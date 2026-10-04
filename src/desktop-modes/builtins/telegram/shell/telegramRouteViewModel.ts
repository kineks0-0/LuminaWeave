import type { ActivityDescriptor } from '../../../../platform/activity/types.js';
import type { SurfaceContractId } from '../../../../platform/surface/types.js';
import type { TelegramStackNavDirection, TelegramStackRoute } from './types.js';

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
  route: TelegramStackRoute,
  contractId?: SurfaceContractId | null
): ActivityDescriptor => {
  const activity = route.activity || { size: 'default', pageType: 'standalone' };
  // 移动端设置页必须走单列小布局：深链工具路由的默认 size 会让设置回退到桌面双栏。
  if (contractId === 'settings.root' && activity.size !== 'small') {
    return { ...activity, size: 'small' };
  }
  return activity;
};

export const resolveTelegramMobileToolProps = (
  route: TelegramStackRoute
): Record<string, unknown> => route.props || {};

export const resolveTelegramMobileToolAuxSidebarMode = (
  contractId: SurfaceContractId
): 'hidden' | undefined => (
  contractId === 'forge.workspace' ? 'hidden' : undefined
);

export const resolveTelegramStackTransitionName = (
  direction: TelegramStackNavDirection
): string => {
  if (direction === 'forward') return 'lw-telegram-stack-forward';
  if (direction === 'back') return 'lw-telegram-stack-back';
  return 'lw-telegram-stack-fade';
};

export const resolveTelegramStackPageKey = (route: TelegramStackRoute): string =>
  [
    route.name,
    route.sessionId,
    route.groupKey,
    route.panelId,
    route.toolId
  ].filter(Boolean).join(':');
