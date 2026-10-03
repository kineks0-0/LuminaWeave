import type { AgentMessage } from '@earendil-works/pi-agent-core';
import { fauxAssistantMessage, fauxText, fauxToolCall, type ToolResultMessage } from '@earendil-works/pi-ai';
import { describe, expect, it } from 'vitest';
import {
    fillMissingToolResults,
    findToolResultInsertIndex,
    insertToolResultAt,
    rebuildSkippedToolResults,
    removeLastToolResult
} from '@/api/core/agent-runtime/session/AgentTranscriptEditor.js';

const user = (text: string): AgentMessage => ({ role: 'user', content: text, timestamp: 1 });

const assistantCalling = (...ids: string[]): AgentMessage =>
    fauxAssistantMessage(ids.map(id => fauxToolCall('write', { path: id }, { id })), { stopReason: 'toolUse' });

const toolResult = (toolCallId: string, text = 'ok'): ToolResultMessage => ({
    role: 'toolResult',
    toolCallId,
    toolName: 'write',
    content: [{ type: 'text', text }],
    isError: false,
    timestamp: 1
});

describe('AgentTranscriptEditor', () => {
    it('finds the insert position after the issuing assistant message and its existing results', () => {
        const messages = [user('go'), assistantCalling('call_0', 'call_1'), toolResult('call_0'), user('later')];

        expect(findToolResultInsertIndex(messages, 'call_1')).toBe(3);
    });

    it('returns the end of the transcript when the issuing assistant message is last', () => {
        const messages = [user('go'), assistantCalling('call_1')];

        expect(findToolResultInsertIndex(messages, 'call_1')).toBe(2);
    });

    it('uses the latest assistant message when tool call ids are reused across turns', () => {
        const messages = [
            user('first'),
            assistantCalling('call_1'),
            toolResult('call_1', 'old'),
            fauxAssistantMessage(fauxText('done')),
            user('second'),
            assistantCalling('call_1')
        ];

        expect(findToolResultInsertIndex(messages, 'call_1')).toBe(6);
    });

    it('returns undefined when no assistant message issued the tool call', () => {
        expect(findToolResultInsertIndex([user('go'), assistantCalling('call_0')], 'call_1')).toBeUndefined();
    });

    it('removes the last matching tool result and reinserts at the same position', () => {
        const messages = [assistantCalling('call_1'), toolResult('call_1', 'old'), assistantCalling('call_1'), toolResult('call_1', 'placeholder')];

        const removed = removeLastToolResult(messages, 'call_1');

        expect(removed.index).toBe(3);
        expect(removed.messages).toHaveLength(3);
        expect(messages).toHaveLength(4);
        const inserted = insertToolResultAt(removed.messages, removed.index ?? 0, toolResult('call_1', 'real'));
        expect(inserted[3]).toMatchObject({ content: [{ type: 'text', text: 'real' }] });
    });

    it('fills missing results only after history and only for normally finished assistant messages', () => {
        const messages = [assistantCalling('call_h'), user('go'), assistantCalling('call_1', 'call_2'), toolResult('call_1')];

        const filled = fillMissingToolResults(messages, 2, 'not executed');

        expect(filled.filled.map(message => message.toolCallId)).toEqual(['call_2']);
        expect(filled.messages).toHaveLength(5);
        expect(filled.messages[4]).toMatchObject({ toolCallId: 'call_2', isError: true });
    });

    it('rebuilds the skipped results after the pending call, replacing any existing segment', () => {
        const prefix = [user('go'), assistantCalling('call_0', 'call_1', 'call_2', 'call_3'), toolResult('call_0')];

        const appended = rebuildSkippedToolResults(prefix, 3, 'call_1');
        const replaced = rebuildSkippedToolResults([...prefix, toolResult('call_2', 'pi'), toolResult('call_3', 'pi')], 3, 'call_1');

        expect(appended.slice(0, 3)).toEqual(prefix);
        expect(appended.slice(3)).toEqual([
            expect.objectContaining({ toolCallId: 'call_2', isError: true, content: [{ type: 'text', text: expect.stringMatching(/^Tool call skipped/) }] }),
            expect.objectContaining({ toolCallId: 'call_3', isError: true })
        ]);
        expect(replaced.map(message => message.role === 'toolResult' ? message.content : null))
            .toEqual(appended.map(message => message.role === 'toolResult' ? message.content : null));
        expect(rebuildSkippedToolResults(prefix, 3, 'missing')).toBe(prefix);
    });
});
