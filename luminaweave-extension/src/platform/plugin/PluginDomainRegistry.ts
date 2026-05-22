import type { PluginManifestV2 } from './types.js';

export class PluginDomainRegistry {
    private readonly manifests = new Map<string, PluginManifestV2>();

    register(manifest: PluginManifestV2): void {
        if (this.manifests.has(manifest.id)) {
            throw new Error(`[PluginDomainRegistry] Duplicate plugin manifest id: ${manifest.id}`);
        }
        this.manifests.set(manifest.id, manifest);
    }

    get(pluginId: string): PluginManifestV2 | undefined {
        return this.manifests.get(pluginId);
    }

    list(): PluginManifestV2[] {
        return Array.from(this.manifests.values());
    }
}

export const pluginDomainRegistry = new PluginDomainRegistry();
