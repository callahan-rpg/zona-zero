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
import { RARITY_META } from '../utils/itemSystem'
import { STORAGE_TYPES } from '../utils/storageSystem'
import GameIcon from './GameIcon'

export default function AdminStorageEditor({ locations = [], catalogItems = [] }) {
  const [storages, setStorages] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedStorageId, setSelectedStorageId] = useState(null)
  const [filterLocation, setFilterLocation] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Formulário de Cadastro/Edição
  const [storageForm, setStorageForm] = useState({
    storageId: '',
    name: '',
    description: '',
    icon: '📦',
    type: 'chest',
    locationSlug: '',
    maxSlots: 12,
    infinite: false,
    isLocked: false,
    keyItemId: '',
    passcode: '',
    lockedMessage: 'Este compartimento está trancado.',
    unlockMessage: 'Você destrancou o recipiente.',
    allowedCategories: []
  })

  // Estado para inserção direta de item pelo Admin
  const [newItem, setNewItem] = useState({
    itemId: '',
    quantity: 1
  })

  // Escuta todos os storages em tempo real
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'storages'), (snap) => {
      setStorages(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, (err) => {
      console.warn('Erro ao escutar storages no admin:', err)
      setLoading(false)
    })
    return unsub
  }, [])

  // Seleciona storage para edição
  function handleSelectStorage(st) {
    setSelectedStorageId(st.id)
    setStorageForm({
      storageId: st.storageId || st.id,
      name: st.name || '',
      description: st.description || '',
      icon: st.icon || '📦',
      type: st.type || 'chest',
      locationSlug: st.locationSlug || '',
      maxSlots: st.capacity?.maxSlots || 12,
      infinite: !!st.capacity?.infinite,
      isLocked: !!st.access?.isLocked,
      keyItemId: st.access?.keyItemId || '',
      passcode: st.access?.passcode || '',
      lockedMessage: st.access?.lockedMessage || 'Este compartimento está trancado.',
      unlockMessage: st.access?.unlockMessage || 'Você destrancou o recipiente.',
      allowedCategories: st.restrictions?.allowedCategories || []
    })
  }

  function handleResetForm() {
    setSelectedStorageId(null)
    setStorageForm({
      storageId: '',
      name: '',
      description: '',
      icon: '📦',
      type: 'chest',
      locationSlug: '',
      maxSlots: 12,
      infinite: false,
      isLocked: false,
      keyItemId: '',
      passcode: '',
      lockedMessage: 'Este compartimento está trancado.',
      unlockMessage: 'Você destrancou o recipiente.',
      allowedCategories: []
    })
  }

  // Salvar Storage
  async function handleSaveStorage(e) {
    e.preventDefault()
    if (!storageForm.storageId.trim()) return alert('Informe um ID único para o armazenamento.')
    if (!storageForm.name.trim()) return alert('Informe um nome para o recipiente.')

    const cleanId = storageForm.storageId.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '')
    const selectedType = STORAGE_TYPES[storageForm.type] || STORAGE_TYPES.chest

    const currentDoc = storages.find(s => s.id === cleanId)

    const payload = {
      storageId: cleanId,
      name: storageForm.name.trim(),
      description: storageForm.description.trim(),
      icon: storageForm.icon.trim() || selectedType.icon,
      type: storageForm.type,
      locationSlug: storageForm.locationSlug || null,
      capacity: {
        maxSlots: Math.max(1, Number(storageForm.maxSlots) || 12),
        infinite: !!storageForm.infinite
      },
      access: {
        isLocked: !!storageForm.isLocked,
        keyItemId: storageForm.keyItemId.trim() || null,
        passcode: storageForm.passcode.trim() || null,
        lockedMessage: storageForm.lockedMessage.trim(),
        unlockMessage: storageForm.unlockMessage.trim()
      },
      restrictions: {
        allowedCategories: storageForm.allowedCategories || []
      },
      items: currentDoc?.items || [],
      activityLog: currentDoc?.activityLog || [],
      updatedAt: new Date().toISOString()
    }

    if (!currentDoc) {
      payload.createdAt = new Date().toISOString()
    }

    try {
      await setDoc(doc(db, 'storages', cleanId), payload, { merge: true })
      alert('Armazenamento salvo com sucesso no Firestore!')
      handleResetForm()
    } catch (err) {
      alert('Erro ao salvar armazenamento: ' + err.message)
    }
  }

  // Excluir Storage
  async function handleDeleteStorage(id) {
    if (!confirm(`Deseja realmente excluir o recipiente "${id}"? Todos os itens guardados serão perdidos.`)) return
    try {
      await deleteDoc(doc(db, 'storages', id))
      if (selectedStorageId === id) handleResetForm()
      alert('Armazenamento excluído!')
    } catch (err) {
      alert('Erro ao excluir: ' + err.message)
    }
  }

  // Adicionar item diretamente pelo Admin no Storage selecionado
  async function handleAdminAddItem(e) {
    e.preventDefault()
    if (!selectedStorageId) return alert('Selecione um recipiente primeiro.')
    if (!newItem.itemId) return alert('Selecione um item do catálogo.')

    const catItem = catalogItems.find(i => i.itemId === newItem.itemId)
    if (!catItem) return alert('Item não encontrado no catálogo.')

    const targetStorage = storages.find(s => s.id === selectedStorageId)
    if (!targetStorage) return alert('Armazenamento não encontrado.')

    const items = [...(targetStorage.items || [])]
    const qty = Math.max(1, Number(newItem.quantity) || 1)

    const existingIndex = items.findIndex(i => i.itemId === newItem.itemId && !i.isQuestItem)
    if (existingIndex >= 0) {
      items[existingIndex].quantity = (items[existingIndex].quantity || 0) + qty
    } else {
      items.push({
        ...catItem,
        instanceId: 'st_adm_' + Math.random().toString(36).substring(2) + Date.now().toString(36),
        quantity: qty,
        storedAt: new Date().toISOString(),
        storedByUid: 'admin',
        storedByName: 'Administrador (Mestre)'
      })
    }

    try {
      await updateDoc(doc(db, 'storages', selectedStorageId), {
        items,
        updatedAt: new Date().toISOString()
      })
      setNewItem({ itemId: '', quantity: 1 })
      alert(`Adicionado ${qty}x ${catItem.name} ao recipiente!`)
    } catch (err) {
      alert('Erro ao adicionar item: ' + err.message)
    }
  }

  // Remover item diretamente pelo Admin
  async function handleAdminRemoveItem(instanceId) {
    if (!selectedStorageId) return
    const targetStorage = storages.find(s => s.id === selectedStorageId)
    if (!targetStorage) return

    const items = (targetStorage.items || []).filter(i => i.instanceId !== instanceId)
    try {
      await updateDoc(doc(db, 'storages', selectedStorageId), {
        items,
        updatedAt: new Date().toISOString()
      })
    } catch (err) {
      alert('Erro ao remover item: ' + err.message)
    }
  }

  // Storages filtrados
  const filteredStorages = storages.filter(st => {
    const matchLoc = filterLocation === 'all' || (filterLocation === 'none' ? !st.locationSlug : st.locationSlug === filterLocation)
    const q = searchQuery.toLowerCase().trim()
    const matchQ = !q || (st.name || '').toLowerCase().includes(q) || (st.id || '').toLowerCase().includes(q)
    return matchLoc && matchQ
  })

  const selectedStorageObj = storages.find(s => s.id === selectedStorageId)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '16px', textTransform: 'uppercase', color: 'var(--accent-yellow)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>📦</span> Sistema Geral de Armazenamento (Storages)
        </h3>
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={handleResetForm}
        >
          ➕ Novo Recipiente
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: '20px' }}>
        {/* COLUNA ESQUERDA: LISTAGEM & INSPEÇÃO */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Filtros */}
          <div className="glass-light" style={{ padding: '12px 16px', borderRadius: '8px', display: 'flex', gap: '12px' }}>
            <input
              type="text"
              placeholder="🔍 Buscar recipiente por nome ou ID..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ flex: 1, padding: '6px 10px', fontSize: '12px' }}
            />
            <select
              value={filterLocation}
              onChange={e => setFilterLocation(e.target.value)}
              style={{ padding: '6px 10px', fontSize: '12px', minWidth: '180px' }}
            >
              <option value="all">Todas as locações</option>
              <option value="none">Avulso / Sem locação (Veículos/Móveis)</option>
              {locations.map(loc => (
                <option key={loc.slug} value={loc.slug}>🗺️ {loc.name}</option>
              ))}
            </select>
          </div>

          {/* Grid de Recipientes Cadastrados */}
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Carregando recipientes de armazenamento...
            </div>
          ) : filteredStorages.length === 0 ? (
            <div className="glass-light" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              Nenhum recipiente de armazenamento encontrado com os filtros atuais.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
              {filteredStorages.map(st => {
                const isSelected = selectedStorageId === st.id
                const locObj = locations.find(l => l.slug === st.locationSlug)
                const itemsCount = (st.items || []).length
                const maxS = st.capacity?.maxSlots || 12

                return (
                  <div
                    key={st.id}
                    className="glass-light"
                    style={{
                      padding: '12px 14px',
                      borderRadius: '8px',
                      border: isSelected ? '2px solid var(--accent-yellow)' : '1px solid var(--glass-border)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '8px',
                      background: isSelected ? 'rgba(245, 158, 11, 0.08)' : undefined
                    }}
                    onClick={() => handleSelectStorage(st)}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '20px' }}>{st.icon || '📦'}</span>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {st.name}
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                              <code>{st.id}</code>
                            </div>
                          </div>
                        </div>

                        {st.access?.isLocked && (
                          <span style={{ fontSize: '10px', padding: '2px 6px', background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.4)' }}>
                            🔒 Trancado
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                        📍 {locObj ? locObj.name : <em style={{ color: 'var(--text-muted)' }}>Sem locação (Móvel / Veículo)</em>}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px', fontSize: '11px' }}>
                      <span style={{ color: 'var(--accent-yellow)' }}>
                        📦 {itemsCount} {st.capacity?.infinite ? 'itens' : `/ ${maxS} slots`}
                      </span>
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        style={{ padding: '2px 6px', fontSize: '10px' }}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteStorage(st.id)
                        }}
                      >
                        🗑️ Excluir
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* INSPEÇÃO DIRETA DE ITENS NO RECIPIENTE SELECIONADO */}
          {selectedStorageObj && (
            <div className="glass" style={{ padding: '16px', borderRadius: '8px', border: '1px solid var(--accent-yellow)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ margin: 0, fontSize: '13px', textTransform: 'uppercase', color: 'var(--accent-yellow)' }}>
                  📦 Itens Guardados em: {selectedStorageObj.name} ({(selectedStorageObj.items || []).length})
                </h4>
              </div>

              {/* Inserir Item pelo Admin */}
              <form onSubmit={handleAdminAddItem} style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                <select
                  value={newItem.itemId}
                  onChange={e => setNewItem(prev => ({ ...prev, itemId: e.target.value }))}
                  style={{ flex: 1, padding: '6px 10px', fontSize: '12px' }}
                  required
                >
                  <option value="">Selecione um item do catálogo para adicionar...</option>
                  {catalogItems.map(item => (
                    <option key={item.itemId || item.id} value={item.itemId || item.id}>
                      {item.icon} {item.name} ({item.itemId})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={newItem.quantity}
                  onChange={e => setNewItem(prev => ({ ...prev, quantity: e.target.value }))}
                  style={{ width: '70px', padding: '6px', fontSize: '12px', textAlign: 'center' }}
                  placeholder="Qtd"
                />
                <button type="submit" className="btn btn-sm btn-primary">
                  ➕ Inserir Item
                </button>
              </form>

              {/* Lista de Itens do Recipiente */}
              {(!selectedStorageObj.items || selectedStorageObj.items.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '12px' }}>
                  Este recipiente está vazio.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
                  {selectedStorageObj.items.map(item => {
                    const rMeta = RARITY_META[item.rarity] || RARITY_META.common
                    return (
                      <div
                        key={item.instanceId}
                        className="glass-light"
                        style={{
                          padding: '8px 10px',
                          borderRadius: '6px',
                          borderLeft: `3px solid ${rMeta.color}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '6px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                          <GameIcon src={item.imageUrl} emoji={item.icon} size={18} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '12px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.name || item.itemId}
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                              Qtd: <strong>{item.quantity || 1}</strong>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleAdminRemoveItem(item.instanceId)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', fontSize: '13px' }}
                          title="Remover item"
                        >
                          ✕
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* COLUNA DIREITA: FORMULÁRIO DE CADASTRO/EDIÇÃO */}
        <div className="glass" style={{ padding: '20px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <h4 style={{ margin: 0, fontSize: '14px', textTransform: 'uppercase', color: 'var(--accent-yellow)', borderBottom: '1px solid var(--glass-border)', paddingBottom: '8px' }}>
            {selectedStorageId ? '✏️ Editar Recipiente' : '➕ Novo Recipiente'}
          </h4>

          <form onSubmit={handleSaveStorage} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px', gap: '8px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '11px' }}>ID Único (Slug)</label>
                <input
                  type="text"
                  placeholder="bau_sala_hospital"
                  value={storageForm.storageId}
                  onChange={e => setStorageForm(prev => ({ ...prev, storageId: e.target.value }))}
                  disabled={!!selectedStorageId}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '11px' }}>Ícone</label>
                <input
                  type="text"
                  value={storageForm.icon}
                  onChange={e => setStorageForm(prev => ({ ...prev, icon: e.target.value }))}
                  style={{ textAlign: 'center' }}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '11px' }}>Nome Visível</label>
              <input
                type="text"
                placeholder="Armário Médico da Ala Norte"
                value={storageForm.name}
                onChange={e => setStorageForm(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '11px' }}>Tipo de Compartimento</label>
                <select
                  value={storageForm.type}
                  onChange={e => {
                    const t = e.target.value
                    const meta = STORAGE_TYPES[t]
                    setStorageForm(prev => ({
                      ...prev,
                      type: t,
                      icon: meta ? meta.icon : prev.icon,
                      maxSlots: meta ? meta.defaultSlots : prev.maxSlots
                    }))
                  }}
                >
                  {Object.values(STORAGE_TYPES).map(t => (
                    <option key={t.id} value={t.id}>{t.icon} {t.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '11px' }}>Locação Vinculada</label>
                <select
                  value={storageForm.locationSlug}
                  onChange={e => setStorageForm(prev => ({ ...prev, locationSlug: e.target.value }))}
                >
                  <option value="">Sem locação (Móvel / Veículo)</option>
                  {locations.map(loc => (
                    <option key={loc.slug} value={loc.slug}>🗺️ {loc.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '11px' }}>Descrição Narrativa</label>
              <textarea
                rows="2"
                placeholder="Armário de metal enferrujado com gavetas..."
                value={storageForm.description}
                onChange={e => setStorageForm(prev => ({ ...prev, description: e.target.value }))}
                style={{ width: '100%', padding: '6px', fontSize: '11px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: 'inherit' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '11px' }}>Capacidade (Slots)</label>
                <input
                  type="number"
                  min={1}
                  value={storageForm.maxSlots}
                  onChange={e => setStorageForm(prev => ({ ...prev, maxSlots: e.target.value }))}
                  disabled={storageForm.infinite}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '16px' }}>
                <input
                  type="checkbox"
                  id="infSlots"
                  checked={storageForm.infinite}
                  onChange={e => setStorageForm(prev => ({ ...prev, infinite: e.target.checked }))}
                  style={{ width: 'auto' }}
                />
                <label htmlFor="infSlots" style={{ fontSize: '11px', margin: 0, cursor: 'pointer' }}>
                  Slots Infinitos
                </label>
              </div>
            </div>

            {/* CONFIGURAÇÕES DE TRAVA E SEGURANÇA */}
            <div style={{ padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="isLocked"
                  checked={storageForm.isLocked}
                  onChange={e => setStorageForm(prev => ({ ...prev, isLocked: e.target.checked }))}
                  style={{ width: 'auto' }}
                />
                <label htmlFor="isLocked" style={{ fontSize: '11px', margin: 0, cursor: 'pointer', fontWeight: 600 }}>
                  🔒 Trancar Recipiente (Exigir Chave ou Código)
                </label>
              </div>

              {storageForm.isLocked && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '10px' }}>Chave Exigida (itemId)</label>
                      <input
                        type="text"
                        placeholder="chave_hospital"
                        value={storageForm.keyItemId}
                        onChange={e => setStorageForm(prev => ({ ...prev, keyItemId: e.target.value }))}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '10px' }}>Código PIN / Segredo</label>
                      <input
                        type="text"
                        placeholder="4815"
                        value={storageForm.passcode}
                        onChange={e => setStorageForm(prev => ({ ...prev, passcode: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '10px' }}>Mensagem quando Trancado</label>
                    <input
                      type="text"
                      value={storageForm.lockedMessage}
                      onChange={e => setStorageForm(prev => ({ ...prev, lockedMessage: e.target.value }))}
                    />
                  </div>
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
              {selectedStorageId && (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={handleResetForm}
                  style={{ flex: 1 }}
                >
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                className="btn btn-sm btn-primary"
                style={{ flex: 2 }}
              >
                💾 Salvar Armazenamento
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
