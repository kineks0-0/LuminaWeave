import type { ActivityDescriptor } from '../../../platform/activity/types.js';
import type { SurfaceContractId } from '../../../platform/surface/types.js';
import type { TelegramStackRoute } from '../../types.js';

type SurfaceContractResolver = (id: string) => SurfaceContractId | null;

export interface TelegramToolContractResolvers {
  resolveRegisteredPanelContractId: SurfaceContractResolver;
  resolvePluginContractId: SurfaceContractResolver;
}

const telegramMobileRootRouteNames = new Set<TelegramStackRoute['name']>([
  'conversationList',
  'roleList',
  'settings',
  'profile'
]);

export const isTelegramMobileRootRoute = (route: TelegramStackRoute): boolean =>
  telegramMobileRootRouteNames.has(route.name);

export const canPopTelegramMobileRoute = (route: TelegramStackRoute): boolean =>
  !isTelegramMobileRootRoute(route);

export const shouldShowTelegramMobileBottomNav = (
  isTelegramMobileMode: boolean,
  route: TelegramStackRoute
): boolean => isTelegramMobileMode && isTelegramMobileRootRoute(route);

export const shouldShowTelegramMobileStackBar = (route: TelegramStackRoute): boolean =>
  canPopTelegramMobileRoute(route) && !['chat', 'roleProfile'].includes(route.name);

export const resolveTelegramMobileRouteTitle = (route: TelegramStackRoute): string => {
  if (route.name === 'characterOverview') return '角色概览';
  if (route.name === 'roleProfile') return '角色资料';
  if (route.name === 'chat') return '聊天';
  if (route.name === 'tool') return route.title || '工具';
  return '';
};

export const resolveTelegramMobileToolContractId = (
  route: TelegramStackRoute,
  resolvers: TelegramToolContractResolvers
): SurfaceContractId | null => {
  if (route.contractId) {
    return route.contractId;
  }
  const panelId = route.panelId || route.toolId || 'lumina-settings';
  return resolvers.resolveRegisteredPanelContractId(panelId)
    || resolvers.resolvePluginContractId(panelId);
};

export const resolveTelegramMobileToolActivity = (
  route: TelegramStackRoute
): ActivityDescriptor => route.activity || { size: 'default', pageType: 'standalone' };

export const resolveTelegramMobileToolProps = (
  route: TelegramStackRoute
): Record<string, unknown> => route.props || {};

export const resolveTelegramMobileToolAuxSidebarMode = (
  contractId: SurfaceContractId
): 'hidden' | undefined => (
  contractId === 'forge.workspace' ? 'hidden' : undefined
);
