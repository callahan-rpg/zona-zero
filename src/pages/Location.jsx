import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, getDoc, updateDoc, arrayUnion, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../contexts/AuthContext.jsx'
import HUD from '../components/HUD.jsx'
import WeatherEffects from '../components/WeatherEffects.jsx'
import { calculateGameTime, getDynamicWeather } from '../utils/timeSystem'

// Locação padrão de teste (sala do hospital)
// Em produção, todos os dados virão do Firestore via admin panel
const DEFAULT_LOCATION = {
  name: 'Sala do Hospital',
  slug: 'sala-hospital',
  description: 'Corredores úmidos e escuros. O cheiro de antisséptico misturado com algo pior paira no ar. Equipamentos médicos tombados pelo chão.',
  backgroundImage: null, // Coloque a URL de uma imagem de fundo aqui
  xatIframe: `https://xat.com/embed/chat.php#id=220535128&gn=CachoeiraAltheris_acerpg`,
  navigationButtons: [],
  loot: {
    enabled: true,
    cooldownMinutes: 30,
    emptyChance: 0.35,
    maxItemsPerSearch: 2,
    table: [
      { itemId: 'atadura',     name: 'Atadura',     icon: '🩹', chance: 0.65, min: 1, max: 3 },
      { itemId: 'analgesico',  name: 'Analgésico',  icon: '💊', chance: 0.45, min: 1, max: 2 },
      { itemId: 'seringa',     name: 'Seringa',     icon: '💉', chance: 0.25, min: 1, max: 1 },
      { itemId: 'antibiotico', name: 'Antibiótico', icon: '🧪', chance: 0.15, min: 1, max: 1 },
      { itemId: 'ataduraster', name: 'Kit de Sutura',icon:'🧵', chance: 0.08, min: 1, max: 1 },
    ],
  },
}

function rollLoot(lootConfig) {
  if (Math.random() < lootConfig.emptyChance) return []

  const found = []
  const shuffled = [...lootConfig.table].sort(() => Math.random() - 0.5)

  for (const item of shuffled) {
    if (found.length >= lootConfig.maxItemsPerSearch) break
    if (Math.random() < item.chance) {
      const qty = Math.floor(Math.random() * (item.max - item.min + 1)) + item.min
      found.push({ ...item, quantity: qty })
    }
  }
  return found
}

export default function Location() {
  const { slug } = useParams()
  const { user, character, refreshCharacter } = useAuth()
  const navigate = useNavigate()

  const [location, setLocation] = useState(null)
  const [loadingLocation, setLoadingLocation] = useState(true)
  const [gameConfig, setGameConfig] = useState(null)
  const [weatherFxEnabled, setWeatherFxEnabled] = useState(() => {
    return localStorage.getItem('zz_weather_fx') !== 'false'
  })

  // Escuta alterações no toggle de efeitos visuais disparados pelo HUD
  useEffect(() => {
    const handleFxToggle = () => {
      setWeatherFxEnabled(localStorage.getItem('zz_weather_fx') !== 'false')
    }
    window.addEventListener('weather_fx_toggle', handleFxToggle)
    return () => window.removeEventListener('weather_fx_toggle', handleFxToggle)
  }, [])

  // Escuta configurações de clima global em tempo real
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'game_config', 'global'), (snap) => {
      if (snap.exists()) setGameConfig(snap.data())
    })
    return unsub
  }, [])

  // Loot state
  const [lootState, setLootState] = useState('idle') // idle | searching | result
  const [lootResult, setLootResult] = useState([])
  const [lootCooldown, setLootCooldown] = useState(false)

  // Carrega dados da locação do Firestore (ou usa padrão para teste)
  useEffect(() => {
    async function loadLocation() {
      setLoadingLocation(true)
      try {
        const docRef = doc(db, 'locations', slug)
        const docSnap = await getDoc(docRef)
        if (docSnap.exists()) {
          setLocation(docSnap.data())
        } else {
          // Fallback para locação padrão de teste
          setLocation(DEFAULT_LOCATION)
        }
      } catch {
        setLocation(DEFAULT_LOCATION)
      } finally {
        setLoadingLocation(false)
      }
    }
    loadLocation()
  }, [slug])

  // Verifica cooldown de loot para esta locação com atualização em tempo real
  useEffect(() => {
    if (!location) return

    const checkCooldown = () => {
      if (!character?.lastLootByLocation) {
        setLootCooldown(false)
        return
      }
      const lastLoot = character.lastLootByLocation[slug]
      if (!lastLoot) {
        setLootCooldown(false)
        return
      }

      const lastDate = lastLoot.toDate ? lastLoot.toDate() : new Date(lastLoot)
      const cooldownMs = (location.loot?.cooldownMinutes || 30) * 60 * 1000
      const elapsed = Date.now() - lastDate.getTime()
      setLootCooldown(elapsed < cooldownMs)
    }

    checkCooldown()
    const timer = setInterval(checkCooldown, 2000) // Reavalia a cada 2 segundos
    return () => clearInterval(timer)
  }, [character, location, slug])

  async function handleLoot() {
    if (lootState !== 'idle' || lootCooldown || !location?.loot?.enabled) return

    setLootState('searching')
    await new Promise((r) => setTimeout(r, 2500)) // animação de busca

    const items = rollLoot(location.loot)
    setLootResult(items)
    setLootState('result')

    // Salva timestamp de busca de recursos (mesmo se vier vazio para trigger do cooldown!)
    if (user) {
      const userRef = doc(db, 'users', user.uid)
      const updates = {
        [`character.lastLootByLocation.${slug}`]: new Date()
      }

      if (items.length > 0) {
        const inventoryItems = items.map((item) => ({
          instanceId: Math.random().toString(36).substring(2) + Date.now().toString(36),
          itemId: item.itemId,
          name: item.name,
          icon: item.icon,
          quantity: item.quantity,
          obtainedAt: new Date().toISOString(),
          obtainedFrom: slug,
        }))
        updates['character.inventory'] = arrayUnion(...inventoryItems)
      }

      try {
        await updateDoc(userRef, updates)
        await refreshCharacter()
        setLootCooldown(true) // Força bloqueio visual imediato
      } catch (err) {
        console.error("Erro ao salvar loot:", err)
      }
    }
  }

  function closeLootModal() {
    setLootState('idle')
    setLootResult([])
  }

  if (loadingLocation) {
    return (
      <div className="loading-screen">
        <span className="loading-dot" />
      </div>
    )
  }

  if (!location) return null

  const hasBackground = !!location.backgroundImage

  // Calcula o clima dinâmico sincronizado com o HUD e o Calendário
  const gameTime = calculateGameTime(gameConfig)
  const weather = getDynamicWeather(gameConfig, gameTime)

  return (
    <div className="location-page">
      {/* Background */}
      <div
        className={`location-bg ${hasBackground ? '' : 'fallback'}`}
        style={hasBackground ? { backgroundImage: `url(${location.backgroundImage})` } : {}}
      />

      {/* Efeitos Climáticos (Renderizados no Canvas sobre o background) */}
      <WeatherEffects
        condition={weather?.condition || 'sunny'}
        enabled={weatherFxEnabled}
        isIndoor={!!location.isIndoor}
      />

      <div className="location-overlay" />

      {/* HUD */}
      <HUD locationName={location.name} />

      {/* Conteúdo principal */}
      <div className="location-content">
        <div className="location-main">
          {/* Botões de saída (esquerda) */}
          <div className="nav-buttons-left">
            {location.navigationButtons?.filter(b => b.position === 'left').map((btn, i) => (
              <button
                key={i}
                className="nav-btn"
                onClick={() => btn.target && navigate(`/location/${btn.target}`)}
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* Chat central */}
          <div className="chat-container">
            <div className="chat-wrapper">
              <iframe
                src={location.xatIframe}
                allow="clipboard-write"
                width="100%"
                height="500"
                frameBorder="0"
                scrolling="no"
                title={`Chat — ${location.name}`}
              />
            </div>

            {/* Botão de busca de recursos */}
            {location.loot?.enabled && (
              <div className="loot-section">
                <button
                  className={`loot-btn ${lootState === 'searching' ? 'searching' : ''}`}
                  onClick={handleLoot}
                  disabled={lootState !== 'idle' || lootCooldown}
                  title={lootCooldown ? 'Você já procurou aqui recentemente. Aguarde o cooldown.' : ''}
                >
                  <span>{lootState === 'searching' ? '🔍' : lootCooldown ? '⏳' : '🔦'}</span>
                  {lootState === 'searching'
                    ? 'Procurando...'
                    : lootCooldown
                    ? 'Cooldown ativo'
                    : 'Procurar Recursos'}
                </button>
              </div>
            )}
          </div>

          {/* Botões direita */}
          <div className="nav-buttons-right">
            {location.navigationButtons?.filter(b => b.position !== 'left').map((btn, i) => (
              <button
                key={i}
                className="nav-btn"
                onClick={() => btn.target && navigate(`/location/${btn.target}`)}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Modal de resultado do loot */}
      {lootState === 'result' && (
        <div className="loot-modal-overlay" onClick={closeLootModal}>
          <div
            className={`loot-modal ${lootResult.length === 0 ? 'empty' : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            {lootResult.length > 0 ? (
              <>
                <h3>🔦 Você encontrou!</h3>
                <div className="loot-items">
                  {lootResult.map((item, i) => (
                    <div className="loot-item" key={i}>
                      <div className="loot-item-info">
                        <span className="loot-item-icon">{item.icon}</span>
                        <span>{item.name}</span>
                      </div>
                      <span className="loot-item-qty">×{item.quantity}</span>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                  Itens adicionados ao inventário.
                </p>
              </>
            ) : (
              <>
                <h3>😶 Nada encontrado</h3>
                <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24 }}>
                  Você vasculhou o local mas não encontrou nada útil desta vez.
                </p>
              </>
            )}
            <button className="btn btn-primary btn-sm" onClick={closeLootModal}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
