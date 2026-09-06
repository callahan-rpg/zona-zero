import { useState, useEffect } from 'react'
import {
  doc,
  onSnapshot,
  collection,
  query,
  orderBy,
  limit
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../contexts/AuthContext.jsx'
import {
  DEFAULT_BASE_DEFENSE,
  getDefenseStatusMeta,
  updateBaseDefenseHp,
  updateBaseDefenseSettings
} from '../utils/baseDefenseSystem'

export default function AdminBaseDefenseEditor({ locations = [] }) {
  const { user } = useAuth()

  const [defenseData, setDefenseData] = useState(DEFAULT_BASE_DEFENSE)
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  // Formulário de Alteração de HP
  const [targetHp, setTargetHp] = useState(100)
  const [reason, setReason] = useState('')
  const [savingHp, setSavingHp] = useState(false)
  const [hpFeedback, setHpFeedback] = useState('')

  // Formulário de Configurações Gerais
  const [baseName, setBaseName] = useState('Defesa do Acampamento')
  const [maxHp, setMaxHp] = useState(100)
  const [savingSettings, setSavingSettings] = useState(false)

  // Formulário de Ponto de Exibição
  const [newPoint, setNewPoint] = useState({
    name: 'Armazém da Casa Grande',
    targetSlug: 'casa-grande',
    storageId: 'armazem-casa-grande',
    enabled: true
  })

  // Escuta dados da Defesa da Base
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'base_defense', 'global'), (snap) => {
      if (snap.exists()) {
        const data = { ...DEFAULT_BASE_DEFENSE, ...snap.data() }
        setDefenseData(data)
        setTargetHp(data.currentHp ?? 100)
        setMaxHp(data.maxHp ?? 100)
        setBaseName(data.name || 'Defesa do Acampamento')
      } else {
        setDefenseData(DEFAULT_BASE_DEFENSE)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  // Escuta histórico de auditoria
  useEffect(() => {
    const q = query(
      collection(db, 'base_defense_logs'),
      orderBy('timestamp', 'desc'),
      limit(50)
    )
    const unsub = onSnapshot(q, (snap) => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [])

  const currentHp = Number(defenseData.currentHp ?? 100)
  const currentMax = Number(defenseData.maxHp ?? 100)
  const statusMeta = getDefenseStatusMeta(currentHp, currentMax)
  const previewMeta = getDefenseStatusMeta(targetHp, maxHp)

  // Enviar Alteração de Vida
  async function handleApplyHpChange(e) {
    e.preventDefault()
    if (!reason.trim()) {
      return alert('O motivo da alteração da defesa é obrigatório para registrar a narrativa no histórico!')
    }

    const hpNum = Number(targetHp)
    if (isNaN(hpNum) || hpNum < 0 || hpNum > currentMax) {
      return alert(`A vida deve ser um número entre 0 e ${currentMax}.`)
    }

    setSavingHp(true)
    setHpFeedback('')

    try {
      const res = await updateBaseDefenseHp({
        newHp: hpNum,
        reason: reason.trim(),
        adminName: user?.displayName || user?.email || 'Admin',
        adminUid: user?.uid || null,
        gameConfig: null
      })

      setHpFeedback(`Vida da base atualizada de ${res.previousHp} para ${res.newHp} (${res.delta >= 0 ? '+' : ''}${res.delta}). Log registrado no histórico!`)
      setReason('')
      setTimeout(() => setHpFeedback(''), 5000)
    } catch (err) {
      alert('Erro ao alterar vida da defesa: ' + err.message)
    } finally {
      setSavingHp(false)
    }
  }

  // Aplicar Delta Rápido
  function applyQuickDelta(delta) {
    setTargetHp(prev => {
      const next = Number(prev) + delta
      return Math.max(0, Math.min(currentMax, next))
    })
  }

  // Salvar Configurações Gerais
  async function handleSaveSettings(e) {
    e.preventDefault()
    const maxNum = Math.max(1, Number(maxHp) || 100)

    setSavingSettings(true)
    try {
      await updateBaseDefenseSettings({
        name: baseName.trim() || 'Defesa do Acampamento',
        maxHp: maxNum,
        displayPoints: defenseData.displayPoints,
        adminName: user?.displayName || 'Admin'
      })
      alert('Configurações da base salvas com sucesso!')
    } catch (err) {
      alert('Erro: ' + err.message)
    } finally {
      setSavingSettings(false)
    }
  }

  // Adicionar Ponto de Exibição
  async function handleAddDisplayPoint(e) {
    e.preventDefault()
    if (!newPoint.name.trim()) return alert('Informe o nome do ponto de exibição.')

    const currentPoints = defenseData.displayPoints || []
    const pointId = 'point_' + Math.random().toString(36).substring(2, 9)

    const updatedPoints = [
      ...currentPoints,
      {
        ...newPoint,
        id: pointId
      }
    ]

    try {
      await updateBaseDefenseSettings({
        name: defenseData.name,
        maxHp: defenseData.maxHp,
        displayPoints: updatedPoints,
        adminName: user?.displayName || 'Admin'
      })
      alert('Ponto de exibição adicionado!')
      setNewPoint({
        name: '',
        targetSlug: '',
        storageId: '',
        enabled: true
      })
    } catch (err) {
      alert('Erro ao adicionar ponto de exibição: ' + err.message)
    }
  }

  // Remover Ponto de Exibição
  async function handleRemoveDisplayPoint(pointId) {
    if (!confirm('Deseja remover este ponto de exibição?')) return
    const currentPoints = defenseData.displayPoints || []
    const updatedPoints = currentPoints.filter(p => p.id !== pointId)

    try {
      await updateBaseDefenseSettings({
        name: defenseData.name,
        maxHp: defenseData.maxHp,
        displayPoints: updatedPoints,
        adminName: user?.displayName || 'Admin'
      })
    } catch (err) {
      alert('Erro: ' + err.message)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* CARD PRINCIPAL: STATUS ATUAL DA DEFESA */}
      <div
        className="glass"
        style={{
          padding: '20px 24px',
          borderRadius: 14,
          border: `1px solid ${statusMeta.border}88`,
          background: `linear-gradient(135deg, ${statusMeta.bg} 0%, rgba(15, 23, 42, 0.95) 100%)`,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          boxShadow: `0 12px 32px rgba(0,0,0,0.6), 0 0 20px ${statusMeta.color}22`
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: statusMeta.bg, border: `1px solid ${statusMeta.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>
              {statusMeta.icon}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontFamily: 'Oswald', letterSpacing: 1, textTransform: 'uppercase', color: '#fff' }}>
                  {defenseData.name || 'Defesa do Acampamento'}
                </h3>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: statusMeta.bg,
                    color: statusMeta.color,
                    border: `1px solid ${statusMeta.border}`
                  }}
                >
                  {statusMeta.badge}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {statusMeta.description}
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: statusMeta.color, fontFamily: 'Oswald', letterSpacing: 1 }}>
              {currentHp} <span style={{ fontSize: 16, color: 'var(--text-muted)' }}>/ {currentMax}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Integridade Estrutural: <strong>{statusMeta.percentage}%</strong>
            </div>
          </div>
        </div>

        {/* Barra de Vida */}
        <div style={{ width: '100%', height: 12, background: 'rgba(0,0,0,0.6)', borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div
            style={{
              width: `${statusMeta.percentage}%`,
              height: '100%',
              background: `linear-gradient(90deg, ${statusMeta.color}aa 0%, ${statusMeta.color} 100%)`,
              boxShadow: `0 0 12px ${statusMeta.color}`,
              borderRadius: 6,
              transition: 'width 0.4s ease'
            }}
          />
        </div>
      </div>

      {/* FORMULÁRIO 1: ALTERAÇÃO MANUAL DE VIDA COM MOTIVO */}
      <form onSubmit={handleApplyHpChange} className="glass" style={{ padding: 22, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ margin: 0, fontSize: 14, textTransform: 'uppercase', color: 'var(--accent-yellow)', letterSpacing: 0.5 }}>
            ⚔️ Alterar Vida da Defesa da Base
          </h4>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Toda alteração exige motivo obrigatório para histórico de auditoria
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 14 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: 11, fontWeight: 700 }}>Nova Vida Atual (0 a {currentMax})</label>
            <input
              type="number"
              min="0"
              max={currentMax}
              value={targetHp}
              onChange={(e) => setTargetHp(Number(e.target.value))}
              style={{ fontSize: 16, fontWeight: 'bold', color: previewMeta.color }}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: 11, fontWeight: 700 }}>Motivo Narrativo da Alteração (Obrigatório)</label>
            <input
              type="text"
              placeholder="Ex: Ataque de zumbis durante a madrugada / Reparo com madeira e chapas de aço..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Botões Rápidos de Dano e Reparo */}
        <div>
          <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
            Ajustes Rápidos de Dano / Reparo:
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <button type="button" className="btn btn-sm btn-danger" onClick={() => applyQuickDelta(-10)}>
              -10 Dano
            </button>
            <button type="button" className="btn btn-sm btn-danger" onClick={() => applyQuickDelta(-25)}>
              -25 Dano
            </button>
            <button type="button" className="btn btn-sm btn-danger" onClick={() => applyQuickDelta(-50)}>
              -50 Dano
            </button>
            <button type="button" className="btn btn-sm btn-danger" onClick={() => applyQuickDelta(-70)}>
              -70 Dano
            </button>
            <button type="button" className="btn btn-sm" onClick={() => setTargetHp(0)} style={{ borderColor: '#ef4444', color: '#f87171' }}>
              💥 0 (Destruída)
            </button>

            <span style={{ width: 1, background: 'var(--glass-border)', margin: '0 4px' }} />

            <button type="button" className="btn btn-sm" onClick={() => applyQuickDelta(10)} style={{ borderColor: '#22c55e', color: '#4ade80' }}>
              +10 Reparo
            </button>
            <button type="button" className="btn btn-sm" onClick={() => applyQuickDelta(25)} style={{ borderColor: '#22c55e', color: '#4ade80' }}>
              +25 Reparo
            </button>
            <button type="button" className="btn btn-sm" onClick={() => applyQuickDelta(50)} style={{ borderColor: '#22c55e', color: '#4ade80' }}>
              +50 Reparo
            </button>
            <button type="button" className="btn btn-sm" onClick={() => setTargetHp(currentMax)} style={{ borderColor: '#22c55e', color: '#4ade80' }}>
              🛡️ 100% (Total: {currentMax})
            </button>
          </div>
        </div>

        {/* Preview do Impacto */}
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid var(--glass-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 12
          }}
        >
          <div>
            Resultado: <strong style={{ color: '#fff' }}>{currentHp}</strong> ➔ <strong style={{ color: previewMeta.color }}>{targetHp}</strong>
            {' '}({targetHp - currentHp >= 0 ? `+${targetHp - currentHp}` : targetHp - currentHp} de defesa)
          </div>
          <div style={{ color: previewMeta.color, fontWeight: 700 }}>
            Status resultante: {previewMeta.icon} {previewMeta.label} ({previewMeta.percentage}%)
          </div>
        </div>

        {hpFeedback && (
          <div style={{ padding: '10px 14px', background: 'rgba(34, 197, 94, 0.15)', border: '1px solid #22c55e', borderRadius: 8, color: '#86efac', fontSize: 12 }}>
            ✓ {hpFeedback}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={savingHp || !reason.trim() || targetHp === currentHp}
            style={{ padding: '10px 24px', fontWeight: 700 }}
          >
            {savingHp ? 'Salvando...' : '🛡️ Salvar Alteração de Vida'}
          </button>
        </div>
      </form>

      {/* FORMULÁRIO 2: CONFIGURAÇÕES DA BASE (NOME, MAX HP) */}
      <form onSubmit={handleSaveSettings} className="glass" style={{ padding: 20, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h4 style={{ margin: 0, fontSize: 14, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
          ⚙️ Parâmetros Gerais da Base
        </h4>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px', gap: 12 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: 11 }}>Nome da Base / Fortificação</label>
            <input
              type="text"
              value={baseName}
              onChange={(e) => setBaseName(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: 11 }}>Vida Máxima Total</label>
            <input
              type="number"
              min="1"
              value={maxHp}
              onChange={(e) => setMaxHp(Number(e.target.value))}
              required
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="btn btn-sm btn-primary" disabled={savingSettings}>
            {savingSettings ? 'Salvando...' : 'Salvar Parâmetros'}
          </button>
        </div>
      </form>

      {/* SEÇÃO 3: PONTOS DE EXIBIÇÃO DA DEFESA */}
      <div className="glass" style={{ padding: 20, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <h4 style={{ margin: '0 0 4px 0', fontSize: 14, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
            📍 Pontos de Exibição da Defesa
          </h4>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Locais ou armazenamentos onde a integridade da defesa é exposta aos jogadores (Inicial: <strong>Armazém da Casa Grande</strong>).
          </div>
        </div>

        <form onSubmit={handleAddDisplayPoint} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 140px', gap: 10, alignItems: 'end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: 10 }}>Nome do Ponto</label>
            <input
              type="text"
              placeholder="Ex: Sala de Comando / Portão Principal..."
              value={newPoint.name}
              onChange={(e) => setNewPoint(prev => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: 10 }}>Locação do RPG</label>
            <select
              value={newPoint.targetSlug}
              onChange={(e) => setNewPoint(prev => ({ ...prev, targetSlug: e.target.value }))}
            >
              <option value="">(Opcional) Selecione locação...</option>
              {locations.map(l => (
                <option key={l.slug} value={l.slug}>{l.name} ({l.slug})</option>
              ))}
              <option value="casa-grande">Casa Grande (Padrão)</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: 10 }}>ID do Armazenamento (Se aplicável)</label>
            <input
              type="text"
              placeholder="Ex: armazem-casa-grande"
              value={newPoint.storageId}
              onChange={(e) => setNewPoint(prev => ({ ...prev, storageId: e.target.value }))}
            />
          </div>

          <button type="submit" className="btn btn-sm btn-primary" style={{ padding: '9px 0', width: '100%' }}>
            + Adicionar Ponto
          </button>
        </form>

        {/* Lista de Pontos Ativos */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
          {(defenseData.displayPoints || []).map((p) => (
            <div
              key={p.id}
              className="glass-light"
              style={{
                padding: 12,
                borderRadius: 8,
                border: '1px solid var(--glass-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <strong style={{ fontSize: 12, color: '#fff', display: 'block' }}>🛡️ {p.name}</strong>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                  {p.targetSlug && `Locação: ${p.targetSlug}`}
                  {p.storageId && ` • Storage: ${p.storageId}`}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-danger"
                onClick={() => handleRemoveDisplayPoint(p.id)}
                style={{ fontSize: 10, padding: '2px 6px' }}
                title="Remover ponto"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* SEÇÃO 4: HISTÓRICO DE AUDITORIA & ALTERAÇÕES */}
      <div className="glass" style={{ padding: 20, borderRadius: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h4 style={{ margin: 0, fontSize: 14, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
            📜 Histórico Permanente de Alterações da Defesa
          </h4>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Total de registros: {logs.length}
          </span>
        </div>

        {logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)', fontSize: 12 }}>
            Nenhuma alteração registrada ainda.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflowY: 'auto' }}>
            {logs.map((log) => {
              const isDamage = (log.delta ?? 0) < 0
              return (
                <div
                  key={log.id}
                  className="glass-light"
                  style={{
                    padding: '12px 14px',
                    borderRadius: 8,
                    borderLeft: `4px solid ${isDamage ? '#ef4444' : '#22c55e'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <strong style={{ fontSize: 13, color: '#fff' }}>
                        {log.previousHp} ➔ {log.newHp}
                      </strong>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          color: isDamage ? '#ef4444' : '#22c55e',
                          background: isDamage ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                          padding: '1px 6px',
                          borderRadius: 4
                        }}
                      >
                        {log.delta > 0 ? `+${log.delta}` : log.delta} de defesa
                      </span>
                    </div>

                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {log.gameDateFormatted ? `📅 ${log.gameDateFormatted} — ${log.gameTimeString || ''}` : new Date(log.createdAt).toLocaleString('pt-BR')}
                    </div>
                  </div>

                  <div style={{ fontSize: 12, color: 'var(--text-primary)', fontStyle: 'italic', background: 'rgba(0,0,0,0.25)', padding: '6px 10px', borderRadius: 4 }}>
                    "{log.reason}"
                  </div>

                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'right' }}>
                    Admin responsável: <strong style={{ color: '#fff' }}>{log.adminName || 'Admin'}</strong>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
