import { useState, useEffect, useRef } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../contexts/AuthContext.jsx'
import { getMaxHp } from '../utils/itemSystem'
import { ATTRIBUTE_ICONS, COMBAT_STATUS_EFFECTS } from '../utils/combatSystem'

export default function CombatHUD({ locationSlug }) {
  const { user } = useAuth()
  const [combat, setCombat] = useState(null)
  const [loading, setLoading] = useState(true)
  const [impactAnimation, setImpactAnimation] = useState(null)
  const [floatingTexts, setFloatingTexts] = useState([])
  const [showDetails, setShowDetails] = useState(true)
  const [participantsData, setParticipantsData] = useState({})

  // Escuta o combate ativo na locação
  useEffect(() => {
    if (!locationSlug) return
    const unsub = onSnapshot(doc(db, 'active_combats', locationSlug), (snap) => {
      if (snap.exists() && snap.data().active) {
        const data = snap.data()
        setCombat(data)

        // Processa animação de impacto se houver
        if (data.lastImpact && Date.now() - (data.lastImpact.timestamp || 0) < 4000) {
          const impact = data.lastImpact
          setImpactAnimation(impact)
          
          // Adiciona número flutuante
          const newFloat = {
            id: Math.random().toString(36).substring(2),
            targetId: impact.targetId,
            type: impact.type,
            value: impact.value,
            text: impact.type === 'damage' ? `-${impact.value}` : impact.type === 'heal' ? `+${impact.value}` : '💥'
          }
          setFloatingTexts(prev => [...prev.slice(-4), newFloat])

          // Limpa animação após 2s
          setTimeout(() => {
            setImpactAnimation(null)
          }, 2000)
        }
      } else {
        setCombat(null)
      }
      setLoading(false)
    })
    return unsub
  }, [locationSlug])

  // Escuta dados em tempo real dos personagens participantes
  useEffect(() => {
    if (!combat || !combat.participantUids || combat.participantUids.length === 0) return

    const unsubs = combat.participantUids.map(uid => {
      return onSnapshot(doc(db, 'users', uid), (snap) => {
        if (snap.exists()) {
          const udata = snap.data()
          setParticipantsData(prev => ({
            ...prev,
            [uid]: {
              uid,
              name: udata.character?.name || 'Sobrevivente',
              avatarUrl: udata.character?.avatarUrl || '',
              vitals: udata.character?.vitals || { blood: 100, hunger: 100, thirst: 100 },
              attributes: udata.character?.attributes || { forca: 1, destreza: 1, constituicao: 1, sabedoria: 1, carisma: 1 },
              level: udata.character?.level || 1,
              status: combat.participantStatus?.[uid] || []
            }
          }))
        }
      })
    })

    return () => {
      unsubs.forEach(unsub => unsub && unsub())
    }
  }, [combat?.participantUids, combat?.participantStatus])

  if (loading || !combat || !combat.active) {
    return null
  }

  const isLocalUserTakingDamage = impactAnimation && impactAnimation.targetId === user?.uid && impactAnimation.type === 'damage'

  return (
    <div className={`combat-hud-container ${isLocalUserTakingDamage ? 'combat-screen-shake' : ''}`}>
      {/* Vinheta vermelha de dano na tela do jogador */}
      {isLocalUserTakingDamage && <div className="combat-damage-vignette" />}

      {/* HEADER DO COMBATE */}
      <div className="combat-hud-header">
        <div className="combat-hud-title-wrap">
          <span className="combat-badge-pulse">⚔️ ENCONTRO ATIVO</span>
          <h3 className="combat-title">{combat.title || 'Combate em Andamento'}</h3>
        </div>
        <div className="combat-hud-actions">
          <button
            type="button"
            className="combat-toggle-btn"
            onClick={() => setShowDetails(prev => !prev)}
            title={showDetails ? 'Recolher detalhes' : 'Expandir detalhes'}
          >
            {showDetails ? '▲ Minimizar' : '▼ Detalhes'}
          </button>
        </div>
      </div>

      {showDetails && (
        <div className="combat-arena-grid">
          {/* LADO DOS JOGADORES / SOBREVIVENTES */}
          <div className="combat-side combat-allies-side">
            <div className="combat-side-header">
              <span className="side-tag allies">🛡️ Sobreviventes ({combat.participantUids?.length || 0})</span>
            </div>

            <div className="combat-cards-list">
              {combat.participantUids?.map(uid => {
                const char = participantsData[uid]
                if (!char) {
                  return (
                    <div key={uid} className="combat-card glass-light loading-card">
                      <span>Carregando dados...</span>
                    </div>
                  )
                }

                const maxHp = getMaxHp(char)
                const currentHp = Math.min(char.vitals?.blood ?? maxHp, maxHp)
                const hpPercent = Math.max(0, Math.min(100, Math.round((currentHp / maxHp) * 100)))
                const isTargetOfImpact = impactAnimation?.targetId === uid
                const floatList = floatingTexts.filter(f => f.targetId === uid)

                return (
                  <div
                    key={uid}
                    className={`combat-card ally-card ${isTargetOfImpact ? 'card-impact' : ''} ${currentHp <= 0 ? 'card-down' : ''}`}
                  >
                    {/* Floating combat numbers */}
                    <div className="floating-text-container">
                      {floatList.map(f => (
                        <span key={f.id} className={`floating-combat-num ${f.type}`}>
                          {f.text}
                        </span>
                      ))}
                    </div>

                    <div className="combat-card-top">
                      {char.avatarUrl ? (
                        <img src={char.avatarUrl} alt={char.name} className="combat-card-avatar" />
                      ) : (
                        <div className="combat-card-avatar-placeholder">👤</div>
                      )}
                      <div className="combat-card-meta">
                        <div className="combat-card-name-row">
                          <strong className="combat-card-name">{char.name}</strong>
                          <span className="combat-card-lvl">Nv {char.level}</span>
                        </div>

                        {/* Barra de HP */}
                        <div className="combat-hp-wrap">
                          <div className="combat-hp-labels">
                            <span style={{ color: '#ef4444' }}>HP</span>
                            <span className="combat-hp-val">
                              {currentHp} / {maxHp} <small>({hpPercent}%)</small>
                            </span>
                          </div>
                          <div className="combat-hp-track">
                            <div
                              className="combat-hp-fill ally-fill"
                              style={{ width: `${hpPercent}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Status Ativos */}
                    {char.status && char.status.length > 0 && (
                      <div className="combat-status-row">
                        {char.status.map(stId => {
                          const stMeta = COMBAT_STATUS_EFFECTS.find(s => s.id === stId)
                          if (!stMeta) return null
                          return (
                            <span
                              key={stId}
                              className="combat-status-badge"
                              style={{ borderColor: stMeta.color, color: stMeta.color }}
                              title={`${stMeta.label}: ${stMeta.desc}`}
                            >
                              {stMeta.icon} {stMeta.label}
                            </span>
                          )
                        })}
                      </div>
                    )}

                    {/* ATRIBUTOS SIMPLIFICADOS */}
                    <div className="combat-attributes-strip">
                      {Object.keys(ATTRIBUTE_ICONS).map(attrKey => {
                        const meta = ATTRIBUTE_ICONS[attrKey]
                        const val = char.attributes?.[attrKey] ?? 1
                        return (
                          <div key={attrKey} className="compact-attr-tag" title={`${meta.label}: ${val}`}>
                            <span className="compact-attr-icon">{meta.icon}</span>
                            <span className="compact-attr-lbl">{meta.label}</span>
                            <span className="compact-attr-val">{val}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* VERSUS DIVIDER */}
          <div className="combat-vs-divider">
            <span className="vs-circle">VS</span>
          </div>

          {/* LADO DOS INIMIGOS / NPCS */}
          <div className="combat-side combat-enemies-side">
            <div className="combat-side-header">
              <span className="side-tag enemies">👹 Inimigos ({combat.enemies?.length || 0})</span>
            </div>

            <div className="combat-cards-list">
              {combat.enemies && combat.enemies.length > 0 ? (
                combat.enemies.map(enemy => {
                  const maxHp = enemy.maxHp || 40
                  const currentHp = Math.max(0, enemy.currentHp ?? maxHp)
                  const hpPercent = Math.max(0, Math.min(100, Math.round((currentHp / maxHp) * 100)))
                  const isTargetOfImpact = impactAnimation?.targetId === enemy.id
                  const floatList = floatingTexts.filter(f => f.targetId === enemy.id)
                  const isDead = currentHp <= 0

                  return (
                    <div
                      key={enemy.id}
                      className={`combat-card enemy-card ${enemy.isBoss ? 'boss-card' : ''} ${isTargetOfImpact ? 'card-impact' : ''} ${isDead ? 'card-dead' : ''}`}
                    >
                      {/* Floating combat numbers */}
                      <div className="floating-text-container">
                        {floatList.map(f => (
                          <span key={f.id} className={`floating-combat-num ${f.type}`}>
                            {f.text}
                          </span>
                        ))}
                      </div>

                      <div className="combat-card-top">
                        {enemy.avatarUrl ? (
                          <img src={enemy.avatarUrl} alt={enemy.name} className="combat-card-avatar" />
                        ) : (
                          <div className="combat-card-avatar-placeholder enemy-avatar">
                            {enemy.icon || '🧟'}
                          </div>
                        )}
                        <div className="combat-card-meta">
                          <div className="combat-card-name-row">
                            <strong className="combat-card-name">
                              {enemy.name} {enemy.isBoss && <span className="boss-badge">👑 BOSS</span>}
                            </strong>
                            {isDead && <span className="dead-tag">💀 DERROTADO</span>}
                          </div>

                          {/* Barra de HP do Inimigo */}
                          <div className="combat-hp-wrap">
                            <div className="combat-hp-labels">
                              <span style={{ color: '#ef4444' }}>HP</span>
                              <span className="combat-hp-val">
                                {currentHp} / {maxHp} <small>({hpPercent}%)</small>
                              </span>
                            </div>
                            <div className="combat-hp-track">
                              <div
                                className={`combat-hp-fill enemy-fill ${enemy.isBoss ? 'boss-fill' : ''}`}
                                style={{ width: `${hpPercent}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Status Ativos do Inimigo */}
                      {enemy.status && enemy.status.length > 0 && (
                        <div className="combat-status-row">
                          {enemy.status.map(stId => {
                            const stMeta = COMBAT_STATUS_EFFECTS.find(s => s.id === stId)
                            if (!stMeta) return null
                            return (
                              <span
                                key={stId}
                                className="combat-status-badge"
                                style={{ borderColor: stMeta.color, color: stMeta.color }}
                                title={`${stMeta.label}: ${stMeta.desc}`}
                              >
                                {stMeta.icon} {stMeta.label}
                              </span>
                            )
                          })}
                        </div>
                      )}

                      {/* ATRIBUTOS SIMPLIFICADOS DO INIMIGO */}
                      {enemy.attributes && (
                        <div className="combat-attributes-strip">
                          {Object.keys(ATTRIBUTE_ICONS).map(attrKey => {
                            const meta = ATTRIBUTE_ICONS[attrKey]
                            const val = enemy.attributes?.[attrKey] ?? 0
                            return (
                              <div key={attrKey} className="compact-attr-tag" title={`${meta.label}: ${val}`}>
                                <span className="compact-attr-icon">{meta.icon}</span>
                                <span className="compact-attr-lbl">{meta.label}</span>
                                <span className="compact-attr-val">{val}</span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })
              ) : (
                <div className="combat-card glass-light" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  Nenhum inimigo cadastrado nesta cena.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FEED NARRATIVO RECENTE */}
      {combat.combatLog && combat.combatLog.length > 0 && (
        <div className="combat-log-ticker">
          <span className="log-ticker-icon">📜</span>
          <div className="log-ticker-content">
            <span className="log-ticker-text">
              {combat.combatLog[combat.combatLog.length - 1]?.text}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
