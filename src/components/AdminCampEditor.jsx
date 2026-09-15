import { useState, useEffect } from 'react'
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import {
  DEFAULT_CAMP_STRUCTURES,
  DEFAULT_CAMP_CONFIG,
  DEFAULT_CAMP_MISSIONS,
  calculateEvolution,
  getCampCurrentCycleKey,
  getCampActiveModifiers,
  reviewCampMission,
} from '../utils/campSystem'
import { useGameConfig } from '../contexts/GameConfigContext'
import { uploadImageFree } from '../utils/imageUpload'

export default function AdminCampEditor() {
  const gameConfig = useGameConfig()
  const [activeSubTab, setActiveSubTab] = useState('structures') // structures | missions | config | history | review
  const [structures, setStructures] = useState([])
  const [missions, setMissions] = useState([])
  const [campConfig, setCampConfig] = useState(DEFAULT_CAMP_CONFIG)
  const [missionLogs, setMissionLogs] = useState([])
  const [evolutionLogs, setEvolutionLogs] = useState([])
  const [pendingMissions, setPendingMissions] = useState([])

  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState({ type: '', msg: '' })
  const [reviewLoading, setReviewLoading] = useState(null) // missionId being reviewed
  const [rejectModal, setRejectModal] = useState(null) // { missionId, missionName }
  const [rejectReason, setRejectReason] = useState('')
  const [uploadingBoardImg, setUploadingBoardImg] = useState(false)

  // Modal / Edição de Estrutura
  const [editingStructure, setEditingStructure] = useState(null)
  const [pmModalStructure, setPmModalStructure] = useState(null)
  const [pmAddValue, setPmAddValue] = useState(5)

  // Modal / Edição de Missão
  const [editingMission, setEditingMission] = useState(null)

  function showMsg(type, msg) {
    setFeedback({ type, msg })
    setTimeout(() => setFeedback({ type: '', msg: '' }), 4000)
  }

  // 1. Escuta Estruturas em Tempo Real
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'camp_structures'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      // Ordena: Casa Grande primeiro, depois pelo nome
      list.sort((a, b) => {
        if (a.id === 'casa_grande') return -1
        if (b.id === 'casa_grande') return 1
        return (a.name || '').localeCompare(b.name || '')
      })
      setStructures(list)
      setLoading(false)
    }, (err) => {
      console.error('Erro ao buscar estruturas:', err)
      setLoading(false)
    })
    return unsub
  }, [])

  // 2. Escuta Missões em Tempo Real
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'camp_missions'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      setMissions(list)
    }, (err) => console.error('Erro ao buscar missões:', err))
    return unsub
  }, [])

  // 3. Escuta Configuração Global do Acampamento
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'camp_config', 'global'), (snap) => {
      if (snap.exists()) {
        setCampConfig({ ...DEFAULT_CAMP_CONFIG, ...snap.data() })
      } else {
        setCampConfig(DEFAULT_CAMP_CONFIG)
      }
    }, (err) => console.error('Erro ao buscar config do acampamento:', err))
    return unsub
  }, [])

  // 4. Escuta Logs de Missões e Evolução
  useEffect(() => {
    if (activeSubTab !== 'history') return
    const qMissions = query(collection(db, 'camp_mission_logs'), orderBy('timestamp', 'desc'), limit(40))
    const unsubM = onSnapshot(qMissions, (snap) => {
      setMissionLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })

    const qEvo = query(collection(db, 'camp_evolution_logs'), orderBy('timestamp', 'desc'), limit(40))
    const unsubE = onSnapshot(qEvo, (snap) => {
      setEvolutionLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })

    return () => {
      unsubM()
      unsubE()
    }
  }, [activeSubTab])

  // 5. Escuta Missões Pendentes de Aprovação da Staff
  useEffect(() => {
    const qPending = query(collection(db, 'camp_missions'))
    const unsub = onSnapshot(qPending, (snap) => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setPendingMissions(all.filter(m => m.status === 'pendente_aprovacao'))
    })
    return unsub
  }, [])

  // --- Ações Administrativas ---

  // Inicializar Estruturas Padrão de Sosnovka
  async function handleSeedStructures() {
    if (!window.confirm('Deseja inicializar as 7 estruturas canônicas do Acampamento de Sosnovka?\n(Estruturas existentes com o mesmo ID não serão sobrescritas).')) return
    try {
      let created = 0
      for (const def of DEFAULT_CAMP_STRUCTURES) {
        const existing = structures.find(s => s.id === def.id)
        if (!existing) {
          await setDoc(doc(db, 'camp_structures', def.id), {
            ...def,
            createdAt: new Date().toISOString(),
          })
          created++
        }
      }
      showMsg('success', `${created} estrutura(s) padrão adicionada(s) com sucesso!`)
    } catch (err) {
      showMsg('error', 'Falha ao inicializar estruturas: ' + err.message)
    }
  }

  // Inicializar Missões Padrão
  async function handleSeedMissions() {
    if (!window.confirm('Deseja criar as missões padrão de Melhoria e Recursos de Sosnovka?')) return
    try {
      let created = 0
      for (const def of DEFAULT_CAMP_MISSIONS) {
        const existing = missions.find(m => m.id === def.id)
        if (!existing) {
          await setDoc(doc(db, 'camp_missions', def.id), {
            ...def,
            createdAt: new Date().toISOString(),
          })
          created++
        }
      }
      showMsg('success', `${created} missão(ões) padrão criada(s) com sucesso!`)
    } catch (err) {
      showMsg('error', 'Falha ao inicializar missões: ' + err.message)
    }
  }

  // Salvar Configuração Global
  async function handleSaveConfig(e) {
    e.preventDefault()
    try {
      await setDoc(doc(db, 'camp_config', 'global'), campConfig, { merge: true })
      showMsg('success', 'Configurações globais salvas com sucesso!')
    } catch (err) {
      showMsg('error', 'Erro ao salvar configurações: ' + err.message)
    }
  }

  // Virar Ciclo Manualmente
  async function handleAdvanceManualCycle() {
    const nextCycle = (Number(campConfig.manualCycleId) || 1) + 1
    if (!window.confirm(`Deseja virar o ciclo do Acampamento para o Ciclo ${nextCycle}?\nIsso resetará o limite de 2 missões de todos os personagens para este novo ciclo.`)) return
    try {
      const updated = {
        ...campConfig,
        manualCycleId: nextCycle,
        lastManualResetAt: new Date().toISOString(),
      }
      await setDoc(doc(db, 'camp_config', 'global'), updated, { merge: true })
      showMsg('success', `Ciclo avançado com sucesso para o Ciclo ${nextCycle}!`)
    } catch (err) {
      showMsg('error', 'Erro ao avançar ciclo: ' + err.message)
    }
  }

  // Salvar Estrutura
  async function handleSaveStructure(e) {
    e.preventDefault()
    if (!editingStructure?.id || !editingStructure?.name) return
    try {
      await setDoc(doc(db, 'camp_structures', editingStructure.id), editingStructure, { merge: true })
      setEditingStructure(null)
      showMsg('success', `Estrutura "${editingStructure.name}" salva com sucesso!`)
    } catch (err) {
      showMsg('error', 'Erro ao salvar estrutura: ' + err.message)
    }
  }

  // Adicionar PM Diretamente (Admin)
  async function handleAddPmDirect() {
    if (!pmModalStructure || !pmAddValue) return
    const casaGrande = structures.find(s => s.id === 'casa_grande')
    const isCg = pmModalStructure.id === 'casa_grande'
    const cgLevel = casaGrande ? Number(casaGrande.level) || 1 : 1

    try {
      const evo = calculateEvolution({
        currentLevel: Number(pmModalStructure.level) || 1,
        currentPm: Number(pmModalStructure.currentPm) || 0,
        addedPm: Number(pmAddValue),
        maxLevel: Number(pmModalStructure.maxLevel) || 5,
        pmPerLevel: Number(pmModalStructure.pmPerLevel) || 100,
        isCasaGrande: isCg,
        casaGrandeLevel: cgLevel,
      })

      await updateDoc(doc(db, 'camp_structures', pmModalStructure.id), {
        level: evo.newLevel,
        currentPm: evo.newPm,
        lastAdminPmAddAt: new Date().toISOString(),
      })

      showMsg('success', `+${pmAddValue} PM aplicados! Nível: ${evo.newLevel} | Progresso: ${evo.newPm}/100`)
      setPmModalStructure(null)
    } catch (err) {
      showMsg('error', 'Erro ao aplicar PM: ' + err.message)
    }
  }

  // Salvar Missão
  async function handleSaveMission(e) {
    e.preventDefault()
    if (!editingMission?.name) return
    try {
      const missionId = editingMission.id || `mis_${Date.now().toString(36)}`
      const dataToSave = {
        ...editingMission,
        id: missionId,
        rewardPm: Number(editingMission.rewardPm) || 0,
        active: editingMission.active !== false,
      }
      await setDoc(doc(db, 'camp_missions', missionId), dataToSave, { merge: true })
      setEditingMission(null)
      showMsg('success', `Missão "${dataToSave.name}" salva com sucesso!`)
    } catch (err) {
      showMsg('error', 'Erro ao salvar missão: ' + err.message)
    }
  }

  // Aprovar Missão (Staff)
  async function handleApproveMission(missionId) {
    if (reviewLoading) return
    setReviewLoading(missionId)
    try {
      const result = await reviewCampMission({
        db,
        adminUid: 'admin',
        adminName: 'Staff',
        missionId,
        approved: true,
        gameConfig,
      })
      showMsg('success', `✅ Missão "${result.missionName}" aprovada! +${result.pmGranted} PM aplicados.`)
    } catch (err) {
      showMsg('error', 'Erro ao aprovar: ' + err.message)
    } finally {
      setReviewLoading(null)
    }
  }

  // Rejeitar Missão (Staff)
  async function handleRejectMission() {
    if (!rejectModal || reviewLoading) return
    setReviewLoading(rejectModal.missionId)
    try {
      await reviewCampMission({
        db,
        adminUid: 'admin',
        adminName: 'Staff',
        missionId: rejectModal.missionId,
        approved: false,
        rejectionReason: rejectReason || 'Relatório não aprovado.',
        gameConfig,
      })
      showMsg('success', `Missão rejeitada. Os participantes foram notificados.`)
      setRejectModal(null)
      setRejectReason('')
    } catch (err) {
      showMsg('error', 'Erro ao rejeitar: ' + err.message)
    } finally {
      setReviewLoading(null)
    }
  }

  // Deletar Missão
  async function handleDeleteMission(missionId, name) {
    if (!window.confirm(`Excluir permanentemente a missão "${name}"?`)) return
    try {
      await deleteDoc(doc(db, 'camp_missions', missionId))
      showMsg('success', 'Missão excluída.')
    } catch (err) {
      showMsg('error', 'Erro ao excluir missão: ' + err.message)
    }
  }

  // Casa Grande & Teto
  const casaGrande = structures.find(s => s.id === 'casa_grande')
  const cgLevel = casaGrande ? Number(casaGrande.level) || 1 : 1
  const activeCycleKey = getCampCurrentCycleKey(campConfig, gameConfig)
  const consolidatedMods = getCampActiveModifiers(structures)

  return (
    <div style={{ color: '#fff' }}>
      {/* Header & Feedback */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.4rem', color: '#facc15' }}>
            🏕️ {campConfig.campName || 'Acampamento de Sosnovka'}
          </h2>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Sede Central: <strong>Casa Grande (Nível {cgLevel})</strong> • Ciclo Ativo: <code>{activeCycleKey}</code> • Limite: <strong>{campConfig.missionLimitPerCycle || 2} missões/personagem</strong>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {structures.length === 0 && (
            <button className="btn btn-sm btn-primary" onClick={handleSeedStructures}>
              🌱 Inicializar 7 Estruturas
            </button>
          )}
          {missions.length === 0 && (
            <button className="btn btn-sm btn-outline" onClick={handleSeedMissions}>
              📜 Criar Missões Padrão
            </button>
          )}
          {campConfig.cycleType === 'manual' && (
            <button className="btn btn-sm" onClick={handleAdvanceManualCycle} style={{ background: '#7c3aed', color: '#fff', border: 'none' }}>
              🔄 Virar Ciclo Manual ({campConfig.manualCycleId || 1})
            </button>
          )}
        </div>
      </div>

      {feedback.msg && (
        <div style={{
          padding: '10px 14px',
          borderRadius: 8,
          marginBottom: 16,
          background: feedback.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)',
          border: `1px solid ${feedback.type === 'error' ? '#ef4444' : '#22c55e'}`,
          color: feedback.type === 'error' ? '#fca5a5' : '#86efac',
          fontSize: 13,
        }}>
          {feedback.msg}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <button
          className={`btn btn-sm ${activeSubTab === 'structures' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveSubTab('structures')}
        >
          🏛️ Estruturas ({structures.length})
        </button>
        <button
          className={`btn btn-sm ${activeSubTab === 'missions' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveSubTab('missions')}
        >
          🔨 Missões ({missions.length})
        </button>
        <button
          className={`btn btn-sm ${activeSubTab === 'config' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveSubTab('config')}
        >
          ⚙️ Ciclos & Regras
        </button>
        <button
          className={`btn btn-sm ${activeSubTab === 'history' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveSubTab('history')}
        >
          📜 Histórico de Auditoria
        </button>
        <button
          className={`btn btn-sm ${activeSubTab === 'review' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveSubTab('review')}
          style={pendingMissions.length > 0 ? { borderColor: '#f59e0b', color: '#fbbf24' } : {}}
        >
          📋 Revisão Staff {pendingMissions.length > 0 && <span style={{ marginLeft: 4, background: '#ef4444', color: '#fff', borderRadius: 99, padding: '0 5px', fontSize: 10, fontWeight: 800 }}>{pendingMissions.length}</span>}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1. ABA DE ESTRUTURAS */}
      {/* ========================================================================= */}
      {activeSubTab === 'structures' && (
        <div>
          {/* Card Resumo da Casa Grande e Modificadores */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.12), rgba(0,0,0,0.4))',
            border: '1px solid rgba(234, 179, 8, 0.4)',
            borderRadius: 10,
            padding: 16,
            marginBottom: 20,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#facc15', textTransform: 'uppercase', letterSpacing: 1 }}>
                ⭐ Teto de Evolução do Acampamento
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}>
                Casa Grande — Nível {cgLevel} / 5
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                Nenhuma outra estrutura pode avançar além do Nível {cgLevel} até que a Casa Grande evolua.
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)' }}>
                🛡️ Defesa Base: <strong>+{consolidatedMods.base_defense_bonus}</strong>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)' }}>
                📦 Armazém: <strong>+{consolidatedMods.storage_capacity_bonus} slots</strong>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)' }}>
                🐔 Galinhas: <strong>+{consolidatedMods.chicken_capacity_bonus}</strong>
              </div>
            </div>
          </div>

          {/* Grid de Estruturas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {structures.map((st) => {
              const curLevel = Number(st.level) || 1
              const maxLvl = Number(st.maxLevel) || 5
              const curPm = Number(st.currentPm) || 0
              const neededPm = Number(st.pmPerLevel) || 100
              const pct = Math.min(100, Math.round((curPm / neededPm) * 100))
              const isCg = st.id === 'casa_grande'
              const isCeilingBlocked = !isCg && curLevel >= cgLevel && curLevel < maxLvl

              const currentBenefit = st.benefitsByLevel?.[curLevel]
              const nextBenefit = curLevel < maxLvl ? st.benefitsByLevel?.[curLevel + 1] : null

              return (
                <div
                  key={st.id}
                  style={{
                    background: 'rgba(15, 23, 42, 0.75)',
                    border: isCg ? '2px solid rgba(234, 179, 8, 0.6)' : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 10,
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 24 }}>{st.icon || '🏛️'}</span>
                        <div>
                          <strong style={{ fontSize: 15, color: '#fff' }}>{st.name}</strong>
                          {isCg && (
                            <span style={{ marginLeft: 6, fontSize: 10, background: '#f59e0b', color: '#000', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                              TETO
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#38bdf8' }}>
                        Nível {curLevel} <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>/ {maxLvl}</span>
                      </div>
                    </div>

                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 12px 0', minHeight: 32 }}>
                      {st.description}
                    </p>

                    {/* Barra de Progresso em PM */}
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                        <span style={{ color: 'var(--text-muted)' }}>Progresso da Evolução:</span>
                        <strong style={{ color: pct >= 100 ? '#4ade80' : '#facc15' }}>
                          {curPm} / {neededPm} PM ({pct}%)
                        </strong>
                      </div>
                      <div style={{ width: '100%', height: 8, background: 'rgba(0,0,0,0.5)', borderRadius: 4, overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${pct}%`,
                            height: '100%',
                            background: pct >= 100 ? '#22c55e' : 'linear-gradient(90deg, #eab308, #f59e0b)',
                            borderRadius: 4,
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                    </div>

                    {/* Alerta de Bloqueio por Casa Grande */}
                    {isCeilingBlocked && (
                      <div style={{
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.35)',
                        borderRadius: 6,
                        padding: '6px 10px',
                        fontSize: 11,
                        color: '#fca5a5',
                        marginBottom: 12,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}>
                        ⚠️ <span>Bloqueado pelo teto da Casa Grande (Nível {cgLevel}).</span>
                      </div>
                    )}

                    {/* Benefícios Atuais & Próximos */}
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: 10, borderRadius: 6, fontSize: 11, marginBottom: 12 }}>
                      <div style={{ color: '#4ade80', marginBottom: 4 }}>
                        ✓ <strong>Atual (Nvl {curLevel}):</strong> {currentBenefit?.label || 'Base funcional'}
                      </div>
                      {nextBenefit ? (
                        <div style={{ color: '#93c5fd' }}>
                          ⬆️ <strong>Próximo (Nvl {curLevel + 1}):</strong> {nextBenefit?.label}
                        </div>
                      ) : (
                        <div style={{ color: '#facc15' }}>
                          ✨ <strong>Nível Máximo Alcançado!</strong>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Ações da Estrutura */}
                  <div style={{ display: 'flex', gap: 8, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12 }}>
                    <button
                      className="btn btn-sm btn-outline"
                      style={{ flex: 1 }}
                      onClick={() => setEditingStructure({ ...st })}
                    >
                      ✏️ Configurar
                    </button>
                    <button
                      className="btn btn-sm"
                      style={{ background: 'rgba(234, 179, 8, 0.2)', border: '1px solid #eab308', color: '#facc15' }}
                      onClick={() => {
                        setPmModalStructure(st)
                        setPmAddValue(5)
                      }}
                    >
                      + PM Rápido
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. ABA DE MISSÕES */}
      {/* ========================================================================= */}
      {activeSubTab === 'missions' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16 }}>Catálogo de Missões ({missions.length})</h3>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                Missões de Melhoria geram PM para estruturas; Missões de Recurso fornecem materiais físicos.
              </p>
            </div>

            <button
              className="btn btn-sm btn-primary"
              onClick={() => setEditingMission({
                name: '',
                description: '',
                type: 'improvement',
                targetStructureId: 'casa_grande',
                rewardPm: 5,
                requiredMaterials: [{ itemId: 'material_madeira', name: 'Madeira', quantity: 3, icon: '🪵' }],
                rewardItems: [],
                active: true,
                category: 'construcao'
              })}
            >
              + Nova Missão
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
            {missions.map((m) => {
              const isImprovement = m.type === 'improvement'
              return (
                <div
                  key={m.id}
                  style={{
                    background: 'rgba(15, 23, 42, 0.7)',
                    border: `1px solid ${isImprovement ? 'rgba(59, 130, 246, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
                    borderRadius: 8,
                    padding: 14,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <span style={{
                        fontSize: 10,
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        background: isImprovement ? 'rgba(59, 130, 246, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                        color: isImprovement ? '#93c5fd' : '#86efac',
                        border: `1px solid ${isImprovement ? '#3b82f6' : '#22c55e'}`,
                      }}>
                        {isImprovement ? '🔨 Missão de Melhoria' : '📦 Missão de Recurso'}
                      </span>

                      <span style={{ fontSize: 11, color: m.active ? '#4ade80' : '#ef4444' }}>
                        {m.active ? '● Ativa' : '○ Inativa'}
                      </span>
                    </div>

                    <strong style={{ fontSize: 14, display: 'block', marginBottom: 4 }}>{m.name}</strong>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 10px 0' }}>{m.description}</p>

                    {isImprovement && (
                      <div style={{ fontSize: 12, marginBottom: 8 }}>
                        🏛️ Estrutura Destino: <strong>{m.targetStructureName || m.targetStructureId}</strong>
                        <span style={{ marginLeft: 8, color: '#facc15', fontWeight: 700 }}>+{m.rewardPm || 5} PM</span>
                      </div>
                    )}

                    {/* Materiais Requeridos */}
                    {Array.isArray(m.requiredMaterials) && m.requiredMaterials.length > 0 && (
                      <div style={{ fontSize: 11, background: 'rgba(0,0,0,0.3)', padding: '6px 8px', borderRadius: 4, marginBottom: 6 }}>
                        <span style={{ color: 'var(--text-muted)' }}>Materiais Exigidos: </span>
                        {m.requiredMaterials.map(mat => `${mat.quantity}x ${mat.name || mat.itemId}`).join(', ')}
                      </div>
                    )}

                    {/* Recompensas de Itens */}
                    {Array.isArray(m.rewardItems) && m.rewardItems.length > 0 && (
                      <div style={{ fontSize: 11, background: 'rgba(34, 197, 94, 0.1)', padding: '6px 8px', borderRadius: 4, marginBottom: 6, color: '#86efac' }}>
                        <span>Recompensa em Itens: </span>
                        {m.rewardItems.map(item => `${item.quantity}x ${item.name || item.itemId}`).join(', ')}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 6, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10 }}>
                    <button
                      className="btn btn-sm btn-outline"
                      style={{ flex: 1 }}
                      onClick={() => setEditingMission({ ...m })}
                    >
                      ✏️ Editar
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDeleteMission(m.id, m.name)}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. ABA DE CONFIGURAÇÃO GLOBAL */}
      {/* ========================================================================= */}
      {activeSubTab === 'config' && (
        <div style={{ maxWidth: 650, background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 20 }}>
          <h3 style={{ margin: '0 0 14px 0', fontSize: 16, color: '#facc15' }}>⚙️ Regras e Ciclos do Acampamento</h3>

          <form onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Nome do Acampamento</label>
              <input
                type="text"
                className="form-control"
                value={campConfig.campName || ''}
                onChange={e => setCampConfig(prev => ({ ...prev, campName: e.target.value }))}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Limite de Missões por Ciclo</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  className="form-control"
                  value={campConfig.missionLimitPerCycle ?? 2}
                  onChange={e => setCampConfig(prev => ({ ...prev, missionLimitPerCycle: Number(e.target.value) }))}
                />
                <small style={{ color: 'var(--text-muted)', fontSize: 10 }}>Padrão: 2 missões por personagem.</small>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>PM Padrão por Missão</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  className="form-control"
                  value={campConfig.defaultRewardPm ?? 5}
                  onChange={e => setCampConfig(prev => ({ ...prev, defaultRewardPm: Number(e.target.value) }))}
                />
                <small style={{ color: 'var(--text-muted)', fontSize: 10 }}>Padrão: 5 PM.</small>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Slug da Sede no Mapa</label>
                <input
                  type="text"
                  className="form-control"
                  value={campConfig.hubLocationSlug || 'casa-grande'}
                  onChange={e => setCampConfig(prev => ({ ...prev, hubLocationSlug: e.target.value }))}
                  placeholder="ex: casa-grande"
                />
                <small style={{ color: 'var(--text-muted)', fontSize: 10 }}>Local onde o quadro de missões aparece.</small>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Vagas Padrão p/ Missão</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  className="form-control"
                  value={campConfig.defaultMissionSlots ?? 4}
                  onChange={e => setCampConfig(prev => ({ ...prev, defaultMissionSlots: Number(e.target.value) }))}
                />
                <small style={{ color: 'var(--text-muted)', fontSize: 10 }}>Padrão: 4 vagas.</small>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Duração Padrão (Horas Off)</label>
                <input
                  type="number"
                  min="1"
                  max="168"
                  className="form-control"
                  value={campConfig.defaultDurationHoursOff ?? 24}
                  onChange={e => setCampConfig(prev => ({ ...prev, defaultDurationHoursOff: Number(e.target.value) }))}
                />
                <small style={{ color: 'var(--text-muted)', fontSize: 10 }}>Tempo limite de entrega.</small>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4, fontWeight: 600, color: '#facc15' }}>
                🖼️ Imagem do Quadro de Missões (Banner Clicável na Sede)
              </label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  className="form-control"
                  style={{ flex: 1, minWidth: 240 }}
                  value={campConfig.boardImageUrl || ''}
                  placeholder="/assets/camp_quest_board.jpg ou link externo..."
                  onChange={e => setCampConfig(prev => ({ ...prev, boardImageUrl: e.target.value }))}
                />

                <label
                  style={{
                    background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.25) 0%, rgba(14, 165, 233, 0.35) 100%)',
                    border: '1px solid #38bdf8',
                    color: '#7dd3fc',
                    padding: '8px 14px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: uploadingBoardImg ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {uploadingBoardImg ? '⏳ Enviando...' : '📤 Upload do Computador'}
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploadingBoardImg}
                    style={{ display: 'none' }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      try {
                        setUploadingBoardImg(true)
                        showMsg('info', 'Fazendo upload da imagem do quadro...')
                        const url = await uploadImageFree(file)
                        if (url) {
                          setCampConfig(prev => ({ ...prev, boardImageUrl: url }))
                          showMsg('success', 'Imagem do quadro enviada e aplicada com sucesso!')
                        }
                      } catch (err) {
                        showMsg('error', 'Falha no upload: ' + err.message)
                      } finally {
                        setUploadingBoardImg(false)
                      }
                    }}
                  />
                </label>

                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => {
                    setCampConfig(prev => ({ ...prev, boardImageUrl: '/assets/camp_quest_board.jpg' }))
                    showMsg('info', 'Restaurada imagem padrão do quadro.')
                  }}
                  title="Usar imagem padrão do quadro"
                >
                  Restaurar Padrão
                </button>
              </div>
              <small style={{ color: 'var(--text-muted)', fontSize: 10, display: 'block', marginTop: 4 }}>
                Essa imagem é exibida diretamente abaixo do chat da Sede do Acampamento (no mínimo 600px). Ao clicar nela, os sobreviventes acessam o painel de missões e evolução.
              </small>

              {campConfig.boardImageUrl && (
                <div style={{ marginTop: 10, maxWidth: 360, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.5)', padding: 4 }}>
                  <img
                    src={campConfig.boardImageUrl}
                    alt="Preview do Quadro"
                    style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block', borderRadius: 6 }}
                  />
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Definição do Ciclo de Renovação</label>
              <select
                className="form-control"
                value={campConfig.cycleType || 'daily_ingame'}
                onChange={e => setCampConfig(prev => ({ ...prev, cycleType: e.target.value }))}
              >
                <option value="daily_ingame">🌅 Diário In-Game (A cada 1 dia no relógio do RPG / 12h reais)</option>
                <option value="daily_real">📅 Diário Real (A cada 24 horas no relógio real UTC)</option>
                <option value="weekly_real">🗓️ Semanal Real (Renova semanalmente)</option>
                <option value="manual">🛑 Manual pelo Mestre (Mestre clica no botão para virar o ciclo)</option>
              </select>
            </div>

            {campConfig.cycleType === 'manual' && (
              <div style={{ background: 'rgba(124, 58, 237, 0.15)', border: '1px solid #7c3aed', padding: 12, borderRadius: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#c084fc', marginBottom: 4 }}>
                  Ciclo Manual Atual: Ciclo #{campConfig.manualCycleId || 1}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
                  Última virada: {campConfig.lastManualResetAt ? new Date(campConfig.lastManualResetAt).toLocaleString('pt-BR') : 'Início do jogo'}.
                </div>
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{ background: '#7c3aed', color: '#fff', border: 'none' }}
                  onClick={handleAdvanceManualCycle}
                >
                  🔄 Virar Ciclo Agora (Avançar para Ciclo {(Number(campConfig.manualCycleId) || 1) + 1})
                </button>
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ marginTop: 10 }}>
              💾 Salvar Configurações
            </button>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. ABA DE HISTÓRICO & AUDITORIA */}
      {/* ========================================================================= */}
      {activeSubTab === 'history' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Histórico de Missões */}
          <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 16 }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: 14, color: '#38bdf8' }}>🔨 Missões Concluídas Recentes</h4>
            {missionLogs.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nenhuma missão concluída registrada ainda.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 450, overflowY: 'auto' }}>
                {missionLogs.map(log => (
                  <div key={log.id} style={{ background: 'rgba(0,0,0,0.3)', padding: 10, borderRadius: 6, fontSize: 11 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#fff' }}>
                      <strong>{log.characterName || 'Sobrevivente'}</strong>
                      <span style={{ color: 'var(--text-muted)' }}>{log.createdAt ? new Date(log.createdAt).toLocaleTimeString('pt-BR') : ''}</span>
                    </div>
                    <div style={{ color: '#facc15', marginTop: 2 }}>{log.missionName}</div>
                    <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>
                      Destino: <strong>{log.targetStructureName || 'Recursos'}</strong> • PM: <strong>+{log.pmGranted || 0}</strong>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Histórico de Evoluções */}
          <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 16 }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: 14, color: '#4ade80' }}>🏛️ Evoluções de Estruturas</h4>
            {evolutionLogs.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nenhuma evolução de estrutura registrada ainda.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 450, overflowY: 'auto' }}>
                {evolutionLogs.map(log => (
                  <div key={log.id} style={{ background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.25)', padding: 10, borderRadius: 6, fontSize: 11 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#4ade80', fontWeight: 700 }}>
                      <span>{log.structureName}</span>
                      <span>Nível {log.previousLevel} ➔ {log.newLevel}</span>
                    </div>
                    <div style={{ color: '#fff', marginTop: 3 }}>
                      Evoluído por: <strong>{log.characterName || 'Sobrevivente'}</strong> ({log.missionName})
                    </div>
                    <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>
                      {log.createdAt ? new Date(log.createdAt).toLocaleString('pt-BR') : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. ABA DE REVISÃO DA STAFF */}
      {/* ========================================================================= */}
      {activeSubTab === 'review' && (
        <div>
          <h3 style={{ margin: '0 0 14px 0', fontSize: 16, color: '#facc15' }}>📋 Missões Pendentes de Análise</h3>

          {pendingMissions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 14 }}>
              ✅ Nenhuma missão aguardando revisão no momento.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {pendingMissions.map(m => {
                const participants = m.participants || []
                const isImprovement = m.type === 'improvement'
                return (
                  <div key={m.id} style={{
                    background: 'rgba(167, 139, 250, 0.08)',
                    border: '1px solid rgba(167, 139, 250, 0.4)',
                    borderRadius: 10, padding: 16,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 700, background: isImprovement ? 'rgba(59,130,246,0.2)' : 'rgba(34,197,94,0.2)', color: isImprovement ? '#93c5fd' : '#86efac', border: `1px solid ${isImprovement ? '#3b82f6' : '#22c55e'}` }}>
                            {isImprovement ? '🔨 Melhoria' : '📦 Recurso'}
                          </span>
                          <strong style={{ fontSize: 15 }}>{m.name}</strong>
                          {isImprovement && <span style={{ color: '#facc15', fontWeight: 800 }}>+{m.rewardPm || 5} PM → {m.targetStructureName}</span>}
                        </div>

                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                          👥 Equipe: {participants.map(p => p.name).join(', ') || 'Nenhum'}
                        </div>

                        {m.submission?.submittedAt && (
                          <div style={{ fontSize: 11, color: '#a78bfa' }}>
                            📅 Entregue em: {new Date(m.submission.submittedAt).toLocaleString('pt-BR')} por <strong>{m.submission.submittedByName}</strong>
                          </div>
                        )}

                        {m.submission?.documentUrl && (
                          <div style={{ marginTop: 4 }}>
                            <a
                              href={m.submission.documentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontSize: 12, color: '#60a5fa', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            >
                              📄 Abrir Documento do RP ↗
                            </a>
                          </div>
                        )}

                        {m.submission?.notes && (
                          <div style={{ marginTop: 6, fontSize: 11, background: 'rgba(0,0,0,0.3)', padding: '6px 10px', borderRadius: 6, color: '#d1d5db' }}>
                            💬 {m.submission.notes}
                          </div>
                        )}
                      </div>

                      {/* Botões de Ação */}
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        <button
                          className="btn btn-sm"
                          disabled={!!reviewLoading}
                          onClick={() => handleApproveMission(m.id)}
                          style={{ background: '#16a34a', color: '#fff', border: 'none', fontWeight: 700, minWidth: 90 }}
                        >
                          {reviewLoading === m.id ? '...' : '✅ Aprovar'}
                        </button>
                        <button
                          className="btn btn-sm btn-outline"
                          disabled={!!reviewLoading}
                          onClick={() => { setRejectModal({ missionId: m.id, missionName: m.name }); setRejectReason('') }}
                          style={{ borderColor: '#ef4444', color: '#f87171', minWidth: 90 }}
                        >
                          ❌ Rejeitar
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIÇÃO DE ESTRUTURA */}
      {/* ========================================================================= */}
      {editingStructure && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16
        }}>
          <div style={{
            background: '#0f172a', border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 12, maxWidth: 600, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 20
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 16 }}>Configurar Estrutura: {editingStructure.name}</h3>

            <form onSubmit={handleSaveStructure} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11 }}>Ícone</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editingStructure.icon || ''}
                    onChange={e => setEditingStructure(p => ({ ...p, icon: e.target.value }))}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11 }}>Nome da Estrutura</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editingStructure.name || ''}
                    onChange={e => setEditingStructure(p => ({ ...p, name: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11 }}>Descrição</label>
                <textarea
                  className="form-control"
                  rows="2"
                  value={editingStructure.description || ''}
                  onChange={e => setEditingStructure(p => ({ ...p, description: e.target.value }))}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11 }}>Nível Atual (1 a 5)</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    className="form-control"
                    value={editingStructure.level ?? 1}
                    onChange={e => setEditingStructure(p => ({ ...p, level: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11 }}>PM Atual</label>
                  <input
                    type="number"
                    min="0"
                    max="1000"
                    className="form-control"
                    value={editingStructure.currentPm ?? 0}
                    onChange={e => setEditingStructure(p => ({ ...p, currentPm: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11 }}>PM por Nível</label>
                  <input
                    type="number"
                    min="10"
                    max="500"
                    className="form-control"
                    value={editingStructure.pmPerLevel ?? 100}
                    onChange={e => setEditingStructure(p => ({ ...p, pmPerLevel: Number(e.target.value) }))}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11 }}>Localidade Slug Vinculada</label>
                <input
                  type="text"
                  className="form-control"
                  value={editingStructure.locationSlug || ''}
                  onChange={e => setEditingStructure(p => ({ ...p, locationSlug: e.target.value }))}
                  placeholder="ex: acampamento, casa-grande"
                />
              </div>

              {/* Benefícios por nível (Configuráveis) */}
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 8, marginTop: 6 }}>
                <strong style={{ fontSize: 12, color: '#facc15', display: 'block', marginBottom: 8 }}>
                  Rótulo dos Benefícios por Nível
                </strong>
                {[1, 2, 3, 4, 5].map(lvl => (
                  <div key={lvl} style={{ marginBottom: 6 }}>
                    <label style={{ fontSize: 10, color: 'var(--text-muted)' }}>Nível {lvl}:</label>
                    <input
                      type="text"
                      className="form-control"
                      style={{ fontSize: 11, padding: '4px 8px' }}
                      value={editingStructure.benefitsByLevel?.[lvl]?.label || ''}
                      onChange={e => {
                        const val = e.target.value
                        setEditingStructure(p => ({
                          ...p,
                          benefitsByLevel: {
                            ...(p.benefitsByLevel || {}),
                            [lvl]: {
                              ...(p.benefitsByLevel?.[lvl] || {}),
                              label: val
                            }
                          }
                        }))
                      }}
                    />
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
                <button type="button" className="btn btn-sm btn-outline" onClick={() => setEditingStructure(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-sm btn-primary">
                  Salvar Estrutura
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADICIONAR PM DIRETO (ADMIN) */}
      {/* ========================================================================= */}
      {pmModalStructure && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16
        }}>
          <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 12, maxWidth: 400, width: '100%', padding: 20 }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: 15 }}>
              Adicionar PM Direto: {pmModalStructure.name}
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 14px 0' }}>
              Nível atual: {pmModalStructure.level} • PM atual: {pmModalStructure.currentPm}/{pmModalStructure.pmPerLevel || 100}
            </p>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Quantidade de PM a creditar:</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                {[5, 10, 25, 50, 100].map(v => (
                  <button
                    key={v}
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => setPmAddValue(v)}
                    style={{ borderColor: pmAddValue === v ? '#facc15' : undefined }}
                  >
                    +{v}
                  </button>
                ))}
              </div>
              <input
                type="number"
                className="form-control"
                value={pmAddValue}
                onChange={e => setPmAddValue(Number(e.target.value))}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-sm btn-outline" onClick={() => setPmModalStructure(null)}>
                Cancelar
              </button>
              <button className="btn btn-sm btn-primary" onClick={handleAddPmDirect}>
                Aplicar PM
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIÇÃO DE MISSÃO */}
      {/* ========================================================================= */}
      {editingMission && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16
        }}>
          <div style={{
            background: '#0f172a', border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 12, maxWidth: 620, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 20
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 16 }}>
              {editingMission.id ? `Editar Missão: ${editingMission.name}` : 'Criar Nova Missão'}
            </h3>

            <form onSubmit={handleSaveMission} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11 }}>Nome da Missão</label>
                <input
                  type="text"
                  className="form-control"
                  value={editingMission.name || ''}
                  onChange={e => setEditingMission(p => ({ ...p, name: e.target.value }))}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: 11 }}>Descrição dos Objetivos</label>
                <textarea
                  className="form-control"
                  rows="2"
                  value={editingMission.description || ''}
                  onChange={e => setEditingMission(p => ({ ...p, description: e.target.value }))}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11 }}>Tipo da Missão</label>
                  <select
                    className="form-control"
                    value={editingMission.type || 'improvement'}
                    onChange={e => setEditingMission(p => ({ ...p, type: e.target.value }))}
                  >
                    <option value="improvement">🔨 Missão de Melhoria (Concede PM)</option>
                    <option value="resource">📦 Missão de Recurso (Concede Materiais)</option>
                  </select>
                </div>

                {editingMission.type === 'improvement' ? (
                  <div>
                    <label style={{ fontSize: 11 }}>Estrutura Destino</label>
                    <select
                      className="form-control"
                      value={editingMission.targetStructureId || ''}
                      onChange={e => {
                        const struct = structures.find(s => s.id === e.target.value)
                        setEditingMission(p => ({
                          ...p,
                          targetStructureId: e.target.value,
                          targetStructureName: struct?.name || e.target.value,
                        }))
                      }}
                    >
                      {structures.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label style={{ fontSize: 11 }}>Categoria</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editingMission.category || 'recurso'}
                      onChange={e => setEditingMission(p => ({ ...p, category: e.target.value }))}
                    />
                  </div>
                )}
              </div>

              {editingMission.type === 'improvement' && (
                <div>
                  <label style={{ fontSize: 11 }}>Recompensa em Pontos de Melhoria (PM)</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    className="form-control"
                    value={editingMission.rewardPm ?? 5}
                    onChange={e => setEditingMission(p => ({ ...p, rewardPm: Number(e.target.value) }))}
                  />
                  <small style={{ color: 'var(--text-muted)', fontSize: 10 }}>Padrão: 5 PM.</small>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11 }}>Vagas de Participantes</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    className="form-control"
                    value={editingMission.slots ?? 4}
                    onChange={e => setEditingMission(p => ({ ...p, slots: Number(e.target.value) }))}
                  />
                  <small style={{ color: 'var(--text-muted)', fontSize: 10 }}>Padrão: 4 vagas.</small>
                </div>

                <div>
                  <label style={{ fontSize: 11 }}>Duração (Horas Off-Game)</label>
                  <input
                    type="number"
                    min="1"
                    max="168"
                    className="form-control"
                    value={editingMission.durationHoursOff ?? 24}
                    onChange={e => setEditingMission(p => ({ ...p, durationHoursOff: Number(e.target.value) }))}
                  />
                  <small style={{ color: 'var(--text-muted)', fontSize: 10 }}>Padrão: 24 horas.</small>
                </div>
              </div>

              {/* Materiais Necessários */}
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <strong style={{ fontSize: 11, color: '#facc15' }}>Materiais Necessários para Executar</strong>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    style={{ fontSize: 10, padding: '2px 8px' }}
                    onClick={() => setEditingMission(p => ({
                      ...p,
                      requiredMaterials: [...(p.requiredMaterials || []), { itemId: 'material_madeira', name: 'Madeira', quantity: 1, icon: '🪵' }]
                    }))}
                  >
                    + Adicionar Material
                  </button>
                </div>

                {(editingMission.requiredMaterials || []).map((mat, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.2fr 80px 40px', gap: 8, marginBottom: 6 }}>
                    <select
                      className="form-control"
                      value={mat.itemId}
                      onChange={e => {
                        const val = e.target.value
                        const names = {
                          material_madeira: 'Madeira',
                          material_metal: 'Metal',
                          material_sucata: 'Sucata',
                          material_tecido: 'Tecido',
                          material_suprimentos: 'Suprimentos'
                        }
                        const icons = {
                          material_madeira: '🪵',
                          material_metal: '🔩',
                          material_sucata: '⚙️',
                          material_tecido: '🧵',
                          material_suprimentos: '📦'
                        }
                        const list = [...(editingMission.requiredMaterials || [])]
                        list[idx] = { ...list[idx], itemId: val, name: names[val] || val, icon: icons[val] || '📦' }
                        setEditingMission(p => ({ ...p, requiredMaterials: list }))
                      }}
                    >
                      <option value="material_madeira">🪵 Madeira</option>
                      <option value="material_metal">🔩 Metal</option>
                      <option value="material_sucata">⚙️ Sucata</option>
                      <option value="material_tecido">🧵 Tecido</option>
                      <option value="material_suprimentos">📦 Suprimentos</option>
                    </select>

                    <input
                      type="number"
                      min="1"
                      className="form-control"
                      placeholder="Qtd"
                      value={mat.quantity}
                      onChange={e => {
                        const list = [...(editingMission.requiredMaterials || [])]
                        list[idx] = { ...list[idx], quantity: Number(e.target.value) }
                        setEditingMission(p => ({ ...p, requiredMaterials: list }))
                      }}
                    />

                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => {
                        const list = (editingMission.requiredMaterials || []).filter((_, i) => i !== idx)
                        setEditingMission(p => ({ ...p, requiredMaterials: list }))
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                <button type="button" className="btn btn-sm btn-outline" onClick={() => setEditingMission(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-sm btn-primary">
                  Salvar Missão
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REJEITAR MISSÃO (STAFF) */}
      {/* ========================================================================= */}
      {rejectModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16
        }}>
          <div style={{
            background: '#0f172a', border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: 12, maxWidth: 460, width: '100%', padding: 20
          }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: 16, color: '#f87171' }}>
              ❌ Rejeitar Missão: {rejectModal.missionName}
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
              Informe o motivo da rejeição para que os sobreviventes possam corrigir o RP ou documento:
            </p>

            <textarea
              className="form-control"
              rows="3"
              placeholder="Ex: Documento sem permissão de visualização pública / RP insuficiente..."
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              style={{ marginBottom: 14 }}
            />

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-sm btn-outline"
                disabled={!!reviewLoading}
                onClick={() => { setRejectModal(null); setRejectReason('') }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-sm btn-danger"
                disabled={!!reviewLoading}
                onClick={handleRejectMission}
                style={{ minWidth: 100 }}
              >
                {reviewLoading ? 'Processando...' : 'Confirmar Rejeição'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
