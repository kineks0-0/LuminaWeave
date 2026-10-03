import type { RegistrationDisposer } from './PluginRegistrationScope.js';
import type { PluginManifestV2 } from './types.js';

export class PluginDomainRegistry {
    private readonly manifests = new Map<string, PluginManifestV2>();

    register(manifest: PluginManifestV2): RegistrationDisposer {
        if (this.manifests.has(manifest.id)) {
            throw new Error(`[PluginDomainRegistry] Duplicate plugin manifest id: ${manifest.id}`);
        }
        this.manifests.set(manifest.id, manifest);
        return () => {
            if (this.manifests.get(manifest.id) === manifest) {
                this.manifests.delete(manifest.id);
            }
        };
    }

    get(pluginId: string): PluginManifestV2 | undefined {
        return this.manifests.get(pluginId);
    }

    list(): PluginManifestV2[] {
        return Array.from(this.manifests.values());
    }
}

export const pluginDomainRegistry = new PluginDomainRegistry();
