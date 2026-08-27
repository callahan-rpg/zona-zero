import { useEffect, useRef, useState } from 'react'

/**
 * WeatherEffects: Renderiza efeitos visuais em Canvas diretamente sobre a imagem de fundo.
 *
 * @param {string} condition - Condição do tempo ('rainy', 'storm', 'foggy', 'snowy', 'cloudy', 'sunny')
 * @param {boolean} enabled - Se os efeitos estão ativados pelo usuário
 * @param {boolean} isIndoor - Se o local é ambiente fechado (desativa chuva/relâmpago diretos)
 */
export default function WeatherEffects({ condition = 'sunny', enabled = true, isIndoor = false }) {
  const canvasRef = useRef(null)
  const [opacity, setOpacity] = useState(() => {
    const saved = localStorage.getItem('zz_weather_opacity')
    return saved ? Number(saved) : 100
  })

  useEffect(() => {
    const handleOpacityChange = (e) => {
      if (e.detail !== undefined) {
        setOpacity(e.detail)
      } else {
        const saved = localStorage.getItem('zz_weather_opacity')
        setOpacity(saved ? Number(saved) : 100)
      }
    }
    window.addEventListener('weather_opacity_change', handleOpacityChange)
    return () => window.removeEventListener('weather_opacity_change', handleOpacityChange)
  }, [])

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

    // 🌫️ NEBLINA / NÉVOA
    if (condition === 'foggy' || condition === 'cloudy') {
      const fogCount = 25
      for (let i = 0; i < fogCount; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          radius: Math.random() * 140 + 80,
          vx: (Math.random() - 0.5) * 0.35,
          vy: (Math.random() - 0.5) * 0.15,
          opacity: Math.random() * 0.08 + 0.03,
        })
      }
    }

    // Relâmpagos em tempestade
    let lightningOpacity = 0
    let nextLightningTime = Date.now() + Math.random() * 6000 + 4000

    // Loop de renderização
    const render = () => {
      ctx.clearRect(0, 0, width, height)

      // Renderiza relâmpago
      if (condition === 'storm') {
        const now = Date.now()
        if (now > nextLightningTime) {
          lightningOpacity = 0.8
          nextLightningTime = now + Math.random() * 8000 + 5000
        }
        if (lightningOpacity > 0) {
          ctx.fillStyle = `rgba(230, 245, 255, ${lightningOpacity})`
          ctx.fillRect(0, 0, width, height)
          lightningOpacity -= 0.04
        }
      }

      // Renderiza partículas
      if (condition === 'snowy') {
        ctx.fillStyle = 'white'
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i]
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`
          ctx.fill()

          p.y += p.speed
          p.x += p.drift + Math.sin(p.swing) * 0.4
          p.swing += p.swingSpeed

          if (p.y > height) {
            p.y = -p.radius
            p.x = Math.random() * width
          }
          if (p.x > width) p.x = 0
          if (p.x < 0) p.x = width
        }
      }

      if (condition === 'rainy' || condition === 'storm') {
        ctx.lineWidth = condition === 'storm' ? 1.5 : 1.2
        ctx.strokeStyle = condition === 'storm' ? 'rgba(190, 220, 255, 0.7)' : 'rgba(210, 230, 255, 0.55)'

        for (let i = 0; i < particles.length; i++) {
          const p = particles[i]
          ctx.beginPath()
          ctx.moveTo(p.x, p.y)
          ctx.lineTo(p.x + p.slant, p.y + p.length)
          ctx.stroke()

          p.y += p.speed
          p.x += p.slant * (p.speed / 10)

          if (p.y > height) {
            p.y = -p.length
            p.x = Math.random() * width
          }
        }
      }

      if (condition === 'foggy' || condition === 'cloudy') {
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
        opacity: opacity / 100,
        transition: 'opacity 0.2s ease',
      }}
    />
  )
}
