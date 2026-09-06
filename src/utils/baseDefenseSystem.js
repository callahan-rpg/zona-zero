import { doc, getDoc, setDoc, addDoc, updateDoc, collection, runTransaction } from 'firebase/firestore'
import { db } from '../firebase/config'
import { calculateGameTime } from './timeSystem'

export const DEFAULT_BASE_DEFENSE = {
  name: 'Defesa do Acampamento',
  currentHp: 100,
  maxHp: 100,
  displayPoints: [
    {
      id: 'point_armazem_cg',
      name: 'Armazém da Casa Grande',
      targetSlug: 'casa-grande',
      storageId: 'armazem-casa-grande',
      enabled: true,
      description: 'Ponto principal de suprimentos e registro de integridade da Casa Grande.'
    }
  ]
}

/**
 * Retorna o status e cores da integridade da base baseado na porcentagem de vida
 */
export function getDefenseStatusMeta(currentHp = 100, maxHp = 100) {
  const safeMax = Math.max(1, Number(maxHp) || 100)
  const safeCurrent = Math.max(0, Math.min(safeMax, Number(currentHp) || 0))
  const percentage = Math.round((safeCurrent / safeMax) * 100)

  if (percentage >= 75) {
    return {
      percentage,
      label: 'Fortificada',
      badge: 'DEFESA INTACTA',
      color: '#22c55e',
      border: '#16a34a',
      bg: 'rgba(34, 197, 94, 0.12)',
      icon: '🛡️',
      description: 'Estruturas, portões e barricadas em excelente estado de conservação.'
    }
  }

  if (percentage >= 40) {
    return {
      percentage,
      label: 'Avariada',
      badge: 'DEFESA AVARIADA',
      color: '#f59e0b',
      border: '#d97706',
      bg: 'rgba(245, 158, 11, 0.15)',
      icon: '⚠️',
      description: 'Danos estruturais parciais. Necessita de reparos e vigilância.'
    }
  }

  if (percentage > 0) {
    return {
      percentage,
      label: 'Crítica',
      badge: 'ESTADO CRÍTICO',
      color: '#ef4444',
      border: '#dc2626',
      bg: 'rgba(239, 68, 68, 0.20)',
      icon: '🚨',
      description: 'Brechas perigosas nas muralhas! Risco iminente de invasão por hordas.'
    }
  }

  return {
    percentage: 0,
    label: 'Colapsada',
    badge: 'DEFESA DESTRUÍDA',
    color: '#b91c1c',
    border: '#991b1b',
    bg: 'rgba(185, 28, 28, 0.30)',
    icon: '☠️',
    description: 'Portões derrubados e defesas destruídas. A base está completamente exposta!'
  }
}

/**
 * Altera a vida da defesa da base com registro obrigatório de motivo e log de auditoria
 */
export async function updateBaseDefenseHp({
  newHp,
  reason,
  adminName = 'Admin',
  adminUid = null,
  gameConfig = null
}) {
  const hpVal = Number(newHp)
  if (isNaN(hpVal) || !Number.isFinite(hpVal)) {
    throw new Error('Informe um valor numérico válido para a vida da defesa.')
  }

  if (!reason || !reason.trim()) {
    throw new Error('O motivo da alteração da defesa é obrigatório para o histórico.')
  }

  const cleanReason = reason.trim()
  const gameTime = calculateGameTime(gameConfig)
  const nowIso = new Date().toISOString()
  const nowMs = Date.now()

  const defenseRef = doc(db, 'base_defense', 'global')

  return await runTransaction(db, async (transaction) => {
    const defenseSnap = await transaction.get(defenseRef)
    let currentData = DEFAULT_BASE_DEFENSE

    if (defenseSnap.exists()) {
      currentData = { ...DEFAULT_BASE_DEFENSE, ...defenseSnap.data() }
    }

    const maxHp = Number(currentData.maxHp) || 100
    const prevHp = Number(currentData.currentHp) || 0

    if (hpVal < 0) {
      throw new Error('A vida da defesa não pode ser menor que 0.')
    }
    if (hpVal > maxHp) {
      throw new Error(`A vida da defesa não pode ultrapassar a vida máxima (${maxHp}).`)
    }

    const delta = hpVal - prevHp

    // Atualiza documento principal da defesa
    transaction.set(defenseRef, {
      ...currentData,
      currentHp: hpVal,
      lastUpdated: nowIso,
      updatedByAdmin: adminName,
      updatedByUid: adminUid
    }, { merge: true })

    // Registra log permanente no histórico de auditoria
    const logRef = doc(collection(db, 'base_defense_logs'))
    const logData = {
      previousHp: prevHp,
      newHp: hpVal,
      delta: delta,
      reason: cleanReason,
      adminName: adminName || 'Admin',
      adminUid: adminUid || null,
      gameDateFormatted: gameTime.formattedDate,
      gameTimeString: gameTime.timeString,
      createdAt: nowIso,
      timestamp: nowMs
    }

    transaction.set(logRef, logData)

    return {
      success: true,
      previousHp: prevHp,
      newHp: hpVal,
      delta,
      logData
    }
  })
}

/**
 * Atualiza parâmetros da base (Vida Máxima, Nome, Pontos de Exibição)
 */
export async function updateBaseDefenseSettings({
  name,
  maxHp,
  displayPoints,
  adminName = 'Admin'
}) {
  const defenseRef = doc(db, 'base_defense', 'global')
  const defenseSnap = await getDoc(defenseRef)

  const currentData = defenseSnap.exists()
    ? { ...DEFAULT_BASE_DEFENSE, ...defenseSnap.data() }
    : DEFAULT_BASE_DEFENSE

  const cleanMaxHp = Math.max(1, Number(maxHp) || currentData.maxHp || 100)
  const cleanCurrentHp = Math.min(cleanMaxHp, currentData.currentHp ?? cleanMaxHp)

  const payload = {
    ...currentData,
    name: name || currentData.name || 'Defesa do Acampamento',
    maxHp: cleanMaxHp,
    currentHp: cleanCurrentHp,
    displayPoints: Array.isArray(displayPoints) ? displayPoints : currentData.displayPoints,
    lastUpdated: new Date().toISOString(),
    updatedByAdmin: adminName
  }

  await setDoc(defenseRef, payload, { merge: true })
  return payload
}
