import { createContext, useContext, useEffect, useState, useRef } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
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

      // Sede: 0.2% por min | Fome: 0.1% por min
      const thirstLoss = minutesPassed * 0.2
      const hungerLoss = minutesPassed * 0.1

      const newThirst = Math.max(0, parseFloat((curT - thirstLoss).toFixed(2)))
      const newHunger = Math.max(0, parseFloat((curH - hungerLoss).toFixed(2)))
      let newBlood = curB

      if (newHunger === 0 || newThirst === 0) {
        const bloodLoss = minutesPassed * 0.5
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

    const newCharacter = {
      name: characterData.name,
      age: characterData.age,
      level: 1,
      xp: 0,
      avatarUrl: characterData.avatarUrl || null,
      attributes: {
        forca: characterData.forca,
        destreza: characterData.destreza,
        sabedoria: characterData.sabedoria,
        carisma: characterData.carisma,
        constituicao: characterData.constituicao,
      },
      inventory: [],
      currentLocation: 'sala-hospital',
      lastLootByLocation: {},
      uniqueSearchesDone: {},
      vitals: {
        hunger: 100,
        thirst: 100,
        blood: 100,
      },
      createdAt: serverTimestamp(),
    }

    await setDoc(doc(db, 'users', uid), {
      email,
      role: 'player',
      character: newCharacter,
    })

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

        updatedVitals = {
          hunger: Math.max(0, Math.min(100, (updatedVitals.hunger ?? 100) + hAdd)),
          thirst: Math.max(0, Math.min(100, (updatedVitals.thirst ?? 100) + tAdd)),
          blood:  Math.max(0, Math.min(100, (updatedVitals.blood  ?? 100) + bAdd)),
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
    updateCharacter,
    refreshCharacter,
    transferItem,
    consumeItem,
    discardItem,
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
