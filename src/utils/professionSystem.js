// Sistema de Profissões e Especializações - RPG Zona Zero

export const ATTRIBUTE_LIST = [
  { key: 'forca',        label: 'Força',        icon: '💪', color: '#ef4444', desc: 'Poder físico, dano corpo a corpo e capacidade de carga.' },
  { key: 'destreza',     label: 'Destreza',     icon: '🎯', color: '#f59e0b', desc: 'Precisão com armas de disparo, pontaria e coordenação fina.' },
  { key: 'agilidade',    label: 'Agilidade',    icon: '⚡', color: '#eab308', desc: 'Velocidade de reação, esquiva, reflexos e tempo de resposta.' },
  { key: 'sabedoria',    label: 'Sabedoria',    icon: '🧠', color: '#3b82f6', desc: 'Medicina, intuição, estabilidade mental e primeiros socorros.' },
  { key: 'percepcao',    label: 'Percepção',    icon: '👁️', color: '#06b6d4', desc: 'Atenção ao ambiente, rastreamento, busca de loot e sentidos aguçados.' },
  { key: 'inteligencia', label: 'Inteligência', icon: '🔬', color: '#a855f7', desc: 'Engenharia, computação, química, raciocínio lógico e veículos.' },
  { key: 'carisma',      label: 'Carisma',      icon: '🗣️', color: '#ec4899', desc: 'Negociação, liderança, persuasão e interação com sobreviventes.' },
  { key: 'constituicao', label: 'Constituição', icon: '🛡️', color: '#10b981', desc: 'Resistência biológica, imunidade a doenças, fôlego e vitalidade.' },
]

export const PROFESSIONS = {
  militar: {
    id: 'militar',
    name: 'Militar',
    icon: '🪖',
    badge: '🎖️ Forças Armadas & Segurança',
    description: 'Profissão voltada para combate tático, disciplina rigorosa, resistência física e uso eficiente de armas. Militares enfrentam infectados e ameaças com determinação letal.',
    bonus: { forca: 2 },
    bonusSummary: '+2 Força',
    specialties: {
      policial: {
        id: 'policial',
        name: 'Policial',
        icon: '👮',
        bonus: { forca: 1 },
        bonusSummary: '+1 Força',
        proficiency: 'Armas de fogo leves e contenção física',
        abilities: [
          'Proficiência com armas de fogo leves (pistolas e submetralhadoras)',
          'Conhecimento de protocolos policiais e procedimentos de segurança',
          'Técnicas de imobilização e contenção'
        ],
        starterItems: [
          { itemId: 'pistola_glock', name: 'Pistola 9mm', icon: '🔫', quantity: 1, rarity: 'rare', category: 'firearms' },
          { itemId: 'municao_9mm', name: 'Caixa de Munição 9mm', icon: '📦', quantity: 1, rarity: 'rare', category: 'firearms' },
          { itemId: 'colete_balistico', name: 'Colete Policial Balístico', icon: '🛡️', quantity: 1, rarity: 'very_rare', category: 'clothing' },
          { itemId: 'algemas', name: 'Algemas de Aço', icon: '⛓️', quantity: 1, rarity: 'uncommon', category: 'general' },
        ]
      },
      bombeiro: {
        id: 'bombeiro',
        name: 'Bombeiro',
        icon: '🔥',
        bonus: { forca: 1 },
        bonusSummary: '+1 Força',
        proficiency: 'Machados pesados e arrombamento estrutural',
        abilities: [
          'Proficiência extrema com machados e marretas',
          'Maior facilidade e rapidez para arrombar portas e escombros',
          'Resistência básica a fumaça e ambientes asfixiantes'
        ],
        starterItems: [
          { itemId: 'machado_incendio', name: 'Machado de Incêndio', icon: '🪓', quantity: 1, rarity: 'rare', category: 'melee' },
          { itemId: 'roupa_bombeiro', name: 'Uniforme de Proteção Térmica', icon: '🦺', quantity: 1, rarity: 'rare', category: 'clothing' },
          { itemId: 'mascara_respiratoria', name: 'Máscara Respiratória', icon: '🎭', quantity: 1, rarity: 'uncommon', category: 'clothing' },
          { itemId: 'lanterna_portatil', name: 'Lanterna Portátil Reforçada', icon: '🔦', quantity: 1, rarity: 'uncommon', category: 'general' },
        ]
      },
      sargento: {
        id: 'sargento',
        name: 'Sargento',
        icon: '🎖️',
        bonus: { forca: 1 },
        bonusSummary: '+1 Força',
        proficiency: 'Armamentos militares pesados e comando tático',
        abilities: [
          'Proficiência com fuzis táticos e armamento pesado',
          'Conhecimento de patrulha, formações defensivas e liderança de esquadrão',
          'Táticas avançadas de sobrevivência em zonas de combate'
        ],
        starterItems: [
          { itemId: 'fuzil_militar', name: 'Fuzil Militar Tático', icon: '🎖️', quantity: 1, rarity: 'very_rare', category: 'firearms' },
          { itemId: 'municao_militar', name: 'Munição Militar 5.56mm', icon: '📦', quantity: 1, rarity: 'rare', category: 'firearms' },
          { itemId: 'traje_militar', name: 'Traje Militar Camuflado', icon: '🪖', quantity: 1, rarity: 'rare', category: 'clothing' },
          { itemId: 'faca_tatica', name: 'Faca de Combate Militar', icon: '🗡️', quantity: 1, rarity: 'uncommon', category: 'melee' },
        ]
      }
    }
  },

  medico: {
    id: 'medico',
    name: 'Médico',
    icon: '🩺',
    badge: '💉 Saúde & Bio-Emergência',
    description: 'Profissionais acostumados a lidar com ferimentos, infecções, medicamentos e traumas críticos. São vitais para manter qualquer grupo de sobreviventes vivo.',
    bonus: { sabedoria: 2 },
    bonusSummary: '+2 Sabedoria',
    specialties: {
      medico_clinico: {
        id: 'medico_clinico',
        name: 'Médico Clínico',
        icon: '🩺',
        bonus: { sabedoria: 1 },
        bonusSummary: '+1 Sabedoria',
        proficiency: 'Cirurgias de campo e diagnósticos avançados',
        abilities: [
          'Maior eficiência e rendimento ao tratar ferimentos graves',
          'Capacidade de realizar cirurgias de campo e suturas avançadas',
          'Diagnóstico precoce de sintomas infecciosos'
        ],
        starterItems: [
          { itemId: 'kit_cirurgico', name: 'Kit Médico Avançado', icon: '🩺', quantity: 1, rarity: 'rare', category: 'medical', consumable: true, consumeEffect: { blood: 60, thirst: 10 } },
          { itemId: 'remedio_basico', name: 'Remédios Básicos', icon: '💊', quantity: 2, rarity: 'common', category: 'medical', consumable: true, consumeEffect: { blood: 15 } },
          { itemId: 'bandagem', name: 'Bandagem Estéril', icon: '🩹', quantity: 3, rarity: 'common', category: 'medical', consumable: true, consumeEffect: { blood: 25 } },
          { itemId: 'alcool_antisseptico', name: 'Álcool 70%', icon: '🧪', quantity: 1, rarity: 'uncommon', category: 'medical', consumable: true, consumeEffect: { blood: 10 } },
        ]
      },
      socorrista: {
        id: 'socorrista',
        name: 'Socorrista',
        icon: '🚑',
        bonus: { agilidade: 1 },
        bonusSummary: '+1 Agilidade',
        proficiency: 'Intervenção médica de emergência e resgate veloz',
        abilities: [
          'Tratamento ultrarrápido de hemorragias em combate',
          'Capacidade de estabilizar aliados em estado crítico ou inconscientes',
          'Agilidade superior para manobras de resgate sob fogo cruzado'
        ],
        starterItems: [
          { itemId: 'kit_primeiros_socorros', name: 'Kit de Primeiros Socorros', icon: '🚑', quantity: 1, rarity: 'uncommon', category: 'medical', consumable: true, consumeEffect: { blood: 40 } },
          { itemId: 'bandagem', name: 'Bandagem Estéril', icon: '🩹', quantity: 4, rarity: 'common', category: 'medical', consumable: true, consumeEffect: { blood: 25 } },
          { itemId: 'remedio_basico', name: 'Remédios Básicos', icon: '💊', quantity: 2, rarity: 'common', category: 'medical', consumable: true, consumeEffect: { blood: 15 } },
        ]
      },
      farmaceutico: {
        id: 'farmaceutico',
        name: 'Farmacêutico',
        icon: '🧪',
        bonus: { sabedoria: 1 },
        bonusSummary: '+1 Sabedoria',
        proficiency: 'Química medicinal e síntese de fármacos',
        abilities: [
          'Identificação precisa da eficácia e pureza de fármacos',
          'Melhor aproveitamento de dosagens sem desperdício',
          'Capacidade de sintetizar medicamentos e antissépticos básicos'
        ],
        starterItems: [
          { itemId: 'bolsa_farmaceutica', name: 'Bolsa Farmacêutica', icon: '🧰', quantity: 1, rarity: 'rare', category: 'general' },
          { itemId: 'remedio_basico', name: 'Remédios Básicos', icon: '💊', quantity: 3, rarity: 'common', category: 'medical', consumable: true, consumeEffect: { blood: 15 } },
          { itemId: 'alcool_antisseptico', name: 'Álcool 70%', icon: '🧪', quantity: 2, rarity: 'uncommon', category: 'medical', consumable: true, consumeEffect: { blood: 10 } },
        ]
      }
    }
  },

  mecanico: {
    id: 'mecanico',
    name: 'Mecânico',
    icon: '🔧',
    badge: '⚙️ Engenharia & Maquinário',
    description: 'Essenciais para o funcionamento do mundo: consertam veículos, operam geradores elétricos e constroem defesas sólidas contra hordas.',
    bonus: { inteligencia: 2 },
    bonusSummary: '+2 Inteligência',
    specialties: {
      mecanico_auto: {
        id: 'mecanico_auto',
        name: 'Mecânico Automotivo',
        icon: '🔧',
        bonus: { inteligencia: 1 },
        bonusSummary: '+1 Inteligência',
        proficiency: 'Mecânica a combustão e motores',
        abilities: [
          'Capacidade de consertar e reativar veículos abandonados',
          'Maior eficiência e rendimento ao reparar peças mecânicas',
          'Conhecimento detalhado de sistemas de ignição e combustível'
        ],
        starterItems: [
          { itemId: 'ferramentas_pro', name: 'Maleta de Ferramentas Pro', icon: '🧰', quantity: 1, rarity: 'rare', category: 'melee' },
          { itemId: 'galao_combustivel', name: 'Galão de Combustível (Cheio)', icon: '⛽', quantity: 1, rarity: 'rare', category: 'general' },
          { itemId: 'luvas_trabalho', name: 'Luvas de Proteção Reforçadas', icon: '🧤', quantity: 1, rarity: 'common', category: 'clothing' },
        ]
      },
      engenheiro: {
        id: 'engenheiro',
        name: 'Engenheiro',
        icon: '⚙️',
        bonus: { inteligencia: 1 },
        bonusSummary: '+1 Inteligência',
        proficiency: 'Sistemas elétricos, redes e circuitos de energia',
        abilities: [
          'Reparação de máquinas industriais e complexas',
          'Instalação e manutenção de geradores e redes elétricas',
          'Análise estrutural de integridade de construções'
        ],
        starterItems: [
          { itemId: 'ferramentas_tecnicas', name: 'Estojo de Ferramentas Técnicas', icon: '🔬', quantity: 1, rarity: 'rare', category: 'general' },
          { itemId: 'extensao_eletrica', name: 'Extensão Elétrica Industrial', icon: '🔌', quantity: 1, rarity: 'uncommon', category: 'general' },
          { itemId: 'baterias_pilhas', name: 'Pilhas e Baterias', icon: '🔋', quantity: 2, rarity: 'uncommon', category: 'general' },
        ]
      },
      construtor: {
        id: 'construtor',
        name: 'Construtor',
        icon: '🏗️',
        bonus: { forca: 1 },
        bonusSummary: '+1 Força',
        proficiency: 'Alvenaria, carpintaria e fortificações',
        abilities: [
          'Construção e reforço de barricadas duradouras',
          'Maior velocidade e menor custo de material para obras',
          'Criação de estruturas seguras e portões defensivos'
        ],
        starterItems: [
          { itemId: 'martelo', name: 'Martelo de Orelha Pesado', icon: '🔨', quantity: 1, rarity: 'uncommon', category: 'melee' },
          { itemId: 'pregos_parafusos', name: 'Caixa de Pregos e Parafusos', icon: '🔩', quantity: 2, rarity: 'junk', category: 'general' },
          { itemId: 'tabua_madeira', name: 'Tábuas de Madeira Tratada', icon: '🪵', quantity: 3, rarity: 'junk', category: 'melee' },
          { itemId: 'fita_adesiva', name: 'Fita Adesiva Reforçada', icon: '🩹', quantity: 1, rarity: 'common', category: 'general' },
        ]
      }
    }
  },

  cacador: {
    id: 'cacador',
    name: 'Caçador',
    icon: '🎯',
    badge: '🌲 Sobrevivência Selvagem & Rastreio',
    description: 'Inspirado na sobrevivência bruta de ermos: sabem rastrear alvos, encontrar água pura, caçar presas e sobreviver longe de qualquer cidade.',
    bonus: { percepcao: 2 },
    bonusSummary: '+2 Percepção',
    specialties: {
      cacador_selvagem: {
        id: 'cacador_selvagem',
        name: 'Caçador',
        icon: '🎯',
        bonus: { percepcao: 1 },
        bonusSummary: '+1 Percepção',
        proficiency: 'Armas de caça e tiro de longa distância',
        abilities: [
          'Proficiência completa com rifles de ferrolho e arcos',
          'Rastreamento apurado de animais e presas selvagens',
          'Maior aproveitamento de carne limpa e couros'
        ],
        starterItems: [
          { itemId: 'rifle_caca', name: 'Rifle de Caça com Luneta', icon: '🎯', quantity: 1, rarity: 'rare', category: 'firearms' },
          { itemId: 'municao_caca', name: 'Caixa de Cartuchos de Caça', icon: '📦', quantity: 1, rarity: 'uncommon', category: 'firearms' },
          { itemId: 'faca_caca', name: 'Faca de Caça Afiada', icon: '🔪', quantity: 1, rarity: 'uncommon', category: 'melee' },
        ]
      },
      mateiro: {
        id: 'mateiro',
        name: 'Mateiro',
        icon: '🌲',
        bonus: { constituicao: 1 },
        bonusSummary: '+1 Constituição',
        proficiency: 'Sobrevivência em biomas selvagens e botânica',
        abilities: [
          'Identificação confiável de plantas, raízes e cogumelos comestíveis',
          'Melhor aproveitamento de recursos naturais e fontes de água',
          'Resistência superior a intempéries e noites ao ar livre'
        ],
        starterItems: [
          { itemId: 'mochila_sobrevivencia', name: 'Mochila Tática de Mateiro', icon: '🎒', quantity: 1, rarity: 'rare', category: 'general' },
          { itemId: 'faca_cozinha', name: 'Faca de Sobrevivência', icon: '🔪', quantity: 1, rarity: 'uncommon', category: 'melee' },
          { itemId: 'isqueiro_fosforo', name: 'Isqueiro e Fósforos Impermeáveis', icon: '🔥', quantity: 1, rarity: 'uncommon', category: 'general' },
          { itemId: 'corda_nylon', name: 'Rolo de Corda de Nylon', icon: '🪢', quantity: 1, rarity: 'uncommon', category: 'general' },
        ]
      },
      trapper: {
        id: 'trapper',
        name: 'Trapper',
        icon: '🐺',
        bonus: { percepcao: 1 },
        bonusSummary: '+1 Percepção',
        proficiency: 'Manufatura de armadilhas e curtimento',
        abilities: [
          'Fabricação e desarme de armadilhas mecânicas',
          'Captura eficiente de pequenos e médios animais',
          'Conhecimento de extração de peles, ossos e tendões'
        ],
        starterItems: [
          { itemId: 'kit_armadilhas', name: 'Kit de Armadilhas Mecânicas', icon: '🐺', quantity: 2, rarity: 'uncommon', category: 'general' },
          { itemId: 'canivete_multiuso', name: 'Canivete Multiuso', icon: '🗡️', quantity: 1, rarity: 'uncommon', category: 'melee' },
          { itemId: 'corda_nylon', name: 'Rolo de Corda de Nylon', icon: '🪢', quantity: 1, rarity: 'uncommon', category: 'general' },
        ]
      }
    }
  },

  agricultor: {
    id: 'agricultor',
    name: 'Agricultor',
    icon: '🌾',
    badge: '🌱 Produção & Sustentabilidade',
    description: 'Enquanto a maioria disputa restos industrializados, o agricultor produz comida, cuida de animais e garante a renovação dos recursos da comunidade.',
    bonus: { constituicao: 2 },
    bonusSummary: '+2 Constituição',
    specialties: {
      agricultor_cultivo: {
        id: 'agricultor_cultivo',
        name: 'Agricultor',
        icon: '🌾',
        bonus: { constituicao: 1 },
        bonusSummary: '+1 Constituição',
        proficiency: 'Cultivo, botânica aplicada e horticultura',
        abilities: [
          'Técnicas avançadas de plantio e rotação de culturas',
          'Melhor aproveitamento e multiplicação de sementes',
          'Identificação do ciclo de colheita e saúde do solo'
        ],
        starterItems: [
          { itemId: 'ferramentas_agricolas', name: 'Conjunto de Ferramentas Agrícolas', icon: '🧑‍🌾', quantity: 1, rarity: 'uncommon', category: 'melee' },
          { itemId: 'sementes_iniciais', name: 'Pacote de Sementes Mistas', icon: '🌱', quantity: 3, rarity: 'uncommon', category: 'supplies' },
          { itemId: 'garrafa_agua', name: 'Garrafa de Água Potável', icon: '💧', quantity: 2, rarity: 'common', category: 'supplies', consumable: true, consumeEffect: { thirst: 35 } },
        ]
      },
      pecuarista: {
        id: 'pecuarista',
        name: 'Pecuarista',
        icon: '🐄',
        bonus: { constituicao: 1 },
        bonusSummary: '+1 Constituição',
        proficiency: 'Manejo animal e veterinária básica',
        abilities: [
          'Cuidados, alimentação e reprodução de animais de abate/trabalho',
          'Produção e extração de laticínios, ovos e derivados',
          'Conhecimento do comportamento de animais silvestres e domesticados'
        ],
        starterItems: [
          { itemId: 'luvas_trabalho', name: 'Luvas de Couro de Trabalho', icon: '🧤', quantity: 1, rarity: 'common', category: 'clothing' },
          { itemId: 'corda_nylon', name: 'Rolo de Corda Resistente', icon: '🪢', quantity: 1, rarity: 'uncommon', category: 'general' },
          { itemId: 'faca_cozinha', name: 'Faca Utilitária', icon: '🔪', quantity: 1, rarity: 'uncommon', category: 'melee' },
        ]
      },
      produtor_alimentos: {
        id: 'produtor_alimentos',
        name: 'Produtor Culinário',
        icon: '🍞',
        bonus: { inteligencia: 1 },
        bonusSummary: '+1 Inteligência',
        proficiency: 'Conservação, secagem e fermentação de alimentos',
        abilities: [
          'Conservação de alimentos sem necessidade de refrigeração',
          'Técnicas de fermentação, defumação, desidratação e salga',
          'Preparo de rações concentradas e nutritivas'
        ],
        starterItems: [
          { itemId: 'panela_frigideira', name: 'Panela de Ferro Culinária', icon: '🍳', quantity: 1, rarity: 'uncommon', category: 'melee' },
          { itemId: 'abridor_latas', name: 'Abridor de Latas', icon: '🧰', quantity: 1, rarity: 'uncommon', category: 'general' },
          { itemId: 'mantimentos_secos', name: 'Pacote de Mantimentos', icon: '🌾', quantity: 2, rarity: 'common', category: 'supplies', consumable: true, consumeEffect: { hunger: 20 } },
          { itemId: 'isqueiro_fosforo', name: 'Isqueiro e Fósforos', icon: '🔥', quantity: 1, rarity: 'uncommon', category: 'general' },
        ]
      }
    }
  },

  cientista: {
    id: 'cientista',
    name: 'Cientista',
    icon: '🔬',
    badge: '🧪 Pesquisa, Bio-Análise & Tecnologia',
    description: 'Indivíduos com conhecimento acadêmico avançado para decifrar a origem do vírus, analisar mutações, manipular produtos químicos e quebrar códigos.',
    bonus: { inteligencia: 2 },
    bonusSummary: '+2 Inteligência',
    specialties: {
      quimico: {
        id: 'quimico',
        name: 'Químico',
        icon: '🧪',
        bonus: { inteligencia: 1 },
        bonusSummary: '+1 Inteligência',
        proficiency: 'Síntese química e compostos voláteis',
        abilities: [
          'Manipulação e neutralização de substâncias perigosas',
          'Fabricação de compostos químicos, explosivos e desinfetantes',
          'Identificação precisa de misturas e compostos tóxicos'
        ],
        starterItems: [
          { itemId: 'equipamento_quimico', name: 'Equipamento Químico Portátil', icon: '🧪', quantity: 1, rarity: 'rare', category: 'general' },
          { itemId: 'alcool_antisseptico', name: 'Álcool 70%', icon: '🧪', quantity: 2, rarity: 'uncommon', category: 'medical', consumable: true, consumeEffect: { blood: 10 } },
          { itemId: 'mascara_respiratoria', name: 'Máscara com Filtro Químico', icon: '🎭', quantity: 1, rarity: 'uncommon', category: 'clothing' },
        ]
      },
      pesquisador: {
        id: 'pesquisador',
        name: 'Pesquisador',
        icon: '🔬',
        bonus: { sabedoria: 1 },
        bonusSummary: '+1 Sabedoria',
        proficiency: 'Análise documental e investigação biológica',
        abilities: [
          'Análise de relatórios científicos, registros de quarentena e mapas',
          'Interpretação de dados de amostras de infectados',
          'Identificação de fraquezas e padrões comportamentais de mutações'
        ],
        starterItems: [
          { itemId: 'caderno_pesquisa', name: 'Caderno de Anotações & Lupa', icon: '📖', quantity: 1, rarity: 'rare', category: 'general' },
          { itemId: 'oculos_grau', name: 'Óculos de Alta Precisão', icon: '👓', quantity: 1, rarity: 'uncommon', category: 'clothing' },
          { itemId: 'lanterna_portatil', name: 'Lanterna UV / Portátil', icon: '🔦', quantity: 1, rarity: 'uncommon', category: 'general' },
        ]
      },
      analista_ti: {
        id: 'analista_ti',
        name: 'Analista de TI',
        icon: '💻',
        bonus: { inteligencia: 1 },
        bonusSummary: '+1 Inteligência',
        proficiency: 'Sistemas eletrônicos, criptografia e bancos de dados',
        abilities: [
          'Hackeamento e acesso a terminais e sistemas de segurança trancados',
          'Recuperação de dados e registros em computadores danificados',
          'Manutenção e reconfiguração de equipamentos eletrônicos'
        ],
        starterItems: [
          { itemId: 'notebook_estudante', name: 'Notebook Tático Operacional', icon: '💻', quantity: 1, rarity: 'rare', category: 'general' },
          { itemId: 'celular_funcional', name: 'Smartphone Desbloqueado', icon: '📱', quantity: 1, rarity: 'rare', category: 'general' },
          { itemId: 'carregador_cabos', name: 'Carregador Solar e Cabos', icon: '🔌', quantity: 1, rarity: 'uncommon', category: 'general' },
          { itemId: 'baterias_pilhas', name: 'Pilhas e Baterias', icon: '🔋', quantity: 2, rarity: 'uncommon', category: 'general' },
        ]
      }
    }
  },

  sobrevivente: {
    id: 'sobrevivente',
    name: 'Sobrevivente',
    icon: '🏕️',
    badge: '🔪 Resiliência Urbana & Prática',
    description: 'A profissão civil mais pura: sem teorias militares ou acadêmicas, aprendeu na marra a resistir ao caos diário com astúcia, adaptação e força de vontade.',
    bonus: { constituicao: 1, percepcao: 1 },
    bonusSummary: '+1 Const, +1 Percep',
    specialties: {
      preparador: {
        id: 'preparador',
        name: 'Preparador (Prepper)',
        icon: '🏕️',
        bonus: { percepcao: 1 },
        bonusSummary: '+1 Percepção',
        proficiency: 'Logística de mantimentos e capacidade de carga',
        abilities: [
          'Excelente organização de mochila e capacidade de carga expandida',
          'Início com reserva sólida de mantimentos e utilitários',
          'Orientação rápida em rotas de fuga urbanas'
        ],
        starterItems: [
          { itemId: 'mochila_pequena', name: 'Mochila Resistente', icon: '🎒', quantity: 1, rarity: 'uncommon', category: 'general' },
          { itemId: 'comida_enlatada', name: 'Comida Enlatada', icon: '🥫', quantity: 2, rarity: 'common', category: 'supplies', consumable: true, consumeEffect: { hunger: 30 } },
          { itemId: 'garrafa_agua', name: 'Garrafa de Água Potável', icon: '💧', quantity: 2, rarity: 'common', category: 'supplies', consumable: true, consumeEffect: { thirst: 35 } },
          { itemId: 'lanterna_portatil', name: 'Lanterna Portátil', icon: '🔦', quantity: 1, rarity: 'uncommon', category: 'general' },
        ]
      },
      sobrevivencialista: {
        id: 'sobrevivencialista',
        name: 'Sobrevivencialista',
        icon: '🔪',
        bonus: { percepcao: 1 },
        bonusSummary: '+1 Percepção',
        proficiency: 'Bushcraft, fogueiras rápidas e coleta urbana',
        abilities: [
          'Acendimento veloz de fogueiras e fontes de calor seguras',
          'Montagem rápida de abrigos improvisados em ruínas',
          'Eficiência em vasculhas de sucatas e materiais reaproveitáveis'
        ],
        starterItems: [
          { itemId: 'faca_cozinha', name: 'Faca Utilitária Afiada', icon: '🔪', quantity: 1, rarity: 'uncommon', category: 'melee' },
          { itemId: 'isqueiro_fosforo', name: 'Isqueiro e Fósforos', icon: '🔥', quantity: 1, rarity: 'uncommon', category: 'general' },
          { itemId: 'corda_nylon', name: 'Rolo de Corda', icon: '🪢', quantity: 1, rarity: 'uncommon', category: 'general' },
          { itemId: 'fita_adesiva', name: 'Fita Adesiva Reforçada', icon: '🩹', quantity: 1, rarity: 'common', category: 'general' },
        ]
      },
      negociador: {
        id: 'negociador',
        name: 'Negociador',
        icon: '🗣️',
        bonus: { carisma: 1 },
        bonusSummary: '+1 Carisma',
        proficiency: 'Diplomacia, persuasão e comércio',
        abilities: [
          'Maior facilidade em interações pacíficas e diplomáticas com NPCs',
          'Poder de barganha: melhores preços e trocas no comércio',
          'Começa com pequenos recursos comerciais de alto valor de troca'
        ],
        starterItems: [
          { itemId: 'dinheiro_papel', name: 'Notas e Títulos Comerciais', icon: '💵', quantity: 5, rarity: 'junk', category: 'general' },
          { itemId: 'isqueiro_fosforo', name: 'Isqueiro de Colecionador', icon: '🔥', quantity: 1, rarity: 'uncommon', category: 'general' },
          { itemId: 'perfume', name: 'Vidro de Perfume Preservado', icon: '✨', quantity: 1, rarity: 'common', category: 'general' },
          { itemId: 'relogio_pulso', name: 'Relógio de Pulso Analógico', icon: '⌚', quantity: 1, rarity: 'rare', category: 'general', unlocks: ['hud_clock'] },
        ]
      }
    }
  }
}

/**
 * Retorna os dados completos da profissão pelo ID
 */
export function getProfessionData(profId) {
  if (!profId) return null
  return PROFESSIONS[profId] || null
}

/**
 * Retorna os dados da especialização pelo ID da profissão e da especialização
 */
export function getSpecialtyData(profId, specId) {
  const prof = getProfessionData(profId)
  if (!prof || !prof.specialties || !specId) return null
  return prof.specialties[specId] || null
}

/**
 * Retorna todos os itens iniciais combinados da especialização (com suporte a customização do Admin)
 */
export function getStarterItems(profId, specId, customConfig = null) {
  if (customConfig && customConfig[`${profId}_${specId}`]) {
    return customConfig[`${profId}_${specId}`].map((item, idx) => ({
      instanceId: `starter_${profId}_${specId}_${idx}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ...item
    }))
  }
  const spec = getSpecialtyData(profId, specId)
  if (!spec || !spec.starterItems) return []
  return spec.starterItems.map((item, idx) => ({
    instanceId: `starter_${profId}_${specId}_${idx}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    ...item
  }))
}

/**
 * Calcula o bônus combinado de profissão + especialidade
 */
export function calculateProfessionBonuses(profId, specId) {
  const bonuses = {
    forca: 0,
    destreza: 0,
    agilidade: 0,
    sabedoria: 0,
    percepcao: 0,
    inteligencia: 0,
    carisma: 0,
    constituicao: 0,
  }

  const prof = getProfessionData(profId)
  if (prof?.bonus) {
    Object.entries(prof.bonus).forEach(([attr, val]) => {
      if (bonuses[attr] !== undefined) bonuses[attr] += val
    })
  }

  const spec = getSpecialtyData(profId, specId)
  if (spec?.bonus) {
    Object.entries(spec.bonus).forEach(([attr, val]) => {
      if (bonuses[attr] !== undefined) bonuses[attr] += val
    })
  }

  return bonuses
}

/**
 * Calcula atributos totais com detalhamento (Profissão + Especialidade + Traços + Penalidades)
 */
export function getDetailedAttributes(baseAttributes = {}, profId, specId, penalties = {}, traitModifiers = {}) {
  const prof = getProfessionData(profId)
  const spec = getSpecialtyData(profId, specId)

  return ATTRIBUTE_LIST.map(({ key, label, icon, color, desc }) => {
    const base = Number(baseAttributes[key] ?? 1)
    const profBonus = prof?.bonus?.[key] || 0
    const specBonus = spec?.bonus?.[key] || 0
    const traitBonus = Number(traitModifiers[key] || 0)
    const totalBonus = profBonus + specBonus + traitBonus
    const penalty = penalties[key] || 0
    const total = base + totalBonus + penalty  // SEM clamp: atributos podem ser negativos

    return {
      key,
      label,
      icon,
      color,
      desc,
      base,
      profBonus,
      specBonus,
      traitBonus,
      totalBonus,
      penalty,
      total,
      hasProfBonus: profBonus > 0,
      hasSpecBonus: specBonus > 0,
      hasTraitBonus: traitBonus !== 0,
      isDebuffed: penalty < 0 || traitBonus < 0,
      isNegative: (base + totalBonus + penalty) < 0,
    }
  })
}
