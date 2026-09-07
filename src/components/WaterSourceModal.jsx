import { useState, useEffect, useRef } from 'react'
import { doc, runTransaction } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../contexts/AuthContext.jsx'
import { validateWaterCollection } from '../utils/waterSystem'
import { consumeItemFromInventory, addItemToInventory } from '../utils/activitySystem'
import { DEFAULT_PRESET_ITEMS, RARITY_META } from '../utils/itemSystem'

export default function WaterSourceModal({ waterSource, locationSlug, onClose }) {
  const { user, character, refreshCharacter } = useAuth()

  const [phase, setPhase] = useState('idle') // idle | collecting | result | error
  const [progress, setProgress] = useState(0)
  const [collectQty, setCollectQty] = useState(1)
  const [resultData, setResultData] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const timerRef = useRef(null)

  const inventory = character?.inventory || []
  const validation = validateWaterCollection(waterSource, inventory)
  const emptyBottlesCount = validation.found || 0
  const maxPossible = Math.max(1, Math.floor(emptyBottlesCount / (waterSource?.requiredQuantity || 1)))

  // Ajusta quantidade selecionada caso a quantidade disponível seja menor
  useEffect(() => {
    if (collectQty > maxPossible && maxPossible > 0) {
      setCollectQty(maxPossible)
    }
  }, [maxPossible, collectQty])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  async function handleStartCollection() {
    if (isProcessing || phase === 'collecting') return

    const check = validateWaterCollection(waterSource, character?.inventory || [])
    if (!check.ok) {
      setErrorMsg(check.reason)
      return
    }

    const neededTotal = collectQty * (waterSource.requiredQuantity || 1)
    if (emptyBottlesCount < neededTotal) {
      setErrorMsg(`Você precisa de ${neededTotal}x ${waterSource.requiredItemName || 'Garrafa Vazia'} para coletar esta quantidade.`)
      return
    }

    setErrorMsg('')
    setIsProcessing(true)
    setPhase('collecting')
    setProgress(0)

    const durationSec = waterSource.durationSec || 3
    const totalMs = durationSec * 1000
    const intervalMs = 100
    const stepPercent = (intervalMs / totalMs) * 100

    let current = 0
    timerRef.current = setInterval(() => {
      current += stepPercent
      if (current >= 100) {
        clearInterval(timerRef.current)
        setProgress(100)
        finalizeCollection(collectQty)
      } else {
        setProgress(current)
      }
    }, intervalMs)
  }

  async function finalizeCollection(qtyToCollect) {
    if (!user?.uid || !waterSource) return

    try {
      let createdItem = null
      const totalRequired = qtyToCollect * (waterSource.requiredQuantity || 1)
      const totalProduced = qtyToCollect * (waterSource.producedQuantity || 1)

      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', user.uid)
        const userSnap = await transaction.get(userRef)
        if (!userSnap.exists()) throw new Error('Personagem não encontrado.')

        const charData = userSnap.data()?.character || {}
        let currentInv = [...(charData.inventory || [])]

        // 1. Valida se ainda tem os recipientes no inventário
        const reqItemId = waterSource.requiredItem || 'garrafa_vazia'
        const reqItemName = waterSource.requiredItemName || 'Garrafa de Água Vazia'
        currentInv = consumeItemFromInventory(currentInv, reqItemId, totalRequired, reqItemName)

        // 2. Cria os itens de água impura produzidos
        const prodItemId = waterSource.producedItem || 'garrafa_agua_impura'
        const preset = DEFAULT_PRESET_ITEMS.find(p => p.itemId === prodItemId)

        createdItem = {
          itemId: prodItemId,
          name: waterSource.producedItemName || preset?.name || 'Garrafa de Água Impura',
          icon: preset?.icon || '🧪',
          quantity: totalProduced,
          category: 'supplies',
          rarity: preset?.rarity || 'common',
          consumable: false,
          isQuestItem: false,
          description: preset?.description || 'Água turva coletada de fonte natural. Não deve ser bebida crua. Ferva em uma panela para purificar.',
          obtainedFrom: `Coleta em ${waterSource.name || 'Fonte de Água'}`
        }

        currentInv = addItemToInventory(currentInv, createdItem)

        transaction.update(userRef, {
          'character.inventory': currentInv,
          'character.lastWaterCollectedAt': new Date().toISOString()
        })
      })

      if (refreshCharacter) await refreshCharacter()
      setResultData({ ...createdItem, quantity: totalProduced })
      setPhase('result')
    } catch (err) {
      console.error('Erro na coleta de água:', err)
      setErrorMsg(err.message || 'Erro ao processar a coleta de água.')
      setPhase('error')
    } finally {
      setIsProcessing(false)
    }
  }

  function handleReset() {
    setPhase('idle')
    setProgress(0)
    setResultData(null)
    setErrorMsg('')
    setIsProcessing(false)
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      <div
        className="glass"
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '16px',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.9), 0 0 30px rgba(56, 189, 248, 0.15)',
          overflow: 'hidden',
          background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(10, 15, 29, 0.98) 100%)'
        }}
      >
        {/* CABEÇALHO */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(56, 189, 248, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(56, 189, 248, 0.08)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '28px' }}>{waterSource.icon || '💧'}</span>
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: '18px',
                  fontWeight: 800,
                  fontFamily: 'Oswald, sans-serif',
                  letterSpacing: '1px',
                  color: '#38bdf8',
                  textTransform: 'uppercase'
                }}
              >
                {waterSource.name || 'Fonte de Água'}
              </h2>
              <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>
                {waterSource.description || 'Ponto de coleta de água natural para sobrevivência.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={phase === 'collecting'}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '20px',
              cursor: phase === 'collecting' ? 'not-allowed' : 'pointer',
              padding: '4px 8px',
              borderRadius: '6px'
            }}
          >
            ✕
          </button>
        </div>

        {/* CORPO DO MODAL */}
        <div style={{ padding: '24px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '18px' }}>

          {/* FASE DE ERRO */}
          {phase === 'error' && (
            <div
              style={{
                padding: '16px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid #ef4444',
                borderRadius: '10px',
                textAlign: 'center',
                color: '#fca5a5'
              }}
            >
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>⚠️</div>
              <strong style={{ display: 'block', fontSize: '14px', marginBottom: '4px' }}>Falha na Coleta</strong>
              <p style={{ margin: 0, fontSize: '12px' }}>{errorMsg || 'Ocorreu um erro ao coletar água.'}</p>
              <button
                className="btn btn-primary"
                onClick={handleReset}
                style={{ marginTop: '14px', padding: '6px 16px', fontSize: '12px' }}
              >
                Tentar Novamente
              </button>
            </div>
          )}

          {/* FASE DE ANIMAÇÃO DE COLETA */}
          {phase === 'collecting' && (
            <div
              style={{
                padding: '30px 20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                gap: '20px'
              }}
            >
              {/* Garrafa enchendo e água animada */}
              <div style={{ position: 'relative', width: '100px', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div
                  style={{
                    position: 'absolute',
                    fontSize: '40px',
                    filter: 'drop-shadow(0 0 15px rgba(56, 189, 248, 0.8))',
                    animation: 'pulse 1s infinite alternate'
                  }}
                >
                  💧
                </div>
                <div
                  style={{
                    fontSize: '54px',
                    zIndex: 2,
                    animation: 'bounce 0.8s infinite alternate'
                  }}
                >
                  🍾
                </div>
              </div>

              <div>
                <h3 style={{ margin: '0 0 6px', fontSize: '17px', color: '#38bdf8', fontFamily: 'Oswald, sans-serif' }}>
                  Enchendo {collectQty > 1 ? `${collectQty} Garrafas` : 'Garrafa'} de Água...
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
                  Coletando água fresca da fonte em seu recipiente.
                </p>
              </div>

              {/* BARRA DE PROGRESSO */}
              <div style={{ width: '100%', maxWidth: '320px' }}>
                <div
                  style={{
                    height: '10px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '5px',
                    overflow: 'hidden',
                    border: '1px solid rgba(56, 189, 248, 0.3)'
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${progress}%`,
                      background: 'linear-gradient(90deg, #38bdf8, #0284c7)',
                      transition: 'width 0.1s linear',
                      boxShadow: '0 0 10px rgba(56, 189, 248, 0.6)'
                    }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#38bdf8', marginTop: '4px' }}>
                  <span>Coletando</span>
                  <span>{Math.round(progress)}%</span>
                </div>
              </div>
            </div>
          )}

          {/* FASE DE RESULTADO / COLETA BEM SUCEDIDA */}
          {phase === 'result' && resultData && (
            <div
              style={{
                padding: '24px 20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                gap: '16px',
                background: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: '12px'
              }}
            >
              <div style={{ fontSize: '13px', textTransform: 'uppercase', color: '#38bdf8', fontWeight: 700, letterSpacing: '1px' }}>
                ✨ Água Coletada com Sucesso! ✨
              </div>

              <div
                style={{
                  width: '74px',
                  height: '74px',
                  borderRadius: '16px',
                  background: 'rgba(0, 0, 0, 0.5)',
                  border: '2px solid #38bdf8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '40px',
                  boxShadow: '0 0 20px rgba(56, 189, 248, 0.35)'
                }}
              >
                {resultData.icon || '🧪'}
              </div>

              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: '18px', color: '#fff', fontFamily: 'Oswald, sans-serif' }}>
                  {resultData.quantity > 1 ? `${resultData.quantity}x ` : ''}{resultData.name}
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', maxWidth: '380px', lineHeight: 1.4 }}>
                  {resultData.description}
                </p>
              </div>

              <div
                style={{
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '11px',
                  color: '#fef08a',
                  textAlign: 'left',
                  width: '100%',
                  maxWidth: '380px'
                }}
              >
                <strong>🔥 Próximo Passo — Purificação:</strong>
                <p style={{ margin: '4px 0 0 0', lineHeight: 1.4 }}>
                  Esta água é impura. Vá até uma cozinha ou fogueira com a <strong>Panela de Ferro equipada</strong> e selecione a receita <strong>"Purificar Água"</strong> para fervê-la e torná-la potável!
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                {emptyBottlesCount > 0 && (
                  <button
                    className="btn btn-primary"
                    onClick={handleReset}
                    style={{
                      background: '#0284c7',
                      borderColor: '#0284c7',
                      color: '#fff',
                      fontWeight: 700,
                      padding: '8px 18px',
                      fontSize: '12px'
                    }}
                  >
                    💧 Coletar Mais
                  </button>
                )}
                <button
                  className="btn"
                  onClick={onClose}
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    padding: '8px 16px',
                    fontSize: '12px'
                  }}
                >
                  Guardar e Fechar
                </button>
              </div>
            </div>
          )}

          {/* FASE IDLE: VISUALIZAÇÃO DOS REQUISITOS E BOTÃO COLETAR */}
          {phase === 'idle' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* CARD DE STATUS DO RECIPIENTE */}
              <div
                style={{
                  padding: '16px',
                  background: 'rgba(0, 0, 0, 0.35)',
                  border: validation.ok ? '1px solid rgba(56, 189, 248, 0.25)' : '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Recipiente Necessário
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: validation.ok ? '#34d399' : '#f87171',
                      background: validation.ok ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      padding: '2px 8px',
                      borderRadius: '6px'
                    }}
                  >
                    {validation.ok ? `✓ ${emptyBottlesCount} Disponíveis` : '✕ Recipiente Ausente'}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '24px' }}>🍾</span>
                    <div>
                      <strong style={{ fontSize: '13px', color: '#fff', display: 'block' }}>
                        {waterSource.requiredItemName || 'Garrafa de Água Vazia'}
                      </strong>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                        Consumida na coleta para armazenar a água.
                      </span>
                    </div>
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: validation.ok ? '#38bdf8' : '#f87171' }}>
                    {emptyBottlesCount} / {waterSource.requiredQuantity || 1}
                  </span>
                </div>

                {/* ALERTA SE NÃO TIVER GARRAFAS VAZIAS */}
                {!validation.ok && (
                  <div
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      fontSize: '11px',
                      color: '#fca5a5'
                    }}
                  >
                    <strong>⚠️ Sem garrafas vazias no inventário:</strong>
                    <p style={{ margin: '4px 0 0 0', lineHeight: 1.4 }}>
                      Ao beber uma <strong>Garrafa de Água Potável</strong>, ela se transforma em uma <strong>Garrafa de Água Vazia</strong> que você pode trazer até aqui para reabastecer!
                    </p>
                  </div>
                )}
              </div>

              {/* CARD DE RESULTADO ESPERADO */}
              <div
                style={{
                  padding: '14px 16px',
                  background: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '24px' }}>🧪</span>
                  <div>
                    <strong style={{ fontSize: '13px', color: '#e2e8f0', display: 'block' }}>
                      {waterSource.producedItemName || 'Garrafa de Água Impura'}
                    </strong>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                      Deve ser fervida na cozinha/fogueira com a panela.
                    </span>
                  </div>
                </div>
                <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 700, background: 'rgba(56, 189, 248, 0.15)', padding: '3px 8px', borderRadius: '6px' }}>
                  +{collectQty * (waterSource.producedQuantity || 1)}x Água Impura
                </span>
              </div>

              {/* CONTROLE DE QUANTIDADE SE TIVER MAIS DE 1 GARRAFA */}
              {validation.ok && maxPossible > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#cbd5e1' }}>Quantidade a Coletar:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => setCollectQty(prev => Math.max(1, prev - 1))}
                      disabled={collectQty <= 1}
                      style={{ padding: '2px 8px', fontSize: '12px' }}
                    >
                      -
                    </button>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#38bdf8', minWidth: '24px', textAlign: 'center' }}>
                      {collectQty}
                    </span>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => setCollectQty(prev => Math.min(maxPossible, prev + 1))}
                      disabled={collectQty >= maxPossible}
                      style={{ padding: '2px 8px', fontSize: '12px' }}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => setCollectQty(maxPossible)}
                      style={{ padding: '2px 6px', fontSize: '10px', marginLeft: '4px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}
                    >
                      Máx ({maxPossible})
                    </button>
                  </div>
                </div>
              )}

              {/* BOTÃO COLETAR ÁGUA */}
              <button
                className="btn btn-primary"
                onClick={handleStartCollection}
                disabled={!validation.ok || isProcessing}
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '14px',
                  fontWeight: 800,
                  background: validation.ok ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : 'rgba(255,255,255,0.08)',
                  borderColor: validation.ok ? '#38bdf8' : 'transparent',
                  color: validation.ok ? '#fff' : '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  borderRadius: '8px',
                  boxShadow: validation.ok ? '0 4px 15px rgba(2, 132, 199, 0.4)' : 'none',
                  cursor: validation.ok ? 'pointer' : 'not-allowed'
                }}
              >
                {validation.ok ? `💧 Coletar ${collectQty > 1 ? `${collectQty}x ` : ''}Água (${waterSource.durationSec || 3}s)` : '🔒 Requer Garrafa Vazia'}
              </button>

            </div>
          )}

        </div>
      </div>
    </div>
  )
}
