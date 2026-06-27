import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RuntimeExtensionStorePort, RuntimeStorageRecordInfo } from '@shared/api/HALRuntimePorts.js';
import { initMockHAL } from '../support/halMock.js';
import { shellWorkspaceService } from '@/api/core/hal/shell/ShellWorkspaceService.js';
import { RuntimeStorageAdminService } from '@/api/core/storage/RuntimeStorageAdminService.js';

const createRuntimeStore = (): RuntimeExtensionStorePort => {
    const records: RuntimeStorageRecordInfo[] = [
        {
            namespace: 'lumina.forge',
            table: 'pi-sessions',
            key: 'forge_ws_1',
            kind: 'json',
            backend: 'indexeddb',
            bytes: 512,
            updatedAt: 100
        },
        {
            namespace: 'lumina.resource-runtime',
            table: 'shell-workspaces',
            key: 'forge-project-bindings.v1',
            kind: 'json',
            backend: 'indexeddb',
            bytes: 128,
            updatedAt: 200
        },
        {
            namespace: 'custom.runtime',
            table: 'cache',
            key: 'x',
            kind: 'json',
            backend: 'indexeddb',
            bytes: 64,
            updatedAt: 300
        }
    ];

    return {
        getJson: vi.fn(async () => null),
        setJson: vi.fn(async () => undefined),
        updateJson: vi.fn(async () => undefined),
        deleteJson: vi.fn(async () => undefined),
        listKeys: vi.fn(async () => []),
        setBlob: vi.fn(async () => undefined),
        getBlob: vi.fn(async () => null),
        listRecords: vi.fn(async () => records)
    };
};

describe('RuntimeStorageAdminService', () => {
    beforeEach(() => {
        shellWorkspaceService.resetForTests({ clearStorage: true });
        initMockHAL({
            runtime: {
                extensionStore: createRuntimeStore()
            }
        });
    });

    it('groups runtime records and separates Forge VFS files from Git history', async () => {
        const fs = await shellWorkspaceService.getFileSystem({ projectId: 'forge_project_alpha' });
        await fs.mkdir('/forge/forge_project_alpha/.git', { recursive: true });
        await fs.writeFile('/forge/forge_project_alpha/card.md', '# Card');
        await fs.writeFile('/forge/forge_project_alpha/.git/HEAD', 'ref: refs/heads/main');

        const service = new RuntimeStorageAdminService();
        const usage = await service.listUsage();

        expect(usage.find(item => item.id === 'forge-agent-sessions')).toEqual(expect.objectContaining({
            bytes: 512,
            recordCount: 1,
            backend: 'indexeddb'
        }));
        expect(usage.find(item => item.id === 'resource-runtime')).toEqual(expect.objectContaining({
            bytes: 128,
            recordCount: 1
        }));
        expect(usage.find(item => item.id === 'other-runtime')).toEqual(expect.objectContaining({
            bytes: 64,
            recordCount: 1
        }));
        expect(usage.find(item => item.id === 'forge-vfs')).toEqual(expect.objectContaining({
            recordCount: 1
        }));
        expect(usage.find(item => item.id === 'forge-git')).toEqual(expect.objectContaining({
            recordCount: 1
        }));
    });
});
