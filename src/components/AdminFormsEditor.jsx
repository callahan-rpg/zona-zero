import { useState, useEffect } from 'react'
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { sendFormToDiscord } from '../utils/discordFormService'

const EMPTY_FIELD = {
  id: '',
  label: '',
  type: 'text', // text | textarea | number | select | multiselect | checkbox | image
  placeholder: '',
  helperText: '',
  required: false,
  inline: false,
  options: [] // Para select / multiselect
}

const EMPTY_FORM = {
  id: '',
  title: '',
  subtitle: '',
  icon: '📝',
  description: '',
  locationSlug: '', // slug da locação ou '' para Global / Qualquer sala
  locationName: '',
  webhookUrl: '',
  buttonText: '📨 Enviar Formulário',
  buttonColor: '#eab308',
  embedColor: '#eab308',
  botUsername: 'Zona Zero • Central',
  botAvatarUrl: '',
  notifyPing: '', // Ex: @here ou <@&ID_DO_CARGO>
  successMessageTitle: 'Formulário Transmitido!',
  successMessageDescription: 'Suas informações foram registradas com sucesso e enviadas para a moderação.',
  enabled: true,
  fields: [
    { id: 'motivo', label: 'Motivo / Assunto', type: 'text', placeholder: 'Ex: Denúncia, Pedido de Suprimentos, etc.', required: true, inline: false },
    { id: 'detalhes', label: 'Relato Detalhado', type: 'textarea', placeholder: 'Descreva tudo detalhadamente...', required: true, inline: false },
    { id: 'anexo_foto', label: 'Foto / Prova Visual', type: 'image', placeholder: 'Envie uma foto de comprovação...', required: false, inline: false }
  ]
}

export default function AdminFormsEditor({ locations = [] }) {
  const [forms, setForms] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [testingWebhook, setTestingWebhook] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  // Listener em tempo real dos formulários configurados (/custom_forms)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'custom_forms'), (snap) => {
      setForms(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, (err) => {
      console.error('Erro ao escutar formulários customizados:', err)
      setLoading(false)
    })
    return unsub
  }, [])

  function handleStartEdit(f) {
    setEditingId(f.id)
    setForm({
      id: f.id,
      title: f.title || '',
      subtitle: f.subtitle || '',
      icon: f.icon || '📝',
      description: f.description || '',
      locationSlug: f.locationSlug || '',
      locationName: f.locationName || '',
      webhookUrl: f.webhookUrl || '',
      buttonText: f.buttonText || '📨 Enviar Formulário',
      buttonColor: f.buttonColor || '#eab308',
      embedColor: f.embedColor || '#eab308',
      botUsername: f.botUsername || 'Zona Zero • Central',
      botAvatarUrl: f.botAvatarUrl || '',
      notifyPing: f.notifyPing || '',
      successMessageTitle: f.successMessageTitle || 'Formulário Transmitido!',
      successMessageDescription: f.successMessageDescription || 'Suas informações foram registradas com sucesso e enviadas para a moderação.',
      enabled: f.enabled !== false,
      fields: Array.isArray(f.fields) && f.fields.length > 0 ? f.fields : []
    })
  }

  function handleCancelEdit() {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  // Adiciona um novo campo ao formulário atual
  function handleAddField() {
    const newId = 'campo_' + Math.random().toString(36).substring(2, 7)
    setForm(prev => ({
      ...prev,
      fields: [
        ...prev.fields,
        {
          id: newId,
          label: 'Novo Campo',
          type: 'text',
          placeholder: '',
          helperText: '',
          required: false,
          inline: false,
          options: []
        }
      ]
    }))
  }

  function handleRemoveField(index) {
    setForm(prev => ({
      ...prev,
      fields: prev.fields.filter((_, i) => i !== index)
    }))
  }

  function handleUpdateField(index, key, value) {
    setForm(prev => {
      const updated = [...prev.fields]
      updated[index] = { ...updated[index], [key]: value }
      return { ...prev, fields: updated }
    })
  }

  function handleFieldOptionsChange(index, rawText) {
    // Quebra por vírgula ou nova linha
    const opts = rawText.split(/[,\n]/).map(s => s.trim()).filter(Boolean)
    handleUpdateField(index, 'options', opts)
  }

  // Testar Webhook do Discord ao vivo
  async function handleTestWebhook() {
    if (!form.webhookUrl) return alert('Por favor, informe a URL do Webhook do Discord para testar.')
    setTestingWebhook(true)
    try {
      await sendFormToDiscord({
        webhookUrl: form.webhookUrl,
        formConfig: form,
        fieldValues: (form.fields || []).reduce((acc, f) => {
          acc[f.id] = f.type === 'checkbox' ? true : (f.type === 'image' ? 'https://res.cloudinary.com/z3cr8lix/image/upload/v1789136338/iszapvfszdg6phioddwn.png' : `[Valor Teste] ${f.label}`)
          return acc
        }, {}),
        userData: {
          uid: 'admin_test_123',
          name: 'Painel Admin (Simulação)',
          profession: 'Administrador',
          locationName: form.locationName || 'Painel de Controle',
          avatarUrl: 'https://res.cloudinary.com/z3cr8lix/image/upload/v1789136338/iszapvfszdg6phioddwn.png'
        }
      })
      alert('✅ Mensagem de teste enviada com sucesso para o seu Discord!')
    } catch (err) {
      alert('❌ Erro no teste do Webhook: ' + err.message)
    } finally {
      setTestingWebhook(false)
    }
  }

  async function handleSaveForm(e) {
    e.preventDefault()
    if (!form.title.trim()) return alert('O título do formulário é obrigatório.')
    if (!form.webhookUrl.trim()) return alert('A URL do Webhook do Discord é obrigatória.')

    const formId = editingId || (form.title.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now().toString(36))

    // Acha nome da locação
    let locName = 'Todas as Locações (Global)'
    if (form.locationSlug) {
      const found = locations.find(l => l.slug === form.locationSlug)
      if (found) locName = found.name
    }

    const payload = {
      ...form,
      id: formId,
      title: form.title.trim(),
      subtitle: form.subtitle.trim(),
      description: form.description.trim(),
      locationSlug: form.locationSlug.trim(),
      locationName: locName,
      webhookUrl: form.webhookUrl.trim(),
      updatedAt: new Date().toISOString()
    }

    setSaving(true)
    try {
      await setDoc(doc(db, 'custom_forms', formId), payload)
      alert(editingId ? 'Formulário atualizado com sucesso!' : 'Novo formulário criado com sucesso!')
      handleCancelEdit()
    } catch (err) {
      alert('Erro ao salvar formulário: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteForm(id) {
    if (!confirm('Deseja realmente excluir este formulário? Os jogadores não poderão mais preenchê-lo.')) return
    try {
      await deleteDoc(doc(db, 'custom_forms', id))
      if (editingId === id) handleCancelEdit()
      alert('Formulário excluído com sucesso!')
    } catch (err) {
      alert('Erro ao excluir: ' + err.message)
    }
  }

  const filteredForms = forms.filter(f => {
    const q = searchTerm.toLowerCase().trim()
    if (!q) return true
    return (
      (f.title || '').toLowerCase().includes(q) ||
      (f.locationName || '').toLowerCase().includes(q) ||
      (f.description || '').toLowerCase().includes(q)
    )
  })

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.4fr', gap: 20 }}>
      {/* Coluna 1: Lista de Formulários Criados */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="glass-light" style={{ padding: 16, borderRadius: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15, color: '#facc15', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>📝</span> Formulários Configurados ({forms.length})
            </h3>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => {
                setEditingId(null)
                setForm(EMPTY_FORM)
              }}
              style={{ fontSize: 11, background: '#eab308', borderColor: '#facc15', color: '#000', fontWeight: 'bold' }}
            >
              ➕ Novo Formulário
            </button>
          </div>

          <input
            type="text"
            placeholder="🔍 Buscar por título ou sala..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '7px 10px', fontSize: 12, marginBottom: 12 }}
          />

          {loading ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>Carregando formulários...</div>
          ) : filteredForms.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)', fontSize: 12 }}>
              Nenhum formulário cadastrado ainda. Crie seu primeiro formulário ao lado e conecte com o seu Discord!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '680px', overflowY: 'auto' }}>
              {filteredForms.map(f => (
                <div
                  key={f.id}
                  className="glass"
                  style={{
                    padding: '12px 14px',
                    borderRadius: 10,
                    borderLeft: `4px solid ${f.embedColor || '#eab308'}`,
                    border: editingId === f.id ? '1px solid #facc15' : '1px solid rgba(255,255,255,0.06)',
                    background: editingId === f.id ? 'rgba(234, 179, 8, 0.08)' : 'rgba(0,0,0,0.3)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 20 }}>{f.icon || '📝'}</span>
                      <div>
                        <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>{f.title}</strong>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          📍 {f.locationSlug ? (f.locationName || f.locationSlug) : '🌐 Em todas as salas (Global)'}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => handleStartEdit(f)}
                        style={{ padding: '3px 8px', fontSize: 11 }}
                      >
                        ✏️ Editar
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDeleteForm(f.id)}
                        style={{ padding: '3px 8px', fontSize: 11 }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  {f.description && (
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)', opacity: 0.85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {f.description}
                    </p>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, fontSize: 10.5, color: 'var(--text-muted)' }}>
                    <span>🗂️ {f.fields?.length || 0} campos configurados</span>
                    <span style={{ color: f.enabled !== false ? '#4ade80' : '#f87171', fontWeight: 'bold' }}>
                      {f.enabled !== false ? '● Ativo' : '○ Desativado'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Coluna 2: Formulário de Configuração & Customização */}
      <div>
        <form onSubmit={handleSaveForm} className="glass-light" style={{ padding: 20, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15, color: '#facc15' }}>
              {editingId ? '✏️ Editar Formulário Discord' : '➕ Configurar Novo Formulário Discord'}
            </h3>
            {editingId && (
              <button
                type="button"
                className="btn btn-sm"
                onClick={handleCancelEdit}
                style={{ fontSize: 11 }}
              >
                Cancelar Edição
              </button>
            )}
          </div>

          {/* Dados Principais */}
          <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: 10 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: 11 }}>Ícone</label>
              <input
                type="text"
                value={form.icon}
                onChange={e => setForm(prev => ({ ...prev, icon: e.target.value }))}
                placeholder="📝"
                style={{ textAlign: 'center', fontSize: 16, padding: '7px' }}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: 11 }}>Título do Formulário *</label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ex: Requisição de Munição, Boletim de Ocorrência..."
                required
                style={{ padding: '7px 10px', fontSize: 12 }}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: 11 }}>Subtítulo / Linha de Apoio (Opcional)</label>
            <input
              type="text"
              value={form.subtitle}
              onChange={e => setForm(prev => ({ ...prev, subtitle: e.target.value }))}
              placeholder="Ex: Preencha com cautela. Falsos relatos serão punidos."
              style={{ padding: '7px 10px', fontSize: 12 }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: 11 }}>Descrição / Instruções aos Jogadores</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Explique o propósito deste formulário..."
              style={{ width: '100%', padding: '7px 10px', fontSize: 12 }}
            />
          </div>

          {/* Onde o formulário vai aparecer */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: 11, color: '#38bdf8', fontWeight: 600 }}>📍 Local Onde o Formulário Ficará</label>
              <select
                value={form.locationSlug}
                onChange={e => {
                  const slug = e.target.value
                  const loc = locations.find(l => l.slug === slug)
                  setForm(prev => ({ ...prev, locationSlug: slug, locationName: loc?.name || '' }))
                }}
                style={{ padding: '7px 10px', fontSize: 12 }}
              >
                <option value="">🌐 Todas as Locações (Botão Global)</option>
                {locations.map(l => (
                  <option key={l.slug || l.id} value={l.slug}>
                    {l.name} ({l.slug})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: 11 }}>Texto do Botão de Abertura</label>
              <input
                type="text"
                value={form.buttonText}
                onChange={e => setForm(prev => ({ ...prev, buttonText: e.target.value }))}
                placeholder="Ex: 📝 Fazer Denúncia"
                style={{ padding: '7px 10px', fontSize: 12 }}
              />
            </div>
          </div>

          {/* Integração Webhook do Discord */}
          <div className="glass" style={{ padding: 14, borderRadius: 10, border: '1px solid rgba(88, 101, 242, 0.4)', background: 'rgba(88, 101, 242, 0.08)' }}>
            <h4 style={{ margin: '0 0 10px', fontSize: 12.5, color: '#818cf8', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>👾</span> Integração Discord Webhook
            </h4>
            
            <div className="form-group" style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11 }}>URL do Webhook do Discord *</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="url"
                  value={form.webhookUrl}
                  onChange={e => setForm(prev => ({ ...prev, webhookUrl: e.target.value }))}
                  placeholder="https://discord.com/api/webhooks/..."
                  required
                  style={{ flex: 1, padding: '7px 10px', fontSize: 11, fontFamily: 'monospace' }}
                />
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={handleTestWebhook}
                  disabled={testingWebhook || !form.webhookUrl}
                  style={{ background: '#5865f2', borderColor: '#818cf8', color: '#fff', fontSize: 11, whiteSpace: 'nowrap' }}
                >
                  {testingWebhook ? '⏳ Testando...' : '🚀 Testar Webhook'}
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px', gap: 8 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: 10 }}>Nome do Bot no Discord</label>
                <input
                  type="text"
                  value={form.botUsername}
                  onChange={e => setForm(prev => ({ ...prev, botUsername: e.target.value }))}
                  placeholder="Zona Zero • Central"
                  style={{ padding: '6px 8px', fontSize: 11 }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: 10 }}>Menção / Ping (Opcional)</label>
                <input
                  type="text"
                  value={form.notifyPing}
                  onChange={e => setForm(prev => ({ ...prev, notifyPing: e.target.value }))}
                  placeholder="Ex: @here ou <@&ROLE_ID>"
                  style={{ padding: '6px 8px', fontSize: 11 }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: 10 }}>Cor do Embed</label>
                <input
                  type="color"
                  value={form.embedColor || '#eab308'}
                  onChange={e => setForm(prev => ({ ...prev, embedColor: e.target.value }))}
                  style={{ width: '100%', height: '32px', padding: 2, background: 'none', border: '1px solid var(--glass-border)', borderRadius: 6, cursor: 'pointer' }}
                />
              </div>
            </div>
          </div>

          {/* Construtor Dinâmico de Campos do Formulário */}
          <div className="glass" style={{ padding: 14, borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h4 style={{ margin: 0, fontSize: 13, color: '#facc15', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>🎛️</span> Campos do Formulário ({form.fields?.length || 0})
              </h4>
              <button
                type="button"
                className="btn btn-sm"
                onClick={handleAddField}
                style={{ fontSize: 11, background: 'rgba(255,255,255,0.06)' }}
              >
                ➕ Adicionar Campo
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(form.fields || []).map((field, idx) => (
                <div
                  key={field.id || idx}
                  style={{
                    padding: 12,
                    background: 'rgba(0,0,0,0.25)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8
                  }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 40px', gap: 8, alignItems: 'center' }}>
                    <input
                      type="text"
                      value={field.label}
                      onChange={e => handleUpdateField(idx, 'label', e.target.value)}
                      placeholder="Nome / Rótulo do Campo"
                      style={{ padding: '6px 8px', fontSize: 11.5, fontWeight: 600 }}
                    />

                    <select
                      value={field.type}
                      onChange={e => handleUpdateField(idx, 'type', e.target.value)}
                      style={{ padding: '6px 8px', fontSize: 11.5 }}
                    >
                      <option value="text">✏️ Texto Curto</option>
                      <option value="textarea">📜 Texto Longo</option>
                      <option value="number">🔢 Número</option>
                      <option value="select">🔽 Lista / Seleção Única</option>
                      <option value="multiselect">☑️ Múltipla Escolha</option>
                      <option value="checkbox">🔘 Checkbox (Sim/Não)</option>
                      <option value="image">📷 Envio de Foto</option>
                    </select>

                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => handleRemoveField(idx)}
                      style={{ padding: '4px', fontSize: 12, height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Excluir este campo"
                    >
                      🗑️
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <input
                      type="text"
                      value={field.placeholder || ''}
                      onChange={e => handleUpdateField(idx, 'placeholder', e.target.value)}
                      placeholder="Placeholder (ex: Digite aqui...)"
                      style={{ padding: '5px 8px', fontSize: 11 }}
                    />
                    <input
                      type="text"
                      value={field.helperText || ''}
                      onChange={e => handleUpdateField(idx, 'helperText', e.target.value)}
                      placeholder="Texto de ajuda (opcional)"
                      style={{ padding: '5px 8px', fontSize: 11 }}
                    />
                  </div>

                  {/* Se for select ou multiselect, exibe opções */}
                  {(field.type === 'select' || field.type === 'multiselect') && (
                    <div style={{ marginTop: 2 }}>
                      <label style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        Opções de Escolha (separe por vírgulas ou quebra de linha):
                      </label>
                      <input
                        type="text"
                        value={(field.options || []).join(', ')}
                        onChange={e => handleFieldOptionsChange(idx, e.target.value)}
                        placeholder="Ex: Opção A, Opção B, Opção C"
                        style={{ padding: '5px 8px', fontSize: 11 }}
                      />
                    </div>
                  )}

                  {/* Se for checkbox, permite definir o texto do checkbox */}
                  {field.type === 'checkbox' && (
                    <div style={{ marginTop: 2 }}>
                      <label style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        Texto do Checkbox (ao lado da caixa de marcação):
                      </label>
                      <input
                        type="text"
                        value={field.checkboxLabel || ''}
                        onChange={e => handleUpdateField(idx, 'checkboxLabel', e.target.value)}
                        placeholder="Ex: Confirmo que li e estou ciente."
                        style={{ padding: '5px 8px', fontSize: 11 }}
                      />
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={!!field.required}
                        onChange={e => handleUpdateField(idx, 'required', e.target.checked)}
                      />
                      <span>Obrigatório</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={!!field.inline}
                        onChange={e => handleUpdateField(idx, 'inline', e.target.checked)}
                      />
                      <span>Exibir lado a lado no Discord (Inline)</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Botão de Salvar */}
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
              style={{
                flex: 1,
                padding: '10px',
                background: '#eab308',
                borderColor: '#facc15',
                color: '#000',
                fontWeight: 700,
                fontSize: 13
              }}
            >
              {saving ? '⏳ Salvando...' : (editingId ? '💾 Salvar Alterações' : '➕ Criar Formulário Discord')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
