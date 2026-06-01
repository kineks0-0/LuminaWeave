import { computed } from 'vue';
import { activeSettings, useSettings } from '../../plugins/settings/useSettings.js';
import {
    DEFAULT_DESKTOP_MODE_ID,
    getActiveDesktopModeIdFromSettings,
    getDesktopModeNavigationPreset,
    getDesktopModeOrDefault,
    getDesktopModeSettingStorageKey,
    getDesktopModeShell,
    getDesktopModeSurfacePreset,
} from './registry.js';
import type { ResolvedDesktopAppearance, ThemeWorkspaceMode } from './types.js';

const mediaQuery = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

const resolveAppearance = (): ResolvedDesktopAppearance => {
    const desktopModeId = getActiveDesktopModeIdFromSettings(activeSettings) || DEFAULT_DESKTOP_MODE_ID;
    const desktopMode = getDesktopModeOrDefault(desktopModeId);
    const desktopAppearance = activeSettings[getDesktopModeSettingStorageKey(desktopModeId, 'appearanceMode')];
    if (desktopAppearance === 'light' || desktopAppearance === 'dark') {
        return desktopAppearance;
    }
    if (desktopMode.preferredAppearance === 'light' || desktopMode.preferredAppearance === 'dark') {
        return desktopMode.preferredAppearance;
    }

    const appearance = activeSettings['lumina-settings.appearance'] || 'system';
    if (appearance === 'light' || appearance === 'dark') {
        return appearance;
    }
    return mediaQuery?.matches ? 'dark' : 'light';
};

export const useDesktopMode = () => {
    useSettings();

    const desktopModeId = computed(() => getActiveDesktopModeIdFromSettings(activeSettings) || DEFAULT_DESKTOP_MODE_ID);
    const desktopMode = computed(() => getDesktopModeOrDefault(desktopModeId.value));
    const desktopShell = computed(() => getDesktopModeShell(desktopModeId.value));
    const resolvedAppearance = computed<ResolvedDesktopAppearance>(() => resolveAppearance());
    const navigationPreset = computed(() => getDesktopModeNavigationPreset(desktopModeId.value));
    const surfacePreset = computed(() => getDesktopModeSurfacePreset(desktopModeId.value));
    const resolvedLayoutMode = computed<ThemeWorkspaceMode>(() => desktopShell.value.kind);

    return {
        desktopModeId,
        desktopMode,
        desktopShell,
        resolvedAppearance,
        navigationPreset,
        surfacePreset,
        resolvedLayoutMode,
    };
};
