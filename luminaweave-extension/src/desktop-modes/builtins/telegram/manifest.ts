import type { DesktopModeManifest } from '../../core/types.js';
import { telegramDesktopModeSettings } from './settings.js';
import { createTelegramSurfaceSkinMap } from './skins.js';
import { resolveTelegramDesignTokens } from './tokens.js';

export const telegramDesktopMode: DesktopModeManifest = {
    id: 'telegram',
    name: 'Telegram 桌面',
    description: '以聊天为中心的 Liquid Glass 桌面模式，支持浅色/深色、角色列表、会话资料页与移动端四项底栏。',
    preferredAppearance: 'follow-setting',
    shell: {
        kind: 'traditional'
    },
    navigationPreset: {
        traditional: {
            headerVariant: 'telegram',
            leftRail: 'character-rail',
            widgetVariant: 'telegram',
            headerDesktopPosition: 'top',
            headerMobilePosition: 'bottom',
        },
    },
    surfacePreset: {
        mainSurfaceVariant: 'telegram',
        widgetSurfaceVariant: 'telegram',
        chatVariant: 'telegram',
        settingsVariant: 'telegram',
        timelineVariant: 'telegram',
    },
    designTokens: resolveTelegramDesignTokens,
    surfaceSkins: createTelegramSurfaceSkinMap(),
    rendererVariants: {
        'telegram.frame': 'telegram',
        'telegram.chatList': 'telegram',
        'telegram.conversation': 'telegram',
        'telegram.infoPanel': 'telegram',
        'telegram.composer': 'telegram',
        'shell.header': 'telegram',
        'shell.widget': 'telegram',
        'shell.mainSurface': 'telegram',
        'shell.characterRail': 'telegram',
        'shell.characterCard': 'telegram',
        'chat.stream': 'telegram',
        'chat.preview': 'telegram',
        'settings.root': 'telegram',
        'settings.unified': 'telegram',
        'settings.detailed': 'telegram',
        'settings.control': 'telegram',
        'timeline.root': 'telegram',
        'lorebook.workspace': 'telegram',
        'lorebook.editor': 'telegram',
        'stats.panel': 'telegram',
        'director.panel': 'telegram'
    },
    settingsManifest: telegramDesktopModeSettings
};
