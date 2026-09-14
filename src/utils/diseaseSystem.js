/**
 * diseaseSystem.js
 * Motor Central de Lógica de Doenças, Sintomas, Risco, Tratamento e Moodles.
 * Zona Zero RPG
 */

import {
  DEFAULT_DISEASES,
  DEFAULT_SYMPTOMS,
  DEFAULT_MOODLES,
  DEFAULT_MEDICINE_TREATMENTS,
} from './diseaseDefaults'
import { calculateTraitModifiers } from './traitsSystem'

// =============================================================================
// 1. CÁLCULO DE RESISTÊNCIA BIOLÓGICA DO PERSONAGEM
// =============================================================================

/**
 * Calcula a resistência biológica do personagem contra doenças.
 * Derivada de:
 * - Atributo base de Constituição
 * - Bônus/penalidades de traços (ex: Em Forma +3, Acima do Peso -3)
 * - Vantagem "Alta Imunidade" (+5 resistência) / Desvantagem "Baixa Imunidade" (-5 resistência)
 * - Condição de higiene (Banho recente +2 resistência / Falta de higiene -3)
 */
export function calculateCharacterResistance(character) {
  const baseAttrs = character?.baseAttributes || character?.attributes || {}
  const baseCon = Number(baseAttrs.constituicao ?? 1)

  // Traços de atributos
  const traitMods = calculateTraitModifiers(character?.traits || [])
  const conTraitMod = Number(traitMods.constituicao || 0)

  // Vantagens e Desvantagens (Perks)
  const perks = Array.isArray(character?.perks) ? character.perks : []
  let perkBonus = 0
  if (perks.includes('alta_imunidade')) perkBonus += 5
  if (perks.includes('baixa_imunidade')) perkBonus -= 5

  // Bônus/Penalidade de Higiene
  // 1 dia in-game = 12h reais (43.200.000 ms)
  const hygiene = character?.hygiene || { level: 100, lastBathTime: Date.now() }
  const msSinceLastBath = Date.now() - (hygiene.lastBathTime || Date.now())
  const hoursSinceBath = msSinceLastBath / (1000 * 60 * 60)
  
  let hygieneBonus = 0
  let hygieneLabel = 'Higienizado'
  if (hoursSinceBath > 24 || (hygiene.level !== undefined && hygiene.level < 25)) {
    hygieneBonus = -3
    hygieneLabel = 'Higiene Ruim (Vulnerável)'
  } else if (hoursSinceBath > 12 || (hygiene.level !== undefined && hygiene.level < 60)) {
    hygieneBonus = -1
    hygieneLabel = 'Higiene Regular'
  } else {
    hygieneBonus = 2
    hygieneLabel = 'Limpo & Higienizado'
  }

  const effectiveCon = baseCon + conTraitMod
  const totalResistance = effectiveCon + perkBonus + hygieneBonus

  return {
    baseCon,
    conTraitMod,
    effectiveCon,
    perkBonus,
    hygieneBonus,
    hygieneLabel,
    totalResistance,
  }
}

// =============================================================================
// 2. FÓRMULA DE RISCO E INSTANCIAÇÃO DE DOENÇA
// =============================================================================

/**
 * Avalia a chance de infecção a partir de uma fonte de exposição e do risco acumulado.
 *
 * @param {Object} character - Personagem atual
 * @param {string} exposureType - 'thermal_exposure' | 'water_impure' | 'wound' | 'bad_hygiene'
 * @param {number} exposureValue - Valor numérico da exposição
 * @param {Object} customConfig - Configurações globais de doenças
 * @returns {Object} { infected: boolean, diseaseId: string|null, reason: string }
 */
export function evaluateInfectionRisk(character, exposureType, exposureValue = 10, customConfig = null) {
  const { totalResistance, perkBonus, hygieneBonus } = calculateCharacterResistance(character)
  const diseasesMap = customConfig?.diseases || DEFAULT_DISEASES

  // Resistência mínima para evitar divisão por zero ou chances negativas
  const clampedResistance = Math.max(1, totalResistance + 10)

  // 1. EXPOSIÇÃO RESPIRATÓRIA (FRIO / CHUVA / TEMPESTADE)
  if (exposureType === 'thermal_exposure' || exposureType === 'cold' || exposureType === 'rain') {
    // Chance base proporcional à exposição térmica acumulada
    const baseChance = (exposureValue / (clampedResistance * 6.5))
    const roll = Math.random()

    if (roll < baseChance) {
      // Determina gravidade com base na intensidade da exposição
      const currentDiseases = character?.diseases || []
      const hasCold = currentDiseases.some(d => d.diseaseId === 'resfriado' && !d.cured)
      const hasFlu = currentDiseases.some(d => d.diseaseId === 'gripe' && !d.cured)

      let selectedDiseaseId = 'resfriado'
      if (exposureValue > 70 || (hasFlu && exposureValue > 40)) {
        selectedDiseaseId = 'pneumonia'
      } else if (exposureValue > 35 || hasCold) {
        selectedDiseaseId = 'gripe'
      }

      // Se já tem essa mesma doença ativa, não duplica
      const alreadyActive = currentDiseases.some(d => d.diseaseId === selectedDiseaseId && !d.cured)
      if (alreadyActive) {
        return { infected: false, diseaseId: null, reason: 'Já possui a doença em curso.' }
      }

      return {
        infected: true,
        diseaseId: selectedDiseaseId,
        diseaseName: diseasesMap[selectedDiseaseId]?.name || selectedDiseaseId,
        reason: `Exposição térmica acumulada (${Math.round(exposureValue)} pts) superou a resistência corporal.`
      }
    }
  }

  // 2. EXPOSIÇÃO GASTROINTESTINAL (ÁGUA IMPURA)
  if (exposureType === 'water_impure') {
    // Beber água impura tem risco alto inerente (35% a 65% dependendo da imunidade e higiene)
    let baseRisk = 0.50
    if (perkBonus > 0) baseRisk -= 0.20
    if (perkBonus < 0) baseRisk += 0.20
    if (hygieneBonus < 0) baseRisk += 0.15

    const roll = Math.random()
    if (roll < baseRisk) {
      // Se higiene muito ruim ou resistência muito baixa, pode evoluir para infecção severa
      const isSevere = hygieneBonus < 0 || clampedResistance < 8 || Math.random() < 0.25
      const selectedDiseaseId = isSevere ? 'infeccao_intestinal' : 'gastroenterite'

      const currentDiseases = character?.diseases || []
      const alreadyActive = currentDiseases.some(d => d.diseaseId === selectedDiseaseId && !d.cured)
      if (alreadyActive) {
        return { infected: false, diseaseId: null, reason: 'Já possui infecção gastrointestinal em curso.' }
      }

      return {
        infected: true,
        diseaseId: selectedDiseaseId,
        diseaseName: diseasesMap[selectedDiseaseId]?.name || selectedDiseaseId,
        reason: 'Ingestão de agentes patogênicos presentes na água crua/não purificada.'
      }
    }
  }

  // 3. EXPOSIÇÃO MANUAL / FERIMENTO NARRATIVO
  if (exposureType === 'wound') {
    return {
      infected: true,
      diseaseId: 'pneumonia',
      diseaseName: 'Pneumonia Bacteriana',
      reason: 'Complicação infecciosa provocada por ferimento aberto exposto.'
    }
  }

  return { infected: false, diseaseId: null, reason: 'O organismo combateu o agente infeccioso.' }
}

/**
 * Cria uma nova instância de doença com incubação e histórico.
 */
export function createDiseaseInstance(diseaseId, source = 'exposure', customConfig = null) {
  const diseasesMap = customConfig?.diseases || DEFAULT_DISEASES
  const diseaseDef = diseasesMap[diseaseId]
  if (!diseaseDef) return null

  const instanceId = `dis_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
  const incubationMinutes = Number(diseaseDef.incubationMinutes ?? 30)

  return {
    instanceId,
    diseaseId,
    name: diseaseDef.name,
    source,
    startedAt: Date.now(),
    incubationMinutes,
    stageIndex: 0, // 0 = Incubação silenciosa
    stageElapsedMinutes: 0,
    totalElapsedMinutes: 0,
    activeSymptoms: [],
    cured: false,
    history: [
      {
        timestamp: Date.now(),
        event: 'Início da Incubação',
        description: `Exposição por ${source} registrada. Período de incubação de ${incubationMinutes} minutos de jogo ativo.`
      }
    ]
  }
}

// =============================================================================
// 3. PROGRESSÃO ONLINE (TICK A CADA CICLO DA SESSÃO)
// =============================================================================

/**
 * Executa um ciclo de progressão temporal para o personagem online.
 * Atualiza exposição térmica, avança incubação/estágios e determina sintomas.
 *
 * @param {Object} character - Dados do personagem
 * @param {number} elapsedMinutes - Minutos decorridos na sessão ativa
 * @param {Object} thermalCondition - Condição térmica calculada (de thermalSystem)
 * @param {Object} customConfig - Configurações globais do Firestore
 * @returns {Object} Próximo estado do personagem
 */
export function processDiseasesTick(character, elapsedMinutes = 0.33, thermalCondition = null, customConfig = null) {
  if (!character) return { character, hasChanges: false }

  const diseasesMap = customConfig?.diseases || DEFAULT_DISEASES
  const symptomsMap = customConfig?.symptoms || DEFAULT_SYMPTOMS

  let hasChanges = false
  const updatedDiseases = [...(character.diseases || [])]
  let currentExposure = Number(character.thermalExposure || 0)
  const historyLog = [...(character.diseaseHistory || [])]

  // 1. PROGRESSÃO DA EXPOSIÇÃO TÉRMICA
  if (thermalCondition) {
    const delta = (thermalCondition.exposureDeltaPerMin || 0) * elapsedMinutes
    const nextExposure = Math.max(0, Math.min(100, Number((currentExposure + delta).toFixed(2))))

    if (nextExposure !== currentExposure) {
      currentExposure = nextExposure
      hasChanges = true
    }

    // Se o frio acumulou além de 25 pontos, faz teste periódico para resfriado/gripe
    if (currentExposure >= 25) {
      const riskCheck = evaluateInfectionRisk(character, 'thermal_exposure', currentExposure, customConfig)
      if (riskCheck.infected && riskCheck.diseaseId) {
        const newInstance = createDiseaseInstance(riskCheck.diseaseId, 'thermal_exposure', customConfig)
        if (newInstance) {
          updatedDiseases.push(newInstance)
          historyLog.unshift({
            timestamp: Date.now(),
            diseaseId: riskCheck.diseaseId,
            diseaseName: newInstance.name,
            event: 'Infecção Adquirida',
            description: riskCheck.reason
          })
          hasChanges = true
        }
      }
    }
  }

  // 2. PROGRESSÃO DAS DOENÇAS ATIVAS
  updatedDiseases.forEach((dis, idx) => {
    if (dis.cured) return

    const diseaseDef = diseasesMap[dis.diseaseId]
    if (!diseaseDef) return

    dis.totalElapsedMinutes = Number(((dis.totalElapsedMinutes || 0) + elapsedMinutes).toFixed(2))
    dis.stageElapsedMinutes = Number(((dis.stageElapsedMinutes || 0) + elapsedMinutes).toFixed(2))

    // Estágio 0: Período de Incubação
    if (dis.stageIndex === 0) {
      if (dis.stageElapsedMinutes >= (dis.incubationMinutes || 30)) {
        // Concluiu incubação -> avança para Estágio 1
        dis.stageIndex = 1
        dis.stageElapsedMinutes = 0
        dis.activeSymptoms = rollStageSymptoms(diseaseDef, 1, symptomsMap)
        dis.history = dis.history || []
        dis.history.unshift({
          timestamp: Date.now(),
          event: 'Fim da Incubação / Primeiros Sintomas',
          description: `Os primeiros sintomas de ${dis.name} começaram a se manifestar no corpo.`
        })
        historyLog.unshift({
          timestamp: Date.now(),
          diseaseId: dis.diseaseId,
          diseaseName: dis.name,
          event: 'Manifestação de Sintomas',
          description: `Sintomas iniciais ativos: ${dis.activeSymptoms.map(s => symptomsMap[s.symptomId]?.name || s.symptomId).join(', ')}.`
        })
        hasChanges = true
      }
    } else {
      // Estágios Ativos (1, 2, 3...)
      const stages = diseaseDef.stages || []
      const currentStageDef = stages.find(s => s.stageIndex === dis.stageIndex) || stages[dis.stageIndex - 1]
      const stageDuration = currentStageDef?.durationMinutes || 60

      if (dis.stageElapsedMinutes >= stageDuration) {
        const nextStageIndex = dis.stageIndex + 1
        const nextStageDef = stages.find(s => s.stageIndex === nextStageIndex)

        if (nextStageDef) {
          // Avança para o próximo estágio
          dis.stageIndex = nextStageIndex
          dis.stageElapsedMinutes = 0
          dis.activeSymptoms = rollStageSymptoms(diseaseDef, nextStageIndex, symptomsMap)
          dis.history = dis.history || []
          dis.history.unshift({
            timestamp: Date.now(),
            event: `Evolução para Estágio ${nextStageIndex}`,
            description: `A doença evoluiu para ${nextStageDef.name}.`
          })
          historyLog.unshift({
            timestamp: Date.now(),
            diseaseId: dis.diseaseId,
            diseaseName: dis.name,
            event: `Mudança de Estágio (${nextStageIndex})`,
            description: `Estágio: ${nextStageDef.name}. Sintomas: ${dis.activeSymptoms.map(s => symptomsMap[s.symptomId]?.name || s.symptomId).join(', ')}.`
          })
          hasChanges = true
        } else {
          // Não há mais estágios: Doença curada pelo próprio organismo!
          dis.cured = true
          dis.curedAt = Date.now()
          dis.activeSymptoms = []
          dis.history = dis.history || []
          dis.history.unshift({
            timestamp: Date.now(),
            event: 'Recuperação Concluída',
            description: `O sistema imunológico debelou completamente a doença ${dis.name}.`
          })
          historyLog.unshift({
            timestamp: Date.now(),
            diseaseId: dis.diseaseId,
            diseaseName: dis.name,
            event: 'Recuperação Concluída',
            description: `O sobrevivente se recuperou totalmente de ${dis.name}.`
          })
          hasChanges = true
        }
      }
    }
  })

  // 3. RETORNO DO ESTADO
  const nextCharacter = {
    ...character,
    thermalExposure: currentExposure,
    diseases: updatedDiseases.filter(d => !d.cured || (Date.now() - (d.curedAt || 0) < 300000)), // Mantém curadas por 5 min para feedback
    diseaseHistory: historyLog.slice(0, 50), // Mantém histórico recente limpo
  }

  return {
    character: nextCharacter,
    hasChanges,
  }
}

/**
 * Sorteia sintomas de um estágio com base nas chances configuradas.
 */
export function rollStageSymptoms(diseaseDef, stageIndex, symptomsMap) {
  const stages = diseaseDef?.stages || []
  const stageDef = stages.find(s => s.stageIndex === stageIndex) || stages[stageIndex - 1]
  if (!stageDef || !Array.isArray(stageDef.symptoms)) return []

  const activeSymptoms = []
  stageDef.symptoms.forEach(sym => {
    const chance = sym.chance ?? 1.0
    if (Math.random() <= chance) {
      activeSymptoms.push({
        symptomId: sym.symptomId,
        level: sym.level || 1,
      })
    }
  })

  // Garante ao menos 1 sintoma se o estágio tiver lista
  if (activeSymptoms.length === 0 && stageDef.symptoms.length > 0) {
    const fallback = stageDef.symptoms[0]
    activeSymptoms.push({
      symptomId: fallback.symptomId,
      level: fallback.level || 1,
    })
  }

  return activeSymptoms
}

// =============================================================================
// 4. DERIVAÇÃO DE PENALIDADES DE ATRIBUTOS E MOODLES ATIVOS
// =============================================================================

/**
 * Agrupa todos os sintomas de doenças ativas e calcula as penalidades temporárias nos atributos.
 *
 * @param {Array} diseases - Lista de doenças do personagem
 * @param {Object} customConfig - Configurações globais
 * @returns {Object} { penalties, reasons, activeSymptomsMap }
 */
export function getActiveDiseasePenalties(diseases = [], customConfig = null) {
  const symptomsMap = customConfig?.symptoms || DEFAULT_SYMPTOMS
  const diseasesMap = customConfig?.diseases || DEFAULT_DISEASES

  const penalties = {
    forca: 0,
    destreza: 0,
    agilidade: 0,
    sabedoria: 0,
    percepcao: 0,
    inteligencia: 0,
    carisma: 0,
    constituicao: 0,
  }

  const reasons = []
  const activeSymptomsMap = {}

  if (!Array.isArray(diseases)) return { penalties, reasons, activeSymptomsMap }

  // Consolida o nível mais alto para cada sintoma (sem duplicar penalidades de mesma origem)
  diseases.forEach(dis => {
    if (dis.cured) return
    const dId = dis.diseaseId || dis.id
    const diseaseDef = diseasesMap[dId]

    let symptoms = Array.isArray(dis.activeSymptoms) ? [...dis.activeSymptoms] : []

    // Se o estágio não for 0 e a lista de sintomas estiver vazia, gera dinamicamente a partir da definição
    if (symptoms.length === 0 && diseaseDef && (dis.stageIndex === undefined || dis.stageIndex > 0 || (dis.stage && dis.stage !== 'incubation'))) {
      const targetStage = Number(dis.stageIndex) || 1
      symptoms = rollStageSymptoms(diseaseDef, targetStage, symptomsMap)
    }

    // Incubação pura não aplica penalidades mecânicas
    if (dis.stageIndex === 0 || dis.stage === 'incubation') return

    symptoms.forEach(sym => {
      const sId = typeof sym === 'string' ? sym : sym?.symptomId
      const lvl = typeof sym === 'object' ? (Number(sym?.level) || 1) : 1
      if (!sId) return

      const existingLevel = activeSymptomsMap[sId]?.level || 0
      if (lvl > existingLevel) {
        activeSymptomsMap[sId] = {
          symptomId: sId,
          level: lvl,
          diseaseName: dis.name || diseaseDef?.name || dId,
        }
      }
    })
  })

  // Aplica as penalidades dos sintomas consolidados
  Object.values(activeSymptomsMap).forEach(({ symptomId, level }) => {
    const symDef = symptomsMap[symptomId]
    if (!symDef) return

    const levelData = symDef.levels?.[level] || symDef.levels?.[1]
    if (!levelData) return

    const symPenalties = levelData.penalties || {}
    let appliedAny = false
    const penaltyParts = []

    Object.entries(symPenalties).forEach(([attrKey, val]) => {
      if (penalties[attrKey] !== undefined && val !== 0) {
        penalties[attrKey] += val
        appliedAny = true
        penaltyParts.push(`${attrKey.toUpperCase().substring(0, 3)} ${val > 0 ? `+${val}` : val}`)
      }
    })

    const penaltySuffix = penaltyParts.length > 0 ? ` (${penaltyParts.join(', ')})` : ''
    reasons.push(`🤒 ${symDef.name}: ${levelData.label}${penaltySuffix}`)
  })

  return {
    penalties,
    reasons,
    activeSymptomsMap,
  }
}

/**
 * Deriva a lista ordenada de Moodles visuais que devem aparecer na tela do jogador.
 *
 * @param {Array} diseases - Lista de doenças ativas do personagem
 * @param {Object} customConfig - Configurações globais
 * @returns {Array} Lista de moodles formatados para o HUD
 */
export function getActiveMoodles(diseases = [], customConfig = null) {
  const symptomsMap = customConfig?.symptoms || DEFAULT_SYMPTOMS
  const moodlesConfig = customConfig?.moodles || DEFAULT_MOODLES

  const { activeSymptomsMap } = getActiveDiseasePenalties(diseases, customConfig)
  const renderedMoodles = []

  Object.values(activeSymptomsMap).forEach(({ symptomId, level }) => {
    const symDef = symptomsMap[symptomId]
    if (!symDef) return

    const moodleId = symDef.moodleId
    const moodleDef = moodlesConfig[moodleId]
    if (!moodleDef || moodleDef.active === false) return

    const levelData = symDef.levels?.[level] || symDef.levels?.[1] || {}
    
    // Imagem personalizada: se houver por nível, ou global do moodle, ou ícone emoji fallback
    const customImg = moodleDef.imagesByLevel?.[level] || moodleDef.customImageUrl || ''
    const icon = moodleDef.defaultIcon || '⚠️'

    renderedMoodles.push({
      id: `${moodleId}_lvl_${level}`,
      moodleId,
      symptomId,
      name: symDef.name,
      level,
      levelLabel: levelData.label || `Intensidade ${level}`,
      description: levelData.desc || symDef.description,
      icon,
      customImg,
      priority: Number(moodleDef.priority || 5),
    })
  })

  // Se houver alguma doença ativa em incubação silenciosa sem outros moodles na tela, mostra o moodle "Sentindo-se Estranho" (estilo Project Zomboid)
  const incubating = (Array.isArray(diseases) ? diseases : []).filter(d => !d.cured && (d.stageIndex === 0 || d.stage === 'incubation'))
  if (incubating.length > 0 && renderedMoodles.length === 0) {
    const incMoodleDef = moodlesConfig['moodle_nausea'] || moodlesConfig['moodle_cansaco']
    renderedMoodles.push({
      id: 'moodle_incubacao',
      moodleId: 'moodle_nausea',
      symptomId: 'nausea',
      name: 'Mal-Estar',
      level: 1,
      levelLabel: 'Sentindo-se Estranho',
      description: 'Você sente seu corpo estranho e um desconforto sutil. Algo parece estar se desenvolvendo no seu organismo...',
      icon: '🤢',
      customImg: incMoodleDef?.imagesByLevel?.[1] || incMoodleDef?.customImageUrl || '',
      priority: 2,
    })
  }

  // Ordena por prioridade decrescente (maior prioridade no topo)
  renderedMoodles.sort((a, b) => b.priority - a.priority)

  return renderedMoodles
}

// =============================================================================
// 5. TRATAMENTO COM REMÉDIOS E CURA
// =============================================================================

/**
 * Trata ou cura doenças ao consumir um medicamento.
 *
 * @param {Object} character - Dados do personagem
 * @param {Object} item - Item consumido
 * @param {Object} customConfig - Configurações globais
 * @returns {Object} { treated: boolean, curedCount: number, message: string, updatedDiseases, updatedHistory }
 */
export function applyMedicineTreatment(character, item, customConfig = null) {
  if (!character || !item) return { treated: false, message: 'Item inválido.' }

  const medicinesMap = customConfig?.medicines || DEFAULT_MEDICINE_TREATMENTS
  const diseasesMap = customConfig?.diseases || DEFAULT_DISEASES

  const itemIdKey = item.itemId || item.id || ''
  const medDef = medicinesMap[itemIdKey] || (item.cureDiseases ? item : null)

  if (!medDef || (!Array.isArray(medDef.cureDiseases) && !Array.isArray(medDef.relieveSymptoms))) {
    return { treated: false, message: 'Este item não possui propriedades medicinais específicas.' }
  }

  const cureDiseases = medDef.cureDiseases || []
  const currentDiseases = [...(character.diseases || [])]
  const historyLog = [...(character.diseaseHistory || [])]
  let curedCount = 0
  const curedNames = []

  currentDiseases.forEach(dis => {
    if (!dis.cured && cureDiseases.includes(dis.diseaseId)) {
      dis.cured = true
      dis.curedAt = Date.now()
      dis.activeSymptoms = []
      dis.history = dis.history || []
      dis.history.unshift({
        timestamp: Date.now(),
        event: 'Tratado com Medicamento',
        description: `Curado pelo consumo de ${item.name || 'Medicamento'}.`
      })

      historyLog.unshift({
        timestamp: Date.now(),
        diseaseId: dis.diseaseId,
        diseaseName: dis.name,
        event: 'Cura Medicamentosa',
        description: `O sobrevivente foi tratado com ${item.name || 'Medicamento'}. A doença foi eliminada.`
      })

      curedCount++
      curedNames.push(dis.name)
    }
  })

  if (curedCount > 0) {
    return {
      treated: true,
      curedCount,
      message: medDef.successMessage || `O medicamento fez efeito! ${curedNames.join(', ')} foi curada com sucesso.`,
      updatedDiseases: currentDiseases,
      updatedHistory: historyLog,
    }
  }

  return {
    treated: true,
    curedCount: 0,
    message: `${item.name}: O medicamento foi administrado como preventivo. Nenhum patógeno ativo correspondente foi encontrado.`,
    updatedDiseases: currentDiseases,
    updatedHistory: historyLog,
  }
}
