import { collection, doc, getDocs, getDoc, setDoc, addDoc, updateDoc, runTransaction, query, where, orderBy, limit } from 'firebase/firestore'
import { db } from '../firebase/config'
import { hasRadio } from './itemSystem'
import { calculateGameTime } from './timeSystem'

/**
 * Frequências do Rádio e suas regras de tempo estritas
 * 
 * Regra do RPG: 1 dia no jogo (ON) = 12 horas reais (OFF).
 * - 1x por dia ON  -> Intervalo de 12 horas reais (OFF) [= 1 dia in-game]
 * - 1x por dia OFF -> Intervalo de 24 horas reais (OFF) [= 2 dias in-game]
 */
export const RADIO_FREQUENCIES = {
  '1x_day_on': {
    id: '1x_day_on',
    label: '1 vez por dia ON (A cada 12h OFF)',
    shortLabel: '1x / dia ON (12h)',
    intervalHours: 12,
    intervalMs: 12 * 60 * 60 * 1000,
    desc: 'Equivale a 1 transmissão por dia dentro do RPG (a cada 12 horas do relógio real).'
  },
  '1x_day_off': {
    id: '1x_day_off',
    label: '1 vez por dia OFF (A cada 24h OFF)',
    shortLabel: '1x / dia OFF (24h)',
    intervalHours: 24,
    intervalMs: 24 * 60 * 60 * 1000,
    desc: 'Equivale a 1 transmissão a cada 24 horas reais (2 dias dentro do RPG).'
  }
}

export const DEFAULT_RADIO_POINT = {
  id: 'radio_casa_grande',
  name: 'Rádio do Acampamento',
  locationSlug: 'casa-grande-2-andar',
  locationName: 'Casa Grande — 2º Andar',
  enabled: true,
  description: 'Estação de rádio transmissora e receptora sintonizada na frequência de emergência da base.'
}

/**
 * Envia uma transmissão manual de Rádio para todos os sobreviventes que possuem o item Rádio
 */
export async function sendManualBroadcast({
  message,
  senderName = 'Rádio do Acampamento',
  category = 'Comunicado Geral',
  gameConfig = null
}) {
  if (!message || !message.trim()) {
    throw new Error('A mensagem de transmissão não pode estar vazia.')
  }

  const cleanMessage = message.trim()
  const gameTime = calculateGameTime(gameConfig)
  const nowIso = new Date().toISOString()
  const nowMs = Date.now()

  // 1. Busca todos os usuários do RPG
  const usersSnap = await getDocs(collection(db, 'users'))
  const notifiedUids = []

  // 2. Filtra usuários que possuem Rádio e dispara notificações atômicas
  const updatePromises = []

  usersSnap.forEach((userDoc) => {
    const userData = userDoc.data()
    const inventory = userData.character?.inventory || []

    if (hasRadio(inventory)) {
      notifiedUids.push(userDoc.id)
      const notifId = 'notif_radio_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36)
      const newNotif = {
        id: notifId,
        type: 'radio_message',
        senderName: senderName || 'Rádio do Acampamento',
        senderAvatar: null,
        message: cleanMessage,
        category: category,
        gameDateFormatted: gameTime.formattedDate,
        gameTimeString: gameTime.timeString,
        read: false,
        createdAt: nowIso
      }

      const existingNotifs = userData.character?.notifications || []
      const updatedNotifs = [newNotif, ...existingNotifs.slice(0, 49)]

      const userRef = doc(db, 'users', userDoc.id)
      updatePromises.push(
        updateDoc(userRef, {
          'character.notifications': updatedNotifs
        })
      )
    }
  })

  await Promise.all(updatePromises)

  // 3. Registra no histórico permanente de transmissões
  const transmissionData = {
    message: cleanMessage,
    senderName: senderName || 'Rádio do Acampamento',
    category: category || 'Comunicado Geral',
    type: 'manual',
    gameDateFormatted: gameTime.formattedDate,
    gameTimeString: gameTime.timeString,
    recipientsCount: notifiedUids.length,
    notifiedUids: notifiedUids,
    timestamp: nowMs,
    createdAt: nowIso
  }

  const transmissionRef = await addDoc(collection(db, 'radio_transmissions'), transmissionData)

  return {
    id: transmissionRef.id,
    ...transmissionData
  }
}

/**
 * Executa o ciclo do scheduler de mensagens automáticas de forma segura e atômica.
 * Evita disparos duplicados mesmo com múltiplos clientes/sessões abertas simultaneamente.
 */
export async function checkAndTriggerAutoBroadcasts(gameConfig = null) {
  try {
    const schedulesSnap = await getDocs(collection(db, 'radio_auto_messages'))
    if (schedulesSnap.empty) return { processed: 0 }

    const gameTime = calculateGameTime(gameConfig)
    const nowMs = Date.now()
    const nowIso = new Date().toISOString()

    let processedCount = 0

    for (const scheduleDoc of schedulesSnap.docs) {
      const schedule = { id: scheduleDoc.id, ...scheduleDoc.data() }

      // Se a automação estiver desativada ou sem mensagens
      if (schedule.enabled === false) continue
      const messagesList = Array.isArray(schedule.messages) && schedule.messages.length > 0
        ? schedule.messages
        : (schedule.text ? [schedule.text] : [])

      if (messagesList.length === 0) continue

      const freqKey = schedule.frequency || '1x_day_on'
      const freqMeta = RADIO_FREQUENCIES[freqKey] || RADIO_FREQUENCIES['1x_day_on']
      const intervalMs = freqMeta.intervalMs

      const nextExecutionMs = schedule.nextExecutionMs || 0

      // Se ainda não chegou o momento do disparo
      if (nextExecutionMs > nowMs) {
        continue
      }

      // Se for a primeira inicialização da mensagem e não possuir nextExecutionMs definido, agenda para o próximo ciclo
      if (!schedule.lastExecutionMs && !schedule.nextExecutionMs) {
        await updateDoc(doc(db, 'radio_auto_messages', schedule.id), {
          lastExecution: null,
          lastExecutionMs: null,
          nextExecution: new Date(nowMs + intervalMs).toISOString(),
          nextExecutionMs: nowMs + intervalMs,
          updatedAt: nowIso
        })
        continue
      }

      // Operação atômica no Firestore para travar o ciclo e evitar concorrência/duplicidade
      const scheduleRef = doc(db, 'radio_auto_messages', schedule.id)

      let shouldSend = false
      let chosenMessage = ''

      try {
        await runTransaction(db, async (transaction) => {
          const freshSnap = await transaction.get(scheduleRef)
          if (!freshSnap.exists()) return

          const freshData = freshSnap.data()
          if (freshData.enabled === false) return

          const currentNextMs = freshData.nextExecutionMs || 0
          if (currentNextMs > nowMs) {
            // Outro cliente/processo já executou este ciclo
            return
          }

          // Escolhe mensagem (aleatória entre as cadastradas ou única)
          const validMessages = (freshData.messages || [freshData.text || '']).filter(m => typeof m === 'string' && m.trim().length > 0)
          if (validMessages.length === 0) return

          const randomIndex = Math.floor(Math.random() * validMessages.length)
          chosenMessage = validMessages[randomIndex].trim()

          // Avança a próxima execução para o futuro (+12h ou +24h)
          const nextTargetMs = nowMs + intervalMs

          transaction.update(scheduleRef, {
            lastExecution: nowIso,
            lastExecutionMs: nowMs,
            lastMessageSent: chosenMessage,
            nextExecution: new Date(nextTargetMs).toISOString(),
            nextExecutionMs: nextTargetMs,
            updatedAt: nowIso
          })

          shouldSend = true
        })
      } catch (transErr) {
        console.warn('Erro ao processar transação de mensagem automática:', transErr)
        continue
      }

      if (shouldSend && chosenMessage) {
        // Dispara para todos os usuários com Rádio
        const usersSnap = await getDocs(collection(db, 'users'))
        const notifiedUids = []
        const updatePromises = []

        usersSnap.forEach((userDoc) => {
          const userData = userDoc.data()
          const inventory = userData.character?.inventory || []

          if (hasRadio(inventory)) {
            notifiedUids.push(userDoc.id)
            const notifId = 'notif_radio_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36)
            const newNotif = {
              id: notifId,
              type: 'radio_message',
              senderName: schedule.senderName || 'Rádio do Acampamento',
              senderAvatar: null,
              message: chosenMessage,
              category: schedule.group || schedule.category || 'Alerta do Rádio',
              gameDateFormatted: gameTime.formattedDate,
              gameTimeString: gameTime.timeString,
              read: false,
              createdAt: nowIso
            }

            const existingNotifs = userData.character?.notifications || []
            const updatedNotifs = [newNotif, ...existingNotifs.slice(0, 49)]

            const userRef = doc(db, 'users', userDoc.id)
            updatePromises.push(
              updateDoc(userRef, {
                'character.notifications': updatedNotifs
              })
            )
          }
        })

        await Promise.all(updatePromises)

        // Registra no histórico permanente
        await addDoc(collection(db, 'radio_transmissions'), {
          message: chosenMessage,
          senderName: schedule.senderName || 'Rádio do Acampamento',
          category: schedule.group || schedule.category || 'Alerta Automático',
          scheduleId: schedule.id,
          type: 'auto',
          gameDateFormatted: gameTime.formattedDate,
          gameTimeString: gameTime.timeString,
          recipientsCount: notifiedUids.length,
          notifiedUids: notifiedUids,
          timestamp: nowMs,
          createdAt: nowIso
        })

        processedCount++
      }
    }

    return { processed: processedCount }
  } catch (err) {
    console.error('Erro no scheduler de rádio:', err)
    return { error: err.message }
  }
}

/**
 * Toca efeito sonoro sutil de estática de rádio / bip
 */
export function playRadioChime() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, audioCtx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.18)

    gain.gain.setValueAtTime(0.08, audioCtx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.18)

    osc.connect(gain)
    gain.connect(audioCtx.destination)

    osc.start()
    osc.stop(audioCtx.currentTime + 0.18)
  } catch {
    // Ignora se o navegador bloquear autoplay
  }
}
