// Utilitários e configurações para o Sistema de Combate em Tempo Real

export const COMBAT_STATUS_EFFECTS = [
  { id: 'bleeding', label: 'Sangrando', icon: '🩸', color: '#ef4444', desc: 'Perdendo vida gradualmente' },
  { id: 'stunned',  label: 'Atordoado', icon: '💫', color: '#f59e0b', desc: 'Incapacitado de reagir' },
  { id: 'burning',  label: 'Em Chamas', icon: '🔥', color: '#f97316', desc: 'Sofrendo dano por fogo' },
  { id: 'infected', label: 'Infectado', icon: '☣️', color: '#10b981', desc: 'Infecção necrosante ativa' },
  { id: 'blind',    label: 'Cego',      icon: '👁️', color: '#8b5cf6', desc: 'Visão comprometida' },
  { id: 'shielded', label: 'Protegido', icon: '🛡️', color: '#38bdf8', desc: 'Sob cobertura ou armadura' },
]

export const MONSTER_TEMPLATES = [
  {
    id: 'zumbi_lento',
    name: 'Zumbi Errante',
    icon: '🧟',
    avatarUrl: '',
    maxHp: 40,
    attributes: { forca: 2, destreza: 1, constituicao: 2, sabedoria: 0, carisma: 0 },
    isBoss: false,
    description: 'Um infectado cambaleante, lento mas resistente.'
  },
  {
    id: 'corredor_infectado',
    name: 'Corredor Feroz',
    icon: '🏃‍♂️🧟',
    avatarUrl: '',
    maxHp: 35,
    attributes: { forca: 2, destreza: 4, constituicao: 1, sabedoria: 0, carisma: 0 },
    isBoss: false,
    description: 'Infectado recente, corre com extrema rapidez e ferocidade.'
  },
  {
    id: 'cao_infectado',
    name: 'Cão Mutante',
    icon: '🐕🧟',
    avatarUrl: '',
    maxHp: 30,
    attributes: { forca: 2, destreza: 4, constituicao: 1, sabedoria: 1, carisma: 0 },
    isBoss: false,
    description: 'Animal corrompido com mandíbula reforçada e reflexos aguçados.'
  },
  {
    id: 'carnical_bruto',
    name: 'Brutamontes Carniçal',
    icon: '👹',
    avatarUrl: '',
    maxHp: 120,
    attributes: { forca: 5, destreza: 2, constituicao: 5, sabedoria: 1, carisma: 0 },
    isBoss: false,
    description: 'Monstro massivo de músculos expostos e impacto esmagador.'
  },
  {
    id: 'boss_alpha',
    name: 'Tyrant Alfa',
    icon: '💀',
    avatarUrl: '',
    maxHp: 250,
    attributes: { forca: 7, destreza: 4, constituicao: 8, sabedoria: 2, carisma: 0 },
    isBoss: true,
    description: 'Abominação colossal mutada. Chefe de encontro extremamente perigoso.'
  },
  {
    id: 'saqueador_armado',
    name: 'Saqueador Hostil',
    icon: '🥷',
    avatarUrl: '',
    maxHp: 60,
    attributes: { forca: 3, destreza: 3, constituicao: 2, sabedoria: 2, carisma: 1 },
    isBoss: false,
    description: 'Sobrevivente humano hostil armado e desesperado.'
  }
]

export const ATTRIBUTE_ICONS = {
  forca: { label: 'FOR', icon: '💪', color: '#f87171' },
  destreza: { label: 'DES', icon: '🏃', color: '#fbbf24' },
  sabedoria: { label: 'SAB', icon: '🧠', color: '#60a5fa' },
  carisma: { label: 'CAR', icon: '🗣️', color: '#c084fc' },
  constituicao: { label: 'CON', icon: '🛡️', color: '#34d399' }
}

/**
 * Retorna o HP máximo com a regra: 50 + (CON * 10)
 */
export function calculateMaxHp(constituicao = 0) {
  const con = Number(constituicao) || 0
  return 50 + (con * 10)
}
