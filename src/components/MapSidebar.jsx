import { useState, useMemo } from 'react'
import { VAREZHIA, DANGER_COLORS, MARKER_TYPES, searchNodes } from '../utils/varezhiaData'

const TERRAIN_ICONS = {
  mountain:   '⛰️',
  forest:     '🌲',
  urban:      '🏙️',
  industrial: '🏭',
  plains:     '🌾',
  coastal:    '🌊',
  desert:     '🏜️',
  rocky:      '🪨',
}

const TYPE_LABEL = {
  [MARKER_TYPES.CITY]:     'Cidade',
  [MARKER_TYPES.DISTRICT]: 'Distrito',
  [MARKER_TYPES.SPECIAL]:  'Local Especial',
  [MARKER_TYPES.MILITARY]: 'Instalação Militar',
  [MARKER_TYPES.POI]:      'Ponto de Interesse',
}

export default function MapSidebar({ selectedId, onSelectNode, collapsed, onToggle }) {
  const [query,       setQuery]       = useState('')
  const [expandedIds, setExpandedIds] = useState(new Set(['novigrad'])) // Novigrad aberto por padrão

  const searchResults = useMemo(() => searchNodes(query), [query])

  function toggleExpand(id) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleSelect(node) {
    onSelectNode(node)
    // Auto-expande a região ao selecionar
    if (node.regionId) {
      setExpandedIds(prev => new Set([...prev, node.regionId]))
    }
    if (node.type === MARKER_TYPES.REGION) {
      setExpandedIds(prev => new Set([...prev, node.id]))
    }
  }

  const dangerLabel = (lvl) => '▮'.repeat(lvl) + '▯'.repeat(5 - lvl)

  return (
    <aside className="map-sidebar" data-collapsed={collapsed}>
      {/* Cabeçalho */}
      <div className="map-sidebar__header">
        {!collapsed && (
          <>
            <span className="map-sidebar__title">EXPLORAR VAREZHIA</span>
            <span className="map-sidebar__subtitle">República de Varezhia · 43.000 km²</span>
          </>
        )}
        <button
          className="map-sidebar__toggle"
          onClick={onToggle}
          title={collapsed ? 'Expandir painel' : 'Recolher painel'}
          aria-label={collapsed ? 'Expandir painel lateral' : 'Recolher painel lateral'}
        >
          {collapsed ? '▶' : '◀'}
        </button>
      </div>

      {!collapsed && (
        <>
          {/* Barra de pesquisa */}
          <div className="map-sidebar__search">
            <span className="map-sidebar__search-icon">🔍</span>
            <input
              id="map-search"
              type="text"
              placeholder="Buscar localização..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoComplete="off"
              aria-label="Buscar localização no mapa"
            />
            {query && (
              <button className="map-sidebar__search-clear" onClick={() => setQuery('')}
                aria-label="Limpar busca">✕</button>
            )}
          </div>

          {/* Resultados de busca */}
          {query.length >= 2 ? (
            <div className="map-sidebar__results">
              {searchResults.length === 0 ? (
                <p className="map-sidebar__empty">Nenhum resultado encontrado.</p>
              ) : (
                searchResults.map(node => (
                  <button
                    key={node.id}
                    className={`map-sidebar__result-item ${selectedId === node.id ? 'active' : ''}`}
                    onClick={() => { handleSelect(node); setQuery('') }}
                  >
                    <span className="map-sidebar__result-name">{node.name}</span>
                    <span className="map-sidebar__result-breadcrumb">{node.breadcrumb}</span>
                  </button>
                ))
              )}
            </div>
          ) : (
            /* Lista hierárquica completa */
            <nav className="map-sidebar__nav" aria-label="Navegação pelo mapa de Varezhia">
              {VAREZHIA.regions.map(region => {
                const isRegionExpanded = expandedIds.has(region.id)
                const isRegionSelected = selectedId === region.id
                const hasCities = (region.cities || []).length > 0

                return (
                  <div key={region.id} className="map-sidebar__region">
                    {/* Cabeçalho da região */}
                    <button
                      className={`map-sidebar__region-header ${isRegionSelected ? 'active' : ''}`}
                      onClick={() => { handleSelect(region); if (hasCities) toggleExpand(region.id) }}
                      aria-expanded={isRegionExpanded}
                    >
                      <span className="map-sidebar__region-icon">
                        {TERRAIN_ICONS[region.terrain] || '📍'}
                      </span>
                      <span className="map-sidebar__region-name">{region.name}</span>
                      <span
                        className="map-sidebar__danger"
                        style={{ color: DANGER_COLORS[region.dangerLevel] }}
                        title={`Perigo: ${region.dangerLevel}/5`}
                      >
                        {dangerLabel(region.dangerLevel)}
                      </span>
                      {hasCities && (
                        <span className="map-sidebar__chevron">
                          {isRegionExpanded ? '▾' : '▸'}
                        </span>
                      )}
                    </button>

                    {/* Cidades / distritos da região */}
                    {isRegionExpanded && hasCities && (
                      <ul className="map-sidebar__cities" role="list">
                        {(region.cities || []).map(city => {
                          const isCitySelected = selectedId === city.id
                          const hasPois = (city.pois || []).length > 0
                          const isPoisExpanded = expandedIds.has(city.id + '-pois')
                          const typeTag = TYPE_LABEL[city.type]

                          return (
                            <li key={city.id}>
                              <button
                                className={`map-sidebar__city-btn ${isCitySelected ? 'active' : ''}`}
                                onClick={() => {
                                  handleSelect({ ...city, regionId: region.id, regionName: region.name })
                                  if (hasPois) toggleExpand(city.id + '-pois')
                                }}
                                aria-current={isCitySelected ? 'true' : undefined}
                              >
                                <span
                                  className="map-sidebar__city-dot"
                                  style={{ background: DANGER_COLORS[city.dangerLevel] }}
                                />
                                <span className="map-sidebar__city-name">{city.name}</span>
                                {typeTag && (
                                  <span className="map-sidebar__city-type">{typeTag}</span>
                                )}
                                {hasPois && (
                                  <span className="map-sidebar__chevron map-sidebar__chevron--sm">
                                    {isPoisExpanded ? '▾' : '▸'}
                                  </span>
                                )}
                              </button>

                              {/* POIs da cidade */}
                              {isPoisExpanded && hasPois && (
                                <ul className="map-sidebar__pois" role="list">
                                  {(city.pois || []).map(poi => (
                                    <li key={poi.id}>
                                      <button
                                        className={`map-sidebar__poi-btn ${selectedId === poi.id ? 'active' : ''}`}
                                        onClick={() => handleSelect({ ...poi, regionId: region.id, cityId: city.id, regionName: region.name })}
                                      >
                                        <span className="map-sidebar__poi-dot" />
                                        {poi.name}
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                )
              })}
            </nav>
          )}
        </>
      )}
    </aside>
  )
}
