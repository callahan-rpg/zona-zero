import { useState, useEffect } from 'react'
import { validateActivityRequirements, formatDuration } from '../utils/activitySystem'
import FishingModal from './FishingModal.jsx'
import FarmingModal from './FarmingModal.jsx'
import AnimalCareModal from './AnimalCareModal.jsx'

/**
 * ActivityButton
 * Botão genérico de atividade de produção exibido na barra de ações da Location.
 * Detecta o tipo da atividade e abre o modal correspondente.
 */
export default function ActivityButton({ activity, character, locationSlug }) {
  const [showModal, setShowModal] = useState(false)
  const [cooldownRemaining, setCooldownRemaining] = useState(0)

  // Observa cooldown em tempo real para pesca
  useEffect(() => {
    if (!activity || activity.type !== 'fishing') {
      setCooldownRemaining(0)
      return
    }

    const checkCd = () => {
      const cooldownMs = activity.cooldownMs !== undefined
        ? Number(activity.cooldownMs)
        : (activity.cooldownMinutes !== undefined ? Number(activity.cooldownMinutes) * 60000 : 30 * 60 * 1000)

      if (cooldownMs <= 0) {
        setCooldownRemaining(0)
        return
      }

      const lastAttempt = character?.lastFishingAttempt?.[locationSlug] ||
                          character?.lastActivityReward?.[`fishing_${locationSlug}`] ||
                          character?.lastActivityAttempt?.[`fishing_${locationSlug}`]

      if (!lastAttempt) {
        setCooldownRemaining(0)
        return
      }

      const lastDate = lastAttempt.toDate ? lastAttempt.toDate() : new Date(lastAttempt)
      const elapsed = Date.now() - lastDate.getTime()
      setCooldownRemaining(Math.max(0, cooldownMs - elapsed))
    }

    checkCd()
    const timer = setInterval(checkCd, 1000)
    return () => clearInterval(timer)
  }, [activity, character, locationSlug])

  if (!activity || !activity.enabled) return null

  const inventory = character?.inventory || []
  const errors = validateActivityRequirements(activity, inventory)
  const hasErrors = errors.length > 0

  // Cores por tipo de atividade
  const typeColors = {
    fishing:     { bg: 'rgba(56,189,248,0.18)',  border: '#38bdf8', text: '#7dd3fc' },
    farming:     { bg: 'rgba(74,222,128,0.18)',  border: '#4ade80', text: '#86efac' },
    animal_care: { bg: 'rgba(251,191,36,0.18)',  border: '#fbbf24', text: '#fde68a' },
  }
  const colors = typeColors[activity.type] || typeColors.fishing

  const imgUrl = activity.buttonImage || activity.imageUrl

  return (
    <>
      <button
        type="button"
        className={imgUrl ? 'activity-img-btn' : 'loot-btn'}
        style={imgUrl ? {
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          outline: 'none',
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.18s ease, filter 0.18s ease',
        } : {
          background: colors.bg,
          borderColor: colors.border,
          color: colors.text,
          fontWeight: 700,
          boxShadow: `0 0 12px ${colors.bg}`,
          opacity: 1,
          position: 'relative',
          padding: '8px 14px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: '44px',
          minHeight: '44px',
        }}
        onClick={() => setShowModal(true)}
        title={cooldownRemaining > 0 ? `${activity.name} em cooldown (${formatDuration(cooldownRemaining)})` : hasErrors ? `${activity.name}\n${errors.join('\n')}` : activity.name}
      >
        {imgUrl ? (
          <img
            src={imgUrl}
            alt={activity.name}
            style={{
              width: 'auto',
              maxHeight: 72,
              maxWidth: 160,
              objectFit: 'contain',
              display: 'block',
              filter: cooldownRemaining > 0
                ? 'grayscale(0.85) opacity(0.55)'
                : 'drop-shadow(0 3px 10px rgba(0,0,0,0.6))',
              transition: 'transform 0.15s ease, filter 0.15s ease',
            }}
            onMouseEnter={e => {
              if (cooldownRemaining <= 0) {
                e.currentTarget.style.transform = 'scale(1.08)'
                e.currentTarget.style.filter = 'drop-shadow(0 0 14px rgba(255,255,255,0.5))'
              }
            }}
            onMouseLeave={e => {
              if (cooldownRemaining <= 0) {
                e.currentTarget.style.transform = 'scale(1)'
                e.currentTarget.style.filter = 'drop-shadow(0 3px 10px rgba(0,0,0,0.6))'
              }
            }}
          />
        ) : (
          <span style={{ fontSize: 20, lineHeight: 1 }}>{cooldownRemaining > 0 ? '⏳' : (activity.icon || '⚙️')}</span>
        )}

        {cooldownRemaining > 0 && (
          <span style={{
            position: 'absolute',
            bottom: -4,
            background: 'rgba(0, 0, 0, 0.85)',
            border: `1px solid ${colors.border}`,
            color: colors.text,
            borderRadius: 4,
            fontSize: 9,
            padding: '1px 4px',
            whiteSpace: 'nowrap',
            fontWeight: 800,
            lineHeight: 1.1,
          }}>
            {formatDuration(cooldownRemaining)}
          </span>
        )}

        {hasErrors && cooldownRemaining <= 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            background: '#ef4444', color: '#fff',
            borderRadius: '50%', width: 16, height: 16,
            fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 900,
            boxShadow: '0 0 6px #ef4444'
          }}>!</span>
        )}
      </button>

      {/* Modal por tipo */}
      {showModal && activity.type === 'fishing' && (
        <FishingModal
          activity={activity}
          character={character}
          locationSlug={locationSlug}
          onClose={() => setShowModal(false)}
        />
      )}
      {showModal && activity.type === 'farming' && (
        <FarmingModal
          activity={activity}
          character={character}
          locationSlug={locationSlug}
          onClose={() => setShowModal(false)}
        />
      )}
      {showModal && activity.type === 'animal_care' && (
        <AnimalCareModal
          activity={activity}
          character={character}
          locationSlug={locationSlug}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}
