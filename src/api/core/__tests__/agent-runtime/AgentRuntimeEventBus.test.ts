import { describe, expect, it, vi } from 'vitest';
import { AgentRuntimeEventBus } from '@/api/core/agent-runtime/events/AgentRuntimeEventBus.js';

describe('AgentRuntimeEventBus', () => {
    it('isolates snapshots, events, and subscriptions by session and turn', () => {
        const bus = new AgentRuntimeEventBus();
        const observed: string[] = [];
        const unsubscribe = bus.subscribe({ sessionId: 'session_1', turnId: 'turn_1' }, event => {
            observed.push(event.type);
        });

        emitMessage(bus, 'session_1', 'turn_1', 'message_1', 'session one');
        emitMessage(bus, 'session_2', 'turn_2', 'message_2', 'session two');

        expect(bus.getSnapshot('session_1')).toMatchObject({
            sessionId: 'session_1',
            activeTurnId: 'turn_1',
            messages: [expect.objectContaining({ id: 'message_1', turnId: 'turn_1' })]
        });
        expect(bus.getSnapshot('session_2')).toMatchObject({
            sessionId: 'session_2',
            activeTurnId: 'turn_2',
            messages: [expect.objectContaining({ id: 'message_2', turnId: 'turn_2' })]
        });
        expect(bus.getEvents({ sessionId: 'session_1', turnId: 'turn_1' })).toHaveLength(3);
        expect(observed).toEqual(['turn_start', 'message_start', 'message_update']);

        unsubscribe();
        bus.emit({ type: 'turn_end', sessionId: 'session_1', turnId: 'turn_1' });
        expect(observed).toEqual(['turn_start', 'message_start', 'message_update']);
    });

    it('does not let a stale turn mutate the active turn snapshot', () => {
        const bus = new AgentRuntimeEventBus();
        bus.emit({ type: 'turn_start', sessionId: 'session_1', turnId: 'turn_1' });
        bus.emit({ type: 'turn_start', sessionId: 'session_1', turnId: 'turn_2' });
        bus.emit({
            type: 'tool_execution_start',
            sessionId: 'session_1',
            turnId: 'turn_2',
            toolCallId: 'call_2',
            toolName: 'read',
            args: {}
        });
        bus.emit({
            type: 'turn_end',
            sessionId: 'session_1',
            turnId: 'turn_1',
            errorMessage: 'stale failure'
        });

        expect(bus.getSnapshot('session_1')).toMatchObject({
            activeTurnId: 'turn_2',
            isStreaming: true,
            pendingToolCalls: [expect.objectContaining({ toolCallId: 'call_2', turnId: 'turn_2' })]
        });
        expect(bus.getSnapshot('session_1').errorMessage).toBeUndefined();
    });

    it('projects content blocks by contentIndex and keeps messages from the same turn independent', () => {
        const bus = new AgentRuntimeEventBus();
        emitMessage(bus, 'session_1', 'turn_1', 'message_1', 'first');
        emitMessage(bus, 'session_1', 'turn_1', 'message_2', 'second');
        bus.emit({
            type: 'message_update',
            sessionId: 'session_1',
            turnId: 'turn_1',
            messageId: 'message_1',
            block: { type: 'thinking', contentIndex: 1, text: 'checking' }
        });
        bus.emit({
            type: 'message_update',
            sessionId: 'session_1',
            turnId: 'turn_1',
            messageId: 'message_1',
            block: { type: 'text', contentIndex: 0, text: 'first updated' }
        });
        bus.emit({ type: 'message_end', sessionId: 'session_1', turnId: 'turn_1', messageId: 'message_1' });

        expect(bus.getSnapshot('session_1').messages).toEqual([
            expect.objectContaining({
                id: 'message_1',
                status: 'complete',
                blocks: [
                    { type: 'text', contentIndex: 0, text: 'first updated' },
                    { type: 'thinking', contentIndex: 1, text: 'checking' }
                ]
            }),
            expect.objectContaining({
                id: 'message_2',
                status: 'streaming',
                blocks: [{ type: 'text', contentIndex: 0, text: 'second' }]
            })
        ]);
    });

    it('keeps a pending tool running until its matching lifecycle end', () => {
        const bus = new AgentRuntimeEventBus();
        bus.emit({ type: 'turn_start', sessionId: 'session_1', turnId: 'turn_1' });
        bus.emit({
            type: 'tool_execution_start',
            sessionId: 'session_1',
            turnId: 'turn_1',
            toolCallId: 'call_1',
            toolName: 'write',
            args: { path: './card.md' }
        });
        bus.emit({
            type: 'tool_execution_update',
            sessionId: 'session_1',
            turnId: 'turn_1',
            toolCallId: 'call_1',
            toolName: 'write',
            content: [{ type: 'text', text: 'partial' }]
        });

        expect(bus.getSnapshot('session_1').pendingToolCalls).toEqual([
            expect.objectContaining({
                turnId: 'turn_1',
                toolCallId: 'call_1',
                toolName: 'write',
                updates: [[{ type: 'text', text: 'partial' }]]
            })
        ]);

        bus.emit({
            type: 'tool_execution_end',
            sessionId: 'session_1',
            turnId: 'turn_1',
            toolCallId: 'call_1',
            toolName: 'write',
            status: 'denied'
        });
        expect(bus.getSnapshot('session_1').pendingToolCalls).toEqual([]);
    });

    it('stops streaming while awaiting approval without ending the turn', () => {
        const bus = new AgentRuntimeEventBus();
        emitPausedTurn(bus);

        const snapshot = bus.getSnapshot('session_1');
        expect(snapshot).toMatchObject({
            activeTurnId: 'turn_1',
            isStreaming: false,
            awaitingApproval: {
                turnId: 'turn_1',
                toolCallId: 'call_1',
                toolName: 'write',
                args: { path: 'a.txt' },
                source: 'registry'
            },
            pendingToolCalls: [expect.objectContaining({ toolCallId: 'call_1', status: 'running' })]
        });
        expect(snapshot.streamingMessage).toBeUndefined();
    });

    it('resumes streaming and clears awaitingApproval when the approval is granted', () => {
        const bus = new AgentRuntimeEventBus();
        emitPausedTurn(bus);

        bus.emit({ type: 'approval_resolved', sessionId: 'session_1', turnId: 'turn_1', toolCallId: 'call_1', approved: true });

        const snapshot = bus.getSnapshot('session_1');
        expect(snapshot.isStreaming).toBe(true);
        expect(snapshot.awaitingApproval).toBeUndefined();
        expect(snapshot.activeTurnId).toBe('turn_1');
    });

    it('keeps streaming off after a denial and ignores mismatched approval resolutions', () => {
        const bus = new AgentRuntimeEventBus();
        emitPausedTurn(bus);

        bus.emit({ type: 'approval_resolved', sessionId: 'session_1', turnId: 'turn_1', toolCallId: 'call_other', approved: true });
        bus.emit({ type: 'approval_resolved', sessionId: 'session_1', turnId: 'turn_other', toolCallId: 'call_1', approved: true });
        expect(bus.getSnapshot('session_1')).toMatchObject({
            isStreaming: false,
            awaitingApproval: { toolCallId: 'call_1' }
        });

        bus.emit({ type: 'approval_resolved', sessionId: 'session_1', turnId: 'turn_1', toolCallId: 'call_1', approved: false });
        const snapshot = bus.getSnapshot('session_1');
        expect(snapshot.isStreaming).toBe(false);
        expect(snapshot.awaitingApproval).toBeUndefined();
    });

    it('clears awaitingApproval when the active turn ends', () => {
        const bus = new AgentRuntimeEventBus();
        emitPausedTurn(bus);

        bus.emit({ type: 'turn_end', sessionId: 'session_1', turnId: 'turn_1' });

        expect(bus.getSnapshot('session_1').awaitingApproval).toBeUndefined();
    });

    it('returns immutable scoped snapshots and events', () => {
        const bus = new AgentRuntimeEventBus();
        emitMessage(bus, 'session_1', 'turn_1', 'message_1', 'answer');
        const snapshot = bus.getSnapshot('session_1');
        snapshot.messages.length = 0;
        const events = bus.getEvents({ sessionId: 'session_1' });
        events.length = 0;

        expect(bus.getSnapshot('session_1').messages).toHaveLength(1);
        expect(bus.getEvents({ sessionId: 'session_1' })).toHaveLength(3);
    });

    it('isolates subscription failures so later listeners and events keep flowing', () => {
        const bus = new AgentRuntimeEventBus();
        const logger = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const observed: string[] = [];
        bus.subscribe({ sessionId: 'session_1' }, () => {
            throw new Error('projection failed');
        });
        bus.subscribe({ sessionId: 'session_1' }, event => {
            observed.push(event.type);
        });

        bus.emit({ type: 'turn_start', sessionId: 'session_1', turnId: 'turn_1' });
        bus.emit({ type: 'turn_end', sessionId: 'session_1', turnId: 'turn_1' });

        expect(observed).toEqual(['turn_start', 'turn_end']);
        expect(logger).toHaveBeenCalledWith(
            expect.objectContaining({ error: expect.any(Error) }),
            'Agent runtime event subscription failed.'
        );
        logger.mockRestore();
    });
});

const emitMessage = (
    bus: AgentRuntimeEventBus,
    sessionId: string,
    turnId: string,
    messageId: string,
    text: string
): void => {
    bus.emit({ type: 'turn_start', sessionId, turnId });
    bus.emit({
        type: 'message_start',
        sessionId,
        turnId,
        message: { id: messageId, turnId, role: 'assistant', blocks: [] }
    });
    bus.emit({
        type: 'message_update',
        sessionId,
        turnId,
        messageId,
        block: { type: 'text', contentIndex: 0, text }
    });
};

/** 一个正在流式输出、随后因工具审批暂停的回合。 */
const emitPausedTurn = (bus: AgentRuntimeEventBus): void => {
    emitMessage(bus, 'session_1', 'turn_1', 'message_1', 'writing');
    bus.emit({
        type: 'tool_execution_start',
        sessionId: 'session_1',
        turnId: 'turn_1',
        toolCallId: 'call_1',
        toolName: 'write',
        args: { path: 'a.txt' }
    });
    bus.emit({
        type: 'approval_required',
        sessionId: 'session_1',
        turnId: 'turn_1',
        toolCallId: 'call_1',
        toolName: 'write',
        args: { path: 'a.txt' },
        source: 'registry'
    });
};
