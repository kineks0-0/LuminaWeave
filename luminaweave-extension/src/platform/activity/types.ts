import type { Component } from 'vue';
import type { SurfaceContractId } from '../surface/types.js';

export type ActivitySize = 'default' | 'small';
export type ActivityPageType = 'nested' | 'standalone';
export type ActivityStatusBarIconColor = 'light' | 'dark' | 'auto';
export type ActivityStatusBarSafeAreaMode = 'shell' | 'manual';
export type LegacyActivityMode = 'large' | 'small';

export interface ActivityStatusBarDescriptor {
  background?: string;
  iconColor?: ActivityStatusBarIconColor;
  safeArea?: ActivityStatusBarSafeAreaMode;
}

export interface ResolvedActivityStatusBarAppearance {
  background: string | null;
  iconColor: Exclude<ActivityStatusBarIconColor, 'auto'>;
  safeArea: ActivityStatusBarSafeAreaMode;
}

export interface ActivityTitleBarAction {
  id: string;
  label: string;
  icon?: string;
}

export interface ActivityTitleBarDescriptor {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  actions?: ActivityTitleBarAction[];
}

export interface ActivitySecondaryMenuItem {
  id: string;
  label: string;
  icon?: string;
}

export interface ActivitySecondaryMenuDescriptor {
  activeId?: string;
  items?: ActivitySecondaryMenuItem[];
}

export interface ActivityDescriptor {
  size?: ActivitySize;
  pageType?: ActivityPageType;
  statusBar?: ActivityStatusBarDescriptor;
  titleBar?: ActivityTitleBarDescriptor;
  secondaryMenu?: ActivitySecondaryMenuDescriptor;
}

export interface NormalizedActivityDescriptor {
  size: ActivitySize;
  pageType: ActivityPageType;
  statusBar?: ActivityStatusBarDescriptor;
  titleBar?: ActivityTitleBarDescriptor;
  secondaryMenu?: ActivitySecondaryMenuDescriptor;
}

export type ActivityLaunchRole = 'primary' | 'support' | 'auxiliary' | 'dialog';

export type ActivityLaunchTarget =
  | { kind: 'surface'; contractId: SurfaceContractId }
  | { kind: 'plugin'; pluginId: string; contractId?: SurfaceContractId }
  | { kind: 'registered-panel'; panelId: string; contractId?: SurfaceContractId }
  | { kind: 'component'; component: Component };

export interface ActivityLaunchIntent {
  id?: string;
  title: string;
  icon?: string;
  role?: ActivityLaunchRole;
  target: ActivityLaunchTarget;
  activity?: ActivityDescriptor;
  props?: Record<string, unknown>;
  dedupeKey?: string;
  source?: string;
}

export interface ActivityLaunchEnvironment {
  shellKind?: 'traditional' | 'freeform';
  /**
   * @deprecated Use shellKind. Kept while shell callers finish migrating away
   * from the old user-facing layout mode terminology.
   */
  layoutMode?: 'traditional' | 'freeform';
  isMobile: boolean;
  desktopModeId: string;
}

export interface ActivityDynamicTabConfig {
  id: string;
  name: string;
  icon: string;
  component?: Component | string;
  surfaceContractId?: SurfaceContractId;
  props?: Record<string, unknown>;
  activity?: ActivityDescriptor;
}

export interface ActivityPanelPayload {
  panelId: string;
  title: string;
  icon: string;
  contractId?: SurfaceContractId;
  component?: Component;
  activity: NormalizedActivityDescriptor;
  props: Record<string, unknown>;
}

export type ActivityLaunchPlacement =
  | 'main'
  | 'right-panel'
  | 'temporary-tab'
  | 'workspace-window'
  | 'telegram-stack'
  | 'modal';

export interface ActivityTelegramRoute {
  name: 'tool';
  panelId: string;
  title?: string;
  icon?: string;
  contractId?: SurfaceContractId;
  activity?: NormalizedActivityDescriptor;
  props?: Record<string, unknown>;
}

export interface ActivityLaunchResolution {
  placement: ActivityLaunchPlacement;
  intent: ActivityLaunchIntent;
  activity: NormalizedActivityDescriptor;
  panelId?: string;
  panel?: ActivityPanelPayload;
  workspaceAppId?: string;
  tab?: ActivityDynamicTabConfig;
  modalEvent?: string;
  telegramRoute?: ActivityTelegramRoute;
}
