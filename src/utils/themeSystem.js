/**
 * Utilitário de Tema e Cores para o RPG Zombie
 * Gerencia a aplicação de cores de acento e tint translúcido sobre o efeito Glassmorphism.
 */

// Converte HEX para RGB { r, g, b }
export function hexToRgb(hex) {
  let c = (hex || '').replace('#', '').trim()
  if (c.length === 3) {
    c = c.split('').map(x => x + x).join('')
  }
  if (c.length !== 6) return { r: 38, g: 200, b: 143 }
  const num = parseInt(c, 16)
  if (isNaN(num)) return { r: 38, g: 200, b: 143 }
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  }
}

// Converte RGB para HEX (#RRGGBB)
export function rgbToHex(r, g, b) {
  const toHex = (n) => {
    const val = Math.max(0, Math.min(255, Math.round(n)))
    return val.toString(16).padStart(2, '0').toUpperCase()
  }
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

// Converte HSV (h: 0-360, s: 0-1, v: 0-1) para RGB (0-255)
export function hsvToRgb(h, s, v) {
  let r = 0, g = 0, b = 0
  const i = Math.floor((h / 60) % 6)
  const f = (h / 60) - i
  const p = v * (1 - s)
  const q = v * (1 - f * s)
  const t = v * (1 - (1 - f) * s)

  switch (i) {
    case 0: r = v; g = t; b = p; break
    case 1: r = q; g = v; b = p; break
    case 2: r = p; g = v; b = t; break
    case 3: r = p; g = q; b = v; break
    case 4: r = t; g = p; b = v; break
    case 5: r = v; g = p; b = q; break
    default: break
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  }
}

// Converte RGB (0-255) para HSV (h: 0-360, s: 0-1, v: 0-1)
export function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  const s = max === 0 ? 0 : d / max
  const v = max

  if (max !== min) {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break
      case g: h = (b - r) / d + 2; break
      case b: h = (r - g) / d + 4; break
      default: break
    }
    h = h * 60
    if (h < 0) h += 360
  }

  return {
    h: Math.round(h),
    s: s,
    v: v
  }
}

// Mistura uma cor RGB com o fundo escuro padrão (#0d0f12) mantendo o efeito fosco e legibilidade
function blendColorWithDark(r, g, b, tintIntensity = 0.15) {
  const baseR = 13
  const baseG = 15
  const baseB = 18

  const finalR = Math.round(baseR * (1 - tintIntensity) + r * tintIntensity)
  const finalG = Math.round(baseG * (1 - tintIntensity) + g * tintIntensity)
  const finalB = Math.round(baseB * (1 - tintIntensity) + b * tintIntensity)

  return { r: finalR, g: finalG, b: finalB }
}

/**
 * Aplica as cores dinâmicas no documento CSS :root
 * @param {string} hexColor Ex: "#26C88F" ou "#3b82f6"
 * @param {number} tintStrength Grau de mistura no vidro de 0 a 100 (padrão 15)
 */
export function applyThemeColor(hexColor, tintStrength = 15) {
  if (!hexColor) return
  const { r, g, b } = hexToRgb(hexColor)
  const tintFactor = Math.max(0, Math.min(100, tintStrength)) / 100

  // Se tintFactor for 0, usamos o preto fosco puro original
  const blended = blendColorWithDark(r, g, b, tintFactor * 0.35)
  const blendedLight = blendColorWithDark(r, g, b, tintFactor * 0.45)

  // Variáveis calculadas
  const glassBg = `rgba(${blended.r}, ${blended.g}, ${blended.b}, 0.88)`
  const glassBgLight = `rgba(${blendedLight.r}, ${blendedLight.g}, ${blendedLight.b}, 0.72)`
  const glassBorder = `rgba(${r}, ${g}, ${b}, ${0.12 + tintFactor * 0.18})`
  const glassBorderHover = `rgba(${r}, ${g}, ${b}, ${0.35 + tintFactor * 0.25})`
  const glassShadow = `0 14px 44px rgba(0, 0, 0, 0.72), 0 0 20px rgba(${r}, ${g}, ${b}, ${tintFactor * 0.12})`
  const accentColor = hexColor
  const accentDim = `rgba(${r}, ${g}, ${b}, 0.75)`
  const accentGlow = `0 0 16px rgba(${r}, ${g}, ${b}, 0.25)`

  const root = document.documentElement

  root.style.setProperty('--glass-bg', glassBg)
  root.style.setProperty('--glass-bg-light', glassBgLight)
  root.style.setProperty('--glass-border', glassBorder)
  root.style.setProperty('--glass-border-hover', glassBorderHover)
  root.style.setProperty('--glass-shadow', glassShadow)
  root.style.setProperty('--accent', accentColor)
  root.style.setProperty('--accent-dim', accentDim)
  root.style.setProperty('--accent-glow', accentGlow)
  root.style.setProperty('--theme-rgb', `${r}, ${g}, ${b}`)
  root.style.setProperty('--theme-tint-intensity', String(tintFactor))

  // Salvar no localStorage
  localStorage.setItem('zz_theme_color', hexColor)
  localStorage.setItem('zz_theme_tint', String(tintStrength))

  // Notificar outros componentes
  window.dispatchEvent(new CustomEvent('theme_color_change', {
    detail: { color: hexColor, tint: tintStrength, r, g, b }
  }))
}

/**
 * Reseta o tema para o padrão original de fábrica
 */
export function resetThemeToDefault() {
  localStorage.removeItem('zz_theme_color')
  localStorage.removeItem('zz_theme_tint')

  const root = document.documentElement
  root.style.removeProperty('--glass-bg')
  root.style.removeProperty('--glass-bg-light')
  root.style.removeProperty('--glass-border')
  root.style.removeProperty('--glass-border-hover')
  root.style.removeProperty('--glass-shadow')
  root.style.removeProperty('--accent')
  root.style.removeProperty('--accent-dim')
  root.style.removeProperty('--accent-glow')
  root.style.removeProperty('--theme-rgb')
  root.style.removeProperty('--theme-tint-intensity')

  window.dispatchEvent(new CustomEvent('theme_color_change', {
    detail: { color: '#f3f4f6', tint: 0, r: 243, g: 244, b: 246 }
  }))
}

/**
 * Inicializa o tema ao carregar a página
 */
export function initTheme() {
  const savedColor = localStorage.getItem('zz_theme_color')
  const savedTint = localStorage.getItem('zz_theme_tint')
  if (savedColor) {
    applyThemeColor(savedColor, savedTint ? Number(savedTint) : 15)
  }
}
