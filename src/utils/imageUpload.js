/**
 * Utilitário para upload de imagens utilizando o Cloudinary (Unsigned Preset).
 * Inclui auto-compressão para evitar exceder limite de processamento e retentativa com backoff.
 */

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'z3cr8lix'
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'zona_zero'

/**
 * Redimensiona e otimiza imagens grandes no cliente antes do upload.
 * Reduz enormemente o consumo de capacidade/CPU do Cloudinary.
 */
async function compressImageClientSide(fileOrBase64, maxWidth = 1920, maxHeight = 1080, quality = 0.85) {
  // Se for SVG ou GIF animado, não passa por canvas para preservar animação/vetor
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

      // Se já for pequena, mantém
      if (width <= maxWidth && height <= maxHeight && (fileOrBase64.size && fileOrBase64.size < 500 * 1024)) {
        return resolve(fileOrBase64)
      }

      // Calcula proporção
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

      // Converte para blob WebP ou JPEG
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob)
        } else {
          resolve(fileOrBase64)
        }
      }, 'image/webp', quality)
    }

    img.onerror = () => resolve(fileOrBase64)

    if (fileOrBase64 instanceof File) {
      img.src = URL.createObjectURL(fileOrBase64)
    } else {
      img.src = fileOrBase64
    }
  })
}

/**
 * Faz upload de um arquivo de imagem (File) ou string Base64 e retorna a URL direta hospedada no Cloudinary.
 * Contém retentativas automáticas caso a conta receba "Slow Down / Capacity".
 * 
 * @param {File|string} fileOrBase64 - Arquivo de imagem selecionado ou string Base64
 * @param {number} maxRetries - Número de tentativas em caso de erro 429
 * @returns {Promise<string>} URL segura HTTPS do Cloudinary
 */
export async function uploadImageFree(fileOrBase64, maxRetries = 3) {
  if (!fileOrBase64) throw new Error('Nenhum arquivo fornecido.')

  // Valida tipo de imagem
  if (fileOrBase64 instanceof File && !fileOrBase64.type.startsWith('image/')) {
    throw new Error('O arquivo selecionado deve ser uma imagem válida (PNG, JPG, WEBP, GIF, SVG).')
  }

  // Comprime levemente antes do upload para evitar sobrecarga de processamento no Cloudinary
  const payloadFile = await compressImageClientSide(fileOrBase64)

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const formData = new FormData()
      formData.append('file', payloadFile)
      formData.append('upload_preset', UPLOAD_PRESET)

      const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (response.ok && data.secure_url) {
        return data.secure_url
      }

      const errMsg = data.error?.message || ''

      // Se for limite de capacidade / 429 / rate limit, aguarda e tenta novamente
      if (response.status === 429 || errMsg.toLowerCase().includes('capacity') || errMsg.toLowerCase().includes('slow down')) {
        if (attempt < maxRetries) {
          const waitTime = attempt * 2000 // 2s, 4s...
          console.warn(`Cloudinary capacidade temporariamente cheia. Tentando novamente em ${waitTime / 1000}s... (Tentativa ${attempt}/${maxRetries})`)
          await new Promise(r => setTimeout(r, waitTime))
          continue
        }
      }

      console.error('Erro na resposta do Cloudinary:', data)
      throw new Error(errMsg || 'Falha ao processar upload no Cloudinary.')
    } catch (err) {
      if (attempt >= maxRetries) {
        throw err
      }
      const waitTime = attempt * 2000
      await new Promise(r => setTimeout(r, waitTime))
    }
  }
}

/**
 * Utilitário para converter uma imagem existente em Base64 para uma URL do Cloudinary.
 * @param {string} base64String 
 * @returns {Promise<string>}
 */
export async function uploadBase64ToCloudinary(base64String) {
  if (!base64String || typeof base64String !== 'string' || !base64String.startsWith('data:image')) {
    return base64String
  }
  return await uploadImageFree(base64String)
}
