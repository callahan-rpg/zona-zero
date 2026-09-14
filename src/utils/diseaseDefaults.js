/**
 * diseaseDefaults.js
 * Configurações padrão de Doenças, Sintomas, Moodles e Medicamentos do Zona Zero RPG.
 * Todas as definições são expansíveis e customizáveis via Firestore (game_config/global.diseaseConfig).
 */

// =============================================================================
// 1. SINTOMAS & NÍVEIS DE INTENSIDADE
// =============================================================================
export const DEFAULT_SYMPTOMS = {
  febre: {
    id: 'febre',
    name: 'Febre',
    moodleId: 'moodle_febre',
    description: 'Temperatura corporal anormalmente elevada.',
    levels: {
      1: { label: 'Febril', desc: 'Seu corpo está ligeiramente quente e você sente um leve rubor no rosto.', penalties: { percepcao: -1 } },
      2: { label: 'Febre Moderada', desc: 'Seu corpo queima em calor. Gotas de suor escorrem e a vista fica turva.', penalties: { percepcao: -1, destreza: -1 } },
      3: { label: 'Febre Alta', desc: 'Febre ardente e delirante. Seu corpo treme e você mal consegue focar no ambiente.', penalties: { percepcao: -2, destreza: -2, agilidade: -1 } }
    }
  },
  calafrios: {
    id: 'calafrios',
    moodleId: 'moodle_calafrios',
    name: 'Calafrios',
    description: 'Sensação súbita de frio intenso com tremores involuntários.',
    levels: {
      1: { label: 'Arrepios', desc: 'Arrepios esporádicos percorrem sua coluna.', penalties: {} },
      2: { label: 'Tremores Frios', desc: 'Tremores ritmados percorrem seus membros, dificultando movimentos firmes.', penalties: { destreza: -1 } },
      3: { label: 'Calafrios Severos', desc: 'Seus dentes batem incontrolavelmente e suas mãos tremem de frio.', penalties: { destreza: -2, agilidade: -1 } }
    }
  },
  coriza: {
    id: 'coriza',
    moodleId: 'moodle_coriza',
    name: 'Coriza & Espirros',
    description: 'Vias nasais congestionadas com secreção constante.',
    levels: {
      1: { label: 'Nariz Escorrendo', desc: 'Leve secreção nasal e respiração um pouco desconfortável.', penalties: {} },
      2: { label: 'Congestão Nasal', desc: 'Nariz completamente entupido e espirros frequentes.', penalties: { percepcao: -1 } },
      3: { label: 'Coriza Intensa', desc: 'Fadiga respiratória, crises de espirros e irritação nas vias aéreas.', penalties: { percepcao: -1, carisma: -1 } }
    }
  },
  tosse: {
    id: 'tosse',
    moodleId: 'moodle_tosse',
    name: 'Tosse',
    description: 'Irritação brônquica com acessos de tosse seca ou produtiva.',
    levels: {
      1: { label: 'Pigcarro Leve', desc: 'Pigarros ocasionais e garganta ligeiramente arranhada.', penalties: {} },
      2: { label: 'Tosse Persistente', desc: 'Acessos incômodos de tosse que ecoam no peito.', penalties: { destreza: -1 } },
      3: { label: 'Tosse Dilacerante', desc: 'Tosse violenta que machuca o tórax e compromete o fôlego.', penalties: { forca: -1, destreza: -1, constituicao: -1 } }
    }
  },
  cansaco: {
    id: 'cansaco',
    moodleId: 'moodle_cansaco',
    name: 'Fadiga & Cansaço',
    description: 'Esgotamento da energia física e lentidão muscular.',
    levels: {
      1: { label: 'Fadiga Leve', desc: 'Seus músculos parecem um pouco mais pesados que o normal.', penalties: {} },
      2: { label: 'Cansaço Evidente', desc: 'Sensação constante de exaustão corporal e lentidão ao caminhar.', penalties: { agilidade: -1, forca: -1 } },
      3: { label: 'Exaustão Prostrada', desc: 'Seu corpo mal responde. Cada passo exige enorme força de vontade.', penalties: { agilidade: -2, forca: -2, constituicao: -1 } }
    }
  },
  nausea: {
    id: 'nausea',
    moodleId: 'moodle_nausea',
    name: 'Náusea',
    description: 'Enjoo estomacal com sensação de refluxo iminente.',
    levels: {
      1: { label: 'Estômago Embrulhado', desc: 'Um desconforto persistente no estômago reduz seu apetite.', penalties: {} },
      2: { label: 'Náusea Moderada', desc: 'Enjoo forte com salivação amarga e tonturas passageiras.', penalties: { destreza: -1, sabedoria: -1 } },
      3: { label: 'Ânsia Intensa', desc: 'Vontade violenta de vomitar. Seu abdômen contrai em espasmos dolorosos.', penalties: { forca: -1, destreza: -1, agilidade: -1 } }
    }
  },
  dor_abdominal: {
    id: 'dor_abdominal',
    moodleId: 'moodle_dor_abdominal',
    name: 'Dor Abdominal',
    description: 'Cólicas e desconforto espasmódico no trato intestinal.',
    levels: {
      1: { label: 'Desconforto Abdominal', desc: 'Pressão incômoda na região da barriga.', penalties: {} },
      2: { label: 'Cólicas Moderadas', desc: 'Pontadas agudas de dor que forçam você a se curvar.', penalties: { agilidade: -1 } },
      3: { label: 'Dor Aguda / Espasmos', desc: 'Cólicas lancinantes e queimação estomacal intensa.', penalties: { agilidade: -2, forca: -1 } }
    }
  },
  diarreia: {
    id: 'diarreia',
    moodleId: 'moodle_diarreia',
    name: 'Desconforto Intestinal',
    description: 'Evacuações desreguladas e desidratação gastrointestinal acelerada.',
    levels: {
      1: { label: 'Digestão Instável', desc: 'Borborigmos e sensação de urgência intestinal leve.', penalties: {} },
      2: { label: 'Desarranjo Intestinal', desc: 'Desidratação rápida e necessidade constante de alívio.', penalties: { constituicao: -1 } },
      3: { label: 'Diarreia Aguda', desc: 'Perda líquida extrema, fraqueza severa e cólicas contínuas.', penalties: { constituicao: -2, forca: -1 } }
    }
  },
  falta_ar: {
    id: 'falta_ar',
    moodleId: 'moodle_falta_ar',
    name: 'Dificuldade Respiratória',
    description: 'Respiração curta e queimação nos pulmões.',
    levels: {
      1: { label: 'Respiração Pesada', desc: 'Sensação de ar insuficiente ao se movimentar rapidamente.', penalties: {} },
      2: { label: 'Falta de Ar Notável', desc: 'Ofegante mesmo em repouso. Seu peito queima ao respirar fundo.', penalties: { constituicao: -1, agilidade: -1 } },
      3: { label: 'Asfixia Dolorosa', desc: 'Chiados nos pulmões e insuficiência respiratória grave.', penalties: { constituicao: -2, agilidade: -2, forca: -1 } }
    }
  }
}

// =============================================================================
// 2. MOODLES VISUAIS (Inspirados no Project Zomboid)
// =============================================================================
export const DEFAULT_MOODLES = {
  moodle_febre: {
    id: 'moodle_febre',
    name: 'Febre',
    defaultIcon: '🤒',
    customImageUrl: '',
    imagesByLevel: { 1: '', 2: '', 3: '' },
    priority: 10,
    active: true,
  },
  moodle_falta_ar: {
    id: 'moodle_falta_ar',
    name: 'Falta de Ar',
    defaultIcon: '🫁',
    customImageUrl: '',
    imagesByLevel: { 1: '', 2: '', 3: '' },
    priority: 9,
    active: true,
  },
  moodle_nausea: {
    id: 'moodle_nausea',
    name: 'Náusea',
    defaultIcon: '🤢',
    customImageUrl: '',
    imagesByLevel: { 1: '', 2: '', 3: '' },
    priority: 8,
    active: true,
  },
  moodle_dor_abdominal: {
    id: 'moodle_dor_abdominal',
    name: 'Cólicas Abdominais',
    defaultIcon: '😣',
    customImageUrl: '',
    imagesByLevel: { 1: '', 2: '', 3: '' },
    priority: 7,
    active: true,
  },
  moodle_diarreia: {
    id: 'moodle_diarreia',
    name: 'Desarranjo Intestinal',
    defaultIcon: '🚽',
    customImageUrl: '',
    imagesByLevel: { 1: '', 2: '', 3: '' },
    priority: 6,
    active: true,
  },
  moodle_calafrios: {
    id: 'moodle_calafrios',
    name: 'Calafrios',
    defaultIcon: '🥶',
    customImageUrl: '',
    imagesByLevel: { 1: '', 2: '', 3: '' },
    priority: 5,
    active: true,
  },
  moodle_tosse: {
    id: 'moodle_tosse',
    name: 'Tosse',
    defaultIcon: '😷',
    customImageUrl: '',
    imagesByLevel: { 1: '', 2: '', 3: '' },
    priority: 4,
    active: true,
  },
  moodle_coriza: {
    id: 'moodle_coriza',
    name: 'Coriza',
    defaultIcon: '🤧',
    customImageUrl: '',
    imagesByLevel: { 1: '', 2: '', 3: '' },
    priority: 3,
    active: true,
  },
  moodle_cansaco: {
    id: 'moodle_cansaco',
    name: 'Fadiga Corporal',
    defaultIcon: '🥱',
    customImageUrl: '',
    imagesByLevel: { 1: '', 2: '', 3: '' },
    priority: 2,
    active: true,
  }
}

// =============================================================================
// 3. DOENÇAS INICIAIS
// =============================================================================
export const DEFAULT_DISEASES = {
  resfriado: {
    id: 'resfriado',
    name: 'Resfriado Comum',
    description: 'Infecção viral branda das vias aéreas superiores, decorrente de exposição a correntes de ar frio ou umidade prolongada.',
    active: true,
    type: 'respiratory',
    severity: 'mild',
    sources: ['cold', 'rain', 'thermal_exposure'],
    incubationMinutes: 25, // Minutos de jogo online
    durationMinutes: 120,
    cureThreshold: 100,
    stages: [
      {
        stageIndex: 1,
        name: 'Início dos Sintomas',
        durationMinutes: 40,
        symptoms: [
          { symptomId: 'coriza', level: 1, chance: 0.9 },
          { symptomId: 'cansaco', level: 1, chance: 0.6 }
        ]
      },
      {
        stageIndex: 2,
        name: 'Pico do Resfriado',
        durationMinutes: 50,
        symptoms: [
          { symptomId: 'coriza', level: 2, chance: 1.0 },
          { symptomId: 'tosse', level: 1, chance: 0.7 },
          { symptomId: 'calafrios', level: 1, chance: 0.5 }
        ]
      },
      {
        stageIndex: 3,
        name: 'Convalescência',
        durationMinutes: 30,
        symptoms: [
          { symptomId: 'coriza', level: 1, chance: 0.5 }
        ]
      }
    ]
  },

  gripe: {
    id: 'gripe',
    name: 'Gripe Viral',
    description: 'Infecção respiratória mais severa, provocando dores generalizadas, febre, calafrios e indisposição pronunciada.',
    active: true,
    type: 'respiratory',
    severity: 'moderate',
    sources: ['cold', 'rain', 'thermal_exposure'],
    incubationMinutes: 35,
    durationMinutes: 240,
    stages: [
      {
        stageIndex: 1,
        name: 'Incubação Tardia & Primeiras Dores',
        durationMinutes: 60,
        symptoms: [
          { symptomId: 'calafrios', level: 1, chance: 0.8 },
          { symptomId: 'cansaco', level: 1, chance: 0.9 },
          { symptomId: 'coriza', level: 1, chance: 0.7 }
        ]
      },
      {
        stageIndex: 2,
        name: 'Fase Aguda',
        durationMinutes: 120,
        symptoms: [
          { symptomId: 'febre', level: 2, chance: 0.9 },
          { symptomId: 'calafrios', level: 2, chance: 0.8 },
          { symptomId: 'tosse', level: 2, chance: 0.8 },
          { symptomId: 'cansaco', level: 2, chance: 1.0 }
        ]
      },
      {
        stageIndex: 3,
        name: 'Recuperação Gradual',
        durationMinutes: 60,
        symptoms: [
          { symptomId: 'tosse', level: 1, chance: 0.6 },
          { symptomId: 'cansaco', level: 1, chance: 0.5 }
        ]
      }
    ]
  },

  pneumonia: {
    id: 'pneumonia',
    name: 'Pneumonia Bacteriana',
    description: 'Inflamação aguda dos pulmões. Requer exposição severa ao frio congelante, tempestades ou agravamento de infecções respiratórias.',
    active: true,
    type: 'respiratory',
    severity: 'severe',
    sources: ['extreme_cold', 'storm_exposure', 'untreated_flu', 'wound'],
    incubationMinutes: 50,
    durationMinutes: 360,
    stages: [
      {
        stageIndex: 1,
        name: 'Fase Inicial',
        durationMinutes: 80,
        symptoms: [
          { symptomId: 'tosse', level: 2, chance: 0.9 },
          { symptomId: 'febre', level: 2, chance: 0.8 },
          { symptomId: 'falta_ar', level: 1, chance: 0.7 }
        ]
      },
      {
        stageIndex: 2,
        name: 'Comprometimento Pulmonar Grave',
        durationMinutes: 180,
        symptoms: [
          { symptomId: 'febre', level: 3, chance: 1.0 },
          { symptomId: 'falta_ar', level: 3, chance: 0.9 },
          { symptomId: 'tosse', level: 3, chance: 1.0 },
          { symptomId: 'cansaco', level: 3, chance: 1.0 }
        ]
      },
      {
        stageIndex: 3,
        name: 'Descongestão e Alívio',
        durationMinutes: 100,
        symptoms: [
          { symptomId: 'tosse', level: 2, chance: 0.8 },
          { symptomId: 'falta_ar', level: 1, chance: 0.6 }
        ]
      }
    ]
  },

  gastroenterite: {
    id: 'gastroenterite',
    name: 'Gastroenterite Aguda',
    description: 'Infecção do trato digestivo provocada principalmente pela ingestão de água impura ou alimentos contaminados.',
    active: true,
    type: 'gastrointestinal',
    severity: 'moderate',
    sources: ['water_impure', 'bad_hygiene'],
    incubationMinutes: 20,
    durationMinutes: 180,
    stages: [
      {
        stageIndex: 1,
        name: 'Desconforto Gástrico',
        durationMinutes: 40,
        symptoms: [
          { symptomId: 'nausea', level: 1, chance: 0.9 },
          { symptomId: 'dor_abdominal', level: 1, chance: 0.8 }
        ]
      },
      {
        stageIndex: 2,
        name: 'Crise Gastrointestinal',
        durationMinutes: 90,
        symptoms: [
          { symptomId: 'nausea', level: 2, chance: 1.0 },
          { symptomId: 'dor_abdominal', level: 2, chance: 0.9 },
          { symptomId: 'diarreia', level: 2, chance: 0.85 },
          { symptomId: 'calafrios', level: 1, chance: 0.5 }
        ]
      },
      {
        stageIndex: 3,
        name: 'Estabilização',
        durationMinutes: 50,
        symptoms: [
          { symptomId: 'dor_abdominal', level: 1, chance: 0.5 },
          { symptomId: 'cansaco', level: 1, chance: 0.6 }
        ]
      }
    ]
  },

  infeccao_intestinal: {
    id: 'infeccao_intestinal',
    name: 'Infecção Intestinal Severa',
    description: 'Agravamento bacteriano severo no intestino decorrente de água contaminada consumida com sistema imunológico fragilizado ou baixa higiene.',
    active: true,
    type: 'gastrointestinal',
    severity: 'severe',
    sources: ['water_impure', 'bad_hygiene'],
    incubationMinutes: 30,
    durationMinutes: 300,
    stages: [
      {
        stageIndex: 1,
        name: 'Início Febril e Cólicas',
        durationMinutes: 60,
        symptoms: [
          { symptomId: 'dor_abdominal', level: 2, chance: 0.9 },
          { symptomId: 'nausea', level: 2, chance: 0.8 },
          { symptomId: 'febre', level: 1, chance: 0.7 }
        ]
      },
      {
        stageIndex: 2,
        name: 'Infecção Aguda',
        durationMinutes: 150,
        symptoms: [
          { symptomId: 'febre', level: 2, chance: 0.95 },
          { symptomId: 'dor_abdominal', level: 3, chance: 1.0 },
          { symptomId: 'diarreia', level: 3, chance: 1.0 },
          { symptomId: 'nausea', level: 3, chance: 0.85 },
          { symptomId: 'cansaco', level: 2, chance: 0.9 }
        ]
      },
      {
        stageIndex: 3,
        name: 'Recuperação Lenta',
        durationMinutes: 90,
        symptoms: [
          { symptomId: 'dor_abdominal', level: 1, chance: 0.6 },
          { symptomId: 'cansaco', level: 1, chance: 0.7 }
        ]
      }
    ]
  }
}

// =============================================================================
// 4. MAPEAMENTO DE MEDICAMENTOS & TRATAMENTOS
// =============================================================================
export const DEFAULT_MEDICINE_TREATMENTS = {
  multivitaminico: {
    itemId: 'multivitaminico',
    name: 'Frasco de Multivitamínicos',
    cureDiseases: ['gripe', 'resfriado'],
    relieveSymptoms: ['cansaco'],
    cureChance: 1.0,
    successMessage: 'As vitaminas fortificam seu organismo. A gripe e o mal-estar começam a regredir gradativamente.',
  },
  tetraciclina: {
    itemId: 'tetraciclina',
    name: 'Tetraciclina (Antibiótico)',
    cureDiseases: ['infeccao_intestinal', 'pneumonia', 'gastroenterite'],
    relieveSymptoms: ['dor_abdominal', 'diarreia', 'falta_ar'],
    cureChance: 1.0,
    successMessage: 'O potente antibiótico combate a infecção no seu corpo. Os sintomas mais graves cessam.',
  },
  carvao_ativado: {
    itemId: 'carvao_ativado',
    name: 'Carvão Ativado',
    cureDiseases: ['gastroenterite'],
    relieveSymptoms: ['nausea', 'dor_abdominal'],
    cureChance: 1.0,
    successMessage: 'O carvão ativado absorve as toxinas gastrointestinais. Seu estômago assenta e a náusea se dissipa.',
  },
  antitermico: {
    itemId: 'antitermico',
    name: 'Antitérmico / Analgésico',
    cureDiseases: [],
    relieveSymptoms: ['febre', 'calafrios', 'tosse'],
    cureChance: 1.0,
    successMessage: 'O antitérmico alivia a febre alta e aplaca as dores musculares pelo corpo.',
  },
  remedio_basico: {
    itemId: 'remedio_basico',
    name: 'Remédios Básicos',
    cureDiseases: ['resfriado'],
    relieveSymptoms: ['coriza', 'calafrios'],
    cureChance: 0.85,
    successMessage: 'Os medicamentos básicos aliviam os sintomas respiratórios mais incômodos.',
  }
}
