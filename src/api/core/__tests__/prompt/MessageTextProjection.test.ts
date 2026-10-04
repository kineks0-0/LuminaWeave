import { describe, expect, it, vi } from 'vitest';
import type { LuminaChatMessage } from '@shared/LuminaMessage.js';
import { MessageTextProjection } from '../../hal/prompt/MessageTextProjection.js';

const buildMessage = (overrides: Partial<LuminaChatMessage> = {}): LuminaChatMessage => ({
    id: 'msg_1',
    parentId: null,
    mes: '',
    mesRaw: 'hello',
    role: 'user',
    is_user: true,
    extra: {},
    ...overrides
} as LuminaChatMessage);

describe('MessageTextProjection.projectForDisplay', () => {
    it('project raw text into display text when mes is missing', () => {
        const apply = vi.fn((text: string) => `display:${text}`);
        const chat = [buildMessage({ mes: '', mesRaw: 'hello' })];

        MessageTextProjection.projectForDisplay(chat, apply, (msg) => msg.mesRaw || '');

        expect(apply).toHaveBeenCalledWith('hello', 'user_input', { depth: 0 });
        expect(chat[0].mes).toBe('display:hello');
    });

    it('reprojects when mesRaw is newer than mes', () => {
        const apply = vi.fn((text: string) => `display:${text}`);
        const chat = [buildMessage({
            mes: 'stale',
            mesRaw: 'fresh',
            extra: { mesRaw_ts: 2, mes_ts: 1 }
        })];

        MessageTextProjection.projectForDisplay(chat, apply, (msg) => msg.mesRaw || '');

        expect(chat[0].mes).toBe('display:fresh');
    });

    it('keeps existing mes when timestamps show it is current', () => {
        const apply = vi.fn((text: string) => `display:${text}`);
        const chat = [buildMessage({
            mes: 'current',
            mesRaw: 'raw',
            extra: { mesRaw_ts: 1, mes_ts: 2 }
        })];

        MessageTextProjection.projectForDisplay(chat, apply, (msg) => msg.mesRaw || '');

        expect(apply).not.toHaveBeenCalled();
        expect(chat[0].mes).toBe('current');
    });
});
