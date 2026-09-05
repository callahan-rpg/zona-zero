import { doc, runTransaction } from 'firebase/firestore'
import { db } from '../firebase/config'

/**
 * Definição dos tipos padronizados de recipientes de armazenamento
 */
export const STORAGE_TYPES = {
  chest: {
    id: 'chest',
    name: 'Baú / Caixa',
    icon: '📦',
    defaultSlots: 12,
    description: 'Caixa de madeira ou plástico reforçado para guardar suprimentos diversos.',
    allowedCategories: [] // Vazio significa todas
  },
  cabinet: {
    id: 'cabinet',
    name: 'Armário de Metal',
    icon: '🗄️',
    defaultSlots: 18,
    description: 'Armário de metal com prateleiras resistentes.',
    allowedCategories: []
  },
  fridge: {
    id: 'fridge',
    name: 'Geladeira / Frigobar',
    icon: '🧊',
    defaultSlots: 14,
    description: 'Compartimento refrigerado ideal para alimentos, bebidas e remédios sensíveis.',
    allowedCategories: ['supplies', 'medical']
  },
  safe: {
    id: 'safe',
    name: 'Cofre de Alta Segurança',
    icon: '🔒',
    defaultSlots: 8,
    description: 'Cofre pesado de aço blindado com mecanismo de segredo.',
    allowedCategories: []
  },
  vehicle_trunk: {
    id: 'vehicle_trunk',
    name: 'Porta-Malas de Veículo',
    icon: '🚗',
    defaultSlots: 20,
    description: 'Compartimento traseiro de transporte de carga de um veículo.',
    allowedCategories: []
  },
  warehouse: {
    id: 'warehouse',
    name: 'Depósito / Armazém',
    icon: '🏭',
    defaultSlots: 60,
    description: 'Instalação ampla com grande capacidade de estocagem.',
    allowedCategories: []
  },
  residential: {
    id: 'residential',
    name: 'Estoque Residencial',
    icon: '🏠',
    defaultSlots: 36,
    description: 'Armazenamento privado destinado a abrigos e residências.',
    allowedCategories: []
  }
}

/**
 * Valida se um item pode ser depositado no container com base em regras e capacidade
 */
export function canDepositItem(storage, item) {
  if (!storage || !item) return { allowed: false, reason: 'Dados inválidos.' }

  if (item.isQuestItem) {
    return { allowed: false, reason: 'Itens de missão essenciais não podem ser guardados em recipientes.' }
  }

  // Verifica se o item já existe no storage para fins de limite de slots
  const items = storage.items || []
  const existingItemIndex = items.findIndex(i => i.itemId === item.itemId && !i.isQuestItem)
  
  const maxSlots = storage.capacity?.maxSlots || 12
  const isInfinite = !!storage.capacity?.infinite

  if (!isInfinite && existingItemIndex === -1 && items.length >= maxSlots) {
    return { allowed: false, reason: `O armazenamento atingiu o limite de ${maxSlots} slots.` }
  }

  // Validação de categorias permitidas
  const allowedCategories = storage.restrictions?.allowedCategories || []
  const itemCategory = item.category || 'general'
  if (allowedCategories.length > 0 && !allowedCategories.includes(itemCategory)) {
    return { allowed: false, reason: `Este recipiente não aceita itens da categoria "${itemCategory}".` }
  }

  // Validação de categorias bloqueadas
  const blockedCategories = storage.restrictions?.blockedCategories || []
  if (blockedCategories.includes(itemCategory)) {
    return { allowed: false, reason: `Itens da categoria "${itemCategory}" são proibidos neste recipiente.` }
  }

  return { allowed: true }
}

/**
 * Deposita um item do inventário do usuário dentro do Storage (Transacional e Atômico)
 */
export async function depositToStorage({
  storageId,
  userUid,
  itemInstanceId,
  quantityToDeposit,
  userName = 'Sobrevivente'
}) {
  if (!storageId || !userUid || !itemInstanceId || quantityToDeposit <= 0) {
    throw new Error('Parâmetros inválidos para depósito.')
  }

  const userRef = doc(db, 'users', userUid)
  const storageRef = doc(db, 'storages', storageId)

  return await runTransaction(db, async (transaction) => {
    const [userSnap, storageSnap] = await Promise.all([
      transaction.get(userRef),
      transaction.get(storageRef)
    ])

    if (!userSnap.exists()) throw new Error('Personagem não encontrado.')
    if (!storageSnap.exists()) throw new Error('Recipiente de armazenamento não encontrado.')

    const userData = userSnap.data()
    const storageData = storageSnap.data()

    const userInventory = [...(userData.character?.inventory || [])]
    const storageItems = [...(storageData.items || [])]

    // 1. Encontra item no inventário do usuário
    const itemIndex = userInventory.findIndex(i => i.instanceId === itemInstanceId)
    if (itemIndex === -1) throw new Error('Item não encontrado no seu inventário.')

    const sourceItem = userInventory[itemIndex]
    if (sourceItem.quantity < quantityToDeposit) {
      throw new Error(`Quantidade insuficiente. Você possui apenas ${sourceItem.quantity} unidade(s).`)
    }

    // 2. Valida regras do Storage
    const validation = canDepositItem(storageData, sourceItem)
    if (!validation.allowed) {
      throw new Error(validation.reason)
    }

    // 3. Atualiza inventário do usuário
    if (sourceItem.quantity === quantityToDeposit) {
      userInventory.splice(itemIndex, 1)
    } else {
      userInventory[itemIndex] = {
        ...sourceItem,
        quantity: sourceItem.quantity - quantityToDeposit
      }
    }

    // 4. Adiciona ou empilha no Storage
    const existingIndex = storageItems.findIndex(i => i.itemId === sourceItem.itemId && !i.isQuestItem)
    if (existingIndex >= 0) {
      storageItems[existingIndex] = {
        ...storageItems[existingIndex],
        quantity: (storageItems[existingIndex].quantity || 0) + quantityToDeposit
      }
    } else {
      const newItemEntry = {
        ...sourceItem,
        instanceId: 'st_' + Math.random().toString(36).substring(2) + Date.now().toString(36),
        quantity: quantityToDeposit,
        storedAt: new Date().toISOString(),
        storedByUid: userUid,
        storedByName: userName
      }
      delete newItemEntry.equipped // Itens guardados nunca ficam equipados
      storageItems.push(newItemEntry)
    }

    // 5. Registra log de atividade
    const activityLog = [
      {
        id: Math.random().toString(36).substring(2),
        type: 'deposit',
        userUid,
        userName,
        itemId: sourceItem.itemId,
        itemName: sourceItem.name || sourceItem.itemId,
        quantity: quantityToDeposit,
        timestamp: new Date().toISOString()
      },
      ...(storageData.activityLog || []).slice(0, 24)
    ]

    // 6. Atualizações no banco
    transaction.update(userRef, {
      'character.inventory': userInventory
    })

    transaction.update(storageRef, {
      items: storageItems,
      activityLog,
      updatedAt: new Date().toISOString()
    })

    return { success: true, depositedItem: sourceItem, quantity: quantityToDeposit }
  })
}

/**
 * Retira um item do Storage e coloca no inventário do usuário (Transacional e Atômico)
 */
export async function withdrawFromStorage({
  storageId,
  userUid,
  storageInstanceId,
  quantityToWithdraw,
  userName = 'Sobrevivente'
}) {
  if (!storageId || !userUid || !storageInstanceId || quantityToWithdraw <= 0) {
    throw new Error('Parâmetros inválidos para retirada.')
  }

  const userRef = doc(db, 'users', userUid)
  const storageRef = doc(db, 'storages', storageId)

  return await runTransaction(db, async (transaction) => {
    const [userSnap, storageSnap] = await Promise.all([
      transaction.get(userRef),
      transaction.get(storageRef)
    ])

    if (!userSnap.exists()) throw new Error('Personagem não encontrado.')
    if (!storageSnap.exists()) throw new Error('Recipiente de armazenamento não encontrado.')

    const userData = userSnap.data()
    const storageData = storageSnap.data()

    const userInventory = [...(userData.character?.inventory || [])]
    const storageItems = [...(storageData.items || [])]

    // 1. Encontra item no Storage
    const itemIndex = storageItems.findIndex(i => i.instanceId === storageInstanceId)
    if (itemIndex === -1) throw new Error('Item não encontrado no armazenamento.')

    const storageItem = storageItems[itemIndex]
    if (storageItem.quantity < quantityToWithdraw) {
      throw new Error(`Quantidade insuficiente no armazenamento (${storageItem.quantity} disponível).`)
    }

    // 2. Atualiza Storage
    if (storageItem.quantity === quantityToWithdraw) {
      storageItems.splice(itemIndex, 1)
    } else {
      storageItems[itemIndex] = {
        ...storageItem,
        quantity: storageItem.quantity - quantityToWithdraw
      }
    }

    // 3. Adiciona ou empilha no inventário do usuário
    const existingIndex = userInventory.findIndex(i => i.itemId === storageItem.itemId && !i.isQuestItem)
    if (existingIndex >= 0) {
      userInventory[existingIndex] = {
        ...userInventory[existingIndex],
        quantity: (userInventory[existingIndex].quantity || 0) + quantityToWithdraw
      }
    } else {
      userInventory.push({
        ...storageItem,
        instanceId: Math.random().toString(36).substring(2) + Date.now().toString(36),
        quantity: quantityToWithdraw,
        obtainedAt: new Date().toISOString(),
        obtainedFrom: `Armazenamento (${storageData.name || storageId})`
      })
    }

    // 4. Registra log de atividade
    const activityLog = [
      {
        id: Math.random().toString(36).substring(2),
        type: 'withdraw',
        userUid,
        userName,
        itemId: storageItem.itemId,
        itemName: storageItem.name || storageItem.itemId,
        quantity: quantityToWithdraw,
        timestamp: new Date().toISOString()
      },
      ...(storageData.activityLog || []).slice(0, 24)
    ]

    // 5. Atualizações no banco
    transaction.update(userRef, {
      'character.inventory': userInventory
    })

    transaction.update(storageRef, {
      items: storageItems,
      activityLog,
      updatedAt: new Date().toISOString()
    })

    return { success: true, withdrawnItem: storageItem, quantity: quantityToWithdraw }
  })
}
