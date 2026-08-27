// Utilitários e regras do sistema avançado de itens, busca e inventário

export const SUPPLY_RARITIES = ['junk', 'common', 'uncommon']
export const UNIQUE_RARITIES = ['rare', 'very_rare', 'exceptional']

export const RARITY_META = {
  junk:        { id: 'junk',        label: 'Sucata',       color: '#9e9e9e', bg: 'rgba(158, 158, 158, 0.15)', border: '#757575', icon: '🔩' },
  common:      { id: 'common',      label: 'Comum',        color: '#ffffff', bg: 'rgba(255, 255, 255, 0.12)', border: '#e0e0e0', icon: '⚪' },
  uncommon:    { id: 'uncommon',    label: 'Incomum',      color: '#4caf50', bg: 'rgba(76, 175, 80, 0.18)',   border: '#4caf50', icon: '🟢' },
  rare:        { id: 'rare',        label: 'Raro',         color: '#2196f3', bg: 'rgba(33, 150, 243, 0.22)',  border: '#2196f3', icon: '🔵' },
  very_rare:   { id: 'very_rare',   label: 'Muito Raro',   color: '#9c27b0', bg: 'rgba(156, 39, 176, 0.25)',  border: '#9c27b0', icon: '🟣' },
  exceptional: { id: 'exceptional', label: 'Excepcional',  color: '#ff9800', bg: 'rgba(255, 152, 0, 0.28)',   border: '#ff9800', icon: '🟠' },
}

export const DEFAULT_PRESET_ITEMS = [
  // COZINHA
  { itemId: 'saco_lixo', name: 'Sacos de Lixo', icon: '🗑️', category: 'general', rarity: 'junk', consumable: false, isQuestItem: false, description: 'Sacos plásticos usados para descarte ou contenção rápida.' },
  { itemId: 'talheres_pratos', name: 'Pratos e Talheres', icon: '🍽️', category: 'general', rarity: 'junk', consumable: false, isQuestItem: false, description: 'Utensílios de cozinha comuns.' },
  { itemId: 'alimento_perecivel', name: 'Restos de Alimentos', icon: '🍞', category: 'general', rarity: 'junk', consumable: true, consumeEffect: { hunger: 5, thirst: -5 }, isQuestItem: false, description: 'Comida já passada, use com cuidado.' },
  { itemId: 'comida_enlatada', name: 'Comida Enlatada', icon: '🥫', category: 'general', rarity: 'common', consumable: true, consumeEffect: { hunger: 30 }, isQuestItem: false, description: 'Alimento preservado de longa duração.' },
  { itemId: 'mantimentos_secos', name: 'Pacote de Mantimentos', icon: '🌾', category: 'general', rarity: 'common', consumable: true, consumeEffect: { hunger: 20 }, isQuestItem: false, description: 'Macarrão, arroz ou farinha.' },
  { itemId: 'garrafa_agua', name: 'Garrafa de Água', icon: '💧', category: 'general', rarity: 'common', consumable: true, consumeEffect: { thirst: 35 }, isQuestItem: false, description: 'Água mineral potável e limpa.' },
  { itemId: 'cereais', name: 'Caixa de Cereais', icon: '🥣', category: 'general', rarity: 'common', consumable: true, consumeEffect: { hunger: 15 }, isQuestItem: false, description: 'Cereais crocantes açucarados.' },
  { itemId: 'cafe_cha', name: 'Café e Chá', icon: '☕', category: 'general', rarity: 'common', consumable: true, consumeEffect: { thirst: 10, hunger: 5 }, isQuestItem: false, description: 'Pó de café e sachês de infusão.' },
  { itemId: 'produto_limpeza', name: 'Produto de Limpeza', icon: '🧴', category: 'general', rarity: 'common', consumable: false, isQuestItem: false, description: 'Detergente e desinfetante.' },
  { itemId: 'abridor_latas', name: 'Abridor de Latas', icon: '🧰', category: 'general', rarity: 'uncommon', consumable: false, isQuestItem: false, description: 'Ferramenta compacta para abrir conservas.' },
  { itemId: 'isqueiro_fosforo', name: 'Isqueiro e Fósforos', icon: '🔥', category: 'general', rarity: 'uncommon', consumable: false, isQuestItem: false, description: 'Fonte portátil para fazer fogo.' },
  { itemId: 'faca_cozinha', name: 'Faca de Cozinha', icon: '🔪', category: 'melee', rarity: 'uncommon', consumable: false, isQuestItem: false, description: 'Lâmina afiada usada na culinária e defesa.' },
  { itemId: 'panela_frigideira', name: 'Panela de Ferro', icon: '🍳', category: 'melee', rarity: 'uncommon', consumable: false, isQuestItem: false, description: 'Utensílio culinário resistente e pesado.' },

  // QUARTO
  { itemId: 'livros_revistas', name: 'Livros e Revistas', icon: '📚', category: 'general', rarity: 'junk', consumable: false, isQuestItem: false, description: 'Leituras do velho mundo.' },
  { itemId: 'celular_descarregado', name: 'Celular sem Bateria', icon: '📱', category: 'general', rarity: 'junk', consumable: false, isQuestItem: false, description: 'Aparelho inútil sem rede elétrica.' },
  { itemId: 'dinheiro_papel', name: 'Notas de Dinheiro', icon: '💵', category: 'general', rarity: 'junk', consumable: false, isQuestItem: false, description: 'Cédulas de papel sem valor comercial atual.' },
  { itemId: 'roupas_comuns', name: 'Roupas Comuns', icon: '👕', category: 'clothing', rarity: 'common', consumable: false, isQuestItem: false, description: 'Camisa e calça em bom estado.' },
  { itemId: 'meias', name: 'Par de Meias', icon: '🧦', category: 'clothing', rarity: 'common', consumable: false, isQuestItem: false, description: 'Mantém os pés secos e protegidos.' },
  { itemId: 'calcados_tenis', name: 'Tênis Resistente', icon: '👟', category: 'clothing', rarity: 'common', consumable: false, isQuestItem: false, description: 'Calçado confortável para caminhadas longas.' },
  { itemId: 'bandagem', name: 'Bandagem Estéril', icon: '🩹', category: 'medical', rarity: 'common', consumable: true, consumeEffect: { blood: 25 }, isQuestItem: false, description: 'Estanca sangramentos leves e protege feridas.' },
  { itemId: 'remedio_basico', name: 'Remédios Básicos', icon: '💊', category: 'medical', rarity: 'common', consumable: true, consumeEffect: { blood: 15, hunger: -5 }, isQuestItem: false, description: 'Analgésicos e anti-inflamatórios.' },
  { itemId: 'perfume', name: 'Vidro de Perfume', icon: '✨', category: 'general', rarity: 'common', consumable: false, isQuestItem: false, description: 'Fragrância ainda preservada.' },
  { itemId: 'carregador_cabos', name: 'Carregador e Cabos', icon: '🔌', category: 'general', rarity: 'uncommon', consumable: false, isQuestItem: false, description: 'Cabos elétricos diversos.' },
  { itemId: 'mochila_pequena', name: 'Mochila Pequena', icon: '🎒', category: 'general', rarity: 'uncommon', consumable: false, isQuestItem: false, description: 'Espaço extra de transporte.' },
  { itemId: 'chaves_genericas', name: 'Molho de Chaves', icon: '🗝️', category: 'general', rarity: 'uncommon', consumable: false, isQuestItem: false, description: 'Chaves de portas e cadeados residenciais.' },
  { itemId: 'oculos_grau', name: 'Óculos', icon: '👓', category: 'clothing', rarity: 'uncommon', consumable: false, isQuestItem: false, description: 'Óculos com armação preservada.' },
  { itemId: 'relogio_pulso', name: 'Relógio de Pulso', icon: '⌚', category: 'general', rarity: 'rare', unlocks: ['hud_clock'], consumable: false, isQuestItem: false, description: 'Relógio mecânico analógico. Permite ver o horário exato.' },

  // BANHEIRO
  { itemId: 'papel_higienico', name: 'Papel Higiênico', icon: '🧻', category: 'general', rarity: 'junk', consumable: false, isQuestItem: false, description: 'Item essencial de higiene pessoal.' },
  { itemId: 'sabonete', name: 'Sabonete', icon: '🧼', category: 'general', rarity: 'common', consumable: false, isQuestItem: false, description: 'Barra de sabão higiênico.' },
  { itemId: 'shampoo', name: 'Frasco de Shampoo', icon: '🧴', category: 'general', rarity: 'common', consumable: false, isQuestItem: false, description: 'Higiene e cuidado pessoal.' },
  { itemId: 'pasta_escova', name: 'Pasta e Escova de Dentes', icon: '🪥', category: 'general', rarity: 'common', consumable: false, isQuestItem: false, description: 'Higiene bucal.' },
  { itemId: 'desodorante', name: 'Desodorante', icon: '🫧', category: 'general', rarity: 'common', consumable: false, isQuestItem: false, description: 'Aerossol para proteção contra odores.' },
  { itemId: 'lamina_barbear', name: 'Lâminas de Barbear', icon: '🪒', category: 'general', rarity: 'uncommon', consumable: false, isQuestItem: false, description: 'Lâminas finas e afiadas.' },
  { itemId: 'alcool_antisseptico', name: 'Álcool 70%', icon: '🧪', category: 'medical', rarity: 'uncommon', consumable: true, consumeEffect: { blood: 10 }, isQuestItem: false, description: 'Desinfeta ferimentos e esteriliza ferramentas.' },

  // GARAGEM / ÁREA DE SERVIÇO
  { itemId: 'pregos_parafusos', name: 'Caixa de Pregos e Parafusos', icon: '🔩', category: 'general', rarity: 'junk', consumable: false, isQuestItem: false, description: 'Peças metálicas para carpintaria.' },
  { itemId: 'pregadores', name: 'Pregadores de Roupa', icon: '📎', category: 'general', rarity: 'junk', consumable: false, isQuestItem: false, description: 'Presilhas plásticas e de madeira.' },
  { itemId: 'tabua_madeira', name: 'Tábua de Madeira', icon: '🪵', category: 'melee', rarity: 'junk', consumable: false, isQuestItem: false, description: 'Pedaço de tábua que pode ser improvisado.' },
  { itemId: 'fita_adesiva', name: 'Fita Adesiva Reforçada', icon: '🩹', category: 'general', rarity: 'common', consumable: false, isQuestItem: false, description: 'Fita adesiva de alta resistência.' },
  { itemId: 'luvas_trabalho', name: 'Luvas de Proteção', icon: '🧤', category: 'clothing', rarity: 'common', consumable: false, isQuestItem: false, description: 'Protegem as mãos contra detritos e cortes.' },
  { itemId: 'chave_fenda', name: 'Chave de Fenda', icon: '🪛', category: 'melee', rarity: 'uncommon', consumable: false, isQuestItem: false, description: 'Ferramenta de manutenção e perfuração.' },
  { itemId: 'alicate', name: 'Alicate Universal', icon: '🔧', category: 'melee', rarity: 'uncommon', consumable: false, isQuestItem: false, description: 'Corta fios e prende estruturas.' },
  { itemId: 'martelo', name: 'Martelo de Orelha', icon: '🔨', category: 'melee', rarity: 'uncommon', consumable: false, isQuestItem: false, description: 'Ferramenta pesada contundente.' },
  { itemId: 'baterias_pilhas', name: 'Pilhas e Baterias', icon: '🔋', category: 'general', rarity: 'uncommon', consumable: false, isQuestItem: false, description: 'Alimentação para eletrônicos e lanternas.' },
  { itemId: 'extensao_eletrica', name: 'Extensão Elétrica', icon: '🔌', category: 'general', rarity: 'uncommon', consumable: false, isQuestItem: false, description: 'Fio longo emborrachado.' },
  { itemId: 'lanterna_portatil', name: 'Lanterna Portátil', icon: '🔦', category: 'general', rarity: 'uncommon', consumable: false, isQuestItem: false, description: 'Facho de luz portátil.' },
  { itemId: 'corda_nylon', name: 'Rolo de Corda', icon: '🪢', category: 'general', rarity: 'uncommon', consumable: false, isQuestItem: false, description: 'Corda resistente de amarração.' },
  { itemId: 'galao_combustivel', name: 'Galão de Combustível', icon: '⛽', category: 'general', rarity: 'rare', consumable: false, isQuestItem: false, description: 'Gasolina altamente inflamável e valiosa.' },

  // RAROS DE BUSCA ÚNICA & APARTAMENTOS
  { itemId: 'notebook_estudante', name: 'Notebook Funcional', icon: '💻', category: 'general', rarity: 'rare', consumable: false, isQuestItem: false, description: 'Computador portátil com arquivos e bateria preservada.' },
  { itemId: 'celular_funcional', name: 'Smartphone Operacional', icon: '📱', category: 'general', rarity: 'rare', consumable: false, isQuestItem: false, description: 'Aparelho desbloqueado com dados armazenados.' },
  { itemId: 'pistola_glock', name: 'Pistola 9mm', icon: '🔫', category: 'firearms', rarity: 'rare', consumable: false, isQuestItem: false, description: 'Arma de fogo semi-automática confiável.' },
  { itemId: 'municao_9mm', name: 'Caixa de Munição 9mm', icon: '📦', category: 'firearms', rarity: 'rare', consumable: false, isQuestItem: false, description: 'Cartuchos para armas curtas.' },
  { itemId: 'kit_cirurgico', name: 'Kit Médico Avançado', icon: '🩺', category: 'medical', rarity: 'rare', consumable: true, consumeEffect: { blood: 60, thirst: 10 }, isQuestItem: false, description: 'Suturas estéreis, tesouras e analgésicos fortes.' },
  { itemId: 'ferramentas_pro', name: 'Maleta de Ferramentas Pro', icon: '🧰', category: 'melee', rarity: 'rare', consumable: false, isQuestItem: false, description: 'Conjunto completo de ferramentas pesadas.' },
  { itemId: 'fuzil_militar', name: 'Fuzil Militar Tático', icon: '🎖️', category: 'firearms', rarity: 'very_rare', consumable: false, isQuestItem: false, description: 'Armamento de ponta das forças armadas.' },
  { itemId: 'colete_balistico', name: 'Colete Balístico Kevlar', icon: '🛡️', category: 'clothing', rarity: 'very_rare', consumable: false, isQuestItem: false, description: 'Proteção blindada contra tiros e mordidas.' },
  { itemId: 'reliquia_sobrevivente', name: 'Amuleto do Fundador', icon: '👑', category: 'general', rarity: 'exceptional', isQuestItem: true, consumable: false, description: 'Item lendário único deixado pelos primeiros colonizadores.' },
]

/**
 * Verifica se um personagem possui determinado item no inventário pelo itemId ou instanceId.
 */
export function hasItem(inventory = [], targetId) {
  if (!inventory || !Array.isArray(inventory) || !targetId) return false
  const cleanTarget = String(targetId).toLowerCase().trim()
  return inventory.some(item => {
    if (!item) return false
    const matchId = item.itemId && String(item.itemId).toLowerCase().trim() === cleanTarget
    const matchInst = item.instanceId && String(item.instanceId).toLowerCase().trim() === cleanTarget
    const matchName = item.name && String(item.name).toLowerCase().trim() === cleanTarget
    return (matchId || matchInst || matchName) && (item.quantity ?? 1) > 0
  })
}

/**
 * Retorna se uma determinada feature está desbloqueada por algum item no inventário
 */
export function hasFeatureUnlocked(inventory = [], featureId) {
  if (!inventory || !Array.isArray(inventory) || !featureId) return false

  return inventory.some(item => {
    if (!item || (item.quantity ?? 1) <= 0) return false

    // 1. Checa array de unlocks salvo diretamente no item do inventário
    if (Array.isArray(item.unlocks) && item.unlocks.includes(featureId)) {
      return true
    }

    // 2. Checa se o item coincide com algum item padrão do DEFAULT_PRESET_ITEMS que possui esse unlock
    const preset = DEFAULT_PRESET_ITEMS.find(p => p.itemId === item.itemId)
    if (preset && Array.isArray(preset.unlocks) && preset.unlocks.includes(featureId)) {
      return true
    }

    // 3. Fallbacks diretos para o relógio (caso o item tenha sido inserido manualmente pelo Admin sem a tag unlocks)
    if (featureId === 'hud_clock') {
      const cleanId = String(item.itemId || '').toLowerCase()
      const cleanName = String(item.name || '').toLowerCase()
      if (
        cleanId === 'relogio' ||
        cleanId === 'relogio_pulso' ||
        cleanId === 'relogio_digital' ||
        cleanId === 'relogio_parede' ||
        cleanName.includes('relógio') ||
        cleanName.includes('relogio') ||
        cleanName.includes('watch') ||
        cleanName.includes('clock')
      ) {
        return true
      }
    }

    return false
  })
}

/**
 * Retorna o período do dia baseado na hora do jogo (quando o jogador não tem relógio)
 */
export function getTimeOfDay(gameTime) {
  const hour = gameTime?.hour ?? 12
  if (hour >= 5 && hour < 12) {
    return { id: 'morning', label: 'Manhã', icon: '🌅' }
  } else if (hour >= 12 && hour < 18) {
    return { id: 'afternoon', label: 'Tarde', icon: '🌤️' }
  } else {
    return { id: 'night', label: 'Noite', icon: '🌙' }
  }
}

/**
 * Aplica efeitos nos vitais do personagem (Fome, Sede, Sangue)
 */
export function applyConsumeEffect(currentVitals = {}, effect = {}) {
  const hunger = currentVitals.hunger ?? 100
  const thirst = currentVitals.thirst ?? 100
  const blood  = currentVitals.blood  ?? 100

  return {
    hunger: Math.max(0, Math.min(100, hunger + (effect.hunger || 0))),
    thirst: Math.max(0, Math.min(100, thirst + (effect.thirst || 0))),
    blood:  Math.max(0, Math.min(100, blood  + (effect.blood  || 0))),
  }
}

/**
 * Calcula os debuffs aplicados aos atributos baseado nos níveis de Sede e Fome
 * 
 * Regras:
 * - Vitais entre 25% e 50%: -1 em atributos físicos (Força/Destreza).
 * - Vitais abaixo de 25% (Crítico): -2 em Força, Destreza, Constituição e -1 em Sabedoria/Carisma.
 * - Vital em 0% (Inanição/Desidratação): Perda contínua de Sangue e -3 em todos os atributos.
 */
export function getVitalsDebuffs(vitals = {}) {
  const hunger = vitals.hunger ?? 100
  const thirst = vitals.thirst ?? 100
  const blood  = vitals.blood  ?? 100

  const penalties = {
    forca: 0,
    destreza: 0,
    constituicao: 0,
    sabedoria: 0,
    carisma: 0,
  }

  const reasons = []

  // Avalia pior estado entre Fome e Sede
  const minVital = Math.min(hunger, thirst)

  if (minVital === 0) {
    penalties.forca -= 3
    penalties.destreza -= 3
    penalties.constituicao -= 3
    penalties.sabedoria -= 3
    penalties.carisma -= 3
    reasons.push(hunger === 0 ? '💀 Inanição Extrema (Fome em 0%)' : '💀 Desidratação Extrema (Sede em 0%)')
  } else if (minVital < 25) {
    penalties.forca -= 2
    penalties.destreza -= 2
    penalties.constituicao -= 2
    penalties.sabedoria -= 1
    penalties.carisma -= 1
    if (hunger < 25) reasons.push('⚠️ Fome Crítica (< 25%)')
    if (thirst < 25) reasons.push('⚠️ Sede Crítica (< 25%)')
  } else if (minVital <= 50) {
    penalties.forca -= 1
    penalties.destreza -= 1
    if (hunger <= 50) reasons.push('🥖 Fome Moderada (≤ 50%)')
    if (thirst <= 50) reasons.push('💧 Sede Moderada (≤ 50%)')
  }

  // Sangue crítico (< 25%) também afeta físico
  if (blood > 0 && blood < 25) {
    penalties.forca -= 1
    penalties.destreza -= 1
    penalties.constituicao -= 1
    reasons.push('🩸 Hemorragia / Sangue Crítico (< 25%)')
  }

  const hasDebuff = Object.values(penalties).some(val => val < 0)

  return {
    penalties,
    reasons,
    hasDebuff,
    isStarving: hunger === 0,
    isDehydrated: thirst === 0,
    isBleedingOut: blood === 0
  }
}

/**
 * Retorna os atributos efetivos (atributos base + penalidades de debuffs)
 */
export function calculateEffectiveAttributes(baseAttributes = {}, vitals = {}) {
  const { penalties } = getVitalsDebuffs(vitals)
  const effective = {}

  for (const [attr, val] of Object.entries(baseAttributes)) {
    const penalty = penalties[attr] || 0
    effective[attr] = Math.max(1, (val ?? 1) + penalty)
  }

  return effective
}

/**
 * Rola loot de suprimentos garantindo que APENAS itens comuns, incomuns ou sucatas apareçam
 */
export function rollSupplyLoot(lootConfig) {
  if (!lootConfig || !lootConfig.enabled) return []
  if (Math.random() < (lootConfig.emptyChance ?? 0.25)) return []

  const table = (lootConfig.table || []).filter(item => {
    const rarity = item.rarity || 'common'
    return SUPPLY_RARITIES.includes(rarity)
  })

  if (table.length === 0) return []

  // Quantidade de itens para sortear (1 a maxItemsPerSearch)
  const maxItems = Math.min(table.length, lootConfig.maxItemsPerSearch || 2)
  const rolled = []
  const available = [...table]

  for (let i = 0; i < maxItems && available.length > 0; i++) {
    const totalChance = available.reduce((acc, it) => acc + (it.chance || 0.3), 0)
    let randomVal = Math.random() * totalChance
    let chosenIdx = -1

    for (let j = 0; j < available.length; j++) {
      randomVal -= (available[j].chance || 0.3)
      if (randomVal <= 0) {
        chosenIdx = j
        break
      }
    }

    if (chosenIdx !== -1) {
      const chosen = available.splice(chosenIdx, 1)[0]
      const minQ = chosen.min || 1
      const maxQ = chosen.max || 1
      const qty = Math.floor(Math.random() * (maxQ - minQ + 1)) + minQ

      rolled.push({
        instanceId: Math.random().toString(36).substring(2) + Date.now().toString(36),
        itemId: chosen.itemId,
        name: chosen.name,
        icon: chosen.icon,
        rarity: chosen.rarity || 'common',
        quantity: qty,
        category: chosen.category || 'general',
        consumable: chosen.consumable ?? false,
        consumeEffect: chosen.consumeEffect || null,
        isQuestItem: chosen.isQuestItem ?? false,
        unlocks: chosen.unlocks || [],
        obtainedAt: new Date().toISOString(),
        obtainedFrom: 'Busca de Suprimentos'
      })
    }
  }

  return rolled
}

/**
 * Retorna todos os itens raros/excepcionais disponíveis para a Busca Única
 */
export function rollUniqueLoot(locationUniqueConfig) {
  if (!locationUniqueConfig || !locationUniqueConfig.enabled) return []
  const items = locationUniqueConfig.items || []
  if (items.length === 0) return []

  return items.map(item => ({
    ...item,
    quantity: item.quantity || 1,
    rarity: item.rarity || 'rare',
    selected: false
  }))
}
