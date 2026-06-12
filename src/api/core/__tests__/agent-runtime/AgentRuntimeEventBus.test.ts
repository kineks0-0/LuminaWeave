import { describe, expect, it } from 'vitest';
import { AgentRuntimeEventBus } from '@/api/core/agent-runtime/events/AgentRuntimeEventBus.js';

describe('AgentRuntimeEventBus', () => {
    it('records lifecycle events in order and projects streaming message snapshot state', () => {
        const bus = new AgentRuntimeEventBus({
            activeTools: [
                { name: 'read', description: 'Read files.', needsApproval: false },
                { name: 'write', description: 'Write files.', needsApproval: true }
            ]
        });
        const observed: string[] = [];
        bus.subscribe(event => {
            observed.push(event.type);
        });

        bus.emit({ type: 'agent_start', sessionId: 'session_1' });
        bus.emit({ type: 'turn_start', turnId: 'turn_1' });
        bus.emit({
            type: 'message_start',
            message: { id: 'message_1', role: 'assistant', blocks: [] }
        });
        bus.emit({
            type: 'message_update',
            messageId: 'message_1',
            block: { type: 'thinking', text: 'checking context' }
        });
        bus.emit({
            type: 'message_update',
            messageId: 'message_1',
            block: { type: 'text', text: 'answer' }
        });
        bus.emit({ type: 'message_end', messageId: 'message_1' });
        bus.emit({ type: 'turn_end', turnId: 'turn_1' });
        bus.emit({ type: 'agent_end', sessionId: 'session_1' });

        expect(observed).toEqual([
            'agent_start',
            'turn_start',
            'message_start',
            'message_update',
            'message_update',
            'message_end',
            'turn_end',
            'agent_end'
        ]);
        expect(bus.getEvents().map(event => event.type)).toEqual(observed);
        expect(bus.getSnapshot()).toEqual({
            isStreaming: false,
            streamingMessage: undefined,
            pendingToolCalls: [],
            messages: [
                {
                    id: 'message_1',
                    role: 'assistant',
                    blocks: [
                        { type: 'thinking', text: 'checking context' },
                        { type: 'text', text: 'answer' }
                    ],
                    status: 'complete'
                }
            ],
            errorMessage: undefined,
            activeTools: [
                { name: 'read', description: 'Read files.', needsApproval: false },
                { name: 'write', description: 'Write files.', needsApproval: true }
            ],
            queue: undefined
        });
    });

    it('tracks tool execution, queue state, and cleanup on agent end', () => {
        const bus = new AgentRuntimeEventBus();

        bus.emit({
            type: 'queue_update',
            queuedTurns: 2,
            activeTurnId: 'turn_1'
        });
        bus.emit({
            type: 'tool_execution_start',
            toolCallId: 'call_1',
            toolName: 'read',
            args: { path: './agent/skills/writer/SKILL.md' }
        });
        bus.emit({
            type: 'tool_execution_update',
            toolCallId: 'call_1',
            content: [{ type: 'text', text: 'partial' }]
        });

        expect(bus.getSnapshot().pendingToolCalls).toEqual([
            {
                toolCallId: 'call_1',
                toolName: 'read',
                args: { path: './agent/skills/writer/SKILL.md' },
                status: 'running',
                updates: [[{ type: 'text', text: 'partial' }]]
            }
        ]);
        expect(bus.getSnapshot().queue).toEqual({
            queuedTurns: 2,
            activeTurnId: 'turn_1'
        });

        bus.emit({
            type: 'tool_execution_end',
            toolCallId: 'call_1',
            status: 'completed',
            result: {
                content: [{ type: 'text', text: 'done' }],
                details: { path: './agent/skills/writer/SKILL.md' }
            }
        });
        bus.emit({ type: 'agent_end', sessionId: 'session_1' });

        expect(bus.getSnapshot().pendingToolCalls).toEqual([]);
        expect(bus.getEvents().map(event => event.type)).toEqual([
            'queue_update',
            'tool_execution_start',
            'tool_execution_update',
            'tool_execution_end',
            'agent_end'
        ]);
    });

    it('sets error state on turn end and returns immutable snapshots', () => {
        const bus = new AgentRuntimeEventBus();
        bus.emit({ type: 'turn_start', turnId: 'turn_1' });
        bus.emit({ type: 'turn_end', turnId: 'turn_1', errorMessage: 'model failed' });

        const snapshot = bus.getSnapshot();
        snapshot.messages.push({
            id: 'local_mutation',
            role: 'assistant',
            blocks: []
        });

        expect(bus.getSnapshot().errorMessage).toBe('model failed');
        expect(bus.getSnapshot().messages).toEqual([]);
    });
});
