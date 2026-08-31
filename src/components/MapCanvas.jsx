import { memo, useRef, useEffect, useCallback, useState } from 'react'
import { MARKER_TYPES, DANGER_COLORS } from '../utils/varezhiaData'
import {
  initialCamera, applyTransform, zoomAtPoint, clampPan,
  lerpCamera, cameraReached, ZOOM_MIN, ZOOM_MAX,
} from '../utils/mapSystem'

// ─── Ícone do Pin Interativo ──────────────────────────────────────────────────
function MapPin({ pin, isSelected, onClick, isPlayerHere }) {
  const dangerColor = DANGER_COLORS[pin.dangerLevel] || '#38bdf8'
  const isCity = pin.type === MARKER_TYPES.CITY
  const isMilitary = pin.type === MARKER_TYPES.MILITARY
  const isSpecial = pin.type === MARKER_TYPES.SPECIAL
  const isDistrict = pin.type === MARKER_TYPES.DISTRICT

  let iconSymbol = '📍'
  if (isCity) iconSymbol = '🏙️'
  if (isMilitary) iconSymbol = '⚔️'
  if (isSpecial) iconSymbol = '⚡'
  if (isDistrict) iconSymbol = '🏢'
  if (pin.type === MARKER_TYPES.LOCATION) iconSymbol = '🚪'

  return (
    <div
      className={`map-interactive-pin ${isSelected ? 'selected' : ''} ${isPlayerHere ? 'player-here' : ''}`}
      style={{
        left: `${pin.x}%`,
        top: `${pin.y}%`,
      }}
      onClick={(e) => {
        e.stopPropagation()
        onClick(pin)
      }}
      title={pin.name}
    >
      {/* Halo Pulsante para o Jogador */}
      {isPlayerHere && (
        <div className="map-pin-player-pulse" />
      )}

      {/* Halo de Seleção */}
      {isSelected && (
        <div className="map-pin-select-ring" style={{ borderColor: dangerColor }} />
      )}

      {/* Corpo do Pin */}
      <div className="map-pin-badge" style={{ borderColor: dangerColor, boxShadow: `0 0 14px ${dangerColor}66` }}>
        <span className="map-pin-icon">{iconSymbol}</span>
      </div>

      {/* Rótulo com Nome */}
      <div className="map-pin-label">
        <span className="map-pin-name">{pin.name}</span>
        {pin.dangerLevel && (
          <span className="map-pin-danger" style={{ color: dangerColor }}>
            Perigo {pin.dangerLevel}/5
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Visualizador do Mapa com Pan & Zoom ─────────────────────────────────────
const MapCanvas = memo(function MapCanvas({
  mapImage,
  pins = [],
  selectedId,
  onSelectPin,
  onEnterCity,
  currentLocationSlug,
  isCityLevel = false,
}) {
  const containerRef = useRef(null)
  const layerRef     = useRef(null)
  const camRef       = useRef(initialCamera())
  const targetRef    = useRef(initialCamera())
  const dragRef      = useRef({ active: false, startX: 0, startY: 0, startPan: { x: 0, y: 0 }, moved: false })
  const rafRef       = useRef(null)
  const [, setRerender] = useState(0)

  // Reseta câmera ao trocar de mapa (País <-> Cidade)
  useEffect(() => {
    camRef.current = initialCamera()
    targetRef.current = initialCamera()
    applyTransform(layerRef.current, camRef.current)
  }, [mapImage])

  // Loop de animação suave (lerp)
  const startAnimLoop = useCallback(() => {
    if (rafRef.current) return
    function tick() {
      const cur = camRef.current
      const tgt = targetRef.current
      if (cameraReached(cur, tgt)) {
        camRef.current = tgt
        applyTransform(layerRef.current, tgt)
        rafRef.current = null
        return
      }
      const next = lerpCamera(cur, tgt, 0.16)
      camRef.current = next
      applyTransform(layerRef.current, next)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  // Zoom no Scroll
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    function onWheel(e) {
      e.preventDefault()
      const rect = container.getBoundingClientRect()
      const delta = e.deltaY < 0 ? 1 : -1
      const next = zoomAtPoint(camRef.current, delta, e.clientX, e.clientY, rect)
      camRef.current = next
      targetRef.current = next
      applyTransform(layerRef.current, next)
      setRerender(v => v + 1)
    }

    container.addEventListener('wheel', onWheel, { passive: false })
    return () => container.removeEventListener('wheel', onWheel)
  }, [])

  // Drag com o Mouse
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    function onMouseDown(e) {
      if (e.button !== 0) return
      dragRef.current = {
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        startPan: { x: camRef.current.panX, y: camRef.current.panY },
        moved: false,
      }
      container.style.cursor = 'grabbing'
    }

    function onMouseMove(e) {
      if (!dragRef.current.active) return
      const dx = e.clientX - dragRef.current.startX
      const dy = e.clientY - dragRef.current.startY
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragRef.current.moved = true
      const rect = container.getBoundingClientRect()
      const next = clampPan({
        ...camRef.current,
        panX: dragRef.current.startPan.x + dx,
        panY: dragRef.current.startPan.y + dy,
      }, rect)
      camRef.current = next
      targetRef.current = next
      applyTransform(layerRef.current, next)
    }

    function onMouseUp() {
      dragRef.current.active = false
      if (containerRef.current) containerRef.current.style.cursor = 'grab'
    }

    container.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      container.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  // Clique em um Pin
  function handlePinClick(pin) {
    if (dragRef.current.moved) return
    onSelectPin(pin)

    // Se estiver no mapa do país e o pin for uma cidade navegável, permite zoom e foco
    if (!isCityLevel && pin.hasCityMap && onEnterCity) {
      // O jogador pode clicar para inspecionar, e no painel ou duplo-clique abrir a cidade
    }
  }

  // Clique no fundo do mapa (deseleciona)
  function handleBackgroundClick() {
    if (dragRef.current.moved) return
    onSelectPin(null)
  }

  return (
    <div
      ref={containerRef}
      className="map-canvas-viewport"
      onClick={handleBackgroundClick}
    >
      {/* Camada móvel com imagem e pins */}
      <div ref={layerRef} className="map-canvas-layer">
        <img
          src={mapImage}
          alt="Mapa de Varezhia"
          className="map-image-base"
          draggable={false}
        />

        {/* Grade tática de satélite */}
        <div className="map-tactical-grid-overlay" />

        {/* Pins Interativos */}
        {pins.map((pin) => {
          const isSelected = selectedId === pin.id
          const isPlayerHere = currentLocationSlug && pin.locationSlug === currentLocationSlug
          return (
            <MapPin
              key={pin.id}
              pin={pin}
              isSelected={isSelected}
              isPlayerHere={isPlayerHere}
              onClick={handlePinClick}
            />
          )
        })}
      </div>
    </div>
  )
})

export default MapCanvas
