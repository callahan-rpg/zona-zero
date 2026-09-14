/**
 * Utilitário para upload de imagens.
 * ARQUITETURA SEGURA: O navegador chama exclusivamente a API interna (/api/upload).
 * Nenhuma chave, credencial ou preset do Cloudinary fica exposto no bundle do cliente.
 */

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
 * Redimensiona e otimiza imagens grandes no cliente antes do envio para a API.
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

      if (width <= maxWidth && height <= maxHeight && (fileOrBase64.size && fileOrBase64.size < 500 * 1024)) {
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

    if (fileOrBase64 instanceof File) {
      img.src = URL.createObjectURL(fileOrBase64)
    } else {
      img.src = fileOrBase64
    }
  })
}

/**
 * Envia o arquivo de imagem para o backend seguro (/api/upload).
 * 
 * @param {File|string} fileOrBase64 - Arquivo ou string Base64
 * @param {number} maxRetries - Tentativas em caso de instabilidade
 * @returns {Promise<string>} URL segura da imagem hospedada
 */
export async function uploadImageFree(fileOrBase64, maxRetries = 3) {
  if (!fileOrBase64) throw new Error('Nenhum arquivo fornecido.')

  if (fileOrBase64 instanceof File && !fileOrBase64.type.startsWith('image/')) {
    throw new Error('O arquivo selecionado deve ser uma imagem válida (PNG, JPG, WEBP, GIF, SVG).')
  }

  const payloadFile = await compressImageClientSide(fileOrBase64)
  const dataUrl = await fileToDataUrl(payloadFile)

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ file: dataUrl }),
      })

      const data = await response.json().catch(() => ({}))

      if (response.ok && data.url) {
        return data.url
      }

      const errMsg = data.error || 'Falha ao processar upload no servidor.'

      if (response.status === 429 || errMsg.toLowerCase().includes('capacity') || errMsg.toLowerCase().includes('slow down')) {
        if (attempt < maxRetries) {
          const waitTime = attempt * 2000
          console.warn(`Capacidade temporariamente cheia. Tentando novamente em ${waitTime / 1000}s...`)
          await new Promise((r) => setTimeout(r, waitTime))
          continue
        }
      }

      throw new Error(errMsg)
    } catch (err) {
      if (attempt >= maxRetries) {
        throw err
      }
      const waitTime = attempt * 2000
      await new Promise((r) => setTimeout(r, waitTime))
    }
  }
}

/**
 * Converte base64 para URL hospedada através do backend.
 */
export async function uploadBase64ToCloudinary(base64String) {
  if (!base64String || typeof base64String !== 'string' || !base64String.startsWith('data:image')) {
    return base64String
  }
  return await uploadImageFree(base64String)
}
