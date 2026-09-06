import { useState, useEffect, useRef } from 'react'
import { doc, runTransaction, updateDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../contexts/AuthContext.jsx'
import {
  validateActivityRequirements,
  validateToolForActivity,
  applyToolDurabilityLoss,
  checkEquippedAccessory,
  isItemMatching,
  rollFishingReward,
  consumeItemFromInventory,
  addItemToInventory,
  formatDuration,
  checkInventoryItem,
} from '../utils/activitySystem'
import { RARITY_META } from '../utils/itemSystem'

// Mapeia itemIds de peixes para dados do preset
const FISH_META = {
  peixe_pequeno: { name: 'Peixe Pequeno', icon: '🐟', rarity: 'common' },
  peixe_medio:   { name: 'Peixe Médio',   icon: '🐠', rarity: 'uncommon' },
  peixe_grande:  { name: 'Peixe Grande',  icon: '🐡', rarity: 'rare' },
}

export default function FishingModal({ activity, character, locationSlug, onClose }) {
  const { user, refreshCharacter } = useAuth()

  const [phase, setPhase] = useState('idle') // idle | fishing | result | error
  const [errors, setErrors] = useState([])
  const [timeLeft, setTimeLeft] = useState(0)
  const [result, setResult] = useState(null)
  const [toolResult, setToolResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const timerRef = useRef(null)
  const fishingStartRef = useRef(null)
  const fishingDurationRef = useRef(0)
  const activeFishingRef = useRef(null)

  const inventory = character?.inventory || []
  const toolCheck = validateToolForActivity(activity, inventory)
  const reqErrors = validateActivityRequirements(activity, inventory)
  const { found: minhocas } = checkInventoryItem(inventory, 'minhoca', 1)

  // Verifica se já tem pesca ativa ao abrir o modal
  useEffect(() => {
    const active = character?.activeActivities?.fishing
    if (active && active.status === 'in_progress') {
      const elapsed = Date.now() - new Date(active.startedAt).getTime()
      const remaining = Math.max(0, (active.durationMs || 600000) - elapsed)
      fishingStartRef.current = new Date(active.startedAt).getTime()
      fishingDurationRef.current = active.durationMs || 600000
      activeFishingRef.current = active

      if (remaining > 0) {
        setTimeLeft(remaining)
        setPhase('fishing')
        startTimer(remaining, active)
      } else {
        // Pescaria terminou enquanto o modal estava fechado ou já expirou — conclui agora
        setTimeLeft(0)
        setPhase('fishing')
        concludeFishing(active)
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  function startTimer(initialMs, activeInfo = null) {
    if (timerRef.current) clearInterval(timerRef.current)
    setTimeLeft(initialMs)

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        const next = prev - 1000
        if (next <= 0) {
          clearInterval(timerRef.current)
          concludeFishing(activeInfo || activeFishingRef.current)
          return 0
        }
        return next
      })
    }, 1000)
  }

  async function handleStartFishing() {
    if (loading || phase !== 'idle') return
    if (reqErrors.length > 0) {
      setErrors(reqErrors)
      return
    }

    setLoading(true)
    setErrors([])

    const durationMs = Number(activity.durationMs) || 10 * 60 * 1000 // 10 min padrão
    const startedAt = new Date().toISOString()
    const fishingInfo = {
      activityId: activity.id,
      locationSlug,
      startedAt,
      durationMs,
      status: 'in_progress',
    }

    try {
      const userRef = doc(db, 'users', user.uid)

      await runTransaction(db, async (tx) => {
        const snap = await tx.get(userRef)
        if (!snap.exists()) throw new Error('Personagem não encontrado.')

        const charData = snap.data().character || {}
        let inv = [...(charData.inventory || [])]

        // Validação de ferramenta e durabilidade no momento do início
        const validTool = validateToolForActivity(activity, inv)
        if (!validTool.ok) throw new Error(validTool.error)

        // Validação de minhocas
        const minhocaItem = inv.find(i => i && isItemMatching(i, 'minhoca') && (i.quantity || 1) >= 1)
        if (!minhocaItem) throw new Error('Você não possui minhocas para usar como isca.')

        // Cooldown de recompensa
        const lastReward = charData.lastActivityReward?.[`fishing_${locationSlug}`]
        if (lastReward) {
          const cooldownMs = Number(activity.cooldownMs) || 30 * 60 * 1000
          const timeSince = Date.now() - new Date(lastReward).getTime()
          if (timeSince < cooldownMs) {
            const waitMin = Math.ceil((cooldownMs - timeSince) / 60000)
            throw new Error(`Aguarde ${waitMin} minuto(s) antes de pescar novamente aqui.`)
          }
        }

        // Consome 1 minhoca ATOMICAMENTE no início da pescaria
        inv = consumeItemFromInventory(inv, 'minhoca', 1, 'Minhoca')

        tx.update(userRef, {
          'character.inventory': inv,
          'character.activeActivities.fishing': fishingInfo
        })
      })

      fishingStartRef.current = Date.now()
      fishingDurationRef.current = durationMs
      activeFishingRef.current = fishingInfo
      setPhase('fishing')
      startTimer(durationMs, fishingInfo)
      await refreshCharacter()

    } catch (err) {
      console.error(err)
      setErrorMsg(err.message || 'Erro ao iniciar pescaria.')
    } finally {
      setLoading(false)
    }
  }

  async function concludeFishing(activeFishing = null) {
    if (timerRef.current) clearInterval(timerRef.current)
    setLoading(true)

    const actInfo = activeFishing || activeFishingRef.current || character?.activeActivities?.fishing || {
      activityId: activity.id,
      locationSlug,
      startedAt: new Date().toISOString(),
      durationMs: fishingDurationRef.current || 0,
      status: 'in_progress',
    }

    try {
      const rewardItem = rollFishingReward(activity)
      const userRef = doc(db, 'users', user.uid)
      let toolLossInfo = null

      await runTransaction(db, async (tx) => {
        const snap = await tx.get(userRef)
        if (!snap.exists()) return

        const charData = snap.data().character || {}
        let inv = [...(charData.inventory || [])]

        // 1. Aplica perda de durabilidade na ferramenta equipada (ex: -10 de durabilidade)
        const toolValidation = validateToolForActivity(activity, inv)
        if (toolValidation.ok && toolValidation.tool) {
          const lossRes = applyToolDurabilityLoss(inv, toolValidation.tool, activity.durabilityCost || 10)
          inv = lossRes.inventory
          toolLossInfo = lossRes
        }

        // 2. Adiciona recompensa se um peixe foi capturado (estritamente 1 peixe)
        if (rewardItem) {
          const meta = FISH_META[rewardItem.itemId] || {}
          inv = addItemToInventory(inv, {
            itemId: rewardItem.itemId,
            name: meta.name || rewardItem.name || 'Peixe',
            icon: meta.icon || rewardItem.icon || '🐟',
            quantity: 1, // Sempre 1 por tentativa
            category: 'general',
            rarity: meta.rarity || rewardItem.rarity || 'common',
            consumable: true,
            consumeEffect: rewardItem.consumeEffect || { hunger: 15, blood: 5 },
            obtainedFrom: `Pesca — ${locationSlug}`,
          })
        }

        // 3. Notificações do resultado e durabilidade
        const newNotifs = []
        if (rewardItem) {
          const fishIcon = rewardItem.icon || FISH_META[rewardItem.itemId]?.icon || '🐟'
          const fishName = rewardItem.name || FISH_META[rewardItem.itemId]?.name || 'Peixe'
          newNotifs.push({
            id: Math.random().toString(36).substring(2),
            type: 'activity_reward',
            title: '🎣 Você pescou um peixe!',
            message: `Você capturou 1x ${fishIcon} ${fishName}!`,
            timestamp: new Date().toISOString(),
            read: false,
          })
        } else {
          newNotifs.push({
            id: Math.random().toString(36).substring(2),
            type: 'activity_reward',
            title: '🎣 Pescaria Concluída',
            message: 'Os peixes não morderam a isca desta vez...',
            timestamp: new Date().toISOString(),
            read: false,
          })
        }

        if (toolLossInfo?.isBroken) {
          newNotifs.push({
            id: Math.random().toString(36).substring(2),
            type: 'tool_break',
            title: '⚠️ Ferramenta Quebrada',
            message: `Sua ${toolLossInfo.tool.name || 'Vara de Pesca'} perdeu toda a durabilidade e está muito danificada para ser usada (0/${toolLossInfo.tool.maxDurability || 100}).`,
            timestamp: new Date().toISOString(),
            read: false,
          })
        }

        const notifications = [
          ...newNotifs,
          ...(charData.notifications || []).slice(0, 28),
        ]

        tx.update(userRef, {
          'character.inventory': inv,
          'character.activeActivities.fishing': {
            status: 'completed',
            completedAt: new Date().toISOString(),
          },
          [`character.lastActivityReward.fishing_${locationSlug}`]: new Date().toISOString(),
          'character.notifications': notifications,
        })
      })

      activeFishingRef.current = null
      setResult(rewardItem)
      setToolResult(toolLossInfo)
      setPhase('result')
      await refreshCharacter()

    } catch (err) {
      console.error('Erro ao concluir pescaria:', err)
      setResult(null)
      setPhase('result')
    } finally {
      setLoading(false)
    }
  }

  async function handleCancel() {
    if (timerRef.current) clearInterval(timerRef.current)
    activeFishingRef.current = null
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        'character.activeActivities.fishing': { status: 'cancelled' }
      })
      await refreshCharacter()
    } catch (err) {
      console.error(err)
    }
    onClose()
  }

  const progressPct = fishingDurationRef.current > 0
    ? Math.round(((fishingDurationRef.current - timeLeft) / fishingDurationRef.current) * 100)
    : 0

  const resultMeta = result ? (RARITY_META[FISH_META[result.itemId]?.rarity || result.rarity] || RARITY_META.common) : null

  return (
    <div className="loot-modal-overlay" onClick={phase === 'idle' || phase === 'result' ? onClose : undefined}>
      <div
        className="loot-modal"
        onClick={e => e.stopPropagation()}
        style={{ width: 420, maxWidth: '95vw', textAlign: 'left' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <span style={{ fontSize: 28 }}>🎣</span>
          <div>
            <h3 style={{ color: '#38bdf8', margin: 0, fontSize: 18 }}>Pesca</h3>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{activity.name || 'Pescar'}</div>
          </div>
        </div>

        {/* Fase: IDLE */}
        {phase === 'idle' && (
          <>
            {/* Status dos requisitos */}
            <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 8, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Equipamento</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 16 }}>🎣</span>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, color: toolCheck.ok ? '#4ade80' : '#f87171' }}>
                    {toolCheck.tool?.name || 'Vara de Pesca'}
                  </span>
                  {toolCheck.tool && (
                    <div style={{ fontSize: 11, color: toolCheck.curDur < (activity?.durabilityCost || 10) ? '#f87171' : 'var(--text-muted)' }}>
                      Durabilidade: <strong>{toolCheck.curDur}/{toolCheck.maxDur}</strong> (Custo por pesca: -{activity?.durabilityCost || 10})
                    </div>
                  )}
                </div>
                <span style={{ fontSize: 11, color: toolCheck.ok ? '#4ade80' : '#f87171', fontWeight: 600 }}>
                  {toolCheck.ok ? '✓ Pronta' : '✗ Indisponível'}
                </span>
              </div>

              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, marginTop: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Iscas</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>🪱</span>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, color: minhocas > 0 ? '#4ade80' : '#f87171' }}>Minhoca</span>
                </div>
                <span style={{ fontSize: 12, color: minhocas > 0 ? '#4ade80' : '#f87171' }}>
                  {minhocas > 0 ? `✓ ${minhocas} unidades` : '✗ Nenhuma'}
                </span>
              </div>
            </div>

            {/* Tempo estimado */}
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              ⏱️ Duração: <strong style={{ color: '#fff' }}>{formatDuration(activity.durationMs || 600000)}</strong>
            </div>

            {/* Erros */}
            {errors.length > 0 && (
              <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, padding: 10, marginBottom: 14 }}>
                {errors.map((e, i) => <div key={i} style={{ fontSize: 12, color: '#fca5a5', marginBottom: 2 }}>{e}</div>)}
              </div>
            )}
            {!toolCheck.ok && (
              <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, padding: 10, marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: '#fca5a5' }}>{toolCheck.error}</div>
              </div>
            )}
            {errorMsg && (
              <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, padding: 10, marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: '#fca5a5' }}>{errorMsg}</div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-primary"
                onClick={handleStartFishing}
                disabled={loading || !toolCheck.ok || reqErrors.length > 0 || minhocas < 1}
                style={{ flex: 1 }}
              >
                {loading ? 'Iniciando...' : '🎣 Iniciar Pescaria'}
              </button>
              <button className="btn btn-sm" onClick={onClose} style={{ padding: '8px 16px' }}>Fechar</button>
            </div>
          </>
        )}

        {/* Fase: PESCANDO */}
        {phase === 'fishing' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 8, animation: 'pulse 2s ease-in-out infinite' }}>🎣</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#38bdf8', marginBottom: 4 }}>Pescando...</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>Aguarde o peixe morder a isca</div>

            {/* Barra de progresso */}
            <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{
                height: '100%',
                width: `${progressPct}%`,
                background: 'linear-gradient(90deg, #0284c7, #38bdf8)',
                borderRadius: 4,
                transition: 'width 1s linear'
              }} />
            </div>

            <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', fontVariantNumeric: 'tabular-nums', marginBottom: 20 }}>
              {formatDuration(timeLeft)}
            </div>

            {timeLeft <= 0 ? (
              <button
                className="btn btn-primary"
                onClick={() => concludeFishing()}
                disabled={loading}
                style={{ width: '100%', marginBottom: 12, padding: '10px 16px', fontSize: 14 }}
              >
                {loading ? 'Puxando a linha...' : '🎣 Puxar a Linha & Ver Resultado!'}
              </button>
            ) : null}

            <button
              className="btn btn-sm btn-danger"
              onClick={handleCancel}
              disabled={loading}
              style={{ fontSize: 12 }}
            >
              ✕ Cancelar Pescaria
            </button>
          </div>
        )}

        {/* Fase: RESULTADO */}
        {phase === 'result' && (
          <div style={{ textAlign: 'center' }}>
            {result ? (
              <>
                <div style={{ fontSize: 40, marginBottom: 8 }}>{result.icon || FISH_META[result.itemId]?.icon || '🐟'}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: resultMeta?.color || '#4ade80', marginBottom: 4 }}>
                  Você pescou!
                </div>
                <div style={{
                  background: 'rgba(0,0,0,0.25)',
                  borderRadius: 10,
                  padding: 16,
                  marginBottom: 16,
                  border: `1px solid ${resultMeta?.border || 'rgba(255,255,255,0.12)'}`,
                  display: 'inline-block',
                  minWidth: 160
                }}>
                  <div style={{ fontSize: 32, marginBottom: 4 }}>{result.icon || FISH_META[result.itemId]?.icon || '🐟'}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: resultMeta?.color || '#fff' }}>
                    {result.name || FISH_META[result.itemId]?.name || result.itemId}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>×{result.quantity}</div>
                  <div style={{ fontSize: 10, color: resultMeta?.color, marginTop: 4, textTransform: 'uppercase' }}>
                    {resultMeta?.label}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
                  Item adicionado à sua mochila.
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 40, marginBottom: 8 }}>😶</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>
                  Nada desta vez...
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
                  Os peixes não picaram. Tente novamente mais tarde.
                </div>
              </>
            )}

            {/* Aviso de desgaste ou quebra da ferramenta */}
            {toolResult && (
              <div style={{
                background: toolResult.isBroken ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${toolResult.isBroken ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 6,
                padding: '8px 12px',
                marginBottom: 16,
                fontSize: 12,
                color: toolResult.isBroken ? '#fca5a5' : 'var(--text-muted)'
              }}>
                {toolResult.isBroken ? (
                  <span>⚠️ <strong>Atenção:</strong> Sua {toolResult.tool.name || 'ferramenta'} quebrou (0/{toolResult.tool.maxDurability || 100}) e precisará ser reparada para novo uso.</span>
                ) : (
                  <span>⚙️ Desgaste da ferramenta: <strong>-{toolResult.lostDurability}</strong> durabilidade (Restante: {toolResult.newDurability}/{toolResult.tool.maxDurability || 100}).</span>
                )}
              </div>
            )}

            <button className="btn btn-primary" onClick={onClose} style={{ width: '100%' }}>Fechar</button>
          </div>
        )}
      </div>
    </div>
  )
}
