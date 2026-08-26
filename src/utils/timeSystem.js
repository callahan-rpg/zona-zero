// Sistema de Cálculos de Tempo, Fases da Lua, Estações e Clima para o Zona Zero RPG
// Região: Leste Europeu (clima temperado continental / invernos rigorosos)

export const SEASONS = {
  spring: { id: 'spring', name: 'Primavera', icon: '🌱', desc: 'Descongelamento e clima instável. Zumbis ressurgem do gelo.' },
  summer: { id: 'summer', name: 'Verão', icon: '☀️', desc: 'Dias longos e quentes. Risco de desidratação e tempestades repentinas.' },
  autumn: { id: 'autumn', name: 'Outono', icon: '🍂', desc: 'Ventos frios, névoa espessa e folhas mortas. Visibilidade reduzida.' },
  winter: { id: 'winter', name: 'Inverno', icon: '❄️', desc: 'Frio extremo e nevascas. Hordas lentas, mas sobrevivência crítica.' }
}

export const MOON_PHASES = [
  { id: 'new', name: 'Lua Nova', icon: '🌑', zombieEffect: 'Escuridão quase total. Visão de zumbis reduzida, mas emboscadas são letais.' },
  { id: 'waxing_crescent', name: 'Lua Crescente', icon: '🌒', zombieEffect: 'Pouca luz noturna. Atividade moderada de infectados.' },
  { id: 'first_quarter', name: 'Quarto Crescente', icon: '🌓', zombieEffect: 'Luz moderada. Comportamento padrão de patrulha das hordas.' },
  { id: 'waxing_gibbous', name: 'Gibosa Crescente', icon: '🌔', zombieEffect: 'Noite iluminada. Zumbis começam a se agrupar e uivar.' },
  { id: 'full', name: 'Lua Cheia', icon: '🌕', zombieEffect: '⚠️ FRENESI LUNAR: Zumbis ficam altamente agressivos, velozes e atraídos pela luz.' },
  { id: 'waning_gibbous', name: 'Gibosa Minguante', icon: '🌖', zombieEffect: 'Alta visibilidade. Infectados dispersando lentamente após o frenesi.' },
  { id: 'last_quarter', name: 'Quarto Minguante', icon: '🌗', zombieEffect: 'Luz moderada. Zumbis em estado de descanso e lentidão.' },
  { id: 'waning_crescent', name: 'Lua Minguante', icon: '🌘', zombieEffect: 'Noites silenciosas e escuras. Menor movimentação nas ruas.' }
]

export const MONTHS = [
  { name: 'Janeiro', days: 31, season: 'winter' },
  { name: 'Fevereiro', days: 28, season: 'winter' },
  { name: 'Março', days: 31, season: 'spring' },
  { name: 'Abril', days: 30, season: 'spring' },
  { name: 'Maio', days: 31, season: 'spring' },
  { name: 'Junho', days: 30, season: 'summer' },
  { name: 'Julho', days: 31, season: 'summer' },
  { name: 'Agosto', days: 31, season: 'summer' },
  { name: 'Setembro', days: 30, season: 'autumn' },
  { name: 'Outubro', days: 31, season: 'autumn' },
  { name: 'Novembro', days: 30, season: 'autumn' },
  { name: 'Dezembro', days: 31, season: 'winter' }
]

/**
 * Calcula a data e hora in-game atuais.
 * Regra: 1 dia no jogo = 12 horas reais (speedRatio = 2.0).
 *
 * @param {Object} config - Configurações do jogo do Firestore
 * @returns {Object} Dados completos de tempo, data, estação e lua
 */
export function calculateGameTime(config) {
  // Config padrão se não existir no Firestore
  const baseEpochMs = config?.time?.baseEpochMs || new Date('2026-08-26T00:00:00Z').getTime()
  const baseYear = config?.time?.baseYear || 2026
  const baseMonth = config?.time?.baseMonth || 8 // 1-indexed (8 = Agosto)
  const baseDay = config?.time?.baseDay || 26
  const baseHour = config?.time?.baseHour ?? 12
  const baseMinute = config?.time?.baseMinute ?? 0
  const isDynamic = config?.time?.mode !== 'manual'

  if (!isDynamic) {
    // Modo Manual
    const manualVal = config?.time?.value || '12:00'
    const manualPeriod = config?.time?.period || 'day'
    const manualSeason = config?.time?.season || 'summer'
    const manualMoon = config?.time?.moonPhase || 'full'
    const currentSeason = SEASONS[manualSeason] || SEASONS.summer
    const currentMoon = MOON_PHASES.find(m => m.id === manualMoon) || MOON_PHASES[4]
    
    return {
      isDynamic: false,
      timeString: manualVal,
      hour: parseInt(manualVal.split(':')[0] || '12', 10),
      minute: parseInt(manualVal.split(':')[1] || '00', 10),
      period: manualPeriod,
      day: baseDay,
      month: baseMonth,
      monthName: MONTHS[baseMonth - 1]?.name || 'Agosto',
      year: baseYear,
      season: currentSeason,
      moonPhase: currentMoon,
      formattedDate: `${String(baseDay).padStart(2, '0')} de ${MONTHS[baseMonth - 1]?.name || 'Agosto'}, ${baseYear}`
    }
  }

  // Modo Dinâmico: 1 dia in-game (86400s) = 12h reais (43200s) -> Multiplicador 2x
  const nowMs = Date.now()
  const elapsedRealMs = Math.max(0, nowMs - baseEpochMs)
  const elapsedGameMs = elapsedRealMs * 2

  // Cria a data in-game base inicial
  // Note que baseMonth é 1-indexed
  const baseGameDate = new Date(Date.UTC(baseYear, baseMonth - 1, baseDay, baseHour, baseMinute, 0))
  const currentGameDate = new Date(baseGameDate.getTime() + elapsedGameMs)

  const hour = currentGameDate.getUTCHours()
  const minute = currentGameDate.getUTCMinutes()
  const day = currentGameDate.getUTCDate()
  const monthIdx = currentGameDate.getUTCMonth() // 0 to 11
  const month = monthIdx + 1
  const year = currentGameDate.getUTCFullYear()

  const timeString = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  const isDay = hour >= 6 && hour < 19
  const period = isDay ? 'day' : 'night'

  // Determinar Estação do Ano pelo mês (Leste Europeu / Hemisfério Norte)
  const monthSeasonId = MONTHS[monthIdx]?.season || 'summer'
  const season = SEASONS[config?.time?.seasonOverride || monthSeasonId] || SEASONS.summer

  // Determinar Fase da Lua
  // Ciclo sinódico lunar ~ 29.53 dias in-game
  // Calculamos a partir dos dias in-game transcorridos
  const daysSinceEpoch = (currentGameDate.getTime() - new Date(Date.UTC(2026, 0, 1)).getTime()) / (1000 * 60 * 60 * 24)
  const cyclePosition = (daysSinceEpoch % 29.53058867) / 29.53058867
  const moonIndex = Math.floor(cyclePosition * 8) % 8
  const moonPhase = config?.time?.moonOverride
    ? (MOON_PHASES.find(m => m.id === config.time.moonOverride) || MOON_PHASES[moonIndex])
    : MOON_PHASES[moonIndex]

  return {
    isDynamic: true,
    timeString,
    hour,
    minute,
    period,
    day,
    month,
    monthName: MONTHS[monthIdx]?.name || 'Janeiro',
    year,
    season,
    moonPhase,
    formattedDate: `${String(day).padStart(2, '0')} de ${MONTHS[monthIdx]?.name}, ${year}`
  }
}

/**
 * Gera o clima dinâmico baseado na Região (Leste Europeu), Estação e Período (dia/noite).
 * 
 * @param {Object} config - Configurações do Firestore
 * @param {Object} gameTime - Resultado de calculateGameTime
 * @returns {Object} Dados do clima (condição, temperatura, ícone, rótulo)
 */
export function getDynamicWeather(config, gameTime) {
  // Se o admin tiver forçado um clima fixo em modo manual
  if (config?.weather?.mode === 'manual' && config?.weather?.condition) {
    return {
      condition: config.weather.condition,
      temperature: config.weather.temperature ?? 20,
      label: config.weather.label || 'Personalizado',
      icon: config.weather.icon || '☀️',
      region: 'Leste Europeu',
      mode: 'manual'
    }
  }

  const seasonId = gameTime.season.id
  const isNight = gameTime.period === 'night'
  const hour = gameTime.hour

  // Seed temporal com base no dia e bloco de 4 horas in-game para manter estabilidade durante o dia
  const timeBlock = Math.floor(hour / 4)
  const seed = (gameTime.year * 366 + gameTime.month * 31 + gameTime.day) * 10 + timeBlock

  // Pseudo-random consistente para a janela de horas
  const pseudoRand = (Math.sin(seed * 999.123) + 1) / 2

  let condition = 'sunny'
  let label = 'Ensolarado'
  let icon = '☀️'
  let baseTemp = 15

  if (seasonId === 'winter') {
    // Inverno no Leste Europeu: -15°C a 2°C, neve frequente, tempestades de neve e neblina gélida
    baseTemp = Math.round(-12 + pseudoRand * 14) // -12 a +2°C
    if (isNight) baseTemp -= 4

    if (pseudoRand < 0.40) {
      condition = 'snowy'
      label = 'Nevando'
      icon = '❄️'
    } else if (pseudoRand < 0.65) {
      condition = 'cloudy'
      label = 'Céu Nublado e Gélido'
      icon = '☁️'
    } else if (pseudoRand < 0.85) {
      condition = 'foggy'
      label = 'Névoa Congelante'
      icon = '🌫️'
    } else {
      condition = isNight ? 'clear_night' : 'sunny'
      label = isNight ? 'Noite Gélida e Estrelada' : 'Sol Pálido de Inverno'
      icon = isNight ? '🌙' : '☀️'
    }
  } else if (seasonId === 'summer') {
    // Verão no Leste Europeu: 18°C a 32°C, ensolarado, tempestades térmicas
    baseTemp = Math.round(18 + pseudoRand * 14) // 18 a 32°C
    if (isNight) baseTemp -= 6

    if (pseudoRand < 0.50) {
      condition = isNight ? 'clear_night' : 'sunny'
      label = isNight ? 'Noite Quente e Limpa' : 'Ensolarado e Quente'
      icon = isNight ? '🌙' : '☀️'
    } else if (pseudoRand < 0.70) {
      condition = 'cloudy'
      label = 'Parcialmente Nublado'
      icon = '⛅'
    } else if (pseudoRand < 0.88) {
      condition = 'rainy'
      label = 'Chuva de Verão'
      icon = '🌧️'
    } else {
      condition = 'storm'
      label = 'Tempestade de Raios'
      icon = '⛈️'
    }
  } else if (seasonId === 'autumn') {
    // Outono no Leste Europeu: 3°C a 16°C, neblina espessa, chuvas frias constantes
    baseTemp = Math.round(4 + pseudoRand * 12)
    if (isNight) baseTemp -= 4

    if (pseudoRand < 0.35) {
      condition = 'foggy'
      label = 'Neblina Densa'
      icon = '🌫️'
    } else if (pseudoRand < 0.65) {
      condition = 'rainy'
      label = 'Chuva Fria e Constante'
      icon = '🌧️'
    } else if (pseudoRand < 0.85) {
      condition = 'cloudy'
      label = 'Céu Cinzento e Encoberto'
      icon = '☁️'
    } else {
      condition = 'storm'
      label = 'Vendaval e Chuva Forte'
      icon = '⛈️'
    }
  } else {
    // Primavera no Leste Europeu: 8°C a 19°C, dias amenos, chuvas e degelo
    baseTemp = Math.round(8 + pseudoRand * 11)
    if (isNight) baseTemp -= 5

    if (pseudoRand < 0.40) {
      condition = 'sunny'
      label = 'Ameno e Ensolarado'
      icon = '☀️'
    } else if (pseudoRand < 0.70) {
      condition = 'cloudy'
      label = 'Nublado'
      icon = '⛅'
    } else {
      condition = 'rainy'
      label = 'Chuva de Primavera'
      icon = '🌧️'
    }
  }

  return {
    condition,
    temperature: baseTemp,
    label,
    icon,
    region: 'Leste Europeu',
    mode: 'dynamic'
  }
}
