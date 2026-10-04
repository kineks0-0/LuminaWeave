import {
    getActivityTargetId,
    normalizeActivityDescriptor
} from '../../../../platform/activity/activityLaunchResolver.js';
import type { ActivityLaunchIntent, ActivityModeHandler } from '../../../../platform/activity/types.js';
import type { SurfaceContractId } from '../../../../platform/surface/types.js';
import type { TelegramStackRoute } from './types.js';

const resolvePanelId = (intent: ActivityLaunchIntent): string => {
    if (intent.target.kind === 'registered-panel') return intent.target.panelId;
    if (intent.target.kind === 'plugin') return intent.target.pluginId;
    return getActivityTargetId(intent);
};

const resolveContractId = (intent: ActivityLaunchIntent): SurfaceContractId | undefined => {
    if (intent.target.kind === 'surface') return intent.target.contractId;
    if (intent.target.kind === 'plugin' || intent.target.kind === 'registered-panel') {
        return intent.target.contractId;
    }
    return undefined;
};

/**
 * Telegram 移动端把 standalone Activity 收进模式自有页面栈。平台不再按模式 ID 特判，
 * 由模式 shell 注册该处理器接管。
 */
export const createTelegramActivityModeHandler = (
    pushRoute: (route: TelegramStackRoute) => void
): ActivityModeHandler => (intent, environment) => {
    if (environment.desktopModeId !== 'telegram' || !environment.isMobile) {
        return false;
    }

    const activity = normalizeActivityDescriptor(intent.activity);
    if (activity.pageType !== 'standalone') {
        return false;
    }

    const panelId = resolvePanelId(intent);
    const contractId = resolveContractId(intent);
    pushRoute({
        name: 'tool',
        panelId,
        title: intent.title,
        icon: intent.icon || '',
        ...(contractId ? { contractId } : {}),
        activity,
        props: intent.props || {}
    });

    return { activity, placement: 'telegram-stack', panelId };
};
