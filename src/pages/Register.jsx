import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { collection, doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../contexts/AuthContext.jsx'
import {
  PROFESSIONS,
  ATTRIBUTE_LIST,
  getProfessionData,
  getSpecialtyData,
  getStarterItems,
  calculateProfessionBonuses
} from '../utils/professionSystem'
import {
  TRAITS,
  PERKS,
  calculateTraitModifiers,
  validateTraitsBalance
} from '../utils/traitsSystem'
import { RARITY_META } from '../utils/itemSystem'

const TOTAL_POINTS = 15
const MIN_ATTR = 0
const MAX_ATTR = 3
const MAX_PLAYERS_PER_PROFESSION = 2

function getErrorMessage(code) {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'Este e-mail já está cadastrado.'
    case 'auth/invalid-email':
      return 'E-mail inválido.'
    case 'auth/weak-password':
      return 'Senha muito fraca. Use pelo menos 6 caracteres.'
    default:
      return 'Erro ao criar conta. Tente novamente.'
  }
}

// Componente reutilizável: Grade de Atributos (com stepper)
function AttributeGrid({ attrs, profBonuses, specBonuses, traitModifiers, onChangeAttr, remainingPoints, readOnly }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 8 }}>
      {ATTRIBUTE_LIST.map(({ key, label, icon, desc }) => {
        const baseDistributed = Number(attrs[key] || 0)
        const profBonus = profBonuses?.[key] || 0
        const specBonus = specBonuses?.[key] || 0
        const traitBonus = traitModifiers?.[key] || 0
        const netBonus = profBonus + specBonus + traitBonus
        // SEM clamp — atributos PODEM ser negativos
        const finalVal = baseDistributed + netBonus

        return (
          <div
            key={key}
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: netBonus !== 0 ? `1px solid ${netBonus > 0 ? '#22c55e' : '#ef4444'}50` : '1px solid var(--glass-border)',
              borderRadius: 8,
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            {/* Linha Superior */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 20 }}>{icon}</span>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: 12.5, color: '#fff' }}>{label}</strong>
                    {(profBonus > 0 || specBonus > 0) && (
                      <span style={{ fontSize: 9, color: '#4ade80', fontWeight: 'bold', background: 'rgba(74,222,128,0.15)', padding: '1px 4px', borderRadius: 4 }}>
                        +{profBonus + specBonus} Prof
                      </span>
                    )}
                    {traitBonus !== 0 && (
                      <span style={{ fontSize: 9, color: traitBonus > 0 ? '#4ade80' : '#ef4444', fontWeight: 'bold', background: traitBonus > 0 ? 'rgba(74,222,128,0.15)' : 'rgba(239,68,68,0.15)', padding: '1px 4px', borderRadius: 4 }}>
                        {traitBonus > 0 ? `+${traitBonus}` : traitBonus} Traço
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Stepper e Total */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                {!readOnly && (
                  <div className="attr-controls" style={{ margin: 0 }}>
                    <button
                      type="button"
                      className="attr-btn"
                      onClick={() => onChangeAttr(key, -1)}
                      disabled={baseDistributed <= MIN_ATTR}
                      title="Diminuir ponto"
                    >−</button>
                    <span className="attr-value-display" style={{ minWidth: 22, fontSize: 12, fontWeight: 700 }}>
                      {baseDistributed}
                    </span>
                    <button
                      type="button"
                      className="attr-btn"
                      onClick={() => onChangeAttr(key, 1)}
                      disabled={baseDistributed >= MAX_ATTR || remainingPoints <= 0}
                      title={baseDistributed >= MAX_ATTR ? "Limite máximo de 3 pontos no Nível 1" : "Adicionar ponto"}
                    >+</button>
                  </div>
                )}
                <div style={{ minWidth: 40, textAlign: 'right' }}>
                  <span style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: finalVal < 0 ? '#f87171' : finalVal === 0 ? 'var(--text-muted)' : netBonus > 0 ? '#4ade80' : netBonus < 0 ? '#ef4444' : 'var(--accent-yellow)'
                  }}>
                    = {finalVal}
                  </span>
                </div>
              </div>
            </div>

            {/* Linha Inferior: Descrição */}
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', lineHeight: 1.3 }}>
              {desc}
            </div>

            {/* Aviso de atributo negativo */}
            {finalVal < 0 && (
              <div style={{ fontSize: 10, color: '#f87171', background: 'rgba(239,68,68,0.08)', padding: '2px 6px', borderRadius: 4, borderLeft: '2px solid #ef4444' }}>
                ⚠️ Atributo negativo! O traço penaliza mais do que a distribuição de pontos cobre.
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// Componente reutilizável: Seletor de Traços e Vantagens (Accordions)
function TraitsPerksSelector({
  selectedTraits, selectedPerks, onToggleTrait, onTogglePerk,
  expandTraits, setExpandTraits, expandPerks, setExpandPerks,
  balanceInfo
}) {
  const traitPosCount = (selectedTraits || []).filter(tId => TRAITS[tId]?.type === 'positive').length
  const traitNegCount = (selectedTraits || []).filter(tId => TRAITS[tId]?.type === 'negative').length
  const perkPosCount = (selectedPerks || []).filter(pId => PERKS[pId]?.type === 'positive').length
  const perkNegCount = (selectedPerks || []).filter(pId => PERKS[pId]?.type === 'negative').length

  return (
    <>
      {/* Status do Balanço se Inválido */}
      {!balanceInfo.isValid && (
        <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '10px 14px', borderRadius: 8, color: '#fca5a5', fontSize: 11.5, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {balanceInfo.errors?.map((err, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>⚠️</span>
              <span>{err}</span>
            </div>
          )) || <div>⚠️ {balanceInfo.message}</div>}
        </div>
      )}

      {/* ACCORDION 1: TRAÇOS DE ATRIBUTOS (+3 / -3) */}
      <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, overflow: 'hidden', background: 'rgba(0,0,0,0.25)' }}>
        <div
          onClick={() => setExpandTraits(prev => !prev)}
          style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.03)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 16 }}>🧬</span>
            <strong style={{ fontSize: 12.5, color: '#fff', textTransform: 'uppercase' }}>Traços de Atributos (+3 / -3)</strong>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>(Máx. 3 positivos & 3 negativos)</span>
            <span style={{ fontSize: 10, background: traitPosCount === traitNegCount && traitPosCount > 0 ? 'rgba(38,200,143,0.2)' : 'rgba(255,255,255,0.06)', color: traitPosCount === traitNegCount && traitPosCount > 0 ? 'var(--accent)' : '#fff', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
              +{traitPosCount} / -{traitNegCount}
            </span>
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{expandTraits ? '▲ Recolher' : '▼ Expandir Traços'}</span>
        </div>

        {expandTraits && (
          <div style={{ padding: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            {/* Traços Positivos (+3) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ fontSize: 10.5, color: '#4ade80', fontWeight: 700, textTransform: 'uppercase' }}>Traços Positivos (+3):</span>
                <span style={{ fontSize: 9.5, color: traitPosCount > 3 ? '#ef4444' : '#4ade80', fontWeight: 700 }}>{traitPosCount}/3 máx</span>
              </div>
              {Object.values(TRAITS).filter(t => t.type === 'positive').map(trait => {
                const isSelected = selectedTraits.includes(trait.id)
                return (
                  <div
                    key={trait.id}
                    onClick={() => onToggleTrait(trait.id)}
                    style={{
                      padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
                      background: isSelected ? 'rgba(74, 222, 128, 0.18)' : 'rgba(0,0,0,0.3)',
                      border: isSelected ? '1px solid #22c55e' : '1px solid rgba(255,255,255,0.06)',
                      display: 'flex', flexDirection: 'column', gap: 3,
                      fontSize: 11, transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{trait.icon}</span>
                        <strong style={{ color: isSelected ? '#86efac' : '#fff' }}>{trait.name}</strong>
                      </div>
                      <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 700 }}>{trait.summary}</span>
                    </div>
                    {trait.description && (
                      <div style={{ fontSize: 9.5, color: isSelected ? '#dcfce7' : 'var(--text-muted)', lineHeight: 1.25 }}>
                        {trait.description}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Traços Negativos (-3) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ fontSize: 10.5, color: '#f87171', fontWeight: 700, textTransform: 'uppercase' }}>Traços Negativos (-3):</span>
                <span style={{ fontSize: 9.5, color: '#f87171', fontWeight: 700 }}>{traitNegCount} selecionado(s)</span>
              </div>
              {Object.values(TRAITS).filter(t => t.type === 'negative').map(trait => {
                const isSelected = selectedTraits.includes(trait.id)
                return (
                  <div
                    key={trait.id}
                    onClick={() => onToggleTrait(trait.id)}
                    style={{
                      padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
                      background: isSelected ? 'rgba(239, 68, 68, 0.18)' : 'rgba(0,0,0,0.3)',
                      border: isSelected ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.06)',
                      display: 'flex', flexDirection: 'column', gap: 3,
                      fontSize: 11, transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{trait.icon}</span>
                        <strong style={{ color: isSelected ? '#fca5a5' : '#fff' }}>{trait.name}</strong>
                      </div>
                      <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 700 }}>{trait.summary}</span>
                    </div>
                    {trait.description && (
                      <div style={{ fontSize: 9.5, color: isSelected ? '#fee2e2' : 'var(--text-muted)', lineHeight: 1.25 }}>
                        {trait.description}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ACCORDION 2: VANTAGENS E DESVANTAGENS (MECÂNICAS) */}
      <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, overflow: 'hidden', background: 'rgba(0,0,0,0.25)' }}>
        <div
          onClick={() => setExpandPerks(prev => !prev)}
          style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.03)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 16 }}>⚡</span>
            <strong style={{ fontSize: 12.5, color: '#fff', textTransform: 'uppercase' }}>Vantagens & Desvantagens (Mecânicas)</strong>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>(Máx. 2 vantagens & 2 desvantagens)</span>
            <span style={{ fontSize: 10, background: perkPosCount === perkNegCount && perkPosCount > 0 ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)', color: perkPosCount === perkNegCount && perkPosCount > 0 ? '#fbbf24' : '#fff', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
              +{perkPosCount} / -{perkNegCount}
            </span>
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{expandPerks ? '▲ Recolher' : '▼ Expandir Vantagens'}</span>
        </div>

        {expandPerks && (
          <div style={{ padding: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            {/* Vantagens */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ fontSize: 10.5, color: '#4ade80', fontWeight: 700, textTransform: 'uppercase' }}>Vantagens:</span>
                <span style={{ fontSize: 9.5, color: perkPosCount > 2 ? '#ef4444' : '#4ade80', fontWeight: 700 }}>{perkPosCount}/2 máx</span>
              </div>
              {Object.values(PERKS).filter(p => p.type === 'positive').map(perk => {
                const isSelected = selectedPerks.includes(perk.id)
                return (
                  <div
                    key={perk.id}
                    onClick={() => onTogglePerk(perk.id)}
                    style={{
                      padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
                      background: isSelected ? 'rgba(74, 222, 128, 0.18)' : 'rgba(0,0,0,0.3)',
                      border: isSelected ? '1px solid #22c55e' : '1px solid rgba(255,255,255,0.06)',
                      display: 'flex', flexDirection: 'column', gap: 3,
                      fontSize: 11, transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{perk.icon}</span>
                        <strong style={{ color: isSelected ? '#86efac' : '#fff' }}>{perk.name}</strong>
                      </div>
                      <span style={{ fontSize: 9.5, color: '#4ade80', textAlign: 'right' }}>{perk.summary}</span>
                    </div>
                    {perk.description && (
                      <div style={{ fontSize: 9.5, color: isSelected ? '#dcfce7' : 'var(--text-muted)', lineHeight: 1.25 }}>
                        {perk.description}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Desvantagens */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ fontSize: 10.5, color: '#f87171', fontWeight: 700, textTransform: 'uppercase' }}>Desvantagens:</span>
                <span style={{ fontSize: 9.5, color: '#f87171', fontWeight: 700 }}>{perkNegCount} selecionada(s)</span>
              </div>
              {Object.values(PERKS).filter(p => p.type === 'negative').map(perk => {
                const isSelected = selectedPerks.includes(perk.id)
                return (
                  <div
                    key={perk.id}
                    onClick={() => onTogglePerk(perk.id)}
                    style={{
                      padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
                      background: isSelected ? 'rgba(239, 68, 68, 0.18)' : 'rgba(0,0,0,0.3)',
                      border: isSelected ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.06)',
                      display: 'flex', flexDirection: 'column', gap: 3,
                      fontSize: 11, transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{perk.icon}</span>
                        <strong style={{ color: isSelected ? '#fca5a5' : '#fff' }}>{perk.name}</strong>
                      </div>
                      <span style={{ fontSize: 9.5, color: '#f87171', textAlign: 'right' }}>{perk.summary}</span>
                    </div>
                    {perk.description && (
                      <div style={{ fontSize: 9.5, color: isSelected ? '#fee2e2' : 'var(--text-muted)', lineHeight: 1.25 }}>
                        {perk.description}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// Componente reutilizável: Cards de Traços & Vantagens (modo leitura para prévia)
function TraitsPerksBadges({ traits, perks }) {
  if ((!traits || traits.length === 0) && (!perks || perks.length === 0)) return null
  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
      <span style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: 6 }}>
        Traços & Vantagens / Desvantagens Ativos:
      </span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {(traits || []).map(tId => {
          const t = TRAITS[tId]
          if (!t) return null
          const isPos = t.type === 'positive'
          return (
            <span key={tId} style={{ fontSize: 10.5, padding: '3px 8px', borderRadius: 4, background: isPos ? 'rgba(74,222,128,0.15)' : 'rgba(239,68,68,0.15)', color: isPos ? '#4ade80' : '#f87171', border: `1px solid ${isPos ? 'rgba(74,222,128,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
              {t.icon} {t.name} ({t.summary})
            </span>
          )
        })}
        {(perks || []).map(pId => {
          const p = PERKS[pId]
          if (!p) return null
          const isPos = p.type === 'positive'
          return (
            <span key={pId} style={{ fontSize: 10.5, padding: '3px 8px', borderRadius: 4, background: isPos ? 'rgba(56,189,248,0.15)' : 'rgba(245,158,11,0.15)', color: isPos ? '#38bdf8' : '#fbbf24', border: `1px solid ${isPos ? 'rgba(56,189,248,0.3)' : 'rgba(245,158,11,0.3)'}` }}>
              {p.icon} {p.name} ({p.summary})
            </span>
          )
        })}
      </div>
    </div>
  )
}

// Componente reutilizável: Grid de Atributos Finais (modo leitura para prévia)
function AttributePreviewGrid({ attrs, profBonuses, specBonuses, traitModifiers }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
      {ATTRIBUTE_LIST.map(({ key, label, icon }) => {
        const baseDistributed = Number(attrs[key] || 0)
        const profBonus = profBonuses?.[key] || 0
        const specBonus = specBonuses?.[key] || 0
        const traitBonus = traitModifiers?.[key] || 0
        const netBonus = profBonus + specBonus + traitBonus
        // SEM clamp — atributos PODEM ser negativos
        const finalVal = baseDistributed + netBonus
        return (
          <div key={key} className="character-float-attr-card" style={{ padding: '6px 4px', border: finalVal < 0 ? '1px solid rgba(239,68,68,0.4)' : undefined }}>
            <span className="character-float-attr-icon">{icon}</span>
            <span className="character-float-attr-val" style={{ fontSize: 15, color: finalVal < 0 ? '#f87171' : netBonus > 0 ? '#4ade80' : netBonus < 0 ? '#ef4444' : 'inherit' }}>
              {finalVal}
            </span>
            <span className="character-float-attr-lbl" style={{ fontSize: 9.5 }}>{label}</span>
          </div>
        )
      })}
    </div>
  )
}

// Componente reutilizável: Grid de Equipamentos Iniciais (modo leitura)
function StarterItemsGrid({ items }) {
  if (!items || items.length === 0) return null
  return (
    <div style={{ background: 'rgba(0,0,0,0.25)', padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
      <span style={{ fontSize: 10.5, color: 'var(--accent-yellow)', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: 6 }}>
        🎒 Mochila & Equipamentos Iniciais ({items.length} itens):
      </span>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 6 }}>
        {items.map((item, idx) => {
          const rMeta = RARITY_META[item.rarity] || RARITY_META.common
          return (
            <div key={idx} style={{ padding: '6px 8px', borderRadius: 6, background: 'rgba(0,0,0,0.3)', border: `1px solid ${rMeta.border || 'rgba(255,255,255,0.08)'}`, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 16 }}>{item.icon || '📦'}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                <div style={{ fontSize: 9, color: rMeta.color }}>{rMeta.label} · Qtd: {item.quantity || 1}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Register() {
  const navigate = useNavigate()
  const { register } = useAuth()

  // Steps:
  // 1: Conta (Email / Senha)
  // 2: Escolha de Modo (Ficha Pré-Pronta vs. Custom)
  // 3a (pre_made): Escolher Ficha Pré-Pronta + ajustar nome/gênero/foto
  // 3b (custom): Identidade, Profissão, Especialização, História & Ponto de Nascimento
  // 4 (ambos): Traços & Vantagens (Accordions) + Distribuição dos 15 Pontos de Atributos
  // 5 (ambos): Prévia Completa da Ficha antes de confirmar
  const [step, setStep] = useState(1)
  const [creationMode, setCreationMode] = useState('custom') // 'pre_made' | 'custom'
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Accordions
  const [expandTraitsSection, setExpandTraitsSection] = useState(true)
  const [expandPerksSection, setExpandPerksSection] = useState(true)

  // Firestore data
  const [registeredUsers, setRegisteredUsers] = useState([])
  const [preMadeSheets, setPreMadeSheets] = useState([])
  const [locations, setLocations] = useState([])
  const [customStarterConfig, setCustomStarterConfig] = useState({})

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setRegisteredUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() })))
    }, (err) => console.warn('Aviso ao consultar usuários:', err))

    const unsubSheets = onSnapshot(collection(db, 'pre_made_sheets'), (snap) => {
      setPreMadeSheets(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    }, (err) => console.warn('Aviso ao consultar fichas pré-prontas:', err))

    const unsubLocs = onSnapshot(collection(db, 'locations'), (snap) => {
      setLocations(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    }, (err) => console.warn('Aviso ao consultar locações:', err))

    const unsubStarters = onSnapshot(doc(db, 'game_config', 'starter_items'), (snap) => {
      if (snap.exists()) setCustomStarterConfig(snap.data().config || {})
    }, (err) => console.warn('Aviso ao consultar itens iniciais:', err))

    return () => { unsubUsers(); unsubSheets(); unsubLocs(); unsubStarters() }
  }, [])

  const spawnPoints = locations.filter(l => l.isSpawnPoint)
  const availableSpawnLocations = spawnPoints.length > 0 ? spawnPoints : locations

  const professionCounts = {}
  Object.keys(PROFESSIONS).forEach(pId => { professionCounts[pId] = 0 })
  registeredUsers.forEach(u => {
    const pId = u.character?.profession?.id || (typeof u.character?.profession === 'string' ? u.character.profession : null)
    if (pId && professionCounts[pId] !== undefined) professionCounts[pId] += 1
  })

  // ─── Step 1 ───────────────────────────────────────────────────────────────
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // ─── Compartilhado por ambos os modos (Traços, Vantagens, Atributos Distribuídos) ───
  const [selectedTraits, setSelectedTraits] = useState([])
  const [selectedPerks, setSelectedPerks] = useState([])
  const [attrs, setAttrs] = useState({
    forca: 0, destreza: 0, agilidade: 0, sabedoria: 0,
    percepcao: 0, inteligencia: 0, carisma: 0, constituicao: 0,
  })

  // ─── Modo Ficha Pré-Pronta ─────────────────────────────────────────────────
  const [selectedSheetId, setSelectedSheetId] = useState('')
  const [preMadeName, setPreMadeName] = useState('')
  const [preMadeAvatarUrl, setPreMadeAvatarUrl] = useState('')

  // ─── Modo Personagem Próprio ───────────────────────────────────────────────
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [backstory, setBackstory] = useState('')
  const [selectedProfId, setSelectedProfId] = useState(() => Object.keys(PROFESSIONS)[0] || 'militar')
  const [selectedSpecId, setSelectedSpecId] = useState('policial')
  const [selectedSpawnLocation, setSelectedSpawnLocation] = useState('')

  useEffect(() => {
    if (!selectedSpawnLocation && availableSpawnLocations.length > 0) {
      setSelectedSpawnLocation(availableSpawnLocations[0].slug || availableSpawnLocations[0].id)
    }
  }, [availableSpawnLocations, selectedSpawnLocation])

  // ─── Derivados: Modo Custom ────────────────────────────────────────────────
  const usedPoints = Object.values(attrs).reduce((a, b) => a + Number(b), 0)
  const remainingPoints = TOTAL_POINTS - usedPoints
  const traitModifiers = calculateTraitModifiers(selectedTraits)
  const balanceInfo = validateTraitsBalance(selectedTraits, selectedPerks)

  const selectedProfData = getProfessionData(selectedProfId)
  const selectedSpecData = getSpecialtyData(selectedProfId, selectedSpecId)
  const profBonuses = calculateProfessionBonuses(selectedProfId, selectedSpecId)
  const starterEquipment = getStarterItems(selectedProfId, selectedSpecId, customStarterConfig)

  // HP calculado para modo custom (CON pode ser negativa → HP < 100)
  const totalConstitutionCustom = Number(attrs.constituicao || 0) + Number(profBonuses.constituicao || 0) + Number(traitModifiers.constituicao || 0)
  const calculatedMaxHpCustom = 100 + (totalConstitutionCustom * 5)

  // ─── Derivados: Ficha Pré-Pronta ──────────────────────────────────────────
  const selectedSheet = preMadeSheets.find(s => s.id === selectedSheetId)

  // Para a ficha pré-pronta, profissão/especialização vêm da ficha mas traços são escolhidos pelo jogador
  const preMadeProfId = selectedSheet?.profession?.id || selectedSheet?.profession || null
  const preMadeSpecId = selectedSheet?.specialty?.id || selectedSheet?.specialty || null
  const preMadeProfBonuses = preMadeProfId ? calculateProfessionBonuses(preMadeProfId, preMadeSpecId) : {}
  const preMadeSpecData = preMadeProfId ? getSpecialtyData(preMadeProfId, preMadeSpecId) : null
  const preMadeStarterItems = preMadeProfId ? getStarterItems(preMadeProfId, preMadeSpecId, customStarterConfig) : (selectedSheet?.inventory || [])

  // Constituição do personagem pré-pronto = pontos distribuídos + bônus da ficha + traço
  const preMadeBaseConFromSheet = Number(selectedSheet?.baseAttributes?.constituicao ?? selectedSheet?.attributes?.constituicao ?? 1)
  const totalConstitutionPreMade = Number(attrs.constituicao || 0) + Number(preMadeProfBonuses?.constituicao || 0) + Number(traitModifiers.constituicao || 0)
  const calculatedMaxHpPreMade = 100 + (totalConstitutionPreMade * 5)

  // Nome legível dos locais
  const preMadeSpawnLocObj = locations.find(l => (l.slug || l.id) === (selectedSheet?.startingLocation || 'sala-hospital'))
  const preMadeSpawnName = preMadeSpawnLocObj ? preMadeSpawnLocObj.name : 'Hospital Central de Varezhia'
  const customSpawnLocObj = locations.find(l => (l.slug || l.id) === selectedSpawnLocation)
  const customSpawnName = customSpawnLocObj ? customSpawnLocObj.name : (selectedSpawnLocation || 'Hospital Central de Varezhia')

  // ─── Helpers ──────────────────────────────────────────────────────────────
  function changeAttr(key, delta) {
    setAttrs((prev) => {
      const current = Number(prev[key] || 0)
      const next = current + delta
      if (next < MIN_ATTR || next > MAX_ATTR) return prev
      if (delta > 0 && remainingPoints <= 0) return prev
      return { ...prev, [key]: next }
    })
  }

  function toggleTrait(traitId) {
    const trait = TRAITS[traitId]
    if (!trait) return

    // Se está tentando ATIVAR um traço, verifica conflito com o traço opostor da mesma attrKey
    if (!selectedTraits.includes(traitId)) {
      const opposingType = trait.type === 'positive' ? 'negative' : 'positive'
      const conflict = Object.values(TRAITS).find(
        t => t.attrKey === trait.attrKey && t.type === opposingType && selectedTraits.includes(t.id)
      )
      if (conflict) {
        alert(`⚠️ Conflito! O traço "${trait.name}" e "${conflict.name}" afetam o mesmo atributo (${conflict.summary.replace(/[+-]3 /, '')}) e se anulam mutuamente. Remova "${conflict.name}" primeiro para poder escolher "${trait.name}".`)
        return
      }
    }

    setSelectedTraits(prev => prev.includes(traitId) ? prev.filter(t => t !== traitId) : [...prev, traitId])
  }

  function togglePerk(perkId) {
    const perk = PERKS[perkId]
    if (!perk) return

    // Se está tentando ATIVAR uma vantagem/desvantagem, verifica conflito com a oposta
    if (!selectedPerks.includes(perkId)) {
      // Pares de conflito conhecidos (mesma mecânica, efeito oposto)
      const PERK_CONFLICTS = {
        hidratado:        'sedento',
        sedento:          'hidratado',
        estomago_pequeno: 'faminto',
        faminto:          'estomago_pequeno',
        sortudo:          'azarado',
        azarado:          'sortudo',
        alta_imunidade:   'baixa_imunidade',
        baixa_imunidade:  'alta_imunidade',
        pele_grossa:      'pele_fragil',
        pele_fragil:      'pele_grossa',
      }
      const conflictId = PERK_CONFLICTS[perkId]
      if (conflictId && selectedPerks.includes(conflictId)) {
        const conflict = PERKS[conflictId]
        alert(`⚠️ Conflito! "${perk.name}" e "${conflict?.name || conflictId}" têm efeitos opostos e se anulam mutuamente. Remova "${conflict?.name || conflictId}" primeiro para poder escolher "${perk.name}".`)
        return
      }
    }

    setSelectedPerks(prev => prev.includes(perkId) ? prev.filter(p => p !== perkId) : [...prev, perkId])
  }

  function handleSelectProf(profId) {
    if ((professionCounts[profId] || 0) >= MAX_PLAYERS_PER_PROFESSION) {
      alert(`A profissão ${PROFESSIONS[profId]?.name || profId} está lotada (${MAX_PLAYERS_PER_PROFESSION}/${MAX_PLAYERS_PER_PROFESSION} vagas). Escolha outra.`)
      return
    }
    setSelectedProfId(profId)
    const prof = PROFESSIONS[profId]
    if (prof?.specialties) setSelectedSpecId(Object.keys(prof.specialties)[0])
  }

  // ─── Handlers de Navegação ─────────────────────────────────────────────────
  function handleStep1(e) {
    e.preventDefault()
    setError('')
    if (password !== confirmPassword) { setError('As senhas não coincidem.'); return }
    if (password.length < 6) { setError('A senha deve ter pelo menos 6 caracteres.'); return }
    setStep(2)
  }

  function handleSelectMode(mode) {
    setCreationMode(mode)
    // Reset traços/atributos ao trocar de modo
    setSelectedTraits([])
    setSelectedPerks([])
    setAttrs({ forca: 0, destreza: 0, agilidade: 0, sabedoria: 0, percepcao: 0, inteligencia: 0, carisma: 0, constituicao: 0 })
    if (mode === 'pre_made') {
      const available = preMadeSheets.filter(s => s.available !== false && !s.claimedBy)
      if (available.length > 0) {
        setSelectedSheetId(available[0].id)
        setPreMadeName(available[0].defaultName || available[0].title || '')
        setPreMadeAvatarUrl(available[0].avatarUrl || '')
      }
    }
    setStep(3)
  }

  function handleStep3PreMade(e) {
    e.preventDefault()
    setError('')
    if (!selectedSheet) { setError('Selecione uma ficha pré-pronta disponível.'); return }
    if (!preMadeName.trim()) { setError('Informe o nome do seu personagem.'); return }
    setStep(4)
  }

  function handleStep3Custom(e) {
    e.preventDefault()
    setError('')
    if (!name.trim()) { setError('Informe o nome do personagem.'); return }
    if (!age || isNaN(age) || age < 1 || age > 120) { setError('Informe uma idade válida.'); return }
    if (!selectedProfId || !selectedSpecId) { setError('Selecione uma profissão e especialização.'); return }
    if (!backstory.trim()) { setError('Escreva a história do seu personagem.'); return }
    const count = professionCounts[selectedProfId] || 0
    if (count >= MAX_PLAYERS_PER_PROFESSION) {
      setError(`A profissão ${PROFESSIONS[selectedProfId]?.name} está lotada. Escolha outra.`)
      return
    }
    setStep(4)
  }

  function handleStep4(e) {
    e.preventDefault()
    setError('')
    if (!balanceInfo.isValid) { setError(balanceInfo.message); return }
    if (remainingPoints > 0) {
      if (!confirm(`Você ainda tem ${remainingPoints} ponto(s) não distribuídos (de 15). Continuar mesmo assim?`)) return
    }
    setStep(5)
  }

  // ─── Registro Final: Ficha Pré-Pronta ─────────────────────────────────────
  async function handleRegisterPreMadeFinal() {
    setError('')
    setLoading(true)
    const spawnLoc = selectedSheet.startingLocation || 'sala-hospital'

    // Calcula atributos finais = pontos distribuídos pelo jogador + bônus da profissão da ficha + traços
    const finalAttributes = {}
    ATTRIBUTE_LIST.forEach(({ key }) => {
      const baseVal = Number(attrs[key] || 0)
      const profBonusVal = Number(preMadeProfBonuses?.[key] || 0)
      const traitBonusVal = Number(traitModifiers[key] || 0)
      // SEM clamp — pode ser negativo
      finalAttributes[key] = baseVal + profBonusVal + traitBonusVal
    })

    try {
      await register(email, password, {
        name: preMadeName.trim(),
        age: Number(selectedSheet.age || 30),
        avatarUrl: preMadeAvatarUrl.trim() || selectedSheet.avatarUrl || null,
        backstory: selectedSheet.backstory || '',
        preMadeSheetId: selectedSheet.id,
        profession: selectedSheet.profession,
        specialty: selectedSheet.specialty,
        currentLocation: spawnLoc,
        rublos: 200,
        traits: selectedTraits,
        perks: selectedPerks,
        // Pontos distribuídos (atributos base sem bônus)
        forca: attrs.forca, destreza: attrs.destreza, agilidade: attrs.agilidade,
        sabedoria: attrs.sabedoria, percepcao: attrs.percepcao, inteligencia: attrs.inteligencia,
        carisma: attrs.carisma, constituicao: attrs.constituicao,
        attributes: finalAttributes,
        baseAttributes: { ...attrs },
        inventory: preMadeStarterItems,
      })
      navigate(`/location/${spawnLoc}`)
    } catch (err) {
      setError(getErrorMessage(err.code))
      setStep(1)
    } finally {
      setLoading(false)
    }
  }

  // ─── Registro Final: Personagem Próprio ───────────────────────────────────
  async function handleRegisterCustomFinal() {
    setError('')
    setLoading(true)

    const finalAttributes = {}
    ATTRIBUTE_LIST.forEach(({ key }) => {
      const baseVal = Number(attrs[key] || 0)
      const profBonusVal = Number(profBonuses[key] || 0)
      const traitBonusVal = Number(traitModifiers[key] || 0)
      // SEM clamp — pode ser negativo
      finalAttributes[key] = baseVal + profBonusVal + traitBonusVal
    })

    const spawnLoc = selectedSpawnLocation || (availableSpawnLocations[0]?.slug || 'sala-hospital')

    try {
      await register(email, password, {
        name: name.trim(),
        age: Number(age),
        avatarUrl: avatarUrl.trim() || null,
        backstory: backstory.trim(),
        currentLocation: spawnLoc,
        rublos: 200,
        traits: selectedTraits,
        perks: selectedPerks,
        profession: { id: selectedProfId, name: selectedProfData?.name || selectedProfId, icon: selectedProfData?.icon || '🪖', bonusSummary: selectedProfData?.bonusSummary || '' },
        specialty: { id: selectedSpecId, name: selectedSpecData?.name || selectedSpecId, icon: selectedSpecData?.icon || '⭐', bonusSummary: selectedSpecData?.bonusSummary || '', proficiency: selectedSpecData?.proficiency || '', abilities: selectedSpecData?.abilities || [] },
        forca: attrs.forca, destreza: attrs.destreza, agilidade: attrs.agilidade,
        sabedoria: attrs.sabedoria, percepcao: attrs.percepcao, inteligencia: attrs.inteligencia,
        carisma: attrs.carisma, constituicao: attrs.constituicao,
        attributes: finalAttributes,
        baseAttributes: { ...attrs },
        inventory: starterEquipment,
      })
      navigate(`/location/${spawnLoc}`)
    } catch (err) {
      setError(getErrorMessage(err.code))
      setStep(1)
    } finally {
      setLoading(false)
    }
  }

  // ─── Derivados para o Passo 5 Unificado ───────────────────────────────────
  const isPreMade = creationMode === 'pre_made'
  const previewName = isPreMade ? preMadeName : name
  const previewAge = isPreMade ? (selectedSheet?.age || 30) : age
  const previewAvatar = isPreMade ? (preMadeAvatarUrl || selectedSheet?.avatarUrl || null) : avatarUrl
  const previewProfData = isPreMade ? getProfessionData(preMadeProfId) : selectedProfData
  const previewSpecData = isPreMade ? preMadeSpecData : selectedSpecData
  const previewProfBonuses = isPreMade ? preMadeProfBonuses : profBonuses
  const previewSpecBonuses = {}
  const previewSpawnName = isPreMade ? preMadeSpawnName : customSpawnName
  const previewBackstory = isPreMade ? (selectedSheet?.backstory || '') : backstory
  const previewItems = isPreMade ? preMadeStarterItems : starterEquipment
  const previewMaxHp = isPreMade ? calculatedMaxHpPreMade : calculatedMaxHpCustom

  // ─── RENDER ───────────────────────────────────────────────────────────────
  const totalSteps = creationMode === 'custom' ? [1, 2, 3, 4, 5] : [1, 2, 3, 4, 5]

  return (
    <div className="register-page" style={{ padding: '30px 16px', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="register-box" style={{ maxWidth: step >= 2 ? '960px' : '480px', width: '100%', transition: 'max-width 0.3s ease' }}>
        {/* Logo */}
        <div style={{ padding: '24px 28px 0', textAlign: 'center' }}>
          <div className="auth-logo" style={{ marginBottom: 0 }}>
            <h1 style={{ fontFamily: 'Oswald', letterSpacing: 3 }}>ZONA ZERO</h1>
            <p style={{ letterSpacing: 2, fontSize: 11, color: 'var(--accent-yellow)' }}>REGISTRO DE SOBREVIVENTE</p>
          </div>
        </div>

        {/* Indicadores de etapa: Números */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, margin: '20px 28px 4px' }}>
          {totalSteps.map(num => {
            const isActive = step === num
            const isDone = step > num
            return (
              <div key={num} style={{
                width: 34, height: 34, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 800, fontFamily: 'Oswald, sans-serif',
                transition: 'all 0.2s ease',
                background: isActive ? 'var(--accent)' : isDone ? 'rgba(38, 200, 143, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                color: isActive ? '#000' : isDone ? '#4ade80' : 'var(--text-muted)',
                border: isActive ? '2px solid #fff' : isDone ? '1px solid #22c55e' : '1px solid var(--glass-border)',
                boxShadow: isActive ? '0 0 12px rgba(38, 200, 143, 0.5)' : 'none'
              }}>
                {isDone ? '✓' : num}
              </div>
            )
          })}
        </div>

        <div className="register-content" style={{ padding: '20px 28px 28px' }}>
          {error && <div className="form-error" style={{ marginBottom: 16 }}>{error}</div>}

          {/* ================================================================ */}
          {/* ETAPA 1: Dados de conta */}
          {/* ================================================================ */}
          {step === 1 && (
            <form onSubmit={handleStep1}>
              <div className="form-group">
                <label>E-mail</label>
                <input type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              </div>
              <div className="form-group">
                <label>Senha</label>
                <input type="password" placeholder="Mínimo 6 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
              </div>
              <div className="form-group">
                <label>Confirmar Senha</label>
                <input type="password" placeholder="Repita a senha" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required autoComplete="new-password" />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px', marginTop: 8 }}>
                Continuar para Criação do Personagem →
              </button>
              <div className="form-link" style={{ marginTop: 16 }}>
                Já tem conta? <Link to="/login">Fazer login</Link>
              </div>
            </form>
          )}

          {/* ================================================================ */}
          {/* ETAPA 2: Escolha de Método */}
          {/* ================================================================ */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ textAlign: 'center', marginBottom: 6 }}>
                <h3 style={{ fontSize: 16, textTransform: 'uppercase', color: 'var(--accent-yellow)', margin: '0 0 6px' }}>Como você deseja ingressar no RPG?</h3>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
                  Escolha se prefere assumir um personagem com história já integrada à trama ou forjar seu próprio sobrevivente.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Ficha Pré-Pronta */}
                <div onClick={() => handleSelectMode('pre_made')} className="hover-card"
                  style={{ background: 'rgba(52, 211, 153, 0.05)', border: '2px solid rgba(52, 211, 153, 0.3)', borderRadius: 12, padding: '24px 20px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12, transition: 'all 0.2s ease' }}>
                  <span style={{ fontSize: 44 }}>📋</span>
                  <div>
                    <h4 style={{ fontSize: 16, color: '#34d399', margin: '0 0 6px', fontWeight: 800 }}>Ficha Pré-Pronta</h4>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
                      Personagem com história, profissão e especialização pré-definidas pelo Mestre. Você personaliza nome, gênero e foto — e ainda distribui seus 15 pontos de atributos e escolhe traços!
                    </p>
                  </div>
                  <div style={{ background: 'rgba(52, 211, 153, 0.12)', border: '1px solid rgba(52, 211, 153, 0.3)', padding: '6px 12px', borderRadius: 6, fontSize: 11, color: '#6ee7b7' }}>
                    ✨ Nome, gênero e foto são seus. Traços e atributos também!
                  </div>
                  <button type="button" className="btn" style={{ width: '100%', marginTop: 'auto', background: 'rgba(52, 211, 153, 0.2)', color: '#34d399', borderColor: '#34d399', fontWeight: 700 }}>
                    Escolher Ficha Pronta →
                  </button>
                </div>

                {/* Montar Personagem Próprio */}
                <div onClick={() => handleSelectMode('custom')} className="hover-card"
                  style={{ background: 'rgba(56, 189, 248, 0.05)', border: '2px solid rgba(56, 189, 248, 0.3)', borderRadius: 12, padding: '24px 20px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12, transition: 'all 0.2s ease' }}>
                  <span style={{ fontSize: 44 }}>⚙️</span>
                  <div>
                    <h4 style={{ fontSize: 16, color: '#38bdf8', margin: '0 0 6px', fontWeight: 800 }}>Montar Personagem Próprio</h4>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
                      Crie seu sobrevivente do zero. Escreva sua história, escolha profissão, especialização, local de nascimento, traços e distribua 15 pontos.
                    </p>
                  </div>
                  <div style={{ background: 'rgba(56, 189, 248, 0.12)', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '6px 12px', borderRadius: 6, fontSize: 11, color: '#7dd3fc' }}>
                    🎨 200 Rublos iniciais + Traços e Vantagens/Desvantagens
                  </div>
                  <button type="button" className="btn" style={{ width: '100%', marginTop: 'auto', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', borderColor: '#38bdf8', fontWeight: 700 }}>
                    Criar do Zero →
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 10 }}>
                <button type="button" className="btn" onClick={() => setStep(1)} style={{ padding: '8px 16px' }}>← Voltar</button>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* ETAPA 3 (PRÉ-PRONTA): Escolher Ficha + Nome/Gênero/Foto */}
          {/* ================================================================ */}
          {step === 3 && creationMode === 'pre_made' && (
            <form onSubmit={handleStep3PreMade} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={{ fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', color: '#34d399', display: 'block', marginBottom: 8, fontWeight: 700 }}>
                  Selecione uma Ficha Pré-Pronta Disponível:
                </label>

                {preMadeSheets.filter(s => s.available !== false && !s.claimedBy).length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', background: 'rgba(0,0,0,0.3)', borderRadius: 10, border: '1px dashed var(--glass-border)', color: 'var(--text-muted)' }}>
                    <p style={{ margin: 0, fontSize: 13 }}>Nenhuma ficha pré-pronta disponível no momento.</p>
                    <button type="button" onClick={() => { setCreationMode('custom'); setStep(3) }} style={{ marginTop: 10, background: 'none', border: 'none', color: 'var(--accent)', textDecoration: 'underline', cursor: 'pointer', fontSize: 12 }}>
                      Clique aqui para montar seu personagem próprio
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
                    {preMadeSheets.filter(s => s.available !== false && !s.claimedBy).map(sheet => {
                      const isSelected = selectedSheetId === sheet.id
                      const pObj = sheet.profession || {}
                      const sObj = sheet.specialty || {}
                      const spawnLocMatch = locations.find(l => (l.slug || l.id) === (sheet.startingLocation || 'sala-hospital'))
                      const cardSpawnName = spawnLocMatch ? spawnLocMatch.name : 'Hospital Central de Varezhia'
                      return (
                        <div key={sheet.id} onClick={() => { setSelectedSheetId(sheet.id); setPreMadeName(sheet.defaultName || sheet.title || ''); setPreMadeAvatarUrl(sheet.avatarUrl || '') }}
                          style={{ background: isSelected ? 'rgba(52, 211, 153, 0.15)' : 'rgba(255,255,255,0.02)', border: isSelected ? '2px solid #34d399' : '1px solid var(--glass-border)', borderRadius: 10, padding: 12, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8, transition: 'all 0.15s ease' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 8, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
                              {sheet.avatarUrl ? <img src={sheet.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.onerror = null; e.target.src = '' }} /> : <span>{pObj.icon || '👤'}</span>}
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <strong style={{ fontSize: 13, color: isSelected ? '#34d399' : '#fff', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sheet.title}</strong>
                              <span style={{ fontSize: 11, color: 'var(--accent-yellow)' }}>{pObj.icon} {pObj.name} · {sObj.name}</span>
                            </div>
                          </div>
                          <div style={{ fontSize: 10.5, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span>📍</span> Nasce em: <strong style={{ color: '#fff' }}>{cardSpawnName}</strong>
                          </div>
                          <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {sheet.backstory}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Detalhe da Ficha Selecionada */}
              {selectedSheet && (
                <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(52, 211, 153, 0.3)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 24 }}>{selectedSheet.profession?.icon || '👤'}</span>
                      <div>
                        <strong style={{ fontSize: 15, color: '#34d399' }}>{selectedSheet.title}</strong>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                          {selectedSheet.profession?.name} · {selectedSheet.specialty?.name} · {selectedSheet.age} anos · <span style={{ color: '#facc15' }}>200 Rublos</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div style={{ textAlign: 'right', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '4px 8px', borderRadius: 6 }}>
                        <span style={{ fontSize: 9.5, color: '#38bdf8', textTransform: 'uppercase', display: 'block' }}>📍 Local de Nascimento</span>
                        <strong style={{ fontSize: 12, color: '#fff' }}>{preMadeSpawnName}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Bônus Profissão/Especialização */}
                  {(selectedSheet.profession?.bonusSummary || selectedSheet.specialty?.bonusSummary) && (
                    <div style={{ background: 'rgba(234, 179, 8, 0.08)', border: '1px solid rgba(234, 179, 8, 0.25)', padding: '8px 12px', borderRadius: 8 }}>
                      <span style={{ fontSize: 10.5, color: '#facc15', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: 3 }}>✨ Bônus Concedidos por esta Ficha:</span>
                      <div style={{ fontSize: 12, color: '#fff', display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                        {selectedSheet.profession?.bonusSummary && <span>🎖️ <strong>Profissão:</strong> <span style={{ color: '#4ade80' }}>{selectedSheet.profession.bonusSummary}</span></span>}
                        {selectedSheet.specialty?.bonusSummary && <span>⭐ <strong>Especialidade:</strong> <span style={{ color: '#4ade80' }}>{selectedSheet.specialty.bonusSummary}</span></span>}
                      </div>
                    </div>
                  )}

                  {/* Equipamentos Iniciais Dinâmicos da Especialidade */}
                  {preMadeStarterItems.length > 0 && (
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--glass-border)' }}>
                      <span style={{ fontSize: 10, color: 'var(--accent-yellow)', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                        🎒 Equipamentos Iniciais ({preMadeStarterItems.length}):
                      </span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {preMadeStarterItems.map((item, idx) => (
                          <span key={idx} style={{ fontSize: 10, background: 'rgba(0,0,0,0.4)', padding: '2px 6px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.08)' }}>
                            {item.icon || '📦'} {item.name} {item.quantity > 1 ? `x${item.quantity}` : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Biografia */}
                  <div style={{ background: 'rgba(255,255,255,0.02)', padding: 10, borderRadius: 8, border: '1px solid var(--glass-border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 10.5, color: 'var(--accent-yellow)', textTransform: 'uppercase', fontWeight: 700 }}>📜 Biografia & Passado Base (Pré-definida):</span>
                      <span style={{ fontSize: 10, color: '#4ade80' }}>🔒 Apenas a staff terá acesso</span>
                    </div>
                    <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.45, maxHeight: 120, overflowY: 'auto' }}>
                      {selectedSheet.backstory}
                    </p>
                  </div>

                  {/* Aviso sobre atributos e traços */}
                  <div style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.25)', padding: '8px 12px', borderRadius: 8 }}>
                    <span style={{ fontSize: 11, color: '#7dd3fc', lineHeight: 1.4, display: 'block' }}>
                      ℹ️ <strong>No próximo passo</strong> você irá distribuir <strong>15 pontos de atributos</strong> e escolher seus <strong>traços e vantagens/desvantagens</strong> — assim como no modo personalizado.
                    </span>
                  </div>

                  {/* Campos: Nome, Gênero e Foto */}
                  <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: 12 }}>
                    <span style={{ fontSize: 11, color: 'var(--accent)', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: 8 }}>✨ Personalize: Nome, Gênero e Foto de Perfil:</span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: 11 }}>Nome do seu Personagem</label>
                        <input type="text" value={preMadeName} onChange={e => setPreMadeName(e.target.value)} required style={{ padding: '8px 10px', fontSize: 12 }} />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: 11 }}>Link da Foto/Avatar (URL)</label>
                        <input type="url" placeholder="https://..." value={preMadeAvatarUrl} onChange={e => setPreMadeAvatarUrl(e.target.value)} style={{ padding: '8px 10px', fontSize: 12 }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" className="btn" style={{ flex: 1 }} onClick={() => setStep(2)}>← Voltar</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2, padding: '12px' }} disabled={!selectedSheet}>
                  Avançar para Traços & Atributos →
                </button>
              </div>
            </form>
          )}

          {/* ================================================================ */}
          {/* ETAPA 3 (CUSTOM): Identidade, Profissão, Especialização, História & Spawn */}
          {/* ================================================================ */}
          {step === 3 && creationMode === 'custom' && (
            <form onSubmit={handleStep3Custom} style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
              {/* Identidade */}
              <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 16, alignItems: 'center' }}>
                <div className="avatar-preview" style={{ width: 90, height: 90, borderRadius: 12, margin: '0 auto', overflow: 'hidden', border: '2px solid var(--accent-yellow)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}>
                  {avatarUrl.trim() ? (
                    <img src={avatarUrl.trim()} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.onerror = null; e.target.src = '' }} />
                  ) : (
                    <span style={{ fontSize: 36 }}>{selectedProfData?.icon || '👤'}</span>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 10 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label>Nome do Personagem</label>
                      <input type="text" placeholder="Ex: Marcus Miller" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label>Idade</label>
                      <input type="number" placeholder="32" value={age} onChange={(e) => setAge(e.target.value)} min={1} max={120} required />
                    </div>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label style={{ fontSize: 10 }}>Link da Foto/Avatar (Opcional)</label>
                    <input type="url" placeholder="https://exemplo.com/foto.jpg" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} style={{ padding: '6px 10px', fontSize: 11 }} />
                  </div>
                </div>
              </div>

              {/* Profissão */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--accent)', margin: 0, fontWeight: 700 }}>
                    1. Escolha sua Profissão (Limite de 2 por Profissão)
                  </label>
                  <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Vagas em tempo real</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8 }}>
                  {Object.values(PROFESSIONS).map((prof) => {
                    const isSelected = selectedProfId === prof.id
                    const count = professionCounts[prof.id] || 0
                    const remainingSlots = Math.max(0, MAX_PLAYERS_PER_PROFESSION - count)
                    const isFull = count >= MAX_PLAYERS_PER_PROFESSION
                    return (
                      <button key={prof.id} type="button" onClick={() => handleSelectProf(prof.id)} disabled={isFull}
                        style={{ background: isSelected ? 'rgba(38, 200, 143, 0.18)' : isFull ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.03)', border: isSelected ? '2px solid var(--accent)' : isFull ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid var(--glass-border)', borderRadius: 8, padding: '10px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: isFull ? 'not-allowed' : 'pointer', opacity: isFull ? 0.45 : 1, transition: 'all 0.15s ease', transform: isSelected ? 'scale(1.02)' : 'none' }}>
                        <span style={{ fontSize: 24 }}>{prof.icon}</span>
                        <strong style={{ fontSize: 12, color: isSelected ? '#fff' : isFull ? 'var(--text-muted)' : 'var(--text-primary)' }}>{prof.name}</strong>
                        <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: isFull ? 'rgba(239, 68, 68, 0.2)' : remainingSlots === 1 ? 'rgba(234, 179, 8, 0.2)' : 'rgba(34, 197, 94, 0.15)', color: isFull ? '#f87171' : remainingSlots === 1 ? '#facc15' : '#4ade80' }}>
                          {isFull ? 'Lotado (2/2)' : `${remainingSlots} vaga${remainingSlots > 1 ? 's' : ''}`}
                        </span>
                        <span style={{ fontSize: 9.5, color: 'var(--accent-yellow)', fontWeight: 600 }}>{prof.bonusSummary}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Descrição da Profissão */}
              {selectedProfData && (
                <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: 8, padding: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 20 }}>{selectedProfData.icon}</span>
                    <strong style={{ fontSize: 14, color: 'var(--accent)' }}>{selectedProfData.name}</strong>
                    <span style={{ fontSize: 11, background: 'rgba(255, 193, 7, 0.2)', color: '#fbbf24', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>Bônus Geral: {selectedProfData.bonusSummary}</span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>{selectedProfData.description}</p>
                </div>
              )}

              {/* Especialização */}
              {selectedProfData && (
                <div>
                  <label style={{ fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--accent-yellow)', display: 'block', marginBottom: 8, fontWeight: 700 }}>
                    2. Escolha sua Especialização ({selectedProfData.name})
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                    {Object.values(selectedProfData.specialties).map((spec) => {
                      const isSelected = selectedSpecId === spec.id
                      const customItemsForSpec = customStarterConfig[`${selectedProfId}_${spec.id}`] || spec.starterItems || []
                      return (
                        <div key={spec.id} onClick={() => setSelectedSpecId(spec.id)}
                          style={{ background: isSelected ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255,255,255,0.02)', border: isSelected ? '2px solid #f59e0b' : '1px solid var(--glass-border)', borderRadius: 10, padding: 12, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6, transition: 'all 0.15s ease' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 18 }}>{spec.icon}</span>
                              <strong style={{ fontSize: 13, color: isSelected ? '#f59e0b' : '#fff' }}>{spec.name}</strong>
                            </div>
                            <span style={{ fontSize: 11, color: '#4ade80', fontWeight: 'bold', background: 'rgba(74, 222, 128, 0.15)', padding: '2px 6px', borderRadius: 4 }}>{spec.bonusSummary}</span>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}><strong style={{ color: 'var(--text-secondary)' }}>Proficiência:</strong> {spec.proficiency}</div>
                          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 10.5, color: 'var(--text-secondary)', lineHeight: 1.3 }}>
                            {spec.abilities.map((ab, i) => <li key={i}>{ab}</li>)}
                          </ul>
                          <div style={{ marginTop: 4, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                            <span style={{ fontSize: 10, color: 'var(--accent-yellow)', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: 4 }}>🎒 Equipamentos Iniciais ({customItemsForSpec.length}):</span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {customItemsForSpec.map((item, idx) => (
                                <span key={idx} style={{ fontSize: 10, background: 'rgba(0,0,0,0.4)', padding: '2px 6px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.08)' }}>
                                  {item.icon || '📦'} {item.name} {item.quantity > 1 ? `x${item.quantity}` : ''}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* História */}
              <div style={{ width: '100%', background: 'rgba(0,0,0,0.25)', padding: 16, borderRadius: 10, border: '1px solid rgba(234, 179, 8, 0.3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 4 }}>
                  <label style={{ fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--accent-yellow)', margin: 0, fontWeight: 800 }}>3. História do Personagem</label>
                  <span style={{ fontSize: 11, color: '#4ade80' }}>🔒 Apenas a staff terá acesso</span>
                </div>
                <textarea rows={6} placeholder="Escreva a história e biografia do seu sobrevivente..." value={backstory} onChange={(e) => setBackstory(e.target.value)} required
                  style={{ width: '100%', minHeight: '130px', padding: '12px 14px', fontSize: 12.5, lineHeight: 1.5, background: 'rgba(0,0,0,0.4)', border: '1px solid var(--glass-border)', borderRadius: 8, color: '#fff', resize: 'vertical', fontFamily: 'inherit' }} />
              </div>

              {/* Ponto de Spawn */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: '#38bdf8', margin: 0, fontWeight: 700 }}>4. Local de Nascimento / Ponto de Partida</label>
                  <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>Onde sua jornada se inicia</span>
                </div>
                {availableSpawnLocations.length === 0 ? (
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 8, border: '1px solid var(--glass-border)', fontSize: 12, color: 'var(--text-secondary)' }}>
                    📍 <strong>Hospital Central de Varezhia</strong> — Ponto de partida padrão.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
                    {availableSpawnLocations.map(loc => {
                      const locKey = loc.slug || loc.id
                      const isSelected = selectedSpawnLocation === locKey
                      return (
                        <div key={locKey} onClick={() => setSelectedSpawnLocation(locKey)}
                          style={{ background: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.02)', border: isSelected ? '2px solid #38bdf8' : '1px solid var(--glass-border)', borderRadius: 8, padding: 12, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4, transition: 'all 0.15s ease' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 18 }}>📍</span>
                            <strong style={{ fontSize: 13, color: isSelected ? '#38bdf8' : '#fff' }}>{loc.name}</strong>
                          </div>
                          {loc.description && <p style={{ fontSize: 10.5, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{loc.description}</p>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button type="button" className="btn" style={{ flex: 1 }} onClick={() => setStep(2)}>← Voltar</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2, padding: '12px' }}>Avançar para Traços & Atributos →</button>
              </div>
            </form>
          )}

          {/* ================================================================ */}
          {/* ETAPA 4 (AMBOS OS MODOS): Traços, Vantagens e Distribuição de Atributos */}
          {/* ================================================================ */}
          {step === 4 && (
            <form onSubmit={handleStep4} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Header */}
              <div style={{ background: 'rgba(0,0,0,0.35)', padding: 12, borderRadius: 10, border: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <h3 style={{ fontSize: 14, textTransform: 'uppercase', color: 'var(--accent-yellow)', margin: '0 0 2px', fontWeight: 800 }}>
                    Traços, Vantagens & Atributos
                  </h3>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>
                    {isPreMade
                      ? `Personagem: ${selectedSheet?.title || ''} — Distribua os 15 pontos e escolha seus traços (opcionais).`
                      : 'Escolha seus traços opcionais (1 positivo = 1 negativo) e distribua 15 pontos de atributos.'}
                  </p>
                </div>
                {/* Balanço Positivos vs Negativos */}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <div style={{ background: 'rgba(74, 222, 128, 0.12)', border: '1px solid rgba(74, 222, 128, 0.3)', padding: '4px 8px', borderRadius: 6, textAlign: 'center' }}>
                    <span style={{ fontSize: 9, color: '#4ade80', textTransform: 'uppercase', display: 'block', fontWeight: 700 }}>Positivos</span>
                    <strong style={{ fontSize: 13, color: '#4ade80' }}>{balanceInfo.positivesCount}</strong>
                  </div>
                  <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>vs</span>
                  <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '4px 8px', borderRadius: 6, textAlign: 'center' }}>
                    <span style={{ fontSize: 9, color: '#f87171', textTransform: 'uppercase', display: 'block', fontWeight: 700 }}>Negativos</span>
                    <strong style={{ fontSize: 13, color: '#f87171' }}>{balanceInfo.negativesCount}</strong>
                  </div>
                </div>
              </div>

              {/* Componente de Traços/Vantagens */}
              <TraitsPerksSelector
                selectedTraits={selectedTraits}
                selectedPerks={selectedPerks}
                onToggleTrait={toggleTrait}
                onTogglePerk={togglePerk}
                expandTraits={expandTraitsSection}
                setExpandTraits={setExpandTraitsSection}
                expandPerks={expandPerksSection}
                setExpandPerks={setExpandPerksSection}
                balanceInfo={balanceInfo}
              />

              {/* Distribuição dos Atributos */}
              <div style={{ background: 'rgba(0,0,0,0.25)', padding: 14, borderRadius: 10, border: '1px solid rgba(38, 200, 143, 0.3)' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--text-primary)', fontWeight: 800 }}>Distribuição de Atributos (Nível 1)</span>
                      <span style={{ fontSize: 10.5, color: 'var(--accent)', background: 'rgba(38,200,143,0.15)', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>Máx. 3 pts por atributo</span>
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                      Distribua seus <strong>15 pontos</strong>. Bônus de profissão e traços são somados no total final — que <strong style={{ color: '#f87171' }}>pode ser negativo</strong> se um traço negativo não for compensado.
                    </p>
                  </div>
                  <div className="points-remaining" style={{ margin: 0, padding: '6px 14px', fontSize: 13, borderRadius: 8 }}>
                    Pontos restantes: <strong style={{ marginLeft: 6, fontSize: 16, color: remainingPoints === 0 ? '#22c55e' : '#f59e0b' }}>{remainingPoints} / {TOTAL_POINTS}</strong>
                  </div>
                </div>

                <AttributeGrid
                  attrs={attrs}
                  profBonuses={isPreMade ? preMadeProfBonuses : profBonuses}
                  specBonuses={{}}
                  traitModifiers={traitModifiers}
                  onChangeAttr={changeAttr}
                  remainingPoints={remainingPoints}
                  readOnly={false}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" className="btn" style={{ flex: 1 }} onClick={() => setStep(3)}>← Voltar</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2, padding: '12px' }} disabled={!balanceInfo.isValid}>
                  Avançar para Prévia da Ficha →
                </button>
              </div>
            </form>
          )}

          {/* ================================================================ */}
          {/* ETAPA 5 (AMBOS OS MODOS): Prévia Completa da Ficha */}
          {/* ================================================================ */}
          {step === 5 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ textAlign: 'center', marginBottom: 2 }}>
                <h3 style={{ fontSize: 16, textTransform: 'uppercase', color: 'var(--accent-yellow)', margin: '0 0 4px', fontWeight: 800 }}>🔍 Prévia Completa do Sobrevivente</h3>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
                  Revise todos os detalhes antes de confirmar sua entrada em Varezhia.
                </p>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid var(--glass-border)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Card de Identidade */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 64, height: 64, borderRadius: 10, overflow: 'hidden', border: '2px solid var(--accent)', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {previewAvatar?.trim() ? (
                        <img src={previewAvatar.trim()} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.onerror = null; e.target.src = '' }} />
                      ) : (
                        <span style={{ fontSize: 32 }}>{previewProfData?.icon || '👤'}</span>
                      )}
                    </div>
                    <div>
                      <h4 style={{ margin: '0 0 2px', fontSize: 17, color: '#fff', fontWeight: 800 }}>
                        {previewName || 'Sobrevivente'} ({previewAge} anos)
                        {isPreMade && <span style={{ fontSize: 11, color: '#34d399', marginLeft: 8, fontWeight: 400 }}>· Ficha Pré-Pronta: {selectedSheet?.title}</span>}
                      </h4>
                      <div style={{ fontSize: 12, color: 'var(--accent-yellow)', fontWeight: 600 }}>
                        {previewProfData?.icon} {previewProfData?.name} · {previewSpecData?.name} {previewSpecData?.proficiency ? `(${previewSpecData.proficiency})` : ''}
                      </div>
                      <div style={{ fontSize: 11, color: '#38bdf8', marginTop: 2 }}>
                        📍 Local de Início: <strong>{previewSpawnName}</strong>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div style={{ background: 'rgba(234, 179, 8, 0.12)', border: '1px solid rgba(234, 179, 8, 0.3)', padding: '6px 12px', borderRadius: 8, textAlign: 'center' }}>
                      <span style={{ fontSize: 9.5, color: '#facc15', textTransform: 'uppercase', display: 'block', fontWeight: 700 }}>💰 Saldo Inicial</span>
                      <strong style={{ fontSize: 14, color: '#fff' }}>200 Rublos</strong>
                    </div>
                    <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '6px 12px', borderRadius: 8, textAlign: 'center' }}>
                      <span style={{ fontSize: 9.5, color: '#fca5a5', textTransform: 'uppercase', display: 'block', fontWeight: 700 }}>❤️ Vida Base</span>
                      <strong style={{ fontSize: 14, color: previewMaxHp < 100 ? '#f87171' : '#ef4444' }}>{previewMaxHp} HP</strong>
                    </div>
                  </div>
                </div>

                {/* Aviso de HP baixo se CON negativa */}
                {previewMaxHp < 100 && (
                  <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)', padding: '8px 12px', borderRadius: 8, color: '#fca5a5', fontSize: 11.5 }}>
                    ⚠️ Atenção: sua Constituição final é negativa, resultando em <strong>{previewMaxHp} HP</strong> de vida base (abaixo de 100). Isso é uma consequência intencional dos seus traços negativos.
                  </div>
                )}

                {/* Traços & Vantagens */}
                <TraitsPerksBadges traits={selectedTraits} perks={selectedPerks} />

                {/* Atributos Finais */}
                <div>
                  <span style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: 6 }}>Atributos Finais Calculados:</span>
                  <AttributePreviewGrid
                    attrs={attrs}
                    profBonuses={previewProfBonuses}
                    specBonuses={previewSpecBonuses}
                    traitModifiers={traitModifiers}
                  />
                </div>

                {/* Equipamentos Iniciais */}
                <StarterItemsGrid items={previewItems} />

                {/* História */}
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 8, border: '1px solid var(--glass-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 10.5, color: 'var(--accent-yellow)', textTransform: 'uppercase', fontWeight: 700 }}>
                      📜 {isPreMade ? 'Lore Base Pré-Definida (Editável pela Staff):' : 'Lore & Biografia do Personagem:'}
                    </span>
                    <span style={{ fontSize: 10, color: '#4ade80' }}>🔒 Apenas a staff terá acesso</span>
                  </div>
                  <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.45, maxHeight: 120, overflowY: 'auto' }}>
                    {previewBackstory}
                  </p>
                </div>
              </div>

              {/* Botões de Confirmação */}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" className="btn" style={{ flex: 1 }} onClick={() => setStep(4)} disabled={loading}>
                  ← Voltar e Ajustar
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ flex: 2, padding: '14px', background: '#10b981', borderColor: '#34d399', color: '#000', fontWeight: 800, fontSize: 14 }}
                  onClick={isPreMade ? handleRegisterPreMadeFinal : handleRegisterCustomFinal}
                  disabled={loading}
                >
                  {loading ? 'Criando Sobrevivente...' : '⚔️ Confirmar Ficha e Entrar no RPG'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
