import EmptySurface from './EmptySurface.vue';
import { OFFICIAL_SURFACE_CONTRACTS } from './officialContracts';
import { surfaceRegistry } from './SurfaceRegistry';

let initialized = false;

export const initializeSurfaceRuntime = (): void => {
    if (initialized) return;

    OFFICIAL_SURFACE_CONTRACTS.forEach(contractId => {
        surfaceRegistry.registerContract({ id: contractId });
    });

    surfaceRegistry.registerEmptyRenderer({
        contractId: '__empty__',
        component: EmptySurface,
        ownerId: 'core',
        kind: 'empty'
    });

    initialized = true;
};
