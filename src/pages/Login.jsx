import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'

function getErrorMessage(code) {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'E-mail ou senha incorretos.'
    case 'auth/too-many-requests':
      return 'Muitas tentativas. Tente novamente mais tarde.'
    case 'auth/user-disabled':
      return 'Esta conta foi desativada.'
    case 'auth/invalid-email':
      return 'Formato de e-mail inválido.'
    default:
      return 'Erro ao autenticar. Verifique suas credenciais.'
  }
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)

  const { login, resetPassword } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccessMsg('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/location/sala-hospital')
    } catch (err) {
      setError(getErrorMessage(err.code))
    } finally {
      setLoading(false)
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault()
    setError('')
    setSuccessMsg('')
    if (!resetEmail.trim()) {
      setError('Informe seu e-mail para recuperar a senha.')
      return
    }

    setResetLoading(true)
    try {
      await resetPassword(resetEmail.trim())
      setSuccessMsg(`Instruções de redefinição de senha foram enviadas para ${resetEmail.trim()}. Verifique sua caixa de entrada e spam.`)
      setShowForgot(false)
      setResetEmail('')
    } catch (err) {
      setError(getErrorMessage(err.code) || 'Não foi possível enviar o e-mail de recuperação.')
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-box">
        <div className="auth-logo">
          <h1>ZONA ZERO</h1>
          <p>Protocolo de Sobrevivência</p>
        </div>

        <p className="auth-title">
          {showForgot ? 'Recuperação de Acesso' : 'Acesso ao Bunker'}
        </p>

        {error && <div className="form-error" style={{ marginBottom: 14 }}>{error}</div>}
        {successMsg && (
          <div style={{
            background: 'rgba(34, 197, 94, 0.15)',
            border: '1px solid rgba(34, 197, 94, 0.4)',
            color: '#4ade80',
            padding: '10px 14px',
            borderRadius: 8,
            fontSize: 12,
            marginBottom: 14,
            lineHeight: 1.4
          }}>
            ✅ {successMsg}
          </div>
        )}

        {!showForgot ? (
          <form onSubmit={handleSubmit}>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ margin: 0 }}>Senha</label>
                <button
                  type="button"
                  onClick={() => {
                    setResetEmail(email)
                    setShowForgot(true)
                    setError('')
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent-yellow)',
                    fontSize: 11,
                    cursor: 'pointer',
                    padding: 0,
                    textDecoration: 'underline'
                  }}
                >
                  Esqueci minha senha
                </button>
              </div>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={{ marginTop: 4 }}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: 8, padding: '12px' }}
              disabled={loading}
            >
              {loading ? 'Entrando...' : 'Entrar no Abrigo'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword}>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.4 }}>
              Digite o e-mail cadastrado da sua conta. Você receberá um link seguro para redefinir sua senha.
            </p>

            <div className="form-group">
              <label>E-mail da Conta</label>
              <input
                type="email"
                placeholder="seu@email.com"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button
                type="button"
                className="btn"
                style={{ flex: 1 }}
                onClick={() => {
                  setShowForgot(false)
                  setError('')
                }}
                disabled={resetLoading}
              >
                Voltar
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ flex: 2, padding: '10px' }}
                disabled={resetLoading}
              >
                {resetLoading ? 'Enviando...' : '📧 Enviar Link'}
              </button>
            </div>
          </form>
        )}

        <div className="form-link" style={{ marginTop: 20 }}>
          Novo sobrevivente?
          <Link to="/register" style={{ fontWeight: 700, color: 'var(--accent)' }}> Criar personagem</Link>
        </div>
      </div>
    </div>
  )
}
