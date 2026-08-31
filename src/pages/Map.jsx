import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { doc, onSnapshot, updateDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../contexts/AuthContext.jsx'
import HUD from '../components/HUD.jsx'
import { VAREZHIA, getCityPinById, MARKER_TYPES, DANGER_COLORS } from '../utils/varezhiaData'
import {
  initialCamera, applyTransform, zoomAtPoint, clampPan,
  lerpCamera, cameraReached, ZOOM_MIN, ZOOM_MAX,
} from '../utils/mapSystem'

const DANGER_LABELS = ['', 'Muito Baixo (Zona Segura)', 'Baixo', 'Moderado', 'Alto (Hordas)', 'Extremo (Zona de Morte)']

export default function Map() {
  const { user, character, refreshCharacter } = useAuth()
  const navigate = useNavigate()
  const { city: cityParam } = useParams()

  const [remoteMapConfig, setRemoteMapConfig] = useState(null)
  const [currentCity, setCurrentCity] = useState(null)
  const [selectedPin, setSelectedPin] = useState(null)
  const [traveling, setTraveling] = useState(false)

  // Pan / Zoom refs
  const frameWrapperRef = useRef(null)
  const mapFrameRef = useRef(null)
  const camRef = useRef(initialCamera())
  const targetRef = useRef(initialCamera())
  const dragRef = useRef({ active: false, startX: 0, startY: 0, startPan: { x: 0, y: 0 }, moved: false })
  const rafRef = useRef(null)
  const [, setRerender] = useState(0)

  // 1. Escuta o config do Firestore em tempo real
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'map_config', 'global'), (snap) => {
      if (snap.exists()) setRemoteMapConfig(snap.data())
    }, (err) => {
      console.warn('Usando dados canônicos locais do mapa:', err)
    })
    return unsub
  }, [])

  // 2. Sincroniza com URL (/map/:city)
  useEffect(() => {
    if (cityParam) {
      const remotePins = remoteMapConfig?.countryPins || VAREZHIA.countryPins || []
      const remotePin = remotePins.find(p => (p.cityId || p.id) === cityParam)
      if (remotePin) {
        setCurrentCity({ ...remotePin, _resolvedId: cityParam })
      } else {
        const canonical = getCityPinById(cityParam)
        if (canonical) setCurrentCity(canonical)
      }
    } else {
      setCurrentCity(null)
    }
  }, [cityParam, remoteMapConfig])

  // 3. Imagem e Pins ativos (Nacional vs Cidade)
  const { activeImage, activePins, mapTitle, mapSubtitle, currentCityConfig } = useMemo(() => {
    if (currentCity) {
      const cityLookupId = currentCity._resolvedId || currentCity.cityId || currentCity.id
      const customCity = remoteMapConfig?.cities?.[cityLookupId]
      const img = customCity?.mapImage || currentCity.mapImage || VAREZHIA.mapImage
      const pins = customCity?.pins || VAREZHIA.cityPins?.[cityLookupId] || []
      const cityName = customCity?.name || currentCity.name
      return {
        activeImage: img,
        activePins: pins,
        mapTitle: cityName.toUpperCase(),
        mapSubtitle: `Cidade · ${currentCity.region || 'Varezhia'}`,
        currentCityConfig: customCity,
      }
    }

    const img = remoteMapConfig?.countryMapImage || VAREZHIA.mapImage
    const pins = remoteMapConfig?.countryPins || VAREZHIA.countryPins || []
    return {
      activeImage: img,
      activePins: pins,
      mapTitle: 'REPÚBLICA DE VAREZHIA',
      mapSubtitle: 'Mapa Nacional · 43.000 km²',
      currentCityConfig: null,
    }
  }, [currentCity, remoteMapConfig])

  // Auto-seleciona primeiro pin ou atualiza seleção
  useEffect(() => {
    if (activePins && activePins.length > 0) {
      if (!selectedPin || !activePins.some(p => p.id === selectedPin.id)) {
        setSelectedPin(activePins[0])
      }
    } else {
      setSelectedPin(null)
    }
  }, [activePins])

  // Reseta câmera ao trocar de mapa
  useEffect(() => {
    camRef.current = initialCamera()
    targetRef.current = initialCamera()
    applyTransform(mapFrameRef.current, camRef.current)
  }, [activeImage])

  // ── Pan e Zoom com Mouse e Touch ──────────────────────────────────────────

  // Zoom no Scroll — rect do WRAPPER (estático) e frameEl para zoom
  useEffect(() => {
    const wrapper = frameWrapperRef.current
    if (!wrapper) return

    function onWheel(e) {
      e.preventDefault()
      const frameEl = mapFrameRef.current
      if (!frameEl) return
      const rect = wrapper.getBoundingClientRect()
      const frameRect = { width: frameEl.offsetWidth, height: frameEl.offsetHeight }
      const delta = e.deltaY < 0 ? 1 : -1
      const next = zoomAtPoint(camRef.current, delta, e.clientX, e.clientY, rect, frameRect)
      camRef.current = next
      targetRef.current = next
      applyTransform(frameEl, next)
      setRerender(v => v + 1)
    }

    wrapper.addEventListener('wheel', onWheel, { passive: false })
    return () => wrapper.removeEventListener('wheel', onWheel)
  }, [])

  // Drag com Mouse
  useEffect(() => {
    const wrapper = frameWrapperRef.current
    if (!wrapper) return

    function onMouseDown(e) {
      if (e.button !== 0) return
      dragRef.current = {
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        startPan: { x: camRef.current.panX, y: camRef.current.panY },
        moved: false,
      }
      wrapper.style.cursor = 'grabbing'
    }

    function onMouseMove(e) {
      if (!dragRef.current.active) return
      const dx = e.clientX - dragRef.current.startX
      const dy = e.clientY - dragRef.current.startY
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        dragRef.current.moved = true
      }
      const rect = wrapper.getBoundingClientRect()
      const frameEl = mapFrameRef.current
      const frameRect = frameEl ? { width: frameEl.offsetWidth, height: frameEl.offsetHeight } : null
      const next = clampPan({
        ...camRef.current,
        panX: dragRef.current.startPan.x + dx,
        panY: dragRef.current.startPan.y + dy,
      }, rect, frameRect)
      camRef.current = next
      targetRef.current = next
      applyTransform(frameEl, next)
    }

    function onMouseUp() {
      dragRef.current.active = false
      if (wrapper) wrapper.style.cursor = 'grab'
    }

    wrapper.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      wrapper.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  // Suporte a Touch e Pinch-to-Zoom para Notebooks Touchscreen e Mobile
  useEffect(() => {
    const container = frameWrapperRef.current
    if (!container) return

    let touchStartDist = 0
    let touchStartZoom = 1

    function getTouchDist(e) {
      if (e.touches.length < 2) return 0
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      return Math.sqrt(dx * dx + dy * dy)
    }

    function onTouchStart(e) {
      if (e.touches.length === 1) {
        dragRef.current = {
          active: true,
          startX: e.touches[0].clientX,
          startY: e.touches[0].clientY,
          startPan: { x: camRef.current.panX, y: camRef.current.panY },
          moved: false,
        }
      } else if (e.touches.length === 2) {
        touchStartDist = getTouchDist(e)
        touchStartZoom = camRef.current.zoom
      }
    }

    function onTouchMove(e) {
      const frameEl = mapFrameRef.current
      const frameRect = frameEl ? { width: frameEl.offsetWidth, height: frameEl.offsetHeight } : null
      if (e.touches.length === 1 && dragRef.current.active) {
        const dx = e.touches[0].clientX - dragRef.current.startX
        const dy = e.touches[0].clientY - dragRef.current.startY
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragRef.current.moved = true
        const rect = container.getBoundingClientRect()
        const next = clampPan({
          ...camRef.current,
          panX: dragRef.current.startPan.x + dx,
          panY: dragRef.current.startPan.y + dy,
        }, rect, frameRect)
        camRef.current = next
        applyTransform(frameEl, next)
      } else if (e.touches.length === 2 && touchStartDist > 0) {
        e.preventDefault()
        const dist = getTouchDist(e)
        const scaleFactor = dist / touchStartDist
        const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, touchStartZoom * scaleFactor))
        const rect = container.getBoundingClientRect()
        const next = clampPan({ ...camRef.current, zoom: newZoom }, rect, frameRect)
        camRef.current = next
        applyTransform(frameEl, next)
      }
    }

    function onTouchEnd() {
      dragRef.current.active = false
      touchStartDist = 0
    }

    container.addEventListener('touchstart', onTouchStart, { passive: false })
    container.addEventListener('touchmove', onTouchMove, { passive: false })
    container.addEventListener('touchend', onTouchEnd)
    return () => {
      container.removeEventListener('touchstart', onTouchStart)
      container.removeEventListener('touchmove', onTouchMove)
      container.removeEventListener('touchend', onTouchEnd)
    }
  }, [])

  // ── Handlers de Navegação ──────────────────────────────────────────────────

  function handlePinClick(pin, e) {
    if (e) e.stopPropagation()
    if (dragRef.current.moved) return
    setSelectedPin(pin)
  }

  function handleEnterCity(cityPin) {
    const targetCityId = cityPin.cityId || cityPin.id
    setCurrentCity({ ...cityPin, _resolvedId: targetCityId })
    setSelectedPin(null)
    navigate(`/map/${targetCityId}`)
  }

  function handleBackToCountry() {
    setCurrentCity(null)
    setSelectedPin(null)
    navigate('/map')
  }

  function handleResetZoom() {
    camRef.current = initialCamera()
    targetRef.current = initialCamera()
    applyTransform(mapFrameRef.current, camRef.current)
    setRerender(v => v + 1)
  }

  async function handleTravel(slug) {
    if (!user || traveling || !slug) return
    setTraveling(true)
    try {
      const userRef = doc(db, 'users', user.uid)
      await updateDoc(userRef, { 'character.currentLocation': slug })
      await refreshCharacter()
      navigate(`/location/${slug}`)
    } catch (err) {
      console.error('Erro ao viajar:', err)
    } finally {
      setTraveling(false)
    }
  }

  const isCityLevel = !!currentCity

  // Informações para o painel lateral direito
  const displayedNode = selectedPin || (isCityLevel ? currentCity : null)
  const dangerColor = DANGER_COLORS[displayedNode?.dangerLevel || 3] || '#38bdf8'
  const isCityPinOnCountry = !isCityLevel && (displayedNode?.type === MARKER_TYPES.CITY || displayedNode?.hasCityMap)

  return (
    <div className="map-view-page">
      <HUD locationName={`Mapa · ${mapTitle}`} />

      <div className="map-view-container">
        {/* ══ CENTRO: MAPA INTEIRO COM PAN/ZOOM & PINS ══ */}
        <main className="map-view-main">
          {/* Header Barra Superior do Mapa */}
          <div className="map-view-header">
            <div className="map-view-header__left">
              {isCityLevel && (
                <button className="map-back-nav-btn" onClick={handleBackToCountry}>
                  ← Voltar ao Mapa Nacional
                </button>
              )}
              <div>
                <h1 className="map-view-title">{mapTitle}</h1>
                <span className="map-view-subtitle">{mapSubtitle}</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                className="map-zoom-reset-btn"
                onClick={handleResetZoom}
                title="Resetar Zoom e Posição Inicial"
              >
                🔄 Resetar Zoom
              </button>
              <div className="map-view-badge">
                {isCityLevel ? `🏙️ ${activePins.length} Localidades` : `🗺️ ${activePins.length} Regiões/Cidades`}
              </div>
            </div>
          </div>

          {/* Wrapper com Pan & Zoom */}
          <div
            ref={frameWrapperRef}
            className="map-frame-wrapper"
          >
            <div
              ref={mapFrameRef}
              className="map-frame"
            >
              <img
                src={activeImage}
                alt={mapTitle}
                className="map-frame-img"
                draggable={false}
              />

              {/* Grade Tática */}
              <div className="map-frame-grid" />

              {/* Pins Posicionados */}
              {activePins.map((pin) => {
                const isSelected = selectedPin?.id === pin.id
                const pinDangerColor = DANGER_COLORS[pin.dangerLevel || 3] || '#38bdf8'
                const isPlayerHere = character?.currentLocation && pin.locationSlug === character.currentLocation

                let iconSymbol = '📍'
                if (pin.type === MARKER_TYPES.CITY) iconSymbol = '🏙️'
                if (pin.type === MARKER_TYPES.MILITARY) iconSymbol = '⚔️'
                if (pin.type === MARKER_TYPES.SPECIAL) iconSymbol = '⚡'
                if (pin.type === MARKER_TYPES.DISTRICT) iconSymbol = '🏢'
                if (pin.type === MARKER_TYPES.LOCATION) iconSymbol = '🚪'

                return (
                  <div
                    key={pin.id}
                    onClick={(e) => handlePinClick(pin, e)}
                    className={`map-view-pin ${isSelected ? 'active' : ''} ${isPlayerHere ? 'player-here' : ''}`}
                    style={{
                      left: `${pin.x}%`,
                      top: `${pin.y}%`,
                    }}
                    title={pin.name}
                  >
                    {/* Badge do Pin (Limpo, sem pulso) */}
                    <div
                      className="map-view-pin-badge"
                      style={{
                        borderColor: isSelected ? '#ffc83b' : pinDangerColor,
                        background: isSelected ? 'rgba(255, 200, 59, 0.25)' : 'rgba(10, 15, 12, 0.95)',
                        boxShadow: isSelected ? `0 0 16px ${pinDangerColor}` : `0 0 8px ${pinDangerColor}66`,
                      }}
                    >
                      <span>{iconSymbol}</span>
                    </div>

                    {/* Rótulo do Pin */}
                    <div className="map-view-pin-label">
                      <span className="map-view-pin-name">{pin.name}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Dica no rodapé do frame */}
          <div className="map-frame-footer">
            <span>🖱️ Arraste para mover o mapa · 🔍 Scroll para dar Zoom · Clique nos marcadores para detalhes</span>
          </div>
        </main>

        {/* ══ DIREITA: PAINEL DE INFORMAÇÕES & LOCALIDADES ══════════════ */}
        <aside className="map-view-sidebar">
          <div className="map-sidebar-content">

            {/* Cabeçalho do Local Selecionado */}
            {displayedNode ? (
              <>
                <div className="map-node-header">
                  <div className="map-node-type-tag">
                    {displayedNode.type === MARKER_TYPES.CITY ? '🏙️ Cidade / Região' :
                     displayedNode.type === MARKER_TYPES.LOCATION ? '🚪 Sala / Locação do Jogo' :
                     displayedNode.type === MARKER_TYPES.MILITARY ? '⚔️ Base Militar' :
                     displayedNode.type === MARKER_TYPES.SPECIAL ? '⚡ Instalação Especial' : '🏢 Distrito Urbano'}
                  </div>
                  <h2 className="map-node-name">{displayedNode.name}</h2>
                  {displayedNode.region && (
                    <span className="map-node-region">{displayedNode.region}</span>
                  )}
                </div>

                {/* Nível de Perigo */}
                <div className="map-node-card">
                  <div className="map-node-card-title">
                    <span>Nível de Perigo</span>
                    <span style={{ color: dangerColor, fontWeight: 'bold' }}>
                      {DANGER_LABELS[displayedNode.dangerLevel || 3]} ({displayedNode.dangerLevel || 3}/5)
                    </span>
                  </div>
                  <div className="map-danger-meter">
                    <div
                      className="map-danger-meter-fill"
                      style={{
                        width: `${((displayedNode.dangerLevel || 3) / 5) * 100}%`,
                        backgroundColor: dangerColor,
                      }}
                    />
                  </div>
                </div>

                {/* Descrição Narrativa */}
                <div className="map-node-card">
                  <div className="map-node-card-title">
                    <span>Descrição do Local</span>
                  </div>
                  <p className="map-node-description">
                    {displayedNode.description || 'Nenhum relatório detalhado ou inteligência disponível para esta zona de sobrevivência.'}
                  </p>
                </div>

                {/* Botões de Ação */}
                <div className="map-node-actions">
                  {/* Se for pin de Cidade no Mapa Nacional */}
                  {isCityPinOnCountry && (
                    <button
                      className="map-action-btn map-action-btn--explore"
                      onClick={() => handleEnterCity(displayedNode)}
                    >
                      🗺️ Abrir Mapa de {displayedNode.name}
                    </button>
                  )}

                  {/* Se tiver Sala/Locação Vinculada (CRUD) */}
                  {displayedNode.locationSlug && (
                    <button
                      className="map-action-btn map-action-btn--travel"
                      onClick={() => handleTravel(displayedNode.locationSlug)}
                      disabled={traveling}
                    >
                      {traveling ? '⏳ Entrando...' : '🚪 Entrar na Sala'}
                    </button>
                  )}
                </div>

                {/* Lista de Localidades Configuradas (Distritos / Salas) */}
                <div className="map-node-card" style={{ marginTop: '12px' }}>
                  <div className="map-node-card-title">
                    <span>Localidades na Região ({activePins.length})</span>
                  </div>
                  <ul className="map-location-list">
                    {activePins.map(p => (
                      <li
                        key={p.id}
                        onClick={() => setSelectedPin(p)}
                        className={`map-location-item ${selectedPin?.id === p.id ? 'active' : ''}`}
                      >
                        <span className="map-location-dot" style={{ backgroundColor: DANGER_COLORS[p.dangerLevel || 3] }} />
                        <div className="map-location-info">
                          <span className="map-location-name">{p.name}</span>
                          <span className="map-location-type">
                            {p.type === MARKER_TYPES.CITY ? 'Cidade' : p.locationSlug ? 'Sala Disponível' : 'Ponto de Interesse'}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            ) : (
              <div className="map-sidebar-empty">
                <p>Selecione uma localização no mapa para inspecionar dados e relatórios.</p>
              </div>
            )}

          </div>
        </aside>
      </div>
    </div>
  )
}
