/**
 * Utilitário para upload gratuito de imagens direto do navegador
 * Suporta ImgBB (com fallback para conversão Base64 / URL direta)
 */

// Chave pública gratuita para ImgBB API (permite upload direto de imagens)
const IMGBB_API_KEY = '6d207e02198a847aa98d0a2a901485a5' // ImgBB free upload API key

/**
 * Faz upload de um arquivo de imagem (File) e retorna a URL direta da imagem hospedada.
 * Se houver erro de rede, comprime em DataURL Base64 para não travar o fluxo.
 */
export async function uploadImageFree(file) {
  if (!file) throw new Error('Nenhum arquivo fornecido.')

  // Validação simples de tipo
  if (!file.type.startsWith('image/')) {
    throw new Error('O arquivo selecionado deve ser uma imagem válida (PNG, JPG, WEBP, GIF, SVG).')
  }

  // Tenta upload via ImgBB
  try {
    const formData = new FormData()
    formData.append('image', file)

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
      method: 'POST',
      body: formData
    })

    const data = await response.json()

    if (data && data.success && data.data && (data.data.display_url || data.data.url)) {
      return data.data.display_url || data.data.url
    }
  } catch (err) {
    console.warn('Upload ImgBB falhou, convertendo para Base64 local:', err)
  }

  // Fallback seguro: converte para Base64 se a API remota estiver inacessível
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = (error) => reject(error)
    reader.readAsDataURL(file)
  })
}
