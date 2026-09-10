import { createContext, useContext, useEffect, useState } from "react"
import { doc, onSnapshot } from "firebase/firestore"
import { db } from "../firebase/config"
import { useAuth } from "./AuthContext.jsx"

// Estado singleton em memoria para evitar leituras duplicadas entre re-renders
let cachedConfig = null
let activeUnsub = null
const subscribers = new Set()

function startSharedConfigListener() {
  if (activeUnsub) return
  activeUnsub = onSnapshot(doc(db, "game_config", "global"), (snap) => {
    const data = snap.exists() ? snap.data() : null
    cachedConfig = data
    subscribers.forEach((cb) => {
      try { cb(data) } catch (e) { console.error("GameConfigContext subscriber error:", e) }
    })
  }, (err) => {
    console.warn("Aviso no listener de game_config/global:", err)
  })
}

function subscribeGameConfig(callback) {
  subscribers.add(callback)
  if (cachedConfig !== null) callback(cachedConfig)
  startSharedConfigListener()
  return () => { subscribers.delete(callback) }
}

const GameConfigContext = createContext(null)

export function GameConfigProvider({ children }) {
  const { user } = useAuth()
  const [gameConfig, setGameConfig] = useState(cachedConfig)

  useEffect(() => {
    if (!user) return
    return subscribeGameConfig((config) => setGameConfig(config))
  }, [user])

  return (
    <GameConfigContext.Provider value={gameConfig}>
      {children}
    </GameConfigContext.Provider>
  )
}

/**
 * Hook para consumir game_config/global de forma centralizada.
 * Garante que exista apenas 1 conexao Firestore para este documento
 * independente de quantos componentes chamem este hook.
 */
export function useGameConfig() {
  return useContext(GameConfigContext)
}
