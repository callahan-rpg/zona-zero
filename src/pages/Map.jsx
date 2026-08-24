import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../contexts/AuthContext.jsx'
import HUD from '../components/HUD.jsx'

export default function Map() {
  const { user, character, refreshCharacter } = useAuth()
  const navigate = useNavigate()
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [traveling, setTraveling] = useState(false)

  // Escuta todas as locações ativas do Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'locations'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      setLocations(list)
      setLoading(false)
    })
    return unsub
  }, [])

  async function handleTravel(slug) {
    if (!user || traveling) return
    setTraveling(true)
    try {
      const userRef = doc(db, 'users', user.uid)
      await updateDoc(userRef, {
        'character.currentLocation': slug
      })
      await refreshCharacter()
      navigate(`/location/${slug}`)
    } catch (err) {
      console.error('Erro ao viajar:', err)
      alert('Erro ao viajar: ' + err.message)
    } finally {
      setTraveling(false)
    }
  }

  // Locações default caso o Firestore esteja vazio (Fase 1 / inicialização)
  const defaultLocations = [
    {
      slug: 'sala-hospital',
      name: 'Sala do Hospital',
      description: 'Cenário inicial do hospital abandonado, repleto de macas tombadas e cheiro de antisséptico.',
    }
  ]

  const activeLocations = locations.length > 0 ? locations : defaultLocations

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', overflowY: 'auto' }}>
      <HUD locationName="Mapa do Setor" />

      <div style={{ padding: 'calc(var(--hud-height) + 24px) 24px 24px', maxWidth: '800px', margin: '0 auto' }}>
        <div className="glass" style={{ padding: '32px', textAlign: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontFamily: 'Oswald', letterSpacing: 3, textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '8px' }}>
            🗺️ Mapa de Sobrevivência
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Selecione uma área livre no mapa para viajar. Cuidado com hordas de infectados nas ruas.
          </p>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
            <span className="loading-dot" />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {activeLocations.map((loc) => {
              const isCurrent = character?.currentLocation === loc.slug
              return (
                <div
                  key={loc.slug}
                  className="glass-light"
                  style={{
                    padding: '20px',
                    borderRadius: '12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    border: isCurrent ? '1px solid var(--accent)' : '1px solid var(--glass-border)',
                    boxShadow: isCurrent ? '0 0 20px rgba(92, 255, 122, 0.1)' : 'none',
                    transition: 'var(--transition)'
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0, paddingRight: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: 18 }}>📍</span>
                      <h3 style={{ fontSize: 16, fontWeight: 'bold' }}>{loc.name}</h3>
                      {isCurrent && (
                        <span style={{
                          fontSize: 10,
                          background: 'rgba(92, 255, 122, 0.15)',
                          color: 'var(--accent)',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-pill)',
                          fontWeight: 'bold',
                          textTransform: 'uppercase',
                          letterSpacing: 0.5
                        }}>
                          Você está aqui
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      {loc.description || 'Nenhuma descrição fornecida.'}
                    </p>
                  </div>

                  <div>
                    {isCurrent ? (
                      <button
                        className="btn btn-primary"
                        onClick={() => navigate(`/location/${loc.slug}`)}
                      >
                        Entrar
                      </button>
                    ) : (
                      <button
                        className="btn"
                        onClick={() => handleTravel(loc.slug)}
                        disabled={traveling}
                      >
                        {traveling ? 'Viajando...' : 'Viajar'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
