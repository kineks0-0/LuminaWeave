import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EnvDetector } from '../EnvDetector.js';
import { STClient } from '../st-adapter/STClient';

describe('STClient - extra normalization', () => {
    let helper: any;

    beforeEach(() => {
        helper = undefined;
        vi.restoreAllMocks();
        vi.spyOn(EnvDetector, 'stHelper', 'get').mockImplementation(() => helper);
        vi.spyOn(EnvDetector, 'stMain', 'get').mockImplementation(() => undefined as any);
        vi.spyOn(EnvDetector, 'ctx', 'get').mockImplementation(() => undefined as any);
    });

    it('updateMessages should flatten nested extra.extra into extra', async () => {
        type MockCalls = { mock: { calls: unknown[][] } };

        const setChatMessages = vi.fn(async () => {});
        const getChatMessages = vi.fn(() => [{
            message_id: 2,
            message: 'old',
            extra: { oldKey: 1 }
        }]);

        helper = {
            setChatMessages,
            getChatMessages
        };

        await STClient.updateMessages([{
            index: 0,
            content: 'new',
            extra: {
                extra: {
                    id: 'node_2',
                    compressionState: 'summary'
                }
            }
        }], true);

        expect(setChatMessages).toHaveBeenCalledTimes(1);
        const calls = (setChatMessages as unknown as MockCalls).mock.calls;
        const firstCall = calls[0];
        expect(Array.isArray(firstCall)).toBe(true);
        const payload = (firstCall?.[0] as unknown);
        expect(Array.isArray(payload)).toBe(true);
        const firstTarget = (payload as unknown[])[0] as { extra?: Record<string, unknown> };
        expect(firstTarget.extra?.id).toBe('node_2');
        expect(firstTarget.extra?.compressionState).toBe('summary');
        expect((firstTarget.extra as Record<string, unknown> | undefined)?.extra).toBeUndefined();
        expect(firstTarget.extra?.oldKey).toBe(1);
    });

    it('appendMessages should flatten nested extra.extra into extra', async () => {
        type MockCalls = { mock: { calls: unknown[][] } };

        const createChatMessages = vi.fn(async () => {});
        helper = {
            createChatMessages
        };

        await STClient.appendMessages([{
            role: 'assistant',
            name: 'A',
            mesRaw: 'hi',
            extra: {
                extra: { id: 'node_3' },
                compressionState: 'summary'
            }
        }], true);

        expect(createChatMessages).toHaveBeenCalledTimes(1);
        const calls = (createChatMessages as unknown as MockCalls).mock.calls;
        const firstCall = calls[0];
        expect(Array.isArray(firstCall)).toBe(true);
        const payload = (firstCall?.[0] as unknown);
        expect(Array.isArray(payload)).toBe(true);
        const firstMsg = (payload as unknown[])[0] as { extra?: Record<string, unknown> };
        expect(firstMsg.extra?.id).toBe('node_3');
        expect(firstMsg.extra?.compressionState).toBe('summary');
        expect((firstMsg.extra as Record<string, unknown> | undefined)?.extra).toBeUndefined();
    });

    it('appendMessages should prefer mesST over mesRaw and mes when writing ST message', async () => {
        type MockCalls = { mock: { calls: unknown[][] } };

        const createChatMessages = vi.fn(async () => {});
        helper = {
            createChatMessages
        };

        await STClient.appendMessages([{
            role: 'assistant',
            name: 'A',
            mesST: 'st-body',
            mesRaw: 'raw-body',
            mes: 'display-body',
            extra: {
                mesST: 'extra-st',
                mesRaw: 'extra-raw'
            }
        }], true);

        const calls = (createChatMessages as unknown as MockCalls).mock.calls;
        const payload = (calls[0]?.[0] as unknown[])?.[0] as { message?: string };
        expect(payload.message).toBe('st-body');
    });

    it('appendMessages should fall back to extra.mesRaw when top-level mesST and mesRaw are absent', async () => {
        type MockCalls = { mock: { calls: unknown[][] } };

        const createChatMessages = vi.fn(async () => {});
        helper = {
            createChatMessages
        };

        await STClient.appendMessages([{
            role: 'assistant',
            name: 'A',
            mes: 'display-body',
            extra: {
                mesRaw: 'raw-from-extra'
            }
        }], true);

        const calls = (createChatMessages as unknown as MockCalls).mock.calls;
        const payload = (calls[0]?.[0] as unknown[])?.[0] as { message?: string };
        expect(payload.message).toBe('raw-from-extra');
    });

    it('getRawMessages should project active swipe text and regexed display text', () => {
        const getChatMessages = vi.fn(() => [{
            message_id: 7,
            name: 'Assistant',
            role: 'assistant',
            is_hidden: false,
            message: 'old active',
            swipe_id: 1,
            swipes: ['first raw', 'second raw'],
            swipes_info: [
                { extra: { id: 'node_swipe_0', fingerprint: 'fp_0' } },
                { extra: { id: 'node_swipe_1', fingerprint: 'fp_1', mesRaw: 'second raw' } }
            ],
            extra: { id: 'st_floor_id', fingerprint: 'fp_floor' }
        }]);
        const formatAsTavernRegexedString = vi.fn((text: string, _source: string, _destination: string, options?: { depth?: number }) => {
            return `display:${text}:depth=${options?.depth ?? 'none'}`;
        });

        helper = {
            getChatMessages,
            formatAsTavernRegexedString
        };

        const messages = STClient.getRawMessages({ includeSwipes: true });

        expect(messages).toHaveLength(1);
        expect(messages[0].message).toBe('second raw');
        expect(messages[0].mes).toBe('display:second raw:depth=0');
        expect(messages[0].extra.id).toBe('node_swipe_1');
        expect(messages[0].extra.message_id).toBe(7);
        expect(messages[0].extra.swipe_id).toBe(1);
        expect(messages[0].extra.swipeCount).toBe(2);
        expect(messages[0].extra.activeSwipeText).toBe('second raw');
    });

    it('updateMessages should skip body overwrite when swipe_id no longer matches', async () => {
        const setChatMessages = vi.fn(async () => {});
        const getChatMessages = vi.fn(() => [{
            message_id: 5,
            role: 'assistant',
            message: 'current swipe text',
            swipe_id: 1,
            swipes: ['older', 'current swipe text'],
            swipes_info: [{}, {}],
            extra: { id: 'node_current' }
        }]);

        helper = {
            setChatMessages,
            getChatMessages
        };

        await STClient.updateMessages([{
            index: 0,
            content: 'rewrite old branch',
            expectedSwipeId: 0,
            expectedActiveSwipeText: 'older',
            extra: { id: 'node_old_branch' }
        }], true);

        expect(setChatMessages).not.toHaveBeenCalled();
    });
});
