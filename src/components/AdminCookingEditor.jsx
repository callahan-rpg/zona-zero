import { useState, useEffect } from 'react'
import { collection, onSnapshot, doc, runTransaction } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useItemCatalog } from '../utils/itemCatalogService'
import { DEFAULT_RECIPES, COOKING_UTENSILS } from '../utils/cookingSystem'
import { DEFAULT_PRESET_ITEMS, RARITY_META } from '../utils/itemSystem'

const EMPTY_RECIPE_FORM = {
  id: '',
  name: '',
  icon: '🍳',
  description: '',
  enabled: true,
  cookDurationSec: 4,
  requiredTool: 'panela_frigideira',
  requiredToolName: 'Panela ou Frigideira de Ferro',
  ingredients: [
    { itemId: '', name: '', icon: '📦', quantity: 1 }
  ],
  result: {
    itemId: '',
    name: '',
    icon: '🍲',
    quantity: 1,
    rarity: 'uncommon',
    category: 'supplies',
    consumable: true,
    consumeEffect: { hunger: 40, thirst: 0, blood: 10 },
    description: ''
  }
}

export default function AdminCookingEditor({ catalogItems = [] }) {
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingRecipeId, setEditingRecipeId] = useState(null)
  const [form, setForm] = useState(EMPTY_RECIPE_FORM)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // Usa o listener único compartilhado de items_db (cache global)
  const { list: itemsDbLive } = useItemCatalog()

  // Escuta catálogo de receitas
  useEffect(() => {
    const unsubRecipes = onSnapshot(collection(db, 'recipes'), (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setRecipes(docs)
      setLoading(false)
    }, (err) => {
      console.error('Erro ao carregar receitas:', err)
      setLoading(false)
    })
    return unsubRecipes
  }, [])

  // Lista unificada e filtrada EXCLUSIVAMENTE de itens da categoria "Mantimentos" (supplies)
  const supplyItems = (() => {
    const map = new Map()

    // 1. Presets padrão com categoria supplies / mantimentos
    DEFAULT_PRESET_ITEMS.filter(i => {
      const cat = String(i.category || '').toLowerCase().trim()
      return cat === 'supplies' || cat === 'mantimentos'
    }).forEach(i => {
      map.set(i.itemId, { ...i, itemId: i.itemId })
    })

    // 2. Itens cadastrados no Firestore (catalogItems / itemsDbLive) com categoria supplies / mantimentos
    const pool = itemsDbLive.length > 0 ? itemsDbLive : (catalogItems || [])
    pool.filter(i => {
      const cat = String(i.category || '').toLowerCase().trim()
      return cat === 'supplies' || cat === 'mantimentos'
    }).forEach(i => {
      const id = i.itemId || i.id
      map.set(id, { ...i, itemId: id })
    })

    const list = Array.from(map.values())
    list.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    return list
  })()

  function handleStartEdit(recipe) {
    setEditingRecipeId(recipe.id)
    setForm({
      id: recipe.id,
      name: recipe.name || '',
      icon: recipe.icon || '🍳',
      description: recipe.description || '',
      enabled: recipe.enabled !== false,
      cookDurationSec: recipe.cookDurationSec || 4,
      requiredTool: recipe.requiredTool || '',
      requiredToolName: recipe.requiredToolName || '',
      ingredients: (recipe.ingredients || []).map(ing => ({
        itemId: ing.itemId || '',
        name: ing.name || '',
        icon: ing.icon || '📦',
        quantity: Math.max(1, Number(ing.quantity) || 1)
      })),
      result: {
        itemId: recipe.result?.itemId || '',
        name: recipe.result?.name || '',
        icon: recipe.result?.icon || '🍲',
        quantity: Math.max(1, Number(recipe.result?.quantity) || 1),
        rarity: recipe.result?.rarity || 'uncommon',
        category: recipe.result?.category || 'supplies',
        consumable: recipe.result?.consumable !== undefined ? recipe.result.consumable : true,
        consumeEffect: {
          hunger: Number(recipe.result?.consumeEffect?.hunger) || 0,
          thirst: Number(recipe.result?.consumeEffect?.thirst) || 0,
          blood: Number(recipe.result?.consumeEffect?.blood) || 0
        },
        description: recipe.result?.description || ''
      }
    })
  }

  function handleCancelEdit() {
    setEditingRecipeId(null)
    setForm(EMPTY_RECIPE_FORM)
  }

  function handleAddIngredientRow() {
    setForm(prev => ({
      ...prev,
      ingredients: [
        ...prev.ingredients,
        { itemId: '', name: '', icon: '📦', quantity: 1 }
      ]
    }))
  }

  function handleRemoveIngredientRow(index) {
    setForm(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index)
    }))
  }

  function handleIngredientChange(index, itemId) {
    const found = supplyItems.find(i => (i.itemId || i.id) === itemId)
    setForm(prev => {
      const updated = [...prev.ingredients]
      updated[index] = {
        ...updated[index],
        itemId,
        name: found?.name || itemId,
        icon: found?.icon || '📦'
      }
      return { ...prev, ingredients: updated }
    })
  }

  function handleIngredientQtyChange(index, quantity) {
    setForm(prev => {
      const updated = [...prev.ingredients]
      updated[index] = {
        ...updated[index],
        quantity: Math.max(1, Number(quantity) || 1)
      }
      return { ...prev, ingredients: updated }
    })
  }

  function handleResultItemSelect(itemId) {
    const found = supplyItems.find(i => (i.itemId || i.id) === itemId)
    if (!found) return

    setForm(prev => ({
      ...prev,
      result: {
        ...prev.result,
        itemId: found.itemId || found.id,
        name: found.name || prev.result.name,
        icon: found.icon || prev.result.icon,
        rarity: found.rarity || prev.result.rarity,
        category: found.category || 'supplies',
        consumable: found.consumable !== undefined ? found.consumable : true,
        consumeEffect: {
          hunger: found.consumeEffect?.hunger ?? prev.result.consumeEffect.hunger,
          thirst: found.consumeEffect?.thirst ?? prev.result.consumeEffect.thirst,
          blood: found.consumeEffect?.blood ?? prev.result.consumeEffect.blood,
        },
        description: found.description || prev.result.description
      }
    }))
  }

  async function handleSaveRecipe(e) {
    e.preventDefault()
    if (!form.name.trim()) return alert('Informe o nome da receita.')
    if (form.ingredients.length === 0 || form.ingredients.some(i => !i.itemId)) {
      return alert('Selecione todos os itens dos ingredientes.')
    }
    if (!form.result.itemId && !form.result.name) {
      return alert('Configure o prato resultante.')
    }

    const recipeId = form.id.trim() || `rec_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`

    const payload = {
      id: recipeId,
      name: form.name.trim(),
      icon: form.icon || '🍲',
      description: form.description.trim(),
      enabled: !!form.enabled,
      cookDurationSec: Math.max(1, Number(form.cookDurationSec) || 4),
      requiredTool: form.requiredTool || '',
      requiredToolName: COOKING_UTENSILS.find(u => u.id === form.requiredTool)?.label || (form.requiredTool ? form.requiredTool : ''),
      ingredients: form.ingredients.map(ing => ({
        itemId: ing.itemId,
        name: ing.name || ing.itemId,
        icon: ing.icon || '📦',
        quantity: Math.max(1, Number(ing.quantity) || 1)
      })),
      result: {
        itemId: form.result.itemId || 'prato_preparado',
        name: form.result.name || form.name,
        icon: form.result.icon || form.icon || '🍲',
        quantity: Math.max(1, Number(form.result.quantity) || 1),
        rarity: form.result.rarity || 'uncommon',
        category: 'supplies',
        consumable: !!form.result.consumable,
        consumeEffect: {
          hunger: Number(form.result.consumeEffect?.hunger) || 0,
          thirst: Number(form.result.consumeEffect?.thirst) || 0,
          blood: Number(form.result.consumeEffect?.blood) || 0
        },
        description: form.result.description || form.description || ''
      },
      updatedAt: new Date().toISOString()
    }

    try {
      setSaving(true)
      await setDoc(doc(db, 'recipes', recipeId), payload, { merge: true })
      alert(`Receita "${payload.name}" salva com sucesso!`)
      handleCancelEdit()
    } catch (err) {
      alert('Erro ao salvar receita: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteRecipe(recipeId, recipeName) {
    if (!confirm(`Deseja realmente excluir a receita "${recipeName || recipeId}"?`)) return
    try {
      await deleteDoc(doc(db, 'recipes', recipeId))
      alert('Receita excluída.')
      if (editingRecipeId === recipeId) handleCancelEdit()
    } catch (err) {
      alert('Erro ao excluir: ' + err.message)
    }
  }

  async function handleToggleRecipe(recipe) {
    try {
      await updateDoc(doc(db, 'recipes', recipe.id), {
        enabled: recipe.enabled === false ? true : false
      })
    } catch (err) {
      alert('Erro ao alternar status: ' + err.message)
    }
  }

  async function handleSeedDefaultRecipes() {
    if (!confirm('Deseja criar as Receitas Culinárias Padrão no banco de dados agora?')) return
    try {
      setSaving(true)
      let count = 0
      for (const recipe of DEFAULT_RECIPES) {
        await setDoc(doc(db, 'recipes', recipe.id), {
          ...recipe,
          updatedAt: new Date().toISOString()
        }, { merge: true })
        count++
      }
      alert(`Sucesso! ${count} receitas padrão foram cadastradas e ativadas!`)
    } catch (err) {
      alert('Erro ao semear receitas: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const filteredRecipes = recipes.filter(r => {
    if (!searchTerm) return true
    const q = searchTerm.toLowerCase()
    return (
      (r.name || '').toLowerCase().includes(q) ||
      (r.description || '').toLowerCase().includes(q) ||
      (r.id || '').toLowerCase().includes(q)
    )
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* CABEÇALHO & BARRA DE AÇÕES */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ fontSize: '18px', textTransform: 'uppercase', color: '#fbbf24', margin: 0, fontFamily: 'Oswald, sans-serif' }}>
            🍳 Gerenciador de Cozinha & Receitas
          </h3>
          <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)' }}>
            Cadastre combinações de ingredientes existentes, utensílios exigidos e pratos resultantes.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={handleSeedDefaultRecipes}
            disabled={saving}
            style={{
              background: 'rgba(245, 158, 11, 0.15)',
              borderColor: '#f59e0b',
              color: '#facc15',
              fontWeight: 700,
              fontSize: '11px',
              padding: '6px 12px'
            }}
          >
            ⚡ Criar Receitas Padrão (1-Click)
          </button>
        </div>
      </div>

      {/* GRID PRINCIPAL: LISTAGEM À ESQUERDA, FORMULÁRIO À DIREITA */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>

        {/* COLUNA ESQUERDA: LISTA DE RECEITAS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase' }}>
              Receitas Cadastradas ({filteredRecipes.length})
            </span>
            <input
              type="text"
              placeholder="Filtrar receitas..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ padding: '4px 8px', fontSize: '11px', width: '160px' }}
            />
          </div>

          {loading ? (
            <div className="glass-light" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
              ⏳ Carregando receitas...
            </div>
          ) : filteredRecipes.length === 0 ? (
            <div className="glass-light" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Nenhuma receita cadastrada. Clique no botão <strong>"Criar Receitas Padrão"</strong> acima para começar!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '650px', overflowY: 'auto' }}>
              {filteredRecipes.map(recipe => {
                const isEditing = editingRecipeId === recipe.id
                const isEnabled = recipe.enabled !== false
                return (
                  <div
                    key={recipe.id}
                    className="glass-light"
                    style={{
                      padding: '14px',
                      borderRadius: '10px',
                      border: isEditing ? '1px solid #fbbf24' : isEnabled ? '1px solid rgba(255,255,255,0.08)' : '1px dashed rgba(239,68,68,0.3)',
                      background: isEditing ? 'rgba(245, 158, 11, 0.12)' : isEnabled ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.15)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '24px' }}>{recipe.icon || '🍲'}</span>
                        <div>
                          <strong style={{ fontSize: '14px', color: isEnabled ? '#fff' : 'var(--text-muted)' }}>
                            {recipe.name}
                          </strong>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                            ⏱️ {recipe.cookDurationSec || 4}s • 🍳 {recipe.requiredToolName || (recipe.requiredTool ? recipe.requiredTool : 'Sem ferramenta específica')}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => handleToggleRecipe(recipe)}
                          style={{
                            padding: '3px 8px',
                            fontSize: '10px',
                            background: isEnabled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                            borderColor: isEnabled ? '#10b981' : '#ef4444',
                            color: isEnabled ? '#34d399' : '#fca5a5'
                          }}
                        >
                          {isEnabled ? '✓ Ativa' : '✕ Inativa'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={() => handleStartEdit(recipe)}
                          style={{ padding: '3px 8px', fontSize: '10px' }}
                        >
                          ✏️ Editar
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDeleteRecipe(recipe.id, recipe.name)}
                          style={{ padding: '3px 6px', fontSize: '10px' }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    {/* INGREDIENTES E RESULTADO */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', background: 'rgba(255,255,255,0.02)', padding: '6px 10px', borderRadius: '6px' }}>
                      <div style={{ flex: 1, display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                        {(recipe.ingredients || []).map((ing, idx) => (
                          <span key={idx} style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px', color: '#e5e7eb' }}>
                            {ing.quantity}x {ing.icon || ''} {ing.name || ing.itemId}
                          </span>
                        ))}
                      </div>
                      <span style={{ color: '#fbbf24', fontWeight: 700 }}>➔</span>
                      <div style={{ color: '#34d399', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>{recipe.result?.icon || '🍲'}</span>
                        <span>{recipe.result?.name || recipe.name}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* COLUNA DIREITA: FORMULÁRIO DE CADASTRO / EDIÇÃO */}
        <form
          onSubmit={handleSaveRecipe}
          className="glass-light"
          style={{
            padding: '18px',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            height: 'fit-content'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ fontSize: '13px', textTransform: 'uppercase', color: '#fbbf24', margin: 0 }}>
              {editingRecipeId ? '✏️ Editar Receita' : '➕ Nova Receita de Culinária'}
            </h4>
            {editingRecipeId && (
              <button
                type="button"
                className="btn btn-sm"
                onClick={handleCancelEdit}
                style={{ fontSize: '10px', padding: '2px 8px' }}
              >
                Cancelar Edição
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: '8px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '10px' }}>Ícone</label>
              <input
                type="text"
                value={form.icon}
                onChange={e => setForm(prev => ({ ...prev, icon: e.target.value }))}
                style={{ textAlign: 'center' }}
                required
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '10px' }}>Nome da Receita</label>
              <input
                type="text"
                placeholder="Ex: Bacon com Ovos"
                value={form.name}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '10px' }}>Descrição Narrativa</label>
            <textarea
              rows="2"
              placeholder="Descreva o prato, aroma e método de preparo..."
              value={form.description}
              onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
              style={{ width: '100%', padding: '8px', fontSize: '11px' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '10px' }}>Utensílio Exigido (Equipado)</label>
              <select
                value={form.requiredTool}
                onChange={e => {
                  const val = e.target.value
                  const toolObj = COOKING_UTENSILS.find(u => u.id === val)
                  setForm(prev => ({
                    ...prev,
                    requiredTool: val,
                    requiredToolName: toolObj?.label || (val ? val : '')
                  }))
                }}
              >
                {COOKING_UTENSILS.map(u => (
                  <option key={u.id} value={u.id}>{u.icon} {u.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '10px' }}>Tempo de Cozimento (Segundos)</label>
              <input
                type="number"
                min="1"
                max="60"
                value={form.cookDurationSec}
                onChange={e => setForm(prev => ({ ...prev, cookDurationSec: Math.max(1, Number(e.target.value) || 1) }))}
                required
              />
            </div>
          </div>

          {/* SEÇÃO: INGREDIENTES NECESSÁRIOS */}
          <div style={{ padding: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#fbbf24', margin: 0 }}>
                🥩 Ingredientes Exigidos ({form.ingredients.length})
              </label>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={handleAddIngredientRow}
                style={{ fontSize: '10px', padding: '2px 8px' }}
              >
                ➕ Add Ingrediente
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {form.ingredients.map((ing, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 30px', gap: '6px', alignItems: 'center' }}>
                    <select
                    value={ing.itemId}
                    onChange={e => handleIngredientChange(idx, e.target.value)}
                    style={{ fontSize: '11px', padding: '4px 6px' }}
                    required
                  >
                    <option value="">Selecione o mantimento...</option>
                    {supplyItems.map(it => (
                      <option key={it.itemId || it.id} value={it.itemId || it.id}>
                        {it.icon || '🌾'} {it.name || it.itemId || it.id}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min="1"
                    placeholder="Qtd"
                    value={ing.quantity}
                    onChange={e => handleIngredientQtyChange(idx, e.target.value)}
                    style={{ fontSize: '11px', padding: '4px 6px', textAlign: 'center' }}
                    required
                  />

                  {form.ingredients.length > 1 ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => handleRemoveIngredientRow(idx)}
                      style={{ padding: '2px 6px', fontSize: '10px' }}
                    >
                      ✕
                    </button>
                  ) : <span />}
                </div>
              ))}
            </div>
          </div>

          {/* SEÇÃO: PRATO RESULTANTE */}
          <div style={{ padding: '10px', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#34d399', margin: 0 }}>
              🍲 Prato Resultante (Recompensa)
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '10px' }}>Item Base (Tabela de Mantimentos)</label>
                <select
                  value={form.result.itemId}
                  onChange={e => handleResultItemSelect(e.target.value)}
                  style={{ fontSize: '11px' }}
                >
                  <option value="">Selecionar da Tabela de Mantimentos...</option>
                  {supplyItems.map(it => (
                    <option key={it.itemId || it.id} value={it.itemId || it.id}>
                      {it.icon || '🍲'} {it.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '10px' }}>Qtd Produzida</label>
                <input
                  type="number"
                  min="1"
                  value={form.result.quantity}
                  onChange={e => setForm(prev => ({ ...prev, result: { ...prev.result, quantity: Math.max(1, Number(e.target.value) || 1) } }))}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '9px' }}>+ Fome</label>
                <input
                  type="number"
                  value={form.result.consumeEffect.hunger}
                  onChange={e => setForm(prev => ({ ...prev, result: { ...prev.result, consumeEffect: { ...prev.result.consumeEffect, hunger: Number(e.target.value) || 0 } } }))}
                  style={{ fontSize: '11px', textAlign: 'center' }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '9px' }}>+ Sede</label>
                <input
                  type="number"
                  value={form.result.consumeEffect.thirst}
                  onChange={e => setForm(prev => ({ ...prev, result: { ...prev.result, consumeEffect: { ...prev.result.consumeEffect, thirst: Number(e.target.value) || 0 } } }))}
                  style={{ fontSize: '11px', textAlign: 'center' }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '9px' }}>+ HP / Sangue</label>
                <input
                  type="number"
                  value={form.result.consumeEffect.blood}
                  onChange={e => setForm(prev => ({ ...prev, result: { ...prev.result, consumeEffect: { ...prev.result.consumeEffect, blood: Number(e.target.value) || 0 } } }))}
                  style={{ fontSize: '11px', textAlign: 'center' }}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              id="recipeEnabled"
              checked={form.enabled}
              onChange={e => setForm(prev => ({ ...prev, enabled: e.target.checked }))}
              style={{ width: 'auto' }}
            />
            <label htmlFor="recipeEnabled" style={{ margin: 0, fontSize: '11px', cursor: 'pointer' }}>
              Receita ativa e disponível para preparo pelos sobreviventes
            </label>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
            style={{
              padding: '10px',
              fontSize: '13px',
              fontWeight: 700,
              background: '#f59e0b',
              borderColor: '#f59e0b',
              color: '#000'
            }}
          >
            {saving ? '⏳ Salvando...' : editingRecipeId ? '💾 Atualizar Receita' : '➕ Cadastrar Receita'}
          </button>
        </form>
      </div>
    </div>
  )
}
