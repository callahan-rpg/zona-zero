import { useState, useEffect } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useNavigate } from 'react-router-dom'
import HUD from '../components/HUD.jsx'

export default function Characters() {
  const [characters, setCharacters] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDocs(collection(db, 'users'))
        const list = snap.docs
          .map((d) => ({ uid: d.id, ...d.data().character }))
          .filter((c) => !!c.name) // filtra usuários sem personagem criado
          .sort((a, b) => (b.level || 0) - (a.level || 0))
        setCharacters(list)
      } catch (err) {
        console.error('Erro ao carregar personagens:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <HUD />

      <div className="characters-page">
        <div className="characters-header">
          <h1 className="characters-title">Sobreviventes</h1>
          <p className="characters-subtitle">
            {loading ? 'Carregando...' : `${characters.length} sobrevivente${characters.length !== 1 ? 's' : ''} registrado${characters.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
            <span className="loading-dot" />
          </div>
        ) : characters.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: 32, marginBottom: 12 }}>🧟</p>
            <p>Nenhum sobrevivente registrado ainda.</p>
          </div>
        ) : (
          <div className="characters-grid">
            {characters.map((char) => (
              <div
                className="character-card-sm"
                key={char.uid}
                onClick={() => navigate(`/characters/${char.uid}`)}
                title={`Ver ficha de ${char.name}`}
                style={{ cursor: 'pointer' }}
              >
                {char.avatarUrl ? (
                  <img
                    className="character-card-sm-avatar"
                    src={char.avatarUrl}
                    alt={char.name}
                  />
                ) : (
                  <div className="character-card-sm-placeholder">🧟</div>
                )}

                <div className="character-card-sm-info">
                  <div className="character-card-sm-name">{char.name}</div>
                  <div className="character-card-sm-meta">
                    Nível {char.level || 1} · {char.age} anos
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  gap: 4,
                }}>
                  <span style={{
                    fontFamily: 'Share Tech Mono, monospace',
                    fontSize: 11,
                    color: 'var(--text-muted)',
                  }}>
                    {char.xp || 0} XP
                  </span>
                  <span style={{
                    fontSize: 10,
                    color: 'var(--accent-dim)',
                    letterSpacing: 0.5,
                  }}>
                    Ver ficha →
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

