import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LuminaWeaveAPI } from '../index.js';
import { globalXMLInterceptor } from '../core/XMLInterceptor.js';
import { globalMemoryManager } from '../core/MemoryManager.js';
import { pluginManager } from '../../core/PluginManager.js';

// Mock dependecies
vi.mock('../storage.js', () => ({
    lwStorage: {
        get: vi.fn(),
        on: vi.fn(),
        _getContextIds: vi.fn(() => ({ charId: '1', chatId: '1' })),
    }
}));

vi.mock('../core/SyncUtils.js', () => ({
    SyncUtils: {
        compareStates: vi.fn(),
        getFingerprint: vi.fn(),
        generateNodeId: vi.fn(() => 'test-node-id'),
    }
}));

vi.mock('../llmEngine.js', () => ({
    LuminaWeaveLLMEngine: vi.fn().mockImplementation(() => ({
        nexus: {
            fetchModels: vi.fn(async () => []),
            generateStream: vi.fn(async () => {}),
        }
    }))
}));

// Mock window and SillyTavern
(global as any).window = {
    SillyTavern: {
        getContext: vi.fn(() => ({
            eventSource: { on: vi.fn() },
            event_types: {},
        })),
    },
    TavernHelper: {
        formatAsTavernRegexedString: vi.fn((text) => text),
    }
};

describe('LuminaWeaveAPI Streaming Cache', () => {
    let api: LuminaWeaveAPI;

    beforeEach(() => {
        vi.clearAllMocks();
        api = new LuminaWeaveAPI();
    });

    it('should initialize lastStreamState as null', () => {
        expect(api.lastStreamState).toBeNull();
    });

    it('should update lastStreamState when BUFFER_UPDATED is emitted from sub-components', () => {
        const testText = 'Hello';
        const testRaw = '<Chat_Reply>Hello</Chat_Reply>';
        const filteredCount = testRaw.length - testText.length;
        
        api.streamHandler.emit('BUFFER_UPDATED', testText, testRaw, filteredCount, '回复中...', 'abc', '');

        expect(api.lastStreamState).not.toBeNull();
        expect(api.lastStreamState?.text).toBe(testRaw);
        expect(api.lastStreamState?.processed).toBe(testText);
        expect(api.lastStreamState?.filteredCount).toBe(filteredCount);
        expect(api.lastStreamState?.statusText).toBe('回复中...');
        expect(api.lastStreamState?.thinkingText).toBe('abc');
    });

    it('should keep forwarded filteredCount without recomputing from raw text', () => {
        const emittedPayloads: Array<{ processed: string; raw: string; filteredCount: number; statusText?: string; thinkingText?: string }> = [];

        api.on('BUFFER_UPDATED', (processed: string, raw: string, nextFilteredCount: number, statusText?: string, thinkingText?: string) => {
            emittedPayloads.push({ processed, raw, filteredCount: nextFilteredCount, statusText, thinkingText });
        });

        api.streamHandler.emit('BUFFER_UPDATED', '你好', '<think>abc</think><Chat_Reply>你好', 18, '回复中...', 'abc', '');

        expect(emittedPayloads).toEqual([{
            processed: '你好',
            raw: '<think>abc</think><Chat_Reply>你好',
            filteredCount: 18,
            statusText: '回复中...',
            thinkingText: 'abc'
        }]);
    });

    it('should execute XML handlers and commit deltas when finalizing generated output', async () => {
        const activeNode = { id: 'node-1', extra: {} } as any;
        api.chatManager.activeLeafId = 'node-1';

        vi.spyOn(api.chatManager.store, 'getNode').mockReturnValue(activeNode);
        vi.spyOn(globalXMLInterceptor, 'processAndCleanText').mockReturnValue('Cleaned reply');
        vi.spyOn(globalMemoryManager, 'commitDeltas').mockImplementation(() => {});
        vi.spyOn(pluginManager, 'callHooks').mockImplementation(() => {});
        vi.spyOn(api, 'commitToST').mockResolvedValue();

        const result = await (api as any).finalizeGeneratedOutput('<Chat_Reply>Hello</Chat_Reply><Next_Plan>Plan</Next_Plan>');

        expect(globalXMLInterceptor.processAndCleanText).toHaveBeenCalledWith('<Chat_Reply>Hello</Chat_Reply><Next_Plan>Plan</Next_Plan>', true);
        expect(globalMemoryManager.commitDeltas).toHaveBeenCalledWith(activeNode);
        expect(api.commitToST).toHaveBeenCalledTimes(1);
        expect(pluginManager.callHooks).toHaveBeenCalledWith('onGenerationEnded', 'Cleaned reply');
        expect(result).toBe('Cleaned reply');
    });
});
