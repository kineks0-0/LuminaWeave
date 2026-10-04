import { computed } from 'vue';
import { activeSettings, useSettings } from '../../plugins/settings/useSettings.js';
import {
    getActiveDesktopModeIdFromSettings,
    getDesktopModeNavigationPreset,
    getDesktopModeOrDefault,
    getDesktopModeSettingStorageKey,
    getDesktopModeShell,
    getDesktopModeSurfacePreset,
    resolveRegisteredDesktopModeId,
} from './registry.js';
import type { ResolvedDesktopAppearance, ThemeWorkspaceMode } from './types.js';

const mediaQuery = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

const resolveAppearance = (): ResolvedDesktopAppearance => {
    const desktopModeId = resolveRegisteredDesktopModeId(getActiveDesktopModeIdFromSettings(activeSettings));
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

    const desktopModeId = computed(() =>
        resolveRegisteredDesktopModeId(getActiveDesktopModeIdFromSettings(activeSettings)));
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
