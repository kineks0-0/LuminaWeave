import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StreamHandler } from '../StreamHandler';
import { lwStorage } from '../../storage.js';

vi.mock('../../storage.js', () => ({
    lwStorage: {
        get: vi.fn((_: string, defaultValue: unknown) => defaultValue)
    }
}));

vi.mock('../STBridge.js', () => ({
    STBridge: {
        getCsrfToken: vi.fn(async () => 'csrf-token')
    }
}));

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

        handler.on('BUFFER_UPDATED', (text: string, rawText?: string, nextFilteredCount?: number, statusText?: string) => {
            processed = text;
            raw = rawText || '';
            filteredCount = nextFilteredCount || 0;
            status = statusText || '';
        });

        handler.handleRestart();
        handler.handleChunk('<think>abc</think>', '<think>abc</think>');
        expect(processed).toBe('');
        expect(raw).toBe('<think>abc</think>');
        expect(filteredCount).toBe('<think>abc</think>'.length);
        expect(status).toBe('思考中...');

        const fullRaw = '<think>abc</think><Chat_Reply>Hello\\nWorld</Chat_Reply>';
        handler.handleChunk('<Chat_Reply>Hello\\nWorld</Chat_Reply>', fullRaw);

        expect(processed).toBe('Hello\\nWorld');
        expect(raw).toBe(fullRaw);
        expect(filteredCount).toBe(fullRaw.length - 'Hello\\nWorld'.length);
        expect(status).toBe('回复中...');
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

        const thinkRaw = '<think>abc</think>';
        handler.handleChunk(thinkRaw, thinkRaw);

        const actionRaw = `${thinkRaw}<Character_Action>挥剑`;
        handler.handleChunk('<Character_Action>挥剑', actionRaw);

        const closedActionRaw = `${actionRaw}</Character_Action>`;
        handler.handleChunk('</Character_Action>', closedActionRaw);

        const replyRaw = `${closedActionRaw}<Chat_Reply>你好`;
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
            status: '行动中...'
        });
        expect(snapshots[3]).toEqual({
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
        handler.handleChunk('<think>abc</think>', '<think>abc</think>');
        handler.handleChunk('<Chat_Reply>Hello', '<think>abc</think><Chat_Reply>Hello');

        vi.advanceTimersByTime(20);

        expect(statuses[statuses.length - 1]).toBe('回复中...');
        expect(statuses).not.toContain('思考中...');
        handler.clearSmoothTimer();
        vi.useRealTimers();
    });
});
