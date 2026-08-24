import { useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'

const TOTAL_POINTS = 25
const MIN_ATTR = 1
const MAX_ATTR = 10

const ATTRIBUTES = [
  { key: 'forca',       label: 'Força',        icon: '💪' },
  { key: 'destreza',    label: 'Destreza',      icon: '🏃' },
  { key: 'sabedoria',   label: 'Sabedoria',     icon: '🧠' },
  { key: 'carisma',     label: 'Carisma',       icon: '🗣️' },
  { key: 'constituicao',label: 'Constituição',  icon: '🛡️' },
]

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

export default function Register() {
  const navigate = useNavigate()
  const { register } = useAuth()

  const [step, setStep] = useState(1)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Step 1: Conta
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Step 2: Personagem
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [attrs, setAttrs] = useState({
    forca: 1, destreza: 1, sabedoria: 1, carisma: 1, constituicao: 1,
  })

  const usedPoints = Object.values(attrs).reduce((a, b) => a + b, 0) - 5
  const remainingPoints = TOTAL_POINTS - usedPoints

  function changeAttr(key, delta) {
    setAttrs((prev) => {
      const next = prev[key] + delta
      if (next < MIN_ATTR || next > MAX_ATTR) return prev
      if (delta > 0 && remainingPoints <= 0) return prev
      return { ...prev, [key]: next }
    })
  }

  function handleStep1(e) {
    e.preventDefault()
    setError('')
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.')
      return
    }
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    setStep(2)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!name.trim()) { setError('Informe o nome do personagem.'); return }
    if (!age || isNaN(age) || age < 1 || age > 120) { setError('Informe uma idade válida.'); return }

    setLoading(true)
    try {
      await register(email, password, {
        name: name.trim(),
        age: Number(age),
        avatarUrl: avatarUrl.trim() || null,
        ...attrs,
      })
      navigate('/location/sala-hospital')
    } catch (err) {
      setError(getErrorMessage(err.code))
      setStep(1)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="register-page">
      <div className="register-box">
        {/* Logo */}
        <div style={{ padding: '28px 32px 0', textAlign: 'center' }}>
          <div className="auth-logo" style={{ marginBottom: 0 }}>
            <h1>ZONA ZERO</h1>
            <p>Registro de Sobrevivente</p>
          </div>
        </div>

        {/* Indicadores de etapa */}
        <div className="register-steps" style={{ margin: '20px 0 0' }}>
          <div className={`register-step-indicator ${step === 1 ? 'active' : 'done'}`}>
            1. Conta
          </div>
          <div className={`register-step-indicator ${step === 2 ? 'active' : ''}`}>
            2. Personagem
          </div>
        </div>

        <div className="register-content">
          {error && <div className="form-error">{error}</div>}

          {/* ETAPA 1: Dados de conta */}
          {step === 1 && (
            <form onSubmit={handleStep1}>
              <div className="form-group">
                <label>E-mail</label>
                <input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="form-group">
                <label>Senha</label>
                <input
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>
              <div className="form-group">
                <label>Confirmar Senha</label>
                <input
                  type="password"
                  placeholder="Repita a senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px', marginTop: 8 }}>
                Continuar →
              </button>
              <div className="form-link" style={{ marginTop: 16 }}>
                Já tem conta? <Link to="/login">Fazer login</Link>
              </div>
            </form>
          )}

          {/* ETAPA 2: Personagem */}
          {step === 2 && (
            <form onSubmit={handleSubmit}>
              {/* Avatar por URL */}
              <div className="avatar-upload">
                <div className="avatar-preview" title="Pré-visualização do Avatar">
                  {avatarUrl.trim() ? (
                    <img
                      src={avatarUrl.trim()}
                      alt="Preview do Avatar"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = "";
                      }}
                    />
                  ) : (
                    <span className="avatar-preview-icon">🧟</span>
                  )}
                </div>
                <div className="form-group" style={{ width: '100%', marginBottom: 12 }}>
                  <label>Link da Foto/Avatar (Opcional)</label>
                  <input
                    type="url"
                    placeholder="Ex: https://imgur.com/foto.jpg"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                  />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginTop: 4 }}>
                    Hospede sua imagem no Imgur, Pinterest, Discord ou outro site de fotos e cole o link direto aqui.
                  </span>
                </div>
              </div>

              {/* Nome e idade */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 12 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Nome do Personagem</label>
                  <input
                    type="text"
                    placeholder="Ex: Marcus Reyes"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={40}
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Idade</label>
                  <input
                    type="number"
                    placeholder="25"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    min={1} max={120}
                    required
                  />
                </div>
              </div>

              {/* Atributos */}
              <div style={{ marginTop: 20, marginBottom: 8 }}>
                <p style={{ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>
                  Distribuição de Atributos
                </p>

                <div className="points-remaining">
                  Pontos restantes:
                  <span style={{ color: remainingPoints === 0 ? 'var(--accent-yellow)' : 'var(--accent)' }}>
                    {remainingPoints}
                  </span>
                </div>

                <div className="attr-distribution">
                  {ATTRIBUTES.map(({ key, label, icon }) => (
                    <div className="attr-row" key={key}>
                      <span className="attr-row-icon">{icon}</span>
                      <span className="attr-row-name">{label}</span>
                      <div className="attr-controls">
                        <button
                          type="button"
                          className="attr-btn"
                          onClick={() => changeAttr(key, -1)}
                          disabled={attrs[key] <= MIN_ATTR}
                        >−</button>
                        <span className="attr-value-display">{attrs[key]}</span>
                        <button
                          type="button"
                          className="attr-btn"
                          onClick={() => changeAttr(key, 1)}
                          disabled={attrs[key] >= MAX_ATTR || remainingPoints <= 0}
                        >+</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="btn"
                  style={{ flex: 1 }}
                  onClick={() => setStep(1)}
                  disabled={loading}
                >
                  ← Voltar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 2, padding: '12px' }}
                  disabled={loading}
                >
                  {loading ? 'Criando personagem...' : 'Entrar no Mundo'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
