import { useState, useEffect } from 'react'
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  addDoc,
  deleteDoc,
  updateDoc,
  getDocs,
  writeBatch,
  query,
  orderBy,
  limit
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../contexts/AuthContext.jsx'
import {
  RADIO_FREQUENCIES,
  DEFAULT_RADIO_POINT,
  sendManualBroadcast,
  checkAndTriggerAutoBroadcasts,
  playRadioChime
} from '../utils/radioSystem'
import { hasRadio } from '../utils/itemSystem'
import GameIcon from './GameIcon.jsx'

export default function AdminRadioEditor({ locations = [] }) {
  const { user } = useAuth()
  const [activeSubTab, setActiveSubTab] = useState('manual') // manual | auto | points | history

  // Estados de Transmissão Manual
  const [manualText, setManualText] = useState('')
  const [manualCategory, setManualCategory] = useState('Alerta Geral')
  const [manualSending, setManualSending] = useState(false)
  const [manualSuccess, setManualSuccess] = useState('')
  const [radioUsersCount, setRadioUsersCount] = useState(0)
  const [totalUsersCount, setTotalUsersCount] = useState(0)

  // Estados de Mensagens Automáticas
  const [autoSchedules, setAutoSchedules] = useState([])
  const [editingScheduleId, setEditingScheduleId] = useState(null)
  const [scheduleForm, setScheduleForm] = useState({
    group: 'Alertas de Regiões',
    frequency: '1x_day_on',
    enabled: true,
    senderName: 'Rádio do Acampamento',
    messages: [
      'Foi identificado um grupo de zumbis passando por Sterilug. Tenha cuidado.',
      'A estrada ao norte de Volkov apresenta movimentação suspeita.',
      'Foram encontrados sinais de atividade próximo à floresta.',
      'Uma grande quantidade de infectados foi vista ao sul.'
    ]
  })
  const [newMessageText, setNewMessageText] = useState('')

  // Estados de Pontos de Rádio
  const [radioPoints, setRadioPoints] = useState([])
  const [newPoint, setNewPoint] = useState({
    name: 'Rádio do Acampamento',
    locationSlug: 'casa-grande-2-andar',
    locationName: 'Casa Grande — 2º Andar',
    description: 'Estação de rádio fixa sintonizada na frequência da base.',
    enabled: true
  })

  // Estados de Histórico
  const [historyList, setHistoryList] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [deletingId, setDeletingId] = useState(null)
  const [clearingAll, setClearingAll] = useState(false)

  // Escuta contagem de usuários com Rádio
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      let withRadio = 0
      snap.docs.forEach(d => {
        const char = d.data().character
        if (char && hasRadio(char.inventory)) {
          withRadio++
        }
      })
      setTotalUsersCount(snap.docs.length)
      setRadioUsersCount(withRadio)
    })
    return unsub
  }, [])

  // Escuta mensagens automáticas
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'radio_auto_messages'), (snap) => {
      setAutoSchedules(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [])

  // Escuta Pontos de Rádio
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'radio_points'), (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      if (docs.length === 0) {
        // Inicializa ponto padrão se não existir nenhum
        setDoc(doc(db, 'radio_points', DEFAULT_RADIO_POINT.id), DEFAULT_RADIO_POINT).catch(() => {})
      } else {
        setRadioPoints(docs)
      }
    })
    return unsub
  }, [])

  // Escuta Histórico de Transmissões
  useEffect(() => {
    const q = query(
      collection(db, 'radio_transmissions'),
      orderBy('timestamp', 'desc'),
      limit(50)
    )
    const unsub = onSnapshot(q, (snap) => {
      setHistoryList(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoadingHistory(false)
    })
    return unsub
  }, [])

  // Enviar Transmissão Manual
  async function handleSendManual(e) {
    e.preventDefault()
    if (!manualText.trim()) return alert('Digite a mensagem a ser transmitida.')

    setManualSending(true)
    setManualSuccess('')

    try {
      const res = await sendManualBroadcast({
        message: manualText.trim(),
        senderName: 'Rádio do Acampamento',
        category: manualCategory.trim(),
        gameConfig: null
      })

      playRadioChime()
      setManualSuccess(`Transmissão enviada com sucesso para ${res.recipientsCount} sobrevivente(s) com Rádio!`)
      setManualText('')
      setTimeout(() => setManualSuccess(''), 5000)
    } catch (err) {
      alert('Erro ao enviar transmissão: ' + err.message)
    } finally {
      setManualSending(false)
    }
  }

  // Adicionar mensagem à lista de mensagens aleatórias da automação
  function handleAddScheduleMessage() {
    if (!newMessageText.trim()) return
    setScheduleForm(prev => ({
      ...prev,
      messages: [...prev.messages, newMessageText.trim()]
    }))
    setNewMessageText('')
  }

  function handleRemoveScheduleMessage(index) {
    setScheduleForm(prev => ({
      ...prev,
      messages: prev.messages.filter((_, i) => i !== index)
    }))
  }

  // Salvar Agendamento Automático
  async function handleSaveSchedule(e) {
    e.preventDefault()
    if (!scheduleForm.group.trim()) return alert('Dê um nome para o grupo/categoria da mensagem.')
    if (scheduleForm.messages.length === 0) return alert('Adicione pelo menos 1 mensagem ao grupo.')

    const freqMeta = RADIO_FREQUENCIES[scheduleForm.frequency] || RADIO_FREQUENCIES['1x_day_on']
    const nowMs = Date.now()
    const nowIso = new Date().toISOString()

    const payload = {
      group: scheduleForm.group.trim(),
      category: scheduleForm.group.trim(),
      frequency: scheduleForm.frequency,
      enabled: scheduleForm.enabled,
      senderName: scheduleForm.senderName.trim() || 'Rádio do Acampamento',
      messages: scheduleForm.messages,
      updatedAt: nowIso
    }

    try {
      if (editingScheduleId) {
        await updateDoc(doc(db, 'radio_auto_messages', editingScheduleId), payload)
        setEditingScheduleId(null)
      } else {
        payload.createdAt = nowIso
        payload.lastExecution = null
        payload.lastExecutionMs = null
        payload.nextExecution = new Date(nowMs + freqMeta.intervalMs).toISOString()
        payload.nextExecutionMs = nowMs + freqMeta.intervalMs
        await addDoc(collection(db, 'radio_auto_messages'), payload)
      }

      setScheduleForm({
        group: 'Alertas de Regiões',
        frequency: '1x_day_on',
        enabled: true,
        senderName: 'Rádio do Acampamento',
        messages: ['Mensagem de teste do rádio...']
      })
      alert('Configuração de mensagem automática salva com sucesso!')
    } catch (err) {
      alert('Erro ao salvar mensagem automática: ' + err.message)
    }
  }

  async function handleDeleteSchedule(id) {
    if (!confirm('Deseja excluir esta mensagem automática?')) return
    try {
      await deleteDoc(doc(db, 'radio_auto_messages', id))
    } catch (err) {
      alert('Erro ao excluir: ' + err.message)
    }
  }

  async function handleToggleScheduleEnabled(item) {
    try {
      await updateDoc(doc(db, 'radio_auto_messages', item.id), {
        enabled: !item.enabled
      })
    } catch (err) {
      alert('Erro: ' + err.message)
    }
  }

  // Salvar Ponto de Rádio
  async function handleSaveRadioPoint(e) {
    e.preventDefault()
    if (!newPoint.name.trim() || !newPoint.locationSlug) {
      return alert('Preencha o nome do ponto e selecione a locação.')
    }

    const matchedLoc = locations.find(l => l.slug === newPoint.locationSlug)
    const locName = matchedLoc ? matchedLoc.name : newPoint.locationSlug

    const pointId = 'point_' + newPoint.locationSlug.replace(/[^a-z0-9_-]/gi, '')
    const payload = {
      ...newPoint,
      id: pointId,
      locationName: locName,
      updatedAt: new Date().toISOString()
    }

    try {
      await setDoc(doc(db, 'radio_points', pointId), payload)
      alert('Ponto de Rádio cadastrado!')
      setNewPoint({
        name: 'Rádio da Base',
        locationSlug: '',
        locationName: '',
        description: '',
        enabled: true
      })
    } catch (err) {
      alert('Erro ao salvar ponto de rádio: ' + err.message)
    }
  }

  async function handleDeletePoint(id) {
    if (!confirm('Deseja remover este Ponto de Rádio?')) return
    try {
      await deleteDoc(doc(db, 'radio_points', id))
    } catch (err) {
      alert('Erro: ' + err.message)
    }
  }

  // Apagar uma transmissão individual do histórico
  async function handleDeleteTransmission(id) {
    if (!confirm('Apagar esta transmissão do histórico permanente?')) return
    setDeletingId(id)
    try {
      await deleteDoc(doc(db, 'radio_transmissions', id))
    } catch (err) {
      alert('Erro ao apagar transmissão: ' + err.message)
    } finally {
      setDeletingId(null)
    }
  }

  // Apagar TODO o histórico de transmissões
  async function handleClearAllHistory() {
    if (!confirm(
      `⚠️ ATENÇÃO: Isso irá apagar PERMANENTEMENTE todas as ${historyList.length} transmissões do histórico.\n\nEsta ação não pode ser desfeita. Confirmar?`
    )) return

    setClearingAll(true)
    try {
      // Busca todos os documentos (não apenas os 50 carregados no listener)
      const allSnap = await getDocs(collection(db, 'radio_transmissions'))
      if (allSnap.empty) return

      // Usa batches de 500 (limite do Firestore)
      const batchSize = 500
      const docs = allSnap.docs
      for (let i = 0; i < docs.length; i += batchSize) {
        const batch = writeBatch(db)
        docs.slice(i, i + batchSize).forEach(d => batch.delete(d.ref))
        await batch.commit()
      }
    } catch (err) {
      alert('Erro ao limpar histórico: ' + err.message)
    } finally {
      setClearingAll(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Resumo de Status do Rádio */}
      <div
        className="glass"
        style={{
          padding: '16px 20px',
          borderRadius: 12,
          border: '1px solid rgba(34, 197, 94, 0.3)',
          background: 'linear-gradient(90deg, rgba(34, 197, 94, 0.08) 0%, rgba(15, 23, 42, 0.9) 100%)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(34, 197, 94, 0.2)', border: '1px solid #22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
            📻
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontFamily: 'Oswald', textTransform: 'uppercase', color: '#86efac', letterSpacing: 1 }}>
              Sistema de Rádio & Comunicação Global
            </h3>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Transmissões manuais e automáticas para sobreviventes com o item <strong style={{ color: '#fff' }}>Rádio</strong>.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px 14px', borderRadius: 8, border: '1px solid var(--glass-border)', textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#22c55e' }}>{radioUsersCount} / {totalUsersCount}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Portadores de Rádio</div>
          </div>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => checkAndTriggerAutoBroadcasts()}
            style={{ fontSize: 11, padding: '8px 14px', background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.35)', color: '#86efac' }}
            title="Verificar e rodar ciclo do agendador imediatamente"
          >
            ⚡ Checar Scheduler
          </button>
        </div>
      </div>

      {/* Sub-abas de Navegação */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--glass-border)', paddingBottom: 10 }}>
        <button
          className={`btn btn-sm ${activeSubTab === 'manual' ? 'btn-primary' : ''}`}
          onClick={() => setActiveSubTab('manual')}
        >
          ✍️ Transmissão Manual
        </button>
        <button
          className={`btn btn-sm ${activeSubTab === 'auto' ? 'btn-primary' : ''}`}
          onClick={() => setActiveSubTab('auto')}
        >
          ⏰ Mensagens Automáticas ({autoSchedules.length})
        </button>
        <button
          className={`btn btn-sm ${activeSubTab === 'points' ? 'btn-primary' : ''}`}
          onClick={() => setActiveSubTab('points')}
        >
          📍 Pontos de Rádio ({radioPoints.length})
        </button>
        <button
          className={`btn btn-sm ${activeSubTab === 'history' ? 'btn-primary' : ''}`}
          onClick={() => setActiveSubTab('history')}
        >
          📜 Histórico de Transmissões ({historyList.length})
        </button>
      </div>

      {/* SUB-ABA 1: TRANSMISSÃO MANUAL */}
      {activeSubTab === 'manual' && (
        <form onSubmit={handleSendManual} className="glass" style={{ padding: 20, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0, fontSize: 14, textTransform: 'uppercase', color: 'var(--accent)', letterSpacing: 0.5 }}>
              Emitir Comunicado Global Imediato
            </h4>
            <span style={{ fontSize: 11, color: '#86efac', background: 'rgba(34, 197, 94, 0.15)', padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(34, 197, 94, 0.3)' }}>
              Alcance: {radioUsersCount} sobrevivente(s) com Rádio
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 12 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: 11 }}>Categoria / Assunto da Transmissão</label>
              <input
                type="text"
                placeholder="Ex: Alerta de Horda, Aviso de Patrulha, Comunicado da Defesa..."
                value={manualCategory}
                onChange={(e) => setManualCategory(e.target.value)}
                required
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: 11 }}>Frequência</label>
              <input type="text" value="144.800 MHz (Varezhia)" disabled style={{ opacity: 0.7 }} />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: 11 }}>Texto da Transmissão</label>
            <textarea
              rows="4"
              placeholder="Ex: Nessa madrugada, algum bando de zumbis passou por perto dos portões da base. A defesa da base foi comprometida."
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                color: '#fff',
                fontFamily: 'monospace',
                fontSize: 13,
                lineHeight: 1.5
              }}
              required
            />
          </div>

          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            ℹ️ <strong>Regra de Envio:</strong> A notificação será enviada diretamente via sininho e popup de 10 segundos apenas para sobreviventes que possuem o item Rádio no inventário. A transmissão será eternizada no histórico permanente do RPG.
          </div>

          {manualSuccess && (
            <div style={{ padding: '10px 14px', background: 'rgba(34, 197, 94, 0.15)', border: '1px solid #22c55e', borderRadius: 8, color: '#86efac', fontSize: 12 }}>
              ✓ {manualSuccess}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={manualSending || !manualText.trim()}
              style={{ padding: '10px 24px', fontWeight: 700 }}
            >
              {manualSending ? 'Transmitindo...' : '📻 Enviar Transmissão'}
            </button>
          </div>
        </form>
      )}

      {/* SUB-ABA 2: MENSAGENS AUTOMÁTICAS */}
      {activeSubTab === 'auto' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Formulário de Cadastro */}
          <form onSubmit={handleSaveSchedule} className="glass" style={{ padding: 20, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontSize: 14, textTransform: 'uppercase', color: 'var(--accent)', letterSpacing: 0.5 }}>
                {editingScheduleId ? '✏️ Editar Mensagem Automática' : '➕ Nova Mensagem Automática Agendada'}
              </h4>
              {editingScheduleId && (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    setEditingScheduleId(null)
                    setScheduleForm({
                      group: 'Alertas de Regiões',
                      frequency: '1x_day_on',
                      enabled: true,
                      senderName: 'Rádio do Acampamento',
                      messages: ['Mensagem...']
                    })
                  }}
                >
                  Cancelar Edição
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: 11 }}>Nome do Grupo / Categoria</label>
                <input
                  type="text"
                  placeholder="Ex: Alertas de Regiões, Boletim Climático..."
                  value={scheduleForm.group}
                  onChange={(e) => setScheduleForm(prev => ({ ...prev, group: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: 11 }}>Frequência (Regra do Jogo)</label>
                <select
                  value={scheduleForm.frequency}
                  onChange={(e) => setScheduleForm(prev => ({ ...prev, frequency: e.target.value }))}
                >
                  <option value="1x_day_on">1x por dia ON (A cada 12h OFF / 1 dia in-game)</option>
                  <option value="1x_day_off">1x por dia OFF (A cada 24h OFF / 2 dias in-game)</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: 11 }}>Emissor / Identificador</label>
                <input
                  type="text"
                  placeholder="Rádio do Acampamento"
                  value={scheduleForm.senderName}
                  onChange={(e) => setScheduleForm(prev => ({ ...prev, senderName: e.target.value }))}
                />
              </div>
            </div>

            {/* Gerenciamento de Mensagens / Pool de Seleção Aleatória */}
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: 14, borderRadius: 8, border: '1px solid var(--glass-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ fontSize: 11, fontWeight: 700, margin: 0 }}>
                  🎲 Banco de Mensagens Elegíveis (Sorteio Aleatório a cada ciclo)
                </label>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  {scheduleForm.messages.length} mensagem(ns) cadastrada(s)
                </span>
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input
                  type="text"
                  placeholder="Escreva uma variação de mensagem e clique em Adicionar..."
                  value={newMessageText}
                  onChange={(e) => setNewMessageText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddScheduleMessage(); } }}
                  style={{ flex: 1, fontSize: 12, padding: '7px 10px' }}
                />
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={handleAddScheduleMessage}
                >
                  + Adicionar Variação
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                {scheduleForm.messages.map((msg, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      background: 'rgba(255,255,255,0.03)',
                      borderRadius: 6,
                      fontSize: 12,
                      border: '1px solid rgba(255,255,255,0.06)'
                    }}
                  >
                    <span style={{ color: '#e2e8f0', fontFamily: 'monospace' }}>• "{msg}"</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveScheduleMessage(idx)}
                      style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 12 }}
                      title="Remover variação"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  id="autoEnabled"
                  checked={scheduleForm.enabled}
                  onChange={(e) => setScheduleForm(prev => ({ ...prev, enabled: e.target.checked }))}
                  style={{ width: 'auto' }}
                />
                <label htmlFor="autoEnabled" style={{ fontSize: 12, margin: 0, cursor: 'pointer' }}>
                  Automação Ativa (Executar nos ciclos temporais)
                </label>
              </div>

              <button type="submit" className="btn btn-primary" style={{ padding: '8px 20px' }}>
                {editingScheduleId ? 'Salvar Alterações' : 'Cadastrar Mensagem Automática'}
              </button>
            </div>
          </form>

          {/* Lista de Automações Cadastradas */}
          <div className="glass" style={{ padding: 20, borderRadius: 12 }}>
            <h4 style={{ margin: '0 0 14px 0', fontSize: 14, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
              Automações Ativas & Configurações de Ciclo
            </h4>

            {autoSchedules.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)', fontSize: 12 }}>
                Nenhuma mensagem automática configurada no momento.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {autoSchedules.map((item) => {
                  const freq = RADIO_FREQUENCIES[item.frequency] || RADIO_FREQUENCIES['1x_day_on']
                  const count = (item.messages || [item.text || '']).length

                  return (
                    <div
                      key={item.id}
                      className="glass-light"
                      style={{
                        padding: '14px 16px',
                        borderRadius: 10,
                        borderLeft: `4px solid ${item.enabled ? '#22c55e' : '#64748b'}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 12
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 260 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <strong style={{ fontSize: 14, color: '#fff' }}>{item.group || 'Alerta'}</strong>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: 4,
                              background: item.enabled ? 'rgba(34, 197, 94, 0.15)' : 'rgba(100, 116, 139, 0.2)',
                              color: item.enabled ? '#4ade80' : '#94a3b8'
                            }}
                          >
                            {item.enabled ? '● ATIVA' : '○ INATIVA'}
                          </span>
                          <span style={{ fontSize: 11, color: '#facc15', background: 'rgba(234, 179, 8, 0.12)', padding: '2px 8px', borderRadius: 4 }}>
                            ⏱️ {freq.shortLabel}
                          </span>
                        </div>

                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          Pool: <strong>{count}</strong> mensagem(ns) aleatória(s) • Emissor: <strong>{item.senderName || 'Rádio'}</strong>
                        </div>

                        {item.lastMessageSent && (
                          <div style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic', marginTop: 2 }}>
                            Último envio: "{item.lastMessageSent}"
                          </div>
                        )}

                        <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', gap: 14, marginTop: 4 }}>
                          <span>Última execução: {item.lastExecution ? new Date(item.lastExecution).toLocaleString('pt-BR') : 'Nunca'}</span>
                          <span>Próxima execução: {item.nextExecution ? new Date(item.nextExecution).toLocaleString('pt-BR') : 'Aguardando ciclo'}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => handleToggleScheduleEnabled(item)}
                          style={{ fontSize: 11 }}
                        >
                          {item.enabled ? 'Desativar' : 'Ativar'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => {
                            setEditingScheduleId(item.id)
                            setScheduleForm({
                              group: item.group || 'Alertas de Regiões',
                              frequency: item.frequency || '1x_day_on',
                              enabled: item.enabled !== false,
                              senderName: item.senderName || 'Rádio do Acampamento',
                              messages: item.messages || [item.text || '']
                            })
                          }}
                          style={{ fontSize: 11 }}
                        >
                          ✏️ Editar
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDeleteSchedule(item.id)}
                          style={{ fontSize: 11, padding: '4px 8px' }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-ABA 3: PONTOS DE RÁDIO */}
      {activeSubTab === 'points' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Cadastro de Ponto de Rádio */}
          <form onSubmit={handleSaveRadioPoint} className="glass" style={{ padding: 20, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h4 style={{ margin: 0, fontSize: 14, textTransform: 'uppercase', color: 'var(--accent)' }}>
              ➕ Cadastrar Ponto de Rádio Fixo
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: 11 }}>Nome do Ponto de Rádio</label>
                <input
                  type="text"
                  placeholder="Ex: Rádio do Acampamento"
                  value={newPoint.name}
                  onChange={(e) => setNewPoint(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: 11 }}>Locação do RPG</label>
                <select
                  value={newPoint.locationSlug}
                  onChange={(e) => setNewPoint(prev => ({ ...prev, locationSlug: e.target.value }))}
                  required
                >
                  <option value="">Selecione uma locação...</option>
                  {locations.map(loc => (
                    <option key={loc.slug} value={loc.slug}>
                      {loc.name} ({loc.slug})
                    </option>
                  ))}
                  <option value="casa-grande-2-andar">Casa Grande — 2º Andar (Padrão)</option>
                </select>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: 11 }}>Descrição / Detalhes</label>
              <input
                type="text"
                placeholder="Ex: Rádio transmissor de base fixado na mesa do 2º andar."
                value={newPoint.description}
                onChange={(e) => setNewPoint(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Sobreviventes presentes nesta locação poderão clicar no botão do rádio e consultar o histórico sonoro presencial.
              </div>
              <button type="submit" className="btn btn-primary" style={{ padding: '8px 20px' }}>
                Salvar Ponto de Rádio
              </button>
            </div>
          </form>

          {/* Lista de Pontos */}
          <div className="glass" style={{ padding: 20, borderRadius: 12 }}>
            <h4 style={{ margin: '0 0 14px 0', fontSize: 14, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
              Pontos de Rádio Configurados
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {radioPoints.map((pt) => (
                <div
                  key={pt.id}
                  className="glass-light"
                  style={{
                    padding: 14,
                    borderRadius: 10,
                    border: '1px solid var(--glass-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: 13, color: '#86efac' }}>📻 {pt.name}</strong>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDeletePoint(pt.id)}
                      style={{ fontSize: 10, padding: '2px 6px' }}
                    >
                      Remover
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: '#fff' }}>
                    📍 Locação: <strong>{pt.locationName || pt.locationSlug}</strong>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    Slug: <code>{pt.locationSlug}</code>
                  </div>
                  {pt.description && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 4 }}>
                      {pt.description}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUB-ABA 4: HISTÓRICO DE TRANSMISSÕES */}
      {activeSubTab === 'history' && (
        <div className="glass" style={{ padding: 20, borderRadius: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h4 style={{ margin: 0, fontSize: 14, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
              Histórico Permanente de Transmissões do Rádio
            </h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Total: {historyList.length} transmissão(ões) registrada(s)
              </span>
              {historyList.length > 0 && (
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  onClick={handleClearAllHistory}
                  disabled={clearingAll}
                  style={{
                    fontSize: 11,
                    padding: '5px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    opacity: clearingAll ? 0.6 : 1
                  }}
                  title="Apagar todo o histórico de transmissões permanentemente"
                >
                  {clearingAll ? (
                    <>
                      <span style={{ display: 'inline-block', width: 10, height: 10, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                      Limpando...
                    </>
                  ) : (
                    <>🗑️ Limpar Tudo</>
                  )}
                </button>
              )}
            </div>
          </div>

          {loadingHistory ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
              Carregando histórico...
            </div>
          ) : historyList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)', fontSize: 12 }}>
              Nenhuma transmissão registrada ainda.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {historyList.map((t) => (
                <div
                  key={t.id}
                  className="glass-light"
                  style={{
                    padding: '12px 14px',
                    borderRadius: 8,
                    borderLeft: '4px solid #22c55e',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <strong style={{ fontSize: 12, color: '#86efac', textTransform: 'uppercase' }}>
                        {t.senderName || 'Rádio'}
                      </strong>
                      <span style={{ fontSize: 10, background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', padding: '1px 6px', borderRadius: 4 }}>
                        {t.category || t.type}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        {t.gameDateFormatted ? `📅 ${t.gameDateFormatted} — ${t.gameTimeString}` : new Date(t.createdAt).toLocaleString('pt-BR')}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteTransmission(t.id)}
                        disabled={deletingId === t.id}
                        style={{
                          background: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid rgba(239, 68, 68, 0.35)',
                          color: '#f87171',
                          borderRadius: 5,
                          cursor: deletingId === t.id ? 'wait' : 'pointer',
                          padding: '2px 8px',
                          fontSize: 11,
                          lineHeight: 1.5,
                          transition: 'background 0.2s'
                        }}
                        title="Apagar esta transmissão do histórico"
                      >
                        {deletingId === t.id ? '...' : '🗑️'}
                      </button>
                    </div>
                  </div>

                  <div style={{ fontSize: 12, color: '#fff', fontFamily: 'monospace', background: 'rgba(0,0,0,0.3)', padding: '6px 10px', borderRadius: 4 }}>
                    "{t.message}"
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, color: 'var(--text-muted)' }}>
                    <span>Tipo: {t.type === 'auto' ? 'Automática' : 'Manual'}</span>
                    <span>Alcance: {t.recipientsCount ?? 0} ouvinte(s) com Rádio</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
