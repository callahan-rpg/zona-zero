import { useState, useEffect, useRef, useCallback } from 'react'
import {
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../contexts/AuthContext.jsx'

const DICE_TYPES = [
  { type: 'D4',   faces: 4,   icon: '▲' },
  { type: 'D6',   faces: 6,   icon: '⬡' },
  { type: 'D10',  faces: 10,  icon: '◆' },
  { type: 'D20',  faces: 20,  icon: '⬟' },
  { type: 'D100', faces: 100, icon: '●' },
]

export default function DiceRoller({ onClose }) {
  const { user, character } = useAuth()
  const [selected, setSelected] = useState(DICE_TYPES[2]) // D10 padrão
  const [rolling, setRolling]   = useState(false)
  const [result, setResult]     = useState(null)
  const [history, setHistory]   = useState([])

  // Posição do painel — inicia no canto superior direito, logo abaixo da HUD
  const [pos, setPos] = useState({ x: window.innerWidth - 340, y: 90 })
  const dragging  = useRef(false)
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 })
  const panelRef  = useRef(null)

  // Histórico em tempo real (últimas 20 rolagens)
  useEffect(() => {
    const q = query(
      collection(db, 'dice_rolls'),
      orderBy('timestamp', 'desc'),
      limit(20)
    )
    return onSnapshot(q, (snap) =>
      setHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    )
  }, [])

  // ── Arrasto (drag) ───────────────────────────────────────────────────────
  const onMouseDown = useCallback((e) => {
    if (e.target.closest('button')) return
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

  // ── Rolar dado ───────────────────────────────────────────────────────────
  async function roll() {
    if (rolling) return
    setRolling(true)
    setResult(null)
    await new Promise((r) => setTimeout(r, 1200))
    const rolled = Math.floor(Math.random() * selected.faces) + 1
    setResult(rolled)
    setRolling(false)
    await addDoc(collection(db, 'dice_rolls'), {
      playerUid:  user.uid,
      playerName: character?.name || 'Desconhecido',
      diceType:   selected.type,
      faces:      selected.faces,
      result:     rolled,
      timestamp:  serverTimestamp(),
    })
  }

  function formatTime(ts) {
    if (!ts) return ''
    const d = ts.toDate ? ts.toDate() : new Date(ts)
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      ref={panelRef}
      className="dice-float-panel"
      style={{ left: pos.x, top: pos.y }}
    >
      {/* Header: área de arrasto */}
      <div className="dice-float-header" onMouseDown={onMouseDown}>
        <span className="dice-float-title">🎲 Dados</span>
        <button className="dice-close" onClick={onClose} title="Fechar">×</button>
      </div>

      {/* Seleção de tipo de dado */}
      <div className="dice-float-types">
        {DICE_TYPES.map((d) => (
          <button
            key={d.type}
            className={`dice-type-btn ${selected.type === d.type ? 'selected' : ''}`}
            onClick={() => { setSelected(d); setResult(null) }}
            title={d.type}
          >
            <span className="dice-face-icon">{d.icon}</span>
            <span className="dice-label">{d.type}</span>
          </button>
        ))}
      </div>

      {/* Resultado / animação */}
      <div className="dice-float-result">
        {rolling ? (
          <div className="dice-rolling">
            <span className="dice-roll-icon">{selected.icon}</span>
            <span className="dice-roll-label">Rolando {selected.type}…</span>
          </div>
        ) : result !== null ? (
          <>
            <div className="dice-result-number">{result}</div>
            <div className="dice-result-label">{character?.name} · {selected.type}</div>
          </>
        ) : (
          <div className="dice-result-label" style={{ color: 'var(--text-muted)' }}>
            Selecione e role
          </div>
        )}
      </div>

      {/* Botão rolar */}
      <div style={{ padding: '0 12px 12px' }}>
        <button className="dice-roll-btn" onClick={roll} disabled={rolling}>
          {rolling ? 'Rolando…' : `Rolar ${selected.type}`}
        </button>
      </div>

      {/* Histórico */}
      <div className="dice-float-history">
        <div className="dice-float-history-title">Últimas Rolagens</div>
        {history.length === 0 ? (
          <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '10px 0' }}>
            Nenhuma rolagem ainda.
          </p>
        ) : (
          <div className="dice-history-list">
            {history.map((entry) => (
              <div key={entry.id} className="dice-history-item">
                <span className="dice-history-player">{entry.playerName}</span>
                <span className="dice-history-type">{entry.diceType}</span>
                <span className="dice-history-result">{entry.result}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                  {formatTime(entry.timestamp)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

