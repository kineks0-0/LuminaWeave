import type { DesktopModeManifest } from '../../core/types.js';
import { classicDesktopModeSettings } from './settings.js';
import { createClassicSurfaceSkinMap } from './skins.js';
import { resolveClassicDesignTokens } from './tokens.js';

export const classicDesktopMode: DesktopModeManifest = {
    id: 'classic',
    name: '传统桌面',
    description: '保留当前 Lumina 工作区的传统桌面组织方式与默认阅读节奏。',
    preferredAppearance: 'follow-setting',
    shell: {
        kind: 'traditional'
    },
    composition: {
        version: 1,
        desktop: {
            id: 'classic-desktop-activity',
            kind: 'activity-slot',
            size: 'fill',
            visibility: 'visible'
        },
        mobile: {
            id: 'classic-mobile-activity',
            kind: 'activity-slot',
            size: 'fill',
            visibility: 'visible'
        }
    },
    navigationPreset: {
        traditional: {
            headerVariant: 'default',
            leftRail: 'none',
            widgetVariant: 'default',
            headerDesktopPosition: 'follow-setting',
            headerMobilePosition: 'follow-setting',
        },
    },
    surfacePreset: {
        mainSurfaceVariant: 'default',
        widgetSurfaceVariant: 'default',
        chatVariant: 'default',
        settingsVariant: 'default',
        timelineVariant: 'default',
    },
    designTokens: resolveClassicDesignTokens,
    surfaceSkins: createClassicSurfaceSkinMap(),
    settingsManifest: classicDesktopModeSettings
};
