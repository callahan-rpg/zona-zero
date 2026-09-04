import React from 'react'
import GameIcon from './GameIcon'
import { EQUIPMENT_SLOTS, UNARMED_ATTACK, RARITY_META } from '../utils/itemSystem'

/**
 * Componente visual do Esqueleto / Paperdoll de Equipamento.
 * Exibe os slots corporais (Cabeça, Tórax Blusa, Tórax Colete, Luvas, Arma em Mãos, Pernas, Pés),
 * com indicadores de durabilidade, isolamento térmico total, redução fixa de dano e dano da arma em mãos.
 */
export default function EquipmentPaperdoll({
  equipmentStats,
  thermalInfo,
  onUnequipItem,
  onEquipClick,
  disabled = false
}) {
  const { equippedMap, totalInsulation, totalDamageReduction, weaponStats } = equipmentStats || {
    equippedMap: {},
    totalInsulation: 0,
    totalDamageReduction: 0,
    weaponStats: UNARMED_ATTACK
  }

  // Agrupamento dos slots para o layout em duas colunas ao redor da silhueta
  const leftSlots = ['head', 'torso_inner', 'torso_outer']
  const rightSlots = ['hands_gloves', 'hands_weapon', 'legs', 'feet']

  const renderSlotCard = (slotId) => {
    const slotDef = EQUIPMENT_SLOTS.find(s => s.id === slotId)
    if (!slotDef) return null

    const item = equippedMap[slotId]
    const hasItem = !!item
    const rMeta = hasItem ? (RARITY_META[item.rarity] || RARITY_META.common) : null

    // Cálculo de durabilidade
    const maxDur = hasItem && item.maxDurability ? Number(item.maxDurability) : null
    const curDur = hasItem && item.durability !== undefined ? Number(item.durability) : maxDur
    const durPct = maxDur && maxDur > 0 ? Math.max(0, Math.min(100, Math.round((curDur / maxDur) * 100))) : null
    const isBroken = durPct !== null && durPct <= 0

    let durColor = '#4ade80'
    if (durPct !== null) {
      if (durPct <= 25) durColor = '#ef4444'
      else if (durPct <= 50) durColor = '#f59e0b'
    }

    return (
      <div
        key={slotId}
        className={`paperdoll-slot-card ${hasItem ? 'occupied' : 'empty'} ${isBroken ? 'broken' : ''}`}
        style={{
          borderLeft: hasItem ? `3px solid ${rMeta?.color || 'var(--accent)'}` : undefined,
        }}
      >
        <div className="paperdoll-slot-header">
          <div className="paperdoll-slot-title">
            <span className="paperdoll-slot-icon">{slotDef.icon}</span>
            <span className="paperdoll-slot-name">{slotDef.label}</span>
          </div>

          {hasItem && (
            <button
              type="button"
              className="paperdoll-unequip-btn"
              onClick={() => !disabled && onUnequipItem && onUnequipItem(item)}
              title="Desequipar e guardar na mochila"
              disabled={disabled}
            >
              ✕ Desequipar
            </button>
          )}
        </div>

        {hasItem ? (
          <div className="paperdoll-item-details">
            <div className="paperdoll-item-top-row">
              <div className="paperdoll-item-avatar">
                <GameIcon src={item.imageUrl} emoji={item.icon || slotDef.icon} size={22} />
              </div>
              <div className="paperdoll-item-info">
                <strong className="paperdoll-item-name" style={{ color: rMeta?.color || '#fff' }}>
                  {item.name}
                </strong>
                <div className="paperdoll-item-badges">
                  {item.insulation > 0 && (
                    <span className="paperdoll-badge badge-insulation" title={`Isolamento Térmico: +${item.insulation}°C`}>
                      🧥 +{item.insulation}°C
                    </span>
                  )}
                  {item.damageReduction > 0 && (
                    <span className="paperdoll-badge badge-defense" title={`Proteção Fixa: -${item.damageReduction} de dano por golpe`}>
                      🛡️ -{item.damageReduction} dano
                    </span>
                  )}
                  {item.damageMin && (
                    <span className="paperdoll-badge badge-damage" title={`Dano Base: ${item.damageMin}–${item.damageMax}`}>
                      ⚔️ {item.damageMin}–{item.damageMax}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Barra de Durabilidade */}
            {maxDur !== null && (
              <div className="paperdoll-durability-container" title={`Durabilidade: ${curDur} / ${maxDur} (${durPct}%)`}>
                <div className="paperdoll-durability-label">
                  <span>Conservação</span>
                  <strong style={{ color: isBroken ? '#ef4444' : durColor }}>
                    {isBroken ? '⚠️ QUEBRADO (0%)' : `${curDur}/${maxDur}`}
                  </strong>
                </div>
                <div className="paperdoll-durability-track">
                  <div
                    className="paperdoll-durability-fill"
                    style={{ width: `${durPct}%`, background: durColor }}
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="paperdoll-empty-placeholder">
            <span>{slotDef.placeholder}</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="equipment-paperdoll-panel">
      {/* Header com os 3 cards de status agregados */}
      <div className="paperdoll-stats-header">
        {/* 1. Dano em Mãos */}
        <div className="paperdoll-stat-card stat-damage" title="Dano do ataque da arma atualmente equipada (ou desarmado)">
          <div className="stat-card-icon">{weaponStats.icon || '⚔️'}</div>
          <div className="stat-card-info">
            <span className="stat-card-label">Ataque em Mãos</span>
            <strong className="stat-card-value text-red">
              {weaponStats.damageText || `${weaponStats.damageMin}–${weaponStats.damageMax}`}
            </strong>
            <small className="stat-card-sub">{weaponStats.name}</small>
          </div>
        </div>

        {/* 2. Redução Fixa de Dano */}
        <div className="paperdoll-stat-card stat-defense" title="Pontos fixos de dano absorvidos por coletes, armaduras e roupas grossas equipadas">
          <div className="stat-card-icon">🛡️</div>
          <div className="stat-card-info">
            <span className="stat-card-label">Redução Fixa</span>
            <strong className="stat-card-value text-blue">
              -{totalDamageReduction} Dano
            </strong>
            <small className="stat-card-sub">por golpe recebido</small>
          </div>
        </div>

        {/* 3. Isolamento Térmico & Temperatura */}
        <div className="paperdoll-stat-card stat-thermal" title={`Isolamento total de roupas equipadas. Sensação térmica: ${thermalInfo?.effectiveTemp ?? 20}°C (${thermalInfo?.label || 'Normal'})`}>
          <div className="stat-card-icon">{thermalInfo?.icon || '🧥'}</div>
          <div className="stat-card-info">
            <span className="stat-card-label">Isolamento Térmico</span>
            <strong className="stat-card-value text-green">
              +{totalInsulation}°C
            </strong>
            <small className="stat-card-sub" style={{ color: thermalInfo?.color || 'var(--text-muted)' }}>
              {thermalInfo?.effectiveTemp ?? 20}°C · {thermalInfo?.label || 'Conforto'}
            </small>
          </div>
        </div>
      </div>

      {/* Grid com slots corporais */}
      <div className="paperdoll-body-layout">
        <div className="paperdoll-slots-col">
          {leftSlots.map(renderSlotCard)}
        </div>

        <div className="paperdoll-silhouette-container">
          <div className="paperdoll-silhouette-graphic">
            <div className="silhouette-head" title="Cabeça" />
            <div className="silhouette-torso" title="Tórax (Blusa + Colete)" />
            <div className="silhouette-arms" title="Mãos & Armas" />
            <div className="silhouette-legs" title="Pernas & Calças" />
            <div className="silhouette-feet" title="Pés & Calçados" />
          </div>
          <span className="silhouette-label">Esqueleto de Traje</span>
        </div>

        <div className="paperdoll-slots-col">
          {rightSlots.map(renderSlotCard)}
        </div>
      </div>
    </div>
  )
}
