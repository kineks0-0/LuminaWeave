import { computed } from 'vue';
import { activeSettings, useSettings } from '../plugins/settings/useSettings';
import {
    DEFAULT_THEME_PACK_ID,
    getActiveDesktopModeIdFromSettings,
    getThemePackOrDefault,
    resolveComponentSkin
} from './themeRegistry';
import type { ResolvedThemeAppearance } from './types';

const mediaQuery = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

const resolveAppearance = (): ResolvedThemeAppearance => {
    const themeId = getActiveDesktopModeIdFromSettings(activeSettings) || DEFAULT_THEME_PACK_ID;
    const themePack = getThemePackOrDefault(themeId);
    if (themePack.preferredAppearance === 'light' || themePack.preferredAppearance === 'dark') {
        return themePack.preferredAppearance;
    }

    const appearance = activeSettings['lumina-settings.appearance'] || 'system';
    if (appearance === 'light' || appearance === 'dark') {
        return appearance;
    }
    return mediaQuery?.matches ? 'dark' : 'light';
};

export const useComponentSkin = (componentId: string) => {
    useSettings();

    const desktopModeId = computed(() => getActiveDesktopModeIdFromSettings(activeSettings) || DEFAULT_THEME_PACK_ID);
    const resolvedAppearance = computed<ResolvedThemeAppearance>(() => resolveAppearance());
    const resolved = computed(() => resolveComponentSkin(desktopModeId.value, componentId, {
        activeSettings,
        resolvedAppearance: resolvedAppearance.value,
        themePackId: desktopModeId.value,
        desktopModeId: desktopModeId.value,
    }));

    return {
        desktopModeId,
        themePackId: desktopModeId,
        resolvedAppearance,
        desktopMode: computed(() => resolved.value.themePack),
        themePack: computed(() => resolved.value.themePack),
        cssVars: computed(() => resolved.value.cssVars),
        tokens: computed(() => resolved.value.tokens),
        classMap: computed(() => resolved.value.classMap),
        variant: computed(() => resolved.value.variant)
    };
};
