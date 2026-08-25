import { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../contexts/AuthContext.jsx'
import DiceRoller from './DiceRoller.jsx'
import CharacterPopup from './CharacterPopup.jsx'

const WEATHER_ICONS = {
  sunny: '☀️',
  cloudy: '☁️',
  rainy: '🌧️',
  foggy: '🌫️',
  storm: '⛈️',
}

export default function HUD({ locationName }) {
  const { character, role, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [gameConfig, setGameConfig] = useState(null)
  const [showDice, setShowDice] = useState(false)
  const [showCharacter, setShowCharacter] = useState(false)
  const [currentTime, setCurrentTime] = useState('')

  // Escuta configurações globais do jogo em tempo real
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'game_config', 'global'), (snap) => {
      if (snap.exists()) setGameConfig(snap.data())
    })
    return unsub
  }, [])

  // Relógio local (atualiza a cada minuto)
  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setCurrentTime(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
    }
    tick()
    const interval = setInterval(tick, 60000)
    return () => clearInterval(interval)
  }, [])

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  const weather = gameConfig?.weather
  const displayTime = gameConfig?.time?.mode === 'manual'
    ? gameConfig.time.value
    : currentTime

  return (
    <>
      <header className="hud">
        {/* Esquerda: logo + localização */}
        <div className="hud-left">
          <span className="hud-logo">ZONA ZERO</span>
          {locationName && (
            <span className="hud-location-name">{locationName}</span>
          )}
        </div>

        {/* Centro: clima + hora */}
        <div className="hud-center">
          {weather && (
            <div className="hud-weather">
              <span className="weather-icon">
                {WEATHER_ICONS[weather.condition] || '🌡️'}
              </span>
              <span className="temp">{weather.temperature}°C</span>
              <span className="separator">·</span>
              <span>{weather.label}</span>
              <span className="separator">|</span>
              <span className="time">{displayTime}</span>
            </div>
          )}
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

          <Link
            to="/characters"
            className={`hud-btn ${location.pathname === '/characters' ? 'active' : ''}`}
          >
            <span className="hud-btn-icon">👥</span>
            Sobreviventes
          </Link>

          <button
            className={`hud-btn ${showCharacter ? 'active' : ''}`}
            onClick={() => setShowCharacter((prev) => !prev)}
            title="Ver Personagem"
          >
            <span className="hud-btn-icon">👤</span>
            Personagem
          </button>

          <button
            className={`hud-btn ${showDice ? 'active' : ''}`}
            onClick={() => setShowDice((prev) => !prev)}
            title="Rolar Dados"
          >
            <span className="hud-btn-icon">🎲</span>
            Dados
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

      {showDice && <DiceRoller onClose={() => setShowDice(false)} />}
      {showCharacter && <CharacterPopup onClose={() => setShowCharacter(false)} />}
    </>
  )
}
