import { beforeEach, describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import { IDBKeyRange, indexedDB } from 'fake-indexeddb';
import { IndexedDbExtensionStore } from '@/api/core/hal/adapters/browser/IndexedDbExtensionStore.js';

Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;

const installLocalStorage = (): Map<string, string> => {
    const storage = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
        value: {
            getItem: (key: string) => storage.get(key) ?? null,
            setItem: (key: string, value: string) => {
                storage.set(key, String(value));
            },
            removeItem: (key: string) => {
                storage.delete(key);
            },
            clear: () => {
                storage.clear();
            },
            key: (index: number) => Array.from(storage.keys())[index] ?? null,
            get length() {
                return storage.size;
            }
        },
        configurable: true
    });
    return storage;
};

describe('IndexedDbExtensionStore', () => {
    beforeEach(() => {
        installLocalStorage();
    });

    it('stores JSON and exposes storage record metadata', async () => {
        const store = new IndexedDbExtensionStore({ databaseName: 'lw-test-json' });

        await store.setJson({
            namespace: 'lumina.test',
            table: 'main',
            key: 'settings',
            value: { enabled: true }
        });

        await expect(store.getJson({
            namespace: 'lumina.test',
            table: 'main',
            key: 'settings'
        })).resolves.toEqual({ enabled: true });
        await expect(store.listKeys({
            namespace: 'lumina.test',
            table: 'main'
        })).resolves.toEqual(['settings']);
        await expect(store.listRecords()).resolves.toEqual([
            expect.objectContaining({
                backend: 'indexeddb',
                namespace: 'lumina.test',
                table: 'main',
                key: 'settings',
                kind: 'json',
                bytes: expect.any(Number)
            })
        ]);
    });

    it('stores blobs without converting them through localStorage', async () => {
        const store = new IndexedDbExtensionStore({ databaseName: 'lw-test-blob' });
        const data = new Uint8Array([1, 2, 3, 4]);

        await store.setBlob({
            namespace: 'lumina.test',
            table: 'assets',
            key: 'image',
            data
        });
        const blob = await store.getBlob({
            namespace: 'lumina.test',
            table: 'assets',
            key: 'image'
        });

        expect(blob).toBeInstanceOf(Blob);
        expect(blob ? Array.from(new Uint8Array(await blob.arrayBuffer())) : []).toEqual([1, 2, 3, 4]);
    });

    it('migrates exact legacy localStorage extension store keys lazily', async () => {
        localStorage.setItem(
            'tt_ext_store_lumina_legacy_main_config',
            JSON.stringify({ migrated: true })
        );
        const store = new IndexedDbExtensionStore({ databaseName: 'lw-test-migrate' });

        await expect(store.getJson({
            namespace: 'lumina_legacy',
            table: 'main',
            key: 'config'
        })).resolves.toEqual({ migrated: true });
        await expect(store.listRecords()).resolves.toEqual([
            expect.objectContaining({
                namespace: 'lumina_legacy',
                table: 'main',
                key: 'config',
                kind: 'json'
            })
        ]);
        expect(localStorage.getItem('tt_ext_store_lumina_legacy_main_config')).toBeNull();
    });
});
