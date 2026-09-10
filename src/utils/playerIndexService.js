import { collection, doc, getDocs, setDoc, query, where, writeBatch } from 'firebase/firestore'
import { db } from '../firebase/config'
import { hasRadio } from './itemSystem'

// Cache em memória curto para evitar leituras repetidas em modais fechados/reabertos
let cachedIndex = null
let lastFetchTime = 0
const CACHE_TTL_MS = 30000 // 30 segundos de cache local

/**
 * Monta o objeto leve de índice do jogador
 */
export function buildPlayerIndexDoc(uid, character = {}, role = 'player') {
  const professionId = character?.profession?.id || 
    (typeof character?.profession === 'string' ? character.profession : null)

  return {
    uid,
    name: character?.name || '',
    avatarUrl: character?.avatarUrl || null,
    age: character?.age || null,
    level: Number(character?.level || 1),
    xp: Number(character?.xp || 0),
    hasRadio: hasRadio(character?.inventory || []),
    professionId: professionId || null,
    role: role || 'player',
    updatedAt: new Date().toISOString()
  }
}

/**
 * Sincroniza o documento leve do jogador em /players_index/{uid}
 */
export async function syncPlayerIndex(uid, character, role = 'player') {
  if (!uid || !character?.name) return

  try {
    const docData = buildPlayerIndexDoc(uid, character, role)
    await setDoc(doc(db, 'players_index', uid), docData, { merge: true })
    
    // Invalida cache local de índice para refletir atualizações locais
    cachedIndex = null
  } catch (err) {
    console.warn('[playerIndexService] Erro ao sincronizar índice do jogador:', err)
  }
}

/**
 * Busca todos os jogadores do índice leve com cache de 30s
 * @param {boolean} forceRefresh Se true, ignora o cache
 */
export async function getPlayerIndex(forceRefresh = false) {
  const now = Date.now()
  if (!forceRefresh && cachedIndex && (now - lastFetchTime < CACHE_TTL_MS)) {
    return cachedIndex
  }

  try {
    const snap = await getDocs(collection(db, 'players_index'))
    const list = snap.docs.map(d => ({ ...d.data(), uid: d.id }))
    cachedIndex = list
    lastFetchTime = now
    return list
  } catch (err) {
    console.error('[playerIndexService] Erro ao carregar players_index:', err)
    if (cachedIndex) return cachedIndex
    throw err
  }
}

/**
 * Busca apenas os jogadores que possuem Rádio (filtro no servidor Firestore)
 */
export async function getRadioReceivers() {
  try {
    const q = query(collection(db, 'players_index'), where('hasRadio', '==', true))
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ ...d.data(), uid: d.id }))
  } catch (err) {
    console.error('[playerIndexService] Erro ao buscar receptores de rádio:', err)
    throw err
  }
}

/**
 * Função de migração em lote (executada 1x pelo Admin)
 * Lê todos os usuários em /users e gera os documentos correspondentes em /players_index
 */
export async function migratePlayersIndex(onProgress = null) {
  const usersSnap = await getDocs(collection(db, 'users'))
  const total = usersSnap.docs.length
  let processed = 0

  // Firestore aceita até 500 operações por writeBatch. Usamos lotes de 200 por segurança.
  const CHUNK_SIZE = 200
  const docs = usersSnap.docs

  for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
    const chunk = docs.slice(i, i + CHUNK_SIZE)
    const batch = writeBatch(db)

    for (const userDoc of chunk) {
      const data = userDoc.data()
      const char = data.character || {}
      if (char.name) {
        const indexDoc = buildPlayerIndexDoc(userDoc.id, char, data.role || 'player')
        const ref = doc(db, 'players_index', userDoc.id)
        batch.set(ref, indexDoc, { merge: true })
      }
      processed++
    }

    await batch.commit()
    if (onProgress) {
      onProgress({ processed, total })
    }
  }

  // Limpa cache
  cachedIndex = null
  lastFetchTime = 0

  return { total, processed }
}
