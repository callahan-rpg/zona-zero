import { useState, useEffect } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../contexts/AuthContext.jsx'
import HUD from '../components/HUD.jsx'

const ATTRIBUTES = [
  { key: 'forca',        label: 'Força',        icon: '💪' },
  { key: 'destreza',     label: 'Destreza',     icon: '🏃' },
  { key: 'sabedoria',    label: 'Sabedoria',    icon: '🧠' },
  { key: 'carisma',      label: 'Carisma',      icon: '🗣️' },
  { key: 'constituicao', label: 'Constituição', icon: '🛡️' },
]

function xpForNextLevel(level) {
  return level * 100
}

export default function Character() {
  const { user, character, transferItem } = useAuth()

  // Estados do Modal de Transferência
  const [showTransfer, setShowTransfer] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [transferQty, setTransferQty] = useState(1)
  const [recipientUid, setRecipientUid] = useState('')
  const [survivors, setSurvivors] = useState([])
  const [loadingSurvivors, setLoadingSurvivors] = useState(false)
  const [transferLoading, setTransferLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Carrega lista de outros sobreviventes para transferência
  useEffect(() => {
    if (!showTransfer || !user) return

    async function loadSurvivors() {
      setLoadingSurvivors(true)
      try {
        const snap = await getDocs(collection(db, 'users'))
        const list = snap.docs
          .map((d) => ({ uid: d.id, ...d.data().character }))
          .filter((c) => c.uid !== user.uid && !!c.name) // Remove eu mesmo e contas incompletas
        setSurvivors(list)
        if (list.length > 0) {
          setRecipientUid(list[0].uid)
        }
      } catch (err) {
        console.error('Erro ao buscar sobreviventes:', err)
      } finally {
        setLoadingSurvivors(false)
      }
    }

    loadSurvivors()
  }, [showTransfer, user])

  if (!character) {
    return (
      <div className="loading-screen">
        <span className="loading-dot" />
      </div>
    )
  }

  const xpProgress = Math.min((character.xp / xpForNextLevel(character.level)) * 100, 100)

  function openTransfer(item) {
    setSelectedItem(item)
    setTransferQty(1)
    setError('')
    setSuccess('')
    setShowTransfer(true)
  }

  async function handleTransferSubmit(e) {
    e.preventDefault()
    if (!selectedItem || !recipientUid) return
    setError('')
    setSuccess('')
    setTransferLoading(true)

    try {
      await transferItem(recipientUid, selectedItem.instanceId, Number(transferQty))
      setSuccess('Item transferido com sucesso!')
      // Espera 1.5s e fecha o modal
      setTimeout(() => {
        setShowTransfer(false)
        setSelectedItem(null)
      }, 1500)
    } catch (err) {
      setError(err.message || 'Erro ao transferir item.')
    } finally {
      setTransferLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <HUD />

      <div className="character-page">
        <div className="character-card">
          {/* Header: avatar + nome + nível */}
          <div className="character-header">
            <div className="character-avatar-container">
              {character.avatarUrl ? (
                <img
                  className="character-avatar"
                  src={character.avatarUrl}
                  alt={character.name}
                />
              ) : (
                <div className="character-avatar-placeholder">🧟</div>
              )}
              <div className="character-level-badge">Nv {character.level}</div>
            </div>

            <div className="character-info">
              <div className="character-name">{character.name}</div>
              <div className="character-age">{character.age} anos</div>

              <div className="xp-bar-container">
                <div className="xp-bar-label">
                  <span>Experiência</span>
                  <span>{character.xp} / {xpForNextLevel(character.level)} XP</span>
                </div>
                <div className="xp-bar">
                  <div className="xp-bar-fill" style={{ width: `${xpProgress}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Atributos */}
          <div className="character-attributes">
            <p className="section-title">Atributos</p>
            <div className="attributes-grid">
              {ATTRIBUTES.map(({ key, label, icon }) => (
                <div className="attr-card" key={key}>
                  <span className="attr-icon">{icon}</span>
                  <span className="attr-value">{character.attributes?.[key] ?? 1}</span>
                  <span className="attr-name">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Inventário */}
          <div className="character-inventory">
            <p className="section-title" style={{ paddingTop: 4 }}>Inventário</p>

            {!character.inventory || character.inventory.length === 0 ? (
              <div className="inventory-empty">
                <p>📦 Inventário vazio</p>
                <p style={{ marginTop: 8, fontSize: 12 }}>
                  Explore os locais para encontrar recursos.
                </p>
              </div>
            ) : (
              <div className="inventory-grid">
                {character.inventory.map((item) => (
                  <div className="inventory-item" key={item.instanceId} style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span className="inventory-item-icon">{item.icon || '📦'}</span>
                      <div className="inventory-item-info" style={{ flex: 1 }}>
                        <div className="inventory-item-name">{item.name}</div>
                        <div className="inventory-item-qty">×{item.quantity}</div>
                      </div>
                    </div>
                    
                    <button
                      className="btn btn-sm"
                      style={{ fontSize: 11, padding: '4px 8px', borderRadius: '4px', width: '100%' }}
                      onClick={() => openTransfer(item)}
                    >
                      🤝 Transferir
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Transferência */}
      {showTransfer && selectedItem && (
        <div className="loot-modal-overlay" onClick={() => !transferLoading && setShowTransfer(false)}>
          <div className="loot-modal" onClick={(e) => e.stopPropagation()} style={{ width: '380px', textAlign: 'left' }}>
            <h3 style={{ color: 'var(--accent)', marginBottom: 16 }}>🤝 Transferir Recurso</h3>

            {error && <div className="form-error">{error}</div>}
            {success && <div className="form-error" style={{ color: 'var(--accent)', borderColor: 'rgba(92, 255, 122, 0.3)', background: 'rgba(92, 255, 122, 0.1)' }}>{success}</div>}

            <form onSubmit={handleTransferSubmit}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', marginBottom: 16 }}>
                <span style={{ fontSize: 24 }}>{selectedItem.icon}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 'bold' }}>{selectedItem.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Você possui: {selectedItem.quantity} unidades</div>
                </div>
              </div>

              <div className="form-group">
                <label>Enviar para</label>
                {loadingSurvivors ? (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Buscando sobreviventes...</p>
                ) : survivors.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--accent-red)' }}>Nenhum outro sobrevivente online.</p>
                ) : (
                  <select
                    value={recipientUid}
                    onChange={(e) => setRecipientUid(e.target.value)}
                    required
                  >
                    {survivors.map((s) => (
                      <option key={s.uid} value={s.uid}>
                        {s.name} (Nv {s.level || 1})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="form-group">
                <label>Quantidade</label>
                <input
                  type="number"
                  min="1"
                  max={selectedItem.quantity}
                  value={transferQty}
                  onChange={(e) => setTransferQty(Math.min(selectedItem.quantity, Math.max(1, Number(e.target.value))))}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                <button
                  type="button"
                  className="btn"
                  style={{ flex: 1 }}
                  onClick={() => setShowTransfer(false)}
                  disabled={transferLoading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 2 }}
                  disabled={transferLoading || survivors.length === 0}
                >
                  {transferLoading ? 'Transferindo...' : 'Confirmar Envio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
