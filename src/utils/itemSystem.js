// Utilitários e regras do sistema avançado de itens, busca e inventário

export const SUPPLY_RARITIES = ['junk', 'common', 'uncommon']
export const UNIQUE_RARITIES = ['rare', 'very_rare', 'exceptional']

export const RARITY_META = {
  junk:        { id: 'junk',        label: 'Sucata',       color: '#9e9e9e', bg: 'rgba(158, 158, 158, 0.15)', border: '#757575', icon: '🔩' },
  common:      { id: 'common',      label: 'Comum',        color: '#ffffff', bg: 'rgba(255, 255, 255, 0.12)', border: '#e0e0e0', icon: '⚪' },
  uncommon:    { id: 'uncommon',    label: 'Incomum',      color: '#4caf50', bg: 'rgba(76, 175, 80, 0.18)',   border: '#4caf50', icon: '🟢' },
  rare:        { id: 'rare',        label: 'Raro',         color: '#2196f3', bg: 'rgba(33, 150, 243, 0.22)',  border: '#2196f3', icon: '🔵' },
  very_rare:   { id: 'very_rare',   label: 'Muito Raro',   color: '#9c27b0', bg: 'rgba(156, 39, 176, 0.25)',  border: '#9c27b0', icon: '🟣' },
  exceptional: { id: 'exceptional', label: 'Excepcional',  color: '#ff9800', bg: 'rgba(255, 152, 0, 0.28)',   border: '#ff9800', icon: '🟠' },
}

export const EQUIPMENT_SLOTS = [
  { id: 'head',          label: 'Cabeça / Rosto',            icon: '🧢', placeholder: 'Nenhum item na cabeça' },
  { id: 'torso_inner',   label: 'Tórax (Blusa / Traje)',     icon: '👕', placeholder: 'Sem blusa / camiseta' },
  { id: 'torso_outer',   label: 'Tórax (Colete / Armadura)', icon: '🛡️', placeholder: 'Sem colete / armadura' },
  { id: 'hands_gloves',  label: 'Mãos (Luvas)',              icon: '🧤', placeholder: 'Sem luvas de proteção' },
  { id: 'hands_weapon',  label: 'Mãos (Arma Principal)',     icon: '⚔️', placeholder: 'Desarmado (Soco: 3–6)' },
  { id: 'legs',          label: 'Pernas (Calças)',           icon: '👖', placeholder: 'Sem calças resistentes' },
  { id: 'feet',          label: 'Pés (Calçados)',            icon: '👟', placeholder: 'Descalço' },
]

export const UNARMED_ATTACK = {
  name: 'Desarmado (Soco)',
  icon: '👊',
  damageMin: 3,
  damageMax: 6,
  damageText: '3–6'
}

export const DEFAULT_PRESET_ITEMS = [
  // COZINHA
  { itemId: 'saco_lixo', name: 'Sacos de Lixo', icon: '🗑️', category: 'general', rarity: 'junk', consumable: false, isQuestItem: false, description: 'Sacos plásticos usados para descarte ou contenção rápida.' },
  { itemId: 'talheres_pratos', name: 'Pratos e Talheres', icon: '🍽️', category: 'general', rarity: 'junk', consumable: false, isQuestItem: false, description: 'Utensílios de cozinha comuns.' },
  { itemId: 'alimento_perecivel', name: 'Restos de Alimentos', icon: '🍞', category: 'general', rarity: 'junk', consumable: true, consumeEffect: { hunger: 5, thirst: -5 }, isQuestItem: false, description: 'Comida já passada, use com cuidado.' },
  { itemId: 'comida_enlatada', name: 'Comida Enlatada', icon: '🥫', category: 'general', rarity: 'common', consumable: true, consumeEffect: { hunger: 30 }, isQuestItem: false, description: 'Alimento preservado de longa duração.' },
  { itemId: 'mantimentos_secos', name: 'Pacote de Mantimentos', icon: '🌾', category: 'general', rarity: 'common', consumable: true, consumeEffect: { hunger: 20 }, isQuestItem: false, description: 'Macarrão, arroz ou farinha.' },
  { itemId: 'garrafa_agua', name: 'Garrafa de Água', icon: '💧', category: 'general', rarity: 'common', consumable: true, consumeEffect: { thirst: 35 }, isQuestItem: false, description: 'Água mineral potável e limpa.' },
  { itemId: 'cereais', name: 'Caixa de Cereais', icon: '🥣', category: 'general', rarity: 'common', consumable: true, consumeEffect: { hunger: 15 }, isQuestItem: false, description: 'Cereais crocantes açucarados.' },
  { itemId: 'cafe_cha', name: 'Café e Chá', icon: '☕', category: 'general', rarity: 'common', consumable: true, consumeEffect: { thirst: 10, hunger: 5 }, isQuestItem: false, description: 'Pó de café e sachês de infusão.' },
  { itemId: 'produto_limpeza', name: 'Produto de Limpeza', icon: '🧴', category: 'general', rarity: 'common', consumable: false, isQuestItem: false, description: 'Detergente e desinfetante.' },
  { itemId: 'abridor_latas', name: 'Abridor de Latas', icon: '🧰', category: 'general', rarity: 'uncommon', consumable: false, isQuestItem: false, description: 'Ferramenta compacta para abrir conservas.' },
  { itemId: 'isqueiro_fosforo', name: 'Isqueiro e Fósforos', icon: '🔥', category: 'general', rarity: 'uncommon', consumable: false, isQuestItem: false, description: 'Fonte portátil para fazer fogo.' },
  { itemId: 'faca_cozinha', name: 'Faca de Cozinha', icon: '🔪', category: 'melee', rarity: 'uncommon', consumable: false, isQuestItem: false, equipSlot: 'hands_weapon', damageMin: 12, damageMax: 18, maxDurability: 80, durability: 80, description: 'Lâmina afiada usada na culinária e defesa.' },
  { itemId: 'panela_frigideira', name: 'Panela de Ferro', icon: '🍳', category: 'melee', rarity: 'uncommon', consumable: false, isQuestItem: false, equipSlot: 'hands_weapon', damageMin: 10, damageMax: 16, maxDurability: 120, durability: 120, description: 'Utensílio culinário resistente e pesado.' },

  // QUARTO
  { itemId: 'livros_revistas', name: 'Livros e Revistas', icon: '📚', category: 'general', rarity: 'junk', consumable: false, isQuestItem: false, description: 'Leituras do velho mundo.' },
  { itemId: 'celular_descarregado', name: 'Celular sem Bateria', icon: '📱', category: 'general', rarity: 'junk', consumable: false, isQuestItem: false, description: 'Aparelho inútil sem rede elétrica.' },
  { itemId: 'dinheiro_papel', name: 'Notas de Dinheiro', icon: '💵', category: 'general', rarity: 'junk', consumable: false, isQuestItem: false, description: 'Cédulas de papel sem valor comercial atual.' },
  { itemId: 'roupas_comuns', name: 'Roupas Comuns', icon: '👕', category: 'clothing', rarity: 'common', consumable: false, isQuestItem: false, equipSlot: 'torso_inner', insulation: 6, damageReduction: 0, maxDurability: 100, durability: 100, description: 'Camisa e calça em bom estado.' },
  { itemId: 'meias', name: 'Par de Meias', icon: '🧦', category: 'clothing', rarity: 'common', consumable: false, isQuestItem: false, equipSlot: 'feet', insulation: 2, damageReduction: 0, maxDurability: 80, durability: 80, description: 'Mantém os pés secos e protegidos.' },
  { itemId: 'calcados_tenis', name: 'Tênis Resistente', icon: '👟', category: 'clothing', rarity: 'common', consumable: false, isQuestItem: false, equipSlot: 'feet', insulation: 3, damageReduction: 1, maxDurability: 150, durability: 150, description: 'Calçado confortável para caminhadas longas.' },
  { itemId: 'bandagem', name: 'Bandagem Estéril', icon: '🩹', category: 'medical', rarity: 'common', consumable: true, consumeEffect: { blood: 25 }, isQuestItem: false, description: 'Estanca sangramentos leves e protege feridas.' },
  { itemId: 'remedio_basico', name: 'Remédios Básicos', icon: '💊', category: 'medical', rarity: 'common', consumable: true, consumeEffect: { blood: 15, hunger: -5 }, isQuestItem: false, description: 'Analgésicos e anti-inflamatórios.' },
  { itemId: 'perfume', name: 'Vidro de Perfume', icon: '✨', category: 'general', rarity: 'common', consumable: false, isQuestItem: false, description: 'Fragrância ainda preservada.' },
  { itemId: 'carregador_cabos', name: 'Carregador e Cabos', icon: '🔌', category: 'general', rarity: 'uncommon', consumable: false, isQuestItem: false, description: 'Cabos elétricos diversos.' },
  { itemId: 'mochila_pequena', name: 'Mochila Pequena', icon: '🎒', category: 'general', rarity: 'uncommon', consumable: false, isQuestItem: false, description: 'Espaço extra de transporte.' },
  { itemId: 'chaves_genericas', name: 'Molho de Chaves', icon: '🗝️', category: 'general', rarity: 'uncommon', consumable: false, isQuestItem: false, description: 'Chaves de portas e cadeados residenciais.' },
  { itemId: 'oculos_grau', name: 'Óculos', icon: '👓', category: 'clothing', rarity: 'uncommon', consumable: false, isQuestItem: false, equipSlot: 'head', insulation: 0, damageReduction: 0, maxDurability: 80, durability: 80, description: 'Óculos com armação preservada.' },
  { itemId: 'relogio_pulso', name: 'Relógio de Pulso', icon: '⌚', category: 'general', rarity: 'rare', unlocks: ['hud_clock'], consumable: false, isQuestItem: false, description: 'Relógio mecânico analógico. Permite ver o horário exato.' },

  // BANHEIRO
  { itemId: 'papel_higienico', name: 'Papel Higiênico', icon: '🧻', category: 'general', rarity: 'junk', consumable: false, isQuestItem: false, description: 'Item essencial de higiene pessoal.' },
  { itemId: 'sabonete', name: 'Sabonete', icon: '🧼', category: 'general', rarity: 'common', consumable: false, isQuestItem: false, description: 'Barra de sabão higiênico.' },
  { itemId: 'shampoo', name: 'Frasco de Shampoo', icon: '🧴', category: 'general', rarity: 'common', consumable: false, isQuestItem: false, description: 'Higiene e cuidado pessoal.' },
  { itemId: 'pasta_escova', name: 'Pasta e Escova de Dentes', icon: '🪥', category: 'general', rarity: 'common', consumable: false, isQuestItem: false, description: 'Higiene bucal.' },
  { itemId: 'desodorante', name: 'Desodorante', icon: '🫧', category: 'general', rarity: 'common', consumable: false, isQuestItem: false, description: 'Aerossol para proteção contra odores.' },
  { itemId: 'lamina_barbear', name: 'Lâminas de Barbear', icon: '🪒', category: 'general', rarity: 'uncommon', consumable: false, isQuestItem: false, description: 'Lâminas finas e afiadas.' },
  { itemId: 'alcool_antisseptico', name: 'Álcool 70%', icon: '🧪', category: 'medical', rarity: 'uncommon', consumable: true, consumeEffect: { blood: 10 }, isQuestItem: false, description: 'Desinfeta ferimentos e esteriliza ferramentas.' },

  // GARAGEM / ÁREA DE SERVIÇO
  { itemId: 'pregos_parafusos', name: 'Caixa de Pregos e Parafusos', icon: '🔩', category: 'general', rarity: 'junk', consumable: false, isQuestItem: false, description: 'Peças metálicas para carpintaria.' },
  { itemId: 'pregadores', name: 'Pregadores de Roupa', icon: '📎', category: 'general', rarity: 'junk', consumable: false, isQuestItem: false, description: 'Presilhas plásticas e de madeira.' },
  { itemId: 'tabua_madeira', name: 'Tábua de Madeira', icon: '🪵', category: 'melee', rarity: 'junk', consumable: false, isQuestItem: false, equipSlot: 'hands_weapon', damageMin: 8, damageMax: 14, maxDurability: 50, durability: 50, description: 'Pedaço de tábua que pode ser improvisado.' },
  { itemId: 'fita_adesiva', name: 'Fita Adesiva Reforçada', icon: '🩹', category: 'general', rarity: 'common', consumable: false, isQuestItem: false, description: 'Fita adesiva de alta resistência.' },
  { itemId: 'luvas_trabalho', name: 'Luvas de Proteção', icon: '🧤', category: 'clothing', rarity: 'common', consumable: false, isQuestItem: false, equipSlot: 'hands_gloves', insulation: 3, damageReduction: 1, maxDurability: 120, durability: 120, description: 'Protegem as mãos contra detritos e cortes.' },
  { itemId: 'chave_fenda', name: 'Chave de Fenda', icon: '🪛', category: 'melee', rarity: 'uncommon', consumable: false, isQuestItem: false, equipSlot: 'hands_weapon', damageMin: 8, damageMax: 14, maxDurability: 90, durability: 90, description: 'Ferramenta de manutenção e perfuração.' },
  { itemId: 'alicate', name: 'Alicate Universal', icon: '🔧', category: 'melee', rarity: 'uncommon', consumable: false, isQuestItem: false, equipSlot: 'hands_weapon', damageMin: 8, damageMax: 14, maxDurability: 110, durability: 110, description: 'Corta fios e prende estruturas.' },
  { itemId: 'martelo', name: 'Martelo de Orelha', icon: '🔨', category: 'melee', rarity: 'uncommon', consumable: false, isQuestItem: false, equipSlot: 'hands_weapon', damageMin: 10, damageMax: 16, maxDurability: 150, durability: 150, description: 'Ferramenta pesada contundente.' },
  { itemId: 'baterias_pilhas', name: 'Pilhas e Baterias', icon: '🔋', category: 'general', rarity: 'uncommon', consumable: false, isQuestItem: false, description: 'Alimentação para eletrônicos e lanternas.' },
  { itemId: 'extensao_eletrica', name: 'Extensão Elétrica', icon: '🔌', category: 'general', rarity: 'uncommon', consumable: false, isQuestItem: false, description: 'Fio longo emborrachado.' },
  { itemId: 'lanterna_portatil', name: 'Lanterna Portátil', icon: '🔦', category: 'general', rarity: 'uncommon', consumable: false, isQuestItem: false, description: 'Facho de luz portátil.' },
  { itemId: 'corda_nylon', name: 'Rolo de Corda', icon: '🪢', category: 'general', rarity: 'uncommon', consumable: false, isQuestItem: false, description: 'Corda resistente de amarração.' },
  { itemId: 'galao_combustivel', name: 'Galão de Combustível', icon: '⛽', category: 'general', rarity: 'rare', consumable: false, isQuestItem: false, description: 'Gasolina altamente inflamável e valiosa.' },

  // RAROS DE BUSCA ÚNICA & APARTAMENTOS
  { itemId: 'notebook_estudante', name: 'Notebook Funcional', icon: '💻', category: 'general', rarity: 'rare', consumable: false, isQuestItem: false, description: 'Computador portátil com arquivos e bateria preservada.' },
  { itemId: 'celular_funcional', name: 'Smartphone Operacional', icon: '📱', category: 'general', rarity: 'rare', consumable: false, isQuestItem: false, description: 'Aparelho desbloqueado com dados armazenados.' },
  { itemId: 'pistola_glock', name: 'Pistola 9mm', icon: '🔫', category: 'firearms', rarity: 'rare', consumable: false, isQuestItem: false, equipSlot: 'hands_weapon', damageMin: 22, damageMax: 28, maxDurability: 200, durability: 200, description: 'Arma de fogo semi-automática confiável.' },
  { itemId: 'municao_9mm', name: 'Caixa de Munição 9mm', icon: '📦', category: 'firearms', rarity: 'rare', consumable: false, isQuestItem: false, description: 'Cartuchos para armas curtas.' },
  { itemId: 'kit_cirurgico', name: 'Kit Médico Avançado', icon: '🩺', category: 'medical', rarity: 'rare', consumable: true, consumeEffect: { blood: 60, thirst: 10 }, isQuestItem: false, description: 'Suturas estéreis, tesouras e analgésicos fortes.' },
  { itemId: 'ferramentas_pro', name: 'Maleta de Ferramentas Pro', icon: '🧰', category: 'melee', rarity: 'rare', consumable: false, isQuestItem: false, equipSlot: 'hands_weapon', damageMin: 10, damageMax: 16, maxDurability: 200, durability: 200, description: 'Conjunto completo de ferramentas pesadas.' },
  { itemId: 'fuzil_militar', name: 'Fuzil Militar Tático', icon: '🎖️', category: 'firearms', rarity: 'very_rare', consumable: false, isQuestItem: false, equipSlot: 'hands_weapon', damageMin: 35, damageMax: 45, maxDurability: 250, durability: 250, description: 'Armamento de ponta das forças armadas.' },
  { itemId: 'colete_balistico', name: 'Colete Balístico Kevlar', icon: '🛡️', category: 'clothing', rarity: 'very_rare', consumable: false, isQuestItem: false, equipSlot: 'torso_outer', damageReduction: 8, insulation: 2, maxDurability: 250, durability: 250, description: 'Proteção blindada contra tiros e mordidas (Redução fixa de dano).' },
  { itemId: 'reliquia_sobrevivente', name: 'Amuleto do Fundador', icon: '👑', category: 'general', rarity: 'exceptional', isQuestItem: true, consumable: false, description: 'Item lendário único deixado pelos primeiros colonizadores.' },

  // EQUIPAMENTOS E PROFISSÕES / ESPECIALIZAÇÕES
  { itemId: 'algemas', name: 'Algemas de Aço', icon: '⛓️', category: 'general', rarity: 'uncommon', consumable: false, isQuestItem: false, description: 'Algemas de aço padrão policial com chave.' },
  { itemId: 'machado_incendio', name: 'Machado de Incêndio', icon: '🪓', category: 'melee', rarity: 'rare', consumable: false, isQuestItem: false, equipSlot: 'hands_weapon', damageMin: 25, damageMax: 35, maxDurability: 220, durability: 220, description: 'Machado pesado de cabo longo, excelente contra portas e infectados.' },
  { itemId: 'roupa_bombeiro', name: 'Uniforme de Proteção Térmica', icon: '🦺', category: 'clothing', rarity: 'rare', consumable: false, isQuestItem: false, equipSlot: 'torso_inner', damageReduction: 4, insulation: 12, maxDurability: 200, durability: 200, description: 'Traje de bombeiro resistente a chamas e rasgos.' },
  { itemId: 'mascara_respiratoria', name: 'Máscara Respiratória', icon: '🎭', category: 'clothing', rarity: 'uncommon', consumable: false, isQuestItem: false, equipSlot: 'head', damageReduction: 0, insulation: 1, maxDurability: 100, durability: 100, description: 'Filtro facial contra fumaça, poeira e toxinas leves.' },
  { itemId: 'municao_militar', name: 'Munição Militar 5.56mm', icon: '📦', category: 'firearms', rarity: 'rare', consumable: false, isQuestItem: false, description: 'Pente de alta perfuração para fuzis táticos.' },
  { itemId: 'traje_militar', name: 'Traje Militar Camuflado', icon: '🪖', category: 'clothing', rarity: 'rare', consumable: false, isQuestItem: false, equipSlot: 'torso_inner', damageReduction: 3, insulation: 8, maxDurability: 180, durability: 180, description: 'Uniforme de combate reforçado com camuflagem urbana.' },
  { itemId: 'faca_tatica', name: 'Faca de Combate Militar', icon: '🗡️', category: 'melee', rarity: 'uncommon', consumable: false, isQuestItem: false, equipSlot: 'hands_weapon', damageMin: 15, damageMax: 22, maxDurability: 140, durability: 140, description: 'Lâmina serrilhada de aço forjado para combate tático.' },
  { itemId: 'kit_primeiros_socorros', name: 'Kit de Primeiros Socorros', icon: '🚑', category: 'medical', rarity: 'uncommon', consumable: true, consumeEffect: { blood: 40 }, isQuestItem: false, description: 'Kit compacto para estancar sangramentos emergenciais.' },
  { itemId: 'bolsa_farmaceutica', name: 'Bolsa Farmacêutica', icon: '🧰', category: 'general', rarity: 'rare', consumable: false, isQuestItem: false, description: 'Mala com compartimentos térmicos e frascos de ensaio.' },
  { itemId: 'ferramentas_tecnicas', name: 'Estojo de Ferramentas Técnicas', icon: '🔬', category: 'general', rarity: 'rare', consumable: false, isQuestItem: false, description: 'Multímetro, chave de precisão e solda rápida.' },
  { itemId: 'rifle_caca', name: 'Rifle de Caça com Luneta', icon: '🎯', category: 'firearms', rarity: 'rare', consumable: false, isQuestItem: false, equipSlot: 'hands_weapon', damageMin: 45, damageMax: 60, maxDurability: 200, durability: 200, description: 'Rifle de ferrolho com mira telescópica para disparos precisos.' },
  { itemId: 'municao_caca', name: 'Caixa de Cartuchos de Caça', icon: '📦', category: 'firearms', rarity: 'uncommon', consumable: false, isQuestItem: false, description: 'Cartuchos pesados calibre .308 de alto impacto.' },
  { itemId: 'faca_caca', name: 'Faca de Caça Afiada', icon: '🔪', category: 'melee', rarity: 'uncommon', consumable: false, isQuestItem: false, equipSlot: 'hands_weapon', damageMin: 15, damageMax: 22, maxDurability: 130, durability: 130, description: 'Lâmina especial para escalpelar presas e corte de tecidos grossos.' },
  { itemId: 'mochila_sobrevivencia', name: 'Mochila Tática de Mateiro', icon: '🎒', category: 'general', rarity: 'rare', consumable: false, isQuestItem: false, description: 'Mochila robusta com alças e bolsos para longas caminhadas.' },
  { itemId: 'kit_armadilhas', name: 'Kit de Armadilhas Mecânicas', icon: '🐺', category: 'general', rarity: 'uncommon', consumable: false, isQuestItem: false, description: 'Arapucas e laços para captura de animais de pequeno porte.' },
  { itemId: 'canivete_multiuso', name: 'Canivete Multiuso', icon: '🗡️', category: 'melee', rarity: 'uncommon', consumable: false, isQuestItem: false, equipSlot: 'hands_weapon', damageMin: 8, damageMax: 14, maxDurability: 100, durability: 100, description: 'Canivete com múltiplas lâminas, abridor e serra fina.' },
  { itemId: 'ferramentas_agricolas', name: 'Conjunto de Ferramentas Agrícolas', icon: '🧑‍🌾', category: 'melee', rarity: 'uncommon', consumable: false, isQuestItem: false, equipSlot: 'hands_weapon', damageMin: 12, damageMax: 18, maxDurability: 120, durability: 120, description: 'Enxada e foice manual para manejo de plantio.' },
  { itemId: 'sementes_iniciais', name: 'Pacote de Sementes Mistas', icon: '🌱', category: 'supplies', rarity: 'uncommon', consumable: false, isQuestItem: false, description: 'Sementes selecionadas de hortaliças e grãos nutritivos.' },
  { itemId: 'equipamento_quimico', name: 'Equipamento Químico Portátil', icon: '🧪', category: 'general', rarity: 'rare', consumable: false, isQuestItem: false, description: 'Kit de tubos de ensaio, reagentes e medidores de pH.' },
  { itemId: 'caderno_pesquisa', name: 'Caderno de Anotações & Lupa', icon: '📖', category: 'general', rarity: 'rare', consumable: false, isQuestItem: false, description: 'Diário de laboratório e lentes de aumento de precisão.' },
]

/**
 * Verifica se um personagem possui determinado item no inventário pelo itemId ou instanceId.
 */
export function hasItem(inventory = [], targetId) {
  if (!inventory || !Array.isArray(inventory) || !targetId) return false
  const cleanTarget = String(targetId).toLowerCase().trim()
  return inventory.some(item => {
    if (!item) return false
    const matchId = item.itemId && String(item.itemId).toLowerCase().trim() === cleanTarget
    const matchInst = item.instanceId && String(item.instanceId).toLowerCase().trim() === cleanTarget
    const matchName = item.name && String(item.name).toLowerCase().trim() === cleanTarget
    return (matchId || matchInst || matchName) && (item.quantity ?? 1) > 0
  })
}

/**
 * Retorna se uma determinada feature está desbloqueada por algum item no inventário
 */
export function hasFeatureUnlocked(inventory = [], featureId) {
  if (!inventory || !Array.isArray(inventory) || !featureId) return false

  return inventory.some(item => {
    if (!item || (item.quantity ?? 1) <= 0) return false

    // 1. Checa array de unlocks salvo diretamente no item do inventário
    if (Array.isArray(item.unlocks) && item.unlocks.includes(featureId)) {
      return true
    }

    // 2. Checa se o item coincide com algum item padrão do DEFAULT_PRESET_ITEMS que possui esse unlock
    const preset = DEFAULT_PRESET_ITEMS.find(p => p.itemId === item.itemId)
    if (preset && Array.isArray(preset.unlocks) && preset.unlocks.includes(featureId)) {
      return true
    }

    // 3. Fallbacks diretos para o relógio (caso o item tenha sido inserido manualmente pelo Admin sem a tag unlocks)
    if (featureId === 'hud_clock') {
      const cleanId = String(item.itemId || '').toLowerCase()
      const cleanName = String(item.name || '').toLowerCase()
      if (
        cleanId === 'relogio' ||
        cleanId === 'relogio_pulso' ||
        cleanId === 'relogio_digital' ||
        cleanId === 'relogio_parede' ||
        cleanName.includes('relógio') ||
        cleanName.includes('relogio') ||
        cleanName.includes('watch') ||
        cleanName.includes('clock')
      ) {
        return true
      }
    }

    return false
  })
}

/**
 * Retorna o período do dia baseado na hora do jogo (quando o jogador não tem relógio)
 */
export function getTimeOfDay(gameTime) {
  const hour = gameTime?.hour ?? 12
  if (hour >= 5 && hour < 12) {
    return { id: 'morning', label: 'Manhã', icon: '🌅' }
  } else if (hour >= 12 && hour < 18) {
    return { id: 'afternoon', label: 'Tarde', icon: '🌤️' }
  } else {
    return { id: 'night', label: 'Noite', icon: '🌙' }
  }
}

/**
 * Aplica efeitos nos vitais do personagem (Fome, Sede, Sangue)
 */
export function applyConsumeEffect(currentVitals = {}, effect = {}) {
  const hunger = currentVitals.hunger ?? 100
  const thirst = currentVitals.thirst ?? 100
  const blood  = currentVitals.blood  ?? 100

  return {
    hunger: Math.max(0, Math.min(100, hunger + (effect.hunger || 0))),
    thirst: Math.max(0, Math.min(100, thirst + (effect.thirst || 0))),
    blood:  Math.max(0, Math.min(100, blood  + (effect.blood  || 0))),
  }
}

/**
 * Calcula os debuffs aplicados aos atributos baseado nos níveis de Sede e Fome
 * 
 * Regras:
 * - Vitais entre 25% e 50%: -1 em atributos físicos (Força/Destreza).
 * - Vitais abaixo de 25% (Crítico): -2 em Força, Destreza, Constituição e -1 em Sabedoria/Carisma.
 * - Vital em 0% (Inanição/Desidratação): Perda contínua de Sangue e -3 em todos os atributos.
 */
export function getVitalsDebuffs(vitals = {}) {
  const hunger = vitals.hunger ?? 100
  const thirst = vitals.thirst ?? 100
  const blood  = vitals.blood  ?? 100

  const penalties = {
    forca: 0,
    destreza: 0,
    agilidade: 0,
    sabedoria: 0,
    percepcao: 0,
    inteligencia: 0,
    carisma: 0,
    constituicao: 0,
  }

  const reasons = []

  // Avalia pior estado entre Fome e Sede
  const minVital = Math.min(hunger, thirst)

  if (minVital === 0) {
    penalties.forca -= 3
    penalties.destreza -= 3
    penalties.agilidade -= 3
    penalties.constituicao -= 3
    penalties.sabedoria -= 3
    penalties.percepcao -= 3
    penalties.inteligencia -= 2
    penalties.carisma -= 3
    reasons.push(hunger === 0 ? '💀 Inanição Extrema (Fome em 0%)' : '💀 Desidratação Extrema (Sede em 0%)')
  } else if (minVital < 25) {
    penalties.forca -= 2
    penalties.destreza -= 2
    penalties.agilidade -= 2
    penalties.constituicao -= 2
    penalties.sabedoria -= 1
    penalties.percepcao -= 1
    penalties.carisma -= 1
    if (hunger < 25) reasons.push('⚠️ Fome Crítica (< 25%)')
    if (thirst < 25) reasons.push('⚠️ Sede Crítica (< 25%)')
  } else if (minVital <= 50) {
    penalties.forca -= 1
    penalties.destreza -= 1
    penalties.agilidade -= 1
    if (hunger <= 50) reasons.push('🥖 Fome Moderada (≤ 50%)')
    if (thirst <= 50) reasons.push('💧 Sede Moderada (≤ 50%)')
  }

  // Sangue crítico (< 25%) também afeta físico
  if (blood > 0 && blood < 25) {
    penalties.forca -= 1
    penalties.destreza -= 1
    penalties.agilidade -= 1
    penalties.constituicao -= 1
    reasons.push('🩸 Hemorragia / Sangue Crítico (< 25%)')
  }

  const hasDebuff = Object.values(penalties).some(val => val < 0)

  return {
    penalties,
    reasons,
    hasDebuff,
    isStarving: hunger === 0,
    isDehydrated: thirst === 0,
    isBleedingOut: blood === 0
  }
}

/**
 * Retorna os atributos efetivos (atributos base + penalidades de debuffs)
 */
export function calculateEffectiveAttributes(baseAttributes = {}, vitals = {}) {
  const { penalties } = getVitalsDebuffs(vitals)
  const effective = {}

  for (const [attr, val] of Object.entries(baseAttributes)) {
    const penalty = penalties[attr] || 0
    effective[attr] = (val ?? 0) + penalty  // SEM clamp: atributos podem ser negativos
  }

  return effective
}

export function rollSupplyLoot(lootConfig, characterPerks = []) {
  if (!lootConfig || !lootConfig.enabled) return []
  if (Math.random() < (lootConfig.emptyChance ?? 0.25)) return []

  const table = lootConfig.table || []
  if (table.length === 0) return []

  const isLucky = Array.isArray(characterPerks) && characterPerks.includes('sortudo')
  const isUnlucky = Array.isArray(characterPerks) && characterPerks.includes('azarado')

  // Quantidade de itens para sortear (1 a maxItemsPerSearch)
  const maxItems = Math.min(table.length, lootConfig.maxItemsPerSearch || 2)
  const rolled = []
  const available = [...table]

  for (let i = 0; i < maxItems && available.length > 0; i++) {
    const totalChance = available.reduce((acc, it) => {
      let weight = it.chance || 0.3
      if (isLucky && (it.rarity === 'uncommon' || it.rarity === 'rare' || it.rarity === 'very_rare')) {
        weight *= 1.15
      }
      return acc + weight
    }, 0)
    let randomVal = Math.random() * totalChance
    let chosenIdx = -1

    for (let j = 0; j < available.length; j++) {
      let weight = available[j].chance || 0.3
      if (isLucky && (available[j].rarity === 'uncommon' || available[j].rarity === 'rare' || available[j].rarity === 'very_rare')) {
        weight *= 1.15
      }
      randomVal -= weight
      if (randomVal <= 0) {
        chosenIdx = j
        break
      }
    }

    if (chosenIdx !== -1) {
      const chosen = available.splice(chosenIdx, 1)[0]
      const preset = DEFAULT_PRESET_ITEMS.find(p => p.itemId === chosen.itemId)
      let minQ = chosen.min || 1
      let maxQ = chosen.max || 1

      // Desvantagem Azarado: encontra sucata em maior quantidade (2 a 5)
      if (isUnlucky && (chosen.rarity === 'junk' || preset?.rarity === 'junk')) {
        minQ = Math.max(2, minQ)
        maxQ = Math.max(5, maxQ)
      }

      const qty = Math.floor(Math.random() * (maxQ - minQ + 1)) + minQ

      rolled.push({
        instanceId: Math.random().toString(36).substring(2) + Date.now().toString(36),
        itemId: chosen.itemId,
        name: chosen.name || preset?.name || 'Item',
        icon: chosen.icon || preset?.icon || '📦',
        rarity: chosen.rarity || preset?.rarity || 'common',
        quantity: qty,
        category: chosen.category || preset?.category || 'general',
        consumable: chosen.consumable !== undefined ? chosen.consumable : (preset?.consumable ?? false),
        consumeEffect: chosen.consumeEffect || preset?.consumeEffect || null,
        isQuestItem: chosen.isQuestItem !== undefined ? chosen.isQuestItem : (preset?.isQuestItem ?? false),
        equipSlot: chosen.equipSlot || preset?.equipSlot || null,
        insulation: chosen.insulation !== undefined ? chosen.insulation : (preset?.insulation ?? 0),
        damageReduction: chosen.damageReduction !== undefined ? chosen.damageReduction : (preset?.damageReduction ?? 0),
        damageMin: chosen.damageMin !== undefined ? chosen.damageMin : (preset?.damageMin ?? null),
        damageMax: chosen.damageMax !== undefined ? chosen.damageMax : (preset?.damageMax ?? null),
        maxDurability: chosen.maxDurability !== undefined ? chosen.maxDurability : (preset?.maxDurability ?? null),
        durability: chosen.durability !== undefined ? chosen.durability : (preset?.durability ?? preset?.maxDurability ?? null),
        equipped: false,
        description: chosen.description || preset?.description || '',
        unlocks: chosen.unlocks || preset?.unlocks || [],
        obtainedAt: new Date().toISOString(),
        obtainedFrom: 'Busca de Suprimentos'
      })
    }
  }

  return rolled
}

export function rollUniqueLoot(locationUniqueConfig) {
  if (!locationUniqueConfig || !locationUniqueConfig.enabled) return []
  const items = locationUniqueConfig.items || []
  if (items.length === 0) return []

  return items.map(item => {
    const preset = DEFAULT_PRESET_ITEMS.find(p => p.itemId === item.itemId)
    return {
      ...item,
      name: item.name || preset?.name || 'Item Raro',
      icon: item.icon || preset?.icon || '⭐',
      quantity: item.quantity || 1,
      rarity: item.rarity || preset?.rarity || 'rare',
      category: item.category || preset?.category || 'general',
      consumable: item.consumable !== undefined ? item.consumable : (preset?.consumable ?? false),
      consumeEffect: item.consumeEffect || preset?.consumeEffect || null,
      isQuestItem: item.isQuestItem !== undefined ? item.isQuestItem : (preset?.isQuestItem ?? false),
      equipSlot: item.equipSlot || preset?.equipSlot || null,
      insulation: item.insulation !== undefined ? item.insulation : (preset?.insulation ?? 0),
      damageReduction: item.damageReduction !== undefined ? item.damageReduction : (preset?.damageReduction ?? 0),
      damageMin: item.damageMin !== undefined ? item.damageMin : (preset?.damageMin ?? null),
      damageMax: item.damageMax !== undefined ? item.damageMax : (preset?.damageMax ?? null),
      maxDurability: item.maxDurability !== undefined ? item.maxDurability : (preset?.maxDurability ?? null),
      durability: item.durability !== undefined ? item.durability : (preset?.durability ?? preset?.maxDurability ?? null),
      equipped: false,
      description: item.description || preset?.description || '',
      unlocks: item.unlocks || preset?.unlocks || [],
      selected: false
    }
  })
}

/**
 * Calcula a vida (HP/Sangue) máxima do personagem: 100 + (Constituição * 5)
 * Exemplo: 4 de constituição = 120 HP
 */
export function getMaxHp(character) {
  const con = Number(character?.attributes?.constituicao) || 0
  return 100 + (con * 5)
}

/**
 * Retorna as estatísticas totais e itens agrupados por slot de equipamento.
 * Considera itens equipados no inventário (item.equipped === true).
 */
export function calculateCharacterEquipmentStats(inventory = []) {
  const equippedMap = {
    head: null,
    torso_inner: null,
    torso_outer: null,
    hands_gloves: null,
    hands_weapon: null,
    legs: null,
    feet: null,
  }

  let totalInsulation = 0
  let totalDamageReduction = 0
  let weapon = null

  if (Array.isArray(inventory)) {
    inventory.forEach(item => {
      if (!item || !item.equipped) return

      // Determina slot de equipamento do item (ou fallback)
      const slot = item.equipSlot || (item.equippedSlot || null)
      if (slot && equippedMap[slot] === null) {
        equippedMap[slot] = item

        const isBroken = (item.durability !== undefined && Number(item.durability) <= 0)

        // Itens não quebrados concedem isolamento e redução de dano
        if (!isBroken) {
          if (item.insulation) {
            totalInsulation += Number(item.insulation) || 0
          }
          if (item.damageReduction) {
            totalDamageReduction += Number(item.damageReduction) || 0
          }
        }

        if (slot === 'hands_weapon') {
          weapon = item
        }
      }
    })
  }

  let weaponStats = null
  if (weapon) {
    const isBroken = (weapon.durability !== undefined && Number(weapon.durability) <= 0)
    const min = Number(weapon.damageMin) || 3
    const max = Number(weapon.damageMax) || (min + 4)
    weaponStats = {
      name: weapon.name,
      icon: weapon.icon || '⚔️',
      damageMin: min,
      damageMax: max,
      damageText: `${min}–${max}`,
      isBroken,
      durability: weapon.durability,
      maxDurability: weapon.maxDurability
    }
  } else {
    weaponStats = { ...UNARMED_ATTACK }
  }

  return {
    equippedMap,
    totalInsulation,
    totalDamageReduction,
    weaponStats,
    equippedCount: Object.values(equippedMap).filter(Boolean).length
  }
}

/**
 * Calcula a temperatura corporal sentida do sobrevivente baseado no clima e no isolamento das roupas.
 */
export function calculateBodyTemperature(weatherTemp = 20, totalInsulation = 0) {
  const effectiveTemp = Number(weatherTemp) + Number(totalInsulation)
  let status = 'normal'
  let label = 'Conforto Térmico'
  let color = '#4ade80'
  let icon = '🌡️'

  if (effectiveTemp < 5) {
    status = 'freezing'
    label = 'Hipotermia / Frio Extremo'
    color = '#38bdf8'
    icon = '🥶'
  } else if (effectiveTemp < 15) {
    status = 'cold'
    label = 'Frio'
    color = '#60a5fa'
    icon = '🧣'
  } else if (effectiveTemp > 38) {
    status = 'heatstroke'
    label = 'Insolação / Calor Extremo'
    color = '#ef4444'
    icon = '🥵'
  } else if (effectiveTemp > 30) {
    status = 'warm'
    label = 'Aquecido'
    color = '#f59e0b'
    icon = '☀️'
  }

  return {
    effectiveTemp,
    status,
    label,
    color,
    icon
  }
}

/**
 * Rola o dano variável de uma arma (ou ataque desarmado).
 */
export function rollWeaponDamage(weaponStats = UNARMED_ATTACK) {
  const min = Number(weaponStats.damageMin) || 3
  const max = Number(weaponStats.damageMax) || min
  const rolled = Math.floor(Math.random() * (max - min + 1)) + min
  return rolled
}


