import type { DesktopModeManifest } from '../../core/types.js';
import { discordDesktopModeSettings } from './settings.js';
import { createDiscordSurfaceSkinMap } from './skins.js';
import { resolveDiscordDesignTokens } from './tokens.js';

export const discordDesktopMode: DesktopModeManifest = {
    id: 'discord',
    name: 'Discord 桌面',
    description: '频道式桌面模式，角色轨、聊天区和侧栏统一成更强的面板结构，并跟随全局浅色/深色外观。',
    preferredAppearance: 'follow-setting',
    shell: {
        kind: 'traditional'
    },
    composition: {
        version: 1,
        desktop: {
            id: 'discord-desktop-layout',
            kind: 'group',
            direction: 'row',
            size: 'fill',
            visibility: 'visible',
            children: [
                {
                    id: 'discord-desktop-roster',
                    kind: 'surface',
                    contractId: 'character.roster',
                    input: { compact: true },
                    size: 'content',
                    visibility: 'visible',
                    collapsesWithNavigation: true
                },
                {
                    id: 'discord-desktop-activity',
                    kind: 'activity-slot',
                    size: 'fill',
                    visibility: 'visible'
                }
            ]
        },
        mobile: {
            id: 'discord-mobile-activity',
            kind: 'activity-slot',
            size: 'fill',
            visibility: 'visible'
        }
    },
    navigationPreset: {
        traditional: {
            headerVariant: 'discord',
            leftRail: 'character-rail',
            widgetVariant: 'discord',
            headerDesktopPosition: 'top',
            headerMobilePosition: 'top',
        },
    },
    surfacePreset: {
        mainSurfaceVariant: 'discord',
        widgetSurfaceVariant: 'discord',
    },
    designTokens: resolveDiscordDesignTokens,
    surfaceSkins: createDiscordSurfaceSkinMap(),
    rendererVariants: {
        'shell.header': 'discord',
        'shell.widget': 'discord',
        'shell.mobileDiscord': 'discord',
        'shell.guildRail': 'discord',
        'shell.characterRail': 'discord',
        'shell.characterCard': 'discord',
        'chat.main': 'discord',
        'settings.root': 'discord-panel',
        'settings.control': 'discord',
        'timeline.root': 'discord',
        'lorebook.workspace': 'discord',
        'lorebook.editor': 'discord'
    },
    settingsManifest: discordDesktopModeSettings
};
