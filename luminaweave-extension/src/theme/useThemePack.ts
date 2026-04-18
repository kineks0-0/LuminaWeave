import { computed } from 'vue';
import { activeSettings, useSettings } from '../plugins/settings/useSettings';
import {
    getActiveDesktopModeIdFromSettings,
    DEFAULT_THEME_PACK_ID,
    getDesktopModeOrDefault,
    getDesktopModeShell,
    getThemeNavigationPreset,
    getThemeSurfacePreset,
} from './themeRegistry';
import type { ResolvedThemeAppearance, ThemeWorkspaceMode } from './types';

const mediaQuery = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

const resolveAppearance = (): ResolvedThemeAppearance => {
    const themeId = getActiveDesktopModeIdFromSettings(activeSettings) || DEFAULT_THEME_PACK_ID;
    const themePack = getDesktopModeOrDefault(themeId);
    if (themePack.preferredAppearance === 'light' || themePack.preferredAppearance === 'dark') {
        return themePack.preferredAppearance;
    }

    const appearance = activeSettings['lumina-settings.appearance'] || 'system';
    if (appearance === 'light' || appearance === 'dark') {
        return appearance;
    }
    return mediaQuery?.matches ? 'dark' : 'light';
};

export const useThemePack = () => {
    useSettings();

    const desktopModeId = computed(() => getActiveDesktopModeIdFromSettings(activeSettings) || DEFAULT_THEME_PACK_ID);
    const desktopMode = computed(() => getDesktopModeOrDefault(desktopModeId.value));
    const desktopShell = computed(() => getDesktopModeShell(desktopModeId.value));
    const resolvedAppearance = computed<ResolvedThemeAppearance>(() => resolveAppearance());
    const navigationPreset = computed(() => getThemeNavigationPreset(desktopModeId.value));
    const surfacePreset = computed(() => getThemeSurfacePreset(desktopModeId.value));
    const resolvedLayoutMode = computed<ThemeWorkspaceMode>(() => desktopShell.value.kind);

    return {
        desktopModeId,
        desktopMode,
        desktopShell,
        themePackId: desktopModeId,
        themePack: desktopMode,
        resolvedAppearance,
        navigationPreset,
        surfacePreset,
        resolvedLayoutMode,
    };
};
