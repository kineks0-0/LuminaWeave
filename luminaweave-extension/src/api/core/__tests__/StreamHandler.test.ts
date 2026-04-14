import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StreamHandler } from '../StreamHandler';
import { lwStorage } from '../../storage.js';

vi.mock('../../storage.js', () => ({
    lwStorage: {
        get: vi.fn((_: string, defaultValue: unknown) => defaultValue),
        _getContextIds: vi.fn(() => ({ chatId: 'chat_1', charId: 'char_1' }))
    }
}));

vi.mock('../st-adapter/STClient', () => ({
    STClient: {
        getCsrfToken: vi.fn(async () => 'csrf-token')
    }
}));

vi.mock('../NexusClient.js', () => {
    const MockNexusClient = function(this: any) {
        this.attachStream = vi.fn(async (config: any, callbacks: any) => {
            // 模拟一段数据传输
            if (callbacks?.onDelta) {
                callbacks.onDelta('def');
            }
            // 核心逻辑：模拟后端提交，这会触发 TRANSACTION_COMMITTED 事件
            if (callbacks?.onBackendCommitted) {
                await callbacks.onBackendCommitted({ 
                    lastTransactionId: 'tx_1', 
                    activeLeafId: 'leaf_1' 
                });
            }
            // 核心逻辑：模拟完成信号，使 resumeToTerminal 这里的 Promise 能够完成
            if (callbacks?.onDone) {
                await callbacks.onDone({ 
                    status: 'success',
                    lastTransactionId: 'tx_1',
                    activeLeafId: 'leaf_1'
                });
            }
        });
    };
    return { NexusClient: MockNexusClient };
});

describe('StreamHandler reconnect buffer sync', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
        vi.mocked(lwStorage.get).mockImplementation((_: string, defaultValue: unknown) => defaultValue);
    });

    it('should resync buffer even when server buffer is shorter than local progress', async () => {
        const handler = new StreamHandler();
        handler.isGenerating = true;
        handler.responseBuffer = 'abcdef';

        let lastRaw = '';
        handler.on('BUFFER_UPDATED', (_processed: string, rawText?: string) => {
            lastRaw = rawText || '';
        });

        vi.stubGlobal('fetch', vi.fn(async () => ({
            ok: true,
            json: async () => ({
                isGenerating: true,
                buffer: 'abc',
                status: 'running',
                errorMessage: null
            })
        })));

        await handler.syncWithServer('chat_1');

        expect(handler.responseBuffer).toBe('abc');
        expect(lastRaw).toBe('abc');
        vi.unstubAllGlobals();
    });
    it('should emit TRANSACTION_COMMITTED and trigger sync when transaction IDs mismatch', async () => {
        vi.useFakeTimers();
        const handler = new StreamHandler();
        const mockSyncFromST = vi.fn();
        const mockGetIntegratedTxId = vi.fn(() => 'tx_old');
        
        // 模拟全局 LuminaWeave 环境，确保 window 属性被正确代理
        const mockLuminaWeave = {
            syncFromST: mockSyncFromST,
            chatManager: {
                persistence: {
                    getIntegratedTxId: mockGetIntegratedTxId
                }
            }
        };
        vi.stubGlobal('LuminaWeave', mockLuminaWeave);
        (window as any).LuminaWeave = mockLuminaWeave;

        let committedInfo: any = null;
        handler.on('TRANSACTION_COMMITTED', (info: any) => {
            committedInfo = info;
        });

        vi.stubGlobal('fetch', vi.fn(async () => ({
            ok: true,
            json: async () => ({
                isGenerating: false,
                buffer: 'abc',
                lastTransactionId: 'tx_new',
                status: 'success'
            })
        })));

        await handler.syncWithServer('chat_1');

        expect(committedInfo).toEqual({
            lastTransactionId: 'tx_new',
            activeLeafId: undefined,
            generationId: undefined
        });
        
        // 验证是否触发了同步
        await vi.runAllTimersAsync();
        expect(mockSyncFromST).toHaveBeenCalled();

        vi.unstubAllGlobals();
        delete (window as any).LuminaWeave;
        vi.useRealTimers();
    });

    it('should resume streaming to terminal state via attach SSE', async () => {
        const handler = new StreamHandler();
        handler.responseBuffer = '';
        handler.isGenerating = false;

        const responses = [
            {
                ok: true,
                json: async () => ({
                    isGenerating: true,
                    buffer: '',
                    rawBuffer: 'abc',
                    generationId: 'gen_1',
                    status: 'running',
                    errorMessage: null
                })
            },
            {
                ok: true,
                json: async () => ({
                    isGenerating: false,
                    buffer: '',
                    rawBuffer: 'abcdef',
                    generationId: 'gen_1',
                    status: 'success',
                    errorMessage: null,
                    lastTransactionId: 'tx_1'
                })
            }
        ];

        vi.stubGlobal('fetch', vi.fn(async () => {
            const next = responses.shift();
            if (!next) throw new Error('no more mock responses');
            return next;
        }));

        await handler.resumeToTerminal('chat_1');

        expect(handler.responseBuffer).toBe('abcdef');
        expect(handler.isGenerating).toBe(false);

        vi.unstubAllGlobals();
    });

    it('should keep raw XML buffer and only emit Chat_Reply content when filter is enabled', () => {
        vi.mocked(lwStorage.get).mockImplementation((key: string, defaultValue: unknown) => {
            if (key === 'lumina-chat.filterChatReply') return true;
            return defaultValue;
        });

        const handler = new StreamHandler();
        let processed = '';
        let raw = '';
        let filteredCount = 0;
        let status = '';
        let thinkingText = '';

        handler.on('BUFFER_UPDATED', (text: string, rawText?: string, nextFilteredCount?: number, statusText?: string, nextThinkingText?: string) => {
            processed = text;
            raw = rawText || '';
            filteredCount = nextFilteredCount || 0;
            status = statusText || '';
            thinkingText = nextThinkingText || '';
        });

        handler.handleRestart();
        handler.handleChunk('<think>abc', '<think>abc');
        expect(processed).toBe('');
        expect(raw).toBe('<think>abc');
        expect(filteredCount).toBe('<think>abc'.length);
        expect(status).toBe('思考中...');
        expect(thinkingText).toBe('abc');

        handler.handleChunk('</think>', '<think>abc</think>');
        expect(processed).toBe('');
        expect(raw).toBe('<think>abc</think>');
        expect(filteredCount).toBe('<think>abc</think>'.length);
        expect(status).toBe('');
        expect(thinkingText).toBe('abc');

        const fullRaw = '<think>abc</think><Chat_Reply>Hello\\nWorld</Chat_Reply>';
        handler.handleChunk('<Chat_Reply>Hello\\nWorld</Chat_Reply>', fullRaw);

        expect(processed).toBe('Hello\\nWorld');
        expect(raw).toBe(fullRaw);
        expect(filteredCount).toBe(fullRaw.length - 'Hello\\nWorld'.length);
        expect(status).toBe('回复中...');
        expect(thinkingText).toBe('abc');
    });

    it('should keep status stable across prelude tags before Chat_Reply', () => {
        vi.mocked(lwStorage.get).mockImplementation((key: string, defaultValue: unknown) => {
            if (key === 'lumina-chat.filterChatReply') return true;
            return defaultValue;
        });

        const handler = new StreamHandler();
        const snapshots: Array<{ text: string; filteredCount: number; status: string }> = [];

        handler.on('BUFFER_UPDATED', (text: string, _rawText?: string, filteredCount?: number, statusText?: string) => {
            snapshots.push({
                text,
                filteredCount: filteredCount || 0,
                status: statusText || ''
            });
        });

        handler.handleRestart();

        const thinkRaw = '<think>abc';
        handler.handleChunk(thinkRaw, thinkRaw);

        const actionRaw = `${thinkRaw}<Character_Action>挥剑`;
        handler.handleChunk('<Character_Action>挥剑', actionRaw);

        const closedActionRaw = `${actionRaw}</Character_Action>`;
        handler.handleChunk('</Character_Action>', closedActionRaw);

        const closedThinkingRaw = `${closedActionRaw}</think>`;
        handler.handleChunk('</think>', closedThinkingRaw);

        const replyRaw = `${closedThinkingRaw}<Chat_Reply>你好`;
        handler.handleChunk('<Chat_Reply>你好', replyRaw);

        expect(snapshots[0]).toEqual({
            text: '',
            filteredCount: thinkRaw.length,
            status: '思考中...'
        });
        expect(snapshots[1]).toEqual({
            text: '',
            filteredCount: actionRaw.length,
            status: '行动中...'
        });
        expect(snapshots[2]).toEqual({
            text: '',
            filteredCount: closedActionRaw.length,
            status: '思考中...'
        });
        expect(snapshots[3]).toEqual({
            text: '',
            filteredCount: closedThinkingRaw.length,
            status: ''
        });
        expect(snapshots[4]).toEqual({
            text: '你好',
            filteredCount: replyRaw.length - '你好'.length,
            status: '回复中...'
        });
    });

    it('should update smoothed status when raw phase changes', () => {
        vi.useFakeTimers();
        vi.mocked(lwStorage.get).mockImplementation((key: string, defaultValue: unknown) => {
            if (key === 'lumina-chat.filterChatReply') return true;
            if (key === 'lumina-chat.streamingSmoothness') return true;
            if (key === 'lumina-chat.streamingSmoothnessFactor') return 2;
            if (key === 'lumina-chat.streamingMaxSpeed') return 1;
            return defaultValue;
        });

        const handler = new StreamHandler();
        const statuses: string[] = [];

        handler.on('BUFFER_UPDATED', (_text: string, _rawText?: string, _filteredCount?: number, statusText?: string) => {
            statuses.push(statusText || '');
        });

        handler.handleRestart();
        handler.handleChunk('<think>abc', '<think>abc');
        handler.handleChunk('</think><Chat_Reply>Hello', '<think>abc</think><Chat_Reply>Hello');

        vi.advanceTimersByTime(20);

        expect(statuses[statuses.length - 1]).toBe('回复中...');
        // 核心修复验证：即便由于过滤导致正文为空，由于状态（元数据）变了，也应该立即发出通知
        expect(statuses).toContain('思考中...');
        handler.clearSmoothTimer();
        vi.useRealTimers();
    });

    it('should transition from Thinking to Replying for top-level text', () => {
        vi.useFakeTimers();
        vi.mocked(lwStorage.get).mockImplementation((key: string, defaultValue: unknown) => {
            if (key === 'lumina-chat.filterChatReply') return true;
            if (key === 'lumina-chat.allowTopLevelInFilter') return true;
            if (key === 'lumina-chat.streamingSmoothness') return true;
            return defaultValue;
        });

        const handler = new StreamHandler();
        const results: Array<{ text: string; status: string }> = [];

        handler.on('BUFFER_UPDATED', (text: string, _raw?: string, _count?: number, status?: string) => {
            results.push({ text, status: status || '' });
        });

        handler.handleRestart();
        // 1. 发送思考内容
        handler.handleChunk('<think>abc', '<think>abc');
        expect(results[results.length - 1].status).toBe('思考中...');

        // 2. 发送顶层回复。由于有平滑队列，此时 text 应为空或旧值，但 status 必须立即更新
        handler.handleChunk('</think> Hello', '<think>abc</think> Hello');
        expect(results[results.length - 1].status).toBe('回复中...');
        expect(results[results.length - 1].text).toBe(""); // 证明 text 还没吐出来，但在 metadataChanged 驱动下 status 已经变了

        handler.clearSmoothTimer();
        vi.useRealTimers();
    });

    it('Watchdog mechanism properly triggers resumeToTerminal after 20s of silence', async () => {
        vi.useFakeTimers();
        const handler = new StreamHandler();
        vi.spyOn(handler, 'resumeToTerminal').mockResolvedValue(undefined);
        
        handler.handleRestart({ silent: false });
        expect(handler.isGenerating).toBe(true);

        // Fast-forward 26s (Interval fires every 5s, timeout is >20s)
        vi.advanceTimersByTime(26000);

        expect(handler.resumeToTerminal).toHaveBeenCalled();
        vi.useRealTimers();
    });

    it('resumeToTerminal falls back to pollUntilTerminal if backend lacks generationId', async () => {
        const handler = new StreamHandler();
        vi.stubGlobal('fetch', vi.fn(async () => ({
            ok: true,
            json: async () => ({
                isGenerating: true,
                generationId: null, 
                rawBuffer: 'Poll prefix'
            })
        })));

        // @ts-ignore - access private for test
        const pollSpy = vi.spyOn(handler, 'pollUntilTerminal').mockResolvedValue(undefined);

        await handler.resumeToTerminal('chat_fallback_1');

        expect(pollSpy).toHaveBeenCalled();
        vi.unstubAllGlobals();
    });
});
