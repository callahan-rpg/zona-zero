/**
 * Utilitário para upload de imagens utilizando o Cloudinary (Unsigned Preset).
 * Mantém fallback para Base64 local caso ocorra algum problema de rede.
 */

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'z3cr8lix'
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'zona_zero'

/**
 * Faz upload de um arquivo de imagem (File) e retorna a URL direta hospedada no Cloudinary.
 * Se houver erro de rede, converte em DataURL Base64 como fallback seguro.
 * 
 * @param {File} file - Arquivo de imagem selecionado
 * @returns {Promise<string>} URL segura HTTPS do Cloudinary ou DataURL Base64
 */
export async function uploadImageFree(file) {
  if (!file) throw new Error('Nenhum arquivo fornecido.')

  // Validação simples de tipo
  if (!file.type.startsWith('image/')) {
    throw new Error('O arquivo selecionado deve ser uma imagem válida (PNG, JPG, WEBP, GIF, SVG).')
  }

  // Tenta upload via Cloudinary
  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('upload_preset', UPLOAD_PRESET)

    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
      method: 'POST',
      body: formData
    })

    const data = await response.json()

    if (response.ok && data.secure_url) {
      return data.secure_url
    } else {
      console.warn('Erro na resposta do Cloudinary:', data)
      throw new Error(data.error?.message || 'Falha ao processar upload no Cloudinary.')
    }
  } catch (err) {
    console.warn('Upload Cloudinary falhou, convertendo para Base64 local como fallback:', err)
  }

  // Fallback seguro: converte para Base64 se a API remota estiver inacessível
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = (error) => reject(error)
    reader.readAsDataURL(file)
  })
}
