export const DEFAULT_RULES_CONFIG = {
  hero: {
    tag: 'MANUAL DO SOBREVIVENTE // PROTOCOLO DE VAREZHIA',
    title: 'REGRAS DO SISTEMA',
    description: 'Em Zona Zero, a sobrevivência é orientada por consequências narrativas, gestão de riscos e aprendizado contínuo. Aqui, sua profissão determina seu ponto de partida, seus ferimentos contam uma história e a morte é o ápice da tensão.',
    stats: [
      { num: '7', lbl: 'Profissões' },
      { num: '21+', lbl: 'Especializações' },
      { num: '80 XP', lbl: 'Por Nível' },
      { num: '24h = 2d', lbl: 'Tempo OFF/ON' }
    ]
  },
  professionsIntro: {
    title: '🧬 A Filosofia das Profissões (Estilo Project Zomboid)',
    description: 'No universo de Zona Zero, a profissão não é uma classe fixa engessada. Ela representa o passado do seu personagem: quem ele era antes do colapso e aquilo em que se destacava. Um Médico ainda pode aprender a disparar fuzis com precisão militar, e um Militar pode aprender mecânica ou agricultura conforme sobrevive.'
  },
  professions: [
    {
      id: 'militar',
      name: 'Militar',
      icon: '🪖',
      color: '#ef4444',
      badge: '🎖️ Forças Armadas & Segurança',
      attrBonus: '+2 Força',
      summary: 'Profissão voltada para combate tático, disciplina rigorosa, resistência física e uso eficiente de armas. Militares enfrentam infectados e ameaças com determinação letal.',
      quote: '"No caos, a disciplina é a única linha entre a vida e a morte."',
      specialties: [
        {
          id: 'policial',
          name: 'Policial',
          icon: '👮',
          attrBonus: '+1 Força',
          proficiencies: ['Armas de fogo leves (pistolas e submetralhadoras)', 'Procedimentos policiais e protocolos de segurança'],
          starterEquipment: ['Pistola 9mm (x1)', 'Caixa de Munição 9mm (x1)', 'Colete Policial Balístico (x1)', 'Algemas de Aço (x1)'],
          perks: ['Proficiência com armas de fogo leves (pistolas e submetralhadoras)', 'Conhecimento de protocolos policiais e procedimentos de segurança', 'Técnicas de imobilização e contenção']
        },
        {
          id: 'bombeiro',
          name: 'Bombeiro',
          icon: '🔥',
          attrBonus: '+1 Força',
          proficiencies: ['Machados pesados e arrombamento estrutural', 'Resgate em ambientes asfixiantes'],
          starterEquipment: ['Machado de Incêndio (x1)', 'Uniforme de Proteção Térmica (x1)', 'Máscara Respiratória (x1)', 'Lanterna Portátil Reforçada (x1)'],
          perks: ['Proficiência extrema com machados e marretas', 'Maior facilidade e rapidez para arrombar portas e escombros', 'Resistência básica a fumaça e ambientes asfixiantes']
        },
        {
          id: 'sargento',
          name: 'Sargento',
          icon: '🎖️',
          attrBonus: '+1 Força',
          proficiencies: ['Armamentos militares pesados (Fuzis)', 'Comando tático e patrulha'],
          starterEquipment: ['Fuzil Militar Tático (x1)', 'Munição Militar 5.56mm (x1)', 'Traje Militar Camuflado (x1)', 'Faca de Combate Militar (x1)'],
          perks: ['Proficiência com fuzis táticos e armamento pesado', 'Conhecimento de patrulha, formações defensivas e liderança de esquadrão', 'Táticas avançadas de sobrevivência em zonas de combate']
        }
      ]
    },
    {
      id: 'medico',
      name: 'Médico',
      icon: '🩺',
      color: '#38bdf8',
      badge: '💉 Saúde & Bio-Emergência',
      attrBonus: '+2 Sabedoria',
      summary: 'Profissionais acostumados a lidar com ferimentos, infecções, medicamentos e traumas críticos. São vitais para manter qualquer grupo de sobreviventes vivo.',
      quote: '"Sangramento estancado a tempo é a diferença entre um companheiro vivo e mais um corpo."',
      specialties: [
        {
          id: 'medico_clinico',
          name: 'Médico Clínico',
          icon: '🩺',
          attrBonus: '+1 Sabedoria',
          proficiencies: ['Cirurgias de campo e diagnósticos avançados', 'Tratamento de infecções graves'],
          starterEquipment: ['Kit Médico Avançado (x1)', 'Remédios Básicos (x2)', 'Bandagem Estéril (x3)', 'Álcool 70% (x1)'],
          perks: ['Maior eficiência e rendimento ao tratar ferimentos graves', 'Capacidade de realizar cirurgias de campo e suturas avançadas', 'Diagnóstico precoce de sintomas infecciosos']
        },
        {
          id: 'socorrista',
          name: 'Socorrista',
          icon: '🚑',
          attrBonus: '+1 Agilidade',
          proficiencies: ['Intervenção médica de emergência e resgate veloz', 'Estabilização de feridos sob fogo'],
          starterEquipment: ['Kit de Primeiros Socorros (x1)', 'Bandagem Estéril (x4)', 'Remédios Básicos (x2)'],
          perks: ['Tratamento ultrarrápido de hemorragias em combate', 'Capacidade de estabilizar aliados em estado crítico ou inconscientes', 'Agilidade superior para manobras de resgate sob fogo cruzado']
        },
        {
          id: 'farmaceutico',
          name: 'Farmacêutico',
          icon: '🧪',
          attrBonus: '+1 Sabedoria',
          proficiencies: ['Química medicinal e síntese de fármacos', 'Purificação de compostos'],
          starterEquipment: ['Bolsa Farmacêutica (x1)', 'Remédios Básicos (x3)', 'Álcool 70% (x2)'],
          perks: ['Identificação precisa da eficácia e pureza de fármacos', 'Melhor aproveitamento de dosagens sem desperdício', 'Capacidade de sintetizar medicamentos e antissépticos básicos']
        }
      ]
    },
    {
      id: 'mecanico',
      name: 'Mecânico',
      icon: '🔧',
      color: '#f59e0b',
      badge: '⚙️ Engenharia & Maquinário',
      attrBonus: '+2 Inteligência',
      summary: 'Essenciais para o funcionamento do mundo: consertam veículos, operam geradores elétricos e constroem defesas sólidas contra hordas.',
      quote: '"Quem controla a energia e os motores controla o mapa."',
      specialties: [
        {
          id: 'mecanico_auto',
          name: 'Mecânico Automotivo',
          icon: '🔧',
          attrBonus: '+1 Inteligência',
          proficiencies: ['Mecânica a combustão e motores', 'Manutenção e ignição veicular'],
          starterEquipment: ['Maleta de Ferramentas Pro (x1)', 'Galão de Combustível (Cheio) (x1)', 'Luvas de Proteção Reforçadas (x1)'],
          perks: ['Capacidade de consertar e reativar veículos abandonados', 'Maior eficiência e rendimento ao reparar peças mecânicas', 'Conhecimento detalhado de sistemas de ignição e combustível']
        },
        {
          id: 'engenheiro',
          name: 'Engenheiro',
          icon: '⚙️',
          attrBonus: '+1 Inteligência',
          proficiencies: ['Sistemas elétricos, redes e circuitos de energia', 'Maquinário industrial'],
          starterEquipment: ['Estojo de Ferramentas Técnicas (x1)', 'Extensão Elétrica Industrial (x1)', 'Pilhas e Baterias (x2)'],
          perks: ['Reparação de máquinas industriais e complexas', 'Instalação e manutenção de geradores e redes elétricas', 'Análise estrutural de integridade de construções']
        },
        {
          id: 'construtor',
          name: 'Construtor',
          icon: '🏗️',
          attrBonus: '+1 Força',
          proficiencies: ['Alvenaria, carpintaria e fortificações', 'Barricadas e defesas estruturais'],
          starterEquipment: ['Martelo de Orelha Pesado (x1)', 'Caixa de Pregos e Parafusos (x2)', 'Tábuas de Madeira Tratada (x3)', 'Fita Adesiva Reforçada (x1)'],
          perks: ['Construção e reforço de barricadas duradouras', 'Maior velocidade e menor custo de material para obras', 'Criação de estruturas seguras e portões defensivos']
        }
      ]
    },
    {
      id: 'cacador',
      name: 'Caçador',
      icon: '🎯',
      color: '#10b981',
      badge: '🌲 Sobrevivência Selvagem & Rastreio',
      attrBonus: '+2 Percepção',
      summary: 'Inspirado na sobrevivência bruta de ermos: sabem rastrear alvos, encontrar água pura, caçar presas e sobreviver longe de qualquer cidade.',
      quote: '"Na floresta, ou você observa primeiro, ou se torna a presa."',
      specialties: [
        {
          id: 'cacador_selvagem',
          name: 'Caçador',
          icon: '🎯',
          attrBonus: '+1 Percepção',
          proficiencies: ['Armas de caça e tiro de longa distância', 'Rastreamento de animais e presas'],
          starterEquipment: ['Rifle de Caça com Luneta (x1)', 'Caixa de Cartuchos de Caça (x1)', 'Faca de Caça Afiada (x1)'],
          perks: ['Proficiência completa com rifles de ferrolho e arcos', 'Rastreamento apurado de animais e presas selvagens', 'Maior aproveitamento de carne limpa e couros']
        },
        {
          id: 'mateiro',
          name: 'Mateiro',
          icon: '🌲',
          attrBonus: '+1 Constituição',
          proficiencies: ['Sobrevivência em biomas selvagens e botânica', 'Orientação natural e acampamentos'],
          starterEquipment: ['Mochila Tática de Mateiro (x1)', 'Faca de Sobrevivência (x1)', 'Isqueiro e Fósforos Impermeáveis (x1)', 'Rolo de Corda de Nylon (x1)'],
          perks: ['Identificação confiável de plantas, raízes e cogumelos comestíveis', 'Melhor aproveitamento de recursos naturais e fontes de água', 'Resistência superior a intempéries e noites ao ar livre']
        },
        {
          id: 'trapper',
          name: 'Trapper',
          icon: '🐺',
          attrBonus: '+1 Percepção',
          proficiencies: ['Manufatura de armadilhas mecânicas', 'Curtimento e extração animal'],
          starterEquipment: ['Kit de Armadilhas Mecânicas (x2)', 'Canivete Multiuso (x1)', 'Rolo de Corda de Nylon (x1)'],
          perks: ['Fabricação e desarme de armadilhas mecânicas', 'Captura eficiente de pequenos e médios animais', 'Conhecimento de extração de peles, ossos e tendões']
        }
      ]
    },
    {
      id: 'agricultor',
      name: 'Agricultor',
      icon: '🌾',
      color: '#eab308',
      badge: '🌱 Produção & Sustentabilidade',
      attrBonus: '+2 Constituição',
      summary: 'Enquanto a maioria disputa restos industrializados, o agricultor produz comida, cuida de animais e garante a renovação dos recursos da comunidade.',
      quote: '"As latas de comida vão acabar. Quem souber plantar herdará a terra."',
      specialties: [
        {
          id: 'agricultor_cultivo',
          name: 'Agricultor',
          icon: '🌾',
          attrBonus: '+1 Constituição',
          proficiencies: ['Cultivo, botânica aplicada e horticultura', 'Rotação de culturas e plantio'],
          starterEquipment: ['Conjunto de Ferramentas Agrícolas (x1)', 'Pacote de Sementes Mistas (x3)', 'Garrafa de Água Potável (x2)'],
          perks: ['Técnicas avançadas de plantio e rotação de culturas', 'Melhor aproveitamento e multiplicação de sementes', 'Identificação do ciclo de colheita e saúde do solo']
        },
        {
          id: 'pecuarista',
          name: 'Pecuarista',
          icon: '🐄',
          attrBonus: '+1 Constituição',
          proficiencies: ['Manejo animal e veterinária básica', 'Comportamento de animais silvestres e de criação'],
          starterEquipment: ['Luvas de Couro de Trabalho (x1)', 'Rolo de Corda Resistente (x1)', 'Faca Utilitária (x1)'],
          perks: ['Cuidados, alimentação e reprodução de animais de abate/trabalho', 'Produção e extração de laticínios, ovos e derivados', 'Conhecimento do comportamento de animais silvestres e domesticados']
        },
        {
          id: 'produtor_alimentos',
          name: 'Produtor Culinário',
          icon: '🍞',
          attrBonus: '+1 Inteligência',
          proficiencies: ['Conservação, secagem e fermentação de alimentos', 'Preparo de rações nutritivas'],
          starterEquipment: ['Panela de Ferro Culinária (x1)', 'Abridor de Latas (x1)', 'Pacote de Mantimentos (x2)', 'Isqueiro e Fósforos (x1)'],
          perks: ['Conservação de alimentos sem necessidade de refrigeração', 'Técnicas de fermentação, defumação, desidratação e salga', 'Preparo de rações concentradas e nutritivas']
        }
      ]
    },
    {
      id: 'cientista',
      name: 'Cientista',
      icon: '🔬',
      color: '#a855f7',
      badge: '🧪 Pesquisa, Bio-Análise & Tecnologia',
      attrBonus: '+2 Inteligência',
      summary: 'Indivíduos com conhecimento acadêmico avançado para decifrar a origem do vírus, analisar mutações, manipular produtos químicos e quebrar códigos.',
      quote: '"O vírus obedece a leis biológicas. Se entendermos o código, podemos resistir."',
      specialties: [
        {
          id: 'quimico',
          name: 'Químico',
          icon: '🧪',
          attrBonus: '+1 Inteligência',
          proficiencies: ['Síntese química e compostos voláteis', 'Neutralização de substâncias perigosas'],
          starterEquipment: ['Equipamento Químico Portátil (x1)', 'Álcool 70% (x2)', 'Máscara com Filtro Químico (x1)'],
          perks: ['Manipulação e neutralização de substâncias perigosas', 'Fabricação de compostos químicos, explosivos e desinfetantes', 'Identificação precisa de misturas e compostos tóxicos']
        },
        {
          id: 'pesquisador',
          name: 'Pesquisador',
          icon: '🔬',
          attrBonus: '+1 Sabedoria',
          proficiencies: ['Análise documental e investigação biológica', 'Padrões de mutações'],
          starterEquipment: ['Caderno de Anotações & Lupa (x1)', 'Óculos de Alta Precisão (x1)', 'Lanterna UV / Portátil (x1)'],
          perks: ['Análise de relatórios científicos, registros de quarentena e mapas', 'Interpretação de dados de amostras de infectados', 'Identificação de fraquezas e padrões comportamentais de mutações']
        },
        {
          id: 'analista_ti',
          name: 'Analista de TI',
          icon: '💻',
          attrBonus: '+1 Inteligência',
          proficiencies: ['Sistemas eletrônicos, criptografia e bancos de dados', 'Hackeamento de terminais'],
          starterEquipment: ['Notebook Tático Operacional (x1)', 'Smartphone Desbloqueado (x1)', 'Carregador Solar e Cabos (x1)', 'Pilhas e Baterias (x2)'],
          perks: ['Hackeamento e acesso a terminais e sistemas de segurança trancados', 'Recuperação de dados e registros em computadores danificados', 'Manutenção e reconfiguração de equipamentos eletrônicos']
        }
      ]
    },
    {
      id: 'sobrevivente',
      name: 'Sobrevivente',
      icon: '🏕️',
      color: '#22c55e',
      badge: '🔪 Resiliência Urbana & Prática',
      attrBonus: '+1 Constituição | +1 Percepção',
      summary: 'A profissão civil mais pura: sem teorias militares ou acadêmicas, aprendeu na marra a resistir ao caos diário com astúcia, adaptação e força de vontade.',
      quote: '"Eu não era militar nem médico. Só me recusei a morrer."',
      specialties: [
        {
          id: 'preparador',
          name: 'Preparador (Prepper)',
          icon: '🏕️',
          attrBonus: '+1 Percepção',
          proficiencies: ['Logística de mantimentos e capacidade de carga', 'Rotas de fuga urbanas'],
          starterEquipment: ['Mochila Resistente (x1)', 'Comida Enlatada (x2)', 'Garrafa de Água Potável (x2)', 'Lanterna Portátil (x1)'],
          perks: ['Excelente organização de mochila e capacidade de carga expandida', 'Início com reserva sólida de mantimentos e utilitários', 'Orientação rápida em rotas de fuga urbanas']
        },
        {
          id: 'sobrevivencialista',
          name: 'Sobrevivencialista',
          icon: '🔪',
          attrBonus: '+1 Percepção',
          proficiencies: ['Bushcraft, fogueiras rápidas e coleta urbana', 'Abrigos improvisados em ruínas'],
          starterEquipment: ['Faca Utilitária Afiada (x1)', 'Isqueiro e Fósforos (x1)', 'Rolo de Corda (x1)', 'Fita Adesiva Reforçada (x1)'],
          perks: ['Acendimento veloz de fogueiras e fontes de calor seguras', 'Montagem rápida de abrigos improvisados em ruínas', 'Eficiência em vasculhas de sucatas e materiais reaproveitáveis']
        },
        {
          id: 'negociador',
          name: 'Negociador',
          icon: '🗣️',
          attrBonus: '+1 Carisma',
          proficiencies: ['Diplomacia, persuasão e comércio', 'Poder de barganha'],
          starterEquipment: ['Notas e Títulos Comerciais (x5)', 'Isqueiro de Colecionador (x1)', 'Vidro de Perfume Preservado (x1)', 'Relógio de Pulso Analógico (x1)'],
          perks: ['Maior facilidade em interações pacíficas e diplomáticas com NPCs', 'Poder de barganha: melhores preços e trocas no comércio', 'Começa com pequenos recursos comerciais de alto valor de troca']
        }
      ]
    }
  ],
  progression: {
    introTitle: '📈 Sistema de Progressão & Economia de XP',
    introText: 'O ganho de XP em Varezhia não é um troféu por acumular mortes. É a representação literal da experiência adquirida ao sobreviver: investigar mistérios, participar de tramas com a comunidade, treinar e escapar com vida de emboscadas mortais.',
    baseXpPerLevel: 80,
    attrPointsPerLevel: 6,
    maxAttrInvestPerLevel: 3,
    rublesPerLevel: 200,
    difficulties: [
      {
        id: 'green',
        name: 'Fácil // Risco Baixo',
        tag: '🟢 NÍVEL VERDE',
        color: '#22c55e',
        description: 'Atividades ideais para iniciantes e suprimentos básicos. Coletas comunitárias, pequenas entregas urbanas, exploração de áreas seguras.',
        xpRange: '5 a 15 XP',
        footer: 'A morte não é uma consequência esperada neste nível.'
      },
      {
        id: 'yellow',
        name: 'Intermediário // Sobrevivência Real',
        tag: '🟡 NÍVEL AMARELO',
        color: '#eab308',
        description: 'Presença constante de infectados, animais selvagens, bandidos armados, radiação leve e falta de alimentos.',
        xpRange: '15 a 35 XP',
        footer: 'Ferimentos graves e sangramentos são comuns. A morte é possível.'
      },
      {
        id: 'red',
        name: 'Profissional // Risco Extremo',
        tag: '🔴 NÍVEL VERMELHO',
        color: '#ef4444',
        description: 'Bases militares fechadas, hospitais em colapso, zonas de alta contaminação e confronto com facções fortemente armadas.',
        xpRange: '35 a 60+ XP (Tramas: 80+ XP)',
        footer: 'Não há garantia de sobrevivência. Entre sabendo que seu personagem pode morrer.'
      }
    ],
    soloGroupTable: [
      { diff: '🟢 Verde', solo: '5 – 10 XP', group: '8 – 12 XP' },
      { diff: '🟡 Amarelo', solo: '15 – 20 XP', group: '20 – 25 XP' },
      { diff: '🔴 Vermelho', solo: '30 – 40 XP', group: '35 – 50 XP' }
    ],
    trainingTable: [
      { type: 'Treino Simples (Tiro ao alvo, corrida)', xp: '3 – 5 XP' },
      { type: 'Treino Especializado (Cirurgia, mecânica)', xp: '5 – 8 XP' },
      { type: 'Treino Avançado com Mentor/Guia', xp: '8 – 12 XP' },
      { type: 'Treinamento Narrativo Especial', xp: '10 – 15 XP' }
    ],
    plotsTable: [
      { scope: 'Trama Secundária (Guilda / Mistério local)', reward: '20 – 40 XP' },
      { scope: 'Trama Regional (Afeta toda uma Oblast)', reward: '40 – 60 XP' },
      { scope: 'Trama Principal (História Central de Varezhia)', reward: '50 – 80 XP' },
      { scope: 'Grande Arco Narrativo de Conclusão', reward: '80 – 150 XP' }
    ],
    specialFeats: [
      'Sobreviver sozinho a uma emboscada crítica: +5 XP',
      'Salvar um companheiro arriscando a própria vida: +5 XP',
      'Descobrir segredo vital para a trama principal: +5 XP',
      'Solução criativa inesperada para contornar perigo: +3 a 5 XP',
      'Ação que altera o rumo político de uma facção: +5 a 10 XP'
    ],
    failureRules: [
      'Sucesso Completo: 100% do XP',
      'Sucesso Parcial com perdas: 75% do XP',
      'Fracasso com fuga e ferimentos: 50% do XP',
      'Abandono precoce: 25% do XP',
      'Ausência / Sem engajamento real: 0 XP'
    ]
  },
  combat: {
    introTitle: '🩸 Sistema Vital, Ferimentos e Balística',
    introText: 'Em Zona Zero, o combate segue a cadeia lógica: Ação ➔ Dano ➔ HP ➔ Condição ➔ Agravamento ➔ Incapacitação ➔ Morte. Uma bala não apenas remove pontos de vida: ela rasga tecidos, causa hemorragias ativas e fratura ossos, exigindo intervenção médica imediata.',
    vitalStates: [
      { tag: '🟢 100% a 61% — ESTÁVEL', color: 'green', desc: 'O personagem está funcional. Pode correr, disparar com precisão e realizar manobras táticas sem penalidades.' },
      { tag: '🟡 60% a 31% — FERIDO', color: 'yellow', desc: 'Dor e sangramento leve. Penalidades situacionais em testes físicos de agilidade ou esforço prolongado.' },
      { tag: '🟠 30% a 11% — CRÍTICO', color: 'orange', desc: 'Ferimentos graves. Correr torna-se muito difícil, risco de tontura/choque, sangramentos aceleram a perda de sangue.' },
      { tag: '🔴 10% a 1% — INCAPACITADO', color: 'red', desc: 'À beira do desmaio. Qualquer golpe adicional ou perda por hemorragia derruba o personagem a 0 HP.' },
      { tag: '☠️ 0 HP — ESTADO MORIBUNDO', color: 'black', desc: 'O personagem cai no chão inconsciente. Inicia-se o Contador de Morte de 3 Turnos. Se não for estabilizado com primeiros socorros: MORTE.' }
    ],
    bleedLevels: [
      { name: '🩸 Sangramento I — Leve', decay: '-2 HP por turno (Decai a cada 30 min OFF)', desc: 'Pode ser estancado rapidamente com bandagem simples, pano limpo ou curativo rápido.' },
      { name: '🩸🩸 Sangramento II — Moderado', decay: '-4 HP por turno (Decai a cada 25 min OFF)', desc: 'Causado por tiros ou facadas no torso. Sem tratamento, 10 turnos tiram 40 de HP.' },
      { name: '🩸🩸🩸 Sangramento III — Grave', decay: '-7 HP por turno (Decai a cada 20 min OFF)', desc: 'Rompimento vascular severo. Um personagem com 100 HP morre em cerca de 14 turnos sem torniquete cirúrgico.' },
      { name: '🩸🩸🩸🩸 Sangramento IV — Arterial', decay: '-10 HP por turno (Decai a cada 15 min OFF)', desc: 'Hemorragia desesperadora. O personagem perde a consciência em minutos se um médico não estancar imediatamente.' }
    ],
    weapons: [
      { cat: 'Corpo a Corpo', name: 'Facas e Adagas Táticas', dmg: '8 – 16', effect: 'Silencioso + Sangramento Leve' },
      { cat: 'Corpo a Corpo', name: 'Machados & Marretas Pesadas', dmg: '18 – 35', effect: 'Quebra de ossos + Atordoamento' },
      { cat: 'Arma de Fogo', name: 'Pistolas (9mm, .45, Revólver)', dmg: '18 – 32', effect: 'Perfuração balística + Sangramento II' },
      { cat: 'Arma de Fogo', name: 'Rifles & Fuzis de Assalto', dmg: '35 – 45', effect: 'Perfura coletes leves + Sangramento III' },
      { cat: 'Arma de Fogo', name: 'Rifle de Sniper / Caça Pesada', dmg: '45 – 60', effect: 'Dano massivo, letal se atingir a cabeça' },
      { cat: 'Arma de Fogo', name: 'Espingarda Calibre 12', dmg: '45 – 65 (Curta) / 25 – 45 (Média)', effect: 'Dispersão de estilhaços e derrubada' },
      { cat: 'Silenciosa', name: 'Arco & Flechas de Caça', dmg: '15 – 30', effect: 'Disparo furtivo silencioso + Sangramento I/II' },
      { cat: 'Infectados', name: 'Mordida de Zumbi', dmg: '10 – 25', effect: 'Aplica a condição INFECÇÃO STRAIN ZERO' }
    ]
  },
  conditions: {
    introTitle: '🧟 O Relógio da Infecção Strain Zero',
    introText: 'Em Zona Zero, ser mordido por um infectado não significa morte imediata no mesmo segundo. Isso destrói o potencial do Roleplay. Em vez disso, a mordida inicia o Relógio Biológico da Infecção. O jogador pode até mesmo esconder a mordida de seus companheiros, criando drama, busca desesperada por antídotos ou despedidas emocionantes.',
    infectionStages: [
      { badge: 'ESTÁGIO 1', time: '6 a 12 Turnos (30 a 60 min)', name: 'Incubação Silenciosa', desc: 'Nenhum sintoma evidente. O sobrevivente age normalmente, mas o vírus já corre pela corrente sanguínea.', danger: false },
      { badge: 'ESTÁGIO 2', time: '12 a 24 Turnos (1 a 2 horas)', name: 'Primeiros Sintomas', desc: 'Febre branda, tremores nas mãos, suor frio e perda leve de concentração. Aplica -1 em Ações Físicas.', danger: false },
      { badge: 'ESTÁGIO 3', time: '24 a 36 Turnos (2 a 3 horas)', name: 'Infecção Avançada', desc: 'Febre intensa, vômitos, desorientação e perda progressiva de vida: -5 HP por turno.', danger: false },
      { badge: 'ESTÁGIO 4', time: '36 a 48 Turnos (3 a 4 horas)', name: 'Falência e Transformação', desc: 'Perda de consciência: -10 HP por turno. Ao atingir 0 HP, ocorre a morte biológica e reanimação como infectado.', danger: true }
    ],
    vitalsDebuffs: [
      {
        icon: '🥶',
        title: 'Hipotermia & Frio',
        desc: 'Causada por chuva, vento e falta de agasalhos adequados.',
        bullets: ['Nível 1 (Frio): -1 em Percepção', 'Nível 2 (Hipotermia): -2 Constituição, -2 Força', 'Nível 3 (Grave): Perde 5 HP por período + Risco de desmaio']
      },
      {
        icon: '💧',
        title: 'Desidratação (Sede)',
        desc: 'A água é mais urgente que a comida no apocalipse.',
        bullets: ['1 Dia sem água: Sede leve, -1 Constituição', '2 Dias sem água: -2 Constituição, -1 Percepção, -5 HP', '3+ Dias sem água: -3 Constituição, -10 HP + Desmaios']
      },
      {
        icon: '🍞',
        title: 'Inanição (Fome)',
        desc: 'A fome é mais lenta, mas debilita as forças musculares.',
        bullets: ['1 Dia sem comida: Apenas desconforto narrativo', '2 Dias: -1 Constituição', '3 a 5 Dias: -3 Força, -2 Constituição e perda de HP']
      },
      {
        icon: '🦴',
        title: 'Fraturas Ósseas',
        desc: 'Resultantes de quedas altas, machadadas ou tiros de fuzil.',
        bullets: ['Fratura no Braço: Impossibilita armas pesadas de duas mãos', 'Fratura na Perna: Corrida proibida, movimento reduzido', 'Tratamento: Exige tala médica + repouso obrigatório']
      }
    ]
  },
  survivalTime: {
    introTitle: '⏱️ Fluxo Temporal ON / OFF & O Sistema de Legado',
    introText: 'No RPG Zona Zero, o tempo do jogo corre na proporção de 1 para 2 (1h OFF = 2h ON / 24h OFF = 2 Dias ON). Isso garante um ritmo dinâmico para viagens entre cidades, descanso em abrigos e ciclos biológicos do personagem.',
    timeConversions: [
      { off: '1h OFF', on: '2h ON', highlight: false },
      { off: '3h OFF', on: '6h ON', highlight: false },
      { off: '6h OFF', on: '12h ON', highlight: false },
      { off: '12h OFF', on: '1 Dia ON (24h)', highlight: true },
      { off: '24h OFF', on: '2 Dias ON (48h)', highlight: true }
    ],
    deathPaths: [
      {
        icon: '🩸',
        title: '1. Perda Gradual de HP (0 HP)',
        desc: 'Quando o HP atinge zero, o sobrevivente entra em Estado Moribundo. Os aliados têm 3 turnos para aplicar torniquetes, cirurgias ou kits de trauma. Se ninguém ajudar a tempo, o personagem morre.'
      },
      {
        icon: '💥',
        title: '2. Trauma Letal Catastrófico',
        desc: 'Eventos extremos que ignoram o contador de 3 turnos: Tiro crítico com fuzil na cabeça, explosão colada ao corpo, decapitação ou queda de alturas extremas (15+ metros). Nesses casos, a morte é instantânea.'
      },
      {
        icon: '🧟',
        title: '3. Infecção Viral Irreversível',
        desc: 'Se o sobrevivente for mordido e o Estágio IV da Infecção Strain Zero se completar sem a descoberta de um tratamento na história, o personagem perece e se junta à horda.'
      }
    ],
    legacy: {
      title: 'A Morte Não é o Fim: Sistema de Legado',
      subtitle: 'O jogador não perde seu investimento no jogo quando seu personagem morre.',
      description: 'Se o seu personagem morreu no Nível 7, seu próximo sobrevivente herda o nível de progressão correspondente e recebe um Legado Narrativo deixado pelo antecessor:',
      perks: [
        { title: '🗝️ Esconderijo Oculto', desc: 'O novo personagem pode começar com a pista de onde o falecido escondeu suprimentos e munição.' },
        { title: '🗺️ Informação Chave', desc: 'Começa sabendo de segredos militares ou rotas que foram descobertas antes da morte.' },
        { title: '🤝 Conexão com Facções', desc: 'Aliados do falecido podem acolher o novo personagem com respeito prévio.' }
      ]
    }
  }
}
