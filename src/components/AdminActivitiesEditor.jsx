import { useState, useEffect } from 'react'
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  updateDoc
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { ACTIVITY_TYPES } from '../utils/activitySystem'
import { DEFAULT_PRESET_ITEMS } from '../utils/itemSystem'

const DEFAULT_FISH_TABLE = [
  { itemId: 'peixe_pequeno', name: 'Peixe Pequeno', icon: '🐟', chance: 40, rarity: 'common' },
  { itemId: 'peixe_medio',   name: 'Peixe Médio',   icon: '🐠', chance: 25, rarity: 'uncommon' },
  { itemId: 'peixe_grande',  name: 'Peixe Grande',  icon: '🐡', chance: 15, rarity: 'rare' },
]

const DEFAULT_SEEDS_CONFIG = [
  {
    seedItemId: 'semente_tomate',
    cropItemId: 'tomate',
    cropName: 'Tomate',
    cropIcon: '🍅',
    growthTimeValue: 3,
    growthTimeUnit: 'days',
    growthDays: 3,
    growthHours: 72,
    goodConditionMin: 3,
    goodConditionMax: 6,
    badConditionMin: 1,
    badConditionMax: 2,
    goodConditionThreshold: 70,
  },
  {
    seedItemId: 'semente_milho',
    cropItemId: 'milho',
    cropName: 'Milho',
    cropIcon: '🌽',
    growthTimeValue: 4,
    growthTimeUnit: 'days',
    growthDays: 4,
    growthHours: 96,
    goodConditionMin: 3,
    goodConditionMax: 6,
    badConditionMin: 1,
    badConditionMax: 2,
    goodConditionThreshold: 70,
  },
  {
    seedItemId: 'semente_batata',
    cropItemId: 'batata',
    cropName: 'Batata',
    cropIcon: '🥔',
    growthTimeValue: 3,
    growthTimeUnit: 'days',
    growthDays: 3,
    growthHours: 72,
    goodConditionMin: 3,
    goodConditionMax: 6,
    badConditionMin: 1,
    badConditionMax: 2,
    goodConditionThreshold: 70,
  },
]

function parseSeedGrowth(s) {
  let timeValue = 3
  let timeUnit = 'days'

  if (s.growthTimeUnit && (s.growthTimeValue !== undefined && s.growthTimeValue !== '')) {
    timeValue = Number(s.growthTimeValue) || 1
    timeUnit = s.growthTimeUnit === 'hours' ? 'hours' : 'days'
  } else if (s.growthHours !== undefined && s.growthHours !== null && s.growthHours !== '') {
    const hrs = Number(s.growthHours)
    if (hrs >= 24 && hrs % 24 === 0) {
      timeValue = hrs / 24
      timeUnit = 'days'
    } else {
      timeValue = hrs || 1
      timeUnit = 'hours'
    }
  } else if (s.growthDays !== undefined && s.growthDays !== null && s.growthDays !== '') {
    const days = Number(s.growthDays)
    if (days > 0 && days < 1) {
      timeValue = Math.round(days * 24) || 1
      timeUnit = 'hours'
    } else {
      timeValue = days || 1
      timeUnit = 'days'
    }
  } else if (s.growthMs) {
    const hrs = Math.round(s.growthMs / 3600000)
    if (hrs >= 24 && hrs % 24 === 0) {
      timeValue = hrs / 24
      timeUnit = 'days'
    } else {
      timeValue = hrs || 1
      timeUnit = 'hours'
    }
  }

  return { timeValue, timeUnit }
}

export default function AdminActivitiesEditor({ locations = [] }) {
  const [activities, setActivities] = useState([])
  const [catalogItems, setCatalogItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [feedback, setFeedback] = useState({ type: '', msg: '' })
  const [filterType, setFilterType] = useState('all')

  // Formulário de Cadastro/Edição
  const [form, setForm] = useState({
    id: '',
    name: '',
    type: 'fishing',
    icon: '🎣',
    locationSlug: '',
    enabled: true,
    durabilityCost: 10,
    allowedTools: 'vara_pesca',
    // Pesca
    durationMinutes: 10,
    cooldownMinutes: 30,
    emptyChance: 20,
    fishTable: DEFAULT_FISH_TABLE,
    // Plantação
    wormFindChancePlanting: 30,
    wormFindChanceCaring: 30,
    seedsConfig: DEFAULT_SEEDS_CONFIG,
    // Galinheiro
    totalAnimals: 10,
    requiredFoodQuantity: 2,
    description: '',
  })

  // Escuta atividades cadastradas
  useEffect(() => {
    const unsubActivities = onSnapshot(
      collection(db, 'activities'),
      (snap) => {
        setActivities(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        setLoading(false)
      },
      (err) => {
        console.warn('Erro ao escutar atividades no admin:', err)
        setLoading(false)
      }
    )

    // Escuta catálogo geral de itens para puxar a categoria "Mantimentos"
    const unsubCatalog = onSnapshot(
      collection(db, 'items_db'),
      (snap) => {
        setCatalogItems(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      },
      (err) => {
        console.warn('Erro ao carregar catálogo de itens:', err)
      }
    )

    return () => {
      unsubActivities()
      unsubCatalog()
    }
  }, [])

  // Lista unificada e filtrada de itens da categoria "Mantimentos" (supplies)
  const supplyItems = (() => {
    const map = new Map()

    // 1. Presets padrão com categoria supplies
    DEFAULT_PRESET_ITEMS.filter(i => {
      const cat = String(i.category || '').toLowerCase().trim()
      return cat === 'supplies' || cat === 'mantimentos'
    }).forEach(i => {
      map.set(i.itemId, {
        itemId: i.itemId,
        name: i.name,
        icon: i.icon || '🌾',
        rarity: i.rarity || 'common'
      })
    })

    // 2. Itens cadastrados no Firestore (items_db) com category supplies
    catalogItems.filter(i => {
      const cat = String(i.category || '').toLowerCase().trim()
      return cat === 'supplies' || cat === 'mantimentos'
    }).forEach(i => {
      const id = i.itemId || i.id
      map.set(id, {
        itemId: id,
        name: i.name || id,
        icon: i.icon || '🌾',
        rarity: i.rarity || 'common'
      })
    })

    const list = Array.from(map.values())
    list.sort((a, b) => a.name.localeCompare(b.name))
    return list
  })()

  function showMsg(type, msg) {
    setFeedback({ type, msg })
    setTimeout(() => setFeedback({ type: '', msg: '' }), 4500)
  }

  function handleSelect(act) {
    setSelectedId(act.id)

    // Allowed tools normalizado para string
    const toolsStr = Array.isArray(act.allowedTools)
      ? act.allowedTools.join(', ')
      : (act.requirements?.equipped?.map(e => e.itemId).join(', ') || (act.type === 'fishing' ? 'vara_pesca' : act.type === 'farming' ? 'enxada' : ''))

    // Seeds config normalizado para array
    let seeds = DEFAULT_SEEDS_CONFIG
    if (Array.isArray(act.seedsConfig) && act.seedsConfig.length > 0) {
      seeds = act.seedsConfig.map(s => {
        const parsed = parseSeedGrowth(s)
        return {
          seedItemId: s.seedItemId || '',
          cropItemId: s.cropItemId || '',
          cropName: s.cropName || '',
          cropIcon: s.cropIcon || '🌱',
          growthTimeValue: parsed.timeValue,
          growthTimeUnit: parsed.timeUnit,
          growthDays: parsed.timeUnit === 'days' ? parsed.timeValue : Number((parsed.timeValue / 24).toFixed(2)),
          growthHours: parsed.timeUnit === 'hours' ? parsed.timeValue : parsed.timeValue * 24,
          goodConditionMin: s.goodConditionYield?.min ?? s.goodConditionMin ?? 3,
          goodConditionMax: s.goodConditionYield?.max ?? s.goodConditionMax ?? 6,
          badConditionMin: s.badConditionYield?.min ?? s.badConditionMin ?? 1,
          badConditionMax: s.badConditionYield?.max ?? s.badConditionMax ?? 2,
          goodConditionThreshold: s.goodConditionThreshold ?? 70,
        }
      })
    } else if (act.seedsConfig && typeof act.seedsConfig === 'object') {
      seeds = Object.entries(act.seedsConfig).map(([k, v]) => {
        const parsed = parseSeedGrowth(v)
        return {
          seedItemId: k,
          cropItemId: v.cropItemId || k.replace('semente_', ''),
          cropName: v.cropName || v.name || 'Fruto',
          cropIcon: v.cropIcon || v.icon || '🌱',
          growthTimeValue: parsed.timeValue,
          growthTimeUnit: parsed.timeUnit,
          growthDays: parsed.timeUnit === 'days' ? parsed.timeValue : Number((parsed.timeValue / 24).toFixed(2)),
          growthHours: parsed.timeUnit === 'hours' ? parsed.timeValue : parsed.timeValue * 24,
          goodConditionMin: v.goodConditionYield?.min ?? v.harvestMin ?? 3,
          goodConditionMax: v.goodConditionYield?.max ?? v.harvestMax ?? 6,
          badConditionMin: v.badConditionYield?.min ?? 1,
          badConditionMax: v.badConditionYield?.max ?? 2,
          goodConditionThreshold: v.goodConditionThreshold ?? 70,
        }
      })
    }

    setForm({
      id: act.id,
      name: act.name || '',
      type: act.type || 'fishing',
      icon: act.icon || (act.type === 'farming' ? '🌱' : act.type === 'animal_care' ? '🐔' : '🎣'),
      locationSlug: act.locationSlug || '',
      enabled: act.enabled !== false,
      durabilityCost: act.durabilityCost !== undefined ? Number(act.durabilityCost) : 10,
      allowedTools: toolsStr,
      durationMinutes: Math.round((act.durationMs || 600000) / 60000),
      cooldownMinutes: Math.round((act.cooldownMs || 1800000) / 60000),
      emptyChance: act.emptyChance !== undefined ? Number(act.emptyChance) : 20,
      fishTable: (Array.isArray(act.fishTable) && act.fishTable.length > 0)
        ? act.fishTable
        : (Array.isArray(act.rewards) && act.rewards.length > 0
          ? act.rewards.map(r => ({ itemId: r.itemId, name: r.name, icon: r.icon, chance: r.chance ?? r.weight ?? 30, rarity: r.rarity || 'common' }))
          : DEFAULT_FISH_TABLE),
      wormFindChancePlanting: act.wormFindChancePlanting !== undefined ? Math.round(act.wormFindChancePlanting * 100) : 30,
      wormFindChanceCaring: act.wormFindChanceCaring !== undefined ? Math.round(act.wormFindChanceCaring * 100) : 30,
      seedsConfig: seeds,
      totalAnimals: act.totalAnimals || 10,
      requiredFoodQuantity: act.requiredFoodQuantity || 2,
      description: act.description || '',
    })
  }

  function handleReset() {
    setSelectedId(null)
    setForm({
      id: '',
      name: '',
      type: 'fishing',
      icon: '🎣',
      locationSlug: locations[0]?.slug || '',
      enabled: true,
      durabilityCost: 10,
      allowedTools: 'vara_pesca',
      durationMinutes: 10,
      cooldownMinutes: 30,
      emptyChance: 20,
      fishTable: DEFAULT_FISH_TABLE,
      wormFindChancePlanting: 30,
      wormFindChanceCaring: 30,
      seedsConfig: DEFAULT_SEEDS_CONFIG,
      totalAnimals: 10,
      requiredFoodQuantity: 2,
      description: '',
    })
  }

  // Modificadores da Tabela de Peixes (Pesca)
  function handleSelectFishItem(idx, selectedItemId) {
    const found = supplyItems.find(s => s.itemId === selectedItemId)
    const next = [...form.fishTable]
    if (found) {
      next[idx] = {
        ...next[idx],
        itemId: found.itemId,
        name: found.name,
        icon: found.icon || '🐟',
        rarity: found.rarity || 'common'
      }
    } else {
      next[idx] = { ...next[idx], itemId: selectedItemId }
    }
    setForm({ ...form, fishTable: next })
  }

  function handleFishChanceChange(idx, val) {
    const next = [...form.fishTable]
    next[idx] = { ...next[idx], chance: Number(val) || 0 }
    setForm({ ...form, fishTable: next })
  }

  function handleAddFish() {
    const firstOption = supplyItems[0] || { itemId: 'peixe_pequeno', name: 'Peixe Pequeno', icon: '🐟', rarity: 'common' }
    setForm({
      ...form,
      fishTable: [
        ...form.fishTable,
        {
          itemId: firstOption.itemId,
          name: firstOption.name,
          icon: firstOption.icon || '🐟',
          chance: 10,
          rarity: firstOption.rarity || 'common'
        }
      ]
    })
  }

  function handleRemoveFish(idx) {
    const next = form.fishTable.filter((_, i) => i !== idx)
    setForm({ ...form, fishTable: next })
  }

  // Modificadores das Sementes & Colheitas (Plantação)
  function handleSelectSeedItem(idx, selectedItemId) {
    const next = [...form.seedsConfig]
    next[idx] = { ...next[idx], seedItemId: selectedItemId }
    setForm({ ...form, seedsConfig: next })
  }

  function handleSelectCropItem(idx, selectedItemId) {
    const found = supplyItems.find(s => s.itemId === selectedItemId)
    const next = [...form.seedsConfig]
    if (found) {
      next[idx] = {
        ...next[idx],
        cropItemId: found.itemId,
        cropName: found.name,
        cropIcon: found.icon || '🌱',
      }
    } else {
      next[idx] = { ...next[idx], cropItemId: selectedItemId }
    }
    setForm({ ...form, seedsConfig: next })
  }

  function handleSeedFieldChange(idx, field, val) {
    const next = [...form.seedsConfig]
    next[idx] = { ...next[idx], [field]: val }
    setForm({ ...form, seedsConfig: next })
  }

  function handleAddSeed() {
    const defaultSeedItem = supplyItems.find(s => s.itemId.includes('semente')) || supplyItems[0] || { itemId: 'semente_tomate' }
    const defaultCropItem = supplyItems.find(s => !s.itemId.includes('semente')) || supplyItems[1] || { itemId: 'tomate', name: 'Tomate', icon: '🍅' }

    setForm({
      ...form,
      seedsConfig: [
        ...form.seedsConfig,
        {
          seedItemId: defaultSeedItem.itemId,
          cropItemId: defaultCropItem.itemId,
          cropName: defaultCropItem.name,
          cropIcon: defaultCropItem.icon || '🌱',
          growthTimeValue: 3,
          growthTimeUnit: 'days',
          growthDays: 3,
          growthHours: 72,
          goodConditionMin: 3,
          goodConditionMax: 6,
          badConditionMin: 1,
          badConditionMax: 2,
          goodConditionThreshold: 70,
        }
      ]
    })
  }

  function handleRemoveSeed(idx) {
    const next = form.seedsConfig.filter((_, i) => i !== idx)
    setForm({ ...form, seedsConfig: next })
  }

  async function handleSave(e) {
    e.preventDefault()
    const cleanId = (form.id || form.name).toLowerCase().trim().replace(/[^a-z0-9_]/g, '_')
    if (!cleanId) {
      showMsg('error', 'Informe um ID ou nome válido para a atividade.')
      return
    }

    const allowedToolsList = form.allowedTools
      ? form.allowedTools.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
      : []

    try {
      const docData = {
        id: cleanId,
        name: form.name || 'Nova Atividade',
        type: form.type,
        icon: form.icon || (form.type === 'farming' ? '🌱' : form.type === 'animal_care' ? '🐔' : '🎣'),
        locationSlug: form.locationSlug || '',
        enabled: Boolean(form.enabled),
        durabilityCost: Math.max(1, Number(form.durabilityCost) || 10),
        allowedTools: allowedToolsList,
        description: form.description || '',
        updatedAt: new Date().toISOString(),
      }

      if (form.type === 'fishing') {
        docData.durationMs = (Number(form.durationMinutes) || 10) * 60 * 1000
        docData.cooldownMs = (Number(form.cooldownMinutes) || 30) * 60 * 1000
        docData.emptyChance = Number(form.emptyChance) || 0
        docData.fishTable = form.fishTable.map(f => {
          const itemMeta = supplyItems.find(s => s.itemId === f.itemId)
          return {
            itemId: String(f.itemId || '').trim().toLowerCase(),
            name: itemMeta?.name || f.name || f.itemId,
            icon: itemMeta?.icon || f.icon || '🐟',
            chance: Number(f.chance) || 0,
            rarity: itemMeta?.rarity || f.rarity || 'common',
          }
        })
        docData.requirements = {
          equipped: allowedToolsList.map(t => ({ itemId: t, label: t, icon: '🎣' })),
          inventory: [{ itemId: 'minhoca', label: 'Minhoca', quantity: 1, icon: '🪱' }],
        }
      } else if (form.type === 'farming') {
        docData.wormFindChancePlanting = (Number(form.wormFindChancePlanting) || 30) / 100
        docData.wormFindChanceCaring = (Number(form.wormFindChanceCaring) || 30) / 100
        docData.seedsConfig = form.seedsConfig.map(s => {
          const cropMeta = supplyItems.find(i => i.itemId === s.cropItemId)
          const timeVal = Math.max(1, Number(s.growthTimeValue ?? s.growthDays) || 1)
          const timeUnit = s.growthTimeUnit === 'hours' ? 'hours' : 'days'
          const totalHours = timeUnit === 'hours' ? timeVal : timeVal * 24
          const totalMs = totalHours * 60 * 60 * 1000
          const growthDays = timeUnit === 'days' ? timeVal : Number((totalHours / 24).toFixed(2))

          return {
            seedItemId: String(s.seedItemId || '').trim().toLowerCase(),
            cropItemId: String(s.cropItemId || s.seedItemId.replace('semente_', '')).trim().toLowerCase(),
            cropName: cropMeta?.name || s.cropName || 'Colheita',
            cropIcon: cropMeta?.icon || s.cropIcon || '🌱',
            growthTimeValue: timeVal,
            growthTimeUnit: timeUnit,
            growthHours: totalHours,
            growthDays,
            growthMs: totalMs,
            goodConditionYield: {
              min: Number(s.goodConditionMin) || 3,
              max: Number(s.goodConditionMax) || 6,
            },
            badConditionYield: {
              min: Number(s.badConditionMin) || 1,
              max: Number(s.badConditionMax) || 2,
            },
            goodConditionThreshold: Number(s.goodConditionThreshold) || 70,
          }
        })
        docData.requirements = {
          equipped: allowedToolsList.map(t => ({ itemId: t, label: t, icon: '⛏️' })),
        }
      } else if (form.type === 'animal_care') {
        docData.totalAnimals = Number(form.totalAnimals) || 10
        docData.requiredFoodItemId = 'milho'
        docData.requiredFoodQuantity = Number(form.requiredFoodQuantity) || 2
      }

      await setDoc(doc(db, 'activities', cleanId), docData, { merge: true })
      showMsg('success', `Atividade "${docData.name}" salva com sucesso!`)
      if (!selectedId) handleReset()
    } catch (err) {
      console.error(err)
      showMsg('error', `Erro ao salvar: ${err.message}`)
    }
  }

  async function handleDelete(actId) {
    if (!window.confirm(`Tem certeza que deseja excluir a atividade "${actId}"?`)) return
    try {
      await deleteDoc(doc(db, 'activities', actId))
      showMsg('success', 'Atividade removida com sucesso.')
      if (selectedId === actId) handleReset()
    } catch (err) {
      console.error(err)
      showMsg('error', `Erro ao excluir: ${err.message}`)
    }
  }

  async function handleToggle(act) {
    try {
      await updateDoc(doc(db, 'activities', act.id), {
        enabled: !act.enabled
      })
      showMsg('success', `Atividade ${!act.enabled ? 'ativada' : 'desativada'}.`)
    } catch (err) {
      console.error(err)
      showMsg('error', `Erro ao alternar status: ${err.message}`)
    }
  }

  // Cria presets padrão com 1 clique
  async function handleCreatePresets() {
    if (!window.confirm('Deseja criar as atividades padrão (Pesca, Plantação e Galinheiro) vinculadas às primeiras locações?')) return
    const defaultLocationSlug = locations[0]?.slug || 'acampamento'
    
    const presets = [
      {
        id: 'pesca_lago',
        name: 'Pesca no Lago',
        type: 'fishing',
        icon: '🎣',
        locationSlug: defaultLocationSlug,
        enabled: true,
        durationMs: 10 * 60 * 1000,
        cooldownMs: 30 * 60 * 1000,
        durabilityCost: 10,
        allowedTools: ['vara_pesca'],
        emptyChance: 20,
        fishTable: DEFAULT_FISH_TABLE,
        requirements: {
          equipped: [{ itemId: 'vara_pesca', label: 'Vara de Pesca', icon: '🎣' }],
          inventory: [{ itemId: 'minhoca', label: 'Minhoca', quantity: 1, icon: '🪱' }],
        },
        description: 'Lago de águas calmas para pesca e sustento.',
      },
      {
        id: 'horta_comunitaria',
        name: 'Área de Plantação',
        type: 'farming',
        icon: '🌱',
        locationSlug: defaultLocationSlug,
        enabled: true,
        durabilityCost: 10,
        allowedTools: ['enxada'],
        wormFindChancePlanting: 0.30,
        wormFindChanceCaring: 0.30,
        seedsConfig: DEFAULT_SEEDS_CONFIG.map(s => ({
          ...s,
          growthMs: (s.growthTimeUnit === 'hours' ? s.growthTimeValue : s.growthDays * 24) * 60 * 60 * 1000,
          goodConditionYield: { min: s.goodConditionMin, max: s.goodConditionMax },
          badConditionYield: { min: s.badConditionMin, max: s.badConditionMax },
        })),
        requirements: {
          equipped: [{ itemId: 'enxada', label: 'Enxada', icon: '⛏️' }],
        },
        description: 'Terra fértil para plantio compartilhado de tomates, milho e batatas.',
      },
      {
        id: 'galinheiro_refugio',
        name: 'Galinheiro Comunitário',
        type: 'animal_care',
        icon: '🐔',
        locationSlug: defaultLocationSlug,
        enabled: true,
        totalAnimals: 10,
        requiredFoodItemId: 'milho',
        requiredFoodQuantity: 2,
        description: 'Viveiro de galinhas para produção de ovos e adubo orgânico.',
      }
    ]

    try {
      for (const p of presets) {
        await setDoc(doc(db, 'activities', p.id), p, { merge: true })
      }
      showMsg('success', '⚡ 3 Atividades padrão criadas com sucesso!')
    } catch (err) {
      console.error(err)
      showMsg('error', `Erro ao criar presets: ${err.message}`)
    }
  }

  const filteredActivities = activities.filter(a => {
    if (filterType !== 'all' && a.type !== filterType) return false
    return true
  })

  // Cálculo da soma de probabilidades de pesca
  const fishingTotalChance = form.type === 'fishing'
    ? (Number(form.emptyChance) || 0) + form.fishTable.reduce((acc, f) => acc + (Number(f.chance) || 0), 0)
    : 100

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '480px 1fr', gap: 20 }}>
      {/* Coluna Esquerda: Formulário de Cadastro/Edição */}
      <div style={{
        background: 'rgba(0,0,0,0.3)',
        borderRadius: 10,
        padding: 20,
        border: '1px solid rgba(255,255,255,0.1)',
        height: 'fit-content'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, color: '#4ade80', fontSize: 16 }}>
            {selectedId ? '✏️ Editar Atividade' : '➕ Nova Atividade'}
          </h3>
          {selectedId && (
            <button className="btn btn-sm" onClick={handleReset} style={{ fontSize: 11 }}>
              Limpar
            </button>
          )}
        </div>

        {feedback.msg && (
          <div style={{
            background: feedback.type === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(74,222,128,0.15)',
            border: `1px solid ${feedback.type === 'error' ? 'rgba(239,68,68,0.4)' : 'rgba(74,222,128,0.4)'}`,
            borderRadius: 6,
            padding: '8px 12px',
            marginBottom: 14,
            fontSize: 12,
            color: feedback.type === 'error' ? '#fca5a5' : '#86efac',
          }}>
            {feedback.msg}
          </div>
        )}

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* ID & Nome */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>ID Único</label>
              <input
                type="text"
                className="input-field"
                placeholder="ex: lago_pesca"
                value={form.id}
                onChange={e => setForm({ ...form, id: e.target.value })}
                disabled={!!selectedId}
                required
                style={{ width: '100%', fontSize: 12 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Nome de Exibição</label>
              <input
                type="text"
                className="input-field"
                placeholder="ex: Pescaria no Lago"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                required
                style={{ width: '100%', fontSize: 12 }}
              />
            </div>
          </div>

          {/* Tipo & Ícone */}
          <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 8 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Tipo de Atividade</label>
              <select
                className="input-field"
                value={form.type}
                onChange={e => {
                  const t = e.target.value
                  const defIcon = t === 'farming' ? '🌱' : t === 'animal_care' ? '🐔' : '🎣'
                  const defTool = t === 'farming' ? 'enxada' : t === 'fishing' ? 'vara_pesca' : ''
                  setForm({ ...form, type: t, icon: defIcon, allowedTools: defTool })
                }}
                style={{ width: '100%', fontSize: 12 }}
              >
                <option value="fishing">🎣 Pesca (Timer, Isca & Recompensas)</option>
                <option value="farming">🌱 Plantação & Horta (Canteiros & Enxada)</option>
                <option value="animal_care">🐔 Criação Animal (Galinheiro & Ovos)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Ícone</label>
              <input
                type="text"
                className="input-field"
                value={form.icon}
                onChange={e => setForm({ ...form, icon: e.target.value })}
                style={{ width: '100%', fontSize: 14, textAlign: 'center' }}
              />
            </div>
          </div>

          {/* Local Vinculado */}
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Locação Vinculada</label>
            <select
              className="input-field"
              value={form.locationSlug}
              onChange={e => setForm({ ...form, locationSlug: e.target.value })}
              style={{ width: '100%', fontSize: 12 }}
              required
            >
              <option value="">Selecione uma locação...</option>
              {locations.map(loc => (
                <option key={loc.slug} value={loc.slug}>
                  📍 {loc.name} ({loc.slug})
                </option>
              ))}
            </select>
          </div>

          {/* Configuração de Ferramentas & Durabilidade (Geral) */}
          {form.type !== 'animal_care' && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', marginBottom: 6 }}>⚙️ Ferramentas & Durabilidade</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 8 }}>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>
                    IDs das Ferramentas Permitidas (separadas por vírgula)
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="ex: vara_pesca, vara_reforcada"
                    value={form.allowedTools}
                    onChange={e => setForm({ ...form, allowedTools: e.target.value })}
                    style={{ width: '100%', fontSize: 12 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>
                    Custo Durabilidade
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="input-field"
                    value={form.durabilityCost}
                    onChange={e => setForm({ ...form, durabilityCost: e.target.value })}
                    style={{ width: '100%', fontSize: 12 }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Opções específicas de Pesca com Tabela de Itens (Mantimentos) */}
          {form.type === 'fishing' && (
            <div style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 6, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8' }}>🎣 Tabela de Peixes (Categoria Mantimentos 🌾)</div>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Máximo 1 por pesca</span>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Duração (Min)</label>
                  <input
                    type="number"
                    min="1"
                    className="input-field"
                    value={form.durationMinutes}
                    onChange={e => setForm({ ...form, durationMinutes: e.target.value })}
                    style={{ width: '100%', fontSize: 12 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Cooldown (Min)</label>
                  <input
                    type="number"
                    min="0"
                    className="input-field"
                    value={form.cooldownMinutes}
                    onChange={e => setForm({ ...form, cooldownMinutes: e.target.value })}
                    style={{ width: '100%', fontSize: 12 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Não Pescar Nada (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="input-field"
                    value={form.emptyChance}
                    onChange={e => setForm({ ...form, emptyChance: e.target.value })}
                    style={{ width: '100%', fontSize: 12 }}
                  />
                </div>
              </div>

              {/* Tabela de Peixes com Dropdown de Itens Mantimentos */}
              <div style={{ marginTop: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#e2e8f0' }}>Peixes da Tabela de Mantimentos</span>
                  <button type="button" className="btn btn-sm" onClick={handleAddFish} style={{ fontSize: 10, padding: '2px 8px', background: 'rgba(56,189,248,0.2)', borderColor: '#38bdf8', color: '#7dd3fc' }}>
                    + Adicionar Peixe
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {form.fishTable.map((fish, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 75px 28px', gap: 6, alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: 6, borderRadius: 6 }}>
                      {/* Seleção do Item de Mantimentos */}
                      <select
                        className="input-field"
                        value={fish.itemId}
                        onChange={e => handleSelectFishItem(idx, e.target.value)}
                        style={{ padding: '4px 8px', fontSize: 11 }}
                      >
                        <option value="">Selecione um item...</option>
                        {supplyItems.map(item => (
                          <option key={item.itemId} value={item.itemId}>
                            {item.icon} {item.name} ({item.itemId})
                          </option>
                        ))}
                      </select>

                      {/* Porcentagem de chance */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          className="input-field"
                          value={fish.chance}
                          onChange={e => handleFishChanceChange(idx, e.target.value)}
                          style={{ padding: '4px', fontSize: 11, textAlign: 'center', width: '100%' }}
                          title="Chance em %"
                        />
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>%</span>
                      </div>

                      {/* Remover */}
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={() => handleRemoveFish(idx)}
                        style={{ padding: '4px', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Remover peixe"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                {/* Banner de Validação de Soma de Probabilidades */}
                <div style={{
                  marginTop: 8,
                  padding: '6px 10px',
                  borderRadius: 6,
                  fontSize: 11,
                  background: fishingTotalChance === 100 ? 'rgba(74,222,128,0.1)' : 'rgba(234,179,8,0.15)',
                  border: `1px solid ${fishingTotalChance === 100 ? 'rgba(74,222,128,0.3)' : 'rgba(234,179,8,0.4)'}`,
                  color: fishingTotalChance === 100 ? '#86efac' : '#fde047'
                }}>
                  {fishingTotalChance === 100 ? (
                    <span>✓ Soma das chances: <strong>100%</strong> (Distribuição balanceada perfeita)</span>
                  ) : (
                    <span>⚠️ Soma total atual: <strong>{fishingTotalChance}%</strong> ({form.emptyChance}% Vazio + {fishingTotalChance - form.emptyChance}% Peixes). Ajuste a soma dos peixes + chance vazia para 100%.</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Opções específicas de Plantação com Seleção de Semente e Colheita */}
          {form.type === 'farming' && (
            <div style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 6, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#4ade80' }}>🌱 Sementes & Colheitas (Puxadas de Mantimentos 🌾)</div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Chance Minhocas ao Plantar (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="input-field"
                    value={form.wormFindChancePlanting}
                    onChange={e => setForm({ ...form, wormFindChancePlanting: e.target.value })}
                    style={{ width: '100%', fontSize: 12 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Chance Minhocas ao Cuidar (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="input-field"
                    value={form.wormFindChanceCaring}
                    onChange={e => setForm({ ...form, wormFindChanceCaring: e.target.value })}
                    style={{ width: '100%', fontSize: 12 }}
                  />
                </div>
              </div>

              {/* Sementes Configuráveis */}
              <div style={{ marginTop: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#e2e8f0' }}>Pares de Semente ➔ Colheita</span>
                  <button type="button" className="btn btn-sm" onClick={handleAddSeed} style={{ fontSize: 10, padding: '2px 8px', background: 'rgba(74,222,128,0.2)', borderColor: '#4ade80', color: '#86efac' }}>
                    + Adicionar Semente/Colheita
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {form.seedsConfig.map((seed, idx) => (
                    <div key={idx} style={{ background: 'rgba(0,0,0,0.25)', padding: 10, borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)' }}>
                      {/* Linha 1: Seletores de Semente e de Colheita */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 28px', gap: 6, alignItems: 'center', marginBottom: 8 }}>
                        {/* Seletor do Item Semente */}
                        <div>
                          <label style={{ fontSize: 9, color: '#94a3b8', display: 'block', marginBottom: 2, textTransform: 'uppercase', fontWeight: 600 }}>
                            🌱 Item Semente
                          </label>
                          <select
                            className="input-field"
                            value={seed.seedItemId}
                            onChange={e => handleSelectSeedItem(idx, e.target.value)}
                            style={{ width: '100%', padding: '4px 6px', fontSize: 11 }}
                          >
                            <option value="">Selecione a Semente...</option>
                            {supplyItems.map(item => (
                              <option key={item.itemId} value={item.itemId}>
                                {item.icon} {item.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Seletor do Item Colheita */}
                        <div>
                          <label style={{ fontSize: 9, color: '#86efac', display: 'block', marginBottom: 2, textTransform: 'uppercase', fontWeight: 600 }}>
                            🌾 Colheita Gerada
                          </label>
                          <select
                            className="input-field"
                            value={seed.cropItemId}
                            onChange={e => handleSelectCropItem(idx, e.target.value)}
                            style={{ width: '100%', padding: '4px 6px', fontSize: 11 }}
                          >
                            <option value="">Selecione o Fruto...</option>
                            {supplyItems.map(item => (
                              <option key={item.itemId} value={item.itemId}>
                                {item.icon} {item.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Remover */}
                        <div style={{ paddingTop: 14 }}>
                          <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            onClick={() => handleRemoveSeed(idx)}
                            style={{ padding: '4px', fontSize: 11, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title="Remover par"
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      {/* Linha 2: Tempo de crescimento (Horas / Dias) e Faixas de rendimento */}
                      <div style={{ display: 'grid', gridTemplateColumns: '125px 1fr 1fr', gap: 6, fontSize: 10 }}>
                        <div>
                          <label style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Tempo Cresc.</label>
                          <div style={{ display: 'flex', gap: 3 }}>
                            <input
                              type="number"
                              min="1"
                              className="input-field"
                              value={seed.growthTimeValue ?? seed.growthDays ?? 3}
                              onChange={e => handleSeedFieldChange(idx, 'growthTimeValue', e.target.value)}
                              style={{ width: '55%', padding: '3px 4px', fontSize: 11 }}
                              placeholder="1"
                            />
                            <select
                              className="input-field"
                              value={seed.growthTimeUnit || 'days'}
                              onChange={e => handleSeedFieldChange(idx, 'growthTimeUnit', e.target.value)}
                              style={{ width: '45%', padding: '3px 2px', fontSize: 10 }}
                            >
                              <option value="hours">Horas</option>
                              <option value="days">Dias</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label style={{ color: '#86efac', display: 'block', marginBottom: 2 }}>Bom (≥70% HP) Min-Max</label>
                          <div style={{ display: 'flex', gap: 3 }}>
                            <input
                              type="number"
                              min="1"
                              className="input-field"
                              value={seed.goodConditionMin}
                              onChange={e => handleSeedFieldChange(idx, 'goodConditionMin', e.target.value)}
                              style={{ width: '50%', padding: '3px 4px', fontSize: 11 }}
                              title="Qtd Mínima em boa condição"
                            />
                            <input
                              type="number"
                              min="1"
                              className="input-field"
                              value={seed.goodConditionMax}
                              onChange={e => handleSeedFieldChange(idx, 'goodConditionMax', e.target.value)}
                              style={{ width: '50%', padding: '3px 4px', fontSize: 11 }}
                              title="Qtd Máxima em boa condição"
                            />
                          </div>
                        </div>
                        <div>
                          <label style={{ color: '#fca5a5', display: 'block', marginBottom: 2 }}>Ruim (&lt;70% HP) Min-Max</label>
                          <div style={{ display: 'flex', gap: 3 }}>
                            <input
                              type="number"
                              min="1"
                              className="input-field"
                              value={seed.badConditionMin}
                              onChange={e => handleSeedFieldChange(idx, 'badConditionMin', e.target.value)}
                              style={{ width: '50%', padding: '3px 4px', fontSize: 11 }}
                              title="Qtd Mínima em má condição"
                            />
                            <input
                              type="number"
                              min="1"
                              className="input-field"
                              value={seed.badConditionMax}
                              onChange={e => handleSeedFieldChange(idx, 'badConditionMax', e.target.value)}
                              style={{ width: '50%', padding: '3px 4px', fontSize: 11 }}
                              title="Qtd Máxima em má condição"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Opções específicas de Galinheiro */}
          {form.type === 'animal_care' && (
            <div style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 6, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24' }}>⚙️ Configurações do Galinheiro</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Quantidade de Galinhas</label>
                  <input
                    type="number"
                    min="1"
                    className="input-field"
                    value={form.totalAnimals}
                    onChange={e => setForm({ ...form, totalAnimals: e.target.value })}
                    style={{ width: '100%', fontSize: 12 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Milho p/ Alimentar</label>
                  <input
                    type="number"
                    min="1"
                    className="input-field"
                    value={form.requiredFoodQuantity}
                    onChange={e => setForm({ ...form, requiredFoodQuantity: e.target.value })}
                    style={{ width: '100%', fontSize: 12 }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Status Ativo / Inativo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <input
              type="checkbox"
              id="act_enabled"
              checked={form.enabled}
              onChange={e => setForm({ ...form, enabled: e.target.checked })}
              style={{ cursor: 'pointer', width: 16, height: 16 }}
            />
            <label htmlFor="act_enabled" style={{ fontSize: 12, cursor: 'pointer', color: '#e2e8f0' }}>
              Atividade Ativa na Sala
            </label>
          </div>

          <button type="submit" className="btn btn-primary" style={{ marginTop: 8, padding: '10px' }}>
            💾 {selectedId ? 'Salvar Alterações' : 'Criar Atividade'}
          </button>
        </form>
      </div>

      {/* Coluna Direita: Lista de Atividades Cadastradas */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Atividades ({activities.length})</span>
            {/* Filtro por tipo */}
            <select
              className="input-field"
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              style={{ fontSize: 12, padding: '4px 8px' }}
            >
              <option value="all">Todos os tipos</option>
              <option value="fishing">🎣 Pesca</option>
              <option value="farming">🌱 Plantação</option>
              <option value="animal_care">🐔 Galinheiro</option>
            </select>
          </div>

          <button
            className="btn btn-sm"
            onClick={handleCreatePresets}
            style={{
              background: 'rgba(74,222,128,0.15)',
              borderColor: '#4ade80',
              color: '#86efac',
              fontSize: 12
            }}
          >
            ⚡ Criar Atividades Padrão (1-Clique)
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            Carregando atividades...
          </div>
        ) : filteredActivities.length === 0 ? (
          <div style={{
            padding: 40,
            textAlign: 'center',
            background: 'rgba(0,0,0,0.2)',
            borderRadius: 8,
            color: 'var(--text-muted)'
          }}>
            Nenhuma atividade cadastrada. Use o formulário ao lado ou clique em "Criar Atividades Padrão" acima.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filteredActivities.map(act => {
              const loc = locations.find(l => l.slug === act.locationSlug)
              const typeMeta = ACTIVITY_TYPES[act.type] || { label: act.type, icon: '⚙️' }

              return (
                <div
                  key={act.id}
                  style={{
                    background: selectedId === act.id ? 'rgba(74,222,128,0.08)' : 'rgba(0,0,0,0.25)',
                    border: `1px solid ${selectedId === act.id ? '#4ade80' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: 8,
                    padding: 14,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 26 }}>{act.icon || typeMeta.icon}</span>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <strong style={{ color: '#fff', fontSize: 14 }}>{act.name}</strong>
                        <span style={{
                          fontSize: 10,
                          background: act.enabled !== false ? 'rgba(74,222,128,0.2)' : 'rgba(239,68,68,0.2)',
                          color: act.enabled !== false ? '#4ade80' : '#f87171',
                          padding: '2px 6px',
                          borderRadius: 6,
                          fontWeight: 700
                        }}>
                          {act.enabled !== false ? 'ATIVA' : 'INATIVA'}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        Tipo: <strong style={{ color: '#e2e8f0' }}>{typeMeta.label}</strong> • Locação:{' '}
                        <span style={{ color: '#38bdf8' }}>{loc?.name || act.locationSlug || 'Não vinculada'}</span> • Desgaste:{' '}
                        <span style={{ color: '#fbbf24' }}>-{act.durabilityCost || 10} durabilidade</span>
                      </div>
                    </div>
                  </div>

                  {/* Ações */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="btn btn-sm"
                      onClick={() => handleToggle(act)}
                      style={{ fontSize: 11, padding: '4px 8px' }}
                      title={act.enabled ? 'Desativar' : 'Ativar'}
                    >
                      {act.enabled ? 'Desativar' : 'Ativar'}
                    </button>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => handleSelect(act)}
                      style={{ fontSize: 11, padding: '4px 8px' }}
                    >
                      ✏️ Editar
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDelete(act.id)}
                      style={{ fontSize: 11, padding: '4px 8px' }}
                    >
                      🗑️
                    </button>
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
