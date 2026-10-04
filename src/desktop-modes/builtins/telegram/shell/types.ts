import type { ActivityDescriptor } from '../../../../platform/activity/types.js';
import type { SurfaceContractId } from '../../../../platform/surface/types.js';

export type TelegramDesktopLeftRoute = 'conversationList' | 'roleList';
export type TelegramMobileTabId = 'conversations' | 'roles' | 'settings' | 'profile';
export type TelegramStackNavDirection = 'forward' | 'back' | 'fade';
export type TelegramStackRouteName =
  | 'conversationList'
  | 'roleList'
  | 'roleProfile'
  | 'chat'
  | 'tool'
  | 'settings'
  | 'profile';

export interface TelegramStackRoute {
  name: TelegramStackRouteName;
  groupKey?: string | null;
  sessionId?: string;
  panelId?: string;
  toolId?: string;
  title?: string;
  icon?: string;
  contractId?: SurfaceContractId;
  activity?: ActivityDescriptor;
  props?: Record<string, unknown>;
}
