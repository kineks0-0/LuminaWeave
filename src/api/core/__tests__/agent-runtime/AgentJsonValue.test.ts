import { describe, expect, it } from 'vitest';
import { toJsonObject, toJsonValue } from '@/api/core/agent-runtime/runtime/AgentJsonValue.js';

describe('AgentJsonValue', () => {
    it('keeps JSON-compatible values unchanged', () => {
        const value = { text: 'ok', count: 2, flags: [true, null], nested: { path: '/a.md' } };
        expect(toJsonValue(value)).toEqual(value);
    });

    it('returns undefined for undefined input', () => {
        expect(toJsonValue(undefined)).toBeUndefined();
    });

    it('drops non-serializable members and normalizes dates', () => {
        const at = new Date('2026-10-04T00:00:00.000Z');
        expect(toJsonValue({ keep: 1, fn: () => 1, missing: undefined, at }))
            .toEqual({ keep: 1, at: '2026-10-04T00:00:00.000Z' });
    });

    it('returns undefined for circular structures instead of throwing', () => {
        const circular: Record<string, unknown> = { name: 'loop' };
        circular.self = circular;
        expect(toJsonValue(circular)).toBeUndefined();
    });

    it('narrows tool call arguments to a JSON object', () => {
        expect(toJsonObject({ path: './a.md', lines: [1, 2] })).toEqual({ path: './a.md', lines: [1, 2] });
        expect(toJsonObject(['not', 'object'])).toEqual({});
        expect(toJsonObject(null)).toEqual({});
        expect(toJsonObject('text')).toEqual({});
    });
});
