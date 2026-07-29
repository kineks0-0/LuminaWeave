import EmptySurface from './EmptySurface.vue';
import { OFFICIAL_SURFACE_CONTRACT_DEFINITIONS } from './officialContracts.js';
import { surfaceRegistry } from './SurfaceRegistry.js';

let initialized = false;

export const initializeSurfaceRuntime = (): void => {
    if (initialized) return;

    OFFICIAL_SURFACE_CONTRACT_DEFINITIONS.forEach(contract => {
        surfaceRegistry.registerContract(contract);
    });

    surfaceRegistry.registerEmptyRenderer({
        contractId: '__empty__',
        component: EmptySurface,
        ownerId: 'core',
        kind: 'empty'
    });

    initialized = true;
};
