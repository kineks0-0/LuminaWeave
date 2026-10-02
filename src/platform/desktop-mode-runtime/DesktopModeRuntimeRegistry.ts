import { markRaw } from 'vue';
import type {
    DesktopCompositionNode,
    DesktopCompositionViewport
} from '../../desktop-modes/core/types.js';
import { SurfaceRegistry, surfaceRegistry } from '../surface/SurfaceRegistry.js';
import type { SurfaceRendererDefinitionUnion } from '../surface/types.js';
import {
    collectDesktopCompositionSurfaceIds,
    requireDesktopModeComposition,
    resolveDesktopComposition,
    validateDesktopModeComposition
} from './DesktopCompositionRuntime.js';
import type { DesktopModeRuntimeDescriptor } from './types.js';

export class DesktopModeRuntimeRegistry {
    private readonly modes = new Map<string, DesktopModeRuntimeDescriptor>();

    constructor(private readonly surfaces: SurfaceRegistry = surfaceRegistry) {}

    private prepareRegistration(manifest: DesktopModeRuntimeDescriptor): {
        composition: DesktopModeRuntimeDescriptor['composition'];
        overrides: SurfaceRendererDefinitionUnion[];
    } {
        if (this.modes.has(manifest.id)) {
            throw new Error(`[DesktopModeRuntimeRegistry] Duplicate desktop mode id: ${manifest.id}`);
        }

        const composition = validateDesktopModeComposition(
            requireDesktopModeComposition(manifest.manifest.composition),
            this.surfaces
        );

        const overrides = Object.values(manifest.componentOverrides || {})
            .filter((renderer): renderer is SurfaceRendererDefinitionUnion => Boolean(renderer));

        this.surfaces.assertCanRegisterDesktopOverrides(manifest.id, overrides);
        return { composition, overrides };
    }

    assertCanRegister(manifest: DesktopModeRuntimeDescriptor): void {
        this.prepareRegistration(manifest);
    }

    register(manifest: DesktopModeRuntimeDescriptor): void {
        const { composition, overrides } = this.prepareRegistration(manifest);
        const normalizedOverrides = overrides.map(renderer => ({
            ...renderer,
            component: markRaw(renderer.component)
        } as SurfaceRendererDefinitionUnion));

        const normalizedManifest: DesktopModeRuntimeDescriptor = {
            ...manifest,
            manifest: {
                ...manifest.manifest,
                composition
            },
            composition,
            navigationModel: {
                ...manifest.navigationModel,
                primarySurfaces: collectDesktopCompositionSurfaceIds(composition.desktop),
                mobileSurfaces: collectDesktopCompositionSurfaceIds(composition.mobile)
            },
            shellRenderer: manifest.shellRenderer ? markRaw(manifest.shellRenderer) : undefined
        };

        this.surfaces.registerDesktopOverrides(manifest.id, normalizedOverrides);
        this.modes.set(manifest.id, normalizedManifest);
    }

    get(desktopModeId: string): DesktopModeRuntimeDescriptor | undefined {
        return this.modes.get(desktopModeId);
    }

    list(): DesktopModeRuntimeDescriptor[] {
        return Array.from(this.modes.values());
    }

    resolveComposition(
        desktopModeId: string,
        viewport: DesktopCompositionViewport
    ): DesktopCompositionNode {
        const mode = this.modes.get(desktopModeId);
        if (!mode) {
            throw new Error(`[DesktopModeRuntimeRegistry] Unknown desktop mode: ${desktopModeId}`);
        }
        return resolveDesktopComposition(mode.composition, viewport);
    }

    clearForTests(): void {
        this.modes.clear();
        this.surfaces.clearDesktopOverridesForTests();
    }
}

export const desktopModeRuntimeRegistry = new DesktopModeRuntimeRegistry();
