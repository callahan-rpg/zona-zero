import React, { useState, useEffect, useRef, useCallback } from 'react'
import { hexToRgb, rgbToHex, rgbToHsv, hsvToRgb } from '../utils/themeSystem'

// Paletas temáticas rápidas inspiradas em jogos de sobrevivência e apocalipse
const PRESET_PALETTES = [
  { name: 'Bio-Verde', hex: '#26C88F' },
  { name: 'Esmeralda Radioativa', hex: '#22c55e' },
  { name: 'Ciano Neon', hex: '#06b6d4' },
  { name: 'Azul Tático', hex: '#3b82f6' },
  { name: 'Roxo Mutagênico', hex: '#8b5cf6' },
  { name: 'Carmesim Sangue', hex: '#ef4444' },
  { name: 'Âmbar Alerta', hex: '#f59e0b' },
  { name: 'Cinza Monocromático', hex: '#9ca3af' },
]

export default function ColorPicker({ currentColor, currentTint, onChangeColor, onChangeTint, onReset }) {
  // Estado interno de HSV para permitir arrastar no seletor 2D e barra de matiz
  const [hsv, setHsv] = useState(() => {
    const rgb = hexToRgb(currentColor || '#26C88F')
    return rgbToHsv(rgb.r, rgb.g, rgb.b)
  })

  const satValBoxRef = useRef(null)
  const hueSliderRef = useRef(null)
  const isDraggingSatVal = useRef(false)
  const isDraggingHue = useRef(false)

  // Sincroniza se a cor externa mudar
  useEffect(() => {
    if (currentColor) {
      const rgb = hexToRgb(currentColor)
      const newHsv = rgbToHsv(rgb.r, rgb.g, rgb.b)
      setHsv(prev => {
        // Preserva o Hue se Saturação for 0 para não pular para vermelho
        if (newHsv.s === 0 && prev.h !== undefined) {
          return { ...newHsv, h: prev.h }
        }
        return newHsv
      })
    }
  }, [currentColor])

  // Cor pura do Matiz (para o fundo do gradiente 2D)
  const hueRgb = hsvToRgb(hsv.h, 1, 1)
  const hueHex = rgbToHex(hueRgb.r, hueRgb.g, hueRgb.b)

  // Cor RGB atual calculada
  const currentRgb = hsvToRgb(hsv.h, hsv.s, hsv.v)
  const currentHexCode = rgbToHex(currentRgb.r, currentRgb.g, currentRgb.b)

  // Manipulador do Seletor 2D (Saturação e Valor/Brilho)
  const handleSatValMove = useCallback((e) => {
    if (!satValBoxRef.current) return
    const rect = satValBoxRef.current.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY

    const x = Math.max(0, Math.min(rect.width, clientX - rect.left))
    const y = Math.max(0, Math.min(rect.height, clientY - rect.top))

    const s = x / rect.width
    const v = 1 - (y / rect.height)

    const updatedHsv = { ...hsv, s, v }
    setHsv(updatedHsv)

    const rgb = hsvToRgb(updatedHsv.h, s, v)
    const newHex = rgbToHex(rgb.r, rgb.g, rgb.b)
    onChangeColor?.(newHex)
  }, [hsv, onChangeColor])

  // Manipulador do Slider Vertical de Matiz (Hue)
  const handleHueMove = useCallback((e) => {
    if (!hueSliderRef.current) return
    const rect = hueSliderRef.current.getBoundingClientRect()
    const clientY = e.touches ? e.touches[0].clientY : e.clientY

    const y = Math.max(0, Math.min(rect.height, clientY - rect.top))
    const h = (y / rect.height) * 360

    const updatedHsv = { ...hsv, h: Math.round(h) }
    setHsv(updatedHsv)

    const rgb = hsvToRgb(updatedHsv.h, updatedHsv.s, updatedHsv.v)
    const newHex = rgbToHex(rgb.r, rgb.g, rgb.b)
    onChangeColor?.(newHex)
  }, [hsv, onChangeColor])

  // Listeners globais para arrasto fluido
  useEffect(() => {
    function onMouseMove(e) {
      if (isDraggingSatVal.current) handleSatValMove(e)
      if (isDraggingHue.current) handleHueMove(e)
    }
    function onMouseUp() {
      isDraggingSatVal.current = false
      isDraggingHue.current = false
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('touchmove', onMouseMove)
    window.addEventListener('touchend', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('touchmove', onMouseMove)
      window.removeEventListener('touchend', onMouseUp)
    }
  }, [handleSatValMove, handleHueMove])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Contêiner Principal Estilo Glass-Color-Card */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--glass-border)',
          borderRadius: 14,
          padding: 14,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}
      >
        {/* Barra Superior: Slider de Intensidade do Vidro + Preview circular */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              Opacidade do Tom
            </span>
            <input
              type="range"
              min="0"
              max="60"
              value={currentTint ?? 15}
              onChange={(e) => onChangeTint?.(Number(e.target.value))}
              style={{
                flex: 1,
                cursor: 'pointer',
                accentColor: currentHexCode,
                height: 5
              }}
              title="Ajusta o quanto a cor se funde ao vidro fosco da interface"
            />
            <span style={{ fontSize: 11, fontFamily: 'Share Tech Mono, monospace', color: 'var(--text-muted)', width: 28, textAlign: 'right' }}>
              {currentTint ?? 15}%
            </span>
          </div>

          {/* Círculo indicador com a cor atual */}
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              backgroundColor: currentHexCode,
              border: '2px solid rgba(255, 255, 255, 0.8)',
              boxShadow: `0 0 10px ${currentHexCode}66`,
              flexShrink: 0
            }}
          />
        </div>

        {/* Corpo do Seletor: Caixa 2D + Barra de Matiz */}
        <div style={{ display: 'flex', gap: 12, height: 160 }}>
          {/* Caixa 2D Sat / Val */}
          <div
            ref={satValBoxRef}
            onMouseDown={(e) => {
              isDraggingSatVal.current = true
              handleSatValMove(e)
            }}
            onTouchStart={(e) => {
              isDraggingSatVal.current = true
              handleSatValMove(e)
            }}
            style={{
              flex: 1,
              position: 'relative',
              borderRadius: 10,
              cursor: 'crosshair',
              overflow: 'hidden',
              backgroundColor: hueHex,
              backgroundImage: `
                linear-gradient(to right, #fff 0%, transparent 100%),
                linear-gradient(to top, #000 0%, transparent 100%)
              `,
              boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.1)'
            }}
          >
            {/* Indicador arrastável circular 2D */}
            <div
              style={{
                position: 'absolute',
                left: `${hsv.s * 100}%`,
                top: `${(1 - hsv.v) * 100}%`,
                transform: 'translate(-50%, -50%)',
                width: 14,
                height: 14,
                borderRadius: '50%',
                border: '2px solid #ffffff',
                boxShadow: '0 0 4px rgba(0,0,0,0.8), inset 0 0 2px rgba(0,0,0,0.5)',
                pointerEvents: 'none'
              }}
            />

            {/* Badges de Códigos HEX e RGB no interior do picker (igual a imagem de referência) */}
            <div
              style={{
                position: 'absolute',
                bottom: 8,
                left: 10,
                background: 'rgba(0, 0, 0, 0.65)',
                backdropFilter: 'blur(8px)',
                padding: '4px 8px',
                borderRadius: 6,
                border: '1px solid rgba(255, 255, 255, 0.1)',
                pointerEvents: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: 1
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'Share Tech Mono, monospace', color: '#ffffff', letterSpacing: 0.5 }}>
                {currentHexCode}
              </span>
              <span style={{ fontSize: 9, fontFamily: 'Share Tech Mono, monospace', color: 'rgba(255, 255, 255, 0.7)' }}>
                R{currentRgb.r} G{currentRgb.g} B{currentRgb.b}
              </span>
            </div>
          </div>

          {/* Slider Vertical de Hue / Matiz */}
          <div
            ref={hueSliderRef}
            onMouseDown={(e) => {
              isDraggingHue.current = true
              handleHueMove(e)
            }}
            onTouchStart={(e) => {
              isDraggingHue.current = true
              handleHueMove(e)
            }}
            style={{
              width: 22,
              borderRadius: 12,
              position: 'relative',
              cursor: 'pointer',
              background: 'linear-gradient(to bottom, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)',
              boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.15)'
            }}
          >
            {/* Pino indicador de Matiz */}
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: `${(hsv.h / 360) * 100}%`,
                transform: 'translate(-50%, -50%)',
                width: 18,
                height: 18,
                borderRadius: '50%',
                border: '2px solid #ffffff',
                backgroundColor: 'rgba(0,0,0,0.3)',
                boxShadow: '0 0 4px rgba(0,0,0,0.9)',
                pointerEvents: 'none'
              }}
            />
          </div>
        </div>

        {/* Paletas Predefinidas Rápidas */}
        <div>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>
            Paletas Rápidas
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
            {PRESET_PALETTES.map(p => (
              <button
                key={p.hex}
                type="button"
                onClick={() => onChangeColor?.(p.hex)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  background: currentHexCode.toLowerCase() === p.hex.toLowerCase() ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                  border: currentHexCode.toLowerCase() === p.hex.toLowerCase() ? `1px solid ${p.hex}` : '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: 6,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textAlign: 'left',
                  minWidth: 0,
                  boxSizing: 'border-box'
                }}
                title={p.name}
              >
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    backgroundColor: p.hex,
                    flexShrink: 0
                  }}
                />
                <span style={{ fontSize: 10.5, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {p.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Botão de Redefinir para o Padrão */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
          <button
            type="button"
            onClick={onReset}
            style={{
              background: 'transparent',
              border: '1px solid var(--glass-border)',
              borderRadius: 6,
              padding: '4px 10px',
              fontSize: 11,
              color: 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text-primary)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-muted)'
              e.currentTarget.style.borderColor = 'var(--glass-border)'
            }}
          >
            ↺ Restaurar Padrão
          </button>
        </div>
      </div>
    </div>
  )
}
