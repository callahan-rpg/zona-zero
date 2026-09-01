import React from 'react'
import {
  MapPin,
  Map,
  Users,
  Swords,
  Dices,
  Settings,
  ShieldAlert,
  LogOut,
  Bell,
  Sun,
  Cloud,
  CloudRain,
  CloudFog,
  CloudLightning,
  Snowflake,
  Package,
  Crosshair,
  Heart,
  Droplets,
  Utensils,
  Backpack,
  Skull,
  Radio,
  Compass,
  Key,
  Shield,
  Zap,
  Flame,
  Search,
  Check,
  X,
  Plus,
  Trash2,
  Edit3,
  ChevronRight,
  ExternalLink,
  Lock,
  Unlock,
  Sparkles,
  Award,
  AlertTriangle,
  Home,
  BookOpen,
  Scroll,
  Scale,
  User,
  LogIn,
  ChevronLeft
} from 'lucide-react'

// Mapeamento dos nomes mais usados no RPG para ícones vetoriais do Lucide
const ICON_MAP = {
  // Navegação e HUD
  home: Home,
  book: BookOpen,
  scroll: Scroll,
  lore: BookOpen,
  rules: Scale,
  user: User,
  login: LogIn,
  arrowLeft: ChevronLeft,
  rooms: MapPin,
  location: MapPin,
  map: Map,
  players: Users,
  characters: Users,
  combat: Swords,
  dice: Dices,
  settings: Settings,
  admin: ShieldAlert,
  logout: LogOut,
  bell: Bell,

  // Clima
  sunny: Sun,
  cloudy: Cloud,
  rainy: CloudRain,
  foggy: CloudFog,
  storm: CloudLightning,
  snowy: Snowflake,

  // Status & Vitals
  hunger: Utensils,
  thirst: Droplets,
  blood: Heart,
  hp: Heart,
  sanity: Zap,
  energy: Zap,
  radioactive: Skull,
  skull: Skull,
  crosshair: Crosshair,
  shield: Shield,

  // Itens & Inventário
  item: Package,
  backpack: Backpack,
  key: Key,
  radio: Radio,
  compass: Compass,
  fire: Flame,
  sparkles: Sparkles,
  medal: Award,

  // Ações / Geral
  search: Search,
  check: Check,
  close: X,
  plus: Plus,
  trash: Trash2,
  edit: Edit3,
  warning: AlertTriangle,
  arrowRight: ChevronRight,
  external: ExternalLink,
  lock: Lock,
  unlock: Unlock
}

/**
 * Componente unificado para ícones do jogo:
 * 1. Se `src` for passado (URL ou /assets/...), renderiza <img>
 * 2. Se `name` corresponder a um ícone SVG Lucide, renderiza o SVG
 * 3. Se `emoji` for passado como fallback, renderiza o emoji
 */
export default function GameIcon({
  name,
  src,
  emoji,
  size = 18,
  color,
  className = '',
  style = {},
  alt = 'icon'
}) {
  // 1. Prioridade: Imagem explícita (URL local ou na web)
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={`game-icon-img ${className}`}
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
          display: 'inline-block',
          verticalAlign: 'middle',
          ...style
        }}
        onError={(e) => {
          if (emoji) {
            e.currentTarget.style.display = 'none'
          }
        }}
      />
    )
  }

  // 2. Prioridade: SVG do Lucide
  const LucideComponent = name ? ICON_MAP[name.toLowerCase()] : null
  if (LucideComponent) {
    return (
      <LucideComponent
        size={size}
        color={color}
        className={`game-icon-svg ${className}`}
        style={{
          display: 'inline-block',
          verticalAlign: 'middle',
          flexShrink: 0,
          ...style
        }}
      />
    )
  }

  // 3. Fallback: Emoji ou texto
  if (emoji) {
    return (
      <span
        className={`game-icon-emoji ${className}`}
        style={{
          fontSize: size,
          lineHeight: 1,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...style
        }}
      >
        {emoji}
      </span>
    )
  }

  // Padrão genérico caso nada seja passado
  return <Package size={size} color={color} className={`game-icon-svg ${className}`} style={style} />
}
