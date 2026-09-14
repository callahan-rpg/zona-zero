import { useState, useEffect } from 'react'
import { doc, updateDoc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../contexts/AuthContext'
import { checkInventoryItem } from '../utils/activitySystem'

/**
 * BathroomModal: Gerencia o Banheiro, Reservatório de Água e Ação de Banho/Higiene.
 */
export default function BathroomModal({ isOpen, onClose, location }) {
  const { user, character } = useAuth()
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [bathingProgress, setBathingProgress] = useState(0)
  const [isBathing, setIsBathing] = useState(false)
  const [currentWater, setCurrentWater] = useState(() => Math.max(0, Number(location?.bathroomWater ?? 10)))
  const [maxWater, setMaxWater] = useState(() => Math.max(1, Number(location?.bathroomMaxWater ?? 20)))

  // Escuta dados em tempo real da locação para o reservatório de água
  useEffect(() => {
    if (!location?.slug) return
    const locRef = doc(db, 'locations', location.slug)
    const unsub = onSnapshot(locRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data()
        if (data.bathroomWater !== undefined) setCurrentWater(Math.max(0, Number(data.bathroomWater)))
        if (data.bathroomMaxWater !== undefined) setMaxWater(Math.max(1, Number(data.bathroomMaxWater)))
      }
    }, (err) => console.error('Erro ao escutar reservatório:', err))
    return unsub
  }, [location?.slug])

  if (!isOpen || !location) return null

  const inventory = Array.isArray(character?.inventory) ? character.inventory : []
  const waterPct = Math.min(100, Math.round((currentWater / maxWater) * 100))

  // Checagem de itens de água no inventário
  const cleanWaterCheck = checkInventoryItem(inventory, 'garrafa_agua', 1)
  const impureWaterCheck = checkInventoryItem(inventory, 'garrafa_agua_impura', 1)
  const totalWaterBottles = cleanWaterCheck.found + impureWaterCheck.found

  // Status de higiene atual do personagem
  const rawHygiene = character?.hygiene
  const hygieneLevel = typeof rawHygiene === 'number' ? rawHygiene : (rawHygiene?.level ?? 100)
  const lastBath = typeof rawHygiene === 'object' && rawHygiene?.lastBathTime ? rawHygiene.lastBathTime : (character?.lastBathTime || Date.now())
  const msSinceLastBath = Date.now() - lastBath
  const hoursSinceBath = Math.max(0, Math.floor(msSinceLastBath / (1000 * 60 * 60)))

  // Abastece o reservatório com 1 garrafa de água
  async function handleAddWater() {
    if (currentWater >= maxWater) {
      setFeedback({ type: 'warning', text: 'O reservatório de água já está em sua capacidade máxima!' })
      return
    }

    // Prioriza usar água impura primeiro para o banho, guardando a potável para beber
    const targetItem = impureWaterCheck.found > 0 ? 'garrafa_agua_impura' : 'garrafa_agua'
    const itemInInv = inventory.find(i => (i.itemId === targetItem || i.id === targetItem))

    if (!itemInInv) {
      setFeedback({ type: 'danger', text: 'Você não possui garrafas de água (potável ou impura) no inventário para abastecer.' })
      return
    }

    setLoading(true)
    try {
      // Consome a garrafa do inventário e devolve garrafa vazia
      const updatedInv = [...inventory]
      const idx = updatedInv.findIndex(i => (i.itemId === targetItem || i.id === targetItem))
      if (idx !== -1) {
        if (updatedInv[idx].quantity > 1) {
          updatedInv[idx] = { ...updatedInv[idx], quantity: updatedInv[idx].quantity - 1 }
        } else {
          updatedInv.splice(idx, 1)
        }

        // Devolve garrafa vazia
        const emptyIdx = updatedInv.findIndex(i => (i.itemId === 'garrafa_vazia' || i.id === 'garrafa_vazia'))
        if (emptyIdx !== -1) {
          updatedInv[emptyIdx] = { ...updatedInv[emptyIdx], quantity: (updatedInv[emptyIdx].quantity || 1) + 1 }
        } else {
          updatedInv.push({
            itemId: 'garrafa_vazia',
            name: 'Garrafa Vazia',
            icon: '🧴',
            quantity: 1,
            rarity: 'common',
            weight: 0.1,
            category: 'general'
          })
        }

        if (user?.uid) {
          const userRef = doc(db, 'users', user.uid)
          await updateDoc(userRef, { 'character.inventory': updatedInv })
        }
      }

      // Adiciona 2 litros ao reservatório da locação
      const newWater = Math.min(maxWater, currentWater + 2)
      setCurrentWater(newWater)
      const locRef = doc(db, 'locations', location.slug || location.id)
      await updateDoc(locRef, {
        bathroomWater: newWater
      })

      setFeedback({ type: 'success', text: `Você despejou 1x ${itemInInv.name} no reservatório (+2L). Garrafa vazia guardada.` })
    } catch (err) {
      console.error('Erro ao abastecer reservatório:', err)
      setFeedback({ type: 'danger', text: 'Falha ao abastecer reservatório: ' + err.message })
    } finally {
      setLoading(false)
    }
  }

  // Toma banho consumindo 2 litros de água
  async function handleTakeBath() {
    if (currentWater < 2) {
      setFeedback({ type: 'danger', text: 'Água insuficiente no reservatório! Abasteça com garrafas de água primeiro (mínimo 2L).' })
      return
    }

    setIsBathing(true)
    setBathingProgress(0)

    const interval = setInterval(() => {
      setBathingProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          return 100
        }
        return prev + 25
      })
    }, 400)

    setTimeout(async () => {
      try {
        const newWater = Math.max(0, currentWater - 2)
        setCurrentWater(newWater)
        const locRef = doc(db, 'locations', location.slug || location.id)
        await updateDoc(locRef, {
          bathroomWater: newWater
        })

        // Atualiza a higiene do personagem para 100%
        if (user?.uid) {
          const userRef = doc(db, 'users', user.uid)
          await updateDoc(userRef, {
            'character.hygiene': 100,
            'character.lastBathTime': Date.now()
          })
        }

        setFeedback({
          type: 'success',
          text: '🚿 Banho tomado com sucesso! Você está limpo e higienizado. Sua higiene foi restaurada para 100% com bônus de imunidade biológica.'
        })
      } catch (err) {
        console.error('Erro ao registrar banho:', err)
        setFeedback({ type: 'danger', text: 'Falha ao tomar banho: ' + err.message })
      } finally {
        setIsBathing(false)
        setBathingProgress(0)
      }
    }, 2000)
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={(e) => { if (e.target === e.currentTarget && !isBathing) onClose() }}
    >
      <div
        className="glass"
        style={{
          maxWidth: '500px',
          width: '100%',
          padding: '24px',
          borderRadius: '16px',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.9), 0 0 30px rgba(56, 189, 248, 0.15)',
          background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(10, 15, 30, 0.98) 100%)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '32px' }}>🚿</span>
            <div>
              <h3 style={{ margin: 0, fontFamily: 'Oswald, sans-serif', letterSpacing: 1, textTransform: 'uppercase', color: '#38bdf8', fontSize: '18px' }}>
                Banheiro & Higiene Pessoal
              </h3>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{location.name}</span>
            </div>
          </div>
          {!isBathing && (
            <button
              onClick={onClose}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '22px', cursor: 'pointer', padding: '4px' }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Feedback visual */}
        {feedback && (
          <div style={{
            padding: '10px 14px',
            borderRadius: '8px',
            marginBottom: '16px',
            fontSize: '12px',
            lineHeight: 1.4,
            background: feedback.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : feedback.type === 'warning' ? 'rgba(234, 179, 8, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${feedback.type === 'success' ? '#22c55e' : feedback.type === 'warning' ? '#eab308' : '#ef4444'}`,
            color: feedback.type === 'success' ? '#86efac' : feedback.type === 'warning' ? '#fde047' : '#fca5a5'
          }}>
            {feedback.text}
          </div>
        )}

        {/* Status de Higiene do Personagem */}
        <div style={{ background: 'rgba(0,0,0,0.4)', padding: '14px', borderRadius: '10px', border: '1px solid var(--glass-border)', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Condição de Higiene:</span>
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: '6px',
              background: hygieneLevel >= 80 ? 'rgba(74, 222, 128, 0.15)' : hygieneLevel >= 40 ? 'rgba(234, 179, 8, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: hygieneLevel >= 80 ? '#4ade80' : hygieneLevel >= 40 ? '#facc15' : '#f87171'
            }}>
              {hygieneLevel >= 80 ? `✨ Limpo (${hygieneLevel}%)` : hygieneLevel >= 40 ? `⚠️ Higiene Regular (${hygieneLevel}%)` : `🪰 Sujo (${hygieneLevel}%)`}
            </span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
            Último banho tomado há {hoursSinceBath} hora(s) in-game. Manter a higiene acima de 80% concede bônus de resistência e previne doenças transmitidas por sujeira e bactérias.
          </div>
        </div>

        {/* Nível do Reservatório de Água */}
        <div style={{ background: 'rgba(56, 189, 248, 0.06)', padding: '14px', borderRadius: '10px', border: '1px solid rgba(56, 189, 248, 0.25)', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: '#7dd3fc', fontWeight: 600 }}>🪣 Caixa d'Água / Reservatório:</span>
            <strong style={{ fontSize: '13px', color: '#38bdf8' }}>{currentWater}L / {maxWater}L ({waterPct}%)</strong>
          </div>
          <div style={{ height: '10px', background: 'rgba(0,0,0,0.5)', borderRadius: '5px', overflow: 'hidden', marginBottom: '8px' }}>
            <div style={{ height: '100%', width: `${waterPct}%`, background: 'linear-gradient(90deg, #0284c7, #38bdf8)', transition: 'width 0.3s ease' }} />
          </div>
          <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block' }}>
            Consumo: 2L por banho. Você pode abastecer o tanque com garrafas de água (potável ou impura).
          </span>
        </div>

        {/* Barra de Progresso do Banho */}
        {isBathing && (
          <div style={{ marginBottom: '18px', textAlign: 'center' }}>
            <span style={{ fontSize: '12px', color: '#38bdf8', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
              Lavando o corpo e se higienizando...
            </span>
            <div style={{ height: '10px', background: 'rgba(0,0,0,0.5)', borderRadius: '5px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${bathingProgress}%`, background: '#22c55e', transition: 'width 0.3s ease' }} />
            </div>
          </div>
        )}

        {/* Botões de Ação */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleAddWater}
            disabled={loading || isBathing || currentWater >= maxWater || totalWaterBottles === 0}
            title={totalWaterBottles === 0 ? 'Você não tem garrafas de água' : 'Despejar 1 garrafa no reservatório (+2L)'}
            style={{ fontSize: '12px', padding: '9px 16px' }}
          >
            💧 Abastecer (+2L)
            {totalWaterBottles > 0 && <span style={{ marginLeft: 4, opacity: 0.8 }}>({totalWaterBottles})</span>}
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleTakeBath}
            disabled={loading || isBathing || currentWater < 2}
            style={{
              fontSize: '12px',
              padding: '9px 18px',
              background: currentWater >= 2 ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : undefined,
              borderColor: currentWater >= 2 ? '#38bdf8' : undefined,
              fontWeight: 700
            }}
          >
            {isBathing ? '🚿 Tomando Banho...' : '🚿 Tomar Banho (2L)'}
          </button>
        </div>
      </div>
    </div>
  )
}
