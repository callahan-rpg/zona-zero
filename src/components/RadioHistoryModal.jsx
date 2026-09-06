import { useState, useEffect, useMemo } from 'react'
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore'
import { db } from '../firebase/config'
import { playRadioChime } from '../utils/radioSystem'
import GameIcon from './GameIcon.jsx'

export default function RadioHistoryModal({
  isOpen,
  onClose,
  pointName = 'Rádio do Acampamento',
  locationName = 'Casa Grande — 2º Andar'
}) {
  const [transmissions, setTransmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')

  useEffect(() => {
    if (!isOpen) return

    setLoading(true)
    playRadioChime()

    const q = query(
      collection(db, 'radio_transmissions'),
      orderBy('timestamp', 'desc'),
      limit(100)
    )

    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setTransmissions(docs)
      setLoading(false)
    }, (err) => {
      console.warn('Erro ao carregar transmissões de rádio:', err)
      setLoading(false)
    })

    return () => unsub()
  }, [isOpen])

  // Categorias únicas para filtro
  const categories = useMemo(() => {
    const set = new Set()
    transmissions.forEach(t => {
      if (t.category) set.add(t.category)
    })
    return ['all', ...Array.from(set)]
  }, [transmissions])

  // Transmissões filtradas
  const filteredTransmissions = useMemo(() => {
    return transmissions.filter(t => {
      const matchCat = selectedCategory === 'all' || t.category === selectedCategory
      const q = searchQuery.toLowerCase().trim()
      const matchQ = !q ||
        (t.message || '').toLowerCase().includes(q) ||
        (t.senderName || '').toLowerCase().includes(q) ||
        (t.gameDateFormatted || '').toLowerCase().includes(q)

      return matchCat && matchQ
    })
  }, [transmissions, selectedCategory, searchQuery])

  if (!isOpen) return null

  return (
    <div className="loot-modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div
        className="glass"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '640px',
          maxWidth: '95vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '16px',
          border: '1px solid rgba(34, 197, 94, 0.35)',
          background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(10, 15, 29, 0.98) 100%)',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.85), 0 0 30px rgba(34, 197, 94, 0.15)',
          overflow: 'hidden',
          animation: 'popoverFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Topo do Rádio com Mostrador Analógico */}
        <div
          style={{
            padding: '16px 20px',
            background: 'linear-gradient(90deg, rgba(20, 83, 45, 0.3) 0%, rgba(15, 23, 42, 0.6) 100%)',
            borderBottom: '1px solid rgba(34, 197, 94, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: 'rgba(34, 197, 94, 0.15)',
                border: '1px solid #22c55e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                boxShadow: '0 0 16px rgba(34, 197, 94, 0.25)'
              }}
            >
              📻
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontFamily: 'Oswald', letterSpacing: 1, textTransform: 'uppercase', color: '#86efac' }}>
                  {pointName}
                </h3>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: 'rgba(34, 197, 94, 0.2)',
                    color: '#4ade80',
                    border: '1px solid rgba(34, 197, 94, 0.4)',
                    letterSpacing: 0.5
                  }}
                >
                  FREQ 144.800 MHz • SINAL ATIVO
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                📍 {locationName} • Histórico permanente de escuta
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={playRadioChime}
              className="btn btn-sm"
              title="Testar sinal de rádio"
              style={{ fontSize: 11, padding: '4px 10px', background: 'rgba(34, 197, 94, 0.12)', border: '1px solid rgba(34, 197, 94, 0.3)', color: '#86efac' }}
            >
              🔊 Sintonia
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-sm"
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer', padding: '4px 8px' }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Barra de Filtros & Busca */}
        <div style={{ padding: '12px 20px', background: 'rgba(0,0,0,0.25)', borderBottom: '1px solid var(--glass-border)', display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              type="text"
              placeholder="🔍 Buscar comunicado, data ou alerta no registro..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', fontSize: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, color: '#fff' }}
            />
          </div>
          {categories.length > 2 && (
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{ padding: '7px 10px', fontSize: 12, background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'var(--text-primary)' }}
            >
              <option value="all">📡 Todas as Categorias</option>
              {categories.filter(c => c !== 'all').map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
        </div>

        {/* Lista de Transmissões / Diário de Escuta */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 24, marginBottom: 8, animation: 'pulse 1.2s infinite' }}>📻</div>
              Sintonizando frequência de rádio...
            </div>
          ) : filteredTransmissions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', borderRadius: 10, border: '1px dashed rgba(255,255,255,0.08)' }}>
              <span style={{ fontSize: 32, display: 'block', marginBottom: 8 }}>🔇</span>
              <strong style={{ display: 'block', color: 'var(--text-primary)', marginBottom: 4 }}>Nenhuma transmissão registrada</strong>
              Nenhum comunicado foi captado nesta frequência até o momento.
            </div>
          ) : (
            filteredTransmissions.map((t) => (
              <div
                key={t.id}
                className="glass-light"
                style={{
                  padding: '14px 16px',
                  borderRadius: '10px',
                  borderLeft: '4px solid #22c55e',
                  background: 'rgba(0, 0, 0, 0.4)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>📡</span>
                    <strong style={{ fontSize: 13, color: '#86efac', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {t.senderName || 'Rádio do Acampamento'}
                    </strong>
                    {t.category && (
                      <span style={{ fontSize: 10, background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', padding: '2px 6px', borderRadius: 4, border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                        {t.category}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    {t.gameDateFormatted ? `📅 ${t.gameDateFormatted} — ${t.gameTimeString || ''}` : new Date(t.createdAt).toLocaleString('pt-BR')}
                  </div>
                </div>

                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 6,
                    background: 'rgba(15, 23, 42, 0.75)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    fontSize: 13,
                    color: '#f1f5f9',
                    lineHeight: 1.5,
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  "{t.message}"
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, color: 'var(--text-muted)' }}>
                  <span>
                    Origem: <strong style={{ color: '#94a3b8' }}>{t.type === 'auto' ? 'Transmissão Agendada' : 'Transmissão Manual'}</strong>
                  </span>
                  <span>
                    Ouvintes com Rádio: <strong style={{ color: '#22c55e' }}>{t.recipientsCount ?? 0} sobrevivente(s)</strong>
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Rodapé */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Exibindo {filteredTransmissions.length} de {transmissions.length} registro(s) de escuta
          </span>
          <button className="btn btn-sm btn-primary" onClick={onClose} style={{ padding: '6px 18px' }}>
            Fechar Rádio
          </button>
        </div>
      </div>
    </div>
  )
}
