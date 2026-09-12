import { useState, useEffect } from 'react'
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  updateDoc
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { useItemCatalog } from '../utils/itemCatalogService'
import { DEFAULT_WATER_SOURCES } from '../utils/waterSystem'
import { DEFAULT_PRESET_ITEMS } from '../utils/itemSystem'
import { uploadImageFree } from '../utils/imageUpload'

const EMPTY_FORM = {
  id: '',
  name: '',
  icon: '💧',
  buttonImage: '',
  locationSlug: '',
  locationName: '',
  description: '',
  enabled: true,
  requiredItem: 'garrafa_vazia',
  requiredItemName: 'Garrafa de Água Vazia',
  requiredQuantity: 1,
  producedItem: 'garrafa_agua_impura',
  producedItemName: 'Garrafa de Água Impura',
  producedQuantity: 1,
  durationSec: 3
}

export default function AdminWaterSourcesEditor({ locations = [] }) {
  const [sources, setSources] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // Usa o listener único compartilhado de items_db (cache global)
  const { list: itemsDbLive } = useItemCatalog()

  // Escuta fontes de água do Firestore (/water_sources)
  useEffect(() => {
    const unsubSources = onSnapshot(collection(db, 'water_sources'), (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setSources(docs)
      setLoading(false)
    }, (err) => {
      console.error('Erro ao carregar fontes de água:', err)
      setLoading(false)
    })
    return unsubSources
  }, [])

  // Lista unificada e filtrada de itens de mantimentos / recipientes
  const supplyItems = (() => {
    const map = new Map()

    DEFAULT_PRESET_ITEMS.filter(i => {
      const cat = String(i.category || '').toLowerCase().trim()
      return cat === 'supplies' || cat === 'mantimentos' || cat === 'general'
    }).forEach(i => {
      map.set(i.itemId, { ...i, itemId: i.itemId })
    })

    itemsDbLive.forEach(i => {
      const id = i.itemId || i.id
      map.set(id, { ...i, itemId: id })
    })

    const list = Array.from(map.values())
    list.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    return list
  })()

  function handleStartEdit(source) {
    setEditingId(source.id)
    setForm({
      id: source.id,
      name: source.name || '',
      icon: source.icon || '💧',
      buttonImage: source.buttonImage || source.imageUrl || '',
      locationSlug: source.locationSlug || '',
      locationName: source.locationName || '',
      description: source.description || '',
      enabled: source.enabled !== false,
      requiredItem: source.requiredItem || 'garrafa_vazia',
      requiredItemName: source.requiredItemName || 'Garrafa de Água Vazia',
      requiredQuantity: Math.max(1, Number(source.requiredQuantity) || 1),
      producedItem: source.producedItem || 'garrafa_agua_impura',
      producedItemName: source.producedItemName || 'Garrafa de Água Impura',
      producedQuantity: Math.max(1, Number(source.producedQuantity) || 1),
      durationSec: Math.max(1, Number(source.durationSec) || 3)
    })
  }

  function handleCancelEdit() {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.name.trim()) return alert('Informe o nome da fonte de água.')
    if (!form.locationSlug) return alert('Selecione o local onde a fonte estará disponível.')

    const loc = locations.find(l => l.slug === form.locationSlug)
    const sourceId = form.id.trim() || `fonte_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`

    const reqPreset = supplyItems.find(i => (i.itemId || i.id) === form.requiredItem)
    const prodPreset = supplyItems.find(i => (i.itemId || i.id) === form.producedItem)

    const payload = {
      id: sourceId,
      name: form.name.trim(),
      icon: form.icon || '💧',
      buttonImage: (form.buttonImage || '').trim(),
      locationSlug: form.locationSlug,
      locationName: loc?.name || form.locationName || form.locationSlug,
      description: form.description.trim(),
      enabled: !!form.enabled,
      requiredItem: form.requiredItem || 'garrafa_vazia',
      requiredItemName: reqPreset?.name || form.requiredItemName || 'Garrafa de Água Vazia',
      requiredQuantity: Math.max(1, Number(form.requiredQuantity) || 1),
      producedItem: form.producedItem || 'garrafa_agua_impura',
      producedItemName: prodPreset?.name || form.producedItemName || 'Garrafa de Água Impura',
      producedQuantity: Math.max(1, Number(form.producedQuantity) || 1),
      durationSec: Math.max(1, Number(form.durationSec) || 3),
      updatedAt: new Date().toISOString()
    }

    try {
      setSaving(true)
      await setDoc(doc(db, 'water_sources', sourceId), payload, { merge: true })
      alert(`Fonte de Água "${payload.name}" salva com sucesso!`)
      handleCancelEdit()
    } catch (err) {
      alert('Erro ao salvar fonte de água: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(sourceId, sourceName) {
    if (!confirm(`Deseja realmente excluir a fonte de água "${sourceName || sourceId}"?`)) return
    try {
      await deleteDoc(doc(db, 'water_sources', sourceId))
      alert('Fonte de água excluída.')
      if (editingId === sourceId) handleCancelEdit()
    } catch (err) {
      alert('Erro ao excluir: ' + err.message)
    }
  }

  async function handleToggle(source) {
    try {
      await updateDoc(doc(db, 'water_sources', source.id), {
        enabled: source.enabled === false ? true : false
      })
    } catch (err) {
      alert('Erro ao alternar status: ' + err.message)
    }
  }

  async function handleSeedDefaults() {
    if (!confirm('Deseja criar as Fontes de Água Padrão (Lago de Sterilug, Poço da Fazenda, Rio das Pedras) no banco de dados agora?')) return
    try {
      setSaving(true)
      let count = 0
      for (const src of DEFAULT_WATER_SOURCES) {
        await setDoc(doc(db, 'water_sources', src.id), {
          ...src,
          updatedAt: new Date().toISOString()
        }, { merge: true })
        count++
      }
      alert(`Sucesso! ${count} fontes de água padrão foram cadastradas!`)
    } catch (err) {
      alert('Erro ao semear fontes: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const filteredSources = sources.filter(s => {
    if (!searchTerm) return true
    const q = searchTerm.toLowerCase()
    return (
      (s.name || '').toLowerCase().includes(q) ||
      (s.locationName || '').toLowerCase().includes(q) ||
      (s.locationSlug || '').toLowerCase().includes(q)
    )
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* CABEÇALHO & BARRA DE AÇÕES */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ fontSize: '18px', textTransform: 'uppercase', color: '#38bdf8', margin: 0, fontFamily: 'Oswald, sans-serif' }}>
            💧 Gerenciador de Fontes de Água
          </h3>
          <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>
            Configure rios, lagos, poços e reservatórios onde os sobreviventes podem coletar água impura com garrafas vazias.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={handleSeedDefaults}
            disabled={saving}
            style={{
              background: 'rgba(56, 189, 248, 0.15)',
              borderColor: '#38bdf8',
              color: '#7dd3fc',
              fontWeight: 700,
              fontSize: '11px',
              padding: '6px 12px'
            }}
          >
            ⚡ Criar Fontes de Água Padrão (1-Click)
          </button>
        </div>
      </div>

      {/* GRID PRINCIPAL: LISTAGEM À ESQUERDA, FORMULÁRIO À DIREITA */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>

        {/* COLUNA ESQUERDA: LISTA DE FONTES DE ÁGUA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase' }}>
              Fontes de Água Cadastradas ({filteredSources.length})
            </span>
            <input
              type="text"
              placeholder="Filtrar fontes..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ padding: '4px 8px', fontSize: '11px', width: '160px' }}
            />
          </div>

          {loading ? (
            <div className="glass-light" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
              ⏳ Carregando fontes de água...
            </div>
          ) : filteredSources.length === 0 ? (
            <div className="glass-light" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Nenhuma fonte de água cadastrada. Clique no botão <strong>"Criar Fontes de Água Padrão"</strong> acima para começar!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '650px', overflowY: 'auto' }}>
              {filteredSources.map(source => {
                const isEditing = editingId === source.id
                const isEnabled = source.enabled !== false
                return (
                  <div
                    key={source.id}
                    className="glass-light"
                    style={{
                      padding: '14px',
                      borderRadius: '10px',
                      border: isEditing ? '1px solid #38bdf8' : isEnabled ? '1px solid rgba(255,255,255,0.08)' : '1px dashed rgba(239,68,68,0.3)',
                      background: isEditing ? 'rgba(56, 189, 248, 0.12)' : isEnabled ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.15)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '24px' }}>{source.icon || '💧'}</span>
                        <div>
                          <strong style={{ fontSize: '14px', color: isEnabled ? '#fff' : 'var(--text-muted)' }}>
                            {source.name}
                          </strong>
                          <div style={{ fontSize: '11px', color: '#38bdf8' }}>
                            📍 {source.locationName || source.locationSlug}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => handleToggle(source)}
                          style={{
                            padding: '3px 8px',
                            fontSize: '10px',
                            background: isEnabled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                            borderColor: isEnabled ? '#10b981' : '#ef4444',
                            color: isEnabled ? '#34d399' : '#fca5a5'
                          }}
                        >
                          {isEnabled ? '✓ Ativa' : '✕ Inativa'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={() => handleStartEdit(source)}
                          style={{ padding: '3px 8px', fontSize: '10px' }}
                        >
                          ✏️ Editar
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDelete(source.id, source.name)}
                          style={{ padding: '3px 6px', fontSize: '10px' }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    {/* REQUISITO E RESULTADO */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', background: 'rgba(255,255,255,0.02)', padding: '6px 10px', borderRadius: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ color: '#94a3b8' }}>Requer:</span>
                        <span style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px', color: '#e2e8f0' }}>
                          {source.requiredQuantity || 1}x 🍾 {source.requiredItemName || source.requiredItem}
                        </span>
                      </div>
                      <span style={{ color: '#38bdf8', fontWeight: 700 }}>➔</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ color: '#94a3b8' }}>Produz:</span>
                        <span style={{ background: 'rgba(56, 189, 248, 0.15)', padding: '2px 6px', borderRadius: '4px', color: '#38bdf8', fontWeight: 700 }}>
                          +{source.producedQuantity || 1}x 🧪 {source.producedItemName || source.producedItem}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* COLUNA DIREITA: FORMULÁRIO DE CADASTRO / EDIÇÃO */}
        <form
          onSubmit={handleSave}
          className="glass-light"
          style={{
            padding: '18px',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            height: 'fit-content'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ fontSize: '13px', textTransform: 'uppercase', color: '#38bdf8', margin: 0 }}>
              {editingId ? '✏️ Editar Fonte de Água' : '➕ Nova Fonte de Água'}
            </h4>
            {editingId && (
              <button
                type="button"
                className="btn btn-sm"
                onClick={handleCancelEdit}
                style={{ fontSize: '10px', padding: '2px 8px' }}
              >
                Cancelar
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: '8px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '10px' }}>Emoji</label>
              <input
                type="text"
                value={form.icon}
                onChange={e => setForm(prev => ({ ...prev, icon: e.target.value }))}
                style={{ textAlign: 'center' }}
                required
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '10px' }}>Nome da Fonte</label>
              <input
                type="text"
                placeholder="Ex: Lago de Sterilug"
                value={form.name}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>
          </div>

          {/* Imagem / Ícone SVG Customizado */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: 10 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: '#e2e8f0', display: 'block', marginBottom: 4 }}>
              🖼️ Imagem ou Ícone SVG do Botão (Opcional)
            </label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {form.buttonImage ? (
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(0,0,0,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <img src={form.buttonImage} alt="Preview" style={{ width: 26, height: 26, objectFit: 'contain' }} />
                </div>
              ) : null}
              <input
                type="text"
                placeholder="URL da imagem (PNG, SVG, WebP) ou faça upload..."
                value={form.buttonImage || ''}
                onChange={e => setForm(prev => ({ ...prev, buttonImage: e.target.value }))}
                style={{ flex: 1, fontSize: 11 }}
              />
              <label
                style={{
                  background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2) 0%, rgba(14, 116, 144, 0.3) 100%)',
                  border: '1px solid #06b6d4',
                  color: '#67e8f9',
                  padding: '5px 8px',
                  borderRadius: 6,
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                📤 Upload
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    try {
                      const url = await uploadImageFree(file)
                      if (url) {
                        setForm(prev => ({ ...prev, buttonImage: url }))
                      }
                    } catch (err) {
                      alert('Falha no upload: ' + err.message)
                    }
                  }}
                />
              </label>
              {form.buttonImage && (
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, buttonImage: '' }))}
                  style={{
                    background: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid #ef4444',
                    color: '#fca5a5',
                    padding: '4px 6px',
                    borderRadius: 6,
                    fontSize: 10,
                    cursor: 'pointer'
                  }}
                  title="Remover imagem"
                >
                  ✕
                </button>
              )}
            </div>
            <span style={{ fontSize: 9, color: 'var(--text-muted)', display: 'block', marginTop: 4 }}>
              Se preenchido, o botão exibirá apenas esta imagem/ícone.
            </span>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '10px' }}>Locação / Sala do Jogo</label>
            <select
              value={form.locationSlug}
              onChange={e => {
                const slug = e.target.value
                const loc = locations.find(l => l.slug === slug)
                setForm(prev => ({
                  ...prev,
                  locationSlug: slug,
                  locationName: loc?.name || slug
                }))
              }}
              required
            >
              <option value="">Selecione o local...</option>
              {locations.map(loc => (
                <option key={loc.id || loc.slug} value={loc.slug}>
                  📍 {loc.name} ({loc.slug})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '10px' }}>Descrição Narrativa</label>
            <textarea
              rows="2"
              placeholder="Descreva a fonte, o riacho, a pureza visual da água..."
              value={form.description}
              onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
              style={{ width: '100%', padding: '8px', fontSize: '11px' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {/* RECIPIENTE EXIGIDO */}
            <div style={{ padding: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '6px' }}>
              <label style={{ fontSize: '10px', color: '#fbbf24', fontWeight: 700 }}>🍾 Recipiente Necessário</label>
              <select
                value={form.requiredItem}
                onChange={e => {
                  const val = e.target.value
                  const it = supplyItems.find(i => (i.itemId || i.id) === val)
                  setForm(prev => ({ ...prev, requiredItem: val, requiredItemName: it?.name || val }))
                }}
                style={{ fontSize: '11px', width: '100%', marginTop: '4px' }}
              >
                {supplyItems.map(it => (
                  <option key={it.itemId || it.id} value={it.itemId || it.id}>
                    {it.icon || '📦'} {it.name}
                  </option>
                ))}
              </select>
            </div>

            {/* ITEM PRODUZIDO */}
            <div style={{ padding: '8px', background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '6px' }}>
              <label style={{ fontSize: '10px', color: '#38bdf8', fontWeight: 700 }}>🧪 Item Produzido</label>
              <select
                value={form.producedItem}
                onChange={e => {
                  const val = e.target.value
                  const it = supplyItems.find(i => (i.itemId || i.id) === val)
                  setForm(prev => ({ ...prev, producedItem: val, producedItemName: it?.name || val }))
                }}
                style={{ fontSize: '11px', width: '100%', marginTop: '4px' }}
              >
                {supplyItems.map(it => (
                  <option key={it.itemId || it.id} value={it.itemId || it.id}>
                    {it.icon || '📦'} {it.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '9px' }}>Qtd Recipiente</label>
              <input
                type="number"
                min="1"
                value={form.requiredQuantity}
                onChange={e => setForm(prev => ({ ...prev, requiredQuantity: Math.max(1, Number(e.target.value) || 1) }))}
                style={{ fontSize: '11px', textAlign: 'center' }}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '9px' }}>Qtd Produzida</label>
              <input
                type="number"
                min="1"
                value={form.producedQuantity}
                onChange={e => setForm(prev => ({ ...prev, producedQuantity: Math.max(1, Number(e.target.value) || 1) }))}
                style={{ fontSize: '11px', textAlign: 'center' }}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '9px' }}>Tempo Coleta (s)</label>
              <input
                type="number"
                min="1"
                max="60"
                value={form.durationSec}
                onChange={e => setForm(prev => ({ ...prev, durationSec: Math.max(1, Number(e.target.value) || 1) }))}
                style={{ fontSize: '11px', textAlign: 'center' }}
                required
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              id="sourceEnabled"
              checked={form.enabled}
              onChange={e => setForm(prev => ({ ...prev, enabled: e.target.checked }))}
              style={{ width: 'auto' }}
            />
            <label htmlFor="sourceEnabled" style={{ margin: 0, fontSize: '11px', cursor: 'pointer' }}>
              Fonte de água ativa e disponível para coleta pelos sobreviventes
            </label>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
            style={{
              padding: '10px',
              fontSize: '13px',
              fontWeight: 700,
              background: '#0284c7',
              borderColor: '#0284c7',
              color: '#fff'
            }}
          >
            {saving ? '⏳ Salvando...' : editingId ? '💾 Atualizar Fonte' : '➕ Cadastrar Fonte de Água'}
          </button>
        </form>
      </div>
    </div>
  )
}
