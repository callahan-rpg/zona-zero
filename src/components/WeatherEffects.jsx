import { useEffect, useRef } from 'react'

/**
 * WeatherEffects: Renderiza efeitos visuais em Canvas diretamente sobre a imagem de fundo.
 *
 * @param {string} condition - Condição do tempo ('rainy', 'storm', 'foggy', 'snowy', 'cloudy', 'sunny')
 * @param {boolean} enabled - Se os efeitos estão ativados pelo usuário
 * @param {boolean} isIndoor - Se o local é ambiente fechado (desativa chuva/relâmpago diretos)
 */
export default function WeatherEffects({ condition = 'sunny', enabled = true, isIndoor = false }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!enabled || isIndoor) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animationFrameId
    let width = (canvas.width = window.innerWidth)
    let height = (canvas.height = window.innerHeight)

    const handleResize = () => {
      if (!canvas) return
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
    }
    window.addEventListener('resize', handleResize)

    // Configuração de partículas de acordo com o clima
    const particles = []

    // 🌧️ CHUVA & TEMPESTADE
    if (condition === 'rainy' || condition === 'storm') {
      const dropCount = condition === 'storm' ? 350 : 180
      for (let i = 0; i < dropCount; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          length: Math.random() * (condition === 'storm' ? 35 : 20) + 12,
          speed: Math.random() * (condition === 'storm' ? 18 : 10) + 10,
          opacity: Math.random() * 0.45 + 0.2,
          slant: condition === 'storm' ? -3 : -1,
        })
      }
    }

    // 🌫️ NEBLINA / NÉVOA / RADIAÇÃO EM SUSPENSÃO
    if (condition === 'foggy') {
      const fogCount = 45
      for (let i = 0; i < fogCount; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          radius: Math.random() * 120 + 80,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.2,
          opacity: Math.random() * 0.08 + 0.03,
        })
      }
    }

    // Variáveis de Relâmpago para Tempestade
    let lightningOpacity = 0
    let nextLightningTime = Date.now() + Math.random() * 5000 + 3000

    // Loop de renderização
    const render = () => {
      ctx.clearRect(0, 0, width, height)

      // EFEITO RELÂMPAGO (STORM)
      if (condition === 'storm') {
        const now = Date.now()
        if (now > nextLightningTime) {
          lightningOpacity = Math.random() * 0.65 + 0.35
          nextLightningTime = now + Math.random() * 7000 + 4000
        }
        if (lightningOpacity > 0) {
          ctx.fillStyle = `rgba(215, 235, 255, ${lightningOpacity})`
          ctx.fillRect(0, 0, width, height)
          lightningOpacity -= 0.04
        }
      }

      // RENDERIZAR CHUVA
      if (condition === 'rainy' || condition === 'storm') {
        ctx.strokeStyle = condition === 'storm' ? 'rgba(180, 215, 255, 0.65)' : 'rgba(170, 205, 240, 0.45)'
        ctx.lineWidth = condition === 'storm' ? 1.5 : 1.2
        ctx.beginPath()

        for (let i = 0; i < particles.length; i++) {
          const p = particles[i]
          ctx.moveTo(p.x, p.y)
          ctx.lineTo(p.x + p.slant, p.y + p.length)

          p.y += p.speed
          p.x += p.slant

          if (p.y > height) {
            p.y = -p.length
            p.x = Math.random() * width
          }
        }
        ctx.stroke()
      }

      // RENDERIZAR NEBLINA
      if (condition === 'foggy') {
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i]
          const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius)
          gradient.addColorStop(0, `rgba(200, 215, 220, ${p.opacity})`)
          gradient.addColorStop(1, 'rgba(200, 215, 220, 0)')

          ctx.fillStyle = gradient
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
          ctx.fill()

          p.x += p.vx
          p.y += p.vy

          if (p.x < -p.radius) p.x = width + p.radius
          if (p.x > width + p.radius) p.x = -p.radius
          if (p.y < -p.radius) p.y = height + p.radius
          if (p.y > height + p.radius) p.y = -p.radius
        }
      }

      animationFrameId = requestAnimationFrame(render)
    }

    render()

    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animationFrameId)
    }
  }, [condition, enabled, isIndoor])

  if (!enabled || isIndoor || !['rainy', 'storm', 'foggy'].includes(condition)) {
    return null
  }

  return (
    <canvas
      ref={canvasRef}
      className="weather-canvas"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 2,
      }}
    />
  )
}
