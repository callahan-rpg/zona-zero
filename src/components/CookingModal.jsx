import { useState, useEffect, useRef } from 'react'
import { collection, onSnapshot, doc, runTransaction } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../contexts/AuthContext.jsx'
import { canCookRecipe, getAvailableRecipes, resolveIngredientMatch, getIngredientVariants, DEFAULT_RECIPES } from '../utils/cookingSystem'
import { consumeItemFromInventory, addItemToInventory } from '../utils/activitySystem'
import { RARITY_META } from '../utils/itemSystem'
import { createMiniGameSession, validateMiniGameOutcome, MINIGAME_TYPES } from '../utils/minigameEngine'
import CookingMinigame from './CookingMinigame.jsx'

export default function CookingModal({ locationSlug, onClose }) {
  const { user, character, refreshCharacter } = useAuth()

  const [recipes, setRecipes] = useState([])
  const [loadingRecipes, setLoadingRecipes] = useState(true)
  const [selectedRecipe, setSelectedRecipe] = useState(null)
  const [selectedVariants, setSelectedVariants] = useState({}) // { [ingIndex]: itemId }
  const [phase, setPhase] = useState('idle') // idle | minigame | cooking | result | failure | error
  const [cookingProgress, setCookingProgress] = useState(0)
  const [cookedItemResult, setCookedItemResult] = useState(null)
  const [activeSession, setActiveSession] = useState(null)
  const [failureInfo, setFailureInfo] = useState({ lostIngredients: false, message: '' })
  const [actionError, setActionError] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const progressIntervalRef = useRef(null)

  // Escuta receitas cadastradas no Firestore (/recipes)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'recipes'), (snap) => {
      if (!snap.empty) {
        const loaded = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        setRecipes(loaded)
      } else {
        // Usa as receitas padrão se o Firestore ainda não tiver receitas cadastradas
        setRecipes(DEFAULT_RECIPES)
      }
      setLoadingRecipes(false)
    }, (err) => {
      console.error('Erro ao buscar receitas:', err)
      setRecipes(DEFAULT_RECIPES)
      setLoadingRecipes(false)
    })

    return () => {
      unsub()
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
    }
  }, [])

  const inventory = character?.inventory || []

  // Filtro Estrito: Apenas receitas que o jogador PODE cozinhar agora (com suporte a variações)
  const availableRecipes = getAvailableRecipes(recipes, inventory)

  // Se a receita selecionada não estiver mais disponível, seleciona a primeira disponível ou null
  useEffect(() => {
    if (phase !== 'idle') return
    if (selectedRecipe) {
      const stillAvailable = availableRecipes.find(r => r.id === selectedRecipe.id)
      if (!stillAvailable) {
        setSelectedRecipe(availableRecipes[0] || null)
        setSelectedVariants({})
      }
    } else if (availableRecipes.length > 0) {
      setSelectedRecipe(availableRecipes[0])
      setSelectedVariants({})
    }
  }, [availableRecipes.length, phase])

  async function handleStartCooking() {
    if (!selectedRecipe || isProcessing || phase === 'cooking' || phase === 'minigame') return

    const check = canCookRecipe(selectedRecipe, character?.inventory || [], selectedVariants)
    if (!check.ok) {
      setActionError(check.reason || 'Você não atende aos requisitos desta receita.')
      return
    }

    setActionError('')
    const useMinigame = selectedRecipe.minigame !== 'none'

    if (useMinigame) {
      // 1. Inicia Sessão de Minigame
      const session = createMiniGameSession({
        type: MINIGAME_TYPES.COOKING_TEMPERATURE,
        recipeId: selectedRecipe.id,
        characterId: user?.uid,
        durationSec: selectedRecipe.cookDurationSec || 6,
        difficulty: selectedRecipe.minigameDifficulty || 'normal',
        ingredientLossOnFailure: selectedRecipe.ingredientLossOnFailure === true
      })

      setActiveSession(session)
      setPhase('minigame')
    } else {
      // 2. Preparo Direto sem Minigame (Legado / Configurado sem minigame)
      setIsProcessing(true)
      setPhase('cooking')
      setCookingProgress(0)

      const durationSec = selectedRecipe.cookDurationSec || 4
      const totalMs = durationSec * 1000
      const intervalMs = 100
      const stepPercent = (intervalMs / totalMs) * 100

      let current = 0
      progressIntervalRef.current = setInterval(() => {
        current += stepPercent
        if (current >= 100) {
          clearInterval(progressIntervalRef.current)
          setCookingProgress(100)
          finalizeCooking(selectedRecipe, { success: true })
        } else {
          setCookingProgress(current)
        }
      }, intervalMs)
    }
  }

  // Callback chamado quando o minigame termina (sucesso ou falha)
  async function handleMinigameOutcome(outcome) {
    if (!activeSession || isProcessing) return

    const validation = validateMiniGameOutcome(activeSession, outcome)
    if (!validation.ok) {
      setActionError(validation.reason || 'Erro na validação da sessão do minigame.')
      setPhase('error')
      return
    }

    setIsProcessing(true)
    await finalizeCooking(selectedRecipe, {
      success: validation.success,
      ingredientLossOnFailure: validation.ingredientLossOnFailure,
      sessionId: validation.sessionId
    })
  }

  // Finalização Atômica no Firestore com consumo das variantes corretas
  async function finalizeCooking(recipeToCook, { success = true, ingredientLossOnFailure = false, sessionId = null } = {}) {
    if (!user?.uid || !recipeToCook) {
      setIsProcessing(false)
      return
    }

    try {
      let resultItemData = null
      let lostIngredients = false

      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', user.uid)
        const userSnap = await transaction.get(userRef)
        if (!userSnap.exists()) throw new Error('Personagem não encontrado.')

        const charData = userSnap.data()?.character || {}
        let currentInv = [...(charData.inventory || [])]

        // 1. Valida se os itens/variantes ainda existem no inventário
        const check = canCookRecipe(recipeToCook, currentInv, selectedVariants)
        if (!check.ok) {
          throw new Error(check.reason || 'Itens ou ferramentas insuficientes.')
        }

        const resolved = check.resolvedIngredients || []

        if (success) {
          // SUCESSO: Consome os ingredientes resolvidos (item base ou variante escolhida)
          for (const itemSlot of resolved) {
            const qty = Math.max(1, Number(itemSlot.quantity) || 1)
            currentInv = consumeItemFromInventory(
              currentInv,
              itemSlot.matchedItem.itemId,
              qty,
              itemSlot.matchedItem.name
            )
          }

          const resDef = recipeToCook.result || {}
          resultItemData = {
            itemId: resDef.itemId || 'comida_preparada',
            name: resDef.name || recipeToCook.name || 'Refeição Preparada',
            icon: resDef.icon || recipeToCook.icon || '🍲',
            quantity: Math.max(1, Number(resDef.quantity) || 1),
            rarity: resDef.rarity || 'uncommon',
            category: resDef.category || 'supplies',
            consumable: resDef.consumable !== undefined ? resDef.consumable : true,
            consumeEffect: resDef.consumeEffect || { hunger: 40, blood: 15 },
            description: resDef.description || recipeToCook.description || 'Comida quente e nutritiva preparada na cozinha.',
            obtainedFrom: 'Cozinha / Culinária'
          }

          currentInv = addItemToInventory(currentInv, resultItemData)

          transaction.update(userRef, {
            'character.inventory': currentInv,
            'character.lastCookedAt': new Date().toISOString(),
            'character.lastCookingSessionId': sessionId || null
          })
        } else {
          // FALHA: Se configurado perda, consome os itens resolvidos; caso contrário preserva
          if (ingredientLossOnFailure) {
            lostIngredients = true
            for (const itemSlot of resolved) {
              const qty = Math.max(1, Number(itemSlot.quantity) || 1)
              currentInv = consumeItemFromInventory(
                currentInv,
                itemSlot.matchedItem.itemId,
                qty,
                itemSlot.matchedItem.name
              )
            }

            transaction.update(userRef, {
              'character.inventory': currentInv,
              'character.lastCookingSessionId': sessionId || null
            })
          }
        }
      })

      if (refreshCharacter) await refreshCharacter()

      if (success) {
        setCookedItemResult(resultItemData)
        setPhase('result')
      } else {
        setFailureInfo({
          lostIngredients,
          message: lostIngredients
            ? 'Você não conseguiu atingir o ponto de cozimento a tempo. Os ingredientes foram desperdiçados.'
            : 'Você não conseguiu atingir o ponto de cozimento a tempo, mas os ingredientes foram preservados na sua mochila.'
        })
        setPhase('failure')
      }
    } catch (err) {
      console.error('Erro ao cozinhar:', err)
      setActionError(err.message || 'Erro ao processar o cozimento.')
      setPhase('error')
    } finally {
      setIsProcessing(false)
      setActiveSession(null)
    }
  }

  function handleReset() {
    setPhase('idle')
    setCookingProgress(0)
    setCookedItemResult(null)
    setActiveSession(null)
    setFailureInfo({ lostIngredients: false, message: '' })
    setActionError('')
    setIsProcessing(false)
  }

  function handleCancelMinigame() {
    handleReset()
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
          maxWidth: '820px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '16px',
          border: '1px solid rgba(251, 191, 36, 0.3)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.9), 0 0 30px rgba(245, 158, 11, 0.15)',
          overflow: 'hidden',
          background: 'linear-gradient(180deg, rgba(26, 20, 16, 0.95) 0%, rgba(15, 12, 10, 0.98) 100%)'
        }}
      >
        {/* CABEÇALHO */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(251, 191, 36, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(245, 158, 11, 0.08)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '28px' }}>🍳</span>
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: '18px',
                  fontWeight: 800,
                  fontFamily: 'Oswald, sans-serif',
                  letterSpacing: '1px',
                  color: '#fbbf24',
                  textTransform: 'uppercase'
                }}
              >
                Cozinha & Preparo de Alimentos
              </h2>
              <p style={{ margin: 0, fontSize: '11px', color: '#d1d5db' }}>
                Combine ingredientes e use seus utensílios para preparar refeições nutritivas.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (phase === 'minigame') handleCancelMinigame()
              onClose()
            }}
            disabled={isProcessing}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#9ca3af',
              fontSize: '20px',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              padding: '4px 8px',
              borderRadius: '6px'
            }}
          >
            ✕
          </button>
        </div>

        {/* CORPO DO MODAL */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* FASE: MINIGAME DE COZINHA */}
          {phase === 'minigame' && selectedRecipe && (
            <CookingMinigame
              recipe={selectedRecipe}
              session={activeSession}
              onFinish={handleMinigameOutcome}
              onCancel={handleCancelMinigame}
            />
          )}

          {/* FASE DE FALHA NO MINIGAME */}
          {phase === 'failure' && (
            <div
              style={{
                padding: '30px 20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                gap: '16px',
                background: failureInfo.lostIngredients ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                border: failureInfo.lostIngredients ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(59, 130, 246, 0.4)',
                borderRadius: '12px'
              }}
            >
              <div style={{ fontSize: '44px' }}>
                {failureInfo.lostIngredients ? '🔥' : '🍲'}
              </div>

              <div>
                <h3 style={{ margin: '0 0 6px', fontSize: '18px', color: failureInfo.lostIngredients ? '#f87171' : '#93c5fd', fontFamily: 'Oswald, sans-serif' }}>
                  {failureInfo.lostIngredients ? 'Preparo Falhou — Ingredientes Perdidos' : 'Preparo Falhou — Ingredientes Preservados'}
                </h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#e5e7eb', maxWidth: '440px', lineHeight: 1.5 }}>
                  {failureInfo.message}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  className="btn btn-primary"
                  onClick={handleReset}
                  style={{
                    background: '#f59e0b',
                    borderColor: '#f59e0b',
                    color: '#000',
                    fontWeight: 700,
                    padding: '8px 20px',
                    fontSize: '13px'
                  }}
                >
                  🔄 Tentar Novamente
                </button>
                <button
                  className="btn"
                  onClick={onClose}
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    padding: '8px 16px',
                    fontSize: '13px'
                  }}
                >
                  Fechar Cozinha
                </button>
              </div>
            </div>
          )}

          {/* FASE DE ERRO INESPERADO */}
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
              <strong style={{ display: 'block', fontSize: '14px', marginBottom: '4px' }}>Erro de Processamento</strong>
              <p style={{ margin: 0, fontSize: '12px' }}>{actionError || 'Ocorreu um erro ao tentar processar o cozimento.'}</p>
              <button
                className="btn btn-primary"
                onClick={handleReset}
                style={{ marginTop: '14px', padding: '6px 16px', fontSize: '12px' }}
              >
                Voltar à Cozinha
              </button>
            </div>
          )}

          {/* FASE DE ANIMAÇÃO DE COZIMENTO DIRETO (quando receita sem minigame) */}
          {phase === 'cooking' && (
            <div
              style={{
                padding: '40px 20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                gap: '20px'
              }}
            >
              <div style={{ position: 'relative', width: '120px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div
                  style={{
                    position: 'absolute',
                    fontSize: '44px',
                    filter: 'drop-shadow(0 0 15px rgba(245, 158, 11, 0.8))',
                    animation: 'pulse 1.2s infinite alternate'
                  }}
                >
                  🔥
                </div>
                <div
                  style={{
                    fontSize: '64px',
                    zIndex: 2,
                    animation: 'bounce 0.8s infinite alternate'
                  }}
                >
                  🍳
                </div>
                <div
                  style={{
                    position: 'absolute',
                    top: '-10px',
                    display: 'flex',
                    gap: '10px',
                    fontSize: '22px',
                    opacity: 0.9
                  }}
                >
                  {(selectedRecipe?.ingredients || []).map((ing, idx) => (
                    <span key={idx} style={{ animation: `bounce ${0.6 + idx * 0.2}s infinite alternate` }}>
                      {ing.icon || '🧂'}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h3 style={{ margin: '0 0 6px', fontSize: '18px', color: '#fbbf24', fontFamily: 'Oswald, sans-serif' }}>
                  Cozinhando {selectedRecipe?.name}...
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>
                  Fervendo e combinando os ingredientes na panela quente.
                </p>
              </div>

              <div style={{ width: '100%', maxWidth: '360px' }}>
                <div
                  style={{
                    height: '10px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '5px',
                    overflow: 'hidden',
                    border: '1px solid rgba(251, 191, 36, 0.3)'
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${cookingProgress}%`,
                      background: 'linear-gradient(90deg, #f59e0b, #ef4444)',
                      transition: 'width 0.1s linear',
                      boxShadow: '0 0 10px rgba(245, 158, 11, 0.6)'
                    }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#fbbf24', marginTop: '4px' }}>
                  <span>Preparo em andamento</span>
                  <span>{Math.round(cookingProgress)}%</span>
                </div>
              </div>
            </div>
          )}

          {/* FASE DE RESULTADO / PRATO PRONTO (SUCESSO) */}
          {phase === 'result' && cookedItemResult && (
            <div
              style={{
                padding: '30px 20px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                gap: '16px',
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '12px'
              }}
            >
              <div style={{ fontSize: '14px', textTransform: 'uppercase', color: '#34d399', fontWeight: 700, letterSpacing: '1px' }}>
                ✨ Prato Pronto com Sucesso! ✨
              </div>

              <div
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '16px',
                  background: 'rgba(0, 0, 0, 0.5)',
                  border: `2px solid ${RARITY_META[cookedItemResult.rarity]?.color || '#34d399'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '44px',
                  boxShadow: `0 0 20px ${RARITY_META[cookedItemResult.rarity]?.color || '#34d399'}44`
                }}
              >
                {cookedItemResult.icon || '🍲'}
              </div>

              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: '20px', color: '#fff', fontFamily: 'Oswald, sans-serif' }}>
                  {cookedItemResult.quantity > 1 ? `${cookedItemResult.quantity}x ` : ''}{cookedItemResult.name}
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af', maxWidth: '400px' }}>
                  {cookedItemResult.description}
                </p>
              </div>

              {cookedItemResult.consumeEffect && (
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  {Boolean(cookedItemResult.consumeEffect.hunger) && (
                    <div style={{ padding: '4px 10px', background: 'rgba(245, 158, 11, 0.2)', border: '1px solid #f59e0b', borderRadius: '6px', fontSize: '11px', color: '#fbbf24', fontWeight: 600 }}>
                      🍖 +{cookedItemResult.consumeEffect.hunger} Fome
                    </div>
                  )}
                  {Boolean(cookedItemResult.consumeEffect.thirst) && (
                    <div style={{ padding: '4px 10px', background: 'rgba(56, 189, 248, 0.2)', border: '1px solid #38bdf8', borderRadius: '6px', fontSize: '11px', color: '#7dd3fc', fontWeight: 600 }}>
                      💧 +{cookedItemResult.consumeEffect.thirst} Sede
                    </div>
                  )}
                  {Boolean(cookedItemResult.consumeEffect.blood) && (
                    <div style={{ padding: '4px 10px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', borderRadius: '6px', fontSize: '11px', color: '#fca5a5', fontWeight: 600 }}>
                      🩸 +{cookedItemResult.consumeEffect.blood} HP / Sangue
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  className="btn btn-primary"
                  onClick={handleReset}
                  style={{
                    background: '#10b981',
                    borderColor: '#10b981',
                    color: '#000',
                    fontWeight: 700,
                    padding: '8px 20px',
                    fontSize: '13px'
                  }}
                >
                  🍳 Cozinhar Outra Refeição
                </button>
                <button
                  className="btn"
                  onClick={onClose}
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    padding: '8px 16px',
                    fontSize: '13px'
                  }}
                >
                  Fechar
                </button>
              </div>
            </div>
          )}

          {/* FASE IDLE: SELEÇÃO DE RECEITAS DISPONÍVEIS */}
          {phase === 'idle' && (
            <>
              {loadingRecipes ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                  ⏳ Carregando livro de receitas...
                </div>
              ) : availableRecipes.length === 0 ? (
                <div
                  style={{
                    padding: '40px 24px',
                    textAlign: 'center',
                    background: 'rgba(0, 0, 0, 0.4)',
                    borderRadius: '12px',
                    border: '1px dashed rgba(245, 158, 11, 0.3)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '12px'
                  }}
                >
                  <span style={{ fontSize: '48px', opacity: 0.8 }}>🍳</span>
                  <h3 style={{ margin: 0, fontSize: '16px', color: '#fbbf24', textTransform: 'uppercase', fontFamily: 'Oswald, sans-serif' }}>
                    Nenhuma Receita Disponível
                  </h3>
                  <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af', maxWidth: '440px', lineHeight: 1.5 }}>
                    Você não possui os ingredientes necessários (ou variações compatíveis) ou o utensílio culinário equipado para cozinhar no momento.
                  </p>
                  <div
                    style={{
                      background: 'rgba(245, 158, 11, 0.08)',
                      border: '1px solid rgba(245, 158, 11, 0.2)',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      fontSize: '11px',
                      color: '#fef08a',
                      textAlign: 'left',
                      maxWidth: '420px',
                      marginTop: '8px'
                    }}
                  >
                    <strong>💡 Dicas para Cozinhar:</strong>
                    <ul style={{ margin: '6px 0 0 0', paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <li>Equipe uma <strong>Panela de Ferro / Frigideira</strong> em seu slot de Acessório ou Mãos.</li>
                      <li>Receitas aceitam <strong>variações</strong> (ex: qualquer peixe pequeno, médio ou salmão serve para peixe grelhado).</li>
                      <li>Colete <strong>Ovos</strong> no Galinheiro ou pesque <strong>Peixes</strong> no Rio.</li>
                    </ul>
                  </div>
                </div>
              ) : (
                /* LISTAGEM DE RECEITAS DISPONÍVEIS & PAINEL DE PREPARO */
                <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '16px' }}>

                  {/* COLUNA ESQUERDA: LISTA DE RECEITAS QUE PODEM SER FEITAS */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>
                      Receitas Prontas para Cozinhar ({availableRecipes.length})
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
                      {availableRecipes.map(recipe => {
                        const isSelected = selectedRecipe?.id === recipe.id
                        return (
                          <div
                            key={recipe.id}
                            onClick={() => {
                              setSelectedRecipe(recipe)
                              setSelectedVariants({})
                            }}
                            style={{
                              padding: '12px 14px',
                              background: isSelected ? 'rgba(245, 158, 11, 0.2)' : 'rgba(0, 0, 0, 0.35)',
                              border: isSelected ? '1px solid #fbbf24' : '1px solid rgba(255, 255, 255, 0.08)',
                              borderRadius: '10px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              transition: 'all 0.2s ease',
                              boxShadow: isSelected ? '0 0 12px rgba(245, 158, 11, 0.25)' : 'none'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontSize: '24px' }}>{recipe.icon || '🍲'}</span>
                              <div>
                                <strong style={{ fontSize: '13px', color: isSelected ? '#fbbf24' : '#fff', display: 'block' }}>
                                  {recipe.name}
                                </strong>
                                <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                                  {(recipe.ingredients || []).map(i => {
                                    const altCount = (i.alternatives || []).length
                                    return `${i.quantity}x ${i.name || i.itemId}${altCount > 0 ? ` (+${altCount} var)` : ''}`
                                  }).join(' + ')}
                                </span>
                              </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                              <span style={{ fontSize: '11px', color: '#34d399', fontWeight: 700, background: 'rgba(16, 185, 129, 0.15)', padding: '3px 8px', borderRadius: '6px' }}>
                                ✓ Pronto
                              </span>
                              {recipe.minigame !== 'none' && (
                                <span style={{ fontSize: '9px', color: '#fbbf24', opacity: 0.8 }}>
                                  🔥 Minigame
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* COLUNA DIREITA: DETALHES DA RECEITA SELECIONADA E BOTÃO DE COZINHAR */}
                  {selectedRecipe && (
                    <div
                      style={{
                        padding: '16px',
                        background: 'rgba(0, 0, 0, 0.45)',
                        border: '1px solid rgba(251, 191, 36, 0.25)',
                        borderRadius: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '14px'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {/* TÍTULO E ÍCONE DO PRATO */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '32px' }}>{selectedRecipe.icon || '🍲'}</span>
                          <div>
                            <h3 style={{ margin: 0, fontSize: '16px', color: '#fbbf24', fontFamily: 'Oswald, sans-serif' }}>
                              {selectedRecipe.name}
                            </h3>
                            <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                              {selectedRecipe.description}
                            </span>
                          </div>
                        </div>

                        {/* INGREDIENTES NECESSÁRIOS COM SUPORTE A VARIAÇÕES */}
                        <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                          <div style={{ fontSize: '10px', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 700, marginBottom: '6px' }}>
                            Ingredientes Utilizados
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {(selectedRecipe.ingredients || []).map((ing, idx) => {
                              const match = resolveIngredientMatch(ing, inventory, selectedVariants[idx])
                              const hasAlternatives = (ing.alternatives || []).length > 0
                              const hasMultipleAvailable = match.availableVariants?.length > 1

                              return (
                                <div
                                  key={idx}
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '4px',
                                    padding: '6px 8px',
                                    background: 'rgba(255, 255, 255, 0.02)',
                                    borderRadius: '6px',
                                    border: '1px solid rgba(255, 255, 255, 0.04)'
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span>{match.matchedItem?.icon || ing.icon || '📦'}</span>
                                      <strong>{match.matchedItem?.name || ing.name || ing.itemId}</strong>
                                    </div>
                                    <span style={{ color: '#34d399', fontWeight: 600 }}>{ing.quantity}x</span>
                                  </div>

                                  {/* SELETOR DE VARIAÇÃO SE O JOGADOR TIVER MÚLTIPLAS OPÇÕES NO INVENTÁRIO */}
                                  {hasMultipleAvailable ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                      <span style={{ fontSize: '10px', color: '#fbbf24' }}>🔁 Escolher variação:</span>
                                      <select
                                        value={match.matchedItem?.itemId}
                                        onChange={(e) => setSelectedVariants(prev => ({ ...prev, [idx]: e.target.value }))}
                                        style={{
                                          fontSize: '11px',
                                          padding: '2px 6px',
                                          background: 'rgba(0, 0, 0, 0.5)',
                                          border: '1px solid #fbbf24',
                                          borderRadius: '4px',
                                          color: '#fbbf24',
                                          flex: 1
                                        }}
                                      >
                                        {match.availableVariants.map(v => (
                                          <option key={v.itemId} value={v.itemId}>
                                            Usar: {v.icon || '📦'} {v.name}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  ) : hasAlternatives ? (
                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                      💡 Aceita também: {ing.alternatives.map(a => a.name).join(', ')}
                                    </div>
                                  ) : null}
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        {/* UTENSÍLIO EXIGIDO */}
                        {selectedRecipe.requiredTool && (
                          <div style={{ background: 'rgba(245, 158, 11, 0.08)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
                            <span style={{ color: '#fbbf24' }}>🍳 Utensílio Equipado:</span>
                            <span style={{ color: '#34d399', fontWeight: 700 }}>✓ {selectedRecipe.requiredToolName || 'Panela / Frigideira'}</span>
                          </div>
                        )}

                        {/* RESULTADO ESPERADO / BENEFÍCIOS VITAIS */}
                        {selectedRecipe.result?.consumeEffect && (
                          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                            <div style={{ fontSize: '10px', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>
                              Efeito ao Consumir
                            </div>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              {Boolean(selectedRecipe.result.consumeEffect.hunger) && (
                                <span style={{ fontSize: '11px', color: '#fbbf24' }}>🍖 +{selectedRecipe.result.consumeEffect.hunger} Fome</span>
                              )}
                              {Boolean(selectedRecipe.result.consumeEffect.thirst) && (
                                <span style={{ fontSize: '11px', color: '#7dd3fc' }}>💧 +{selectedRecipe.result.consumeEffect.thirst} Sede</span>
                              )}
                              {Boolean(selectedRecipe.result.consumeEffect.blood) && (
                                <span style={{ fontSize: '11px', color: '#fca5a5' }}>🩸 +{selectedRecipe.result.consumeEffect.blood} HP</span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* TAG DE RISCO DE INGREDIENTES */}
                        {selectedRecipe.minigame !== 'none' && selectedRecipe.ingredientLossOnFailure && (
                          <div style={{ fontSize: '10px', color: '#fca5a5', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '4px 8px', borderRadius: '6px' }}>
                            ⚠️ Atenção: Se você falhar no ponto de cozimento, os ingredientes serão perdidos!
                          </div>
                        )}
                      </div>

                      {/* BOTÃO COZINHAR */}
                      <button
                        className="btn btn-primary"
                        onClick={handleStartCooking}
                        disabled={isProcessing}
                        style={{
                          width: '100%',
                          padding: '12px',
                          fontSize: '14px',
                          fontWeight: 800,
                          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                          border: 'none',
                          color: '#000',
                          textTransform: 'uppercase',
                          letterSpacing: '1px',
                          borderRadius: '8px',
                          boxShadow: '0 4px 15px rgba(245, 158, 11, 0.4)',
                          cursor: 'pointer'
                        }}
                      >
                        {selectedRecipe.minigame !== 'none'
                          ? `🔥 Iniciar Preparo (Minigame ${selectedRecipe.cookDurationSec || 6}s)`
                          : `🔥 Cozinhar Agora (${selectedRecipe.cookDurationSec || 4}s)`}
                      </button>
                    </div>
                  )}

                </div>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  )
}
