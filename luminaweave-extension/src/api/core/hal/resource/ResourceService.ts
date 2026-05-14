import type {
    ResourceDocument,
    ResourceListQuery,
    ResourceRef,
    ResourceSaveResult,
    ResourceType,
    ResourceWriteOptions
} from '@shared/resources/index.js';
import type { ResourceSource } from './ResourceSource.js';
import { ResourceSourceRegistry } from './ResourceSourceRegistry.js';

export class ResourceService {
    constructor(private readonly registry: ResourceSourceRegistry) {}

    async listResources(query: ResourceListQuery = {}): Promise<ResourceDocument[]> {
        const sources = query.sourceId
            ? [this.requireSource(query.sourceId)]
            : this.registry.listSources()
                .map(source => this.registry.getSource(source.id))
                .filter((source): source is ResourceSource => Boolean(source));

        const results = await Promise.all(
            sources
                .filter(source => source.descriptor.status.available)
                .map(source => source.listResources(query))
        );

        return results
            .flat()
            .filter(document => !query.resourceType || document.ref.resourceType === query.resourceType)
            .filter(document => this.matchesSearch(document, query.search));
    }

    async getResource(ref: ResourceRef): Promise<ResourceDocument | null> {
        return this.requireSource(ref.sourceId).getResource(ref);
    }

    async saveResource(ref: ResourceRef, payload: unknown, options?: ResourceWriteOptions): Promise<ResourceSaveResult> {
        const source = this.requireSource(ref.sourceId);
        if (!source.saveResource) {
            return {
                status: 'rejected',
                diagnostics: [{
                    level: 'warning',
                    code: 'RESOURCE_SAVE_UNSUPPORTED',
                    message: `Resource source "${ref.sourceId}" does not support saveResource.`
                }]
            };
        }
        return source.saveResource(ref, payload, options);
    }

    async forkResource(ref: ResourceRef, targetSourceId: string): Promise<ResourceDocument> {
        const document = await this.getResource(ref);
        if (!document) {
            throw new Error(`Resource not found: ${ref.path}`);
        }
        return this.importResource(targetSourceId, document.ref.resourceType, {
            ...(document.raw && typeof document.raw === 'object' ? document.raw as object : {}),
            _lumina_forked_from: document.ref
        });
    }

    async importResource(targetSourceId: string, resourceType: ResourceType, payload: unknown): Promise<ResourceDocument> {
        const source = this.requireSource(targetSourceId);
        if (!source.importResource) {
            throw new Error(`Resource source "${targetSourceId}" does not support importResource.`);
        }
        return source.importResource(resourceType, payload);
    }

    async exportResource(ref: ResourceRef): Promise<unknown> {
        const source = this.requireSource(ref.sourceId);
        if (source.exportResource) {
            return source.exportResource(ref);
        }
        const document = await source.getResource(ref);
        return document?.raw ?? null;
    }

    private requireSource(sourceId: string): ResourceSource {
        const source = this.registry.getSource(sourceId);
        if (!source) {
            throw new Error(`Resource source not found: ${sourceId}`);
        }
        return source;
    }

    private matchesSearch(document: ResourceDocument, search?: string): boolean {
        const query = search?.trim().toLowerCase();
        if (!query) return true;
        const haystack = [
            document.summary.name,
            document.summary.description,
            document.summary.format,
            ...(document.summary.keywords ?? []),
            document.ref.path
        ].join('\n').toLowerCase();
        return haystack.includes(query);
    }
}
