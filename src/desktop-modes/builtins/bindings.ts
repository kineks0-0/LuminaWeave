import TelegramUserInfoPanel from './telegram/shell/TelegramUserInfoPanel.vue';
import TelegramShell from './telegram/shell/TelegramShell.vue';
import DiscordShell from './discord/shell/DiscordShell.vue';
import type { DesktopModePackage } from '../core/types.js';

/**
 * 内置模式在受信运行时的组件绑定。manifest 由 core registry 以纯数据注册，
 * 组件在这里单独绑定，避免 core → builtins → shell 组件的循环依赖。
 */
export type DesktopModeBinding = Omit<DesktopModePackage, 'manifest'>;

export const builtinDesktopModeBindings = new Map<string, DesktopModeBinding>([
    ['telegram', {
        shellRenderer: TelegramShell,
        shellChrome: {
            hideGlobalHeader: true
        },
        componentOverrides: [
            {
                contractId: 'telegram.infoPanel',
                component: TelegramUserInfoPanel,
                variant: 'telegram'
            }
        ]
    }],
    ['discord', {
        shellRenderer: DiscordShell,
        shellChrome: {
            headerRailToggle: {
                settingKey: 'discord-channel-mark',
                default: true
            }
        }
    }]
]);
