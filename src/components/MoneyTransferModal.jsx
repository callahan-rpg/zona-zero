import { useState, useEffect } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../contexts/AuthContext.jsx'

export default function MoneyTransferModal({ isOpen, onClose }) {
  const { user, character, transferMoney } = useAuth()

  const [survivors, setSurvivors] = useState([])
  const [recipientUid, setRecipientUid] = useState('')
  const [amount, setAmount] = useState('')
  const [loadingSurvivors, setLoadingSurvivors] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const myBalance = Number(character?.rublos || 0)

  useEffect(() => {
    if (!isOpen || !user) return

    async function loadSurvivors() {
      setLoadingSurvivors(true)
      setError('')
      setSuccess('')
      setAmount('')
      try {
        const snap = await getDocs(collection(db, 'users'))
        const list = snap.docs
          .map((d) => ({ uid: d.id, ...d.data().character }))
          .filter((c) => c.uid !== user.uid && !!c.name)
        setSurvivors(list)
        if (list.length > 0) {
          setRecipientUid(list[0].uid)
        }
      } catch (err) {
        console.error('Erro ao buscar sobreviventes:', err)
        setError('Não foi possível carregar a lista de sobreviventes.')
      } finally {
        setLoadingSurvivors(false)
      }
    }

    loadSurvivors()
  }, [isOpen, user])

  if (!isOpen) return null

  const numAmount = parseInt(amount, 10) || 0
  const balanceAfter = myBalance - numAmount
  const isAmountValid = numAmount > 0 && numAmount <= myBalance

  async function handleSubmit(e) {
    e.preventDefault()
    if (!recipientUid) {
      setError('Selecione um sobrevivente destinatário.')
      return
    }
    if (!isAmountValid) {
      if (numAmount > myBalance) {
        setError('Você não possui Novos Rublos suficientes.')
      } else {
        setError('Informe um valor válido maior que zero.')
      }
      return
    }

    setError('')
    setSuccess('')
    setLoading(true)

    try {
      await transferMoney(recipientUid, numAmount)
      setSuccess(`Transferência de ${numAmount.toLocaleString('pt-BR')} Novos Rublos realizada com sucesso!`)
      setTimeout(() => {
        onClose?.()
      }, 1500)
    } catch (err) {
      setError(err.message || 'Erro ao processar transferência.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="loot-modal-overlay" onClick={() => !loading && onClose?.()}>
      <div
        className="loot-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ width: '400px', maxWidth: '95vw', textAlign: 'left' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 24 }}>💸</span>
          <div>
            <h3 style={{ color: '#facc15', margin: 0 }}>Transferir Novos Rublos</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
              Envio direto e seguro de dinheiro para outro jogador
            </p>
          </div>
        </div>

        {error && <div className="form-error" style={{ marginBottom: 12 }}>{error}</div>}
        {success && (
          <div
            className="form-error"
            style={{
              color: '#5cff7a',
              borderColor: 'rgba(92, 255, 122, 0.3)',
              background: 'rgba(92, 255, 122, 0.1)',
              marginBottom: 12
            }}
          >
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Destinatário */}
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
              Destinatário
            </label>
            {loadingSurvivors ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>
                Localizando sobreviventes no rádio...
              </div>
            ) : survivors.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--accent-red)', padding: '8px 0' }}>
                Nenhum outro sobrevivente online registrado.
              </div>
            ) : (
              <select
                value={recipientUid}
                onChange={(e) => setRecipientUid(e.target.value)}
                style={{ width: '100%', padding: '10px', fontSize: 13 }}
                required
              >
                {survivors.map((s) => (
                  <option key={s.uid} value={s.uid}>
                    👤 {s.name} (Nv. {s.level || 1})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Valor a transferir */}
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
              Valor a Transferir (Novos Rublos)
            </label>
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: 14
                }}
              >
                💰
              </span>
              <input
                type="number"
                min="1"
                max={myBalance}
                step="1"
                placeholder="Ex: 250"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{ width: '100%', padding: '10px 10px 10px 36px', fontSize: 14 }}
                required
              />
            </div>
            {/* Botões de atalho */}
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              {[25, 50, 100, 250, 500].filter(v => v <= myBalance).map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setAmount(String(val))}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--glass-border)',
                    color: 'var(--text-secondary)',
                    borderRadius: 4,
                    padding: '3px 6px',
                    fontSize: 11,
                    cursor: 'pointer'
                  }}
                >
                  +{val}
                </button>
              ))}
              {myBalance > 0 && (
                <button
                  type="button"
                  onClick={() => setAmount(String(myBalance))}
                  style={{
                    background: 'rgba(234, 179, 8, 0.15)',
                    border: '1px solid rgba(234, 179, 8, 0.3)',
                    color: '#facc15',
                    borderRadius: 4,
                    padding: '3px 6px',
                    fontSize: 11,
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  Tudo ({myBalance.toLocaleString('pt-BR')})
                </button>
              )}
            </div>
          </div>

          {/* Resumo dos Saldos */}
          <div
            style={{
              padding: '12px',
              background: 'rgba(0,0,0,0.3)',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.06)',
              marginBottom: 18,
              fontSize: 12
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: 'var(--text-muted)' }}>Seu saldo atual:</span>
              <strong style={{ color: '#facc15' }}>
                {myBalance.toLocaleString('pt-BR')} Novos Rublos
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: 'var(--text-muted)' }}>Valor do envio:</span>
              <strong style={{ color: numAmount > 0 ? '#ef4444' : 'var(--text-muted)' }}>
                {numAmount > 0 ? `- ${numAmount.toLocaleString('pt-BR')} Novos Rublos` : '0'}
              </strong>
            </div>

            <div
              style={{
                borderTop: '1px solid rgba(255,255,255,0.08)',
                paddingTop: 6,
                marginTop: 6,
                display: 'flex',
                justifyContent: 'space-between'
              }}
            >
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Saldo após envio:</span>
              <strong
                style={{
                  color: balanceAfter < 0 ? '#ef4444' : '#5cff7a'
                }}
              >
                {balanceAfter < 0 ? 'Saldo Insuficiente' : `${balanceAfter.toLocaleString('pt-BR')} Novos Rublos`}
              </strong>
            </div>
          </div>

          {/* Ações */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn"
              style={{ flex: 1 }}
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{
                flex: 2,
                background: '#f59e0b',
                borderColor: '#fbbf24',
                color: '#000',
                fontWeight: 700
              }}
              disabled={loading || survivors.length === 0 || !isAmountValid}
            >
              {loading ? 'Processando...' : 'Transferir Dinheiro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
