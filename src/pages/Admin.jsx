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

const WEATHER_OPTIONS = [
  { value: 'sunny',  label: 'Ensolarado', icon: '☀️' },
  { value: 'cloudy', label: 'Nublado',    icon: '☁️' },
  { value: 'rainy',  label: 'Chovendo',   icon: '🌧️' },
  { value: 'foggy',  label: 'Neblina',    icon: '🌫️' },
  { value: 'storm',  label: 'Tempestade', icon: '⛈️' },
  { value: 'snowy',  label: 'Nevando',    icon: '❄️' },
]

export default function Admin() {
  const [activeTab, setActiveTab] = useState('config') // config | calendar | locations | players

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
    emptyChance: 0.3,
    navigationButtons: [],
    lootTable: [
      { itemId: 'atadura',     name: 'Atadura',     icon: '🩹', chance: 0.65, min: 1, max: 3 },
      { itemId: 'analgesico',  name: 'Analgésico',  icon: '💊', chance: 0.45, min: 1, max: 2 },
      { itemId: 'seringa',     name: 'Seringa',     icon: '💉', chance: 0.25, min: 1, max: 1 },
      { itemId: 'antibiotico', name: 'Antibiótico', icon: '🧪', chance: 0.15, min: 1, max: 1 },
    ]
  })

  const [newNavBtn, setNewNavBtn] = useState({ label: '', target: '', position: 'right' })
  const [newLootItem, setNewLootItem] = useState({ itemId: '', name: '', icon: '📦', chance: 0.5, min: 1, max: 1 })

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
      emptyChance: loc.loot?.emptyChance || 0.3,
      navigationButtons: loc.navigationButtons || [],
      lootTable: loc.loot?.table || []
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
      emptyChance: 0.3,
      navigationButtons: [],
      lootTable: [
        { itemId: 'atadura',     name: 'Atadura',     icon: '🩹', chance: 0.65, min: 1, max: 3 },
        { itemId: 'analgesico',  name: 'Analgésico',  icon: '💊', chance: 0.45, min: 1, max: 2 },
        { itemId: 'seringa',     name: 'Seringa',     icon: '💉', chance: 0.25, min: 1, max: 1 },
        { itemId: 'antibiotico', name: 'Antibiótico', icon: '🧪', chance: 0.15, min: 1, max: 1 },
      ]
    })
    setNewLootItem({ itemId: '', name: '', icon: '📦', chance: 0.5, min: 1, max: 1 })
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
    setNewNavBtn({ label: '', target: '', position: 'right' })
  }

  function removeNavButton(idx) {
    setLocForm(prev => ({
      ...prev,
      navigationButtons: prev.navigationButtons.filter((_, i) => i !== idx)
    }))
  }

  function addLootItem() {
    if (!newLootItem.itemId || !newLootItem.name) return alert('Preencha o ID e o Nome do Item de Loot')
    setLocForm(prev => ({
      ...prev,
      lootTable: [...prev.lootTable, {
        itemId: newLootItem.itemId.trim().toLowerCase(),
        name: newLootItem.name.trim(),
        icon: newLootItem.icon.trim(),
        chance: Number(newLootItem.chance),
        min: Number(newLootItem.min),
        max: Number(newLootItem.max)
      }]
    }))
    setNewLootItem({ itemId: '', name: '', icon: '📦', chance: 0.5, min: 1, max: 2 })
  }

  function removeLootItem(idx) {
    setLocForm(prev => ({
      ...prev,
      lootTable: prev.lootTable.filter((_, i) => i !== idx)
    }))
  }

  // ==========================================
  // TAB 3: SOBREVIVENTES (GERENCIAR JOGADORES)
  // ==========================================
  const [players, setPlayers] = useState([])
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [newItem, setNewItem] = useState({ itemId: 'faca', name: 'Faca', icon: '🔪', quantity: 1 })

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

  async function handleAddInventoryItem(e) {
    e.preventDefault()
    if (!selectedPlayer || !newItem.name) return

    const playerRef = doc(db, 'users', selectedPlayer.uid)
    const currentInventory = [...(selectedPlayer.character?.inventory || [])]

    const idx = currentInventory.findIndex(i => i.itemId === newItem.itemId)
    if (idx !== -1) {
      currentInventory[idx].quantity += Number(newItem.quantity)
    } else {
      currentInventory.push({
        instanceId: Math.random().toString(36).substring(2),
        itemId: newItem.itemId,
        name: newItem.name,
        icon: newItem.icon,
        quantity: Number(newItem.quantity),
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
      setNewItem({ itemId: 'faca', name: 'Faca', icon: '🔪', quantity: 1 })
      alert('Item adicionado ao inventário!')
    } catch (err) {
      alert('Erro ao atualizar inventário: ' + err.message)
    }
  }

  async function handleRemoveInventoryItem(instanceId) {
    if (!selectedPlayer) return
    const playerRef = doc(db, 'users', selectedPlayer.uid)
    const currentInventory = selectedPlayer.character.inventory.filter(i => i.instanceId !== instanceId)

    try {
      await updateDoc(playerRef, {
        'character.inventory': currentInventory
      })
      setSelectedPlayer(prev => ({
        ...prev,
        character: { ...prev.character, inventory: currentInventory }
      }))
    } catch (err) {
      alert('Erro: ' + err.message)
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
            <button className={`btn btn-sm ${activeTab === 'calendar' ? 'btn-primary' : ''}`} onClick={() => setActiveTab('calendar')}>
              📅 Eventos do Calendário
            </button>
            <button className={`btn btn-sm ${activeTab === 'locations' ? 'btn-primary' : ''}`} onClick={() => setActiveTab('locations')}>
              🗺️ Locações (CRUD)
            </button>
            <button className={`btn btn-sm ${activeTab === 'players' ? 'btn-primary' : ''}`} onClick={() => setActiveTab('players')}>
              👥 Sobreviventes
            </button>
          </div>

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
                <label>Título da Sala / Jogo</label>
                <input type="text" value={tempTitle} onChange={(e) => setTempTitle(e.target.value)} required />
              </div>

              {/* SEÇÃO 1: SISTEMA DE TEMPO */}
              <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '10px' }}>
                <h4 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 12 }}>
                  ⏳ Mecânica de Horário e Ciclo (12h Reais = 24h In-Game)
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                  <div className="form-group">
                    <label>Modo de Passagem do Tempo</label>
                    <select
                      value={tempTime.mode}
                      onChange={(e) => setTempTime(prev => ({ ...prev, mode: e.target.value }))}
                    >
                      <option value="dynamic">⚡ Dinâmico / Automático (12h real = 24h no jogo)</option>
                      <option value="manual">🔒 Manual / Fixo (Travado pelo Mestre)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Região do Cenário</label>
                    <select
                      value={tempWeather.region || 'Leste Europeu'}
                      onChange={(e) => setTempWeather(prev => ({ ...prev, region: e.target.value }))}
                    >
                      <option value="Leste Europeu">🌲 Leste Europeu (Clima Temperado/Continental)</option>
                    </select>
                  </div>
                </div>

                {tempTime.mode === 'dynamic' ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 10 }}>
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
                    <label style={{ fontSize: 10 }}>Tipo / Categoria</label>
                    <select
                      value={newEvent.type}
                      onChange={(e) => {
                        const val = e.target.value
                        let color = '#ef4444'
                        if (val === 'supply') color = '#22c55e'
                        if (val === 'blackout') color = '#f59e0b'
                        if (val === 'boss') color = '#a855f7'
                        if (val === 'roleplay') color = '#3b82f6'
                        setNewEvent(prev => ({ ...prev, type: val, color }))
                      }}
                    >
                      <option value="horde">🧟 Horda / Ataque</option>
                      <option value="supply">📦 Queda de Suprimentos</option>
                      <option value="blackout">⚡ Apagão / Tempestade</option>
                      <option value="boss">💀 Aberração / Boss</option>
                      <option value="roleplay">🎭 Evento de Roleplay</option>
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
                      <option value="Extremo (Letal)">🔴 Extremo (Letal)</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Descrição Narrativa / Instruções</label>
                  <textarea
                    rows="3"
                    placeholder="Detalhes que os jogadores verão ao passar o mouse sobre a data no calendário..."
                    value={newEvent.description}
                    onChange={(e) => setNewEvent(prev => ({ ...prev, description: e.target.value }))}
                    style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: 'inherit', fontFamily: 'inherit' }}
                  />
                </div>

                <button type="submit" className="btn btn-primary" style={{ marginTop: 4 }}>
                  ➕ Salvar Evento no Calendário
                </button>
              </form>

              {/* Lista de Eventos Cadastrados */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <h4 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  Eventos Agendados ({calendarEvents.length})
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '480px', overflowY: 'auto' }}>
                  {calendarEvents.length === 0 ? (
                    <div className="glass-light" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                      Nenhum evento agendado. Adicione eventos para que os jogadores visualizem no calendário arrastável.
                    </div>
                  ) : (
                    calendarEvents.map((ev) => (
                      <div key={ev.id} className="glass-light" style={{ padding: '12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderLeft: `3px solid ${ev.color || 'var(--accent)'}` }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <strong style={{ fontSize: 13 }}>{ev.title}</strong>
                            <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.08)' }}>
                              📅 {ev.day} de {MONTHS[(ev.month || 1) - 1]?.name}, {ev.year}
                            </span>
                            {ev.dangerLevel && (
                              <span style={{ fontSize: 10, color: 'var(--accent-yellow)' }}>
                                ⚠️ {ev.dangerLevel}
                              </span>
                            )}
                          </div>
                          {ev.description && (
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                              {ev.description}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          style={{ padding: '2px 6px', fontSize: 11 }}
                          onClick={() => handleDeleteEvent(ev.id)}
                        >
                          🗑️
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* CONTEÚDO DA TAB 2: LOCAÇÕES */}
          {activeTab === 'locations' && (
            <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, alignItems: 'start' }}>
              {/* Esquerda: lista e deleção */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <h4 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>Locações Existentes</h4>
                <button className="btn btn-sm btn-primary" onClick={resetLocForm} style={{ marginBottom: 8 }}>
                  + Criar Nova Locação
                </button>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '400px', overflowY: 'auto' }}>
                  {locations.map((loc) => (
                    <div key={loc.id} className="glass-light" style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <strong style={{ fontSize: 13, cursor: 'pointer', color: editingLoc === loc.id ? 'var(--accent)' : 'inherit' }} onClick={() => handleLocEdit(loc)}>{loc.name}</strong>
                          <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: loc.isIndoor ? 'rgba(255,255,255,0.06)' : 'rgba(92,255,122,0.1)', color: loc.isIndoor ? 'var(--text-muted)' : 'var(--accent)' }}>
                            {loc.isIndoor ? '🏠 Interior' : '🌳 Aberto'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-sm" style={{ padding: '2px 6px', fontSize: 10 }} onClick={() => handleLocEdit(loc)}>
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
                          <button className="btn btn-sm btn-danger" style={{ padding: '2px 6px', fontSize: 10 }} onClick={() => handleLocDelete(loc.id)}>
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
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                      {editingLoc ? '⚠️ O ID não pode ser alterado após criar a sala.' : `🔗 URL: /location/${locForm.slug || '...'}`}
                    </div>
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

                <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '6px', marginBottom: 16 }}>
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

                {/* Loot Config */}
                <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '6px', marginTop: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <input type="checkbox" id="lootEn" checked={locForm.lootEnabled} onChange={(e) => setLocForm(prev => ({ ...prev, lootEnabled: e.target.checked }))} style={{ width: 'auto' }} />
                    <label htmlFor="lootEn" style={{ margin: 0, cursor: 'pointer' }}>Habilitar Busca de Recursos (Loot)</label>
                  </div>
                  {locForm.lootEnabled && (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label>Tempo de Cooldown (Minutos)</label>
                          <input type="number" value={locForm.cooldownMinutes} onChange={(e) => setLocForm(prev => ({ ...prev, cooldownMinutes: e.target.value }))} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label>Chance de vir vazio (0 a 1)</label>
                          <input type="number" step="0.1" min="0" max="1" value={locForm.emptyChance} onChange={(e) => setLocForm(prev => ({ ...prev, emptyChance: e.target.value }))} />
                        </div>
                      </div>

                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12, marginTop: 12 }}>
                        <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>📦 Tabela de Recursos (Itens)</label>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '8px 0' }}>
                          {locForm.lootTable.length === 0 && (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>Nenhum item configurado. A busca virá sempre vazia.</span>
                          )}
                          {locForm.lootTable.map((item, idx) => (
                            <div key={idx} className="glass-light" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderRadius: 6, fontSize: 11 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 16 }}>{item.icon}</span>
                                <strong>{item.name}</strong>
                                <span style={{ color: 'var(--text-muted)' }}>({item.itemId})</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <span>Chance: <strong>{(item.chance * 100).toFixed(0)}%</strong></span>
                                <span>Qtd: <strong>{item.min}-{item.max}</strong></span>
                                <button type="button" onClick={() => removeLootItem(idx)} style={{ background: 'transparent', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>×</button>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '80px 120px 45px 1fr 1fr 1fr 40px', gap: 6, alignItems: 'end', marginTop: 8 }}>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label style={{ fontSize: 9 }}>ID Item</label>
                            <input type="text" placeholder="Ex: faca" value={newLootItem.itemId} onChange={(e) => setNewLootItem(prev => ({ ...prev, itemId: e.target.value }))} style={{ padding: '8px' }} />
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label style={{ fontSize: 9 }}>Nome</label>
                            <input type="text" placeholder="Ex: Faca Amolada" value={newLootItem.name} onChange={(e) => setNewLootItem(prev => ({ ...prev, name: e.target.value }))} style={{ padding: '8px' }} />
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label style={{ fontSize: 9 }}>Ícone</label>
                            <input type="text" placeholder="Ex: 🔪" value={newLootItem.icon} onChange={(e) => setNewLootItem(prev => ({ ...prev, icon: e.target.value }))} style={{ padding: '8px', textAlign: 'center' }} />
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label style={{ fontSize: 9 }}>Chance (0-1)</label>
                            <input type="number" step="0.05" min="0" max="1" placeholder="Chance" value={newLootItem.chance} onChange={(e) => setNewLootItem(prev => ({ ...prev, chance: e.target.value }))} style={{ padding: '8px' }} />
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label style={{ fontSize: 9 }}>Min</label>
                            <input type="number" min="1" value={newLootItem.min} onChange={(e) => setNewLootItem(prev => ({ ...prev, min: e.target.value }))} style={{ padding: '8px' }} />
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label style={{ fontSize: 9 }}>Max</label>
                            <input type="number" min="1" value={newLootItem.max} onChange={(e) => setNewLootItem(prev => ({ ...prev, max: e.target.value }))} style={{ padding: '8px' }} />
                          </div>
                          <button type="button" className="btn btn-sm btn-primary" onClick={addLootItem} style={{ padding: '10px 0', width: '100%', borderRadius: 6 }}>
                            +
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Botões de navegação */}
                <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '6px', marginTop: 8 }}>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>🗺️ Caminhos de Navegação</label>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 8px', opacity: 0.7 }}>
                    Defina para onde o jogador pode ir a partir desta sala.
                  </p>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '8px 0' }}>
                    {locForm.navigationButtons.length === 0 && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>Nenhum caminho adicionado ainda.</span>
                    )}
                    {locForm.navigationButtons.map((btn, i) => (
                      <span key={i} className="glass-light" style={{ padding: '5px 10px', fontSize: 11, borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span>{btn.position === 'left' ? '⬅️' : '➡️'}</span>
                        <strong>{btn.label}</strong>
                        <span style={{ color: 'var(--text-muted)' }}>→</span>
                        <span style={{ fontFamily: 'monospace', color: 'var(--accent-blue)' }}>{btn.target}</span>
                        <button type="button" onClick={() => removeNavButton(i)} style={{ background: 'transparent', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>×</button>
                      </span>
                    ))}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px 60px', gap: 6, alignItems: 'end', marginTop: 8 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: 10 }}>Texto do Botão</label>
                      <input type="text" placeholder="Ex: Ir para a UTI" value={newNavBtn.label} onChange={(e) => setNewNavBtn(prev => ({ ...prev, label: e.target.value }))} />
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
                      <label style={{ fontSize: 10 }}>Lado da Tela</label>
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
                      <span style={{ fontSize: 20 }}>{p.character?.avatarUrl ? '👤' : '🧟'}</span>
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
                    <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 12 }}>Inventário do Jogador</label>

                    <form onSubmit={handleAddInventoryItem} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 1fr 80px 100px', gap: 6, marginBottom: 16, alignItems: 'end' }}>
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
        </div>
      </div>
    </div>
  )
}
