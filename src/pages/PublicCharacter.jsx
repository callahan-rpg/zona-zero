import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useItemCatalog } from '../utils/itemCatalogService'
import HUD from '../components/HUD.jsx'
import EquipmentPaperdoll from '../components/EquipmentPaperdoll.jsx'
import { useAuth } from '../contexts/AuthContext.jsx'
import {
  DEFAULT_PRESET_ITEMS,
  calculateCharacterEquipmentStats,
  calculateBodyTemperature,
} from '../utils/itemSystem'
import { getItemCategory } from './Character.jsx'
import { ATTRIBUTE_LIST, getProfessionData, getSpecialtyData, getDetailedAttributes } from '../utils/professionSystem'
import { TRAITS, PERKS, calculateTraitModifiers } from '../utils/traitsSystem'

function xpForNextLevel(level) {
  return (level || 1) * 100
}

export default function PublicCharacter() {
  const { uid } = useParams()
  const navigate = useNavigate()
  const { user, character: myChar, useItemOnTarget } = useAuth()

  const [character, setCharacter] = useState(null)
  const [targetRole, setTargetRole] = useState('player')
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Modal de socorro médico
  const [showMedicalModal, setShowMedicalModal] = useState(false)
  const [selectedMedicalItem, setSelectedMedicalItem] = useState(null)
  const [medicalLoading, setMedicalLoading] = useState(false)
  const [medicalError, setMedicalError] = useState('')
  const [medicalSuccess, setMedicalSuccess] = useState('')

  // Utiliza o listener único compartilhado e em cache do catálogo de itens global
  const { map: catalogMap } = useItemCatalog()

  useEffect(() => {
    // Se o usuário tentar acessar seu próprio perfil pela rota pública, redireciona para a gestão do dono
    if (user && uid === user.uid) {
      navigate('/character', { replace: true })
      return
    }

    async function load() {
      setLoading(true)
      try {
        const docRef = doc(db, 'users', uid)
        const docSnap = await getDoc(docRef)
        if (docSnap.exists() && docSnap.data().character?.name) {
          const raw = docSnap.data()
          // Sanitização rigorosa: nunca armazena email ou credenciais confidenciais no estado público
          const safeChar = { ...raw.character }
          delete safeChar.email
          setCharacter(safeChar)
          setTargetRole(raw.role || 'player')
        } else {
          // Fallback para o índice público de sobreviventes
          const indexSnap = await getDoc(doc(db, 'players_index', uid))
          if (indexSnap.exists()) {
            const idxData = indexSnap.data()
            setCharacter({
              name: idxData.name,
              avatarUrl: idxData.avatarUrl,
              age: idxData.age,
              level: idxData.level,
              xp: idxData.xp,
              profession: idxData.professionId,
              inventory: [],
            })
            setTargetRole(idxData.role || 'player')
          } else {
            setNotFound(true)
          }
        }
      } catch {
        // Se a RLS do Firestore bloquear leitura direta de /users/{uid}, carrega do índice público
        try {
          const indexSnap = await getDoc(doc(db, 'players_index', uid))
          if (indexSnap.exists()) {
            const idxData = indexSnap.data()
            setCharacter({
              name: idxData.name,
              avatarUrl: idxData.avatarUrl,
              age: idxData.age,
              level: idxData.level,
              xp: idxData.xp,
              profession: idxData.professionId,
              inventory: [],
            })
            setTargetRole(idxData.role || 'player')
          } else {
            setNotFound(true)
          }
        } catch {
          setNotFound(true)
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [uid, user, navigate])

  const rawInventory = character?.inventory || []

  const inventory = useMemo(() => {
    return rawInventory.map(item => {
      const catData = catalogMap[item.itemId]
      const presetData = DEFAULT_PRESET_ITEMS.find(p => p.itemId === item.itemId)

      const equipSlot = catData?.equipSlot || item.equipSlot || presetData?.equipSlot || null
      const insulation = catData?.insulation !== undefined ? Number(catData.insulation) : item.insulation !== undefined ? Number(item.insulation) : (presetData?.insulation ?? 0)
      const damageReduction = catData?.damageReduction !== undefined ? Number(catData.damageReduction) : item.damageReduction !== undefined ? Number(item.damageReduction) : (presetData?.damageReduction ?? 0)
      const damageMin = catData?.damageMin !== undefined ? Number(catData.damageMin) : item.damageMin !== undefined ? Number(item.damageMin) : (presetData?.damageMin ?? null)
      const damageMax = catData?.damageMax !== undefined ? Number(catData.damageMax) : item.damageMax !== undefined ? Number(item.damageMax) : (presetData?.damageMax ?? null)
      const maxDurability = catData?.maxDurability !== undefined ? Number(catData.maxDurability) : item.maxDurability !== undefined ? Number(item.maxDurability) : (presetData?.maxDurability ?? null)
      const durability = item.durability !== undefined ? Number(item.durability) : (maxDurability ?? null)

      return {
        ...item,
        name: catData?.name || item.name || presetData?.name || 'Item',
        icon: catData?.icon || item.icon || presetData?.icon || '📦',
        imageUrl: catData?.imageUrl || item.imageUrl || '',
        rarity: catData?.rarity || item.rarity || presetData?.rarity || 'common',
        category: catData?.category || item.category || presetData?.category || 'general',
        description: catData?.description || item.description || presetData?.description || '',
        equipSlot,
        insulation,
        damageReduction,
        damageMin,
        damageMax,
        maxDurability,
        durability,
        equipped: item.equipped === true,
      }
    })
  }, [rawInventory, catalogMap])

  const equipmentStats = useMemo(() => {
    return calculateCharacterEquipmentStats(inventory)
  }, [inventory])

  const thermalInfo = useMemo(() => {
    return calculateBodyTemperature(20, equipmentStats.totalInsulation)
  }, [equipmentStats.totalInsulation])

  // Itens médicos da mochila do usuário logado (para prestar atendimento)
  const myMedicalItems = useMemo(() => {
    const items = myChar?.inventory || []
    return items
      .map((item) => {
        const catData = catalogMap[item.itemId]
        const presetData = DEFAULT_PRESET_ITEMS.find((p) => p.itemId === item.itemId)
        const category = catData?.category || item.category || presetData?.category || getItemCategory(item)
        const maxUses = catData?.maxUses !== undefined ? Number(catData.maxUses) : item.maxUses !== undefined ? Number(item.maxUses) : (presetData?.maxUses ?? 1)
        const currentUses = item.currentUses !== undefined ? Number(item.currentUses) : maxUses
        const canTargetOther = catData?.canTargetOther !== undefined
          ? !!catData.canTargetOther
          : item.canTargetOther !== undefined
          ? !!item.canTargetOther
          : presetData?.canTargetOther !== undefined
          ? !!presetData.canTargetOther
          : category === 'medical'

        return {
          ...item,
          name: catData?.name || item.name || presetData?.name || 'Item',
          icon: catData?.icon || item.icon || presetData?.icon || '💉',
          category,
          maxUses,
          currentUses,
          consumeEffect: catData?.consumeEffect || item.consumeEffect,
          canTargetOther
        }
      })
      .filter((item) => item.canTargetOther || item.category === 'medical')
  }, [myChar?.inventory, catalogMap])

  if (loading) {
    return <div className="loading-screen"><span className="loading-dot" /></div>
  }

  if (notFound) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
        <HUD />
        <div className="character-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass" style={{ padding: 40, textAlign: 'center', maxWidth: 400 }}>
            <p style={{ fontSize: 48, marginBottom: 16 }}>🧟</p>
            <h2 style={{ fontFamily: 'Oswald', letterSpacing: 2, color: 'var(--accent)', marginBottom: 12 }}>
              Sobrevivente não encontrado
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
              Este sobrevivente pode ter perecido na Zona Zero.
            </p>
            <button className="btn btn-primary" onClick={() => navigate('/characters')}>
              ← Voltar aos Sobreviventes
            </button>
          </div>
        </div>
      </div>
    )
  }

  const xpMax = xpForNextLevel(character.level)
  const xpCurrent = character.xp || 0
  const xpProgress = Math.min((xpCurrent / xpMax) * 100, 100)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <HUD />

      <div className="character-page">
        {/* Topo / Voltar */}
        <div style={{ maxWidth: 1200, margin: '0 auto 16px auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => navigate(-1)}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span>←</span> Voltar
          </button>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Ficha Pública de Sobrevivente
          </span>
        </div>

        <div className="character-layout-grid">
          {/* COLUNA ESQUERDA: Perfil + Atributos */}
          <div className="character-profile-panel">
            <div className="character-header">
              <div className="character-avatar-container">
                {character.avatarUrl ? (
                  <img
                    className="character-avatar"
                    src={character.avatarUrl}
                    alt={character.name}
                  />
                ) : (
                  <div className="character-avatar-placeholder">🧟</div>
                )}
                <div className="character-level-badge">Nv {character.level || 1}</div>
              </div>

              <div className="character-info">
                <div className="character-name">{character.name}</div>
                <div className="character-age">
                  {character.age || '??'} anos · {character.profession?.name || (targetRole === 'admin' ? '🛡️ Administrador' : 'Sobrevivente')}
                </div>

                <div className="xp-bar-container">
                  <div className="xp-bar-label">
                    <span>Experiência</span>
                    <span>{xpCurrent} / {xpMax} XP</span>
                  </div>
                  <div className="xp-bar">
                    <div className="xp-bar-fill" style={{ width: `${xpProgress}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Ação rápida de Socorro Médico (se o usuário logado estiver vendo outro sobrevivente) */}
            {user && user.uid !== uid && (
              <div style={{ marginBottom: 18 }}>
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{
                    width: '100%',
                    background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.25) 0%, rgba(20, 83, 45, 0.35) 100%)',
                    borderColor: '#22c55e',
                    color: '#86efac',
                    fontWeight: 700,
                    padding: '8px 12px',
                    fontSize: 12,
                    boxShadow: '0 0 12px rgba(34, 197, 94, 0.25)'
                  }}
                  onClick={() => {
                    setMedicalError('')
                    setMedicalSuccess('')
                    if (myMedicalItems.length > 0) {
                      setSelectedMedicalItem(myMedicalItems[0])
                    } else {
                      setSelectedMedicalItem(null)
                    }
                    setShowMedicalModal(true)
                  }}
                >
                  <span>🩺</span> Prestar Socorro / Tratar Sobrevivente
                </button>
              </div>
            )}

            {/* Banner / Card de Profissão & Especialização */}
            {(() => {
              const profId = character.profession?.id || (typeof character.profession === 'string' ? character.profession : null)
              const specId = character.specialty?.id || (typeof character.specialty === 'string' ? character.specialty : null)
              const profData = profId ? (getProfessionData(profId) || character.profession) : null
              const specData = profId ? (getSpecialtyData(profId, specId) || character.specialty) : null

              if (!profData && !specData) {
                if (targetRole === 'admin') {
                  return (
                    <div style={{ marginBottom: 18, background: 'rgba(56, 189, 248, 0.08)', padding: 12, borderRadius: 8, border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 18 }}>🛡️</span>
                        <div>
                          <strong style={{ fontSize: 13, color: '#38bdf8' }}>Administrador do Sistema</strong>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>· Staff / Isento de Profissão</span>
                        </div>
                      </div>
                    </div>
                  )
                }
                return null
              }

              return (
                <div style={{ marginBottom: 18, background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 8, border: '1px solid var(--glass-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 18 }}>{profData?.icon || '🪖'}</span>
                      <strong style={{ fontSize: 13, color: 'var(--accent)' }}>{profData?.name || 'Profissão'}</strong>
                      {specData?.name && (
                        <>
                          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>▸</span>
                          <span style={{ fontSize: 18 }}>{specData?.icon || '⭐'}</span>
                          <strong style={{ fontSize: 13, color: '#f59e0b' }}>{specData?.name}</strong>
                        </>
                      )}
                    </div>
                    {(profData?.bonusSummary || specData?.bonusSummary) && (
                      <span style={{ fontSize: 10, color: '#4ade80', background: 'rgba(74,222,128,0.12)', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                        {[profData?.bonusSummary, specData?.bonusSummary].filter(Boolean).join(' | ')}
                      </span>
                    )}
                  </div>

                  {specData?.proficiency && (
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      <strong style={{ color: 'var(--accent-yellow)' }}>Proficiência:</strong> {specData.proficiency}
                    </div>
                  )}

                  {Array.isArray(specData?.abilities) && specData.abilities.length > 0 && (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 6, marginTop: 4 }}>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Capacidades Especiais:</span>
                      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 10.5, color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                        {specData.abilities.map((ab, i) => (
                          <li key={i}>{ab}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Atributos */}
            <div className="character-attributes">
              <p className="section-title">Atributos de Sobrevivência (8)</p>
              {(() => {
                const profId = character.profession?.id || (typeof character.profession === 'string' ? character.profession : null)
                const specId = character.specialty?.id || (typeof character.specialty === 'string' ? character.specialty : null)
                const baseAttrs = character.baseAttributes || character.attributes || {}
                const traitModifiers = calculateTraitModifiers(character.traits || [])
                const detailedAttrs = getDetailedAttributes(baseAttrs, profId, specId, {}, traitModifiers)

                return (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                      {detailedAttrs.map((attr) => {
                        const hasBonus = attr.totalBonus > 0
                        const isDebuffed = attr.isDebuffed
                        const tooltipText = `Atributo: ${attr.label}\nTotal: ${attr.total}\nBase: ${attr.base}${attr.profBonus ? `\nProfissão: +${attr.profBonus}` : ''}${attr.specBonus ? `\nEspecialidade: +${attr.specBonus}` : ''}${attr.traitBonus ? `\nTraço: ${attr.traitBonus > 0 ? `+${attr.traitBonus}` : attr.traitBonus}` : ''}`

                        return (
                          <div
                            className={`character-float-attr-card ${isDebuffed ? 'attr-debuffed' : ''}`}
                            key={attr.key}
                            title={tooltipText}
                            style={{ border: hasBonus && !isDebuffed ? '1px solid rgba(74,222,128,0.3)' : undefined }}
                          >
                            <span className="character-float-attr-icon">{attr.icon}</span>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                              <span className="character-float-attr-val" style={{ color: isDebuffed ? '#f87171' : hasBonus ? '#4ade80' : 'inherit' }}>
                                {attr.total}
                              </span>
                              {hasBonus && !isDebuffed && (
                                <span style={{ fontSize: 8, color: '#4ade80', fontWeight: 'bold' }}>(+{attr.totalBonus})</span>
                              )}
                              {isDebuffed && (
                                <span style={{ fontSize: 8, color: '#ef4444', fontWeight: 'bold' }}>({attr.penalty})</span>
                              )}
                            </div>
                            <span className="character-float-attr-lbl" style={{ fontSize: 9.5 }}>{attr.label}</span>
                          </div>
                        )
                      })}
                    </div>

                    {/* Traços e Vantagens */}
                    {((character.traits && character.traits.length > 0) || (character.perks && character.perks.length > 0)) && (
                      <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <span style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, display: 'block', marginBottom: 4 }}>
                          Traços & Vantagens / Desvantagens:
                        </span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {(character.traits || []).map(tId => {
                            const t = TRAITS[tId]
                            if (!t) return null
                            const isPos = t.type === 'positive'
                            return (
                              <span
                                key={tId}
                                title={`${t.name}: ${t.summary}`}
                                style={{
                                  fontSize: 9.5,
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  background: isPos ? 'rgba(74,222,128,0.15)' : 'rgba(239,68,68,0.15)',
                                  color: isPos ? '#4ade80' : '#f87171',
                                  border: `1px solid ${isPos ? 'rgba(74,222,128,0.3)' : 'rgba(239,68,68,0.3)'}`
                                }}
                              >
                                {t.icon} {t.name} ({t.summary})
                              </span>
                            )
                          })}
                          {(character.perks || []).map(pId => {
                            const p = PERKS[pId]
                            if (!p) return null
                            const isPos = p.type === 'positive'
                            return (
                              <span
                                key={pId}
                                title={`${p.name}: ${p.summary}`}
                                style={{
                                  fontSize: 9.5,
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  background: isPos ? 'rgba(56,189,248,0.15)' : 'rgba(245,158,11,0.15)',
                                  color: isPos ? '#38bdf8' : '#fbbf24',
                                  border: `1px solid ${isPos ? 'rgba(56,189,248,0.3)' : 'rgba(245,158,11,0.3)'}`
                                }}
                              >
                                {p.icon} {p.name}
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          </div>

          {/* COLUNA DIREITA: Equipamento & Traje Equipado (Privacidade de Inventário) */}
          <div className="character-inventory-panel">
            <div className="inventory-header-row" style={{ marginBottom: 12 }}>
              <div>
                <p className="section-title" style={{ marginBottom: 4 }}>Equipamento & Traje</p>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Itens e vestimentas atualmente equipados no corpo do sobrevivente.
                </span>
              </div>
            </div>

            {/* Painel de Equipamento & Traje do Sobrevivente */}
            <EquipmentPaperdoll
              equipmentStats={equipmentStats}
              thermalInfo={thermalInfo}
              disabled={true}
            />
          </div>
        </div>
      </div>

      {/* Modal de Prestar Socorro Médico */}
      {showMedicalModal && (
        <div className="loot-modal-overlay" onClick={() => !medicalLoading && setShowMedicalModal(false)}>
          <div className="loot-modal" onClick={(e) => e.stopPropagation()} style={{ width: '400px', textAlign: 'left' }}>
            <h3 style={{ color: '#5cff7a', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🩺</span> Prestar Atendimento Médico
            </h3>

            {medicalError && <div className="form-error">{medicalError}</div>}
            {medicalSuccess && <div className="form-error" style={{ color: '#5cff7a', borderColor: 'rgba(92, 255, 122, 0.3)', background: 'rgba(92, 255, 122, 0.1)' }}>{medicalSuccess}</div>}

            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
              Paciente: <strong style={{ color: '#fff' }}>{character?.name}</strong> (Nv {character?.level || 1})
            </p>

            {myMedicalItems.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--accent-red)', fontSize: 12, background: 'rgba(239,68,68,0.08)', borderRadius: 6, border: '1px solid rgba(239,68,68,0.2)' }}>
                Você não possui nenhum item médico ou curativo disponível na sua mochila.
              </div>
            ) : (
              <form onSubmit={async (e) => {
                e.preventDefault()
                if (!selectedMedicalItem) return
                setMedicalError('')
                setMedicalSuccess('')
                setMedicalLoading(true)
                try {
                  const res = await useItemOnTarget({
                    itemInstanceId: selectedMedicalItem.instanceId,
                    targetUid: uid,
                    consumeEffect: selectedMedicalItem.consumeEffect
                  })
                  const usesText = res?.maxUses > 1 ? ` (Restam ${res.remainingUses}/${res.maxUses} doses)` : ''
                  setMedicalSuccess(`Tratamento aplicado com sucesso em ${character.name}!${usesText}`)
                  setTimeout(() => {
                    setShowMedicalModal(false)
                  }, 1500)
                } catch (err) {
                  setMedicalError(err.message || 'Erro ao aplicar tratamento.')
                } finally {
                  setMedicalLoading(false)
                }
              }}>
                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 11 }}>Selecione o Item Médico da Sua Mochila</label>
                  <select
                    value={selectedMedicalItem?.instanceId || ''}
                    onChange={(e) => {
                      const found = myMedicalItems.find(i => i.instanceId === e.target.value)
                      setSelectedMedicalItem(found || null)
                    }}
                    required
                    style={{ fontSize: 12 }}
                  >
                    {myMedicalItems.map(item => (
                      <option key={item.instanceId} value={item.instanceId}>
                        {item.icon} {item.name} (Qtd: {item.quantity}{Number(item.maxUses) > 1 ? ` · Doses: ${item.currentUses ?? item.maxUses}/${item.maxUses}` : ''})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedMedicalItem?.consumeEffect && (
                  <div style={{ fontSize: 11, background: 'rgba(92, 255, 122, 0.08)', padding: '8px 10px', borderRadius: 6, marginBottom: 14, border: '1px solid rgba(92, 255, 122, 0.2)' }}>
                    <strong>Efeito que será aplicado:</strong>
                    {Boolean(selectedMedicalItem.consumeEffect.blood)  && <div style={{ color: '#f87171', fontWeight: 600 }}>🩸 Sangue/HP: +{selectedMedicalItem.consumeEffect.blood}</div>}
                    {Boolean(selectedMedicalItem.consumeEffect.hunger) && <div>🍗 Fome: +{selectedMedicalItem.consumeEffect.hunger}%</div>}
                    {Boolean(selectedMedicalItem.consumeEffect.thirst) && <div>💧 Sede: +{selectedMedicalItem.consumeEffect.thirst}%</div>}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button
                    type="button"
                    className="btn"
                    style={{ flex: 1 }}
                    onClick={() => setShowMedicalModal(false)}
                    disabled={medicalLoading}
                  >
                    Fechar
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ flex: 2, background: '#1d4ed8', borderColor: '#3b82f6' }}
                    disabled={medicalLoading || !selectedMedicalItem}
                  >
                    {medicalLoading ? 'Aplicando...' : '💉 Aplicar Socorro'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
