import { describe, it, expect, vi, beforeEach } from 'vitest';
import { STSyncService } from '../STSyncService';
import { WorldlineStore } from '../WorldlineStore';
import type { LuminaChatMessage } from '../ChatManager';
import { STAdapter } from '../STAdapter';
import { STProtocol } from '../st-adapter/STProtocol';
import { STClient } from '../st-adapter/STClient';
import { SyncUtils } from '../SyncUtils';

// Mock STAdapter
vi.mock('../STAdapter', () => ({
    STAdapter: {
        getSnapshot: vi.fn(),
        compareStates: vi.fn(),
        applyDelta: vi.fn(),
    }
}));

// Mock STClient
vi.mock('../st-adapter/STClient', () => ({
    STClient: {
        getRawMessages: vi.fn(),
        getMessages: vi.fn(),
        updateMessages: vi.fn(),
        appendMessages: vi.fn(),
        deleteMessages: vi.fn(),
        flush: vi.fn()
    }
}));

// Mock lwStorage
vi.mock('../../storage', () => ({
    lwStorage: {
        _getContextIds: vi.fn(() => ({ charId: 'c1' })),
        get: vi.fn((key, def) => def),
        set: vi.fn()
    }
}));

describe('STSyncService', () => {
    let store: WorldlineStore;
    let service: STSyncService;
    const createNode = (overrides: Partial<LuminaChatMessage> & Pick<LuminaChatMessage, 'id' | 'parentId' | 'mesRaw' | 'fingerprint'>): LuminaChatMessage => ({
        name: 'Tester',
        role: 'user',
        mes: overrides.mes ?? overrides.mesRaw,
        send_date: 0,
        extra: {},
        is_user: true,
        ...overrides
    } as LuminaChatMessage);

    const createSTNode = (message: string, extra: any = {}, overrides: any = {}) => {
        return STProtocol.fromST({
            message_id: 0,
            name: 'Tester',
            role: 'user',
            is_hidden: false,
            message: message,
            data: {},
            extra: {
                stFingerprint: extra.stFingerprint || extra.fingerprint || 'sfp1',
                ...extra
            },
            ...overrides
        });
    };

    beforeEach(() => {
        store = new WorldlineStore();
        service = new STSyncService(store);
        vi.clearAllMocks();
        
        (STAdapter.compareStates as any).mockReturnValue({
            diffCount: 0,
            hasConflict: false,
            hasDivergence: false,
            divergenceIndex: -1,
            onlyInIndependent: [],
            onlyInST: [],
            updated: [],
            independentSequence: [],
            stSequence: []
        });
    });

    it('should sync new messages from ST (safe append)', async () => {
        const messages = [
            createSTNode('A', { id: '1', fingerprint: 'fp1' })
        ];
        (STAdapter.getSnapshot as any).mockReturnValue(Promise.resolve({
            raw: [],
            lumina: messages,
            idToIndex: new Map()
        }));

        const result = await service.syncFromST();
        
        expect(store.nodePool).toHaveLength(1);
        expect(store.activeLeafId).toBe('1');
        expect(result.totalDiff).toBe(0); // No divergence
    });

    it('should perform force branch alignment correctly', async () => {
        // Local has branch 1 -> 2
        store.setNodes([
            { id: '1', parentId: null, mesRaw: 'A', fingerprint: 'fp1' } as any,
            { id: '2', parentId: '1', mesRaw: 'B', fingerprint: 'fp2' } as any
        ]);
        store.activeLeafId = '2';

        // ST has 1 -> 3 (diverged or edited)
        const messages = [
            createSTNode('A', { id: '1', fingerprint: 'fp1' }),
            createSTNode('C', { id: '3', fingerprint: 'fp3' })
        ];
        (STAdapter.getSnapshot as any).mockReturnValue(Promise.resolve({
            raw: [],
            lumina: messages,
            idToIndex: new Map()
        }));

        // Force Sync
        await service.syncFromST({ forceOverwrite: true });

        expect(store.hasNode('1')).toBe(true);
        expect(store.hasNode('2')).toBe(true); // Still exists! (Smart branch sync)
        expect(store.hasNode('3')).toBe(true);
        expect(store.activeLeafId).toBe('3');
        
        const trace = store.getTrace('3');
        expect(trace.map(n => n.id)).toEqual(['1', '3']);
    });

    it('should commit local changes to ST correctly', async () => {
        // Local has branch 1 -> 2
        store.setNodes([
            { id: '1', parentId: null, mesRaw: 'A', fingerprint: 'fp1', mes: 'A', role: 'user', extra: {} } as any,
            { id: '2', parentId: '1', mesRaw: 'B', fingerprint: 'fp2', mes: 'B', role: 'char', extra: {} } as any
        ]);
        store.activeLeafId = '2';

        // ST has only 1
        const messages = [
            createSTNode('A', { id: '1', fingerprint: 'fp1' })
        ];
        (STAdapter.getSnapshot as any).mockReturnValue(Promise.resolve({
            raw: [],
            lumina: messages,
            idToIndex: new Map()
        }));

        (STAdapter.compareStates as any).mockReturnValue({
            diffCount: 1,
            hasConflict: false,
            hasDivergence: true,
            divergenceIndex: 1,
            onlyInIndependent: [],
            onlyInST: [],
            updated: [],
            independentSequence: store.getTrace('2'),
            stSequence: [messages[0]]
        });

        (STAdapter.applyDelta as any).mockImplementation(async () => {
            await STClient.appendMessages([{ extra: { id: '2' } } as any]);
        });

        await service.commitToST();

        // Should call appendMessages
        expect(STClient.appendMessages).toHaveBeenCalled();
        const appendArgs = (STClient.appendMessages as any).mock.calls[0][0];
        expect(appendArgs[0].extra.id).toBe('2');
    });

    it('should keep active selection when ST has no new node', async () => {
        store.setNodes([
            { id: '1', parentId: null, mesRaw: 'A', fingerprint: 'fp1' } as any,
            { id: '2', parentId: '1', mesRaw: 'B', fingerprint: 'fp2' } as any,
            { id: '3', parentId: '2', mesRaw: 'C', fingerprint: 'fp3' } as any
        ]);
        store.activeLeafId = '2';

        const messages = [
            createSTNode('A', { id: '1', fingerprint: 'fp1' }),
            createSTNode('B', { id: '2', fingerprint: 'fp2' }),
            createSTNode('C', { id: '3', fingerprint: 'fp3' })
        ];
        (STAdapter.getSnapshot as any).mockReturnValue(Promise.resolve({
            raw: [],
            lumina: messages,
            idToIndex: new Map()
        }));

        await service.syncFromST();

        expect(store.activeLeafId).toBe('2');
    });

    it('should follow latest tail when ST appends new node', async () => {
        store.setNodes([
            { id: '1', parentId: null, mesRaw: 'A', fingerprint: 'fp1' } as any,
            { id: '2', parentId: '1', mesRaw: 'B', fingerprint: 'fp2' } as any
        ]);
        store.activeLeafId = '2';

        const messages = [
            createSTNode('A', { id: '1', fingerprint: 'fp1' }),
            createSTNode('B', { id: '2', fingerprint: 'fp2' }),
            createSTNode('C', { id: '3', fingerprint: 'fp3' })
        ];
        (STAdapter.getSnapshot as any).mockReturnValue(Promise.resolve({
            raw: [],
            lumina: messages,
            idToIndex: new Map()
        }));

        await service.syncFromST();

        expect(store.activeLeafId).toBe('3');
    });

    it('should not create duplicated nodes and should keep activeLeafId stable after commit then sync', async () => {
        store.setNodes([
            { id: '1', parentId: null, mesRaw: 'A', fingerprint: 'fp1', mes: 'A', role: 'user', extra: {} } as any,
            { id: '2', parentId: '1', mesRaw: 'B', fingerprint: 'fp2', mes: 'B', role: 'char', extra: {} } as any
        ]);
        store.activeLeafId = '2';

        const stAfterCommit = [
            createSTNode('A', { id: '1', fingerprint: 'fp1' }),
            createSTNode('B', { id: '2', fingerprint: 'fp2' })
        ];
        (STAdapter.getSnapshot as any).mockReturnValue(Promise.resolve({
            raw: [],
            lumina: stAfterCommit,
            idToIndex: new Map()
        }));

        await service.commitToST();

        const activeLeafAfterCommit = store.activeLeafId;
        const beforeNodeIds = new Set(store.nodePool.map(n => n.id));
        const beforeNodeCount = store.nodePool.length;

        await service.syncFromST();

        const afterNodeIds = store.nodePool.map(n => n.id);
        const uniqueAfterNodeIds = new Set(afterNodeIds);

        expect(store.activeLeafId).toBe(activeLeafAfterCommit);
        expect(uniqueAfterNodeIds.size).toBe(beforeNodeIds.size);
        expect(store.nodePool.length).toBe(beforeNodeCount);
        expect(afterNodeIds).toEqual(['1', '2']);
    });

    it('should keep node_rb unique and set activeLeafId to node_rb after syncing node_sfx -> st_msg_1 -> node_rb chain', async () => {
        store.setNodes([
            createNode({ id: 'node_sfx', parentId: null, mesRaw: 'SFX', fingerprint: 'fp_sfx', role: 'user' }),
            createNode({ id: 'node_rb', parentId: 'node_sfx', mesRaw: 'RB', fingerprint: 'fp_rb', role: 'assistant' })
        ]);
        store.activeLeafId = 'node_rb';

        const messages = [
            createSTNode('SFX', { id: 'node_sfx', fingerprint: 'fp_sfx' }),
            createSTNode('MID', { fingerprint: 'fp_mid' }, { message_id: 1 }),
            createSTNode('RB', { id: 'node_rb', fingerprint: 'fp_rb' })
        ];
        (STAdapter.getSnapshot as any).mockReturnValue(Promise.resolve({
            raw: [],
            lumina: messages,
            idToIndex: new Map()
        }));

        const result = await service.syncFromST();
        const idsAfterSync = store.nodePool.map(n => n.id);
        const nodeRbCount = idsAfterSync.filter(id => id === 'node_rb').length;
        const uniqueIds = new Set(idsAfterSync);

        expect(result.totalDiff).toBeGreaterThanOrEqual(0);
        expect(nodeRbCount).toBe(1);
        expect(uniqueIds.size).toBe(idsAfterSync.length);
        expect(idsAfterSync).toEqual(expect.arrayContaining(['node_sfx', 'st_msg_1', 'node_rb']));
        expect(store.activeLeafId).toBe('node_rb');
        expect(store.getTrace('node_rb').map(n => n.id)).toEqual(['node_sfx', 'st_msg_1', 'node_rb']);
    });

    it('should suppress loopback re-import for lumina-marked ST messages', async () => {
        store.setNodes([
            createNode({ id: 'node_origin', parentId: null, mesRaw: 'A', fingerprint: 'fp1', role: 'assistant' })
        ]);
        store.activeLeafId = 'node_origin';

        const messages = [
            createSTNode('A', { id: 'node_origin', fingerprint: 'fp1' }),
            createSTNode('A', {
                fingerprint: 'fp1',
                '_lw_sync_source': 'lumina',
                '_lw_sync_ts': Date.now()
            }, { message_id: 9 })
        ];
        (STAdapter.getSnapshot as any).mockReturnValue(Promise.resolve({
            raw: [],
            lumina: messages,
            idToIndex: new Map()
        }));

        await service.syncFromST();

        expect(store.nodePool.map(n => n.id)).toEqual(['node_origin']);
        expect(store.activeLeafId).toBe('node_origin');
    });

    it('should dedupe st_msg id when fingerprint already exists in local node', async () => {
        store.setNodes([
            createNode({ id: 'node_local', parentId: null, mesRaw: 'SAME', fingerprint: 'fp_same', role: 'assistant' })
        ]);
        store.activeLeafId = 'node_local';

        const messages = [
            createSTNode('SAME', { id: 'node_local', fingerprint: 'fp_same' }),
            createSTNode('SAME', { fingerprint: 'fp_same' }, { message_id: 22 })
        ];
        (STAdapter.getSnapshot as any).mockReturnValue(Promise.resolve({
            raw: [],
            lumina: messages,
            idToIndex: new Map()
        }));

        await service.syncFromST();

        expect(store.nodePool.map(n => n.id)).toEqual(['node_local']);
        expect(store.activeLeafId).toBe('node_local');
    });

    it('should perform post-sync deduplication pass for identical fingerprints under same parent', async () => {
        // Setup: Two branches with identical content under the same parent
        store.setNodes([
            createNode({ id: 'root', parentId: null, mesRaw: 'root', fingerprint: 'fp_root', role: 'user' }),
            createNode({ id: 'branch1', parentId: 'root', mesRaw: 'duplicate_content', fingerprint: 'fp_dup', role: 'assistant' }),
            createNode({ id: 'branch2', parentId: 'root', mesRaw: 'duplicate_content', fingerprint: 'fp_dup', role: 'assistant' }),
            createNode({ id: 'child_of_2', parentId: 'branch2', mesRaw: 'child', fingerprint: 'fp_child', role: 'user' })
        ]);
        store.activeLeafId = 'child_of_2';

        const messages = [
            createSTNode('root', { id: 'root', fingerprint: 'fp_root' }),
            createSTNode('duplicate_content', { id: 'branch1', fingerprint: 'fp_dup' }),
            createSTNode('child', { id: 'child_of_2', fingerprint: 'fp_child' }),
        ];
        (STAdapter.getSnapshot as any).mockReturnValue(Promise.resolve({
            raw: [],
            lumina: messages,
            idToIndex: new Map()
        }));

        // This sync should trigger the deduplication pass
        await service.syncFromST();

        // Need to re-fetch the nodeIds since the original array reference in nodePool might have been modified
        const nodeIds = store.nodePool.map(n => n.id);
        
        // Either branch1 or branch2 should be removed, leaving only 3 nodes
        expect(nodeIds.length).toBe(3);
        expect(nodeIds).toContain('root');
        expect(nodeIds).toContain('child_of_2');
        
        // Ensure child_of_2 was properly reparented to the surviving branch
        const survivingBranch = store.nodePool.find(n => n.fingerprint === 'fp_dup');
        expect(survivingBranch).toBeDefined();
        const childNode = store.getNode('child_of_2');
        expect(childNode?.parentId).toBe(survivingBranch?.id);
    });

    it('should not merge nodes with identical fingerprints if they have different parents (cross-branch)', async () => {
        store.setNodes([
            createNode({ id: 'root', parentId: null, mesRaw: 'root', fingerprint: 'fp_root' }),
            createNode({ id: 'branchA', parentId: 'root', mesRaw: 'A', fingerprint: 'fpA' }),
            createNode({ id: 'branchB', parentId: 'root', mesRaw: 'B', fingerprint: 'fpB' }),
            createNode({ id: 'dupA', parentId: 'branchA', mesRaw: 'same', fingerprint: 'fp_same' }),
            createNode({ id: 'dupB', parentId: 'branchB', mesRaw: 'same', fingerprint: 'fp_same' })
        ]);
        store.activeLeafId = 'dupA';

        const messages = [
            createSTNode('root', { id: 'root', fingerprint: 'fp_root' }),
            createSTNode('A', { id: 'branchA', fingerprint: 'fpA' }),
            createSTNode('same', { id: 'dupA', fingerprint: 'fp_same' }),
        ];
        (STAdapter.getSnapshot as any).mockReturnValue(Promise.resolve({
            raw: [],
            lumina: messages,
            idToIndex: new Map()
        }));

        await service.syncFromST();

        // Both dupA and dupB should survive because they have different parents
        expect(store.hasNode('dupA')).toBe(true);
        expect(store.hasNode('dupB')).toBe(true);
        expect(store.nodePool.length).toBe(5);
    });
});
