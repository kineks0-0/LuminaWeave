import type { ResourceSourceDescriptor } from '@shared/resources/index.js';
import type { ResourceSource } from './ResourceSource.js';

export class ResourceSourceRegistry {
    private readonly sources = new Map<string, ResourceSource>();

    registerSource(source: ResourceSource): void {
        this.sources.set(source.descriptor.id, source);
    }

    listSources(): ResourceSourceDescriptor[] {
        return Array.from(this.sources.values()).map(source => source.descriptor);
    }

    getSource(sourceId: string): ResourceSource | null {
        return this.sources.get(sourceId) ?? null;
    }

    async mountSource(sourceId: string, options?: Record<string, unknown>): Promise<void> {
        const source = this.getSource(sourceId);
        if (!source) {
            throw new Error(`Resource source not found: ${sourceId}`);
        }
        await source.mount?.(options);
    }
}
