/**
 * Utilitário para upload de imagens.
 * 
 * ARQUITETURA HÍBRIDA ROBUSTA:
 * 1. Tenta primeiramente a API do servidor (/api/upload).
 * 2. Se a rota /api/upload falhar (ex: deploy em host estático, estouro de payload 4.5MB da Vercel,
 *    instabilidade temporária de serverless ou ambiente local), aciona automaticamente o fallback
 *    direto ao Cloudinary via endpoint não-assinado (Unsigned Upload Preset).
 * 3. Faz compressão inteligente no cliente antes do envio para economizar banda e acelerar o upload.
 */

import { auth } from '../firebase/config'

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'z3cr8lix'
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'zona_zero'

/**
 * Converte um File ou Blob para Base64 Data URL.
 */
function fileToDataUrl(fileOrBlob) {
  return new Promise((resolve, reject) => {
    if (typeof fileOrBlob === 'string') return resolve(fileOrBlob)
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = (err) => reject(err)
    reader.readAsDataURL(fileOrBlob)
  })
}

/**
 * Redimensiona e otimiza imagens grandes no cliente antes do envio.
 */
async function compressImageClientSide(fileOrBase64, maxWidth = 1920, maxHeight = 1080, quality = 0.85) {
  if (fileOrBase64 instanceof File && (fileOrBase64.type === 'image/svg+xml' || fileOrBase64.type === 'image/gif')) {
    return fileOrBase64
  }
  if (typeof fileOrBase64 === 'string' && (fileOrBase64.startsWith('data:image/svg') || fileOrBase64.startsWith('data:image/gif'))) {
    return fileOrBase64
  }

  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      let { width, height } = img

      if (width <= maxWidth && height <= maxHeight && (fileOrBase64.size && fileOrBase64.size < 400 * 1024)) {
        return resolve(fileOrBase64)
      }

      if (width > maxWidth || height > maxHeight) {
        if (width / height > maxWidth / maxHeight) {
          height = Math.round((height * maxWidth) / width)
          width = maxWidth
        } else {
          width = Math.round((width * maxHeight) / height)
          height = maxHeight
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob)
        } else {
          resolve(fileOrBase64)
        }
      }, 'image/webp', quality)
    }

    img.onerror = () => resolve(fileOrBase64)

    if (fileOrBase64 instanceof File || fileOrBase64 instanceof Blob) {
      img.src = URL.createObjectURL(fileOrBase64)
    } else {
      img.src = fileOrBase64
    }
  })
}

/**
 * Fallback direto ao Cloudinary (Unsigned Upload Preset).
 */
async function uploadDirectToCloudinary(fileOrBase64) {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    throw new Error('Configuração do Cloudinary ausente.')
  }

  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`

  // Envio via FormData binário (se File/Blob) ou JSON (se string base64)
  if (fileOrBase64 instanceof File || fileOrBase64 instanceof Blob) {
    const formData = new FormData()
    formData.append('file', fileOrBase64)
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET)

    const res = await fetch(endpoint, {
      method: 'POST',
      body: formData,
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.secure_url) {
      throw new Error(data.error?.message || 'Falha no upload direto ao Cloudinary.')
    }
    return data.secure_url
  } else {
    const dataUrl = await fileToDataUrl(fileOrBase64)
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file: dataUrl,
        upload_preset: CLOUDINARY_UPLOAD_PRESET,
      }),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.secure_url) {
      throw new Error(data.error?.message || 'Falha no upload direto ao Cloudinary.')
    }
    return data.secure_url
  }
}

/**
 * Envia imagem para hospedagem na nuvem.
 * Tenta a API segura do servidor (/api/upload), e caso indisponível,
 * usa o fallback transparente direto para o Cloudinary.
 * 
 * @param {File|Blob|string} fileOrBase64
 * @param {number} maxRetries
 * @returns {Promise<string>} URL HTTPS da imagem hospedada
 */
export async function uploadImageFree(fileOrBase64, maxRetries = 2) {
  if (!fileOrBase64) throw new Error('Nenhum arquivo fornecido.')

  if (fileOrBase64 instanceof File && !fileOrBase64.type.startsWith('image/')) {
    throw new Error('O arquivo selecionado deve ser uma imagem válida (PNG, JPG, WEBP, GIF, SVG).')
  }

  // 1. Otimiza no cliente
  const payloadFile = await compressImageClientSide(fileOrBase64)
  const dataUrl = await fileToDataUrl(payloadFile)

  // 2. Token de autenticação para proteção de cota se houver backend
  const idToken = auth?.currentUser ? await auth.currentUser.getIdToken().catch(() => '') : ''

  // 3. Tentativa 1: Endpoint de API local/serverless
  try {
    const headers = { 'Content-Type': 'application/json' }
    if (idToken) headers['Authorization'] = `Bearer ${idToken}`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 12000)

    const response = await fetch('/api/upload', {
      method: 'POST',
      headers,
      body: JSON.stringify({ file: dataUrl }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (response.ok) {
      const data = await response.json().catch(() => null)
      if (data && data.url) {
        return data.url
      }
    } else {
      console.warn(`[Upload] /api/upload respondeu status ${response.status}. Ativando fallback Cloudinary direto...`)
    }
  } catch (err) {
    console.warn('[Upload] /api/upload inacessível ou falhou:', err.message, '- Usando fallback Cloudinary direto...')
  }

  // 4. Tentativa 2: Fallback direto Cloudinary (com tentativas)
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const directUrl = await uploadDirectToCloudinary(payloadFile)
      if (directUrl) return directUrl
    } catch (directErr) {
      console.warn(`[Upload Cloudinary] Tentativa ${attempt} falhou:`, directErr.message)
      if (attempt >= maxRetries) {
        throw new Error(`Erro no upload: ${directErr.message}`)
      }
      await new Promise((r) => setTimeout(r, 1500 * attempt))
    }
  }

  throw new Error('Falha ao processar upload da imagem.')
}

/**
 * Converte base64 para URL hospedada através do Cloudinary.
 */
export async function uploadBase64ToCloudinary(base64String) {
  if (!base64String || typeof base64String !== 'string' || !base64String.startsWith('data:image')) {
    return base64String
  }
  return await uploadImageFree(base64String)
}
