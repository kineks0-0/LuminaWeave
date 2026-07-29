import { markRaw } from 'vue';
import { SurfaceRegistry, surfaceRegistry } from '../surface/SurfaceRegistry.js';
import type { SurfaceRendererDefinitionUnion } from '../surface/types.js';
import type { DesktopModeRuntimeDescriptor } from './types.js';

export class DesktopModeRuntimeRegistry {
    private readonly modes = new Map<string, DesktopModeRuntimeDescriptor>();

    constructor(private readonly surfaces: SurfaceRegistry = surfaceRegistry) {}

    register(manifest: DesktopModeRuntimeDescriptor): void {
        if (this.modes.has(manifest.id)) {
            throw new Error(`[DesktopModeRuntimeRegistry] Duplicate desktop mode id: ${manifest.id}`);
        }

        const normalizedManifest: DesktopModeRuntimeDescriptor = {
            ...manifest,
            shellRenderer: manifest.shellRenderer ? markRaw(manifest.shellRenderer) : undefined
        };

        const overrides = Object.values(manifest.componentOverrides || {})
            .filter((renderer): renderer is SurfaceRendererDefinitionUnion => Boolean(renderer))
            .map(renderer => ({
                ...renderer,
                component: markRaw(renderer.component)
            } as SurfaceRendererDefinitionUnion));

        this.surfaces.registerDesktopOverrides(manifest.id, overrides);
        this.modes.set(manifest.id, normalizedManifest);
    }

    get(desktopModeId: string): DesktopModeRuntimeDescriptor | undefined {
        return this.modes.get(desktopModeId);
    }

    list(): DesktopModeRuntimeDescriptor[] {
        return Array.from(this.modes.values());
    }

    clearForTests(): void {
        this.modes.clear();
        this.surfaces.clearDesktopOverridesForTests();
    }
}

export const desktopModeRuntimeRegistry = new DesktopModeRuntimeRegistry();
