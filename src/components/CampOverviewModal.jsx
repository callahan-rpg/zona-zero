import { useState, useEffect } from 'react'
import {
  collection,
  doc,
  onSnapshot,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../contexts/AuthContext'
import { useGameConfig } from '../contexts/GameConfigContext'
import {
  DEFAULT_CAMP_CONFIG,
  getCampCurrentCycleKey,
  getCampActiveModifiers,
  joinCampMission,
  leaveCampMission,
  submitMissionReport,
  formatCountdown,
} from '../utils/campSystem'

export default function CampOverviewModal({ isOpen, onClose }) {
  const { user, character, refreshCharacter } = useAuth()
  const gameConfig = useGameConfig()

  const [activeTab, setActiveTab] = useState('structures') // structures | missions
  const [missionFilter, setMissionFilter] = useState('all') // all | improvement | resource
  const [structures, setStructures] = useState([])
  const [missions, setMissions] = useState([])
  const [campConfig, setCampConfig] = useState(DEFAULT_CAMP_CONFIG)
  const [cycleData, setCycleData] = useState({ completedCount: 0, missionIds: [] })
  const [now, setNow] = useState(Date.now())

  const [actionLoading, setActionLoading] = useState(null) // missionId being actioned
  const [errorMsg, setErrorMsg] = useState('')
  const [toastMsg, setToastMsg] = useState('')

  // Modal de Entrega de Relatório
  const [submitModal, setSubmitModal] = useState(null) // { missionId, missionName }
  const [reportUrl, setReportUrl] = useState('')
  const [reportNotes, setReportNotes] = useState('')
  const [submitLoading, setSubmitLoading] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // 1. Escuta Estruturas
  useEffect(() => {
    if (!isOpen) return
    const unsub = onSnapshot(collection(db, 'camp_structures'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      list.sort((a, b) => {
        if (a.id === 'casa_grande') return -1
        if (b.id === 'casa_grande') return 1
        return (a.name || '').localeCompare(b.name || '')
      })
      setStructures(list)
    })
    return unsub
  }, [isOpen])

  // 2. Escuta Missões
  useEffect(() => {
    if (!isOpen) return
    const unsub = onSnapshot(collection(db, 'camp_missions'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setMissions(list.filter(m => m.active !== false))
    })
    return unsub
  }, [isOpen])

  // 3. Escuta Config do Acampamento
  useEffect(() => {
    if (!isOpen) return
    const unsub = onSnapshot(doc(db, 'camp_config', 'global'), (snap) => {
      if (snap.exists()) setCampConfig({ ...DEFAULT_CAMP_CONFIG, ...snap.data() })
    })
    return unsub
  }, [isOpen])

  // 4. Escuta Limite do Jogador no Ciclo Atual
  useEffect(() => {
    if (!isOpen || !user?.uid) return
    const cycleKey = getCampCurrentCycleKey(campConfig, gameConfig)
    const cycleRef = doc(db, 'camp_player_cycles', `${user.uid}_${cycleKey}`)
    const unsub = onSnapshot(cycleRef, (snap) => {
      if (snap.exists()) {
        setCycleData(snap.data())
      } else {
        setCycleData({ completedCount: 0, missionIds: [] })
      }
    })
    return unsub
  }, [isOpen, user?.uid, campConfig, gameConfig])

  // Relógio para contagens regressivas em tempo real
  useEffect(() => {
    if (!isOpen) return
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [isOpen])

  function showToast(msg) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 3500)
  }

  if (!isOpen) return null

  const casaGrande = structures.find(s => s.id === 'casa_grande')
  const cgLevel = casaGrande ? Number(casaGrande.level) || 1 : 1
  const cycleLimit = Number(campConfig.missionLimitPerCycle) || 2
  const completedCount = Number(cycleData.completedCount) || 0
  const isLimitReached = completedCount >= cycleLimit
  const consolidatedMods = getCampActiveModifiers(structures)
  const inventory = character?.inventory || []

  // Candidatar-se a uma Missão
  async function handleJoin(mission) {
    if (actionLoading) return
    setErrorMsg('')
    setActionLoading(mission.id)
    try {
      const result = await joinCampMission({
        db, userUid: user.uid, character, missionId: mission.id,
      })
      if (result.isFull) {
        showToast(`✅ Equipe formada! A missão "${result.missionName}" entrou em andamento. O prazo de ${mission.durationHoursOff || 48}h OFF começou agora.`)
      } else {
        showToast(`✅ Inscrito! Vagas: ${result.participantsCount}/${result.maxSlots}`)
      }
    } catch (err) {
      setErrorMsg(err.message || 'Falha ao se inscrever.')
    } finally {
      setActionLoading(null)
    }
  }

  // Sair de uma Missão Aberta
  async function handleLeave(mission) {
    if (actionLoading) return
    setErrorMsg('')
    setActionLoading(mission.id)
    try {
      await leaveCampMission({ db, userUid: user.uid, missionId: mission.id })
      showToast('Você saiu da missão.')
    } catch (err) {
      setErrorMsg(err.message || 'Falha ao sair da missão.')
    } finally {
      setActionLoading(null)
    }
  }

  // Entregar Relatório de RP
  async function handleSubmitReport() {
    if (!submitModal || !reportUrl.trim()) return
    setSubmitError('')
    setSubmitLoading(true)
    try {
      await submitMissionReport({
        db,
        userUid: user.uid,
        character,
        missionId: submitModal.missionId,
        documentUrl: reportUrl,
        notes: reportNotes,
      })
      showToast(`📄 Relatório de "${submitModal.missionName}" enviado! Aguardando aprovação da Staff.`)
      setSubmitModal(null)
      setReportUrl('')
      setReportNotes('')
    } catch (err) {
      setSubmitError(err.message || 'Falha ao enviar relatório.')
    } finally {
      setSubmitLoading(false)
    }
  }

  // Filtra missões exibidas
  const filteredMissions = missions.filter(m => {
    if (missionFilter === 'improvement') return m.type === 'improvement'
    if (missionFilter === 'resource') return m.type === 'resource'
    return true
  })

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: 16,
    }}>
      <div style={{
        background: 'linear-gradient(180deg, #0f172a 0%, #090d16 100%)',
        border: '1px solid rgba(234, 179, 8, 0.4)',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.9), 0 0 30px rgba(234, 179, 8, 0.1)',
        borderRadius: 14,
        maxWidth: 920,
        width: '100%',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        color: '#fff',
      }}>
        {/* Header do Acampamento */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(0, 0, 0, 0.4)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 26 }}>🏕️</span>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#facc15', letterSpacing: 0.5 }}>
                  {campConfig.campName || 'Acampamento de Sosnovka'}
                </h2>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  Centro de Sobrevivência • Casa Grande Nível {cgLevel} / 5
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              background: 'rgba(234, 179, 8, 0.12)',
              border: '1px solid rgba(234, 179, 8, 0.4)',
              padding: '6px 12px',
              borderRadius: 8,
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <span>🔨 Missões no ciclo:</span>
              <strong style={{ color: isLimitReached ? '#ef4444' : '#4ade80', fontSize: 13 }}>
                {completedCount} / {cycleLimit}
              </strong>
            </div>

            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: 22,
                cursor: 'pointer',
                lineHeight: 1,
                padding: 4,
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Abas de Navegação */}
        <div style={{
          display: 'flex',
          gap: 8,
          padding: '10px 20px',
          background: 'rgba(0, 0, 0, 0.2)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        }}>
          <button
            className={`btn btn-sm ${activeTab === 'structures' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('structures')}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            🏛️ Estruturas ({structures.length})
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'missions' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('missions')}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            🔨 Missões ({missions.length})
          </button>
        </div>

        {/* Toast de feedback rápido */}
        {toastMsg && (
          <div style={{
            margin: '12px 20px 0',
            padding: '10px 14px',
            background: 'rgba(34, 197, 94, 0.15)',
            border: '1px solid #22c55e',
            borderRadius: 8,
            color: '#86efac',
            fontSize: 12,
            animation: 'fadeIn 0.2s ease',
          }}>
            {toastMsg}
          </div>
        )}
        {/* Erro de feedback */}
        {errorMsg && (
          <div style={{
            margin: '12px 20px 0',
            padding: '10px 14px',
            background: 'rgba(239, 68, 68, 0.2)',
            border: '1px solid #ef4444',
            borderRadius: 8,
            color: '#fca5a5',
            fontSize: 12,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span>⚠️ {errorMsg}</span>
            <button onClick={() => setErrorMsg('')} style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: 16 }}>✕</button>
          </div>
        )}

        {/* Conteúdo com Scroll */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

          {/* ========================================================================= */}
          {/* ABA 1: ESTRUTURAS DO ACAMPAMENTO */}
          {/* ========================================================================= */}
          {activeTab === 'structures' && (
            <div>
              {/* Barra Resumo de Bônus Ativos */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 10,
                padding: '12px 16px',
                marginBottom: 16,
                display: 'flex',
                justifyContent: 'space-around',
                flexWrap: 'wrap',
                gap: 10,
                fontSize: 12,
              }}>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: 10, textTransform: 'uppercase' }}>Defesa Base</span>
                  <strong style={{ color: '#22c55e', fontSize: 14 }}>+{consolidatedMods.base_defense_bonus}</strong>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: 10, textTransform: 'uppercase' }}>Armazém Extra</span>
                  <strong style={{ color: '#38bdf8', fontSize: 14 }}>+{consolidatedMods.storage_capacity_bonus} slots</strong>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: 10, textTransform: 'uppercase' }}>Consumo Necessidades</span>
                  <strong style={{ color: '#facc15', fontSize: 14 }}>
                    {consolidatedMods.need_consumption_multiplier < 1 ? `-${Math.round((1 - consolidatedMods.need_consumption_multiplier) * 100)}%` : 'Padrão'}
                  </strong>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: 10, textTransform: 'uppercase' }}>Tempo de Plantio</span>
                  <strong style={{ color: '#4ade80', fontSize: 14 }}>
                    {consolidatedMods.crop_growth_time_multiplier < 1 ? `-${Math.round((1 - consolidatedMods.crop_growth_time_multiplier) * 100)}%` : 'Padrão'}
                  </strong>
                </div>
              </div>

              {/* Grid de Estruturas */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 14 }}>
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
                        background: 'rgba(15, 23, 42, 0.65)',
                        border: isCg ? '1.5px solid rgba(234, 179, 8, 0.7)' : '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: 10,
                        padding: 14,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 22 }}>{st.icon || '🏛️'}</span>
                            <strong style={{ fontSize: 14, color: isCg ? '#facc15' : '#fff' }}>{st.name}</strong>
                          </div>
                          <span style={{
                            fontSize: 11,
                            fontWeight: 800,
                            padding: '2px 7px',
                            borderRadius: 4,
                            background: isCg ? 'rgba(234, 179, 8, 0.2)' : 'rgba(56, 189, 248, 0.15)',
                            color: isCg ? '#facc15' : '#38bdf8',
                            border: `1px solid ${isCg ? '#eab308' : '#0284c7'}`,
                          }}>
                            Nível {curLevel}
                          </span>
                        </div>

                        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 10px 0', minHeight: 28 }}>
                          {st.description}
                        </p>

                        {/* Barra de Progresso em PM */}
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                            <span style={{ color: 'var(--text-muted)' }}>Progresso (PM):</span>
                            <strong style={{ color: pct >= 100 ? '#4ade80' : '#facc15' }}>
                              {curPm} / {neededPm} PM
                            </strong>
                          </div>
                          <div style={{ width: '100%', height: 7, background: 'rgba(0,0,0,0.5)', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{
                              width: `${pct}%`,
                              height: '100%',
                              background: pct >= 100 ? '#22c55e' : 'linear-gradient(90deg, #eab308, #f59e0b)',
                              borderRadius: 4,
                              transition: 'width 0.3s ease',
                            }} />
                          </div>
                        </div>

                        {/* Alerta de Bloqueio por Casa Grande */}
                        {isCeilingBlocked && (
                          <div style={{
                            background: 'rgba(239, 68, 68, 0.12)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: 6,
                            padding: '6px 8px',
                            fontSize: 10,
                            color: '#fca5a5',
                            marginBottom: 8,
                          }}>
                            🔒 <strong>Limite de Nível:</strong> A Casa Grande precisa alcançar o Nível {curLevel + 1} para esta estrutura poder evoluir.
                          </div>
                        )}

                        {/* Benefícios Atuais */}
                        <div style={{ background: 'rgba(0,0,0,0.25)', padding: 8, borderRadius: 6, fontSize: 10, marginBottom: 8 }}>
                          <div style={{ color: '#4ade80', marginBottom: 3 }}>
                            ✓ <strong>Ativo:</strong> {currentBenefit?.label || 'Base funcional'}
                          </div>
                          {nextBenefit ? (
                            <div style={{ color: '#93c5fd' }}>
                              ⬆️ <strong>Próximo:</strong> {nextBenefit?.label}
                            </div>
                          ) : (
                            <div style={{ color: '#facc15' }}>
                              ⭐ Nível máximo atingido!
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Melhorias Especiais */}
                      {Array.isArray(st.specialUpgrades) && st.specialUpgrades.length > 0 && (
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 6, fontSize: 10 }}>
                          <span style={{ color: 'var(--text-muted)' }}>Especial: </span>
                          {st.specialUpgrades.map(u => (
                            <span key={u.id} style={{ color: u.unlocked ? '#4ade80' : 'var(--text-muted)' }}>
                              {u.unlocked ? `✓ ${u.name}` : `🔒 ${u.name} (Nvl ${u.levelRequired})`}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ABA 2: MISSÕES DISPONÍVEIS */}
          {/* ========================================================================= */}
          {activeTab === 'missions' && (
            <div>
              {/* Filtros de Missões */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className={`btn btn-sm ${missionFilter === 'all' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setMissionFilter('all')}
                  >
                    Todas ({missions.length})
                  </button>
                  <button
                    className={`btn btn-sm ${missionFilter === 'improvement' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setMissionFilter('improvement')}
                  >
                    🔨 Melhoria (+PM)
                  </button>
                  <button
                    className={`btn btn-sm ${missionFilter === 'resource' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setMissionFilter('resource')}
                  >
                    📦 Recursos
                  </button>
                </div>

                <div style={{ fontSize: 12, color: isLimitReached ? '#ef4444' : 'var(--text-muted)' }}>
                  {isLimitReached ? (
                    <span>⚠️ Limite do ciclo atingido ({completedCount}/{cycleLimit}). Aguarde a virada do ciclo.</span>
                  ) : (
                    <span>Você pode realizar mais <strong>{cycleLimit - completedCount}</strong> missão(ões) neste ciclo.</span>
                  )}
                </div>
              </div>

              {/* Grid de Missões Cooperativas */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: 14 }}>
                {filteredMissions.map((mission) => {
                  const isImprovement = mission.type === 'improvement'
                  const targetStruct = structures.find(s => s.id === mission.targetStructureId)
                  const targetLevel = targetStruct ? Number(targetStruct.level) || 1 : 1
                  const isCg = mission.targetStructureId === 'casa_grande'
                  const isCeilingBlocked = isImprovement && !isCg && targetLevel >= cgLevel

                  const mStatus = mission.status || 'aberta'
                  const participants = mission.participants || []
                  const maxSlots = Number(mission.maxSlots || campConfig.defaultMissionSlots || 2)
                  const isUserParticipant = participants.some(p => p.uid === user?.uid)
                  const isFull = participants.length >= maxSlots

                  // Countdown do prazo
                  const deadlineMs = mission.deadline ? new Date(mission.deadline).getTime() - now : 0
                  const isExpired = mission.deadline && deadlineMs <= 0

                  // Cor de borda por status
                  const borderColor = mStatus === 'em_andamento'
                    ? 'rgba(251, 191, 36, 0.6)'
                    : mStatus === 'pendente_aprovacao'
                    ? 'rgba(167, 139, 250, 0.6)'
                    : isImprovement ? 'rgba(59, 130, 246, 0.35)' : 'rgba(34, 197, 94, 0.35)'

                  return (
                    <div
                      key={mission.id}
                      style={{
                        background: 'rgba(15, 23, 42, 0.7)',
                        border: `1px solid ${borderColor}`,
                        borderRadius: 10,
                        padding: 14,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      {/* Cabeçalho do Card */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{
                          fontSize: 10, padding: '2px 7px', borderRadius: 4, fontWeight: 700, textTransform: 'uppercase',
                          background: isImprovement ? 'rgba(59, 130, 246, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                          color: isImprovement ? '#93c5fd' : '#86efac',
                          border: `1px solid ${isImprovement ? '#3b82f6' : '#22c55e'}`,
                        }}>
                          {isImprovement ? '🔨 Melhoria' : '📦 Recurso'}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {isImprovement && (
                            <span style={{ fontSize: 11, fontWeight: 800, color: '#facc15' }}>+{mission.rewardPm || 5} PM</span>
                          )}
                          {/* Badge de Status */}
                          {mStatus === 'em_andamento' && (
                            <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(251,191,36,0.2)', color: '#fbbf24', border: '1px solid #fbbf24', fontWeight: 700 }}>
                              ⚡ EM ANDAMENTO
                            </span>
                          )}
                          {mStatus === 'pendente_aprovacao' && (
                            <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(167,139,250,0.2)', color: '#a78bfa', border: '1px solid #a78bfa', fontWeight: 700 }}>
                              🕐 ANÁLISE STAFF
                            </span>
                          )}
                        </div>
                      </div>

                      <strong style={{ fontSize: 14, color: '#fff' }}>{mission.name}</strong>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>{mission.description}</p>

                      {/* Estrutura Destino */}
                      {isImprovement && targetStruct && (
                        <div style={{ fontSize: 11, background: 'rgba(0,0,0,0.3)', padding: '5px 8px', borderRadius: 6 }}>
                          🏛️ <strong>{targetStruct.name}</strong> — Nv {targetLevel} • {targetStruct.currentPm || 0}/{targetStruct.pmPerLevel || 100} PM
                          {isCeilingBlocked && <span style={{ color: '#f87171', marginLeft: 6 }}>🔒 Bloqueado pela Casa Grande</span>}
                        </div>
                      )}

                      {/* Recompensas de Materiais */}
                      {Array.isArray(mission.rewardItems) && mission.rewardItems.length > 0 && (
                        <div style={{ fontSize: 11, background: 'rgba(34,197,94,0.1)', padding: '5px 8px', borderRadius: 6, color: '#86efac' }}>
                          🎁 Recompensa: {mission.rewardItems.map(rw => `${rw.icon || '📦'} +${rw.quantity} ${rw.name}`).join(', ')}
                        </div>
                      )}

                      {/* === VAGAS E PARTICIPANTES === */}
                      <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          👥 Equipe — {participants.length}/{maxSlots} vagas
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {Array.from({ length: maxSlots }).map((_, slotIdx) => {
                            const participant = participants[slotIdx]
                            return (
                              <div key={slotIdx} style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '5px 8px', borderRadius: 6,
                                background: participant ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)',
                                border: `1px solid ${participant ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)'}`,
                                fontSize: 12,
                              }}>
                                <span style={{ fontSize: 14 }}>{participant ? '✅' : '🔲'}</span>
                                {participant ? (
                                  <span><strong style={{ color: '#fff' }}>{participant.name}</strong>{participant.profession ? <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>({participant.profession})</span> : null}</span>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Vaga {slotIdx + 1} — Disponível</span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* === COUNTDOWN (se em andamento) === */}
                      {mStatus === 'em_andamento' && mission.deadline && (
                        <div style={{
                          background: isExpired ? 'rgba(239,68,68,0.15)' : 'rgba(251,191,36,0.12)',
                          border: `1px solid ${isExpired ? '#ef4444' : '#fbbf24'}`,
                          borderRadius: 8, padding: '8px 12px',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12,
                        }}>
                          <span style={{ color: isExpired ? '#fca5a5' : '#fde68a' }}>
                            {isExpired ? '⚠️ Prazo expirado!' : '⏱️ Prazo restante:'}
                          </span>
                          <strong style={{ color: isExpired ? '#ef4444' : '#facc15', fontSize: 14, fontFamily: 'monospace' }}>
                            {isExpired ? 'EXPIRADO' : formatCountdown(deadlineMs)}
                          </strong>
                        </div>
                      )}

                      {/* === AVISO DE ANÁLISE === */}
                      {mStatus === 'pendente_aprovacao' && (
                        <div style={{ background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.4)', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: '#c4b5fd' }}>
                          🕐 <strong>Relatório enviado!</strong> Aguardando análise da Staff.
                          {mission.submission?.documentUrl && (
                            <div style={{ marginTop: 4 }}>
                              📄 <a href={mission.submission.documentUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#a78bfa' }}>Ver documento entregue</a>
                            </div>
                          )}
                          {mission.rejectionReason && (
                            <div style={{ marginTop: 6, color: '#fca5a5', background: 'rgba(239,68,68,0.1)', padding: '4px 8px', borderRadius: 4 }}>
                              ❌ Rejeitado: {mission.rejectionReason}
                            </div>
                          )}
                        </div>
                      )}

                      {/* === AÇÕES === */}
                      <div style={{ display: 'flex', gap: 8 }}>
                        {/* Botão Inscrever */}
                        {mStatus === 'aberta' && !isUserParticipant && !isCeilingBlocked && (
                          <button
                            className="btn btn-sm btn-primary"
                            disabled={!!actionLoading || isFull}
                            onClick={() => handleJoin(mission)}
                            style={{ flex: 1, fontWeight: 700, background: isFull ? 'rgba(255,255,255,0.05)' : 'linear-gradient(90deg, #10b981, #059669)', color: isFull ? 'var(--text-muted)' : '#fff', border: isFull ? '1px solid rgba(255,255,255,0.1)' : 'none' }}
                          >
                            {actionLoading === mission.id ? '...' : isFull ? '⛔ Vagas Esgotadas' : '✋ Inscrever-se'}
                          </button>
                        )}

                        {/* Botão Sair (só se aberta e inscrito) */}
                        {mStatus === 'aberta' && isUserParticipant && (
                          <button
                            className="btn btn-sm btn-outline"
                            disabled={!!actionLoading}
                            onClick={() => handleLeave(mission)}
                            style={{ flex: 1 }}
                          >
                            {actionLoading === mission.id ? '...' : '🚪 Desistir'}
                          </button>
                        )}

                        {/* Botão Entregar Relatório (em andamento + participante) */}
                        {mStatus === 'em_andamento' && isUserParticipant && (
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => { setSubmitModal({ missionId: mission.id, missionName: mission.name }); setReportUrl(''); setReportNotes(''); setSubmitError('') }}
                            style={{ flex: 1, fontWeight: 700, background: 'linear-gradient(90deg, #7c3aed, #6d28d9)', border: 'none' }}
                          >
                            📄 Entregar Relatório
                          </button>
                        )}

                        {/* Aviso sem ação */}
                        {mStatus === 'em_andamento' && !isUserParticipant && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', width: '100%', paddingTop: 4 }}>
                            🔒 Missão em andamento com equipe fechada.
                          </div>
                        )}
                        {mStatus === 'aberta' && isCeilingBlocked && (
                          <div style={{ fontSize: 11, color: '#f87171', textAlign: 'center', width: '100%', paddingTop: 4 }}>
                            🔒 Bloqueada pelo nível da Casa Grande.
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL DE ENTREGA DE RELATÓRIO */}
      {/* ========================================================================= */}
      {submitModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: 16,
        }}>
          <div style={{
            background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
            border: '2px solid #7c3aed',
            boxShadow: '0 0 50px rgba(124,58,237,0.4)',
            borderRadius: 14, maxWidth: 500, width: '100%', padding: 24, color: '#fff',
          }}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: 18, color: '#a78bfa' }}>📄 Entregar Relatório de RP</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 16px 0' }}>
              <strong>{submitModal.missionName}</strong> — Cole o link do Google Docs com os prints do RP. A Staff irá avaliar e aprovar os PM.
            </p>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, display: 'block', marginBottom: 4, color: 'var(--text-muted)' }}>Link do Google Docs / Álbum de Prints *</label>
              <input
                type="url"
                className="form-control"
                placeholder="https://docs.google.com/..."
                value={reportUrl}
                onChange={e => setReportUrl(e.target.value)}
                style={{ fontSize: 13 }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, display: 'block', marginBottom: 4, color: 'var(--text-muted)' }}>Observações adicionais (opcional)</label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="Descreva brevemente o que foi feito no RP..."
                value={reportNotes}
                onChange={e => setReportNotes(e.target.value)}
                style={{ fontSize: 12 }}
              />
            </div>

            {submitError && (
              <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.2)', border: '1px solid #ef4444', borderRadius: 6, fontSize: 12, color: '#fca5a5', marginBottom: 12 }}>
                ⚠️ {submitError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-sm btn-outline" onClick={() => setSubmitModal(null)} style={{ flex: 1 }}>Cancelar</button>
              <button
                className="btn btn-sm btn-primary"
                disabled={submitLoading || !reportUrl.trim()}
                onClick={handleSubmitReport}
                style={{ flex: 2, fontWeight: 700, background: 'linear-gradient(90deg, #7c3aed, #6d28d9)', border: 'none' }}
              >
                {submitLoading ? 'Enviando...' : '📤 Enviar para Avaliação da Staff'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
