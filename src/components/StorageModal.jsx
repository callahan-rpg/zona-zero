import { useState, useEffect, useMemo } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../contexts/AuthContext.jsx'
import { RARITY_META } from '../utils/itemSystem.js'
import { STORAGE_TYPES, depositToStorage, withdrawFromStorage } from '../utils/storageSystem.js'
import { getItemCategory } from '../pages/Character.jsx'
import GameIcon from './GameIcon.jsx'

export default function StorageModal({
  isOpen,
  onClose,
  storageId,
  initialStorageData = null
}) {
  const { user, character, refreshCharacter } = useAuth()

  const [storageData, setStorageData] = useState(initialStorageData)
  const [loading, setLoading] = useState(true)
  const [activeCategoryFilter, setActiveCategoryFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('inventory') // inventory | log

  // Quantidades selecionadas para transferências
  const [depositQuantities, setDepositQuantities] = useState({})
  const [withdrawQuantities, setWithdrawQuantities] = useState({})

  // Estados de trava e destrancamento
  const [isUnlockedLocally, setIsUnlockedLocally] = useState(false)
  const [passcodeInput, setPasscodeInput] = useState('')
  const [lockError, setLockError] = useState('')

  // Estados de feedback de ação
  const [actionLoading, setActionLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Escuta o documento do Storage em tempo real
  useEffect(() => {
    if (!isOpen || !storageId) return
    setLoading(true)
    setErrorMsg('')
    setSuccessMsg('')
    setLockError('')

    const unsub = onSnapshot(doc(db, 'storages', storageId), (snap) => {
      if (snap.exists()) {
        setStorageData({ id: snap.id, ...snap.data() })
      } else {
        setStorageData(null)
      }
      setLoading(false)
    }, (err) => {
      console.warn('Erro ao escutar Storage:', err)
      setLoading(false)
    })

    return () => unsub()
  }, [isOpen, storageId])

  // Informações do tipo de Storage
  const typeMeta = STORAGE_TYPES[storageData?.type] || STORAGE_TYPES.chest

  // Verificação de Acesso / Cadeado
  const isLocked = useMemo(() => {
    if (!storageData?.access?.isLocked) return false
    if (isUnlockedLocally) return false
    return true
  }, [storageData, isUnlockedLocally])

  // Verifica se o jogador tem a chave exigida no inventário
  const playerHasKey = useMemo(() => {
    const keyId = storageData?.access?.keyItemId
    if (!keyId || !character?.inventory) return false
    return character.inventory.some(i => i.itemId === keyId && (i.quantity || 0) > 0)
  }, [storageData, character?.inventory])

  // Capacidade e slots
  const itemsInStorage = storageData?.items || []
  const maxSlots = storageData?.capacity?.maxSlots || typeMeta.defaultSlots
  const isInfiniteSlots = !!storageData?.capacity?.infinite
  const slotsUsed = itemsInStorage.length
  const slotsPercentage = isInfiniteSlots ? 0 : Math.min(100, Math.round((slotsUsed / maxSlots) * 100))

  // Inventário do jogador filtrado
  const playerInventory = useMemo(() => {
    const inv = character?.inventory || []
    return inv.filter(item => {
      if (!item) return false
      const itemCat = getItemCategory(item)
      const matchCat = activeCategoryFilter === 'all' || itemCat === activeCategoryFilter
      const q = searchQuery.toLowerCase().trim()
      const matchQuery = !q || (item.name || '').toLowerCase().includes(q) || (item.itemId || '').toLowerCase().includes(q)
      return matchCat && matchQuery
    })
  }, [character?.inventory, activeCategoryFilter, searchQuery])

  // Itens do storage filtrados por busca e categoria
  const filteredStorageItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return itemsInStorage.filter(item => {
      if (!item) return false
      const itemCat = getItemCategory(item)
      const matchCat = activeCategoryFilter === 'all' || itemCat === activeCategoryFilter
      const matchQuery = !q || (item.name || '').toLowerCase().includes(q) || (item.itemId || '').toLowerCase().includes(q)
      return matchCat && matchQuery
    })
  }, [itemsInStorage, activeCategoryFilter, searchQuery])

  // Destrancar com Chave ou Código
  function handleUnlockWithKey() {
    setLockError('')
    if (playerHasKey) {
      setIsUnlockedLocally(true)
      setSuccessMsg(storageData?.access?.unlockMessage || 'Recipiente destrancado com a chave do seu inventário.')
    } else {
      setLockError(storageData?.access?.lockedMessage || 'Você não possui a chave necessária para abrir este recipiente.')
    }
  }

  function handleUnlockWithPasscode(e) {
    e.preventDefault()
    setLockError('')
    const targetPass = String(storageData?.access?.passcode || '').trim()
    if (passcodeInput.trim() === targetPass) {
      setIsUnlockedLocally(true)
      setSuccessMsg('Segredo correto! Recipiente destrancado.')
      setPasscodeInput('')
    } else {
      setLockError('Código incorreto! O mecanismo permanece travado.')
    }
  }

  // Ações de Depósito
  async function handleDeposit(item) {
    if (!user || actionLoading) return
    setErrorMsg('')
    setSuccessMsg('')
    const qty = Math.max(1, Math.min(item.quantity || 1, depositQuantities[item.instanceId] || 1))

    try {
      setActionLoading(true)
      await depositToStorage({
        storageId,
        userUid: user.uid,
        itemInstanceId: item.instanceId,
        quantityToDeposit: qty,
        userName: character?.name || 'Sobrevivente'
      })
      await refreshCharacter()
      setSuccessMsg(`Depositado com sucesso: ${qty}x ${item.name || item.itemId}`)
      setDepositQuantities(prev => ({ ...prev, [item.instanceId]: 1 }))
    } catch (err) {
      setErrorMsg(err.message || 'Erro ao depositar item.')
    } finally {
      setActionLoading(false)
    }
  }

  // Ações de Retirada
  async function handleWithdraw(item) {
    if (!user || actionLoading) return
    setErrorMsg('')
    setSuccessMsg('')
    const qty = Math.max(1, Math.min(item.quantity || 1, withdrawQuantities[item.instanceId] || 1))

    try {
      setActionLoading(true)
      await withdrawFromStorage({
        storageId,
        userUid: user.uid,
        storageInstanceId: item.instanceId,
        quantityToWithdraw: qty,
        userName: character?.name || 'Sobrevivente'
      })
      await refreshCharacter()
      setSuccessMsg(`Retirado com sucesso: ${qty}x ${item.name || item.itemId}`)
      setWithdrawQuantities(prev => ({ ...prev, [item.instanceId]: 1 }))
    } catch (err) {
      setErrorMsg(err.message || 'Erro ao retirar item.')
    } finally {
      setActionLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="loot-modal-overlay" onClick={onClose} style={{ zIndex: 1050 }}>
      <div
        className="glass"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '95%',
          maxWidth: '1080px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '12px',
          border: '1px solid var(--glass-border)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.85), 0 0 20px rgba(59, 130, 246, 0.15)',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out'
        }}
      >
        {/* HEADER */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--glass-border)',
            background: 'rgba(0, 0, 0, 0.4)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>{storageData?.icon || typeMeta.icon}</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--accent-yellow)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                {storageData?.name || typeMeta.name}
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                {storageData?.description || typeMeta.description}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Status de Capacidade de Slots */}
            {!isLocked && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', color: slotsUsed >= maxSlots && !isInfiniteSlots ? '#ef4444' : 'var(--text-muted)' }}>
                  Capacidade: <strong>{slotsUsed}</strong> {isInfiniteSlots ? 'itens' : `/ ${maxSlots} slots`}
                </div>
                {!isInfiniteSlots && (
                  <div style={{ width: '120px', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', marginTop: '4px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${slotsPercentage}%`,
                        height: '100%',
                        background: slotsPercentage > 90 ? '#ef4444' : slotsPercentage > 70 ? '#f59e0b' : '#10b981',
                        transition: 'width 0.3s ease'
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            <button
              onClick={onClose}
              className="btn btn-sm"
              style={{ padding: '6px 12px', background: 'rgba(255, 255, 255, 0.05)' }}
            >
              ✕ Fechar
            </button>
          </div>
        </div>

        {/* FEEDBACKS (ERRO / SUCESSO) */}
        {errorMsg && (
          <div style={{ padding: '10px 20px', background: 'rgba(239, 68, 68, 0.2)', borderBottom: '1px solid rgba(239, 68, 68, 0.4)', color: '#fca5a5', fontSize: '13px' }}>
            ⚠️ {errorMsg}
          </div>
        )}
        {successMsg && (
          <div style={{ padding: '10px 20px', background: 'rgba(16, 185, 129, 0.2)', borderBottom: '1px solid rgba(16, 185, 129, 0.4)', color: '#6ee7b7', fontSize: '13px' }}>
            ✓ {successMsg}
          </div>
        )}

        {/* CORPO PRINCIPAL */}
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="loading-dot" style={{ margin: '0 auto 12px' }} />
            Acessando compartimento de armazenamento...
          </div>
        ) : isLocked ? (
          /* TELA DE RECIPIENTE TRANCADO */
          <div style={{ padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔒</div>
            <h4 style={{ fontSize: '18px', color: '#f87171', marginBottom: '8px', textTransform: 'uppercase' }}>
              Recipiente Trancado
            </h4>
            <p style={{ maxWidth: '480px', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>
              {storageData?.access?.lockedMessage || 'Este compartimento está protegido e trancado. Você precisa da chave apropriada ou do código de acesso para abri-lo.'}
            </p>

            {lockError && (
              <div style={{ marginBottom: '16px', color: '#f87171', fontSize: '13px', background: 'rgba(239, 68, 68, 0.15)', padding: '8px 16px', borderRadius: '6px' }}>
                {lockError}
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'center' }}>
              {/* Opção 1: Usar Chave */}
              {storageData?.access?.keyItemId && (
                <div className="glass-light" style={{ padding: '16px 20px', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Fechadura por Chave</span>
                  <button
                    onClick={handleUnlockWithKey}
                    disabled={!playerHasKey}
                    className={`btn btn-sm ${playerHasKey ? 'btn-primary' : ''}`}
                    style={{ opacity: playerHasKey ? 1 : 0.5 }}
                  >
                    🗝️ {playerHasKey ? 'Usar Chave do Inventário' : 'Chave não encontrada'}
                  </button>
                </div>
              )}

              {/* Opção 2: Código PIN / Segredo */}
              {storageData?.access?.passcode && (
                <form onSubmit={handleUnlockWithPasscode} className="glass-light" style={{ padding: '16px 20px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Mecanismo de Segredo</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="password"
                      placeholder="Código..."
                      value={passcodeInput}
                      onChange={e => setPasscodeInput(e.target.value)}
                      style={{ padding: '6px 10px', fontSize: '13px', width: '120px', textAlign: 'center', letterSpacing: '2px' }}
                    />
                    <button type="submit" className="btn btn-sm btn-primary">
                      Destrancar
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        ) : (
          /* CONTEÚDO PRINCIPAL (DUPLA COLUNA: MOCHILA vs STORAGE) */
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            {/* BARRA DE BUSCA E ABAS */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setActiveTab('inventory')}
                  className={`btn btn-sm ${activeTab === 'inventory' ? 'btn-primary' : ''}`}
                  style={{ fontSize: '12px' }}
                >
                  📦 Transferência
                </button>
                <button
                  onClick={() => setActiveTab('log')}
                  className={`btn btn-sm ${activeTab === 'log' ? 'btn-primary' : ''}`}
                  style={{ fontSize: '12px' }}
                >
                  📜 Histórico ({storageData?.activityLog?.length || 0})
                </button>
              </div>

              {activeTab === 'inventory' && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="🔍 Filtrar itens..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ padding: '6px 12px', fontSize: '12px', width: '200px' }}
                  />
                  <select
                    value={activeCategoryFilter}
                    onChange={e => setActiveCategoryFilter(e.target.value)}
                    style={{ padding: '6px 10px', fontSize: '12px' }}
                  >
                    <option value="all">Todas as categorias</option>
                    <option value="general">🎒 Gerais</option>
                    <option value="supplies">🌾 Mantimentos</option>
                    <option value="clothing">👕 Roupas</option>
                    <option value="melee">🗡️ Armas Brancas</option>
                    <option value="firearms">🔫 Armas de Fogo</option>
                    <option value="medical">💉 Médicos</option>
                  </select>
                </div>
              )}
            </div>

            {activeTab === 'log' ? (
              /* ABA DE LOGS */
              <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
                <h4 style={{ fontSize: '13px', color: 'var(--accent-yellow)', textTransform: 'uppercase', marginBottom: '12px' }}>
                  Movimentações Recentes
                </h4>
                {(!storageData?.activityLog || storageData.activityLog.length === 0) ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '13px' }}>
                    Nenhuma movimentação registrada neste recipiente ainda.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {storageData.activityLog.map(log => (
                      <div
                        key={log.id}
                        className="glass-light"
                        style={{
                          padding: '10px 14px',
                          borderRadius: '6px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          borderLeft: `3px solid ${log.type === 'deposit' ? '#10b981' : '#f59e0b'}`
                        }}
                      >
                        <div>
                          <span style={{ fontWeight: 600, color: log.type === 'deposit' ? '#6ee7b7' : '#fcd34d' }}>
                            {log.type === 'deposit' ? '⬇ Depositou' : '⬆ Retirou'}:
                          </span>{' '}
                          <strong>{log.quantity}x {log.itemName}</strong> por <em>{log.userName}</em>
                        </div>
                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-primary)', fontWeight: 500 }}>
                            📅 {log.timestamp ? new Date(log.timestamp).toLocaleDateString('pt-BR') : ''}
                          </span>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                            ⏰ {log.timestamp ? new Date(log.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* ABA DE TRANSFERÊNCIA DE ITENS (DUPLA COLUNA) */
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', flex: 1, overflow: 'hidden' }}>
                {/* COLUNA ESQUERDA: INVENTÁRIO DO JOGADOR */}
                <div style={{ padding: '16px 20px', borderRight: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h4 style={{ margin: 0, fontSize: '14px', textTransform: 'uppercase', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>🎒</span> Sua Mochila ({playerInventory.length})
                    </h4>
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
                    {playerInventory.length === 0 ? (
                      <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                        Nenhum item disponível na sua mochila para depositar.
                      </div>
                    ) : (
                      playerInventory.map(item => {
                        const rMeta = RARITY_META[item.rarity] || RARITY_META.common
                        const curQty = depositQuantities[item.instanceId] || 1
                        return (
                          <div
                            key={item.instanceId}
                            className="glass-light"
                            style={{
                              padding: '10px 12px',
                              borderRadius: '8px',
                              borderLeft: `3px solid ${rMeta.color}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '10px'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                              <div style={{ width: 34, height: 34, borderRadius: 6, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <GameIcon src={item.imageUrl} emoji={item.icon} size={20} />
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {item.name || item.itemId}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                  Possui: <strong>{item.quantity || 1}</strong> un.
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                              {(item.quantity || 1) > 1 && (
                                <input
                                  type="number"
                                  min={1}
                                  max={item.quantity || 1}
                                  value={curQty}
                                  onChange={e => {
                                    const val = Math.max(1, Math.min(item.quantity || 1, Number(e.target.value) || 1))
                                    setDepositQuantities(prev => ({ ...prev, [item.instanceId]: val }))
                                  }}
                                  style={{ width: '45px', padding: '4px', fontSize: '12px', textAlign: 'center' }}
                                />
                              )}
                              <button
                                onClick={() => handleDeposit(item)}
                                disabled={actionLoading || item.isQuestItem}
                                className="btn btn-sm btn-primary"
                                style={{ fontSize: '11px', padding: '4px 8px' }}
                                title={item.isQuestItem ? 'Item de missão não pode ser guardado' : 'Depositar'}
                              >
                                ➡ Guardar
                              </button>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>

                {/* COLUNA DIREITA: RECIPIENTE DE ARMAZENAMENTO */}
                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'rgba(0, 0, 0, 0.15)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h4 style={{ margin: 0, fontSize: '14px', textTransform: 'uppercase', color: 'var(--accent-yellow)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>{storageData?.icon || typeMeta.icon}</span> {storageData?.name || typeMeta.name} ({filteredStorageItems.length})
                    </h4>
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
                    {filteredStorageItems.length === 0 ? (
                      <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                        Compartimento vazio no momento.
                      </div>
                    ) : (
                      filteredStorageItems.map(item => {
                        const rMeta = RARITY_META[item.rarity] || RARITY_META.common
                        const curQty = withdrawQuantities[item.instanceId] || 1
                        return (
                          <div
                            key={item.instanceId}
                            className="glass-light"
                            style={{
                              padding: '10px 12px',
                              borderRadius: '8px',
                              borderLeft: `3px solid ${rMeta.color}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '10px'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                              <div style={{ width: 34, height: 34, borderRadius: 6, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <GameIcon src={item.imageUrl} emoji={item.icon} size={20} />
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {item.name || item.itemId}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                  No recipiente: <strong>{item.quantity || 1}</strong> un.
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                              {(item.quantity || 1) > 1 && (
                                <input
                                  type="number"
                                  min={1}
                                  max={item.quantity || 1}
                                  value={curQty}
                                  onChange={e => {
                                    const val = Math.max(1, Math.min(item.quantity || 1, Number(e.target.value) || 1))
                                    setWithdrawQuantities(prev => ({ ...prev, [item.instanceId]: val }))
                                  }}
                                  style={{ width: '45px', padding: '4px', fontSize: '12px', textAlign: 'center' }}
                                />
                              )}
                              <button
                                onClick={() => handleWithdraw(item)}
                                disabled={actionLoading}
                                className="btn btn-sm"
                                style={{ fontSize: '11px', padding: '4px 8px', background: 'rgba(245, 158, 11, 0.2)', borderColor: 'var(--accent-yellow)', color: 'var(--accent-yellow)' }}
                              >
                                ⬅ Retirar
                              </button>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
