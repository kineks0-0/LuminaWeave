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
import { STGlobalAccessor } from './STGlobalAccessor.js';
import { STClient } from './STClient.js';
import type { ResourceSource } from '../../hal/resource/ResourceSource.js';
import { resourceWritePolicyService } from '../../hal/resource/ResourceWritePolicyService.js';

const SOURCE_ID = 'st';

const ST_CAPABILITIES: ResourceCapabilities = {
    readable: true,
    writable: false,
    forkable: true,
    importable: false,
    exportable: true,
    searchable: true
};

const normalizeId = (value: unknown, fallback: string): string => {
    const text = typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
    return (text || fallback)
        .replace(/\.json$/i, '')
        .replace(/[^\w\u4e00-\u9fa5-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        || fallback;
};

const normalizeCharacterResourceId = (value: unknown, fallback: string): string => {
    const text = typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
    const base = text || fallback;
    if (/\.png$/i.test(base)) {
        return `${normalizeId(base.replace(/\.png$/i, ''), fallback)}.json`;
    }
    return normalizeId(base, fallback);
};

const normalizeLegacyCharacterResourceId = (value: unknown, fallback: string): string =>
    normalizeId(value, fallback);

const getContextCharacters = (): any[] => {
    return STClient.getCharacters();
};

const getWorldbookNames = (): string[] => {
    return STClient.getWorldbookNames();
};

const getWorldbookRaw = async (resourceId: string): Promise<Record<string, unknown> | null> => {
    return STClient.getWorldbook(resourceId);
};

const getPresetNames = (): string[] => {
    const names = new Set<string>();
    ['openai', 'textgenerationwebui', 'instruct', 'context'].forEach(type => {
        try {
            STClient.getPresets(type).forEach(name => names.add(name));
        } catch {
            // Ignore absent managers.
        }
    });
    names.add('in_use');
    return Array.from(names).filter(Boolean);
};

export class STResourceSource implements ResourceSource {
    get descriptor(): ResourceSourceDescriptor {
        const available = Boolean(STGlobalAccessor.stMain || STGlobalAccessor.stHelper);
        return {
            id: SOURCE_ID,
            kind: 'st',
            label: 'SillyTavern',
            status: {
                available,
                reason: available ? undefined : 'SillyTavern runtime is not available.'
            },
            capabilities: ST_CAPABILITIES
        };
    }

    async listResources(query: ResourceListQuery = {}): Promise<ResourceDocument[]> {
        if (!this.descriptor.status.available) return [];
        const types: ResourceType[] = query.resourceType
            ? [query.resourceType]
            : ['character', 'worldbook', 'preset'];
        const lists = await Promise.all(types.map(type => this.listByType(type)));
        return lists.flat();
    }

    async getResource(ref: ResourceRef): Promise<ResourceDocument | null> {
        if (!this.descriptor.status.available) return null;
        return this.getByType(ref.resourceType, ref.resourceId);
    }

    async saveResource(ref: ResourceRef, _payload: unknown): Promise<ResourceSaveResult> {
        return resourceWritePolicyService.createRequiresPolicyResult(ref);
    }

    async exportResource(ref: ResourceRef): Promise<unknown> {
        return (await this.getResource(ref))?.raw ?? null;
    }

    private async listByType(resourceType: ResourceType): Promise<ResourceDocument[]> {
        if (resourceType === 'character') {
            return getContextCharacters()
                .map((character, index) => this.toDocument('character', normalizeCharacterResourceId(character?.avatar ?? character?.name, String(index)), this.normalizeCharacterRaw(character, index)));
        }
        if (resourceType === 'worldbook') {
            const docs = await Promise.all(getWorldbookNames().map(async name => this.getWorldbookDocument(name)));
            return docs.filter((doc): doc is ResourceDocument => Boolean(doc));
        }
        if (resourceType === 'preset') {
            const docs = await Promise.all(getPresetNames().map(async name => this.getPresetDocument(name)));
            return docs.filter((doc): doc is ResourceDocument => Boolean(doc));
        }
        return [];
    }

    private async getByType(resourceType: ResourceType, resourceId: string): Promise<ResourceDocument | null> {
        if (resourceType === 'character') {
            const characters = getContextCharacters();
            const match = characters.find((character, index) =>
                normalizeCharacterResourceId(character?.avatar ?? character?.name, String(index)) === resourceId
                || normalizeLegacyCharacterResourceId(character?.avatar ?? character?.name, String(index)) === resourceId
                || String(index) === resourceId
            );
            return match ? this.toDocument(resourceType, resourceId, this.normalizeCharacterRaw(match, characters.indexOf(match))) : null;
        }
        if (resourceType === 'worldbook') return this.getWorldbookDocument(resourceId);
        if (resourceType === 'preset') return this.getPresetDocument(resourceId);
        return null;
    }

    private normalizeCharacterRaw(character: any, index: number): Record<string, unknown> {
        const data = character?.data && typeof character.data === 'object' ? character.data : character;
        return cloneSTRawPayload({
            id: String(index),
            ...character,
            data
        });
    }

    private async getWorldbookDocument(resourceId: string): Promise<ResourceDocument | null> {
        const raw = await getWorldbookRaw(resourceId);
        return raw ? this.toDocument('worldbook', normalizeId(resourceId, resourceId), raw) : null;
    }

    private async getPresetDocument(resourceId: string): Promise<ResourceDocument | null> {
        const raw = await STClient.getPreset(resourceId).catch(() => null);
        return raw ? this.toDocument('preset', normalizeId(resourceId, resourceId), raw) : null;
    }

    private toDocument(resourceType: ResourceType, resourceId: string, raw: unknown): ResourceDocument {
        const path = buildSourceResourcePath(SOURCE_ID, resourceType, resourceId);
        const ref: ResourceRef = {
            sourceId: SOURCE_ID,
            resourceType,
            resourceId,
            revision: null,
            path,
            writable: false,
            origin: 'st',
            forkedFrom: null
        };
        return {
            ref,
            raw,
            summary: summarizeSTResource(resourceType, resourceId, raw),
            capabilities: ST_CAPABILITIES,
            diagnostics: resourceType === 'preset' && resourceId === 'in_use'
                ? [{ level: 'info', code: 'ST_ACTIVE_PRESET_ALIAS', message: 'This document represents the current active ST preset.' }]
                : undefined
        };
    }
}
