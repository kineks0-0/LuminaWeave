import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NexusClient } from '../NexusClient.js';
import { BridgeDispatcher } from '@shared/api/BridgeDispatcher.js';

function createMockStreamingHandle() {
    let tokenListener: ((token: string) => void) | undefined;
    let doneListener: ((data: any) => void) | undefined;

    const handle = {
        isBusy: () => true,
        abort: vi.fn(),
        onToken(callback: (token: string) => void) {
            tokenListener = callback;
            return handle;
        },
        onCommitted(_callback: (data: any) => void) {
            return handle;
        },
        onDone(callback: (data: any) => void) {
            doneListener = callback;
            return handle;
        },
        onError(_callback: (error: any) => void) {
            return handle;
        },
        emitToken(token: string) {
            tokenListener?.(token);
        },
        emitDone(data: any) {
            doneListener?.(data);
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

describe('Reproduction: Whitespace Token Loss', () => {
    let client: NexusClient;
    let bridge: ReturnType<typeof injectMockBridge>;

    beforeEach(() => {
        vi.clearAllMocks();
        bridge = injectMockBridge();
        client = new NexusClient();
    });

    it('Should NOT lose whitespace tokens (spaces and newlines)', async () => {
        const handle = createMockStreamingHandle();
        bridge.nexus.generateStream.mockReturnValue(handle);
        const onChunk = vi.fn();
        const run = client.generateStream({
            chatId: 'test_ws',
            charName: 'Test',
            parentId: null,
            messages: [],
            nodes: []
        }, { onChunk });

        handle.emitToken('Hello');
        handle.emitToken(' ');
        handle.emitToken('World');
        handle.emitToken('\n');
        handle.emitToken('Next');
        handle.emitDone({ status: 'success' });

        await run;

        expect(onChunk).toHaveBeenCalledTimes(5);
        expect(onChunk).toHaveBeenNthCalledWith(1, 'Hello', 'Hello');
        expect(onChunk).toHaveBeenNthCalledWith(2, ' ', 'Hello ');
        expect(onChunk).toHaveBeenNthCalledWith(3, 'World', 'Hello World');
        expect(onChunk).toHaveBeenNthCalledWith(4, '\n', 'Hello World\n');
        expect(onChunk).toHaveBeenNthCalledWith(5, 'Next', 'Hello World\nNext');
    });

    it('Should fallback to raw text if JSON parsing fails but event is token-like', async () => {
        const handle = createMockStreamingHandle();
        bridge.nexus.generateStream.mockReturnValue(handle);
        const onChunk = vi.fn();
        const run = client.generateStream({
            chatId: 'test_raw',
            charName: 'Test',
            parentId: null,
            messages: [],
            nodes: []
        }, { onChunk });

        handle.emitToken('RawToken');
        handle.emitDone({ status: 'success' });

        await run;

        expect(onChunk).toHaveBeenCalledWith('RawToken', 'RawToken');
    });
});
