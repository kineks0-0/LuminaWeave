import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NexusClient, StreamCallbacks } from '../NexusClient.js';
import { BridgeDispatcher } from '@shared/api/BridgeDispatcher.js';

function createMockStreamingHandle() {
    let busy = true;
    let tokenListener: ((token: string) => void) | undefined;
    let committedListener: ((data: any) => void) | undefined;
    let doneListener: ((data: any) => void) | undefined;
    let errorListener: ((error: any) => void) | undefined;

    const handle = {
        isBusy: () => busy,
        abort: vi.fn(() => {
            busy = false;
        }),
        onToken(callback: (token: string) => void) {
            tokenListener = callback;
            return handle;
        },
        onCommitted(callback: (data: any) => void) {
            committedListener = callback;
            return handle;
        },
        onDone(callback: (data: any) => void) {
            doneListener = callback;
            return handle;
        },
        onError(callback: (error: any) => void) {
            errorListener = callback;
            return handle;
        },
        emitToken(token: string) {
            tokenListener?.(token);
        },
        emitCommitted(data: any) {
            committedListener?.(data);
        },
        emitDone(data: any) {
            busy = false;
            doneListener?.(data);
        },
        emitError(error: any) {
            busy = false;
            errorListener?.(error);
        }
    };

    return handle;
}

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

describe('NexusClient stream routing', () => {
    let client: NexusClient;
    let bridge: ReturnType<typeof injectMockBridge>;

    beforeEach(() => {
        vi.clearAllMocks();
        bridge = injectMockBridge();
        client = new NexusClient();
    });

    it('Case 1: 多段 Token 累加测试 - 应正确维护 localFullText', async () => {
        const handle = createMockStreamingHandle();
        bridge.nexus.generateStream.mockReturnValue(handle);
        const onChunk = vi.fn();
        const onDelta = vi.fn();
        const callbacks: StreamCallbacks = { onChunk, onDelta };

        const run = client.generateStream({
            chatId: 'test_chat',
            charName: 'TestBot',
            parentId: null,
            messages: [],
            nodes: []
        }, callbacks);

        handle.emitToken('H');
        handle.emitToken('e');
        handle.emitToken('l');
        handle.emitDone({ status: 'success' });

        await run;

        expect(onChunk).toHaveBeenCalledTimes(3);
        expect(onChunk).toHaveBeenNthCalledWith(1, 'H', 'H');
        expect(onChunk).toHaveBeenNthCalledWith(2, 'e', 'He');
        expect(onChunk).toHaveBeenNthCalledWith(3, 'l', 'Hel');
        
        expect(onDelta).toHaveBeenCalledTimes(3);
        expect(onDelta).toHaveBeenCalledWith('l');
    });

    it('Case 2: 事务提交 (committed) 路由测试', async () => {
        const handle = createMockStreamingHandle();
        bridge.nexus.generateStream.mockReturnValue(handle);
        const onBackendCommitted = vi.fn();
        const callbacks: StreamCallbacks = { onBackendCommitted };

        const run = client.generateStream({
            chatId: 'test_chat',
            charName: 'TestBot',
            parentId: null,
            messages: [],
            nodes: []
        }, callbacks);

        handle.emitCommitted({
            lastTransactionId: 'tx_sse_123',
            activeLeafId: 'leaf_456'
        });
        handle.emitDone({ status: 'success' });

        await run;

        expect(onBackendCommitted).toHaveBeenCalledWith({
            lastTransactionId: 'tx_sse_123',
            activeLeafId: 'leaf_456'
        });
    });

    it('Case 3: 生成结束 (done) 路由与全量兜底测试', async () => {
        const handle = createMockStreamingHandle();
        bridge.nexus.generateStream.mockReturnValue(handle);
        const onDone = vi.fn();
        const callbacks: StreamCallbacks = { onDone };

        const run = client.generateStream({
            chatId: 'test_chat',
            charName: 'TestBot',
            parentId: null,
            messages: [],
            nodes: []
        }, callbacks);

        handle.emitToken('Part1');
        handle.emitDone({});

        await run;

        expect(onDone).toHaveBeenCalledWith(expect.objectContaining({
            fullText: 'Part1',
            status: 'success'
        }));
    });

    it('Case 4: 异常边界测试 - onerror 应触发回调并中断', async () => {
        const handle = createMockStreamingHandle();
        bridge.nexus.generateStream.mockReturnValue(handle);
        const onError = vi.fn();
        const callbacks: StreamCallbacks = { onError };
        const testError = new Error('SSE Connection Failed');

        const run = client.generateStream({
            chatId: 'test_chat',
            charName: 'TestBot',
            parentId: null,
            messages: [],
            nodes: []
        }, callbacks);

        handle.emitError(testError);

        await run;

        expect(onError).toHaveBeenCalledWith(testError);
    });

    it('Case 5: 中断信号透传测试', async () => {
        const handle = createMockStreamingHandle();
        bridge.nexus.generateStream.mockReturnValue(handle);
        const controller = new AbortController();

        const run = client.generateStream({
            chatId: 'test_chat',
            charName: 'TestBot',
            parentId: null,
            messages: [],
            nodes: []
        }, {}, controller.signal);

        controller.abort();
        handle.emitDone({ status: 'aborted' });

        await run;

        expect(handle.abort).toHaveBeenCalled();
    });
});
