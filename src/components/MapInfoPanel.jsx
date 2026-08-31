import { useNavigate } from 'react-router-dom'
import { DANGER_COLORS, MARKER_TYPES } from '../utils/varezhiaData'

const DANGER_LABELS = ['', 'Muito Baixo', 'Baixo', 'Moderado', 'Alto', 'Extremo']

export default function MapInfoPanel({
  node,
  onClose,
  traveling,
  onTravel,
  onEnterCity,
  isCityLevel = false,
  embedded = false,
}) {
  const navigate = useNavigate()
  if (!node) return null

  const dangerColor = DANGER_COLORS[node.dangerLevel] || '#38bdf8'
  const dangerPct   = ((node.dangerLevel || 0) / 5) * 100
  const isCityWithMap = node.type === MARKER_TYPES.CITY && (node.hasCityMap || node.mapImage)

  return (
    <aside
      className={embedded ? 'map-info-panel map-info-panel--embedded' : 'map-info-panel'}
      role="complementary"
      aria-label="Informações da localização"
    >
      {/* Cabeçalho */}
      <div className="map-info-panel__header">
        <div className="map-info-panel__title-row">
          <span className="map-info-panel__type-icon" aria-hidden="true">
            {node.type === MARKER_TYPES.CITY ? '🏙️' : node.type === MARKER_TYPES.LOCATION ? '🚪' : '📍'}
          </span>
          <div>
            {node.region && (
              <p className="map-info-panel__region-label">{node.region}</p>
            )}
            <h2 className="map-info-panel__title">{node.name}</h2>
          </div>
        </div>
        <button
          className="map-info-panel__close"
          onClick={onClose}
          aria-label="Fechar painel de informações"
        >✕</button>
      </div>

      {/* Nível de perigo */}
      {node.dangerLevel && (
        <div className="map-info-panel__danger">
          <div className="map-info-panel__danger-row">
            <span className="map-info-panel__danger-label">Nível de Perigo</span>
            <span className="map-info-panel__danger-value" style={{ color: dangerColor }}>
              {DANGER_LABELS[node.dangerLevel] || '—'} ({node.dangerLevel}/5)
            </span>
          </div>
          <div className="map-info-panel__danger-bar">
            <div
              className="map-info-panel__danger-fill"
              style={{ width: `${dangerPct}%`, background: dangerColor }}
            />
          </div>
        </div>
      )}

      {/* Descrição */}
      {node.description && (
        <p className="map-info-panel__description">{node.description}</p>
      )}

      {/* Ações */}
      <div className="map-info-panel__actions">
        {/* Ação 1: Abrir Mapa da Cidade (se estiver no mapa nacional) */}
        {!isCityLevel && isCityWithMap && onEnterCity && (
          <button
            className="map-info-panel__btn map-info-panel__btn--city"
            onClick={() => onEnterCity(node)}
            style={{ marginBottom: 8 }}
          >
            🗺️ Explorar Mapa de {node.name} ➔
          </button>
        )}

        {/* Ação 2: Entrar na Sala / Locação do Jogo (se houver locationSlug cadastrado) */}
        {node.locationSlug ? (
          <button
            id={`travel-to-${node.locationSlug}`}
            className="map-info-panel__btn map-info-panel__btn--primary"
            onClick={() => onTravel(node.locationSlug)}
            disabled={traveling}
            aria-busy={traveling}
          >
            {traveling ? (
              <><span className="map-info-panel__spinner" aria-hidden="true" />Entrando...</>
            ) : (
              '🚪 Entrar na Sala'
            )}
          </button>
        ) : !isCityWithMap ? (
          <div className="map-info-panel__unavailable">
            <span aria-hidden="true">🔒</span>
            <span>Sala ainda não disponível</span>
          </div>
        ) : null}
      </div>
    </aside>
  )
}
