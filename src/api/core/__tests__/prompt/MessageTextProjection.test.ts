import { describe, expect, it, vi } from 'vitest';
import type { LuminaChatMessage } from '@shared/LuminaMessage.js';
import { MessageTextProjection } from '../../hal/prompt/MessageTextProjection.js';

vi.mock('@/api/storage.js', () => ({
    lwStorage: {
        get: vi.fn((_key: string, def: unknown) => def)
    }
}));

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

    it('force reprojects current mes when the display regex set changes', () => {
        const apply = vi.fn((text: string) => `display:${text}`);
        const chat = [buildMessage({
            mes: 'current',
            mesRaw: 'raw',
            extra: { mesRaw_ts: 1, mes_ts: 2 }
        })];

        MessageTextProjection.projectForDisplay(chat, apply, (msg) => msg.mesRaw || '', { force: true });

        expect(apply).toHaveBeenCalledWith('raw', 'user_input', { depth: 0 });
        expect(chat[0].mes).toBe('display:raw');
    });
});

describe('MessageTextProjection.extractMessageText', () => {
    it('keeps raw tag content for the character greeting', () => {
        const raw = '<thinking>先想</thinking><Character_Action>挥手</Character_Action>你好';
        const greeting = buildMessage({
            parentId: null,
            is_user: false,
            conversationType: 'chat',
            mesRaw: raw,
            pluginRaw: raw
        });

        const text = MessageTextProjection.extractMessageText(greeting);

        expect(text).toContain('<thinking>');
        expect(text).toContain('<Character_Action>');
    });

    it('cleans tags for non-greeting assistant messages', () => {
        const raw = '<thinking>先想</thinking><Character_Action>挥手</Character_Action><Chat_Reply>你好</Chat_Reply>';
        const reply = buildMessage({
            parentId: 'node_prev',
            is_user: false,
            conversationType: 'chat',
            mesRaw: raw,
            pluginRaw: raw
        });

        expect(MessageTextProjection.extractMessageText(reply)).toBe('你好');
    });
});
