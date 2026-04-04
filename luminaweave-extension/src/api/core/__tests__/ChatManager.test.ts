import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChatManager } from '../ChatManager';
import { SyncUtils } from '../SyncUtils';
import { LuminaChatMessage } from '../ChatManager';

vi.mock('../../storage.js', () => ({
    lwStorage: {
        _getContextIds: vi.fn(() => ({ charId: 'c1', chatId: 'chat1' })),
        get: vi.fn((key, def) => def),
        set: vi.fn(),
        on: vi.fn(),
        emit: vi.fn()
    }
}));

vi.mock('../PersistenceService', () => ({
    PersistenceService: vi.fn(function () {
        return {
            loadFromIndependentChat: vi.fn().mockResolvedValue(true),
            saveToIndependentChat: vi.fn().mockResolvedValue(true),
            appendToIndependentChat: vi.fn().mockResolvedValue(true),
            alignTransactionState: vi.fn().mockResolvedValue(true)
        };
    })
}));

describe('ChatManager Data Priority Sync', () => {
    let manager: ChatManager;

    beforeEach(() => {
        vi.clearAllMocks();
        manager = new ChatManager();
        // 提供一个虚拟的 parentApi 供 getSyncDiff 调用
        manager.parentApi = {
            getSyncDiff: vi.fn()
        };
        // Spy on internal methods
        vi.spyOn(manager.sync, 'syncFromST').mockResolvedValue({ totalDiff: 0, details: {} });
        vi.spyOn(manager, 'commitToST').mockResolvedValue();
        vi.spyOn(manager, 'emit');
    });

    it('1.1 When plugin has no data, it should import from ST', async () => {
        manager.store.setNodes([]); // No local data
        vi.spyOn(manager.persistence, 'loadFromIndependentChat').mockResolvedValue(false);
        
        await manager.syncFromST();

        expect(manager.sync.syncFromST).toHaveBeenCalledWith({ forceOverwrite: true });
        expect(manager.commitToST).not.toHaveBeenCalled();
    });

    it('1.2 When plugin has data, it should push to ST if local is ahead of ST (no divergence)', async () => {
        manager.store.setNodes([{ id: '1', fingerprint: 'fp1' } as any]);
        
        vi.spyOn(manager.parentApi, 'getSyncDiff').mockReturnValue({
            hasDivergence: false,
            onlyInIndependent: [{ id: '2' }], // Local is ahead
            onlyInST: [],
            updated: [],
            diffCount: 1
        } as any);

        await manager.syncFromST();

        // 自动推送到 ST
        expect(manager.commitToST).toHaveBeenCalled();
        expect(manager.sync.syncFromST).not.toHaveBeenCalled();
    });

    it('1.2.1 When encountering unmergeable conflicts, it should notify user', async () => {
        manager.store.setNodes([{ id: '1', fingerprint: 'fp1' } as any]);
        
        const mockDiffData = {
            hasDivergence: true,
            hasConflict: true,
            onlyInIndependent: [{ id: '1' }],
            onlyInST: [{ id: '2' }],
            diffCount: 2
        };
        vi.spyOn(manager.parentApi, 'getSyncDiff').mockReturnValue(mockDiffData as any);

        await manager.syncFromST();

        expect(manager.emit).toHaveBeenCalledWith('CHAT_CONFLICT', mockDiffData);
        expect(manager.commitToST).not.toHaveBeenCalled();
        expect(manager.sync.syncFromST).not.toHaveBeenCalled();
    });

    it('should force ignore ST info and resolve to Lumina when ignoreST is enabled', async () => {
        manager.store.setNodes([{ id: '1', fingerprint: 'fp1' } as any]);

        const mockDiffData = {
            hasDivergence: true,
            hasConflict: true,
            onlyInIndependent: [{ id: '1' }],
            onlyInST: [{ id: '2' }],
            updated: [],
            diffCount: 2
        };
        vi.spyOn(manager.parentApi, 'getSyncDiff').mockReturnValue(mockDiffData as any);

        await manager.syncFromST(0, { ignoreST: true });

        expect(manager.commitToST).toHaveBeenCalled();
        expect(manager.emit).not.toHaveBeenCalledWith('CHAT_CONFLICT', mockDiffData);
        expect(manager.sync.syncFromST).not.toHaveBeenCalled();
    });

    it('1.2.2 should not auto force overwrite on divergence even if global setting enables it', async () => {
        manager.store.setNodes([{ id: '1', fingerprint: 'fp1' } as any]);
        const mockDiffData = {
            hasDivergence: true,
            hasConflict: true,
            onlyInIndependent: [{ id: '1' }],
            onlyInST: [{ id: '2' }],
            diffCount: 2
        };
        vi.spyOn(manager.parentApi, 'getSyncDiff').mockReturnValue(mockDiffData as any);
        const storageMock = await import('../../storage.js');
        (storageMock.lwStorage.get as any).mockImplementation((key: string, def: any) => {
            if (key === 'lumina-chat.storagePolicy') return 'independent';
            if (key === 'lumina-chat.forceOverwriteWhenConflict') return true;
            return def;
        });

        await manager.syncFromST();

        expect(manager.emit).toHaveBeenCalledWith('CHAT_CONFLICT', mockDiffData);
        expect(manager.sync.syncFromST).not.toHaveBeenCalled();
        expect(manager.commitToST).not.toHaveBeenCalled();
    });

    it('1.2 should compare active trace instead of full node pool', async () => {
        manager.store.setNodes([
            { id: 'root', parentId: null, fingerprint: 'fp_root', mesRaw: 'A' },
            { id: 'active', parentId: 'root', fingerprint: 'fp_active', mesRaw: 'B' },
            { id: 'branch', parentId: 'root', fingerprint: 'fp_branch', mesRaw: 'C' }
        ] as any);
        manager.store.activeLeafId = 'active';
        manager.parentApi = {
            getSyncDiff: vi.fn().mockImplementation(() => {
                const activeTrace = manager.store.getTrace(manager.store.activeLeafId);
                const localForCompare = activeTrace.length > 0 ? activeTrace : manager.store.nodePool;
                return {
                    localCompared: localForCompare,
                    hasDivergence: false,
                    onlyInIndependent: [],
                    onlyInST: [],
                    diffCount: 0
                }
            })
        };

        await manager.syncFromST();

        const localCompared = manager.parentApi.getSyncDiff().localCompared.map((m: any) => m.id);
        expect(localCompared).toEqual(['root', 'active']);
        expect(localCompared.includes('branch')).toBe(false);
    });

    it('should skip ST bootstrap import when independent storage restored local nodes', async () => {
        manager.store.setNodes([]);
        vi.spyOn(manager.persistence, 'loadFromIndependentChat').mockImplementation(async () => {
            manager.store.setNodes([{ id: 'node_local_1', parentId: null, fingerprint: 'fp_local_1', mesRaw: 'A' } as any]);
            manager.store.activeLeafId = 'node_local_1';
            return true;
        });
        vi.spyOn(manager.parentApi, 'getSyncDiff').mockReturnValue({
            hasDivergence: false,
            onlyInIndependent: [],
            onlyInST: [],
            diffCount: 0
        } as any);

        await manager.syncFromST();

        expect(manager.sync.syncFromST).not.toHaveBeenCalled();
        expect(manager.commitToST).not.toHaveBeenCalled();
        expect(manager.activeLeafId).toBe('node_local_1');
    });

    it('should allow explicit force overwrite even when local nodes exist', async () => {
        manager.store.setNodes([{ id: 'node_local_2', parentId: null, fingerprint: 'fp_local_2', mesRaw: 'A' } as any]);
        vi.spyOn(manager.persistence, 'loadFromIndependentChat').mockResolvedValue(true);

        await manager.syncFromST(0, { forceOverwrite: true });

        expect(manager.sync.syncFromST).toHaveBeenCalledWith({ forceOverwrite: true });
    });
});
