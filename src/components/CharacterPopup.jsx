import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { getVitalsDebuffs, getMaxHp } from '../utils/itemSystem'

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
  const debuffInfo = getVitalsDebuffs(character.vitals || {})

  const handleOpenFullInventory = () => {
    onClose?.()
    if (window.location.pathname === '/character') {
      return
    }
    if (window.location.pathname.startsWith('/location')) {
      window.open('/character', '_blank', 'noopener,noreferrer')
    } else {
      window.location.href = '/character'
    }
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

            {/* Saldo de Novos Rublos */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: '8px',
                padding: '5px 8px',
                background: 'rgba(234, 179, 8, 0.12)',
                border: '1px solid rgba(234, 179, 8, 0.3)',
                borderRadius: '6px',
                fontSize: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold', color: '#facc15' }}>
                <span>💰</span>
                <span>{Number(character.rublos || 0).toLocaleString('pt-BR')} Novos Rublos</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('open_money_transfer_modal'))
                }}
                style={{
                  background: 'rgba(234, 179, 8, 0.2)',
                  border: '1px solid rgba(234, 179, 8, 0.4)',
                  color: '#facc15',
                  borderRadius: '4px',
                  padding: '2px 6px',
                  fontSize: '10px',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
                title="Transferir Novos Rublos para outro sobrevivente"
              >
                Transferir
              </button>
            </div>
          </div>
        </div>

        {/* Vitais de Sobrevivência (Sede, Fome, Vida) */}
        <div className="character-float-vitals-section">
          <div className="character-float-section-title">Vitais de Sobrevivência</div>
          <div className="character-vitals-bars">
            {/* Sede */}
            <div className="vital-row">
              <div className="vital-label">
                <span style={{ color: '#38bdf8', fontWeight: 600 }}>Sede</span>
                <span>{character.vitals?.thirst ?? 100}%</span>
              </div>
              <div className="vital-progress-track">
                <div
                  className="vital-progress-fill vital-thirst"
                  style={{ width: `${character.vitals?.thirst ?? 100}%` }}
                />
              </div>
            </div>

            {/* Fome */}
            <div className="vital-row">
              <div className="vital-label">
                <span style={{ color: '#facc15', fontWeight: 600 }}>Fome</span>
                <span>{character.vitals?.hunger ?? 100}%</span>
              </div>
              <div className="vital-progress-track">
                <div
                  className="vital-progress-fill vital-hunger"
                  style={{ width: `${character.vitals?.hunger ?? 100}%` }}
                />
              </div>
            </div>

            {/* Vida */}
            {(() => {
              const maxHp = getMaxHp(character)
              const currentHp = Math.min(character.vitals?.blood ?? maxHp, maxHp)
              const hpPercent = Math.max(0, Math.min(100, Math.round((currentHp / maxHp) * 100)))
              return (
                <div className="vital-row">
                  <div className="vital-label">
                    <span style={{ color: '#ef4444', fontWeight: 600 }}>Vida (HP)</span>
                    <span>{currentHp} / {maxHp} ({hpPercent}%)</span>
                  </div>
                  <div className="vital-progress-track">
                    <div
                      className="vital-progress-fill vital-blood"
                      style={{ width: `${hpPercent}%` }}
                    />
                  </div>
                </div>
              )
            })()}

          </div>
        </div>

        {/* Atributos */}
        <div className="character-float-attr-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div className="character-float-section-title" style={{ margin: 0 }}>Atributos Principais</div>
            {debuffInfo.hasDebuff && (
              <span style={{ fontSize: 9, color: '#f87171', fontWeight: 'bold', background: 'rgba(239, 68, 68, 0.15)', padding: '1px 5px', borderRadius: 4 }}>
                ⚠️ Debuff
              </span>
            )}
          </div>
          <div className="character-float-attributes-grid">
            {ATTRIBUTES.map(({ key, label, icon }) => {
              const baseVal = character.attributes?.[key] ?? 1
              const penalty = debuffInfo.penalties[key] || 0
              const effectiveVal = Math.max(1, baseVal + penalty)
              const isDebuffed = penalty < 0

              return (
                <div key={key} className={`character-float-attr-card ${isDebuffed ? 'attr-debuffed' : ''}`} title={isDebuffed ? `${label}: ${baseVal} (${penalty} por Fome/Sede)` : `${label}: ${baseVal}`}>
                  <span className="character-float-attr-icon">{icon}</span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                    <span className="character-float-attr-val" style={{ color: isDebuffed ? '#f87171' : 'inherit' }}>
                      {effectiveVal}
                    </span>
                    {isDebuffed && (
                      <span style={{ fontSize: 9, color: '#ef4444', fontWeight: 'bold' }}>
                        ({penalty})
                      </span>
                    )}
                  </div>
                  <span className="character-float-attr-lbl">{label}</span>
                </div>
              )
            })}
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
            <span>Mochila & Inventário</span>
          </button>
        </div>
      </div>
    </div>
  )
}
