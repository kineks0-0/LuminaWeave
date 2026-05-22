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

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #4aa3ff, #2a6fe6)',
  'linear-gradient(135deg, #6ed36e, #39a94a)',
  'linear-gradient(135deg, #f2b45c, #d46c35)',
  'linear-gradient(135deg, #9b7cff, #6654de)',
  'linear-gradient(135deg, #54c7d5, #2588a7)',
  'linear-gradient(135deg, #e95c67, #c94157)'
];

export const getTelegramInitial = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 1).toUpperCase() : '?';
};

const hashText = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
};

export const getTelegramAvatarStyle = (seed?: string | null) => ({
  '--lw-telegram-avatar-bg': AVATAR_GRADIENTS[hashText(seed || 'telegram') % AVATAR_GRADIENTS.length]
});

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

export const getTelegramSettingsIconName = (pluginId: string): TelegramIconName => {
  if (pluginId.includes('desktop-mode')) return 'palette';
  if (pluginId.includes('chat')) return 'chat';
  if (pluginId.includes('forge')) return 'forge';
  if (pluginId.includes('director')) return 'bot';
  if (pluginId.includes('timeline')) return 'timeline';
  if (pluginId.includes('lorebook')) return 'book';
  if (pluginId.includes('stats')) return 'spark';
  if (pluginId.includes('dev')) return 'settings';
  return 'settings';
};

export const getTelegramSettingsIconTone = (pluginId: string) => {
  if (pluginId.includes('desktop-mode')) return 'blue';
  if (pluginId.includes('chat')) return 'sky';
  if (pluginId.includes('forge')) return 'orange';
  if (pluginId.includes('director')) return 'violet';
  if (pluginId.includes('timeline')) return 'green';
  if (pluginId.includes('lorebook')) return 'cyan';
  if (pluginId.includes('stats')) return 'red';
  return 'blue';
};
