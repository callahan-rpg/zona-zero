/**
 * Utilitários para áudio ambiente do YouTube
 */

export function extractYouTubeId(url) {
  if (!url || typeof url !== 'string') return null
  const clean = url.trim()
  
  // Se for apenas o ID de 11 caracteres
  if (/^[a-zA-Z0-9_-]{11}$/.test(clean)) {
    return clean
  }

  // Padrões de URL do YouTube:
  // https://www.youtube.com/watch?v=VIDEO_ID
  // https://youtu.be/VIDEO_ID
  // https://www.youtube.com/embed/VIDEO_ID
  // https://www.youtube.com/v/VIDEO_ID
  // https://www.youtube.com/live/VIDEO_ID
  const patterns = [
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/live\/)([^"&?\/\s]{11})/i
  ]

  for (const pattern of patterns) {
    const match = clean.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }

  return null
}

export const DEFAULT_WEATHER_SOUNDS = {
  rainy: {
    outdoor: 'https://www.youtube.com/watch?v=mPZkdNFkNps', // Chuva externa
    indoor: 'https://www.youtube.com/watch?v=q76bMs-NwRk',  // Chuva ouvida de dentro
  },
  storm: {
    outdoor: 'https://www.youtube.com/watch?v=nDq6TstdEi8', // Tempestade externa com trovões
    indoor: 'https://www.youtube.com/watch?v=5qap5aO4i9A',  // Tempestade ouvida de dentro
  },
  snowy: {
    outdoor: 'https://www.youtube.com/watch?v=vz91359zkHg', // Vento e nevasca externa
    indoor: 'https://www.youtube.com/watch?v=7X8II6J-6mU',  // Nevasca ouvida de dentro
  },
  foggy: {
    outdoor: 'https://www.youtube.com/watch?v=bvqH4aG_a7M', // Vento e névoa ambiente
    indoor: '',
  },
  sunny: {
    outdoor: '',
    indoor: '',
  },
  cloudy: {
    outdoor: '',
    indoor: '',
  }
}
