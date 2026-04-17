import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NexusClient } from '../NexusClient.js';
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

describe('NexusClient', () => {
    let client: NexusClient;
    let bridge: ReturnType<typeof injectMockBridge>;

    beforeEach(() => {
        vi.clearAllMocks();
        bridge = injectMockBridge();
        client = new NexusClient();
    });

    it('fetchModels should delegate to BridgeDispatcher.nexus.fetchModels', async () => {
        bridge.nexus.fetchModels.mockResolvedValue(['gpt-4', 'gpt-3.5-turbo']);

        const models = await client.fetchModels('provider-1');
        expect(bridge.nexus.fetchModels).toHaveBeenCalledWith('provider-1');
        expect(models).toEqual(['gpt-4', 'gpt-3.5-turbo']);
    });

    it('generateStream should accumulate tokens and forward done payload', async () => {
        const handle = createMockStreamingHandle();
        bridge.nexus.generateStream.mockReturnValue(handle);

        const onChunk = vi.fn();
        const onDone = vi.fn();

        const run = client.generateStream({
            chatId: 'c2',
            charName: 'Alice',
            parentId: 'p1',
            messages: [],
            nodes: []
        }, { onChunk, onDone });

        handle.emitToken('Hello');
        handle.emitToken(' World');
        handle.emitDone({ status: 'success', lastTransactionId: 'tx1' });

        await run;

        expect(bridge.nexus.generateStream).toHaveBeenCalledWith({
            chatId: 'c2',
            charName: 'Alice',
            parentId: 'p1',
            messages: [],
            nodes: []
        });
        expect(onChunk).toHaveBeenCalledWith('Hello', 'Hello');
        expect(onChunk).toHaveBeenCalledWith(' World', 'Hello World');
        expect(onDone).toHaveBeenCalledWith(expect.objectContaining({
            status: 'success',
            fullText: 'Hello World',
            lastTransactionId: 'tx1'
        }));
    });

    it('attachStream should pass through params and stream callbacks', async () => {
        const handle = createMockStreamingHandle();
        bridge.nexus.attachStream.mockReturnValue(handle);

        const onChunk = vi.fn();
        const onDone = vi.fn();

        const run = client.attachStream({
            chatId: 'c3',
            generationId: 'gen_123',
            from: 10
        }, { onChunk, onDone });

        handle.emitToken('abc');
        handle.emitDone({ status: 'success', generationId: 'gen_123' });

        await run;

        expect(bridge.nexus.attachStream).toHaveBeenCalledWith({
            chatId: 'c3',
            generationId: 'gen_123',
            from: 10
        });
        expect(onChunk).toHaveBeenCalledWith('abc', 'abc');
        expect(onDone).toHaveBeenCalledWith(expect.objectContaining({
            status: 'success',
            fullText: 'abc',
            generationId: 'gen_123'
        }));
    });
});
