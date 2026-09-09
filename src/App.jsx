import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { doc, onSnapshot, getDoc } from 'firebase/firestore'
import { db } from './firebase/config'
import { useAuth } from './contexts/AuthContext.jsx'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Home from './pages/Home.jsx'
import Location from './pages/Location.jsx'
import Character from './pages/Character.jsx'
import Characters from './pages/Characters.jsx'
import Admin from './pages/Admin.jsx'
import Map from './pages/Map.jsx'
import PublicCharacter from './pages/PublicCharacter.jsx'
import Combat from './pages/Combat.jsx'
import Rules from './pages/Rules.jsx'
import AmbientSoundPlayer from './components/AmbientSoundPlayer.jsx'
import { calculateGameTime, getDynamicWeather } from './utils/timeSystem'
import { DEFAULT_WEATHER_SOUNDS } from './utils/audioSystem'
import { checkAndTriggerAutoBroadcasts } from './utils/radioSystem'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-screen"><span className="loading-dot" /></div>
  return user ? children : <Navigate to="/login" replace />
}

function PublicRoute({ children }) {
  const { user, character, loading } = useAuth()
  if (loading) return <div className="loading-screen"><span className="loading-dot" /></div>
  const targetLoc = character?.currentLocation || 'acampamento'
  return !user ? children : <Navigate to={`/location/${targetLoc}`} replace />
}

function AdminRoute({ children }) {
  const { user, character, role, loading } = useAuth()
  if (loading) return <div className="loading-screen"><span className="loading-dot" /></div>
  if (!user) return <Navigate to="/login" replace />
  const targetLoc = character?.currentLocation || 'acampamento'
  return role === 'admin' ? children : <Navigate to={`/location/${targetLoc}`} replace />
}

/**
 * GlobalRadioScheduler: Executa o scheduler de transmissões automáticas
 * de forma atômica e independente de onde o jogador esteja navegando.
 */
function GlobalRadioScheduler() {
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return

    // Checagem inicial
    checkAndTriggerAutoBroadcasts().catch(() => {})

    // Checagem periódica a cada 60 segundos
    const interval = setInterval(() => {
      checkAndTriggerAutoBroadcasts().catch(() => {})
    }, 60_000)

    return () => clearInterval(interval)
  }, [user])

  return null
}

/**
 * GlobalAmbientSound: Gerencia o áudio ambiente de clima e o som específico da locação
 * de forma unificada e ininterrupta entre trocas de página.
 */
function GlobalAmbientSound() {
  const { user } = useAuth()
  const routeLocation = useLocation()
  const [gameConfig, setGameConfig] = useState(null)
  const [isIndoor, setIsIndoor] = useState(false)
  const [locationSoundUrl, setLocationSoundUrl] = useState('')
  const [disableWeatherSound, setDisableWeatherSound] = useState(false)

  // 1. Escuta o clima global em tempo real
  useEffect(() => {
    if (!user) return
    const unsub = onSnapshot(doc(db, 'game_config', 'global'), (snap) => {
      if (snap.exists()) setGameConfig(snap.data())
    })
    return unsub
  }, [user])

  // 2. Extrai o slug do local da rota atual e busca se é Indoor, se tem som específico da sala e se o clima é silenciado
  useEffect(() => {
    const pathname = routeLocation.pathname
    if (pathname.startsWith('/location/')) {
      const slug = pathname.replace('/location/', '').split('/')[0]
      if (slug) {
        getDoc(doc(db, 'locations', slug))
          .then((snap) => {
            if (snap.exists()) {
              const data = snap.data()
              setIsIndoor(!!data.isIndoor)
              setLocationSoundUrl(data.locationSound || '')
              setDisableWeatherSound(!!data.disableWeatherSound)
            } else {
              setIsIndoor(false)
              setLocationSoundUrl('')
              setDisableWeatherSound(false)
            }
          })
          .catch(() => {
            setIsIndoor(false)
            setLocationSoundUrl('')
            setDisableWeatherSound(false)
          })
      }
    } else {
      // Fora de uma locação (ex: /character, /combat, /map), trata como ambiente interno sem som de sala
      setIsIndoor(true)
      setLocationSoundUrl('')
      setDisableWeatherSound(false)
    }
  }, [routeLocation.pathname])

  if (!user) return null

  const gameTime = calculateGameTime(gameConfig)
  const weather = getDynamicWeather(gameConfig, gameTime)

  return (
    <AmbientSoundPlayer
      condition={weather?.condition || 'sunny'}
      isIndoor={isIndoor}
      weatherSounds={gameConfig?.weatherSounds || DEFAULT_WEATHER_SOUNDS}
      locationSoundUrl={locationSoundUrl}
      disableWeatherSound={disableWeatherSound}
    />
  )
}

export default function App() {
  return (
    <BrowserRouter>
      {/* Scheduler global de rádio & Player de áudio ambiente persistente */}
      <GlobalRadioScheduler />
      <GlobalAmbientSound />

      <Routes>
        {/* Rotas públicas */}
        <Route path="/" element={<Home />} />
        <Route path="/rules" element={<Rules />} />
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<Register />} />

        {/* Rotas protegidas */}
        <Route path="/location/:slug" element={<ProtectedRoute><Location /></ProtectedRoute>} />
        <Route path="/character" element={<ProtectedRoute><Character /></ProtectedRoute>} />
        <Route path="/characters" element={<ProtectedRoute><Characters /></ProtectedRoute>} />
        <Route path="/combat" element={<ProtectedRoute><Combat /></ProtectedRoute>} />
        <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
        <Route path="/map" element={<ProtectedRoute><Map /></ProtectedRoute>} />
        <Route path="/map/:region" element={<ProtectedRoute><Map /></ProtectedRoute>} />
        <Route path="/map/:region/:city" element={<ProtectedRoute><Map /></ProtectedRoute>} />
        <Route path="/characters/:uid" element={<ProtectedRoute><PublicCharacter /></ProtectedRoute>} />

        {/* Redirecionamentos */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
