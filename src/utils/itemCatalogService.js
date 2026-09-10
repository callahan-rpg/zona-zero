import { useState, useEffect } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase/config'

// Estado compartilhado em memória para todo o ciclo da aplicação
let cachedCatalogList = null
let cachedCatalogMap = null
let activeUnsub = null
const subscribers = new Set()

function startSharedCatalogListener() {
  if (activeUnsub) return

  activeUnsub = onSnapshot(collection(db, 'items_db'), (snap) => {
    const list = []
    const map = {}

    snap.docs.forEach((d) => {
      const data = d.data()
      const item = { id: d.id, ...data }
      list.push(item)
      const key = data.itemId || d.id
      map[key] = item
    })

    cachedCatalogList = list
    cachedCatalogMap = map

    // Notifica todos os componentes inscritos
    subscribers.forEach((cb) => {
      try {
        cb({ list, map })
      } catch (err) {
        console.error('Erro no subscriber do catálogo:', err)
      }
    })
  }, (err) => {
    console.warn('Aviso no listener compartilhado de items_db:', err)
  })
}

/**
 * Inscreve um callback para receber a lista e o mapa do catálogo de itens.
 * Utiliza uma única conexão do Firestore compartilhada por todos os componentes.
 */
export function subscribeItemCatalog(callback) {
  subscribers.add(callback)

  // Se já tiver dados em cache, entrega imediatamente sem esperar a rede
  if (cachedCatalogList && cachedCatalogMap) {
    callback({ list: cachedCatalogList, map: cachedCatalogMap })
  }

  startSharedCatalogListener()

  return () => {
    subscribers.delete(callback)
    // Se não houver mais nenhum componente escutando, podemos optar por manter
    // a conexão ativa ou fechar. Mantendo ativa ou fechando: mantemos em memória
    // para evitar refazer leituras do Firestore a cada clique de tela.
  }
}

/**
 * Hook React para consumir o catálogo centralizado de itens com deduplicação de leituras.
 */
export function useItemCatalog() {
  const [catalog, setCatalog] = useState({
    list: cachedCatalogList || [],
    map: cachedCatalogMap || {},
    loaded: !!cachedCatalogList
  })

  useEffect(() => {
    const unsub = subscribeItemCatalog(({ list, map }) => {
      setCatalog({ list, map, loaded: true })
    })
    return unsub
  }, [])

  return catalog
}
