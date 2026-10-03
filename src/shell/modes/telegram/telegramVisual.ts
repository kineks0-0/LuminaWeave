import type { Component } from 'vue';
import {
  Archive,
  ArrowLeft,
  Bell,
  BookOpen,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  CircleUserRound,
  Database,
  Grid2X2,
  Hammer,
  History,
  HousePlus,
  Layers,
  ListFilter,
  Menu,
  MessageCircle,
  MessageCirclePlus,
  MonitorCog,
  MoreVertical,
  Palette,
  PanelRight,
  Plus,
  Rocket,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  UserRound,
  X
} from 'lucide-vue-next';
import { resolveAvatarHue } from '../../../plugins/chat/presentation/telegramChatList.js';

export type TelegramIconName =
  | 'archive'
  | 'back'
  | 'bell'
  | 'book'
  | 'bot'
  | 'chat'
  | 'check'
  | 'chevronDown'
  | 'chevronRight'
  | 'close'
  | 'contacts'
  | 'database'
  | 'desktop'
  | 'filter'
  | 'forge'
  | 'grid'
  | 'history'
  | 'homePlus'
  | 'layers'
  | 'menu'
  | 'messagePlus'
  | 'more'
  | 'palette'
  | 'panels'
  | 'plus'
  | 'privacy'
  | 'rocket'
  | 'search'
  | 'settings'
  | 'spark'
  | 'star'
  | 'timeline'
  | 'user';

export const TELEGRAM_ICON_STROKE_WIDTH = 2.55;

const ICONS: Record<TelegramIconName, Component> = {
  archive: Archive,
  back: ArrowLeft,
  bell: Bell,
  book: BookOpen,
  bot: Bot,
  chat: MessageCircle,
  check: Check,
  chevronDown: ChevronDown,
  chevronRight: ChevronRight,
  close: X,
  contacts: CircleUserRound,
  database: Database,
  desktop: MonitorCog,
  filter: ListFilter,
  forge: Hammer,
  grid: Grid2X2,
  history: History,
  homePlus: HousePlus,
  layers: Layers,
  menu: Menu,
  messagePlus: MessageCirclePlus,
  more: MoreVertical,
  palette: Palette,
  panels: PanelRight,
  plus: Plus,
  privacy: ShieldCheck,
  rocket: Rocket,
  search: Search,
  settings: Settings,
  spark: Sparkles,
  star: Star,
  timeline: Layers,
  user: UserRound
};

export const getTelegramIconComponent = (name: TelegramIconName): Component => ICONS[name];

export const getTelegramInitial = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 1).toUpperCase() : '?';
};

/** 与会话列表的 TelegramAvatar 共用同一色相算法，同一角色在各处的占位色一致 */
export const getTelegramAvatarStyle = (seed?: string | null) => {
  const hue = resolveAvatarHue(seed || 'telegram');
  return {
    '--lw-telegram-avatar-bg': `linear-gradient(180deg, oklch(0.74 0.13 ${hue}), oklch(0.62 0.14 ${hue}))`
  };
};

export const hideBrokenTelegramAvatar = (event: Event) => {
  const image = event.currentTarget;
  if (image instanceof HTMLImageElement) {
    image.hidden = true;
  }
};

export const getTelegramToolIconName = (toolId: string): TelegramIconName => {
  if (toolId === 'lumina-forge') return 'forge';
  if (toolId === 'lumina-launcher') return 'rocket';
  if (toolId.includes('timeline')) return 'timeline';
  if (toolId.includes('stats')) return 'spark';
  if (toolId.includes('director')) return 'bot';
  if (toolId.includes('lorebook')) return 'book';
  return 'grid';
};
