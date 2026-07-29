import type { LuminaPlugin } from '../../types/plugin.js';
import type { SurfaceContractId } from '../surface/types.js';

export const getPrimarySurfaceContractIdForPlugin = (
    plugin: Pick<LuminaPlugin, 'platformManifest'>
): SurfaceContractId | null => plugin.platformManifest?.primarySurface || null;
