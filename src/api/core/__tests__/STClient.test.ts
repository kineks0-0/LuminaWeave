import { describe, it, expect, vi, beforeEach } from 'vitest';

let helper: any;

vi.mock('../EnvDetector.js', () => ({
    EnvDetector: {
        get stHelper() {
            return helper;
        },
        get stMain() {
            return undefined;
        },
        get ctx() {
            return undefined;
        }
    }
}));

import { STClient } from '../st-adapter/STClient';

describe('STClient - extra normalization', () => {
    beforeEach(() => {
        helper = undefined;
        vi.restoreAllMocks();
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
});
