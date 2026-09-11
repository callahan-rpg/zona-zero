/**
 * Utilitário para upload de imagens utilizando o Cloudinary (Unsigned Preset).
 */

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'z3cr8lix'
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'zona_zero'

/**
 * Faz upload de um arquivo de imagem (File) ou string Base64 e retorna a URL direta hospedada no Cloudinary.
 * 
 * @param {File|string} fileOrBase64 - Arquivo de imagem selecionado ou string Base64 (data:image/...)
 * @returns {Promise<string>} URL segura HTTPS do Cloudinary
 */
export async function uploadImageFree(fileOrBase64) {
  if (!fileOrBase64) throw new Error('Nenhum arquivo fornecido.')

  // Se for arquivo File, valida tipo de imagem
  if (fileOrBase64 instanceof File && !fileOrBase64.type.startsWith('image/')) {
    throw new Error('O arquivo selecionado deve ser uma imagem válida (PNG, JPG, WEBP, GIF, SVG).')
  }

  const formData = new FormData()
  formData.append('file', fileOrBase64)
  formData.append('upload_preset', UPLOAD_PRESET)

  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: formData
  })

  const data = await response.json()

  if (response.ok && data.secure_url) {
    return data.secure_url
  } else {
    console.error('Erro na resposta do Cloudinary:', data)
    throw new Error(data.error?.message || 'Falha ao processar upload no Cloudinary.')
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
