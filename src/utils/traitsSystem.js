// Sistema de Traços (Atributos) e Vantagens/Desvantagens (Mecânicas) - RPG Zona Zero

// 1. TRAÇOS DE ATRIBUTOS
export const TRAITS = {
  // Traços Negativos (-3 no atributo)
  acima_do_peso: {
    id: 'acima_do_peso',
    name: 'Acima do Peso',
    type: 'negative',
    attrKey: 'constituicao',
    modifier: -3,
    icon: '🍔',
    summary: '-3 Constituição',
    description: 'Dificuldade de fôlego e sobrepeso afetam sua resistência biológica e fôlego geral.',
  },
  sedentario: {
    id: 'sedentario',
    name: 'Sedentário',
    type: 'negative',
    attrKey: 'destreza',
    modifier: -3,
    icon: '🛋️',
    summary: '-3 Destreza',
    description: 'Falta de coordenação motora fina e reflexos manuais enfraquecidos.',
  },
  magrelo: {
    id: 'magrelo',
    name: 'Magrelo',
    type: 'negative',
    attrKey: 'forca',
    modifier: -3,
    icon: '🦴',
    summary: '-3 Força',
    description: 'Pouca massa muscular e dificuldade para carregar peso ou causar dano de impacto.',
  },
  analfabeto: {
    id: 'analfabeto',
    name: 'Analfabeto',
    type: 'negative',
    attrKey: 'sabedoria',
    modifier: -3,
    icon: '📵',
    summary: '-3 Sabedoria',
    description: 'Incapacidade de ler manuais técnicos, bulas de remédios e livros instrucionais.',
  },
  solitario: {
    id: 'solitario',
    name: 'Solitário',
    type: 'negative',
    attrKey: 'carisma',
    modifier: -3,
    icon: '🤐',
    summary: '-3 Carisma',
    description: 'Dificuldade extrema em se expressar, negociar e conviver com outros sobreviventes.',
  },

  // Traços Positivos (+3 no atributo)
  em_forma: {
    id: 'em_forma',
    name: 'Em Forma',
    type: 'positive',
    attrKey: 'constituicao',
    modifier: 3,
    icon: '🏃',
    summary: '+3 Constituição',
    description: 'Excelente condicionamento cardiovascular, fôlego expandido e vigor natural.',
  },
  atletico: {
    id: 'atletico',
    name: 'Atlético',
    type: 'positive',
    attrKey: 'destreza',
    modifier: 3,
    icon: '🤸',
    summary: '+3 Destreza',
    description: 'Precisão motora apurada, mãos firmes para pontaria e manuseio fino.',
  },
  musculoso: {
    id: 'musculoso',
    name: 'Musculoso',
    type: 'positive',
    attrKey: 'forca',
    modifier: 3,
    icon: '🏋️',
    summary: '+3 Força',
    description: 'Forte musculatura desenvolvida, alta capacidade de carga e impacto corpo a corpo.',
  },
  autodidata: {
    id: 'autodidata',
    name: 'Autodidata',
    type: 'positive',
    attrKey: 'sabedoria',
    modifier: 3,
    icon: '📖',
    summary: '+3 Sabedoria',
    description: 'Capacidade intuitiva rápida de assimilar conhecimentos práticos e diagnósticos médicos.',
  },
  extrovertido: {
    id: 'extrovertido',
    name: 'Extrovertido',
    type: 'positive',
    attrKey: 'carisma',
    modifier: 3,
    icon: '🤝',
    summary: '+3 Carisma',
    description: 'Facilidade natural para liderar, negociar preços em abrigos e acalmar companheiros.',
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
 * Valida se as escolhas de Traços e Vantagens/Desvantagens estão em equilíbrio.
 * Regra: Cada escolha positiva (Traço positivo ou Vantagem) exige pelo menos uma contrapartida negativa (Traço negativo ou Desvantagem).
 */
export function validateTraitsBalance(selectedTraitIds = [], selectedPerkIds = []) {
  const allPositivesCount =
    (selectedTraitIds || []).filter(id => TRAITS[id]?.type === 'positive').length +
    (selectedPerkIds || []).filter(id => PERKS[id]?.type === 'positive').length

  const allNegativesCount =
    (selectedTraitIds || []).filter(id => TRAITS[id]?.type === 'negative').length +
    (selectedPerkIds || []).filter(id => PERKS[id]?.type === 'negative').length

  // Para poder ter N positivos, precisa ter pelo menos N negativos
  const isValid = allPositivesCount <= allNegativesCount

  return {
    isValid,
    positivesCount: allPositivesCount,
    negativesCount: allNegativesCount,
    requiredNegatives: Math.max(0, allPositivesCount - allNegativesCount),
    message: isValid
      ? 'Equilíbrio respeitado!'
      : `Para escolher ${allPositivesCount} benefício(s) (Traço Positivo / Vantagem), você precisa selecionar pelo menos ${allPositivesCount} contrapartida(s) negativa(s) (Traço Negativo / Desvantagem). Faltam ${allPositivesCount - allNegativesCount} negativa(s).`
  }
}
