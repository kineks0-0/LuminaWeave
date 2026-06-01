import { computed } from 'vue';
import { activeSettings, useSettings } from '../../plugins/settings/useSettings.js';
import {
    DEFAULT_DESKTOP_MODE_ID,
    getActiveDesktopModeIdFromSettings,
    getDesktopModeOrDefault,
    getDesktopModeSettingStorageKey,
    resolveSurfaceSkin
} from './registry.js';
import type { ResolvedDesktopAppearance } from './types.js';

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

export const useSurfaceSkin = (componentId: string) => {
    useSettings();

    const desktopModeId = computed(() => getActiveDesktopModeIdFromSettings(activeSettings) || DEFAULT_DESKTOP_MODE_ID);
    const resolvedAppearance = computed<ResolvedDesktopAppearance>(() => resolveAppearance());
    const resolved = computed(() => resolveSurfaceSkin(desktopModeId.value, componentId, {
        activeSettings,
        resolvedAppearance: resolvedAppearance.value,
        desktopModeId: desktopModeId.value,
    }));

    return {
        desktopModeId,
        resolvedAppearance,
        desktopMode: computed(() => resolved.value.desktopMode),
        cssVars: computed(() => resolved.value.cssVars),
        tokens: computed(() => resolved.value.tokens),
        classMap: computed(() => resolved.value.classMap),
        variant: computed(() => resolved.value.variant)
    };
};
