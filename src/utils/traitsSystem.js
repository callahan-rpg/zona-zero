// Sistema de Traços (Atributos) e Vantagens/Desvantagens (Mecânicas) - RPG Zona Zero

// 1. TRAÇOS DE ATRIBUTOS
export const TRAITS = {
  // --- CONSTITUIÇÃO ---
  em_forma: {
    id: 'em_forma',
    name: 'Em forma',
    type: 'positive',
    attrKey: 'constituicao',
    modifier: 3,
    icon: '🟢',
    summary: '+3 Constituição',
    description: 'Possui um corpo saudável e bem condicionado, apresentando boa resistência física e capacidade de suportar esforços prolongados sem se cansar facilmente.',
  },
  acima_do_peso: {
    id: 'acima_do_peso',
    name: 'Acima do Peso',
    type: 'negative',
    attrKey: 'constituicao',
    modifier: -3,
    icon: '🔴',
    summary: '-3 Constituição',
    description: 'Possui excesso de peso que interfere em sua resistência física. Esforços prolongados, corridas e atividades que exigem grande disposição física tendem a causar fadiga mais rapidamente.',
  },

  // --- DESTREZA ---
  atletico: {
    id: 'atletico',
    name: 'Atlético',
    type: 'positive',
    attrKey: 'destreza',
    modifier: 3,
    icon: '🟢',
    summary: '+3 Destreza',
    description: 'Possui excelente coordenação motora e domínio corporal. Seus movimentos são precisos, naturais e bem coordenados, permitindo executar tarefas físicas com maior facilidade.',
  },
  sedentario: {
    id: 'sedentario',
    name: 'Sedentário',
    type: 'negative',
    attrKey: 'destreza',
    modifier: -3,
    icon: '🔴',
    summary: '-3 Destreza',
    description: 'Está pouco acostumado a atividades físicas. Seus movimentos tendem a ser menos coordenados e tarefas que exigem precisão corporal podem se tornar mais difíceis.',
  },

  // --- FORÇA ---
  musculoso: {
    id: 'musculoso',
    name: 'Musculoso',
    type: 'positive',
    attrKey: 'forca',
    modifier: 3,
    icon: '🟢',
    summary: '+3 Força',
    description: 'Possui uma musculatura desenvolvida e grande capacidade física. É capaz de realizar esforços que exigem força bruta, carregar cargas pesadas e enfrentar adversidades físicas com maior facilidade.',
  },
  magrelo: {
    id: 'magrelo',
    name: 'Magrelo',
    type: 'negative',
    attrKey: 'forca',
    modifier: -3,
    icon: '🔴',
    summary: '-3 Força',
    description: 'Possui pouca massa muscular e força física reduzida. Carregar peso, empurrar objetos ou realizar atividades que dependam de força bruta exige maior esforço.',
  },

  // --- INTELIGÊNCIA ---
  autodidata: {
    id: 'autodidata',
    name: 'Autodidata',
    type: 'positive',
    attrKey: 'inteligencia',
    modifier: 3,
    icon: '🟢',
    summary: '+3 Inteligência',
    description: 'Possui facilidade para aprender por conta própria. Consegue compreender informações, adquirir conhecimentos e encontrar soluções mesmo sem orientação ou treinamento formal.',
  },
  analfabeto: {
    id: 'analfabeto',
    name: 'Analfabeto',
    type: 'negative',
    attrKey: 'inteligencia',
    modifier: -3,
    icon: '🔴',
    summary: '-3 Inteligência',
    description: 'Possui grande dificuldade para interpretar informações escritas e adquirir conhecimentos através de métodos convencionais. Livros, documentos e instruções escritas podem ser pouco úteis para ele.',
  },

  // --- CARISMA ---
  extrovertido: {
    id: 'extrovertido',
    name: 'Extrovertido',
    type: 'positive',
    attrKey: 'carisma',
    modifier: 3,
    icon: '🟢',
    summary: '+3 Carisma',
    description: 'Comunicativo e sociável, possui facilidade para conversar, criar vínculos e conquistar a confiança das pessoas. Não costuma ter dificuldade para se expressar ou iniciar uma interação.',
  },
  solitario: {
    id: 'solitario',
    name: 'Solitário',
    type: 'negative',
    attrKey: 'carisma',
    modifier: -3,
    icon: '🔴',
    summary: '-3 Carisma',
    description: 'Prefere permanecer isolado e possui dificuldade para estabelecer vínculos. Conversas, negociações e interações sociais podem ser desconfortáveis ou pouco naturais.',
  },

  // --- SABEDORIA ---
  experiente: {
    id: 'experiente',
    name: 'Experiente',
    type: 'positive',
    attrKey: 'sabedoria',
    modifier: 3,
    icon: '🟢',
    summary: '+3 Sabedoria',
    description: 'Possui uma boa experiência de vida e sabe reconhecer situações de risco. É capaz de interpretar circunstâncias, compreender consequências e tomar decisões baseadas em experiências anteriores.',
  },
  ingenuo: {
    id: 'ingenuo',
    name: 'Ingênuo',
    type: 'negative',
    attrKey: 'sabedoria',
    modifier: -3,
    icon: '🔴',
    summary: '-3 Sabedoria',
    description: 'Possui pouca experiência em lidar com situações complexas e tende a confiar facilmente nas pessoas. Pode ter dificuldade para reconhecer perigos, segundas intenções ou consequências de suas escolhas.',
  },

  // --- PERCEPÇÃO ---
  observador: {
    id: 'observador',
    name: 'Observador',
    type: 'positive',
    attrKey: 'percepcao',
    modifier: 3,
    icon: '🟢',
    summary: '+3 Percepção',
    description: 'Presta atenção ao que acontece ao seu redor e percebe detalhes que normalmente passariam despercebidos. Pequenas alterações no ambiente, movimentos ou sinais de perigo dificilmente escapam de sua atenção.',
  },
  desatento: {
    id: 'desatento',
    name: 'Desatento',
    type: 'negative',
    attrKey: 'percepcao',
    modifier: -3,
    icon: '🔴',
    summary: '-3 Percepção',
    description: 'Costuma ignorar detalhes ao seu redor e facilmente perde informações importantes. Movimentos discretos, objetos escondidos ou mudanças no ambiente podem passar despercebidos.',
  },

  // --- AGILIDADE ---
  agil: {
    id: 'agil',
    name: 'Ágil',
    type: 'positive',
    attrKey: 'agilidade',
    modifier: 3,
    icon: '🟢',
    summary: '+3 Agilidade',
    description: 'Possui excelente mobilidade e tempo de reação. Consegue se movimentar rapidamente, mudar de direção, manter o equilíbrio e reagir a situações inesperadas com facilidade.',
  },
  desajeitado: {
    id: 'desajeitado',
    name: 'Desajeitado',
    type: 'negative',
    attrKey: 'agilidade',
    modifier: -3,
    icon: '🔴',
    summary: '-3 Agilidade',
    description: 'Possui pouca coordenação em movimentos rápidos. Pode perder o equilíbrio, tropeçar ou reagir lentamente quando precisa se movimentar de maneira repentina.',
  },
}

// 2. VANTAGENS E DESVANTAGENS (MECÂNICAS)
export const PERKS = {
  // Desvantagens
  sedento: {
    id: 'sedento',
    name: 'Sedento',
    type: 'negative',
    icon: '🚰',
    summary: 'Sede desce 50% mais rápido',
    description: 'Seu organismo consome hidratação aceleradamente, necessitando de água constante.',
  },
  faminto: {
    id: 'faminto',
    name: 'Faminto',
    type: 'negative',
    icon: '🍖',
    summary: 'Fome desce 50% mais rápido',
    description: 'Metabolismo acelerado que consome calorias rapidamente.',
  },
  azarado: {
    id: 'azarado',
    name: 'Azarado',
    type: 'negative',
    icon: '🪞',
    summary: 'Encontra sucata em maior quantidade (2-5 itens)',
    description: 'O azar persegue suas buscas: encontra entulhos e sucata com frequência anormal.',
  },
  baixa_imunidade: {
    id: 'baixa_imunidade',
    name: 'Baixa Imunidade',
    type: 'negative',
    icon: '🤒',
    summary: 'Facilmente adoece (Sistema de Doenças em breve)',
    description: 'Sistema imunológico fragilizado contra infecções e agentes patogênicos. [Aviso: O sistema de doenças será integrado em breve].',
  },
  pele_fragil: {
    id: 'pele_fragil',
    name: 'Pele Frágil',
    type: 'negative',
    icon: '🩸',
    summary: 'Aumenta sangramento (+50% perda de sangue)',
    description: 'Cortes e ferimentos sangram com muito mais intensidade e demoram mais para coagular.',
  },

  // Vantagens
  hidratado: {
    id: 'hidratado',
    name: 'Hidratado',
    type: 'positive',
    icon: '💧',
    summary: 'Sede desce 50% mais devagar',
    description: 'Excelente retenção líquida e controle biológico da desidratação.',
  },
  estomago_pequeno: {
    id: 'estomago_pequeno',
    name: 'Estômago Pequeno',
    type: 'positive',
    icon: '🥣',
    summary: 'Fome desce 50% mais devagar',
    description: 'Sacia-se com poucas porções e suporta longos períodos de racionamento.',
  },
  sortudo: {
    id: 'sortudo',
    name: 'Sortudo',
    type: 'positive',
    icon: '🍀',
    summary: '+15% de chance de itens Incomuns e Raros',
    description: 'Olhar aguçado e destino favorável ao revirar cômodos e armários.',
  },
  alta_imunidade: {
    id: 'alta_imunidade',
    name: 'Alta Imunidade',
    type: 'positive',
    icon: '🛡️',
    summary: 'Dificilmente adoece (Sistema de Doenças em breve)',
    description: 'Anticorpos resistentes e robustez celular. [Aviso: O sistema de doenças será integrado em breve].',
  },
  pele_grossa: {
    id: 'pele_grossa',
    name: 'Pele Grossa',
    type: 'positive',
    icon: '🦾',
    summary: 'Diminui sangramento (-50% perda de sangue)',
    description: 'Tecido epitelial espesso que reduz a gravidade de cortes e sangramentos.',
  },
}

export const MAX_POSITIVE_TRAITS = 3
export const MAX_POSITIVE_PERKS = 2

/**
 * Calcula os bônus de atributos somando todos os traços selecionados
 */
export function calculateTraitModifiers(selectedTraitIds = []) {
  const modifiers = {
    forca: 0,
    destreza: 0,
    agilidade: 0,
    sabedoria: 0,
    percepcao: 0,
    inteligencia: 0,
    carisma: 0,
    constituicao: 0,
  }

  if (!Array.isArray(selectedTraitIds)) return modifiers

  selectedTraitIds.forEach(id => {
    const trait = TRAITS[id]
    if (trait && trait.attrKey && modifiers[trait.attrKey] !== undefined) {
      modifiers[trait.attrKey] += trait.modifier
    }
  })

  return modifiers
}

/**
 * Valida se as escolhas de Traços e Vantagens/Desvantagens estão em equilíbrio e dentro dos limites.
 * Regras:
 * 1. Traços e Vantagens/Desvantagens são independentes entre si.
 * 2. Traço positivo exige Traço negativo (máx 3 traços positivos).
 * 3. Vantagem exige Desvantagem (máx 2 vantagens).
 */
export function validateTraitsBalance(selectedTraitIds = [], selectedPerkIds = []) {
  const traitPositives = (selectedTraitIds || []).filter(id => TRAITS[id]?.type === 'positive').length
  const traitNegatives = (selectedTraitIds || []).filter(id => TRAITS[id]?.type === 'negative').length

  const perkPositives = (selectedPerkIds || []).filter(id => PERKS[id]?.type === 'positive').length
  const perkNegatives = (selectedPerkIds || []).filter(id => PERKS[id]?.type === 'negative').length

  const errors = []

  // Limites máximos
  if (traitPositives > MAX_POSITIVE_TRAITS) {
    errors.push(`Você só pode escolher até ${MAX_POSITIVE_TRAITS} traços positivos (selecionou ${traitPositives}).`)
  }
  if (perkPositives > MAX_POSITIVE_PERKS) {
    errors.push(`Você só pode escolher até ${MAX_POSITIVE_PERKS} vantagens (selecionou ${perkPositives}).`)
  }

  // Equilíbrio independente
  if (traitPositives > traitNegatives) {
    const missing = traitPositives - traitNegatives
    errors.push(`Traços: Você escolheu ${traitPositives} traço(s) positivo(s) e precisa selecionar pelo menos ${missing} traço(s) negativo(s) correspondente(s).`)
  }

  if (perkPositives > perkNegatives) {
    const missing = perkPositives - perkNegatives
    errors.push(`Vantagens: Você escolheu ${perkPositives} vantagem(ns) e precisa selecionar pelo menos ${missing} desvantagem(ns) correspondente(s).`)
  }

  const isValid = errors.length === 0

  return {
    isValid,
    traitPositives,
    traitNegatives,
    perkPositives,
    perkNegatives,
    errors,
    message: isValid
      ? 'Equilíbrio e limites respeitados!'
      : errors.join(' ')
  }
}
