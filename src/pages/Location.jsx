import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, getDoc, updateDoc, runTransaction, onSnapshot, collection, query, where } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useGameConfig } from '../contexts/GameConfigContext.jsx'
import HUD from '../components/HUD.jsx'
import CombatHUD from '../components/CombatHUD.jsx'
import WeatherEffects from '../components/WeatherEffects.jsx'
import ShopModal from '../components/ShopModal.jsx'
import StorageModal from '../components/StorageModal.jsx'
import ActivityButton from '../components/ActivityButton.jsx'
import RadioHistoryModal from '../components/RadioHistoryModal.jsx'
import BaseDefenseBanner from '../components/BaseDefenseBanner.jsx'
import CookingModal from '../components/CookingModal.jsx'
import WaterSourceModal from '../components/WaterSourceModal.jsx'
import CustomFormModal from '../components/CustomFormModal.jsx'
import CampOverviewModal from '../components/CampOverviewModal.jsx'
import BathroomModal from '../components/BathroomModal.jsx'
import { calculateGameTime, getDynamicWeather } from '../utils/timeSystem'
import { rollSupplyLoot, rollUniqueLoot, hasItem, RARITY_META } from '../utils/itemSystem'
import { checkInventorySlotsAvailable } from '../utils/weightSystem'
import { useItemCatalog } from '../utils/itemCatalogService'
import { formatDuration } from '../utils/activitySystem'

/**
 * Retorna a imagem de fundo correta baseada na hora in-game.
 *  06h–17h → Dia
 *  05h–06h e 17h–18h → Amanhecer/Entardecer
 *  18h–05h → Noite
 * Fallback: backgroundImage geral → null
 */
function getBgForHour(hour, location) {
  if (!location) return null
  const isDay      = hour >= 6  && hour < 17
  const isTwilight = (hour >= 5 && hour < 6) || (hour >= 17 && hour < 18)
  // night: hour >= 18 || hour < 5

  const bgDay = (location.backgroundImageDay || '').trim()
  const bgTwilight = (location.backgroundImageTwilight || '').trim()
  const bgNight = (location.backgroundImageNight || '').trim()
  const bgGeneral = (location.backgroundImage || '').trim()

  if (isDay)      return bgDay || bgGeneral || null
  if (isTwilight) return bgTwilight || bgGeneral || null
  return bgNight || bgGeneral || null
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
  const { user, character, setCharacterInventory, recordUniqueSearch, setLocationContext } = useAuth()
  const navigate = useNavigate()

  const [location, setLocation] = useState(null)
  const [loadingLocation, setLoadingLocation] = useState(true)
  // Usa o GameConfigContext centralizado — sem abrir conexão Firestore própria
  const gameConfig = useGameConfig()
  const [weatherFxEnabled, setWeatherFxEnabled] = useState(() => {
    return localStorage.getItem('zz_weather_fx') !== 'false'
  })

  // Sincroniza ambiente da locação com o contexto de exposição térmica
  useEffect(() => {
    if (location) {
      setLocationContext?.({ isIndoor: !!location.isIndoor, slug: location.slug || slug })
    }
  }, [location, slug, setLocationContext])

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
  const [supplyCooldownRemaining, setSupplyCooldownRemaining] = useState(0)

  // Estados de Busca Única
  const [uniqueSearchState, setUniqueSearchState] = useState('idle') // idle | searching | choose_modal
  const [uniqueFoundItems, setUniqueFoundItems] = useState([])
  const [selectedUniqueIndices, setSelectedUniqueIndices] = useState([])
  const [uniqueSaving, setUniqueSaving] = useState(false)

  // Estados de Loja Local
  const [showShop, setShowShop] = useState(false)
  const [shopInfo, setShopInfo] = useState(null)
  const { list: catalogItems, map: catalogMap } = useItemCatalog()

  // Estados de Armazenamento / Storages Locais
  const [locationStorages, setLocationStorages] = useState([])
  const [activeStorageId, setActiveStorageId] = useState(null)
  const [showStorageModal, setShowStorageModal] = useState(false)

  // Estados de Ponto de Rádio Local
  const [activeRadioPoint, setActiveRadioPoint] = useState(null)
  const [showRadioModal, setShowRadioModal] = useState(false)

  // Estados de Exibição da Defesa da Base
  const [isDefenseDisplayPoint, setIsDefenseDisplayPoint] = useState(false)

  // Estados de Cozinha / Culinária
  const [showCookingModal, setShowCookingModal] = useState(false)

  // Estados de Coleta de Água
  const [activeWaterSource, setActiveWaterSource] = useState(null)
  const [showWaterModal, setShowWaterModal] = useState(false)

  // Estados de Banheiro & Higiene Pessoal
  const [showBathroomModal, setShowBathroomModal] = useState(false)

  // Estados de Formulários Customizados (Discord)
  const [locationForms, setLocationForms] = useState([])
  const [activeCustomForm, setActiveCustomForm] = useState(null)

  // Estados de Melhorias do Acampamento de Sosnovka
  const [showCampModal, setShowCampModal] = useState(false)
  const [campConfig, setCampConfig] = useState(null)
  const [campHubSlug, setCampHubSlug] = useState('casa-grande')

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  // Carrega a configuração do acampamento (configurável pelo Admin)
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'camp_config', 'global'), (snap) => {
      if (snap.exists()) {
        const data = snap.data()
        setCampConfig(data)
        setCampHubSlug(data.hubLocationSlug || 'casa-grande')
      }
    })
    return unsub
  }, [])

  // Escuta Pontos de Rádio vinculados a esta locação (filtrado na nuvem)
  useEffect(() => {
    if (!slug) return
    const q = query(collection(db, 'radio_points'), where('locationSlug', '==', slug))
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      const matched = docs.find(pt => pt.enabled !== false)
      if (matched) {
        setActiveRadioPoint(matched)
      } else if (slug === 'casa-grande-2-andar') {
        setActiveRadioPoint({
          id: 'def_radio_cg',
          name: 'Rádio do Acampamento',
          locationSlug: slug,
          locationName: 'Casa Grande — 2º Andar'
        })
      } else {
        setActiveRadioPoint(null)
      }
    })
    return unsub
  }, [slug])

  // Escuta Pontos de Exibição da Defesa da Base de forma otimizada
  useEffect(() => {
    if (!slug) return
    // Casa grande é o ponto central principal de defesa da base
    if (slug === 'casa-grande') {
      setIsDefenseDisplayPoint(true)
    }
    // Evita abrir listener em dezenas de salas normais que nunca foram pontos de defesa
    const knownPoints = sessionStorage.getItem('zz_defense_display_points')
    if (knownPoints) {
      try {
        const points = JSON.parse(knownPoints)
        if (!points.includes(slug) && slug !== 'casa-grande') {
          setIsDefenseDisplayPoint(false)
          return
        }
      } catch (_) {}
    }

    const unsub = onSnapshot(doc(db, 'base_defense', 'global'), (snap) => {
      if (snap.exists()) {
        const data = snap.data()
        const targetSlugs = (data.displayPoints || [])
          .filter(pt => pt.enabled !== false)
          .map(pt => pt.targetSlug)
        sessionStorage.setItem('zz_defense_display_points', JSON.stringify(targetSlugs))
        const isPoint = targetSlugs.includes(slug) || (slug === 'casa-grande')
        setIsDefenseDisplayPoint(isPoint)
      } else {
        setIsDefenseDisplayPoint(slug === 'casa-grande')
      }
    })
    return unsub
  }, [slug])

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

  // Escuta Fontes de Água vinculadas a esta locação (filtrado na nuvem)
  useEffect(() => {
    if (!slug) return
    const q = query(collection(db, 'water_sources'), where('locationSlug', '==', slug))
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      const matched = docs.find(s => s.enabled !== false)
      setActiveWaterSource(matched || null)
    })
    return unsub
  }, [slug])

  // Estados de Atividades de Produção Locais (Pesca, Plantação, Galinheiro, etc.)
  const [locationActivities, setLocationActivities] = useState([])

  // Escuta recipientes de armazenamento vinculados a esta locação (filtrado na nuvem)
  useEffect(() => {
    if (!slug) return
    const q = query(collection(db, 'storages'), where('locationSlug', '==', slug))
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setLocationStorages(docs)
    })
    return unsub
  }, [slug])

  // Escuta atividades de produção vinculadas a esta locação (filtrado na nuvem)
  useEffect(() => {
    if (!slug) return
    const q = query(collection(db, 'activities'), where('locationSlug', '==', slug))
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      const matched = docs.filter(act => act.enabled !== false)
      setLocationActivities(matched)
    })
    return unsub
  }, [slug])

  // Escuta formulários customizados vinculados a esta locação ou globais
  useEffect(() => {
    if (!slug) return
    const unsub = onSnapshot(collection(db, 'custom_forms'), (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      const matched = docs.filter(f => f.enabled !== false && (!f.locationSlug || f.locationSlug === slug))
      setLocationForms(matched)
    })
    return unsub
  }, [slug])



  // Escuta alterações no toggle de efeitos visuais disparados pelo HUD
  useEffect(() => {
    const handleFxToggle = () => {
      setWeatherFxEnabled(localStorage.getItem('zz_weather_fx') !== 'false')
    }
    window.addEventListener('weather_fx_toggle', handleFxToggle)
    return () => window.removeEventListener('weather_fx_toggle', handleFxToggle)
  }, [])

  // game_config é fornecido pelo GameConfigContext — sem listener local

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
    if (!location) return
    const hour = gameConfig ? calculateGameTime(gameConfig).hour : new Date().getHours()
    const bg = getBgForHour(hour, location)
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
        setSupplyCooldownRemaining(0)
        return
      }
      const lastLoot = character.lastLootByLocation[slug]
      if (!lastLoot) {
        setSupplyCooldown(false)
        setSupplyCooldownRemaining(0)
        return
      }

      const lastDate = lastLoot.toDate ? lastLoot.toDate() : new Date(lastLoot)
      const cooldownMs = (location.loot?.cooldownMinutes || 30) * 60 * 1000
      const elapsed = Date.now() - lastDate.getTime()
      const remaining = Math.max(0, cooldownMs - elapsed)
      setSupplyCooldownRemaining(remaining)
      setSupplyCooldown(remaining > 0)
    }

    checkCooldown()
    const timer = setInterval(checkCooldown, 1000)
    return () => clearInterval(timer)
  }, [character, location, slug])

  // Verifica se o personagem já fez a Busca Única deste local
  const isUniqueDone = !!(character?.uniqueSearchesDone && character.uniqueSearchesDone[slug])

  // Lógica de Busca de Suprimentos (Repetível com Cooldown - Sucata, Comum e Incomum)
  async function handleSupplySearch() {
    if (supplySearchState !== 'idle' || supplyCooldown || !location?.loot?.enabled) return

    // Valida se o inventário já está no limite máximo de slots antes de iniciar a busca
    const slotPreCheck = checkInventorySlotsAvailable(character, null, gameConfig, catalogMap)
    if (slotPreCheck.usedSlots >= slotPreCheck.maxSlots) {
      showToast(`Seu inventário está cheio (${slotPreCheck.usedSlots}/${slotPreCheck.maxSlots} slots)! Libere espaço antes de vasculhar.`)
      return
    }

    setSupplySearchState('searching')
    await new Promise((r) => setTimeout(r, 2000))

    const items = rollSupplyLoot(location.loot, character?.perks || [])

    if (user) {
      const userRef = doc(db, 'users', user.uid)

      try {
        let finalInventory = null

        await runTransaction(db, async (transaction) => {
          const snap = await transaction.get(userRef)
          if (!snap.exists()) throw new Error('Personagem não encontrado.')

          const charData = snap.data().character || {}

          // Validação transacional de slots disponíveis
          const slotCheck = checkInventorySlotsAvailable(charData, items, gameConfig, catalogMap)
          if (!slotCheck.allowed) {
            throw new Error(slotCheck.reason || 'Seu inventário está cheio! Libere espaço no inventário.')
          }

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
                ...(item.maxUses && Number(item.maxUses) > 1 ? {
                  maxUses: Number(item.maxUses),
                  currentUses: Number(item.maxUses),
                } : {}),
                obtainedAt: new Date().toISOString(),
                obtainedFrom: `Suprimentos (${slug})`,
              })
            }
          }

          finalInventory = inventory

          transaction.update(userRef, {
            'character.inventory': inventory,
            [`character.lastLootByLocation.${slug}`]: new Date()
          })
        })

        // Atualiza o estado local imediatamente com o inventário final confirmado pela transação.
        if (finalInventory !== null) {
          setCharacterInventory(finalInventory)
        }

        setSupplyLootResult(items)
        setSupplySearchState('result')
        setSupplyCooldown(true)
      } catch (err) {
        console.error('Erro ao salvar busca de suprimentos:', err)
        showToast(err.message || 'Erro ao coletar suprimentos.')
        setSupplySearchState('idle')
        setSupplyLootResult([])
      }
    }
  }

  // Lógica da Busca Única (One-shot - Raro, Muito Raro e Excepcional)
  async function handleUniqueSearch() {
    if (uniqueSearchState !== 'idle' || isUniqueDone || !location?.uniqueSearch?.enabled) return

    // Valida se o inventário já está cheio
    const slotPreCheck = checkInventorySlotsAvailable(character, null, gameConfig, catalogMap)
    if (slotPreCheck.usedSlots >= slotPreCheck.maxSlots) {
      showToast(`Seu inventário está cheio (${slotPreCheck.usedSlots}/${slotPreCheck.maxSlots} slots)! Libere espaço para realizar a Busca Única.`)
      return
    }

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

    const chosen = selectedUniqueIndices.map(idx => uniqueFoundItems[idx])

    // Valida se os itens escolhidos cabem no inventário
    const slotCheck = checkInventorySlotsAvailable(character, chosen, gameConfig, catalogMap)
    if (!slotCheck.allowed) {
      showToast(slotCheck.reason || 'Espaço insuficiente no inventário! Libere slots para levar estes itens.')
      return
    }

    setUniqueSaving(true)
    try {
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
  const hasAnyBg = !!(
    (location.backgroundImage && location.backgroundImage.trim()) ||
    (location.backgroundImageDay && location.backgroundImageDay.trim()) ||
    (location.backgroundImageNight && location.backgroundImageNight.trim()) ||
    (location.backgroundImageTwilight && location.backgroundImageTwilight.trim())
  )

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
          backgroundImage: prevBg ? `url("${prevBg}")` : 'none',
          opacity: fading && prevBg ? 1 : 0,
        }}
      />

      {/* Camada atual — aparece com fade-in */}
      <div
        className={`location-bg location-bg-current ${!hasAnyBg ? 'fallback' : ''}`}
        style={currentBg ? { backgroundImage: `url("${currentBg}")`, opacity: fading ? 0 : 1 } : { opacity: fading ? 0 : 1 }}
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
            {/* Banner de Defesa da Base caso a locação seja um ponto de exibição */}
            {isDefenseDisplayPoint && (
              <div style={{ marginBottom: 12 }}>
                <BaseDefenseBanner compact={false} showHistory={true} />
              </div>
            )}

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

            {/* Quadro de Missões & Melhorias do Acampamento (Exibido abaixo do chat na Sede) */}
            {slug === campHubSlug && (
              <div
                className="camp-quest-board-container"
                style={{
                  margin: '18px auto 14px auto',
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setShowCampModal(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setShowCampModal(true)
                    }
                  }}
                  title="Quadro de Missões & Melhorias do Acampamento — Clique para abrir o menu de missões e evolução"
                  className="camp-quest-board-card"
                  style={{
                    cursor: 'pointer',
                    width: '100%',
                    maxWidth: '850px',
                    minWidth: 'min(600px, 100%)',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    position: 'relative',
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    boxShadow: 'none',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                >
                  <img
                    src={campConfig?.boardImageUrl || location?.campBoardImage || '/assets/camp_quest_board.jpg'}
                    alt="Quadro de Missões e Melhorias do Acampamento"
                    className="camp-quest-board-img"
                    style={{
                      width: '100%',
                      minWidth: 'min(600px, 100%)',
                      height: 'auto',
                      maxHeight: '380px',
                      objectFit: 'cover',
                      display: 'block',
                      borderRadius: '8px',
                      border: 'none',
                      outline: 'none',
                      transition: 'transform 0.3s ease, filter 0.3s ease',
                    }}
                  />
                  {/* Overlay interativo com badge no rodapé do quadro */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.6) 55%, transparent 100%)',
                      padding: '18px 22px 12px 22px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 10,
                      pointerEvents: 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: '1.6rem', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))' }}>🏕️</span>
                      <div>
                        <div style={{ color: '#facc15', fontWeight: 800, fontSize: 16, textShadow: '0 2px 4px rgba(0,0,0,0.95)', letterSpacing: '0.5px' }}>
                          QUADRO DE MISSÕES & MELHORIAS
                        </div>
                        <div style={{ color: '#cbd5e1', fontSize: 12, textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
                          {campConfig?.campName || 'Acampamento de Sosnovka'} • Clique no quadro para interagir
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        background: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: 12,
                        padding: '6px 16px',
                        borderRadius: 20,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        border: '1px solid rgba(254, 240, 138, 0.4)',
                      }}
                    >
                      <span>📜</span> Acessar Missões
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Painel de Ações de Busca (Suprimentos + Busca Única + Loja / Comércio + Recipientes de Armazenamento + Ponto de Rádio) */}
            <div className="loot-search-actions-bar">

              {/* Botão de Ponto de Rádio Local */}
              {activeRadioPoint && (
                <button
                  className="loot-btn"
                  style={{
                    background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.25) 0%, rgba(20, 83, 45, 0.35) 100%)',
                    borderColor: '#22c55e',
                    color: '#86efac',
                    fontWeight: 700,
                    boxShadow: '0 0 12px rgba(34, 197, 94, 0.25)'
                  }}
                  onClick={() => setShowRadioModal(true)}
                  title={`Sintonizar e consultar transmissões no ${activeRadioPoint.name}`}
                >
                  <span>📻</span>
                  {activeRadioPoint.name || 'Rádio do Acampamento'}
                </button>
              )}

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

              {/* Botão de Cozinha & Preparo de Alimentos */}
              {location.hasKitchen !== false && (
                <button
                  type="button"
                  className={location.kitchenButtonImage ? 'activity-img-btn' : 'loot-btn'}
                  style={location.kitchenButtonImage ? {
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    outline: 'none',
                    position: 'relative',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'transform 0.18s ease, filter 0.18s ease',
                  } : {
                    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(217, 119, 6, 0.35) 100%)',
                    borderColor: '#f59e0b',
                    color: '#facc15',
                    fontWeight: 700,
                    boxShadow: '0 0 12px rgba(245, 158, 11, 0.25)',
                    padding: '8px 14px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '44px',
                    minHeight: '44px',
                  }}
                  onClick={() => setShowCookingModal(true)}
                  title="Cozinhar - Preparar refeições e cozinhar alimentos"
                >
                  {location.kitchenButtonImage ? (
                    <img
                      src={location.kitchenButtonImage}
                      alt="Cozinhar"
                      style={{
                        width: 'auto',
                        maxHeight: 72,
                        maxWidth: 160,
                        objectFit: 'contain',
                        display: 'block',
                        filter: 'drop-shadow(0 3px 10px rgba(0,0,0,0.6))',
                        transition: 'transform 0.15s ease, filter 0.15s ease',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.transform = 'scale(1.08)'
                        e.currentTarget.style.filter = 'drop-shadow(0 0 14px rgba(245, 158, 11, 0.65))'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.transform = 'scale(1)'
                        e.currentTarget.style.filter = 'drop-shadow(0 3px 10px rgba(0,0,0,0.6))'
                      }}
                    />
                  ) : (
                    <span style={{ fontSize: 20, lineHeight: 1 }}>{location.kitchenIcon || '🍳'}</span>
                  )}
                </button>
              )}

              {/* Botão de Coleta de Água Natural / Poço / Rio */}
              {activeWaterSource && (
                (() => {
                  const waterImg = activeWaterSource.buttonImage || activeWaterSource.imageUrl
                  return (
                    <button
                      type="button"
                      className={waterImg ? 'activity-img-btn' : 'loot-btn'}
                      style={waterImg ? {
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        outline: 'none',
                        position: 'relative',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'transform 0.18s ease, filter 0.18s ease',
                      } : {
                        background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.25) 0%, rgba(14, 116, 144, 0.35) 100%)',
                        borderColor: '#06b6d4',
                        color: '#67e8f9',
                        fontWeight: 700,
                        boxShadow: '0 0 12px rgba(6, 182, 212, 0.25)',
                        padding: '8px 14px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: '44px',
                        minHeight: '44px',
                      }}
                      onClick={() => setShowWaterModal(true)}
                      title={`Coletar Água - ${activeWaterSource.name || 'Fonte de Água'}`}
                    >
                      {waterImg ? (
                        <img
                          src={waterImg}
                          alt={activeWaterSource.name || 'Fonte de Água'}
                          style={{
                            width: 'auto',
                            maxHeight: 72,
                            maxWidth: 160,
                            objectFit: 'contain',
                            display: 'block',
                            filter: 'drop-shadow(0 3px 10px rgba(0,0,0,0.6))',
                            transition: 'transform 0.15s ease, filter 0.15s ease',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.transform = 'scale(1.08)'
                            e.currentTarget.style.filter = 'drop-shadow(0 0 14px rgba(6, 182, 212, 0.65))'
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.transform = 'scale(1)'
                            e.currentTarget.style.filter = 'drop-shadow(0 3px 10px rgba(0,0,0,0.6))'
                          }}
                        />
                      ) : (
                        <span style={{ fontSize: 20, lineHeight: 1 }}>{activeWaterSource.icon || '💧'}</span>
                      )}
                    </button>
                  )
                })()
              )}

              {/* Botão de Banheiro & Higiene Pessoal */}
              {location.hasBathroom !== false && (
                <button
                  type="button"
                  className="loot-btn"
                  style={{
                    background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.25) 0%, rgba(2, 132, 199, 0.35) 100%)',
                    borderColor: '#38bdf8',
                    color: '#7dd3fc',
                    fontWeight: 700,
                    boxShadow: '0 0 12px rgba(56, 189, 248, 0.25)',
                    padding: '8px 14px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '44px',
                    minHeight: '44px',
                  }}
                  onClick={() => setShowBathroomModal(true)}
                  title="Banheiro & Higiene: tomar banho e abastecer o reservatório de água"
                >
                  <span style={{ fontSize: 20, lineHeight: 1 }}>🚿</span>
                </button>
              )}

              {/* Atividades de Produção Locais (Pesca, Plantação, Galinheiro, etc.) */}
              {locationActivities.map(act => (
                <ActivityButton
                  key={act.id}
                  activity={act}
                  character={character}
                  locationSlug={slug}
                />
              ))}

              {/* Botões de Formulários Customizados vinculados ao Discord */}
              {locationForms.map(cf => (
                <button
                  key={cf.id}
                  className="loot-btn"
                  style={{
                    background: `linear-gradient(135deg, ${cf.buttonColor ? `${cf.buttonColor}33` : 'rgba(234, 179, 8, 0.25)'} 0%, ${cf.buttonColor ? `${cf.buttonColor}15` : 'rgba(202, 138, 4, 0.2)'} 100%)`,
                    borderColor: cf.buttonColor || '#eab308',
                    color: cf.buttonColor || '#fef08a',
                    fontWeight: 700,
                    boxShadow: `0 0 12px ${cf.buttonColor ? `${cf.buttonColor}33` : 'rgba(234, 179, 8, 0.25)'}`
                  }}
                  onClick={() => setActiveCustomForm(cf)}
                  title={cf.description || cf.title}
                >
                  <span>{cf.icon || '📝'}</span>
                  {cf.buttonText || cf.title || 'Formulário'}
                </button>
              ))}

              {/* Botão 1: Buscar Suprimentos (Repetível / Cooldown / Sucata & Comuns) */}
              {location.loot?.enabled && (
                (() => {
                  const supplyImg = location.loot?.buttonImage
                  const isCooling = supplyCooldownRemaining > 0 || supplyCooldown
                  const titleText = isCooling
                    ? `Buscar Suprimentos em cooldown (${formatDuration(supplyCooldownRemaining)})`
                    : supplySearchState === 'searching'
                    ? 'Vasculhando local...'
                    : 'Buscar Suprimentos - Itens comuns, mantimentos e sucatas'

                  return (
                    <button
                      type="button"
                      className={supplyImg ? 'activity-img-btn' : `loot-btn loot-btn-supply ${supplySearchState === 'searching' ? 'searching' : ''}`}
                      style={supplyImg ? {
                        background: 'transparent',
                        border: 'none',
                        padding: 0,
                        cursor: (supplySearchState !== 'idle' || isCooling) ? 'not-allowed' : 'pointer',
                        outline: 'none',
                        position: 'relative',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'transform 0.18s ease, filter 0.18s ease',
                      } : {
                        position: 'relative',
                      }}
                      onClick={handleSupplySearch}
                      disabled={supplySearchState !== 'idle' || isCooling}
                      title={titleText}
                    >
                      {supplyImg ? (
                        <img
                          src={supplyImg}
                          alt="Buscar Suprimentos"
                          style={{
                            width: 'auto',
                            maxHeight: 72,
                            maxWidth: 160,
                            objectFit: 'contain',
                            display: 'block',
                            filter: isCooling
                              ? 'grayscale(0.85) opacity(0.55)'
                              : supplySearchState === 'searching'
                              ? 'brightness(1.2) drop-shadow(0 0 14px rgba(234, 179, 8, 0.8))'
                              : 'drop-shadow(0 3px 10px rgba(0,0,0,0.6))',
                            transition: 'transform 0.15s ease, filter 0.15s ease',
                          }}
                          onMouseEnter={e => {
                            if (!isCooling && supplySearchState === 'idle') {
                              e.currentTarget.style.transform = 'scale(1.08)'
                              e.currentTarget.style.filter = 'drop-shadow(0 0 14px rgba(234, 179, 8, 0.65))'
                            }
                          }}
                          onMouseLeave={e => {
                            if (!isCooling && supplySearchState === 'idle') {
                              e.currentTarget.style.transform = 'scale(1)'
                              e.currentTarget.style.filter = 'drop-shadow(0 3px 10px rgba(0,0,0,0.6))'
                            }
                          }}
                        />
                      ) : (
                        <>
                          <span>{supplySearchState === 'searching' ? '🔍' : isCooling ? '⏳' : (location.loot?.icon || '🔦')}</span>
                          {supplySearchState === 'searching'
                            ? 'Vasculhando...'
                            : isCooling
                            ? `Cooldown (${formatDuration(supplyCooldownRemaining)})`
                            : 'Buscar Suprimentos'}
                        </>
                      )}

                      {/* Badge de Cooldown sobre a imagem */}
                      {supplyImg && isCooling && (
                        <span style={{
                          position: 'absolute',
                          bottom: -4,
                          background: 'rgba(0, 0, 0, 0.85)',
                          border: '1px solid #eab308',
                          color: '#fef08a',
                          borderRadius: 4,
                          fontSize: 9,
                          padding: '1px 4px',
                          whiteSpace: 'nowrap',
                          fontWeight: 800,
                          lineHeight: 1.1,
                          pointerEvents: 'none'
                        }}>
                          {formatDuration(supplyCooldownRemaining)}
                        </span>
                      )}
                    </button>
                  )
                })()
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

      {/* Modal de Histórico de Transmissões do Rádio Presencial */}
      <RadioHistoryModal
        isOpen={showRadioModal}
        onClose={() => setShowRadioModal(false)}
        pointName={activeRadioPoint?.name || 'Rádio do Acampamento'}
        locationName={location?.name || slug}
      />

      {/* Modal de Cozinha & Culinária */}
      {showCookingModal && (
        <CookingModal
          locationSlug={slug}
          onClose={() => setShowCookingModal(false)}
        />
      )}

      {/* Modal de Coleta de Água */}
      {showWaterModal && activeWaterSource && (
        <WaterSourceModal
          waterSource={activeWaterSource}
          locationSlug={slug}
          onClose={() => setShowWaterModal(false)}
        />
      )}

      {/* Modal de Formulário Customizado do Discord */}
      {activeCustomForm && (
        <CustomFormModal
          form={activeCustomForm}
          character={character}
          user={user}
          locationName={location?.name || slug}
          onClose={() => setActiveCustomForm(null)}
        />
      )}

      {/* Modal de Visão Geral e Missões de Evolução do Acampamento */}
      <CampOverviewModal
        isOpen={showCampModal}
        onClose={() => setShowCampModal(false)}
      />

      {/* Modal de Banheiro e Higiene */}
      {showBathroomModal && (
        <BathroomModal
          isOpen={showBathroomModal}
          onClose={() => setShowBathroomModal(false)}
          location={location}
        />
      )}
    </div>
  )
}

