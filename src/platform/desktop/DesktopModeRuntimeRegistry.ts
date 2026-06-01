import { markRaw } from 'vue';
import { surfaceRegistry } from '../surface/SurfaceRegistry.js';
import type { DesktopModeRuntimeDescriptor } from './types.js';

export class DesktopModeRuntimeRegistry {
    private readonly modes = new Map<string, DesktopModeRuntimeDescriptor>();

    register(manifest: DesktopModeRuntimeDescriptor): void {
        if (this.modes.has(manifest.id)) {
            throw new Error(`[DesktopModeRuntimeRegistry] Duplicate desktop mode id: ${manifest.id}`);
        }

        const normalizedManifest: DesktopModeRuntimeDescriptor = {
            ...manifest,
            shellRenderer: manifest.shellRenderer ? markRaw(manifest.shellRenderer) : undefined
        };

        this.modes.set(manifest.id, normalizedManifest);

        Object.values(manifest.componentOverrides || {}).forEach(renderer => {
            if (!renderer) return;
            surfaceRegistry.registerDesktopOverride(manifest.id, {
                ...renderer,
                component: markRaw(renderer.component)
            });
        });
    }

    get(desktopModeId: string): DesktopModeRuntimeDescriptor | undefined {
        return this.modes.get(desktopModeId);
    }

    list(): DesktopModeRuntimeDescriptor[] {
        return Array.from(this.modes.values());
    }

    clearForTests(): void {
        this.modes.clear();
        surfaceRegistry.clearDesktopOverridesForTests();
    }
}

export const desktopModeRuntimeRegistry = new DesktopModeRuntimeRegistry();
