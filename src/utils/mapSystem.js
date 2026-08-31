/**
 * mapSystem.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Utilitários matemáticos para o sistema de mapa em 2 níveis (País & Cidades).
 * 
 * Modelo:
 *   - Imagem de fundo em container com aspect-ratio e coordenadas percentuais (0-100%).
 *   - Pan e zoom aplicados via CSS transform (translate3d + scale) acelerado por GPU.
 *   - Zoom exponencial multiplicativo centrado no ponteiro do mouse (sem drift).
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const ZOOM_MIN = 0.65
export const ZOOM_MAX = 3.5
export const ZOOM_INITIAL = 0.90
export const ZOOM_FACTOR_IN = 1.15
export const ZOOM_FACTOR_OUT = 0.87

/** Estado inicial da câmera */
export function initialCamera() {
  return { zoom: ZOOM_INITIAL, panX: 0, panY: 0 }
}

/**
 * Calcula o transform CSS para aplicar no container da imagem do mapa.
 */
export function cameraToTransform(camera) {
  return `translate3d(${camera.panX}px, ${camera.panY}px, 0) scale(${camera.zoom})`
}

/**
 * Aplica transform diretamente no elemento DOM (60fps constante sem re-render).
 */
export function applyTransform(el, cam) {
  if (!el) return
  el.style.transform = cameraToTransform(cam)
}

/**
 * Calcula novo pan/zoom mantendo o ponto exato sob o cursor do mouse.
 */
export function zoomAtPoint(cam, delta, cx, cy, rect, frameRect) {
  const oldZoom = cam.zoom
  const factor = delta > 0 ? ZOOM_FACTOR_IN : ZOOM_FACTOR_OUT
  const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, oldZoom * factor))
  if (Math.abs(newZoom - oldZoom) < 0.001) return cam

  const mouseX = cx - rect.left
  const mouseY = cy - rect.top

  // Ponto relativo no mapa antes do zoom
  const mapX = (mouseX - cam.panX) / oldZoom
  const mapY = (mouseY - cam.panY) / oldZoom

  // Novo pan mantendo o ponto no cursor
  const newPanX = mouseX - mapX * newZoom
  const newPanY = mouseY - mapY * newZoom

  return clampPan({ zoom: newZoom, panX: newPanX, panY: newPanY }, rect, frameRect)
}

/**
 * Trava os limites do pan para que o mapa não saia completamente da tela.
 */
export function clampPan(cam, rect, frameRect) {
  const containerW = rect.width
  const containerH = rect.height
  const frameW = (frameRect?.width || containerW) * cam.zoom
  const frameH = (frameRect?.height || containerH) * cam.zoom

  const minPanX = Math.min(0, containerW - frameW)
  const maxPanX = Math.max(0, (containerW - frameW) / 2)
  const minPanY = Math.min(0, containerH - frameH)
  const maxPanY = Math.max(0, (containerH - frameH) / 2)

  return {
    ...cam,
    panX: Math.min(maxPanX + 150, Math.max(minPanX - 150, cam.panX)),
    panY: Math.min(maxPanY + 150, Math.max(minPanY - 150, cam.panY)),
  }
}

/**
 * Suaviza a transição de câmera (lerp).
 */
export function lerpCamera(current, target, factor = 0.14) {
  return {
    zoom: current.zoom + (target.zoom - current.zoom) * factor,
    panX: current.panX + (target.panX - current.panX) * factor,
    panY: current.panY + (target.panY - current.panY) * factor,
  }
}

/**
 * Verifica se a câmera atingiu o alvo.
 */
export function cameraReached(current, target, threshold = 0.5) {
  return (
    Math.abs(current.zoom - target.zoom) < 0.01 &&
    Math.abs(current.panX - target.panX) < threshold &&
    Math.abs(current.panY - target.panY) < threshold
  )
}
