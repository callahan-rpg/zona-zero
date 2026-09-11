import { useState } from 'react'
import { uploadImageFree } from '../utils/imageUpload'
import { sendFormToDiscord } from '../utils/discordFormService'

export default function CustomFormModal({ form, character, user, locationName, onClose }) {
  const [fieldValues, setFieldValues] = useState(() => {
    const initial = {}
    ;(form.fields || []).forEach(f => {
      if (f.type === 'checkbox') {
        initial[f.id] = false
      } else if (f.type === 'multiselect') {
        initial[f.id] = []
      } else {
        initial[f.id] = f.defaultValue || ''
      }
    })
    return initial
  })

  const [uploadingFieldId, setUploadingFieldId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState(null)

  function handleChange(fieldId, val) {
    setFieldValues(prev => ({ ...prev, [fieldId]: val }))
  }

  function handleMultiSelectToggle(fieldId, optionVal) {
    setFieldValues(prev => {
      const currentList = prev[fieldId] || []
      const exists = currentList.includes(optionVal)
      const nextList = exists 
        ? currentList.filter(v => v !== optionVal)
        : [...currentList, optionVal]
      return { ...prev, [fieldId]: nextList }
    })
  }

  async function handleImageUpload(fieldId, file) {
    if (!file) return
    try {
      setUploadingFieldId(fieldId)
      const url = await uploadImageFree(file)
      setFieldValues(prev => ({ ...prev, [fieldId]: url }))
    } catch (err) {
      alert('Erro ao enviar imagem: ' + err.message)
    } finally {
      setUploadingFieldId(null)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErrorMessage(null)

    // Validações de campos obrigatórios
    for (const field of (form.fields || [])) {
      if (field.required) {
        const val = fieldValues[field.id]
        if (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0)) {
          setErrorMessage(`Por favor, preencha o campo obrigatório: "${field.label}"`)
          return
        }
      }
    }

    setSubmitting(true)
    try {
      await sendFormToDiscord({
        webhookUrl: form.webhookUrl,
        formConfig: form,
        fieldValues,
        userData: {
          uid: user?.uid,
          name: character?.name || 'Sobrevivente',
          profession: character?.profession || character?.role || '',
          locationName: locationName || form.locationName || '',
          avatarUrl: character?.avatarUrl || null
        }
      })

      setSuccess(true)
    } catch (err) {
      setErrorMessage(err.message || 'Falha ao enviar formulário.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        className="glass"
        style={{
          width: '100%',
          maxWidth: '620px',
          maxHeight: '90vh',
          background: 'rgba(18, 18, 22, 0.95)',
          border: `1px solid ${form.embedColor || 'var(--accent-yellow)'}`,
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: `0 0 35px ${form.embedColor ? `${form.embedColor}33` : 'rgba(234, 179, 8, 0.2)'}`,
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Cabeçalho do Modal */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(0,0,0,0) 100%)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '28px' }}>{form.icon || '📝'}</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary)', fontFamily: 'Oswald, sans-serif', letterSpacing: '0.5px' }}>
                {form.title || 'Formulário'}
              </h3>
              {form.subtitle && (
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                  {form.subtitle}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-sm"
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'var(--text-muted)',
              fontSize: '16px',
              padding: '4px 10px',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>

        {/* Corpo com Scroll */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {success ? (
            <div style={{ textAlign: 'center', padding: '30px 10px' }}>
              <div style={{ fontSize: '48px', marginBottom: 12 }}>✅</div>
              <h3 style={{ color: '#4ade80', margin: '0 0 8px', fontSize: '20px' }}>
                {form.successMessageTitle || 'Enviado com Sucesso!'}
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', maxWidth: '420px', margin: '0 auto 24px', lineHeight: 1.5 }}>
                {form.successMessageDescription || 'Suas informações foram transmitidas e registradas no servidor.'}
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={onClose}
                style={{ padding: '8px 24px', minWidth: '140px' }}
              >
                Fechar
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {form.description && (
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    fontSize: '12.5px',
                    color: 'var(--text-secondary)',
                    lineHeight: '1.5',
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {form.description}
                </div>
              )}

              {errorMessage && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#f87171',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}
                >
                  <span>⚠️</span>
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Lista de Campos Dinâmicos */}
              {(form.fields || []).map((field) => {
                const val = fieldValues[field.id]

                return (
                  <div key={field.id} className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>
                        {field.label} {field.required && <span style={{ color: 'var(--accent-red)' }}>*</span>}
                      </span>
                      {field.helperText && (
                        <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontWeight: 400 }}>
                          {field.helperText}
                        </span>
                      )}
                    </label>

                    {/* Tipo: TEXT / EMAIL / TEL / NUMBER */}
                    {(field.type === 'text' || field.type === 'number' || field.type === 'email' || field.type === 'tel' || !field.type) && (
                      <input
                        type={field.type || 'text'}
                        placeholder={field.placeholder || ''}
                        value={val || ''}
                        onChange={e => handleChange(field.id, e.target.value)}
                        style={{ padding: '8px 12px', fontSize: '12.5px' }}
                      />
                    )}

                    {/* Tipo: TEXTAREA */}
                    {field.type === 'textarea' && (
                      <textarea
                        rows={field.rows || 3}
                        placeholder={field.placeholder || ''}
                        value={val || ''}
                        onChange={e => handleChange(field.id, e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          fontSize: '12.5px',
                          background: 'rgba(0,0,0,0.3)',
                          border: '1px solid var(--glass-border)',
                          borderRadius: 8,
                          color: '#fff',
                          resize: 'vertical'
                        }}
                      />
                    )}

                    {/* Tipo: SELECT */}
                    {field.type === 'select' && (
                      <select
                        value={val || ''}
                        onChange={e => handleChange(field.id, e.target.value)}
                        style={{ padding: '8px 12px', fontSize: '12.5px' }}
                      >
                        <option value="">{field.placeholder || 'Selecione uma opção...'}</option>
                        {(field.options || []).map((opt, oIdx) => (
                          <option key={oIdx} value={typeof opt === 'object' ? opt.value : opt}>
                            {typeof opt === 'object' ? opt.label : opt}
                          </option>
                        ))}
                      </select>
                    )}

                    {/* Tipo: MULTISELECT */}
                    {field.type === 'multiselect' && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                        {(field.options || []).map((opt, oIdx) => {
                          const optVal = typeof opt === 'object' ? opt.value : opt
                          const optLabel = typeof opt === 'object' ? opt.label : opt
                          const isSelected = (val || []).includes(optVal)

                          return (
                            <button
                              key={oIdx}
                              type="button"
                              onClick={() => handleMultiSelectToggle(field.id, optVal)}
                              style={{
                                padding: '5px 10px',
                                fontSize: '11px',
                                borderRadius: '6px',
                                background: isSelected ? 'rgba(234, 179, 8, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                                border: `1px solid ${isSelected ? 'var(--accent-yellow)' : 'rgba(255, 255, 255, 0.1)'}`,
                                color: isSelected ? '#fef08a' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                transition: 'all 0.15s'
                              }}
                            >
                              {isSelected ? '✓ ' : '+ '}{optLabel}
                            </button>
                          )
                        })}
                      </div>
                    )}

                    {/* Tipo: CHECKBOX */}
                    {field.type === 'checkbox' && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 4 }}>
                        <input
                          type="checkbox"
                          checked={!!val}
                          onChange={e => handleChange(field.id, e.target.checked)}
                          style={{ width: '16px', height: '16px' }}
                        />
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {field.checkboxLabel || field.placeholder || 'Sim'}
                        </span>
                      </label>
                    )}

                    {/* Tipo: IMAGE / FOTO UPLOAD */}
                    {field.type === 'image' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input
                            type="url"
                            placeholder={field.placeholder || 'Cole o link da foto ou faça upload...'}
                            value={val || ''}
                            onChange={e => handleChange(field.id, e.target.value)}
                            style={{ flex: 1, padding: '7px 10px', fontSize: '12px' }}
                          />
                          <label
                            className="btn btn-sm"
                            style={{
                              padding: '7px 12px',
                              fontSize: '11px',
                              cursor: 'pointer',
                              background: 'rgba(56, 189, 248, 0.15)',
                              borderColor: '#38bdf8',
                              color: '#7dd3fc',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {uploadingFieldId === field.id ? '⏳ Enviando...' : '📷 Escolher Foto'}
                            <input
                              type="file"
                              accept="image/*"
                              style={{ display: 'none' }}
                              disabled={uploadingFieldId === field.id}
                              onChange={e => {
                                const f = e.target.files?.[0]
                                if (f) handleImageUpload(field.id, f)
                              }}
                            />
                          </label>
                        </div>
                        {val && (
                          <div style={{ width: '60px', height: '60px', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
                            <img src={val} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Botões do Rodapé */}
              <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
                <button
                  type="button"
                  className="btn"
                  onClick={onClose}
                  disabled={submitting}
                  style={{ flex: 1, padding: '10px' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                  style={{
                    flex: 2,
                    padding: '10px',
                    background: form.buttonColor || undefined,
                    borderColor: form.buttonColor || undefined,
                    fontWeight: 700
                  }}
                >
                  {submitting ? '⏳ Transmitindo...' : (form.buttonText || '📨 Enviar Formulário')}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
