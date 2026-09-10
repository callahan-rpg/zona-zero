import { useState, useEffect } from 'react'
import { doc, getDocs, collection, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { DEFAULT_PRESET_ITEMS } from './itemSystem'
import { DEFAULT_BACKPACKS } from './weightSystem'

const LOCAL_STORAGE_KEY = 'zombie_rpg_item_catalog_cache_v1'

// Sanitiza item removendo data:image/ Base64 gigante se houver (para evitar estourar o limite de 1MB do Firestore)
function sanitizeItemForCatalog(item) {
  if (!item) return item
  const sanitized = { ...item }

  // Se imageUrl for Base64 gigante (> 2048 caracteres), não insere no documento único consolidado
  // (a imagem original ainda existirá no items_db individual caso necessário)
  if (sanitized.imageUrl && typeof sanitized.imageUrl === 'string' && sanitized.imageUrl.startsWith('data:image') && sanitized.imageUrl.length > 2048) {
    // Preserva apenas se for URL externa normal (http/https/blob)
    delete sanitized.imageUrl
  }

  return sanitized
}

// Cria o catálogo base a partir dos presets de código fonte (0 custo de rede)
function buildInitialCatalog() {
  const map = {}
  const list = []

  // 1. Presets padrão de código
  if (Array.isArray(DEFAULT_PRESET_ITEMS)) {
    for (const item of DEFAULT_PRESET_ITEMS) {
      if (item && item.itemId) {
        const entry = { ...item, id: item.itemId }
        map[item.itemId] = entry
        list.push(entry)
      }
    }
  }

  // 2. Mochilas padrão
  if (Array.isArray(DEFAULT_BACKPACKS)) {
    for (const bp of DEFAULT_BACKPACKS) {
      if (bp && bp.itemId) {
        const entry = { ...bp, id: bp.itemId }
        map[bp.itemId] = entry
        if (!list.some(i => i.itemId === bp.itemId)) {
          list.push(entry)
        }
      }
    }
  }

  // 3. Tenta sobrepor com o cache persistido no localStorage (se existir)
  try {
    const rawCache = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (rawCache) {
      const parsed = JSON.parse(rawCache)
      const cachedItems = Array.isArray(parsed) ? parsed : parsed.items
      if (Array.isArray(cachedItems)) {
        for (const item of cachedItems) {
          const key = item.itemId || item.id
          if (key) {
            map[key] = { ...(map[key] || {}), ...item, id: key }
          }
        }
        return { list: Object.values(map), map }
      }
    }
  } catch (err) {
    console.warn('Erro ao ler cache local do catálogo:', err)
  }

  return { list, map }
}

const initial = buildInitialCatalog()
let cachedCatalogList = initial.list
let cachedCatalogMap = initial.map
let activeUnsub = null
const subscribers = new Set()

function notifySubscribers() {
  subscribers.forEach((cb) => {
    try {
      cb({ list: cachedCatalogList, map: cachedCatalogMap })
    } catch (err) {
      console.error('Erro no subscriber do catálogo:', err)
    }
  })
}

/**
 * Inicia o listener de 1 ÚNICO documento consolidado (/game_config/items_catalog)
 * Custo Firestore: 1 única leitura por sessão!
 */
function startSharedCatalogListener() {
  if (activeUnsub) return

  activeUnsub = onSnapshot(doc(db, 'game_config', 'items_catalog'), (snap) => {
    if (snap.exists()) {
      const data = snap.data()
      const firestoreItems = data.items || []

      const map = {}
      if (Array.isArray(DEFAULT_PRESET_ITEMS)) {
        for (const p of DEFAULT_PRESET_ITEMS) {
          if (p && p.itemId) {
            map[p.itemId] = { ...p, id: p.itemId }
          }
        }
      }
      if (Array.isArray(DEFAULT_BACKPACKS)) {
        for (const bp of DEFAULT_BACKPACKS) {
          if (bp && bp.itemId) {
            map[bp.itemId] = { ...bp, id: bp.itemId }
          }
        }
      }

      if (Array.isArray(firestoreItems)) {
        for (const item of firestoreItems) {
          const key = item.itemId || item.id
          if (key) {
            map[key] = { ...(map[key] || {}), ...item, id: key }
          }
        }
      }

      const list = Object.values(map)
      cachedCatalogList = list
      cachedCatalogMap = map

      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({
          version: data.version || Date.now(),
          updatedAt: data.updatedAt || new Date().toISOString(),
          items: list
        }))
      } catch (err) {
        console.warn('Falha ao gravar cache no localStorage:', err)
      }

      notifySubscribers()
    }
  }, (err) => {
    console.warn('Aviso no listener consolidado de items_catalog:', err)
  })
}

/**
 * Salva o catálogo consolidado no documento único do Firestore com sanitização e medição de tamanho.
 */
export async function saveConsolidatedCatalog(itemsArray) {
  if (!Array.isArray(itemsArray)) return

  // 1. Sanitiza itens removendo Base64 gigantes para garantir que fique bem abaixo de 1 MB
  const sanitizedItems = itemsArray.map(sanitizeItemForCatalog)

  const payload = {
    version: Date.now(),
    updatedAt: new Date().toISOString(),
    itemCount: sanitizedItems.length,
    items: sanitizedItems
  }

  // Verifica o tamanho estimado antes de enviar
  const payloadJson = JSON.stringify(payload)
  const byteSize = new Blob([payloadJson]).size

  // Se mesmo sem Base64 passar de 900 KB, grava apenas os itens customizados (aqueles que não estão nos presets do código)
  if (byteSize > 900000) {
    console.warn(`Tamanho do catálogo (${byteSize} bytes) próximo do limite de 1MB. Compactando apenas itens customizados...`)
    const presetIds = new Set([
      ...DEFAULT_PRESET_ITEMS.map(i => i.itemId),
      ...DEFAULT_BACKPACKS.map(i => i.itemId)
    ])
    
    // Itens que foram criados no Firestore ou que diferem dos presets
    const customOnly = sanitizedItems.filter(item => {
      const key = item.itemId || item.id
      return !presetIds.has(key)
    })

    const compactPayload = {
      version: Date.now(),
      updatedAt: new Date().toISOString(),
      itemCount: customOnly.length,
      items: customOnly
    }

    await setDoc(doc(db, 'game_config', 'items_catalog'), compactPayload)
  } else {
    await setDoc(doc(db, 'game_config', 'items_catalog'), payload)
  }

  // Atualiza cache em memória imediatamente
  const map = {}
  itemsArray.forEach(i => {
    const key = i.itemId || i.id
    if (key) map[key] = { ...i, id: key }
  })
  cachedCatalogList = itemsArray
  cachedCatalogMap = map

  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload))
  } catch (e) {
    // Ignora quota de localStorage
  }

  notifySubscribers()
}

/**
 * Migração / Consolidação inicial com limpeza de imagens Base64:
 */
export async function consolidateCatalogFromItemsDb() {
  const map = {}

  // 1. Carrega todos os presets do código
  for (const item of DEFAULT_PRESET_ITEMS) {
    if (item && item.itemId) map[item.itemId] = { ...item, id: item.itemId }
  }
  for (const bp of DEFAULT_BACKPACKS) {
    if (bp && bp.itemId) map[bp.itemId] = { ...bp, id: bp.itemId }
  }

  // 2. Busca itens existentes no items_db legado
  try {
    const snap = await getDocs(collection(db, 'items_db'))
    snap.docs.forEach(d => {
      const data = d.data()
      const key = data.itemId || d.id
      map[key] = { ...(map[key] || {}), ...data, id: key, itemId: key }
    })
  } catch (err) {
    console.warn('Não foi possível ler items_db legado:', err)
  }

  const consolidatedList = Object.values(map)
  await saveConsolidatedCatalog(consolidatedList)
  return consolidatedList
}

export function subscribeItemCatalog(callback) {
  subscribers.add(callback)

  if (cachedCatalogList && cachedCatalogMap) {
    callback({ list: cachedCatalogList, map: cachedCatalogMap })
  }

  startSharedCatalogListener()

  return () => {
    subscribers.delete(callback)
  }
}

export function useItemCatalog() {
  const [catalog, setCatalog] = useState({
    list: cachedCatalogList || [],
    map: cachedCatalogMap || {},
    loaded: true
  })

  useEffect(() => {
    const unsub = subscribeItemCatalog(({ list, map }) => {
      setCatalog({ list, map, loaded: true })
    })
    return unsub
  }, [])

  return catalog
}

export function getCatalogItem(itemId) {
  if (!itemId) return null
  return cachedCatalogMap[itemId] || null
}
