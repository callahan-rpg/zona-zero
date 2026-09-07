import { useState, useEffect, useRef } from 'react'
import { collection, onSnapshot, doc, runTransaction } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../contexts/AuthContext.jsx'
import { canCookRecipe, getAvailableRecipes, DEFAULT_RECIPES } from '../utils/cookingSystem'
import { consumeItemFromInventory, addItemToInventory } from '../utils/activitySystem'
import { RARITY_META } from '../utils/itemSystem'

export default function CookingModal({ locationSlug, onClose }) {
  const { user, character, refreshCharacter } = useAuth()

  const [recipes, setRecipes] = useState([])
  const [loadingRecipes, setLoadingRecipes] = useState(true)
  const [selectedRecipe, setSelectedRecipe] = useState(null)
  const [phase, setPhase] = useState('idle') // idle | cooking | result | error
  const [cookingProgress, setCookingProgress] = useState(0)
  const [cookedItemResult, setCookedItemResult] = useState(null)
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

  // Filtro Estrito: Apenas receitas que o jogador PODE cozinhar agora
  const availableRecipes = getAvailableRecipes(recipes, inventory)

  // Se a receita selecionada não estiver mais disponível, seleciona a primeira disponível ou null
  useEffect(() => {
    if (phase !== 'idle') return
    if (selectedRecipe) {
      const stillAvailable = availableRecipes.find(r => r.id === selectedRecipe.id)
      if (!stillAvailable) {
        setSelectedRecipe(availableRecipes[0] || null)
      }
    } else if (availableRecipes.length > 0) {
      setSelectedRecipe(availableRecipes[0])
    }
  }, [availableRecipes.length, phase])

  async function handleStartCooking() {
    if (!selectedRecipe || isProcessing || phase === 'cooking') return

    const check = canCookRecipe(selectedRecipe, character?.inventory || [])
    if (!check.ok) {
      setActionError(check.reason || 'Você não atende aos requisitos desta receita.')
      return
    }

    setActionError('')
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
        finalizeCooking(selectedRecipe)
      } else {
        setCookingProgress(current)
      }
    }, intervalMs)
  }

  async function finalizeCooking(recipeToCook) {
    if (!user?.uid || !recipeToCook) return

    try {
      let resultItemData = null

      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', user.uid)
        const userSnap = await transaction.get(userRef)
        if (!userSnap.exists()) throw new Error('Personagem não encontrado.')

        const charData = userSnap.data()?.character || {}
        let currentInv = [...(charData.inventory || [])]

        // 1. Valida se ainda pode cozinhar
        const check = canCookRecipe(recipeToCook, currentInv)
        if (!check.ok) {
          throw new Error(check.reason || 'Itens ou ferramentas insuficientes.')
        }

        // 2. Consome os ingredientes da receita do inventário
        const ingredients = recipeToCook.ingredients || []
        for (const ing of ingredients) {
          const qty = Math.max(1, Number(ing.quantity) || 1)
          currentInv = consumeItemFromInventory(currentInv, ing.itemId, qty, ing.name)
        }

        // 3. Monta o item resultante
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

        // 4. Adiciona o item pronto ao inventário
        currentInv = addItemToInventory(currentInv, resultItemData)

        // 5. Salva na ficha
        transaction.update(userRef, {
          'character.inventory': currentInv,
          'character.lastCookedAt': new Date().toISOString()
        })
      })

      if (refreshCharacter) await refreshCharacter()
      setCookedItemResult(resultItemData)
      setPhase('result')
    } catch (err) {
      console.error('Erro ao cozinhar:', err)
      setActionError(err.message || 'Erro ao processar o cozimento.')
      setPhase('error')
    } finally {
      setIsProcessing(false)
    }
  }

  function handleReset() {
    setPhase('idle')
    setCookingProgress(0)
    setCookedItemResult(null)
    setActionError('')
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
            onClick={onClose}
            disabled={phase === 'cooking'}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#9ca3af',
              fontSize: '20px',
              cursor: phase === 'cooking' ? 'not-allowed' : 'pointer',
              padding: '4px 8px',
              borderRadius: '6px'
            }}
          >
            ✕
          </button>
        </div>

        {/* CORPO DO MODAL */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>

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
              <strong style={{ display: 'block', fontSize: '14px', marginBottom: '4px' }}>Falha no Preparo</strong>
              <p style={{ margin: 0, fontSize: '12px' }}>{actionError || 'Ocorreu um erro ao tentar cozinhar o prato.'}</p>
              <button
                className="btn btn-primary"
                onClick={handleReset}
                style={{ marginTop: '14px', padding: '6px 16px', fontSize: '12px' }}
              >
                Voltar à Cozinha
              </button>
            </div>
          )}

          {/* FASE DE ANIMAÇÃO DE COZIMENTO */}
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
              {/* Panela e fogo animados */}
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
                {/* Ingredientes subindo/saindo vapor */}
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

              {/* BARRA DE PROGRESSO DE COZIMENTO */}
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

          {/* FASE DE RESULTADO / PRATO PRONTO */}
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

              {/* BENEFÍCIOS VITAIS DO PRATO */}
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
                /* ESTADO VAZIO: NENHUMA RECEITA DISPONÍVEL COM O INVENTÁRIO ATUAL */
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
                    Você não possui os ingredientes necessários ou o utensílio culinário equipado para cozinhar no momento.
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
                      <li>Colete <strong>Ovos</strong> no Galinheiro ou pesque <strong>Peixes</strong> no Rio.</li>
                      <li>Colha <strong>Tomates e Batatas</strong> em suas plantações ou busque mantimentos em residências.</li>
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
                            onClick={() => setSelectedRecipe(recipe)}
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
                                  {(recipe.ingredients || []).map(i => `${i.quantity}x ${i.name || i.itemId}`).join(' + ')}
                                </span>
                              </div>
                            </div>
                            <span style={{ fontSize: '11px', color: '#34d399', fontWeight: 700, background: 'rgba(16, 185, 129, 0.15)', padding: '3px 8px', borderRadius: '6px' }}>
                              ✓ Pronto
                            </span>
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

                        {/* INGREDIENTES NECESSÁRIOS */}
                        <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                          <div style={{ fontSize: '10px', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 700, marginBottom: '6px' }}>
                            Ingredientes Consumidos
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {(selectedRecipe.ingredients || []).map((ing, idx) => (
                              <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                                <span>{ing.icon || '📦'} {ing.name || ing.itemId}</span>
                                <span style={{ color: '#34d399', fontWeight: 600 }}>{ing.quantity}x</span>
                              </div>
                            ))}
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
                        🔥 Cozinhar Agora ({selectedRecipe.cookDurationSec || 4}s)
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
