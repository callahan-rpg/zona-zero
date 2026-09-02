import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../contexts/AuthContext.jsx'
import GameIcon from '../components/GameIcon.jsx'

// Dados padrão da Home caso não existam no Firestore ainda
const DEFAULT_HOME_CONFIG = {
  titleText: 'ZO\nNA\nZE\nRO',
  subtitleText: 'PROTOCOL DE SOBREVIVÊNCIA & IMERSÃO PÓS-APOCALÍPTICA',
  fontFamily: "'Oswald', sans-serif",
  slides: [
    {
      id: 'slide_1',
      number: '01',
      badge: '01 / AMBIENTAÇÃO',
      title: 'VAREZHIA EM RUÍNAS',
      tagline: 'Território sob Quarentena Militar',
      description: 'Uma nação devastada de 43.000 km². Cidades fantasmas, laboratórios sob escombros e uma infecção em constante mutação.',
      imageUrl: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1920&q=80',
      actionType: 'lore'
    },
    {
      id: 'slide_2',
      number: '02',
      badge: '02 / MECÂNICAS DE JOGO',
      title: 'SISTEMA VITAL E CLIMA',
      tagline: 'Ecossistema Imersivo e Dinâmico',
      description: 'Gira os ponteiros do tempo. Fome, sede, sangramento, hipotermia e mutações biológicas afetam diretamente suas rolagens de dados.',
      imageUrl: 'https://images.unsplash.com/photo-1509114397022-ed747cca3f65?auto=format&fit=crop&w=1920&q=80',
      actionType: 'rules'
    },
    {
      id: 'slide_3',
      number: '03',
      badge: '03 / TÁTICA EM COMBATE',
      title: 'MESA DE COMBATE EM TEMPO REAL',
      tagline: 'Combate Tático & Inimigos Únicos',
      description: 'Turnos integrados, barras de HP dinâmicas, logs narrativos e fichas de sobreviventes prontas para a batalha.',
      imageUrl: 'https://images.unsplash.com/photo-1508614589041-895b88991e3e?auto=format&fit=crop&w=1920&q=80',
      actionType: 'login'
    }
  ],
  loreText: `### ☣️ A Queda de Varezhia

No inverno de 2024, a **República de Varezhia** declarou estado de emergência sanitária nacional após a contenção falhar no *Complexo de Pesquisa Biológica Oskol*.

Em poucas semanas, o vírus mutageno **Strain Zero** varreu metrópoles, vilarejos de mineração e guarnições militares. As fronteiras foram seladas por forças de coerção internacionais, transformando o país em uma imensa zona de quarentena isolada.

Hoje, os sobreviventes se agrupam em abrigos subterrâneos, hospitais desativados e ruínas fortificadas. A energia elétrica é escassa, a comida é racionada e cada expedição à superfície pode ser a última.`,
  rulesText: `### 📜 Diretrizes e Regras de Sobrevivência

1. **Interpretação e Fair Play**: Mantenha o tom de suspense e sobrevivência realista nas postagens e comandos.
2. **Sistema Vital**: Fome, Sede e Vida (Sangue) impactam seus testes de atributos. Mantenha seus suplementos em dia.
3. **Mesa de Combate**: Ataques, esquivas e usos de itens seguem as regras ativas na Mesa de Combate controlada pelo Administrador/Mestre.
4. **Navegação e Exploração**: Respeite os requisitos de itens (como chaves e equipamentos de segurança) para acessar setores de alto risco.`
}

export default function Home() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // null = ainda não recebeu resposta do Firestore
  const [homeConfig, setHomeConfig] = useState(null)
  const [configLoaded, setConfigLoaded] = useState(false)
  const [activeSlideIndex, setActiveSlideIndex] = useState(0)
  const [activeModal, setActiveModal] = useState(null) // 'lore' | 'rules' | null

  // Escuta as configurações da Home no Firestore em tempo real
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'home_config', 'global'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data()
          setHomeConfig({
            ...DEFAULT_HOME_CONFIG,
            ...data,
            slides: (data.slides && data.slides.length > 0) ? data.slides : DEFAULT_HOME_CONFIG.slides
          })
        } else {
          // Documento não existe ainda → usa padrão
          setHomeConfig(DEFAULT_HOME_CONFIG)
        }
        setConfigLoaded(true)
      },
      (err) => {
        console.warn('Usando valores padrão da Home (Firestore rules ou offline):', err)
        // Mesmo em erro, exibe o padrão em vez de tela em branco
        setHomeConfig(DEFAULT_HOME_CONFIG)
        setConfigLoaded(true)
      }
    )
    return unsub
  }, [])

  // Enquanto não carregou do Firestore, mostra fundo escuro puro (sem piscar imagem padrão)
  if (!configLoaded) {
    return <div style={{ width: '100vw', height: '100vh', background: '#0b0c0e' }} />
  }

  // Garantir índice válido dos slides
  const rawSlides = homeConfig?.slides && homeConfig.slides.length > 0 ? homeConfig.slides : DEFAULT_HOME_CONFIG.slides
  const slides = rawSlides.map((s, i) => ({
    ...s,
    imageUrl: s.imageUrl || DEFAULT_HOME_CONFIG.slides[0].imageUrl,
    badge: s.badge || s.number || `0${i + 1}`,
    title: s.title || 'VAREZHIA',
    description: s.description || ''
  }))
  const currentSlide = slides[activeSlideIndex % slides.length] || slides[0]

  function nextSlide() {
    setActiveSlideIndex((prev) => (prev + 1) % slides.length)
  }

  function prevSlide() {
    setActiveSlideIndex((prev) => (prev - 1 + slides.length) % slides.length)
  }

  function handleActionClick(type) {
    if (type === 'lore') {
      setActiveModal('lore')
    } else if (type === 'rules') {
      setActiveModal('rules')
    } else if (type === 'login') {
      if (user) {
        navigate('/location/sala-hospital')
      } else {
        navigate('/login')
      }
    }
  }

  return (
    <div className="home-page-wrapper">
      <div className="home-outer-container">
        {/* ============================================================ */}
        {/* CABEÇALHO EXTERNO (ACIMA DA IMAGEM)                          */}
        {/* ============================================================ */}
        <header className={`home-navbar${user ? ' home-navbar--hud' : ''}`}>
          {/* Logo Zona Zero Clicável */}
          <Link to="/" className="home-nav-logo" title="Ir para a Home">
            ZONA ZERO
          </Link>

          {/* Navegação Central com Pílula de Ícones */}
          <nav className="home-nav-pills">
            <button
              type="button"
              className="home-nav-btn active"
              onClick={() => setActiveSlideIndex(0)}
              title="Home do RPG"
            >
              <GameIcon name="home" size={16} />
              <span className="home-nav-label">Home</span>
            </button>

            <button
              type="button"
              className="home-nav-btn"
              onClick={() => setActiveModal('lore')}
              title="História do Jogo / Lore"
            >
              <GameIcon name="lore" size={16} />
              <span className="home-nav-label">História do Jogo</span>
            </button>

            <button
              type="button"
              className="home-nav-btn"
              onClick={() => setActiveModal('rules')}
              title="Regras do RPG"
            >
              <GameIcon name="rules" size={16} />
              <span className="home-nav-label">Regras</span>
            </button>

            {!user ? (
              <>
                <Link to="/register" className="home-nav-btn" title="Criar novo personagem">
                  <GameIcon name="create" size={16} />
                  <span className="home-nav-label">Registro</span>
                </Link>
                <Link to="/login" className="home-nav-btn" title="Entrar com sua conta">
                  <GameIcon name="login" size={16} />
                  <span className="home-nav-label">Login</span>
                </Link>
              </>
            ) : (
              <Link to="/map" className="home-nav-btn" title="Ver Mapa do RPG">
                <GameIcon name="map" size={16} />
                <span className="home-nav-label">Mapa</span>
              </Link>
            )}
          </nav>

          {/* Botão de Ação à Direita — só aparece para visitantes */}
          {!user && (
            <div className="home-nav-right">
              <Link to="/login" className="home-action-btn" title="Acessar Bunker">
                <GameIcon name="login" size={15} />
                LOGIN
              </Link>
            </div>
          )}
        </header>

        {/* ============================================================ */}
        {/* QUADRO / MOLDURA EXPANDIDA COM A IMAGEM DE FUNDO             */}
        {/* ============================================================ */}
        <main
          className="home-viewport-frame"
          style={{
            backgroundImage: `linear-gradient(to right, rgba(10, 11, 13, 0.85) 0%, rgba(10, 11, 13, 0.20) 45%, rgba(10, 11, 13, 0.70) 100%), url(${currentSlide.imageUrl})`
          }}
        >
          {/* Lado Esquerdo: Tipografia Grande da Home */}
          <div className="home-hero-typography">
            <h1
              className="home-large-title"
              style={{
                fontFamily: homeConfig.fontFamily || DEFAULT_HOME_CONFIG.fontFamily
              }}
            >
              {(homeConfig.titleText || DEFAULT_HOME_CONFIG.titleText).split('\n').map((line, idx) => (
                <span key={idx} className="title-line">
                  {line}
                </span>
              ))}
            </h1>
            <p className="home-hero-subtitle">
              {homeConfig.subtitleText || DEFAULT_HOME_CONFIG.subtitleText}
            </p>
          </div>

          {/* Canto Inferior Direito: Setas de Navegação do Slider */}
          <div className="home-slider-arrows">
            <button
              type="button"
              className="slider-arrow-btn"
              onClick={prevSlide}
              title="Slide Anterior"
            >
              <GameIcon name="arrowLeft" size={16} />
            </button>
            <button
              type="button"
              className="slider-arrow-btn"
              onClick={nextSlide}
              title="Próximo Slide"
            >
              <GameIcon name="arrowRight" size={16} />
            </button>
          </div>
        </main>
      </div>

      {/* ============================================================ */}
      {/* MODAL DE HISTÓRIA DO JOGO / LORE                            */}
      {/* ============================================================ */}
      {activeModal === 'lore' && (
        <div className="home-modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="home-modal-container glass" onClick={(e) => e.stopPropagation()}>
            <div className="home-modal-header">
              <h2>
                <GameIcon name="lore" size={20} /> História de Varezhia
              </h2>
              <button
                type="button"
                className="home-modal-close"
                onClick={() => setActiveModal(null)}
              >
                <GameIcon name="close" size={18} />
              </button>
            </div>
            <div className="home-modal-body">
              <div className="lore-formatted-content">
                {(homeConfig.loreText || DEFAULT_HOME_CONFIG.loreText)
                  .split('\n\n')
                  .map((paragraph, idx) => (
                    <p key={idx}>{paragraph}</p>
                  ))}
              </div>
            </div>
            <div className="home-modal-footer">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setActiveModal(null)}
              >
                Fechar História
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL DE REGRAS DO RPG                                      */}
      {/* ============================================================ */}
      {activeModal === 'rules' && (
        <div className="home-modal-backdrop" onClick={() => setActiveModal(null)}>
          <div className="home-modal-container glass" onClick={(e) => e.stopPropagation()}>
            <div className="home-modal-header">
              <h2>
                <GameIcon name="rules" size={20} /> Regras e Mecânicas do RPG
              </h2>
              <button
                type="button"
                className="home-modal-close"
                onClick={() => setActiveModal(null)}
              >
                <GameIcon name="close" size={18} />
              </button>
            </div>
            <div className="home-modal-body">
              <div className="rules-formatted-content">
                {(homeConfig.rulesText || DEFAULT_HOME_CONFIG.rulesText)
                  .split('\n\n')
                  .map((paragraph, idx) => (
                    <p key={idx}>{paragraph}</p>
                  ))}
              </div>
            </div>
            <div className="home-modal-footer">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setActiveModal(null)}
              >
                Compreendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
