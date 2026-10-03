import { fauxAssistantMessage, fauxText, fauxThinking, fauxToolCall } from '@earendil-works/pi-ai';
import { describe, expect, it } from 'vitest';
import {
    blockKey,
    projectAssistantBlocks
} from '@/api/core/agent-runtime/session/AgentMessageProjection.js';

describe('AgentMessageProjection', () => {
    it('projects text, thinking and toolCall parts by contentIndex', () => {
        const message = fauxAssistantMessage([
            fauxThinking('plan'),
            fauxText('answer'),
            fauxToolCall('echo', { text: 'x' }, { id: 'call_1' })
        ], { stopReason: 'toolUse' });

        expect(projectAssistantBlocks(message)).toEqual([
            { type: 'thinking', contentIndex: 0, text: 'plan', redacted: false },
            { type: 'text', contentIndex: 1, text: 'answer' },
            { type: 'toolCall', id: 'call_1', contentIndex: 2, toolName: 'echo', args: { text: 'x' } }
        ]);
    });

    it('marks redacted thinking blocks', () => {
        const message = fauxAssistantMessage([{ type: 'thinking', thinking: '', redacted: true }]);

        expect(projectAssistantBlocks(message)).toEqual([
            { type: 'thinking', contentIndex: 0, text: '', redacted: true }
        ]);
    });

    it('returns an empty list for empty content', () => {
        const message = fauxAssistantMessage([]);

        expect(projectAssistantBlocks(message)).toEqual([]);
    });

    it('derives equal keys for equal blocks and different keys for different blocks', () => {
        const first = { type: 'text', contentIndex: 0, text: 'hi' };
        const same = { type: 'text', contentIndex: 0, text: 'hi' };
        const changed = { type: 'text', contentIndex: 0, text: 'hi!' };
        const otherIndex = { type: 'text', contentIndex: 1, text: 'hi' };

        expect(blockKey(first)).toBe(blockKey(same));
        expect(blockKey(first)).not.toBe(blockKey(changed));
        expect(blockKey(first)).not.toBe(blockKey(otherIndex));
    });
});
