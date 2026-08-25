import { useState, useEffect, useMemo } from 'react'
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

export const INVENTORY_CATEGORIES = [
  { id: 'all',      label: 'Todos',              icon: '📦' },
  { id: 'general',  label: 'Itens Gerais',       icon: '🎒' },
  { id: 'clothing', label: 'Roupas',             icon: '👕' },
  { id: 'melee',    label: 'Armas Brancas',      icon: '🗡️' },
  { id: 'firearms', label: 'Armas de Fogo',      icon: '🔫' },
  { id: 'medical',  label: 'Suprimentos Médicos', icon: '💉' },
]

export function getItemCategory(item) {
  if (item.category) {
    const cat = item.category.toLowerCase().trim()
    if (['general', 'geral', 'itens gerais'].includes(cat)) return 'general'
    if (['clothing', 'roupas', 'roupa', 'vestimenta', 'equipamento'].includes(cat)) return 'clothing'
    if (['melee', 'armas brancas', 'branca', 'corpo a corpo'].includes(cat)) return 'melee'
    if (['firearms', 'armas de fogo', 'fogo', 'armas'].includes(cat)) return 'firearms'
    if (['medical', 'suprimentos medicos', 'medico', 'médico', 'cura'].includes(cat)) return 'medical'
    return cat
  }

  // Inferência inteligente baseada no nome / itemId
  const text = `${item.itemId || ''} ${item.name || ''}`.toLowerCase()

  // Médicos
  if (
    /atadura|analges|seringa|antibi|sutura|remed|curativo|medic|cura|pilula|pílula|gaze|bandagem|alcool|álcool|morfina|kit/i.test(text)
  ) {
    return 'medical'
  }

  // Armas de Fogo & Munições
  if (
    /pistola|revolv|espingarda|shotgun|rifle|fuzil|submetralhadora|municao|munição|bala|cartucho|carregador|glock|beretta|ak47|m4|escopeta|arma de fogo/i.test(text)
  ) {
    return 'firearms'
  }

  // Armas Brancas
  if (
    /faca|adaga|machado|taco|porrete|bastao|bastão|pe de cabra|pé de cabra|espada|lamina|lâmina|foice|martelo|barra de ferro|cano|estilete|canivete|arma branca/i.test(text)
  ) {
    return 'melee'
  }

  // Roupas & Vestuário
  if (
    /roupa|casaco|jaqueta|camisa|camiseta|calca|calça|bota|tenis|tênis|mochila|capacete|luva|colete|bone|boné|chapeu|chapéu|mascara|máscara|uniforme|cinto/i.test(text)
  ) {
    return 'clothing'
  }

  return 'general'
}

const CATEGORY_LABELS = {
  general:  { label: 'Item Geral',         color: 'var(--text-muted)' },
  clothing: { label: 'Roupa / Vestuário',  color: '#70d6ff' },
  melee:    { label: 'Arma Branca',        color: '#ff9770' },
  firearms: { label: 'Arma de Fogo',       color: '#ff70a6' },
  medical:  { label: 'Suprimento Médico',  color: '#5cff7a' },
}

function xpForNextLevel(level) {
  return (level || 1) * 100
}

export default function Character() {
  const { user, character, transferItem } = useAuth()

  // Filtro de aba ativo
  const [activeCategory, setActiveCategory] = useState('all')

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

  const inventory = character?.inventory || []

  // Agrupamento e contagem por categorias
  const { filteredItems, categoryCounts } = useMemo(() => {
    const counts = {
      all: inventory.length,
      general: 0,
      clothing: 0,
      melee: 0,
      firearms: 0,
      medical: 0,
    }

    const categorized = inventory.map((item) => {
      const cat = getItemCategory(item)
      if (counts[cat] !== undefined) counts[cat]++
      else counts.general++
      return { ...item, _category: cat }
    })

    const filtered = activeCategory === 'all'
      ? categorized
      : categorized.filter((item) => item._category === activeCategory)

    return { filteredItems: filtered, categoryCounts: counts }
  }, [inventory, activeCategory])

  if (!character) {
    return (
      <div className="loading-screen">
        <span className="loading-dot" />
      </div>
    )
  }

  const xpMax = xpForNextLevel(character.level)
  const xpCurrent = character.xp || 0
  const xpProgress = Math.min((xpCurrent / xpMax) * 100, 100)

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
        <div className="character-layout-grid">
          {/* COLUNA ESQUERDA: Perfil + Nível + XP + Atributos */}
          <div className="character-profile-panel">
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
                <div className="character-level-badge">Nv {character.level || 1}</div>
              </div>

              <div className="character-info">
                <div className="character-name">{character.name}</div>
                <div className="character-age">{character.age || '??'} anos · Sobrevivente</div>

                <div className="xp-bar-container">
                  <div className="xp-bar-label">
                    <span>Experiência</span>
                    <span>{xpCurrent} / {xpMax} XP</span>
                  </div>
                  <div className="xp-bar">
                    <div className="xp-bar-fill" style={{ width: `${xpProgress}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Atributos */}
            <div className="character-attributes">
              <p className="section-title">Atributos de Sobrevivência</p>
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
          </div>

          {/* COLUNA DIREITA: Mochila & Inventário com Abas */}
          <div className="character-inventory-panel">
            <div className="inventory-header-row">
              <div>
                <p className="section-title" style={{ marginBottom: 4 }}>Mochila & Inventário</p>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Total de itens: <strong style={{ color: 'var(--accent)' }}>{inventory.length}</strong>
                </span>
              </div>
            </div>

            {/* Abas de Categoria */}
            <div className="inventory-tabs">
              {INVENTORY_CATEGORIES.map((cat) => {
                const count = categoryCounts[cat.id] || 0
                return (
                  <button
                    key={cat.id}
                    type="button"
                    className={`inventory-tab-btn ${activeCategory === cat.id ? 'active' : ''}`}
                    onClick={() => setActiveCategory(cat.id)}
                  >
                    <span className="tab-icon">{cat.icon}</span>
                    <span className="tab-label">{cat.label}</span>
                    <span className="tab-badge">{count}</span>
                  </button>
                )
              })}
            </div>

            {/* Grid de Itens Filtrados */}
            {filteredItems.length === 0 ? (
              <div className="inventory-empty">
                <p className="inventory-empty-icon">
                  {INVENTORY_CATEGORIES.find((c) => c.id === activeCategory)?.icon || '📦'}
                </p>
                <p style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Nenhum item nesta categoria
                </p>
                <p style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                  {activeCategory === 'all'
                    ? 'Explore as salas e faça buscas de suprimentos para encontrar recursos.'
                    : 'Colete ou transfira itens desta categoria durante suas expedições.'}
                </p>
              </div>
            ) : (
              <div className="inventory-grid">
                {filteredItems.map((item) => {
                  const catMeta = CATEGORY_LABELS[item._category] || CATEGORY_LABELS.general
                  return (
                    <div className="inventory-item-card" key={item.instanceId}>
                      <div className="inventory-item-top">
                        <span className="inventory-item-card-icon">{item.icon || '📦'}</span>
                        <span
                          className="inventory-item-category-tag"
                          style={{ color: catMeta.color, borderColor: catMeta.color }}
                        >
                          {catMeta.label}
                        </span>
                      </div>

                      <div className="inventory-item-main">
                        <div className="inventory-item-card-name" title={item.name}>
                          {item.name}
                        </div>
                        <div className="inventory-item-card-qty">
                          Quantidade: <span>×{item.quantity}</span>
                        </div>
                      </div>

                      <button
                        className="btn btn-sm inventory-transfer-btn"
                        onClick={() => openTransfer(item)}
                        title="Transferir item para outro sobrevivente"
                      >
                        <span>🤝</span>
                        <span>Transferir</span>
                      </button>
                    </div>
                  )
                })}
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
