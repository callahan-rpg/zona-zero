import { useState, useEffect } from 'react'
import { collection, onSnapshot, doc, updateDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../contexts/AuthContext.jsx'
import HUD from '../components/HUD.jsx'
import { getMaxHp } from '../utils/itemSystem'
import { ATTRIBUTE_ICONS, COMBAT_STATUS_EFFECTS, MONSTER_TEMPLATES } from '../utils/combatSystem'

export default function CombatPage() {
  const { user, role } = useAuth()
  const isAdmin = role === 'admin'

  const [combats, setCombats] = useState([])
  const [selectedSlug, setSelectedSlug] = useState('')
  const [activeCombat, setActiveCombat] = useState(null)
  const [participantsData, setParticipantsData] = useState({})
  const [allPlayers, setAllPlayers] = useState([])

  // Modal / Edição de Jogador (Admin)
  const [editingPlayer, setEditingPlayer] = useState(null)
  const [playerHpInput, setPlayerHpInput] = useState('')
  const [playerCommentInput, setPlayerCommentInput] = useState('')
  const [playerAttrForm, setPlayerAttrForm] = useState({})

  // Modal / Edição de Inimigo (Admin)
  const [editingEnemy, setEditingEnemy] = useState(null)
  const [enemyForm, setEnemyForm] = useState({
    name: '',
    icon: '🧟',
    avatarUrl: '',
    currentHp: 40,
    maxHp: 40,
    turnComment: '',
    forca: 1,
    destreza: 1,
    constituicao: 1,
    sabedoria: 1,
    carisma: 1,
    isBoss: false
  })

  // Modal de Adicionar Inimigo (Admin)
  const [showAddEnemyModal, setShowAddEnemyModal] = useState(false)

  // Feed de Combate
  const [combatLogInput, setCombatLogInput] = useState('')

  // 1. Escuta todos os combates ativos do banco
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'active_combats'), (snap) => {
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(c => c.active)
      setCombats(list)
      if (list.length > 0 && (!selectedSlug || !list.some(c => c.id === selectedSlug))) {
        setSelectedSlug(list[0].id)
      }
    })
    return unsub
  }, [selectedSlug])

  // 2. Escuta o combate atualmente selecionado
  useEffect(() => {
    if (!selectedSlug) {
      setActiveCombat(null)
      return
    }
    const unsub = onSnapshot(doc(db, 'active_combats', selectedSlug), (snap) => {
      if (snap.exists() && snap.data().active) {
        setActiveCombat(snap.data())
      } else {
        setActiveCombat(null)
      }
    })
    return unsub
  }, [selectedSlug])

  // 3. Escuta todos os sobreviventes (para o admin gerenciar)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      setAllPlayers(snap.docs.map(d => ({ uid: d.id, ...d.data() })))
    })
    return unsub
  }, [])

  // 4. Escuta dados em tempo real dos sobreviventes no combate selecionado
  useEffect(() => {
    if (!activeCombat || !activeCombat.participantUids || activeCombat.participantUids.length === 0) {
      setParticipantsData({})
      return
    }

    const unsubs = activeCombat.participantUids.map(uid => {
      return onSnapshot(doc(db, 'users', uid), (snap) => {
        if (snap.exists()) {
          const udata = snap.data()
          setParticipantsData(prev => ({
            ...prev,
            [uid]: {
              uid,
              name: udata.character?.name || 'Sobrevivente',
              avatarUrl: udata.character?.avatarUrl || '',
              vitals: udata.character?.vitals || { blood: 100, hunger: 100, thirst: 100 },
              attributes: udata.character?.attributes || { forca: 1, destreza: 1, constituicao: 1, sabedoria: 1, carisma: 1 },
              level: udata.character?.level || 1,
              status: activeCombat.participantStatus?.[uid] || []
            }
          }))
        }
      })
    })

    return () => {
      unsubs.forEach(unsub => unsub && unsub())
    }
  }, [activeCombat?.participantUids, activeCombat?.participantStatus])

  // =========================================================================
  // ADMIN ACTIONS: REORDENAÇÃO & EDIÇÃO EM TEMPO REAL
  // =========================================================================

  // Mover Jogador para cima ou para baixo na ordem
  const handleMoveParticipant = async (index, direction) => {
    if (!isAdmin || !activeCombat?.participantUids) return
    const uids = [...activeCombat.participantUids]
    const targetIdx = index + direction
    if (targetIdx < 0 || targetIdx >= uids.length) return

    const temp = uids[index]
    uids[index] = uids[targetIdx]
    uids[targetIdx] = temp

    try {
      const combatRef = doc(db, 'active_combats', selectedSlug)
      await updateDoc(combatRef, { participantUids: uids })
    } catch (err) {
      console.error('Erro ao reordenar jogadores:', err)
    }
  }

  // Mover Inimigo para cima ou para baixo na ordem
  const handleMoveEnemy = async (index, direction) => {
    if (!isAdmin || !activeCombat?.enemies) return
    const enemies = [...activeCombat.enemies]
    const targetIdx = index + direction
    if (targetIdx < 0 || targetIdx >= enemies.length) return

    const temp = enemies[index]
    enemies[index] = enemies[targetIdx]
    enemies[targetIdx] = temp

    try {
      const combatRef = doc(db, 'active_combats', selectedSlug)
      await updateDoc(combatRef, { enemies })
    } catch (err) {
      console.error('Erro ao reordenar inimigos:', err)
    }
  }

  // Abrir edição de Sobrevivente
  const handleOpenEditPlayer = (uid) => {
    const char = participantsData[uid]
    if (!char) return
    const maxHp = getMaxHp(char)
    setEditingPlayer({ ...char, maxHp })
    setPlayerHpInput(String(char.vitals?.blood ?? maxHp))
    setPlayerCommentInput(activeCombat?.participantComments?.[uid] || '')
    setPlayerAttrForm({ ...char.attributes })
  }

  // Salvar Sobrevivente editado
  const handleSavePlayerEdit = async (e) => {
    e.preventDefault()
    if (!editingPlayer) return
    try {
      const userRef = doc(db, 'users', editingPlayer.uid)
      await updateDoc(userRef, {
        'character.vitals.blood': Number(playerHpInput),
        'character.attributes': {
          forca: Number(playerAttrForm.forca) || 1,
          destreza: Number(playerAttrForm.destreza) || 1,
          constituicao: Number(playerAttrForm.constituicao) || 1,
          sabedoria: Number(playerAttrForm.sabedoria) || 1,
          carisma: Number(playerAttrForm.carisma) || 1
        }
      })

      // Atualiza comentário de turno e log do combate
      const currentComments = activeCombat?.participantComments || {}
      const updatedComments = {
        ...currentComments,
        [editingPlayer.uid]: playerCommentInput.trim()
      }

      const combatRef = doc(db, 'active_combats', selectedSlug)
      await updateDoc(combatRef, {
        participantComments: updatedComments
      })

      setEditingPlayer(null)
    } catch (err) {
      alert('Erro ao salvar jogador: ' + err.message)
    }
  }

  // Toggle status de sobrevivente
  const handleTogglePlayerStatus = async (uid, statusId) => {
    if (!isAdmin) return
    const currentParticipantStatus = activeCombat?.participantStatus || {}
    const charStatus = currentParticipantStatus[uid] || []
    const hasSt = charStatus.includes(statusId)
    const newStatus = hasSt ? charStatus.filter(s => s !== statusId) : [...charStatus, statusId]

    try {
      const combatRef = doc(db, 'active_combats', selectedSlug)
      await updateDoc(combatRef, {
        participantStatus: { ...currentParticipantStatus, [uid]: newStatus }
      })
    } catch (err) {
      console.error(err)
    }
  }

  // Abrir edição de Inimigo
  const handleOpenEditEnemy = (enemy) => {
    setEditingEnemy(enemy)
    setEnemyForm({
      name: enemy.name || '',
      icon: enemy.icon || '🧟',
      avatarUrl: enemy.avatarUrl || '',
      currentHp: enemy.currentHp ?? enemy.maxHp,
      maxHp: enemy.maxHp || 40,
      turnComment: enemy.turnComment || '',
      forca: enemy.attributes?.forca ?? 1,
      destreza: enemy.attributes?.destreza ?? 1,
      constituicao: enemy.attributes?.constituicao ?? 1,
      sabedoria: enemy.attributes?.sabedoria ?? 1,
      carisma: enemy.attributes?.carisma ?? 0,
      isBoss: !!enemy.isBoss
    })
  }

  // Salvar Inimigo editado
  const handleSaveEnemyEdit = async (e) => {
    e.preventDefault()
    if (!editingEnemy) return
    const updatedEnemies = (activeCombat?.enemies || []).map(en => {
      if (en.id === editingEnemy.id) {
        return {
          ...en,
          name: enemyForm.name.trim(),
          icon: enemyForm.icon.trim(),
          avatarUrl: enemyForm.avatarUrl.trim(),
          currentHp: Math.max(0, Number(enemyForm.currentHp)),
          maxHp: Math.max(1, Number(enemyForm.maxHp)),
          turnComment: enemyForm.turnComment.trim(),
          attributes: {
            forca: Number(enemyForm.forca) || 0,
            destreza: Number(enemyForm.destreza) || 0,
            constituicao: Number(enemyForm.constituicao) || 0,
            sabedoria: Number(enemyForm.sabedoria) || 0,
            carisma: Number(enemyForm.carisma) || 0
          },
          isBoss: !!enemyForm.isBoss
        }
      }
      return en
    })

    try {
      const combatRef = doc(db, 'active_combats', selectedSlug)
      await updateDoc(combatRef, { enemies: updatedEnemies })
      setEditingEnemy(null)
    } catch (err) {
      alert('Erro ao salvar inimigo: ' + err.message)
    }
  }

  // Excluir Inimigo da cena
  const handleDeleteEnemy = async (enemyId) => {
    if (!confirm('Deseja remover este inimigo do combate?')) return
    const updated = (activeCombat?.enemies || []).filter(en => en.id !== enemyId)
    try {
      const combatRef = doc(db, 'active_combats', selectedSlug)
      await updateDoc(combatRef, { enemies: updated })
      setEditingEnemy(null)
    } catch (err) {
      alert('Erro ao remover: ' + err.message)
    }
  }

  // Adicionar Inimigo pelo Modal
  const handleAddEnemySubmit = async (e) => {
    e.preventDefault()
    if (!enemyForm.name.trim()) return alert('Nome do inimigo obrigatório')
    const hp = Number(enemyForm.maxHp) || 40
    const newEnemy = {
      id: 'enemy_' + Math.random().toString(36).substring(2, 8),
      name: enemyForm.name.trim(),
      icon: enemyForm.icon.trim() || '🧟',
      avatarUrl: enemyForm.avatarUrl.trim(),
      currentHp: hp,
      maxHp: hp,
      turnComment: enemyForm.turnComment.trim(),
      attributes: {
        forca: Number(enemyForm.forca) || 0,
        destreza: Number(enemyForm.destreza) || 0,
        constituicao: Number(enemyForm.constituicao) || 0,
        sabedoria: Number(enemyForm.sabedoria) || 0,
        carisma: Number(enemyForm.carisma) || 0
      },
      status: [],
      isBoss: !!enemyForm.isBoss
    }

    const updated = [...(activeCombat?.enemies || []), newEnemy]
    try {
      const combatRef = doc(db, 'active_combats', selectedSlug)
      await updateDoc(combatRef, { enemies: updated })
      setShowAddEnemyModal(false)
    } catch (err) {
      alert('Erro ao adicionar inimigo: ' + err.message)
    }
  }

  // Toggle status de Inimigo
  const handleToggleEnemyStatus = async (enemyId, statusId) => {
    if (!isAdmin) return
    const updated = (activeCombat?.enemies || []).map(en => {
      if (en.id === enemyId) {
        const hasSt = (en.status || []).includes(statusId)
        const next = hasSt ? en.status.filter(s => s !== statusId) : [...(en.status || []), statusId]
        return { ...en, status: next }
      }
      return en
    })

    try {
      const combatRef = doc(db, 'active_combats', selectedSlug)
      await updateDoc(combatRef, { enemies: updated })
    } catch (err) {
      console.error(err)
    }
  }

  // Enviar Log Manual Narrativo
  const handleSendCombatLog = async (e) => {
    e.preventDefault()
    if (!combatLogInput.trim() || !isAdmin) return
    try {
      const combatRef = doc(db, 'active_combats', selectedSlug)
      await updateDoc(combatRef, {
        combatLog: [
          ...(activeCombat?.combatLog || []).slice(-25),
          { id: Math.random().toString(36).substring(2), text: combatLogInput.trim(), timestamp: Date.now() }
        ]
      })
      setCombatLogInput('')
    } catch (err) {
      alert('Erro ao enviar narrativa: ' + err.message)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', overflowY: 'auto' }}>
      <HUD />

      <div style={{ padding: 'calc(var(--hud-height) + 16px) 24px 40px', maxWidth: '1380px', margin: '0 auto' }}>
        {/* CASO NÃO HAJA COMBATE ATIVO */}
        {!activeCombat ? (
          <div className="glass" style={{ padding: '60px 20px', textAlign: 'center', borderRadius: 16, marginTop: 20 }}>
            <span style={{ fontSize: 48, display: 'block', marginBottom: 16 }}>🛡️</span>
            <h3 style={{ fontSize: 20, color: 'var(--text-primary)', marginBottom: 8 }}>Nenhum combate ativo no momento</h3>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', maxWidth: 460, margin: '0 auto 20px' }}>
              Quando o narrador iniciar uma cena de combate em uma locação, todos os sobreviventes e inimigos aparecerão aqui com suas estatísticas e vida em tempo real.
            </p>
            {isAdmin && (
              <a href="/admin" className="btn btn-primary" style={{ display: 'inline-flex', padding: '10px 20px', textDecoration: 'none' }}>
                Ir ao Painel Admin para Iniciar Combate
              </a>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* BARRA SUPERIOR DISCRETA (Título da Locação + Seletor se houver múltiplos) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, padding: '10px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid var(--glass-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18 }}>⚔️</span>
                <div>
                  <strong style={{ fontSize: 14, color: 'var(--text-primary)' }}>{activeCombat.title || 'Cena de Combate'}</strong>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>({activeCombat.locationSlug})</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {combats.length > 1 && (
                  <select
                    value={selectedSlug}
                    onChange={e => setSelectedSlug(e.target.value)}
                    style={{ padding: '4px 8px', fontSize: 12, borderRadius: 6, background: 'rgba(0,0,0,0.6)', color: '#fff', border: '1px solid var(--glass-border)' }}
                  >
                    {combats.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.title || c.id}
                      </option>
                    ))}
                  </select>
                )}

                {isAdmin && (
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={() => {
                      setEnemyForm({
                        name: 'Zumbi Errante',
                        icon: '🧟',
                        avatarUrl: '',
                        currentHp: 40,
                        maxHp: 40,
                        turnComment: '',
                        forca: 2,
                        destreza: 1,
                        constituicao: 2,
                        sabedoria: 0,
                        carisma: 0,
                        isBoss: false
                      })
                      setShowAddEnemyModal(true)
                    }}
                    style={{ fontSize: 11, padding: '5px 12px' }}
                  >
                    + Adicionar Inimigo
                  </button>
                )}
              </div>
            </div>

            {/* ARENA DE COMBATE (GRID: SOBREVIVENTES VS INIMIGOS) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
              {/* COLUNA ESQUERDA: SOBREVIVENTES */}
              <div className="glass" style={{ padding: '16px', borderRadius: 14, border: '1px solid rgba(56,189,248,0.25)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 8 }}>
                  <h4 style={{ margin: 0, fontSize: 13, textTransform: 'uppercase', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 6 }}>
                    🛡️ Sobreviventes ({activeCombat.participantUids?.length || 0})
                  </h4>
                  {isAdmin && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Use as setas para reordenar</span>}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {activeCombat.participantUids?.map((uid, idx) => {
                    const char = participantsData[uid]
                    if (!char) {
                      return (
                        <div key={uid} className="glass-light" style={{ padding: 12, borderRadius: 8, color: 'var(--text-muted)', fontSize: 12 }}>
                          Carregando sobrevivente...
                        </div>
                      )
                    }

                    const maxHp = getMaxHp(char)
                    const currentHp = Math.min(char.vitals?.blood ?? maxHp, maxHp)
                    const hpPercent = Math.max(0, Math.min(100, Math.round((currentHp / maxHp) * 100)))
                    const charStatus = char.status || []
                    const turnComment = activeCombat.participantComments?.[uid]

                    return (
                      <div
                        key={uid}
                        className="glass-light combat-item-card"
                        style={{
                          padding: '12px 14px',
                          borderRadius: 10,
                          borderLeft: '4px solid #38bdf8',
                          transition: 'all 0.2s',
                          background: currentHp <= 0 ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.03)'
                        }}
                      >
                        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                          {/* Botões de Reordenação (Admin) */}
                          {isAdmin && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginRight: -4 }}>
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={(e) => { e.stopPropagation(); handleMoveParticipant(idx, -1); }}
                                style={{ background: 'transparent', border: 'none', color: idx === 0 ? 'rgba(255,255,255,0.1)' : '#38bdf8', cursor: idx === 0 ? 'default' : 'pointer', fontSize: 12, lineHeight: 1, padding: 0 }}
                                title="Mover para cima"
                              >
                                ▲
                              </button>
                              <button
                                type="button"
                                disabled={idx === activeCombat.participantUids.length - 1}
                                onClick={(e) => { e.stopPropagation(); handleMoveParticipant(idx, 1); }}
                                style={{ background: 'transparent', border: 'none', color: idx === activeCombat.participantUids.length - 1 ? 'rgba(255,255,255,0.1)' : '#38bdf8', cursor: idx === activeCombat.participantUids.length - 1 ? 'default' : 'pointer', fontSize: 12, lineHeight: 1, padding: 0 }}
                                title="Mover para baixo"
                              >
                                ▼
                              </button>
                            </div>
                          )}

                          {char.avatarUrl ? (
                            <img src={char.avatarUrl} alt={char.name} style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--glass-border)' }} />
                          ) : (
                            <div style={{ width: 44, height: 44, borderRadius: 8, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                              👤
                            </div>
                          )}

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                              <strong style={{ fontSize: 14, color: 'var(--text-primary)' }}>{char.name}</strong>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Nv {char.level}</span>
                                {isAdmin && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditPlayer(uid)}
                                    className="btn btn-sm"
                                    style={{ padding: '2px 6px', fontSize: 10, background: 'rgba(56,189,248,0.1)', borderColor: 'rgba(56,189,248,0.3)', color: '#38bdf8' }}
                                    title="Editar HP, Atributos e Ação do Turno"
                                  >
                                    ✏️ Editar
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* CAMPO DE COMENTÁRIO DO TURNO (AÇÃO RECENTE) */}
                            {turnComment ? (
                              <div style={{ fontSize: 11, color: '#facc15', fontStyle: 'italic', marginBottom: 6, padding: '3px 6px', background: 'rgba(250, 204, 21, 0.08)', borderRadius: 4, borderLeft: '2px solid #facc15' }}>
                                💬 "{turnComment}"
                              </div>
                            ) : isAdmin && (
                              <div
                                onClick={() => handleOpenEditPlayer(uid)}
                                style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 6, cursor: 'pointer' }}
                              >
                                + Adicionar ação/comentário do turno
                              </div>
                            )}

                            {/* Barra de Vida */}
                            <div style={{ marginBottom: 6 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, marginBottom: 2 }}>
                                <span style={{ color: '#ef4444' }}>HP / Sangue</span>
                                <span style={{ color: currentHp <= 20 ? '#ef4444' : '#22c55e' }}>{currentHp} / {maxHp}</span>
                              </div>
                              <div style={{ width: '100%', height: 6, background: 'rgba(0,0,0,0.5)', borderRadius: 4, overflow: 'hidden' }}>
                                <div style={{ width: `${hpPercent}%`, height: '100%', background: 'linear-gradient(90deg, #ef4444 0%, #22c55e 100%)', transition: 'width 0.3s' }} />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Status Badges */}
                        {charStatus.length > 0 && (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                            {charStatus.map(stId => {
                              const stMeta = COMBAT_STATUS_EFFECTS.find(s => s.id === stId)
                              if (!stMeta) return null
                              return (
                                <span
                                  key={stId}
                                  style={{
                                    fontSize: 9,
                                    fontWeight: 700,
                                    padding: '2px 6px',
                                    borderRadius: 4,
                                    background: 'rgba(0,0,0,0.4)',
                                    border: `1px solid ${stMeta.color}`,
                                    color: stMeta.color,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 3
                                  }}
                                >
                                  {stMeta.icon} {stMeta.label}
                                </span>
                              )
                            })}
                          </div>
                        )}

                        {/* Atributos Simplificados */}
                        <div className="combat-attributes-strip" style={{ marginTop: 6 }}>
                          {['forca', 'destreza', 'constituicao', 'sabedoria', 'carisma'].map(attrKey => {
                            const meta = ATTRIBUTE_ICONS[attrKey]
                            const val = char.attributes?.[attrKey] ?? 1
                            return (
                              <div key={attrKey} className="compact-attr-tag" title={`${meta.label}: ${val}`}>
                                <span className="compact-attr-icon">{meta.icon}</span>
                                <span className="compact-attr-lbl">{meta.label}</span>
                                <span className="compact-attr-val">{val}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* COLUNA DIREITA: INIMIGOS / NPCS */}
              <div className="glass" style={{ padding: '16px', borderRadius: 14, border: '1px solid rgba(239,68,68,0.25)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 8 }}>
                  <h4 style={{ margin: 0, fontSize: 13, textTransform: 'uppercase', color: '#f87171', display: 'flex', alignItems: 'center', gap: 6 }}>
                    👹 Inimigos ({activeCombat.enemies?.length || 0})
                  </h4>
                  {isAdmin && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Use as setas para reordenar</span>}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {!activeCombat.enemies || activeCombat.enemies.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)', fontSize: 13 }}>
                      Nenhum inimigo na cena.
                    </div>
                  ) : (
                    activeCombat.enemies.map((enemy, idx) => {
                      const currentHp = Math.max(0, enemy.currentHp ?? enemy.maxHp)
                      const maxHp = enemy.maxHp || 40
                      const hpPercent = Math.max(0, Math.min(100, Math.round((currentHp / maxHp) * 100)))
                      const isDead = currentHp <= 0

                      return (
                        <div
                          key={enemy.id}
                          className="glass-light combat-item-card"
                          style={{
                            padding: '12px 14px',
                            borderRadius: 10,
                            borderLeft: `4px solid ${enemy.isBoss ? '#f59e0b' : '#ef4444'}`,
                            transition: 'all 0.2s',
                            opacity: isDead ? 0.5 : 1,
                            background: enemy.isBoss ? 'rgba(245,158,11,0.04)' : 'rgba(255,255,255,0.03)'
                          }}
                        >
                          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                            {/* Botões de Reordenação (Admin) */}
                            {isAdmin && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginRight: -4 }}>
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={(e) => { e.stopPropagation(); handleMoveEnemy(idx, -1); }}
                                  style={{ background: 'transparent', border: 'none', color: idx === 0 ? 'rgba(255,255,255,0.1)' : '#f87171', cursor: idx === 0 ? 'default' : 'pointer', fontSize: 12, lineHeight: 1, padding: 0 }}
                                  title="Mover para cima"
                                >
                                  ▲
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === activeCombat.enemies.length - 1}
                                  onClick={(e) => { e.stopPropagation(); handleMoveEnemy(idx, 1); }}
                                  style={{ background: 'transparent', border: 'none', color: idx === activeCombat.enemies.length - 1 ? 'rgba(255,255,255,0.1)' : '#f87171', cursor: idx === activeCombat.enemies.length - 1 ? 'default' : 'pointer', fontSize: 12, lineHeight: 1, padding: 0 }}
                                  title="Mover para baixo"
                                >
                                  ▼
                                </button>
                              </div>
                            )}

                            {enemy.avatarUrl ? (
                              <img src={enemy.avatarUrl} alt={enemy.name} style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--glass-border)' }} />
                            ) : (
                              <div style={{ width: 44, height: 44, borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                                {enemy.icon || '🧟'}
                              </div>
                            )}

                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                                <strong style={{ fontSize: 14, color: enemy.isBoss ? '#fbbf24' : 'var(--text-primary)' }}>
                                  {enemy.name} {enemy.isBoss && <span className="boss-badge">BOSS</span>}
                                </strong>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  {isDead && <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 800 }}>💀 DERROTADO</span>}
                                  {isAdmin && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditEnemy(enemy)}
                                      className="btn btn-sm"
                                      style={{ padding: '2px 6px', fontSize: 10, background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)', color: '#f87171' }}
                                      title="Editar HP, Atributos e Ação do Monstro"
                                    >
                                      ✏️ Editar
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* CAMPO DE COMENTÁRIO DO INIMIGO (AÇÃO DO TURNO) */}
                              {enemy.turnComment ? (
                                <div style={{ fontSize: 11, color: '#fb923c', fontStyle: 'italic', marginBottom: 6, padding: '3px 6px', background: 'rgba(251, 146, 60, 0.08)', borderRadius: 4, borderLeft: '2px solid #fb923c' }}>
                                  💬 "{enemy.turnComment}"
                                </div>
                              ) : isAdmin && (
                                <div
                                  onClick={() => handleOpenEditEnemy(enemy)}
                                  style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 6, cursor: 'pointer' }}
                                >
                                  + Adicionar ação/golpe do monstro
                                </div>
                              )}

                              {/* Barra de Vida do Inimigo */}
                              <div style={{ marginBottom: 6 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, marginBottom: 2 }}>
                                  <span style={{ color: '#ef4444' }}>HP</span>
                                  <span style={{ color: isDead ? '#6b7280' : '#ef4444' }}>{currentHp} / {maxHp}</span>
                                </div>
                                <div style={{ width: '100%', height: 6, background: 'rgba(0,0,0,0.5)', borderRadius: 4, overflow: 'hidden' }}>
                                  <div style={{ width: `${hpPercent}%`, height: '100%', background: enemy.isBoss ? 'linear-gradient(90deg, #ea580c 0%, #f59e0b 100%)' : 'linear-gradient(90deg, #b91c1c 0%, #ef4444 100%)', transition: 'width 0.3s' }} />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Status do Inimigo */}
                          {enemy.status && enemy.status.length > 0 && (
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                              {enemy.status.map(stId => {
                                const stMeta = COMBAT_STATUS_EFFECTS.find(s => s.id === stId)
                                if (!stMeta) return null
                                return (
                                  <span
                                    key={stId}
                                    style={{
                                      fontSize: 9,
                                      fontWeight: 700,
                                      padding: '2px 6px',
                                      borderRadius: 4,
                                      background: 'rgba(0,0,0,0.4)',
                                      border: `1px solid ${stMeta.color}`,
                                      color: stMeta.color,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 3
                                    }}
                                  >
                                    {stMeta.icon} {stMeta.label}
                                  </span>
                                )
                              })}
                            </div>
                          )}

                          {/* Atributos do Inimigo */}
                          {enemy.attributes && (
                            <div className="combat-attributes-strip" style={{ marginTop: 6 }}>
                              {['forca', 'destreza', 'constituicao', 'sabedoria', 'carisma'].map(attrKey => {
                                const meta = ATTRIBUTE_ICONS[attrKey]
                                const val = enemy.attributes?.[attrKey] ?? 0
                                return (
                                  <div key={attrKey} className="compact-attr-tag" title={`${meta.label}: ${val}`}>
                                    <span className="compact-attr-icon">{meta.icon}</span>
                                    <span className="compact-attr-lbl">{meta.label}</span>
                                    <span className="compact-attr-val">{val}</span>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>

            {/* FEED NARRATIVO & HISTÓRICO */}
            <div className="glass" style={{ padding: '16px 18px', borderRadius: 14 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 12, textTransform: 'uppercase', color: 'var(--accent-yellow)', display: 'flex', alignItems: 'center', gap: 6 }}>
                📜 Histórico da Cena
              </h4>

              {isAdmin && (
                <form onSubmit={handleSendCombatLog} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <input
                    type="text"
                    placeholder="Narrar golpe ou evento geral..."
                    value={combatLogInput}
                    onChange={e => setCombatLogInput(e.target.value)}
                    style={{ flex: 1, padding: '8px 12px', fontSize: 12, borderRadius: 8, background: 'rgba(0,0,0,0.4)', border: '1px solid var(--glass-border)', color: '#fff' }}
                  />
                  <button type="submit" className="btn btn-primary" style={{ padding: '0 16px', fontSize: 12 }}>
                    Enviar
                  </button>
                </form>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 140, overflowY: 'auto' }}>
                {(!activeCombat.combatLog || activeCombat.combatLog.length === 0) ? (
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>Nenhuma narrativa registrada ainda.</p>
                ) : (
                  activeCombat.combatLog.slice().reverse().map(log => (
                    <div key={log.id} style={{ fontSize: 11, color: 'var(--text-secondary)', padding: '5px 8px', background: 'rgba(0,0,0,0.25)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.03)' }}>
                      <span style={{ color: 'var(--text-muted)', marginRight: 6, fontSize: 10 }}>[{new Date(log.timestamp || Date.now()).toLocaleTimeString()}]</span>
                      <span style={{ color: 'var(--text-primary)' }}>{log.text}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          MODAIS DE EDIÇÃO COMPLETA DO MESTRE / ADMIN (COM INPUTS CORRIGIDOS)
          ========================================================================= */}

      {/* 1. MODAL DE EDIÇÃO DE SOBREVIVENTE */}
      {editingPlayer && (
        <div className="combat-modal-overlay">
          <div className="combat-modal-card" style={{ borderColor: 'rgba(56,189,248,0.4)' }}>
            <div className="combat-modal-header">
              <h3 style={{ margin: 0, fontSize: 16, color: '#38bdf8' }}>Editar: {editingPlayer.name}</h3>
              <button type="button" onClick={() => setEditingPlayer(null)} className="combat-modal-close">×</button>
            </div>

            <form onSubmit={handleSavePlayerEdit} className="combat-modal-form">
              {/* Edição de Vida / HP */}
              <div className="combat-form-field">
                <label>
                  Vida Atual (HP / Sangue) · Máx: <strong>{editingPlayer.maxHp} HP</strong>
                </label>
                <input
                  type="number"
                  value={playerHpInput}
                  onChange={e => setPlayerHpInput(e.target.value)}
                  className="combat-dark-input"
                />
              </div>

              {/* Comentário do Turno (O que acabou de fazer) */}
              <div className="combat-form-field">
                <label>💬 Ação do Turno / Comentário</label>
                <input
                  type="text"
                  placeholder="Ex: Disparou 2 tiros de Glock e recuou para a porta"
                  value={playerCommentInput}
                  onChange={e => setPlayerCommentInput(e.target.value)}
                  className="combat-dark-input"
                />
              </div>

              {/* Edição dos Atributos */}
              <div className="combat-form-field">
                <label>Atributos de Sobrevivência</label>
                <div className="combat-attrs-grid">
                  {['forca', 'destreza', 'constituicao', 'sabedoria', 'carisma'].map(attr => (
                    <div key={attr} className="combat-attr-box">
                      <span className="attr-tag-label">{attr.substring(0, 3)}</span>
                      <input
                        type="number"
                        value={playerAttrForm[attr] ?? 1}
                        onChange={e => setPlayerAttrForm(prev => ({ ...prev, [attr]: Number(e.target.value) }))}
                        className="combat-dark-input attr-number-input"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Status Toggles */}
              <div className="combat-form-field">
                <label>Condições & Status Ativos</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {COMBAT_STATUS_EFFECTS.map(st => {
                    const isActive = (editingPlayer.status || []).includes(st.id)
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => handleTogglePlayerStatus(editingPlayer.uid, st.id)}
                        style={{
                          padding: '4px 8px',
                          fontSize: 11,
                          fontWeight: 600,
                          background: isActive ? st.color + '33' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${isActive ? st.color : 'rgba(255,255,255,0.08)'}`,
                          color: isActive ? '#fff' : 'var(--text-muted)',
                          borderRadius: 6,
                          cursor: 'pointer'
                        }}
                      >
                        {st.icon} {st.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <button type="button" className="btn" onClick={() => setEditingPlayer(null)} style={{ flex: 1 }}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>💾 Salvar Alterações</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. MODAL DE EDIÇÃO DE INIMIGO */}
      {editingEnemy && (
        <div className="combat-modal-overlay">
          <div className="combat-modal-card" style={{ borderColor: 'rgba(239,68,68,0.4)' }}>
            <div className="combat-modal-header">
              <h3 style={{ margin: 0, fontSize: 16, color: '#f87171' }}>Editar: {editingEnemy.name}</h3>
              <button type="button" onClick={() => setEditingEnemy(null)} className="combat-modal-close">×</button>
            </div>

            <form onSubmit={handleSaveEnemyEdit} className="combat-modal-form">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px', gap: 8 }}>
                <div className="combat-form-field">
                  <label>Nome do Inimigo</label>
                  <input
                    type="text"
                    value={enemyForm.name}
                    onChange={e => setEnemyForm(prev => ({ ...prev, name: e.target.value }))}
                    className="combat-dark-input"
                  />
                </div>
                <div className="combat-form-field">
                  <label>Ícone</label>
                  <input
                    type="text"
                    value={enemyForm.icon}
                    onChange={e => setEnemyForm(prev => ({ ...prev, icon: e.target.value }))}
                    className="combat-dark-input"
                    style={{ textAlign: 'center' }}
                  />
                </div>
              </div>

              {/* Comentário / Ação do Turno */}
              <div className="combat-form-field">
                <label>💬 Ação / Golpe do Turno</label>
                <input
                  type="text"
                  placeholder="Ex: Mordida feroz no braço esquerdo"
                  value={enemyForm.turnComment}
                  onChange={e => setEnemyForm(prev => ({ ...prev, turnComment: e.target.value }))}
                  className="combat-dark-input"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div className="combat-form-field">
                  <label>HP Atual</label>
                  <input
                    type="number"
                    value={enemyForm.currentHp}
                    onChange={e => setEnemyForm(prev => ({ ...prev, currentHp: e.target.value }))}
                    className="combat-dark-input"
                  />
                </div>
                <div className="combat-form-field">
                  <label>HP Máximo</label>
                  <input
                    type="number"
                    value={enemyForm.maxHp}
                    onChange={e => setEnemyForm(prev => ({ ...prev, maxHp: e.target.value }))}
                    className="combat-dark-input"
                  />
                </div>
              </div>

              {/* Atributos do Inimigo */}
              <div className="combat-form-field">
                <label>Atributos do Monstro</label>
                <div className="combat-attrs-grid">
                  {['forca', 'destreza', 'constituicao', 'sabedoria', 'carisma'].map(attr => (
                    <div key={attr} className="combat-attr-box">
                      <span className="attr-tag-label">{attr.substring(0, 3)}</span>
                      <input
                        type="number"
                        value={enemyForm[attr]}
                        onChange={e => setEnemyForm(prev => ({ ...prev, [attr]: Number(e.target.value) }))}
                        className="combat-dark-input attr-number-input"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Boss checkbox */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  id="isBossCheck"
                  checked={enemyForm.isBoss}
                  onChange={e => setEnemyForm(prev => ({ ...prev, isBoss: e.target.checked }))}
                  style={{ width: 'auto' }}
                />
                <label htmlFor="isBossCheck" style={{ margin: 0, fontSize: 12, cursor: 'pointer', color: '#fbbf24', fontWeight: 600 }}>
                  👑 Marcar como Chefe (Boss / Barra de Destaque)
                </label>
              </div>

              {/* Status Toggles do Inimigo */}
              <div className="combat-form-field">
                <label>Condições & Status</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {COMBAT_STATUS_EFFECTS.map(st => {
                    const isActive = (editingEnemy.status || []).includes(st.id)
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => handleToggleEnemyStatus(editingEnemy.id, st.id)}
                        style={{
                          padding: '4px 8px',
                          fontSize: 11,
                          fontWeight: 600,
                          background: isActive ? st.color + '33' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${isActive ? st.color : 'rgba(255,255,255,0.08)'}`,
                          color: isActive ? '#fff' : 'var(--text-muted)',
                          borderRadius: 6,
                          cursor: 'pointer'
                        }}
                      >
                        {st.icon} {st.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <button type="button" className="btn btn-danger" onClick={() => handleDeleteEnemy(editingEnemy.id)} style={{ flex: 1 }}>
                  🗑️ Remover
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>
                  💾 Salvar Inimigo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. MODAL DE ADICIONAR INIMIGO */}
      {showAddEnemyModal && (
        <div className="combat-modal-overlay">
          <div className="combat-modal-card" style={{ borderColor: 'rgba(239,68,68,0.4)' }}>
            <div className="combat-modal-header">
              <h3 style={{ margin: 0, fontSize: 16, color: '#f87171' }}>➕ Adicionar Inimigo</h3>
              <button type="button" onClick={() => setShowAddEnemyModal(false)} className="combat-modal-close">×</button>
            </div>

            {/* Presets Rápidos */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                ⚡ Presets Rápidos:
              </label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {MONSTER_TEMPLATES.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setEnemyForm({
                        name: `${m.name} #${(activeCombat?.enemies?.length || 0) + 1}`,
                        icon: m.icon,
                        avatarUrl: m.avatarUrl || '',
                        currentHp: m.maxHp,
                        maxHp: m.maxHp,
                        turnComment: '',
                        forca: m.attributes.forca,
                        destreza: m.attributes.destreza,
                        constituicao: m.attributes.constituicao,
                        sabedoria: m.attributes.sabedoria,
                        carisma: m.attributes.carisma,
                        isBoss: !!m.isBoss
                      })
                    }}
                    style={{ padding: '4px 8px', fontSize: 11, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)', color: '#fff', borderRadius: 6, cursor: 'pointer' }}
                  >
                    {m.icon} {m.name} ({m.maxHp} HP)
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleAddEnemySubmit} className="combat-modal-form">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 80px', gap: 8 }}>
                <div className="combat-form-field">
                  <label>Nome</label>
                  <input
                    type="text"
                    value={enemyForm.name}
                    onChange={e => setEnemyForm(prev => ({ ...prev, name: e.target.value }))}
                    className="combat-dark-input"
                  />
                </div>
                <div className="combat-form-field">
                  <label>Ícone</label>
                  <input
                    type="text"
                    value={enemyForm.icon}
                    onChange={e => setEnemyForm(prev => ({ ...prev, icon: e.target.value }))}
                    className="combat-dark-input"
                    style={{ textAlign: 'center' }}
                  />
                </div>
                <div className="combat-form-field">
                  <label>HP</label>
                  <input
                    type="number"
                    value={enemyForm.maxHp}
                    onChange={e => setEnemyForm(prev => ({ ...prev, maxHp: e.target.value }))}
                    className="combat-dark-input"
                  />
                </div>
              </div>

              {/* Atributos */}
              <div className="combat-form-field">
                <label>Atributos</label>
                <div className="combat-attrs-grid">
                  {['forca', 'destreza', 'constituicao', 'sabedoria', 'carisma'].map(attr => (
                    <div key={attr} className="combat-attr-box">
                      <span className="attr-tag-label">{attr.substring(0, 3)}</span>
                      <input
                        type="number"
                        value={enemyForm[attr]}
                        onChange={e => setEnemyForm(prev => ({ ...prev, [attr]: Number(e.target.value) }))}
                        className="combat-dark-input attr-number-input"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  id="addBossCheck"
                  checked={enemyForm.isBoss}
                  onChange={e => setEnemyForm(prev => ({ ...prev, isBoss: e.target.checked }))}
                  style={{ width: 'auto' }}
                />
                <label htmlFor="addBossCheck" style={{ margin: 0, fontSize: 12, cursor: 'pointer', color: '#fbbf24', fontWeight: 600 }}>
                  👑 Marcar como Chefe (Boss)
                </label>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <button type="button" className="btn" onClick={() => setShowAddEnemyModal(false)} style={{ flex: 1 }}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>+ Adicionar à Cena</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
