import { fauxAssistantMessage, fauxText } from '@earendil-works/pi-ai';
import { describe, expect, it, vi } from 'vitest';
import {
    batchResponse,
    createSessionKit,
    describeEntries,
    echoTool,
    logMessages,
    registerWriteTool,
    toolCallResponse,
    unpairedToolCalls,
    withoutTimestamps
} from './agentSessionTestKit';

const failingIdAt = (failOn: number[]) => {
    let calls = 0;
    return () => {
        calls += 1;
        if (failOn.includes(calls)) throw new Error('disk full');
        return `n${calls}`;
    };
};

describe('AgentSession log checkpoints', () => {
    it('writes a plain turn as turn:start, user, assistant, turn:end on one chain', async () => {
        const { faux, session, plan, requireLog, logChanges } = createSessionKit();
        faux.setResponses([fauxAssistantMessage(fauxText('hi'))]);

        const result = await session.runTurn(plan('t1'));

        const state = requireLog().toPersistedState();
        expect(describeEntries(state)).toEqual(['turn:start', 'user', 'assistant', 'turn:end:completed']);
        expect(state.entries[0].payload).toEqual({
            kind: 'turn',
            turnId: 't1',
            phase: 'start',
            model: { provider: 'faux', id: 'faux-model' }
        });
        expect(state.entries[0].parentId).toBeNull();
        state.entries.slice(1).forEach((entry, index) => {
            expect(entry.parentId).toBe(state.entries[index].id);
        });
        expect(withoutTimestamps(logMessages(state))).toEqual(withoutTimestamps(result.messages));
        expect(logChanges).toHaveLength(4);
        expect(requireLog().getHeadId()).toBe(state.entries[3].id);
    });

    it('writes the approval, its resolution and the tool result around a pause', async () => {
        const { faux, session, tools, plan, requireLog } = createSessionKit();
        registerWriteTool(tools);
        faux.setResponses([toolCallResponse('write', { path: 'a.txt' }), fauxAssistantMessage(fauxText('after'))]);

        const paused = await session.runTurn(plan('t1'));

        expect(paused.status).toBe('awaiting_approval');
        expect(describeEntries(requireLog().toPersistedState())).toEqual([
            'turn:start', 'user', 'assistant', 'approval:call_1'
        ]);

        const resumed = await session.resolveToolApproval('t1', 'call_1', true);

        const state = requireLog().toPersistedState();
        expect(describeEntries(state)).toEqual([
            'turn:start', 'user', 'assistant', 'approval:call_1',
            'approval:call_1:approved', 'toolResult:call_1', 'assistant', 'turn:end:completed'
        ]);
        if (resumed.status === 'not_found') throw new Error('expected a turn result');
        expect(withoutTimestamps(logMessages(state))).toEqual(withoutTimestamps(resumed.messages));
    });

    it('keeps the log a prefix of the transcript when later calls in the batch are skipped', async () => {
        const { faux, session, tools, plan, requireLog } = createSessionKit();
        registerWriteTool(tools);
        faux.setResponses([batchResponse(), fauxAssistantMessage(fauxText('after'))]);

        const paused = await session.runTurn(plan('t1', { tools: [echoTool] }));

        expect(paused.status).toBe('awaiting_approval');
        expect(describeEntries(requireLog().toPersistedState())).toEqual([
            'turn:start', 'user', 'assistant', 'toolResult:call_1', 'approval:call_2'
        ]);
        expect(paused.messages.map(message => message.role === 'toolResult' ? message.toolCallId : message.role))
            .toEqual(['user', 'assistant', 'call_1', 'call_3']);

        const resumed = await session.resolveToolApproval('t1', 'call_2', true);

        if (resumed.status === 'not_found') throw new Error('expected a turn result');
        const state = requireLog().toPersistedState();
        expect(describeEntries(state)).toEqual([
            'turn:start', 'user', 'assistant', 'toolResult:call_1', 'approval:call_2',
            'approval:call_2:approved', 'toolResult:call_2', 'toolResult:call_3', 'assistant', 'turn:end:completed'
        ]);
        expect(withoutTimestamps(logMessages(state))).toEqual(withoutTimestamps(resumed.messages));
        expect(unpairedToolCalls(resumed.messages)).toEqual([]);
    });

    it('writes the denial and the error result when an approval is rejected', async () => {
        const { faux, session, tools, plan, requireLog } = createSessionKit();
        registerWriteTool(tools);
        faux.setResponses([toolCallResponse('write', { path: 'a.txt' })]);
        await session.runTurn(plan('t1'));

        const result = await session.resolveToolApproval('t1', 'call_1', false, 'no');

        const state = requireLog().toPersistedState();
        expect(describeEntries(state)).toEqual([
            'turn:start', 'user', 'assistant', 'approval:call_1',
            'approval:call_1:denied', 'toolResult:call_1', 'turn:end:completed'
        ]);
        expect(state.entries[4].payload).toMatchObject({ resolution: { approved: false, message: 'no' } });
        if (result.status === 'not_found') throw new Error('expected a turn result');
        expect(withoutTimestamps(logMessages(state))).toEqual(withoutTimestamps(result.messages));
    });

    it('writes the cancellation when aborted while awaiting approval', async () => {
        const { faux, session, tools, plan, requireLog } = createSessionKit();
        registerWriteTool(tools);
        faux.setResponses([toolCallResponse('write', { path: 'a.txt' })]);
        await session.runTurn(plan('t1'));

        await session.abort();

        const state = requireLog().toPersistedState();
        expect(describeEntries(state)).toEqual([
            'turn:start', 'user', 'assistant', 'approval:call_1',
            'approval:call_1:denied', 'toolResult:call_1', 'turn:end:aborted'
        ]);
        expect(state.entries.at(-1)?.payload).toMatchObject({ errorMessage: 'Agent runtime aborted.' });
    });

    it('logs the decision when a bus listener resolves the approval while it is announced', async () => {
        const { faux, session, tools, plan, requireLog, events } = createSessionKit();
        registerWriteTool(tools);
        faux.setResponses([toolCallResponse('write', { path: 'a.txt' }), fauxAssistantMessage(fauxText('after'))]);
        events.subscribe({}, event => {
            if (event.type === 'approval_required') void session.resolveToolApproval(event.turnId, event.toolCallId, true);
        });

        const result = await session.runTurn(plan('t1'));

        expect(result.status).toBe('completed');
        expect(describeEntries(requireLog().toPersistedState())).toEqual([
            'turn:start', 'user', 'assistant', 'approval:call_1',
            'approval:call_1:approved', 'toolResult:call_1', 'assistant', 'turn:end:completed'
        ]);
    });

    it('runs a second turn from branchHistory', async () => {
        const { faux, session, plan, requireLog } = createSessionKit();
        faux.setResponses([fauxAssistantMessage(fauxText('one')), fauxAssistantMessage(fauxText('two'))]);
        await session.runTurn(plan('t1', { prompt: 'first' }));

        const history = session.branchHistory();
        const second = await session.runTurn(plan('t2', { prompt: 'second', history }));

        expect(second.status).toBe('completed');
        expect(second.messages.map(message => message.role)).toEqual(['user', 'assistant', 'user', 'assistant']);
        expect(withoutTimestamps(logMessages(requireLog().toPersistedState())))
            .toEqual(withoutTimestamps(second.messages));
    });

    it('creates a sibling branch after checking out an earlier node and keeps the old branch', async () => {
        const { faux, session, plan, requireLog } = createSessionKit();
        faux.setResponses([
            fauxAssistantMessage(fauxText('one')),
            fauxAssistantMessage(fauxText('two')),
            fauxAssistantMessage(fauxText('three'))
        ]);
        const log = requireLog();
        await session.runTurn(plan('t1', { prompt: 'first' }));
        const firstEnd = log.getHeadId();
        await session.runTurn(plan('t2', { prompt: 'second', history: session.branchHistory() }));
        const secondEnd = log.getHeadId() ?? '';
        const oldBranch = log.branchMessages({ nodeId: secondEnd });

        session.checkout(firstEnd);
        await session.runTurn(plan('t3', { prompt: 'third', history: session.branchHistory() }));

        const entries = log.toPersistedState().entries;
        const starts = entries.filter(entry => entry.payload.kind === 'turn' && entry.payload.phase === 'start');
        expect(starts.map(entry => entry.parentId)).toEqual([null, firstEnd, firstEnd]);
        expect(log.branchMessages({ nodeId: secondEnd })).toEqual(oldBranch);
        expect(log.branchMessages().map(message => message.role === 'user' ? message.content : message.role)).toEqual([
            [{ type: 'text', text: 'first' }], 'assistant', [{ type: 'text', text: 'third' }], 'assistant'
        ]);
    });

    it('rejects checkout and branching while a turn is busy', async () => {
        const { faux, session, tools, plan, requireLog } = createSessionKit();
        registerWriteTool(tools);
        faux.setResponses([toolCallResponse('write', { path: 'a.txt' })]);
        const running = session.runTurn(plan('t1'));

        expect(() => session.checkout(null)).toThrow('AgentSession is busy');
        await running;
        expect(() => session.checkout(null)).toThrow('AgentSession is busy');
        const userId = requireLog().toPersistedState().entries[1].id;
        expect(() => session.branchFromUserMessage(userId)).toThrow('AgentSession is busy');
    });

    it('branches from a user message back to the head before its turn', async () => {
        const { faux, session, plan, requireLog } = createSessionKit();
        faux.setResponses([fauxAssistantMessage(fauxText('one')), fauxAssistantMessage(fauxText('two'))]);
        const log = requireLog();
        await session.runTurn(plan('t1', { prompt: 'first' }));
        const firstEnd = log.getHeadId();
        await session.runTurn(plan('t2', { prompt: 'second', history: session.branchHistory() }));
        const secondUser = log.toPersistedState().entries.filter(entry =>
            entry.payload.kind === 'message' && entry.payload.message.role === 'user'
        )[1];

        expect(session.branchFromUserMessage(secondUser.id)).toEqual({ headId: firstEnd, text: 'second' });
        expect(log.getHeadId()).toBe(firstEnd);
        expect(session.branchHistory().map(message => message.role)).toEqual(['user', 'assistant']);
    });
    it('writes an aborted turn once, without duplicating messages', async () => {
        const { faux, session, plan, events, requireLog } = createSessionKit();
        faux.setResponses([fauxAssistantMessage(fauxText('word '.repeat(200)))]);
        let aborting: Promise<void> | undefined;
        events.subscribe({}, event => {
            if (event.type === 'message_update' && !aborting) aborting = session.abort();
        });

        const result = await session.runTurn(plan('t1'));
        await aborting;

        const state = requireLog().toPersistedState();
        expect(result.status).toBe('aborted');
        expect(describeEntries(state)).toEqual(['turn:start', 'user', 'assistant', 'turn:end:aborted']);
        expect(state.entries.at(-1)?.payload).toMatchObject({ errorMessage: 'Agent runtime aborted.' });
        expect(withoutTimestamps(logMessages(state))).toEqual(withoutTimestamps(result.messages));
    });

    it('writes the error turn end on the fallback path', async () => {
        const { session, plan, requireLog } = createSessionKit();

        const result = await session.runTurn(plan('t1'));

        expect(result.status).toBe('error');
        const state = requireLog().toPersistedState();
        expect(describeEntries(state)).toEqual(['turn:start', 'user', 'assistant', 'turn:end:error']);
        expect(state.entries.at(-1)?.payload).toMatchObject({ errorMessage: 'No more faux responses queued' });
    });

    it('writes paired approval entries and a consistent prefix when onApprovalNeeded approves synchronously', async () => {
        let ref: ReturnType<typeof createSessionKit> | undefined;
        const kit = createSessionKit({
            observer: {
                onApprovalNeeded: approval => {
                    void ref?.session.resolveToolApproval(approval.turnId, approval.toolCallId, true);
                }
            }
        });
        ref = kit;
        registerWriteTool(kit.tools);
        kit.faux.setResponses([batchResponse(), fauxAssistantMessage(fauxText('after'))]);

        const result = await kit.session.runTurn(kit.plan('t1', { tools: [echoTool] }));

        const state = kit.requireLog().toPersistedState();
        expect(result.status).toBe('completed');
        expect(describeEntries(state)).toEqual([
            'turn:start', 'user', 'assistant', 'toolResult:call_1', 'approval:call_2',
            'approval:call_2:approved', 'toolResult:call_2', 'toolResult:call_3', 'assistant', 'turn:end:completed'
        ]);
        expect(withoutTimestamps(logMessages(state))).toEqual(withoutTimestamps(result.messages));
    });

    describe('write failures', () => {
        it('settles the turn normally when a log write throws', async () => {
            vi.spyOn(console, 'error').mockImplementation(() => undefined);
            // 第 3 次写入（assistant 消息）失败；turn:end 仍应写入，会话回到 idle。
            const kit = createSessionKit({ logOptions: { createId: failingIdAt([3]) } });
            kit.faux.setResponses([fauxAssistantMessage(fauxText('one')), fauxAssistantMessage(fauxText('two'))]);

            const result = await kit.session.runTurn(kit.plan('t1'));

            expect(result.status).toBe('completed');
            expect(kit.ofType('agent_end')).toHaveLength(1);
            expect(describeEntries(kit.requireLog().toPersistedState())).toEqual(['turn:start', 'user', 'turn:end:completed']);
            await expect(kit.session.runTurn(kit.plan('t2'))).resolves.toMatchObject({ status: 'completed' });
            vi.restoreAllMocks();
        });

        it('retries the failed message at the next checkpoint and keeps the log a prefix', async () => {
            vi.spyOn(console, 'error').mockImplementation(() => undefined);
            const kit = createSessionKit({ logOptions: { createId: failingIdAt([3]) } });
            registerWriteTool(kit.tools);
            kit.faux.setResponses([toolCallResponse('write', { path: 'a.txt' }), fauxAssistantMessage(fauxText('after'))]);

            const paused = await kit.session.runTurn(kit.plan('t1'));
            expect(paused.status).toBe('awaiting_approval');
            const resumed = await kit.session.resolveToolApproval('t1', 'call_1', true);

            if (resumed.status === 'not_found') throw new Error('expected a turn result');
            const state = kit.requireLog().toPersistedState();
            expect(withoutTimestamps(logMessages(state))).toEqual(withoutTimestamps(resumed.messages));
            expect(describeEntries(state).at(-1)).toBe('turn:end:completed');
            vi.restoreAllMocks();
        });
    });

    describe('custom entries', () => {
        it('keeps a custom entry appended during a turn on the active branch', async () => {
            let ref: ReturnType<typeof createSessionKit> | undefined;
            const kit = createSessionKit({
                observer: {
                    onMessageEnd: ({ message }) => {
                        if (message.role === 'assistant') ref?.session.appendCustom('note', { seen: true });
                    }
                }
            });
            ref = kit;
            kit.faux.setResponses([fauxAssistantMessage(fauxText('hi'))]);

            await kit.session.runTurn(kit.plan('t1'));

            const state = kit.requireLog().toPersistedState();
            expect(describeEntries(state)).toEqual(['turn:start', 'user', 'custom:note', 'assistant', 'turn:end:completed']);
            state.entries.slice(1).forEach((entry, index) => expect(entry.parentId).toBe(state.entries[index].id));
            expect(state.entries[2].payload).toEqual({ kind: 'custom', turnId: 't1', customType: 'note', data: { seen: true } });
            expect(kit.requireLog().getHeadId()).toBe(state.entries.at(-1)?.id);
        });

        it('hangs an idle custom entry under the head', async () => {
            const kit = createSessionKit();
            kit.faux.setResponses([fauxAssistantMessage(fauxText('hi'))]);
            await kit.session.runTurn(kit.plan('t1'));
            const head = kit.requireLog().getHeadId();

            expect(kit.session.appendCustom('meta', [1, 2])).toBe(true);

            const entries = kit.requireLog().toPersistedState().entries;
            expect(entries.at(-1)).toMatchObject({ parentId: head, payload: { kind: 'custom', customType: 'meta', data: [1, 2] } });
            expect(entries.at(-1)?.payload).not.toHaveProperty('turnId');
        });
    });

    it('rejects a turnId that already started on the current branch', async () => {
        const kit = createSessionKit();
        kit.faux.setResponses([fauxAssistantMessage(fauxText('one')), fauxAssistantMessage(fauxText('two'))]);
        await kit.session.runTurn(kit.plan('t1'));

        await expect(kit.session.runTurn(kit.plan('t1', { history: kit.session.branchHistory() })))
            .rejects.toThrow('turnId already exists');
        await expect(kit.session.runTurn(kit.plan('t2', { history: kit.session.branchHistory() })))
            .resolves.toMatchObject({ status: 'completed' });
    });
});
