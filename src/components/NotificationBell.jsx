import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { RARITY_META } from '../utils/itemSystem.js'

export default function NotificationBell() {
  const { character, markNotificationsRead, clearNotifications } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const toastTimeoutRef = useRef(null)
  const lastProcessedIdRef = useRef(null)
  const popoverRef = useRef(null)

  const notifications = character?.notifications || []
  const unreadCount = notifications.filter(n => !n.read).length

  // Observa novas notificações para disparar o toast popup de 10s
  useEffect(() => {
    if (notifications.length === 0) return

    const latest = notifications[0]
    // Se for uma notificação nova que ainda não processamos neste ciclo
    if (latest && !latest.read && latest.id !== lastProcessedIdRef.current) {
      lastProcessedIdRef.current = latest.id
      setToast(latest)

      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
      toastTimeoutRef.current = setTimeout(() => {
        setToast(null)
      }, 10000) // 10 segundos
    }
  }, [notifications])

  // Fecha o popover se clicar fora
  useEffect(() => {
    function handleClickOutside(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  function handleToggleOpen() {
    setIsOpen(prev => {
      const next = !prev
      if (next && unreadCount > 0) {
        markNotificationsRead()
      }
      return next
    })
  }

  function formatTime(isoString) {
    if (!isoString) return ''
    const d = new Date(isoString)
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' · ' + d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  }

  return (
    <div style={{ position: 'relative' }} ref={popoverRef}>
      {/* Botão Sininho no Menu */}
      <button
        type="button"
        className={`hud-btn ${isOpen ? 'active' : ''}`}
        onClick={handleToggleOpen}
        title="Notificações de Itens"
        style={{ position: 'relative', padding: '7px 10px' }}
      >
        <span className="hud-btn-icon" style={{ fontSize: 16 }}>🔔</span>
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              background: '#ef4444',
              color: '#fff',
              fontSize: 10,
              fontWeight: 800,
              minWidth: 18,
              height: 18,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid var(--bg-primary)',
              animation: 'pulse 1.8s infinite',
              padding: '0 3px'
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover / Histórico de Notificações */}
      {isOpen && (
        <div
          className="glass"
          style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            right: 0,
            width: '330px',
            maxHeight: '420px',
            display: 'flex',
            flexDirection: 'column',
            borderRadius: '12px',
            padding: '14px',
            zIndex: 1000,
            boxShadow: '0 16px 36px rgba(0,0,0,0.7)',
            border: '1px solid var(--glass-border)',
            animation: 'popoverFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 16 }}>🔔</span>
              <strong style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--text-primary)', letterSpacing: 0.5 }}>
                Notificações
              </strong>
            </div>
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={clearNotifications}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer', padding: '2px 6px' }}
                title="Limpar histórico"
              >
                Limpar tudo
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', maxHeight: '320px', paddingRight: 4 }}>
            {notifications.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)', fontSize: 12 }}>
                <span style={{ fontSize: 24, display: 'block', marginBottom: 6 }}>📭</span>
                Nenhuma notificação no momento.
              </div>
            ) : (
              notifications.map((n) => {
                const rarity = RARITY_META[n.item?.rarity] || { label: 'Comum', color: '#9ca3af' }
                return (
                  <div
                    key={n.id}
                    className="glass-light"
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      borderLeft: `3px solid ${n.read ? 'rgba(255,255,255,0.15)' : 'var(--accent)'}`,
                      background: n.read ? 'rgba(255,255,255,0.02)' : 'rgba(92,255,122,0.05)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {n.senderAvatar ? (
                        <img
                          src={n.senderAvatar}
                          alt={n.senderName}
                          style={{ width: 24, height: 24, borderRadius: 6, objectFit: 'cover', border: '1px solid var(--glass-border)' }}
                          onError={(e) => { e.target.onerror = null; e.target.src = ''; }}
                        />
                      ) : (
                        <span style={{ fontSize: 16 }}>👤</span>
                      )}
                      <div style={{ minWidth: 0, flex: 1, fontSize: 12 }}>
                        <strong style={{ color: '#fff' }}>{n.senderName}</strong>
                        <span style={{ color: 'var(--text-muted)' }}> te enviou um item:</span>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'rgba(0,0,0,0.3)',
                        padding: '6px 10px',
                        borderRadius: 6,
                        border: '1px solid rgba(255,255,255,0.04)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        <span style={{ fontSize: 18 }}>{n.item?.icon || '📦'}</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 'bold', color: rarity.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {n.item?.name}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                            Qtd: {n.item?.quantity || 1} · {rarity.label}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'right', fontStyle: 'italic' }}>
                      🕒 {formatTime(n.createdAt)}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* POP-UP TOAST NO CANTO DIREITO (Auto-hide após 10s) */}
      {toast && (
        <div
          className="glass"
          style={{
            position: 'fixed',
            top: 'calc(var(--hud-height, 60px) + 16px)',
            right: '20px',
            width: '320px',
            padding: '14px 16px',
            borderRadius: '12px',
            border: '1px solid var(--accent)',
            background: 'rgba(15, 23, 42, 0.95)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.8), 0 0 16px rgba(92,255,122,0.2)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            animation: 'toastSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 16 }}>🎁</span>
              <strong style={{ fontSize: 12, textTransform: 'uppercase', color: 'var(--accent)', letterSpacing: 0.5 }}>
                Item Recebido!
              </strong>
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 16, cursor: 'pointer', padding: 0 }}
            >
              ✕
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {toast.senderAvatar ? (
              <img
                src={toast.senderAvatar}
                alt={toast.senderName}
                style={{ width: 34, height: 34, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--glass-border)' }}
                onError={(e) => { e.target.onerror = null; e.target.src = ''; }}
              />
            ) : (
              <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                👤
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0, fontSize: 12, lineHeight: 1.3 }}>
              <div><strong style={{ color: '#fff' }}>{toast.senderName}</strong> te enviou:</div>
              <div style={{ color: 'var(--accent)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <span>{toast.item?.icon}</span>
                <span>{toast.item?.quantity}x {toast.item?.name}</span>
              </div>
            </div>
          </div>

          {/* Barra de progresso visual de 10s */}
          <div style={{ width: '100%', height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden', marginTop: 2 }}>
            <div
              style={{
                width: '100%',
                height: '100%',
                background: 'var(--accent)',
                animation: 'toastProgress 10s linear forwards'
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
