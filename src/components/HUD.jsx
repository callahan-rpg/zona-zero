import { useEffect, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { doc, onSnapshot, collection } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../contexts/AuthContext.jsx'
import DiceRoller from './DiceRoller.jsx'
import CharacterPopup from './CharacterPopup.jsx'
import CalendarModal from './CalendarModal.jsx'
import SettingsModal from './SettingsModal.jsx'
import NotificationBell from './NotificationBell.jsx'
import MoneyTransferModal from './MoneyTransferModal.jsx'
import GameIcon from './GameIcon.jsx'
import { calculateGameTime, getDynamicWeather } from '../utils/timeSystem'
import { hasFeatureUnlocked, getTimeOfDay, getVitalsDebuffs } from '../utils/itemSystem'

export default function HUD({ locationName }) {
  const { character, role, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [gameConfig, setGameConfig] = useState(null)
  const [calendarEvents, setCalendarEvents] = useState([])
  const [hasActiveCombat, setHasActiveCombat] = useState(false)
  const [showDice, setShowDice] = useState(false)
  const [showCharacter, setShowCharacter] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showMoneyTransfer, setShowMoneyTransfer] = useState(false)
  const [showWeatherPopover, setShowWeatherPopover] = useState(false)
  const [tickCounter, setTickCounter] = useState(0)
  const [dismissedVitalAlert, setDismissedVitalAlert] = useState(false)
  const [weatherFxEnabled, setWeatherFxEnabled] = useState(() => {
    return localStorage.getItem('zz_weather_fx') !== 'false'
  })

  // Escuta evento customizado para abertura do modal de transferência
  useEffect(() => {
    const handleOpenMoney = () => setShowMoneyTransfer(true)
    window.addEventListener('open_money_transfer_modal', handleOpenMoney)
    return () => window.removeEventListener('open_money_transfer_modal', handleOpenMoney)
  }, [])

  // Escuta combates ativos no Firestore para exibir o botão com badge pulsante
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'active_combats'), (snap) => {
      const anyActive = snap.docs.some(d => d.data().active)
      setHasActiveCombat(anyActive)
    })
    return unsub
  }, [])


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

  // Verifica se o personagem possui item que desbloqueia a visualização de relógio preciso
  const hasClock = hasFeatureUnlocked(character?.inventory, 'hud_clock')
  const periodOfDay = getTimeOfDay(gameTime)

  // Checagem de vitais para alertas na tela
  const vitals = character?.vitals || { hunger: 100, thirst: 100, blood: 100 }
  const debuffInfo = getVitalsDebuffs(vitals)
  const isHungerLow = (vitals.hunger ?? 100) < 30
  const isThirstLow = (vitals.thirst ?? 100) < 30
  const isBloodLow  = (vitals.blood ?? 100) < 30
  const hasVitalWarning = isHungerLow || isThirstLow || isBloodLow

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
            title={hasClock ? "Clique para abrir o Calendário de Sobrevivência & Eventos" : "Você não possui um relógio. Exibindo estimativa solar do período."}
          >
            <span className="weather-icon">{weather.icon}</span>
            <span className="temp">{weather.temperature}°C</span>
            <span className="separator">|</span>
            {hasClock ? (
              <span className="time" style={{ fontWeight: 'bold' }}>{gameTime.timeString}</span>
            ) : (
              <span className="time" style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                <small>{periodOfDay.icon}</small> {periodOfDay.label}
              </span>
            )}
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
            <GameIcon name="rooms" size={16} className="hud-btn-icon" />
          </Link>

          <Link
            to="/map"
            className={`hud-btn ${location.pathname === '/map' ? 'active' : ''}`}
          >
            <GameIcon name="map" size={16} className="hud-btn-icon" />
          </Link>

          <button
            type="button"
            onClick={() => {
              if (location.pathname === '/characters') return
              if (location.pathname.startsWith('/location')) {
                window.open('/characters', '_blank', 'noopener,noreferrer')
              } else {
                navigate('/characters')
              }
            }}
            className={`hud-btn ${location.pathname === '/characters' ? 'active' : ''}`}
            title={location.pathname === '/characters' ? 'Você já está na página de Sobreviventes' : 'Sobreviventes'}
          >
            <GameIcon name="players" size={16} className="hud-btn-icon" />
          </button>

          <button
            type="button"
            onClick={() => {
              if (location.pathname === '/combat') return
              if (location.pathname.startsWith('/location')) {
                window.open('/combat', '_blank', 'noopener,noreferrer')
              } else {
                navigate('/combat')
              }
            }}
            className={`hud-btn combat-hud-icon-btn ${location.pathname === '/combat' ? 'active' : ''} ${hasActiveCombat ? 'combat-pulsing-active' : ''}`}
            title={hasActiveCombat ? "⚔️ Mesa de Combate Tático (EM ANDAMENTO)" : "⚔️ Mesa de Combate Tático"}
          >
            <GameIcon name="combat" size={18} className="hud-btn-icon" style={{ margin: 0 }} />
          </button>

          <button
            className={`hud-btn ${showDice ? 'active' : ''}`}
            onClick={() => setShowDice((prev) => !prev)}
            title="Rolar Dados"
          >
            <GameIcon name="dice" size={16} className="hud-btn-icon" />
          </button>

          {/* Botão de Configurações do Usuário (Clima, Opacidade, Áudio) */}
          <button
            className={`hud-btn ${showSettings ? 'active' : ''}`}
            onClick={() => setShowSettings((prev) => !prev)}
            title="Configurações (Clima, Opacidade e Áudio)"
            style={{ padding: '7px 10px' }}
          >
            <GameIcon name="settings" size={16} className="hud-btn-icon" />
          </button>

          {role === 'admin' && (
            <Link
              to="/admin"
              className={`hud-btn ${location.pathname === '/admin' ? 'active' : ''}`}
              style={{ borderColor: 'var(--accent-yellow)', color: 'var(--accent-yellow)' }}
            >
              <GameIcon name="admin" size={16} className="hud-btn-icon" />
              Admin
            </Link>
          )}

          {/* Sininho de Notificações de Itens */}
          <NotificationBell />

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
            <GameIcon name="logout" size={16} className="hud-btn-icon" />
            Sair
          </button>
        </div>
      </header>

      {/* Alerta na tela para Fome ou Sede crítica (< 30%) */}
      {hasVitalWarning && !dismissedVitalAlert && (
        <div className="vital-warning-banner">
          <div className="vital-warning-content">
            <span className="vital-warning-icon">⚠️</span>
            <div className="vital-warning-text">
              <strong>Atenção Sobrevivente:</strong>
              {isBloodLow && <span className="vital-tag danger">Vida Crítica ({vitals.blood ?? 0}%)</span>}
              {isThirstLow && <span className="vital-tag warning">Desidratando ({vitals.thirst ?? 0}%)</span>}
              {isHungerLow && <span className="vital-tag warning">Fome Severa ({vitals.hunger ?? 0}%)</span>}
              <span className="vital-tag debuff-alert">Debuff ativo nos Atributos</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <Link to="/character" className="vital-warning-btn">
              Mochila / Consumir
            </Link>
            <button
              type="button"
              className="vital-warning-close"
              onClick={() => setDismissedVitalAlert(true)}
              title="Dispensar aviso por agora"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Popups flutuantes */}
      {showDice && <DiceRoller onClose={() => setShowDice(false)} />}
      {showCharacter && <CharacterPopup onClose={() => setShowCharacter(false)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showMoneyTransfer && <MoneyTransferModal isOpen={showMoneyTransfer} onClose={() => setShowMoneyTransfer(false)} />}
      {showCalendar && (
        <CalendarModal
          gameTime={gameTime}
          weather={weather}
          events={calendarEvents}
          hasClock={hasClock}
          onClose={() => setShowCalendar(false)}
        />
      )}
    </>
  )
}
