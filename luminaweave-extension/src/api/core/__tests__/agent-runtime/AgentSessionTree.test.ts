import type { AgentMessage } from '@earendil-works/pi-agent-core';
import { describe, expect, it } from 'vitest';
import { AgentSessionTree } from '@/api/core/agent-runtime/session/AgentSessionTree.js';

type TestEntryKind = 'metadata' | 'user' | 'assistant' | 'tool_result';

const createTree = (initialState?: ReturnType<AgentSessionTree<TestEntryKind, Record<string, unknown>>['toPersistedState']>) => new AgentSessionTree<TestEntryKind, Record<string, unknown>>({
    sessionId: 'agent_session',
    now: (() => {
        let time = 1000;
        return () => time += 10;
    })(),
    createNodeId: (() => {
        let index = 0;
        return () => `node_${++index}`;
    })(),
    initialState
});

const extractMessage = (payload: Record<string, unknown>): AgentMessage | null =>
    typeof payload.agentMessage === 'object' && payload.agentMessage !== null
        ? payload.agentMessage as AgentMessage
        : null;

describe('AgentSessionTree', () => {
    it('stores append-only entries and rebuilds branch tree from id / parentId', () => {
        const tree = createTree();

        tree.append('metadata', 'Session', 'metadata', { text: 'metadata' }, null);
        tree.append('user', 'User', 'first input', { text: 'first input' });
        tree.append('assistant', 'Assistant', 'first reply', { text: 'first reply' });
        tree.checkout('node_1');
        tree.append('user', 'User', 'branch input', { text: 'branch input' });

        expect(tree.getEntries().map(entry => ({
            id: entry.id,
            parentId: entry.parentId,
            kind: entry.kind
        }))).toEqual([
            { id: 'node_1', parentId: null, kind: 'metadata' },
            { id: 'node_2', parentId: 'node_1', kind: 'user' },
            { id: 'node_3', parentId: 'node_2', kind: 'assistant' },
            { id: 'node_4', parentId: 'node_1', kind: 'user' }
        ]);
        expect(tree.getTree()).toEqual([
            expect.objectContaining({
                id: 'node_1',
                children: [
                    expect.objectContaining({ id: 'node_2', children: [expect.objectContaining({ id: 'node_3' })] }),
                    expect.objectContaining({ id: 'node_4' })
                ]
            })
        ]);
    });

    it('branches from a user node by checking out its parent and returning editable input', () => {
        const tree = createTree();

        tree.append('metadata', 'Session', 'metadata', {}, null);
        tree.append('user', 'User', 'original input', { text: 'original input' });
        tree.append('assistant', 'Assistant', 'reply', { text: 'reply' });

        const result = tree.branchFromUserNode('node_2', {
            userKind: 'user',
            extractInput: payload => typeof payload.text === 'string' ? payload.text : ''
        });

        expect(result).toEqual({
            activeNodeId: 'node_1',
            input: 'original input',
            userNodeId: 'node_2'
        });
        expect(tree.getActiveNodeId()).toBe('node_1');
    });

    it('hydrates from persisted state without sharing mutable payload references', () => {
        const tree = createTree();
        const payload = { text: 'original' };
        tree.append('metadata', 'Session', 'metadata', payload, null);

        const restored = createTree(tree.toPersistedState());
        payload.text = 'mutated';

        expect(restored.getEntries()).toEqual([
            expect.objectContaining({
                payload: { text: 'original' }
            })
        ]);
        expect(restored.getActiveNodeId()).toBe('node_1');
    });

    it('trims branch messages while preserving assistant tool calls with their tool results', () => {
        const tree = createTree();
        tree.append('metadata', 'Session', 'metadata', {}, null);
        tree.append('user', 'User', 'old input', {
            agentMessage: { role: 'user', content: 'old input', timestamp: 1 }
        });
        tree.append('assistant', 'Assistant', 'needs tool', {
            agentMessage: {
                role: 'assistant',
                content: [{ type: 'toolCall', id: 'call_read', name: 'readFile', arguments: { path: './AGENTS.md' } }],
                api: 'openai-completions',
                provider: 'openai',
                model: 'gpt-5',
                usage: {
                    input: 0,
                    output: 0,
                    cacheRead: 0,
                    cacheWrite: 0,
                    totalTokens: 0,
                    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
                },
                stopReason: 'toolUse',
                timestamp: 2
            }
        });
        tree.append('tool_result', 'Tool result · readFile', 'tool output', {
            agentMessage: {
                role: 'toolResult',
                toolCallId: 'call_read',
                toolName: 'readFile',
                content: [{ type: 'text', text: 'AGENTS' }],
                isError: false,
                timestamp: 3
            }
        });
        tree.append('user', 'User', 'continue', {
            agentMessage: { role: 'user', content: 'continue', timestamp: 4 }
        });

        const messages = tree.getBranchMessages({
            maxMessages: 2,
            extractMessage
        });

        expect(messages.map(message => message.role)).toEqual(['assistant', 'toolResult', 'user']);
        expect(messages[0]).toMatchObject({
            role: 'assistant',
            content: [expect.objectContaining({ type: 'toolCall', id: 'call_read' })]
        });
        expect(messages[1]).toMatchObject({
            role: 'toolResult',
            toolCallId: 'call_read'
        });
    });
});
