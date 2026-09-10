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
import { getMaxHp, DEFAULT_PRESET_ITEMS, getItemUses, hasRadio } from '../utils/itemSystem'
import { addItemToInventory } from '../utils/activitySystem'
import { canUnequipBackpack } from '../utils/weightSystem'
import { syncPlayerIndex } from '../utils/playerIndexService'
import { getCatalogItem } from '../utils/itemCatalogService'

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

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (!isMounted) return

      if (firebaseUser) {
        setUser(firebaseUser)
        const docRef = doc(db, 'users', firebaseUser.uid)

        // Listener em tempo real único (já retorna os dados imediatamente no snapshot inicial)
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

    return () => {
      isMounted = false
      clearTimeout(fallbackTimer)
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

  // Sincronização automática com /players_index com debounce de 2.5s
  const lastIndexSyncKeyRef = useRef('')
  const syncIndexTimerRef = useRef(null)

  useEffect(() => {
    if (!user?.uid || !character?.name) return

    const profId = character?.profession?.id || (typeof character?.profession === 'string' ? character.profession : '')
    const hasRad = hasRadio(character?.inventory || [])
    const syncKey = `${character.name}|${character.avatarUrl || ''}|${character.level || 1}|${character.xp || 0}|${character.age || ''}|${profId}|${hasRad}|${role}`

    if (lastIndexSyncKeyRef.current === syncKey) return

    clearTimeout(syncIndexTimerRef.current)
    syncIndexTimerRef.current = setTimeout(() => {
      lastIndexSyncKeyRef.current = syncKey
      syncPlayerIndex(user.uid, character, role)
    }, 2500)

    return () => clearTimeout(syncIndexTimerRef.current)
  }, [user?.uid, character, role])

  // --------------------------------------------------------------------------
  // SISTEMA DE DEGRADAÇÃO AUTOMÁTICA DE VITAIS (TAXA DE JOGO)
  // - Sede: -2% a cada 10 min (-0.2% por minuto)
  // - Fome: -1.5% a cada 15 min (-0.1% por minuto)
  // - Inanição/Desidratação (Fome ou Sede em 0%): -0.5% de Vida por minuto
  // OTIMIZAÇÃO: A UI atualiza a cada 20s, mas a persistência no Firestore ocorre
  // a cada 3 minutos (ou imediatamente se a vida cair), economizando 90% de writes.
  // --------------------------------------------------------------------------
  const pendingVitalsRef = useRef(null)
  const lastPersistTimeRef = useRef(Date.now())

  useEffect(() => {
    if (!user) return

    let lastTick = Date.now()

    const persistVitalsNow = async (vitalsToSave) => {
      if (!vitalsToSave || !user) return
      try {
        const userRef = doc(db, 'users', user.uid)
        await updateDoc(userRef, {
          'character.vitals': vitalsToSave
        })
        lastPersistTimeRef.current = Date.now()
        pendingVitalsRef.current = null
      } catch (err) {
        console.error('Erro ao persistir vitais:', err)
      }
    }

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

        // 1. Atualização imediata e fluida na UI local
        setCharacter(prev => prev ? ({ ...prev, vitals: nextVitals }) : prev)
        pendingVitalsRef.current = nextVitals

        // 2. Gravação no Firestore apenas se:
        // - Passaram 3 minutos (180s) desde a última gravação OU
        // - A vida caiu (inanição crítica que precisa ser persistida)
        const timeSinceLastPersist = now - lastPersistTimeRef.current
        const bloodDropped = newBlood < curB

        if (timeSinceLastPersist >= 180000 || bloodDropped) {
          await persistVitalsNow(nextVitals)
        }
      }
    }, 20000) // Cálculo local suave a cada 20 segundos

    // Salva qualquer alteração pendente caso o usuário feche a aba
    const handleBeforeUnload = () => {
      if (pendingVitalsRef.current && user) {
        persistVitalsNow(pendingVitalsRef.current)
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      clearInterval(interval)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      if (pendingVitalsRef.current && user) {
        persistVitalsNow(pendingVitalsRef.current)
      }
    }
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
      currentLocation: characterData.currentLocation || 'acampamento',
      lastLootByLocation: {},
      uniqueSearchesDone: {},
      vitals: {
        hunger: 100,
        thirst: 100,
        blood: getMaxHp({ attributes: characterData.attributes || baseAttrs }),
      },
      introductionSeen: false, // Abertura narrativa: false = ainda não exibida
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

    try {
      await syncPlayerIndex(uid, newCharacter, 'player')
    } catch (indexErr) {
      console.warn('Aviso ao sincronizar players_index no cadastro:', indexErr)
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
      let inventory = [...(charData.inventory || [])]
      const itemIndex = inventory.findIndex((i) => i.instanceId === instanceId)

      if (itemIndex === -1) throw new Error('Item não encontrado no inventário.')

      const item = inventory[itemIndex]
      const usesInfo = getItemUses(item)
      const maxUses = usesInfo.maxUses

      if (maxUses > 1) {
        // Item com múltiplas doses/usos (ex: Kit de Cirurgia 3x, Álcool 2x)
        const currentUses = item.currentUses !== undefined ? Number(item.currentUses) : maxUses
        const newUses = currentUses - 1

        if (newUses > 0) {
          inventory[itemIndex] = {
            ...item,
            currentUses: newUses,
            maxUses: maxUses
          }
        } else {
          // Esgotou todos os usos desta unidade
          if (item.quantity > 1) {
            inventory[itemIndex] = {
              ...item,
              quantity: item.quantity - 1,
              currentUses: maxUses,
              maxUses: maxUses
            }
          } else {
            inventory.splice(itemIndex, 1)
          }

          // Se o item gera subproduto ao ser consumido por completo
          const returnItemId = item.returnItemOnConsume || (item.itemId === 'garrafa_agua' ? 'garrafa_vazia' : null)
          if (returnItemId) {
            const returnPreset = DEFAULT_PRESET_ITEMS.find(p => p.itemId === returnItemId)
            const returnItemData = {
              itemId: returnItemId,
              name: returnPreset?.name || 'Garrafa de Água Vazia',
              icon: returnPreset?.icon || '🍾',
              quantity: 1,
              category: returnPreset?.category || 'supplies',
              rarity: returnPreset?.rarity || 'common',
              consumable: false,
              isQuestItem: false,
              description: returnPreset?.description || 'Recipiente vazio restante após o consumo.',
              obtainedFrom: `Consumo de ${item.name || 'Item'}`
            }
            inventory = addItemToInventory(inventory, returnItemData)
          }
        }
      } else {
        // Item de uso único padrão
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

        // Se o item gera um recipiente/subproduto ao ser consumido (ex: Garrafa de Água -> Garrafa Vazia)
        const returnItemId = item.returnItemOnConsume || (item.itemId === 'garrafa_agua' ? 'garrafa_vazia' : null)
        if (returnItemId) {
          const returnPreset = DEFAULT_PRESET_ITEMS.find(p => p.itemId === returnItemId)
          const returnItemData = {
            itemId: returnItemId,
            name: returnPreset?.name || 'Garrafa de Água Vazia',
            icon: returnPreset?.icon || '🍾',
            quantity: quantityToConsume,
            category: returnPreset?.category || 'supplies',
            rarity: returnPreset?.rarity || 'common',
            consumable: false,
            isQuestItem: false,
            description: returnPreset?.description || 'Recipiente vazio restante após o consumo.',
            obtainedFrom: `Consumo de ${item.name || 'Água'}`
          }
          inventory = addItemToInventory(inventory, returnItemData)
        }
      }

      // Aplica efeitos nos vitais do próprio usuário
      const currentVitals = charData.vitals || { hunger: 100, thirst: 100, blood: 100 }
      let updatedVitals = { ...currentVitals }
      const effect = consumeEffect || item.consumeEffect
      if (effect) {
        const multiplier = maxUses > 1 ? 1 : quantityToConsume
        const hAdd = (effect.hunger || 0) * multiplier
        const tAdd = (effect.thirst || 0) * multiplier
        const bAdd = (effect.blood  || 0) * multiplier

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
  }

  // Usar item médico ou consumível em outro sobrevivente
  async function useItemOnTarget({ itemInstanceId, targetUid, consumeEffect = null }) {
    if (!user) return
    if (!targetUid || targetUid === user.uid) {
      return await consumeItem(itemInstanceId, 1, consumeEffect)
    }

    const senderRef = doc(db, 'users', user.uid)
    const targetRef = doc(db, 'users', targetUid)

    let resultSummary = null

    await runTransaction(db, async (transaction) => {
      const [senderSnap, targetSnap] = await Promise.all([
        transaction.get(senderRef),
        transaction.get(targetRef)
      ])

      if (!senderSnap.exists() || !targetSnap.exists()) {
        throw new Error('Jogador remetente ou paciente não encontrado.')
      }

      const senderData = senderSnap.data()
      const targetData = targetSnap.data()

      const senderChar = senderData.character || {}
      const targetChar = targetData.character || {}

      let senderInventory = [...(senderChar.inventory || [])]
      const itemIndex = senderInventory.findIndex((i) => i.instanceId === itemInstanceId)

      if (itemIndex === -1) {
        throw new Error('Item não encontrado na sua mochila.')
      }

      const item = senderInventory[itemIndex]
      const usesInfo = getItemUses(item)
      const maxUses = usesInfo.maxUses

      let remainingUses = 0

      if (maxUses > 1) {
        const currentUses = item.currentUses !== undefined ? Number(item.currentUses) : maxUses
        const newUses = currentUses - 1
        remainingUses = newUses

        if (newUses > 0) {
          senderInventory[itemIndex] = {
            ...item,
            currentUses: newUses,
            maxUses: maxUses
          }
        } else {
          if (item.quantity > 1) {
            senderInventory[itemIndex] = {
              ...item,
              quantity: item.quantity - 1,
              currentUses: maxUses,
              maxUses: maxUses
            }
            remainingUses = maxUses
          } else {
            senderInventory.splice(itemIndex, 1)
            remainingUses = 0
          }
        }
      } else {
        if (item.quantity > 1) {
          senderInventory[itemIndex] = {
            ...item,
            quantity: item.quantity - 1
          }
        } else {
          senderInventory.splice(itemIndex, 1)
        }
      }

      // Aplica efeitos nos vitais do paciente alvo
      const currentVitals = targetChar.vitals || { hunger: 100, thirst: 100, blood: 100 }
      let updatedVitals = { ...currentVitals }
      const effect = consumeEffect || item.consumeEffect || null

      if (effect) {
        const hAdd = Number(effect.hunger || 0)
        const tAdd = Number(effect.thirst || 0)
        const bAdd = Number(effect.blood  || 0)

        const targetMaxHp = getMaxHp(targetChar)
        updatedVitals = {
          hunger: Math.max(0, Math.min(100, (updatedVitals.hunger ?? 100) + hAdd)),
          thirst: Math.max(0, Math.min(100, (updatedVitals.thirst ?? 100) + tAdd)),
          blood:  Math.max(0, Math.min(targetMaxHp, (updatedVitals.blood  ?? targetMaxHp) + bAdd)),
        }
      }

      // Cria a notificação de tratamento para o paciente
      const effectDesc = []
      if (effect?.blood) effectDesc.push(`+${effect.blood} HP/Sangue`)
      if (effect?.hunger) effectDesc.push(`+${effect.hunger} Fome`)
      if (effect?.thirst) effectDesc.push(`+${effect.thirst} Sede`)
      const effectText = effectDesc.length > 0 ? ` (${effectDesc.join(', ')})` : ''

      const notification = {
        id: 'notif_med_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
        type: 'medical_treatment',
        senderUid: user.uid,
        senderName: senderChar.name || 'Médico / Sobrevivente',
        senderAvatar: senderChar.avatarUrl || null,
        item: {
          itemId: item.itemId,
          name: item.name || 'Item Médico',
          icon: item.icon || '🩺',
          rarity: item.rarity || 'common'
        },
        message: `${senderChar.name || 'Um sobrevivente'} prestou socorro e aplicou ${item.name || 'um item médico'} em você!${effectText}`,
        read: false,
        createdAt: new Date().toISOString()
      }

      const recipientNotifications = [
        notification,
        ...(targetChar.notifications || []).slice(0, 49)
      ]

      transaction.update(senderRef, {
        'character.inventory': senderInventory
      })

      transaction.update(targetRef, {
        'character.vitals': updatedVitals,
        'character.notifications': recipientNotifications
      })

      resultSummary = {
        itemName: item.name || 'Item Médico',
        targetName: targetChar.name || 'Sobrevivente',
        maxUses,
        remainingUses
      }
    })

    return resultSummary
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
  }

  // Equipar um item no slot anatômico correspondente
  // slotOverride permite forçar um acessório para o slot hands_weapon (para usar como arma principal)
  async function equipItem(instanceId, slotOverride = null) {
    if (!user || !instanceId) return
    const userRef = doc(db, 'users', user.uid)

    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(userRef)
      if (!snap.exists()) throw new Error('Personagem não encontrado.')

      const charData = snap.data().character || {}
      const inventory = [...(charData.inventory || [])]
      const targetItem = inventory.find((i) => i.instanceId === instanceId)

      if (!targetItem) throw new Error('Item não encontrado no inventário.')

      // Determina o equipSlot do item diretamente ou a partir do catálogo consolidado / presets locais (0 leituras)
      let naturalSlot = targetItem.equipSlot
      if (!naturalSlot) {
        const catItem = getCatalogItem(targetItem.itemId)
        if (catItem?.equipSlot) {
          naturalSlot = catItem.equipSlot
          targetItem.equipSlot = catItem.equipSlot
        }
      }
      if (!naturalSlot) {
        const preset = DEFAULT_PRESET_ITEMS.find((p) => p.itemId === targetItem.itemId)
        if (preset?.equipSlot) {
          naturalSlot = preset.equipSlot
          targetItem.equipSlot = preset.equipSlot
        }
      }

      if (!naturalSlot) {
        // Fallback legado na coleção items_db caso seja um item muito antigo
        try {
          const itemDbRef = doc(db, 'items_db', targetItem.itemId)
          const itemDbSnap = await transaction.get(itemDbRef)
          if (itemDbSnap.exists() && itemDbSnap.data().equipSlot) {
            naturalSlot = itemDbSnap.data().equipSlot
            targetItem.equipSlot = naturalSlot
          }
        } catch (_) {}
      }

      if (!naturalSlot) throw new Error('Este item não pode ser equipado em nenhum slot corporal.')

      const ACCESSORY_SLOTS = [
        'accessory_1',
        'accessory_2',
        'accessory_3',
        'accessory_4',
        'accessory_5',
        'accessory_6',
      ]

      const isAccessory =
        targetItem.category === 'accessories' ||
        targetItem.category === 'accessory' ||
        (naturalSlot && (naturalSlot === 'accessory' || naturalSlot.startsWith('accessory')))

      let targetSlot = slotOverride || naturalSlot

      // Valida se o slotOverride é permitido (apenas hands_weapon por enquanto)
      if (slotOverride && slotOverride !== naturalSlot) {
        const hasWeaponDamage = (Number(targetItem.damageMin) > 0 || Number(targetItem.damageMax) > 0)
        if (!hasWeaponDamage) throw new Error('Este acessório não possui dano e não pode ser equipado como arma.')
      }

      if (isAccessory && !slotOverride) {
        // Encontra quais slots de acessórios já estão ocupados por outros itens equipados
        const occupiedAccessorySlots = new Set()
        inventory.forEach((i) => {
          if (i.instanceId === instanceId || !i.equipped) return
          const iSlot = i.equippedAsSlot || i.equipSlot || DEFAULT_PRESET_ITEMS.find((p) => p.itemId === i.itemId)?.equipSlot
          if (iSlot && ACCESSORY_SLOTS.includes(iSlot)) {
            occupiedAccessorySlots.add(iSlot)
          }
        })

        // Procura o primeiro slot de acessório livre (de 1 a 6)
        const freeSlot = ACCESSORY_SLOTS.find((slot) => !occupiedAccessorySlots.has(slot))
        targetSlot = freeSlot || 'accessory_1'

        // Se todos os 6 slots estavam cheios e teve que substituir accessory_1, desequipa quem estava nele
        if (!freeSlot) {
          inventory.forEach((i) => {
            if (i.instanceId === instanceId) return
            const iSlot = i.equippedAsSlot || i.equipSlot || DEFAULT_PRESET_ITEMS.find((p) => p.itemId === i.itemId)?.equipSlot
            if (iSlot === 'accessory_1' && i.equipped) {
              i.equipped = false
              if (i.equippedAsSlot) delete i.equippedAsSlot
            }
          })
        }

        targetItem.equipped = true
        targetItem.equippedAsSlot = targetSlot
      } else {
        // Desequipa qualquer outro item que esteja atualmente no slot de destino
        inventory.forEach((i) => {
          if (i.instanceId === instanceId) return
          const iSlot = i.equippedAsSlot || i.equipSlot || DEFAULT_PRESET_ITEMS.find((p) => p.itemId === i.itemId)?.equipSlot
          if (iSlot === targetSlot && i.equipped) {
            i.equipped = false
            // Limpa o slot forçado se existia
            if (i.equippedAsSlot) delete i.equippedAsSlot
          }
        })

        // Equipa o item no slot (normal ou forçado)
        targetItem.equipped = true
        if (slotOverride && slotOverride !== naturalSlot) {
          // Marca temporariamente o slot onde está equipado para cálculos corretos
          targetItem.equippedAsSlot = slotOverride
        } else {
          // Remove slot forçado anterior se reequipando no slot natural
          if (targetItem.equippedAsSlot) delete targetItem.equippedAsSlot
        }
      }

      transaction.update(userRef, {
        'character.inventory': inventory,
      })
    })
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

      // Validação estrutural de slots para mochilas / expansores de inventário
      const unequipCheck = canUnequipBackpack(inventory, targetItem, charData)
      if (!unequipCheck.ok) {
        throw new Error(unequipCheck.error)
      }

      targetItem.equipped = false
      // Limpa slot forçado (ex: acessório usado como arma)
      if (targetItem.equippedAsSlot) delete targetItem.equippedAsSlot

      transaction.update(userRef, {
        'character.inventory': inventory,
      })
    })
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
    useItemOnTarget,
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
