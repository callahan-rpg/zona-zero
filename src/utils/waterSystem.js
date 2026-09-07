/**
 * waterSystem.js
 * Utilitários e regras do Sistema de Fontes de Água e Coleta do Zona Zero RPG
 *
 * Princípios:
 * - Fontes de água configuráveis no Firestore (/water_sources/{id})
 * - Utiliza a tabela padrão de itens e o inventário único existente
 * - Coleta atômica: consome Garrafa Vazia e produz Garrafa de Água Impura
 * - Purificação integrada ao Sistema de Culinária (/recipes)
 */

import { checkInventoryItem, isItemMatching } from './activitySystem'
import { DEFAULT_PRESET_ITEMS } from './itemSystem'

export const DEFAULT_WATER_SOURCES = [
  {
    id: 'fonte_lago_sterilug',
    name: 'Lago de Sterilug',
    locationSlug: 'lago-sterilug',
    locationName: 'Lago de Sterilug',
    enabled: true,
    requiredItem: 'garrafa_vazia',
    requiredItemName: 'Garrafa de Água Vazia',
    requiredQuantity: 1,
    producedItem: 'garrafa_agua_impura',
    producedItemName: 'Garrafa de Água Impura',
    producedQuantity: 1,
    durationSec: 3,
    icon: '🌊',
    description: 'Margem do lago de águas naturais frias. Colete água em suas garrafas vazias para posterior fervura na panela.'
  },
  {
    id: 'fonte_poco_fazenda',
    name: 'Poço Artesiano da Fazenda',
    locationSlug: 'horta-comunitaria',
    locationName: 'Horta Comunitária',
    enabled: true,
    requiredItem: 'garrafa_vazia',
    requiredItemName: 'Garrafa de Água Vazia',
    requiredQuantity: 1,
    producedItem: 'garrafa_agua_impura',
    producedItemName: 'Garrafa de Água Impura',
    producedQuantity: 1,
    durationSec: 3,
    icon: '🚰',
    description: 'Poço com manivela de ferro que extrai água subterrânea da região.'
  },
  {
    id: 'fonte_rio_acampamento',
    name: 'Rio das Pedras',
    locationSlug: 'acampamento-central',
    locationName: 'Acampamento Central',
    enabled: true,
    requiredItem: 'garrafa_vazia',
    requiredItemName: 'Garrafa de Água Vazia',
    requiredQuantity: 1,
    producedItem: 'garrafa_agua_impura',
    producedItemName: 'Garrafa de Água Impura',
    producedQuantity: 1,
    durationSec: 3,
    icon: '💧',
    description: 'Leito de pedras onde corre água fresca do riacho ao lado do refúgio.'
  }
]

/**
 * Valida se o jogador atende aos requisitos para coletar água na fonte informada.
 * Retorna { ok, found, needed, requiredItemName, reason }
 */
export function validateWaterCollection(source, inventory = []) {
  if (!source || source.enabled === false) {
    return { ok: false, reason: 'Esta fonte de água está desativada ou inacessível no momento.' }
  }

  const reqItem = source.requiredItem || 'garrafa_vazia'
  const needed = Math.max(1, Number(source.requiredQuantity) || 1)
  const reqName = source.requiredItemName || 'Garrafa de Água Vazia'

  const { ok, found } = checkInventoryItem(inventory, reqItem, needed)

  if (!ok) {
    return {
      ok: false,
      found,
      needed,
      requiredItem: reqItem,
      requiredItemName: reqName,
      reason: `Você precisa de pelo menos ${needed}x ${reqName} no inventário para coletar água (possui: ${found}).`
    }
  }

  return {
    ok: true,
    found,
    needed,
    requiredItem: reqItem,
    requiredItemName: reqName
  }
}
