/**
 * campSystem.js
 * Engine Central do Sistema de Pontos de Melhoria (PM) e Evolução do Acampamento de Sosnovka
 *
 * Princípios de Arquitetura:
 *  - Abstração genérica: Estrutura -> Nível -> Progresso (PM) -> Benefícios -> Modificadores
 *  - Preservação total de excedente de PM (ex: 98 + 5 = sobe nível e fica 3/100)
 *  - Casa Grande como teto máximo de nível para as demais estruturas
 *  - Separação estrita entre Materiais físicos e Pontos de Melhoria
 *  - Execução atômica no backend via runTransaction (anti-dupla conclusão)
 *  - Ciclos configuráveis para limite de missões por personagem
 */

import {
  doc,
  collection,
  runTransaction,
  getDoc,
} from 'firebase/firestore'
import { isItemMatching, addItemToInventory } from './activitySystem.js'
import { calculateGameTime } from './timeSystem.js'

// ---------------------------------------------------------------------------
// 1. ESTRUTURAS PADRÃO DO ACAMPAMENTO DE SOSNOVKA
// ---------------------------------------------------------------------------

export const DEFAULT_CAMP_STRUCTURES = [
  {
    id: 'casa_grande',
    name: 'Casa Grande',
    description: 'Sede administrativa, rádio central e ponto vital de comando do acampamento. Seu nível dita o teto de evolução de todas as outras estruturas.',
    icon: '🏛️',
    isMainCeiling: true,
    level: 1,
    currentPm: 0,
    pmPerLevel: 100,
    maxLevel: 5,
    active: true,
    locationSlug: 'casa-grande',
    benefitsByLevel: {
      1: { label: 'Base', description: 'Abrigo inicial funcional e centro de comando.', modifiers: { base_defense_bonus: 0, storage_capacity_bonus: 0, camp_capacity_bonus: 0 } },
      2: { label: '+100 Defesa, +20 Armazém, +5 Capacidade', description: 'Muralhas reforçadas e depósito ampliado.', modifiers: { base_defense_bonus: 100, storage_capacity_bonus: 20, camp_capacity_bonus: 5 } },
      3: { label: '+200 Defesa, +40 Armazém, +10 Capacidade', description: 'Trincheiras, estacas defensivas e grande despensa central.', modifiers: { base_defense_bonus: 200, storage_capacity_bonus: 40, camp_capacity_bonus: 10 } },
      4: { label: '+300 Defesa, +60 Armazém, +15 Capacidade', description: 'Postos de vigilância perimetral e armazém fortificado.', modifiers: { base_defense_bonus: 300, storage_capacity_bonus: 60, camp_capacity_bonus: 15 } },
      5: { label: '+400 Defesa, +80 Armazém, +20 Capacidade', description: 'Fortaleza inexpugnável com capacidade logística máxima.', modifiers: { base_defense_bonus: 400, storage_capacity_bonus: 80, camp_capacity_bonus: 20 } },
    },
    specialUpgrades: [
      { id: 'upg_radio_room', name: 'Reconstruir Sala de Rádio', description: 'Desbloqueia transmissões de emergência e longo alcance.', unlocked: false, levelRequired: 2 }
    ]
  },
  {
    id: 'galinheiro',
    name: 'Galinheiro Comunitário',
    description: 'Instalação protegida para criação de aves, fornecendo ovos frescos e adubo de alta qualidade para as plantações.',
    icon: '🐔',
    isMainCeiling: false,
    level: 1,
    currentPm: 0,
    pmPerLevel: 100,
    maxLevel: 5,
    active: true,
    locationSlug: 'galinheiro_refugio',
    benefitsByLevel: {
      1: { label: 'Base', description: 'Puleiro rústico com capacidade inicial de galinhas.', modifiers: { chicken_capacity_bonus: 0, egg_storage_bonus: 0 } },
      2: { label: '+50 Estrutura, +30 Armazenamento, +5 Galinhas', description: 'Cercado fortificado contra predadores noturnos.', modifiers: { chicken_capacity_bonus: 5, egg_storage_bonus: 30 } },
      3: { label: '+100 Estrutura, +60 Armazenamento, +10 Galinhas', description: 'Ninhos aquecidos e comedouros automáticos.', modifiers: { chicken_capacity_bonus: 10, egg_storage_bonus: 60 } },
      4: { label: '+150 Estrutura, +90 Armazenamento, +15 Galinhas', description: 'Gaiolas de postura protegidas e silo de ração.', modifiers: { chicken_capacity_bonus: 15, egg_storage_bonus: 90 } },
      5: { label: '+200 Estrutura, +120 Armazenamento, +20 Galinhas', description: 'Complexo avícola de alta produtividade sustentável.', modifiers: { chicken_capacity_bonus: 20, egg_storage_bonus: 120 } },
    },
    specialUpgrades: [
      { id: 'upg_incubator', name: 'Construir Incubadora Térmica', description: 'Reprodução controlada de pintinhos para renovar o plantel.', unlocked: false, levelRequired: 3 }
    ]
  },
  {
    id: 'oficina',
    name: 'Oficina de Manutenção & Ferraria',
    description: 'Bancadas de trabalho, ferramentas mecânicas e forja para reparos de equipamentos, armas e veículos.',
    icon: '🔧',
    isMainCeiling: false,
    level: 1,
    currentPm: 0,
    pmPerLevel: 100,
    maxLevel: 5,
    active: true,
    locationSlug: 'oficina',
    benefitsByLevel: {
      1: { label: 'Base', description: 'Bancada de reparos simples com ferramentas manuais.', modifiers: { scrap_storage_slots: 0, crafting_efficiency_pct: 0 } },
      2: { label: '+50 Estrutura, +20 slots Sucata, -10% Consumo', description: 'Torno mecânico e gaveteiros organizados.', modifiers: { scrap_storage_slots: 20, crafting_efficiency_pct: 10 } },
      3: { label: '+100 Estrutura, +40 slots Sucata, -20% Consumo', description: 'Forja de brasas e bigorna reforçada.', modifiers: { scrap_storage_slots: 40, crafting_efficiency_pct: 20 } },
      4: { label: '+150 Estrutura, +60 slots Sucata, -30% Consumo', description: 'Gerador dedicado e ferramentas pneumáticas restauradas.', modifiers: { scrap_storage_slots: 60, crafting_efficiency_pct: 30 } },
      5: { label: '+200 Estrutura, +80 slots Sucata, -40% Consumo', description: 'Polo fabril artesanal com máxima economia de insumos.', modifiers: { scrap_storage_slots: 80, crafting_efficiency_pct: 40 } },
    },
    specialUpgrades: [
      { id: 'upg_vehicle_bay', name: 'Recuperar Bancada Mecânica Automotiva', description: 'Permite reparo integral de motores e veículos terrestres.', unlocked: false, levelRequired: 3 }
    ]
  },
  {
    id: 'horta',
    name: 'Horta Comunitária',
    description: 'Canteiros irrigados de cultivo de tubérculos, legumes e grãos para sustento dos sobreviventes.',
    icon: '🌱',
    isMainCeiling: false,
    level: 1,
    currentPm: 0,
    pmPerLevel: 100,
    maxLevel: 5,
    active: true,
    locationSlug: 'horta-comunitaria',
    benefitsByLevel: {
      1: { label: 'Base', description: 'Canteiros de terra batida com drenagem natural.', modifiers: { farm_plot_bonus: 0, crop_growth_time_multiplier: 1.0 } },
      2: { label: '+50 Estrutura, +5 Canteiros, -20% Tempo', description: 'Compostagem enriquecida e adubação sistemática.', modifiers: { farm_plot_bonus: 5, crop_growth_time_multiplier: 0.80 } },
      3: { label: '+100 Estrutura, +10 Canteiros, -40% Tempo', description: 'Estufa envidraçada contra geadas e pragas.', modifiers: { farm_plot_bonus: 10, crop_growth_time_multiplier: 0.60 } },
      4: { label: '+150 Estrutura, +15 Canteiros, -60% Tempo', description: 'Canaletas de irrigação automática.', modifiers: { farm_plot_bonus: 15, crop_growth_time_multiplier: 0.40 } },
      5: { label: '+200 Estrutura, +20 Canteiros, -60% Tempo Máximo', description: 'Agrofloresta planejada de altíssima produtividade.', modifiers: { farm_plot_bonus: 20, crop_growth_time_multiplier: 0.40 } },
    },
    specialUpgrades: [
      { id: 'upg_irrigation', name: 'Construir Sistema de Irrigação por Gotejamento', description: 'Reduz a necessidade diária de rega e economiza água.', unlocked: false, levelRequired: 2 }
    ]
  },
  {
    id: 'campo_treinamento',
    name: 'Campo de Treinamento',
    description: 'Área externa demarcada para exercícios físicos, treino tático, tiro ao alvo e condicionamento de combate.',
    icon: '🎯',
    isMainCeiling: false,
    level: 1,
    currentPm: 0,
    pmPerLevel: 100,
    maxLevel: 5,
    active: true,
    locationSlug: 'acampamento',
    benefitsByLevel: {
      1: { label: 'Modalidade: Força', description: 'Tocos, pedras de arremesso e barra fixa de madeira.', modifiers: { training_time_multiplier: 1.0, allowed_modalities: ['forca'] } },
      2: { label: 'Força + Destreza (-5% Tempo)', description: 'Pista de obstáculos leves e alvos móveis.', modifiers: { training_time_multiplier: 0.95, allowed_modalities: ['forca', 'destreza'] } },
      3: { label: 'Força + Destreza + Agilidade (-10% Tempo)', description: 'Circuito com cordas suspensas e manequins de treino.', modifiers: { training_time_multiplier: 0.90, allowed_modalities: ['forca', 'destreza', 'agilidade'] } },
      4: { label: '+ Sabedoria + Inteligência (-15% Tempo)', description: 'Mesa tática com mapas operacionais e biblioteca de manuais.', modifiers: { training_time_multiplier: 0.85, allowed_modalities: ['forca', 'destreza', 'agilidade', 'sabedoria', 'inteligencia'] } },
      5: { label: 'Todas as Modalidades (-20% Tempo)', description: 'Complexo de treino militar completo para todas as disciplinas.', modifiers: { training_time_multiplier: 0.80, allowed_modalities: ['forca', 'destreza', 'agilidade', 'sabedoria', 'inteligencia', 'todas'] } },
    },
    specialUpgrades: [
      { id: 'upg_combat_arena', name: 'Construir Arena de Sparring Fechada', description: 'Permite simulações de combate desarmado e tático sem risco de ferimentos graves.', unlocked: false, levelRequired: 3 }
    ]
  },
  {
    id: 'chales',
    name: 'Chalés dos Sobreviventes',
    description: 'Alojamentos aquecidos e quartos coletivos que garantem descanso, abrigo térmico e conforto da comunidade.',
    icon: '🏕️',
    isMainCeiling: false,
    level: 1,
    currentPm: 0,
    pmPerLevel: 100,
    maxLevel: 5,
    active: true,
    locationSlug: 'acampamento',
    benefitsByLevel: {
      1: { label: 'Base', description: 'Quartos rústicos com camas improvisadas.', modifiers: { housing_space_bonus: 0, need_consumption_multiplier: 1.0 } },
      2: { label: '+50 Estrutura, +10 Espaço, -5% Necessidades', description: 'Isolamento térmico nas paredes e camas de estrado.', modifiers: { housing_space_bonus: 10, need_consumption_multiplier: 0.95 } },
      3: { label: '+100 Estrutura, +20 Espaço, -10% Necessidades', description: 'Lareiras de alvenaria e abastecimento de lenha seca.', modifiers: { housing_space_bonus: 20, need_consumption_multiplier: 0.90 } },
      4: { label: '+150 Estrutura, +30 Espaço, -15% Necessidades', description: 'Cozinha comunitária interna e colchões higienizados.', modifiers: { housing_space_bonus: 30, need_consumption_multiplier: 0.85 } },
      5: { label: '+200 Estrutura, +40 Espaço, -20% Necessidades', description: 'Vila habitacional protegida, segura e altamente acolhedora.', modifiers: { housing_space_bonus: 40, need_consumption_multiplier: 0.80 } },
    },
    specialUpgrades: [
      { id: 'upg_communal_bath', name: 'Construir Vestiário & Banho Quente Coletivo', description: 'Restauração de bem-estar acelerada e proteção contra hipotermia.', unlocked: false, levelRequired: 3 }
    ]
  },
  {
    id: 'lago_pier',
    name: 'Lago & Píer Lacustre',
    description: 'Píer de pesca, ancoradouro de canoas e via lacustre para expedições e obtenção de peixes.',
    icon: '🚣',
    isMainCeiling: false,
    level: 1,
    currentPm: 0,
    pmPerLevel: 100,
    maxLevel: 5,
    active: true,
    locationSlug: 'lago-sterilug',
    benefitsByLevel: {
      1: { label: 'Base', description: 'Margem do lago com tablado simples para pesca de vara.', modifiers: { fishing_capacity_bonus: 0, fishing_time_multiplier: 1.0 } },
      2: { label: '+50 Estrutura, +2 Capacidade, -4% Tempo Pesca', description: 'Píer de madeira calafetado e suporte para linhas.', modifiers: { fishing_capacity_bonus: 2, fishing_time_multiplier: 0.96 } },
      3: { label: '+100 Estrutura, +4 Capacidade, -8% Tempo Pesca', description: 'Armadilha flutuante (covo) e canoa de remos leve.', modifiers: { fishing_capacity_bonus: 4, fishing_time_multiplier: 0.92 } },
      4: { label: '+150 Estrutura, +6 Capacidade, -12% Tempo Pesca', description: 'Farol de guia noturno e barco a motor secundário.', modifiers: { fishing_capacity_bonus: 6, fishing_time_multiplier: 0.88 } },
      5: { label: '+200 Estrutura, +8 Capacidade, -16% Tempo Pesca', description: 'Complexo náutico com rede de cerco e transporte lacustre de carga.', modifiers: { fishing_capacity_bonus: 8, fishing_time_multiplier: 0.84 } },
    },
    specialUpgrades: [
      { id: 'upg_motor_boat', name: 'Recuperar Barco com Motor de Popa', description: 'Desbloqueia pesca em alto lago e transporte rápido até outras margens.', unlocked: false, levelRequired: 3 }
    ]
  }
]

// ---------------------------------------------------------------------------
// 2. CONFIGURAÇÕES GLOBAIS PADRÃO DO ACAMPAMENTO
// ---------------------------------------------------------------------------

export const DEFAULT_CAMP_CONFIG = {
  campName: 'Acampamento de Sosnovka',
  hubLocationSlug: 'casa-grande',      // Locação única onde o painel Hub fica visível
  boardImageUrl: '/assets/camp_quest_board.jpg', // Imagem do quadro de missões
  missionLimitPerCycle: 2,
  defaultRewardPm: 5,
  defaultMissionSlots: 2,              // Vagas padrão por missão
  defaultDurationHoursOff: 48,         // Prazo padrão em horas reais (2 dias OFF)
  discordWebhookUrl: '',               // Webhook opcional para notificar a staff
  cycleType: 'daily_ingame',           // 'daily_ingame' | 'daily_real' | 'weekly_real' | 'manual'
  manualCycleId: 1,
  lastManualResetAt: new Date().toISOString(),
  enabled: true,
}

// ---------------------------------------------------------------------------
// 3. MISSÕES PADRÃO INICIAIS (MELHORIAS E RECURSOS)
// ---------------------------------------------------------------------------

export const DEFAULT_CAMP_MISSIONS = [
  // --- MISSÕES DE MELHORIA (Concedem PM) ---
  {
    id: 'mis_barricada_cg',
    name: 'Reforçar Barricada Oeste',
    description: 'Empilhar toras, fixar chapas de metal e travar o portão secundário da Casa Grande.',
    type: 'improvement',
    targetStructureId: 'casa_grande',
    targetStructureName: 'Casa Grande',
    rewardPm: 5,
    maxSlots: 2,
    durationHoursOff: 48,
    requiredMaterials: [
      { itemId: 'material_madeira', name: 'Madeira', quantity: 3, icon: '🪵' },
      { itemId: 'material_metal',   name: 'Metal',   quantity: 2, icon: '🔩' }
    ],
    rewardItems: [],
    active: true,
    status: 'aberta',
    participants: [],
    startedAt: null,
    deadline: null,
    submission: null,
    category: 'defesa'
  },
  {
    id: 'mis_chale_03',
    name: 'Recuperar o Chalé 03',
    description: 'Substituir telhas podres, calafetar frestas de vento e reparar a porta de entrada.',
    type: 'improvement',
    targetStructureId: 'chales',
    targetStructureName: 'Chalés dos Sobreviventes',
    rewardPm: 5,
    maxSlots: 2,
    durationHoursOff: 48,
    requiredMaterials: [
      { itemId: 'material_madeira', name: 'Madeira', quantity: 3, icon: '🪵' },
      { itemId: 'material_metal',   name: 'Metal',   quantity: 2, icon: '🔩' },
      { itemId: 'material_tecido',  name: 'Tecido',  quantity: 1, icon: '🧵' }
    ],
    rewardItems: [],
    active: true,
    status: 'aberta',
    participants: [],
    startedAt: null,
    deadline: null,
    submission: null,
    category: 'alojamento'
  },
  {
    id: 'mis_canteiros_horta',
    name: 'Construir Canteiros Elevados',
    description: 'Montar armações de madeira para proteger hortaliças do encharcamento e adicionar adubo rico.',
    type: 'improvement',
    targetStructureId: 'horta',
    targetStructureName: 'Horta Comunitária',
    rewardPm: 5,
    maxSlots: 2,
    durationHoursOff: 48,
    requiredMaterials: [
      { itemId: 'material_madeira',      name: 'Madeira',     quantity: 2, icon: '🪵' },
      { itemId: 'material_suprimentos',  name: 'Suprimentos', quantity: 1, icon: '📦' }
    ],
    rewardItems: [],
    active: true,
    status: 'aberta',
    participants: [],
    startedAt: null,
    deadline: null,
    submission: null,
    category: 'agricultura'
  },
  {
    id: 'mis_cercado_aves',
    name: 'Reforçar o Cercado das Aves',
    description: 'Trocar telas arrebentadas e travar a tampa superior contra predadores voadores e rastejantes.',
    type: 'improvement',
    targetStructureId: 'galinheiro',
    targetStructureName: 'Galinheiro Comunitário',
    rewardPm: 5,
    maxSlots: 2,
    durationHoursOff: 48,
    requiredMaterials: [
      { itemId: 'material_madeira', name: 'Madeira', quantity: 2, icon: '🪵' },
      { itemId: 'material_metal',   name: 'Metal',   quantity: 1, icon: '🔩' }
    ],
    rewardItems: [],
    active: true,
    status: 'aberta',
    participants: [],
    startedAt: null,
    deadline: null,
    submission: null,
    category: 'animais'
  },
  {
    id: 'mis_bancadas_oficina',
    name: 'Organizar Bancada de Ferraria',
    description: 'Fixar morsas, alinhar bigornas e recuperar gaveteiros de parafusos e componentes.',
    type: 'improvement',
    targetStructureId: 'oficina',
    targetStructureName: 'Oficina de Manutenção',
    rewardPm: 5,
    maxSlots: 2,
    durationHoursOff: 48,
    requiredMaterials: [
      { itemId: 'material_metal',  name: 'Metal',  quantity: 2, icon: '🔩' },
      { itemId: 'material_sucata', name: 'Sucata', quantity: 2, icon: '⚙️' }
    ],
    rewardItems: [],
    active: true,
    status: 'aberta',
    participants: [],
    startedAt: null,
    deadline: null,
    submission: null,
    category: 'oficina'
  },
  {
    id: 'mis_tablado_pier',
    name: 'Consertar Tablado de Atracação',
    description: 'Substituir pranchas de madeira podres do píer e fixar os cabeços de amarração de canoas.',
    type: 'improvement',
    targetStructureId: 'lago_pier',
    targetStructureName: 'Lago & Píer Lacustre',
    rewardPm: 5,
    maxSlots: 2,
    durationHoursOff: 48,
    requiredMaterials: [
      { itemId: 'material_madeira', name: 'Madeira', quantity: 4, icon: '🪵' },
      { itemId: 'material_metal',   name: 'Metal',   quantity: 2, icon: '🔩' }
    ],
    rewardItems: [],
    active: true,
    status: 'aberta',
    participants: [],
    startedAt: null,
    deadline: null,
    submission: null,
    category: 'pesca'
  },
  {
    id: 'mis_campo_treino',
    name: 'Nivelar Solo do Campo de Treino',
    description: 'Remover tocos de árvores, estender barreiras e construir suportes de tiro e musculação.',
    type: 'improvement',
    targetStructureId: 'campo_treinamento',
    targetStructureName: 'Campo de Treinamento',
    rewardPm: 5,
    maxSlots: 2,
    durationHoursOff: 48,
    requiredMaterials: [
      { itemId: 'material_madeira',     name: 'Madeira',     quantity: 2, icon: '🪵' },
      { itemId: 'material_suprimentos', name: 'Suprimentos', quantity: 1, icon: '📦' }
    ],
    rewardItems: [],
    active: true,
    status: 'aberta',
    participants: [],
    startedAt: null,
    deadline: null,
    submission: null,
    category: 'treinamento'
  },

  // --- MISSÕES DE RECURSO (Obtêm materiais, não concedem PM) ---
  {
    id: 'mis_rec_madeira',
    name: 'Corte e Coleta de Madeira na Mata',
    description: 'Explorar a borda da floresta de Sosnovka e serrar toras resistentes para construção.',
    type: 'resource',
    targetStructureId: null,
    targetStructureName: null,
    rewardPm: 0,
    maxSlots: 2,
    durationHoursOff: 48,
    requiredMaterials: [],
    rewardItems: [
      { itemId: 'material_madeira', name: 'Madeira', quantity: 3, icon: '🪵' }
    ],
    active: true,
    status: 'aberta',
    participants: [],
    startedAt: null,
    deadline: null,
    submission: null,
    category: 'recurso'
  },
  {
    id: 'mis_rec_metal_sucata',
    name: 'Varredura de Sucatas e Metais',
    description: 'Vasculhar galpões e carcaças mecânicas abandonadas na estrada rural.',
    type: 'resource',
    targetStructureId: null,
    targetStructureName: null,
    rewardPm: 0,
    maxSlots: 2,
    durationHoursOff: 48,
    requiredMaterials: [],
    rewardItems: [
      { itemId: 'material_metal',  name: 'Metal',  quantity: 2, icon: '🔩' },
      { itemId: 'material_sucata', name: 'Sucata', quantity: 1, icon: '⚙️' }
    ],
    active: true,
    status: 'aberta',
    participants: [],
    startedAt: null,
    deadline: null,
    submission: null,
    category: 'recurso'
  },
  {
    id: 'mis_rec_tecidos',
    name: 'Recuperação de Tecidos e Lonas',
    description: 'Resgatar lonas plásticas, cordas e tecidos grossos de tendas desmontadas.',
    type: 'resource',
    targetStructureId: null,
    targetStructureName: null,
    rewardPm: 0,
    maxSlots: 2,
    durationHoursOff: 48,
    requiredMaterials: [],
    rewardItems: [
      { itemId: 'material_tecido', name: 'Tecido', quantity: 2, icon: '🧵' }
    ],
    active: true,
    status: 'aberta',
    participants: [],
    startedAt: null,
    deadline: null,
    submission: null,
    category: 'recurso'
  }
]

// ---------------------------------------------------------------------------
// 4. MOTOR PURO DE EVOLUÇÃO E PRESERVAÇÃO DE EXCEDENTE
// ---------------------------------------------------------------------------

/**
 * Calcula a evolução de uma estrutura, preservando 100% dos PM excedentes
 * e respeitando estritamente o teto da Casa Grande.
 */
export function calculateEvolution({
  currentLevel = 1,
  currentPm = 0,
  addedPm = 0,
  maxLevel = 5,
  pmPerLevel = 100,
  isCasaGrande = false,
  casaGrandeLevel = 5,
}) {
  const safeCurLevel = Math.max(1, Number(currentLevel) || 1)
  const safePmPerLevel = Math.max(1, Number(pmPerLevel) || 100)
  const safeMaxLevel = Math.max(safeCurLevel, Number(maxLevel) || 5)
  const safeCgLevel = Math.max(1, Number(casaGrandeLevel) || 1)

  let level = safeCurLevel
  let pm = Math.max(0, (Number(currentPm) || 0) + (Number(addedPm) || 0))
  let levelsGained = 0
  let blockedByCeiling = false

  // Se já atingiu o nível máximo absoluto
  if (level >= safeMaxLevel) {
    return {
      newLevel: safeMaxLevel,
      newPm: safePmPerLevel,
      levelsGained: 0,
      evolved: false,
      blockedByCeiling: false,
      isMaxLevel: true,
    }
  }

  // Se for outra estrutura que já está no teto da Casa Grande
  if (!isCasaGrande && level >= safeCgLevel) {
    const cappedPm = Math.min(safePmPerLevel, pm)
    return {
      newLevel: level,
      newPm: cappedPm,
      levelsGained: 0,
      evolved: false,
      blockedByCeiling: true,
      isMaxLevel: false,
    }
  }

  // Processamento iterativo (suporta múltiplos níveis se addedPm for >= 200)
  while (pm >= safePmPerLevel && level < safeMaxLevel) {
    // Verifica teto da Casa Grande para o próximo nível
    if (!isCasaGrande && level >= safeCgLevel) {
      blockedByCeiling = true
      pm = Math.min(safePmPerLevel, pm)
      break
    }

    level += 1
    pm -= safePmPerLevel
    levelsGained += 1
  }

  if (level >= safeMaxLevel) {
    pm = safePmPerLevel
  }

  return {
    newLevel: level,
    newPm: pm,
    levelsGained,
    evolved: levelsGained > 0,
    blockedByCeiling,
    isMaxLevel: level >= safeMaxLevel,
  }
}

// ---------------------------------------------------------------------------
// 5. RESOLUÇÃO DE MATERIAIS NO INVENTÁRIO
// ---------------------------------------------------------------------------

export function resolveMaterialAliases(rawItemId) {
  const clean = String(rawItemId || '').toLowerCase().trim()
  if (clean === 'material_madeira' || clean === 'madeira' || clean === 'tabua_madeira') {
    return ['material_madeira', 'madeira', 'tabua_madeira']
  }
  if (clean === 'material_metal' || clean === 'metal' || clean === 'pregos_parafusos') {
    return ['material_metal', 'metal', 'pregos_parafusos']
  }
  if (clean === 'material_sucata' || clean === 'sucata') {
    return ['material_sucata', 'sucata']
  }
  if (clean === 'material_tecido' || clean === 'tecido' || clean === 'corda_nylon') {
    return ['material_tecido', 'tecido', 'corda_nylon']
  }
  if (clean === 'material_suprimentos' || clean === 'suprimentos' || clean === 'adubo') {
    return ['material_suprimentos', 'suprimentos', 'adubo']
  }
  return [clean]
}

export function checkMissionMaterials(inventory = [], requiredMaterials = []) {
  if (!Array.isArray(requiredMaterials) || requiredMaterials.length === 0) {
    return { ok: true, missing: [], details: [] }
  }

  const safeInv = Array.isArray(inventory) ? inventory : []
  const missing = []
  const details = []

  for (const req of requiredMaterials) {
    const requiredQty = Number(req.quantity) || 1
    const aliases = resolveMaterialAliases(req.itemId)

    const totalFound = safeInv.reduce((sum, item) => {
      if (!item) return sum
      const matches = aliases.some(alias => isItemMatching(item, alias))
      return matches ? sum + (Number(item.quantity) || 1) : sum
    }, 0)

    const isSatisfied = totalFound >= requiredQty
    details.push({
      itemId: req.itemId,
      name: req.name || req.itemId,
      icon: req.icon || '📦',
      required: requiredQty,
      found: totalFound,
      satisfied: isSatisfied
    })

    if (!isSatisfied) {
      missing.push({
        itemId: req.itemId,
        name: req.name || req.itemId,
        required: requiredQty,
        found: totalFound,
        needed: requiredQty - totalFound
      })
    }
  }

  return {
    ok: missing.length === 0,
    missing,
    details
  }
}

export function consumeMissionMaterials(inventory = [], requiredMaterials = []) {
  let inv = [...inventory]

  for (const req of requiredMaterials) {
    let toConsume = Number(req.quantity) || 1
    const aliases = resolveMaterialAliases(req.itemId)

    for (let i = inv.length - 1; i >= 0 && toConsume > 0; i--) {
      const item = inv[i]
      if (!item) continue
      const matches = aliases.some(alias => isItemMatching(item, alias))

      if (matches) {
        const itemQty = Number(item.quantity) || 1
        if (itemQty <= toConsume) {
          toConsume -= itemQty
          inv.splice(i, 1)
        } else {
          inv[i] = { ...item, quantity: itemQty - toConsume }
          toConsume = 0
        }
      }
    }

    if (toConsume > 0) {
      throw new Error(`Quantidade insuficiente de ${req.name || req.itemId} para consumir.`)
    }
  }

  return inv
}

// ---------------------------------------------------------------------------
// 6. RESOLUÇÃO DE CHAVE DE CICLO
// ---------------------------------------------------------------------------

export function getCampCurrentCycleKey(campConfig = {}, gameConfig = null) {
  const cycleType = campConfig?.cycleType || 'daily_ingame'

  if (cycleType === 'manual') {
    return `cycle_manual_${campConfig?.manualCycleId || 1}`
  }

  if (cycleType === 'daily_real') {
    const d = new Date()
    return `cycle_real_${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
  }

  if (cycleType === 'weekly_real') {
    const d = new Date()
    const oneJan = new Date(d.getUTCFullYear(), 0, 1)
    const numberOfDays = Math.floor((d - oneJan) / (24 * 60 * 60 * 1000))
    const week = Math.ceil((d.getDay() + 1 + numberOfDays) / 7)
    return `cycle_week_${d.getUTCFullYear()}_w${week}`
  }

  // Padrão: diário in-game
  const gameTime = calculateGameTime(gameConfig)
  return `cycle_ingame_${gameTime.year}-${String(gameTime.month).padStart(2, '0')}-${String(gameTime.day).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// 7. CONSOLIDADOR DE MODIFICADORES ATIVOS DO ACAMPAMENTO
// ---------------------------------------------------------------------------

export function getCampActiveModifiers(structuresList = []) {
  const modifiers = {
    base_defense_bonus: 0,
    storage_capacity_bonus: 0,
    camp_capacity_bonus: 0,
    chicken_capacity_bonus: 0,
    egg_storage_bonus: 0,
    scrap_storage_slots: 0,
    crafting_efficiency_pct: 0,
    farm_plot_bonus: 0,
    crop_growth_time_multiplier: 1.0,
    training_time_multiplier: 1.0,
    housing_space_bonus: 0,
    need_consumption_multiplier: 1.0,
    fishing_capacity_bonus: 0,
    fishing_time_multiplier: 1.0,
  }

  if (!Array.isArray(structuresList)) return modifiers

  for (const st of structuresList) {
    if (st.active === false) continue
    const curLevel = Number(st.level) || 1
    const lvlMeta = st.benefitsByLevel?.[curLevel]
    const mods = lvlMeta?.modifiers || {}

    if (mods.base_defense_bonus) modifiers.base_defense_bonus += Number(mods.base_defense_bonus) || 0
    if (mods.storage_capacity_bonus) modifiers.storage_capacity_bonus += Number(mods.storage_capacity_bonus) || 0
    if (mods.camp_capacity_bonus) modifiers.camp_capacity_bonus += Number(mods.camp_capacity_bonus) || 0
    if (mods.chicken_capacity_bonus) modifiers.chicken_capacity_bonus += Number(mods.chicken_capacity_bonus) || 0
    if (mods.egg_storage_bonus) modifiers.egg_storage_bonus += Number(mods.egg_storage_bonus) || 0
    if (mods.scrap_storage_slots) modifiers.scrap_storage_slots += Number(mods.scrap_storage_slots) || 0
    if (mods.crafting_efficiency_pct) modifiers.crafting_efficiency_pct += Number(mods.crafting_efficiency_pct) || 0
    if (mods.farm_plot_bonus) modifiers.farm_plot_bonus += Number(mods.farm_plot_bonus) || 0
    if (mods.housing_space_bonus) modifiers.housing_space_bonus += Number(mods.housing_space_bonus) || 0
    if (mods.fishing_capacity_bonus) modifiers.fishing_capacity_bonus += Number(mods.fishing_capacity_bonus) || 0

    if (mods.crop_growth_time_multiplier && mods.crop_growth_time_multiplier < modifiers.crop_growth_time_multiplier) {
      modifiers.crop_growth_time_multiplier = Number(mods.crop_growth_time_multiplier)
    }
    if (mods.training_time_multiplier && mods.training_time_multiplier < modifiers.training_time_multiplier) {
      modifiers.training_time_multiplier = Number(mods.training_time_multiplier)
    }
    if (mods.need_consumption_multiplier && mods.need_consumption_multiplier < modifiers.need_consumption_multiplier) {
      modifiers.need_consumption_multiplier = Number(mods.need_consumption_multiplier)
    }
  }

  return modifiers
}

// ---------------------------------------------------------------------------
// 8. TRANSAÇÃO ATÔMICA DE CONCLUSÃO DE MISSÃO
// ---------------------------------------------------------------------------

export async function completeCampMission({
  db,
  userUid,
  missionId,
  targetStructureIdOverride = null,
  gameConfig = null,
}) {
  if (!db || !userUid || !missionId) {
    throw new Error('Parâmetros obrigatórios ausentes para conclusão da missão.')
  }

  const missionRef = doc(db, 'camp_missions', missionId)
  const campConfigRef = doc(db, 'camp_config', 'global')
  const userRef = doc(db, 'users', userUid)
  const casaGrandeRef = doc(db, 'camp_structures', 'casa_grande')

  return await runTransaction(db, async (tx) => {
    // 1. Leituras essenciais
    const [missionSnap, campConfigSnap, userSnap] = await Promise.all([
      tx.get(missionRef),
      tx.get(campConfigRef),
      tx.get(userRef),
    ])

    if (!missionSnap.exists()) {
      throw new Error('Missão não encontrada.')
    }
    if (!userSnap.exists()) {
      throw new Error('Personagem não encontrado.')
    }

    const missionData = missionSnap.data()
    if (missionData.active === false) {
      throw new Error('Esta missão está inativa no momento.')
    }

    const campConfig = campConfigSnap.exists() ? campConfigSnap.data() : DEFAULT_CAMP_CONFIG
    const userData = userSnap.data()
    const character = userData.character || {}
    const inventory = character.inventory || []

    // 2. Validação do Limite de Missões por Ciclo
    const cycleKey = getCampCurrentCycleKey(campConfig, gameConfig)
    const cycleRef = doc(db, 'camp_player_cycles', `${userUid}_${cycleKey}`)
    const cycleSnap = await tx.get(cycleRef)

    const cycleData = cycleSnap.exists() ? cycleSnap.data() : { completedCount: 0, missionIds: [] }
    const missionLimit = Number(campConfig.missionLimitPerCycle) || 2

    if (missionData.type === 'improvement') {
      if ((cycleData.completedCount || 0) >= missionLimit) {
        throw new Error(`Limite de ${missionLimit} missões de melhoria atingido para este ciclo.`)
      }
    }

    // 3. Validação de Materiais Necessários
    const requiredMaterials = missionData.requiredMaterials || []
    const matCheck = checkMissionMaterials(inventory, requiredMaterials)
    if (!matCheck.ok) {
      const missingLabels = matCheck.missing.map(m => `${m.needed}x ${m.name}`).join(', ')
      throw new Error(`Materiais insuficientes na mochila: faltam ${missingLabels}.`)
    }

    // 4. Se for Missão de Melhoria, carrega a estrutura e Casa Grande
    let targetStructure = null
    let casaGrandeData = null
    const targetId = targetStructureIdOverride || missionData.targetStructureId

    let targetStructureRef = null
    if (missionData.type === 'improvement') {
      if (!targetId) {
        throw new Error('Nenhuma estrutura de destino associada a esta missão de melhoria.')
      }

      targetStructureRef = doc(db, 'camp_structures', targetId)
      const [targetSnap, cgSnap] = await Promise.all([
        tx.get(targetStructureRef),
        tx.get(casaGrandeRef),
      ])

      if (!targetSnap.exists()) {
        throw new Error(`Estrutura "${targetId}" não encontrada no acampamento.`)
      }

      targetStructure = targetSnap.data()
      casaGrandeData = cgSnap.exists() ? cgSnap.data() : null

      const isCasaGrande = targetId === 'casa_grande'
      const cgLevel = casaGrandeData ? (Number(casaGrandeData.level) || 1) : 1
      const curLevel = Number(targetStructure.level) || 1

      // 5. REGRA DO TETO DA CASA GRANDE
      if (!isCasaGrande && curLevel >= cgLevel) {
        throw new Error(
          `Esta estrutura já atingiu o nível ${curLevel}, limitado pelo nível atual da Casa Grande (${cgLevel}). Evolua a Casa Grande para desbloquear novos níveis.`
        )
      }
    }

    // 6. Consumo seguro dos materiais do inventário
    let updatedInventory = consumeMissionMaterials(inventory, requiredMaterials)

    // Se for missão de recurso, adiciona as recompensas de materiais ao inventário
    if (missionData.type === 'resource' && Array.isArray(missionData.rewardItems)) {
      for (const reward of missionData.rewardItems) {
        updatedInventory = addItemToInventory(updatedInventory, {
          itemId: reward.itemId,
          name: reward.name,
          icon: reward.icon || '📦',
          quantity: Number(reward.quantity) || 1,
          category: 'supplies',
          rarity: 'common',
          description: `Material obtido na missão "${missionData.name}".`,
          obtainedFrom: `Missão: ${missionData.name}`,
        })
      }
    }

    // 7. Processamento de PM e Evolução
    let evolutionResult = null
    const rewardPm = Number(missionData.rewardPm) || 0

    if (missionData.type === 'improvement' && targetStructure) {
      const isCasaGrande = targetId === 'casa_grande'
      const cgLevel = casaGrandeData ? (Number(casaGrandeData.level) || 1) : 1

      evolutionResult = calculateEvolution({
        currentLevel: Number(targetStructure.level) || 1,
        currentPm: Number(targetStructure.currentPm) || 0,
        addedPm: rewardPm,
        maxLevel: Number(targetStructure.maxLevel) || 5,
        pmPerLevel: Number(targetStructure.pmPerLevel) || 100,
        isCasaGrande,
        casaGrandeLevel: cgLevel,
      })

      const structureUpdates = {
        level: evolutionResult.newLevel,
        currentPm: evolutionResult.newPm,
        lastUpdated: new Date().toISOString(),
        lastUpdatedBy: character.name || 'Sobrevivente',
        lastUpdatedByUid: userUid,
      }

      if (missionData.specialUpgradeId && Array.isArray(targetStructure.specialUpgrades)) {
        structureUpdates.specialUpgrades = targetStructure.specialUpgrades.map(u => {
          if (u.id === missionData.specialUpgradeId) {
            return { ...u, unlocked: true, unlockedAt: new Date().toISOString(), unlockedBy: character.name }
          }
          return u
        })
      }

      tx.update(targetStructureRef, structureUpdates)

      if (evolutionResult.evolved) {
        const evoLogRef = doc(collection(db, 'camp_evolution_logs'))
        tx.set(evoLogRef, {
          structureId: targetId,
          structureName: targetStructure.name,
          previousLevel: Number(targetStructure.level) || 1,
          newLevel: evolutionResult.newLevel,
          levelsGained: evolutionResult.levelsGained,
          pmAtEvolution: evolutionResult.newPm,
          characterUid: userUid,
          characterName: character.name || 'Sobrevivente',
          missionId: missionId,
          missionName: missionData.name,
          timestamp: Date.now(),
          createdAt: new Date().toISOString(),
        })
      }
    }

    // 8. Atualiza o inventário do personagem
    tx.update(userRef, {
      'character.inventory': updatedInventory,
      'character.lastCampMissionAt': new Date().toISOString(),
    })

    // 9. Atualiza o controle do ciclo do jogador
    const newCount = (cycleData.completedCount || 0) + (missionData.type === 'improvement' ? 1 : 0)
    tx.set(cycleRef, {
      userUid,
      cycleKey,
      completedCount: newCount,
      missionIds: [...(cycleData.missionIds || []), missionId],
      lastCompletedAt: new Date().toISOString(),
    }, { merge: true })

    // 10. Registra log permanente da missão no histórico
    const missionLogRef = doc(collection(db, 'camp_mission_logs'))
    tx.set(missionLogRef, {
      missionId,
      missionName: missionData.name,
      missionType: missionData.type,
      targetStructureId: targetId || null,
      targetStructureName: targetStructure?.name || null,
      pmGranted: rewardPm,
      consumedMaterials: requiredMaterials,
      characterUid: userUid,
      characterName: character.name || 'Sobrevivente',
      cycleKey,
      timestamp: Date.now(),
      createdAt: new Date().toISOString(),
    })

    return {
      success: true,
      missionName: missionData.name,
      type: missionData.type,
      targetStructureName: targetStructure?.name || null,
      pmGranted: rewardPm,
      consumedMaterials: requiredMaterials,
      evolutionResult,
      cycleCount: newCount,
      cycleLimit: missionLimit,
    }
  })
}

// ---------------------------------------------------------------------------
// 9. SISTEMA COOPERATIVO DE MISSÕES (Vagas Públicas + Aprovação da Staff)
// ---------------------------------------------------------------------------

/**
 * Formata milissegundos restantes em string legível: "23h 14m 08s".
 */
export function formatCountdown(msRemaining) {
  if (msRemaining <= 0) return 'Expirado'
  const totalSeconds = Math.floor(msRemaining / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`
  return `${s}s`
}

/**
 * Um personagem se candidata a uma vaga em uma missão aberta.
 * Se preencher a última vaga, inicia automaticamente o timer (em_andamento).
 */
export async function joinCampMission({ db, userUid, character, missionId }) {
  if (!db || !userUid || !missionId) throw new Error('Parâmetros obrigatórios ausentes.')

  const missionRef = doc(db, 'camp_missions', missionId)
  const campConfigRef = doc(db, 'camp_config', 'global')

  return await runTransaction(db, async (tx) => {
    const [missionSnap, configSnap] = await Promise.all([
      tx.get(missionRef),
      tx.get(campConfigRef),
    ])

    if (!missionSnap.exists()) throw new Error('Missão não encontrada.')

    const mission = missionSnap.data()
    const config = configSnap.exists() ? configSnap.data() : DEFAULT_CAMP_CONFIG

    if (mission.active === false) throw new Error('Esta missão está inativa.')

    const mStatus = mission.status || 'aberta'
    if (mStatus !== 'aberta') {
      throw new Error('Esta missão não está mais disponível para inscrição.')
    }

    const participants = mission.participants || []
    const maxSlots = Number(mission.maxSlots || config.defaultMissionSlots || 2)

    if (participants.some(p => p.uid === userUid)) {
      throw new Error('Você já está inscrito nesta missão.')
    }
    if (participants.length >= maxSlots) {
      throw new Error('Todas as vagas desta missão já estão preenchidas.')
    }

    const newParticipant = {
      uid: userUid,
      name: character?.name || 'Sobrevivente',
      profession: character?.profession || '',
      avatarUrl: character?.avatarUrl || '',
      joinedAt: new Date().toISOString(),
    }

    const newParticipants = [...participants, newParticipant]
    const isFull = newParticipants.length >= maxSlots

    const updates = {
      participants: newParticipants,
      lastUpdated: new Date().toISOString(),
    }

    if (isFull) {
      const durationHoursOff = Number(mission.durationHoursOff || config.defaultDurationHoursOff || 48)
      const startedAt = new Date().toISOString()
      const deadline = new Date(Date.now() + durationHoursOff * 60 * 60 * 1000).toISOString()
      updates.status = 'em_andamento'
      updates.startedAt = startedAt
      updates.deadline = deadline
    }

    tx.update(missionRef, updates)

    return {
      success: true,
      isFull,
      missionName: mission.name,
      participantsCount: newParticipants.length,
      maxSlots,
    }
  })
}

/**
 * Remove o personagem de uma missão aberta (somente antes de iniciar).
 */
export async function leaveCampMission({ db, userUid, missionId }) {
  if (!db || !userUid || !missionId) throw new Error('Parâmetros obrigatórios ausentes.')

  const missionRef = doc(db, 'camp_missions', missionId)

  return await runTransaction(db, async (tx) => {
    const missionSnap = await tx.get(missionRef)
    if (!missionSnap.exists()) throw new Error('Missão não encontrada.')

    const mission = missionSnap.data()
    const mStatus = mission.status || 'aberta'

    if (mStatus === 'em_andamento') {
      throw new Error('Não é possível sair de uma missão já em andamento. Contate um Mestre.')
    }
    if (mStatus === 'pendente_aprovacao') {
      throw new Error('Esta missão já foi entregue para avaliação da Staff.')
    }

    const participants = (mission.participants || []).filter(p => p.uid !== userUid)

    tx.update(missionRef, {
      participants,
      status: 'aberta',
      lastUpdated: new Date().toISOString(),
    })

    return { success: true, missionName: mission.name }
  })
}

/**
 * Um participante entrega o relatório de RP (link do Google Docs / prints).
 * Muda o status para 'pendente_aprovacao'.
 */
export async function submitMissionReport({ db, userUid, character, missionId, documentUrl, notes }) {
  if (!db || !userUid || !missionId) throw new Error('Parâmetros obrigatórios ausentes.')
  if (!documentUrl?.trim()) throw new Error('O link do documento (Google Docs / prints) é obrigatório.')

  const missionRef = doc(db, 'camp_missions', missionId)

  return await runTransaction(db, async (tx) => {
    const missionSnap = await tx.get(missionRef)
    if (!missionSnap.exists()) throw new Error('Missão não encontrada.')

    const mission = missionSnap.data()

    if ((mission.status || 'aberta') !== 'em_andamento') {
      throw new Error('Somente missões em andamento podem receber um relatório de entrega.')
    }

    const isParticipant = (mission.participants || []).some(p => p.uid === userUid)
    if (!isParticipant) {
      throw new Error('Apenas participantes inscritos podem entregar o relatório desta missão.')
    }

    tx.update(missionRef, {
      status: 'pendente_aprovacao',
      submission: {
        submittedByUid: userUid,
        submittedByName: character?.name || 'Sobrevivente',
        documentUrl: documentUrl.trim(),
        notes: notes?.trim() || null,
        submittedAt: new Date().toISOString(),
      },
      lastUpdated: new Date().toISOString(),
    })

    return { success: true, missionName: mission.name }
  })
}

/**
 * Staff aprova ou rejeita o relatório de uma missão.
 * Aprovação: aplica PM na estrutura, computa ciclos de todos os participantes e reseta a missão.
 * Rejeição: volta status para 'em_andamento', limpa a entrega e registra o motivo.
 */
export async function reviewCampMission({
  db,
  adminUid,
  adminName,
  missionId,
  approved,
  rejectionReason = '',
  gameConfig = null,
}) {
  if (!db || !adminUid || !missionId) throw new Error('Parâmetros obrigatórios ausentes.')

  const missionRef = doc(db, 'camp_missions', missionId)
  const campConfigRef = doc(db, 'camp_config', 'global')
  const casaGrandeRef = doc(db, 'camp_structures', 'casa_grande')

  return await runTransaction(db, async (tx) => {
    const [missionSnap, configSnap] = await Promise.all([
      tx.get(missionRef),
      tx.get(campConfigRef),
    ])

    if (!missionSnap.exists()) throw new Error('Missão não encontrada.')

    const mission = missionSnap.data()
    if ((mission.status || '') !== 'pendente_aprovacao') {
      throw new Error('Esta missão não está aguardando aprovação.')
    }

    const campConfig = configSnap.exists() ? configSnap.data() : DEFAULT_CAMP_CONFIG
    const participants = mission.participants || []

    // === REJEIÇÃO ===
    if (!approved) {
      tx.update(missionRef, {
        status: 'em_andamento',
        submission: null,
        rejectionReason: rejectionReason || 'Relatório não aprovado pela Staff.',
        reviewedByUid: adminUid,
        reviewedByName: adminName,
        reviewedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      })
      return { success: true, approved: false, missionName: mission.name }
    }

    // === APROVAÇÃO ===
    const rewardPm = Number(mission.rewardPm) || 0
    const targetId = mission.targetStructureId
    let evolutionResult = null

    if (mission.type === 'improvement' && targetId) {
      const targetStructureRef = doc(db, 'camp_structures', targetId)
      const [targetSnap, cgSnap] = await Promise.all([
        tx.get(targetStructureRef),
        tx.get(casaGrandeRef),
      ])

      if (targetSnap.exists()) {
        const targetStructure = targetSnap.data()
        const casaGrandeData = cgSnap.exists() ? cgSnap.data() : null
        const isCasaGrande = targetId === 'casa_grande'
        const cgLevel = casaGrandeData ? (Number(casaGrandeData.level) || 1) : 1

        evolutionResult = calculateEvolution({
          currentLevel: Number(targetStructure.level) || 1,
          currentPm: Number(targetStructure.currentPm) || 0,
          addedPm: rewardPm,
          maxLevel: Number(targetStructure.maxLevel) || 5,
          pmPerLevel: Number(targetStructure.pmPerLevel) || 100,
          isCasaGrande,
          casaGrandeLevel: cgLevel,
        })

        tx.update(targetStructureRef, {
          level: evolutionResult.newLevel,
          currentPm: evolutionResult.newPm,
          lastUpdated: new Date().toISOString(),
          lastUpdatedBy: adminName,
          lastUpdatedByUid: adminUid,
        })

        if (evolutionResult.evolved) {
          const evoLogRef = doc(collection(db, 'camp_evolution_logs'))
          tx.set(evoLogRef, {
            structureId: targetId,
            structureName: targetStructure.name,
            previousLevel: Number(targetStructure.level) || 1,
            newLevel: evolutionResult.newLevel,
            levelsGained: evolutionResult.levelsGained,
            pmAtEvolution: evolutionResult.newPm,
            approvedByUid: adminUid,
            approvedByName: adminName,
            missionId,
            missionName: mission.name,
            participants: participants.map(p => p.name),
            timestamp: Date.now(),
            createdAt: new Date().toISOString(),
          })
        }
      }
    }

    // Atualiza ciclo para cada participante
    const cycleKey = getCampCurrentCycleKey(campConfig, gameConfig)
    for (const participant of participants) {
      const cycleRef = doc(db, 'camp_player_cycles', `${participant.uid}_${cycleKey}`)
      const cycleSnap = await tx.get(cycleRef)
      const cycleData = cycleSnap.exists() ? cycleSnap.data() : { completedCount: 0, missionIds: [] }
      const newCount = (cycleData.completedCount || 0) + (mission.type === 'improvement' ? 1 : 0)
      tx.set(cycleRef, {
        userUid: participant.uid,
        cycleKey,
        completedCount: newCount,
        missionIds: [...(cycleData.missionIds || []), missionId],
        lastCompletedAt: new Date().toISOString(),
      }, { merge: true })
    }

    // Registra log da missão
    const missionLogRef = doc(collection(db, 'camp_mission_logs'))
    tx.set(missionLogRef, {
      missionId,
      missionName: mission.name,
      missionType: mission.type,
      targetStructureId: targetId || null,
      targetStructureName: mission.targetStructureName || null,
      pmGranted: rewardPm,
      participants: participants.map(p => ({ uid: p.uid, name: p.name })),
      submittedAt: mission.submission?.submittedAt || null,
      documentUrl: mission.submission?.documentUrl || null,
      approvedByUid: adminUid,
      approvedByName: adminName,
      cycleKey,
      timestamp: Date.now(),
      createdAt: new Date().toISOString(),
    })

    // Reseta a missão para nova rodada
    tx.update(missionRef, {
      status: 'aberta',
      participants: [],
      startedAt: null,
      deadline: null,
      submission: null,
      rejectionReason: null,
      reviewedByUid: adminUid,
      reviewedByName: adminName,
      reviewedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    })

    return {
      success: true,
      approved: true,
      missionName: mission.name,
      pmGranted: rewardPm,
      evolutionResult,
      participantsCount: participants.length,
    }
  })
}
