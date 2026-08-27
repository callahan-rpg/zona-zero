import { useState, useEffect, useRef, useCallback } from 'react'

export default function SettingsModal({ onClose }) {
  const [enabled, setEnabled] = useState(() => {
    return localStorage.getItem('zz_weather_fx') !== 'false'
  })
  const [opacity, setOpacity] = useState(() => {
    const saved = localStorage.getItem('zz_weather_opacity')
    return saved ? Number(saved) : 100
  })
  const [ambientAudio, setAmbientAudio] = useState(() => {
    return localStorage.getItem('zz_ambient_audio') === 'true'
  })
  const [audioVolume, setAudioVolume] = useState(() => {
    const saved = localStorage.getItem('zz_audio_volume')
    return saved ? Number(saved) : 50
  })

  // Posição arrastável do modal
  const [pos, setPos] = useState({ x: Math.max(20, window.innerWidth - 380), y: 80 })
  const dragging = useRef(false)
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 })
  const panelRef = useRef(null)

  const onMouseDown = useCallback((e) => {
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('label')) return
    e.preventDefault()
    dragging.current = true
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y }
  }, [pos])

  useEffect(() => {
    function onMouseMove(e) {
      if (!dragging.current) return
      const dx = e.clientX - dragStart.current.mx
      const dy = e.clientY - dragStart.current.my
      const panel = panelRef.current
      const maxX = panel ? window.innerWidth - panel.offsetWidth : 9999
      const maxY = panel ? window.innerHeight - panel.offsetHeight : 9999
      setPos({
        x: Math.max(0, Math.min(dragStart.current.px + dx, maxX)),
        y: Math.max(0, Math.min(dragStart.current.py + dy, maxY)),
      })
    }
    function onMouseUp() { dragging.current = false }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  function handleToggleWeather(val) {
    setEnabled(val)
    localStorage.setItem('zz_weather_fx', String(val))
    window.dispatchEvent(new Event('weather_fx_toggle'))
  }

  function handleOpacityChange(val) {
    setOpacity(val)
    localStorage.setItem('zz_weather_opacity', String(val))
    window.dispatchEvent(new CustomEvent('weather_opacity_change', { detail: val }))
  }

  function handleAmbientAudioToggle(val) {
    setAmbientAudio(val)
    localStorage.setItem('zz_ambient_audio', String(val))
    window.dispatchEvent(new CustomEvent('ambient_audio_toggle', { detail: val }))
  }

  function handleAudioVolumeChange(val) {
    setAudioVolume(val)
    localStorage.setItem('zz_audio_volume', String(val))
    window.dispatchEvent(new CustomEvent('audio_volume_change', { detail: val }))
  }

  return (
    <div
      ref={panelRef}
      className="character-float-panel"
      style={{ left: pos.x, top: pos.y, width: 340, zIndex: 9999 }}
    >
      {/* Header: Área de arrasto */}
      <div className="character-float-header" onMouseDown={onMouseDown} style={{ cursor: 'move' }}>
        <div className="character-float-title">
          <span>⚙️ Configurações</span>
        </div>
        <button className="character-float-close" onClick={onClose} title="Fechar">×</button>
      </div>

      <div className="character-float-body" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Seção 1: Efeitos Climáticos */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: 8, padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Efeitos Climáticos</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Chuva, neve, neblina e tempestades</div>
            </div>
            <input
              type="checkbox"
              id="weatherToggle"
              checked={enabled}
              onChange={(e) => handleToggleWeather(e.target.checked)}
              style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--accent-yellow)' }}
            />
          </div>

          {enabled && (
            <div style={{ marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Opacidade do Efeito</span>
                <span style={{ fontWeight: 'bold', color: 'var(--accent-yellow)' }}>{opacity}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                value={opacity}
                onChange={(e) => handleOpacityChange(Number(e.target.value))}
                style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--accent-yellow)' }}
              />
            </div>
          )}
        </div>

        {/* Seção 2: Áudio & Efeitos Sonoros */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: 8, padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Sons de Ambiente & Clima</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Áudio atmosférico imersivo</div>
            </div>
            <input
              type="checkbox"
              id="audioToggle"
              checked={ambientAudio}
              onChange={(e) => handleAmbientAudioToggle(e.target.checked)}
              style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--accent-yellow)' }}
            />
          </div>

          {ambientAudio && (
            <div style={{ marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Volume do Som</span>
                <span style={{ fontWeight: 'bold', color: 'var(--accent-yellow)' }}>{audioVolume}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={audioVolume}
                onChange={(e) => handleAudioVolumeChange(Number(e.target.value))}
                style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--accent-yellow)' }}
              />
            </div>
          )}
        </div>

        <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', fontStyle: 'italic' }}>
          Suas preferências são salvas automaticamente no seu navegador.
        </div>
      </div>
    </div>
  )
}
