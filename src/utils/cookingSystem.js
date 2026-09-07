/**
 * cookingSystem.js
 * Utilitários e regras do Sistema de Cozinha do Zona Zero RPG
 *
 * Princípios:
 * - Totalmente baseado em receitas configuráveis no Firestore (/recipes/{id})
 * - Reutiliza a tabela de itens (items_db / DEFAULT_PRESET_ITEMS) e o inventário padrão
 * - Filtra para exibir ao jogador APENAS receitas que ele possui os ingredientes e utensílio equipado
 * - Execução atômica no Firestore via runTransaction
 */

import { checkInventoryItem, checkEquippedAccessory, isItemMatching, consumeItemFromInventory, addItemToInventory } from './activitySystem'
import { DEFAULT_PRESET_ITEMS } from './itemSystem'

// Utensílios de Cozinha sugeridos
export const COOKING_UTENSILS = [
  { id: '', label: 'Nenhum (Preparo sem utensílio específico)', icon: '🥣' },
  { id: 'panela_frigideira', label: 'Panela ou Frigideira de Ferro', icon: '🍳' },
  { id: 'faca_cozinha', label: 'Faca de Cozinha', icon: '🔪' },
]

export const DEFAULT_RECIPES = [
  {
    id: 'rec_purificar_agua',
    name: 'Purificar Água (Ferver na Panela)',
    icon: '💧',
    description: 'Ferva a garrafa de água impura na panela para eliminar bactérias, impurezas e torná-la potável para hidratação.',
    enabled: true,
    requiredTool: 'panela_frigideira',
    cookDurationSec: 4,
    ingredients: [
      { itemId: 'garrafa_agua_impura', name: 'Garrafa de Água Impura', icon: '🧪', quantity: 1 }
    ],
    result: {
      itemId: 'garrafa_agua',
      name: 'Garrafa de Água',
      icon: '💧',
      quantity: 1,
      rarity: 'common',
      category: 'supplies',
      consumable: true,
      consumeEffect: { thirst: 35 },
      returnItemOnConsume: 'garrafa_vazia',
      description: 'Água mineral potável e limpa. Ao beber, restaura a sede e deixa a garrafa vazia.'
    }
  },
  {
    id: 'rec_bacon_ovos',
    name: 'Bacon com Ovos',
    icon: '🍳',
    description: 'Fatias suculentas de bacon fritas com ovos frescos na frigideira de ferro.',
    enabled: true,
    requiredTool: 'panela_frigideira',
    cookDurationSec: 4,
    ingredients: [
      { itemId: 'bacon', name: 'Fatias de Bacon', icon: '🥓', quantity: 1 },
      { itemId: 'ovo', name: 'Ovo de Galinha', icon: '🥚', quantity: 1 }
    ],
    result: {
      itemId: 'bacon_ovos',
      name: 'Bacon com Ovos',
      icon: '🍳',
      quantity: 1,
      rarity: 'uncommon',
      category: 'supplies',
      consumable: true,
      consumeEffect: { hunger: 50, blood: 20, thirst: 5 },
      description: 'Prato clássico e altamente calórico. Fatias crocantes de bacon combinadas com ovos fritos na frigideira.'
    }
  },
  {
    id: 'rec_peixe_grelhado',
    name: 'Peixe Grelhado',
    icon: '🐟',
    description: 'Peixe fresco grelhado na panela com crosta dourada e suculenta.',
    enabled: true,
    requiredTool: 'panela_frigideira',
    cookDurationSec: 4,
    ingredients: [
      { itemId: 'peixe_pequeno', name: 'Peixe Pequeno', icon: '🐟', quantity: 1 }
    ],
    result: {
      itemId: 'peixe_grelhado',
      name: 'Peixe Grelhado',
      icon: '🐟',
      quantity: 1,
      rarity: 'uncommon',
      category: 'supplies',
      consumable: true,
      consumeEffect: { hunger: 45, blood: 15, thirst: 5 },
      description: 'Peixe fresco dourado na panela com temperos rústicos.'
    }
  },
  {
    id: 'rec_omelete',
    name: 'Omelete de Ovos',
    icon: '🍳',
    description: 'Ovos batidos e fritos até ficarem macios e dourados.',
    enabled: true,
    requiredTool: 'panela_frigideira',
    cookDurationSec: 3,
    ingredients: [
      { itemId: 'ovo', name: 'Ovo de Galinha', icon: '🥚', quantity: 2 }
    ],
    result: {
      itemId: 'omelete',
      name: 'Omelete de Ovos',
      icon: '🍳',
      quantity: 1,
      rarity: 'common',
      category: 'supplies',
      consumable: true,
      consumeEffect: { hunger: 35, blood: 12 },
      description: 'Ovos batidos e fritos na panela até ficarem dourados e macios.'
    }
  },
  {
    id: 'rec_sopa_legumes',
    name: 'Sopa Quente de Legumes',
    icon: '🍲',
    description: 'Sopa revigorante com pedaços de batata, tomate e caldo quente.',
    enabled: true,
    requiredTool: 'panela_frigideira',
    cookDurationSec: 5,
    ingredients: [
      { itemId: 'batata', name: 'Batata', icon: '🥔', quantity: 1 },
      { itemId: 'tomate', name: 'Tomate', icon: '🍅', quantity: 1 },
      { itemId: 'garrafa_agua', name: 'Garrafa de Água', icon: '💧', quantity: 1 }
    ],
    result: {
      itemId: 'sopa_legumes',
      name: 'Sopa Quente de Legumes',
      icon: '🍲',
      quantity: 1,
      rarity: 'uncommon',
      category: 'supplies',
      consumable: true,
      consumeEffect: { hunger: 40, thirst: 35, blood: 10 },
      description: 'Sopa nutritiva feita com batatas, tomates e água limpa fervida.'
    }
  },
  {
    id: 'rec_ensopado_carne',
    name: 'Ensopado de Carne e Batata',
    icon: '🍲',
    description: 'Guisado farto de carne e batatas cozidas em fogo brando.',
    enabled: true,
    requiredTool: 'panela_frigideira',
    cookDurationSec: 5,
    ingredients: [
      { itemId: 'carne_crua', name: 'Carne Crua', icon: '🥩', quantity: 1 },
      { itemId: 'batata', name: 'Batata', icon: '🥔', quantity: 1 }
    ],
    result: {
      itemId: 'ensopado_carne',
      name: 'Ensopado de Carne e Batata',
      icon: '🍲',
      quantity: 1,
      rarity: 'rare',
      category: 'supplies',
      consumable: true,
      consumeEffect: { hunger: 65, thirst: 25, blood: 25 },
      description: 'Guisado encorpado com carne macia e batatas cozidas em fogo brando.'
    }
  },
  {
    id: 'rec_batata_assada',
    name: 'Batata Dourada na Frigideira',
    icon: '🥔',
    description: 'Fatias de batata tostadas e crocantes.',
    enabled: true,
    requiredTool: 'panela_frigideira',
    cookDurationSec: 3,
    ingredients: [
      { itemId: 'batata', name: 'Batata', icon: '🥔', quantity: 1 }
    ],
    result: {
      itemId: 'batata_assada',
      name: 'Batata Dourada na Frigideira',
      icon: '🥔',
      quantity: 1,
      rarity: 'common',
      category: 'supplies',
      consumable: true,
      consumeEffect: { hunger: 30, blood: 5 },
      description: 'Batatas fatiadas e tostadas na frigideira de ferro.'
    }
  },
  {
    id: 'rec_milho_cozido',
    name: 'Milho Cozido na Panela',
    icon: '🌽',
    description: 'Espiga de milho fervida na panela.',
    enabled: true,
    requiredTool: 'panela_frigideira',
    cookDurationSec: 3,
    ingredients: [
      { itemId: 'milho', name: 'Milho', icon: '🌽', quantity: 1 }
    ],
    result: {
      itemId: 'milho_cozido',
      name: 'Milho Cozido na Panela',
      icon: '🌽',
      quantity: 1,
      rarity: 'common',
      category: 'supplies',
      consumable: true,
      consumeEffect: { hunger: 30, thirst: 10 },
      description: 'Espiga de milho fervida em água límpida.'
    }
  }
]

/**
 * Valida se uma receita pode ser preparada com o inventário fornecido.
 * Retorna { ok, missingTool, missingIngredients, reason }
 */
export function canCookRecipe(recipe, inventory = []) {
  if (!recipe || recipe.enabled === false) {
    return { ok: false, reason: 'Receita desativada.' }
  }

  // 1. Checa utensílio obrigatório (se configurado)
  if (recipe.requiredTool) {
    const toolCheck = checkEquippedAccessory(inventory, recipe.requiredTool)
    if (!toolCheck.ok) {
      return {
        ok: false,
        missingTool: true,
        requiredTool: recipe.requiredTool,
        reason: `Requer utensílio equipado (${recipe.requiredToolName || recipe.requiredTool}).`
      }
    }
  }

  // 2. Checa todos os ingredientes
  const missingIngredients = []
  const ingredients = recipe.ingredients || []

  if (ingredients.length === 0) {
    return { ok: false, reason: 'Receita sem ingredientes cadastrados.' }
  }

  for (const ing of ingredients) {
    const needed = Math.max(1, Number(ing.quantity) || 1)
    const { ok, found } = checkInventoryItem(inventory, ing.itemId, needed)
    if (!ok) {
      missingIngredients.push({
        itemId: ing.itemId,
        name: ing.name || ing.itemId,
        icon: ing.icon || '📦',
        needed,
        found
      })
    }
  }

  if (missingIngredients.length > 0) {
    return {
      ok: false,
      missingIngredients,
      reason: `Ingredientes insuficientes: ${missingIngredients.map(m => `${m.name} (${m.found}/${m.needed})`).join(', ')}`
    }
  }

  return { ok: true }
}

/**
 * Filtra a lista de receitas para retornar APENAS aquelas que o jogador pode cozinhar agora.
 * (Regra estrita de exibição solicitada pelo usuário)
 */
export function getAvailableRecipes(recipes = [], inventory = []) {
  if (!Array.isArray(recipes)) return []
  return recipes.filter(recipe => canCookRecipe(recipe, inventory).ok)
}
