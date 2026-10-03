import type { AgentMessage, AgentTool } from '@earendil-works/pi-agent-core';
import {
    Type,
    fauxAssistantMessage,
    fauxText,
    fauxThinking,
    fauxToolCall
} from '@earendil-works/pi-ai';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    AgentRuntimeEventBus,
    type AgentRuntimeEvent
} from '@/api/core/agent-runtime/events/AgentRuntimeEventBus.js';
import { AgentToolRegistry } from '@/api/core/agent-runtime/tools/AgentToolRegistry.js';
import { AgentSession } from '@/api/core/agent-runtime/session/AgentSession.js';
import type {
    AgentSessionApprovalPolicy,
    AgentSessionObserver,
    AgentSessionTurnPlan,
    AgentSessionTurnResult
} from '@/api/core/agent-runtime/session/AgentSessionTypes.js';
import { createFauxAgentModel } from '@/api/core/agent-runtime/testing/createFauxAgentModel.js';

interface SetupOptions {
    approvalPolicy?: AgentSessionApprovalPolicy;
    observer?: AgentSessionObserver;
    tokensPerSecond?: number;
}

const setup = (options: SetupOptions = {}) => {
    const events = new AgentRuntimeEventBus();
    const tools = new AgentToolRegistry({ events });
    const faux = createFauxAgentModel(
        options.tokensPerSecond ? { tokensPerSecond: options.tokensPerSecond } : {}
    );
    const turnEnds: AgentSessionTurnResult[] = [];
    const session = new AgentSession({
        sessionId: 's1',
        events,
        tools,
        ...(options.approvalPolicy ? { approvalPolicy: options.approvalPolicy } : {}),
        observer: {
            ...options.observer,
            onTurnEnd: result => {
                turnEnds.push(result);
                options.observer?.onTurnEnd?.(result);
            }
        }
    });
    const received: AgentRuntimeEvent[] = [];
    const types: string[] = [];
    events.subscribe({}, event => {
        received.push(event);
        types.push(event.type);
    });
    const plan = (turnId: string, overrides: Partial<AgentSessionTurnPlan> = {}): AgentSessionTurnPlan => ({
        turnId,
        systemPrompt: 'sys',
        model: faux.model,
        streamFn: faux.streamFn,
        history: [],
        prompt: 'hello',
        ...overrides
    });
    const ofType = <TType extends AgentRuntimeEvent['type']>(type: TType) =>
        received.filter((event): event is Extract<AgentRuntimeEvent, { type: TType }> => event.type === type);
    return { events, tools, faux, session, received, types, plan, ofType, turnEnds };
};

const echoTool: AgentTool = {
    name: 'echo',
    label: 'Echo',
    description: 'Echo text.',
    parameters: Type.Object({ text: Type.String() }),
    execute: async (_toolCallId, params) => ({
        content: [{ type: 'text', text: JSON.stringify(params) }],
        details: undefined
    })
};

const toolCallResponse = (toolName: string, args: Record<string, string>) =>
    fauxAssistantMessage(fauxToolCall(toolName, args, { id: 'call_1' }), { stopReason: 'toolUse' });

const registerWriteTool = (tools: AgentToolRegistry, execute = vi.fn(async () => ({
    content: [{ type: 'text', text: 'written' }],
    details: { ok: true }
}))) => {
    tools.register({
        name: 'write',
        description: 'Write a file.',
        parameters: Type.Object({ path: Type.String() }),
        needsApproval: true,
        execute
    });
    return execute;
};

const toolResultIndex = (messages: AgentMessage[], toolCallId: string): number =>
    messages.findIndex(message => message.role === 'toolResult' && message.toolCallId === toolCallId);

const assistantToolCallIndex = (messages: AgentMessage[], toolCallId: string): number =>
    messages.findIndex(message =>
        message.role === 'assistant'
        && message.content.some(part => part.type === 'toolCall' && part.id === toolCallId)
    );

/** 每条正常完成的 assistant 消息里的 toolCall 都必须在其后紧跟的 toolResult 段中有结果。 */
const unpairedToolCalls = (messages: AgentMessage[]): string[] => {
    const missing: string[] = [];
    messages.forEach((message, index) => {
        if (message.role !== 'assistant' || message.stopReason === 'error' || message.stopReason === 'aborted') return;
        const answered = new Set<string>();
        for (let next = index + 1; next < messages.length; next += 1) {
            const candidate = messages[next];
            if (candidate.role !== 'toolResult') break;
            answered.add(candidate.toolCallId);
        }
        for (const part of message.content) {
            if (part.type === 'toolCall' && !answered.has(part.id)) missing.push(part.id);
        }
    });
    return missing;
};

const lastAssistantToolCallIndex = (messages: AgentMessage[], toolCallId: string): number => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (message.role === 'assistant' && message.content.some(part => part.type === 'toolCall' && part.id === toolCallId)) {
            return index;
        }
    }
    return -1;
};

const deferred = <T>() => {
    let resolve: (value: T) => void = () => undefined;
    const promise = new Promise<T>(next => {
        resolve = next;
    });
    return { promise, resolve };
};

afterEach(() => {
    vi.restoreAllMocks();
});

describe('AgentSession', () => {
    it('runs a plain text turn with a single bus turn lifecycle', async () => {
        const { faux, session, types, plan, ofType, events, turnEnds } = setup();
        faux.setResponses([fauxAssistantMessage(fauxText('hi'))]);

        const result = await session.runTurn(plan('t1'));

        expect(turnEnds).toEqual([result]);

        expect(types.slice(0, 3)).toEqual(['agent_start', 'turn_start', 'message_start']);
        expect(types.slice(-3)).toEqual(['message_end', 'turn_end', 'agent_end']);
        expect(types.slice(3, -3).length).toBeGreaterThan(0);
        expect(types.slice(3, -3).every(type => type === 'message_update')).toBe(true);
        const updates = ofType('message_update').map(event => JSON.stringify(event));
        expect(new Set(updates).size).toBe(updates.length);
        expect(ofType('message_start')[0]).toMatchObject({
            sessionId: 's1',
            turnId: 't1',
            message: { id: 'agent-message:s1:t1:1', role: 'assistant' }
        });
        expect(ofType('agent_start')[0]).toMatchObject({ sessionId: 's1', turnId: 't1' });
        expect(result.status).toBe('completed');
        expect(result.turnId).toBe('t1');
        expect(result.messages.map(message => message.role)).toEqual(['user', 'assistant']);
        const snapshot = events.getSnapshot('s1');
        expect(snapshot.isStreaming).toBe(false);
        expect(snapshot.messages.at(-1)?.blocks).toEqual([{ type: 'text', contentIndex: 0, text: 'hi' }]);
    });

    it('projects thinking and text blocks in content order', async () => {
        const { faux, session, plan, events } = setup();
        faux.setResponses([fauxAssistantMessage([fauxThinking('plan'), fauxText('answer')])]);

        await session.runTurn(plan('t1'));

        const blocks = events.getSnapshot('s1').messages.at(-1)?.blocks ?? [];
        expect(blocks.map(block => ({ type: block.type, contentIndex: block.contentIndex }))).toEqual([
            { type: 'thinking', contentIndex: 0 },
            { type: 'text', contentIndex: 1 }
        ]);
    });

    it('projects adapter tool execution and closes the turn after the tool round', async () => {
        const { faux, session, types, plan, ofType } = setup();
        faux.setResponses([
            toolCallResponse('echo', { text: 'x' }),
            fauxAssistantMessage(fauxText('done'))
        ]);

        const result = await session.runTurn(plan('t1', { tools: [echoTool] }));

        expect(result.status).toBe('completed');
        expect(ofType('tool_execution_start')).toHaveLength(1);
        expect(ofType('tool_execution_start')[0]).toMatchObject({ toolCallId: 'call_1', toolName: 'echo', args: { text: 'x' } });
        expect(ofType('tool_execution_end')).toHaveLength(1);
        expect(ofType('tool_execution_end')[0]).toMatchObject({ toolCallId: 'call_1', status: 'completed' });
        expect(types.slice(-2)).toEqual(['turn_end', 'agent_end']);
        expect(ofType('turn_end')).toHaveLength(1);
        expect(ofType('agent_end')).toHaveLength(1);
        expect(ofType('message_start').map(event => event.message.id)).toEqual([
            'agent-message:s1:t1:1',
            'agent-message:s1:t1:2'
        ]);
    });

    it('runs registry tools without approval and leaves their events to the registry', async () => {
        const { faux, session, tools, plan, ofType } = setup();
        const execute = vi.fn(async (_toolCallId: string, args: { q: string }) => ({
            content: [{ type: 'text', text: `found:${args.q}` }],
            details: { q: args.q }
        }));
        tools.register({
            name: 'lookup',
            description: 'Look up.',
            parameters: Type.Object({ q: Type.String() }),
            needsApproval: false,
            execute
        });
        faux.setResponses([
            toolCallResponse('lookup', { q: 'auth' }),
            fauxAssistantMessage(fauxText('done'))
        ]);

        const result = await session.runTurn(plan('t1'));

        expect(result.status).toBe('completed');
        expect(execute).toHaveBeenCalledTimes(1);
        expect(ofType('tool_execution_start')).toHaveLength(1);
        expect(ofType('tool_execution_end')).toHaveLength(1);
        expect(ofType('tool_execution_end')[0]).toMatchObject({ toolCallId: 'call_1', status: 'completed' });
        const toolResult = result.messages[toolResultIndex(result.messages, 'call_1')];
        expect(toolResult).toMatchObject({ role: 'toolResult', isError: false, content: [{ type: 'text', text: 'found:auth' }] });
        expect(ofType('turn_end')).toHaveLength(1);
        expect(ofType('agent_end')).toHaveLength(1);
    });

    it('pauses on registry approval and continues the same turn after approval', async () => {
        const { faux, session, tools, plan, ofType, types, events, received } = setup();
        const execute = registerWriteTool(tools);
        faux.setResponses([
            toolCallResponse('write', { path: 'a.txt' }),
            fauxAssistantMessage(fauxText('after'))
        ]);

        const paused = await session.runTurn(plan('t1'));

        expect(paused.status).toBe('awaiting_approval');
        expect(paused.pendingApproval).toMatchObject({
            sessionId: 's1',
            turnId: 't1',
            toolCallId: 'call_1',
            toolName: 'write',
            source: 'registry'
        });
        expect(session.getPendingApproval()).toMatchObject({ toolCallId: 'call_1', source: 'registry' });
        expect(types).not.toContain('turn_end');
        expect(types).not.toContain('agent_end');
        expect(events.getSnapshot('s1').pendingToolCalls.map(call => call.toolCallId)).toContain('call_1');
        expect(toolResultIndex(paused.messages, 'call_1')).toBe(-1);
        expect(execute).not.toHaveBeenCalled();

        const eventsBeforeApproval = received.length;
        const resumed = await session.resolveToolApproval('t1', 'call_1', true);

        expect(resumed).toMatchObject({ turnId: 't1', status: 'completed' });
        expect(execute).toHaveBeenCalledTimes(1);
        const afterApproval = received.slice(eventsBeforeApproval);
        expect(afterApproval.some(event =>
            event.type === 'message_update' && event.block.type === 'text' && event.block.text === 'after'
        )).toBe(true);
        expect(ofType('turn_end')).toHaveLength(1);
        expect(ofType('agent_end')).toHaveLength(1);
        expect(types.slice(-2)).toEqual(['turn_end', 'agent_end']);
        expect(ofType('tool_execution_start')).toHaveLength(1);
        expect(session.getPendingApproval()).toBeUndefined();
        if (resumed.status === 'not_found') throw new Error('expected a turn result');
        const assistantIndex = assistantToolCallIndex(resumed.messages, 'call_1');
        expect(assistantIndex).toBeGreaterThanOrEqual(0);
        expect(toolResultIndex(resumed.messages, 'call_1')).toBe(assistantIndex + 1);
        expect(resumed.messages[assistantIndex + 1]).toMatchObject({
            role: 'toolResult',
            isError: false,
            content: [{ type: 'text', text: 'written' }],
            details: { ok: true }
        });
        expect(resumed.messages.at(-1)).toMatchObject({ role: 'assistant' });
    });

    it('ends the turn without continuing when a registry approval is denied', async () => {
        const { faux, session, tools, plan, ofType, types, turnEnds } = setup();
        const execute = registerWriteTool(tools);
        faux.setResponses([
            toolCallResponse('write', { path: 'a.txt' }),
            fauxAssistantMessage(fauxText('after'))
        ]);
        await session.runTurn(plan('t1'));

        const result = await session.resolveToolApproval('t1', 'call_1', false, 'no');

        expect(result).toMatchObject({ turnId: 't1', status: 'completed' });
        expect(turnEnds).toEqual([result]);
        if (result.status === 'not_found') throw new Error('expected a turn result');
        expect(unpairedToolCalls(result.messages)).toEqual([]);
        expect(execute).not.toHaveBeenCalled();
        const deniedIndex = types.indexOf('tool_execution_end');
        expect(ofType('tool_execution_end')).toEqual([
            expect.objectContaining({ toolCallId: 'call_1', status: 'denied' })
        ]);
        expect(types.slice(deniedIndex + 1)).toEqual(['turn_end', 'agent_end']);
        expect(faux.state.callCount).toBe(1);
    });

    it('pauses adapter tools through the approval policy and executes them after approval', async () => {
        const execute = vi.fn(async () => ({
            content: [{ type: 'text', text: 'fetched' }],
            details: { ok: true }
        }));
        const check = vi.fn(() => ({ details: { domain: 'x.com' } }));
        const onApprovalNeeded = vi.fn();
        const onApprovalResolved = vi.fn();
        const { faux, session, plan, ofType, types } = setup({
            approvalPolicy: { check, execute },
            observer: { onApprovalNeeded, onApprovalResolved }
        });
        const fetchExecute = vi.fn(async () => ({
            content: [{ type: 'text' as const, text: 'should not run' }],
            details: undefined
        }));
        const fetchTool: AgentTool = {
            name: 'fetch',
            label: 'Fetch',
            description: 'Fetch a URL.',
            parameters: Type.Object({ url: Type.String() }),
            execute: fetchExecute
        };
        faux.setResponses([
            toolCallResponse('fetch', { url: 'https://x.com' }),
            fauxAssistantMessage(fauxText('after'))
        ]);

        const paused = await session.runTurn(plan('t1', { tools: [fetchTool] }));

        expect(paused.status).toBe('awaiting_approval');
        expect(paused.pendingApproval).toMatchObject({
            toolCallId: 'call_1',
            toolName: 'fetch',
            source: 'policy',
            args: { url: 'https://x.com' },
            details: { domain: 'x.com' }
        });
        expect(onApprovalNeeded).toHaveBeenCalledTimes(1);
        expect(ofType('tool_execution_start')).toHaveLength(1);
        expect(ofType('tool_execution_end')).toHaveLength(0);
        expect(types).not.toContain('turn_end');
        expect(toolResultIndex(paused.messages, 'call_1')).toBe(-1);

        const resumed = await session.resolveToolApproval('t1', 'call_1', true);

        expect(execute).toHaveBeenCalledTimes(1);
        expect(execute).toHaveBeenCalledWith(expect.objectContaining({
            sessionId: 's1',
            turnId: 't1',
            toolCallId: 'call_1',
            toolName: 'fetch',
            args: { url: 'https://x.com' }
        }));
        expect(fetchExecute).not.toHaveBeenCalled();
        expect(onApprovalResolved).toHaveBeenCalledWith(expect.objectContaining({ approved: true }));
        expect(ofType('tool_execution_end')).toEqual([
            expect.objectContaining({ toolCallId: 'call_1', status: 'completed' })
        ]);
        expect(types.indexOf('tool_execution_end')).toBeLessThan(types.indexOf('turn_end'));
        expect(resumed).toMatchObject({ status: 'completed' });
        if (resumed.status === 'not_found') throw new Error('expected a turn result');
        const assistantIndex = assistantToolCallIndex(resumed.messages, 'call_1');
        expect(resumed.messages[assistantIndex + 1]).toMatchObject({
            role: 'toolResult',
            toolCallId: 'call_1',
            content: [{ type: 'text', text: 'fetched' }]
        });
        expect(types.slice(-2)).toEqual(['turn_end', 'agent_end']);
        expect(ofType('agent_end')).toHaveLength(1);
    });

    it('stops the loop on approval even when earlier calls in the batch did not terminate', async () => {
        const { faux, session, tools, plan, ofType } = setup();
        registerWriteTool(tools);
        faux.setResponses([
            fauxAssistantMessage([
                fauxToolCall('echo', { text: 'first' }, { id: 'call_0' }),
                fauxToolCall('write', { path: 'a.txt' }, { id: 'call_1' }),
                fauxToolCall('echo', { text: 'last' }, { id: 'call_2' })
            ], { stopReason: 'toolUse' }),
            fauxAssistantMessage(fauxText('after'))
        ]);

        const paused = await session.runTurn(plan('t1', { tools: [echoTool] }));

        expect(paused.status).toBe('awaiting_approval');
        expect(faux.state.callCount).toBe(1);
        expect(ofType('tool_execution_end')).toEqual([
            expect.objectContaining({ toolCallId: 'call_0', status: 'completed' }),
            expect.objectContaining({ toolCallId: 'call_2', status: 'failed' })
        ]);

        const resumed = await session.resolveToolApproval('t1', 'call_1', true);

        if (resumed.status === 'not_found') throw new Error('expected a turn result');
        expect(resumed.status).toBe('completed');
        const assistantIndex = assistantToolCallIndex(resumed.messages, 'call_1');
        expect(resumed.messages.slice(assistantIndex + 1, assistantIndex + 4)).toEqual([
            expect.objectContaining({ role: 'toolResult', toolCallId: 'call_0', isError: false }),
            expect.objectContaining({ role: 'toolResult', toolCallId: 'call_1', isError: false }),
            expect.objectContaining({ role: 'toolResult', toolCallId: 'call_2', isError: true })
        ]);
        expect(ofType('agent_end')).toHaveLength(1);
    });

    it('keeps history results that reuse the same tool call id when pausing and resuming', async () => {
        const { faux, session, tools, plan } = setup();
        registerWriteTool(tools);
        const history: AgentMessage[] = [
            { role: 'user', content: [{ type: 'text', text: 'earlier' }], timestamp: 1 },
            fauxAssistantMessage(fauxToolCall('write', { path: 'old.txt' }, { id: 'call_1' }), { stopReason: 'toolUse' }),
            {
                role: 'toolResult',
                toolCallId: 'call_1',
                toolName: 'write',
                content: [{ type: 'text', text: 'old result' }],
                isError: false,
                timestamp: 2
            },
            fauxAssistantMessage(fauxText('old done'))
        ];
        faux.setResponses([
            toolCallResponse('write', { path: 'a.txt' }),
            fauxAssistantMessage(fauxText('after'))
        ]);

        const paused = await session.runTurn(plan('t1', { history }));

        expect(paused.status).toBe('awaiting_approval');
        expect(paused.messages.slice(0, history.length)).toEqual(history);
        expect(paused.messages.slice(history.length).map(message => message.role)).toEqual(['user', 'assistant']);

        const resumed = await session.resolveToolApproval('t1', 'call_1', true);

        if (resumed.status === 'not_found') throw new Error('expected a turn result');
        expect(resumed.status).toBe('completed');
        expect(resumed.messages.slice(0, history.length)).toEqual(history);
        const assistantIndex = lastAssistantToolCallIndex(resumed.messages, 'call_1');
        expect(assistantIndex).toBe(history.length + 1);
        expect(resumed.messages[assistantIndex + 1]).toMatchObject({
            role: 'toolResult',
            toolCallId: 'call_1',
            content: [{ type: 'text', text: 'written' }]
        });
    });

    it('runs a second turn on top of the previous turn messages', async () => {
        const { faux, session, plan, turnEnds } = setup();
        faux.setResponses([
            toolCallResponse('echo', { text: 'x' }),
            fauxAssistantMessage(fauxText('done')),
            fauxAssistantMessage(fauxText('again'))
        ]);
        const first = await session.runTurn(plan('t1', { tools: [echoTool] }));

        const second = await session.runTurn(plan('t2', { tools: [echoTool], history: first.messages, prompt: 'more' }));

        expect(second.status).toBe('completed');
        expect(second.messages.slice(0, first.messages.length)).toEqual(first.messages);
        expect(second.messages.at(-1)).toMatchObject({ role: 'assistant', content: [{ type: 'text', text: 'again' }] });
        expect(turnEnds.map(result => result.turnId)).toEqual(['t1', 't2']);
    });

    it('keeps a single bus turn across consecutive approvals in one turn', async () => {
        const { faux, session, tools, plan, ofType, turnEnds } = setup();
        const execute = registerWriteTool(tools);
        faux.setResponses([
            fauxAssistantMessage(fauxToolCall('write', { path: 'a.txt' }, { id: 'call_1' }), { stopReason: 'toolUse' }),
            fauxAssistantMessage(fauxToolCall('write', { path: 'b.txt' }, { id: 'call_2' }), { stopReason: 'toolUse' }),
            fauxAssistantMessage(fauxText('after'))
        ]);

        const first = await session.runTurn(plan('t1'));
        const second = await session.resolveToolApproval('t1', 'call_1', true);

        expect(first.status).toBe('awaiting_approval');
        expect(second).toMatchObject({ status: 'awaiting_approval', pendingApproval: { toolCallId: 'call_2' } });
        expect(turnEnds).toHaveLength(0);

        const done = await session.resolveToolApproval('t1', 'call_2', true);

        expect(done).toMatchObject({ status: 'completed' });
        expect(execute).toHaveBeenCalledTimes(2);
        for (const type of ['agent_start', 'turn_start', 'turn_end', 'agent_end'] as const) {
            expect(ofType(type), type).toHaveLength(1);
        }
        if (done.status === 'not_found') throw new Error('expected a turn result');
        expect(unpairedToolCalls(done.messages)).toEqual([]);
        expect(turnEnds).toEqual([done]);
    });

    it('settles as aborted when aborted while the approved policy tool is executing', async () => {
        const gate = deferred<void>();
        const execute = vi.fn(async () => {
            await gate.promise;
            return { content: [{ type: 'text', text: 'fetched' }], details: { ok: true } };
        });
        const { faux, session, plan, turnEnds, ofType } = setup({
            approvalPolicy: { check: () => ({}), execute }
        });
        const fetchTool: AgentTool = { ...echoTool, name: 'fetch', parameters: Type.Object({ url: Type.String() }) };
        faux.setResponses([
            toolCallResponse('fetch', { url: 'https://x.com' }),
            fauxAssistantMessage(fauxText('after'))
        ]);
        await session.runTurn(plan('t1', { tools: [fetchTool] }));

        const resolving = session.resolveToolApproval('t1', 'call_1', true);
        const aborting = session.abort();
        gate.resolve();
        const result = await resolving;
        await aborting;

        expect(result).toMatchObject({ status: 'aborted', errorMessage: 'Agent runtime aborted.' });
        expect(execute).toHaveBeenCalledTimes(1);
        expect(faux.state.callCount).toBe(1);
        expect(turnEnds).toHaveLength(1);
        expect(ofType('agent_end')).toHaveLength(1);
        if (result.status === 'not_found') throw new Error('expected a turn result');
        expect(unpairedToolCalls(result.messages)).toEqual([]);
        expect(session.getPendingApproval()).toBeUndefined();
    });

    it('emits denied and settles when a policy approval is rejected', async () => {
        const execute = vi.fn(async () => ({ content: [{ type: 'text', text: 'fetched' }], details: undefined }));
        const { faux, session, plan, ofType, types, turnEnds } = setup({
            approvalPolicy: { check: () => ({}), execute }
        });
        const fetchTool: AgentTool = { ...echoTool, name: 'fetch', parameters: Type.Object({ url: Type.String() }) };
        faux.setResponses([
            toolCallResponse('fetch', { url: 'https://x.com' }),
            fauxAssistantMessage(fauxText('after'))
        ]);
        await session.runTurn(plan('t1', { tools: [fetchTool] }));

        const result = await session.resolveToolApproval('t1', 'call_1', false, 'no');

        expect(result).toMatchObject({ status: 'completed' });
        expect(execute).not.toHaveBeenCalled();
        expect(ofType('tool_execution_end')).toEqual([
            expect.objectContaining({ toolCallId: 'call_1', status: 'denied', errorMessage: 'no' })
        ]);
        expect(types.slice(-3)).toEqual(['tool_execution_end', 'turn_end', 'agent_end']);
        expect(faux.state.callCount).toBe(1);
        expect(turnEnds).toHaveLength(1);
    });

    it('reports a failed policy execution and continues with the error result', async () => {
        const execute = vi.fn(async () => {
            throw new Error('boom');
        });
        const { faux, session, plan, ofType } = setup({
            approvalPolicy: { check: () => ({}), execute }
        });
        const fetchTool: AgentTool = { ...echoTool, name: 'fetch', parameters: Type.Object({ url: Type.String() }) };
        faux.setResponses([
            toolCallResponse('fetch', { url: 'https://x.com' }),
            fauxAssistantMessage(fauxText('after'))
        ]);
        await session.runTurn(plan('t1', { tools: [fetchTool] }));

        const result = await session.resolveToolApproval('t1', 'call_1', true);

        expect(ofType('tool_execution_end')).toEqual([
            expect.objectContaining({ toolCallId: 'call_1', status: 'failed', errorMessage: 'boom' })
        ]);
        expect(result).toMatchObject({ status: 'completed' });
        expect(faux.state.callCount).toBe(2);
        if (result.status === 'not_found') throw new Error('expected a turn result');
        expect(result.messages[toolResultIndex(result.messages, 'call_1')]).toMatchObject({
            isError: true,
            content: [{ type: 'text', text: 'boom' }]
        });
    });

    it('settles as error and frees the session when the run rejects unexpectedly', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const { faux, session, tools, plan, ofType, turnEnds } = setup();
        registerWriteTool(tools);
        faux.setResponses([
            toolCallResponse('write', { path: 'a.txt' }),
            fauxAssistantMessage(fauxText('next turn'))
        ]);
        await session.runTurn(plan('t1'));
        vi.spyOn(tools, 'resolveToolApproval').mockRejectedValue(new Error('registry down'));

        const result = await session.resolveToolApproval('t1', 'call_1', false);

        expect(result).toMatchObject({ turnId: 't1', status: 'error', errorMessage: 'registry down' });
        expect(ofType('agent_end')).toHaveLength(1);
        expect(turnEnds).toHaveLength(1);
        await expect(session.runTurn(plan('t2'))).resolves.toMatchObject({ status: 'completed' });
    });

    it('rejects a plan whose history contains system messages', async () => {
        const { session, plan, types } = setup();
        const history: AgentMessage[] = [{ role: 'system', content: 'old system', timestamp: 1 }];

        await expect(session.runTurn(plan('t1', { history }))).rejects.toThrow('history must not contain system messages');
        expect(types).toEqual([]);
    });

    it('returns not_found for a mismatched approval and keeps the pending approval', async () => {
        const { faux, session, tools, plan } = setup();
        registerWriteTool(tools);
        faux.setResponses([toolCallResponse('write', { path: 'a.txt' })]);
        await session.runTurn(plan('t1'));

        await expect(session.resolveToolApproval('wrong', 'call_1', true)).resolves.toEqual({ status: 'not_found' });
        await expect(session.resolveToolApproval('t1', 'wrong', true)).resolves.toEqual({ status: 'not_found' });
        expect(session.getPendingApproval()).toMatchObject({ turnId: 't1', toolCallId: 'call_1' });
    });

    it('closes the turn with the model error message', async () => {
        const { session, plan, ofType, turnEnds } = setup();

        const result = await session.runTurn(plan('t1'));

        expect(turnEnds).toEqual([result]);
        expect(result.status).toBe('error');
        expect(result.errorMessage).toBe('No more faux responses queued');
        expect(ofType('turn_end')).toEqual([
            expect.objectContaining({ turnId: 't1', errorMessage: 'No more faux responses queued' })
        ]);
        expect(ofType('agent_end')).toHaveLength(1);
    });

    it('aborts a running turn', async () => {
        const { faux, session, plan, ofType, events, turnEnds } = setup({ tokensPerSecond: 20 });
        faux.setResponses([fauxAssistantMessage(fauxText('word '.repeat(200)))]);
        let aborting: Promise<void> | undefined;
        events.subscribe({}, event => {
            if (event.type === 'message_update' && !aborting) aborting = session.abort();
        });

        const result = await session.runTurn(plan('t1'));
        await aborting;

        expect(aborting).toBeDefined();
        expect(result.status).toBe('aborted');
        expect(result.errorMessage).toBe('Agent runtime aborted.');
        expect(ofType('turn_end')).toEqual([
            expect.objectContaining({ turnId: 't1', errorMessage: 'Agent runtime aborted.' })
        ]);
        expect(ofType('agent_end')).toHaveLength(1);
        expect(turnEnds).toEqual([result]);
        expect(events.getSnapshot('s1').isStreaming).toBe(false);
    });

    it('fills missing tool results when a turn is aborted mid-batch', async () => {
        const { faux, session, plan, turnEnds } = setup();
        const stopTool: AgentTool = {
            name: 'stop',
            label: 'Stop',
            description: 'Aborts the session while running.',
            parameters: Type.Object({}),
            execute: async () => {
                void session.abort();
                return { content: [{ type: 'text', text: 'stopped' }], details: undefined };
            }
        };
        faux.setResponses([
            fauxAssistantMessage([
                fauxToolCall('echo', { text: 'first' }, { id: 'c0' }),
                fauxToolCall('stop', {}, { id: 'c1' }),
                fauxToolCall('echo', { text: 'last' }, { id: 'c2' })
            ], { stopReason: 'toolUse' }),
            fauxAssistantMessage(fauxText('never'))
        ]);

        const result = await session.runTurn(plan('t1', { tools: [echoTool, stopTool] }));

        expect(result.status).toBe('aborted');
        expect(result.errorMessage).toBe('Agent runtime aborted.');
        expect(unpairedToolCalls(result.messages)).toEqual([]);
        expect(result.messages[toolResultIndex(result.messages, 'c2')]).toMatchObject({
            role: 'toolResult',
            isError: true,
            content: [{ type: 'text', text: 'Agent runtime aborted.' }]
        });
        expect(turnEnds).toEqual([result]);
    });

    it('cancels a pending approval on abort and ends the turn', async () => {
        const onApprovalResolved = vi.fn();
        const { faux, session, tools, plan, ofType, types, turnEnds } = setup({ observer: { onApprovalResolved } });
        registerWriteTool(tools);
        faux.setResponses([
            toolCallResponse('write', { path: 'a.txt' }),
            fauxAssistantMessage(fauxText('after'))
        ]);
        await session.runTurn(plan('t1'));

        await session.abort();

        expect(ofType('tool_execution_end')).toEqual([
            expect.objectContaining({ toolCallId: 'call_1', status: 'denied' })
        ]);
        expect(ofType('turn_end')).toEqual([
            expect.objectContaining({ turnId: 't1', errorMessage: 'Agent runtime aborted.' })
        ]);
        expect(ofType('agent_end')).toHaveLength(1);
        expect(types.slice(-2)).toEqual(['turn_end', 'agent_end']);
        expect(onApprovalResolved).toHaveBeenCalledWith(expect.objectContaining({ approved: false }));
        expect(turnEnds).toHaveLength(1);
        expect(turnEnds[0]).toMatchObject({ status: 'aborted', errorMessage: 'Agent runtime aborted.' });
        expect(unpairedToolCalls(turnEnds[0].messages)).toEqual([]);
        expect(session.getPendingApproval()).toBeUndefined();
        await expect(session.resolveToolApproval('t1', 'call_1', true)).resolves.toEqual({ status: 'not_found' });
        expect(faux.state.callCount).toBe(1);
    });

    it('rejects a new turn while another one awaits approval', async () => {
        const { faux, session, tools, plan } = setup();
        registerWriteTool(tools);
        faux.setResponses([toolCallResponse('write', { path: 'a.txt' })]);
        await session.runTurn(plan('t1'));

        await expect(session.runTurn(plan('t2'))).rejects.toThrow('AgentSession is busy');
        expect(session.getPendingApproval()).toMatchObject({ turnId: 't1' });
    });

    it('isolates observer failures from the turn', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const onMessageEnd = vi.fn(() => {
            throw new Error('observer failed');
        });
        const { faux, session, plan, ofType } = setup({ observer: { onMessageEnd } });
        faux.setResponses([fauxAssistantMessage(fauxText('hi'))]);

        const result = await session.runTurn(plan('t1'));

        expect(result.status).toBe('completed');
        expect(onMessageEnd).toHaveBeenCalled();
        expect(consoleError).toHaveBeenCalled();
        expect(ofType('agent_end')).toHaveLength(1);
    });
});
