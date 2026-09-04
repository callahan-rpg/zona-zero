import { createContext, useContext, useEffect, useState, useRef } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from 'firebase/auth'
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  runTransaction,
  onSnapshot,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { auth, db, storage } from '../firebase/config'
import { getMaxHp, DEFAULT_PRESET_ITEMS } from '../utils/itemSystem'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [character, setCharacter] = useState(null)
  const [role, setRole] = useState('player')
  const [loading, setLoading] = useState(true)

  // Observa mudanças de autenticação e escuta o documento do usuário em tempo real
  useEffect(() => {
    let unsubUserDoc = null
    let isMounted = true

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!isMounted) return

      if (firebaseUser) {
        setUser(firebaseUser)
        const docRef = doc(db, 'users', firebaseUser.uid)

        // 1. Carregamento inicial imediato via getDoc
        try {
          const initialSnap = await getDoc(docRef)
          if (initialSnap.exists() && isMounted) {
            const data = initialSnap.data()
            setCharacter(data.character)
            setRole(data.role || 'player')
          }
        } catch (err) {
          console.warn('Aviso ao carregar dados iniciais do usuário:', err)
        } finally {
          if (isMounted) setLoading(false)
        }

        // 2. Listener em tempo real para sincronização subsequente
        if (unsubUserDoc) unsubUserDoc()
        unsubUserDoc = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists() && isMounted) {
            const data = docSnap.data()
            setCharacter(data.character)
            setRole(data.role || 'player')
          }
          if (isMounted) setLoading(false)
        }, (err) => {
          console.warn('Aviso no snapshot do usuário:', err)
          if (isMounted) setLoading(false)
        })
      } else {
        if (unsubUserDoc) unsubUserDoc()
        if (isMounted) {
          setUser(null)
          setCharacter(null)
          setRole('player')
          setLoading(false)
        }
      }
    })

    // Timeout de segurança: nunca deixa a aplicação travada na tela de carregamento por mais de 3s
    const fallbackTimer = setTimeout(() => {
      if (isMounted) setLoading(false)
    }, 3000)

    // Listener para quando a aba voltar a ter foco/ficar visível: sincronizar dados mais recentes
    const handleFocus = async () => {
      if (auth.currentUser) {
        try {
          const snap = await getDoc(doc(db, 'users', auth.currentUser.uid))
          if (snap.exists() && isMounted) {
            const data = snap.data()
            setCharacter(data.character)
            setRole(data.role || 'player')
          }
        } catch (err) {
          console.warn('Erro ao sincronizar no foco:', err)
        }
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        handleFocus()
      }
    })

    return () => {
      isMounted = false
      clearTimeout(fallbackTimer)
      window.removeEventListener('focus', handleFocus)
      if (unsubUserDoc) unsubUserDoc()
      unsubscribeAuth()
    }
  }, [])

  // Carrega dados do personagem do Firestore (fallback / manual refresh)
  async function loadCharacter(uid) {
    const docRef = doc(db, 'users', uid)
    const docSnap = await getDoc(docRef)
    if (docSnap.exists()) {
      const data = docSnap.data()
      setCharacter(data.character)
      setRole(data.role || 'player')
    }
  }

  // Ref para sempre ter acesso ao valor mais atual do character dentro do intervalo sem disparar re-criações do useEffect
  const characterRef = useRef(character)
  useEffect(() => {
    characterRef.current = character
  }, [character])

  // --------------------------------------------------------------------------
  // SISTEMA DE DEGRADAÇÃO AUTOMÁTICA DE VITAIS (TAXA DE JOGO)
  // - Sede: -2% a cada 10 min (-0.2% por minuto)
  // - Fome: -1.5% a cada 15 min (-0.1% por minuto)
  // - Inanição/Desidratação (Fome ou Sede em 0%): -0.5% de Vida por minuto
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!user) return

    let lastTick = Date.now()

    const interval = setInterval(async () => {
      // Se a aba estiver oculta/minimizada, apenas atualiza lastTick para não acumular nem punir
      if (document.hidden || document.visibilityState !== 'visible') {
        lastTick = Date.now()
        return
      }

      const currentChar = characterRef.current
      if (!currentChar) return

      const now = Date.now()
      const elapsedSec = Math.max(1, (now - lastTick) / 1000)
      lastTick = now

      const minutesPassed = elapsedSec / 60
      const currentVitals = currentChar.vitals || { hunger: 100, thirst: 100, blood: 100 }

      const curH = Number(currentVitals.hunger ?? 100)
      const curT = Number(currentVitals.thirst ?? 100)
      const curB = Number(currentVitals.blood  ?? 100)

      // Efeitos de Vantagens e Desvantagens (Perks)
      const perks = Array.isArray(currentChar.perks) ? currentChar.perks : []
      let thirstMultiplier = 1
      let hungerMultiplier = 1
      let bloodMultiplier = 1

      if (perks.includes('sedento')) thirstMultiplier *= 1.5
      if (perks.includes('hidratado')) thirstMultiplier *= 0.5
      if (perks.includes('faminto')) hungerMultiplier *= 1.5
      if (perks.includes('estomago_pequeno')) hungerMultiplier *= 0.5
      if (perks.includes('pele_fragil')) bloodMultiplier *= 1.5
      if (perks.includes('pele_grossa')) bloodMultiplier *= 0.5

      // Sede: 0.2% por min | Fome: 0.1% por min
      const thirstLoss = minutesPassed * 0.2 * thirstMultiplier
      const hungerLoss = minutesPassed * 0.1 * hungerMultiplier

      const newThirst = Math.max(0, parseFloat((curT - thirstLoss).toFixed(2)))
      const newHunger = Math.max(0, parseFloat((curH - hungerLoss).toFixed(2)))
      let newBlood = curB

      if (newHunger === 0 || newThirst === 0) {
        const bloodLoss = minutesPassed * 0.5 * bloodMultiplier
        newBlood = Math.max(0, parseFloat((curB - bloodLoss).toFixed(2)))
      }

      if (newThirst !== curT || newHunger !== curH || newBlood !== curB) {
        const nextVitals = {
          hunger: newHunger,
          thirst: newThirst,
          blood: newBlood,
        }

        // 1. Atualização imediata na UI
        setCharacter(prev => prev ? ({ ...prev, vitals: nextVitals }) : prev)

        // 2. Gravação assíncrona no Firestore
        try {
          const userRef = doc(db, 'users', user.uid)
          await updateDoc(userRef, {
            'character.vitals': nextVitals
          })
        } catch (err) {
          console.error('Erro ao atualizar vitais:', err)
        }
      }
    }, 20000) // Intervalo a cada 20 segundos

    return () => clearInterval(interval)
  }, [user?.uid])

  // Cadastro: cria conta + personagem
  async function register(email, password, characterData) {
    const credential = await createUserWithEmailAndPassword(auth, email, password)
    const uid = credential.user.uid

    const baseAttrs = {
      forca: Number(characterData.forca ?? 1),
      destreza: Number(characterData.destreza ?? 1),
      agilidade: Number(characterData.agilidade ?? 1),
      sabedoria: Number(characterData.sabedoria ?? 1),
      percepcao: Number(characterData.percepcao ?? 1),
      inteligencia: Number(characterData.inteligencia ?? 1),
      carisma: Number(characterData.carisma ?? 1),
      constituicao: Number(characterData.constituicao ?? 1),
    }

    const newCharacter = {
      name: characterData.name,
      age: characterData.age,
      level: 1,
      xp: 0,
      avatarUrl: characterData.avatarUrl || null,
      profession: characterData.profession || null,
      specialty: characterData.specialty || null,
      traits: Array.isArray(characterData.traits) ? characterData.traits : [],
      perks: Array.isArray(characterData.perks) ? characterData.perks : [],
      backstory: characterData.backstory || '',
      preMadeSheetId: characterData.preMadeSheetId || null,
      baseAttributes: baseAttrs,
      attributes: characterData.attributes || baseAttrs,
      inventory: Array.isArray(characterData.inventory) ? characterData.inventory : [],
      rublos: Number(characterData.rublos ?? 200), // Novos personagens começam com 200 Rublos
      currentLocation: characterData.currentLocation || 'sala-hospital',
      lastLootByLocation: {},
      uniqueSearchesDone: {},
      vitals: {
        hunger: 100,
        thirst: 100,
        blood: getMaxHp({ attributes: characterData.attributes || baseAttrs }),
      },
      createdAt: serverTimestamp(),
    }

    await setDoc(doc(db, 'users', uid), {
      email,
      role: 'player',
      character: newCharacter,
    })

    if (characterData.preMadeSheetId) {
      try {
        await updateDoc(doc(db, 'pre_made_sheets', characterData.preMadeSheetId), {
          available: false,
          claimedBy: uid,
          claimedByName: characterData.name,
          claimedAt: serverTimestamp()
        })
      } catch (sheetErr) {
        console.warn('Aviso ao atualizar status da ficha pré-pronta:', sheetErr)
      }
    }

    setCharacter(newCharacter)
    return credential
  }

  // Login
  async function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password)
  }

  // Logout
  async function logout() {
    return signOut(auth)
  }

  // Recuperação de Senha
  async function resetPassword(email) {
    return sendPasswordResetEmail(auth, email)
  }

  // Atualiza personagem
  async function updateCharacter(updates) {
    if (!user) return
    const docRef = doc(db, 'users', user.uid)
    const updateData = {}
    Object.keys(updates).forEach((key) => {
      updateData[`character.${key}`] = updates[key]
    })
    await updateDoc(docRef, updateData)
    setCharacter((prev) => ({ ...prev, ...updates }))
  }

  // Recarrega dados do personagem
  async function refreshCharacter() {
    if (user) await loadCharacter(user.uid)
  }

  // Consumir um item do inventário e aplicar efeitos de vitais
  async function consumeItem(instanceId, quantityToConsume = 1, consumeEffect = null) {
    if (!user) return
    const userRef = doc(db, 'users', user.uid)

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(userRef)
      if (!snap.exists()) throw new Error('Personagem não encontrado.')

      const charData = snap.data().character || {}
      const inventory = [...(charData.inventory || [])]
      const itemIndex = inventory.findIndex((i) => i.instanceId === instanceId)

      if (itemIndex === -1) throw new Error('Item não encontrado no inventário.')

      const item = inventory[itemIndex]
      if (item.quantity < quantityToConsume) {
        throw new Error('Quantidade insuficiente para consumir.')
      }

      if (item.quantity === quantityToConsume) {
        inventory.splice(itemIndex, 1)
      } else {
        inventory[itemIndex] = {
          ...item,
          quantity: item.quantity - quantityToConsume,
        }
      }

      // Aplica efeitos nos vitais
      const currentVitals = charData.vitals || { hunger: 100, thirst: 100, blood: 100 }
      let updatedVitals = { ...currentVitals }
      if (consumeEffect) {
        const hAdd = (consumeEffect.hunger || 0) * quantityToConsume
        const tAdd = (consumeEffect.thirst || 0) * quantityToConsume
        const bAdd = (consumeEffect.blood  || 0) * quantityToConsume

        const charMaxHp = getMaxHp(charData)
        updatedVitals = {
          hunger: Math.max(0, Math.min(100, (updatedVitals.hunger ?? 100) + hAdd)),
          thirst: Math.max(0, Math.min(100, (updatedVitals.thirst ?? 100) + tAdd)),
          blood:  Math.max(0, Math.min(charMaxHp, (updatedVitals.blood  ?? charMaxHp) + bAdd)),
        }
      }

      transaction.update(userRef, {
        'character.inventory': inventory,
        'character.vitals': updatedVitals,
      })
    })

    await refreshCharacter()
  }

  // Descartar item do inventário
  async function discardItem(instanceId, quantityToDiscard = 1) {
    if (!user) return
    const userRef = doc(db, 'users', user.uid)

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(userRef)
      if (!snap.exists()) throw new Error('Personagem não encontrado.')

      const charData = snap.data().character || {}
      const inventory = [...(charData.inventory || [])]
      const itemIndex = inventory.findIndex((i) => i.instanceId === instanceId)

      if (itemIndex === -1) throw new Error('Item não encontrado no inventário.')

      const item = inventory[itemIndex]
      if (item.isQuestItem) {
        throw new Error('Este é um item importante de missão e não pode ser descartado!')
      }

      if (item.quantity < quantityToDiscard) {
        throw new Error('Quantidade insuficiente para descarte.')
      }

      if (item.quantity === quantityToDiscard) {
        inventory.splice(itemIndex, 1)
      } else {
        inventory[itemIndex] = {
          ...item,
          quantity: item.quantity - quantityToDiscard,
        }
      }

      transaction.update(userRef, {
        'character.inventory': inventory,
      })
    })

    await refreshCharacter()
  }

  // Equipar um item no slot anatômico correspondente
  async function equipItem(instanceId) {
    if (!user || !instanceId) return
    const userRef = doc(db, 'users', user.uid)

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(userRef)
      if (!snap.exists()) throw new Error('Personagem não encontrado.')

      const charData = snap.data().character || {}
      const inventory = [...(charData.inventory || [])]
      const targetItem = inventory.find((i) => i.instanceId === instanceId)

      if (!targetItem) throw new Error('Item não encontrado no inventário.')

      // Determina o equipSlot do item diretamente ou a partir do preset / catalog
      let targetSlot = targetItem.equipSlot
      if (!targetSlot) {
        const preset = DEFAULT_PRESET_ITEMS.find((p) => p.itemId === targetItem.itemId)
        if (preset?.equipSlot) {
          targetSlot = preset.equipSlot
          targetItem.equipSlot = preset.equipSlot
        }
      }

      if (!targetSlot) {
        // Tenta buscar na coleção items_db
        const itemDbRef = doc(db, 'items_db', targetItem.itemId)
        const itemDbSnap = await transaction.get(itemDbRef)
        if (itemDbSnap.exists() && itemDbSnap.data().equipSlot) {
          targetSlot = itemDbSnap.data().equipSlot
          targetItem.equipSlot = targetSlot
        }
      }

      if (!targetSlot) throw new Error('Este item não pode ser equipado em nenhum slot corporal.')

      // Desequipa qualquer outro item que esteja atualmente no mesmo slot
      inventory.forEach((i) => {
        const itemSlot = i.equipSlot || DEFAULT_PRESET_ITEMS.find((p) => p.itemId === i.itemId)?.equipSlot
        if (itemSlot === targetSlot && i.equipped && i.instanceId !== instanceId) {
          i.equipped = false
        }
      })

      // Equipa o item selecionado
      targetItem.equipped = true

      transaction.update(userRef, {
        'character.inventory': inventory,
      })
    })

    await refreshCharacter()
  }

  // Desequipar um item e mantê-lo na mochila
  async function unequipItem(instanceId) {
    if (!user || !instanceId) return
    const userRef = doc(db, 'users', user.uid)

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(userRef)
      if (!snap.exists()) throw new Error('Personagem não encontrado.')

      const charData = snap.data().character || {}
      const inventory = [...(charData.inventory || [])]
      const targetItem = inventory.find((i) => i.instanceId === instanceId)

      if (!targetItem) throw new Error('Item não encontrado.')
      targetItem.equipped = false

      transaction.update(userRef, {
        'character.inventory': inventory,
      })
    })

    await refreshCharacter()
  }

  // Grava a conclusão da Busca Única e adiciona os itens selecionados ao inventário
  async function recordUniqueSearch(locationSlug, chosenItems = []) {
    if (!user || !locationSlug) return
    const userRef = doc(db, 'users', user.uid)

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(userRef)
      if (!snap.exists()) throw new Error('Personagem não encontrado.')

      const charData = snap.data().character || {}
      const uniqueSearchesDone = { ...(charData.uniqueSearchesDone || {}) }

      if (uniqueSearchesDone[locationSlug]) {
        throw new Error('Você já realizou a Busca Única neste local.')
      }

      uniqueSearchesDone[locationSlug] = new Date().toISOString()
      const inventory = [...(charData.inventory || [])]

      // Adiciona itens escolhidos (empilha se já existir o mesmo itemId)
      chosenItems.forEach((item) => {
        const existing = inventory.find(i => i.itemId === item.itemId && !i.isQuestItem)
        if (existing) {
          existing.quantity = (existing.quantity || 1) + (item.quantity || 1)
        } else {
          inventory.push({
            instanceId: Math.random().toString(36).substring(2) + Date.now().toString(36),
            itemId: item.itemId,
            name: item.name,
            icon: item.icon,
            imageUrl: item.imageUrl || '',
            rarity: item.rarity || 'rare',
            quantity: item.quantity || 1,
            category: item.category || 'general',
            consumable: item.consumable ?? false,
            consumeEffect: item.consumeEffect || null,
            isQuestItem: item.isQuestItem ?? false,
            unlocks: item.unlocks || [],
            obtainedAt: new Date().toISOString(),
            obtainedFrom: `Busca Única (${locationSlug})`,
          })
        }
      })

      transaction.update(userRef, {
        'character.inventory': inventory,
        [`character.uniqueSearchesDone.${locationSlug}`]: new Date(),
      })
    })

    await refreshCharacter()
  }

  // Transferência de item de forma transacional e segura
  async function transferItem(recipientUid, itemInstanceId, quantityToTransfer) {
    if (!user) return
    const senderRef = doc(db, 'users', user.uid)
    const recipientRef = doc(db, 'users', recipientUid)

    await runTransaction(db, async (transaction) => {
      const senderSnap = await transaction.get(senderRef)
      const recipientSnap = await transaction.get(recipientRef)

      if (!senderSnap.exists() || !recipientSnap.exists()) {
        throw new Error('Jogador remetente ou destinatário não encontrado.')
      }

      const senderData = senderSnap.data()
      const recipientData = recipientSnap.data()

      const senderInventory = [...(senderData.character?.inventory || [])]
      const recipientInventory = [...(recipientData.character?.inventory || [])]

      // Busca o item no inventário do remetente
      const itemIndex = senderInventory.findIndex((i) => i.instanceId === itemInstanceId)
      if (itemIndex === -1) {
        throw new Error('Item não encontrado no seu inventário.')
      }

      const item = senderInventory[itemIndex]
      if (item.quantity < quantityToTransfer) {
        throw new Error('Quantidade insuficiente para transferência.')
      }

      // Reduz ou remove do remetente
      if (item.quantity === quantityToTransfer) {
        senderInventory.splice(itemIndex, 1)
      } else {
        senderInventory[itemIndex] = {
          ...item,
          quantity: item.quantity - quantityToTransfer,
        }
      }

      // Adiciona ao destinatário (empilha se já existir o mesmo itemId)
      const recipientExisting = recipientInventory.find(i => i.itemId === item.itemId && !i.isQuestItem)
      if (recipientExisting) {
        recipientExisting.quantity = (recipientExisting.quantity || 1) + quantityToTransfer
      } else {
        recipientInventory.push({
          instanceId: Math.random().toString(36).substring(2) + Date.now().toString(36),
          itemId: item.itemId,
          name: item.name,
          icon: item.icon,
          rarity: item.rarity || 'common',
          quantity: quantityToTransfer,
          category: item.category || 'general',
          consumable: item.consumable ?? false,
          consumeEffect: item.consumeEffect || null,
          isQuestItem: item.isQuestItem ?? false,
          unlocks: item.unlocks || [],
          obtainedAt: new Date().toISOString(),
          obtainedFrom: 'transferência',
        })
      }

      // Cria a notificação para o destinatário
      const notification = {
        id: 'notif_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
        type: 'item_received',
        senderUid: user.uid,
        senderName: senderData.character?.name || 'Sobrevivente',
        senderAvatar: senderData.character?.avatarUrl || null,
        item: {
          itemId: item.itemId,
          name: item.name,
          icon: item.icon,
          rarity: item.rarity || 'common',
          quantity: quantityToTransfer
        },
        read: false,
        createdAt: new Date().toISOString()
      }

      const recipientNotifications = [
        notification,
        ...(recipientData.character?.notifications || []).slice(0, 49) // guarda até 50 notificações
      ]

      transaction.update(senderRef, {
        'character.inventory': senderInventory,
      })

      transaction.update(recipientRef, {
        'character.inventory': recipientInventory,
        'character.notifications': recipientNotifications
      })
    })

    await refreshCharacter()
  }

  // Transferência de Novos Rublos de forma atômica e segura
  async function transferMoney(recipientUid, amountToTransfer) {
    if (!user) return
    const amount = Number(amountToTransfer)

    if (!recipientUid || recipientUid === user.uid) {
      throw new Error('Destinatário inválido.')
    }
    if (isNaN(amount) || !Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount)) {
      throw new Error('Informe um valor inteiro válido maior que zero.')
    }

    const senderRef = doc(db, 'users', user.uid)
    const recipientRef = doc(db, 'users', recipientUid)

    await runTransaction(db, async (transaction) => {
      const senderSnap = await transaction.get(senderRef)
      const recipientSnap = await transaction.get(recipientRef)

      if (!senderSnap.exists() || !recipientSnap.exists()) {
        throw new Error('Jogador remetente ou destinatário não encontrado.')
      }

      const senderData = senderSnap.data()
      const recipientData = recipientSnap.data()

      const senderRublos = Number(senderData.character?.rublos || 0)
      const recipientRublos = Number(recipientData.character?.rublos || 0)

      if (senderRublos < amount) {
        throw new Error('Você não possui Novos Rublos suficientes para esta transferência.')
      }

      const nextSenderRublos = senderRublos - amount
      const nextRecipientRublos = recipientRublos + amount

      if (nextSenderRublos < 0) {
        throw new Error('A transação resultaria em saldo negativo.')
      }

      // Cria a notificação para o destinatário
      const notification = {
        id: 'notif_rublos_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
        type: 'money_received',
        senderUid: user.uid,
        senderName: senderData.character?.name || 'Sobrevivente',
        senderAvatar: senderData.character?.avatarUrl || null,
        amount: amount,
        read: false,
        createdAt: new Date().toISOString()
      }

      const recipientNotifications = [
        notification,
        ...(recipientData.character?.notifications || []).slice(0, 49)
      ]

      transaction.update(senderRef, {
        'character.rublos': nextSenderRublos
      })

      transaction.update(recipientRef, {
        'character.rublos': nextRecipientRublos,
        'character.notifications': recipientNotifications
      })
    })

    await refreshCharacter()
  }

  // Marca todas as notificações como lidas
  async function markNotificationsRead() {
    if (!user || !character?.notifications) return
    const updated = (character.notifications || []).map(n => ({ ...n, read: true }))
    try {
      const userRef = doc(db, 'users', user.uid)
      await updateDoc(userRef, { 'character.notifications': updated })
      setCharacter(prev => ({
        ...prev,
        notifications: updated
      }))
    } catch (err) {
      console.error('Erro ao marcar notificações:', err)
    }
  }

  // Limpa histórico de notificações
  async function clearNotifications() {
    if (!user) return
    try {
      const userRef = doc(db, 'users', user.uid)
      await updateDoc(userRef, { 'character.notifications': [] })
      setCharacter(prev => ({
        ...prev,
        notifications: []
      }))
    } catch (err) {
      console.error('Erro ao limpar notificações:', err)
    }
  }

  const value = {
    user,
    character,
    role,
    loading,
    register,
    login,
    logout,
    resetPassword,
    updateCharacter,
    refreshCharacter,
    transferItem,
    transferMoney,
    consumeItem,
    discardItem,
    equipItem,
    unequipItem,
    recordUniqueSearch,
    markNotificationsRead,
    clearNotifications,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
