import { useState, useEffect, useRef } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { VAREZHIA, MARKER_TYPES, DANGER_COLORS } from '../utils/varezhiaData'
import { uploadImageFree } from '../utils/imageUpload'

/**
 * AdminMapEditor — Editor visual de mapa em 3 níveis hierárquicos:
 *  Nível 1: Mapa Nacional (País de Varezhia)
 *  Nível 2: Mapa da Cidade/Estado (ex: Novigrad)
 *  Nível 3: Mapa do Distrito (ex: Stari Grad)
 */
export default function AdminMapEditor({ availableLocations = [] }) {
  const [mapConfig, setMapConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Nível de edição: 'country' | cityId | `${cityId}:${districtId}`
  const [activeLevel, setActiveLevel] = useState('country')

  // Modal de Pin
  const [modalOpen, setModalOpen] = useState(false)
  const [editingPin, setEditingPin] = useState(null)
  const [pinForm, setPinForm] = useState({
    id: '', name: '', type: MARKER_TYPES.CITY, dangerLevel: 3,
    description: '', locationSlug: '', cityId: '', districtId: '',
    hasCityMap: true, mapImage: '', x: 50, y: 50,
  })

  // Modal de Novo Distrito
  const [districtModalOpen, setDistrictModalOpen] = useState(false)
  const [newDistrictForm, setNewDistrictForm] = useState({ id: '', name: '', mapImage: '' })

  const [uploadingImage, setUploadingImage] = useState(false)
  const imageContainerRef = useRef(null)

  // ── Helpers para decompor o nível ──────────────────────────────────────────
  const isCountry   = activeLevel === 'country'
  const isDistrict  = activeLevel.includes(':')
  const isCity      = !isCountry && !isDistrict

  const activeCityId     = isCountry ? null : isDistrict ? activeLevel.split(':')[0] : activeLevel
  const activeDistrictId = isDistrict ? activeLevel.split(':')[1] : null

  // ── Carrega dados do Firestore ──────────────────────────────────────────────
  useEffect(() => {
    async function loadConfig() {
      try {
        const snap = await getDoc(doc(db, 'map_config', 'global'))
        if (snap.exists()) {
          setMapConfig(snap.data())
        } else {
          // Inicializa com dados padrão
          const defaultCities = {}
          Object.keys(VAREZHIA.cityPins).forEach(cityId => {
            const canonical = VAREZHIA.countryPins.find(p => p.id === cityId)
            defaultCities[cityId] = {
              name: canonical?.name || cityId,
              mapImage: canonical?.mapImage || '',
              pins: VAREZHIA.cityPins[cityId] || [],
              districts: {},
            }
          })
          setMapConfig({
            countryMapImage: VAREZHIA.mapImage,
            countryPins: VAREZHIA.countryPins,
            cities: defaultCities,
          })
        }
      } catch (err) {
        console.error('Erro ao carregar mapa:', err)
      } finally {
        setLoading(false)
      }
    }
    loadConfig()
  }, [])

  // ── Imagem e Pins do nível atual ────────────────────────────────────────────
  const currentImage = (() => {
    if (isCountry) return mapConfig?.countryMapImage || VAREZHIA.mapImage
    if (isCity)    return mapConfig?.cities?.[activeCityId]?.mapImage || VAREZHIA.mapImage
    // distrito
    const dConf = mapConfig?.cities?.[activeCityId]?.districts?.[activeDistrictId]
    return dConf?.mapImage || VAREZHIA.cityDistricts?.[activeCityId]?.[activeDistrictId]?.mapImage || VAREZHIA.mapImage
  })()

  const currentPins = (() => {
    if (isCountry) return mapConfig?.countryPins || VAREZHIA.countryPins
    if (isCity)    return mapConfig?.cities?.[activeCityId]?.pins || VAREZHIA.cityPins?.[activeCityId] || []
    const dConf = mapConfig?.cities?.[activeCityId]?.districts?.[activeDistrictId]
    return dConf?.pins || VAREZHIA.cityDistricts?.[activeCityId]?.[activeDistrictId]?.pins || []
  })()

  // Distritos da cidade ativa (para dropdown de vinculação e lista)
  const activeDistricts = (() => {
    if (!activeCityId) return {}
    return mapConfig?.cities?.[activeCityId]?.districts || VAREZHIA.cityDistricts?.[activeCityId] || {}
  })()

  // ── Salva no Firestore ──────────────────────────────────────────────────────
  async function handleSaveGlobal(newConfig) {
    setSaving(true)
    try {
      await setDoc(doc(db, 'map_config', 'global'), newConfig)
      setMapConfig(newConfig)
      alert('✅ Mapa salvo com sucesso!')
    } catch (err) {
      alert('Erro ao salvar mapa: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // ── Helpers para montar config atualizada ────────────────────────────────────
  function buildUpdatedConfig({ newCountryPins, newCityPins, newCityImage, newDistrictPins, newDistrictImage }) {
    const base = { ...(mapConfig || {}) }

    if (isCountry) {
      if (newCountryPins !== undefined) base.countryPins = newCountryPins
      if (newCityImage   !== undefined) base.countryMapImage = newCityImage
      return base
    }

    const existingCity = base.cities?.[activeCityId] || {}
    let updatedCity = { ...existingCity }

    if (isCity) {
      if (newCityPins  !== undefined) updatedCity.pins = newCityPins
      if (newCityImage !== undefined) updatedCity.mapImage = newCityImage
    } else {
      // distrito
      const existingDistrict = updatedCity.districts?.[activeDistrictId] || {}
      let updatedDistrict = { ...existingDistrict }
      if (newDistrictPins  !== undefined) updatedDistrict.pins = newDistrictPins
      if (newDistrictImage !== undefined) updatedDistrict.mapImage = newDistrictImage
      updatedCity = {
        ...updatedCity,
        districts: { ...(updatedCity.districts || {}), [activeDistrictId]: updatedDistrict },
      }
    }

    return { ...base, cities: { ...(base.cities || {}), [activeCityId]: updatedCity } }
  }

  // ── Upload de Imagem ────────────────────────────────────────────────────────
  async function handleImageUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingImage(true)
    try {
      const url = await uploadImageFree(file)
      if (isCountry) {
        handleSaveGlobal(buildUpdatedConfig({ newCityImage: url }))
      } else if (isCity) {
        handleSaveGlobal(buildUpdatedConfig({ newCityImage: url }))
      } else {
        handleSaveGlobal(buildUpdatedConfig({ newDistrictImage: url }))
      }
    } catch (err) {
      alert('Erro no upload: ' + err.message)
    } finally {
      setUploadingImage(false)
    }
  }

  // ── Clique na imagem para posicionar pin ─────────────────────────────────────
  function handleMapClick(e) {
    if (!imageContainerRef.current) return
    const rect = imageContainerRef.current.getBoundingClientRect()
    const xPct = Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10
    const yPct = Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10

    const defaultType = isCountry ? MARKER_TYPES.CITY
                       : isCity   ? MARKER_TYPES.DISTRICT
                       :            MARKER_TYPES.LOCATION

    setEditingPin(null)
    setPinForm({
      id: 'pin_' + Date.now().toString(36),
      name: '', type: defaultType, dangerLevel: 3,
      description: '', locationSlug: '', cityId: '', districtId: '',
      hasCityMap: isCountry, mapImage: '',
      x: xPct, y: yPct,
    })
    setModalOpen(true)
  }

  function handleEditPin(pin, e) {
    e.stopPropagation()
    setEditingPin(pin)
    setPinForm({ locationSlug: '', districtId: '', cityId: '', ...pin })
    setModalOpen(true)
  }

  // ── Salvar Pin ──────────────────────────────────────────────────────────────
  function handleSavePin(e) {
    e.preventDefault()
    if (!pinForm.name) return alert('Insira o nome do marcador.')

    let updatedPins
    if (editingPin) {
      updatedPins = currentPins.map(p => p.id === editingPin.id ? { ...pinForm } : p)
    } else {
      updatedPins = [...currentPins, { ...pinForm }]
    }

    if (isCountry) {
      handleSaveGlobal(buildUpdatedConfig({ newCountryPins: updatedPins }))
    } else if (isCity) {
      handleSaveGlobal(buildUpdatedConfig({ newCityPins: updatedPins }))
    } else {
      handleSaveGlobal(buildUpdatedConfig({ newDistrictPins: updatedPins }))
    }
    setModalOpen(false)
  }

  // ── Excluir Pin ─────────────────────────────────────────────────────────────
  function handleDeletePin(pinId, e) {
    e.stopPropagation()
    if (!confirm('Deseja excluir este marcador?')) return
    const updatedPins = currentPins.filter(p => p.id !== pinId)
    if (isCountry) {
      handleSaveGlobal(buildUpdatedConfig({ newCountryPins: updatedPins }))
    } else if (isCity) {
      handleSaveGlobal(buildUpdatedConfig({ newCityPins: updatedPins }))
    } else {
      handleSaveGlobal(buildUpdatedConfig({ newDistrictPins: updatedPins }))
    }
    setModalOpen(false)
  }

  // ── Criar Novo Distrito ──────────────────────────────────────────────────────
  function handleCreateDistrict(e) {
    e.preventDefault()
    if (!newDistrictForm.id || !newDistrictForm.name) return alert('Preencha o ID e o nome do distrito.')
    if (!activeCityId) return alert('Selecione uma cidade primeiro.')

    const distId = newDistrictForm.id.toLowerCase().replace(/\s+/g, '-')
    const base = { ...(mapConfig || {}) }
    const existingCity = base.cities?.[activeCityId] || {}
    const updatedCity = {
      ...existingCity,
      districts: {
        ...(existingCity.districts || {}),
        [distId]: {
          name: newDistrictForm.name,
          mapImage: newDistrictForm.mapImage || '',
          pins: [],
        },
      },
    }
    const newConfig = { ...base, cities: { ...(base.cities || {}), [activeCityId]: updatedCity } }
    handleSaveGlobal(newConfig)
    setDistrictModalOpen(false)
    setNewDistrictForm({ id: '', name: '', mapImage: '' })
    // Navega automaticamente para o novo distrito
    setActiveLevel(`${activeCityId}:${distId}`)
  }

  // ── Ícone do pin ─────────────────────────────────────────────────────────────
  function pinIcon(pin) {
    if (pin.type === MARKER_TYPES.CITY)     return '🏙️'
    if (pin.type === MARKER_TYPES.DISTRICT) return '🏘️'
    if (pin.type === MARKER_TYPES.MILITARY) return '⚔️'
    if (pin.type === MARKER_TYPES.SPECIAL)  return '⚡'
    if (pin.type === MARKER_TYPES.LOCATION) return pin.locationSlug ? '🚪' : '📍'
    return '📍'
  }

  if (loading) {
    return <div style={{ padding: 24, color: 'var(--text-muted)' }}>Carregando Editor de Mapa...</div>
  }

  // ── Lista de Cidades para o dropdown ──────────────────────────────────────
  const cityList = Object.entries(mapConfig?.cities || {})

  // ── Breadcrumb do nível atual ────────────────────────────────────────────
  const breadcrumb = isCountry ? '🌍 Mapa Nacional'
    : isCity    ? `🏙️ ${mapConfig?.cities?.[activeCityId]?.name || activeCityId}`
    : `🏘️ ${mapConfig?.cities?.[activeCityId]?.districts?.[activeDistrictId]?.name || activeDistrictId}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ─── 1. BARRA SUPERIOR ─────────────────────────────────────────────── */}
      <div className="glass-light" style={{ padding: '16px 20px', borderRadius: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, color: 'var(--accent-yellow)', textTransform: 'uppercase', letterSpacing: 1 }}>
              🗺️ Editor Visual de Mapa (Point & Click)
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: 11.5, color: 'var(--text-muted)' }}>
              Clique na imagem para adicionar marcadores. Navegue entre os 3 níveis: País → Cidade → Distrito.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Upload de Imagem */}
            <label className="btn btn-sm btn-primary" style={{ cursor: 'pointer', margin: 0, fontSize: 11 }}>
              {uploadingImage ? 'Enviando...' : '📷 Trocar Imagem'}
              <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} disabled={uploadingImage} />
            </label>
          </div>
        </div>

        {/* Seletor de Nível em 3 camadas */}
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Nível 1 */}
          <button
            onClick={() => setActiveLevel('country')}
            style={{
              padding: '6px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
              background: isCountry ? 'rgba(255, 200, 59, 0.2)' : 'rgba(255,255,255,0.06)',
              border: isCountry ? '1px solid rgba(255,200,59,0.6)' : '1px solid var(--glass-border)',
              color: isCountry ? '#ffc83b' : 'var(--text-secondary)',
              fontWeight: isCountry ? 700 : 400,
            }}
          >
            🌍 Mapa Nacional
          </button>

          <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>›</span>

          {/* Nível 2: Selecionar Cidade */}
          <select
            value={isDistrict ? activeCityId : isCity ? activeLevel : ''}
            onChange={(e) => e.target.value && setActiveLevel(e.target.value)}
            style={{
              padding: '6px 12px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
              background: isCity ? 'rgba(56, 189, 248, 0.12)' : 'rgba(0,0,0,0.4)',
              border: isCity ? '1px solid rgba(56, 189, 248, 0.5)' : '1px solid var(--glass-border)',
              color: isCity ? '#38bdf8' : 'var(--text-secondary)',
              fontWeight: isCity ? 700 : 400,
            }}
          >
            <option value="">🏙️ Selecionar Cidade...</option>
            {cityList.map(([key, city]) => (
              <option key={key} value={key}>🏙️ {city.name || key}</option>
            ))}
          </select>

          {activeCityId && (
            <>
              <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>›</span>

              {/* Nível 3: Selecionar Distrito */}
              <select
                value={isDistrict ? activeLevel : ''}
                onChange={(e) => e.target.value && setActiveLevel(e.target.value)}
                style={{
                  padding: '6px 12px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
                  background: isDistrict ? 'rgba(34,197,94,0.12)' : 'rgba(0,0,0,0.4)',
                  border: isDistrict ? '1px solid rgba(34,197,94,0.5)' : '1px solid var(--glass-border)',
                  color: isDistrict ? '#22c55e' : 'var(--text-secondary)',
                  fontWeight: isDistrict ? 700 : 400,
                }}
              >
                <option value="">🏘️ Selecionar Distrito...</option>
                {Object.entries(activeDistricts).map(([dKey, d]) => (
                  <option key={dKey} value={`${activeCityId}:${dKey}`}>
                    🏘️ {d.name || dKey}
                  </option>
                ))}
              </select>

              {/* Botão: Criar Novo Distrito */}
              <button
                onClick={() => {
                  setNewDistrictForm({ id: '', name: '', mapImage: '' })
                  setDistrictModalOpen(true)
                }}
                style={{
                  padding: '6px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                  background: 'rgba(34,197,94,0.1)', border: '1px dashed rgba(34,197,94,0.4)',
                  color: '#22c55e',
                }}
              >
                + Novo Distrito
              </button>
            </>
          )}
        </div>

        {/* Breadcrumb atual */}
        <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)' }}>
          Editando: <strong style={{ color: '#fff' }}>{breadcrumb}</strong>
          {' · '}
          <span style={{ color: '#38bdf8' }}>{currentPins.length} marcadores</span>
        </div>
      </div>

      {/* ─── 2. ÁREA VISUAL DO MAPA ─────────────────────────────────────────── */}
      <div style={{ background: '#070a08', border: '1px solid var(--glass-border)', borderRadius: 12, padding: 12, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, padding: '0 4px' }}>
          <span style={{ fontSize: 11, color: '#38bdf8' }}>
            💡 <strong>Clique</strong> na imagem para posicionar um novo marcador.
            {isDistrict && ' Pins de Nível 3 podem ser vinculados a Salas do jogo (Entrar na Sala).'}
          </span>
        </div>

        <div
          ref={imageContainerRef}
          onClick={handleMapClick}
          style={{
            position: 'relative',
            width: '100%',
            borderRadius: 8,
            overflow: 'hidden',
            cursor: 'crosshair',
            background: '#040604',
            boxShadow: 'inset 0 0 40px rgba(0,0,0,0.8)',
          }}
        >
          <img
            src={currentImage}
            alt="Mapa Editor"
            style={{ width: '100%', height: 'auto', display: 'block', pointerEvents: 'none', filter: 'brightness(0.85) contrast(1.05)' }}
          />

          {/* Grade Tática */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none',
            backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }} />

          {/* Pins */}
          {currentPins.map((pin) => {
            const dangerColor = DANGER_COLORS[pin.dangerLevel] || '#38bdf8'
            return (
              <div
                key={pin.id}
                onClick={(e) => handleEditPin(pin, e)}
                style={{
                  position: 'absolute',
                  left: `${pin.x}%`, top: `${pin.y}%`,
                  transform: 'translate(-50%, -50%)',
                  cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  zIndex: 20,
                }}
                title="Clique para editar este pin"
              >
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'rgba(10, 15, 12, 0.95)',
                  border: `2px solid ${dangerColor}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: `0 0 12px ${dangerColor}88`,
                  fontSize: 15,
                }}>
                  {pinIcon(pin)}
                </div>
                <div style={{ marginTop: 4, background: 'rgba(0,0,0,0.85)', padding: '2px 6px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.15)', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
                  <span style={{ fontSize: 10, fontWeight: 'bold', color: '#fff' }}>{pin.name}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ─── 3. MODAL DE CRIAÇÃO / EDIÇÃO DO PIN ────────────────────────────── */}
      {modalOpen && (
        <div className="loot-modal-overlay" onClick={() => setModalOpen(false)}>
          <div
            className="glass"
            onClick={(e) => e.stopPropagation()}
            style={{ width: '90%', maxWidth: '520px', padding: '24px', borderRadius: '14px', border: '1px solid rgba(56, 189, 248, 0.4)', animation: 'slideUp 0.25s ease' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, color: '#38bdf8', textTransform: 'uppercase' }}>
                {editingPin ? `✏️ Editar: ${editingPin.name}` : '📍 Novo Marcador'}
              </h3>
              <button type="button" onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleSavePin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Coordenadas */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 8 }}>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--text-muted)' }}>Posição X (%)</label>
                  <input type="number" step="0.1" min="0" max="100" value={pinForm.x}
                    onChange={(e) => setPinForm(prev => ({ ...prev, x: Number(e.target.value) }))} required />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--text-muted)' }}>Posição Y (%)</label>
                  <input type="number" step="0.1" min="0" max="100" value={pinForm.y}
                    onChange={(e) => setPinForm(prev => ({ ...prev, y: Number(e.target.value) }))} required />
                </div>
              </div>

              {/* Nome e Tipo */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 10 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 11 }}>Nome do Marcador</label>
                  <input type="text" placeholder="Ex: Hospital Central..."
                    value={pinForm.name}
                    onChange={(e) => setPinForm(prev => ({ ...prev, name: e.target.value }))} required />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 11 }}>Tipo</label>
                  <select value={pinForm.type} onChange={(e) => setPinForm(prev => ({ ...prev, type: e.target.value }))}>
                    {isCountry && <>
                      <option value={MARKER_TYPES.CITY}>🏙️ Cidade (Abre Mapa)</option>
                      <option value={MARKER_TYPES.MILITARY}>⚔️ Militar / Bunker</option>
                      <option value={MARKER_TYPES.SPECIAL}>⚡ Especial / Usina</option>
                      <option value={MARKER_TYPES.POI}>📍 Ponto de Interesse</option>
                    </>}
                    {isCity && <>
                      <option value={MARKER_TYPES.DISTRICT}>🏘️ Distrito (Abre Mapa)</option>
                      <option value={MARKER_TYPES.LOCATION}>🚪 Sala / Locação</option>
                      <option value={MARKER_TYPES.POI}>📍 Ponto de Interesse</option>
                    </>}
                    {isDistrict && <>
                      <option value={MARKER_TYPES.LOCATION}>🚪 Sala / Locação do Jogo</option>
                      <option value={MARKER_TYPES.POI}>📍 Ponto de Interesse</option>
                      <option value={MARKER_TYPES.MILITARY}>⚔️ Militar</option>
                      <option value={MARKER_TYPES.SPECIAL}>⚡ Especial</option>
                    </>}
                  </select>
                </div>
              </div>

              {/* Vínculo: Cidade (apenas no mapa nacional, para pins tipo CITY) */}
              {isCountry && pinForm.type === MARKER_TYPES.CITY && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 11, color: '#fbbf24' }}>🗺️ Mapa da Cidade que este Pin Abrirá:</label>
                  <select
                    value={pinForm.cityId || ''}
                    onChange={(e) => setPinForm(prev => ({ ...prev, cityId: e.target.value }))}
                    style={{ background: 'rgba(251, 191, 36, 0.08)', borderColor: 'rgba(251, 191, 36, 0.4)' }}
                  >
                    <option value="">⚠️ Selecione um Mapa de Cidade...</option>
                    {cityList.map(([key, city]) => (
                      <option key={key} value={key}>🏙️ {city.name || key} (ID: {key})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Vínculo: Distrito (no mapa da cidade, para pins tipo DISTRICT) */}
              {isCity && pinForm.type === MARKER_TYPES.DISTRICT && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 11, color: '#38bdf8' }}>🏘️ Distrito que este Pin Abrirá:</label>
                  <select
                    value={pinForm.districtId || ''}
                    onChange={(e) => setPinForm(prev => ({ ...prev, districtId: e.target.value }))}
                    style={{ background: 'rgba(56,189,248,0.08)', borderColor: 'rgba(56,189,248,0.4)' }}
                  >
                    <option value="">⚠️ Selecione um Distrito...</option>
                    {Object.entries(activeDistricts).map(([dKey, d]) => (
                      <option key={dKey} value={dKey}>🏘️ {d.name || dKey}</option>
                    ))}
                  </select>
                  <small style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 3, display: 'block' }}>
                    Crie o distrito primeiro usando "+ Novo Distrito", depois vincule aqui.
                  </small>
                </div>
              )}

              {/* Nível de Perigo */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: 11 }}>Nível de Perigo (1 a 5)</label>
                <select value={pinForm.dangerLevel} onChange={(e) => setPinForm(prev => ({ ...prev, dangerLevel: Number(e.target.value) }))}>
                  <option value={1}>🟢 Nível 1 - Muito Baixo (Zona Segura)</option>
                  <option value={2}>🟡 Nível 2 - Baixo</option>
                  <option value={3}>🟠 Nível 3 - Moderado (Risco Padrão)</option>
                  <option value={4}>🔴 Nível 4 - Alto (Infectados e Hordas)</option>
                  <option value={5}>🟣 Nível 5 - Extremo (Zona de Morte)</option>
                </select>
              </div>

              {/* Vínculo com Sala (apenas no Nível 3 — Distrito) */}
              {(isDistrict || pinForm.type === MARKER_TYPES.LOCATION) && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 11, color: '#4ade80' }}>
                    🔗 Vincular à Sala / Locação do Jogo (Ao clicar → "Entrar na Sala"):
                  </label>
                  <select
                    value={pinForm.locationSlug || ''}
                    onChange={(e) => setPinForm(prev => ({ ...prev, locationSlug: e.target.value }))}
                    style={{ background: 'rgba(34, 197, 94, 0.08)', borderColor: 'rgba(34, 197, 94, 0.4)' }}
                  >
                    <option value="">🔒 Nenhuma (Somente Marcador Visual)</option>
                    {availableLocations.map((loc) => (
                      <option key={loc.slug || loc.id} value={loc.slug}>
                        🚪 {loc.name} (/location/{loc.slug})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Descrição */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: 11 }}>Descrição / História do Local</label>
                <textarea rows={2} placeholder="Detalhes narrativos que o jogador verá ao clicar no pin..."
                  value={pinForm.description}
                  onChange={(e) => setPinForm(prev => ({ ...prev, description: e.target.value }))}
                  style={{ fontSize: 11 }} />
              </div>

              {/* Botões de Ação */}
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                {editingPin && (
                  <button type="button" className="btn btn-danger" onClick={(e) => handleDeletePin(editingPin.id, e)} style={{ flex: 1 }}>
                    🗑️ Excluir
                  </button>
                )}
                <button type="button" className="btn" onClick={() => setModalOpen(false)} style={{ flex: 1 }}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>
                  💾 Salvar Pin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── 4. MODAL DE CRIAR NOVO DISTRITO ────────────────────────────────── */}
      {districtModalOpen && (
        <div className="loot-modal-overlay" onClick={() => setDistrictModalOpen(false)}>
          <div
            className="glass"
            onClick={(e) => e.stopPropagation()}
            style={{ width: '90%', maxWidth: '440px', padding: '24px', borderRadius: '14px', border: '1px solid rgba(34,197,94,0.4)', animation: 'slideUp 0.25s ease' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, color: '#22c55e', textTransform: 'uppercase' }}>
                🏘️ Novo Distrito em {mapConfig?.cities?.[activeCityId]?.name || activeCityId}
              </h3>
              <button type="button" onClick={() => setDistrictModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer' }}>✕</button>
            </div>

            <form onSubmit={handleCreateDistrict} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: 11 }}>ID do Distrito (slug, ex: stari-grad)</label>
                <input type="text" placeholder="stari-grad, centar, aerodrom..."
                  value={newDistrictForm.id}
                  onChange={(e) => setNewDistrictForm(prev => ({ ...prev, id: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
                  required />
                <small style={{ fontSize: 10, color: 'var(--text-muted)' }}>Minúsculo, sem espaços (use hífen). Não pode ser alterado depois.</small>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: 11 }}>Nome de Exibição do Distrito</label>
                <input type="text" placeholder="Ex: Stari Grad, Centar, Aerodrom..."
                  value={newDistrictForm.name}
                  onChange={(e) => setNewDistrictForm(prev => ({ ...prev, name: e.target.value }))}
                  required />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: 11 }}>URL da Imagem do Mapa (opcional)</label>
                <input type="url" placeholder="https://..."
                  value={newDistrictForm.mapImage}
                  onChange={(e) => setNewDistrictForm(prev => ({ ...prev, mapImage: e.target.value }))} />
                <small style={{ fontSize: 10, color: 'var(--text-muted)' }}>Pode trocar a imagem depois usando "📷 Trocar Imagem" ao editar o distrito.</small>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="button" className="btn" onClick={() => setDistrictModalOpen(false)} style={{ flex: 1 }}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>
                  ✅ Criar Distrito
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
