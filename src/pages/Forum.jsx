import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  collection,
  onSnapshot,
  doc,
  addDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../contexts/AuthContext.jsx'
import HUD from '../components/HUD.jsx'
import GameIcon from '../components/GameIcon.jsx'
import { DEFAULT_FORUM_TOPICS } from '../components/AdminForumEditor.jsx'

export default function Forum() {
  const { topicId } = useParams()
  const navigate = useNavigate()
  const { user, character, role } = useAuth()

  // Lista de tópicos cadastrados no Firestore
  const [topics, setTopics] = useState([])
  const [loadingTopics, setLoadingTopics] = useState(true)

  // Aba selecionada na página principal ('groups' | 'posts')
  const [activeTab, setActiveTab] = useState('groups')
  const [filterSearch, setFilterSearch] = useState('')

  // Tópico ativo (se houver param topicId na URL ou selecionado)
  const [activeTopic, setActiveTopic] = useState(null)

  // Posts e comentários do tópico ativo
  const [posts, setPosts] = useState([])
  const [loadingPosts, setLoadingPosts] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [sendingComment, setSendingComment] = useState(false)

  // Total de personagens (para exibição no card como "16 Personagens")
  const [totalCharactersCount, setTotalCharactersCount] = useState(16)
  // Contagem de posts por tópico para exibição
  const [postCounts, setPostCounts] = useState({})

  const commentsEndRef = useRef(null)

  // 1. Escuta tópicos do fórum em tempo real
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'forum_topics'), (snap) => {
      let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      docs.sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
      
      // Se não houver tópicos cadastrados no banco ainda, usa os padrões para exibição inicial
      if (docs.length === 0) {
        docs = DEFAULT_FORUM_TOPICS
      }
      setTopics(docs)
      setLoadingTopics(false)
    }, (err) => {
      console.error('Erro ao escutar tópicos:', err)
      setTopics(DEFAULT_FORUM_TOPICS)
      setLoadingTopics(false)
    })

    return unsub
  }, [])

  // 2. Busca número total de jogadores/personagens para exibição nos cards
  useEffect(() => {
    getDocs(collection(db, 'players_index')).then(snap => {
      if (snap.size > 0) setTotalCharactersCount(snap.size)
    }).catch(() => {})
  }, [])

  // 3. Identifica o tópico selecionado
  useEffect(() => {
    if (topicId) {
      const found = topics.find(t => t.id === topicId)
      if (found) {
        setActiveTopic(found)
      } else if (!loadingTopics) {
        const defaultFound = DEFAULT_FORUM_TOPICS.find(t => t.id === topicId)
        setActiveTopic(defaultFound || null)
      }
    } else {
      setActiveTopic(null)
    }
  }, [topicId, topics, loadingTopics])

  // 4. Escuta posts do tópico ativo
  useEffect(() => {
    if (!activeTopic) {
      setPosts([])
      return
    }

    setLoadingPosts(true)
    const q = query(
      collection(db, 'forum_posts'),
      where('topicId', '==', activeTopic.id)
    )

    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      // Ordenação cronológica segura em memória
      docs.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
      setPosts(docs)
      setLoadingPosts(false)
    }, (err) => {
      console.error('Erro ao carregar mensagens:', err)
      setLoadingPosts(false)
    })

    return unsub
  }, [activeTopic])

  // 5. Escuta contagem de posts de todos os tópicos para a tab de "Posts"
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'forum_posts'), (snap) => {
      const counts = {}
      snap.docs.forEach(d => {
        const tId = d.data().topicId
        counts[tId] = (counts[tId] || 0) + 1
      })
      setPostCounts(counts)
    })
    return unsub
  }, [])

  // Enviar comentário
  async function handleSendComment(e) {
    e.preventDefault()
    if (!newComment.trim() || !activeTopic) return
    if (!user) return alert('Você precisa estar logado para comentar.')

    const authorName = character?.name || user.displayName || 'Sobrevivente'
    const authorAvatar = character?.avatarUrl || null
    const authorRole = role === 'admin' ? 'admin' : 'player'

    setSendingComment(true)
    try {
      await addDoc(collection(db, 'forum_posts'), {
        topicId: activeTopic.id,
        authorUid: user.uid,
        authorName,
        authorAvatar,
        authorRole,
        authorProfession: character?.profession?.name || character?.profession || null,
        content: newComment.trim(),
        createdAt: new Date().toISOString()
      })
      setNewComment('')
      setTimeout(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    } catch (err) {
      alert('Erro ao enviar mensagem: ' + err.message)
    } finally {
      setSendingComment(false)
    }
  }

  // Excluir comentário
  async function handleDeleteComment(post) {
    if (!confirm('Deseja excluir este comentário?')) return
    try {
      await deleteDoc(doc(db, 'forum_posts', post.id))
    } catch (err) {
      alert('Erro ao excluir: ' + err.message)
    }
  }

  // Formata data e hora
  function formatDate(dateStr) {
    if (!dateStr) return ''
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateStr
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0b0e12', color: '#f3f4f6', display: 'flex', flexDirection: 'column' }}>
      <HUD locationName="Fórum da Comunidade" />

      <main style={{ flex: 1, padding: '24px 20px 60px', maxWidth: 1180, width: '100%', margin: '0 auto' }}>
        
        {/* ======================================================== */}
        {/* SEÇÃO A: VISUALIZAÇÃO INTERNA DE UM TÓPICO / DISCUSSÃO  */}
        {/* ======================================================== */}
        {activeTopic ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Barra de Navegação Superior */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => navigate('/forum')}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#fff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: 8,
                  fontSize: 12,
                  cursor: 'pointer'
                }}
              >
                ← Voltar aos Grupos
              </button>

              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {posts.length} {posts.length === 1 ? 'comentário' : 'comentários'}
              </span>
            </div>

            {/* Banner do Tópico */}
            <div style={{
              position: 'relative',
              borderRadius: 14,
              overflow: 'hidden',
              minHeight: 140,
              background: '#040608',
              border: '1px solid var(--glass-border)',
              display: 'flex',
              alignItems: 'flex-end',
              padding: '24px 28px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)'
            }}>
              {activeTopic.coverImage && (
                <img
                  src={activeTopic.coverImage}
                  alt={activeTopic.title}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    opacity: 0.35,
                    filter: 'blur(1px)'
                  }}
                />
              )}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: 'linear-gradient(to top, rgba(11,14,18,0.95) 15%, rgba(11,14,18,0.4) 100%)'
              }} />

              <div style={{ position: 'relative', zIndex: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 26 }}>{activeTopic.icon || '💬'}</span>
                  <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0, textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>
                    {activeTopic.title}
                  </h1>
                </div>
                {activeTopic.description && (
                  <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-secondary)', maxWidth: 700 }}>
                    {activeTopic.description}
                  </p>
                )}
              </div>
            </div>

            {/* MENSAGEM FIXADA DA ADMINISTRAÇÃO (PINNED POST) */}
            {activeTopic.pinnedMessage && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(180, 83, 9, 0.08) 100%)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                borderRadius: 12,
                padding: '18px 22px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                position: 'relative'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      background: '#f59e0b',
                      color: '#000',
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 4,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4
                    }}>
                      📌 Mensagem Fixada
                    </span>
                    <strong style={{ fontSize: 13, color: '#fbbf24' }}>
                      {activeTopic.pinnedAuthorName || 'Mestre / Administração'}
                    </strong>
                  </div>
                  <span style={{ fontSize: 10, color: 'rgba(251, 191, 36, 0.7)' }}>Oficial</span>
                </div>

                <div style={{ fontSize: 13.5, lineHeight: 1.6, color: '#fef3c7', whiteSpace: 'pre-line' }}>
                  {activeTopic.pinnedMessage}
                </div>
              </div>
            )}

            {/* LISTA DE COMENTÁRIOS / POSTAGENS DOS JOGADORES */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Discussão da Comunidade ({posts.length})
                </span>
              </div>

              {loadingPosts ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  ⏳ Carregando mensagens...
                </div>
              ) : posts.length === 0 ? (
                <div style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px dashed rgba(255,255,255,0.1)',
                  borderRadius: 10,
                  padding: 36,
                  textAlign: 'center',
                  color: 'var(--text-muted)'
                }}>
                  <span style={{ fontSize: 24, display: 'block', marginBottom: 8 }}>💬</span>
                  Nenhum comentário neste tópico ainda. Seja o primeiro sobrevivente a se manifestar!
                </div>
              ) : (
                posts.map((post) => {
                  const isAuthor = user && post.authorUid === user.uid
                  const canDelete = isAuthor || role === 'admin'
                  const isAdminAuthor = post.authorRole === 'admin'

                  return (
                    <div
                      key={post.id}
                      style={{
                        background: 'rgba(18, 22, 28, 0.7)',
                        border: isAdminAuthor ? '1px solid rgba(245, 158, 11, 0.25)' : '1px solid rgba(255, 255, 255, 0.06)',
                        borderRadius: 10,
                        padding: '14px 18px',
                        display: 'flex',
                        gap: 14
                      }}
                    >
                      {/* Avatar do Personagem */}
                      <div style={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        overflow: 'hidden',
                        background: '#040608',
                        border: isAdminAuthor ? '2px solid #f59e0b' : '2px solid rgba(255,255,255,0.15)',
                        flexShrink: 0
                      }}>
                        {post.authorAvatar ? (
                          <img src={post.authorAvatar} alt={post.authorName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 20 }}>
                            👤
                          </div>
                        )}
                      </div>

                      {/* Conteúdo do Comentário */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <strong style={{ fontSize: 13, color: isAdminAuthor ? '#fbbf24' : '#fff' }}>
                              {post.authorName}
                            </strong>
                            {isAdminAuthor && (
                              <span style={{ fontSize: 9, background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)', padding: '1px 5px', borderRadius: 3, fontWeight: 700 }}>
                                STAFF
                              </span>
                            )}
                            {post.authorProfession && (
                              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                · {post.authorProfession}
                              </span>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                              {formatDate(post.createdAt)}
                            </span>
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => handleDeleteComment(post)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#ef4444',
                                  fontSize: 11,
                                  cursor: 'pointer',
                                  padding: '2px 4px',
                                  opacity: 0.7
                                }}
                                title="Excluir mensagem"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>

                        <div style={{
                          marginTop: 6,
                          fontSize: 13,
                          lineHeight: 1.5,
                          color: '#e2e8f0',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word'
                        }}>
                          {post.content}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={commentsEndRef} />
            </div>

            {/* FORMULÁRIO PARA NOVO COMENTÁRIO */}
            <form onSubmit={handleSendComment} style={{
              background: 'rgba(18, 22, 28, 0.9)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 12,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              marginTop: 10
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Avatar do usuário atual */}
                <div style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  overflow: 'hidden',
                  background: '#040608',
                  border: '1px solid rgba(255,255,255,0.2)',
                  flexShrink: 0
                }}>
                  {character?.avatarUrl ? (
                    <img src={character.avatarUrl} alt="Você" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 16 }}>
                      👤
                    </div>
                  )}
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Comentando como <strong style={{ color: '#fff' }}>{character?.name || user?.displayName || 'Sobrevivente'}</strong>
                </span>
              </div>

              <textarea
                rows={3}
                placeholder="Escreva seu comentário, sugestão ou feedback sobre este tópico..."
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                disabled={sendingComment}
                required
                style={{
                  width: '100%',
                  background: 'rgba(0, 0, 0, 0.4)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  color: '#fff',
                  fontSize: 13,
                  resize: 'vertical',
                  outline: 'none'
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={sendingComment || !newComment.trim()}
                  style={{
                    padding: '8px 22px',
                    fontSize: 12,
                    fontWeight: 700,
                    borderRadius: 6
                  }}
                >
                  {sendingComment ? 'Enviando...' : '💬 Publicar Resposta'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* ======================================================== */
          /* SEÇÃO B: PÁGINA INICIAL DO FÓRUM (ESTILO IDÊNTICO À FOTO) */
          /* ======================================================== */
          <div>
            {/* Título Superior */}
            <div style={{ marginBottom: 20 }}>
              <h1 style={{ fontSize: 28, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: -0.5 }}>
                Grupos
              </h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                Visualize grupos e posts abaixo.
              </p>
            </div>

            {/* Abas / Filtros: Grupos e Posts */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              marginBottom: 24
            }}>
              <div style={{ display: 'flex', gap: 24 }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('groups')}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '8px 4px 12px',
                    fontSize: 14,
                    fontWeight: 700,
                    color: activeTab === 'groups' ? '#fff' : 'var(--text-muted)',
                    borderBottom: activeTab === 'groups' ? '3px solid #fff' : '3px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Grupos
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('posts')}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '8px 4px 12px',
                    fontSize: 14,
                    fontWeight: 700,
                    color: activeTab === 'posts' ? '#fff' : 'var(--text-muted)',
                    borderBottom: activeTab === 'posts' ? '3px solid #fff' : '3px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Posts
                </button>
              </div>

              {/* Busca rápida */}
              <input
                type="text"
                placeholder="🔍 Filtrar grupos..."
                value={filterSearch}
                onChange={e => setFilterSearch(e.target.value)}
                style={{
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 6,
                  padding: '4px 10px',
                  fontSize: 12,
                  color: '#fff',
                  width: 180,
                  marginBottom: 8
                }}
              />
            </div>

            {/* GRID DOS CARDS DE GRUPOS / TÓPICOS */}
            {loadingTopics ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
                ⏳ Carregando grupos do fórum...
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
                gap: 24
              }}>
                {topics
                  .filter(topic => {
                    if (!filterSearch.trim()) return true
                    const q = filterSearch.toLowerCase()
                    return (topic.title || '').toLowerCase().includes(q) ||
                           (topic.description || '').toLowerCase().includes(q)
                  })
                  .map((topic) => {
                    const postCount = postCounts[topic.id] || 0
                    const charCount = totalCharactersCount || 16

                    return (
                      <div
                        key={topic.id}
                        style={{
                          background: '#fff',
                          color: '#000',
                          borderRadius: 4,
                          border: '1px solid #e2e8f0',
                          overflow: 'hidden',
                          display: 'flex',
                          flexDirection: 'column',
                          boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
                          transition: 'transform 0.18s ease, box-shadow 0.18s ease'
                        }}
                      >
                        {/* Imagem de Capa do Card (Estilo Imagem de Referência) */}
                        <div style={{
                          width: '100%',
                          height: 170,
                          position: 'relative',
                          background: '#1a1f26',
                          overflow: 'hidden'
                        }}>
                          {topic.coverImage ? (
                            <img
                              src={topic.coverImage}
                              alt={topic.title}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                display: 'block'
                              }}
                            />
                          ) : (
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              height: '100%',
                              fontSize: 42,
                              background: '#111827'
                            }}>
                              {topic.icon || '💬'}
                            </div>
                          )}
                        </div>

                        {/* Corpo do Card */}
                        <div style={{ padding: '16px 16px 20px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                          {/* Ícone + Nome do Grupo */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 16 }}>{topic.icon || '💬'}</span>
                            <h3 style={{
                              margin: 0,
                              fontSize: 16,
                              fontWeight: 800,
                              color: '#0f172a',
                              lineHeight: 1.25
                            }}>
                              {topic.title}
                            </h3>
                          </div>

                          {/* Subtítulo: Público · X Personagens */}
                          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 18 }}>
                            {topic.subtitle || 'Público'} · {charCount} Personagens
                            {activeTab === 'posts' && ` · ${postCount} posts`}
                          </div>

                          {/* Botão Retangular: Visualizar */}
                          <div style={{ marginTop: 'auto' }}>
                            <button
                              type="button"
                              onClick={() => navigate(`/forum/${topic.id}`)}
                              style={{
                                width: '100%',
                                background: '#fff',
                                border: '1px solid #0f172a',
                                color: '#0f172a',
                                fontWeight: 700,
                                fontSize: 13,
                                padding: '8px 14px',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.background = '#0f172a'
                                e.currentTarget.style.color = '#fff'
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.background = '#fff'
                                e.currentTarget.style.color = '#0f172a'
                              }}
                            >
                              Visualizar
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
