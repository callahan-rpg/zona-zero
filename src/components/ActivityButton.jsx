import { useState } from 'react'
import { validateActivityRequirements } from '../utils/activitySystem'
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

  return (
    <>
      <button
        className="loot-btn"
        style={{
          background: colors.bg,
          borderColor: colors.border,
          color: colors.text,
          fontWeight: 700,
          boxShadow: `0 0 12px ${colors.bg}`,
          opacity: 1,
          position: 'relative',
        }}
        onClick={() => setShowModal(true)}
        title={hasErrors ? errors.join('\n') : activity.name}
      >
        <span>{activity.icon || '⚙️'}</span>
        {activity.name}
        {hasErrors && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            background: '#ef4444', color: '#fff',
            borderRadius: '50%', width: 14, height: 14,
            fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 900
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
