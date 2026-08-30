import { useState, useEffect, useMemo } from 'react'
import { doc, onSnapshot, runTransaction } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../contexts/AuthContext.jsx'
import { RARITY_META } from '../utils/itemSystem.js'
import GameIcon from './GameIcon.jsx'

export default function ShopModal({
  isOpen,
  onClose,
  locationSlug,
  locationName = 'Loja Local',
  catalogItems = []
}) {
  const { user, character, refreshCharacter } = useAuth()

  const [shopData, setShopData] = useState(null)
  const [loadingShop, setLoadingShop] = useState(true)
  const [activeTab, setActiveTab] = useState('buy') // buy | sell

  // Carrinho de Compras do Jogador (temporário na sessão desta loja)
  // Estrutura: [{ itemId, quantity, buyPrice, name, icon, imageUrl, rarity }]
  const [cart, setCart] = useState([])
  const [buyQuantities, setBuyQuantities] = useState({}) // { [itemId]: number }

  // Estados da Aba Vender
  const [sellQuantities, setSellQuantities] = useState({}) // { [instanceId]: number }
  const [sellingTargetId, setSellingTargetId] = useState(null)

  // Feedback e Loading de transação
  const [transactionLoading, setTransactionLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Modal de confirmação para saída com itens no carrinho
  const [showExitConfirm, setShowExitConfirm] = useState(false)

  // Escuta os dados da loja no Firestore em tempo real (estoque compartilhado)
  useEffect(() => {
    if (!isOpen || !locationSlug) return
    setLoadingShop(true)
    setErrorMsg('')
    setSuccessMsg('')

    const unsub = onSnapshot(doc(db, 'shops', locationSlug), (snap) => {
      if (snap.exists()) {
        setShopData({ id: snap.id, ...snap.data() })
      } else {
        setShopData(null)
      }
      setLoadingShop(false)
    }, (err) => {
      console.warn('Erro ao escutar dados da loja:', err)
      setLoadingShop(false)
    })

    return () => unsub()
  }, [isOpen, locationSlug])

  // Dicionário rápido do catálogo
  const catalogMap = useMemo(() => {
    const map = {}
    catalogItems.forEach(it => {
      map[it.itemId] = it
    })
    return map
  }, [catalogItems])

  // Saldo atual de Novos Rublos do Jogador
  const playerRublos = Number(character?.rublos || 0)

  // Cálculo do total do carrinho
  const cartTotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + (item.buyPrice * item.quantity), 0)
  }, [cart])

  const balanceAfterPurchase = playerRublos - cartTotal
  const hasEnoughFunds = balanceAfterPurchase >= 0

  // ==========================================
  // CONTROLE DE SAÍDA DA LOJA COM CARRINHO CHEIO
  // ==========================================
  function handleAttemptClose() {
    if (cart.length > 0) {
      setShowExitConfirm(true)
    } else {
      onClose?.()
    }
  }

  function handleDiscardCartAndExit() {
    setCart([])
    setShowExitConfirm(false)
    onClose?.()
  }

  // ==========================================
  // AÇÕES DO CARRINHO (COMPRA)
  // ==========================================
  function handleAddToCart(saleItem) {
    setErrorMsg('')
    setSuccessMsg('')
    const catItem = catalogMap[saleItem.itemId] || {}
    const requestedQty = Math.max(1, buyQuantities[saleItem.itemId] || 1)
    const currentStock = saleItem.stock || 0

    if (currentStock <= 0) {
      setErrorMsg('Item esgotado no estoque da loja.')
      return
    }

    const existingInCart = cart.find(c => c.itemId === saleItem.itemId)
    const currentCartQty = existingInCart ? existingInCart.quantity : 0
    const totalDesired = currentCartQty + requestedQty

    if (totalDesired > currentStock) {
      setErrorMsg(`Estoque insuficiente! Você já tem ${currentCartQty} no carrinho e o estoque máximo é de ${currentStock} unidade(s).`)
      return
    }

    if (existingInCart) {
      setCart(prev => prev.map(c => c.itemId === saleItem.itemId ? { ...c, quantity: totalDesired } : c))
    } else {
      setCart(prev => [
        ...prev,
        {
          itemId: saleItem.itemId,
          buyPrice: saleItem.buyPrice,
          quantity: requestedQty,
          name: catItem.name || saleItem.itemId,
          icon: catItem.icon || '📦',
          imageUrl: catItem.imageUrl || '',
          rarity: catItem.rarity || 'common',
          category: catItem.category || 'general',
          consumable: catItem.consumable || false,
          consumeEffect: catItem.consumeEffect || null,
          description: catItem.description || '',
          unlocks: catItem.unlocks || []
        }
      ])
    }

    // Reseta o seletor daquele item para 1
    setBuyQuantities(prev => ({ ...prev, [saleItem.itemId]: 1 }))
  }

  function handleUpdateCartQty(itemId, newQty) {
    const saleItem = shopData?.itemsForSale?.find(i => i.itemId === itemId)
    const maxStock = saleItem?.stock || 0

    if (newQty <= 0) {
      handleRemoveFromCart(itemId)
      return
    }
    if (newQty > maxStock) {
      setErrorMsg(`Quantidade máxima em estoque: ${maxStock}`)
      return
    }
    setErrorMsg('')
    setCart(prev => prev.map(c => c.itemId === itemId ? { ...c, quantity: newQty } : c))
  }

  function handleRemoveFromCart(itemId) {
    setCart(prev => prev.filter(c => c.itemId !== itemId))
  }

  // ==========================================
  // FINALIZAR COMPRA ATÔMICA
  // ==========================================
  async function handleFinalizePurchase() {
    if (!user || cart.length === 0) return
    setErrorMsg('')
    setSuccessMsg('')
    setTransactionLoading(true)

    const shopRef = doc(db, 'shops', locationSlug)
    const userRef = doc(db, 'users', user.uid)

    try {
      await runTransaction(db, async (transaction) => {
        const shopSnap = await transaction.get(shopRef)
        const userSnap = await transaction.get(userRef)

        if (!shopSnap.exists()) throw new Error('Loja não encontrada ou desativada.')
        if (!userSnap.exists()) throw new Error('Personagem não encontrado.')

        const currentShopData = shopSnap.data()
        const currentItemsForSale = [...(currentShopData.itemsForSale || [])]

        const currentUserData = userSnap.data()
        const currentChar = currentUserData.character || {}
        const currentRublos = Number(currentChar.rublos || 0)
        const currentInventory = [...(currentChar.inventory || [])]

        // 1. Recalcula o custo total e valida saldo do jogador
        let totalCost = 0
        for (const cartItem of cart) {
          const shopItem = currentItemsForSale.find(i => i.itemId === cartItem.itemId)
          if (!shopItem) {
            throw new Error(`O item "${cartItem.name}" não está mais disponível nesta loja.`)
          }
          if (cartItem.quantity > (shopItem.stock || 0)) {
            throw new Error(`Estoque insuficiente para "${cartItem.name}". Restam apenas ${shopItem.stock || 0} unidade(s).`)
          }
          totalCost += (shopItem.buyPrice * cartItem.quantity)
        }

        if (currentRublos < totalCost) {
          throw new Error(`Você não possui Novos Rublos suficientes. Custo total: ${totalCost}, seu saldo: ${currentRublos}.`)
        }

        // 2. Atualiza os estoques da loja
        const updatedItemsForSale = currentItemsForSale.map(shopItem => {
          const cartItem = cart.find(c => c.itemId === shopItem.itemId)
          if (cartItem) {
            return {
              ...shopItem,
              stock: Math.max(0, (shopItem.stock || 0) - cartItem.quantity)
            }
          }
          return shopItem
        })

        // 3. Adiciona itens comprados ao inventário do jogador (empilhando itens normais)
        for (const cartItem of cart) {
          const catItem = catalogMap[cartItem.itemId] || {}
          const existingInvItem = currentInventory.find(i => i.itemId === cartItem.itemId && !i.isQuestItem)

          if (existingInvItem) {
            existingInvItem.quantity = (existingInvItem.quantity || 1) + cartItem.quantity
          } else {
            currentInventory.push({
              instanceId: Math.random().toString(36).substring(2) + Date.now().toString(36),
              itemId: cartItem.itemId,
              name: catItem.name || cartItem.name,
              icon: catItem.icon || cartItem.icon || '📦',
              imageUrl: catItem.imageUrl || cartItem.imageUrl || '',
              rarity: catItem.rarity || cartItem.rarity || 'common',
              quantity: cartItem.quantity,
              category: catItem.category || cartItem.category || 'general',
              consumable: catItem.consumable !== undefined ? catItem.consumable : cartItem.consumable,
              consumeEffect: catItem.consumeEffect || cartItem.consumeEffect || null,
              description: catItem.description || cartItem.description || '',
              unlocks: catItem.unlocks || cartItem.unlocks || [],
              obtainedAt: new Date().toISOString(),
              obtainedFrom: `Loja (${shopData?.name || locationSlug})`
            })
          }
        }

        const nextRublos = currentRublos - totalCost

        // 4. Executa mutações atômicas no Firestore
        transaction.update(shopRef, {
          itemsForSale: updatedItemsForSale
        })

        transaction.update(userRef, {
          'character.rublos': nextRublos,
          'character.inventory': currentInventory
        })
      })

      setSuccessMsg('Compra concluída com sucesso! Os itens foram guardados na sua mochila.')
      setCart([])
      await refreshCharacter()
    } catch (err) {
      console.error('Erro na finalização da compra:', err)
      setErrorMsg(err.message || 'Erro ao processar transação.')
    } finally {
      setTransactionLoading(false)
    }
  }

  // ==========================================
  // VENDA ATÔMICA DE ITEM DO INVENTÁRIO
  // ==========================================
  async function handleSellItem(invItem, acceptedConfig) {
    if (!user || !invItem || !acceptedConfig) return
    setErrorMsg('')
    setSuccessMsg('')
    setSellingTargetId(invItem.instanceId)

    const qtyToSell = Math.max(1, Math.min(invItem.quantity || 1, Number(sellQuantities[invItem.instanceId] || 1)))
    const unitPrice = Number(acceptedConfig.sellPrice) || 0
    const totalEarned = unitPrice * qtyToSell

    const shopRef = doc(db, 'shops', locationSlug)
    const userRef = doc(db, 'users', user.uid)

    try {
      await runTransaction(db, async (transaction) => {
        const shopSnap = await transaction.get(shopRef)
        const userSnap = await transaction.get(userRef)

        if (!shopSnap.exists()) throw new Error('Loja não encontrada.')
        if (!userSnap.exists()) throw new Error('Personagem não encontrado.')

        const currentShopData = shopSnap.data()
        const currentItemsForSale = [...(currentShopData.itemsForSale || [])]

        const currentUserData = userSnap.data()
        const currentChar = currentUserData.character || {}
        const currentRublos = Number(currentChar.rublos || 0)
        const currentInventory = [...(currentChar.inventory || [])]

        // 1. Valida se o jogador tem o item e a quantidade
        const itemIdx = currentInventory.findIndex(i => i.instanceId === invItem.instanceId)
        if (itemIdx === -1) throw new Error('Item não encontrado no seu inventário.')

        const realInvItem = currentInventory[itemIdx]
        if ((realInvItem.quantity || 1) < qtyToSell) {
          throw new Error('Quantidade insuficiente no inventário para vender.')
        }

        // 2. Remove / reduz do inventário
        if ((realInvItem.quantity || 1) === qtyToSell) {
          currentInventory.splice(itemIdx, 1)
        } else {
          currentInventory[itemIdx] = {
            ...realInvItem,
            quantity: realInvItem.quantity - qtyToSell
          }
        }

        // 3. Incrementa o estoque da loja se o item estiver configurado para venda
        const updatedItemsForSale = currentItemsForSale.map(saleItem => {
          if (saleItem.itemId === invItem.itemId) {
            return {
              ...saleItem,
              stock: (saleItem.stock || 0) + qtyToSell
            }
          }
          return saleItem
        })

        const nextRublos = currentRublos + totalEarned

        // 4. Executa mutações atômicas
        transaction.update(shopRef, {
          itemsForSale: updatedItemsForSale
        })

        transaction.update(userRef, {
          'character.rublos': nextRublos,
          'character.inventory': currentInventory
        })
      })

      setSuccessMsg(`Você vendeu ${qtyToSell}x ${invItem.name} e recebeu +${totalEarned.toLocaleString('pt-BR')} Novos Rublos!`)
      setSellQuantities(prev => ({ ...prev, [invItem.instanceId]: 1 }))
      await refreshCharacter()
    } catch (err) {
      console.error('Erro na venda:', err)
      setErrorMsg(err.message || 'Erro ao processar venda.')
    } finally {
      setSellingTargetId(null)
    }
  }

  if (!isOpen) return null

  // Itens do inventário que esta loja aceita comprar
  const acceptedMap = (shopData?.itemsAccepted || []).reduce((acc, it) => {
    acc[it.itemId] = it
    return acc
  }, {})

  const sellableInventoryItems = (character?.inventory || []).filter(item => {
    return !!acceptedMap[item.itemId]
  })

  return (
    <div className="loot-modal-overlay" onClick={handleAttemptClose}>
      <div
        className="loot-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '900px',
          maxWidth: '96vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          textAlign: 'left',
          borderRadius: '16px',
          overflow: 'hidden',
          border: '1px solid rgba(234, 179, 8, 0.4)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.85), 0 0 20px rgba(234, 179, 8, 0.15)'
        }}
      >
        {/* HEADER DA LOJA */}
        <div
          style={{
            padding: '16px 22px',
            background: 'linear-gradient(90deg, rgba(234, 179, 8, 0.15) 0%, rgba(18, 20, 23, 0.95) 100%)',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 28 }}>🏪</span>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, color: '#facc15', fontFamily: 'Oswald', letterSpacing: 1, textTransform: 'uppercase' }}>
                {shopData?.name || `Loja de ${locationName}`}
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                {shopData?.description || 'Posto de trocas, compras e comércio de sobrevivência.'}
              </p>
            </div>
          </div>

          {/* Saldo de Novos Rublos do Jogador em destaque */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 14px',
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(234, 179, 8, 0.4)',
                borderRadius: '8px'
              }}
            >
              <span style={{ fontSize: 16 }}>💰</span>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Seus Novos Rublos</div>
                <strong style={{ fontSize: 14, color: '#facc15' }}>
                  {playerRublos.toLocaleString('pt-BR')}
                </strong>
              </div>
            </div>

            <button
              type="button"
              className="character-float-close"
              onClick={handleAttemptClose}
              title="Fechar loja"
              style={{ fontSize: 24, padding: '4px 8px' }}
            >
              ×
            </button>
          </div>
        </div>

        {/* FEEDBACK DE MENSAGENS */}
        {errorMsg && (
          <div style={{ padding: '8px 20px', background: 'rgba(239, 68, 68, 0.15)', borderBottom: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>⚠️ {errorMsg}</span>
            <button type="button" onClick={() => setErrorMsg('')} style={{ background: 'transparent', border: 'none', color: '#fca5a5', cursor: 'pointer' }}>×</button>
          </div>
        )}
        {successMsg && (
          <div style={{ padding: '8px 20px', background: 'rgba(34, 197, 94, 0.15)', borderBottom: '1px solid rgba(34, 197, 94, 0.3)', color: '#86efac', fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>✅ {successMsg}</span>
            <button type="button" onClick={() => setSuccessMsg('')} style={{ background: 'transparent', border: 'none', color: '#86efac', cursor: 'pointer' }}>×</button>
          </div>
        )}

        {/* NAVEGAÇÃO DE ABAS: COMPRAR | VENDER */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)' }}>
          <button
            type="button"
            onClick={() => setActiveTab('buy')}
            style={{
              flex: 1,
              padding: '12px',
              background: activeTab === 'buy' ? 'rgba(234, 179, 8, 0.1)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'buy' ? '2px solid #facc15' : '2px solid transparent',
              color: activeTab === 'buy' ? '#facc15' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.2s'
            }}
          >
            <span>🛒 COMPRAR ITENS</span>
            <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.08)', padding: '1px 6px', borderRadius: 10 }}>
              {shopData?.itemsForSale?.length || 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sell')}
            style={{
              flex: 1,
              padding: '12px',
              background: activeTab === 'sell' ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'sell' ? '2px solid #22c55e' : '2px solid transparent',
              color: activeTab === 'sell' ? '#4ade80' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.2s'
            }}
          >
            <span>💰 VENDER ITENS</span>
            <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.08)', padding: '1px 6px', borderRadius: 10 }}>
              {sellableInventoryItems.length}
            </span>
          </button>
        </div>

        {/* CORPO PRINCIPAL */}
        <div style={{ display: 'grid', gridTemplateColumns: activeTab === 'buy' ? '1fr 320px' : '1fr', flex: 1, overflowY: 'hidden', minHeight: '440px' }}>
          
          {/* ============================================================ */}
          {/* ABA 1: COMPRAR ITENS DA LOJA */}
          {/* ============================================================ */}
          {activeTab === 'buy' && (
            <div style={{ padding: '18px', overflowY: 'auto', maxHeight: '550px' }}>
              {loadingShop ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                  Carregando estoque da loja...
                </div>
              ) : !shopData || !shopData.enabled || (shopData.itemsForSale || []).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                  <span style={{ fontSize: 36, display: 'block', marginBottom: 10 }}>📦</span>
                  Esta loja não possui itens à venda no momento ou está temporariamente fechada.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                  {shopData.itemsForSale.map((saleItem) => {
                    const catItem = catalogMap[saleItem.itemId] || {}
                    const rMeta = RARITY_META[catItem?.rarity || 'common'] || RARITY_META.common
                    const isOutOfStock = (saleItem.stock || 0) <= 0
                    const qty = buyQuantities[saleItem.itemId] || 1

                    return (
                      <div
                        key={saleItem.itemId}
                        className="glass-light"
                        style={{
                          padding: '12px',
                          borderRadius: '10px',
                          borderLeft: `4px solid ${rMeta.color}`,
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          opacity: isOutOfStock ? 0.6 : 1,
                          position: 'relative'
                        }}
                      >
                        <div>
                          {/* Topo do Item */}
                          <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                            <div
                              style={{
                                width: 44,
                                height: 44,
                                borderRadius: 8,
                                background: 'rgba(0,0,0,0.4)',
                                border: `1px solid ${rMeta.border}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}
                            >
                              <GameIcon src={catItem.imageUrl} emoji={catItem.icon || '📦'} size={26} />
                            </div>

                            <div style={{ minWidth: 0, flex: 1 }}>
                              <h4 style={{ margin: 0, fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {catItem.name || saleItem.itemId}
                              </h4>
                              <span style={{ fontSize: 10, color: rMeta.color }}>
                                {rMeta.label}
                              </span>
                            </div>
                          </div>

                          {/* Descrição se houver */}
                          {catItem.description && (
                            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {catItem.description}
                            </p>
                          )}

                          {/* Preço e Estoque */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: '6px 8px', background: 'rgba(0,0,0,0.3)', borderRadius: 6 }}>
                            <div>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Preço:</div>
                              <strong style={{ fontSize: 13, color: '#facc15' }}>
                                💰 {Number(saleItem.buyPrice).toLocaleString('pt-BR')}
                              </strong>
                            </div>

                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Disponível:</div>
                              {isOutOfStock ? (
                                <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 'bold' }}>
                                  📦 Esgotado
                                </span>
                              ) : (
                                <span style={{ fontSize: 11, color: '#4ade80', fontWeight: 'bold' }}>
                                  📦 {saleItem.stock} unid.
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Controles de Compra */}
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {!isOutOfStock && (
                            <input
                              type="number"
                              min="1"
                              max={saleItem.stock}
                              value={qty}
                              onChange={(e) => {
                                const val = Math.max(1, Math.min(saleItem.stock, Number(e.target.value)))
                                setBuyQuantities(prev => ({ ...prev, [saleItem.itemId]: val }))
                              }}
                              style={{ width: '55px', padding: '6px', fontSize: 12, textAlign: 'center' }}
                            />
                          )}

                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            style={{
                              flex: 1,
                              padding: '6px 10px',
                              fontSize: 12,
                              background: isOutOfStock ? 'rgba(255,255,255,0.05)' : '#f59e0b',
                              borderColor: isOutOfStock ? 'var(--glass-border)' : '#fbbf24',
                              color: isOutOfStock ? 'var(--text-muted)' : '#000',
                              fontWeight: 700
                            }}
                            onClick={() => handleAddToCart(saleItem)}
                            disabled={isOutOfStock}
                          >
                            {isOutOfStock ? 'Sem Estoque' : '+ Carrinho'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* PAINEL LATERAL: CARRINHO DE COMPRAS */}
          {/* ============================================================ */}
          {activeTab === 'buy' && (
            <div
              style={{
                borderLeft: '1px solid var(--glass-border)',
                background: 'rgba(0,0,0,0.25)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '16px',
                overflowY: 'auto'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 8 }}>
                  <h4 style={{ margin: 0, fontSize: 13, textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>🛒</span> Seu Carrinho ({cart.length})
                  </h4>
                  {cart.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setCart([])}
                      style={{ background: 'transparent', border: 'none', color: 'var(--accent-red)', fontSize: 11, cursor: 'pointer' }}
                    >
                      Limpar
                    </button>
                  )}
                </div>

                {/* Lista de itens no carrinho */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '250px', overflowY: 'auto', paddingRight: 4 }}>
                  {cart.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)', fontSize: 12 }}>
                      <span style={{ fontSize: 24, display: 'block', marginBottom: 6 }}>🛒</span>
                      Seu carrinho está vazio. Adicione itens da loja para comprar.
                    </div>
                  ) : (
                    cart.map((cartItem) => {
                      const subtotal = cartItem.buyPrice * cartItem.quantity
                      return (
                        <div
                          key={cartItem.itemId}
                          style={{
                            padding: '8px 10px',
                            background: 'rgba(255,255,255,0.03)',
                            borderRadius: '8px',
                            border: '1px solid var(--glass-border)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                              <span>{cartItem.icon}</span>
                              <strong style={{ fontSize: 12, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {cartItem.name}
                              </strong>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveFromCart(cartItem.itemId)}
                              style={{ background: 'transparent', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', fontSize: 14 }}
                            >
                              ×
                            </button>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <button
                                type="button"
                                onClick={() => handleUpdateCartQty(cartItem.itemId, cartItem.quantity - 1)}
                                style={{ width: 20, height: 20, borderRadius: 4, background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', cursor: 'pointer' }}
                              >
                                -
                              </button>
                              <span style={{ fontWeight: 600, minWidth: 16, textAlign: 'center' }}>{cartItem.quantity}</span>
                              <button
                                type="button"
                                onClick={() => handleUpdateCartQty(cartItem.itemId, cartItem.quantity + 1)}
                                style={{ width: 20, height: 20, borderRadius: 4, background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', cursor: 'pointer' }}
                              >
                                +
                              </button>
                              <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>× {cartItem.buyPrice}</span>
                            </div>

                            <strong style={{ color: '#facc15' }}>
                              💰 {subtotal.toLocaleString('pt-BR')}
                            </strong>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {/* Resumo Financeiro & Finalização */}
              <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: 12, marginTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Subtotal / Total:</span>
                  <strong style={{ color: '#facc15', fontSize: 14 }}>
                    💰 {cartTotal.toLocaleString('pt-BR')} Rublos
                  </strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Seu saldo atual:</span>
                  <span>{playerRublos.toLocaleString('pt-BR')}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 12 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Saldo após compra:</span>
                  <strong style={{ color: balanceAfterPurchase < 0 ? '#ef4444' : '#5cff7a' }}>
                    {balanceAfterPurchase < 0 ? 'Saldo Insuficiente' : `${balanceAfterPurchase.toLocaleString('pt-BR')} Rublos`}
                  </strong>
                </div>

                <button
                  type="button"
                  className="btn btn-primary"
                  style={{
                    width: '100%',
                    padding: '10px',
                    fontSize: 13,
                    background: '#f59e0b',
                    borderColor: '#fbbf24',
                    color: '#000',
                    fontWeight: 700
                  }}
                  onClick={handleFinalizePurchase}
                  disabled={transactionLoading || cart.length === 0 || !hasEnoughFunds}
                >
                  {transactionLoading ? 'Processando...' : !hasEnoughFunds ? 'Saldo Insuficiente' : `Finalizar Compra (${cartTotal.toLocaleString('pt-BR')})`}
                </button>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* ABA 2: VENDER ITENS DO INVENTÁRIO */}
          {/* ============================================================ */}
          {activeTab === 'sell' && (
            <div style={{ padding: '20px', overflowY: 'auto', maxHeight: '550px' }}>
              <div style={{ marginBottom: 14 }}>
                <h4 style={{ margin: 0, fontSize: 14, color: '#4ade80' }}>
                  Itens aceitos por este estabelecimento
                </h4>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                  Aqui aparecem os itens da sua mochila que o comerciante tem interesse em comprar.
                </p>
              </div>

              {sellableInventoryItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                  <span style={{ fontSize: 36, display: 'block', marginBottom: 10 }}>🎒</span>
                  Você não possui nenhum item no seu inventário que esta loja compre no momento.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                  {sellableInventoryItems.map((invItem) => {
                    const acceptedConfig = acceptedMap[invItem.itemId]
                    const rMeta = RARITY_META[invItem.rarity || 'common'] || RARITY_META.common
                    const selectedQty = Math.max(1, Math.min(invItem.quantity || 1, Number(sellQuantities[invItem.instanceId] || 1)))
                    const totalPay = (acceptedConfig?.sellPrice || 0) * selectedQty
                    const isSellingThis = sellingTargetId === invItem.instanceId

                    return (
                      <div
                        key={invItem.instanceId}
                        className="glass-light"
                        style={{
                          padding: '14px',
                          borderRadius: '10px',
                          borderLeft: `4px solid ${rMeta.color}`,
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                            <div
                              style={{
                                width: 44,
                                height: 44,
                                borderRadius: 8,
                                background: 'rgba(0,0,0,0.4)',
                                border: `1px solid ${rMeta.border}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}
                            >
                              <GameIcon src={invItem.imageUrl} emoji={invItem.icon || '📦'} size={26} />
                            </div>

                            <div style={{ minWidth: 0, flex: 1 }}>
                              <h4 style={{ margin: 0, fontSize: 13, color: 'var(--text-primary)' }}>
                                {invItem.name}
                              </h4>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                Possui: <strong style={{ color: '#fff' }}>{invItem.quantity}</strong> unidade(s)
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: '6px 10px', background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.2)', borderRadius: 6 }}>
                            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Preço de Compra da Loja:</span>
                            <strong style={{ fontSize: 13, color: '#4ade80' }}>
                              💰 +{Number(acceptedConfig?.sellPrice || 0).toLocaleString('pt-BR')} cada
                            </strong>
                          </div>
                        </div>

                        {/* Controles de Venda */}
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input
                            type="number"
                            min="1"
                            max={invItem.quantity}
                            value={selectedQty}
                            onChange={(e) => {
                              const val = Math.max(1, Math.min(invItem.quantity || 1, Number(e.target.value)))
                              setSellQuantities(prev => ({ ...prev, [invItem.instanceId]: val }))
                            }}
                            style={{ width: '60px', padding: '8px', fontSize: 12, textAlign: 'center' }}
                          />

                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            style={{
                              flex: 1,
                              padding: '8px',
                              fontSize: 12,
                              background: '#22c55e',
                              borderColor: '#4ade80',
                              color: '#000',
                              fontWeight: 700
                            }}
                            onClick={() => handleSellItem(invItem, acceptedConfig)}
                            disabled={isSellingThis}
                          >
                            {isSellingThis ? 'Vendendo...' : `Vender por +${totalPay.toLocaleString('pt-BR')} Rublos`}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* MODAL DE CONFIRMAÇÃO DE SAÍDA COM ITENS NO CARRINHO */}
      {/* ============================================================ */}
      {showExitConfirm && (
        <div className="loot-modal-overlay" style={{ zIndex: 10000 }}>
          <div
            className="loot-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ width: '420px', textAlign: 'center', border: '1px solid var(--accent-yellow)' }}
          >
            <span style={{ fontSize: 32, display: 'block', marginBottom: 8 }}>⚠️</span>
            <h3 style={{ color: 'var(--accent-yellow)', marginBottom: 8 }}>
              Você ainda tem itens no carrinho
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.4 }}>
              Deseja voltar para a loja e finalizar sua compra ou prefere descartar os itens temporários do carrinho?
            </p>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn"
                style={{ flex: 1, borderColor: 'rgba(239, 68, 68, 0.5)', color: '#f87171' }}
                onClick={handleDiscardCartAndExit}
              >
                Descartar Carrinho
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1, background: '#f59e0b', borderColor: '#fbbf24', color: '#000', fontWeight: 700 }}
                onClick={() => setShowExitConfirm(false)}
              >
                Voltar à Loja
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
