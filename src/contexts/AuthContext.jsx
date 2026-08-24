import { createContext, useContext, useEffect, useState } from 'react'
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
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { auth, db, storage } from '../firebase/config'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [character, setCharacter] = useState(null)
  const [role, setRole] = useState('player')
  const [loading, setLoading] = useState(true)

  // Observa mudanças de autenticação
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser)
        await loadCharacter(firebaseUser.uid)
      } else {
        setUser(null)
        setCharacter(null)
        setRole('player')
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  // Carrega dados do personagem do Firestore
  async function loadCharacter(uid) {
    const docRef = doc(db, 'users', uid)
    const docSnap = await getDoc(docRef)
    if (docSnap.exists()) {
      const data = docSnap.data()
      setCharacter(data.character)
      setRole(data.role || 'player')
    }
  }

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

      // Adiciona ao destinatário (se já possuir item idêntico, soma. Senão insere novo)
      const recipientItemIndex = recipientInventory.findIndex((i) => i.itemId === item.itemId)
      if (recipientItemIndex !== -1) {
        recipientInventory[recipientItemIndex] = {
          ...recipientInventory[recipientItemIndex],
          quantity: recipientInventory[recipientItemIndex].quantity + quantityToTransfer,
        }
      } else {
        recipientInventory.push({
          instanceId: Math.random().toString(36).substring(2) + Date.now().toString(36),
          itemId: item.itemId,
          name: item.name,
          icon: item.icon,
          quantity: quantityToTransfer,
          obtainedAt: new Date().toISOString(),
          obtainedFrom: 'transferência',
        })
      }

      transaction.update(senderRef, {
        'character.inventory': senderInventory,
      })

      transaction.update(recipientRef, {
        'character.inventory': recipientInventory,
      })
    })

    await refreshCharacter()
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
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
