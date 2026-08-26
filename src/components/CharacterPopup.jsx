import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'

const ATTRIBUTES = [
  { key: 'forca',        label: 'Força',        icon: '💪' },
  { key: 'destreza',     label: 'Destreza',     icon: '🏃' },
  { key: 'sabedoria',    label: 'Sabedoria',    icon: '🧠' },
  { key: 'carisma',      label: 'Carisma',      icon: '🗣️' },
  { key: 'constituicao', label: 'Constituição', icon: '🛡️' },
]

function xpForNextLevel(level) {
  return (level || 1) * 100
}

export default function CharacterPopup({ onClose }) {
  const { character } = useAuth()

  // Inicia posicionado no canto superior direito abaixo da HUD (ao lado de onde o dados abre ou centralizado à direita)
  const [pos, setPos] = useState({ x: Math.max(20, window.innerWidth - 380), y: 80 })
  const dragging  = useRef(false)
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 })
  const panelRef  = useRef(null)

  // ── Arrasto (drag & drop) ───────────────────────────────────────────────────
  const onMouseDown = useCallback((e) => {
    if (e.target.closest('button') || e.target.closest('a')) return
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
      const maxX = panel ? window.innerWidth  - panel.offsetWidth  : 9999
      const maxY = panel ? window.innerHeight - panel.offsetHeight : 9999
      setPos({
        x: Math.max(0, Math.min(dragStart.current.px + dx, maxX)),
        y: Math.max(0, Math.min(dragStart.current.py + dy, maxY)),
      })
    }
    function onMouseUp() { dragging.current = false }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup',   onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup',   onMouseUp)
    }
  }, [])

  if (!character) return null

  const xpMax = xpForNextLevel(character.level)
  const xpCurrent = character.xp || 0
  const xpProgress = Math.min((xpCurrent / xpMax) * 100, 100)

  const handleOpenFullInventory = () => {
    window.open('/character', '_blank', 'noopener,noreferrer')
  }

  return (
    <div
      ref={panelRef}
      className="character-float-panel"
      style={{ left: pos.x, top: pos.y }}
    >
      {/* Header: Área de arrasto */}
      <div className="character-float-header" onMouseDown={onMouseDown}>
        <div className="character-float-title">
          <span>👤 Sobrevivente</span>
        </div>
        <button className="character-float-close" onClick={onClose} title="Fechar">×</button>
      </div>

      {/* Conteúdo do Personagem */}
      <div className="character-float-body">
        {/* Perfil Básico */}
        <div className="character-float-profile">
          <div className="character-float-avatar-wrap">
            {character.avatarUrl ? (
              <img
                src={character.avatarUrl}
                alt={character.name}
                className="character-float-avatar"
              />
            ) : (
              <div className="character-float-avatar-placeholder">🧟</div>
            )}
            <div className="character-float-lvl">Nv {character.level || 1}</div>
          </div>

          <div className="character-float-info">
            <h4 className="character-float-name">{character.name}</h4>
            <span className="character-float-age">{character.age || '??'} anos · Sobrevivente</span>

            <div className="character-float-xp-box">
              <div className="character-float-xp-label">
                <span>XP</span>
                <span>{xpCurrent} / {xpMax}</span>
              </div>
              <div className="character-float-xp-bar">
                <div className="character-float-xp-fill" style={{ width: `${xpProgress}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Atributos */}
        <div className="character-float-attr-section">
          <div className="character-float-section-title">Atributos Principais</div>
          <div className="character-float-attributes-grid">
            {ATTRIBUTES.map(({ key, label, icon }) => (
              <div key={key} className="character-float-attr-card" title={label}>
                <span className="character-float-attr-icon">{icon}</span>
                <span className="character-float-attr-val">{character.attributes?.[key] ?? 1}</span>
                <span className="character-float-attr-lbl">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Botão de Ação: Expandir Inventário */}
        <div className="character-float-actions">
          <button
            type="button"
            className="character-float-expand-btn"
            onClick={handleOpenFullInventory}
          >
            <span className="btn-icon-pack">📦</span>
            <span>Expandir Inventário</span>
            <span className="btn-external-indicator">↗</span>
          </button>
          <div className="character-float-hint">
            Abre em uma nova aba para não interromper seu jogo/chat
          </div>
        </div>
      </div>
    </div>
  )
}
