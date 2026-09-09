/**
 * activitySystem.js
 * Engine genérico para Atividades de Produção e Sobrevivência do Zona Zero RPG
 *
 * Arquitetura:
 *  - ActivityDefinition: configuração imutável (criada pelo admin no Firestore /activities/{id})
 *  - ActivityState:      estado mutável de instância (Firestore /activity_states/{id})
 *  - ActivityEngine:     funções puras que operam sobre esses dois objetos
 *
 * Princípio de Design:
 *  - Cálculos offline via timestamps — NUNCA dependem da página estar aberta
 *  - Todas as operações de escrita devem ser feitas dentro de runTransaction()
 *  - Nunca duplicar o inventário — sempre usar character.inventory[] existente
 */

// ---------------------------------------------------------------------------
// TIPOS DE ATIVIDADE
// ---------------------------------------------------------------------------

export const ACTIVITY_TYPES = {
  fishing:     { id: 'fishing',     label: 'Pesca',          icon: '🎣' },
  farming:     { id: 'farming',     label: 'Plantação',      icon: '🌱' },
  animal_care: { id: 'animal_care', label: 'Criação Animal', icon: '🐔' },
}

// ---------------------------------------------------------------------------
// CONSTANTES DE DEGRADAÇÃO
// ---------------------------------------------------------------------------

export const FARMING_DEFAULTS = {
  // Degradação de saúde da planta por hora REAL sem cuidado
  healthDecayPerHourReal: 4,
  // Janela de cuidado diário (24h reais)
  careDailyWindowMs: 24 * 60 * 60 * 1000,
  // Saúde crítica → planta pode morrer
  criticalHealthThreshold: 20,
  // Saúde morta
  deadHealthThreshold: 0,
  // Bônus de adubo na saúde
  fertilizerHealthBonus: 20,
  // Teto de saúde
  maxHealth: 100,
}

export const ANIMAL_DEFAULTS = {
  feedingDecayPerHourReal: 3,
  hygieneDecayPerHourReal: 2,
  healthDecayPerHourReal: 2,
  criticalThreshold: 25,
  lowThreshold: 50,
  deathChancePerHourCritical: 0.15,
  aduboPorAnimal: 0.5,
  minhocasPorAnimal: 0.3,
}

// ---------------------------------------------------------------------------
// VALIDADORES DE REQUISITOS E COMPARAÇÃO DE ITENS
// ---------------------------------------------------------------------------

/**
 * Compara se um item do inventário corresponde a um itemId esperado,
 * aceitando variações de nomenclatura, slugs com/sem underline e aliases conhecidos.
 */
export function isItemMatching(item, targetId) {
  if (!item || !targetId) return false
  const itemId = String(item.itemId || '').toLowerCase().trim()
  const cleanTarget = String(targetId || '').toLowerCase().trim()
  const name = String(item.name || '').toLowerCase().trim()

  // 1. Match exato de itemId
  if (itemId === cleanTarget) return true

  // 2. Variações comuns de slug (ex: vara-pesca vs vara_pesca vs varapesca)
  const normId = itemId.replace(/[-_\s]/g, '')
  const normTarget = cleanTarget.replace(/[-_\s]/g, '')
  if (normId === normTarget) return true

  // 3. Aliases específicos de Atividades:
  // Vara de Pesca
  if (cleanTarget === 'vara_pesca' || cleanTarget === 'vara_de_pesca' || cleanTarget === 'varapesca') {
    if (itemId.includes('vara') && itemId.includes('pesca')) return true
    if (itemId === 'vara' || itemId === 'pesca' || itemId.includes('fishing')) return true
    if (name.includes('vara') && (name.includes('pesca') || name.includes('pescar'))) return true
    if (name.includes('vara de pesca') || name.includes('vara artesanal')) return true
  }

  // Enxada / Ferramenta Agrícola
  if (cleanTarget === 'enxada' || cleanTarget === 'enxada_agricola') {
    if (itemId.includes('enxada') || itemId.includes('hoe') || itemId === 'ferramentas_agricolas') return true
    if (name.includes('enxada') || name.includes('enxadão') || name.includes('ferramenta agrícola')) return true
  }

  // Minhoca / Isca
  if (cleanTarget === 'minhoca' || cleanTarget === 'minhocas') {
    if (itemId.includes('minhoca') || itemId.includes('worm') || itemId === 'isca' || itemId.includes('isca_pesca')) return true
    if (name.includes('minhoca') || name.includes('isca viva') || name.includes('isca de pesca')) return true
  }

  // Adubo
  if (cleanTarget === 'adubo' || cleanTarget === 'fertilizante') {
    if (itemId.includes('adubo') || itemId.includes('fertiliz')) return true
    if (name.includes('adubo') || name.includes('fertilizante') || name.includes('composto')) return true
  }

  // Milho
  if (cleanTarget === 'milho' || cleanTarget === 'corn') {
    if (itemId.includes('milho') || itemId.includes('corn')) return true
    if (name.includes('milho') || name.includes('espiga de milho')) return true
  }

  // Garrafa de Água Vazia
  if (cleanTarget === 'garrafa_vazia' || cleanTarget === 'garrafa_de_agua_vazia' || cleanTarget === 'garrafavazia') {
    if (itemId.includes('garrafa') && itemId.includes('vazia')) return true
    if (name.includes('garrafa') && name.includes('vazia')) return true
  }

  // Garrafa de Água Impura
  if (cleanTarget === 'garrafa_agua_impura' || cleanTarget === 'garrafa_de_agua_impura' || cleanTarget === 'agua_impura') {
    if (itemId.includes('impura') || itemId.includes('suja') || itemId.includes('nao_potavel')) return true
    if (name.includes('impura') || name.includes('suja') || name.includes('não potável')) return true
  }

  // Garrafa de Água Potável
  if (cleanTarget === 'garrafa_agua' || cleanTarget === 'garrafa_de_agua' || cleanTarget === 'agua_potavel') {
    if (itemId === 'garrafa_agua' || itemId === 'garrafa_de_agua' || itemId === 'agua_limpa') return true
    if (name.includes('garrafa de água') || name.includes('água potável')) return true
  }

  return false
}

/**
 * Verifica se um item está equipado no personagem (seja em qualquer slot de acessório 1-6 ou mãos).
 */
export function checkEquippedAccessory(inventory, requiredItemId) {
  if (!Array.isArray(inventory)) return { ok: false, item: null }
  const found = inventory.find(item => {
    if (!item || !item.equipped) return false

    // Identifica se está em slot de acessório ou mãos
    const slot = String(item.equippedAsSlot || item.equipSlot || item.equippedSlot || '').toLowerCase()
    const isAccessorySlot = slot.startsWith('accessory_') || slot.startsWith('accessory') || slot === 'hands_weapon' || item.category === 'accessories'

    return isAccessorySlot && isItemMatching(item, requiredItemId)
  })
  return { ok: !!found, item: found }
}

/**
 * Verifica se o inventário tem N unidades de um itemId (ou correspondente).
 */
export function checkInventoryItem(inventory, itemId, quantity = 1) {
  if (!Array.isArray(inventory)) return { ok: false, found: 0 }
  const total = inventory.reduce((acc, i) => {
    if (i && isItemMatching(i, itemId)) return acc + (i.quantity || 1)
    return acc
  }, 0)
  return { ok: total >= quantity, found: total }
}

/**
 * Valida se o personagem possui alguma das ferramentas permitidas equipadas com durabilidade suficiente.
 */
export function validateToolForActivity(activityDef, inventory, durabilityCostOverride = null) {
  if (!Array.isArray(inventory)) return { ok: false, error: 'Inventário inválido.' }

  const cost = Number(durabilityCostOverride ?? activityDef?.durabilityCost ?? 10)

  // Lista de ferramentas permitidas configuradas na atividade
  let allowedTools = activityDef?.allowedTools || []
  if (allowedTools.length === 0) {
    if (activityDef?.requirements?.equipped?.length > 0) {
      allowedTools = activityDef.requirements.equipped.map(r => r.itemId)
    } else if (activityDef?.type === 'fishing') {
      allowedTools = ['vara_pesca']
    } else if (activityDef?.type === 'farming') {
      allowedTools = ['enxada']
    }
  }

  // Procura no inventário por alguma ferramenta permitida que esteja equipada
  let equippedTool = null
  for (const item of inventory) {
    if (!item || !item.equipped) continue
    const slot = String(item.equippedAsSlot || item.equipSlot || item.equippedSlot || '').toLowerCase()
    const isAccessoryOrHand = slot.startsWith('accessory_') || slot.startsWith('accessory') || slot === 'hands_weapon' || item.category === 'accessories'

    if (isAccessoryOrHand) {
      const isAllowed = allowedTools.some(allowedId => isItemMatching(item, allowedId))
      if (isAllowed) {
        equippedTool = item
        break
      }
    }
  }

  if (!equippedTool) {
    const labels = allowedTools.join(', ') || 'ferramenta adequada'
    return {
      ok: false,
      tool: null,
      error: `Equipe uma ferramenta permitida (${labels}) em um slot de Acessório.`
    }
  }

  const maxDur = equippedTool.maxDurability !== undefined ? Number(equippedTool.maxDurability) : 100
  const curDur = equippedTool.durability !== undefined ? Number(equippedTool.durability) : maxDur

  if (curDur < cost || curDur <= 0) {
    return {
      ok: false,
      tool: equippedTool,
      error: `A ${equippedTool.name || 'ferramenta'} está muito danificada para ser utilizada (${curDur}/${maxDur}). Durabilidade necessária: ${cost}.`
    }
  }

  return {
    ok: true,
    tool: equippedTool,
    curDur,
    maxDur,
    cost
  }
}

/**
 * Aplica a redução de durabilidade na ferramenta equipada utilizada na atividade.
 * Garante que a durabilidade não fique negativa e lança erro se a durabilidade for insuficiente.
 */
export function applyToolDurabilityLoss(inventory, toolItemOrInstanceId, durabilityCost = 10) {
  const inv = [...inventory]
  const cost = Math.max(1, Number(durabilityCost || 10))

  let targetIdx = -1
  if (typeof toolItemOrInstanceId === 'string') {
    targetIdx = inv.findIndex(i => i && (i.instanceId === toolItemOrInstanceId || i.itemId === toolItemOrInstanceId) && i.equipped)
    if (targetIdx === -1) {
      targetIdx = inv.findIndex(i => i && (i.instanceId === toolItemOrInstanceId || i.itemId === toolItemOrInstanceId))
    }
  } else if (toolItemOrInstanceId && toolItemOrInstanceId.instanceId) {
    targetIdx = inv.findIndex(i => i && i.instanceId === toolItemOrInstanceId.instanceId)
  }

  if (targetIdx === -1) {
    throw new Error('Ferramenta não encontrada no inventário para aplicar desgaste.')
  }

  const tool = { ...inv[targetIdx] }
  const maxDur = tool.maxDurability !== undefined ? Number(tool.maxDurability) : 100
  const curDur = tool.durability !== undefined ? Number(tool.durability) : maxDur

  if (curDur < cost && curDur <= 0) {
    throw new Error(`A ${tool.name || 'ferramenta'} está quebrada (0/${maxDur}) e não pode ser utilizada.`)
  }

  const newDur = Math.max(0, curDur - cost)
  tool.durability = newDur
  inv[targetIdx] = tool

  return {
    inventory: inv,
    tool,
    oldDurability: curDur,
    newDurability: newDur,
    lostDurability: cost,
    isBroken: newDur <= 0
  }
}

/**
 * Valida todos os requisitos de uma ActivityDefinition para um dado inventário.
 * Retorna array de erros (vazio = ok).
 */
export function validateActivityRequirements(activityDef, inventory) {
  const errors = []

  // Validação de ferramenta permitida e durabilidade
  const toolCheck = validateToolForActivity(activityDef, inventory)
  if (!toolCheck.ok) {
    errors.push(toolCheck.error)
  }

  // Itens no inventário (ex: iscas, sementes)
  const inventoryReqs = activityDef?.requirements?.inventory || []
  for (const req of inventoryReqs) {
    const { ok, found } = checkInventoryItem(inventory, req.itemId, req.quantity || 1)
    if (!ok) {
      errors.push(`📦 Você precisa de ${req.quantity || 1}x ${req.label || req.itemId} (possui: ${found}).`)
    }
  }

  return errors
}

// ---------------------------------------------------------------------------
// CALCULADORES DE ESTADO OFFLINE — PLANTAÇÃO
// ---------------------------------------------------------------------------

/**
 * Calcula o estado atual de uma plantação com base nos timestamps.
 * Pode ser chamado a qualquer momento, mesmo com o jogador offline.
 */
export function calculateFarmingState(state) {
  const now = Date.now()
  const plantedAt    = new Date(state.plantedAt).getTime()
  const lastCaredAt  = new Date(state.lastCaredAt || state.plantedAt).getTime()
  const growthMs     = Number(state.growthDurationMs) || (3 * 24 * 60 * 60 * 1000)

  const elapsedMs      = now - plantedAt
  const remainingMs    = Math.max(0, growthMs - elapsedMs)
  const rawGrowthPct   = Math.min(100, (elapsedMs / growthMs) * 100)
  const hoursWithoutCare = (now - lastCaredAt) / (1000 * 60 * 60)

  const careDailyWindowHours = FARMING_DEFAULTS.careDailyWindowMs / (1000 * 60 * 60)
  const neglectedHours  = Math.max(0, hoursWithoutCare - careDailyWindowHours)
  const healthDecay     = neglectedHours * FARMING_DEFAULTS.healthDecayPerHourReal
  const savedHealth     = Number(state.health ?? 100)
  const currentHealth   = Math.max(0, Math.round(savedHealth - healthDecay))

  const isDead     = currentHealth <= FARMING_DEFAULTS.deadHealthThreshold
  const isCritical = currentHealth <= FARMING_DEFAULTS.criticalHealthThreshold
  const isReady    = rawGrowthPct >= 100 && !isDead

  let status = state.status || 'growing'
  if (isDead) status = 'dead'
  else if (isReady) status = 'ready'

  return {
    health: currentHealth,
    growthPct: Math.round(rawGrowthPct),
    elapsedMs,
    growthMs,
    remainingMs,
    remainingFormatted: formatRemainingTime(remainingMs),
    hoursWithoutCare: Math.round(hoursWithoutCare * 10) / 10,
    isReady,
    isDead,
    isCritical,
    status,
    needsCare: hoursWithoutCare > careDailyWindowHours,
  }
}

/**
 * Calcula a quantidade colhida com base na saúde da plantação e faixas de qualidade.
 */
export function calculateHarvestYield(plotOrSeedConfig, currentHealth) {
  const health = Number(currentHealth ?? 100)
  const threshold = Number(plotOrSeedConfig?.goodConditionThreshold ?? 70)
  const isGoodCondition = health >= threshold

  if (isGoodCondition) {
    const min = Number(plotOrSeedConfig?.goodConditionYield?.min ?? plotOrSeedConfig?.harvestMin ?? 3)
    const max = Number(plotOrSeedConfig?.goodConditionYield?.max ?? plotOrSeedConfig?.harvestMax ?? 6)
    const qty = Math.floor(Math.random() * (max - min + 1)) + min
    return { quantity: Math.max(1, qty), isGoodCondition: true, qualityLabel: 'Boa Condição' }
  } else {
    const min = Number(plotOrSeedConfig?.badConditionYield?.min ?? 1)
    const max = Number(plotOrSeedConfig?.badConditionYield?.max ?? 2)
    const qty = Math.floor(Math.random() * (max - min + 1)) + min
    return { quantity: Math.max(1, qty), isGoodCondition: false, qualityLabel: 'Má Condição' }
  }
}

/**
 * Sorteia descoberta de minhocas ao plantar ou cuidar da horta.
 */
export function rollWormDiscovery(chance = 0.30, min = 1, max = 5) {
  const rollChance = Number(chance !== undefined ? chance : 0.30)
  if (Math.random() < rollChance) {
    const minQ = Math.max(1, Number(min || 1))
    const maxQ = Math.max(minQ, Number(max || 5))
    const quantity = Math.floor(Math.random() * (maxQ - minQ + 1)) + minQ
    return { found: true, quantity }
  }
  return { found: false, quantity: 0 }
}

// ---------------------------------------------------------------------------
// CALCULADORES DE ESTADO OFFLINE — GALINHEIRO
// ---------------------------------------------------------------------------

/**
 * Calcula o estado atual do galinheiro com base nos timestamps.
 */
export function calculateAnimalCareState(state) {
  const now = Date.now()
  const lastFedAt    = new Date(state.lastFedAt    || state.createdAt || now).getTime()
  const lastCleanAt  = new Date(state.lastCleanedAt || state.createdAt || now).getTime()

  const hoursSinceFed   = (now - lastFedAt)   / (1000 * 60 * 60)
  const hoursSinceClean = (now - lastCleanAt) / (1000 * 60 * 60)

  const savedFeeding  = Number(state.feeding ?? 100)
  const currentFeeding = Math.max(0, Math.round(savedFeeding - hoursSinceFed * ANIMAL_DEFAULTS.feedingDecayPerHourReal))

  const savedHygiene  = Number(state.hygiene ?? 100)
  const currentHygiene = Math.max(0, Math.round(savedHygiene - hoursSinceClean * ANIMAL_DEFAULTS.hygieneDecayPerHourReal))

  const savedHealth  = Number(state.health ?? 100)
  const isFeedingLow  = currentFeeding < ANIMAL_DEFAULTS.lowThreshold
  const isHygieneLow  = currentHygiene < ANIMAL_DEFAULTS.lowThreshold
  const isAnyStatLow  = isFeedingLow || isHygieneLow

  const hoursInBadState = isAnyStatLow ? Math.min(hoursSinceFed, hoursSinceClean) : 0
  const healthDecay     = isAnyStatLow ? hoursInBadState * ANIMAL_DEFAULTS.healthDecayPerHourReal : 0
  const currentHealth   = Math.max(0, Math.round(savedHealth - healthDecay))

  const aliveAnimals = Number(state.aliveAnimals ?? state.totalAnimals ?? 0)
  let deadAnimals = 0
  if (currentHealth < 10 && aliveAnimals > 0) {
    const expectedDeaths = Math.floor(hoursInBadState * ANIMAL_DEFAULTS.deathChancePerHourCritical)
    deadAnimals = Math.min(aliveAnimals, expectedDeaths)
  }
  const currentAlive = Math.max(0, aliveAnimals - deadAnimals)

  let status = 'healthy'
  if (currentAlive === 0) status = 'dead'
  else if (currentHealth < ANIMAL_DEFAULTS.criticalThreshold) status = 'sick'
  else if (currentHealth < ANIMAL_DEFAULTS.lowThreshold) status = 'debilitated'

  return {
    feeding: currentFeeding,
    hygiene: currentHygiene,
    health: currentHealth,
    aliveAnimals: currentAlive,
    deadAnimals,
    status,
    isFeedingLow,
    isHygieneLow,
    hoursSinceFed:   Math.round(hoursSinceFed   * 10) / 10,
    hoursSinceClean: Math.round(hoursSinceClean * 10) / 10,
    needsFeeding:  currentFeeding < ANIMAL_DEFAULTS.lowThreshold,
    needsCleaning: currentHygiene < ANIMAL_DEFAULTS.lowThreshold,
  }
}

/**
 * Calcula a produção de adubo ao limpar o galinheiro (minhocas agora são encontradas na plantação).
 */
export function calculateCleaningRewards(aliveAnimals) {
  const adubo = Math.max(1, Math.ceil(aliveAnimals * ANIMAL_DEFAULTS.aduboPorAnimal))
  return { adubo, minhocas: 0 }
}

// ---------------------------------------------------------------------------
// SORTEADOR DE RECOMPENSAS — PESCA (MÁXIMO 1 PEIXE OU 0)
// ---------------------------------------------------------------------------

/**
 * Sorteia uma recompensa de pesca com base na tabela percentual configurada (ou fallback).
 * Garante que cada pescaria resulta em EXATAMENTE 1 PEIXE ou NENHUM PEIXE (null).
 */
export function rollFishingReward(activityDef) {
  // Lista de peixes configurados na atividade ou padrão
  const fishTable = (Array.isArray(activityDef?.fishTable) && activityDef.fishTable.length > 0)
    ? activityDef.fishTable
    : (Array.isArray(activityDef?.rewards) && activityDef.rewards.length > 0)
    ? activityDef.rewards
    : [
        { itemId: 'peixe_pequeno', name: 'Peixe Pequeno', icon: '🐟', chance: 40, rarity: 'common' },
        { itemId: 'peixe_medio',   name: 'Peixe Médio',   icon: '🐠', chance: 25, rarity: 'uncommon' },
        { itemId: 'peixe_grande',  name: 'Peixe Grande',  icon: '🐡', chance: 15, rarity: 'rare' },
      ]

  // Chance de não pegar nada (emptyChance)
  const emptyChance = Number(activityDef?.emptyChance !== undefined ? activityDef.emptyChance : 20)

  // Sorteio de 0 a 100
  const rng = Math.random() * 100

  // 1. Se cair na faixa de "Não pegar nada"
  if (rng < emptyChance) {
    return null
  }

  // 2. Distribui a probabilidade restante entre os peixes cadastrados
  let currentCumulative = emptyChance
  for (const fish of fishTable) {
    const chance = Number(fish.chance ?? fish.weight ?? 0)
    currentCumulative += chance
    if (rng <= currentCumulative) {
      return {
        itemId: fish.itemId,
        name: fish.name || fish.itemId,
        icon: fish.icon || '🐟',
        rarity: fish.rarity || 'common',
        quantity: 1, // REGRA: EXATAMENTE 1 PEIXE POR TENTATIVA
      }
    }
  }

  // Fallback caso a soma das porcentagens ultrapasse 100%
  const lastFish = fishTable[fishTable.length - 1]
  if (lastFish) {
    return {
      itemId: lastFish.itemId,
      name: lastFish.name || lastFish.itemId,
      icon: lastFish.icon || '🐟',
      rarity: lastFish.rarity || 'common',
      quantity: 1,
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// HELPERS DE INVENTÁRIO (para uso dentro de runTransaction)
// ---------------------------------------------------------------------------

/**
 * Remove N unidades de um item do inventário (para uso dentro de transaction).
 * LANÇA erro se não houver quantidade suficiente.
 */
export function consumeItemFromInventory(inventory, itemId, quantity, label) {
  const inv = [...inventory]
  const idx = inv.findIndex(i => i && isItemMatching(i, itemId) && (i.quantity || 1) >= quantity)
  if (idx === -1) throw new Error(`Quantidade insuficiente de ${label || itemId}.`)
  if ((inv[idx].quantity || 1) <= quantity) {
    inv.splice(idx, 1)
  } else {
    inv[idx] = { ...inv[idx], quantity: (inv[idx].quantity || 1) - quantity }
  }
  return inv
}

/**
 * Adiciona itens ao inventário (empilha se já existir o mesmo itemId).
 */
export function addItemToInventory(inventory, itemData) {
  const inv = [...inventory]
  const existing = inv.find(i => i && i.itemId === itemData.itemId && !i.isQuestItem)
  if (existing) {
    existing.quantity = (existing.quantity || 1) + (itemData.quantity || 1)
  } else {
    inv.push({
      instanceId: Math.random().toString(36).substring(2) + Date.now().toString(36),
      itemId: itemData.itemId,
      name: itemData.name || itemData.itemId,
      icon: itemData.icon || '📦',
      quantity: itemData.quantity || 1,
      category: itemData.category || 'general',
      rarity: itemData.rarity || 'common',
      consumable: itemData.consumable ?? false,
      consumeEffect: itemData.consumeEffect || null,
      isQuestItem: false,
      equipped: false,
      description: itemData.description || '',
      obtainedAt: new Date().toISOString(),
      obtainedFrom: itemData.obtainedFrom || 'Atividade de Produção',
    })
  }
  return inv
}

// ---------------------------------------------------------------------------
// GERADOR DE ID ÚNICO
// ---------------------------------------------------------------------------

export function generateActivityStateId(type, locationSlug, ownerUid = '') {
  const rand = Math.random().toString(36).substring(2, 8)
  const ts   = Date.now().toString(36)
  const uid  = ownerUid ? ownerUid.substring(0, 6) : ''
  return `${type}_${locationSlug}_${uid}_${rand}${ts}`.replace(/[^a-zA-Z0-9_]/g, '_')
}

// ---------------------------------------------------------------------------
// FORMATTERS DE UI
// ---------------------------------------------------------------------------

export function formatDuration(ms) {
  if (ms <= 0) return '00:00'
  const totalSec = Math.ceil(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export function formatHoursAgo(hours) {
  if (hours < 0.017) return 'agora mesmo'
  if (hours < 1) return `${Math.round(hours * 60)} min atrás`
  if (hours < 24) return `${Math.round(hours)}h atrás`
  return `${Math.round(hours / 24)} dia(s) atrás`
}

export function formatRemainingTime(ms) {
  if (ms <= 0) return 'Pronto'
  const totalMinutes = Math.ceil(ms / (1000 * 60))
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`
  }
  return `${minutes}min`
}

export function formatGrowthDuration(seedCfg) {
  if (!seedCfg) return ''
  if (seedCfg.growthTimeUnit === 'hours' && seedCfg.growthTimeValue) {
    return `${seedCfg.growthTimeValue} hora${seedCfg.growthTimeValue > 1 ? 's' : ''}`
  }
  if (seedCfg.growthHours && seedCfg.growthHours < 24) {
    return `${seedCfg.growthHours} hora${seedCfg.growthHours > 1 ? 's' : ''}`
  }
  if (seedCfg.growthTimeUnit === 'days' && seedCfg.growthTimeValue) {
    return `${seedCfg.growthTimeValue} dia${seedCfg.growthTimeValue > 1 ? 's' : ''}`
  }
  if (seedCfg.growthDays) {
    if (seedCfg.growthDays < 1) {
      const h = Math.round(seedCfg.growthDays * 24)
      return `${h} hora${h > 1 ? 's' : ''}`
    }
    return `${seedCfg.growthDays} dia${seedCfg.growthDays > 1 ? 's' : ''}`
  }
  if (seedCfg.growthMs) {
    const totalHours = Math.round(seedCfg.growthMs / 3600000)
    if (totalHours < 24) return `${totalHours} hora${totalHours > 1 ? 's' : ''}`
    const days = Math.round(totalHours / 24)
    return `${days} dia${days > 1 ? 's' : ''}`
  }
  return '3 dias'
}

/**
 * Retorna cor da barra de progresso (verde / amarelo / vermelho)
 */
export function getBarColor(value) {
  if (value > 60) return '#4ade80'
  if (value > 30) return '#f59e0b'
  return '#ef4444'
}
