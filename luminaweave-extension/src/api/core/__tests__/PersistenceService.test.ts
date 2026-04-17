import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PersistenceService } from '../PersistenceService';
import { WorldlineStore } from '../WorldlineStore';
import { BridgeDispatcher } from '@shared/api/BridgeDispatcher.js';

vi.mock('../../storage.js', () => ({
    lwStorage: {
        _getContextIds: vi.fn(() => ({ chatId: 'chat_1', charId: 'char_1' })),
        get: vi.fn(() => 0),
        set: vi.fn(async () => undefined)
    }
}));

vi.mock('../../../core/PluginManager.js', () => ({
    pluginManager: {
        callHooks: vi.fn()
    }
}));

function injectMockBridge() {
    const bridge = {
        chat: {
            listChats: vi.fn(),
            getChat: vi.fn(),
            saveChat: vi.fn(),
            patchChat: vi.fn(),
            saveMessage: vi.fn(),
            deleteMessage: vi.fn(),
            getSyncStatus: vi.fn(),
            getTransactions: vi.fn(),
            rollbackTransaction: vi.fn()
        },
        nexus: {
            generateStream: vi.fn(),
            attachStream: vi.fn(),
            stop: vi.fn(),
            fetchModels: vi.fn(),
            getStatus: vi.fn()
        },
        forge: {
            listSessions: vi.fn(),
            getSession: vi.fn(),
            saveSession: vi.fn(),
            updateSession: vi.fn()
        },
        settings: {
            getSettings: vi.fn(),
            saveSettings: vi.fn()
        },
        presets: {
            listPresets: vi.fn(),
            importPreset: vi.fn(),
            exportPreset: vi.fn(),
            restoreDefaults: vi.fn()
        },
        extensionStore: {
            getJson: vi.fn(),
            setJson: vi.fn(),
            updateJson: vi.fn(),
            deleteJson: vi.fn(),
            listKeys: vi.fn(),
            setBlob: vi.fn(),
            getBlob: vi.fn()
        }
    };

    BridgeDispatcher.inject(bridge as any);
    return bridge;
}

describe('PersistenceService Transaction Protocol', () => {
    let store: WorldlineStore;
    let service: PersistenceService;
    let bridge: ReturnType<typeof injectMockBridge>;

    beforeEach(() => {
        vi.clearAllMocks();
        bridge = injectMockBridge();
        bridge.chat.getSyncStatus.mockResolvedValue({ success: true, isTransactionsCompleted: true });
        bridge.chat.getChat.mockResolvedValue([]);
        store = new WorldlineStore();
        service = new PersistenceService(store, () => true);
    });

    it('should send transaction context on full save and persist committed seq', async () => {
        store.setNodes([
            {
                id: 'n1',
                parentId: null,
                name: 'User',
                role: 'user',
                mesRaw: 'hello',
                mes: 'hello',
                fingerprint: 'fp1',
                extra: {}
            }
        ]);
        store.activeLeafId = 'n1';

        bridge.chat.saveChat.mockResolvedValue({ success: true, lastCommittedSeq: 3 });

        await service.syncToIndependentChat('chat_1', true);

        expect(bridge.chat.saveChat).toHaveBeenCalledTimes(1);
        const [, body] = bridge.chat.saveChat.mock.calls[0];
        expect(body.transactionContext.expectedSeq).toBe(0);
        expect(body.transactionContext.idempotencyKey).toContain('chat.save:chat_1:');
    });

    it('should reconcile conflict and retry patch with refreshed expected seq', async () => {
        store.setNodes([
            {
                id: 'n1',
                parentId: null,
                name: 'User',
                role: 'user',
                mesRaw: 'A-new',
                mes: 'A-new',
                fingerprint: 'fp_new',
                extra: {},
                syncStatus: 'local'
            }
        ]);
        store.activeLeafId = 'n1';

        bridge.chat.getChat.mockResolvedValue([
            { type: 'metadata', activeLeafId: 'n1', transaction: { lastCommittedSeq: 5 } },
            {
                id: 'n1',
                parentId: null,
                name: 'User',
                role: 'user',
                mesRaw: 'A-old',
                mes: 'A-old',
                fingerprint: 'fp_old',
                extra: {}
            }
        ]);
        bridge.chat.patchChat
            .mockResolvedValueOnce({
                success: false,
                lastCommittedSeq: 6,
                error: { code: 'TXN_SEQUENCE_CONFLICT', message: 'conflict', retryable: true }
            })
            .mockResolvedValueOnce({ success: true, lastCommittedSeq: 7 });
        bridge.chat.getTransactions.mockResolvedValue({
            success: true,
            transactions: [],
            transaction: {
                id: 'tx_committed',
                chatId: 'chat_1',
                seq: 6,
                status: 'committed',
                scope: 'chat.patch',
                payloadDigest: 'dg_x',
                idempotencyKey: 'noop',
                error: null,
                createdAt: 1,
                updatedAt: 1
            },
            lastCommittedSeq: 6
        });

        await service.syncToIndependentChat('chat_1', false);

        const patchCalls = bridge.chat.patchChat.mock.calls;
        expect(patchCalls.length).toBe(2);
        const firstPatchBody = patchCalls[0][1];
        const retryPatchBody = patchCalls[1][1];
        expect(firstPatchBody.transactionContext.expectedSeq).toBe(5);
        expect(retryPatchBody.transactionContext.expectedSeq).toBe(6);
        expect(firstPatchBody.transactionContext.idempotencyKey).toContain('chat.patch:chat_1:');
        expect(retryPatchBody.transactionContext.idempotencyKey).toBe(firstPatchBody.transactionContext.idempotencyKey);
        expect(bridge.chat.getTransactions).toHaveBeenCalledWith('chat_1', {
            afterSeq: '6',
            scope: 'chat.patch'
        });
    });

    it('should rollback pending transaction during reconciliation and then retry', async () => {
        store.setNodes([
            {
                id: 'n1',
                parentId: null,
                name: 'User',
                role: 'user',
                mesRaw: 'B-new',
                mes: 'B-new',
                fingerprint: 'fp_new2',
                extra: {},
                syncStatus: 'local'
            }
        ]);
        store.activeLeafId = 'n1';

        let firstIdempotencyKey = '';
        bridge.chat.getChat.mockResolvedValue([
            { type: 'metadata', activeLeafId: 'n1', transaction: { lastCommittedSeq: 5 } },
            { id: 'n1', parentId: null, name: 'User', role: 'user', mesRaw: 'B-old', mes: 'B-old', fingerprint: 'fp_old2', extra: {} }
        ]);
        bridge.chat.patchChat.mockImplementation(async (_chatId: string, body: any) => {
            if (!firstIdempotencyKey) {
                firstIdempotencyKey = body.transactionContext.idempotencyKey;
                return {
                    success: false,
                    lastCommittedSeq: 6,
                    error: { code: 'TXN_SEQUENCE_CONFLICT', message: 'conflict', retryable: true }
                };
            }
            return { success: true, lastCommittedSeq: 7 };
        });
        bridge.chat.getTransactions.mockImplementation(async () => ({
            success: true,
            transactions: [{
                id: 'tx_running_1',
                chatId: 'chat_1',
                seq: 7,
                status: 'running',
                scope: 'chat.patch',
                payloadDigest: 'dg_x',
                idempotencyKey: firstIdempotencyKey,
                error: null,
                createdAt: 1,
                updatedAt: 1
            }],
            transaction: {
                id: 'tx_running_1',
                chatId: 'chat_1',
                seq: 7,
                status: 'running',
                scope: 'chat.patch',
                payloadDigest: 'dg_x',
                idempotencyKey: firstIdempotencyKey,
                error: null,
                createdAt: 1,
                updatedAt: 1
            },
            lastCommittedSeq: 6
        }));
        bridge.chat.rollbackTransaction.mockResolvedValue({ success: true, lastCommittedSeq: 7 });

        await service.syncToIndependentChat('chat_1', false);

        expect(bridge.chat.getTransactions).toHaveBeenCalledWith('chat_1', {
            afterSeq: '6',
            scope: 'chat.patch'
        });
        expect(bridge.chat.rollbackTransaction).toHaveBeenCalledWith('chat_1', 'tx_running_1');
        const retryPatchBody = bridge.chat.patchChat.mock.calls[1][1];
        expect(retryPatchBody.transactionContext.expectedSeq).toBe(7);
    });

    it('should skip network sync if all nodes are already synced and metadata is unchanged', async () => {
        store.setNodes([
            { id: 'n1', parentId: null, mesRaw: 'hello', syncStatus: 'synced', fingerprint: 'fp1' } as any
        ]);
        store.activeLeafId = 'n1';

        bridge.chat.getChat.mockResolvedValue([
            { type: 'metadata', activeLeafId: 'n1', transaction: { lastCommittedSeq: 5 } },
            { id: 'n1', parentId: null, mesRaw: 'hello', fingerprint: 'fp1' }
        ]);

        await service.syncToIndependentChat('chat_1', false);

        expect(bridge.chat.saveChat).not.toHaveBeenCalled();
        expect(bridge.chat.patchChat).not.toHaveBeenCalled();
    });

    it('should mark local nodes as synced after successful patch', async () => {
         store.upsertNode({ id: 'n_new', parentId: null, mesRaw: 'new', fingerprint: 'fp_new' } as any);
         expect(store.getNode('n_new')?.syncStatus).toBe('local');

         bridge.chat.getChat.mockResolvedValue([
            { type: 'metadata', activeLeafId: 'n_existing', transaction: { lastCommittedSeq: 9 } },
            { id: 'n_existing', parentId: null, mesRaw: 'old', fingerprint: 'fp_old', extra: {} }
         ]);
         bridge.chat.patchChat.mockResolvedValue({ success: true, lastCommittedSeq: 10 });

        await service.syncToIndependentChat('chat_1', false);
        expect(bridge.chat.patchChat).toHaveBeenCalled();
        expect(store.getNode('n_new')?.syncStatus).toBe('synced');
    });
});
