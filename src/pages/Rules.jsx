import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../contexts/AuthContext.jsx'
import HUD from '../components/HUD.jsx'
import GameIcon from '../components/GameIcon.jsx'
import { DEFAULT_RULES_CONFIG } from '../utils/rulesDefaults.js'

export default function Rules() {
  const { user, role } = useAuth()
  const navigate = useNavigate()

  // Estado das configurações das regras do Firestore
  const [rulesConfig, setRulesConfig] = useState(DEFAULT_RULES_CONFIG)

  // Escuta as configurações de regras no Firestore em tempo real
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'rules_config', 'global'), (snap) => {
      if (snap.exists()) {
        const data = snap.data()
        setRulesConfig({
          ...DEFAULT_RULES_CONFIG,
          ...data,
          hero: { ...DEFAULT_RULES_CONFIG.hero, ...(data.hero || {}) },
          professionsIntro: { ...DEFAULT_RULES_CONFIG.professionsIntro, ...(data.professionsIntro || {}) },
          professions: data.professions && data.professions.length > 0 ? data.professions : DEFAULT_RULES_CONFIG.professions,
          progression: { ...DEFAULT_RULES_CONFIG.progression, ...(data.progression || {}) },
          combat: { ...DEFAULT_RULES_CONFIG.combat, ...(data.combat || {}) },
          conditions: { ...DEFAULT_RULES_CONFIG.conditions, ...(data.conditions || {}) },
          survivalTime: { ...DEFAULT_RULES_CONFIG.survivalTime, ...(data.survivalTime || {}) }
        })
      } else {
        setRulesConfig(DEFAULT_RULES_CONFIG)
      }
    }, (err) => {
      console.warn('Usando regras padrão locais:', err)
      setRulesConfig(DEFAULT_RULES_CONFIG)
    })
    return unsub
  }, [])

  // Abas principais
  const [activeTab, setActiveTab] = useState('professions') // 'professions' | 'progression' | 'combat_damage' | 'conditions' | 'survival_time'
  
  // Filtros/busca e estado interativo
  const [professionSearch, setProfessionSearch] = useState('')
  const [selectedProfession, setSelectedProfession] = useState('militar')
  const [selectedSpecialty, setSelectedSpecialty] = useState(null)

  // Calculadora Interativa de Progressão / Simulador
  const [calcLevel, setCalcLevel] = useState(1)
  const [calcXp, setCalcXp] = useState(0)

  // Simulador de HP & Vitals
  const [simConstitution, setSimConstitution] = useState(4)
  const [simBleedLevel, setSimBleedLevel] = useState('none')
  const [simHitLocation, setSimHitLocation] = useState('torso')
  const [simWeaponDmg, setSimWeaponDmg] = useState(35)

  // Dados de profissões do config ativo
  const professionsData = rulesConfig.professions || DEFAULT_RULES_CONFIG.professions
  // Profissão selecionada
  const activeProfObj = professionsData.find(p => p.id === selectedProfession) || professionsData[0] || DEFAULT_RULES_CONFIG.professions[0]

  // Filtro de profissões
  const filteredProfessions = useMemo(() => {
    if (!professionSearch.trim()) return professionsData
    const q = professionSearch.toLowerCase()
    return professionsData.filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.badge?.toLowerCase().includes(q) ||
      p.specialties?.some(s => s.name.toLowerCase().includes(q))
    )
  }, [professionSearch, professionsData])

  // Cálculo de HP Base
  const calculatedHp = 100 + (simConstitution * 5)
  
  // Modificador de Dano por Localização
  const hitModifiers = {
    head: { mult: 2.5, label: 'Cabeça (×2.5 Dano - Risco Letal Instantâneo)' },
    torso: { mult: 1.0, label: 'Torso (×1.0 Dano Padrão)' },
    arm: { mult: 0.75, label: 'Braço (×0.75 Dano - Fratura / Desarme)' },
    leg: { mult: 0.75, label: 'Perna (×0.75 Dano - Queda / Imobilidade)' }
  }
  const effectiveDmg = Math.round(simWeaponDmg * hitModifiers[simHitLocation].mult)
  const remainingHp = Math.max(0, calculatedHp - effectiveDmg)
  const remainingPct = Math.round((remainingHp / calculatedHp) * 100)

  // Desestruturação dos módulos do rulesConfig
  const hero = rulesConfig.hero || DEFAULT_RULES_CONFIG.hero
  const professionsIntro = rulesConfig.professionsIntro || DEFAULT_RULES_CONFIG.professionsIntro
  const progression = rulesConfig.progression || DEFAULT_RULES_CONFIG.progression
  const combat = rulesConfig.combat || DEFAULT_RULES_CONFIG.combat
  const conditions = rulesConfig.conditions || DEFAULT_RULES_CONFIG.conditions
  const survivalTime = rulesConfig.survivalTime || DEFAULT_RULES_CONFIG.survivalTime

  return (
    <div className="rules-page-container">
      {/* Header HUD se logado, ou barra de topo estilizada */}
      {user ? (
        <HUD locationName="Compêndio de Regras e Sobrevivência" />
      ) : (
        <header className="rules-guest-header">
          <Link to="/" className="home-nav-logo" title="Voltar para a Home">
            ZONA ZERO
          </Link>
          <div className="rules-header-right">
            <Link to="/" className="btn btn-sm">
              <GameIcon name="home" size={14} /> Home
            </Link>
            <Link to="/login" className="btn btn-sm btn-primary">
              <GameIcon name="login" size={14} /> Entrar no Jogo
            </Link>
          </div>
        </header>
      )}

      {/* Botão flutuante de atalho caso seja Admin */}
      {role === 'admin' && (
        <div style={{
          maxWidth: '1280px',
          width: '100%',
          margin: '0 auto',
          padding: '12px 24px 0',
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <Link
            to="/admin?tab=rules"
            className="btn btn-sm"
            style={{
              background: 'rgba(234, 179, 8, 0.15)',
              borderColor: '#eab308',
              color: '#facc15',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
            }}
          >
            ✏️ Editar Textos & Regras no Painel Admin
          </Link>
        </div>
      )}

      <main className="rules-main-content">
        {/* Banner Hero do Compêndio */}
        <section className="rules-hero-banner">
          <div className="rules-hero-text">
            <span className="rules-hero-tag">{hero.tag}</span>
            <h1 className="rules-hero-title">{hero.title}</h1>
            <p className="rules-hero-description">{hero.description}</p>
          </div>
          
          <div className="rules-hero-stats">
            {(hero.stats || DEFAULT_RULES_CONFIG.hero.stats).map((st, idx) => (
              <div key={idx} className="rules-stat-pill">
                <span className="stat-num">{st.num}</span>
                <span className="stat-lbl">{st.lbl}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Barra de Navegação entre Módulos das Regras */}
        <nav className="rules-tab-navigation">
          <button
            type="button"
            className={`rules-tab-btn ${activeTab === 'professions' ? 'active' : ''}`}
            onClick={() => setActiveTab('professions')}
          >
            <span className="tab-icon">🪖</span>
            <span>1. Profissões & Especialidades</span>
          </button>
          <button
            type="button"
            className={`rules-tab-btn ${activeTab === 'progression' ? 'active' : ''}`}
            onClick={() => setActiveTab('progression')}
          >
            <span className="tab-icon">📈</span>
            <span>2. Progressão & Economia de XP</span>
          </button>
          <button
            type="button"
            className={`rules-tab-btn ${activeTab === 'combat_damage' ? 'active' : ''}`}
            onClick={() => setActiveTab('combat_damage')}
          >
            <span className="tab-icon">🩸</span>
            <span>3. Combate, Dano & Sangramento</span>
          </button>
          <button
            type="button"
            className={`rules-tab-btn ${activeTab === 'conditions' ? 'active' : ''}`}
            onClick={() => setActiveTab('conditions')}
          >
            <span className="tab-icon">🧟</span>
            <span>4. Infecção & Condições Vitais</span>
          </button>
          <button
            type="button"
            className={`rules-tab-btn ${activeTab === 'survival_time' ? 'active' : ''}`}
            onClick={() => setActiveTab('survival_time')}
          >
            <span className="tab-icon">⏱️</span>
            <span>5. Tempo ON/OFF & Morte</span>
          </button>
        </nav>

        {/* ========================================================================= */}
        {/* ABA 1: PROFISSÕES & ESPECIALIDADES                                        */}
        {/* ========================================================================= */}
        {activeTab === 'professions' && (
          <div className="rules-section-view">
            <div className="rules-intro-card">
              <h3>{professionsIntro.title}</h3>
              <p>{professionsIntro.description}</p>
              <div className="rules-formula-box">
                <span className="formula-part"><strong>Profissão:</strong> Quem você era (+2 Atributo Geral)</span>
                <span className="formula-arrow">➔</span>
                <span className="formula-part"><strong>Especialização:</strong> No que era bom (+1 Atributo Específico + Equipamento + Perícias)</span>
                <span className="formula-arrow">➔</span>
                <span className="formula-part"><strong>Nível & XP:</strong> Quem você se torna</span>
              </div>
            </div>

            {/* Layout com Seletor Lateral e Detalhes da Profissão */}
            <div className="professions-showcase-layout">
              {/* Coluna Esquerda: Lista de Profissões */}
              <div className="professions-list-col">
                <div className="prof-search-wrap">
                  <input
                    type="text"
                    placeholder="Filtrar profissões ou especialidades..."
                    value={professionSearch}
                    onChange={(e) => setProfessionSearch(e.target.value)}
                    className="prof-search-input"
                  />
                </div>

                <div className="prof-cards-stack">
                  {filteredProfessions.map((prof) => {
                    const isSelected = prof.id === activeProfObj.id
                    return (
                      <button
                        key={prof.id}
                        type="button"
                        className={`prof-card-item ${isSelected ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedProfession(prof.id)
                          setSelectedSpecialty(null)
                        }}
                        style={{ borderLeftColor: isSelected ? prof.color : 'transparent' }}
                      >
                        <div className="prof-card-icon" style={{ background: `${prof.color}15`, color: prof.color }}>
                          {prof.icon}
                        </div>
                        <div className="prof-card-info">
                          <div className="prof-card-top">
                            <span className="prof-card-name">{prof.name}</span>
                            <span className="prof-card-bonus">{prof.attrBonus}</span>
                          </div>
                          <span className="prof-card-badge">{prof.badge}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Coluna Direita: Detalhamento Completo e Especializações */}
              <div className="professions-detail-col">
                <div className="prof-detail-header" style={{ borderColor: `${activeProfObj.color}40` }}>
                  <div className="prof-detail-title-row">
                    <span className="prof-detail-big-icon">{activeProfObj.icon}</span>
                    <div>
                      <span className="prof-detail-tag" style={{ color: activeProfObj.color }}>{activeProfObj.badge}</span>
                      <h2 className="prof-detail-name">{activeProfObj.name}</h2>
                    </div>
                    <div className="prof-detail-bonus-pill">
                      Bônus Base: <strong>{activeProfObj.attrBonus}</strong>
                    </div>
                  </div>
                  <p className="prof-detail-summary">{activeProfObj.summary}</p>
                  <blockquote className="prof-detail-quote">{activeProfObj.quote}</blockquote>
                </div>

                <h4 className="specs-section-title">
                  <span>⚡ Ramificações / Especializações Disponíveis ({activeProfObj.specialties.length})</span>
                  <small>Escolha uma ao criar a ficha para obter bônus adicionais e kit inicial</small>
                </h4>

                <div className="specs-grid">
                  {activeProfObj.specialties.map((spec) => {
                    return (
                      <div key={spec.id} className="spec-card">
                        <div className="spec-card-header">
                          <span className="spec-icon">{spec.icon}</span>
                          <div>
                            <h5 className="spec-name">{spec.name}</h5>
                            <span className="spec-bonus">{spec.attrBonus}</span>
                          </div>
                        </div>

                        <div className="spec-body">
                          <div className="spec-block">
                            <span className="spec-label">🎯 Proficiências & Vantagens</span>
                            <ul className="spec-list">
                              {spec.proficiencies.map((p, idx) => (
                                <li key={idx}>{p}</li>
                              ))}
                            </ul>
                          </div>

                          <div className="spec-block">
                            <span className="spec-label">📦 Equipamento Inicial</span>
                            <div className="spec-equip-tags">
                              {spec.starterEquipment.map((eq, idx) => (
                                <span key={idx} className="spec-equip-tag">
                                  {eq}
                                </span>
                              ))}
                            </div>
                          </div>

                          {spec.perks && spec.perks.length > 0 && (
                            <div className="spec-block">
                              <span className="spec-label">⭐ Habilidade de Sobrevivência</span>
                              <ul className="spec-list perks">
                                {spec.perks.map((pk, idx) => (
                                  <li key={idx}>{pk}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Exemplo de Ficha Prática */}
                <div className="sheet-example-box">
                  <h5>📋 Exemplo Prático de Ficha na Criação</h5>
                  <div className="sheet-example-grid">
                    <div className="example-char-card">
                      <strong>Exemplo A: Combatente de Resgate</strong>
                      <div className="char-meta-row">Profissão: <span>Militar</span> | Especialidade: <span>Bombeiro</span></div>
                      <div className="char-attr-row">
                        <span>Força: <strong>3 → 6</strong> (+2 Militar, +1 Bombeiro)</span>
                        <span>Sabedoria: <strong>3</strong></span>
                        <span>Percepção: <strong>3</strong></span>
                      </div>
                      <p className="char-note">Inicia com Machado de Incêndio, Traje Ignífugo e eficiência máxima para arrombar portas e barricadas.</p>
                    </div>

                    <div className="example-char-card">
                      <strong>Exemplo B: Suporte de Campo</strong>
                      <div className="char-meta-row">Profissão: <span>Médico</span> | Especialidade: <span>Socorrista</span></div>
                      <div className="char-attr-row">
                        <span>Sabedoria: <strong>3 → 5</strong> (+2 Médico)</span>
                        <span>Agilidade: <strong>3 → 4</strong> (+1 Socorrista)</span>
                        <span>Força: <strong>3</strong></span>
                      </div>
                      <p className="char-note">Inicia com Kit de Primeiros Socorros, capacidade de estabilizar aliados moribundos em tempo recorde.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ABA 2: PROGRESSÃO & ECONOMIA DE XP                                        */}
        {/* ========================================================================= */}
        {activeTab === 'progression' && (
          <div className="rules-section-view">
            <div className="rules-intro-card">
              <h3>{progression.introTitle || '📈 Sistema de Progressão & Economia de XP'}</h3>
              <p>{progression.introText}</p>
              <div className="progression-pill-highlight">
                <span>⭐ Base Fixa: <strong>{progression.baseXpPerLevel || 80} XP por Nível</strong> (o XP não inflaciona)</span>
                <span>💪 A cada Nível: <strong>+{progression.attrPointsPerLevel || 6} Pontos de Atributo</strong> (Máx. +{progression.maxAttrInvestPerLevel || 3} no mesmo atributo)</span>
                <span>💰 Recompensa Financeira: <strong>+{progression.rublesPerLevel || 200} Novos Rúblos (₽)</strong> por nível alcançado</span>
              </div>
            </div>

            {/* Simulador Interativo de Níveis */}
            <div className="rules-interactive-widget">
              <div className="widget-header">
                <h4>🧮 Simulador de Evolução de Nível</h4>
                <span>Arraste para testar o progresso do sobrevivente</span>
              </div>
              
              <div className="calc-controls-row">
                <div className="calc-slider-group">
                  <label>Nível Almejado: <strong>Nível {calcLevel}</strong></label>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={calcLevel}
                    onChange={(e) => setCalcLevel(Number(e.target.value))}
                    className="calc-range-slider"
                  />
                </div>
                <div className="calc-results-preview">
                  <div className="calc-res-item">
                    <span className="lbl">XP Total Acumulado</span>
                    <span className="val">{(calcLevel - 1) * (progression.baseXpPerLevel || 80)} XP</span>
                  </div>
                  <div className="calc-res-item">
                    <span className="lbl">Pontos de Atributo Ganhos</span>
                    <span className="val highlight">+{(calcLevel - 1) * (progression.attrPointsPerLevel || 6)} pts</span>
                  </div>
                  <div className="calc-res-item">
                    <span className="lbl">Novos Rúblos Obtidos</span>
                    <span className="val money">+{(calcLevel - 1) * (progression.rublesPerLevel || 200)} ₽</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Classificação de Dificuldade dos Eventos */}
            <h3 className="section-divider-title">🚦 Os 3 Graus de Risco das Missões</h3>
            <div className="difficulty-cards-grid">
              {(progression.difficulties || DEFAULT_RULES_CONFIG.progression.difficulties).map((diff) => (
                <div key={diff.id} className={`diff-card ${diff.id}`}>
                  <div className="diff-card-badge">{diff.tag}</div>
                  <h4 className="diff-card-title">{diff.name}</h4>
                  <p className="diff-card-desc">{diff.description}</p>
                  <div className="diff-card-xp">
                    <span>Recompensa:</span>
                    <strong>{diff.xpRange}</strong>
                  </div>
                  <div className="diff-card-footer">{diff.footer}</div>
                </div>
              ))}
            </div>

            {/* Tabelas de Ganho de XP Detalhadas */}
            <h3 className="section-divider-title">📊 Tabela Completa da Economia de XP</h3>
            <div className="xp-tables-grid">
              <div className="xp-table-card">
                <h5>Missões Solo & Em Grupo</h5>
                <table className="rules-table">
                  <thead>
                    <tr>
                      <th>Dificuldade</th>
                      <th>Solo</th>
                      <th>Grupo (Individual)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(progression.soloGroupTable || DEFAULT_RULES_CONFIG.progression.soloGroupTable).map((row, idx) => (
                      <tr key={idx}>
                        <td>{row.diff}</td>
                        <td>{row.solo}</td>
                        <td>{row.group}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <small className="table-note">* O XP em grupo é individual: cada sobrevivente que participa recebe o valor integral.</small>
              </div>

              <div className="xp-table-card">
                <h5>Treinamentos Narrativos</h5>
                <table className="rules-table">
                  <thead>
                    <tr>
                      <th>Tipo de Treino</th>
                      <th>Ganho de XP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(progression.trainingTable || DEFAULT_RULES_CONFIG.progression.trainingTable).map((row, idx) => (
                      <tr key={idx}>
                        <td>{row.type}</td>
                        <td>{row.xp}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <small className="table-note">* Treinamentos possuem cooldown para evitar repetições ilimitadas sem avanço narrativo.</small>
              </div>

              <div className="xp-table-card">
                <h5>Grandes Tramas Narrativas</h5>
                <table className="rules-table">
                  <thead>
                    <tr>
                      <th>Escopo da Trama</th>
                      <th>Recompensa Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(progression.plotsTable || DEFAULT_RULES_CONFIG.progression.plotsTable).map((row, idx) => (
                      <tr key={idx}>
                        <td>{row.scope}</td>
                        <td>{row.reward}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <small className="table-note">* Tramas são fracionadas em etapas (ex: Reconhecimento + Infiltração + Extração).</small>
              </div>
            </div>

            {/* Regras de Participação e Feitos Excepcionais */}
            <div className="rules-special-rules-grid">
              <div className="special-rule-box">
                <h5>⭐ Feitos Excepcionais (+XP Bônus do Narrador)</h5>
                <p>Recompensas concedidas por atos heróicos ou extremamente inteligentes durante a narrativa:</p>
                <ul>
                  {(progression.specialFeats || DEFAULT_RULES_CONFIG.progression.specialFeats).map((feat, idx) => (
                    <li key={idx}>{feat}</li>
                  ))}
                </ul>
              </div>

              <div className="special-rule-box">
                <h5>🩸 O Fracasso Também Ensina (XP por Participação)</h5>
                <p>Em um RPG realista, aprender a recuar de uma derrota ensina tanto quanto vencer:</p>
                <ul>
                  {(progression.failureRules || DEFAULT_RULES_CONFIG.progression.failureRules).map((frule, idx) => (
                    <li key={idx}>{frule}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ABA 3: COMBATE, DANO & SANGRAMENTO                                        */}
        {/* ========================================================================= */}
        {activeTab === 'combat_damage' && (
          <div className="rules-section-view">
            <div className="rules-intro-card">
              <h3>{combat.introTitle || '🩸 Sistema Vital, Ferimentos e Balística'}</h3>
              <p>{combat.introText}</p>
              <div className="formula-callout">
                <strong>Cálculo do HP Máximo:</strong> <code>HP = 100 + (Constituição × 5)</code>
                <span> (Exemplo: Constituição 4 = 120 HP | Constituição 8 = 140 HP)</span>
              </div>
            </div>

            {/* Simulador de Dano e Impacto Balístico */}
            <div className="rules-interactive-widget">
              <div className="widget-header">
                <h4>🎯 Simulador de Balística & Localização do Tiro</h4>
                <span>Calcule o impacto do projétil e o risco de morte imediata</span>
              </div>

              <div className="damage-calc-grid">
                <div className="damage-calc-inputs">
                  <div className="calc-input-group">
                    <label>Sua Constituição: <strong>{simConstitution} (HP Máx: {calculatedHp})</strong></label>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={simConstitution}
                      onChange={(e) => setSimConstitution(Number(e.target.value))}
                      className="calc-range-slider"
                    />
                  </div>

                  <div className="calc-input-group">
                    <label>Dano Base da Arma: <strong>{simWeaponDmg} pts</strong></label>
                    <input
                      type="range"
                      min="5"
                      max="60"
                      value={simWeaponDmg}
                      onChange={(e) => setSimWeaponDmg(Number(e.target.value))}
                      className="calc-range-slider"
                    />
                  </div>

                  <div className="calc-input-group">
                    <label>Local do Disparo / Golpe:</label>
                    <div className="hit-location-buttons">
                      {Object.keys(hitModifiers).map((locKey) => (
                        <button
                          key={locKey}
                          type="button"
                          className={`hit-btn ${simHitLocation === locKey ? 'active' : ''}`}
                          onClick={() => setSimHitLocation(locKey)}
                        >
                          {locKey === 'head' && '💀 Cabeça (×2.5)'}
                          {locKey === 'torso' && '🦺 Torso (×1.0)'}
                          {locKey === 'arm' && '🦾 Braço (×0.75)'}
                          {locKey === 'leg' && '🦿 Perna (×0.75)'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="damage-calc-results">
                  <div className="calc-result-header">
                    <span>Resultado do Impacto</span>
                    <strong className={remainingHp === 0 ? 'fatal' : remainingPct <= 30 ? 'critical' : 'stable'}>
                      {remainingHp === 0 ? '☠️ MORIBUNDO / LETAL' : remainingPct <= 30 ? '⚠️ ESTADO CRÍTICO' : '🟡 FERIDO'}
                    </strong>
                  </div>

                  <div className="calc-hp-bar-wrap">
                    <div className="calc-hp-bar-label">
                      <span>HP Restante: {remainingHp} / {calculatedHp}</span>
                      <span>{remainingPct}%</span>
                    </div>
                    <div className="calc-hp-bar-track">
                      <div
                        className={`calc-hp-bar-fill ${remainingPct <= 30 ? 'danger' : remainingPct <= 60 ? 'warning' : 'healthy'}`}
                        style={{ width: `${remainingPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="calc-result-details">
                    <div>Dano Aplicado no Alvo: <strong>{effectiveDmg} de Dano</strong></div>
                    <div>Modificador de Local: <strong>{hitModifiers[simHitLocation].label}</strong></div>
                    {simHitLocation === 'head' && effectiveDmg >= calculatedHp && (
                      <div className="critical-warning">⚠️ Trauma Craniano Massivo: Risco de Morte Instantânea sem contador!</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Os 5 Estados de Vitalidade */}
            <h3 className="section-divider-title">📊 Os 5 Estados Vitais do HP</h3>
            <div className="vital-states-grid">
              {(combat.vitalStates || DEFAULT_RULES_CONFIG.combat.vitalStates).map((vs, idx) => (
                <div key={idx} className={`vital-state-card ${vs.color}`}>
                  <div className="v-state-header">{vs.tag}</div>
                  <p>{vs.desc}</p>
                </div>
              ))}
            </div>

            {/* Mecânica de Hemorragia / Sangramento */}
            <h3 className="section-divider-title">🩸 Os 4 Níveis de Hemorragia (Mecânica Vital)</h3>
            <div className="bleed-levels-grid">
              {(combat.bleedLevels || DEFAULT_RULES_CONFIG.combat.bleedLevels).map((bl, idx) => (
                <div key={idx} className={`bleed-card l${idx + 1}`}>
                  <div className="bleed-header">{bl.name}</div>
                  <div className="bleed-decay">{bl.decay}</div>
                  <p>{bl.desc}</p>
                </div>
              ))}
            </div>

            {/* Tabela de Armas e Danos */}
            <h3 className="section-divider-title">⚔️ Tabela Oficial de Armas e Balística</h3>
            <div className="weapons-table-wrap">
              <table className="rules-table">
                <thead>
                  <tr>
                    <th>Categoria</th>
                    <th>Arma</th>
                    <th>Dano Base</th>
                    <th>Efeito Particular</th>
                  </tr>
                </thead>
                <tbody>
                  {(combat.weapons || DEFAULT_RULES_CONFIG.combat.weapons).map((w, idx) => (
                    <tr key={idx}>
                      <td>{w.cat}</td>
                      <td>{w.name}</td>
                      <td>{w.dmg}</td>
                      <td>{w.effect}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ABA 4: INFECÇÃO & CONDIÇÕES VITAIS                                        */}
        {/* ========================================================================= */}
        {activeTab === 'conditions' && (
          <div className="rules-section-view">
            <div className="rules-intro-card">
              <h3>{conditions.introTitle || '🧟 O Relógio da Infecção Strain Zero'}</h3>
              <p>{conditions.introText}</p>
            </div>

            {/* Os 4 Estágios da Infecção */}
            <div className="infection-stages-timeline">
              {(conditions.infectionStages || DEFAULT_RULES_CONFIG.conditions.infectionStages).map((st, idx) => (
                <div key={idx} className={`stage-step ${st.danger ? 'danger' : ''}`}>
                  <div className="stage-badge">{st.badge}</div>
                  <div className="stage-time">{st.time}</div>
                  <h4 className="stage-name">{st.name}</h4>
                  <p>{st.desc}</p>
                </div>
              ))}
            </div>

            {/* Outras Condições de Sobrevivência */}
            <h3 className="section-divider-title">🩺 Doenças, Temperatura e Vitals</h3>
            <div className="conditions-grid">
              {(conditions.vitalsDebuffs || DEFAULT_RULES_CONFIG.conditions.vitalsDebuffs).map((c, idx) => (
                <div key={idx} className="condition-card">
                  <div className="condition-icon">{c.icon}</div>
                  <div className="condition-content">
                    <h4>{c.title}</h4>
                    <p>{c.desc}</p>
                    <ul>
                      {c.bullets?.map((b, bIdx) => (
                        <li key={bIdx}>{b}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ABA 5: TEMPO ON/OFF & MORTE                                               */}
        {/* ========================================================================= */}
        {activeTab === 'survival_time' && (
          <div className="rules-section-view">
            <div className="rules-intro-card">
              <h3>{survivalTime.introTitle || '⏱️ Fluxo Temporal ON / OFF & O Sistema de Legado'}</h3>
              <p>{survivalTime.introText}</p>
            </div>

            {/* Tabela de Conversão Temporal */}
            <div className="time-conversion-box">
              <h4>🕒 Tabela Oficial de Conversão Temporal</h4>
              <div className="time-pills-row">
                {(survivalTime.timeConversions || DEFAULT_RULES_CONFIG.survivalTime.timeConversions).map((tc, idx) => (
                  <div key={idx} className={`time-pill ${tc.highlight ? 'highlight' : ''}`}>
                    <span className="off-tag">{tc.off}</span>
                    <span className="arrow">➔</span>
                    <span className="on-tag">{tc.on}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Os 3 Caminhos da Morte */}
            <h3 className="section-divider-title">☠️ Os 3 Caminhos para a Morte de um Personagem</h3>
            <div className="death-paths-grid">
              {(survivalTime.deathPaths || DEFAULT_RULES_CONFIG.survivalTime.deathPaths).map((dp, idx) => (
                <div key={idx} className="death-card">
                  <div className="death-icon">{dp.icon}</div>
                  <h4>{dp.title}</h4>
                  <p>{dp.desc}</p>
                </div>
              ))}
            </div>

            {/* O Sistema de Legado ao Morrer */}
            <div className="legacy-system-card">
              <div className="legacy-header">
                <span className="legacy-icon">🕯️</span>
                <div>
                  <h4>{survivalTime.legacy?.title || 'A Morte Não é o Fim: Sistema de Legado'}</h4>
                  <p>{survivalTime.legacy?.subtitle || 'O jogador não perde seu investimento no jogo quando seu personagem morre.'}</p>
                </div>
              </div>
              <div className="legacy-body">
                <p>{survivalTime.legacy?.description}</p>
                <div className="legacy-perks-grid">
                  {survivalTime.legacy?.perks?.map((pk, idx) => (
                    <div key={idx} className="legacy-perk">
                      <strong>{pk.title}:</strong> {pk.desc}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="rules-page-footer">
        <div className="rules-footer-content">
          <p>ZONA ZERO RPG © PROTOCOLO DE SOBREVIVÊNCIA // VAREZHIA</p>
          <div className="rules-footer-links">
            <Link to="/">Home do RPG</Link>
            <Link to="/map">Mapa Tático</Link>
            <Link to="/characters">Sobreviventes</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
