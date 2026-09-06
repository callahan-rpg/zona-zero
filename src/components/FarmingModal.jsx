import { useState, useEffect } from 'react'
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  runTransaction,
  deleteDoc,
  setDoc,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../contexts/AuthContext.jsx'
import {
  validateToolForActivity,
  applyToolDurabilityLoss,
  rollWormDiscovery,
  checkEquippedAccessory,
  checkInventoryItem,
  calculateFarmingState,
  calculateHarvestYield,
  consumeItemFromInventory,
  addItemToInventory,
  generateActivityStateId,
  formatHoursAgo,
  getBarColor,
  FARMING_DEFAULTS,
} from '../utils/activitySystem'

// Sementes suportadas padrão caso não estejam customizadas na atividade
const DEFAULT_SEED_CONFIGS = {
  semente_tomate: {
    name: 'Tomate',
    icon: '🍅',
    cropItemId: 'tomate',
    cropName: 'Tomate',
    cropIcon: '🍅',
    growthMs: 3 * 24 * 60 * 60 * 1000, // 3 dias reais
    harvestMin: 3,
    harvestMax: 6,
    goodConditionYield: { min: 3, max: 6 },
    badConditionYield: { min: 1, max: 2 },
    goodConditionThreshold: 70,
    description: 'Cresce em 3 dias. Rendimento: 3 a 6 tomates (ou 1-2 em má condição).',
  },
  semente_milho: {
    name: 'Milho',
    icon: '🌽',
    cropItemId: 'milho',
    cropName: 'Milho',
    cropIcon: '🌽',
    growthMs: 4 * 24 * 60 * 60 * 1000, // 4 dias reais
    harvestMin: 3,
    harvestMax: 6,
    goodConditionYield: { min: 3, max: 6 },
    badConditionYield: { min: 1, max: 2 },
    goodConditionThreshold: 70,
    description: 'Cresce em 4 dias. Alimenta o grupo e o galinheiro.',
  },
  semente_batata: {
    name: 'Batata',
    icon: '🥔',
    cropItemId: 'batata',
    cropName: 'Batata',
    cropIcon: '🥔',
    growthMs: 3 * 24 * 60 * 60 * 1000, // 3 dias reais
    harvestMin: 3,
    harvestMax: 6,
    goodConditionYield: { min: 3, max: 6 },
    badConditionYield: { min: 1, max: 2 },
    goodConditionThreshold: 70,
    description: 'Cresce em 3 dias. Tubérculo resistente e calórico.',
  },
}

export default function FarmingModal({ activity, character, locationSlug, onClose }) {
  const { user, refreshCharacter } = useAuth()
  const [plots, setPlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [selectedSeed, setSelectedSeed] = useState('')
  const [feedback, setFeedback] = useState({ type: '', msg: '' })

  const inventory = character?.inventory || []
  const toolCheck = validateToolForActivity(activity, inventory)
  const { found: aduboCount } = checkInventoryItem(inventory, 'adubo', 1)

  // Mescla sementes configuradas na atividade com as sementes padrão
  const effectiveSeedsConfig = (() => {
    if (activity?.seedsConfig && typeof activity.seedsConfig === 'object') {
      if (Array.isArray(activity.seedsConfig)) {
        const mapped = {}
        for (const s of activity.seedsConfig) {
          if (s.seedItemId) mapped[s.seedItemId] = s
        }
        return Object.keys(mapped).length > 0 ? mapped : DEFAULT_SEED_CONFIGS
      }
      return { ...DEFAULT_SEED_CONFIGS, ...activity.seedsConfig }
    }
    return DEFAULT_SEED_CONFIGS
  })()

  // Identifica sementes disponíveis no inventário
  const availableSeeds = Object.entries(effectiveSeedsConfig)
    .map(([seedId, config]) => {
      const { found } = checkInventoryItem(inventory, seedId, 1)
      return { seedId, ...config, count: found }
    })
    .filter(s => s.count > 0)

  // Escuta os canteiros deste local em tempo real
  useEffect(() => {
    const q = query(
      collection(db, 'activity_states'),
      where('locationSlug', '==', locationSlug),
      where('type', '==', 'farming')
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = []
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() })
        })
        // Ordena pelos mais antigos primeiro
        list.sort((a, b) => new Date(a.plantedAt).getTime() - new Date(b.plantedAt).getTime())
        setPlots(list)
        setLoading(false)
      },
      (err) => {
        console.error('Erro ao escutar plantações:', err)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [locationSlug])

  function showMsg(type, msg) {
    setFeedback({ type, msg })
    setTimeout(() => setFeedback({ type: '', msg: '' }), 5000)
  }

  // 1. Plantar
  async function handlePlant() {
    if (!selectedSeed || actionLoading) return
    if (!toolCheck.ok) {
      showMsg('error', toolCheck.error)
      return
    }

    const seedCfg = effectiveSeedsConfig[selectedSeed]
    if (!seedCfg) return

    setActionLoading(true)
    try {
      const userRef = doc(db, 'users', user.uid)
      const plotId = generateActivityStateId('farming', locationSlug, user.uid)
      const plotRef = doc(db, 'activity_states', plotId)
      const nowIso = new Date().toISOString()
      const growthMs = seedCfg.growthMs || (seedCfg.growthDays ? seedCfg.growthDays * 24 * 60 * 60 * 1000 : 3 * 24 * 60 * 60 * 1000)

      let wormResult = null
      let toolLossResult = null

      await runTransaction(db, async (tx) => {
        const userSnap = await tx.get(userRef)
        if (!userSnap.exists()) throw new Error('Personagem não encontrado.')

        const charData = userSnap.data().character || {}
        let inv = [...(charData.inventory || [])]

        // Valida ferramenta novamente dentro da transaction
        const validTool = validateToolForActivity(activity, inv)
        if (!validTool.ok) throw new Error(validTool.error)

        // 1. Aplica perda de durabilidade na ferramenta ao plantar (ex: -10)
        toolLossResult = applyToolDurabilityLoss(inv, validTool.tool, activity?.durabilityCost || 10)
        inv = toolLossResult.inventory

        // 2. Consome 1 semente atomicamente
        inv = consumeItemFromInventory(inv, selectedSeed, 1, seedCfg.name)

        // 3. Sorteia descoberta de minhocas ao revirar a terra no plantio
        wormResult = rollWormDiscovery(activity?.wormFindChancePlanting ?? 0.30, 1, 5)
        if (wormResult.found) {
          inv = addItemToInventory(inv, {
            itemId: 'minhoca',
            name: 'Minhoca',
            icon: '🪱',
            quantity: wormResult.quantity,
            category: 'general',
            rarity: 'common',
            consumable: false,
            description: 'Isca viva encontrada ao revirar a terra fértil da plantação.',
            obtainedFrom: `Horta — ${locationSlug}`,
          })
        }

        // Cria o canteiro
        tx.set(plotRef, {
          id: plotId,
          type: 'farming',
          activityId: activity?.id || 'farming_default',
          locationSlug,
          seedItemId: selectedSeed,
          cropItemId: seedCfg.cropItemId || selectedSeed.replace('semente_', ''),
          cropName: seedCfg.cropName || seedCfg.name,
          cropIcon: seedCfg.cropIcon || seedCfg.icon || '🌱',
          plantedAt: nowIso,
          lastCaredAt: nowIso,
          lastFertilizedAt: null,
          growthDurationMs: growthMs,
          harvestMin: seedCfg.harvestMin || 3,
          harvestMax: seedCfg.harvestMax || 6,
          goodConditionYield: seedCfg.goodConditionYield || { min: 3, max: 6 },
          badConditionYield: seedCfg.badConditionYield || { min: 1, max: 2 },
          goodConditionThreshold: seedCfg.goodConditionThreshold || 70,
          health: 100,
          plantedBy: user.uid,
          plantedByName: character?.name || 'Sobrevivente',
          status: 'growing',
        })

        // Notificações
        const notifs = []
        if (toolLossResult.isBroken) {
          notifs.push({
            id: Math.random().toString(36).substring(2),
            type: 'tool_break',
            title: '⚠️ Enxada Quebrada',
            message: `Sua ${toolLossResult.tool.name || 'Enxada'} perdeu toda a durabilidade após o plantio (0/${toolLossResult.tool.maxDurability || 100}).`,
            timestamp: nowIso,
            read: false,
          })
        }
        if (wormResult.found) {
          notifs.push({
            id: Math.random().toString(36).substring(2),
            type: 'activity_reward',
            title: '🪱 Minhocas Encontradas!',
            message: `Ao preparar o solo para ${seedCfg.cropName || seedCfg.name}, você encontrou ${wormResult.quantity}x Minhoca(s)!`,
            timestamp: nowIso,
            read: false,
          })
        }

        const notifications = [
          ...notifs,
          ...(charData.notifications || []).slice(0, 28),
        ]

        // Atualiza inventário e dados do jogador
        tx.update(userRef, {
          'character.inventory': inv,
          'character.notifications': notifications,
        })
      })

      let msg = `🌱 Você plantou ${seedCfg.cropName || seedCfg.name} com sucesso! (-${toolLossResult?.lostDurability || 10} durabilidade)`
      if (wormResult?.found) {
        msg += ` 🪱 Encontrou +${wormResult.quantity}x Minhoca(s) na terra!`
      }
      if (toolLossResult?.isBroken) {
        msg += ` ⚠️ Sua Enxada quebrou!`
      }

      showMsg('success', msg)
      setSelectedSeed('')
      await refreshCharacter()
    } catch (err) {
      console.error(err)
      showMsg('error', err.message || 'Erro ao plantar.')
    } finally {
      setActionLoading(false)
    }
  }

  // 2. Cuidar / Regar
  async function handleCare(plot) {
    if (actionLoading) return
    if (!toolCheck.ok) {
      showMsg('error', toolCheck.error)
      return
    }

    setActionLoading(true)
    try {
      const userRef = doc(db, 'users', user.uid)
      const plotRef = doc(db, 'activity_states', plot.id)
      const nowIso = new Date().toISOString()
      let wormResult = null

      await runTransaction(db, async (tx) => {
        const userSnap = await tx.get(userRef)
        const plotSnap = await tx.get(plotRef)
        if (!userSnap.exists() || !plotSnap.exists()) throw new Error('Dados não encontrados.')

        const charData = userSnap.data().character || {}
        let inv = [...(charData.inventory || [])]
        const data = plotSnap.data()
        const computed = calculateFarmingState(data)
        if (computed.isDead) throw new Error('Esta plantação secou e morreu.')

        // Sorteia minhocas ao cuidar/regar a terra
        wormResult = rollWormDiscovery(activity?.wormFindChanceCaring ?? 0.30, 1, 5)
        if (wormResult.found) {
          inv = addItemToInventory(inv, {
            itemId: 'minhoca',
            name: 'Minhoca',
            icon: '🪱',
            quantity: wormResult.quantity,
            category: 'general',
            rarity: 'common',
            consumable: false,
            description: 'Isca viva encontrada ao cuidar da plantação úmida.',
            obtainedFrom: `Horta — ${locationSlug}`,
          })
        }

        // Recupera saúde (+15, max 100) e renova timer de cuidado
        const newHealth = Math.min(100, computed.health + 15)

        tx.update(plotRef, {
          health: newHealth,
          lastCaredAt: nowIso,
        })

        if (wormResult.found) {
          tx.update(userRef, {
            'character.inventory': inv,
          })
        }
      })

      let msg = `💧 Você cuidou e regou o canteiro de ${plot.cropName}! (+15 de saúde)`
      if (wormResult?.found) {
        msg += ` 🪱 Encontrou +${wormResult.quantity}x Minhoca(s) na terra úmida!`
      }

      showMsg('success', msg)
      await refreshCharacter()
    } catch (err) {
      console.error(err)
      showMsg('error', err.message || 'Erro ao cuidar do canteiro.')
    } finally {
      setActionLoading(false)
    }
  }

  // 3. Adubar
  async function handleFertilize(plot) {
    if (actionLoading) return
    if (!toolCheck.ok) {
      showMsg('error', toolCheck.error)
      return
    }
    if (aduboCount < 1) {
      showMsg('error', 'Você não possui Adubo no inventário. Limpe o galinheiro para conseguir.')
      return
    }

    setActionLoading(true)
    try {
      const userRef = doc(db, 'users', user.uid)
      const plotRef = doc(db, 'activity_states', plot.id)
      const nowIso = new Date().toISOString()

      await runTransaction(db, async (tx) => {
        const userSnap = await tx.get(userRef)
        const plotSnap = await tx.get(plotRef)
        if (!userSnap.exists() || !plotSnap.exists()) throw new Error('Dados não encontrados.')

        const charData = userSnap.data().character || {}
        let inv = [...(charData.inventory || [])]
        const data = plotSnap.data()
        const computed = calculateFarmingState(data)

        if (computed.isDead) throw new Error('Esta plantação está morta.')

        // Consome 1 adubo
        inv = consumeItemFromInventory(inv, 'adubo', 1, 'Adubo')

        const newHealth = Math.min(100, computed.health + FARMING_DEFAULTS.fertilizerHealthBonus)

        tx.update(plotRef, {
          health: newHealth,
          lastFertilizedAt: nowIso,
          lastCaredAt: nowIso,
        })

        tx.update(userRef, {
          'character.inventory': inv,
        })
      })

      showMsg('success', `💩 Canteiro de ${plot.cropName} adubado! (+${FARMING_DEFAULTS.fertilizerHealthBonus} saúde)`)
      await refreshCharacter()
    } catch (err) {
      console.error(err)
      showMsg('error', err.message || 'Erro ao adubar.')
    } finally {
      setActionLoading(false)
    }
  }

  // 4. Colher
  async function handleHarvest(plot) {
    if (actionLoading) return
    if (!toolCheck.ok) {
      showMsg('error', toolCheck.error)
      return
    }

    setActionLoading(true)
    try {
      const userRef = doc(db, 'users', user.uid)
      const plotRef = doc(db, 'activity_states', plot.id)

      let harvestYield = { quantity: 1, isGoodCondition: true, qualityLabel: 'Boa Condição' }

      await runTransaction(db, async (tx) => {
        const userSnap = await tx.get(userRef)
        const plotSnap = await tx.get(plotRef)
        if (!userSnap.exists() || !plotSnap.exists()) throw new Error('Dados não encontrados.')

        const plotData = plotSnap.data()
        const computed = calculateFarmingState(plotData)

        if (!computed.isReady) throw new Error('A plantação ainda não está pronta para colheita.')
        if (computed.isDead) throw new Error('A plantação morreu e não pode ser colhida.')

        // Rendimento calculado baseado na qualidade e saúde
        harvestYield = calculateHarvestYield(plotData, computed.health)
        const charData = userSnap.data().character || {}
        let inv = [...(charData.inventory || [])]

        // Adiciona a colheita ao inventário
        inv = addItemToInventory(inv, {
          itemId: plotData.cropItemId,
          name: plotData.cropName,
          icon: plotData.cropIcon || '🌱',
          quantity: harvestYield.quantity,
          category: 'general',
          rarity: harvestYield.isGoodCondition ? 'common' : 'poor',
          consumable: true,
          description: `Colheita fresca de ${plotData.cropName} (${harvestYield.qualityLabel} - Saúde: ${computed.health}%).`,
          obtainedFrom: `Horta — ${locationSlug}`,
        })

        // Notificação
        const notifs = [
          {
            id: Math.random().toString(36).substring(2),
            type: 'activity_reward',
            title: '🌾 Colheita Realizada!',
            message: `Você colheu ${harvestYield.quantity}x ${plotData.cropIcon} ${plotData.cropName} (${harvestYield.qualityLabel})!`,
            timestamp: new Date().toISOString(),
            read: false,
          },
          ...(charData.notifications || []).slice(0, 29),
        ]

        // Deleta o canteiro (foi colhido)
        tx.delete(plotRef)

        tx.update(userRef, {
          'character.inventory': inv,
          'character.notifications': notifs,
        })
      })

      showMsg('success', `🎉 Colheita concluída! Você recebeu ${harvestYield.quantity}x ${plot.cropIcon} ${plot.cropName} (${harvestYield.qualityLabel})!`)
      await refreshCharacter()
    } catch (err) {
      console.error(err)
      showMsg('error', err.message || 'Erro ao colher.')
    } finally {
      setActionLoading(false)
    }
  }

  // 5. Remover canteiro morto
  async function handleRemovePlot(plotId) {
    if (actionLoading) return
    setActionLoading(true)
    try {
      await deleteDoc(doc(db, 'activity_states', plotId))
      showMsg('success', '🧹 Canteiro limpo e liberado para novo plantio.')
    } catch (err) {
      console.error(err)
      showMsg('error', 'Erro ao limpar canteiro.')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="loot-modal-overlay" onClick={onClose}>
      <div
        className="loot-modal"
        onClick={e => e.stopPropagation()}
        style={{ width: 560, maxWidth: '95vw', textAlign: 'left', maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 32 }}>🌱</span>
            <div>
              <h3 style={{ color: '#4ade80', margin: 0, fontSize: 18 }}>Área de Plantação & Agricultura</h3>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Área compartilhada do grupo • Manutenção diária necessária</div>
            </div>
          </div>
          <button className="btn btn-sm" onClick={onClose} style={{ padding: '4px 10px' }}>✕</button>
        </div>

        {/* Alerta de Ferramenta Equipada com Durabilidade */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: toolCheck.ok ? 'rgba(74,222,128,0.08)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${toolCheck.ok ? 'rgba(74,222,128,0.3)' : 'rgba(239,68,68,0.3)'}`,
          borderRadius: 8,
          padding: '10px 14px',
          marginBottom: 16,
        }}>
          <span style={{ fontSize: 20 }}>⛏️</span>
          <div style={{ flex: 1, fontSize: 12 }}>
            <strong>Ferramenta Agrícola:</strong>{' '}
            {toolCheck.ok ? (
              <span style={{ color: '#4ade80' }}>
                {toolCheck.tool?.name || 'Enxada'} equipada (Durabilidade: {toolCheck.curDur}/{toolCheck.maxDur} • Custo ao plantar: -{activity?.durabilityCost || 10}).
              </span>
            ) : (
              <span style={{ color: '#f87171' }}>{toolCheck.error}</span>
            )}
          </div>
        </div>

        {/* Feedback visual */}
        {feedback.msg && (
          <div style={{
            background: feedback.type === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(74,222,128,0.15)',
            border: `1px solid ${feedback.type === 'error' ? 'rgba(239,68,68,0.4)' : 'rgba(74,222,128,0.4)'}`,
            borderRadius: 6,
            padding: '8px 12px',
            marginBottom: 14,
            fontSize: 13,
            color: feedback.type === 'error' ? '#fca5a5' : '#86efac',
          }}>
            {feedback.msg}
          </div>
        )}

        {/* Seção de Plantio de Nova Semente */}
        <div style={{
          background: 'rgba(0,0,0,0.25)',
          borderRadius: 8,
          padding: 14,
          marginBottom: 20,
          border: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🌱</span> Plantar Novo Canteiro
          </div>

          {availableSeeds.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Você não possui sementes no inventário (Sementes de Tomate, Milho, Batata etc.).
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <select
                className="input-field"
                value={selectedSeed}
                onChange={e => setSelectedSeed(e.target.value)}
                style={{ flex: 1, minWidth: 200, padding: '8px 10px', fontSize: 13 }}
              >
                <option value="">Selecione uma semente...</option>
                {availableSeeds.map(s => (
                  <option key={s.seedId} value={s.seedId}>
                    {s.icon || '🌱'} {s.cropName || s.name} ({s.count} disponível{s.count > 1 ? 'is' : ''}) — {s.description || 'Cresce em poucos dias.'}
                  </option>
                ))}
              </select>

              <button
                className="btn btn-primary"
                onClick={handlePlant}
                disabled={!selectedSeed || !toolCheck.ok || actionLoading}
                style={{ padding: '8px 16px', fontSize: 13, whiteSpace: 'nowrap' }}
              >
                {actionLoading ? 'Plantando...' : '⛏️ Plantar'}
              </button>
            </div>
          )}
        </div>

        {/* Lista de Canteiros Ativos */}
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>
            Canteiros na Horta ({plots.length})
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Adubo disponível: <strong style={{ color: aduboCount > 0 ? '#4ade80' : 'inherit' }}>{aduboCount}</strong>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>
            Carregando canteiros...
          </div>
        ) : plots.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: 30,
            background: 'rgba(0,0,0,0.15)',
            borderRadius: 8,
            color: 'var(--text-muted)',
            fontSize: 13
          }}>
            Nenhum canteiro plantado nesta área ainda. Plante a primeira semente acima!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {plots.map(plot => {
              const state = calculateFarmingState(plot)
              const healthColor = getBarColor(state.health)

              return (
                <div
                  key={plot.id}
                  style={{
                    background: state.isDead
                      ? 'rgba(239,68,68,0.06)'
                      : state.isReady
                      ? 'rgba(74,222,128,0.08)'
                      : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${
                      state.isDead
                        ? 'rgba(239,68,68,0.3)'
                        : state.isReady
                        ? 'rgba(74,222,128,0.4)'
                        : 'rgba(255,255,255,0.1)'
                    }`,
                    borderRadius: 8,
                    padding: 14,
                  }}
                >
                  {/* Top line: Ícone, Nome, Status badge, Quem plantou */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 24 }}>{plot.cropIcon || '🌱'}</span>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{plot.cropName}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          Plantado por <strong style={{ color: '#94a3b8' }}>{plot.plantedByName || 'Sobrevivente'}</strong> • {formatHoursAgo(state.hoursWithoutCare)} de cuidado
                        </div>
                      </div>
                    </div>

                    {/* Badge de status */}
                    <div>
                      {state.isDead && (
                        <span style={{ fontSize: 11, background: '#ef4444', color: '#fff', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>
                          💀 Morta (Secou)
                        </span>
                      )}
                      {!state.isDead && state.isReady && (
                        <span style={{ fontSize: 11, background: '#16a34a', color: '#fff', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>
                          🌾 Pronta para Colheita!
                        </span>
                      )}
                      {!state.isDead && !state.isReady && (
                        <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.1)', color: '#94a3b8', padding: '2px 8px', borderRadius: 10 }}>
                          🌱 Em crescimento ({state.growthPct}%)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Barras de Progresso: Crescimento e Saúde */}
                  {!state.isDead && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                      {/* Crescimento */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>
                          <span>Crescimento</span>
                          <strong style={{ color: '#fff' }}>{state.growthPct}%</strong>
                        </div>
                        <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${state.growthPct}%`,
                            background: 'linear-gradient(90deg, #16a34a, #4ade80)',
                            borderRadius: 3,
                            transition: 'width 0.5s ease',
                          }} />
                        </div>
                      </div>

                      {/* Saúde */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>
                          <span>Saúde da Planta</span>
                          <strong style={{ color: healthColor }}>{state.health}/100</strong>
                        </div>
                        <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${state.health}%`,
                            background: healthColor,
                            borderRadius: 3,
                            transition: 'width 0.5s ease',
                          }} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Alerta de negligência */}
                  {state.needsCare && !state.isDead && (
                    <div style={{ fontSize: 11, color: '#fca5a5', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                      ⚠️ <span>Esta planta está há mais de 24h sem água e perdendo saúde. Regue logo!</span>
                    </div>
                  )}

                  {/* Ações */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {state.isReady && !state.isDead && (
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handleHarvest(plot)}
                        disabled={!toolCheck.ok || actionLoading}
                        style={{ fontSize: 12, padding: '6px 12px' }}
                      >
                        🌾 Colher Plantação
                      </button>
                    )}

                    {!state.isDead && !state.isReady && (
                      <>
                        <button
                          className="btn btn-sm"
                          onClick={() => handleCare(plot)}
                          disabled={!toolCheck.ok || actionLoading}
                          style={{ fontSize: 12, padding: '6px 12px', background: 'rgba(56,189,248,0.15)', borderColor: '#38bdf8', color: '#7dd3fc' }}
                          title="Restaura +15 de saúde e reseta o cronômetro de 24h (Pode achar minhocas!)"
                        >
                          💧 Regar & Cuidar (+15 HP)
                        </button>

                        <button
                          className="btn btn-sm"
                          onClick={() => handleFertilize(plot)}
                          disabled={!toolCheck.ok || aduboCount < 1 || actionLoading}
                          style={{ fontSize: 12, padding: '6px 12px', background: 'rgba(234,179,8,0.15)', borderColor: '#eab308', color: '#fef08a' }}
                          title="Consome 1 Adubo e restaura +20 de saúde"
                        >
                          💩 Adubar Solo (+20 HP)
                        </button>
                      </>
                    )}

                    {state.isDead && (
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleRemovePlot(plot.id)}
                        disabled={actionLoading}
                        style={{ fontSize: 12, padding: '6px 12px' }}
                      >
                        🧹 Remover Canteiro Morto
                      </button>
                    )}
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
