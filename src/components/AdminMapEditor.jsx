import { useState, useEffect, useRef } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { VAREZHIA, MARKER_TYPES, DANGER_COLORS } from '../utils/varezhiaData'
import { uploadImageFree } from '../utils/imageUpload'

export default function AdminMapEditor({ availableLocations = [] }) {
  // Configuração Remota do Mapa
  const [mapConfig, setMapConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Nível Atual no Editor: 'country' | id_da_cidade (ex: 'novigrad')
  const [activeLevel, setActiveLevel] = useState('country')

  // Estado do Pin Sendo Adicionado / Editado
  const [modalOpen, setModalOpen] = useState(false)
  const [editingPin, setEditingPin] = useState(null)
  const [pinForm, setPinForm] = useState({
    id: '',
    name: '',
    type: MARKER_TYPES.CITY,
    dangerLevel: 3,
    description: '',
    locationSlug: '',
    cityId: '',
    hasCityMap: true,
    mapImage: '',
    x: 50,
    y: 50,
  })

  // Upload State
  const [uploadingImage, setUploadingImage] = useState(false)
  const imageContainerRef = useRef(null)

  // 1. Carrega dados do Firestore (com fallback para os dados canônicos)
  useEffect(() => {
    async function loadConfig() {
      try {
        const snap = await getDoc(doc(db, 'map_config', 'global'))
        if (snap.exists()) {
          setMapConfig(snap.data())
        } else {
          // Inicializa com os dados padrões
          setMapConfig({
            countryMapImage: VAREZHIA.mapImage,
            countryPins: VAREZHIA.countryPins,
            cities: {
              novigrad: { name: 'Novigrad', mapImage: VAREZHIA.cityPins.novigrad ? 'https://images.unsplash.com/photo-1477959858617-67f30bc75b82?auto=format&fit=crop&w=1600&q=80' : '', pins: VAREZHIA.cityPins.novigrad || [] },
              kamen: { name: 'Kamen', mapImage: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1600&q=80', pins: VAREZHIA.cityPins.kamen || [] },
              veleska: { name: 'Veleska', mapImage: 'https://images.unsplash.com/photo-1508614589041-895b88991e3e?auto=format&fit=crop&w=1600&q=80', pins: VAREZHIA.cityPins.veleska || [] },
              polje: { name: 'Polje', mapImage: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1600&q=80', pins: VAREZHIA.cityPins.polje || [] },
            }
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

  // Imagem e Pins do Nível Atual
  const currentImage = activeLevel === 'country'
    ? (mapConfig?.countryMapImage || VAREZHIA.mapImage)
    : (mapConfig?.cities?.[activeLevel]?.mapImage || VAREZHIA.cityPins[activeLevel]?.mapImage || VAREZHIA.mapImage)

  const currentPins = activeLevel === 'country'
    ? (mapConfig?.countryPins || VAREZHIA.countryPins)
    : (mapConfig?.cities?.[activeLevel]?.pins || VAREZHIA.cityPins[activeLevel] || [])

  // Salva no Firestore
  async function handleSaveGlobal(newConfig) {
    setSaving(true)
    try {
      await setDoc(doc(db, 'map_config', 'global'), newConfig)
      setMapConfig(newConfig)
      alert('Configuração do Mapa salva com sucesso!')
    } catch (err) {
      alert('Erro ao salvar mapa: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // Upload de Imagem de Fundo (País ou Cidade)
  async function handleImageUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingImage(true)
    try {
      const url = await uploadImageFree(file)
      if (activeLevel === 'country') {
        const updated = { ...mapConfig, countryMapImage: url }
        handleSaveGlobal(updated)
      } else {
        const updatedCities = {
          ...(mapConfig.cities || {}),
          [activeLevel]: {
            ...(mapConfig?.cities?.[activeLevel] || {}),
            mapImage: url,
            pins: currentPins
          }
        }
        const updated = { ...mapConfig, cities: updatedCities }
        handleSaveGlobal(updated)
      }
    } catch (err) {
      alert('Erro no upload: ' + err.message)
    } finally {
      setUploadingImage(false)
    }
  }

  // Clique na imagem para Posicionar Novo Pin
  function handleMapClick(e) {
    if (!imageContainerRef.current) return
    const rect = imageContainerRef.current.getBoundingClientRect()
    const xPct = Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10
    const yPct = Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10

    setEditingPin(null)
    setPinForm({
      id: 'pin_' + Date.now().toString(36),
      name: '',
      type: activeLevel === 'country' ? MARKER_TYPES.CITY : MARKER_TYPES.LOCATION,
      dangerLevel: 3,
      description: '',
      locationSlug: '',
      cityId: '',
      hasCityMap: activeLevel === 'country',
      mapImage: '',
      x: xPct,
      y: yPct,
    })
    setModalOpen(true)
  }

  // Abrir modal para Editar Pin Existente
  function handleEditPin(pin, e) {
    e.stopPropagation()
    setEditingPin(pin)
    setPinForm({
      ...pin,
      locationSlug: pin.locationSlug || '',
    })
    setModalOpen(true)
  }

  // Salvar Pin (Criar ou Atualizar)
  function handleSavePin(e) {
    e.preventDefault()
    if (!pinForm.name) return alert('Insira o nome do marcador.')

    let updatedPins = []
    if (editingPin) {
      updatedPins = currentPins.map(p => p.id === editingPin.id ? { ...pinForm } : p)
    } else {
      updatedPins = [...currentPins, { ...pinForm }]
    }

    if (activeLevel === 'country') {
      const updated = { ...mapConfig, countryPins: updatedPins }
      handleSaveGlobal(updated)
    } else {
      const updatedCities = {
        ...(mapConfig.cities || {}),
        [activeLevel]: {
          ...(mapConfig?.cities?.[activeLevel] || {}),
          mapImage: currentImage,
          pins: updatedPins
        }
      }
      const updated = { ...mapConfig, cities: updatedCities }
      handleSaveGlobal(updated)
    }
    setModalOpen(false)
  }

  // Excluir Pin
  function handleDeletePin(pinId, e) {
    e.stopPropagation()
    if (!confirm('Deseja excluir este marcador?')) return

    const updatedPins = currentPins.filter(p => p.id !== pinId)
    if (activeLevel === 'country') {
      const updated = { ...mapConfig, countryPins: updatedPins }
      handleSaveGlobal(updated)
    } else {
      const updatedCities = {
        ...(mapConfig.cities || {}),
        [activeLevel]: {
          ...(mapConfig?.cities?.[activeLevel] || {}),
          mapImage: currentImage,
          pins: updatedPins
        }
      }
      const updated = { ...mapConfig, cities: updatedCities }
      handleSaveGlobal(updated)
    }
    setModalOpen(false)
  }

  if (loading) {
    return <div style={{ padding: 24, color: 'var(--text-muted)' }}>Carregando Editor de Mapa...</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ─── 1. BARRA SUPERIOR DE CONTROLE E SELEÇÃO DE NÍVEL ───────────── */}
      <div className="glass-light" style={{ padding: '16px 20px', borderRadius: 12, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, color: 'var(--accent-yellow)', textTransform: 'uppercase', letterSpacing: 1 }}>
            🗺️ Editor Visual de Mapa (Point & Click)
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: 11.5, color: 'var(--text-muted)' }}>
            Clique diretamente sobre a imagem para posicionar novos marcadores. Eles ficam 100% responsivos em qualquer tela.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Seletor de Nível */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Editando:</span>
            <select
              value={activeLevel}
              onChange={(e) => setActiveLevel(e.target.value)}
              style={{ padding: '7px 12px', fontSize: 12, borderRadius: 6, background: 'rgba(0,0,0,0.4)', border: '1px solid var(--glass-border)', color: '#fff' }}
            >
              <option value="country">🌍 Mapa Nacional (País de Varezhia)</option>
              <optgroup label="🏙️ Mapas das Cidades">
                <option value="novigrad">🏙️ Novigrad (Metrópole)</option>
                <option value="kamen">🌲 Kamen (Norte Montanhoso)</option>
                <option value="veleska">🏭 Veleska (Polo Industrial)</option>
                <option value="polje">🌾 Polje (Campos Agrícolas)</option>
                <option value="dravina">🌳 Dravina (Florestas)</option>
                <option value="srebren">⚓ Srebren (Litoral)</option>
                <option value="zlatna">⛰️ Zlatna (Minas)</option>
              </optgroup>
            </select>
          </div>

          {/* Botão Upload de Imagem */}
          <label className="btn btn-sm btn-primary" style={{ cursor: 'pointer', margin: 0, fontSize: 11 }}>
            {uploadingImage ? 'Enviando...' : '📷 Trocar Imagem do Mapa'}
            <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} disabled={uploadingImage} />
          </label>
        </div>
      </div>

      {/* ─── 2. ÁREA VISUAL DO MAPA COM OS PINS ─────────────────────────── */}
      <div style={{ background: '#070a08', border: '1px solid var(--glass-border)', borderRadius: 12, padding: 12, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, padding: '0 4px' }}>
          <span style={{ fontSize: 11, color: '#38bdf8' }}>
            💡 Dica: Dê um <strong>clique</strong> em qualquer ponto da imagem abaixo para abrir o formulário do Pin.
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Marcadores neste nível: <strong>{currentPins.length}</strong>
          </span>
        </div>

        {/* Container da Imagem de Fundo (Proporção Natural da Imagem) */}
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
          {/* Imagem do Mapa — exibida na proporção natural dela */}
          <img
            src={currentImage}
            alt="Mapa Editor"
            style={{
              width: '100%',
              height: 'auto',
              display: 'block',
              pointerEvents: 'none',
              filter: 'brightness(0.85) contrast(1.05)',
            }}
          />

          {/* Grade Tática */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

          {/* Pins Posicionados */}
          {currentPins.map((pin) => {
            const dangerColor = DANGER_COLORS[pin.dangerLevel] || '#38bdf8'
            return (
              <div
                key={pin.id}
                onClick={(e) => handleEditPin(pin, e)}
                style={{
                  position: 'absolute',
                  left: `${pin.x}%`,
                  top: `${pin.y}%`,
                  transform: 'translate(-50%, -50%)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  zIndex: 20,
                }}
                title="Clique para editar este pin"
              >
                {/* Badge do Pin */}
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'rgba(10, 15, 12, 0.95)',
                    border: `2px solid ${dangerColor}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: `0 0 12px ${dangerColor}88`,
                    fontSize: 15,
                  }}
                >
                  {pin.type === MARKER_TYPES.CITY ? '🏙️' : pin.type === MARKER_TYPES.LOCATION ? '🚪' : '📍'}
                </div>

                {/* Rótulo */}
                <div style={{ marginTop: 4, background: 'rgba(0,0,0,0.85)', padding: '2px 6px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.15)', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
                  <span style={{ fontSize: 10, fontWeight: 'bold', color: '#fff' }}>{pin.name}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ─── 3. MODAL DE CRIAÇÃO / EDIÇÃO DO PIN ─────────────────────────── */}
      {modalOpen && (
        <div className="loot-modal-overlay" onClick={() => setModalOpen(false)}>
          <div
            className="glass"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '90%',
              maxWidth: '520px',
              padding: '24px',
              borderRadius: '14px',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              animation: 'slideUp 0.25s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, color: '#38bdf8', textTransform: 'uppercase' }}>
                {editingPin ? `✏️ Editar Pin: ${editingPin.name}` : '📍 Novo Marcador de Mapa'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Coordenadas */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 8 }}>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--text-muted)' }}>Posição X (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={pinForm.x}
                    onChange={(e) => setPinForm(prev => ({ ...prev, x: Number(e.target.value) }))}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--text-muted)' }}>Posição Y (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={pinForm.y}
                    onChange={(e) => setPinForm(prev => ({ ...prev, y: Number(e.target.value) }))}
                    required
                  />
                </div>
              </div>

              {/* Nome e Tipo */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 10 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 11 }}>Nome do Marcador</label>
                  <input
                    type="text"
                    placeholder="Ex: Praça Central, Delegacia..."
                    value={pinForm.name}
                    onChange={(e) => setPinForm(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 11 }}>Tipo</label>
                  <select
                    value={pinForm.type}
                    onChange={(e) => setPinForm(prev => ({ ...prev, type: e.target.value }))}
                  >
                    <option value={MARKER_TYPES.CITY}>🏙️ Cidade (Abre Mapa)</option>
                    <option value={MARKER_TYPES.LOCATION}>🚪 Sala / Locação do Jogo</option>
                    <option value={MARKER_TYPES.DISTRICT}>🏢 Distrito Urbano</option>
                    <option value={MARKER_TYPES.MILITARY}>⚔️ Militar / Bunker</option>
                    <option value={MARKER_TYPES.SPECIAL}>⚡ Especial / Usina</option>
                    <option value={MARKER_TYPES.POI}>📍 Ponto de Interesse</option>
                  </select>
                </div>
              </div>

              {/* Vínculo com Mapa de Cidade (apenas para pins tipo CITY no mapa do país) */}
              {activeLevel === 'country' && pinForm.type === MARKER_TYPES.CITY && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 11, color: '#fbbf24' }}>
                    🗺️ Mapa da Cidade que este Pin Abrirá:
                  </label>
                  <select
                    value={pinForm.cityId || ''}
                    onChange={(e) => setPinForm(prev => ({ ...prev, cityId: e.target.value }))}
                    style={{ background: 'rgba(251, 191, 36, 0.08)', borderColor: 'rgba(251, 191, 36, 0.4)' }}
                    required
                  >
                    <option value="">⚠️ Selecione um Mapa de Cidade...</option>
                    {Object.entries(mapConfig?.cities || {}).map(([key, city]) => (
                      <option key={key} value={key}>
                        🏙️ {city.name || key} (ID: {key})
                      </option>
                    ))}
                  </select>
                  <small style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 3, display: 'block' }}>
                    Crie o mapa da cidade primeiro na aba correspondente, depois vincule aqui.
                  </small>
                </div>
              )}

              {/* Nível de Perigo */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: 11 }}>Nível de Perigo (1 a 5)</label>
                <select
                  value={pinForm.dangerLevel}
                  onChange={(e) => setPinForm(prev => ({ ...prev, dangerLevel: Number(e.target.value) }))}
                >
                  <option value={1}>🟢 Nível 1 - Muito Baixo (Zona Segura)</option>
                  <option value={2}>🟡 Nível 2 - Baixo</option>
                  <option value={3}>🟠 Nível 3 - Moderado (Risco Padrão)</option>
                  <option value={4}>🔴 Nível 4 - Alto (Infectados e Hordas)</option>
                  <option value={5}>🟣 Nível 5 - Extremo (Zona de Morte)</option>
                </select>
              </div>

              {/* Vínculo com Sala / Locação Criada no CRUD */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: 11, color: '#4ade80' }}>
                  🔗 Vincular à Sala / Locação do Jogo (Ao clicar, viaja para lá):
                </label>
                <select
                  value={pinForm.locationSlug || ''}
                  onChange={(e) => setPinForm(prev => ({ ...prev, locationSlug: e.target.value }))}
                  style={{ background: 'rgba(34, 197, 94, 0.08)', borderColor: 'rgba(34, 197, 94, 0.4)' }}
                >
                  <option value="">🔒 Nenhuma (Somente Marcador Visual no Mapa)</option>
                  {availableLocations.map((loc) => (
                    <option key={loc.slug || loc.id} value={loc.slug}>
                      🚪 {loc.name} (/location/{loc.slug})
                    </option>
                  ))}
                </select>
              </div>

              {/* Descrição */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: 11 }}>Descrição / História do Local</label>
                <textarea
                  rows={2}
                  placeholder="Detalhes narrativos que o jogador verá ao clicar no pin..."
                  value={pinForm.description}
                  onChange={(e) => setPinForm(prev => ({ ...prev, description: e.target.value }))}
                  style={{ fontSize: 11 }}
                />
              </div>

              {/* Botões de Ação */}
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                {editingPin && (
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={(e) => handleDeletePin(editingPin.id, e)}
                    style={{ flex: 1 }}
                  >
                    🗑️ Excluir Pin
                  </button>
                )}
                <button
                  type="button"
                  className="btn"
                  onClick={() => setModalOpen(false)}
                  style={{ flex: 1 }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 2 }}
                >
                  💾 Salvar Pin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
