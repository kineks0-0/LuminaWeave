import { describe, expect, it } from 'vitest';
import type { ResourceDocument, ResourceRef } from '@shared/resources/index.js';
import {
    LocalLorebookHostPort,
    type LocalLorebookResourceSource
} from '@/api/core/host-drivers/standalone/LocalLorebookHostPort.js';

const toDocument = (resourceId: string, raw: Record<string, unknown>): ResourceDocument => ({
    ref: {
        sourceId: 'local',
        resourceType: 'worldbook',
        resourceId,
        path: `lumina://local/worldbook/${resourceId}`,
        writable: true
    },
    raw,
    summary: {
        id: resourceId,
        type: 'worldbook',
        name: typeof raw.name === 'string' ? raw.name : resourceId,
        enabled: true,
        format: 'st-worldbook-object'
    },
    capabilities: {
        readable: true,
        writable: true,
        forkable: true,
        importable: true,
        exportable: true,
        searchable: true
    }
});

const createFakeSource = (): LocalLorebookResourceSource => {
    const store = new Map<string, Record<string, unknown>>();
    return {
        async listResources(query) {
            return [...store.entries()]
                .filter(() => !query?.resourceType || query.resourceType === 'worldbook')
                .map(([id, raw]) => toDocument(id, raw));
        },
        async getResource(ref: ResourceRef) {
            const raw = store.get(ref.resourceId);
            return raw ? toDocument(ref.resourceId, raw) : null;
        },
        async saveResource(ref: ResourceRef, payload: unknown) {
            const raw = payload as Record<string, unknown>;
            store.set(ref.resourceId, raw);
            return { status: 'saved' as const, document: toDocument(ref.resourceId, raw) };
        },
        async deleteResource(ref: ResourceRef) {
            return store.delete(ref.resourceId);
        }
    };
};

describe('LocalLorebookHostPort', () => {
    it('lists created books with local source ids for chat bindings', async () => {
        const port = new LocalLorebookHostPort(createFakeSource());
        expect(await port.createWorldbook('测试书')).toBe(true);
        await port.refreshWorldbookRefs();
        expect(port.getWorldbookRefs()).toEqual([
            { id: '测试书', name: '测试书', sourceId: 'local' }
        ]);
    });

    it('imports ST world info JSON and keeps the entries payload', async () => {
        const port = new LocalLorebookHostPort(createFakeSource());
        const raw = JSON.stringify({ entries: { '0': { uid: 0, key: ['castle'], content: 'Castle lore' } } });
        expect(await port.importRawWorldbook('城堡.json', raw)).toBe(true);

        const book = await port.getWorldbook('城堡');
        expect(book.name).toBe('城堡');
        expect((book.entries as Record<string, unknown>)['0']).toMatchObject({ content: 'Castle lore' });
    });

    it('rejects invalid JSON and array payloads', async () => {
        const port = new LocalLorebookHostPort(createFakeSource());
        expect(await port.importRawWorldbook('bad.json', 'not-json')).toBe(false);
        expect(await port.importRawWorldbook('list.json', '[1,2]')).toBe(false);
    });

    it('returns an empty book shape for missing books and deletes created ones', async () => {
        const port = new LocalLorebookHostPort(createFakeSource());
        await port.createWorldbook('待删除');
        await port.refreshWorldbookRefs();
        expect(port.getWorldbookRefs()).toHaveLength(1);

        expect(await port.deleteWorldbook('待删除')).toBe(true);
        expect(port.getWorldbookRefs()).toHaveLength(0);
        expect(await port.getWorldbook('待删除')).toEqual({ entries: {} });
        expect(port.supportsSystemPromptMount).toBe(false);
    });
});
