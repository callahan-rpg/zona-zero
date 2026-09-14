import { useState, useEffect } from 'react'
import { doc, updateDoc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase/config'
import {
  DEFAULT_DISEASES,
  DEFAULT_SYMPTOMS,
  DEFAULT_MOODLES,
  DEFAULT_MEDICINE_TREATMENTS,
} from '../utils/diseaseDefaults'
import { uploadImageFree } from '../utils/imageUpload'

export default function AdminDiseasesEditor() {
  const [subTab, setSubTab] = useState('diseases') // 'diseases' | 'moodles' | 'medicines'
  const [loading, setLoading] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [feedback, setFeedback] = useState(null)

  // Estados locais das configurações
  const [diseases, setDiseases] = useState(DEFAULT_DISEASES)
  const [moodles, setMoodles] = useState(DEFAULT_MOODLES)
  const [medicines, setMedicines] = useState(DEFAULT_MEDICINE_TREATMENTS)
  const [selectedDiseaseId, setSelectedDiseaseId] = useState('resfriado')
  const [selectedMoodleId, setSelectedMoodleId] = useState('moodle_febre')

  // Carrega configuração salva no Firestore (se houver)
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'game_config', 'global'), (snap) => {
      if (snap.exists()) {
        const data = snap.data()
        if (data.diseaseConfig) {
          if (data.diseaseConfig.diseases) setDiseases(data.diseaseConfig.diseases)
          if (data.diseaseConfig.moodles) setMoodles(data.diseaseConfig.moodles)
          if (data.diseaseConfig.medicines) setMedicines(data.diseaseConfig.medicines)
        }
      }
    })
    return unsub
  }, [])

  // Salva no Firestore
  async function handleSaveConfig() {
    setLoading(true)
    try {
      const configRef = doc(db, 'game_config', 'global')
      await updateDoc(configRef, {
        diseaseConfig: {
          diseases,
          moodles,
          medicines,
          updatedAt: Date.now()
        }
      })
      setFeedback({ type: 'success', text: 'Configurações de Doenças, Moodles e Medicamentos salvas com sucesso!' })
      setTimeout(() => setFeedback(null), 4000)
    } catch (err) {
      console.error('Erro ao salvar diseaseConfig:', err)
      setFeedback({ type: 'danger', text: 'Falha ao salvar: ' + err.message })
    } finally {
      setLoading(false)
    }
  }

  // Restaura padrões de código
  function handleRestoreDefaults() {
    if (!confirm('Deseja restaurar todas as configurações de Doenças, Moodles e Medicamentos para os padrões originais?')) return
    setDiseases(DEFAULT_DISEASES)
    setMoodles(DEFAULT_MOODLES)
    setMedicines(DEFAULT_MEDICINE_TREATMENTS)
    setFeedback({ type: 'success', text: 'Padrões restaurados. Lembre-se de clicar em "Salvar Configurações".' })
  }

  const currentDisease = diseases[selectedDiseaseId] || {}
  const currentMoodle = moodles[selectedMoodleId] || {}

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header com Abas e Ações */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, borderBottom: '1px solid var(--glass-border)', paddingBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className={`btn btn-sm ${subTab === 'diseases' ? 'btn-primary' : ''}`}
            onClick={() => setSubTab('diseases')}
            style={subTab !== 'diseases' ? { color: '#94a3b8' } : undefined}
          >
            🦠 Doenças ({Object.keys(diseases).length})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${subTab === 'moodles' ? 'btn-primary' : ''}`}
            onClick={() => setSubTab('moodles')}
            style={subTab !== 'moodles' ? { color: '#94a3b8' } : undefined}
          >
            🎭 Moodles Visuais ({Object.keys(moodles).length})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${subTab === 'medicines' ? 'btn-primary' : ''}`}
            onClick={() => setSubTab('medicines')}
            style={subTab !== 'medicines' ? { color: '#94a3b8' } : undefined}
          >
            💊 Remédios & Tratamentos ({Object.keys(medicines).length})
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={handleRestoreDefaults}
            disabled={loading}
            title="Recarrega os valores padrão"
          >
            ↺ Restaurar Padrões
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={handleSaveConfig}
            disabled={loading}
            style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', borderColor: '#34d399', fontWeight: 700 }}
          >
            {loading ? 'Salvando...' : '💾 Salvar Configurações'}
          </button>
        </div>
      </div>

      {feedback && (
        <div style={{
          padding: '10px 14px',
          borderRadius: '6px',
          fontSize: '12px',
          background: feedback.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          border: `1px solid ${feedback.type === 'success' ? '#22c55e' : '#ef4444'}`,
          color: feedback.type === 'success' ? '#86efac' : '#fca5a5'
        }}>
          {feedback.text}
        </div>
      )}

      {/* SUB-ABA 1: CONFIGURAÇÃO DE DOENÇAS */}
      {subTab === 'diseases' && (
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20 }}>
          {/* Lista lateral de doenças */}
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 8, border: '1px solid var(--glass-border)', height: 'fit-content' }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 10 }}>
              Selecione a Doença:
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {Object.entries(diseases).map(([id, dis]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedDiseaseId(id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: selectedDiseaseId === id ? '1px solid var(--accent-yellow)' : '1px solid rgba(255,255,255,0.06)',
                    background: selectedDiseaseId === id ? 'rgba(250, 204, 21, 0.12)' : 'rgba(255,255,255,0.02)',
                    color: selectedDiseaseId === id ? '#fde047' : '#e2e8f0',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: selectedDiseaseId === id ? 700 : 500
                  }}
                >
                  <span>{dis.name}</span>
                  <span style={{
                    fontSize: 10,
                    padding: '1px 5px',
                    borderRadius: 3,
                    background: dis.severity === 'severe' ? 'rgba(239, 68, 68, 0.2)' : dis.severity === 'moderate' ? 'rgba(249, 115, 22, 0.2)' : 'rgba(74, 222, 128, 0.2)',
                    color: dis.severity === 'severe' ? '#fca5a5' : dis.severity === 'moderate' ? '#fdba74' : '#86efac'
                  }}>
                    {dis.severity === 'severe' ? 'Grave' : dis.severity === 'moderate' ? 'Mod' : 'Leve'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Editor da doença selecionada */}
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: 20, borderRadius: 8, border: '1px solid var(--glass-border)' }}>
            <h4 style={{ margin: '0 0 16px', color: 'var(--accent-yellow)', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🦠</span> {currentDisease.name} ({selectedDiseaseId})
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Nome Exibido</label>
                <input
                  type="text"
                  className="input-field"
                  value={currentDisease.name || ''}
                  onChange={(e) => setDiseases(prev => ({
                    ...prev,
                    [selectedDiseaseId]: { ...prev[selectedDiseaseId], name: e.target.value }
                  }))}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Severidade</label>
                <select
                  className="input-field"
                  value={currentDisease.severity || 'mild'}
                  onChange={(e) => setDiseases(prev => ({
                    ...prev,
                    [selectedDiseaseId]: { ...prev[selectedDiseaseId], severity: e.target.value }
                  }))}
                >
                  <option value="mild">Leve</option>
                  <option value="moderate">Moderada</option>
                  <option value="severe">Grave</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Incubação (minutos online)</label>
                <input
                  type="number"
                  className="input-field"
                  value={currentDisease.incubationMinutes ?? 30}
                  onChange={(e) => setDiseases(prev => ({
                    ...prev,
                    [selectedDiseaseId]: { ...prev[selectedDiseaseId], incubationMinutes: Number(e.target.value) }
                  }))}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Duração Total (minutos online)</label>
                <input
                  type="number"
                  className="input-field"
                  value={currentDisease.durationMinutes ?? 180}
                  onChange={(e) => setDiseases(prev => ({
                    ...prev,
                    [selectedDiseaseId]: { ...prev[selectedDiseaseId], durationMinutes: Number(e.target.value) }
                  }))}
                />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Descrição Narrativa da Doença</label>
              <textarea
                className="input-field"
                rows={2}
                value={currentDisease.description || ''}
                onChange={(e) => setDiseases(prev => ({
                  ...prev,
                  [selectedDiseaseId]: { ...prev[selectedDiseaseId], description: e.target.value }
                }))}
              />
            </div>

            {/* Estágios da Doença */}
            <div>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#38bdf8', display: 'block', marginBottom: 8 }}>
                Estágios de Evolução ({currentDisease.stages?.length || 0})
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(currentDisease.stages || []).map((stage, sIdx) => (
                  <div key={sIdx} style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <strong style={{ fontSize: 12, color: '#facc15' }}>Estágio {stage.stageIndex}: {stage.name}</strong>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Duração: {stage.durationMinutes} min</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>
                      Sintomas associados: {stage.symptoms?.map(s => `${s.symptomId} (nível ${s.level}, ${(s.chance * 100).toFixed(0)}%)`).join(' · ') || 'Nenhum'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-ABA 2: CONFIGURAÇÃO DE MOODLES */}
      {subTab === 'moodles' && (
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20 }}>
          {/* Lista lateral de moodles */}
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 8, border: '1px solid var(--glass-border)', height: 'fit-content' }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 10 }}>
              Selecione o Moodle:
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {Object.entries(moodles).map(([id, m]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedMoodleId(id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: selectedMoodleId === id ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.06)',
                    background: selectedMoodleId === id ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255,255,255,0.02)',
                    color: selectedMoodleId === id ? '#7dd3fc' : '#e2e8f0',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: selectedMoodleId === id ? 700 : 500
                  }}
                >
                  <span style={{ fontSize: 16 }}>{m.defaultIcon}</span>
                  <span>{m.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Editor do Moodle */}
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: 20, borderRadius: 8, border: '1px solid var(--glass-border)' }}>
            <h4 style={{ margin: '0 0 16px', color: '#38bdf8', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>{currentMoodle.defaultIcon}</span> Moodle: {currentMoodle.name} ({selectedMoodleId})
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Nome do Moodle</label>
                <input
                  type="text"
                  className="input-field"
                  value={currentMoodle.name || ''}
                  onChange={(e) => setMoodles(prev => ({
                    ...prev,
                    [selectedMoodleId]: { ...prev[selectedMoodleId], name: e.target.value }
                  }))}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Ícone Padrão (Emoji ou Caractere)</label>
                <input
                  type="text"
                  className="input-field"
                  value={currentMoodle.defaultIcon || ''}
                  onChange={(e) => setMoodles(prev => ({
                    ...prev,
                    [selectedMoodleId]: { ...prev[selectedMoodleId], defaultIcon: e.target.value }
                  }))}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Prioridade no HUD (1-10)</label>
                <input
                  type="number"
                  className="input-field"
                  value={currentMoodle.priority ?? 5}
                  onChange={(e) => setMoodles(prev => ({
                    ...prev,
                    [selectedMoodleId]: { ...prev[selectedMoodleId], priority: Number(e.target.value) }
                  }))}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  URL de Imagem Geral do Moodle (Fallback)
                </label>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {currentMoodle.customImageUrl && (
                    <div style={{
                      width: 34,
                      height: 34,
                      borderRadius: 6,
                      border: '1px solid rgba(255,255,255,0.2)',
                      background: 'rgba(0,0,0,0.5)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      overflow: 'hidden'
                    }}>
                      <img src={currentMoodle.customImageUrl} alt="Preview Moodle" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>
                  )}
                  <input
                    type="text"
                    className="input-field"
                    placeholder="https://... (ou envie pelo botão)"
                    value={currentMoodle.customImageUrl || ''}
                    onChange={(e) => setMoodles(prev => ({
                      ...prev,
                      [selectedMoodleId]: { ...prev[selectedMoodleId], customImageUrl: e.target.value }
                    }))}
                    style={{ flex: 1, fontSize: 11 }}
                  />
                  <label
                    style={{
                      background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2) 0%, rgba(2, 132, 199, 0.3) 100%)',
                      border: '1px solid #38bdf8',
                      color: '#7dd3fc',
                      padding: '6px 10px',
                      borderRadius: 6,
                      fontSize: 10.5,
                      fontWeight: 600,
                      cursor: uploadingImage ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    📤 {uploadingImage ? 'Enviando...' : 'Upload'}
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      disabled={uploadingImage}
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        setUploadingImage(true)
                        try {
                          const url = await uploadImageFree(file)
                          if (url) {
                            setMoodles(prev => ({
                              ...prev,
                              [selectedMoodleId]: { ...prev[selectedMoodleId], customImageUrl: url }
                            }))
                          }
                        } catch (err) {
                          alert('Falha no upload da imagem: ' + err.message)
                        } finally {
                          setUploadingImage(false)
                        }
                      }}
                    />
                  </label>
                  {currentMoodle.customImageUrl && (
                    <button
                      type="button"
                      onClick={() => setMoodles(prev => ({
                        ...prev,
                        [selectedMoodleId]: { ...prev[selectedMoodleId], customImageUrl: '' }
                      }))}
                      style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid #ef4444', color: '#fca5a5', padding: '4px 7px', borderRadius: 6, fontSize: 10, cursor: 'pointer' }}
                      title="Remover imagem"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Imagens por Nível */}
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#facc15', display: 'block' }}>
                  Imagens Customizadas por Nível de Intensidade (Cloudinary / URL):
                </span>
                <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                  Pressione o botão 📤 Upload para carregar imagens diretamente do seu computador
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                {[1, 2, 3].map(lvl => {
                  const lvlUrl = currentMoodle.imagesByLevel?.[lvl] || ''
                  return (
                    <div key={lvl} style={{ background: 'rgba(255,255,255,0.02)', padding: 10, borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: lvl === 3 ? '#ef4444' : lvl === 2 ? '#f59e0b' : '#38bdf8', margin: 0 }}>
                          Nível {lvl} {lvl === 1 ? '(Leve)' : lvl === 2 ? '(Moderado)' : '(Crítico)'}
                        </label>
                        {lvlUrl && <span style={{ fontSize: 9.5, color: '#34d399', fontWeight: 600 }}>✓ Imagem ativa</span>}
                      </div>

                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {lvlUrl && (
                          <div style={{
                            width: 36,
                            height: 36,
                            borderRadius: 6,
                            border: '1px solid rgba(255,255,255,0.2)',
                            background: 'rgba(0,0,0,0.5)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            overflow: 'hidden'
                          }}>
                            <img src={lvlUrl} alt={`Moodle Lvl ${lvl}`} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                          </div>
                        )}
                        <input
                          type="text"
                          className="input-field"
                          placeholder={`URL nível ${lvl}...`}
                          value={lvlUrl}
                          onChange={(e) => {
                            const val = e.target.value
                            setMoodles(prev => ({
                              ...prev,
                              [selectedMoodleId]: {
                                ...prev[selectedMoodleId],
                                imagesByLevel: {
                                  ...(prev[selectedMoodleId]?.imagesByLevel || {}),
                                  [lvl]: val
                                }
                              }
                            }))
                          }}
                          style={{ flex: 1, fontSize: 11 }}
                        />
                        <label
                          style={{
                            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(217, 119, 6, 0.3) 100%)',
                            border: '1px solid #f59e0b',
                            color: '#fde047',
                            padding: '6px 10px',
                            borderRadius: 6,
                            fontSize: 10.5,
                            fontWeight: 600,
                            cursor: uploadingImage ? 'not-allowed' : 'pointer',
                            whiteSpace: 'nowrap',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          📤 Upload
                          <input
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            disabled={uploadingImage}
                            onChange={async (e) => {
                              const file = e.target.files?.[0]
                              if (!file) return
                              setUploadingImage(true)
                              try {
                                const url = await uploadImageFree(file)
                                if (url) {
                                  setMoodles(prev => ({
                                    ...prev,
                                    [selectedMoodleId]: {
                                      ...prev[selectedMoodleId],
                                      imagesByLevel: {
                                        ...(prev[selectedMoodleId]?.imagesByLevel || {}),
                                        [lvl]: url
                                      }
                                    }
                                  }))
                                }
                              } catch (err) {
                                alert('Falha no upload da imagem: ' + err.message)
                              } finally {
                                setUploadingImage(false)
                              }
                            }}
                          />
                        </label>
                        {lvlUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              setMoodles(prev => ({
                                ...prev,
                                [selectedMoodleId]: {
                                  ...prev[selectedMoodleId],
                                  imagesByLevel: {
                                    ...(prev[selectedMoodleId]?.imagesByLevel || {}),
                                    [lvl]: ''
                                  }
                                }
                              }))
                            }}
                            style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid #ef4444', color: '#fca5a5', padding: '4px 7px', borderRadius: 6, fontSize: 10, cursor: 'pointer' }}
                            title="Remover imagem deste nível"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-ABA 3: CONFIGURAÇÃO DE MEDICAMENTOS */}
      {subTab === 'medicines' && (
        <div style={{ background: 'rgba(0,0,0,0.3)', padding: 20, borderRadius: 8, border: '1px solid var(--glass-border)' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#4ade80', display: 'block', marginBottom: 4 }}>
            💊 Tabela de Tratamentos e Remédios Cadastrados
          </span>
          <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 16 }}>
            Configure quais doenças cada medicamento trata e cura ao ser consumido pelo sobrevivente.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Object.entries(medicines).map(([itemId, med]) => (
              <div key={itemId} style={{ background: 'rgba(255,255,255,0.02)', padding: 14, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <strong style={{ fontSize: 13, color: '#fff' }}>{med.name} ({itemId})</strong>
                  <span style={{ fontSize: 11, color: '#4ade80', fontWeight: 600 }}>Chance de Cura: {((med.cureChance ?? 1) * 100).toFixed(0)}%</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
                  <div>
                    <label style={{ fontSize: 10.5, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>
                      Doenças que Cura (separadas por vírgula):
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      value={Array.isArray(med.cureDiseases) ? med.cureDiseases.join(', ') : ''}
                      onChange={(e) => {
                        const val = e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                        setMedicines(prev => ({
                          ...prev,
                          [itemId]: { ...prev[itemId], cureDiseases: val }
                        }))
                      }}
                      style={{ fontSize: 11 }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 10.5, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>
                      Sintomas que Alivia (separados por vírgula):
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      value={Array.isArray(med.relieveSymptoms) ? med.relieveSymptoms.join(', ') : ''}
                      onChange={(e) => {
                        const val = e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                        setMedicines(prev => ({
                          ...prev,
                          [itemId]: { ...prev[itemId], relieveSymptoms: val }
                        }))
                      }}
                      style={{ fontSize: 11 }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 10.5, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>
                    Mensagem Narrativa de Cura / Efeito:
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={med.successMessage || ''}
                    onChange={(e) => {
                      const val = e.target.value
                      setMedicines(prev => ({
                        ...prev,
                        [itemId]: { ...prev[itemId], successMessage: val }
                      }))
                    }}
                    style={{ fontSize: 11 }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
