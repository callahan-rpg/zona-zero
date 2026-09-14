import { useState, useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from './firebase/config'
import { useAuth } from './contexts/AuthContext.jsx'
import { useGameConfig } from './contexts/GameConfigContext.jsx'
import AmbientSoundPlayer from './components/AmbientSoundPlayer.jsx'
import { calculateGameTime, getDynamicWeather } from './utils/timeSystem'
import { DEFAULT_WEATHER_SOUNDS } from './utils/audioSystem'
import { checkAndTriggerAutoBroadcasts } from './utils/radioSystem'

// Carregamento sob demanda (Lazy Loading): o navegador baixa o código de cada tela
// apenas quando o jogador navega até ela, diminuindo o tempo de carregamento inicial.
const Home = lazy(() => import('./pages/Home.jsx'))
const Login = lazy(() => import('./pages/Login.jsx'))
const Register = lazy(() => import('./pages/Register.jsx'))
const Rules = lazy(() => import('./pages/Rules.jsx'))
const Location = lazy(() => import('./pages/Location.jsx'))
const Character = lazy(() => import('./pages/Character.jsx'))
const Characters = lazy(() => import('./pages/Characters.jsx'))
const PublicCharacter = lazy(() => import('./pages/PublicCharacter.jsx'))
const Combat = lazy(() => import('./pages/Combat.jsx'))
const Admin = lazy(() => import('./pages/Admin.jsx'))
const Map = lazy(() => import('./pages/Map.jsx'))
const Forum = lazy(() => import('./pages/Forum.jsx'))

/**
 * ProtectedLayout: Proteção padrão do roteador.
 * Todas as rotas filhas exigem login obrigatório por padrão.
 */
function ProtectedLayout() {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-screen"><span className="loading-dot" /></div>
  return user ? <Outlet /> : <Navigate to="/login" replace />
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
 * Usa o GameConfigContext compartilhado — sem abrir conexão Firestore própria.
 */
function GlobalAmbientSound() {
  const { user } = useAuth()
  const gameConfig = useGameConfig()
  const routeLocation = useLocation()
  const [isIndoor, setIsIndoor] = useState(false)
  const [locationSoundUrl, setLocationSoundUrl] = useState('')
  const [disableWeatherSound, setDisableWeatherSound] = useState(false)

  // Extrai o slug do local da rota atual e busca se é Indoor, se tem som específico da sala e se o clima é silenciado
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

      <Suspense fallback={<div className="loading-screen"><span className="loading-dot" /></div>}>
        <Routes>
          {/* ROTAS PÚBLICAS (Declaradas explicitamente) */}
          <Route path="/" element={<Home />} />
          <Route path="/rules" element={<Rules />} />
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

          {/* PROTEÇÃO PADRÃO: Qualquer rota interna exige login obrigatório por padrão */}
          <Route element={<ProtectedLayout />}>
            <Route path="/location/:slug" element={<Location />} />
            <Route path="/character" element={<Character />} />
            <Route path="/characters" element={<Characters />} />
            <Route path="/characters/:uid" element={<PublicCharacter />} />
            <Route path="/combat" element={<Combat />} />
            <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
            <Route path="/map" element={<Map />} />
            <Route path="/map/:region" element={<Map />} />
            <Route path="/map/:region/:city" element={<Map />} />
            <Route path="/forum" element={<Forum />} />
            <Route path="/forum/:topicId" element={<Forum />} />
          </Route>

          {/* Redirecionamento de rotas desconhecidas */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
