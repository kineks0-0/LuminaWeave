import { beforeEach, describe, expect, it, vi } from 'vitest';
import Dexie from 'dexie';
import { IDBKeyRange, indexedDB } from 'fake-indexeddb';
import { initMockHAL } from '@/api/core/__tests__/support/halMock.js';
import { ShellWorkspaceService } from '@/api/core/hal/shell/ShellWorkspaceService.js';
import { IndexedDbExtensionStore } from '@/api/core/hal/adapters/browser/IndexedDbExtensionStore.js';

Object.defineProperty(globalThis, 'indexedDB', {
    value: indexedDB,
    configurable: true
});

Object.defineProperty(globalThis, 'IDBKeyRange', {
    value: IDBKeyRange,
    configurable: true
});

Dexie.dependencies.indexedDB = indexedDB;
Dexie.dependencies.IDBKeyRange = IDBKeyRange;

describe('ShellWorkspaceService', () => {
    beforeEach(() => {
        Object.defineProperty(globalThis, 'localStorage', {
            value: {
                getItem: vi.fn(() => null),
                setItem: vi.fn(),
                removeItem: vi.fn(),
                key: vi.fn(() => null),
                get length() {
                    return 0;
                }
            },
            configurable: true
        });
    });

    it('persists current VFS files with lightning-fs and does not write legacy JSON snapshots', async () => {
        const extensionStore = new IndexedDbExtensionStore({ databaseName: 'lw-shell-vfs-store' });
        initMockHAL({ runtime: { extensionStore } });
        const first = new ShellWorkspaceService({ filesystemName: 'lw-shell-vfs-files' });

        const fs = await first.getFileSystem({
            projectId: 'project-alpha',
            conversationId: 'thread-alpha'
        });
        await fs.mkdir('/forge/project-alpha/docs', { recursive: true });
        await fs.writeFile('/forge/project-alpha/docs/readme.md', 'current tree only');
        await first.persist();

        const second = new ShellWorkspaceService({ filesystemName: 'lw-shell-vfs-files' });
        const restored = await second.getFileSystem({
            projectId: 'project-alpha',
            conversationId: 'thread-alpha'
        });

        await expect(restored.readFile('/forge/project-alpha/docs/readme.md')).resolves.toBe('current tree only');
        await expect(extensionStore.getJson({
            namespace: 'lumina.resource-runtime',
            table: 'shell-workspaces',
            key: 'workspace-fs.snapshot.v1'
        })).resolves.toBeNull();
        await expect(extensionStore.listKeys({
            namespace: 'lumina.resource-runtime',
            table: 'shell-workspaces'
        })).resolves.toEqual([]);
    });
});
