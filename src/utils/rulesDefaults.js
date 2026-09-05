export const DEFAULT_RULES_CONFIG = {
  hero: {
    tag: 'MANUAL DO SOBREVIVENTE // PROTOCOLO DE VAREZHIA',
    title: 'REGRAS DO SISTEMA',
    description: 'Em Zona Zero, a sobrevivência é orientada por consequências narrativas, gestão de riscos e aprendizado contínuo. Aqui, sua profissão determina seu ponto de partida, seus ferimentos contam uma história e a morte é o ápice da tensão.',
    stats: [
      { num: '7', lbl: 'Profissões' },
      { num: '21+', lbl: 'Especializações' },
      { num: '80 XP', lbl: 'Por Nível' },
      { num: '24h = 4d', lbl: 'Tempo OFF/ON' }
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
      icon: '🎖️',
      color: '#ef4444',
      badge: 'Combate & Resistência',
      attrBonus: '+2 Força',
      summary: 'Profissão voltada para combate direto, disciplina marcial, resistência física e domínio de armamentos. Sobrevivem com facilidade a encontros violentos contra infectados e facções hostis.',
      quote: '"No caos, a disciplina é a única linha entre a vida e a morte."',
      specialties: [
        {
          id: 'policial',
          name: 'Policial',
          icon: '👮',
          attrBonus: '+1 Força',
          proficiencies: ['Armas de fogo leves (Pistolas/Revólveres)', 'Procedimentos táticos de segurança'],
          starterEquipment: ['Pistola 9mm policial', 'Colete balístico policial', 'Algemas de contenção', 'Coldre tático'],
          perks: ['Conhecimento básico de contenção e protocolos de segurança urbana', 'Precisão aprimorada com armas curtas']
        },
        {
          id: 'bombeiro',
          name: 'Bombeiro',
          icon: '🔥',
          attrBonus: '+1 Força',
          proficiencies: ['Machados pesados e ferramentas de resgate', 'Arrombamento e demolição rápida'],
          starterEquipment: ['Machado de incêndio pesado', 'Traje de proteção anti-chamas', 'Máscara respiratória de combate'],
          perks: ['Maior eficiência para abrir portas trancadas ou barricadas', 'Resistência a fumaça e ambientes quentes']
        },
        {
          id: 'sargento',
          name: 'Sargento',
          icon: '🎖️',
          attrBonus: '+1 Força',
          proficiencies: ['Armas militares pesadas (Fuzis, Espingardas)', 'Táticas de liderança e esquadrão'],
          starterEquipment: ['Fuzil militar ou arma de guerra inicial', 'Traje camuflado com bolsos táticos', 'Rádio comunicador militar'],
          perks: ['Conhecimento avançado de patrulha e combate coordenado em grupo', 'Bônus de moral para aliados próximos']
        }
      ]
    },
    {
      id: 'medico',
      name: 'Médico',
      icon: '🩺',
      color: '#38bdf8',
      badge: 'Suporte Vital & Ciência',
      attrBonus: '+2 Sabedoria',
      summary: 'Especialistas em tratar traumas, doenças infecciosas e cirurgias de emergência. A espinha dorsal de qualquer refúgio quando remédios e antibióticos se tornam raros.',
      quote: '"Sangramento estancado a tempo é a diferença entre um companheiro vivo e mais um corpo."',
      specialties: [
        {
          id: 'medico_clinico',
          name: 'Médico Cirurgião / Clínico',
          icon: '🩺',
          attrBonus: '+1 Sabedoria',
          proficiencies: ['Cirurgias de campo', 'Procedimentos médicos complexos'],
          starterEquipment: ['Kit cirúrgico profissional', 'Maleta de medicamentos básicos', 'Antibióticos e anestésicos'],
          perks: ['Tratamento de traumas profundos e fraturas expostas', 'Capacidade de salvar personagens moribundos com maior eficácia']
        },
        {
          id: 'socorrista',
          name: 'Socorrista (Paramédico)',
          icon: '🚑',
          attrBonus: '+1 Agilidade',
          proficiencies: ['Primeiros socorros rápidos sob fogo', 'Torniquetes e estabilização'],
          starterEquipment: ['Kit de primeiros socorros de trauma', 'Bandagens compressivas', 'Bolsa de fluidos e analgésicos'],
          perks: ['Estabilização de aliados em estado crítico em metade do tempo', 'Agilidade para alcançar feridos em combate']
        },
        {
          id: 'farmaceutico',
          name: 'Farmacêutico',
          icon: '🧪',
          attrBonus: '+1 Sabedoria',
          proficiencies: ['Química medicinal', 'Síntese e purificação de fármacos'],
          starterEquipment: ['Bolsa farmacêutica hermética', 'Frascos de reagentes e compostos', 'Extratos e desinfetantes concentrados'],
          perks: ['Identificação instantânea de substâncias químicas e remédios vencidos', 'Produção de antídotos e pomadas curativas']
        }
      ]
    },
    {
      id: 'mecanico',
      name: 'Mecânico',
      icon: '🔧',
      color: '#f59e0b',
      badge: 'Engenharia & Infraestrutura',
      attrBonus: '+2 Inteligência',
      summary: 'Peça indispensável no apocalipse. Recuperam veículos blindados, colocam geradores para funcionar, consertam armaduras e transformam sucata em fortificações.',
      quote: '"Quem controla a energia e os motores controla o mapa."',
      specialties: [
        {
          id: 'mecanico_auto',
          name: 'Mecânico Automotivo',
          icon: '🔧',
          attrBonus: '+1 Inteligência',
          proficiencies: ['Motores a combustão', 'Sistemas de transmissão e blindagem de veículos'],
          starterEquipment: ['Jogo de ferramentas mecânicas completo', 'Chave inglesa reforçada', 'Galão de óleo e peças sobressalentes'],
          perks: ['Reparo avançado de carros, motos e caminhões', 'Maior eficiência no consumo de combustível de motores']
        },
        {
          id: 'engenheiro',
          name: 'Engenheiro Eletromecânico',
          icon: '⚙️',
          attrBonus: '+1 Inteligência',
          proficiencies: ['Geradores industriais', 'Sistemas elétricos e circuitos de segurança'],
          starterEquipment: ['Multímetro e alicates de precisão', 'Caixa de fusíveis e fios de cobre', 'Ferramentas técnicas avançadas'],
          perks: ['Restauração de energia em bunkers e hospitais', 'Capacidade de sabotar ou ligar sistemas eletrônicos']
        },
        {
          id: 'construtor',
          name: 'Construtor / Barricador',
          icon: '🏗️',
          attrBonus: '+1 Força',
          proficiencies: ['Fortificações e carpintaria pesada', 'Alvenaria e reforço estrutural'],
          starterEquipment: ['Pé de cabra de aço', 'Marreta e pregos industriais', 'Cinto de ferramentas de construção'],
          perks: ['Construção de barricadas com 50% mais resistência a hordas', 'Eficiência dobrada no uso de tábuas e metais']
        }
      ]
    },
    {
      id: 'cacador',
      name: 'Caçador',
      icon: '🎯',
      color: '#10b981',
      badge: 'Rastreamento & Vida Selvagem',
      attrBonus: '+2 Percepção',
      summary: 'Inspirado nos sobreviventes clássicos de DayZ. Sabem se camuflar na floresta, rastrear animais e hostis, produzir arcos e conseguir comida limpa longe dos centros urbanos.',
      quote: '"Na floresta, ou você observa primeiro, ou se torna a presa."',
      specialties: [
        {
          id: 'cacador_atirador',
          name: 'Caçador Rastreador',
          icon: '🎯',
          attrBonus: '+1 Percepção',
          proficiencies: ['Rifles de ferrolho e arcos', 'Tiroteio furtivo e identificação de pegadas'],
          starterEquipment: ['Rifle de caça / Arco com flechas', 'Binóculo de precisão', 'Faca de esfolar'],
          perks: ['Rastreamento de animais e sobreviventes pelo terreno', 'Maior rendimento de carne e couro limpo ao caçar']
        },
        {
          id: 'mateiro',
          name: 'Mateiro (Guia Florestal)',
          icon: '🌲',
          attrBonus: '+1 Constituição',
          proficiencies: ['Botânica de sobrevivência', 'Orientação em ermos e acampamentos seguros'],
          starterEquipment: ['Mochila de sobrevivência militar', 'Cantil com filtro', 'Pederneira e corda reforçada'],
          perks: ['Identificação imediata de plantas comestíveis e venenosas', 'Resistência natural a intempéries da floresta']
        },
        {
          id: 'trapper',
          name: 'Trapper (Armadilheiro)',
          icon: '🐺',
          attrBonus: '+1 Percepção',
          proficiencies: ['Armadilhas mecânicas', 'Iscas e captura de presas'],
          starterEquipment: ['Kit de arames de disparo', 'Armadilhas de urso / laços de aço', 'Faca de caça'],
          perks: ['Fabricação e desarme de armadilhas em portas e trilhas', 'Coleta passiva de pequenos animais para alimentação']
        }
      ]
    },
    {
      id: 'agricultor',
      name: 'Agricultor',
      icon: '🌾',
      color: '#eab308',
      badge: 'Produção Sustentável & Alimentos',
      attrBonus: '+2 Constituição',
      summary: 'Enquanto a maioria saqueia enlatados vencidos, o agricultor produz comida fresca, cria animais e garante a renovação calórica da comunidade.',
      quote: '"As latas de comida vão acabar. Quem souber plantar herdará a terra."',
      specialties: [
        {
          id: 'cultivador',
          name: 'Agricultor Cultivador',
          icon: '🌾',
          attrBonus: '+1 Constituição',
          proficiencies: ['Horticultura', 'Sistemas de irrigação e adubagem'],
          starterEquipment: ['Enxada / Pá reforçada', 'Saco de sementes variadas', 'Fertilizante orgânico', 'Luvas de couro'],
          perks: ['Colheitas com ciclo acelerado e sem pragas', 'Maximização de sementes recuperadas']
        },
        {
          id: 'pecuarista',
          name: 'Pecuarista',
          icon: '🐄',
          attrBonus: '+1 Constituição',
          proficiencies: ['Manejo de rebanhos', 'Tratamento de animais domésticos'],
          starterEquipment: ['Laço de contenção', 'Sal mineral', 'Capa de chuva resistente', 'Botas de fazenda'],
          perks: ['Criação e ordenha de animais sem perda por contaminação', 'Uso de tração animal para transporte de carga']
        },
        {
          id: 'produtor_alimentos',
          name: 'Produtor / Conservador',
          icon: '🍞',
          attrBonus: '+1 Inteligência',
          proficiencies: ['Desidratação e defumação', 'Conservas, fermentação e estoques de longo prazo'],
          starterEquipment: ['Potes de vidro herméticos', 'Sal de cura', 'Facas de corte e utensílios culinários'],
          perks: ['Alimentos conservados duram meses sem apodrecer', 'Maior ganho de energia e hidratação nas refeições preparadas']
        }
      ]
    },
    {
      id: 'cientista',
      name: 'Cientista',
      icon: '🔬',
      color: '#a855f7',
      badge: 'Pesquisa Viral & Tecnologia',
      attrBonus: '+2 Inteligência',
      summary: 'Compreendem a biologia do patógeno Strain Zero, formulam reagentes químicos, operam terminais de segurança militar e decodificam relatórios governamentais.',
      quote: '"O vírus obedece a leis biológicas. Se entendermos o código, podemos resistir."',
      specialties: [
        {
          id: 'quimico',
          name: 'Químico de Laboratório',
          icon: '🧪',
          attrBonus: '+1 Inteligência',
          proficiencies: ['Manipulação de reagentes voláteis', 'Purificação de compostos e solventes'],
          starterEquipment: ['Kit químico portátil', 'Ácido / Solventes em frascos reforçados', 'Óculos de proteção'],
          perks: ['Fabricação de combustíveis, explosivos controlados e neutralizadores', 'Identificação de contaminação química na água']
        },
        {
          id: 'pesquisador',
          name: 'Pesquisador Viral',
          icon: '🔬',
          attrBonus: '+1 Sabedoria',
          proficiencies: ['Análise de amostras biológicas', 'Microscopia e documentação técnica'],
          starterEquipment: ['Microscópio de campo', 'Amostradores de tecido', 'Relatórios científicos confidenciais'],
          perks: ['Interpretação de documentos em laboratórios abandonados', 'Diagnóstico preciso dos estágios da infecção zumbi']
        },
        {
          id: 'analista_sistemas',
          name: 'Analista de Sistemas / Hacker',
          icon: '💻',
          attrBonus: '+1 Inteligência',
          proficiencies: ['Hardware e servidores', 'Bancos de dados e sistemas criptografados'],
          starterEquipment: ['Terminal portátil / Notebook militar', 'Cabos e cartões de acesso', 'Pendrive com rotinas de bypass'],
          perks: ['Desbloqueio de portas eletrônicas e cofres digitais', 'Recuperação de logs e coordenadas em computadores militares']
        }
      ]
    },
    {
      id: 'sobrevivente_civil',
      name: 'Sobrevivente',
      icon: '🎒',
      color: '#22c55e',
      badge: 'Versatilidade & Resiliência Urbana',
      attrBonus: '+1 Constituição | +1 Percepção',
      summary: 'O cidadão comum que aprendeu na marra a resistir. Altamente adaptável, com grande instinto de autopreservação, capacidade de carga e lábia para negociações.',
      quote: '"Eu não era militar nem médico. Só me recusei a morrer."',
      specialties: [
        {
          id: 'preparador',
          name: 'Preparador (Prepper)',
          icon: '🏕️',
          attrBonus: '+1 Percepção',
          proficiencies: ['Logística de suprimentos', 'Navegação urbana e esconderijos'],
          starterEquipment: ['Mochila cargueira de grande capacidade', 'Rações de emergência e canivete suíço', 'Mapa anotado com rotas de fuga'],
          perks: ['+25% de capacidade de carga no inventário', 'Inicia com estoques extras de água e enlatados']
        },
        {
          id: 'sobrevivencialista',
          name: 'Sobrevivencialista',
          icon: '🔪',
          attrBonus: '+1 Percepção',
          proficiencies: ['Fogueiras rápidas', 'Refúgios improvisados e coleta de sucata'],
          starterEquipment: ['Facão de sobrevivência', 'Isqueiro e pederneira', 'Lona plástica reforçada'],
          perks: ['Montagem de abrigos contra chuva e vento em minutos', 'Coleta de materiais com maior facilidade em escombros']
        },
        {
          id: 'negociador',
          name: 'Negociador / Comerciante',
          icon: '🗣️',
          attrBonus: '+1 Carisma',
          proficiencies: ['Barganha e diplomacia', 'Avaliação de valor de itens raros'],
          starterEquipment: ['Bolsa de moedas (Novos Rúblos extras)', 'Bens de alto valor de troca (cigarros, pilhas)', 'Rádio receptor'],
          perks: ['Desconto de 15% nas lojas de NPCs e bônus na venda de itens', 'Melhor interação narrativa com facções neutras']
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
      { cat: 'Branca Leve', name: 'Soco / Chute / Improvisada', dmg: '3 – 10', effect: 'Trauma leve, atordoamento em teste' },
      { cat: 'Branca Média', name: 'Faca de Combate / Pé de Cabra', dmg: '12 – 18', effect: 'Perfuração rápida, Sangramento I' },
      { cat: 'Branca Pesada', name: 'Machado de Incêndio / Espada', dmg: '18 – 35', effect: 'Trauma severo, alto risco de fratura óssea' },
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
    introText: 'No RPG Zona Zero, o tempo do jogo corre na proporção estabelecida de 24 horas OFF (Tempo Real) = 4 dias ON (Tempo de Jogo). Isso garante que viagens entre cidades, descanso em abrigos e ciclos biológicos façam sentido e tenham peso real.',
    timeConversions: [
      { off: '1h OFF', on: '4h ON', highlight: false },
      { off: '3h OFF', on: '12h ON', highlight: false },
      { off: '6h OFF', on: '1 Dia ON', highlight: false },
      { off: '12h OFF', on: '2 Dias ON', highlight: true },
      { off: '24h OFF', on: '4 Dias ON', highlight: true }
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
