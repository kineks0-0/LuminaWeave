import { markRaw } from 'vue';
import { surfaceRegistry } from '../surface/SurfaceRegistry';
import type { DesktopModeManifestV2 } from './types';

export class DesktopModeRuntimeRegistry {
    private readonly modes = new Map<string, DesktopModeManifestV2>();

    register(manifest: DesktopModeManifestV2): void {
        if (this.modes.has(manifest.id)) {
            throw new Error(`[DesktopModeRuntimeRegistry] Duplicate desktop mode id: ${manifest.id}`);
        }

        const normalizedManifest: DesktopModeManifestV2 = {
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

    get(desktopModeId: string): DesktopModeManifestV2 | undefined {
        return this.modes.get(desktopModeId);
    }

    list(): DesktopModeManifestV2[] {
        return Array.from(this.modes.values());
    }

    clearForTests(): void {
        this.modes.clear();
    }
}

export const desktopModeRuntimeRegistry = new DesktopModeRuntimeRegistry();
