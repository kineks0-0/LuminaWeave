import { HALContext } from '../../hal/HALContext.js';
import {
    buildSourceResourcePath,
    cloneSTRawPayload,
    summarizeSTResource,
    type ResourceCapabilities,
    type ResourceDocument,
    type ResourceListQuery,
    type ResourceRef,
    type ResourceSaveResult,
    type ResourceSourceDescriptor,
    type ResourceType
} from '@shared/resources/index.js';
import type { ResourceSource } from '../../hal/resource/ResourceSource.js';

const SOURCE_ID = 'local';
const NAMESPACE = 'lumina_resources_local';
const TABLE = 'resources';

const DEFAULT_CAPABILITIES: ResourceCapabilities = {
    readable: true,
    writable: true,
    forkable: true,
    importable: true,
    exportable: true,
    searchable: true
};

const toKey = (resourceType: ResourceType, resourceId: string): string => `${resourceType}.${resourceId}`;
const fromKey = (key: string): { resourceType: ResourceType; resourceId: string } | null => {
    const [resourceType, ...rest] = key.split('.');
    const resourceId = rest.join('.');
    if (!resourceId) return null;
    if (!['character', 'worldbook', 'preset', 'regex', 'memory'].includes(resourceType)) return null;
    return { resourceType: resourceType as ResourceType, resourceId };
};

const createResourceId = (payload: unknown, fallbackType: ResourceType): string => {
    const raw = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
    const name = typeof raw.name === 'string' && raw.name.trim()
        ? raw.name.trim()
        : `${fallbackType}-${Date.now()}`;
    return name
        .replace(/\.[a-z0-9]+$/i, '')
        .replace(/[^\w\u4e00-\u9fa5-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        || `${fallbackType}-${Date.now()}`;
};

export class LocalResourceSource implements ResourceSource {
    readonly descriptor: ResourceSourceDescriptor = {
        id: SOURCE_ID,
        kind: 'lumina-local',
        label: 'Lumina Local',
        status: { available: true },
        capabilities: DEFAULT_CAPABILITIES
    };

    async listResources(query: ResourceListQuery = {}): Promise<ResourceDocument[]> {
        const keys = await this.listKeys();
        const docs = await Promise.all(
            keys
                .map(fromKey)
                .filter((item): item is { resourceType: ResourceType; resourceId: string } => Boolean(item))
                .filter(item => !query.resourceType || item.resourceType === query.resourceType)
                .map(item => this.getById(item.resourceType, item.resourceId))
        );
        return docs.filter((doc): doc is ResourceDocument => Boolean(doc));
    }

    async getResource(ref: ResourceRef): Promise<ResourceDocument | null> {
        return this.getById(ref.resourceType, ref.resourceId);
    }

    async saveResource(ref: ResourceRef, payload: unknown): Promise<ResourceSaveResult> {
        const raw = cloneSTRawPayload(payload);
        await this.setRaw(ref.resourceType, ref.resourceId, raw);
        return {
            status: 'saved',
            document: this.toDocument(ref.resourceType, ref.resourceId, raw, ref.forkedFrom ?? null)
        };
    }

    async importResource(resourceType: ResourceType, payload: unknown): Promise<ResourceDocument> {
        const raw = cloneSTRawPayload(payload);
        const resourceId = createResourceId(raw, resourceType);
        let candidateId = resourceId;
        let suffix = 1;
        while (await this.getRaw(resourceType, candidateId)) {
            suffix += 1;
            candidateId = `${resourceId}-${suffix}`;
        }
        await this.setRaw(resourceType, candidateId, raw);
        return this.toDocument(resourceType, candidateId, raw, (raw as Record<string, unknown>)._lumina_forked_from as ResourceRef | null ?? null);
    }

    async exportResource(ref: ResourceRef): Promise<unknown> {
        return this.getRaw(ref.resourceType, ref.resourceId);
    }

    private async getById(resourceType: ResourceType, resourceId: string): Promise<ResourceDocument | null> {
        const raw = await this.getRaw(resourceType, resourceId);
        return raw ? this.toDocument(resourceType, resourceId, raw) : null;
    }

    private toDocument(resourceType: ResourceType, resourceId: string, raw: unknown, forkedFrom: ResourceRef | null = null): ResourceDocument {
        const path = buildSourceResourcePath(SOURCE_ID, resourceType, resourceId);
        const ref: ResourceRef = {
            sourceId: SOURCE_ID,
            resourceType,
            resourceId,
            revision: typeof raw === 'object' && raw ? (raw as Record<string, unknown>)._lumina_revision as string | number | undefined : undefined,
            path,
            writable: true,
            origin: forkedFrom?.sourceId ? 'import' : 'lumina-local',
            forkedFrom
        };
        return {
            ref,
            raw,
            summary: summarizeSTResource(resourceType, resourceId, raw),
            capabilities: DEFAULT_CAPABILITIES
        };
    }

    private async listKeys(): Promise<string[]> {
        try {
            return await HALContext.instance.runtime.extensionStore.listKeys({ namespace: NAMESPACE, table: TABLE });
        } catch (error) {
            console.warn('[LocalResourceSource] listKeys failed', error);
            return [];
        }
    }

    private async getRaw(resourceType: ResourceType, resourceId: string): Promise<unknown | null> {
        try {
            return await HALContext.instance.runtime.extensionStore.getJson({
                namespace: NAMESPACE,
                table: TABLE,
                key: toKey(resourceType, resourceId)
            });
        } catch {
            return null;
        }
    }

    private async setRaw(resourceType: ResourceType, resourceId: string, raw: unknown): Promise<void> {
        await HALContext.instance.runtime.extensionStore.setJson({
            namespace: NAMESPACE,
            table: TABLE,
            key: toKey(resourceType, resourceId),
            value: raw
        });
    }
}
