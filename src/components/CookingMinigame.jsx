import { useState, useEffect, useRef } from 'react'
import { MINIGAME_DIFFICULTIES } from '../utils/minigameEngine'

export default function CookingMinigame({
  recipe,
  session,
  onFinish,
  onCancel
}) {
  const difficultyConfig = MINIGAME_DIFFICULTIES[session?.difficulty || recipe?.minigameDifficulty || 'normal'] || MINIGAME_DIFFICULTIES.normal
  const totalDurationSec = Math.max(3, Number(session?.durationSec || recipe?.cookDurationSec || 6))

  const [heatState, setHeatState] = useState(25) // Para feedback de texto/cor reativo (atualizado de forma suave)
  const [inIdealZoneState, setInIdealZoneState] = useState(false)
  const [progressState, setProgressState] = useState(0)
  const [timeLeftState, setTimeLeftState] = useState(totalDurationSec)
  const [isHeating, setIsHeating] = useState(false)
  const [minigameState, setMinigameState] = useState('playing') // playing | success | failed

  // Refs de alta performance para física 60 FPS sem engasgos
  const isHeatingRef = useRef(false)
  const heatRef = useRef(25)
  const velocityRef = useRef(0)
  const progressRef = useRef(0)
  const timeLeftRef = useRef(totalDurationSec)
  const animFrameRef = useRef(null)
  const lastTimeRef = useRef(null)
  const lastUiUpdateRef = useRef(0)

  // Element refs para manipulação DOM ultra suave sem re-renders pesados no loop
  const markerRef = useRef(null)
  const flameRef = useRef(null)
  const progressBarRef = useRef(null)
  const progressTextRef = useRef(null)
  const timerTextRef = useRef(null)
  const idealZoneGlowRef = useRef(null)

  useEffect(() => {
    isHeatingRef.current = isHeating
  }, [isHeating])

  // Loop de física suave com inércia / aceleração natural (Fluid Physics Engine)
  useEffect(() => {
    lastTimeRef.current = performance.now()

    const updatePhysics = (now) => {
      if (minigameState !== 'playing') return

      const dt = Math.min(0.05, (now - lastTimeRef.current) / 1000)
      lastTimeRef.current = now

      // 1. Aceleração e Velocidade Dinâmica (Feedback gradual e orgânico ao segurar espaço)
      const targetVel = isHeatingRef.current
        ? difficultyConfig.heatingRate * 1.5
        : -difficultyConfig.coolingRate * 1.2

      const accelRate = isHeatingRef.current ? 12 : 8
      velocityRef.current += (targetVel - velocityRef.current) * accelRate * dt

      // 2. Atualização de Posição de Temperatura
      let currentHeat = heatRef.current + velocityRef.current * dt
      if (currentHeat <= 0) {
        currentHeat = 0
        velocityRef.current = 0
      } else if (currentHeat >= 100) {
        currentHeat = 100
        velocityRef.current = 0
      }
      heatRef.current = currentHeat

      // 3. Checagem de Zona Ideal
      const inIdeal = currentHeat >= difficultyConfig.idealZoneMin && currentHeat <= difficultyConfig.idealZoneMax

      // 4. Progresso de Cozimento
      let currentProgress = progressRef.current
      if (inIdeal) {
        currentProgress += difficultyConfig.progressGainPerSec * dt
      }
      currentProgress = Math.max(0, Math.min(100, currentProgress))
      progressRef.current = currentProgress

      // 5. Tempo Restante
      let currentTimeLeft = Math.max(0, timeLeftRef.current - dt)
      timeLeftRef.current = currentTimeLeft

      // 6. Atualização Direta no DOM (60 FPS contínuo sem lag de React re-render)
      if (markerRef.current) {
        markerRef.current.style.left = `${currentHeat}%`
        if (inIdeal) {
          markerRef.current.style.background = 'linear-gradient(180deg, #34d399 0%, #059669 100%)'
          markerRef.current.style.boxShadow = '0 0 16px #34d399, 0 0 6px #fff'
        } else if (currentHeat > difficultyConfig.idealZoneMax) {
          markerRef.current.style.background = 'linear-gradient(180deg, #f87171 0%, #dc2626 100%)'
          markerRef.current.style.boxShadow = '0 0 14px #ef4444'
        } else {
          markerRef.current.style.background = 'linear-gradient(180deg, #93c5fd 0%, #2563eb 100%)'
          markerRef.current.style.boxShadow = '0 0 12px #3b82f6'
        }
      }

      if (progressBarRef.current) {
        progressBarRef.current.style.width = `${currentProgress}%`
      }

      if (flameRef.current) {
        const scale = isHeatingRef.current ? 1.25 : inIdeal ? 1.05 : 0.85
        const opacity = Math.max(0.3, Math.min(1, currentHeat / 60))
        flameRef.current.style.transform = `scale(${scale})`
        flameRef.current.style.opacity = `${opacity}`
      }

      // 7. Atualização Throttled do Estado React para elementos textuais (a cada ~80ms)
      if (now - lastUiUpdateRef.current > 80) {
        lastUiUpdateRef.current = now
        setHeatState(currentHeat)
        setInIdealZoneState(inIdeal)
        setProgressState(currentProgress)
        setTimeLeftState(currentTimeLeft)
      }

      // 8. Checagem de Conclusão / Fim de Jogo
      if (currentProgress >= 100) {
        setMinigameState('success')
        setProgressState(100)
        setTimeout(() => {
          onFinish?.({ success: true, heat: currentHeat, progress: 100 })
        }, 400)
        return
      }

      if (currentTimeLeft <= 0) {
        setMinigameState('failed')
        setTimeLeftState(0)
        setTimeout(() => {
          onFinish?.({ success: false, heat: currentHeat, progress: currentProgress })
        }, 500)
        return
      }

      animFrameRef.current = requestAnimationFrame(updatePhysics)
    }

    animFrameRef.current = requestAnimationFrame(updatePhysics)

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [minigameState, difficultyConfig, onFinish])

  // Suporte a teclado ultra-responsivo
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' || e.key === ' ' || e.code === 'KeyW' || e.code === 'ArrowUp') {
        if (!e.repeat) {
          setIsHeating(true)
        }
        e.preventDefault()
      }
    }

    const handleKeyUp = (e) => {
      if (e.code === 'Space' || e.key === ' ' || e.code === 'KeyW' || e.code === 'ArrowUp') {
        setIsHeating(false)
        e.preventDefault()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  const isTooCold = heatState < difficultyConfig.idealZoneMin
  const isTooHot = heatState > difficultyConfig.idealZoneMax

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px',
        padding: '16px 12px',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'manipulation'
      }}
    >
      {/* CABEÇALHO DO MINIGAME */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 12px', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid #f59e0b', borderRadius: '20px', marginBottom: '6px' }}>
          <span style={{ fontSize: '14px' }}>🔥</span>
          <span style={{ fontSize: '11px', fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Controle de Temperatura do Fogo
          </span>
        </div>
        <p style={{ margin: 0, fontSize: '12px', color: '#d1d5db', maxWidth: '420px' }}>
          Segure a <strong>Barra de Espaço</strong> ou o botão para aquecer e mantenha a chama na <strong>Zona Ideal</strong>!
        </p>
      </div>

      {/* PANELA E ANIMAÇÃO VISUAL DE PREPARO */}
      <div
        style={{
          position: 'relative',
          width: '100px',
          height: '90px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {/* Fogo embaixo com scale suave */}
        <div
          ref={flameRef}
          style={{
            position: 'absolute',
            bottom: '4px',
            fontSize: '34px',
            filter: isHeating
              ? 'drop-shadow(0 0 16px #ef4444)'
              : inIdealZoneState
              ? 'drop-shadow(0 0 12px #f59e0b)'
              : 'drop-shadow(0 0 4px #6b7280)',
            transition: 'transform 0.08s ease-out, opacity 0.08s ease-out',
            transformOrigin: 'bottom center'
          }}
        >
          🔥
        </div>

        {/* Panela / Frigideira */}
        <div
          style={{
            fontSize: '52px',
            zIndex: 2,
            transform: isHeating ? 'scale(1.04) translateY(-2px)' : 'scale(1)',
            transition: 'transform 0.1s ease',
            filter: inIdealZoneState ? 'drop-shadow(0 0 10px rgba(16, 185, 129, 0.7))' : 'none'
          }}
        >
          🍳
        </div>

        {/* Vapor saindo quando na zona ideal */}
        {inIdealZoneState && (
          <div
            style={{
              position: 'absolute',
              top: '-6px',
              fontSize: '20px',
              animation: 'bounce 0.8s infinite alternate',
              opacity: 0.9
            }}
          >
            ♨️
          </div>
        )}
      </div>

      {/* GAUGE DE TEMPERATURA */}
      <div style={{ width: '100%', maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
          <span style={{ color: '#93c5fd', fontWeight: 600 }}>❄️ Frio</span>
          <span style={{ color: '#34d399', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            🎯 Ponto Ideal ({difficultyConfig.idealZoneMin}% - {difficultyConfig.idealZoneMax}%)
          </span>
          <span style={{ color: '#f87171', fontWeight: 600 }}>🔥 Superaquecido</span>
        </div>

        {/* BARRA DA ESCALA TÉRMICA COM A ZONA IDEAL */}
        <div
          style={{
            position: 'relative',
            height: '32px',
            background: 'linear-gradient(90deg, #1e293b 0%, #0f172a 100%)',
            borderRadius: '16px',
            border: '2px solid rgba(255, 255, 255, 0.15)',
            overflow: 'hidden',
            boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.8)'
          }}
        >
          {/* FAIXA DA ZONA IDEAL */}
          <div
            ref={idealZoneGlowRef}
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${difficultyConfig.idealZoneMin}%`,
              width: `${difficultyConfig.idealZoneMax - difficultyConfig.idealZoneMin}%`,
              background: inIdealZoneState
                ? 'linear-gradient(180deg, rgba(16, 185, 129, 0.45) 0%, rgba(5, 150, 105, 0.65) 100%)'
                : 'linear-gradient(180deg, rgba(16, 185, 129, 0.25) 0%, rgba(5, 150, 105, 0.35) 100%)',
              borderLeft: '2px dashed #10b981',
              borderRight: '2px dashed #10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s ease',
              boxShadow: inIdealZoneState ? '0 0 16px rgba(16, 185, 129, 0.5)' : 'none'
            }}
          >
            <span style={{ fontSize: '9px', fontWeight: 800, color: inIdealZoneState ? '#ecfdf5' : '#a7f3d0', letterSpacing: '1px' }}>
              ZONA IDEAL
            </span>
          </div>

          {/* INDICADOR / MARCADOR DE CALOR (Manipulado via Direct DOM para 60fps fluido sem lag de transition) */}
          <div
            ref={markerRef}
            style={{
              position: 'absolute',
              top: '2px',
              bottom: '2px',
              left: '25%',
              transform: 'translateX(-50%)',
              width: '20px',
              background: 'linear-gradient(180deg, #93c5fd 0%, #2563eb 100%)',
              borderRadius: '6px',
              border: '2px solid #fff',
              boxShadow: '0 0 12px #3b82f6',
              zIndex: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              willChange: 'left, transform'
            }}
          >
            <div style={{ width: '2px', height: '14px', background: '#fff', borderRadius: '1px' }} />
          </div>
        </div>

        {/* FEEDBACK DE ESTADO TÉRMICO */}
        <div style={{ textAlign: 'center', minHeight: '18px', fontSize: '11px', fontWeight: 700 }}>
          {inIdealZoneState ? (
            <span style={{ color: '#34d399' }}>✨ Ponto perfeito! Cozinhando no fogo ideal (+Progresso)</span>
          ) : isTooCold ? (
            <span style={{ color: '#93c5fd' }}>❄️ Fogo brando! Segure Espaço / Botão para elevar o calor.</span>
          ) : (
            <span style={{ color: '#f87171' }}>⚠️ Muito quente! Solte para a panela esfriar.</span>
          )}
        </div>
      </div>

      {/* BARRA DE PROGRESSO DE COZIMENTO E TEMPO RESTANTE */}
      <div style={{ width: '100%', maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#d1d5db' }}>
          <span>Progresso do Prato: <strong>{Math.round(progressState)}%</strong></span>
          <span style={{ color: timeLeftState <= 2 ? '#ef4444' : '#fbbf24', fontWeight: 700 }}>
            ⏱️ Tempo: {timeLeftState.toFixed(1)}s
          </span>
        </div>

        <div
          style={{
            height: '14px',
            background: 'rgba(0, 0, 0, 0.6)',
            borderRadius: '7px',
            border: '1px solid rgba(251, 191, 36, 0.3)',
            overflow: 'hidden',
            padding: '1px'
          }}
        >
          <div
            ref={progressBarRef}
            style={{
              height: '100%',
              width: `${progressState}%`,
              background: progressState >= 100
                ? '#10b981'
                : 'linear-gradient(90deg, #f59e0b 0%, #10b981 100%)',
              borderRadius: '6px',
              boxShadow: '0 0 10px rgba(16, 185, 129, 0.5)',
              willChange: 'width'
            }}
          />
        </div>
      </div>

      {/* BOTÃO PRINCIPAL DE INTERAÇÃO COM FEEDBACK TÁTIL / VISUAL */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', width: '100%', maxWidth: '360px', marginTop: '6px' }}>
        <button
          type="button"
          onMouseDown={() => setIsHeating(true)}
          onMouseUp={() => setIsHeating(false)}
          onMouseLeave={() => setIsHeating(false)}
          onTouchStart={(e) => {
            e.preventDefault()
            setIsHeating(true)
          }}
          onTouchEnd={(e) => {
            e.preventDefault()
            setIsHeating(false)
          }}
          onTouchCancel={() => setIsHeating(false)}
          style={{
            width: '100%',
            padding: '16px 20px',
            fontSize: '16px',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '1px',
            borderRadius: '12px',
            border: isHeating ? '2px solid #ef4444' : '2px solid #f59e0b',
            background: isHeating
              ? 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)'
              : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            color: isHeating ? '#fff' : '#000',
            boxShadow: isHeating
              ? '0 0 24px rgba(220, 38, 38, 0.9), inset 0 2px 6px rgba(0, 0, 0, 0.5)'
              : '0 4px 15px rgba(245, 158, 11, 0.4)',
            cursor: 'pointer',
            transform: isHeating ? 'scale(0.96)' : 'scale(1)',
            transition: 'transform 0.06s ease, background 0.08s ease, border 0.08s ease',
            touchAction: 'none'
          }}
        >
          {isHeating ? '🔥 AQUECENDO (SOLTE P/ RESFRIAR)' : '🔥 SEGURE ESPAÇO P/ AQUECER'}
        </button>

        <span style={{ fontSize: '10px', color: '#9ca3af' }}>
          💡 Pressione ou segure a <strong>Barra de Espaço</strong> para dosar o fogo com precisão.
        </span>

        {/* BOTÃO DE DESISTIR / CANCELAR SEM PENALIDADE */}
        <button
          type="button"
          onClick={onCancel}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#9ca3af',
            fontSize: '11px',
            cursor: 'pointer',
            marginTop: '4px',
            textDecoration: 'underline'
          }}
        >
          Desistir do preparo (Ingredientes preservados)
        </button>
      </div>
    </div>
  )
}
