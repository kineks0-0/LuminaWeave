import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    configureLorebookHostPort,
    type LorebookHostPort,
    type LorebookHostWorldbookRef
} from '@/api/core/lorebook/LorebookHostPort.js';
import { LorebookManager } from '@/api/core/lorebook/LorebookManager.js';
import { PromptWorldInfoMount } from '@/api/core/lorebook/PromptWorldInfoMount.js';

const createPort = (refs: LorebookHostWorldbookRef[], overrides: Partial<LorebookHostPort> = {}): LorebookHostPort => ({
    getWorldbookRefs: () => refs,
    refreshWorldbookRefs: vi.fn(async () => {}),
    getWorldbook: async () => ({ entries: {} }),
    createWorldbook: async () => true,
    importRawWorldbook: async () => true,
    getGlobalWorldbookNames: () => [],
    getSelectedWorldbookName: () => null,
    rebindGlobalWorldbooks: async () => {},
    ...overrides
});

afterEach(() => {
    configureLorebookHostPort(createPort([]));
});

describe('LorebookManager host port resolution', () => {
    it('picks up a port registered after construction', async () => {
        const manager = new LorebookManager({});
        expect(manager.books).toEqual([]);

        configureLorebookHostPort(createPort([{ id: 'book-a', name: 'Book A', sourceId: 'st' }]));
        await manager.syncFromST();

        expect(manager.books).toEqual([{ id: 'book-a', name: 'Book A', sourceId: 'st' }]);
    });

    it('awaits the async ref refresh before reading the book list', async () => {
        const refresh = vi.fn(async () => {});
        configureLorebookHostPort(createPort([{ id: 'book-b', name: 'Book B' }], { refreshWorldbookRefs: refresh }));
        const manager = new LorebookManager({});

        await manager.syncFromST();
        expect(refresh).toHaveBeenCalled();
        expect(manager.books[0].id).toBe('book-b');
    });

    it('reports capability flags from the active port', () => {
        configureLorebookHostPort(createPort([], { deleteWorldbook: async () => true }));
        const manager = new LorebookManager({});
        expect(manager.canDeleteBooks()).toBe(true);
        expect(manager.supportsSystemPromptMount()).toBe(false);
    });
});

describe('PromptWorldInfoMount host gate', () => {
    it('skips system worldbook sync when the host does not support it', async () => {
        vi.useFakeTimers();
        try {
            const ensureBookExists = vi.fn(async () => true);
            const manager = {
                supportsSystemPromptMount: () => false,
                ensureBookExists,
                getLorebookRaw: vi.fn(async () => ({ entries: {} })),
                saveLorebook: vi.fn(async () => true),
                activateAsGlobal: vi.fn(async () => true),
                syncLuminaRegexToHost: vi.fn(async () => {})
            };
            const mount = new PromptWorldInfoMount(manager as unknown as LorebookManager);

            mount.syncToWorldInfo();
            await vi.advanceTimersByTimeAsync(600);

            expect(ensureBookExists).not.toHaveBeenCalled();
            expect(manager.saveLorebook).not.toHaveBeenCalled();
        } finally {
            vi.useRealTimers();
        }
    });
});
