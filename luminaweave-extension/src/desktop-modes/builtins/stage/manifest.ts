import type { DesktopModeManifest } from '../../core/types.js';
import { stageDesktopModeSettings } from './settings.js';
import { createStageSurfaceSkinMap } from './skins.js';
import { resolveStageDesignTokens } from './tokens.js';

export const stageDesktopMode: DesktopModeManifest = {
    id: 'stage',
    name: '自由工作台',
    description: '以舞台调度和多窗口工作台为核心的桌面模式。',
    preferredAppearance: 'follow-setting',
    shell: {
        kind: 'freeform'
    },
    composition: {
        version: 1,
        desktop: {
            id: 'stage-desktop-activity',
            kind: 'activity-slot',
            size: 'fill',
            visibility: 'visible'
        },
        mobile: {
            id: 'stage-mobile-activity',
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
    designTokens: resolveStageDesignTokens,
    surfaceSkins: createStageSurfaceSkinMap(),
    settingsManifest: stageDesktopModeSettings
};
