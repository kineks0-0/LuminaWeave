import { describe, expect, it, vi } from 'vitest';
import { AgentRuntimeEventBus } from '@/api/core/agent-runtime/events/AgentRuntimeEventBus.js';
import { AgentRuntimeCore } from '@/api/core/agent-runtime/runtime/AgentRuntimeCore.js';

interface TestContext {
    projectId: string;
    threadId: string;
}

const createCore = () => {
    const createdSessions: string[] = [];
    const sessionMethods = {
        runTurn: vi.fn(async (input: { context: TestContext; input: string }) => ({ text: `run:${input.input}` })),
        previewPrompt: vi.fn(async (input: { context: TestContext; input: string }) => ({ text: `preview:${input.input}` })),
        continue: vi.fn(async () => undefined),
        resolveToolApproval: vi.fn(async (turnId: string, toolCallId: string, approved: boolean, message?: string) => ({
            resolved: true,
            turnId,
            toolCallId,
            approved,
            message
        })),
        abort: vi.fn()
    };
    const core = new AgentRuntimeCore<
        { context: TestContext; input: string },
        { text: string },
        { text: string },
        { resolved: boolean; turnId: string; toolCallId: string; approved: boolean; message?: string }
    >({
        resolveSessionId: input => `${input.context.projectId}__${input.context.threadId}`,
        createSession: input => {
            createdSessions.push(input.sessionId);
            return sessionMethods;
        }
    });
    return { core, createdSessions, sessionMethods };
};

describe('AgentRuntimeCore', () => {
    it('routes approval resolution to the exact session without probing other sessions', async () => {
        const firstResolve = vi.fn(async () => ({ resolved: false }));
        const secondResolve = vi.fn(async () => ({ resolved: true }));
        const core = new AgentRuntimeCore<{ sessionId: string }, string, string, { resolved: boolean }>({
            resolveSessionId: input => input.sessionId,
            createSession: ({ sessionId }) => ({
                runTurn: async () => sessionId,
                previewPrompt: async () => sessionId,
                resolveToolApproval: sessionId === 'session_1' ? firstResolve : secondResolve
            })
        });

        await core.runTurn({ sessionId: 'session_1' });
        await core.runTurn({ sessionId: 'session_2' });
        await expect(core.resolveToolApproval(
            'session_2',
            'turn_2',
            'call_2',
            true,
            'approved'
        )).resolves.toEqual({ resolved: true });

        expect(firstResolve).not.toHaveBeenCalled();
        expect(secondResolve).toHaveBeenCalledWith('turn_2', 'call_2', true, 'approved');
    });

    it('reuses adapter sessions by resolved session id for run and preview', async () => {
        const { core, createdSessions, sessionMethods } = createCore();
        const context = { projectId: 'project', threadId: 'thread' };

        await expect(core.runTurn({ context, input: 'hello' })).resolves.toEqual({ text: 'run:hello' });
        await expect(core.previewPrompt({ context, input: 'hello' })).resolves.toEqual({ text: 'preview:hello' });

        expect(createdSessions).toEqual(['project__thread']);
        expect(sessionMethods.runTurn).toHaveBeenCalledTimes(1);
        expect(sessionMethods.previewPrompt).toHaveBeenCalledTimes(1);
    });

    it('routes continue, approval resolution, and abort across managed sessions', async () => {
        const { core, sessionMethods } = createCore();
        const context = { projectId: 'project', threadId: 'thread' };
        await core.runTurn({ context, input: 'hello' });

        await core.continue('project__thread');
        await expect(core.resolveToolApproval('project__thread', 'turn_1', 'call_1', true, 'approved')).resolves.toEqual({
            resolved: true,
            turnId: 'turn_1',
            toolCallId: 'call_1',
            approved: true,
            message: 'approved'
        });
        core.abortActiveGeneration();

        expect(sessionMethods.continue).toHaveBeenCalledTimes(1);
        expect(sessionMethods.resolveToolApproval).toHaveBeenCalledWith('turn_1', 'call_1', true, 'approved');
        expect(sessionMethods.abort).toHaveBeenCalledTimes(1);
    });

    it('passes a shared event bus into managed sessions for run, continue, approval, and abort projection', async () => {
        const events = new AgentRuntimeEventBus({
            activeTools: [{ name: 'read', description: 'Read files.', needsApproval: false }]
        });
        let sessionFactoryEvents: AgentRuntimeEventBus | null = null;
        const core = new AgentRuntimeCore<
            { context: TestContext; input: string },
            { text: string },
            { text: string },
            { resolved: boolean; turnId: string; toolCallId: string; approved: boolean; message?: string }
        >({
            events,
            resolveSessionId: input => `${input.context.projectId}__${input.context.threadId}`,
            createSession: input => {
                sessionFactoryEvents = input.events;
                return {
                    runTurn: async () => {
                        input.events.emit({ type: 'agent_start', sessionId: input.sessionId, turnId: 'turn_run' });
                        input.events.emit({ type: 'turn_start', sessionId: input.sessionId, turnId: 'turn_run' });
                        input.events.emit({
                            type: 'message_start',
                            sessionId: input.sessionId,
                            turnId: 'turn_run',
                            message: { id: 'message_run', turnId: 'turn_run', role: 'assistant', blocks: [] }
                        });
                        input.events.emit({
                            type: 'message_update',
                            sessionId: input.sessionId,
                            turnId: 'turn_run',
                            messageId: 'message_run',
                            block: { type: 'text', text: 'run text' }
                        });
                        input.events.emit({ type: 'message_end', sessionId: input.sessionId, turnId: 'turn_run', messageId: 'message_run' });
                        input.events.emit({ type: 'turn_end', sessionId: input.sessionId, turnId: 'turn_run' });
                        return { text: 'run' };
                    },
                    previewPrompt: async () => ({ text: 'preview' }),
                    continue: async () => {
                        input.events.emit({ type: 'turn_start', sessionId: input.sessionId, turnId: 'turn_continue' });
                        input.events.emit({ type: 'turn_end', sessionId: input.sessionId, turnId: 'turn_continue' });
                    },
                    resolveToolApproval: async (turnId, toolCallId, approved, message) => {
                        input.events.emit({
                            type: 'tool_execution_start',
                            sessionId: input.sessionId,
                            turnId,
                            toolCallId,
                            toolName: 'write',
                            args: { path: './card.md' }
                        });
                        input.events.emit({
                            type: 'tool_execution_end',
                            sessionId: input.sessionId,
                            turnId,
                            toolCallId,
                            toolName: 'write',
                            status: approved ? 'completed' : 'denied',
                            result: {
                                content: [{ type: 'text', text: message ?? '' }],
                                details: { approved }
                            }
                        });
                        return { resolved: true, turnId, toolCallId, approved, message };
                    },
                    abort: () => {
                        input.events.emit({ type: 'agent_end', sessionId: input.sessionId, turnId: 'turn_continue' });
                    }
                };
            }
        });
        const context = { projectId: 'project', threadId: 'thread' };

        await core.runTurn({ context, input: 'hello' });
        await core.continue('project__thread');
        await core.resolveToolApproval('project__thread', 'turn_continue', 'call_write', true, 'approved');
        core.abortActiveGeneration();

        expect(core.events).toBe(events);
        expect(sessionFactoryEvents).toBe(events);
        expect(core.events.getEvents({ sessionId: 'project__thread' }).map(event => event.type)).toEqual([
            'agent_start',
            'turn_start',
            'message_start',
            'message_update',
            'message_end',
            'turn_end',
            'turn_start',
            'turn_end',
            'tool_execution_start',
            'tool_execution_end',
            'agent_end'
        ]);
        expect(core.events.getSnapshot('project__thread')).toMatchObject({
            isStreaming: false,
            pendingToolCalls: [],
            messages: [{
                id: 'message_run',
                role: 'assistant',
                blocks: [{ type: 'text', text: 'run text' }],
                status: 'complete'
            }],
            activeTools: [{ name: 'read', description: 'Read files.', needsApproval: false }]
        });
    });
});
