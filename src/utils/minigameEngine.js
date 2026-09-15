/**
 * minigameEngine.js
 * Engine e infraestrutura base para minigames de sobrevivência do Zona Zero RPG
 * 
 * Preparado de forma desacoplada para suportar culinária agora e futuras atividades
 * (ex: pesca, coleta florestal, reparo mecânico, arrombamento de fechaduras, etc.)
 */

export const MINIGAME_TYPES = {
  COOKING_TEMPERATURE: 'cooking_temperature', // Controle de temperatura e ponto de cozimento
  NONE: 'none'
}

export const MINIGAME_DIFFICULTIES = {
  easy: {
    id: 'easy',
    label: 'Fácil',
    idealZoneMin: 30, // 30% a 75%
    idealZoneMax: 75,
    coolingRate: 18,  // % por segundo que esfria naturalmente
    heatingRate: 45,  // % por segundo que aquece quando mantido
    requiredProgress: 100,
    progressGainPerSec: 28,
  },
  normal: {
    id: 'normal',
    label: 'Normal',
    idealZoneMin: 40, // 40% a 70%
    idealZoneMax: 70,
    coolingRate: 24,
    heatingRate: 50,
    requiredProgress: 100,
    progressGainPerSec: 24,
  },
  hard: {
    id: 'hard',
    label: 'Difícil',
    idealZoneMin: 45, // 45% a 65%
    idealZoneMax: 65,
    coolingRate: 30,
    heatingRate: 55,
    requiredProgress: 100,
    progressGainPerSec: 20,
  }
}

/**
 * Cria uma sessão segura de minigame
 */
export function createMiniGameSession({
  type = MINIGAME_TYPES.COOKING_TEMPERATURE,
  recipeId = null,
  characterId = null,
  durationSec = 6,
  difficulty = 'normal',
  ingredientLossOnFailure = false
} = {}) {
  const sessionId = `mgs_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`
  const startedAt = Date.now()
  const expiresAt = startedAt + (Math.max(2, durationSec) + 4) * 1000 // Margem de segurança de 4s

  return {
    sessionId,
    type,
    recipeId,
    characterId,
    difficulty,
    durationSec,
    ingredientLossOnFailure: !!ingredientLossOnFailure,
    startedAt,
    expiresAt,
    status: 'IN_PROGRESS' // IN_PROGRESS | COMPLETED | FAILED | CANCELLED | EXPIRED
  }
}

/**
 * Valida o desfecho de uma sessão de minigame
 */
export function validateMiniGameOutcome(session, outcome = {}) {
  if (!session || !session.sessionId) {
    return { ok: false, reason: 'Sessão de minigame inválida ou inexistente.' }
  }

  const now = Date.now()
  if (now > session.expiresAt + 2000) {
    return { ok: false, reason: 'Sessão expirada. O tempo limite foi excedido.' }
  }

  return {
    ok: true,
    sessionId: session.sessionId,
    recipeId: session.recipeId,
    success: !!outcome.success,
    ingredientLossOnFailure: session.ingredientLossOnFailure
  }
}
