import { useState, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useGameConfig } from '../contexts/GameConfigContext'
import { getActiveMoodles } from '../utils/diseaseSystem'

/**
 * MoodlesContainer: Renderiza a coluna vertical de Moodles no canto direito da tela.
 * Inspirado no Project Zomboid com tooltips imersivos ao passar o cursor do mouse.
 */
export default function MoodlesContainer() {
  const { character } = useAuth()
  const gameConfig = useGameConfig()
  const [hoveredMoodle, setHoveredMoodle] = useState(null)

  // Obtém moodles ativos a partir das doenças do personagem
  const moodles = useMemo(() => {
    if (!character?.diseases || !Array.isArray(character.diseases)) return []
    return getActiveMoodles(character.diseases, gameConfig?.diseaseConfig)
  }, [character?.diseases, gameConfig?.diseaseConfig])

  if (!moodles || moodles.length === 0) return null

  return (
    <aside className="moodles-viewport" aria-label="Indicadores de Sintomas e Moodles">
      <div className="moodles-stack">
        {moodles.map((moodle) => {
          const isHovered = hoveredMoodle?.id === moodle.id

          return (
            <div
              key={moodle.id}
              className={`moodle-item moodle-lvl-${moodle.level} ${moodle.level === 3 ? 'moodle-pulse-critical' : ''}`}
              onMouseEnter={() => setHoveredMoodle(moodle)}
              onMouseLeave={() => setHoveredMoodle(null)}
              tabIndex={0}
              role="status"
              aria-label={`${moodle.name} - ${moodle.levelLabel}`}
            >
              {/* Ícone ou Imagem Personalizada */}
              <div className="moodle-icon-box">
                {moodle.customImg ? (
                  <img
                    src={moodle.customImg}
                    alt={moodle.name}
                    className="moodle-custom-img"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                ) : (
                  <span className="moodle-emoji-icon">{moodle.icon}</span>
                )}

                {/* Indicador de intensidade de 1 a 3 barras / pontinhos */}
                <div className="moodle-intensity-dots">
                  <span className={`intensity-dot ${moodle.level >= 1 ? 'active' : ''}`} />
                  <span className={`intensity-dot ${moodle.level >= 2 ? 'active' : ''}`} />
                  <span className={`intensity-dot ${moodle.level >= 3 ? 'active' : ''}`} />
                </div>
              </div>

              {/* Tooltip Imersivo ao Passar o Mouse */}
              {isHovered && (
                <div className="moodle-tooltip animate-fade-in" role="tooltip">
                  <div className="moodle-tooltip-header">
                    <strong className="moodle-tooltip-title">{moodle.name}</strong>
                    <span className={`moodle-tooltip-badge badge-lvl-${moodle.level}`}>
                      {moodle.levelLabel}
                    </span>
                  </div>
                  <div className="moodle-tooltip-divider" />
                  <p className="moodle-tooltip-desc">{moodle.description}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </aside>
  )
}
