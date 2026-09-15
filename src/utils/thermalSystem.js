/**
 * thermalSystem.js
 * Sistema de Cálculo de Condição Térmica, Exposição ao Frio e Proteção Ambiental.
 * Zona Zero RPG
 *
 * Integra:
 * - Clima dinâmico (temperatura, chuva, tempestade, neve)
 * - Ambiente da locação (isIndoor)
 * - Roupas equipadas (totalInsulation)
 * - Duração da exposição ativa
 */

export const THERMAL_TIERS = {
  protected: {
    id: 'protected',
    label: 'Abrigo Protegido',
    description: 'Você está em um ambiente interno seguro, protegido de ventos frios e chuvas.',
    color: '#4ade80',
    icon: '🏠',
    exposureDeltaPerMin: -1.2, // Dissipa exposição ao frio
  },
  comfortable: {
    id: 'comfortable',
    label: 'Confortável',
    description: 'A temperatura corporal está em equilíbrio agradável.',
    color: '#34d399',
    icon: '🌡️',
    exposureDeltaPerMin: -0.8, // Dissipa exposição
  },
  mild_cold: {
    id: 'mild_cold',
    label: 'Frio Leve',
    description: 'O vento frio começa a arrepiar a pele, mas a proteção atual ainda ameniza o impacto.',
    color: '#38bdf8',
    icon: '🧣',
    exposureDeltaPerMin: 0.35,
  },
  moderate_cold: {
    id: 'moderate_cold',
    label: 'Frio Moderado',
    description: 'O frio penetra os tecidos das roupas. Você começa a tremer levemente.',
    color: '#60a5fa',
    icon: '🥶',
    exposureDeltaPerMin: 0.9,
  },
  severe_cold: {
    id: 'severe_cold',
    label: 'Frio Severo',
    description: 'Frio intenso e cortante. O corpo perde calor rapidamente e os membros ficam dormentes.',
    color: '#818cf8',
    icon: '❄️',
    exposureDeltaPerMin: 1.8,
  },
  extreme_cold: {
    id: 'extreme_cold',
    label: 'Exposição Extrema / Glacial',
    description: 'Frio extremo e congelante. Risco crítico de hipotermia grave e colapso respiratório.',
    color: '#c084fc',
    icon: '🧊',
    exposureDeltaPerMin: 3.2,
  },
}

/**
 * Calcula a condição térmica efetiva do sobrevivente.
 *
 * @param {Object} params
 * @param {number} params.weatherTemp - Temperatura externa em °C do timeSystem
 * @param {string} params.weatherCondition - Condição ('sunny', 'rainy', 'storm', 'snowy', etc.)
 * @param {boolean} params.isIndoor - Se o sobrevivente está em ambiente fechado
 * @param {number} params.totalInsulation - Soma do isolamento térmico das roupas equipadas
 * @returns {Object} Dados da condição térmica
 */
export function calculateEffectiveThermalCondition({
  weatherTemp = 20,
  weatherCondition = 'sunny',
  isIndoor = false,
  totalInsulation = 0,
}) {
  const rawTemp = Number(weatherTemp) || 0
  const insulation = Number(totalInsulation) || 0

  // 1. AMBIENTE INTERNO PROTEGIDO
  if (isIndoor) {
    // Em ambiente fechado, o frio externo é consideravelmente atenuado
    // Temperatura interna mínima de conforto em torno de 16°C a 20°C
    const bufferedIndoorTemp = Math.max(16, rawTemp + 10 + Math.floor(insulation * 0.5))
    const tier = THERMAL_TIERS.protected

    return {
      tierKey: 'protected',
      label: tier.label,
      description: tier.description,
      color: tier.color,
      icon: tier.icon,
      effectiveTemp: bufferedIndoorTemp,
      isIndoor: true,
      weatherCondition,
      isRaining: false,
      exposureDeltaPerMin: tier.exposureDeltaPerMin,
      wetnessPenalty: 0,
    }
  }

  // 2. AMBIENTE EXTERNO (AO AR LIVRE)
  // Penalidade de umidade por chuva, neve ou tempestade
  let wetnessPenalty = 0
  const isRaining = weatherCondition === 'rainy' || weatherCondition === 'storm'
  if (weatherCondition === 'storm') {
    wetnessPenalty = 6 // Tempestade encharca e resfria bruscamente
  } else if (weatherCondition === 'rainy') {
    wetnessPenalty = 3 // Chuva contínua
  } else if (weatherCondition === 'snowy') {
    wetnessPenalty = 4 // Neve acumulada
  }

  // Temperatura sentida = Externa + Isolamento das Roupas - Penalidade de Umidade
  const effectiveTemp = rawTemp + insulation - wetnessPenalty

  // Determina a faixa térmica
  let tierKey = 'comfortable'
  if (effectiveTemp < -6) {
    tierKey = 'extreme_cold'
  } else if (effectiveTemp < 3) {
    tierKey = 'severe_cold'
  } else if (effectiveTemp < 10) {
    tierKey = 'moderate_cold'
  } else if (effectiveTemp < 16) {
    tierKey = 'mild_cold'
  } else {
    tierKey = 'comfortable'
  }

  const tier = THERMAL_TIERS[tierKey] || THERMAL_TIERS.comfortable

  // Se estiver chovendo ou nevando ao ar livre, a velocidade de acúmulo de exposição aumenta
  let exposureMultiplier = 1.0
  if (weatherCondition === 'storm') exposureMultiplier = 1.8
  else if (weatherCondition === 'rainy') exposureMultiplier = 1.4
  else if (weatherCondition === 'snowy') exposureMultiplier = 1.5

  const exposureDeltaPerMin = tier.exposureDeltaPerMin > 0
    ? Number((tier.exposureDeltaPerMin * exposureMultiplier).toFixed(2))
    : tier.exposureDeltaPerMin

  return {
    tierKey,
    label: tier.label,
    description: tier.description,
    color: tier.color,
    icon: tier.icon,
    effectiveTemp,
    isIndoor: false,
    weatherCondition,
    isRaining,
    exposureDeltaPerMin,
    wetnessPenalty,
  }
}
