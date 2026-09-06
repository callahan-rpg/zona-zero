import { useState, useEffect } from 'react'
import {
  doc,
  onSnapshot,
  runTransaction,
  setDoc,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../contexts/AuthContext.jsx'
import {
  checkInventoryItem,
  calculateAnimalCareState,
  calculateCleaningRewards,
  consumeItemFromInventory,
  addItemToInventory,
  formatHoursAgo,
  getBarColor,
} from '../utils/activitySystem'

export default function AnimalCareModal({ activity, character, locationSlug, onClose }) {
  const { user, refreshCharacter } = useAuth()
  const [coopState, setCoopState] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [feedback, setFeedback] = useState({ type: '', msg: '' })

  const stateDocId = `coop_${locationSlug}`
  const inventory = character?.inventory || []
  const { found: milhoCount } = checkInventoryItem(inventory, 'milho', 1)

  // Escuta o estado compartilhado do galinheiro neste local
  useEffect(() => {
    const docRef = doc(db, 'activity_states', stateDocId)

    const unsubscribe = onSnapshot(
      docRef,
      async (docSnap) => {
        if (!docSnap.exists()) {
          // Cria o estado inicial padrão se ainda não existir
          const initialData = {
            id: stateDocId,
            type: 'animal_care',
            activityId: activity?.id || 'coop_default',
            locationSlug,
            name: activity?.name || 'Galinheiro Comunitário',
            totalAnimals: 10,
            aliveAnimals: 10,
            feeding: 100,
            hygiene: 100,
            health: 100,
            lastFedAt: new Date().toISOString(),
            lastFedBy: 'Início',
            lastCleanedAt: new Date().toISOString(),
            lastCleanedBy: 'Início',
            lastEggCollectionAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          }
          try {
            await setDoc(docRef, initialData)
          } catch (e) {
            console.error('Erro ao inicializar galinheiro:', e)
          }
          setCoopState(initialData)
        } else {
          setCoopState(docSnap.data())
        }
        setLoading(false)
      },
      (err) => {
        console.error('Erro ao escutar galinheiro:', err)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [locationSlug, stateDocId])

  function showMsg(type, msg) {
    setFeedback({ type, msg })
    setTimeout(() => setFeedback({ type: '', msg: '' }), 4500)
  }

  // Cálculos do estado offline
  const computed = coopState ? calculateAnimalCareState(coopState) : null

  // Cálculo de ovos disponíveis
  let eggsAvailable = 0
  if (coopState && computed) {
    const lastEggAt = new Date(coopState.lastEggCollectionAt || coopState.createdAt || Date.now()).getTime()
    const hoursSinceEgg = (Date.now() - lastEggAt) / (1000 * 60 * 60)
    // 1 ovo a cada 8 horas por galinha viva (limitado a 2 por galinha)
    const eggIntervalHours = 8
    const eggsPerChicken = Math.min(2, Math.floor(hoursSinceEgg / eggIntervalHours))
    eggsAvailable = Math.max(0, eggsPerChicken * computed.aliveAnimals)
  }

  // 1. Alimentar galinhas (Consome 2x Milho)
  async function handleFeed() {
    if (actionLoading || !coopState) return
    const requiredCorn = 2
    if (milhoCount < requiredCorn) {
      showMsg('error', `Você precisa de pelo menos ${requiredCorn}x Milho para alimentar o galinheiro (possui: ${milhoCount}).`)
      return
    }

    setActionLoading(true)
    try {
      const userRef = doc(db, 'users', user.uid)
      const coopRef = doc(db, 'activity_states', stateDocId)
      const nowIso = new Date().toISOString()

      await runTransaction(db, async (tx) => {
        const userSnap = await tx.get(userRef)
        const coopSnap = await tx.get(coopRef)
        if (!userSnap.exists() || !coopSnap.exists()) throw new Error('Dados não encontrados.')

        const charData = userSnap.data().character || {}
        let inv = [...(charData.inventory || [])]

        // Consome 2 milhos atomicamente
        inv = consumeItemFromInventory(inv, 'milho', requiredCorn, 'Milho')

        // Atualiza galinheiro
        tx.update(coopRef, {
          feeding: 100,
          health: Math.min(100, (coopSnap.data().health || 100) + 10),
          lastFedAt: nowIso,
          lastFedBy: character?.name || 'Sobrevivente',
        })

        tx.update(userRef, {
          'character.inventory': inv,
        })
      })

      showMsg('success', `🌽 Você alimentou as galinhas com ${requiredCorn}x Milho! Fome saciada.`)
      await refreshCharacter()
    } catch (err) {
      console.error(err)
      showMsg('error', err.message || 'Erro ao alimentar o galinheiro.')
    } finally {
      setActionLoading(false)
    }
  }

  // 2. Limpar galinheiro (Produz Adubo para horta)
  async function handleClean() {
    if (actionLoading || !coopState || !computed) return

    if (computed.aliveAnimals <= 0) {
      showMsg('error', 'Não há galinhas vivas no galinheiro.')
      return
    }

    // Impede spam instantâneo se acabou de limpar
    if (computed.hoursSinceClean < 0.5 && computed.hygiene > 90) {
      showMsg('error', 'O galinheiro ainda está limpo! Aguarde acumular sujeira para limpar e extrair adubo.')
      return
    }

    setActionLoading(true)
    try {
      const userRef = doc(db, 'users', user.uid)
      const coopRef = doc(db, 'activity_states', stateDocId)
      const nowIso = new Date().toISOString()
      const { adubo } = calculateCleaningRewards(computed.aliveAnimals)

      await runTransaction(db, async (tx) => {
        const userSnap = await tx.get(userRef)
        const coopSnap = await tx.get(coopRef)
        if (!userSnap.exists() || !coopSnap.exists()) throw new Error('Dados não encontrados.')

        const charData = userSnap.data().character || {}
        let inv = [...(charData.inventory || [])]

        // Adiciona Adubo
        inv = addItemToInventory(inv, {
          itemId: 'adubo',
          name: 'Adubo',
          icon: '💩',
          quantity: adubo,
          category: 'general',
          rarity: 'common',
          consumable: false,
          description: 'Composto orgânico do galinheiro para melhorar a saúde das plantações na horta.',
          obtainedFrom: `Galinheiro — ${locationSlug}`,
        })

        // Notificação
        const notifs = [
          {
            id: Math.random().toString(36).substring(2),
            type: 'activity_reward',
            title: '🧹 Galinheiro Limpo!',
            message: `Você limpou o galinheiro e obteve ${adubo}x 💩 Adubo!`,
            timestamp: nowIso,
            read: false,
          },
          ...(charData.notifications || []).slice(0, 29),
        ]

        // Atualiza galinheiro
        tx.update(coopRef, {
          hygiene: 100,
          health: Math.min(100, (coopSnap.data().health || 100) + 10),
          lastCleanedAt: nowIso,
          lastCleanedBy: character?.name || 'Sobrevivente',
        })

        tx.update(userRef, {
          'character.inventory': inv,
          'character.notifications': notifs,
        })
      })

      showMsg('success', `🧹 Galinheiro limpo! Você coletou +${adubo}x Adubo 💩!`)
      await refreshCharacter()
    } catch (err) {
      console.error(err)
      showMsg('error', err.message || 'Erro ao limpar o galinheiro.')
    } finally {
      setActionLoading(false)
    }
  }

  // 3. Coletar ovos
  async function handleCollectEggs() {
    if (actionLoading || !coopState || eggsAvailable <= 0) return

    setActionLoading(true)
    try {
      const userRef = doc(db, 'users', user.uid)
      const coopRef = doc(db, 'activity_states', stateDocId)
      const nowIso = new Date().toISOString()
      const eggsQty = eggsAvailable

      await runTransaction(db, async (tx) => {
        const userSnap = await tx.get(userRef)
        const coopSnap = await tx.get(coopRef)
        if (!userSnap.exists() || !coopSnap.exists()) throw new Error('Dados não encontrados.')

        const charData = userSnap.data().character || {}
        let inv = [...(charData.inventory || [])]

        // Adiciona ovos
        inv = addItemToInventory(inv, {
          itemId: 'ovo',
          name: 'Ovo de Galinha',
          icon: '🥚',
          quantity: eggsQty,
          category: 'general',
          rarity: 'common',
          consumable: true,
          consumeEffect: { hunger: 15, blood: 5 },
          description: 'Ovo fresco colhido no ninho.',
          obtainedFrom: `Galinheiro — ${locationSlug}`,
        })

        tx.update(coopRef, {
          lastEggCollectionAt: nowIso,
        })

        tx.update(userRef, {
          'character.inventory': inv,
        })
      })

      showMsg('success', `🥚 Você coletou ${eggsQty}x Ovo(s) fresco(s) do ninho!`)
      await refreshCharacter()
    } catch (err) {
      console.error(err)
      showMsg('error', err.message || 'Erro ao coletar ovos.')
    } finally {
      setActionLoading(false)
    }
  }

  const feedingColor = computed ? getBarColor(computed.feeding) : '#4ade80'
  const hygieneColor = computed ? getBarColor(computed.hygiene) : '#4ade80'
  const healthColor  = computed ? getBarColor(computed.health)  : '#4ade80'

  return (
    <div className="loot-modal-overlay" onClick={onClose}>
      <div
        className="loot-modal"
        onClick={e => e.stopPropagation()}
        style={{ width: 540, maxWidth: '95vw', textAlign: 'left', maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 32 }}>🐔</span>
            <div>
              <h3 style={{ color: '#fbbf24', margin: 0, fontSize: 18 }}>
                {activity?.name || 'Galinheiro Comunitário'}
              </h3>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Compartilhado entre todos os sobreviventes • Ciclo sustentável
              </div>
            </div>
          </div>
          <button className="btn btn-sm" onClick={onClose} style={{ padding: '4px 10px' }}>✕</button>
        </div>

        {/* Feedback visual */}
        {feedback.msg && (
          <div style={{
            background: feedback.type === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(251,191,36,0.15)',
            border: `1px solid ${feedback.type === 'error' ? 'rgba(239,68,68,0.4)' : 'rgba(251,191,36,0.4)'}`,
            borderRadius: 6,
            padding: '8px 12px',
            marginBottom: 14,
            fontSize: 13,
            color: feedback.type === 'error' ? '#fca5a5' : '#fde68a',
          }}>
            {feedback.msg}
          </div>
        )}

        {loading || !computed ? (
          <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)', fontSize: 13 }}>
            Carregando dados do galinheiro...
          </div>
        ) : (
          <>
            {/* Cartão de Visão Geral dos Animais */}
            <div style={{
              background: 'rgba(0,0,0,0.25)',
              borderRadius: 8,
              padding: 14,
              marginBottom: 16,
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600, marginBottom: 2 }}>
                  População do Galinheiro
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>
                  🐔 {computed.aliveAnimals} <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 400 }}>/ {coopState.totalAnimals || 10} Galinhas Vivas</span>
                </div>
              </div>

              {/* Status geral */}
              <div>
                {computed.aliveAnimals === 0 ? (
                  <span style={{ fontSize: 12, background: '#ef4444', color: '#fff', padding: '4px 10px', borderRadius: 12, fontWeight: 700 }}>
                    💀 Extinto (Todas morreram)
                  </span>
                ) : computed.status === 'healthy' ? (
                  <span style={{ fontSize: 12, background: '#16a34a', color: '#fff', padding: '4px 10px', borderRadius: 12, fontWeight: 700 }}>
                    ✨ Saudáveis
                  </span>
                ) : computed.status === 'debilitated' ? (
                  <span style={{ fontSize: 12, background: '#d97706', color: '#fff', padding: '4px 10px', borderRadius: 12, fontWeight: 700 }}>
                    ⚠️ Debilitadas
                  </span>
                ) : (
                  <span style={{ fontSize: 12, background: '#dc2626', color: '#fff', padding: '4px 10px', borderRadius: 12, fontWeight: 700 }}>
                    🚨 Doentes (Risco de Morte)
                  </span>
                )}
              </div>
            </div>

            {/* Barras de Status: Alimentação, Higiene e Saúde */}
            <div style={{
              background: 'rgba(0,0,0,0.25)',
              borderRadius: 8,
              padding: 14,
              marginBottom: 16,
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}>
              {/* Alimentação */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-muted)' }}>
                    🌽 Alimentação • <span style={{ color: '#94a3b8' }}>Alimentado {formatHoursAgo(computed.hoursSinceFed)} ({coopState.lastFedBy || 'Alguém'})</span>
                  </span>
                  <strong style={{ color: feedingColor }}>{computed.feeding}%</strong>
                </div>
                <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${computed.feeding}%`,
                    background: feedingColor,
                    borderRadius: 4,
                    transition: 'width 0.5s ease',
                  }} />
                </div>
              </div>

              {/* Higiene */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-muted)' }}>
                    🧹 Higiene do Viveiro • <span style={{ color: '#94a3b8' }}>Limpo {formatHoursAgo(computed.hoursSinceClean)} ({coopState.lastCleanedBy || 'Alguém'})</span>
                  </span>
                  <strong style={{ color: hygieneColor }}>{computed.hygiene}%</strong>
                </div>
                <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${computed.hygiene}%`,
                    background: hygieneColor,
                    borderRadius: 4,
                    transition: 'width 0.5s ease',
                  }} />
                </div>
              </div>

              {/* Saúde Geral */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-muted)' }}>❤️ Saúde do Bando</span>
                  <strong style={{ color: healthColor }}>{computed.health}/100</strong>
                </div>
                <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${computed.health}%`,
                    background: healthColor,
                    borderRadius: 4,
                    transition: 'width 0.5s ease',
                  }} />
                </div>
              </div>
            </div>

            {/* Alerta de perigo */}
            {(computed.needsFeeding || computed.needsCleaning) && computed.aliveAnimals > 0 && (
              <div style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 8,
                padding: '10px 14px',
                marginBottom: 16,
                fontSize: 12,
                color: '#fca5a5',
              }}>
                ⚠️ <strong>Atenção:</strong>{' '}
                {computed.needsFeeding && computed.needsCleaning
                  ? 'O galinheiro está faminto e sujo! As galinhas começarão a adoecer e morrer se não forem cuidadas.'
                  : computed.needsFeeding
                  ? 'As galinhas estão com fome! Alimente-as com milho para evitar debilitação.'
                  : 'O viveiro está imundo! Faça a limpeza para evitar doenças e gerar adubo/minhocas.'}
              </div>
            )}

            {/* Ninho de Ovos */}
            <div style={{
              background: 'rgba(251,191,36,0.08)',
              border: '1px solid rgba(251,191,36,0.25)',
              borderRadius: 8,
              padding: 14,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 28 }}>🥚</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fde68a' }}>Ninho de Ovos Frescos</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {eggsAvailable > 0
                      ? `${eggsAvailable} ovo(s) pronto(s) para coleta!`
                      : 'As galinhas ainda estão chocando novos ovos.'}
                  </div>
                </div>
              </div>

              <button
                className="btn btn-sm btn-primary"
                onClick={handleCollectEggs}
                disabled={eggsAvailable <= 0 || actionLoading}
                style={{
                  padding: '8px 14px',
                  fontSize: 12,
                  background: eggsAvailable > 0 ? '#f59e0b' : undefined,
                  borderColor: eggsAvailable > 0 ? '#fbbf24' : undefined,
                }}
              >
                🥚 Coletar ({eggsAvailable})
              </button>
            </div>

            {/* Botões de Ação de Manutenção */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {/* Alimentar */}
              <button
                className="btn"
                onClick={handleFeed}
                disabled={milhoCount < 2 || actionLoading || computed.aliveAnimals <= 0}
                style={{
                  background: 'rgba(234,179,8,0.15)',
                  borderColor: '#eab308',
                  color: '#fef08a',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700 }}>🌽 Alimentar Galinhas</div>
                <div style={{ fontSize: 11, opacity: 0.85 }}>
                  Consome 2x Milho (Você tem: {milhoCount})
                </div>
              </button>

              {/* Limpar e Gerar Insumos */}
              <button
                className="btn"
                onClick={handleClean}
                disabled={actionLoading || computed.aliveAnimals <= 0}
                style={{
                  background: 'rgba(56,189,248,0.15)',
                  borderColor: '#38bdf8',
                  color: '#7dd3fc',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700 }}>🧹 Limpar Viveiro</div>
                <div style={{ fontSize: 11, opacity: 0.85 }}>
                  Gera 💩 Adubo para a Horta
                </div>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
