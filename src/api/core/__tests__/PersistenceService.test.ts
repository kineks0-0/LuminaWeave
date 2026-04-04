import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PersistenceService } from '../PersistenceService';
import { WorldlineStore } from '../WorldlineStore';

vi.mock('../../storage.js', () => ({
    lwStorage: {
        _getContextIds: vi.fn(() => ({ chatId: 'chat_1', charId: 'char_1' })),
        get: vi.fn(() => 0),
        set: vi.fn(async () => undefined)
    }
}));

vi.mock('../st-adapter/STClient', () => ({
    STClient: {
        getCsrfToken: vi.fn(async () => 'csrf-token')
    }
}));

vi.mock('../../../core/PluginManager.js', () => ({
    pluginManager: {
        callHooks: vi.fn()
    }
}));

describe('PersistenceService Transaction Protocol', () => {
    let store: WorldlineStore;
    let service: PersistenceService;
    const mockResponse = <T>(status: number, body: T) => ({
        ok: status >= 200 && status < 300,
        status,
        json: async () => body
    });

    beforeEach(() => {
        vi.clearAllMocks();
        store = new WorldlineStore();
        service = new PersistenceService(store, () => true);
        (globalThis as Record<string, unknown>).fetch = vi.fn().mockImplementation(async (url: string) => {
            if (url.includes('/sync-status')) {
                return mockResponse(200, { success: true, isTransactionsCompleted: true });
            }
            return mockResponse(500, { error: 'Not Mocked' });
        });
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

        const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
        fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            if (url.includes('/sync-status')) return mockResponse(200, { success: true, isTransactionsCompleted: true });
            if (url.endsWith('/chat/chat_1') && (!init || init.method === 'GET' || !init.method)) return mockResponse(200, []);
            if (url.includes('/save/chat_1')) return mockResponse(200, { success: true, lastCommittedSeq: 3 });
            return mockResponse(500, {});
        });

        await service.syncToIndependentChat('chat_1', true);

        expect(fetchMock).toHaveBeenCalled();
        const saveCall = fetchMock.mock.calls.find(call => (call[0] as string).includes('/save/chat_1'));
        const body = JSON.parse((saveCall![1] as Record<string, string>).body);
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
                extra: {}
            }
        ]);
        store.activeLeafId = 'n1';

        const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
        let patchCount = 0;
        fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            if (url.includes('/sync-status')) return mockResponse(200, { success: true, isTransactionsCompleted: true });
            if (url.includes('/transactions?')) return mockResponse(200, {
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
            if (url.includes('/api/plugins/luminaweave/chat/chat_1') && !url.includes('/transactions') && (!init || init.method === 'GET' || !init.method)) {
                return mockResponse(200, [
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
            }
            if (url.includes('/chat_1') && init?.method === 'PATCH') {
                patchCount++;
                if (patchCount === 1) {
                    return mockResponse(409, {
                        success: false,
                        lastCommittedSeq: 6,
                        error: { code: 'TXN_SEQUENCE_CONFLICT', message: 'conflict', retryable: true }
                    });
                }
                return mockResponse(200, { success: true, lastCommittedSeq: 7 });
            }
            return mockResponse(500, {});
        });

        await service.syncToIndependentChat('chat_1', false);

        const patchCalls = fetchMock.mock.calls.filter(c => c[1]?.method === 'PATCH');
        expect(patchCalls.length).toBe(2);
        const firstPatchBody = JSON.parse((patchCalls[0][1] as Record<string, string>).body);
        const retryPatchBody = JSON.parse((patchCalls[1][1] as Record<string, string>).body);
        expect(firstPatchBody.transactionContext.expectedSeq).toBe(5);
        expect(retryPatchBody.transactionContext.expectedSeq).toBe(6);
        expect(firstPatchBody.transactionContext.idempotencyKey).toContain('chat.patch:chat_1:');
        expect(retryPatchBody.transactionContext.idempotencyKey).toBe(firstPatchBody.transactionContext.idempotencyKey);
        const txCall = fetchMock.mock.calls.find(c => (c[0] as string).includes('/transactions?'));
        expect(txCall![0]).toContain('afterSeq=6');
        expect(txCall![0]).toContain('scope=chat.patch');
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
                extra: {}
            }
        ]);
        store.activeLeafId = 'n1';

        const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
        let firstIdempotencyKey = '';
        fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            if (url.includes('/sync-status')) return mockResponse(200, { success: true, isTransactionsCompleted: true });
            if (url.includes('/api/plugins/luminaweave/chat/chat_1') && !url.includes('/transactions') && !init?.method) {
                return mockResponse(200, [
                    { type: 'metadata', activeLeafId: 'n1', transaction: { lastCommittedSeq: 5 } },
                    { id: 'n1', parentId: null, name: 'User', role: 'user', mesRaw: 'B-old', mes: 'B-old', fingerprint: 'fp_old2', extra: {} }
                ]);
            }
            if (url.endsWith('/api/plugins/luminaweave/chat/chat_1') && init?.method === 'PATCH' && !url.includes('/transactions')) {
                const body = JSON.parse(init.body as string);
                if (!firstIdempotencyKey) {
                    firstIdempotencyKey = body.transactionContext.idempotencyKey;
                    return mockResponse(409, {
                        success: false,
                        lastCommittedSeq: 6,
                        error: { code: 'TXN_SEQUENCE_CONFLICT', message: 'conflict', retryable: true }
                    });
                }
                return mockResponse(200, { success: true, lastCommittedSeq: 7 });
            }
            if (url.includes('/transactions?')) {
                return mockResponse(200, {
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
                });
            }
            if (url.includes('/transactions/tx_running_1/rollback')) {
                return mockResponse(200, { success: true, lastCommittedSeq: 7 });
            }
            return mockResponse(500, { success: false });
        });

        await service.syncToIndependentChat('chat_1', false);

        expect(fetchMock).toHaveBeenCalledTimes(6);
        expect(fetchMock.mock.calls[3][0]).toContain('/transactions?');
        expect(fetchMock.mock.calls[3][0]).toContain('afterSeq=6');
        expect(fetchMock.mock.calls[4][0]).toContain('/transactions/tx_running_1/rollback');
        const retryPatchBody = JSON.parse((fetchMock.mock.calls[5][1] as Record<string, string>).body);
        expect(retryPatchBody.transactionContext.expectedSeq).toBe(7);
    });
});
