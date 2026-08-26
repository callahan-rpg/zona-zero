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

    // 🌨️ NEVE / NEVASCA
    if (condition === 'snowy') {
      const flakeCount = 130
      for (let i = 0; i < flakeCount; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          radius: Math.random() * 2.5 + 1.2,
          speed: Math.random() * 1.5 + 0.8,
          drift: (Math.random() - 0.5) * 0.8,
          opacity: Math.random() * 0.6 + 0.3,
          swing: Math.random() * Math.PI * 2,
          swingSpeed: Math.random() * 0.03 + 0.01,
        })
      }
    }

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

    // ☁️ CÉU NUBLADO / ENCOBERTO / CINZENTO
    if (condition === 'cloudy') {
      const cloudCount = 18
      for (let i = 0; i < cloudCount; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * (height * 0.7),
          radius: Math.random() * 200 + 140,
          vx: (Math.random() * 0.3 + 0.1), // movimento suave lateral
          opacity: Math.random() * 0.08 + 0.04,
        })
      }
    }

    // Loop de renderização
    const render = () => {
      ctx.clearRect(0, 0, width, height)

      // EFEITO CÉU NUBLADO / CINZENTO (CLOUDY)
      if (condition === 'cloudy') {
        // Tom suave cinzento escurecido sobre a cena
        ctx.fillStyle = 'rgba(25, 30, 38, 0.25)'
        ctx.fillRect(0, 0, width, height)

        for (let i = 0; i < particles.length; i++) {
          const p = particles[i]
          const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius)
          gradient.addColorStop(0, `rgba(40, 48, 58, ${p.opacity})`)
          gradient.addColorStop(0.6, `rgba(30, 38, 48, ${p.opacity * 0.6})`)
          gradient.addColorStop(1, 'rgba(30, 38, 48, 0)')

          ctx.fillStyle = gradient
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
          ctx.fill()

          p.x += p.vx
          if (p.x - p.radius > width) {
            p.x = -p.radius
            p.y = Math.random() * (height * 0.7)
          }
        }
      }

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

      // RENDERIZAR NEVE
      if (condition === 'snowy') {
        ctx.fillStyle = 'rgba(240, 248, 255, 0.8)'
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i]
          p.swing += p.swingSpeed
          p.y += p.speed
          p.x += Math.sin(p.swing) * 0.8 + p.drift

          if (p.y > height) {
            p.y = -5
            p.x = Math.random() * width
          }
          if (p.x < -10) p.x = width + 10
          if (p.x > width + 10) p.x = -10

          ctx.beginPath()
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(235, 245, 255, ${p.opacity})`
          ctx.fill()
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

  if (!enabled || isIndoor || !['rainy', 'storm', 'foggy', 'snowy', 'cloudy'].includes(condition)) {
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
