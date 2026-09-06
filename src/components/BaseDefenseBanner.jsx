import { useState, useEffect } from 'react'
import { doc, onSnapshot, collection, query, orderBy, limit } from 'firebase/firestore'
import { db } from '../firebase/config'
import { getDefenseStatusMeta, DEFAULT_BASE_DEFENSE } from '../utils/baseDefenseSystem'

export default function BaseDefenseBanner({
  compact = false,
  showHistory = true,
  customTitle = null
}) {
  const [defenseData, setDefenseData] = useState(DEFAULT_BASE_DEFENSE)
  const [logs, setLogs] = useState([])
  const [showLogModal, setShowLogModal] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'base_defense', 'global'), (snap) => {
      if (snap.exists()) {
        setDefenseData({ ...DEFAULT_BASE_DEFENSE, ...snap.data() })
      } else {
        setDefenseData(DEFAULT_BASE_DEFENSE)
      }
      setLoading(false)
    }, (err) => {
      console.warn('Erro ao carregar defesa da base:', err)
      setLoading(false)
    })

    return () => unsub()
  }, [])

  useEffect(() => {
    if (!showHistory) return
    const q = query(
      collection(db, 'base_defense_logs'),
      orderBy('timestamp', 'desc'),
      limit(15)
    )
    const unsub = onSnapshot(q, (snap) => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [showHistory])

  const currentHp = Number(defenseData.currentHp ?? 100)
  const maxHp = Number(defenseData.maxHp ?? 100)
  const statusMeta = getDefenseStatusMeta(currentHp, maxHp)

  return (
    <div
      className="glass"
      style={{
        borderRadius: '12px',
        border: `1px solid ${statusMeta.border}66`,
        background: `linear-gradient(135deg, ${statusMeta.bg} 0%, rgba(15, 23, 42, 0.85) 100%)`,
        padding: compact ? '10px 14px' : '14px 18px',
        boxShadow: `0 8px 24px rgba(0,0,0,0.5), 0 0 16px ${statusMeta.color}22`,
        marginBottom: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        transition: 'all 0.3s ease'
      }}
    >
      {/* Linha superior: Título, Ícone e Badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: compact ? 18 : 22 }}>{statusMeta.icon}</span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <strong style={{ fontSize: compact ? 12 : 13, textTransform: 'uppercase', letterSpacing: 0.5, color: '#fff', fontFamily: 'Oswald' }}>
                {customTitle || defenseData.name || 'Defesa do Acampamento'}
              </strong>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: statusMeta.bg,
                  color: statusMeta.color,
                  border: `1px solid ${statusMeta.border}88`,
                  letterSpacing: 0.5
                }}
              >
                {statusMeta.badge}
              </span>
            </div>
            {!compact && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {statusMeta.description}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: compact ? 13 : 15, fontWeight: 800, color: statusMeta.color }}>
              {currentHp} <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>/ {maxHp}</span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              Integridade: {statusMeta.percentage}%
            </div>
          </div>

          {showHistory && logs.length > 0 && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setShowLogModal(true)}
              title="Ver histórico de danos e reparos"
              style={{ fontSize: 10, padding: '3px 7px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)' }}
            >
              📜 Histórico
            </button>
          )}
        </div>
      </div>

      {/* Barra de Vida da Base */}
      <div
        style={{
          width: '100%',
          height: compact ? 8 : 10,
          background: 'rgba(0, 0, 0, 0.5)',
          borderRadius: 6,
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.08)',
          position: 'relative'
        }}
      >
        <div
          style={{
            width: `${statusMeta.percentage}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${statusMeta.color}aa 0%, ${statusMeta.color} 100%)`,
            boxShadow: `0 0 10px ${statusMeta.color}88`,
            borderRadius: 6,
            transition: 'width 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        />
      </div>

      {/* Modal de Histórico de Auditoria da Defesa */}
      {showLogModal && (
        <div className="loot-modal-overlay" onClick={() => setShowLogModal(false)} style={{ zIndex: 10000 }}>
          <div
            className="glass"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '560px',
              maxWidth: '95vw',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: '14px',
              padding: '18px',
              border: '1px solid var(--glass-border)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.8)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottom: '1px solid var(--glass-border)', paddingBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>🛡️</span>
                <strong style={{ fontSize: 14, textTransform: 'uppercase', color: '#fff', fontFamily: 'Oswald', letterSpacing: 1 }}>
                  Histórico de Alterações na Defesa
                </strong>
              </div>
              <button
                type="button"
                onClick={() => setShowLogModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 4 }}>
              {logs.map((log) => {
                const isDamage = (log.delta ?? 0) < 0
                return (
                  <div
                    key={log.id}
                    className="glass-light"
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      borderLeft: `4px solid ${isDamage ? '#ef4444' : '#22c55e'}`,
                      background: 'rgba(0,0,0,0.3)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>
                          {log.previousHp} ➔ {log.newHp}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            color: isDamage ? '#ef4444' : '#22c55e',
                            background: isDamage ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                            padding: '1px 6px',
                            borderRadius: 4
                          }}
                        >
                          {log.delta > 0 ? `+${log.delta}` : log.delta} de defesa
                        </span>
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        {log.gameDateFormatted ? `📅 ${log.gameDateFormatted} — ${log.gameTimeString || ''}` : new Date(log.createdAt).toLocaleString('pt-BR')}
                      </span>
                    </div>

                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                      "{log.reason}"
                    </div>

                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'right' }}>
                      Registrado por: <strong style={{ color: 'var(--text-primary)' }}>{log.adminName || 'Admin'}</strong>
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ marginTop: 14, textAlign: 'right' }}>
              <button className="btn btn-sm btn-primary" onClick={() => setShowLogModal(false)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
