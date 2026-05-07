import type { LuminaPlugin } from '../../types/plugin.js';
import type { SurfaceContractId } from '../surface/types.js';
import type { PluginManifestV2 } from './types.js';
import { getPrimarySurfaceContractIdForPlugin } from './officialPluginSurfaces.js';

export type PluginNavigationSlot = 'mainView' | 'widget' | 'headerCenter' | 'headerRight';

const SURFACE_NAVIGATION_SLOTS: Partial<Record<SurfaceContractId, PluginNavigationSlot[]>> = {
    'chat.main': ['mainView'],
    'timeline.navigator': ['mainView', 'widget'],
    'forge.workspace': ['mainView'],
    'launcher.root': ['mainView'],
    'settings.root': ['widget'],
    'stats.panel': ['widget'],
    'director.panel': ['widget'],
    'lorebook.workspace': ['widget', 'mainView'],
    'dev.tools': ['widget']
};

export const getDefaultNavigationSlotsForSurface = (
    contractId: SurfaceContractId
): PluginNavigationSlot[] => SURFACE_NAVIGATION_SLOTS[contractId] || [];

export const deriveNavigationSlotsFromManifest = (manifest: PluginManifestV2): PluginNavigationSlot[] => {
    if (manifest.navigationSlots?.length) {
        return [...manifest.navigationSlots];
    }

    const declaredSurfaceIds = manifest.surfaces?.map(surface => surface.id) || [];
    const manifestPrimarySurface = manifest.primarySurface || declaredSurfaceIds.find(surfaceId =>
        getDefaultNavigationSlotsForSurface(surfaceId).length > 0
    );
    const primarySurface = manifestPrimarySurface || getPrimarySurfaceContractIdForPlugin(manifest.id);
    const declaresPrimarySurface = manifest.surfaces?.some(surface => surface.id === primarySurface) || false;

    if (!declaresPrimarySurface) {
        return [];
    }

    return getDefaultNavigationSlotsForSurface(primarySurface);
};

export const getPluginNavigationSlots = (
    plugin: Pick<LuminaPlugin, 'slots' | 'platformManifest'>
): PluginNavigationSlot[] => {
    if (plugin.slots?.length) {
        return [...plugin.slots];
    }

    if (!plugin.platformManifest) {
        return [];
    }

    return deriveNavigationSlotsFromManifest(plugin.platformManifest);
};
