import { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { doc, onSnapshot, collection } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../contexts/AuthContext.jsx'
import DiceRoller from './DiceRoller.jsx'
import CharacterPopup from './CharacterPopup.jsx'
import CalendarModal from './CalendarModal.jsx'
import { calculateGameTime, getDynamicWeather } from '../utils/timeSystem'

export default function HUD({ locationName }) {
  const { character, role, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [gameConfig, setGameConfig] = useState(null)
  const [calendarEvents, setCalendarEvents] = useState([])
  const [showDice, setShowDice] = useState(false)
  const [showCharacter, setShowCharacter] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  const [showWeatherPopover, setShowWeatherPopover] = useState(false)
  const [tickCounter, setTickCounter] = useState(0)
  const [weatherFxEnabled, setWeatherFxEnabled] = useState(() => {
    return localStorage.getItem('zz_weather_fx') !== 'false'
  })

  function toggleWeatherFx() {
    setWeatherFxEnabled(prev => {
      const next = !prev
      localStorage.setItem('zz_weather_fx', String(next))
      window.dispatchEvent(new Event('weather_fx_toggle'))
      return next
    })
  }

  // Escuta configurações globais do jogo em tempo real
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'game_config', 'global'), (snap) => {
      if (snap.exists()) setGameConfig(snap.data())
    })
    return unsub
  }, [])

  // Escuta eventos do calendário cadastrados no Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'calendar_events'), (snap) => {
      setCalendarEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [])

  // Relógio do jogo (atualiza periodicamente a simulação)
  useEffect(() => {
    const interval = setInterval(() => {
      setTickCounter(prev => prev + 1)
    }, 1000) // 1s de atualização para fluidez temporal
    return () => clearInterval(interval)
  }, [])

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  // Cálculo temporal e climático
  const gameTime = calculateGameTime(gameConfig)
  const weather = getDynamicWeather(gameConfig, gameTime)

  return (
    <>
      <header className="hud">
        {/* Esquerda: logo + localização + clima dinâmico e interativo */}
        <div className="hud-left">
          <span className="hud-logo">ZONA ZERO</span>
          {locationName && (
            <span className="hud-location-name">{locationName}</span>
          )}

          {/* Widget de Clima e Horário Dinâmico (Clique para abrir o Calendário) */}
          <button
            className={`hud-weather ${showCalendar ? 'active' : ''}`}
            onClick={() => setShowCalendar(prev => !prev)}
            title="Clique para abrir o Calendário de Sobrevivência & Eventos"
          >
            <span className="weather-icon">{weather.icon}</span>
            <span className="temp">{weather.temperature}°C</span>
            <span className="separator">|</span>
            <span className="time">{gameTime.timeString}</span>
            <span className="season-icon" title={gameTime.season.name}>{gameTime.season.icon}</span>
            <span className="moon-icon" title={gameTime.moonPhase.name}>{gameTime.moonPhase.icon}</span>
          </button>
        </div>

        {/* Direita: botões de navegação */}
        <div className="hud-right">
          <Link
            to={`/location/${character?.currentLocation || 'sala-hospital'}`}
            className={`hud-btn ${location.pathname.startsWith('/location') ? 'active' : ''}`}
          >
            <span className="hud-btn-icon">🏚️</span>
            Salas
          </Link>

          <Link
            to="/map"
            className={`hud-btn ${location.pathname === '/map' ? 'active' : ''}`}
          >
            <span className="hud-btn-icon">🗺️</span>
            Mapa
          </Link>

          <a
            href="/characters"
            target="_blank"
            rel="noopener noreferrer"
            className={`hud-btn ${location.pathname === '/characters' ? 'active' : ''}`}
          >
            <span className="hud-btn-icon">👥</span>
            Sobreviventes
          </a>

          <button
            className={`hud-btn ${showDice ? 'active' : ''}`}
            onClick={() => setShowDice((prev) => !prev)}
            title="Rolar Dados"
          >
            <span className="hud-btn-icon">🎲</span>
            Dados
          </button>

          <button
            className={`hud-btn ${weatherFxEnabled ? 'active' : ''}`}
            onClick={toggleWeatherFx}
            title={weatherFxEnabled ? 'Efeitos Climáticos: Ligados (Clique para desligar)' : 'Efeitos Climáticos: Desligados (Clique para ligar)'}
            style={{ padding: '7px 10px' }}
          >
            <span className="hud-btn-icon" style={{ fontSize: 15 }}>{weatherFxEnabled ? '✨' : '💤'}</span>
          </button>

          {role === 'admin' && (
            <Link
              to="/admin"
              className={`hud-btn ${location.pathname === '/admin' ? 'active' : ''}`}
              style={{ borderColor: 'var(--accent-yellow)', color: 'var(--accent-yellow)' }}
            >
              <span className="hud-btn-icon">🛠️</span>
              Admin
            </Link>
          )}

          {character?.avatarUrl ? (
            <img
              className="hud-avatar"
              src={character.avatarUrl}
              alt={character.name}
              onClick={() => setShowCharacter((prev) => !prev)}
              title={`${character.name} (Clique para abrir ficha)`}
            />
          ) : (
            <div
              className="hud-avatar-placeholder"
              onClick={() => setShowCharacter((prev) => !prev)}
              title={`${character?.name || 'Personagem'} (Clique para abrir ficha)`}
            >
              🧟
            </div>
          )}

          <button className="hud-btn btn-danger" onClick={handleLogout}>
            <span className="hud-btn-icon">🚪</span>
            Sair
          </button>
        </div>
      </header>

      {/* Popups flutuantes */}
      {showDice && <DiceRoller onClose={() => setShowDice(false)} />}
      {showCharacter && <CharacterPopup onClose={() => setShowCharacter(false)} />}
      {showCalendar && (
        <CalendarModal
          gameTime={gameTime}
          events={calendarEvents}
          onClose={() => setShowCalendar(false)}
        />
      )}
    </>
  )
}
