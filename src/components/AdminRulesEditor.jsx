import { useState } from 'react'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { DEFAULT_RULES_CONFIG } from '../utils/rulesDefaults'

export default function AdminRulesEditor({ rulesConfig, onUpdate }) {
  const [activeSubTab, setActiveSubTab] = useState('hero_intro') // hero_intro | professions | progression | combat | conditions | survival_time
  const [formData, setFormData] = useState(() => ({
    ...DEFAULT_RULES_CONFIG,
    ...(rulesConfig || {})
  }))
  const [selectedProfIndex, setSelectedProfIndex] = useState(0)
  const [saving, setSaving] = useState(false)

  // Salvar no Firestore
  async function handleSaveRules(e) {
    if (e) e.preventDefault()
    setSaving(true)
    try {
      await setDoc(doc(db, 'rules_config', 'global'), formData, { merge: true })
      if (onUpdate) onUpdate(formData)
      alert('✅ Regras e textos atualizados com sucesso no Firestore!')
    } catch (err) {
      alert('Erro ao salvar regras: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // Restaurar padrões
  function handleResetToDefaults() {
    if (!confirm('Deseja restaurar todos os textos e regras para o padrão original do sistema?')) return
    setFormData(DEFAULT_RULES_CONFIG)
  }

  // Helpers de Profissão
  const currentProf = formData.professions?.[selectedProfIndex] || formData.professions?.[0]

  function updateCurrentProfField(field, value) {
    setFormData(prev => {
      const updated = [...(prev.professions || [])]
      updated[selectedProfIndex] = { ...updated[selectedProfIndex], [field]: value }
      return { ...prev, professions: updated }
    })
  }

  function updateSpecialtyField(specIndex, field, value) {
    setFormData(prev => {
      const updatedProfs = [...(prev.professions || [])]
      const current = { ...updatedProfs[selectedProfIndex] }
      const updatedSpecs = [...(current.specialties || [])]
      updatedSpecs[specIndex] = { ...updatedSpecs[specIndex], [field]: value }
      current.specialties = updatedSpecs
      updatedProfs[selectedProfIndex] = current
      return { ...prev, professions: updatedProfs }
    })
  }

  function addSpecialtyToProf() {
    setFormData(prev => {
      const updatedProfs = [...(prev.professions || [])]
      const current = { ...updatedProfs[selectedProfIndex] }
      const newSpec = {
        id: `spec_${Date.now()}`,
        name: 'Nova Especialização',
        icon: '⭐',
        attrBonus: '+1 Atributo',
        proficiencies: ['Proficiência 1'],
        starterEquipment: ['Item Inicial'],
        perks: ['Habilidade Especial']
      }
      current.specialties = [...(current.specialties || []), newSpec]
      updatedProfs[selectedProfIndex] = current
      return { ...prev, professions: updatedProfs }
    })
  }

  function removeSpecialtyFromProf(specIndex) {
    if (!confirm('Excluir esta especialização?')) return
    setFormData(prev => {
      const updatedProfs = [...(prev.professions || [])]
      const current = { ...updatedProfs[selectedProfIndex] }
      current.specialties = current.specialties.filter((_, i) => i !== specIndex)
      updatedProfs[selectedProfIndex] = current
      return { ...prev, professions: updatedProfs }
    })
  }

  return (
    <form onSubmit={handleSaveRules} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Barra de Ações Superior */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 style={{ fontSize: 16, textTransform: 'uppercase', color: '#facc15', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>📜</span> Editor Completo das Regras do RPG (/rules)
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
            Edite todos os textos, profissões, especialidades, bônus, tabelas de XP, balística e tempos do manual.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn btn-sm" onClick={handleResetToDefaults} style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: '#f87171' }}>
            🔄 Restaurar Padrões
          </button>
          <button type="submit" className="btn btn-sm btn-primary" disabled={saving} style={{ background: '#eab308', borderColor: '#facc15', color: '#000', fontWeight: 'bold' }}>
            {saving ? 'Gravando...' : '💾 Salvar Alterações das Regras'}
          </button>
        </div>
      </div>

      {/* Sub-Abas do Editor de Regras */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, borderBottom: '1px solid var(--glass-border)', paddingBottom: 10 }}>
        <button
          type="button"
          className={`btn btn-sm ${activeSubTab === 'hero_intro' ? 'btn-primary' : ''}`}
          onClick={() => setActiveSubTab('hero_intro')}
        >
          🏷️ Banner & Introdução
        </button>
        <button
          type="button"
          className={`btn btn-sm ${activeSubTab === 'professions' ? 'btn-primary' : ''}`}
          onClick={() => setActiveSubTab('professions')}
        >
          🪖 1. Profissões & Especialidades ({formData.professions?.length || 0})
        </button>
        <button
          type="button"
          className={`btn btn-sm ${activeSubTab === 'progression' ? 'btn-primary' : ''}`}
          onClick={() => setActiveSubTab('progression')}
        >
          📈 2. Progressão & Economia de XP
        </button>
        <button
          type="button"
          className={`btn btn-sm ${activeSubTab === 'combat' ? 'btn-primary' : ''}`}
          onClick={() => setActiveSubTab('combat')}
        >
          🩸 3. Combate & Sangramento
        </button>
        <button
          type="button"
          className={`btn btn-sm ${activeSubTab === 'conditions' ? 'btn-primary' : ''}`}
          onClick={() => setActiveSubTab('conditions')}
        >
          🧟 4. Infecção & Vitals
        </button>
        <button
          type="button"
          className={`btn btn-sm ${activeSubTab === 'survival_time' ? 'btn-primary' : ''}`}
          onClick={() => setActiveSubTab('survival_time')}
        >
          ⏱️ 5. Tempo & Legado
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SUB-ABA 1: BANNER HERO & INTRODUÇÃO                                       */}
      {/* ========================================================================= */}
      {activeSubTab === 'hero_intro' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="glass-light" style={{ padding: 18, borderRadius: 12 }}>
            <h4 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 14 }}>
              🏷️ Cabeçalho Superior da Página (/rules)
            </h4>

            <div className="form-group">
              <label>Tag / Subtítulo Superior</label>
              <input
                type="text"
                value={formData.hero?.tag || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  hero: { ...prev.hero, tag: e.target.value }
                }))}
              />
            </div>

            <div className="form-group">
              <label>Título Principal</label>
              <input
                type="text"
                value={formData.hero?.title || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  hero: { ...prev.hero, title: e.target.value }
                }))}
              />
            </div>

            <div className="form-group">
              <label>Descrição do Banner</label>
              <textarea
                rows={3}
                value={formData.hero?.description || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  hero: { ...prev.hero, description: e.target.value }
                }))}
              />
            </div>

            <div style={{ marginTop: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Cartões de Estatísticas Rápidas (4 Pílulas)
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginTop: 8 }}>
                {(formData.hero?.stats || []).map((st, idx) => (
                  <div key={idx} className="glass" style={{ padding: 10, borderRadius: 8, display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      placeholder="Ex: 80 XP"
                      value={st.num}
                      onChange={(e) => {
                        const val = e.target.value
                        setFormData(prev => {
                          const updated = [...(prev.hero?.stats || [])]
                          updated[idx] = { ...updated[idx], num: val }
                          return { ...prev, hero: { ...prev.hero, stats: updated } }
                        })
                      }}
                      style={{ width: '45%', padding: '6px', fontSize: 12, fontWeight: 'bold', textAlign: 'center' }}
                    />
                    <input
                      type="text"
                      placeholder="Ex: Por Nível"
                      value={st.lbl}
                      onChange={(e) => {
                        const val = e.target.value
                        setFormData(prev => {
                          const updated = [...(prev.hero?.stats || [])]
                          updated[idx] = { ...updated[idx], lbl: val }
                          return { ...prev, hero: { ...prev.hero, stats: updated } }
                        })
                      }}
                      style={{ width: '55%', padding: '6px', fontSize: 11 }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="glass-light" style={{ padding: 18, borderRadius: 12 }}>
            <h4 style={{ fontSize: 13, textTransform: 'uppercase', color: '#38bdf8', marginBottom: 14 }}>
              🧬 Bloco de Introdução das Profissões
            </h4>
            <div className="form-group">
              <label>Título do Bloco</label>
              <input
                type="text"
                value={formData.professionsIntro?.title || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  professionsIntro: { ...prev.professionsIntro, title: e.target.value }
                }))}
              />
            </div>
            <div className="form-group">
              <label>Texto Explicativo</label>
              <textarea
                rows={3}
                value={formData.professionsIntro?.description || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  professionsIntro: { ...prev.professionsIntro, description: e.target.value }
                }))}
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-ABA 2: PROFISSÕES & ESPECIALIDADES                                    */}
      {/* ========================================================================= */}
      {activeSubTab === 'professions' && (
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 18 }}>
          {/* Seletor Lateral de Profissão */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Selecione para Editar
            </label>
            {(formData.professions || []).map((prof, idx) => (
              <button
                key={prof.id || idx}
                type="button"
                onClick={() => setSelectedProfIndex(idx)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: selectedProfIndex === idx ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${selectedProfIndex === idx ? prof.color || 'var(--accent)' : 'var(--glass-border)'}`,
                  color: '#fff',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <span style={{ fontSize: 18 }}>{prof.icon}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 'bold' }}>{prof.name}</div>
                  <small style={{ color: 'var(--text-muted)', fontSize: 10 }}>{prof.specialties?.length || 0} especialidades</small>
                </div>
              </button>
            ))}
          </div>

          {/* Editor da Profissão Selecionada */}
          {currentProf && (
            <div className="glass-light" style={{ padding: 20, borderRadius: 14, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', paddingBottom: 10 }}>
                <h4 style={{ margin: 0, fontSize: 15, textTransform: 'uppercase', color: currentProf.color || 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{currentProf.icon}</span> Editando Profissão: {currentProf.name}
                </h4>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 120px 120px', gap: 10 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Ícone</label>
                  <input
                    type="text"
                    value={currentProf.icon || ''}
                    onChange={(e) => updateCurrentProfField('icon', e.target.value)}
                    style={{ textAlign: 'center', fontSize: 16 }}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Nome da Profissão</label>
                  <input
                    type="text"
                    value={currentProf.name || ''}
                    onChange={(e) => updateCurrentProfField('name', e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Bônus Base</label>
                  <input
                    type="text"
                    value={currentProf.attrBonus || ''}
                    onChange={(e) => updateCurrentProfField('attrBonus', e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Cor do Tema</label>
                  <input
                    type="text"
                    value={currentProf.color || '#ef4444'}
                    onChange={(e) => updateCurrentProfField('color', e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Badge / Arquétipo</label>
                <input
                  type="text"
                  value={currentProf.badge || ''}
                  onChange={(e) => updateCurrentProfField('badge', e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Resumo Geral</label>
                <textarea
                  rows={2}
                  value={currentProf.summary || ''}
                  onChange={(e) => updateCurrentProfField('summary', e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Citação / Frase Temática</label>
                <input
                  type="text"
                  value={currentProf.quote || ''}
                  onChange={(e) => updateCurrentProfField('quote', e.target.value)}
                />
              </div>

              {/* Lista de Especializações */}
              <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h5 style={{ margin: 0, fontSize: 13, textTransform: 'uppercase', color: 'var(--accent-yellow)' }}>
                    ⚡ Especializações desta Profissão ({currentProf.specialties?.length || 0})
                  </h5>
                  <button type="button" className="btn btn-sm" onClick={addSpecialtyToProf} style={{ background: 'rgba(255,255,255,0.08)' }}>
                    + Adicionar Especialidade
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {(currentProf.specialties || []).map((spec, sIdx) => (
                    <div key={spec.id || sIdx} className="glass" style={{ padding: 14, borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input
                            type="text"
                            value={spec.icon || '⭐'}
                            onChange={(e) => updateSpecialtyField(sIdx, 'icon', e.target.value)}
                            style={{ width: 42, textAlign: 'center', padding: '4px', fontSize: 14 }}
                          />
                          <input
                            type="text"
                            value={spec.name || ''}
                            onChange={(e) => updateSpecialtyField(sIdx, 'name', e.target.value)}
                            placeholder="Nome da Especialidade"
                            style={{ fontWeight: 'bold', padding: '4px 8px', fontSize: 12 }}
                          />
                          <input
                            type="text"
                            value={spec.attrBonus || ''}
                            onChange={(e) => updateSpecialtyField(sIdx, 'attrBonus', e.target.value)}
                            placeholder="+1 Atributo"
                            style={{ width: 100, padding: '4px 8px', fontSize: 11, color: 'var(--accent)' }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeSpecialtyFromProf(sIdx)}
                          style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 13 }}
                        >
                          ✕ Excluir
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label style={{ fontSize: 10 }}>Proficiências (separadas por vírgula)</label>
                          <input
                            type="text"
                            value={(spec.proficiencies || []).join(', ')}
                            onChange={(e) => updateSpecialtyField(sIdx, 'proficiencies', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                            style={{ fontSize: 11, padding: '6px' }}
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label style={{ fontSize: 10 }}>Equipamentos Iniciais (separados por vírgula)</label>
                          <input
                            type="text"
                            value={(spec.starterEquipment || []).join(', ')}
                            onChange={(e) => updateSpecialtyField(sIdx, 'starterEquipment', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                            style={{ fontSize: 11, padding: '6px' }}
                          />
                        </div>
                      </div>

                      <div className="form-group" style={{ marginBottom: 0, marginTop: 8 }}>
                        <label style={{ fontSize: 10 }}>Habilidades & Vantagens de Sobrevivência (separadas por ponto e vírgula ';')</label>
                        <input
                          type="text"
                          value={(spec.perks || []).join('; ')}
                          onChange={(e) => updateSpecialtyField(sIdx, 'perks', e.target.value.split(';').map(s => s.trim()).filter(Boolean))}
                          style={{ fontSize: 11, padding: '6px' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-ABA 3: PROGRESSÃO & ECONOMIA DE XP                                    */}
      {/* ========================================================================= */}
      {activeSubTab === 'progression' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="glass-light" style={{ padding: 18, borderRadius: 12 }}>
            <h4 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 14 }}>
              📈 Parâmetros Base de Progressão
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <div className="form-group">
                <label>XP Base por Nível</label>
                <input
                  type="number"
                  value={formData.progression?.baseXpPerLevel ?? 80}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    progression: { ...prev.progression, baseXpPerLevel: Number(e.target.value) }
                  }))}
                />
              </div>
              <div className="form-group">
                <label>Pontos de Atributo / Nível</label>
                <input
                  type="number"
                  value={formData.progression?.attrPointsPerLevel ?? 6}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    progression: { ...prev.progression, attrPointsPerLevel: Number(e.target.value) }
                  }))}
                />
              </div>
              <div className="form-group">
                <label>Investimento Máx / Atributo</label>
                <input
                  type="number"
                  value={formData.progression?.maxAttrInvestPerLevel ?? 3}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    progression: { ...prev.progression, maxAttrInvestPerLevel: Number(e.target.value) }
                  }))}
                />
              </div>
              <div className="form-group">
                <label>Novos Rúblos (₽) / Nível</label>
                <input
                  type="number"
                  value={formData.progression?.rublesPerLevel ?? 200}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    progression: { ...prev.progression, rublesPerLevel: Number(e.target.value) }
                  }))}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Texto Introdutório da Progressão</label>
              <textarea
                rows={2}
                value={formData.progression?.introText || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  progression: { ...prev.progression, introText: e.target.value }
                }))}
              />
            </div>
          </div>

          {/* Cartões dos 3 Graus de Risco */}
          <div className="glass-light" style={{ padding: 18, borderRadius: 12 }}>
            <h4 style={{ fontSize: 13, textTransform: 'uppercase', color: '#facc15', marginBottom: 14 }}>
              🚦 Graus de Risco das Missões (Verde, Amarelo, Vermelho)
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {(formData.progression?.difficulties || []).map((diff, dIdx) => (
                <div key={diff.id || dIdx} className="glass" style={{ padding: 12, borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input
                    type="text"
                    value={diff.name || ''}
                    onChange={(e) => {
                      const val = e.target.value
                      setFormData(prev => {
                        const updated = [...(prev.progression?.difficulties || [])]
                        updated[dIdx] = { ...updated[dIdx], name: val }
                        return { ...prev, progression: { ...prev.progression, difficulties: updated } }
                      })
                    }}
                    style={{ fontWeight: 'bold', fontSize: 12 }}
                  />
                  <input
                    type="text"
                    value={diff.xpRange || ''}
                    placeholder="Faixa de XP (ex: 5 a 15 XP)"
                    onChange={(e) => {
                      const val = e.target.value
                      setFormData(prev => {
                        const updated = [...(prev.progression?.difficulties || [])]
                        updated[dIdx] = { ...updated[dIdx], xpRange: val }
                        return { ...prev, progression: { ...prev.progression, difficulties: updated } }
                      })
                    }}
                    style={{ fontSize: 11, color: 'var(--accent)' }}
                  />
                  <textarea
                    rows={2}
                    value={diff.description || ''}
                    onChange={(e) => {
                      const val = e.target.value
                      setFormData(prev => {
                        const updated = [...(prev.progression?.difficulties || [])]
                        updated[dIdx] = { ...updated[dIdx], description: val }
                        return { ...prev, progression: { ...prev.progression, difficulties: updated } }
                      })
                    }}
                    style={{ fontSize: 11 }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-ABA 4: COMBATE & BALÍSTICA                                            */}
      {/* ========================================================================= */}
      {activeSubTab === 'combat' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="glass-light" style={{ padding: 18, borderRadius: 12 }}>
            <h4 style={{ fontSize: 13, textTransform: 'uppercase', color: '#f87171', marginBottom: 14 }}>
              🩸 Textos do Sistema de Combate & Vitalidade
            </h4>
            <div className="form-group">
              <label>Texto Introdutório de Combate</label>
              <textarea
                rows={2}
                value={formData.combat?.introText || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  combat: { ...prev.combat, introText: e.target.value }
                }))}
              />
            </div>
          </div>

          {/* Tabela de Armas & Danos */}
          <div className="glass-light" style={{ padding: 18, borderRadius: 12 }}>
            <h4 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 14 }}>
              ⚔️ Tabela Oficial de Armas & Danos
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(formData.combat?.weapons || []).map((w, wIdx) => (
                <div key={wIdx} className="glass" style={{ display: 'grid', gridTemplateColumns: '140px 180px 100px 1fr 30px', gap: 8, alignItems: 'center', padding: 8, borderRadius: 8 }}>
                  <input
                    type="text"
                    value={w.cat}
                    onChange={(e) => {
                      const val = e.target.value
                      setFormData(prev => {
                        const updated = [...(prev.combat?.weapons || [])]
                        updated[wIdx] = { ...updated[wIdx], cat: val }
                        return { ...prev, combat: { ...prev.combat, weapons: updated } }
                      })
                    }}
                    style={{ fontSize: 11 }}
                  />
                  <input
                    type="text"
                    value={w.name}
                    onChange={(e) => {
                      const val = e.target.value
                      setFormData(prev => {
                        const updated = [...(prev.combat?.weapons || [])]
                        updated[wIdx] = { ...updated[wIdx], name: val }
                        return { ...prev, combat: { ...prev.combat, weapons: updated } }
                      })
                    }}
                    style={{ fontSize: 11, fontWeight: 'bold' }}
                  />
                  <input
                    type="text"
                    value={w.dmg}
                    onChange={(e) => {
                      const val = e.target.value
                      setFormData(prev => {
                        const updated = [...(prev.combat?.weapons || [])]
                        updated[wIdx] = { ...updated[wIdx], dmg: val }
                        return { ...prev, combat: { ...prev.combat, weapons: updated } }
                      })
                    }}
                    style={{ fontSize: 11, textAlign: 'center', color: 'var(--accent)' }}
                  />
                  <input
                    type="text"
                    value={w.effect}
                    onChange={(e) => {
                      const val = e.target.value
                      setFormData(prev => {
                        const updated = [...(prev.combat?.weapons || [])]
                        updated[wIdx] = { ...updated[wIdx], effect: val }
                        return { ...prev, combat: { ...prev.combat, weapons: updated } }
                      })
                    }}
                    style={{ fontSize: 11 }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => {
                        const updated = prev.combat?.weapons?.filter((_, i) => i !== wIdx) || []
                        return { ...prev, combat: { ...prev.combat, weapons: updated } }
                      })
                    }}
                    style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  setFormData(prev => ({
                    ...prev,
                    combat: {
                      ...prev.combat,
                      weapons: [...(prev.combat?.weapons || []), { cat: 'Nova Categoria', name: 'Nome da Arma', dmg: '10 – 20', effect: 'Efeito especial' }]
                    }
                  }))
                }}
                style={{ width: 'fit-content', marginTop: 6 }}
              >
                + Adicionar Linha de Arma
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-ABA 5: INFECÇÃO & VITALS                                              */}
      {/* ========================================================================= */}
      {activeSubTab === 'conditions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="glass-light" style={{ padding: 18, borderRadius: 12 }}>
            <h4 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 14 }}>
              🧟 Estágios da Infecção Viral Strain Zero
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(formData.conditions?.infectionStages || []).map((stage, stIdx) => (
                <div key={stIdx} className="glass" style={{ padding: 12, borderRadius: 8, display: 'grid', gridTemplateColumns: '100px 180px 1fr 1.5fr', gap: 10 }}>
                  <input
                    type="text"
                    value={stage.badge}
                    onChange={(e) => {
                      const val = e.target.value
                      setFormData(prev => {
                        const updated = [...(prev.conditions?.infectionStages || [])]
                        updated[stIdx] = { ...updated[stIdx], badge: val }
                        return { ...prev, conditions: { ...prev.conditions, infectionStages: updated } }
                      })
                    }}
                    style={{ fontSize: 11, textAlign: 'center' }}
                  />
                  <input
                    type="text"
                    value={stage.time}
                    onChange={(e) => {
                      const val = e.target.value
                      setFormData(prev => {
                        const updated = [...(prev.conditions?.infectionStages || [])]
                        updated[stIdx] = { ...updated[stIdx], time: val }
                        return { ...prev, conditions: { ...prev.conditions, infectionStages: updated } }
                      })
                    }}
                    style={{ fontSize: 11 }}
                  />
                  <input
                    type="text"
                    value={stage.name}
                    onChange={(e) => {
                      const val = e.target.value
                      setFormData(prev => {
                        const updated = [...(prev.conditions?.infectionStages || [])]
                        updated[stIdx] = { ...updated[stIdx], name: val }
                        return { ...prev, conditions: { ...prev.conditions, infectionStages: updated } }
                      })
                    }}
                    style={{ fontSize: 11, fontWeight: 'bold' }}
                  />
                  <input
                    type="text"
                    value={stage.desc}
                    onChange={(e) => {
                      const val = e.target.value
                      setFormData(prev => {
                        const updated = [...(prev.conditions?.infectionStages || [])]
                        updated[stIdx] = { ...updated[stIdx], desc: val }
                        return { ...prev, conditions: { ...prev.conditions, infectionStages: updated } }
                      })
                    }}
                    style={{ fontSize: 11 }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-ABA 6: TEMPO ON/OFF & LEGADO                                          */}
      {/* ========================================================================= */}
      {activeSubTab === 'survival_time' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="glass-light" style={{ padding: 18, borderRadius: 12 }}>
            <h4 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 14 }}>
              ⏱️ Proporção Temporal & Conversões ON / OFF
            </h4>
            <div className="form-group">
              <label>Texto Explicativo de Tempo</label>
              <textarea
                rows={2}
                value={formData.survivalTime?.introText || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  survivalTime: { ...prev.survivalTime, introText: e.target.value }
                }))}
              />
            </div>
          </div>

          <div className="glass-light" style={{ padding: 18, borderRadius: 12 }}>
            <h4 style={{ fontSize: 13, textTransform: 'uppercase', color: '#facc15', marginBottom: 14 }}>
              🕯️ Sistema de Legado ao Morrer
            </h4>
            <div className="form-group">
              <label>Título do Legado</label>
              <input
                type="text"
                value={formData.survivalTime?.legacy?.title || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  survivalTime: {
                    ...prev.survivalTime,
                    legacy: { ...prev.survivalTime?.legacy, title: e.target.value }
                  }
                }))}
              />
            </div>
            <div className="form-group">
              <label>Descrição do Legado</label>
              <textarea
                rows={2}
                value={formData.survivalTime?.legacy?.description || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  survivalTime: {
                    ...prev.survivalTime,
                    legacy: { ...prev.survivalTime?.legacy, description: e.target.value }
                  }
                }))}
              />
            </div>
          </div>
        </div>
      )}
    </form>
  )
}
