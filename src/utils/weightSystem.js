/**
 * Sistema Central de Peso, Capacidade de Carga e Mochilas (weightSystem.js)
 * Zona Zero RPG
 *
 * Responsável por:
 * 1. Calcular o peso de itens individuais e empilhados (stack).
 * 2. Calcular o peso total carregado (itens do inventário + equipamentos equipados + mochila).
 * 3. Calcular a capacidade natural de peso do personagem baseada na Força: 10 kg + (Força × 2.5 kg).
 * 4. Calcular bônus de peso e slots fornecidos por mochilas e equipamentos de transporte.
 * 5. Calcular slots de armazenamento ocupados e disponíveis.
 * 6. Calcular percentual de sobrecarga e penalidades dinâmicas em Destreza e Agilidade.
 * 7. Validar remoção segura de mochilas para evitar estados impossíveis de inventário.
 */

import { DEFAULT_PRESET_ITEMS } from './itemSystem'

// =============================================================================
// PRESETS DAS 4 MOCHILAS INICIAIS
// =============================================================================
export const DEFAULT_BACKPACKS = [
  {
    itemId: 'mochila_pequena',
    name: 'Mochila Pequena',
    icon: '🎒',
    category: 'accessories',
    rarity: 'common',
    equipSlot: 'accessory',
    weight: 1.0,
    storageBonusSlots: 4,
    storageBonusWeight: 5.0,
    isBackpack: true,
    description: 'Mochila leve de passeio com costura simples. Concede +4 slots e suporta +5 kg adicionais.',
  },
  {
    itemId: 'mochila_media',
    name: 'Mochila Média',
    icon: '🎒',
    category: 'accessories',
    rarity: 'uncommon',
    equipSlot: 'accessory',
    weight: 2.0,
    storageBonusSlots: 8,
    storageBonusWeight: 10.0,
    isBackpack: true,
    description: 'Mochila de trekking reforçada com bolsos laterais. Concede +8 slots e suporta +10 kg adicionais.',
  },
  {
    itemId: 'mochila_grande',
    name: 'Mochila Grande',
    icon: '🎒',
    category: 'accessories',
    rarity: 'rare',
    equipSlot: 'accessory',
    weight: 2.5,
    storageBonusSlots: 12,
    storageBonusWeight: 17.5,
    isBackpack: true,
    description: 'Mochila cargueira de alta capacidade com suporte lombar. Concede +12 slots e suporta +17.5 kg adicionais.',
  },
  {
    itemId: 'mochila_militar',
    name: 'Mochila Militar',
    icon: '🎒',
    category: 'accessories',
    rarity: 'epic',
    equipSlot: 'accessory',
    weight: 3.0,
    storageBonusSlots: 16,
    storageBonusWeight: 25.0,
    isBackpack: true,
    description: 'Mochila tática camuflada com sistema MOLLE e nylon balístico. Concede +16 slots e suporta +25 kg adicionais.',
  },
]

// =============================================================================
// FAIXAS DE PENALIDADE POR SOBREPESO (CONFIGURÁVEIS)
// =============================================================================
export const DEFAULT_OVERWEIGHT_TIERS = [
  { minExcess: 30, maxExcess: Infinity, destrezaPenalty: -5, agilidadePenalty: -6, label: 'Sobrecarga Crítica', color: '#ef4444' },
  { minExcess: 20, maxExcess: 30,       destrezaPenalty: -3, agilidadePenalty: -4, label: 'Sobrecarga Severa',   color: '#f87171' },
  { minExcess: 10, maxExcess: 20,       destrezaPenalty: -2, agilidadePenalty: -2, label: 'Sobrecarga Moderada', color: '#fb923c' },
  { minExcess: 0.001, maxExcess: 10,    destrezaPenalty: -1, agilidadePenalty: -1, label: 'Carga Pesada',        color: '#facc15' },
]

// Pesos padrão de fallback por categoria caso o item não tenha peso cadastrado
export const DEFAULT_CATEGORY_WEIGHTS = {
  supplies:    0.5,
  medical:     0.2,
  clothing:    1.0,
  accessories: 0.5,
  melee:       2.0,
  firearms:    3.5,
  general:     0.5,
}

// =============================================================================
// FUNÇÕES DE CÁLCULO DE PESO INDIVIDUAL E STACK
// =============================================================================

/**
 * Retorna o peso unitário de um item em kg.
 */
export function getItemUnitWeight(item) {
  if (!item) return 0.5
  if (item.weight !== undefined && item.weight !== null && !isNaN(Number(item.weight))) {
    return Math.max(0, Number(item.weight))
  }
  const preset = (DEFAULT_PRESET_ITEMS || []).find(p => p.itemId === item.itemId)
  if (preset && preset.weight !== undefined && preset.weight !== null && !isNaN(Number(preset.weight))) {
    return Math.max(0, Number(preset.weight))
  }
  const cat = item._category || item.category || preset?.category || 'general'
  return DEFAULT_CATEGORY_WEIGHTS[cat] || 0.5
}

/**
 * Retorna o peso total de um item considerando sua quantidade (stack).
 */
export function calculateItemStackWeight(item) {
  if (!item) return 0
  const unitWeight = getItemUnitWeight(item)
  const quantity = Math.max(1, Number(item.quantity || 1))
  return Number((unitWeight * quantity).toFixed(2))
}

// =============================================================================
// SERVIÇO PRINCIPAL: CÁLCULO DE ESTATÍSTICAS DE CARGA DO PERSONAGEM
// =============================================================================

/**
 * Calcula todas as métricas de peso, slots, bônus de equipamentos e penalidades de sobrepeso.
 *
 * @param {Object} character - Dados do personagem (attributes, inventory, etc.)
 * @param {Object} gameConfig - Configurações globais do jogo (opcional)
 * @param {Object} catalogMap - Mapa de itens do Firestore items_db para hidratação em tempo real (opcional)
 * @returns {Object} Estatísticas completas de capacidade de carga
 */
export function calculateCharacterCarryStats(character, gameConfig = null, catalogMap = null) {
  const inventory = Array.isArray(character?.inventory) ? character.inventory : []
  const attributes = character?.baseAttributes || character?.attributes || {}
  const strength = Number(attributes.forca ?? 1)

  // 1. Configurações de base
  const naturalBaseSlots = Number(gameConfig?.naturalBaseSlots ?? 8)
  const strengthWeightMult = Number(gameConfig?.strengthWeightMult ?? 2.5)
  const baseWeightCapacity = Number(gameConfig?.baseWeightCapacity ?? 10.0)

  // 2. Capacidade Natural de Peso: 10 kg + (Força * 2.5 kg)
  const naturalMaxWeight = Number((baseWeightCapacity + (strength * strengthWeightMult)).toFixed(2))

  // 3. Itera sobre o inventário para somar pesos, slots e bônus de equipamentos equipados
  let totalWeight = 0
  let usedSlots = 0
  let bonusSlots = 0
  let bonusWeight = 0
  const equippedBackpacks = []

  inventory.forEach(item => {
    if (!item) return

    const catData = catalogMap ? (catalogMap[item.itemId] || catalogMap[item.id]) : null
    const presetData = (DEFAULT_PRESET_ITEMS || []).find(p => p.itemId === item.itemId)

    // Mescla dados de peso e bônus em tempo real
    const itemWeight = catData?.weight !== undefined ? Number(catData.weight) : (item.weight !== undefined ? Number(item.weight) : (presetData?.weight ?? getItemUnitWeight(item)))
    const quantity = Math.max(1, Number(item.quantity || 1))
    const stackWeight = Number((itemWeight * quantity).toFixed(2))
    totalWeight += stackWeight

    if (item.equipped === true) {
      // Itens equipados NÃO ocupam slots de armazenamento interno
      // Mas fornecem bônus caso possuam propriedades de transporte (mochila, jaqueta com bolsos, colete, etc.)
      const itemBonusSlots = Number(
        catData?.storageBonusSlots ??
        item.storageBonusSlots ??
        item.bonusSlots ??
        presetData?.storageBonusSlots ??
        0
      )
      const itemBonusWeight = Number(
        catData?.storageBonusWeight ??
        item.storageBonusWeight ??
        item.bonusWeight ??
        presetData?.storageBonusWeight ??
        0
      )
      const isBackpack = catData?.isBackpack ?? item.isBackpack ?? presetData?.isBackpack ?? (itemBonusSlots > 0 || itemBonusWeight > 0)

      if (itemBonusSlots > 0 || itemBonusWeight > 0 || isBackpack) {
        bonusSlots += itemBonusSlots
        bonusWeight += itemBonusWeight
        equippedBackpacks.push({
          ...item,
          storageBonusSlots: itemBonusSlots,
          storageBonusWeight: itemBonusWeight,
          isBackpack
        })
      }
    } else {
      // Itens não equipados ocupam 1 slot de armazenamento por stack
      usedSlots += 1
    }
  })

  // Arredonda peso total para 2 casas decimais
  totalWeight = Number(totalWeight.toFixed(2))

  // 4. Capacidade Total de Peso e Slots Totais
  const maxWeight = Number((naturalMaxWeight + bonusWeight).toFixed(2))
  const maxSlots = naturalBaseSlots + bonusSlots

  // 5. Cálculo de Sobrecarga e Penalidades
  const isOverweight = totalWeight > maxWeight
  let excessWeight = 0
  let excessPercent = 0

  if (isOverweight && maxWeight > 0) {
    excessWeight = Number((totalWeight - maxWeight).toFixed(2))
    excessPercent = Number(((excessWeight / maxWeight) * 100).toFixed(1))
  }

  // Avalia faixas de penalidade
  const tiers = gameConfig?.overweightTiers || DEFAULT_OVERWEIGHT_TIERS
  const penalties = {
    destreza: 0,
    agilidade: 0,
  }
  let activeTier = null

  if (isOverweight && excessPercent > 0) {
    for (const tier of tiers) {
      if (excessPercent >= tier.minExcess && excessPercent < tier.maxExcess) {
        penalties.destreza = tier.destrezaPenalty
        penalties.agilidade = tier.agilidadePenalty
        activeTier = tier
        break
      }
    }
    // Fallback caso acima de todas as faixas
    if (!activeTier && excessPercent > 0) {
      const highestTier = tiers[0]
      penalties.destreza = highestTier.destrezaPenalty
      penalties.agilidade = highestTier.agilidadePenalty
      activeTier = highestTier
    }
  }

  // 6. Slots Excedidos (se desequipou ou inventário cheio)
  const isSlotsFull = usedSlots >= maxSlots
  const isSlotsOverflown = usedSlots > maxSlots
  const availableSlots = Math.max(0, maxSlots - usedSlots)

  return {
    // Peso
    totalWeight,
    maxWeight,
    naturalMaxWeight,
    bonusWeight,
    excessWeight,
    excessPercent,
    isOverweight,
    // Slots
    usedSlots,
    maxSlots,
    naturalBaseSlots,
    bonusSlots,
    availableSlots,
    isSlotsFull,
    isSlotsOverflown,
    // Penalidades
    penalties,
    activeTier,
    // Mochilas equipadas
    equippedBackpacks,
  }
}

// =============================================================================
// VALIDAÇÃO DE REMOÇÃO SEGURA DE MOCHILA
// =============================================================================

/**
 * Verifica se um item (ex: mochila) pode ser desequipado sem estourar o limite estrutural de slots.
 *
 * @param {Array} inventory - Inventário do personagem
 * @param {Object|string} itemOrInstanceId - Item ou instanceId que se deseja desequipar
 * @param {Object} character - Dados do personagem
 * @param {Object} gameConfig - Configurações globais
 * @returns {Object} { ok: boolean, error?: string, remainingSlots?: number, neededSlots?: number }
 */
export function canUnequipBackpack(inventory = [], itemOrInstanceId, character = {}, gameConfig = null) {
  const target = typeof itemOrInstanceId === 'string'
    ? inventory.find(i => i.instanceId === itemOrInstanceId)
    : itemOrInstanceId

  if (!target) return { ok: true }

  const itemBonusSlots = Number(target.storageBonusSlots || target.bonusSlots || 0)
  if (itemBonusSlots <= 0 && !target.isBackpack) {
    return { ok: true }
  }

  // Simula o inventário sem o bônus desta mochila
  const currentStats = calculateCharacterCarryStats({ ...character, inventory }, gameConfig)
  const newMaxSlots = currentStats.maxSlots - itemBonusSlots
  // Ao desequipar, o próprio item da mochila passa a ocupar 1 slot no inventário!
  const newUsedSlots = currentStats.usedSlots + 1

  if (newUsedSlots > newMaxSlots) {
    const excess = newUsedSlots - newMaxSlots
    return {
      ok: false,
      error: `Você precisa liberar pelo menos ${excess} espaço(s) no inventário antes de desequipar ${target.name || 'esta mochila'} (ocupando ${newUsedSlots} de ${newMaxSlots} slots que restariam).`,
      remainingSlots: newMaxSlots,
      neededSlots: newUsedSlots,
      excess
    }
  }

  return {
    ok: true,
    remainingSlots: newMaxSlots,
    neededSlots: newUsedSlots
  }
}
