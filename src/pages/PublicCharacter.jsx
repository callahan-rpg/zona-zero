import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import HUD from '../components/HUD.jsx'
import { getItemCategory, INVENTORY_CATEGORIES } from './Character.jsx'

const ATTRIBUTES = [
  { key: 'forca',        label: 'Força',        icon: '💪' },
  { key: 'destreza',     label: 'Destreza',     icon: '🏃' },
  { key: 'sabedoria',    label: 'Sabedoria',     icon: '🧠' },
  { key: 'carisma',      label: 'Carisma',       icon: '🗣️' },
  { key: 'constituicao', label: 'Constituição',  icon: '🛡️' },
]

const CATEGORY_LABELS = {
  general:  { label: 'Item Geral',        color: 'var(--text-muted)' },
  clothing: { label: 'Roupa / Vestuário', color: '#70d6ff' },
  melee:    { label: 'Arma Branca',       color: '#ff9770' },
  firearms: { label: 'Arma de Fogo',      color: '#ff70a6' },
  medical:  { label: 'Suprimento Médico', color: '#5cff7a' },
}

function xpForNextLevel(level) {
  return (level || 1) * 100
}

export default function PublicCharacter() {
  const { uid } = useParams()
  const navigate = useNavigate()

  const [character, setCharacter] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [activeCategory, setActiveCategory] = useState('all')

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const docRef = doc(db, 'users', uid)
        const docSnap = await getDoc(docRef)
        if (docSnap.exists() && docSnap.data().character?.name) {
          setCharacter(docSnap.data().character)
        } else {
          setNotFound(true)
        }
      } catch {
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [uid])

  const inventory = character?.inventory || []

  const { filteredItems, categoryCounts } = useMemo(() => {
    const counts = { all: inventory.length, general: 0, clothing: 0, melee: 0, firearms: 0, medical: 0 }
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

  if (loading) {
    return <div className="loading-screen"><span className="loading-dot" /></div>
  }

  if (notFound) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
        <HUD />
        <div className="character-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass" style={{ padding: 40, textAlign: 'center', maxWidth: 400 }}>
            <p style={{ fontSize: 48, marginBottom: 16 }}>🧟</p>
            <h2 style={{ fontFamily: 'Oswald', letterSpacing: 2, color: 'var(--accent)', marginBottom: 12 }}>
              Sobrevivente não encontrado
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
              Este sobrevivente pode ter perecido na Zona Zero.
            </p>
            <button className="btn btn-primary" onClick={() => navigate('/characters')}>
              ← Voltar aos Sobreviventes
            </button>
          </div>
        </div>
      </div>
    )
  }

  const xpMax = xpForNextLevel(character.level)
  const xpCurrent = character.xp || 0
  const xpProgress = Math.min((xpCurrent / xpMax) * 100, 100)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <HUD />

      <div className="character-page">
        {/* Botão Voltar */}
        <div style={{ maxWidth: 1200, margin: '0 auto 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            className="btn"
            onClick={() => navigate('/characters')}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            ← Voltar
          </button>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', letterSpacing: 1 }}>
            Visualizando ficha de sobrevivente
          </span>
        </div>

        <div className="character-layout-grid">
          {/* COLUNA ESQUERDA: Perfil + Atributos */}
          <div className="character-profile-panel">
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

          {/* COLUNA DIREITA: Inventário (somente-leitura) */}
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

            {/* Grid de Itens */}
            {filteredItems.length === 0 ? (
              <div className="inventory-empty">
                <p className="inventory-empty-icon">
                  {INVENTORY_CATEGORIES.find((c) => c.id === activeCategory)?.icon || '📦'}
                </p>
                <p style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Nenhum item nesta categoria
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
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
