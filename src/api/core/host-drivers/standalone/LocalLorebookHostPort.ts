import { lwStorage } from '../../../storage.js';
import { buildSourceResourcePath, type ResourceDocument, type ResourceListQuery, type ResourceRef, type ResourceSaveResult } from '@shared/resources/index.js';
import { LocalResourceSource } from './LocalResourceSource.js';

const SOURCE_ID = 'local';
const GLOBAL_BOOKS_STORAGE_KEY = 'lumina-lorebook.globalWorldbooks';

export interface LocalLorebookResourceSource {
    listResources(query?: ResourceListQuery): Promise<ResourceDocument[]>;
    getResource(ref: ResourceRef): Promise<ResourceDocument | null>;
    saveResource(ref: ResourceRef, payload: unknown): Promise<ResourceSaveResult>;
    deleteResource(ref: ResourceRef): Promise<boolean>;
}

const normalizeName = (name: string): string => String(name || '').trim().replace(/\.json$/i, '');

/**
 * 独立模式的本地世界书宿主端口：把 LorebookHostPort 映射到 lumina_resources_local 存储，
 * 让世界书插件在无 ST 宿主时也能列出、新建、导入、保存和删除本地世界书。
 */
export class LocalLorebookHostPort {
    public readonly supportsSystemPromptMount = false;
    private refs: { name: string; id: string; sourceId: string }[] = [];

    constructor(private readonly source: LocalLorebookResourceSource = new LocalResourceSource()) {}

    async refreshWorldbookRefs(): Promise<void> {
        const documents = await this.source.listResources({ resourceType: 'worldbook' });
        this.refs = documents.map((document) => ({
            id: document.ref.resourceId,
            name: document.summary.name || document.ref.resourceId,
            sourceId: SOURCE_ID
        }));
    }

    getWorldbookRefs(): { name: string; id: string; sourceId: string }[] {
        return [...this.refs];
    }

    async getWorldbook(name: string): Promise<Record<string, unknown>> {
        const document = await this.source.getResource(this.buildRef(normalizeName(name)));
        return (document?.raw as Record<string, unknown> | undefined) ?? { entries: {} };
    }

    async createWorldbook(name: string, entries?: unknown[]): Promise<boolean> {
        const id = normalizeName(name);
        if (!id) return false;
        const result = await this.source.saveResource(this.buildRef(id), {
            name: id,
            entries: this.normalizeEntries(entries)
        });
        await this.refreshWorldbookRefs();
        return result.status === 'saved';
    }

    async importRawWorldbook(filename: string, data: string): Promise<boolean> {
        const id = normalizeName(filename);
        if (!id) return false;
        let parsed: unknown;
        try {
            parsed = JSON.parse(data);
        } catch {
            return false;
        }
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;

        const record = parsed as Record<string, unknown>;
        const raw = {
            ...record,
            name: typeof record.name === 'string' && record.name.trim() ? record.name.trim() : id
        };
        const result = await this.source.saveResource(this.buildRef(id), raw);
        await this.refreshWorldbookRefs();
        return result.status === 'saved';
    }

    async deleteWorldbook(name: string): Promise<boolean> {
        const deleted = await this.source.deleteResource(this.buildRef(normalizeName(name)));
        if (deleted) await this.refreshWorldbookRefs();
        return deleted;
    }

    getGlobalWorldbookNames(): string[] {
        const stored = lwStorage.get(GLOBAL_BOOKS_STORAGE_KEY, [], 'Global');
        return Array.isArray(stored) ? stored.filter((item): item is string => typeof item === 'string') : [];
    }

    getSelectedWorldbookName(): string | null {
        return null;
    }

    async rebindGlobalWorldbooks(newList: string[]): Promise<void> {
        void lwStorage.set(GLOBAL_BOOKS_STORAGE_KEY, [...newList], 'Global');
    }

    private normalizeEntries(entries?: unknown[]): Record<string, unknown> {
        if (!entries || entries.length === 0) return {};
        return Object.fromEntries(entries.map((entry, index) => {
            const record = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
            return [String(record.uid ?? index), entry];
        }));
    }

    private buildRef(resourceId: string): ResourceRef {
        return {
            sourceId: SOURCE_ID,
            resourceType: 'worldbook',
            resourceId,
            path: buildSourceResourcePath(SOURCE_ID, 'worldbook', resourceId),
            writable: true
        };
    }
}
