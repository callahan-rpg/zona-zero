import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, getDoc, updateDoc, runTransaction, onSnapshot, collection } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../contexts/AuthContext.jsx'
import HUD from '../components/HUD.jsx'
import CombatHUD from '../components/CombatHUD.jsx'
import WeatherEffects from '../components/WeatherEffects.jsx'
import ShopModal from '../components/ShopModal.jsx'
import StorageModal from '../components/StorageModal.jsx'
import { calculateGameTime, getDynamicWeather } from '../utils/timeSystem'
import { rollSupplyLoot, rollUniqueLoot, hasItem, RARITY_META } from '../utils/itemSystem'

/**
 * Retorna a imagem de fundo correta baseada na hora in-game.
 *  06h–17h → Dia
 *  05h–06h e 17h–18h → Amanhecer/Entardecer
 *  18h–05h → Noite
 * Fallback: backgroundImage geral → null
 */
function getBgForHour(hour, location) {
  const isDay      = hour >= 6  && hour < 17
  const isTwilight = (hour >= 5 && hour < 6) || (hour >= 17 && hour < 18)
  // night: hour >= 18 || hour < 5

  if (isDay)      return location.backgroundImageDay      || location.backgroundImage || null
  if (isTwilight) return location.backgroundImageTwilight || location.backgroundImage || null
  return               location.backgroundImageNight     || location.backgroundImage || null
}

// Locação padrão de teste (sala do hospital)
const DEFAULT_LOCATION = {
  name: 'Sala do Hospital',
  slug: 'sala-hospital',
  description: 'Corredores úmidos e escuros. O cheiro de antisséptico misturado com algo pior paira no ar. Equipamentos médicos tombados pelo chão.',
  backgroundImage: null,
  xatIframe: `https://xat.com/embed/chat.php#id=220535128&gn=CachoeiraAltheris_acerpg`,
  navigationButtons: [],
  loot: {
    enabled: true,
    cooldownMinutes: 30,
    emptyChance: 0.25,
    maxItemsPerSearch: 2,
    table: [
      { itemId: 'saco_lixo', name: 'Sacos de Lixo', icon: '🗑️', rarity: 'junk', chance: 0.60, min: 1, max: 2 },
      { itemId: 'bandagem', name: 'Bandagem Estéril', icon: '🩹', rarity: 'common', chance: 0.40, min: 1, max: 3 },
      { itemId: 'remedio_basico', name: 'Remédios Básicos', icon: '💊', rarity: 'common', chance: 0.30, min: 1, max: 2 },
      { itemId: 'alcool_antisseptico', name: 'Álcool 70%', icon: '🧪', rarity: 'uncommon', chance: 0.15, min: 1, max: 1 },
    ],
  },
  uniqueSearch: {
    enabled: true,
    maxCarry: 2,
    items: [
      { itemId: 'kit_cirurgico', name: 'Kit Médico Avançado', icon: '🩺', rarity: 'rare', quantity: 1, consumable: true, consumeEffect: { blood: 60, thirst: 10 } },
      { itemId: 'relogio_pulso', name: 'Relógio de Pulso', icon: '⌚', rarity: 'rare', quantity: 1, unlocks: ['hud_clock'] },
      { itemId: 'pistola_glock', name: 'Pistola 9mm', icon: '🔫', rarity: 'rare', quantity: 1, category: 'firearms' },
    ]
  }
}

export default function Location() {
  const { slug } = useParams()
  const { user, character, refreshCharacter, recordUniqueSearch } = useAuth()
  const navigate = useNavigate()

  const [location, setLocation] = useState(null)
  const [loadingLocation, setLoadingLocation] = useState(true)
  const [gameConfig, setGameConfig] = useState(null)
  const [weatherFxEnabled, setWeatherFxEnabled] = useState(() => {
    return localStorage.getItem('zz_weather_fx') !== 'false'
  })

  // --- Fade de imagem de fundo por período do dia ---
  const [currentBg, setCurrentBg] = useState(null)   // imagem visível agora
  const [prevBg,    setPrevBg]    = useState(null)   // imagem anterior (some com fade-out)
  const [fading,    setFading]    = useState(false)  // true durante a transição
  const fadingRef = useRef(false)

  // Toast de aviso (porta trancada, etc.)
  const [toastMessage, setToastMessage] = useState(null)

  // Estados de busca comum (Suprimentos)
  const [supplySearchState, setSupplySearchState] = useState('idle') // idle | searching | result
  const [supplyLootResult, setSupplyLootResult] = useState([])
  const [supplyCooldown, setSupplyCooldown] = useState(false)

  // Estados de Busca Única
  const [uniqueSearchState, setUniqueSearchState] = useState('idle') // idle | searching | choose_modal
  const [uniqueFoundItems, setUniqueFoundItems] = useState([])
  const [selectedUniqueIndices, setSelectedUniqueIndices] = useState([])
  const [uniqueSaving, setUniqueSaving] = useState(false)

  // Estados de Loja Local
  const [showShop, setShowShop] = useState(false)
  const [shopInfo, setShopInfo] = useState(null)
  const [catalogItems, setCatalogItems] = useState([])

  // Estados de Armazenamento / Storages Locais
  const [locationStorages, setLocationStorages] = useState([])
  const [activeStorageId, setActiveStorageId] = useState(null)
  const [showStorageModal, setShowStorageModal] = useState(false)

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  // Escuta dados da loja desta locação em tempo real
  useEffect(() => {
    if (!slug) return
    const unsub = onSnapshot(doc(db, 'shops', slug), (snap) => {
      if (snap.exists()) {
        setShopInfo({ id: snap.id, ...snap.data() })
      } else {
        setShopInfo(null)
      }
    })
    return unsub
  }, [slug])

  // Escuta recipientes de armazenamento vinculados a esta locação
  useEffect(() => {
    if (!slug) return
    const unsub = onSnapshot(collection(db, 'storages'), (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      const matched = docs.filter(st => st.locationSlug === slug)
      setLocationStorages(matched)
    })
    return unsub
  }, [slug])

  // Escuta catálogo geral de itens para hidratação de ícones e descrições na loja
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'items_db'), (snap) => {
      setCatalogItems(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [])

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

  // Carrega dados da locação do Firestore
  useEffect(() => {
    async function loadLocation() {
      setLoadingLocation(true)
      try {
        const docRef = doc(db, 'locations', slug)
        const docSnap = await getDoc(docRef)
        if (docSnap.exists()) {
          setLocation(docSnap.data())
        } else {
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

  // Inicializa a imagem de fundo quando a locação ou config carrega
  useEffect(() => {
    if (!location || !gameConfig) return
    const gt = calculateGameTime(gameConfig)
    const bg = getBgForHour(gt.hour, location)
    setCurrentBg(bg)
    setPrevBg(null)
    setFading(false)
    fadingRef.current = false
  }, [location, gameConfig])

  // Verifica a cada 30s se o período mudou e, se sim, dispara o fade
  useEffect(() => {
    if (!location || !gameConfig) return

    const check = () => {
      if (fadingRef.current) return // já em transição
      const gt  = calculateGameTime(gameConfig)
      const newBg = getBgForHour(gt.hour, location)
      setCurrentBg(prev => {
        if (newBg === prev) return prev // sem mudança
        // Inicia transição
        setPrevBg(prev)
        fadingRef.current = true
        setFading(true)
        // Após a duração do fade (2s), limpa a camada anterior
        setTimeout(() => {
          setPrevBg(null)
          setFading(false)
          fadingRef.current = false
        }, 2000)
        return newBg
      })
    }

    const timer = setInterval(check, 30_000)
    return () => clearInterval(timer)
  }, [location, gameConfig])

  // Verifica cooldown de busca de suprimentos para esta locação
  useEffect(() => {
    if (!location) return

    const checkCooldown = () => {
      if (!character?.lastLootByLocation) {
        setSupplyCooldown(false)
        return
      }
      const lastLoot = character.lastLootByLocation[slug]
      if (!lastLoot) {
        setSupplyCooldown(false)
        return
      }

      const lastDate = lastLoot.toDate ? lastLoot.toDate() : new Date(lastLoot)
      const cooldownMs = (location.loot?.cooldownMinutes || 30) * 60 * 1000
      const elapsed = Date.now() - lastDate.getTime()
      setSupplyCooldown(elapsed < cooldownMs)
    }

    checkCooldown()
    const timer = setInterval(checkCooldown, 2000)
    return () => clearInterval(timer)
  }, [character, location, slug])

  // Verifica se o personagem já fez a Busca Única deste local
  const isUniqueDone = !!(character?.uniqueSearchesDone && character.uniqueSearchesDone[slug])

  // Lógica de Busca de Suprimentos (Repetível com Cooldown - Sucata, Comum e Incomum)
  async function handleSupplySearch() {
    if (supplySearchState !== 'idle' || supplyCooldown || !location?.loot?.enabled) return

    setSupplySearchState('searching')
    await new Promise((r) => setTimeout(r, 2000))

    const items = rollSupplyLoot(location.loot, character?.perks || [])
    setSupplyLootResult(items)
    setSupplySearchState('result')

    if (user) {
      const userRef = doc(db, 'users', user.uid)

      try {
        await runTransaction(db, async (transaction) => {
          const snap = await transaction.get(userRef)
          if (!snap.exists()) throw new Error('Personagem não encontrado.')

          const charData = snap.data().character || {}
          const inventory = [...(charData.inventory || [])]

          // Empilha cada item encontrado com os do mesmo itemId já existentes
          for (const item of items) {
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
                rarity: item.rarity || 'common',
                quantity: item.quantity,
                category: item.category || 'general',
                consumable: item.consumable ?? false,
                consumeEffect: item.consumeEffect || null,
                isQuestItem: item.isQuestItem ?? false,
                description: item.description || '',
                unlocks: item.unlocks || [],
                obtainedAt: new Date().toISOString(),
                obtainedFrom: `Suprimentos (${slug})`,
              })
            }
          }

          transaction.update(userRef, {
            'character.inventory': inventory,
            [`character.lastLootByLocation.${slug}`]: new Date()
          })
        })

        await refreshCharacter()
        setSupplyCooldown(true)
      } catch (err) {
        console.error('Erro ao salvar busca de suprimentos:', err)
      }
    }
  }

  // Lógica da Busca Única (One-shot - Raro, Muito Raro e Excepcional)
  async function handleUniqueSearch() {
    if (uniqueSearchState !== 'idle' || isUniqueDone || !location?.uniqueSearch?.enabled) return

    setUniqueSearchState('searching')
    await new Promise((r) => setTimeout(r, 2500))

    const items = rollUniqueLoot(location.uniqueSearch)
    setUniqueFoundItems(items)
    setSelectedUniqueIndices([])
    setUniqueSearchState('choose_modal')
  }

  // Toggle de seleção de item no modal de Busca Única
  function toggleSelectUniqueItem(index) {
    const maxCarry = location?.uniqueSearch?.maxCarry || 1
    if (selectedUniqueIndices.includes(index)) {
      setSelectedUniqueIndices(prev => prev.filter(i => i !== index))
    } else {
      if (selectedUniqueIndices.length >= maxCarry) {
        showToast(`Você só pode carregar no máximo ${maxCarry} item(ns) deste local!`)
        return
      }
      setSelectedUniqueIndices(prev => [...prev, index])
    }
  }

  // Confirmar itens selecionados da Busca Única
  async function handleConfirmUniqueLoot() {
    if (selectedUniqueIndices.length === 0) {
      showToast('Selecione ao menos 1 item para levar!')
      return
    }

    setUniqueSaving(true)
    try {
      const chosen = selectedUniqueIndices.map(idx => uniqueFoundItems[idx])
      await recordUniqueSearch(slug, chosen)
      setUniqueSearchState('idle')
      setUniqueFoundItems([])
      setSelectedUniqueIndices([])
      showToast(`Você coletou ${chosen.length} item(ns) raros e deixou o resto para trás.`)
    } catch (err) {
      showToast(err.message || 'Erro ao coletar itens da busca única.')
    } finally {
      setUniqueSaving(false)
    }
  }

  // Tratamento de clique nos botões de navegação (com verificação de tranca/chave)
  function handleNavigationClick(btn) {
    if (btn.requiredItem) {
      const hasKey = hasItem(character?.inventory, btn.requiredItem)
      if (!hasKey) {
        showToast(btn.lockedMessage || '🔒 Porta trancada! Você não possui a chave necessária.')
        return
      }
    }
    if (btn.target) {
      navigate(`/location/${btn.target}`)
    }
  }

  if (loadingLocation) {
    return (
      <div className="loading-screen">
        <span className="loading-dot" />
      </div>
    )
  }

  if (!location) return null

  const gameTime = calculateGameTime(gameConfig)
  const weather = getDynamicWeather(gameConfig, gameTime)
  const maxCarry = location.uniqueSearch?.maxCarry || 1

  // Fallback puro quando nenhum período tiver imagem configurada
  const hasAnyBg = !!(location.backgroundImage || location.backgroundImageDay || location.backgroundImageNight || location.backgroundImageTwilight)

  return (
    <div className="location-page">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="game-toast-alert">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Camada anterior — some com fade-out durante a transição */}
      <div
        className="location-bg location-bg-prev"
        style={{
          backgroundImage: prevBg ? `url(${prevBg})` : 'none',
          opacity: fading && prevBg ? 1 : 0,
        }}
      />

      {/* Camada atual — aparece com fade-in */}
      <div
        className={`location-bg location-bg-current ${!hasAnyBg ? 'fallback' : ''}`}
        style={currentBg ? { backgroundImage: `url(${currentBg})`, opacity: fading ? 0 : 1 } : { opacity: fading ? 0 : 1 }}
      />

      {/* Efeitos Climáticos */}
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
            {location.navigationButtons?.filter(b => b.position === 'left').map((btn, i) => {
              const isLocked = btn.requiredItem && !hasItem(character?.inventory, btn.requiredItem)
              return (
                <button
                  key={i}
                  className={`nav-btn ${isLocked ? 'nav-btn-locked' : ''}`}
                  onClick={() => handleNavigationClick(btn)}
                  title={isLocked ? '🔒 Trancado (Requer chave)' : ''}
                >
                  {isLocked && <span style={{ marginRight: 6 }}>🔒</span>}
                  {btn.label}
                </button>
              )
            })}
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

            {/* Painel de Ações de Busca (Suprimentos + Busca Única + Loja / Comércio + Recipientes de Armazenamento) */}
            <div className="loot-search-actions-bar">
              {/* Botões de Armazenamentos Locais (Baús, Armários, Geladeiras, Cofres, etc.) */}
              {locationStorages.map(st => (
                <button
                  key={st.id}
                  className="loot-btn"
                  style={{
                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.25) 0%, rgba(37, 99, 235, 0.35) 100%)',
                    borderColor: '#3b82f6',
                    color: '#93c5fd',
                    fontWeight: 700,
                    boxShadow: '0 0 12px rgba(59, 130, 246, 0.25)'
                  }}
                  onClick={() => {
                    setActiveStorageId(st.id)
                    setShowStorageModal(true)
                  }}
                  title={st.description || `Abrir ${st.name}`}
                >
                  <span>{st.icon || '📦'}</span>
                  {st.name || 'Armazenamento'}
                </button>
              ))}

              {/* Botão 0: Acessar Loja / Comércio do Local */}
              {shopInfo && shopInfo.enabled !== false && (
                <button
                  className="loot-btn"
                  style={{
                    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(217, 119, 6, 0.35) 100%)',
                    borderColor: '#f59e0b',
                    color: '#facc15',
                    fontWeight: 700,
                    boxShadow: '0 0 12px rgba(245, 158, 11, 0.25)'
                  }}
                  onClick={() => setShowShop(true)}
                  title={`Abrir o comércio de ${location.name}`}
                >
                  <span>🏪</span>
                  {shopInfo.name || 'Acessar Loja'}
                </button>
              )}

              {/* Botão 1: Buscar Suprimentos (Repetível / Cooldown / Sucata & Comuns) */}
              {location.loot?.enabled && (
                <button
                  className={`loot-btn loot-btn-supply ${supplySearchState === 'searching' ? 'searching' : ''}`}
                  onClick={handleSupplySearch}
                  disabled={supplySearchState !== 'idle' || supplyCooldown}
                  title={supplyCooldown ? 'Você já procurou aqui recentemente. Aguarde o cooldown.' : 'Buscar itens comuns, mantimentos e sucatas no local.'}
                >
                  <span>{supplySearchState === 'searching' ? '🔍' : supplyCooldown ? '⏳' : '🔦'}</span>
                  {supplySearchState === 'searching'
                    ? 'Vasculhando...'
                    : supplyCooldown
                    ? 'Cooldown Suprimentos'
                    : 'Buscar Suprimentos'}
                </button>
              )}

              {/* Botão 2: Busca Única (One-Shot / Raros, Muito Raros e Excepcionais) */}
              {location.uniqueSearch?.enabled && (
                <button
                  className={`loot-btn loot-btn-unique ${uniqueSearchState === 'searching' ? 'searching' : ''} ${isUniqueDone ? 'unique-done' : ''}`}
                  onClick={handleUniqueSearch}
                  disabled={uniqueSearchState !== 'idle' || isUniqueDone}
                  title={isUniqueDone ? 'Você já fez a busca única deste local com este personagem.' : 'Busca especial de itens raros, equipamentos e segredos. Pode ser feita apenas 1 vez!'}
                >
                  <span>{isUniqueDone ? '🔒' : uniqueSearchState === 'searching' ? '✨' : '⭐'}</span>
                  {isUniqueDone
                    ? 'Busca Única Realizada'
                    : uniqueSearchState === 'searching'
                    ? 'Explorando Segredos...'
                    : 'Busca Única (Raros)'}
                </button>
              )}
            </div>
          </div>

          {/* Botões direita */}
          <div className="nav-buttons-right">
            {location.navigationButtons?.filter(b => b.position !== 'left').map((btn, i) => {
              const isLocked = btn.requiredItem && !hasItem(character?.inventory, btn.requiredItem)
              return (
                <button
                  key={i}
                  className={`nav-btn ${isLocked ? 'nav-btn-locked' : ''}`}
                  onClick={() => handleNavigationClick(btn)}
                  title={isLocked ? '🔒 Trancado (Requer chave)' : ''}
                >
                  {isLocked && <span style={{ marginRight: 6 }}>🔒</span>}
                  {btn.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Modal de Resultado: Busca de Suprimentos */}
      {supplySearchState === 'result' && (
        <div className="loot-modal-overlay" onClick={() => { setSupplySearchState('idle'); setSupplyLootResult([]); }}>
          <div
            className={`loot-modal ${supplyLootResult.length === 0 ? 'empty' : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            {supplyLootResult.length > 0 ? (
              <>
                <h3>🔦 Você encontrou suprimentos!</h3>
                <div className="loot-items">
                  {supplyLootResult.map((item, i) => {
                    const rMeta = RARITY_META[item.rarity] || RARITY_META.common
                    return (
                      <div className="loot-item" key={i} style={{ borderLeft: `3px solid ${rMeta.color}` }}>
                        <div className="loot-item-info">
                          <span className="loot-item-icon">{item.icon}</span>
                          <div>
                            <span style={{ fontWeight: 600 }}>{item.name}</span>
                            <div style={{ fontSize: 11, color: rMeta.color }}>{rMeta.label}</div>
                          </div>
                        </div>
                        <span className="loot-item-qty">×{item.quantity}</span>
                      </div>
                    )
                  })}
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                  Itens adicionados diretamente à sua mochila.
                </p>
              </>
            ) : (
              <>
                <h3>😶 Nada de útil</h3>
                <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24 }}>
                  Você revirou o local mas só encontrou poeira e escombros vazios desta vez.
                </p>
              </>
            )}
            <button className="btn btn-primary btn-sm" onClick={() => { setSupplySearchState('idle'); setSupplyLootResult([]); }}>
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Modal de Escolha: Busca Única (Obrigatório escolher quais levar até maxCarry) */}
      {uniqueSearchState === 'choose_modal' && (
        <div className="loot-modal-overlay">
          <div className="loot-modal unique-loot-modal" onClick={(e) => e.stopPropagation()} style={{ width: '480px', maxWidth: '95vw' }}>
            <div className="unique-modal-badge">⭐ BUSCA ÚNICA</div>
            <h3 style={{ color: 'var(--accent-yellow)', marginTop: 6, marginBottom: 4 }}>
              Descoberta Valiosa!
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
              Você encontrou os itens abaixo, mas só tem capacidade para carregar{' '}
              <strong style={{ color: '#fff' }}>até {maxCarry} item(ns)</strong>. Escolha com sabedoria, o restante será deixado para trás!
            </p>

            <div className="unique-items-grid">
              {uniqueFoundItems.map((item, idx) => {
                const isSelected = selectedUniqueIndices.includes(idx)
                const rMeta = RARITY_META[item.rarity] || RARITY_META.rare
                return (
                  <div
                    key={idx}
                    className={`unique-item-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleSelectUniqueItem(idx)}
                    style={{ borderColor: isSelected ? 'var(--accent-yellow)' : rMeta.border }}
                  >
                    <div className="unique-card-top">
                      <span className="unique-item-icon">{item.icon}</span>
                      <span className="unique-rarity-pill" style={{ color: rMeta.color, background: rMeta.bg }}>
                        {rMeta.label}
                      </span>
                    </div>
                    <div className="unique-card-name">{item.name}</div>
                    <div className="unique-card-qty">Quantidade: ×{item.quantity}</div>
                    <div className="unique-card-select-indicator">
                      {isSelected ? '✓ Selecionado' : '+ Escolher'}
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="unique-modal-footer">
              <div className="unique-counter">
                Selecionados: <strong>{selectedUniqueIndices.length}</strong> / {maxCarry}
              </div>
              <button
                className="btn btn-primary"
                onClick={handleConfirmUniqueLoot}
                disabled={uniqueSaving || selectedUniqueIndices.length === 0}
              >
                {uniqueSaving ? 'Guardando na mochila...' : `Pegar Selecionados (${selectedUniqueIndices.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Loja & Comércio Local */}
      <ShopModal
        isOpen={showShop}
        onClose={() => setShowShop(false)}
        locationSlug={slug}
        locationName={location?.name || 'Comércio Local'}
        catalogItems={catalogItems}
      />

      {/* Modal Universal de Armazenamento (Baús, Armários, Geladeiras, Cofres, etc.) */}
      <StorageModal
        isOpen={showStorageModal}
        onClose={() => {
          setShowStorageModal(false)
          setActiveStorageId(null)
        }}
        storageId={activeStorageId}
      />
    </div>
  )
}

