/**
 * varezhiaData.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Dados canônicos do mundo de Varezhia (Nível 1: País | Nível 2: Cidades | Nível 3: Distritos).
 * Suporta imagens personalizadas carregadas do Firestore (map_config/global)
 * e fallback automático para layout padrão tático de sobrevivência.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const MARKER_TYPES = {
  CITY:     'city',
  DISTRICT: 'district',
  LOCATION: 'location',
  SPECIAL:  'special',
  MILITARY: 'military',
  POI:      'poi',
}

export const DANGER_COLORS = {
  1: '#22c55e',   // Verde (Baixo)
  2: '#84cc16',   // Verde-amarelado
  3: '#f59e0b',   // Âmbar (Moderado)
  4: '#ef4444',   // Vermelho (Alto)
  5: '#dc2626',   // Vermelho Escuro (Extremo)
}

// Imagens padrão de fallback temáticas
export const DEFAULT_MAP_IMAGES = {
  country: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=1920&q=80', // Topográfico / Satélite
  kamen: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1600&q=80', // Montanhas e florestas
  novigrad: 'https://images.unsplash.com/photo-1477959858617-67f30bc75b82?auto=format&fit=crop&w=1600&q=80', // Ruínas urbanas / Metrópole
  veleska: 'https://images.unsplash.com/photo-1508614589041-895b88991e3e?auto=format&fit=crop&w=1600&q=80', // Industrial / Fábricas
  polje: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1600&q=80', // Planícies agrícolas
  dravina: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1600&q=80', // Floresta densa
  srebren: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80', // Costa / Mar
  mrtvo: 'https://images.unsplash.com/photo-1509114397022-ed747cca3f65?auto=format&fit=crop&w=1600&q=80', // Terra Devastada
  zlatna: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1600&q=80', // Colinas áridas
  district: 'https://images.unsplash.com/photo-1560472355-536de3962603?auto=format&fit=crop&w=1600&q=80', // Ruas de cidade destruída
}

// ─── Dados canônicos do País (Varezhia) e suas Cidades ────────────────────────
export const VAREZHIA = {
  id: 'varezhia',
  name: 'República de Varezhia',
  description: 'Uma nação de 43.000 km² em ruínas após o Apocalipse. Suas regiões e cidades continuam sendo a principal referência geográfica de sobrevivência.',
  mapImage: DEFAULT_MAP_IMAGES.country,
  
  // Pins das Cidades e Locais Especiais no Mapa Geral do País (Nível 1)
  countryPins: [
    {
      id: 'kamen',
      name: 'Kamen',
      region: 'Kamen Oblast',
      type: MARKER_TYPES.CITY,
      x: 24.5,
      y: 16.0,
      dangerLevel: 3,
      description: 'Centro histórico de mineração e extração de madeira ao norte. Vales montanhosos e clima frio.',
      mapImage: DEFAULT_MAP_IMAGES.kamen,
      hasCityMap: true,
      locationSlug: null,
    },
    {
      id: 'v04',
      name: 'Complexo Hidrelétrico V-04',
      region: 'Kamen Oblast',
      type: MARKER_TYPES.SPECIAL,
      x: 36.0,
      y: 12.0,
      dangerLevel: 4,
      description: 'Enorme usina hidrelétrica. Estruturas maciças e geradores elétricos.',
      hasCityMap: false,
      locationSlug: null,
    },
    {
      id: 'dravina',
      name: 'Dravina',
      region: 'Dravina',
      type: MARKER_TYPES.CITY,
      x: 22.0,
      y: 32.0,
      dangerLevel: 4,
      description: 'Região de florestas densas, pequenas estradas e rios. Baixa visibilidade e perigo constante.',
      mapImage: DEFAULT_MAP_IMAGES.dravina,
      hasCityMap: true,
      locationSlug: null,
    },
    {
      id: 'novigrad',
      name: 'Novigrad',
      region: 'Novigrad',
      type: MARKER_TYPES.CITY,
      x: 52.0,
      y: 32.0,
      dangerLevel: 4,
      description: 'A maior metrópole de Varezhia (2 milhões de habitantes antes da queda). Dividida em 7 grandes distritos.',
      mapImage: DEFAULT_MAP_IMAGES.novigrad,
      hasCityMap: true,
      locationSlug: null,
    },
    {
      id: 'veleska',
      name: 'Veleska',
      region: 'Veleska',
      type: MARKER_TYPES.CITY,
      x: 25.0,
      y: 49.0,
      dangerLevel: 3,
      description: 'O coração industrial de Varezhia. Fábricas, oficinas, fundições e depósitos de suprimentos.',
      mapImage: DEFAULT_MAP_IMAGES.veleska,
      hasCityMap: true,
      locationSlug: null,
    },
    {
      id: 'porto-seco',
      name: 'Porto Seco de Veleska',
      region: 'Veleska',
      type: MARKER_TYPES.SPECIAL,
      x: 29.0,
      y: 44.0,
      dangerLevel: 4,
      description: 'Terminal ferroviário e logístico gigantesco repleto de contêineres e depósitos.',
      hasCityMap: false,
      locationSlug: null,
    },
    {
      id: 'polje',
      name: 'Polje',
      region: 'Polje',
      type: MARKER_TYPES.CITY,
      x: 46.0,
      y: 54.0,
      dangerLevel: 2,
      description: 'Planícies agrícolas conhecidas como "O Celeiro de Varezhia". Silos e fazendas de suprimentos.',
      mapImage: DEFAULT_MAP_IMAGES.polje,
      hasCityMap: true,
      locationSlug: null,
    },
    {
      id: 'srebren',
      name: 'Srebren',
      region: 'Srebren Coast',
      type: MARKER_TYPES.CITY,
      x: 22.0,
      y: 70.0,
      dangerLevel: 3,
      description: 'Região costeira ao sudoeste. Portos de pesca, armazéns marítimos e praias rochosas.',
      mapImage: DEFAULT_MAP_IMAGES.srebren,
      hasCityMap: true,
      locationSlug: null,
    },
    {
      id: 'v13',
      name: 'Instalação V-13',
      region: 'Mrtvo Polje',
      type: MARKER_TYPES.MILITARY,
      x: 46.0,
      y: 76.0,
      dangerLevel: 5,
      description: 'Bunker militar subterrâneo e laboratório lacrado. Zona de altíssimo perigo biológico.',
      hasCityMap: false,
      locationSlug: null,
    },
    {
      id: 'zlatna',
      name: 'Zlatna',
      region: 'Zlatna',
      type: MARKER_TYPES.CITY,
      x: 76.0,
      y: 50.0,
      dangerLevel: 3,
      description: 'Região de colinas e minas a leste de Novigrad. Antigos depósitos de ouro e metais raros.',
      mapImage: DEFAULT_MAP_IMAGES.zlatna,
      hasCityMap: true,
      locationSlug: null,
    },
    {
      id: 'kozar',
      name: 'Base Militar Kozar',
      region: 'Zlatna',
      type: MARKER_TYPES.MILITARY,
      x: 84.0,
      y: 62.0,
      dangerLevel: 5,
      description: 'Base militar avançada com armamentos e radares pesados.',
      hasCityMap: false,
      locationSlug: null,
    },
  ],

  // Pins das Cidades (Nível 2: Mapa da Cidade → Distritos e POIs)
  cityPins: {
    // 1. Novigrad (Distritos)
    novigrad: [
      { id: 'stari-grad', name: 'Stari Grad', type: MARKER_TYPES.DISTRICT, x: 28.0, y: 35.0, dangerLevel: 3, description: 'Centro histórico com ruas estreitas de pedra e museus abandonados.', districtId: 'stari-grad', locationSlug: null },
      { id: 'centar', name: 'Centar', type: MARKER_TYPES.DISTRICT, x: 48.0, y: 46.0, dangerLevel: 4, description: 'Arranha-céus de bancos, lojas e escritórios de Novigrad.', districtId: 'centar', locationSlug: null },
      { id: 'zelena', name: 'Zelena (Tecnologia)', type: MARKER_TYPES.DISTRICT, x: 68.0, y: 38.0, dangerLevel: 5, description: 'Polo tecnológico de robótica, inteligência artificial e biotecnologia.', districtId: 'zelena', locationSlug: null },
      { id: 'aerodrom', name: 'Aerodrom', type: MARKER_TYPES.DISTRICT, x: 78.0, y: 65.0, dangerLevel: 3, description: 'Antigo Aeroporto Internacional de Novigrad e pistas de carga.', districtId: 'aerodrom', locationSlug: null },
      { id: 'rakovac', name: 'Rakovac', type: MARKER_TYPES.DISTRICT, x: 35.0, y: 62.0, dangerLevel: 4, description: 'Bairro residencial denso com mercados populares saqueados.', districtId: 'rakovac', locationSlug: null },
      { id: 'veles', name: 'Veles', type: MARKER_TYPES.DISTRICT, x: 25.0, y: 72.0, dangerLevel: 3, description: 'Subestações elétricas urbanas e linhas de trem.', districtId: 'veles', locationSlug: null },
    ],

    // 2. Kamen
    kamen: [
      { id: 'kamen-centro', name: 'Praça Central', type: MARKER_TYPES.DISTRICT, x: 45.0, y: 50.0, dangerLevel: 2, description: 'Praça do mercado de madeira e prefeitura da cidade.', districtId: 'kamen-centro', locationSlug: null },
      { id: 'kamen-mina', name: 'Distrito da Mina', type: MARKER_TYPES.DISTRICT, x: 75.0, y: 30.0, dangerLevel: 4, description: 'Entrada dos túneis de mineração no alto da serra.', districtId: 'kamen-mina', locationSlug: null },
      { id: 'kamen-serraria', name: 'Serraria Norte', type: MARKER_TYPES.DISTRICT, x: 22.0, y: 65.0, dangerLevel: 3, description: 'Galpões de processamento de toras de pinho.', districtId: 'kamen-serraria', locationSlug: null },
    ],

    // 3. Veleska
    veleska: [
      { id: 'veleska-fabricas', name: 'Polo Siderúrgico', type: MARKER_TYPES.DISTRICT, x: 40.0, y: 45.0, dangerLevel: 4, description: 'Grandes galpões de fundição de aço e refino.', districtId: 'veleska-fabricas', locationSlug: null },
      { id: 'veleska-estacao', name: 'Estação de Cargas', type: MARKER_TYPES.DISTRICT, x: 60.0, y: 58.0, dangerLevel: 3, description: 'Vagões de trem e armazéns ferroviários.', districtId: 'veleska-estacao', locationSlug: null },
    ],

    // 4. Polje
    polje: [
      { id: 'polje-silo', name: 'Silo Central', type: MARKER_TYPES.DISTRICT, x: 50.0, y: 40.0, dangerLevel: 2, description: 'Enormes torres de armazenamento de grãos e trigo.', districtId: 'polje-silo', locationSlug: null },
      { id: 'polje-fazendas', name: 'Comunidade Dobrava', type: MARKER_TYPES.DISTRICT, x: 30.0, y: 65.0, dangerLevel: 1, description: 'Casas de campo e estábulos rurais.', districtId: 'polje-fazendas', locationSlug: null },
    ],
  },

  // ─── Distritos das Cidades (Nível 3: Mapa do Distrito → Salas / POIs) ─────
  // Pins aqui são do tipo LOCATION com locationSlug para viajar à sala.
  cityDistricts: {
    novigrad: {
      'stari-grad': {
        name: 'Stari Grad',
        mapImage: DEFAULT_MAP_IMAGES.district,
        pins: [
          { id: 'sg-catedral', name: 'Catedral de São Veres', type: MARKER_TYPES.LOCATION, x: 35.0, y: 30.0, dangerLevel: 2, description: 'Antiga catedral gótica convertida em abrigo improvisado. Vitrais quebrados e bancos empilhados como barricadas.', locationSlug: null },
          { id: 'sg-museu', name: 'Museu Histórico', type: MARKER_TYPES.LOCATION, x: 65.0, y: 45.0, dangerLevel: 3, description: 'Museu nacional saqueado. Coleções de armas e armaduras medievais ainda intactas nos cofres.', locationSlug: null },
          { id: 'sg-mercado', name: 'Mercado Velho', type: MARKER_TYPES.LOCATION, x: 50.0, y: 65.0, dangerLevel: 4, description: 'Antigo mercado a céu aberto, agora infestado. Barracas de metal enferrujadas e caixotes apodrecendo.', locationSlug: null },
        ],
      },
      'centar': {
        name: 'Centar',
        mapImage: DEFAULT_MAP_IMAGES.district,
        pins: [
          { id: 'cen-hospital', name: 'Hospital Central', type: MARKER_TYPES.LOCATION, x: 50.0, y: 44.0, dangerLevel: 2, description: 'Hospital Central de Novigrad. Corredores médicos úmidos com suprimentos ainda disponíveis.', locationSlug: 'sala-hospital' },
          { id: 'cen-banco', name: 'Banco Nacional', type: MARKER_TYPES.LOCATION, x: 30.0, y: 55.0, dangerLevel: 4, description: 'Sede do banco central. Cofres trancados e sistemas de segurança ainda ativos.', locationSlug: null },
          { id: 'cen-prefeitura', name: 'Prefeitura de Novigrad', type: MARKER_TYPES.LOCATION, x: 70.0, y: 35.0, dangerLevel: 3, description: 'Edifício do governo municipal. Arquivos e documentos espalhados por todos os andares.', locationSlug: null },
        ],
      },
      'zelena': {
        name: 'Zelena (Tecnologia)',
        mapImage: DEFAULT_MAP_IMAGES.district,
        pins: [
          { id: 'zel-lab', name: 'Laboratório BioTech', type: MARKER_TYPES.LOCATION, x: 40.0, y: 40.0, dangerLevel: 5, description: 'Laboratório de biotecnologia. Experimentos inacabados e contaminação biológica extrema.', locationSlug: null },
          { id: 'zel-servidor', name: 'Centro de Servidores', type: MARKER_TYPES.LOCATION, x: 65.0, y: 60.0, dangerLevel: 4, description: 'Sala de servidores com energia de emergência. Dados classificados podem estar acessíveis.', locationSlug: null },
        ],
      },
      'rakovac': {
        name: 'Rakovac',
        mapImage: DEFAULT_MAP_IMAGES.district,
        pins: [
          { id: 'rak-mercado', name: 'Mercado Rakovac', type: MARKER_TYPES.LOCATION, x: 45.0, y: 50.0, dangerLevel: 3, description: 'Antigo mercado popular. Alguns grupos de sobreviventes ainda tentam manter trocas aqui.', locationSlug: null },
          { id: 'rak-escola', name: 'Escola Primária', type: MARKER_TYPES.LOCATION, x: 60.0, y: 35.0, dangerLevel: 2, description: 'Escola convertida em ponto de reunião. Suprimentos básicos armazenados no ginásio.', locationSlug: null },
        ],
      },
      'aerodrom': {
        name: 'Aerodrom',
        mapImage: DEFAULT_MAP_IMAGES.district,
        pins: [
          { id: 'aer-terminal', name: 'Terminal Principal', type: MARKER_TYPES.LOCATION, x: 50.0, y: 45.0, dangerLevel: 3, description: 'Terminal de passageiros do aeroporto. Lojas de duty-free saqueadas e pistas obstruídas.', locationSlug: null },
          { id: 'aer-hangar', name: 'Hangar Militar', type: MARKER_TYPES.LOCATION, x: 75.0, y: 60.0, dangerLevel: 5, description: 'Hangar de aeronaves militares. Alguns helicópteros ainda intactos mas sem combustível.', locationSlug: null },
        ],
      },
      'veles': {
        name: 'Veles',
        mapImage: DEFAULT_MAP_IMAGES.district,
        pins: [
          { id: 'vel-subestacao', name: 'Subestação Elétrica', type: MARKER_TYPES.LOCATION, x: 40.0, y: 55.0, dangerLevel: 4, description: 'Central de distribuição de energia. Geradores de backup podem ser ativados.', locationSlug: null },
          { id: 'vel-estacao-trem', name: 'Estação de Trem Veles', type: MARKER_TYPES.LOCATION, x: 65.0, y: 40.0, dangerLevel: 3, description: 'Estação ferroviária antiga. Vagões parados e trilhos bloqueados por detritos.', locationSlug: null },
        ],
      },
    },

    kamen: {
      'kamen-centro': {
        name: 'Praça Central de Kamen',
        mapImage: DEFAULT_MAP_IMAGES.district,
        pins: [
          { id: 'kc-praca', name: 'Praça do Mercado', type: MARKER_TYPES.LOCATION, x: 50.0, y: 50.0, dangerLevel: 2, description: 'Praça histórica com fonte central. Frequentada por sobreviventes locais.', locationSlug: null },
          { id: 'kc-prefeitura', name: 'Prefeitura de Kamen', type: MARKER_TYPES.LOCATION, x: 70.0, y: 35.0, dangerLevel: 2, description: 'Edifício administrativo com arquivos municipais e mapas da região.', locationSlug: null },
        ],
      },
      'kamen-mina': {
        name: 'Distrito da Mina',
        mapImage: DEFAULT_MAP_IMAGES.district,
        pins: [
          { id: 'km-entrada', name: 'Entrada Principal da Mina', type: MARKER_TYPES.LOCATION, x: 45.0, y: 40.0, dangerLevel: 4, description: 'Portão de ferro enferrujado. Trilhos de mineração adentram a escuridão da montanha.', locationSlug: null },
          { id: 'km-escritorio', name: 'Escritório da Mineradora', type: MARKER_TYPES.LOCATION, x: 65.0, y: 55.0, dangerLevel: 3, description: 'Sala de operações com mapas dos túneis e inventário de equipamentos.', locationSlug: null },
        ],
      },
      'kamen-serraria': {
        name: 'Serraria Norte',
        mapImage: DEFAULT_MAP_IMAGES.district,
        pins: [
          { id: 'ks-galpao', name: 'Galpão Principal', type: MARKER_TYPES.LOCATION, x: 40.0, y: 45.0, dangerLevel: 3, description: 'Galpão de processamento de toras. Serras elétricas paradas e madeira empilhada.', locationSlug: null },
        ],
      },
    },

    veleska: {
      'veleska-fabricas': {
        name: 'Polo Siderúrgico',
        mapImage: DEFAULT_MAP_IMAGES.district,
        pins: [
          { id: 'vf-fundicao', name: 'Fundição Central', type: MARKER_TYPES.LOCATION, x: 45.0, y: 40.0, dangerLevel: 4, description: 'Alto-fornos apagados mas estruturalmente intactos. Metal bruto disponível para forja.', locationSlug: null },
          { id: 'vf-deposito', name: 'Depósito de Insumos', type: MARKER_TYPES.LOCATION, x: 65.0, y: 60.0, dangerLevel: 3, description: 'Armazém com matérias-primas e ferramentas industriais diversas.', locationSlug: null },
        ],
      },
      'veleska-estacao': {
        name: 'Estação de Cargas',
        mapImage: DEFAULT_MAP_IMAGES.district,
        pins: [
          { id: 've-plataforma', name: 'Plataforma de Cargas', type: MARKER_TYPES.LOCATION, x: 50.0, y: 50.0, dangerLevel: 3, description: 'Área de desembarque com vagões parados e contêineres lacrados.', locationSlug: null },
        ],
      },
    },

    polje: {
      'polje-silo': {
        name: 'Silo Central',
        mapImage: DEFAULT_MAP_IMAGES.district,
        pins: [
          { id: 'ps-silo-a', name: 'Silo A — Trigo', type: MARKER_TYPES.LOCATION, x: 40.0, y: 40.0, dangerLevel: 1, description: 'Torre de armazenamento de trigo. Ainda contém grãos secos e preservados.', locationSlug: null },
          { id: 'ps-silo-b', name: 'Silo B — Milho', type: MARKER_TYPES.LOCATION, x: 60.0, y: 55.0, dangerLevel: 2, description: 'Silo de milho com sistema de ventilação danificado. Odor forte de fermentação.', locationSlug: null },
          { id: 'ps-escritorio', name: 'Escritório do Silo', type: MARKER_TYPES.LOCATION, x: 50.0, y: 70.0, dangerLevel: 1, description: 'Sala de controle do silo com registros de estoque. Computadores sem energia.', locationSlug: null },
        ],
      },
      'polje-fazendas': {
        name: 'Comunidade Dobrava',
        mapImage: DEFAULT_MAP_IMAGES.district,
        pins: [
          { id: 'pf-casa-grande', name: 'Casa da Fazenda', type: MARKER_TYPES.LOCATION, x: 45.0, y: 45.0, dangerLevel: 1, description: 'Casa-sede da fazenda Dobrava. Uma das poucas construções ainda habitadas por sobreviventes organizados.', locationSlug: null },
          { id: 'pf-estabulo', name: 'Estábulo', type: MARKER_TYPES.LOCATION, x: 65.0, y: 60.0, dangerLevel: 1, description: 'Estábulo com alguns animais ainda vivos. Fonte rara de alimento e couro.', locationSlug: null },
        ],
      },
    },
  },
}

/** Retorna a cidade pelo id */
export function getCityPinById(id) {
  return VAREZHIA.countryPins.find(p => p.id === id) || null
}

/** Retorna o objeto de distrito (fallback canônico) dado cityId e districtId */
export function getDistrictById(cityId, districtId) {
  return VAREZHIA.cityDistricts?.[cityId]?.[districtId] || null
}

/** Retorna os pins canônicos de um distrito */
export function getDistrictPins(cityId, districtId) {
  return VAREZHIA.cityDistricts?.[cityId]?.[districtId]?.pins || []
}
