import { useState, useEffect } from 'react'
import {
  doc,
  collection,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc
} from 'firebase/firestore'
import { db } from '../firebase/config'
import HUD from '../components/HUD.jsx'
import { SEASONS, MOON_PHASES, MONTHS, calculateGameTime, getDynamicWeather } from '../utils/timeSystem'
import { RARITY_META, DEFAULT_PRESET_ITEMS, SUPPLY_RARITIES, UNIQUE_RARITIES, getMaxHp } from '../utils/itemSystem'
import { COMBAT_STATUS_EFFECTS, MONSTER_TEMPLATES, ATTRIBUTE_ICONS } from '../utils/combatSystem'

const WEATHER_OPTIONS = [
  { value: 'sunny',  label: 'Ensolarado', icon: '☀️' },
  { value: 'cloudy', label: 'Nublado',    icon: '☁️' },
  { value: 'rainy',  label: 'Chovendo',   icon: '🌧️' },
  { value: 'foggy',  label: 'Neblina',    icon: '🌫️' },
  { value: 'storm',  label: 'Tempestade', icon: '⛈️' },
  { value: 'snowy',  label: 'Nevando',    icon: '❄️' },
]

export default function Admin() {
  const [activeTab, setActiveTab] = useState('config') // config | calendar | locations | catalog | players

  // ==========================================
  // TAB CATALOG: CATÁLOGO GERAL DE ITENS
  // ==========================================
  const [catalogItems, setCatalogItems] = useState([])
  const [editingCatalogItem, setEditingCatalogItem] = useState(null)
  const [catalogSearch, setCatalogSearch] = useState('')
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState('all')
  const [catalogForm, setCatalogForm] = useState({
    itemId: '',
    name: '',
    icon: '📦',
    category: 'general',
    rarity: 'common',
    description: '',
    consumable: false,
    hungerEffect: 0,
    thirstEffect: 0,
    bloodEffect: 0,
    isQuestItem: false,
    unlocks: ''
  })

  // ==========================================
  // TAB 1: CONFIGURAÇÃO GLOBAL (TEMPO, ESTAÇÃO, CLIMA)
  // ==========================================
  const [globalConfig, setGlobalConfig] = useState(null)
  const [tempTitle, setTempTitle] = useState('')
  const [tempWeather, setTempWeather] = useState({
    mode: 'dynamic', // dynamic | manual
    condition: 'sunny',
    temperature: 20,
    label: 'Ensolarado',
    icon: '☀️',
    region: 'Leste Europeu'
  })
  const [tempTime, setTempTime] = useState({
    mode: 'dynamic', // dynamic | manual
    value: '12:00',
    period: 'day',
    baseEpochMs: Date.now(),
    baseYear: 2026,
    baseMonth: 8,
    baseDay: 26,
    baseHour: 12,
    baseMinute: 0,
    seasonOverride: '',
    moonOverride: ''
  })
  const [tempMaintenance, setTempMaintenance] = useState(false)
  const [globalMsg, setGlobalMsg] = useState('')

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'game_config', 'global'), (snap) => {
      if (snap.exists()) {
        const data = snap.data()
        setGlobalConfig(data)
        setTempTitle(data.title || '')
        setTempWeather(data.weather || {
          mode: 'dynamic',
          condition: 'sunny',
          temperature: 20,
          label: 'Ensolarado',
          icon: '☀️',
          region: 'Leste Europeu'
        })
        setTempTime(data.time || {
          mode: 'dynamic',
          value: '12:00',
          period: 'day',
          baseEpochMs: Date.now(),
          baseYear: 2026,
          baseMonth: 8,
          baseDay: 26,
          baseHour: 12,
          baseMinute: 0,
          seasonOverride: '',
          moonOverride: ''
        })
        setTempMaintenance(!!data.maintenance)
        setGlobalMsg(data.global_message || '')
      }
    })
    return unsub
  }, [])

  async function saveGlobalConfig(e) {
    e.preventDefault()
    try {
      await setDoc(doc(db, 'game_config', 'global'), {
        title: tempTitle,
        weather: tempWeather,
        time: tempTime,
        maintenance: tempMaintenance,
        global_message: globalMsg,
      })
      alert('Configuração global salva!')
    } catch (err) {
      console.error(err)
      alert('Erro ao salvar configuração: ' + err.message)
    }
  }

  // Sincroniza o relógio base agora
  function syncTimeToNow() {
    const now = new Date()
    setTempTime(prev => ({
      ...prev,
      baseEpochMs: Date.now(),
      baseHour: now.getHours(),
      baseMinute: now.getMinutes(),
      baseDay: now.getDate(),
      baseMonth: now.getMonth() + 1,
      baseYear: now.getFullYear()
    }))
  }

  // Simulação atual para visualização prévia no admin
  const simulatedTime = calculateGameTime({ time: tempTime })
  const simulatedWeather = getDynamicWeather({ weather: tempWeather }, simulatedTime)

  // ==========================================
  // TAB CALENDAR: EVENTOS DO CALENDÁRIO (CRUD)
  // ==========================================
  const [calendarEvents, setCalendarEvents] = useState([])
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    day: 26,
    month: 8,
    year: 2026,
    type: 'horde', // horde | supply | blackout | boss | roleplay
    color: '#ef4444',
    dangerLevel: 'Médio'
  })

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'calendar_events'), (snap) => {
      setCalendarEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [])

  async function handleAddEvent(e) {
    e.preventDefault()
    if (!newEvent.title) return alert('Insira o título do evento')

    try {
      await addDoc(collection(db, 'calendar_events'), {
        title: newEvent.title.trim(),
        description: newEvent.description.trim(),
        day: Number(newEvent.day),
        month: Number(newEvent.month),
        year: Number(newEvent.year),
        type: newEvent.type,
        color: newEvent.color,
        dangerLevel: newEvent.dangerLevel,
        createdAt: new Date().toISOString()
      })
      setNewEvent({
        title: '',
        description: '',
        day: simulatedTime.day,
        month: simulatedTime.month,
        year: simulatedTime.year,
        type: 'horde',
        color: '#ef4444',
        dangerLevel: 'Médio'
      })
      alert('Evento de calendário adicionado!')
    } catch (err) {
      alert('Erro ao salvar evento: ' + err.message)
    }
  }

  async function handleDeleteEvent(id) {
    if (!confirm('Deseja excluir este evento?')) return
    try {
      await deleteDoc(doc(db, 'calendar_events', id))
    } catch (err) {
      alert('Erro: ' + err.message)
    }
  }

  // ==========================================
  // TAB CATALOG: CATÁLOGO GERAL DE ITENS
  // ==========================================
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'items_db'), (snap) => {
      setCatalogItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [])

  async function handlePopulatePresets() {
    if (!confirm('Deseja cadastrar os itens padrão de sobrevivência (Cozinha, Quarto, Banheiro, Garagem, Armas) no catálogo?')) return
    try {
      for (const item of DEFAULT_PRESET_ITEMS) {
        await setDoc(doc(db, 'items_db', item.itemId), item)
      }
      alert('Catálogo populado com os itens predefinidos com sucesso!')
    } catch (err) {
      alert('Erro ao popular catálogo: ' + err.message)
    }
  }

  async function handleCatalogSubmit(e) {
    e.preventDefault()
    if (!catalogForm.itemId || !catalogForm.name) return alert('ID do item e Nome são obrigatórios')
    const cleanId = catalogForm.itemId.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '')

    const consumeEffect = {}
    if (catalogForm.consumable) {
      if (catalogForm.hungerEffect) consumeEffect.hunger = Number(catalogForm.hungerEffect)
      if (catalogForm.thirstEffect) consumeEffect.thirst = Number(catalogForm.thirstEffect)
      if (catalogForm.bloodEffect)  consumeEffect.blood  = Number(catalogForm.bloodEffect)
    }

    const unlocks = catalogForm.unlocks
      ? catalogForm.unlocks.split(',').map(s => s.trim()).filter(Boolean)
      : []

    const payload = {
      itemId: cleanId,
      name: catalogForm.name.trim(),
      icon: catalogForm.icon.trim() || '📦',
      category: catalogForm.category || 'general',
      rarity: catalogForm.rarity || 'common',
      description: catalogForm.description.trim(),
      consumable: !!catalogForm.consumable,
      consumeEffect: Object.keys(consumeEffect).length > 0 ? consumeEffect : null,
      isQuestItem: !!catalogForm.isQuestItem,
      unlocks: unlocks
    }

    try {
      await setDoc(doc(db, 'items_db', cleanId), payload)
      alert('Item salvo no catálogo!')
      setEditingCatalogItem(null)
      setCatalogForm({
        itemId: '',
        name: '',
        icon: '📦',
        category: 'general',
        rarity: 'common',
        description: '',
        consumable: false,
        hungerEffect: 0,
        thirstEffect: 0,
        bloodEffect: 0,
        isQuestItem: false,
        unlocks: ''
      })
    } catch (err) {
      alert('Erro ao salvar item: ' + err.message)
    }
  }

  async function handleDeleteCatalogItem(id) {
    if (!confirm('Deseja remover este item do catálogo?')) return
    try {
      await deleteDoc(doc(db, 'items_db', id))
      alert('Item removido!')
    } catch (err) {
      alert('Erro: ' + err.message)
    }
  }

  function editCatalogItem(item) {
    setEditingCatalogItem(item.id)
    setCatalogForm({
      itemId: item.itemId || item.id,
      name: item.name || '',
      icon: item.icon || '📦',
      category: item.category || 'general',
      rarity: item.rarity || 'common',
      description: item.description || '',
      consumable: !!item.consumable,
      hungerEffect: item.consumeEffect?.hunger || 0,
      thirstEffect: item.consumeEffect?.thirst || 0,
      bloodEffect: item.consumeEffect?.blood || 0,
      isQuestItem: !!item.isQuestItem,
      unlocks: (item.unlocks || []).join(', ')
    })
  }

  // ==========================================
  // TAB 2: LOCAÇÕES (CRUD)
  // ==========================================
  const [locations, setLocations] = useState([])
  const [editingLoc, setEditingLoc] = useState(null)
  const [locForm, setLocForm] = useState({
    name: '',
    slug: '',
    description: '',
    backgroundImage: '',
    xatIframe: '',
    isIndoor: false,
    lootEnabled: true,
    cooldownMinutes: 30,
    emptyChance: 0.25,
    navigationButtons: [],
    lootTable: [
      { itemId: 'saco_lixo', name: 'Sacos de Lixo', icon: '🗑️', rarity: 'junk', chance: 0.60, min: 1, max: 2 },
      { itemId: 'bandagem', name: 'Bandagem Estéril', icon: '🩹', rarity: 'common', chance: 0.40, min: 1, max: 3 },
      { itemId: 'remedio_basico', name: 'Remédios Básicos', icon: '💊', rarity: 'common', chance: 0.30, min: 1, max: 2 },
      { itemId: 'alcool_antisseptico', name: 'Álcool 70%', icon: '🧪', rarity: 'uncommon', chance: 0.15, min: 1, max: 1 },
    ],
    uniqueEnabled: true,
    uniqueMaxCarry: 2,
    uniqueTable: [
      { itemId: 'relogio_pulso', name: 'Relógio de Pulso', icon: '⌚', rarity: 'rare', quantity: 1, unlocks: ['hud_clock'] },
      { itemId: 'pistola_glock', name: 'Pistola 9mm', icon: '🔫', rarity: 'rare', quantity: 1, category: 'firearms' },
      { itemId: 'kit_cirurgico', name: 'Kit Médico Avançado', icon: '🩺', rarity: 'rare', quantity: 1, consumable: true, consumeEffect: { blood: 60, thirst: 10 } }
    ]
  })

  const [newNavBtn, setNewNavBtn] = useState({ label: '', target: '', position: 'right', requiredItem: '', lockedMessage: '' })
  const [newLootItem, setNewLootItem] = useState({ itemId: '', name: '', icon: '📦', rarity: 'common', chance: 0.4, min: 1, max: 2, category: 'general' })
  const [newUniqueItem, setNewUniqueItem] = useState({ itemId: '', name: '', icon: '⭐', rarity: 'rare', quantity: 1, category: 'general' })

  // Estados dos buscadores de catálogo na aba de Locais
  const [lootPickerOpen, setLootPickerOpen] = useState(false)
  const [lootPickerSearch, setLootPickerSearch] = useState('')
  const [lootPickerCategory, setLootPickerCategory] = useState('all')

  const [uniquePickerOpen, setUniquePickerOpen] = useState(false)
  const [uniquePickerSearch, setUniquePickerSearch] = useState('')
  const [uniquePickerCategory, setUniquePickerCategory] = useState('all')

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'locations'), (snap) => {
      setLocations(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [])

  function handleLocEdit(loc) {
    setEditingLoc(loc.id)
    setLocForm({
      name: loc.name || '',
      slug: loc.slug || '',
      description: loc.description || '',
      backgroundImage: loc.backgroundImage || '',
      xatIframe: loc.xatIframe || '',
      isIndoor: !!loc.isIndoor,
      lootEnabled: loc.loot?.enabled !== false,
      cooldownMinutes: loc.loot?.cooldownMinutes || 30,
      emptyChance: loc.loot?.emptyChance || 0.25,
      navigationButtons: loc.navigationButtons || [],
      lootTable: loc.loot?.table || [],
      uniqueEnabled: loc.uniqueSearch?.enabled !== false,
      uniqueMaxCarry: loc.uniqueSearch?.maxCarry || 2,
      uniqueTable: loc.uniqueSearch?.items || []
    })
  }

  function resetLocForm() {
    setEditingLoc(null)
    setLocForm({
      name: '',
      slug: '',
      description: '',
      backgroundImage: '',
      xatIframe: '',
      isIndoor: false,
      lootEnabled: true,
      cooldownMinutes: 30,
      emptyChance: 0.25,
      navigationButtons: [],
      lootTable: [
        { itemId: 'saco_lixo', name: 'Sacos de Lixo', icon: '🗑️', rarity: 'junk', chance: 0.60, min: 1, max: 2 },
        { itemId: 'bandagem', name: 'Bandagem Estéril', icon: '🩹', rarity: 'common', chance: 0.40, min: 1, max: 3 },
      ],
      uniqueEnabled: true,
      uniqueMaxCarry: 2,
      uniqueTable: [
        { itemId: 'relogio_pulso', name: 'Relógio de Pulso', icon: '⌚', rarity: 'rare', quantity: 1, unlocks: ['hud_clock'] },
      ]
    })
    setNewLootItem({ itemId: '', name: '', icon: '📦', rarity: 'common', chance: 0.4, min: 1, max: 2 })
    setNewUniqueItem({ itemId: '', name: '', icon: '⭐', rarity: 'rare', quantity: 1 })
    setNewNavBtn({ label: '', target: '', position: 'right', requiredItem: '', lockedMessage: '' })
  }

  async function handleLocSubmit(e) {
    e.preventDefault()
    if (!locForm.name || !locForm.slug) return alert('Nome e Slug são obrigatórios')

    const cleanSlug = locForm.slug.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '')
    const payload = {
      name: locForm.name.trim(),
      slug: cleanSlug,
      description: locForm.description.trim(),
      backgroundImage: locForm.backgroundImage.trim() || null,
      xatIframe: locForm.xatIframe.trim(),
      isIndoor: !!locForm.isIndoor,
      loot: {
        enabled: locForm.lootEnabled,
        cooldownMinutes: Number(locForm.cooldownMinutes),
        emptyChance: Number(locForm.emptyChance),
        maxItemsPerSearch: 2,
        table: locForm.lootTable
      },
      uniqueSearch: {
        enabled: locForm.uniqueEnabled,
        maxCarry: Number(locForm.uniqueMaxCarry) || 1,
        items: locForm.uniqueTable
      },
      navigationButtons: locForm.navigationButtons
    }

    try {
      await setDoc(doc(db, 'locations', cleanSlug), payload)
      if (editingLoc && editingLoc !== cleanSlug) {
        await deleteDoc(doc(db, 'locations', editingLoc))
      }
      alert('Locação salva com sucesso!')
      resetLocForm()
    } catch (err) {
      console.error(err)
      alert('Erro ao salvar locação: ' + err.message)
    }
  }

  async function handleLocDelete(id) {
    if (!confirm('Deseja excluir esta locação definitivamente?')) return
    try {
      await deleteDoc(doc(db, 'locations', id))
      alert('Locação removida!')
      if (editingLoc === id) resetLocForm()
    } catch (err) {
      alert('Erro: ' + err.message)
    }
  }

  function addNavButton() {
    if (!newNavBtn.label || !newNavBtn.target) return alert('Preencha o Rótulo e o Destino')
    setLocForm(prev => ({
      ...prev,
      navigationButtons: [...prev.navigationButtons, { ...newNavBtn }]
    }))
    setNewNavBtn({ label: '', target: '', position: 'right', requiredItem: '', lockedMessage: '' })
  }

  function removeNavButton(idx) {
    setLocForm(prev => ({
      ...prev,
      navigationButtons: prev.navigationButtons.filter((_, i) => i !== idx)
    }))
  }

  function addLootItem() {
    if (!newLootItem.itemId || !newLootItem.name) return alert('Preencha o ID e o Nome do Item de Loot')
    
    // Busca se existe no catálogo para herdar propriedades completas
    const catItem = catalogItems.find(c => c.itemId === newLootItem.itemId)
    
    setLocForm(prev => ({
      ...prev,
      lootTable: [...prev.lootTable, {
        itemId: newLootItem.itemId.trim().toLowerCase(),
        name: newLootItem.name.trim(),
        icon: newLootItem.icon.trim(),
        rarity: newLootItem.rarity || 'common',
        chance: Number(newLootItem.chance),
        min: Number(newLootItem.min),
        max: Number(newLootItem.max),
        category: newLootItem.category || catItem?.category || 'general',
        consumable: newLootItem.consumable !== undefined ? newLootItem.consumable : (catItem?.consumable || false),
        consumeEffect: newLootItem.consumeEffect || catItem?.consumeEffect || null,
        description: newLootItem.description || catItem?.description || '',
        unlocks: newLootItem.unlocks || catItem?.unlocks || []
      }]
    }))
    setNewLootItem({ itemId: '', name: '', icon: '📦', rarity: 'common', chance: 0.4, min: 1, max: 2, category: 'general' })
  }

  function removeLootItem(idx) {
    setLocForm(prev => ({
      ...prev,
      lootTable: prev.lootTable.filter((_, i) => i !== idx)
    }))
  }

  function addUniqueItem() {
    if (!newUniqueItem.itemId || !newUniqueItem.name) return alert('Preencha o ID e o Nome do Item Raro')
    
    const catItem = catalogItems.find(c => c.itemId === newUniqueItem.itemId)
    
    setLocForm(prev => ({
      ...prev,
      uniqueTable: [...prev.uniqueTable, {
        itemId: newUniqueItem.itemId.trim().toLowerCase(),
        name: newUniqueItem.name.trim(),
        icon: newUniqueItem.icon.trim(),
        rarity: newUniqueItem.rarity || 'rare',
        quantity: Number(newUniqueItem.quantity) || 1,
        category: newUniqueItem.category || catItem?.category || 'general',
        consumable: newUniqueItem.consumable !== undefined ? newUniqueItem.consumable : (catItem?.consumable || false),
        consumeEffect: newUniqueItem.consumeEffect || catItem?.consumeEffect || null,
        description: newUniqueItem.description || catItem?.description || '',
        unlocks: newUniqueItem.unlocks || catItem?.unlocks || []
      }]
    }))
    setNewUniqueItem({ itemId: '', name: '', icon: '⭐', rarity: 'rare', quantity: 1, category: 'general' })
  }

  function removeUniqueItem(idx) {
    setLocForm(prev => ({
      ...prev,
      uniqueTable: prev.uniqueTable.filter((_, i) => i !== idx)
    }))
  }

  // ==========================================
  // TAB 4: SOBREVIVENTES (GERENCIAR JOGADORES)
  // ==========================================
  const [players, setPlayers] = useState([])
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [newItem, setNewItem] = useState({ itemId: 'faca', name: 'Faca', icon: '🔪', quantity: 1, rarity: 'common' })
  const [pickerSearch, setPickerSearch] = useState('')
  const [pickerCategory, setPickerCategory] = useState('all')
  const [pickerOpen, setPickerOpen] = useState(false)

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      setPlayers(snap.docs.map((d) => ({ uid: d.id, ...d.data() })))
    })
    return unsub
  }, [])

  async function updatePlayerStats(playerUid, field, value) {
    try {
      const docRef = doc(db, 'users', playerUid)
      await updateDoc(docRef, {
        [`character.${field}`]: value
      })
      setSelectedPlayer(prev => {
        if (prev?.uid === playerUid) {
          return {
            ...prev,
            character: { ...prev.character, [field]: value }
          }
        }
        return prev
      })
    } catch (err) {
      alert('Erro ao atualizar: ' + err.message)
    }
  }

  async function updatePlayerVitals(playerUid, vitalField, value) {
    try {
      const docRef = doc(db, 'users', playerUid)
      await updateDoc(docRef, {
        [`character.vitals.${vitalField}`]: Number(value)
      })
      setSelectedPlayer(prev => {
        if (prev?.uid === playerUid) {
          const currentVitals = prev.character.vitals || { hunger: 100, thirst: 100, blood: 100 }
          return {
            ...prev,
            character: {
              ...prev.character,
              vitals: { ...currentVitals, [vitalField]: Number(value) }
            }
          }
        }
        return prev
      })
    } catch (err) {
      alert('Erro ao atualizar vital: ' + err.message)
    }
  }

  async function handleAddInventoryItem(e) {
    e.preventDefault()
    if (!selectedPlayer || !newItem.name) return

    const playerRef = doc(db, 'users', selectedPlayer.uid)
    const currentInventory = [...(selectedPlayer.character?.inventory || [])]

    const idx = currentInventory.findIndex(i => i.itemId === newItem.itemId)
    if (idx !== -1) {
      currentInventory[idx].quantity += Number(newItem.quantity)
      if (newItem.unlocks && Array.isArray(newItem.unlocks)) {
        currentInventory[idx].unlocks = Array.from(new Set([...(currentInventory[idx].unlocks || []), ...newItem.unlocks]))
      }
    } else {
      currentInventory.push({
        instanceId: Math.random().toString(36).substring(2) + Date.now().toString(36),
        itemId: newItem.itemId,
        name: newItem.name,
        icon: newItem.icon,
        rarity: newItem.rarity || 'common',
        quantity: Number(newItem.quantity),
        category: newItem.category || 'general',
        unlocks: newItem.unlocks || [],
        consumable: !!newItem.consumable,
        consumeEffect: newItem.consumeEffect || null,
        isQuestItem: !!newItem.isQuestItem,
        description: newItem.description || '',
        obtainedAt: new Date().toISOString(),
        obtainedFrom: 'Admin Console'
      })
    }

    try {
      await updateDoc(playerRef, {
        'character.inventory': currentInventory
      })
      setSelectedPlayer(prev => ({
        ...prev,
        character: { ...prev.character, inventory: currentInventory }
      }))
      setNewItem({ itemId: 'faca', name: 'Faca', icon: '🔪', quantity: 1, rarity: 'common' })
      alert('Item adicionado ao inventário!')
    } catch (err) {
      alert('Erro ao atualizar inventário: ' + err.message)
    }
  }

  // Remove um item do inventário pelo instanceId
  async function handleRemoveInventoryItem(instanceId) {
    if (!selectedPlayer) return
    const playerRef = doc(db, 'users', selectedPlayer.uid)
    const currentInventory = (selectedPlayer.character?.inventory || []).filter(
      (i) => i.instanceId !== instanceId
    )
    try {
      await updateDoc(playerRef, { 'character.inventory': currentInventory })
      setSelectedPlayer((prev) => ({
        ...prev,
        character: { ...prev.character, inventory: currentInventory },
      }))
    } catch (err) {
      alert('Erro ao remover item: ' + err.message)
    }
  }

  // Consolida itens duplicados (mesmo itemId) somando quantidades
  async function handleConsolidateInventory() {
    if (!selectedPlayer) return
    const raw = selectedPlayer.character?.inventory || []
    const consolidated = []
    for (const item of raw) {
      const existing = consolidated.find(
        (i) => i.itemId === item.itemId && !i.isQuestItem && !item.isQuestItem
      )
      if (existing) {
        existing.quantity = (existing.quantity || 1) + (item.quantity || 1)
      } else {
        consolidated.push({ ...item })
      }
    }
    if (consolidated.length === raw.length) {
      alert('Inventário já está consolidado — nenhum item duplicado encontrado.')
      return
    }
    const playerRef = doc(db, 'users', selectedPlayer.uid)
    try {
      await updateDoc(playerRef, { 'character.inventory': consolidated })
      setSelectedPlayer((prev) => ({
        ...prev,
        character: { ...prev.character, inventory: consolidated },
      }))
      alert(`Consolidação concluída! ${raw.length - consolidated.length} entrada(s) fundida(s).`)
    } catch (err) {
      alert('Erro ao consolidar: ' + err.message)
    }
  }


  // ==========================================
  const [combatLocations, setCombatLocations] = useState([])
  const [selectedCombatSlug, setSelectedCombatSlug] = useState('sala-hospital')
  const [activeCombatData, setActiveCombatData] = useState(null)
  const [combatTitle, setCombatTitle] = useState('Emboscada nos Corredores')
  const [selectedCombatPlayers, setSelectedCombatPlayers] = useState([]) // array de uids
  const [combatEnemies, setCombatEnemies] = useState([])
  const [combatLogInput, setCombatLogInput] = useState('')
  const [customEnemyForm, setCustomEnemyForm] = useState({
    name: 'Infectado Rápido',
    icon: '🏃‍♂️🧟',
    avatarUrl: '',
    maxHp: 40,
    forca: 2,
    destreza: 3,
    constituicao: 2,
    sabedoria: 1,
    carisma: 0,
    isBoss: false
  })

  // Escuta locações para o seletor de combate
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'locations'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setCombatLocations(list)
      if (list.length > 0 && !selectedCombatSlug) {
        setSelectedCombatSlug(list[0].slug || list[0].id)
      }
    })
    return unsub
  }, [])

  // Escuta dados do combate ativo na locação selecionada
  useEffect(() => {
    if (!selectedCombatSlug) return
    const unsub = onSnapshot(doc(db, 'active_combats', selectedCombatSlug), (snap) => {
      if (snap.exists()) {
        const data = snap.data()
        setActiveCombatData(data)
        if (data.active) {
          setCombatTitle(data.title || 'Combate')
          setSelectedCombatPlayers(data.participantUids || [])
          setCombatEnemies(data.enemies || [])
        }
      } else {
        setActiveCombatData(null)
      }
    })
    return unsub
  }, [selectedCombatSlug])

  // Iniciar / Atualizar Combate no Firestore
  async function handleStartOrUpdateCombat(e) {
    if (e) e.preventDefault()
    if (!selectedCombatSlug) return alert('Selecione uma sala/locação para o combate')
    if (selectedCombatPlayers.length === 0 && combatEnemies.length === 0) {
      return alert('Selecione ao menos 1 sobrevivente ou 1 inimigo para o combate')
    }

    try {
      const docRef = doc(db, 'active_combats', selectedCombatSlug)
      await setDoc(docRef, {
        active: true,
        locationSlug: selectedCombatSlug,
        title: combatTitle.trim() || 'Combate Ativo',
        participantUids: selectedCombatPlayers,
        enemies: combatEnemies,
        combatLog: activeCombatData?.combatLog || [
          { id: Math.random().toString(36).substring(2), text: `Combate iniciado em ${selectedCombatSlug}!`, timestamp: Date.now() }
        ],
        lastImpact: activeCombatData?.lastImpact || null,
        updatedAt: new Date().toISOString()
      }, { merge: true })
      alert('Encontro de combate sincronizado com sucesso!')
    } catch (err) {
      alert('Erro ao iniciar combate: ' + err.message)
    }
  }

  // Encerrar Combate
  async function handleEndCombat() {
    if (!confirm('Deseja encerrar o combate nesta sala? O banner desaparecerá para os jogadores.')) return
    try {
      const docRef = doc(db, 'active_combats', selectedCombatSlug)
      await setDoc(docRef, {
        active: false,
        updatedAt: new Date().toISOString()
      }, { merge: true })
      setCombatEnemies([])
      alert('Combate finalizado!')
    } catch (err) {
      alert('Erro ao finalizar combate: ' + err.message)
    }
  }

  // Adicionar Monstro por Template
  function handleAddMonsterTemplate(templateId) {
    const tmpl = MONSTER_TEMPLATES.find(m => m.id === templateId)
    if (!tmpl) return
    const newEnemy = {
      id: 'enemy_' + Math.random().toString(36).substring(2, 8),
      name: `${tmpl.name} #${combatEnemies.length + 1}`,
      icon: tmpl.icon,
      avatarUrl: tmpl.avatarUrl || '',
      maxHp: tmpl.maxHp,
      currentHp: tmpl.maxHp,
      attributes: { ...tmpl.attributes },
      status: [],
      isBoss: !!tmpl.isBoss
    }
    setCombatEnemies(prev => [...prev, newEnemy])
  }

  // Adicionar Inimigo Customizado
  function handleAddCustomEnemy(e) {
    e.preventDefault()
    if (!customEnemyForm.name) return alert('Digite o nome do inimigo')
    const hp = Number(customEnemyForm.maxHp) || 40
    const newEnemy = {
      id: 'enemy_' + Math.random().toString(36).substring(2, 8),
      name: customEnemyForm.name.trim(),
      icon: customEnemyForm.icon || '🧟',
      avatarUrl: customEnemyForm.avatarUrl || '',
      maxHp: hp,
      currentHp: hp,
      attributes: {
        forca: Number(customEnemyForm.forca) || 0,
        destreza: Number(customEnemyForm.destreza) || 0,
        constituicao: Number(customEnemyForm.constituicao) || 0,
        sabedoria: Number(customEnemyForm.sabedoria) || 0,
        carisma: Number(customEnemyForm.carisma) || 0
      },
      status: [],
      isBoss: !!customEnemyForm.isBoss
    }
    setCombatEnemies(prev => [...prev, newEnemy])
  }

  function handleRemoveEnemy(enemyId) {
    setCombatEnemies(prev => prev.filter(e => e.id !== enemyId))
  }

  // Aplica dano ou cura em um INIMIGO
  async function applyEnemyHpDelta(enemyId, delta, reason = '') {
    const updatedEnemies = combatEnemies.map(en => {
      if (en.id === enemyId) {
        const nextHp = Math.max(0, Math.min(en.maxHp, (en.currentHp ?? en.maxHp) + delta))
        return { ...en, currentHp: nextHp }
      }
      return en
    })
    setCombatEnemies(updatedEnemies)

    const enemy = combatEnemies.find(e => e.id === enemyId)
    const logText = delta < 0
      ? `${enemy?.name || 'Inimigo'} sofreu ${Math.abs(delta)} de dano! ${reason ? `(${reason})` : ''}`
      : `${enemy?.name || 'Inimigo'} recuperou ${delta} de HP! ${reason ? `(${reason})` : ''}`

    try {
      const docRef = doc(db, 'active_combats', selectedCombatSlug)
      await updateDoc(docRef, {
        enemies: updatedEnemies,
        lastImpact: {
          targetId: enemyId,
          type: delta < 0 ? 'damage' : 'heal',
          value: Math.abs(delta),
          timestamp: Date.now()
        },
        combatLog: [
          ...(activeCombatData?.combatLog || []).slice(-15),
          { id: Math.random().toString(36).substring(2), text: logText, timestamp: Date.now() }
        ]
      })
    } catch (err) {
      console.error(err)
    }
  }

  // Toggle de Status em um INIMIGO
  async function toggleEnemyStatus(enemyId, statusId) {
    const updatedEnemies = combatEnemies.map(en => {
      if (en.id === enemyId) {
        const hasSt = (en.status || []).includes(statusId)
        const newStatus = hasSt ? en.status.filter(s => s !== statusId) : [...(en.status || []), statusId]
        return { ...en, status: newStatus }
      }
      return en
    })
    setCombatEnemies(updatedEnemies)

    try {
      const docRef = doc(db, 'active_combats', selectedCombatSlug)
      await updateDoc(docRef, { enemies: updatedEnemies })
    } catch (err) {
      console.error(err)
    }
  }

  // Aplica dano ou cura em um JOGADOR (atualiza Firestore do usuário diretamente + dispara animação)
  async function applyPlayerHpDelta(playerUid, delta, reason = '') {
    const p = players.find(pl => pl.uid === playerUid)
    if (!p) return

    const maxHp = getMaxHp(p.character)
    const currentHp = p.character?.vitals?.blood ?? maxHp
    const nextHp = Math.max(0, Math.min(maxHp, currentHp + delta))

    try {
      // 1. Atualiza ficha do usuário
      const userRef = doc(db, 'users', playerUid)
      await updateDoc(userRef, {
        'character.vitals.blood': nextHp
      })

      // 2. Dispara animação de impacto e log no combate
      const logText = delta < 0
        ? `${p.character?.name || 'Sobrevivente'} sofreu ${Math.abs(delta)} de dano! ${reason ? `(${reason})` : ''}`
        : `${p.character?.name || 'Sobrevivente'} recuperou ${delta} de HP! ${reason ? `(${reason})` : ''}`

      const docRef = doc(db, 'active_combats', selectedCombatSlug)
      await updateDoc(docRef, {
        lastImpact: {
          targetId: playerUid,
          type: delta < 0 ? 'damage' : 'heal',
          value: Math.abs(delta),
          timestamp: Date.now()
        },
        combatLog: [
          ...(activeCombatData?.combatLog || []).slice(-15),
          { id: Math.random().toString(36).substring(2), text: logText, timestamp: Date.now() }
        ]
      })
    } catch (err) {
      alert('Erro ao aplicar vida no jogador: ' + err.message)
    }
  }

  // Toggle de Status em um JOGADOR
  async function togglePlayerStatus(playerUid, statusId) {
    const currentParticipantStatus = activeCombatData?.participantStatus || {}
    const charStatus = currentParticipantStatus[playerUid] || []
    const hasSt = charStatus.includes(statusId)
    const newStatus = hasSt ? charStatus.filter(s => s !== statusId) : [...charStatus, statusId]

    const updated = { ...currentParticipantStatus, [playerUid]: newStatus }
    try {
      const docRef = doc(db, 'active_combats', selectedCombatSlug)
      await updateDoc(docRef, { participantStatus: updated })
    } catch (err) {
      console.error(err)
    }
  }

  // Enviar Log Manual Narrativo
  async function handleSendCombatLog(e) {
    e.preventDefault()
    if (!combatLogInput.trim()) return
    try {
      const docRef = doc(db, 'active_combats', selectedCombatSlug)
      await updateDoc(docRef, {
        combatLog: [
          ...(activeCombatData?.combatLog || []).slice(-15),
          { id: Math.random().toString(36).substring(2), text: combatLogInput.trim(), timestamp: Date.now() }
        ]
      })
      setCombatLogInput('')
    } catch (err) {
      alert('Erro ao enviar log: ' + err.message)
    }
  }

  return (

    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', overflowY: 'auto' }}>
      <HUD />

      <div style={{ padding: 'calc(var(--hud-height) + 24px) 24px 24px', maxWidth: '1000px', margin: '0 auto' }}>
        <div className="glass" style={{ padding: '24px', marginBottom: '20px' }}>
          <h2 style={{ fontFamily: 'Oswald', letterSpacing: 2, textTransform: 'uppercase', color: 'var(--accent-yellow)', marginBottom: '16px' }}>
            🛠️ Painel do Administrador
          </h2>

          {/* Abas */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px', marginBottom: '20px' }}>
            <button className={`btn btn-sm ${activeTab === 'config' ? 'btn-primary' : ''}`} onClick={() => setActiveTab('config')}>
              🌍 Tempo & Clima Global
            </button>
            <button className={`btn btn-sm ${activeTab === 'catalog' ? 'btn-primary' : ''}`} onClick={() => setActiveTab('catalog')}>
              🗃️ Catálogo de Itens ({catalogItems.length})
            </button>
            <button className={`btn btn-sm ${activeTab === 'calendar' ? 'btn-primary' : ''}`} onClick={() => setActiveTab('calendar')}>
              📅 Eventos do Calendário
            </button>
            <button className={`btn btn-sm ${activeTab === 'locations' ? 'btn-primary' : ''}`} onClick={() => setActiveTab('locations')}>
              🗺️ Locações (CRUD)
            </button>
            <button className={`btn btn-sm ${activeTab === 'players' ? 'btn-primary' : ''}`} onClick={() => setActiveTab('players')}>
              👥 Sobreviventes
            </button>
            <button className={`btn btn-sm ${activeTab === 'combat' ? 'btn-primary' : ''}`} onClick={() => setActiveTab('combat')} style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: activeTab === 'combat' ? '#fff' : '#f87171' }}>
              ⚔️ Mesa de Combate {activeCombatData?.active && '🔴'}
            </button>
          </div>


          {/* CONTEÚDO DA TAB CATALOG: CATÁLOGO GERAL DE ITENS */}
          {activeTab === 'catalog' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20 }}>
              {/* Esquerda: Lista de Itens do Catálogo */}
              <div>
                {/* Cabeçalho + botão popular */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <h3 style={{ fontSize: 14, textTransform: 'uppercase', color: 'var(--accent-yellow)', margin: 0 }}>
                    Catálogo ({catalogItems.length})
                  </h3>
                  <button type="button" className="btn btn-sm" onClick={handlePopulatePresets} style={{ fontSize: 11, background: 'rgba(245, 158, 11, 0.15)', borderColor: 'var(--accent-yellow)', color: 'var(--accent-yellow)' }}>
                    ⚡ Popular Itens Padrão
                  </button>
                </div>

                {/* Barra de busca + filtro de categoria */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <input
                    type="text"
                    placeholder="🔍 Buscar item por nome ou ID..."
                    value={catalogSearch}
                    onChange={e => setCatalogSearch(e.target.value)}
                    style={{ flex: 1, padding: '7px 10px', fontSize: 12 }}
                  />
                  <select
                    value={catalogCategoryFilter}
                    onChange={e => setCatalogCategoryFilter(e.target.value)}
                    style={{ padding: '7px 8px', fontSize: 12, minWidth: 130 }}
                  >
                    <option value="all">📦 Todas as categorias</option>
                    <option value="general">🎒 Gerais</option>
                    <option value="supplies">🌾 Mantimentos</option>
                    <option value="clothing">👕 Roupas</option>
                    <option value="melee">🗡️ Armas Brancas</option>
                    <option value="firearms">🔫 Armas de Fogo</option>
                    <option value="medical">💉 Médicos</option>
                  </select>
                </div>

                {(() => {
                  const q = catalogSearch.toLowerCase().trim()
                  const filtered = catalogItems.filter(item => {
                    const matchCat = catalogCategoryFilter === 'all' || item.category === catalogCategoryFilter
                    const matchQ = !q || item.name.toLowerCase().includes(q) || (item.itemId || '').toLowerCase().includes(q)
                    return matchCat && matchQ
                  })
                  if (catalogItems.length === 0) return (
                    <div className="glass-light" style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                      Nenhum item cadastrado ainda. Clique em "Popular Itens Padrão" para preencher o catálogo automaticamente.
                    </div>
                  )
                  if (filtered.length === 0) return (
                    <div className="glass-light" style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                      Nenhum item encontrado para "{catalogSearch}"{catalogCategoryFilter !== 'all' ? ' na categoria selecionada' : ''}.
                    </div>
                  )
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, maxHeight: '600px', overflowY: 'auto' }}>
                      {filtered.map(item => {
                        const rMeta = RARITY_META[item.rarity] || RARITY_META.common
                        return (
                          <div key={item.id} className="glass-light" style={{ padding: 10, borderRadius: 8, borderLeft: `3px solid ${rMeta.color}`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <span style={{ fontSize: 22 }}>{item.icon}</span>
                                <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: rMeta.bg, color: rMeta.color, fontWeight: 'bold' }}>
                                  {rMeta.label}
                                </span>
                              </div>
                              <div style={{ fontWeight: 600, fontSize: 13, marginTop: 4 }}>{item.name}</div>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{item.itemId}</div>
                              {item.description && (
                                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, opacity: 0.85 }}>
                                  {item.description}
                                </div>
                              )}
                              {item.consumable && item.consumeEffect && (
                                <div style={{ fontSize: 10, color: '#5cff7a', marginTop: 4 }}>
                                  🍽️ {Object.entries(item.consumeEffect).map(([k, v]) => `+${v} ${k}`).join(' · ')}
                                </div>
                              )}
                              {item.unlocks && item.unlocks.length > 0 && (
                                <div style={{ fontSize: 10, color: '#70d6ff', marginTop: 2 }}>
                                  🔓 {item.unlocks.join(', ')}
                                </div>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: 6, marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 6 }}>
                              <button type="button" className="btn btn-sm" onClick={() => editCatalogItem(item)} style={{ flex: 1, padding: '2px 4px', fontSize: 10 }}>
                                ✏️ Editar
                              </button>
                              <button type="button" className="btn btn-sm btn-danger" onClick={() => handleDeleteCatalogItem(item.id)} style={{ padding: '2px 8px', fontSize: 10 }}>
                                🗑️
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>


              {/* Direita: Formulário Criar / Editar Item */}
              <form onSubmit={handleCatalogSubmit} className="glass-light" style={{ padding: 16, borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 10, height: 'fit-content' }}>
                <h4 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--accent)', margin: 0 }}>
                  {editingCatalogItem ? '✏️ Editar Item do Catálogo' : '➕ Novo Item no Catálogo'}
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: 8 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: 10 }}>Ícone</label>
                    <input type="text" value={catalogForm.icon} onChange={e => setCatalogForm(prev => ({ ...prev, icon: e.target.value }))} style={{ textAlign: 'center' }} required />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: 10 }}>Nome do Item</label>
                    <input type="text" placeholder="Ex: Garrafa de Água" value={catalogForm.name} onChange={e => setCatalogForm(prev => ({ ...prev, name: e.target.value }))} required />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: 10 }}>ID Único (Sem espaços)</label>
                    <input type="text" placeholder="garrafa_agua" value={catalogForm.itemId} onChange={e => setCatalogForm(prev => ({ ...prev, itemId: e.target.value }))} disabled={!!editingCatalogItem} required />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: 10 }}>Raridade / Qualidade</label>
                    <select value={catalogForm.rarity} onChange={e => setCatalogForm(prev => ({ ...prev, rarity: e.target.value }))}>
                      {Object.values(RARITY_META).map(r => (
                        <option key={r.id} value={r.id}>{r.icon} {r.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 10 }}>Categoria de Mochila</label>
                  <select value={catalogForm.category} onChange={e => setCatalogForm(prev => ({ ...prev, category: e.target.value }))}>
                    <option value="general">🎒 Itens Gerais</option>
                    <option value="supplies">🌾 Mantimentos</option>
                    <option value="clothing">👕 Roupas / Vestuário</option>
                    <option value="melee">🗡️ Armas Brancas</option>
                    <option value="firearms">🔫 Armas de Fogo</option>
                    <option value="medical">💉 Suprimentos Médicos</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 10 }}>Descrição Narrativa</label>
                  <textarea rows="2" placeholder="Explicação do item..." value={catalogForm.description} onChange={e => setCatalogForm(prev => ({ ...prev, description: e.target.value }))} style={{ width: '100%', padding: '6px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: 'inherit', fontSize: 11 }} />
                </div>

                <div style={{ padding: 8, background: 'rgba(255,255,255,0.02)', borderRadius: 6, border: '1px solid var(--glass-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <input type="checkbox" id="catConsumable" checked={catalogForm.consumable} onChange={e => setCatalogForm(prev => ({ ...prev, consumable: e.target.checked }))} style={{ width: 'auto' }} />
                    <label htmlFor="catConsumable" style={{ fontSize: 11, margin: 0, cursor: 'pointer' }}>Item Consumível / Usável</label>
                  </div>
                  {catalogForm.consumable && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: 9 }}>🍖 +Fome</label>
                        <input type="number" value={catalogForm.hungerEffect} onChange={e => setCatalogForm(prev => ({ ...prev, hungerEffect: Number(e.target.value) }))} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: 9 }}>💧 +Sede</label>
                        <input type="number" value={catalogForm.thirstEffect} onChange={e => setCatalogForm(prev => ({ ...prev, thirstEffect: Number(e.target.value) }))} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: 9 }}>🩸 +Sangue/HP</label>
                        <input type="number" value={catalogForm.bloodEffect} onChange={e => setCatalogForm(prev => ({ ...prev, bloodEffect: Number(e.target.value) }))} />
                      </div>
                    </div>
                  )}
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 10 }}>Desbloqueia Features (ex: hud_clock, nav_chave_apt203)</label>
                  <input type="text" placeholder="hud_clock" value={catalogForm.unlocks} onChange={e => setCatalogForm(prev => ({ ...prev, unlocks: e.target.value }))} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" id="questItm" checked={catalogForm.isQuestItem} onChange={e => setCatalogForm(prev => ({ ...prev, isQuestItem: e.target.checked }))} style={{ width: 'auto' }} />
                  <label htmlFor="questItm" style={{ fontSize: 11, margin: 0, cursor: 'pointer' }}>Item de Missão (Não pode ser descartado)</label>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  {editingCatalogItem && (
                    <button type="button" className="btn btn-sm" onClick={() => { setEditingCatalogItem(null); setCatalogForm({ itemId: '', name: '', icon: '📦', category: 'general', rarity: 'common', description: '', consumable: false, hungerEffect: 0, thirstEffect: 0, bloodEffect: 0, isQuestItem: false, unlocks: '' }); }} style={{ flex: 1 }}>
                      Cancelar
                    </button>
                  )}
                  <button type="submit" className="btn btn-sm btn-primary" style={{ flex: 2 }}>
                    💾 Salvar Item
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* CONTEÚDO DA TAB 1: CONFIG GLOBAL */}
          {activeTab === 'config' && (
            <form onSubmit={saveGlobalConfig} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Card de Visualização da Simulação Atual */}
              <div className="glass-light" style={{ padding: '16px', borderRadius: '10px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                <h4 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--accent-yellow)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>📡</span> Estado Simulado Atual em Tempo Real
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, fontSize: 13 }}>
                  <div>⏰ Horário: <strong>{simulatedTime.timeString}</strong> ({simulatedTime.period === 'day' ? '☀️ Dia' : '🌙 Noite'})</div>
                  <div>📅 Data: <strong>{simulatedTime.formattedDate}</strong></div>
                  <div>{simulatedTime.season.icon} Estação: <strong>{simulatedTime.season.name}</strong></div>
                  <div>{simulatedTime.moonPhase.icon} Lua: <strong>{simulatedTime.moonPhase.name}</strong></div>
                  <div>{simulatedWeather.icon} Clima: <strong>{simulatedWeather.label} ({simulatedWeather.temperature}°C)</strong></div>
                  <div>📍 Região: <strong>{simulatedWeather.region}</strong></div>
                </div>
              </div>

              <div className="form-group">
                <label>Título / Nome Global do Cenário</label>
                <input
                  type="text"
                  value={tempTitle}
                  onChange={(e) => setTempTitle(e.target.value)}
                  placeholder="Zona Zero RPG"
                />
              </div>

              {/* SEÇÃO 1: TEMPO E CRONOMETRO */}
              <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '10px' }}>
                <h4 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12 }}>
                  ⏱️ Fluxo do Tempo & Ciclo Dia / Noite (2 dias in-game por dia real)
                </h4>

                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label>Modo de Tempo</label>
                  <select
                    value={tempTime.mode || 'dynamic'}
                    onChange={(e) => setTempTime(prev => ({ ...prev, mode: e.target.value }))}
                  >
                    <option value="dynamic">⚙️ Dinâmico / Automático (Horário corre em tempo real - Proporção 2:1)</option>
                    <option value="manual">🔒 Manual / Fixo (O Mestre define a hora exata)</option>
                  </select>
                </div>

                {tempTime.mode === 'dynamic' ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 8 }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: 11 }}>Dia Base</label>
                        <input
                          type="number"
                          min="1"
                          max="31"
                          value={tempTime.baseDay}
                          onChange={(e) => setTempTime(prev => ({ ...prev, baseDay: Number(e.target.value) }))}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: 11 }}>Mês Base</label>
                        <select
                          value={tempTime.baseMonth}
                          onChange={(e) => setTempTime(prev => ({ ...prev, baseMonth: Number(e.target.value) }))}
                        >
                          {MONTHS.map((m, idx) => (
                            <option key={idx} value={idx + 1}>{m.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: 11 }}>Ano Base</label>
                        <input
                          type="number"
                          value={tempTime.baseYear}
                          onChange={(e) => setTempTime(prev => ({ ...prev, baseYear: Number(e.target.value) }))}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: 11 }}>Hora Inicial</label>
                        <input
                          type="number"
                          min="0"
                          max="23"
                          value={tempTime.baseHour}
                          onChange={(e) => setTempTime(prev => ({ ...prev, baseHour: Number(e.target.value) }))}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: 11 }}>Minuto Inicial</label>
                        <input
                          type="number"
                          min="0"
                          max="59"
                          value={tempTime.baseMinute}
                          onChange={(e) => setTempTime(prev => ({ ...prev, baseMinute: Number(e.target.value) }))}
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={syncTimeToNow}
                      style={{ fontSize: 11, padding: '6px 12px', marginTop: 4 }}
                    >
                      🔄 Sincronizar Início da Simulação com Data/Hora Real de Agora
                    </button>
                  </>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label>Horário Fixo (HH:mm)</label>
                      <input
                        type="text"
                        value={tempTime.value}
                        onChange={(e) => setTempTime(prev => ({ ...prev, value: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Período</label>
                      <select
                        value={tempTime.period}
                        onChange={(e) => setTempTime(prev => ({ ...prev, period: e.target.value }))}
                      >
                        <option value="day">☀️ Dia</option>
                        <option value="night">🌙 Noite</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* SEÇÃO 2: ESTAÇÃO E FASES DA LUA */}
              <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '10px' }}>
                <h4 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12 }}>
                  🌕 Estação do Ano & Fase da Lua (Impacto nos Zumbis)
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label>Sobrescrever Estação do Ano (Opcional)</label>
                    <select
                      value={tempTime.seasonOverride || ''}
                      onChange={(e) => setTempTime(prev => ({ ...prev, seasonOverride: e.target.value }))}
                    >
                      <option value="">Automático pelo Mês do Calendário</option>
                      {Object.values(SEASONS).map(s => (
                        <option key={s.id} value={s.id}>{s.icon} {s.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Sobrescrever Fase da Lua (Opcional / Evento)</label>
                    <select
                      value={tempTime.moonOverride || ''}
                      onChange={(e) => setTempTime(prev => ({ ...prev, moonOverride: e.target.value }))}
                    >
                      <option value="">Automático pelo Ciclo Lunar (29.5 dias)</option>
                      {MOON_PHASES.map(m => (
                        <option key={m.id} value={m.id}>{m.icon} {m.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* SEÇÃO 3: CLIMA */}
              <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '10px' }}>
                <h4 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12 }}>
                  🌧️ Sistema de Clima & Efeitos Visuais no Canvas
                </h4>

                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label>Modo do Clima</label>
                  <select
                    value={tempWeather.mode || 'dynamic'}
                    onChange={(e) => setTempWeather(prev => ({ ...prev, mode: e.target.value }))}
                  >
                    <option value="dynamic">🎲 Dinâmico / Procedural (Gera clima de acordo com Estação e Região)</option>
                    <option value="manual">🔒 Manual / Fixo (O Mestre escolhe a condição)</option>
                  </select>
                </div>

                {tempWeather.mode === 'manual' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label>Condição Climática</label>
                      <select
                        value={tempWeather.condition}
                        onChange={(e) => {
                          const opt = WEATHER_OPTIONS.find(o => o.value === e.target.value)
                          setTempWeather(prev => ({
                            ...prev,
                            condition: opt.value,
                            label: opt.label,
                            icon: opt.icon
                          }))
                        }}
                      >
                        {WEATHER_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label} {o.icon}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Temperatura (°C)</label>
                      <input
                        type="number"
                        value={tempWeather.temperature}
                        onChange={(e) => setTempWeather(prev => ({ ...prev, temperature: Number(e.target.value) }))}
                        required
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                <input
                  type="checkbox"
                  id="maint"
                  checked={tempMaintenance}
                  onChange={(e) => setTempMaintenance(e.target.checked)}
                  style={{ width: 'auto' }}
                />
                <label htmlFor="maint" style={{ margin: 0, cursor: 'pointer' }}>Modo Manutenção Ativo</label>
              </div>

              <button type="submit" className="btn btn-primary" style={{ padding: 12, marginTop: 8 }}>
                💾 Salvar Todas as Configurações Globais
              </button>
            </form>
          )}

          {/* CONTEÚDO DA TAB CALENDAR: EVENTOS DO CALENDÁRIO */}
          {activeTab === 'calendar' && (
            <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20 }}>
              {/* Formulário para Adicionar Evento */}
              <form onSubmit={handleAddEvent} className="glass-light" style={{ padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <h3 style={{ fontSize: 14, textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 4 }}>
                  ➕ Adicionar Evento no Calendário
                </h3>

                <div className="form-group">
                  <label>Título do Evento</label>
                  <input
                    type="text"
                    placeholder="Ex: Ataque da Horda Alfa"
                    value={newEvent.title}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <div className="form-group">
                    <label style={{ fontSize: 10 }}>Dia</label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={newEvent.day}
                      onChange={(e) => setNewEvent(prev => ({ ...prev, day: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ fontSize: 10 }}>Mês</label>
                    <select
                      value={newEvent.month}
                      onChange={(e) => setNewEvent(prev => ({ ...prev, month: e.target.value }))}
                    >
                      {MONTHS.map((m, idx) => (
                        <option key={idx} value={idx + 1}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label style={{ fontSize: 10 }}>Ano</label>
                    <input
                      type="number"
                      value={newEvent.year}
                      onChange={(e) => setNewEvent(prev => ({ ...prev, year: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div className="form-group">
                    <label style={{ fontSize: 10 }}>Categoria / Tipo</label>
                    <select
                      value={newEvent.type}
                      onChange={(e) => setNewEvent(prev => ({ ...prev, type: e.target.value }))}
                    >
                      <option value="horde">🧟 Horda / Ataque</option>
                      <option value="supply">📦 Suprimentos / Airdrop</option>
                      <option value="blackout">⚡ Apagão / Tempestade</option>
                      <option value="boss">💀 Boss / Ameaça</option>
                      <option value="roleplay">🎭 Evento Social / Roleplay</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label style={{ fontSize: 10 }}>Nível de Perigo</label>
                    <select
                      value={newEvent.dangerLevel}
                      onChange={(e) => setNewEvent(prev => ({ ...prev, dangerLevel: e.target.value }))}
                    >
                      <option value="Baixo">🟢 Baixo</option>
                      <option value="Médio">🟡 Médio</option>
                      <option value="Alto">🟠 Alto</option>
                      <option value="Extremo">🔴 Extremo</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Descrição do Evento (Narrativa)</label>
                  <textarea
                    rows="3"
                    placeholder="Detalhes que os sobreviventes saberão ao conferir o calendário..."
                    value={newEvent.description}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, description: e.target.value }))}
                    style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: 'inherit', fontFamily: 'inherit', outline: 'none' }}
                  />
                </div>

                <button type="submit" className="btn btn-primary" style={{ padding: 10 }}>
                  ➕ Publicar Evento
                </button>
              </form>

              {/* Lista de Eventos Cadastrados */}
              <div>
                <h4 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>
                  Eventos Cadastrados ({calendarEvents.length})
                </h4>

                {calendarEvents.length === 0 ? (
                  <div className="glass-light" style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                    Nenhum evento registrado no calendário ainda.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10, maxHeight: '550px', overflowY: 'auto' }}>
                    {calendarEvents.map(evt => (
                      <div key={evt.id} className="glass-light" style={{ padding: 12, borderRadius: 8, borderLeft: `3px solid ${evt.color || '#ef4444'}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{evt.title}</span>
                          <button type="button" onClick={() => handleDeleteEvent(evt.id)} style={{ background: 'transparent', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', fontSize: 14 }}>
                            🗑️
                          </button>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--accent-yellow)', margin: '4px 0' }}>
                          📅 {evt.day} de {MONTHS[(evt.month || 1) - 1]?.name} de {evt.year} · Perigo: <strong>{evt.dangerLevel}</strong>
                        </div>
                        {evt.description && (
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                            {evt.description}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CONTEÚDO DA TAB 2: LOCAÇÕES */}
          {activeTab === 'locations' && (
            <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20 }}>
              {/* Esquerda: lista */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Locações ({locations.length})</h4>
                  <button className="btn btn-sm btn-primary" onClick={resetLocForm}>+ Nova Sala</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '600px', overflowY: 'auto' }}>
                  {locations.map((loc) => (
                    <div
                      key={loc.id}
                      className={`glass-light ${editingLoc === loc.id ? 'selected' : ''}`}
                      style={{ padding: '10px 12px', cursor: 'pointer', borderRadius: 8, border: editingLoc === loc.id ? '1px solid var(--accent)' : '1px solid transparent' }}
                      onClick={() => handleLocEdit(loc)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: 13 }}>{loc.name}</strong>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-sm" style={{ padding: '2px 6px', fontSize: 10 }} onClick={(e) => { e.stopPropagation(); handleLocEdit(loc); }}>
                            Editar
                          </button>
                          <a 
                            href={`/location/${loc.slug}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="btn btn-sm" 
                            style={{ padding: '2px 6px', fontSize: 10, background: 'rgba(255,255,255,0.05)' }}
                          >
                            👁️ Ver
                          </a>
                          <button className="btn btn-sm btn-danger" style={{ padding: '2px 6px', fontSize: 10 }} onClick={(e) => { e.stopPropagation(); handleLocDelete(loc.id); }}>
                            Excluir
                          </button>
                        </div>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>URL: /location/{loc.slug}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Direita: formulário */}
              <form onSubmit={handleLocSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '20px', borderRadius: '12px', maxHeight: 'calc(100vh - 240px)', overflowY: 'auto' }} className="glass-light">
                <h3 style={{ fontSize: 14, textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 8 }}>
                  {editingLoc ? `Editando: ${locForm.name}` : 'Criar Nova Locação'}
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label>Nome do Local</label>
                    <input
                      type="text"
                      placeholder="Ex: Praça Central"
                      value={locForm.name}
                      onChange={(e) => {
                        const name = e.target.value
                        const autoSlug = editingLoc ? locForm.slug : name
                          .toLowerCase()
                          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                          .replace(/[^a-z0-9\s-]/g, '')
                          .trim()
                          .replace(/\s+/g, '-')
                        setLocForm(prev => ({ ...prev, name, slug: autoSlug }))
                      }}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>ID da Sala (URL)</label>
                    <input
                      type="text"
                      placeholder="Ex: praca-central"
                      value={locForm.slug}
                      onChange={(e) => setLocForm(prev => ({ ...prev, slug: e.target.value }))}
                      disabled={!!editingLoc}
                      required
                      style={{ opacity: editingLoc ? 0.5 : 1 }}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Descrição do Local</label>
                  <textarea
                    rows="3"
                    placeholder="Descrição narrativa da sala..."
                    value={locForm.description}
                    onChange={(e) => setLocForm(prev => ({ ...prev, description: e.target.value }))}
                    style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: 'inherit', fontFamily: 'inherit', outline: 'none' }}
                  />
                </div>

                <div className="form-group">
                  <label>Link da Imagem de Fundo (Opcional)</label>
                  <input type="url" placeholder="https://exemplo.com/imagem.jpg" value={locForm.backgroundImage} onChange={(e) => setLocForm(prev => ({ ...prev, backgroundImage: e.target.value }))} />
                </div>

                <div className="form-group">
                  <label>Iframe do Chat xat.com</label>
                  <input type="text" placeholder="https://xat.com/embed/chat.php#id=..." value={locForm.xatIframe} onChange={(e) => setLocForm(prev => ({ ...prev, xatIframe: e.target.value }))} required />
                </div>

                <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="checkbox"
                      id="isIndoor"
                      checked={locForm.isIndoor}
                      onChange={(e) => setLocForm(prev => ({ ...prev, isIndoor: e.target.checked }))}
                      style={{ width: 'auto', cursor: 'pointer' }}
                    />
                    <label htmlFor="isIndoor" style={{ margin: 0, cursor: 'pointer', display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 600 }}>🏠 Ambiente Fechado (Interior / Sala Coberta)</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Se marcado, efeitos climáticos externos (como chuva, neve e tempestade) não caem dentro deste local.
                      </span>
                    </label>
                  </div>
                </div>

                {/* 1. SEÇÃO DE BUSCA DE SUPRIMENTOS (COMUM / COOLDOWN) */}
                <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <input type="checkbox" id="lootEn" checked={locForm.lootEnabled} onChange={(e) => setLocForm(prev => ({ ...prev, lootEnabled: e.target.checked }))} style={{ width: 'auto' }} />
                    <label htmlFor="lootEn" style={{ margin: 0, cursor: 'pointer', fontWeight: 600, color: 'var(--accent)' }}>🔦 Busca de Suprimentos (Repetível / Sucata, Comum e Incomum)</label>
                  </div>
                  {locForm.lootEnabled && (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label style={{ fontSize: 10 }}>Tempo de Cooldown (Minutos)</label>
                          <input type="number" value={locForm.cooldownMinutes} onChange={(e) => setLocForm(prev => ({ ...prev, cooldownMinutes: e.target.value }))} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label style={{ fontSize: 10 }}>Chance de vir vazio (0 a 1)</label>
                          <input type="number" step="0.05" min="0" max="1" value={locForm.emptyChance} onChange={(e) => setLocForm(prev => ({ ...prev, emptyChance: e.target.value }))} />
                        </div>
                      </div>

                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10, marginTop: 10 }}>
                        <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>📦 Tabela de Suprimentos</label>
                        
                        {/* === BUSCADOR DO CATÁLOGO PARA SUPRIMENTOS === */}
                        <div style={{ margin: '8px 0 12px' }}>
                          <button
                            type="button"
                            onClick={() => setLootPickerOpen(v => !v)}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: lootPickerOpen ? '#60a5fa' : 'var(--text-secondary)', background: lootPickerOpen ? 'rgba(96,165,250,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${lootPickerOpen ? 'rgba(96,165,250,0.4)' : 'var(--glass-border)'}`, borderRadius: 8, padding: '7px 12px', cursor: 'pointer', width: '100%', justifyContent: 'space-between', transition: 'all 0.2s' }}
                          >
                            <span>🗃️ {lootPickerOpen ? 'Fechar catálogo de itens' : '🔍 Selecionar item do catálogo para Suprimentos'}</span>
                            <span style={{ fontSize: 14, opacity: 0.7 }}>{lootPickerOpen ? '▲' : '▼'}</span>
                          </button>

                          {lootPickerOpen && (
                            <div style={{ marginTop: 8, padding: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(96,165,250,0.25)', borderRadius: 10 }}>
                              {/* Filtros de busca e categoria */}
                              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                                <input
                                  type="text"
                                  placeholder="🔍 Buscar item por nome ou ID..."
                                  value={lootPickerSearch}
                                  onChange={e => setLootPickerSearch(e.target.value)}
                                  style={{ flex: 1, padding: '6px 10px', fontSize: 12 }}
                                />
                                <select
                                  value={lootPickerCategory}
                                  onChange={e => setLootPickerCategory(e.target.value)}
                                  style={{ padding: '6px 8px', fontSize: 12, minWidth: 130 }}
                                >
                                  <option value="all">📦 Todas</option>
                                  <option value="general">🎒 Gerais</option>
                                  <option value="supplies">🌾 Mantimentos</option>
                                  <option value="clothing">👕 Roupas</option>
                                  <option value="melee">🗡️ Armas Brancas</option>
                                  <option value="firearms">🔫 Armas de Fogo</option>
                                  <option value="medical">💉 Médicos</option>
                                </select>
                              </div>

                              {/* Grade de itens filtrados */}
                              {catalogItems.length === 0 ? (
                                <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
                                  Catálogo vazio. Cadastre itens na aba "🗃️ Catálogo de Itens" primeiro.
                                </p>
                              ) : (() => {
                                const q = lootPickerSearch.toLowerCase().trim()
                                const filtered = catalogItems.filter(item => {
                                  const matchCat = lootPickerCategory === 'all' || item.category === lootPickerCategory
                                  const matchQ = !q || item.name.toLowerCase().includes(q) || (item.itemId || '').toLowerCase().includes(q)
                                  return matchCat && matchQ
                                })
                                if (filtered.length === 0) return (
                                  <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
                                    Nenhum item encontrado.
                                  </p>
                                )
                                return (
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
                                    {filtered.map(item => {
                                      const rMeta = RARITY_META[item.rarity] || RARITY_META.common
                                      const isSelected = newLootItem.itemId === item.itemId
                                      return (
                                        <button
                                          key={item.id}
                                          type="button"
                                          onClick={() => {
                                            setNewLootItem(prev => ({
                                              ...prev,
                                              itemId: item.itemId,
                                              name: item.name,
                                              icon: item.icon || '📦',
                                              rarity: item.rarity || 'common',
                                              category: item.category || 'general',
                                              consumable: item.consumable,
                                              consumeEffect: item.consumeEffect,
                                              description: item.description,
                                              unlocks: item.unlocks
                                            }))
                                            setLootPickerOpen(false)
                                          }}
                                          style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            padding: '8px 6px',
                                            borderRadius: 8,
                                            background: isSelected ? 'rgba(96,165,250,0.2)' : 'rgba(255,255,255,0.03)',
                                            border: `1px solid ${isSelected ? '#60a5fa' : rMeta.border || 'rgba(255,255,255,0.08)'}`,
                                            cursor: 'pointer',
                                            textAlign: 'center',
                                            transition: 'all 0.15s'
                                          }}
                                          title={`Clique para selecionar: ${item.name} (${item.itemId})`}
                                        >
                                          <span style={{ fontSize: 20, marginBottom: 2 }}>{item.icon || '📦'}</span>
                                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2, width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {item.name}
                                          </span>
                                          <span style={{ fontSize: 9, color: rMeta.color, marginTop: 2 }}>
                                            {rMeta.label}
                                          </span>
                                        </button>
                                      )
                                    })}
                                  </div>
                                )
                              })()}
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '8px 0' }}>
                          {locForm.lootTable.map((item, idx) => {
                            const rMeta = RARITY_META[item.rarity] || RARITY_META.common
                            return (
                              <div key={idx} className="glass-light" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderRadius: 6, fontSize: 11, borderLeft: `3px solid ${rMeta.color}` }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ fontSize: 16 }}>{item.icon}</span>
                                  <strong>{item.name}</strong>
                                  <span style={{ color: rMeta.color, fontSize: 10 }}>[{rMeta.label}]</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                  <span>Chance: <strong>{(item.chance * 100).toFixed(0)}%</strong></span>
                                  <span>Qtd: <strong>{item.min}-{item.max}</strong></span>
                                  <button type="button" onClick={() => removeLootItem(idx)} style={{ background: 'transparent', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', fontSize: 14 }}>×</button>
                                </div>
                              </div>
                            )
                          })}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 50px 110px 70px 70px 40px', gap: 6, alignItems: 'end', marginTop: 8 }}>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label style={{ fontSize: 9 }}>ID Item</label>
                            <input type="text" placeholder="bandagem" value={newLootItem.itemId} onChange={(e) => {
                              const id = e.target.value
                              const catItem = catalogItems.find(c => c.itemId === id)
                              setNewLootItem(prev => ({
                                ...prev,
                                itemId: id,
                                ...(catItem ? {
                                  name: catItem.name,
                                  icon: catItem.icon,
                                  rarity: catItem.rarity || 'common',
                                  category: catItem.category || 'general',
                                  consumable: catItem.consumable,
                                  consumeEffect: catItem.consumeEffect,
                                  description: catItem.description,
                                  unlocks: catItem.unlocks
                                } : {})
                              }))
                            }} style={{ padding: '6px' }} />
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label style={{ fontSize: 9 }}>Nome</label>
                            <input type="text" placeholder="Bandagem Estéril" value={newLootItem.name} onChange={(e) => setNewLootItem(prev => ({ ...prev, name: e.target.value }))} style={{ padding: '6px' }} />
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label style={{ fontSize: 9 }}>Ícone</label>
                            <input type="text" placeholder="🩹" value={newLootItem.icon} onChange={(e) => setNewLootItem(prev => ({ ...prev, icon: e.target.value }))} style={{ padding: '6px', textAlign: 'center' }} />
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label style={{ fontSize: 9 }}>Raridade</label>
                            <select value={newLootItem.rarity} onChange={(e) => setNewLootItem(prev => ({ ...prev, rarity: e.target.value }))} style={{ padding: '6px' }}>
                              {Object.values(RARITY_META).map(r => (
                                <option key={r.id} value={r.id}>{r.icon} {r.label}</option>
                              ))}
                            </select>
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label style={{ fontSize: 9 }}>Chance</label>
                            <input type="number" step="0.05" min="0" max="1" value={newLootItem.chance} onChange={(e) => setNewLootItem(prev => ({ ...prev, chance: e.target.value }))} style={{ padding: '6px' }} />
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label style={{ fontSize: 9 }}>Min-Max</label>
                            <div style={{ display: 'flex', gap: 2 }}>
                              <input type="number" min="1" value={newLootItem.min} onChange={(e) => setNewLootItem(prev => ({ ...prev, min: e.target.value }))} style={{ padding: '6px', width: '50%' }} />
                              <input type="number" min="1" value={newLootItem.max} onChange={(e) => setNewLootItem(prev => ({ ...prev, max: e.target.value }))} style={{ padding: '6px', width: '50%' }} />
                            </div>
                          </div>
                          <button type="button" className="btn btn-sm btn-primary" onClick={addLootItem} style={{ padding: '8px 0', width: '100%' }}>
                            +
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* 2. SEÇÃO DE BUSCA ÚNICA (ONE-SHOT / RAROS / SELEÇÃO OBRIGATÓRIA) */}
                <div style={{ padding: '14px', background: 'rgba(245, 158, 11, 0.04)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <input type="checkbox" id="uniqueEn" checked={locForm.uniqueEnabled} onChange={(e) => setLocForm(prev => ({ ...prev, uniqueEnabled: e.target.checked }))} style={{ width: 'auto' }} />
                    <label htmlFor="uniqueEn" style={{ margin: 0, cursor: 'pointer', fontWeight: 600, color: 'var(--accent-yellow)' }}>⭐ Busca Única (One-Shot / Raros, Muito Raros e Excepcionais)</label>
                  </div>
                  {locForm.uniqueEnabled && (
                    <>
                      <div className="form-group" style={{ marginBottom: 12 }}>
                        <label style={{ fontSize: 10 }}>Capacidade Máxima de Transporte (Quantos itens o jogador pode escolher levar)</label>
                        <input type="number" min="1" max="10" value={locForm.uniqueMaxCarry} onChange={(e) => setLocForm(prev => ({ ...prev, uniqueMaxCarry: Number(e.target.value) }))} />
                      </div>

                      <div style={{ borderTop: '1px solid rgba(245, 158, 11, 0.15)', paddingTop: 10, marginTop: 10 }}>
                        <label style={{ fontSize: 10, color: 'var(--accent-yellow)', textTransform: 'uppercase', letterSpacing: 0.5 }}>💎 Itens Especiais da Busca Única</label>

                        {/* === BUSCADOR DO CATÁLOGO PARA BUSCA ÚNICA === */}
                        <div style={{ margin: '8px 0 12px' }}>
                          <button
                            type="button"
                            onClick={() => setUniquePickerOpen(v => !v)}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: uniquePickerOpen ? '#f59e0b' : 'var(--text-secondary)', background: uniquePickerOpen ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${uniquePickerOpen ? 'rgba(245,158,11,0.4)' : 'var(--glass-border)'}`, borderRadius: 8, padding: '7px 12px', cursor: 'pointer', width: '100%', justifyContent: 'space-between', transition: 'all 0.2s' }}
                          >
                            <span>🗃️ {uniquePickerOpen ? 'Fechar catálogo de itens' : '🔍 Selecionar item do catálogo para Busca Única'}</span>
                            <span style={{ fontSize: 14, opacity: 0.7 }}>{uniquePickerOpen ? '▲' : '▼'}</span>
                          </button>

                          {uniquePickerOpen && (
                            <div style={{ marginTop: 8, padding: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10 }}>
                              {/* Filtros de busca e categoria */}
                              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                                <input
                                  type="text"
                                  placeholder="🔍 Buscar item por nome ou ID..."
                                  value={uniquePickerSearch}
                                  onChange={e => setUniquePickerSearch(e.target.value)}
                                  style={{ flex: 1, padding: '6px 10px', fontSize: 12 }}
                                />
                                <select
                                  value={uniquePickerCategory}
                                  onChange={e => setUniquePickerCategory(e.target.value)}
                                  style={{ padding: '6px 8px', fontSize: 12, minWidth: 130 }}
                                >
                                  <option value="all">📦 Todas</option>
                                  <option value="general">🎒 Gerais</option>
                                  <option value="supplies">🌾 Mantimentos</option>
                                  <option value="clothing">👕 Roupas</option>
                                  <option value="melee">🗡️ Armas Brancas</option>
                                  <option value="firearms">🔫 Armas de Fogo</option>
                                  <option value="medical">💉 Médicos</option>
                                </select>
                              </div>

                              {/* Grade de itens filtrados */}
                              {catalogItems.length === 0 ? (
                                <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
                                  Catálogo vazio. Cadastre itens na aba "🗃️ Catálogo de Itens" primeiro.
                                </p>
                              ) : (() => {
                                const q = uniquePickerSearch.toLowerCase().trim()
                                const filtered = catalogItems.filter(item => {
                                  const matchCat = uniquePickerCategory === 'all' || item.category === uniquePickerCategory
                                  const matchQ = !q || item.name.toLowerCase().includes(q) || (item.itemId || '').toLowerCase().includes(q)
                                  return matchCat && matchQ
                                })
                                if (filtered.length === 0) return (
                                  <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
                                    Nenhum item encontrado.
                                  </p>
                                )
                                return (
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
                                    {filtered.map(item => {
                                      const rMeta = RARITY_META[item.rarity] || RARITY_META.rare
                                      const isSelected = newUniqueItem.itemId === item.itemId
                                      return (
                                        <button
                                          key={item.id}
                                          type="button"
                                          onClick={() => {
                                            setNewUniqueItem(prev => ({
                                              ...prev,
                                              itemId: item.itemId,
                                              name: item.name,
                                              icon: item.icon || '⭐',
                                              rarity: item.rarity || 'rare',
                                              quantity: 1,
                                              category: item.category || 'general',
                                              consumable: item.consumable,
                                              consumeEffect: item.consumeEffect,
                                              description: item.description,
                                              unlocks: item.unlocks
                                            }))
                                            setUniquePickerOpen(false)
                                          }}
                                          style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            padding: '8px 6px',
                                            borderRadius: 8,
                                            background: isSelected ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.03)',
                                            border: `1px solid ${isSelected ? '#f59e0b' : rMeta.border || 'rgba(255,255,255,0.08)'}`,
                                            cursor: 'pointer',
                                            textAlign: 'center',
                                            transition: 'all 0.15s'
                                          }}
                                          title={`Clique para selecionar: ${item.name} (${item.itemId})`}
                                        >
                                          <span style={{ fontSize: 20, marginBottom: 2 }}>{item.icon || '⭐'}</span>
                                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2, width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {item.name}
                                          </span>
                                          <span style={{ fontSize: 9, color: rMeta.color, marginTop: 2 }}>
                                            {rMeta.label}
                                          </span>
                                        </button>
                                      )
                                    })}
                                  </div>
                                )
                              })()}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '8px 0' }}>
                          {locForm.uniqueTable.map((item, idx) => {
                            const rMeta = RARITY_META[item.rarity] || RARITY_META.rare
                            return (
                              <div key={idx} className="glass-light" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderRadius: 6, fontSize: 11, borderLeft: `3px solid ${rMeta.color}` }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ fontSize: 16 }}>{item.icon}</span>
                                  <strong>{item.name}</strong>
                                  <span style={{ color: rMeta.color, fontSize: 10 }}>[{rMeta.label}]</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                  <span>Qtd: <strong>{item.quantity}</strong></span>
                                  <button type="button" onClick={() => removeUniqueItem(idx)} style={{ background: 'transparent', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', fontSize: 14 }}>×</button>
                                </div>
                              </div>
                            )
                          })}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 50px 110px 70px 40px', gap: 6, alignItems: 'end', marginTop: 8 }}>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label style={{ fontSize: 9 }}>ID Item</label>
                            <input type="text" placeholder="relogio_pulso" value={newUniqueItem.itemId} onChange={(e) => {
                              const id = e.target.value
                              const catItem = catalogItems.find(c => c.itemId === id)
                              setNewUniqueItem(prev => ({
                                ...prev,
                                itemId: id,
                                ...(catItem ? {
                                  name: catItem.name,
                                  icon: catItem.icon,
                                  rarity: catItem.rarity || 'rare',
                                  category: catItem.category || 'general',
                                  consumable: catItem.consumable,
                                  consumeEffect: catItem.consumeEffect,
                                  description: catItem.description,
                                  unlocks: catItem.unlocks
                                } : {})
                              }))
                            }} style={{ padding: '6px' }} />
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label style={{ fontSize: 9 }}>Nome</label>
                            <input type="text" placeholder="Relógio de Pulso" value={newUniqueItem.name} onChange={(e) => setNewUniqueItem(prev => ({ ...prev, name: e.target.value }))} style={{ padding: '6px' }} />
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label style={{ fontSize: 9 }}>Ícone</label>
                            <input type="text" placeholder="⌚" value={newUniqueItem.icon} onChange={(e) => setNewUniqueItem(prev => ({ ...prev, icon: e.target.value }))} style={{ padding: '6px', textAlign: 'center' }} />
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label style={{ fontSize: 9 }}>Raridade</label>
                            <select value={newUniqueItem.rarity} onChange={(e) => setNewUniqueItem(prev => ({ ...prev, rarity: e.target.value }))} style={{ padding: '6px' }}>
                              {Object.values(RARITY_META).map(r => (
                                <option key={r.id} value={r.id}>{r.icon} {r.label}</option>
                              ))}
                            </select>
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label style={{ fontSize: 9 }}>Quantidade</label>
                            <input type="number" min="1" value={newUniqueItem.quantity} onChange={(e) => setNewUniqueItem(prev => ({ ...prev, quantity: Number(e.target.value) }))} style={{ padding: '6px' }} />
                          </div>
                          <button type="button" className="btn btn-sm btn-primary" onClick={addUniqueItem} style={{ padding: '8px 0', width: '100%' }}>
                            +
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* 3. BOTÕES DE NAVEGAÇÃO COM SUPORTE A CHAVE / PORTA TRANCADA */}
                <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '6px' }}>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>🗺️ Caminhos de Navegação</label>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 8px', opacity: 0.7 }}>
                    Defina para onde o jogador pode ir. Você pode adicionar um item necessário (chave) para trancar a porta.
                  </p>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '8px 0' }}>
                    {locForm.navigationButtons.map((btn, i) => (
                      <span key={i} className="glass-light" style={{ padding: '5px 10px', fontSize: 11, borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span>{btn.position === 'left' ? '⬅️' : '➡️'}</span>
                        <strong>{btn.label}</strong>
                        {btn.requiredItem && <span style={{ color: 'var(--accent-yellow)', fontSize: 10 }}>🔒 Requer: {btn.requiredItem}</span>}
                        <span style={{ color: 'var(--text-muted)' }}>→</span>
                        <span style={{ fontFamily: 'monospace', color: 'var(--accent-blue)' }}>{btn.target}</span>
                        <button type="button" onClick={() => removeNavButton(i)} style={{ background: 'transparent', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', fontSize: 14 }}>×</button>
                      </span>
                    ))}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px 100px 40px', gap: 6, alignItems: 'end', marginTop: 8 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: 10 }}>Texto do Botão</label>
                      <input type="text" placeholder="Ex: Apartamento 203" value={newNavBtn.label} onChange={(e) => setNewNavBtn(prev => ({ ...prev, label: e.target.value }))} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: 10 }}>Sala de Destino</label>
                      <select
                        value={newNavBtn.target}
                        onChange={(e) => setNewNavBtn(prev => ({ ...prev, target: e.target.value }))}
                        style={{ width: '100%' }}
                      >
                        <option value="">— Selecione uma sala —</option>
                        {locations
                          .filter(loc => loc.slug !== locForm.slug)
                          .map(loc => (
                            <option key={loc.id} value={loc.slug}>
                              {loc.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: 10 }}>Item Requerido (Opcional)</label>
                      <input type="text" placeholder="chave_apt203" value={newNavBtn.requiredItem} onChange={(e) => setNewNavBtn(prev => ({ ...prev, requiredItem: e.target.value }))} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: 10 }}>Lado</label>
                      <select value={newNavBtn.position} onChange={(e) => setNewNavBtn(prev => ({ ...prev, position: e.target.value }))}>
                        <option value="right">➡️ Direita</option>
                        <option value="left">⬅️ Esquerda</option>
                      </select>
                    </div>
                    <button type="button" className="btn btn-sm btn-primary" onClick={addNavButton} style={{ padding: '10px 0', width: '100%' }}>
                      +
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  <button type="button" className="btn" style={{ flex: 1 }} onClick={resetLocForm}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>💾 Salvar Locação</button>
                </div>
              </form>
            </div>
          )}

          {/* CONTEÚDO DA TAB 3: SOBREVIVENTES */}
          {activeTab === 'players' && (
            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20 }}>
              {/* Esquerda: lista de jogadores */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <h4 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Jogadores Cadastrados</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '420px', overflowY: 'auto' }}>
                  {players.map((p) => (
                    <div
                      key={p.uid}
                      className={`glass-light ${selectedPlayer?.uid === p.uid ? 'selected' : ''}`}
                      style={{ padding: '10px', cursor: 'pointer', display: 'flex', gap: 10, alignItems: 'center', border: selectedPlayer?.uid === p.uid ? '1px solid var(--accent)' : '1px solid transparent' }}
                      onClick={() => setSelectedPlayer(p)}
                    >
                      {p.character?.avatarUrl ? (
                        <img
                          src={p.character.avatarUrl}
                          alt="Avatar"
                          style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover', border: '1px solid var(--glass-border)', flexShrink: 0 }}
                          onError={(e) => { e.target.onerror = null; e.target.src = ''; }}
                        />
                      ) : (
                        <span style={{ fontSize: 20 }}>👤</span>
                      )}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.character?.name || 'Incompleto'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Nível {p.character?.level || 1} · {p.role}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Direita: edição */}
              {selectedPlayer ? (
                <div className="glass-light" style={{ padding: '20px', borderRadius: '12px' }}>
                  <h3 style={{ fontSize: 15, textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 16 }}>
                    Ficha de: {selectedPlayer.character.name}
                  </h3>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16, padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid var(--glass-border)' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Nome do Sobrevivente</label>
                      <input
                        type="text"
                        value={selectedPlayer.character.name || ''}
                        onChange={(e) => updatePlayerStats(selectedPlayer.uid, 'name', e.target.value)}
                        placeholder="Nome do personagem"
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Link da Foto/Avatar (URL)</label>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {selectedPlayer.character.avatarUrl ? (
                          <img
                            src={selectedPlayer.character.avatarUrl}
                            alt="Avatar"
                            style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', border: '1px solid var(--glass-border)', flexShrink: 0 }}
                            onError={(e) => { e.target.onerror = null; e.target.src = ''; }}
                          />
                        ) : (
                          <div style={{ width: 36, height: 36, borderRadius: 6, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                            👤
                          </div>
                        )}
                        <input
                          type="url"
                          value={selectedPlayer.character.avatarUrl || ''}
                          onChange={(e) => updatePlayerStats(selectedPlayer.uid, 'avatarUrl', e.target.value)}
                          placeholder="https://... foto do personagem"
                          style={{ flex: 1 }}
                        />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                    <div className="form-group">
                      <label>Nível</label>
                      <input
                        type="number"
                        value={selectedPlayer.character.level || 1}
                        onChange={(e) => updatePlayerStats(selectedPlayer.uid, 'level', Number(e.target.value))}
                      />
                    </div>
                    <div className="form-group">
                      <label>Experiência (XP)</label>
                      <input
                        type="number"
                        value={selectedPlayer.character.xp || 0}
                        onChange={(e) => updatePlayerStats(selectedPlayer.uid, 'xp', Number(e.target.value))}
                      />
                    </div>
                    <div className="form-group">
                      <label>Idade</label>
                      <input
                        type="number"
                        value={selectedPlayer.character.age || 25}
                        onChange={(e) => updatePlayerStats(selectedPlayer.uid, 'age', Number(e.target.value))}
                      />
                    </div>
                  </div>

                  {/* Edição de Vitais (Sede, Fome, Sangue) */}
                  <div style={{ padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid var(--glass-border)', marginBottom: 16 }}>
                    <label style={{ fontSize: 11, color: 'var(--accent-yellow)', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                      ❤️ Vitais de Sobrevivência (0 a 100%)
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: 10 }}>💧 Sede ({selectedPlayer.character.vitals?.thirst ?? 100}%)</label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={selectedPlayer.character.vitals?.thirst ?? 100}
                          onChange={(e) => updatePlayerVitals(selectedPlayer.uid, 'thirst', e.target.value)}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: 10 }}>🍖 Fome ({selectedPlayer.character.vitals?.hunger ?? 100}%)</label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={selectedPlayer.character.vitals?.hunger ?? 100}
                          onChange={(e) => updatePlayerVitals(selectedPlayer.uid, 'hunger', e.target.value)}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: 10 }}>🩸 Sangue/HP ({selectedPlayer.character.vitals?.blood ?? 100}%)</label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={selectedPlayer.character.vitals?.blood ?? 100}
                          onChange={(e) => updatePlayerVitals(selectedPlayer.uid, 'blood', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div style={{ marginBottom: 20 }}>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Editar Atributos</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
                      {['forca', 'destreza', 'sabedoria', 'carisma', 'constituicao'].map((attr) => (
                        <div key={attr} className="form-group" style={{ marginBottom: 0, textAlign: 'center' }}>
                          <label style={{ fontSize: 10, textTransform: 'capitalize' }}>{attr}</label>
                          <input
                            type="number"
                            value={selectedPlayer.character.attributes?.[attr] ?? 1}
                            onChange={(e) => {
                              const newAttrs = { ...selectedPlayer.character.attributes, [attr]: Number(e.target.value) }
                              updatePlayerStats(selectedPlayer.uid, 'attributes', newAttrs)
                            }}
                            style={{ textAlign: 'center' }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Inventário do Jogador</label>
                      <button
                        type="button"
                        onClick={handleConsolidateInventory}
                        style={{ fontSize: 11, background: 'rgba(255,200,0,0.15)', border: '1px solid rgba(255,200,0,0.3)', color: '#ffc800', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}
                      >
                        ⚡ Consolidar Duplicatas
                      </button>
                    </div>

                    {/* === PICKER DO CATÁLOGO === */}
                    <div style={{ marginBottom: 14 }}>
                      <button
                        type="button"
                        onClick={() => setPickerOpen(v => !v)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: pickerOpen ? '#f59e0b' : 'var(--text-secondary)', background: pickerOpen ? 'rgba(245,158,11,0.10)' : 'rgba(255,255,255,0.04)', border: `1px solid ${pickerOpen ? 'rgba(245,158,11,0.4)' : 'var(--glass-border)'}`, borderRadius: 8, padding: '7px 12px', cursor: 'pointer', width: '100%', justifyContent: 'space-between', transition: 'all 0.2s' }}
                      >
                        <span>🗃️ {pickerOpen ? 'Fechar buscador do catálogo' : 'Selecionar item do catálogo para dar ao jogador'}</span>
                        <span style={{ fontSize: 14, opacity: 0.7 }}>{pickerOpen ? '▲' : '▼'}</span>
                      </button>

                      {pickerOpen && (
                        <div style={{ marginTop: 8, padding: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10 }}>
                          {/* Busca e filtro de categoria */}
                          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                            <input
                              type="text"
                              placeholder="🔍 Buscar por nome ou ID..."
                              value={pickerSearch}
                              onChange={e => setPickerSearch(e.target.value)}
                              style={{ flex: 1, padding: '6px 10px', fontSize: 12 }}
                            />
                            <select
                              value={pickerCategory}
                              onChange={e => setPickerCategory(e.target.value)}
                              style={{ padding: '6px 8px', fontSize: 12, minWidth: 130 }}
                            >
                              <option value="all">📦 Todas</option>
                              <option value="general">🎒 Gerais</option>
                              <option value="supplies">🌾 Mantimentos</option>
                              <option value="clothing">👕 Roupas</option>
                              <option value="melee">🗡️ Armas Brancas</option>
                              <option value="firearms">🔫 Armas de Fogo</option>
                              <option value="medical">💉 Médicos</option>
                            </select>
                          </div>

                          {/* Grade de itens filtrados */}
                          {catalogItems.length === 0 ? (
                            <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
                              Catálogo vazio. Cadastre itens na aba "🗃️ Catálogo de Itens" primeiro.
                            </p>
                          ) : (() => {
                            const q = pickerSearch.toLowerCase().trim()
                            const filtered = catalogItems.filter(item => {
                              const matchCat = pickerCategory === 'all' || item.category === pickerCategory
                              const matchQ = !q || item.name.toLowerCase().includes(q) || (item.itemId || '').toLowerCase().includes(q)
                              return matchCat && matchQ
                            })
                            if (filtered.length === 0) return (
                              <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
                                Nenhum item encontrado.
                              </p>
                            )
                            return (
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
                                {filtered.map(item => {
                                  const rMeta = RARITY_META[item.rarity] || RARITY_META.common
                                  const isSelected = newItem.itemId === item.itemId
                                  return (
                                    <button
                                      key={item.id}
                                      type="button"
                                      onClick={() => setNewItem({
                                        itemId: item.itemId,
                                        name: item.name,
                                        icon: item.icon || '📦',
                                        rarity: item.rarity || 'common',
                                        quantity: 1,
                                        category: item.category || 'general',
                                        unlocks: item.unlocks || [],
                                        consumable: !!item.consumable,
                                        consumeEffect: item.consumeEffect || null,
                                        isQuestItem: !!item.isQuestItem,
                                        description: item.description || ''
                                      })}
                                      title={item.description || item.name}
                                      style={{
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                                        padding: '10px 6px', borderRadius: 8, cursor: 'pointer', textAlign: 'center',
                                        border: isSelected ? `2px solid ${rMeta.color}` : '1px solid rgba(255,255,255,0.07)',
                                        background: isSelected ? `rgba(${rMeta.color.replace('#','').match(/.{2}/g).map(h=>parseInt(h,16)).join(',')}, 0.12)` : 'rgba(255,255,255,0.02)',
                                        boxShadow: isSelected ? `0 0 12px ${rMeta.color}40` : 'none',
                                        transition: 'all 0.15s'
                                      }}
                                    >
                                      <span style={{ fontSize: 22 }}>{item.icon}</span>
                                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3, wordBreak: 'break-word' }}>{item.name}</span>
                                      <span style={{ fontSize: 10, fontWeight: 700, color: rMeta.color }}>{rMeta.icon} {rMeta.label}</span>
                                      {isSelected && <span style={{ fontSize: 9, color: '#f59e0b', marginTop: 2 }}>✓ Selecionado</span>}
                                    </button>
                                  )
                                })}
                              </div>
                            )
                          })()}
                        </div>
                      )}
                    </div>

                    {/* Formulário manual (preenchido pelo picker ou digitado) */}
                    <form onSubmit={handleAddInventoryItem} style={{ display: 'grid', gridTemplateColumns: '50px 1fr 1fr 100px 70px 90px', gap: 6, marginBottom: 16, alignItems: 'end' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: 10 }}>Ícone</label>
                        <input type="text" placeholder="🔪" value={newItem.icon} onChange={(e) => setNewItem(prev => ({ ...prev, icon: e.target.value }))} required />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: 10 }}>Nome do Item</label>
                        <input type="text" placeholder="Faca Tática" value={newItem.name} onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))} required />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: 10 }}>ID (Loot ID)</label>
                        <input type="text" placeholder="faca_tatica" value={newItem.itemId} onChange={(e) => setNewItem(prev => ({ ...prev, itemId: e.target.value }))} required />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: 10 }}>Raridade</label>
                        <select value={newItem.rarity} onChange={(e) => setNewItem(prev => ({ ...prev, rarity: e.target.value }))}>
                          {Object.values(RARITY_META).map(r => (
                            <option key={r.id} value={r.id}>{r.icon} {r.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: 10 }}>Qtd</label>
                        <input type="number" min="1" value={newItem.quantity} onChange={(e) => setNewItem(prev => ({ ...prev, quantity: Number(e.target.value) }))} required />
                      </div>
                      <button type="submit" className="btn btn-sm btn-primary" style={{ padding: '10px 0', width: '100%' }}>
                        + Dar Item
                      </button>
                    </form>


                    {!selectedPlayer.character.inventory || selectedPlayer.character.inventory.length === 0 ? (
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '16px' }}>Inventário vazio.</p>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
                        {selectedPlayer.character.inventory.map((item) => (
                          <div key={item.instanceId} className="glass-light" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                              <span style={{ fontSize: 18 }}>{item.icon}</span>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Qtd: {item.quantity}</div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveInventoryItem(item.instanceId)}
                              style={{ background: 'transparent', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', fontSize: 14 }}
                            >
                              🗑️
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', border: '1px dashed var(--glass-border)', borderRadius: '12px' }}>
                  Selecione um sobrevivente para editar
                </div>
              )}
            </div>
          )}

          {/* ========================================== */}
          {/* CONTEÚDO DA TAB 5: COMBATE & ENCONTROS TÁTICOS */}
          {/* ========================================== */}
          {activeTab === 'combat' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Barra superior de controle do encontro */}
              <div className="glass-light" style={{ padding: '16px 20px', borderRadius: 12, border: '1px solid rgba(239,68,68,0.3)', background: 'linear-gradient(180deg, rgba(239,68,68,0.06) 0%, rgba(0,0,0,0.3) 100%)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16, color: '#f87171', display: 'flex', alignItems: 'center', gap: 8 }}>
                      ⚔️ Gerenciador de Encontro de Combate
                      {activeCombatData?.active && (
                        <span style={{ fontSize: 10, background: '#ef4444', color: '#fff', padding: '2px 8px', borderRadius: 12, fontWeight: 'bold', animation: 'pulseGlow 1.8s infinite' }}>
                          AO VIVO
                        </span>
                      )}
                    </h3>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                      Selecione a sala, escolha os jogadores da cena e gerencie os monstros em tempo real.
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    {activeCombatData?.active ? (
                      <>
                        <button type="button" className="btn btn-sm btn-primary" onClick={handleStartOrUpdateCombat} style={{ background: '#2563eb' }}>
                          🔄 Atualizar Cena
                        </button>
                        <button type="button" className="btn btn-sm btn-danger" onClick={handleEndCombat}>
                          ⏹️ Encerrar Combate
                        </button>
                      </>
                    ) : (
                      <button type="button" className="btn btn-sm btn-danger" onClick={handleStartOrUpdateCombat} style={{ fontWeight: 700, padding: '8px 16px' }}>
                        ▶️ Iniciar Combate na Sala
                      </button>
                    )}
                  </div>
                </div>

                {/* Seletores de Locação e Título do Encontro */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 14, marginTop: 16 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Locação / Sala do Combate</label>
                    <select
                      value={selectedCombatSlug}
                      onChange={e => setSelectedCombatSlug(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', fontSize: 13 }}
                    >
                      {combatLocations.map(loc => (
                        <option key={loc.id} value={loc.slug || loc.id}>
                          {loc.name} ({loc.slug || loc.id})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Título / Descrição Curta da Cena</label>
                    <input
                      type="text"
                      placeholder="Ex: Emboscada nos Corredores do 2º Andar"
                      value={combatTitle}
                      onChange={e => setCombatTitle(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', fontSize: 13 }}
                    />
                  </div>
                </div>
              </div>

              {/* GRID PRINCIPAL: LADO ESQUERDO (JOGADORES SELECIONÁVEIS) | LADO DIREITO (INIMIGOS / PRESETS) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* 1. SELEÇÃO E CONTROLE DOS SOBREVIVENTES */}
                <div className="glass-light" style={{ padding: '16px', borderRadius: 12, border: '1px solid rgba(56,189,248,0.25)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h4 style={{ margin: 0, fontSize: 13, textTransform: 'uppercase', color: '#38bdf8' }}>
                      🛡️ Sobreviventes na Cena ({selectedCombatPlayers.length})
                    </h4>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Marque quem participará</span>
                  </div>

                  {/* Lista de Checkboxes de Jogadores */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto', paddingRight: 4 }}>
                    {players.map(p => {
                      const isSelected = selectedCombatPlayers.includes(p.uid)
                      const maxHp = getMaxHp(p.character)
                      const currentHp = p.character?.vitals?.blood ?? maxHp
                      return (
                        <label
                          key={p.uid}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '8px 10px',
                            borderRadius: 8,
                            background: isSelected ? 'rgba(56,189,248,0.12)' : 'rgba(255,255,255,0.02)',
                            border: `1px solid ${isSelected ? 'rgba(56,189,248,0.4)' : 'var(--glass-border)'}`,
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCombatPlayers(prev => [...prev, p.uid])
                              } else {
                                setSelectedCombatPlayers(prev => prev.filter(id => id !== p.uid))
                              }
                            }}
                            style={{ width: 'auto' }}
                          />
                          <span style={{ fontSize: 18 }}>{p.character?.avatarUrl ? '👤' : '🧟'}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <strong style={{ fontSize: 12, color: 'var(--text-primary)' }}>{p.character?.name || 'Incompleto'}</strong>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                              Nv {p.character?.level || 1} · CON: {p.character?.attributes?.constituicao ?? 1}
                            </div>
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: currentHp <= 20 ? '#ef4444' : '#22c55e' }}>
                            {currentHp}/{maxHp} HP
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>

                {/* 2. ADICIONAR INIMIGOS / NPCS */}
                <div className="glass-light" style={{ padding: '16px', borderRadius: 12, border: '1px solid rgba(239,68,68,0.25)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h4 style={{ margin: 0, fontSize: 13, textTransform: 'uppercase', color: '#f87171' }}>
                      👹 Inimigos no Combate ({combatEnemies.length})
                    </h4>
                  </div>

                  {/* Templates Rápidos de Inimigos */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                      ⚡ Adicionar Template Rápido:
                    </label>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {MONSTER_TEMPLATES.map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handleAddMonsterTemplate(m.id)}
                          style={{
                            padding: '4px 8px',
                            fontSize: 11,
                            fontWeight: 600,
                            background: m.isBoss ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.04)',
                            border: `1px solid ${m.isBoss ? '#f59e0b' : 'var(--glass-border)'}`,
                            color: m.isBoss ? '#fbbf24' : 'var(--text-primary)',
                            borderRadius: 6,
                            cursor: 'pointer'
                          }}
                        >
                          {m.icon} +{m.name} ({m.maxHp} HP)
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Lista de Inimigos Vivos no Combate */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 160, overflowY: 'auto', marginBottom: 14 }}>
                    {combatEnemies.length === 0 ? (
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '12px' }}>
                        Nenhum inimigo adicionado ainda.
                      </p>
                    ) : (
                      combatEnemies.map(enemy => {
                        const currentHp = enemy.currentHp ?? enemy.maxHp
                        return (
                          <div
                            key={enemy.id}
                            style={{
                              background: 'rgba(0,0,0,0.3)',
                              padding: '8px 10px',
                              borderRadius: 8,
                              border: `1px solid ${enemy.isBoss ? '#f59e0b' : 'rgba(239,68,68,0.3)'}`,
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 16 }}>{enemy.icon}</span>
                              <strong style={{ fontSize: 12, color: enemy.isBoss ? '#fbbf24' : '#f87171' }}>
                                {enemy.name}
                              </strong>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: '#ef4444' }}>
                                {currentHp} / {enemy.maxHp} HP
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveEnemy(enemy.id)}
                                style={{ background: 'transparent', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', fontSize: 14 }}
                                title="Remover da cena"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>

                  {/* Form de Inimigo Customizado */}
                  <form onSubmit={handleAddCustomEnemy} style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10 }}>
                    <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                      ➕ Criar Inimigo / NPC Customizado
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 50px 70px', gap: 6, marginBottom: 6 }}>
                      <input
                        type="text"
                        placeholder="Nome do Inimigo"
                        value={customEnemyForm.name}
                        onChange={e => setCustomEnemyForm(prev => ({ ...prev, name: e.target.value }))}
                        style={{ padding: '6px', fontSize: 11 }}
                      />
                      <input
                        type="text"
                        placeholder="🧟"
                        value={customEnemyForm.icon}
                        onChange={e => setCustomEnemyForm(prev => ({ ...prev, icon: e.target.value }))}
                        style={{ padding: '6px', fontSize: 11, textAlign: 'center' }}
                      />
                      <input
                        type="number"
                        placeholder="HP Max"
                        value={customEnemyForm.maxHp}
                        onChange={e => setCustomEnemyForm(prev => ({ ...prev, maxHp: e.target.value }))}
                        style={{ padding: '6px', fontSize: 11 }}
                      />
                    </div>
                    <button type="submit" className="btn btn-sm btn-primary" style={{ width: '100%', fontSize: 11 }}>
                      + Adicionar Inimigo
                    </button>
                  </form>
                </div>
              </div>

              {/* Botão de Atalho para a Mesa de Combate Oficial */}
              {activeCombatData?.active && (
                <div style={{ textAlign: 'center', padding: '14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10 }}>
                  <a href="/combat" target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ display: 'inline-flex', padding: '8px 20px', textDecoration: 'none', fontSize: 13 }}>
                    ⚔️ Abrir Mesa de Combate Tático Oficial (Editar e Narrar ao Vivo) ↗
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


