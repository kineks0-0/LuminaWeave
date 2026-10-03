import type { AgentTool, StreamFn } from '@earendil-works/pi-agent-core';
import { Type, fauxAssistantMessage, fauxText, fauxToolCall } from '@earendil-works/pi-ai';
import { describe, expect, it, vi } from 'vitest';
import type {
    AgentSessionApprovalPolicy,
    AgentSessionLogState,
    AgentSessionObserver
} from '@/api/core/agent-runtime/session/AgentSessionTypes.js';
import { AgentSessionLog } from '@/api/core/agent-runtime/session/AgentSessionLog.js';
import {
    batchResponse,
    createSessionKit,
    describeEntries,
    echoTool,
    registerWriteTool,
    toolCallResponse,
    unpairedToolCalls,
    withoutTimestamps
} from './agentSessionTestKit';

type Kit = ReturnType<typeof createSessionKit>;

const captureContexts = (kit: Kit) => {
    const captured: unknown[] = [];
    const streamFn: StreamFn = (model, context, options) => {
        captured.push(withoutTimestamps(context.messages));
        return kit.faux.streamFn(model, context, options);
    };
    return { captured, streamFn };
};

const withoutUsage = (value: unknown): unknown =>
    JSON.parse(JSON.stringify(value, (key, nested: unknown) => key === 'timestamp' || key === 'usage' ? undefined : nested));

const restorePlan = (kit: Kit, tools?: AgentTool[]) => ({
    systemPrompt: 'sys',
    model: kit.faux.model,
    streamFn: kit.faux.streamFn,
    ...(tools ? { tools } : {})
});

/** 第一次“加载”：跑到等待审批并取出日志持久化状态。 */
const pauseWithRegistryApproval = async (response = toolCallResponse('write', { path: 'a.txt' }), tools?: AgentTool[]) => {
    const kit = createSessionKit();
    registerWriteTool(kit.tools);
    kit.faux.setResponses([response]);
    const paused = await kit.session.runTurn(kit.plan('t1', tools ? { tools } : {}));
    expect(paused.status).toBe('awaiting_approval');
    return { kit, state: kit.requireLog().toPersistedState() };
};

/** 第二次“加载”：新的总线、registry、日志与会话。 */
const reload = (state: AgentSessionLogState, options: { register?: boolean; approvalPolicy?: AgentSessionApprovalPolicy; observer?: AgentSessionObserver } = {}) => {
    const kit = createSessionKit({
        logState: JSON.parse(JSON.stringify(state)),
        ...(options.approvalPolicy ? { approvalPolicy: options.approvalPolicy } : {}),
        ...(options.observer ? { observer: options.observer } : {})
    });
    const execute = options.register === false ? undefined : registerWriteTool(kit.tools);
    return { kit, execute };
};

describe('AgentSession reload restore', () => {
    it('restores a registry approval and continues the turn after approval', async () => {
        const { state } = await pauseWithRegistryApproval();
        const onApprovalNeeded = vi.fn();
        const onApprovalResolved = vi.fn();
        const { kit, execute } = reload(state, { observer: { onApprovalNeeded, onApprovalResolved } });
        kit.faux.setResponses([fauxAssistantMessage(fauxText('after'))]);

        const restored = await kit.session.restorePendingApproval({ plan: restorePlan(kit) });

        expect(restored).toMatchObject({ status: 'restored', turnId: 't1', approval: { toolCallId: 'call_1', source: 'registry' } });
        expect(kit.received.map(event => event.type)).toEqual(['agent_start', 'turn_start', 'approval_required']);
        const snapshot = kit.events.getSnapshot('s1');
        expect(snapshot.isStreaming).toBe(false);
        expect(snapshot.activeTurnId).toBe('t1');
        expect(snapshot.awaitingApproval).toMatchObject({ toolCallId: 'call_1', source: 'registry' });
        expect(kit.session.getPendingApproval()).toMatchObject({ toolCallId: 'call_1' });
        expect(kit.tools.listPendingApprovals('s1')).toEqual([
            expect.objectContaining({ turnId: 't1', toolCallId: 'call_1', toolName: 'write', args: { path: 'a.txt' } })
        ]);
        expect(onApprovalNeeded).not.toHaveBeenCalled();
        expect(kit.logChanges).toEqual([]);

        const result = await kit.session.resolveToolApproval('t1', 'call_1', true);

        if (result.status === 'not_found') throw new Error('expected a turn result');
        expect(result.status).toBe('completed');
        expect(execute).toHaveBeenCalledTimes(1);
        expect(unpairedToolCalls(result.messages)).toEqual([]);
        expect(result.messages.map(message => message.role)).toEqual(['user', 'assistant', 'toolResult', 'assistant']);
        expect(describeEntries(kit.requireLog().toPersistedState())).toEqual([
            'turn:start', 'user', 'assistant', 'approval:call_1',
            'approval:call_1:approved', 'toolResult:call_1', 'assistant', 'turn:end:completed'
        ]);
        expect(kit.ofType('approval_resolved')).toEqual([expect.objectContaining({ toolCallId: 'call_1', approved: true })]);
        expect(kit.events.getSnapshot('s1').awaitingApproval).toBeUndefined();
        expect(kit.events.getSnapshot('s1').activeTurnId).toBeUndefined();
        expect(onApprovalResolved).not.toHaveBeenCalled();
    });

    it('restores a registry approval and denies it', async () => {
        const { state } = await pauseWithRegistryApproval();
        const { kit, execute } = reload(state);

        await kit.session.restorePendingApproval({ plan: restorePlan(kit) });
        const result = await kit.session.resolveToolApproval('t1', 'call_1', false, 'no');

        if (result.status === 'not_found') throw new Error('expected a turn result');
        expect(result.status).toBe('completed');
        expect(execute).not.toHaveBeenCalled();
        expect(unpairedToolCalls(result.messages)).toEqual([]);
        expect(kit.ofType('tool_execution_end')).toEqual([expect.objectContaining({ toolCallId: 'call_1', status: 'denied' })]);
        expect(describeEntries(kit.requireLog().toPersistedState()).slice(-3)).toEqual([
            'approval:call_1:denied', 'toolResult:call_1', 'turn:end:completed'
        ]);
        expect(kit.tools.listPendingApprovals()).toEqual([]);
    });

    it('matches the no-reload transcript for a batch with skipped calls', async () => {
        const direct = createSessionKit();
        registerWriteTool(direct.tools);
        const directContexts = captureContexts(direct);
        direct.faux.setResponses([batchResponse(), fauxAssistantMessage(fauxText('after'))]);
        await direct.session.runTurn(direct.plan('t1', { tools: [echoTool], streamFn: directContexts.streamFn }));
        const directResult = await direct.session.resolveToolApproval('t1', 'call_2', true);

        const { kit: before, state } = await pauseWithRegistryApproval(batchResponse(), [echoTool]);
        const { kit } = reload(state);
        const reloadContexts = captureContexts(kit);
        kit.faux.setResponses([fauxAssistantMessage(fauxText('after'))]);
        const restored = await kit.session.restorePendingApproval({
            plan: { ...restorePlan(kit, [echoTool]), streamFn: reloadContexts.streamFn }
        });
        expect(restored).toMatchObject({ status: 'restored', approval: { toolCallId: 'call_2' } });
        const reloadResult = await kit.session.resolveToolApproval('t1', 'call_2', true);

        if (directResult.status === 'not_found' || reloadResult.status === 'not_found') {
            throw new Error('expected turn results');
        }
        expect(reloadResult.status).toBe('completed');
        // faux provider 按调用次数模拟 prompt cache，重载后的新 faux 实例 usage 拆分不同；比较时去掉 usage。
        expect(withoutUsage(reloadResult.messages)).toEqual(withoutUsage(directResult.messages));
        // 续跑请求交给 provider 的上下文必须完全一致。
        expect(reloadContexts.captured).toHaveLength(1);
        expect(reloadContexts.captured[0]).toEqual(directContexts.captured[1]);
        const beforeIds = before.ofType('message_start').map(event => event.message.id);
        const afterIds = kit.ofType('message_start').map(event => event.message.id);
        expect(afterIds.length).toBeGreaterThan(0);
        expect(afterIds.filter(id => beforeIds.includes(id))).toEqual([]);
        expect(describeEntries(kit.requireLog().toPersistedState())).toEqual([
            'turn:start', 'user', 'assistant', 'toolResult:call_1', 'approval:call_2',
            'approval:call_2:approved', 'toolResult:call_2', 'toolResult:call_3', 'assistant', 'turn:end:completed'
        ]);
    });

    it('restores a policy approval through approvalPolicy.restore', async () => {
        const fetchTool: AgentTool = {
            name: 'fetch',
            label: 'Fetch',
            description: 'Fetch a URL.',
            parameters: Type.Object({ url: Type.String() }),
            execute: vi.fn(async () => ({ content: [{ type: 'text' as const, text: 'should not run' }], details: undefined }))
        };
        const first = createSessionKit({
            approvalPolicy: { check: () => ({ details: { domain: 'x.com' } }), execute: vi.fn() }
        });
        first.faux.setResponses([toolCallResponse('fetch', { url: 'https://x.com' })]);
        await first.session.runTurn(first.plan('t1', { tools: [fetchTool] }));
        const state = first.requireLog().toPersistedState();

        const restore = vi.fn();
        const execute = vi.fn(async () => ({ content: [{ type: 'text', text: 'fetched' }], details: { ok: true } }));
        const { kit } = reload(state, { register: false, approvalPolicy: { check: () => null, execute, restore } });
        kit.faux.setResponses([fauxAssistantMessage(fauxText('after'))]);

        const restored = await kit.session.restorePendingApproval({ plan: restorePlan(kit, [fetchTool]) });

        expect(restored).toMatchObject({ status: 'restored', approval: { toolCallId: 'call_1', source: 'policy' } });
        expect(restore).toHaveBeenCalledTimes(1);
        expect(restore).toHaveBeenCalledWith(expect.objectContaining({
            toolCallId: 'call_1',
            toolName: 'fetch',
            args: { url: 'https://x.com' },
            details: { domain: 'x.com' }
        }));
        expect(kit.events.getSnapshot('s1').awaitingApproval).toMatchObject({ toolCallId: 'call_1', source: 'policy' });

        const result = await kit.session.resolveToolApproval('t1', 'call_1', true);

        expect(execute).toHaveBeenCalledTimes(1);
        expect(result).toMatchObject({ status: 'completed' });
        if (result.status === 'not_found') throw new Error('expected a turn result');
        expect(result.messages[2]).toMatchObject({ role: 'toolResult', toolCallId: 'call_1', content: [{ type: 'text', text: 'fetched' }] });
    });

    it('refuses to restore when the model changed', async () => {
        const { state } = await pauseWithRegistryApproval();
        const { kit } = reload(state);

        const result = await kit.session.restorePendingApproval({
            plan: { ...restorePlan(kit), model: { ...kit.faux.model, id: 'other-model' } }
        });

        expect(result).toEqual({ status: 'model_changed', recorded: { provider: 'faux', id: 'faux-model' } });
        expect(kit.received).toEqual([]);
        expect(kit.tools.listPendingApprovals()).toEqual([]);
        expect(kit.session.getPendingApproval()).toBeUndefined();
    });

    it('refuses to restore a registry approval whose tool is not registered', async () => {
        const { state } = await pauseWithRegistryApproval();
        const { kit } = reload(state, { register: false });

        const result = await kit.session.restorePendingApproval({ plan: restorePlan(kit) });

        expect(result).toEqual({ status: 'tool_not_registered', toolName: 'write' });
        expect(kit.received).toEqual([]);
        expect(kit.session.getPendingApproval()).toBeUndefined();
    });

    it('reports nothing to restore when no approval is pending', async () => {
        const kit = createSessionKit();
        kit.faux.setResponses([fauxAssistantMessage(fauxText('hi'))]);
        await kit.session.runTurn(kit.plan('t1'));
        const { kit: next } = reload(kit.requireLog().toPersistedState());

        await expect(next.session.restorePendingApproval({ plan: restorePlan(next) }))
            .resolves.toEqual({ status: 'nothing_to_restore' });
        expect(next.received).toEqual([]);
    });

    it('rejects restore while a turn is busy', async () => {
        const { kit } = await pauseWithRegistryApproval();

        await expect(kit.session.restorePendingApproval({ plan: restorePlan(kit) })).rejects.toThrow('AgentSession is busy');
    });

    it('closes a turn interrupted by reload with error results and an aborted turn end', () => {
        const log = new AgentSessionLog({ sessionId: 's1' });
        log.append({ kind: 'turn', turnId: 't1', phase: 'start', model: { provider: 'faux', id: 'faux-model' } });
        log.append({ kind: 'message', turnId: 't1', message: { role: 'user', content: [{ type: 'text', text: 'go' }], timestamp: 1 } });
        log.append({
            kind: 'message',
            turnId: 't1',
            message: fauxAssistantMessage([
                fauxToolCall('echo', { text: 'a' }, { id: 'call_1' }),
                fauxToolCall('echo', { text: 'b' }, { id: 'call_2' })
            ], { stopReason: 'toolUse' })
        });
        const kit = createSessionKit({ logState: log.toPersistedState() });

        expect(kit.session.closeInterruptedTurn()).toEqual({ turnId: 't1' });

        const state = kit.requireLog().toPersistedState();
        expect(describeEntries(state)).toEqual([
            'turn:start', 'user', 'assistant', 'toolResult:call_1', 'toolResult:call_2', 'turn:end:aborted'
        ]);
        expect(state.entries[3].payload).toMatchObject({
            message: { role: 'toolResult', isError: true, content: [{ type: 'text', text: 'Interrupted by reload.' }] }
        });
        expect(state.entries.at(-1)?.payload).toEqual({
            kind: 'turn', turnId: 't1', phase: 'end', status: 'aborted', errorMessage: 'Interrupted by reload.'
        });
        expect(kit.received).toEqual([]);
        expect(kit.session.closeInterruptedTurn()).toBeUndefined();
        expect(unpairedToolCalls(kit.session.branchHistory())).toEqual([]);
    });
    it('closes an approved but unexecuted call with a distinct unknown-result message', () => {
        const log = new AgentSessionLog({ sessionId: 's1' });
        const approval = { sessionId: 's1', turnId: 't1', toolCallId: 'call_1', toolName: 'write', args: {}, source: 'registry' as const };
        log.append({ kind: 'turn', turnId: 't1', phase: 'start', model: { provider: 'faux', id: 'faux-model' } });
        log.append({ kind: 'message', turnId: 't1', message: { role: 'user', content: [{ type: 'text', text: 'go' }], timestamp: 1 } });
        log.append({
            kind: 'message',
            turnId: 't1',
            message: fauxAssistantMessage([
                fauxToolCall('write', {}, { id: 'call_1' }),
                fauxToolCall('echo', {}, { id: 'call_2' })
            ], { stopReason: 'toolUse' })
        });
        log.append({ kind: 'approval', approval });
        log.append({ kind: 'approval', approval, resolution: { approved: true } });
        const kit = createSessionKit({ logState: log.toPersistedState() });

        expect(kit.session.closeInterruptedTurn()).toEqual({ turnId: 't1' });

        const texts = kit.requireLog().branchMessages().flatMap(message =>
            message.role === 'toolResult' ? [[message.toolCallId, message.content[0]]] : []
        );
        expect(texts).toEqual([
            ['call_1', { type: 'text', text: 'Tool result unknown after reload.' }],
            ['call_2', { type: 'text', text: 'Interrupted by reload.' }]
        ]);
    });

    describe('atomicity', () => {
        it('rolls back to idle and the registry when the restore fails after the side effect', async () => {
            const { state } = await pauseWithRegistryApproval();
            const { kit } = reload(state);
            // 副作用（registry 重建审批）之后宣告失败：必须撤销 registry 里的审批。
            const emit = vi.spyOn(kit.events, 'emit').mockImplementationOnce(() => undefined)
                .mockImplementationOnce(() => undefined).mockImplementationOnce(() => { throw new Error('bus broke'); });

            await expect(kit.session.restorePendingApproval({ plan: restorePlan(kit) })).rejects.toThrow('bus broke');
            emit.mockRestore();

            expect(kit.tools.listPendingApprovals()).toEqual([]);
            expect(kit.session.getPendingApproval()).toBeUndefined();
            expect(kit.received).toEqual([]);
            // 会话回到 idle：可以重试恢复，也可以丢弃后开新回合。
            await expect(kit.session.restorePendingApproval({ plan: restorePlan(kit) }))
                .resolves.toMatchObject({ status: 'restored' });
            await kit.session.abort();
            kit.faux.setResponses([fauxAssistantMessage(fauxText('next'))]);
            await expect(kit.session.runTurn(kit.plan('t2'))).resolves.toMatchObject({ status: 'completed' });
        });

        it('does not touch the registry when building the turn fails', async () => {
            const { state } = await pauseWithRegistryApproval();
            const { kit } = reload(state);
            const restoreSpy = vi.spyOn(kit.tools, 'restorePendingApproval');
            const failing = {
                ...restorePlan(kit),
                get systemPrompt(): string { throw new Error('plan broke'); }
            };

            await expect(kit.session.restorePendingApproval({ plan: failing })).rejects.toThrow('plan broke');

            expect(restoreSpy).not.toHaveBeenCalled();
            expect(kit.tools.listPendingApprovals()).toEqual([]);
            await expect(kit.session.restorePendingApproval({ plan: restorePlan(kit) }))
                .resolves.toMatchObject({ status: 'restored' });
        });

        it('rejects a second restore and runTurn while approvalPolicy.restore is still pending', async () => {
            const fetchTool: AgentTool = {
                name: 'fetch',
                label: 'Fetch',
                description: 'Fetch a URL.',
                parameters: Type.Object({ url: Type.String() }),
                execute: vi.fn()
            };
            const first = createSessionKit({ approvalPolicy: { check: () => ({}), execute: vi.fn() } });
            first.faux.setResponses([toolCallResponse('fetch', { url: 'https://x.com' })]);
            await first.session.runTurn(first.plan('t1', { tools: [fetchTool] }));
            let release: () => void = () => undefined;
            const gate = new Promise<void>(resolve => { release = resolve; });
            const { kit } = reload(first.requireLog().toPersistedState(), {
                register: false,
                approvalPolicy: { check: () => null, execute: vi.fn(), restore: () => gate }
            });

            const firstRestore = kit.session.restorePendingApproval({ plan: restorePlan(kit, [fetchTool]) });
            await Promise.resolve();

            await expect(kit.session.restorePendingApproval({ plan: restorePlan(kit, [fetchTool]) }))
                .rejects.toThrow('AgentSession is busy');
            await expect(kit.session.runTurn(kit.plan('t2'))).rejects.toThrow('AgentSession is busy');
            expect(kit.received).toEqual([]);

            release();
            await expect(firstRestore).resolves.toMatchObject({ status: 'restored', turnId: 't1' });
            expect(kit.session.getPendingApproval()).toMatchObject({ toolCallId: 'call_1' });
        });

        it('rolls back the busy placeholder when approvalPolicy.restore rejects', async () => {
            const fetchTool: AgentTool = {
                name: 'fetch',
                label: 'Fetch',
                description: 'Fetch a URL.',
                parameters: Type.Object({ url: Type.String() }),
                execute: vi.fn(async () => ({ content: [{ type: 'text' as const, text: 'x' }], details: undefined }))
            };
            const first = createSessionKit({ approvalPolicy: { check: () => ({}), execute: vi.fn() } });
            first.faux.setResponses([toolCallResponse('fetch', { url: 'https://x.com' })]);
            await first.session.runTurn(first.plan('t1', { tools: [fetchTool] }));
            const restore = vi.fn().mockRejectedValueOnce(new Error('policy down')).mockResolvedValue(undefined);
            const { kit } = reload(first.requireLog().toPersistedState(), {
                register: false,
                approvalPolicy: { check: () => null, execute: vi.fn(), restore }
            });

            await expect(kit.session.restorePendingApproval({ plan: restorePlan(kit, [fetchTool]) })).rejects.toThrow('policy down');
            expect(kit.received).toEqual([]);

            await expect(kit.session.restorePendingApproval({ plan: restorePlan(kit, [fetchTool]) }))
                .resolves.toMatchObject({ status: 'restored' });
        });

        it('throws on a corrupted log without leaving a pending approval in the registry', async () => {
            const log = new AgentSessionLog({ sessionId: 's1' });
            const approval = { sessionId: 's1', turnId: 't1', toolCallId: 'call_1', toolName: 'write', args: {}, source: 'registry' as const };
            log.append({ kind: 'turn', turnId: 't1', phase: 'start', model: { provider: 'faux', id: 'faux-model' } });
            log.append({ kind: 'message', turnId: 't1', message: { role: 'user', content: [{ type: 'text', text: 'go' }], timestamp: 1 } });
            log.append({ kind: 'approval', approval });
            const { kit } = reload(log.toPersistedState());

            await expect(kit.session.restorePendingApproval({ plan: restorePlan(kit) }))
                .rejects.toThrow('no tool call for the pending approval');

            expect(kit.tools.listPendingApprovals()).toEqual([]);
            expect(kit.received).toEqual([]);
            expect(kit.session.getPendingApproval()).toBeUndefined();
            expect(kit.session.discardPendingApproval()).toEqual({ turnId: 't1' });
        });

        it('reports policy_not_attached without changing state when no restorable policy is mounted', async () => {
            const fetchTool: AgentTool = {
                name: 'fetch',
                label: 'Fetch',
                description: 'Fetch a URL.',
                parameters: Type.Object({ url: Type.String() }),
                execute: vi.fn()
            };
            const first = createSessionKit({ approvalPolicy: { check: () => ({}), execute: vi.fn() } });
            first.faux.setResponses([toolCallResponse('fetch', { url: 'https://x.com' })]);
            await first.session.runTurn(first.plan('t1', { tools: [fetchTool] }));
            const state = first.requireLog().toPersistedState();

            for (const approvalPolicy of [undefined, { check: () => null, execute: vi.fn() }]) {
                const { kit } = reload(state, { register: false, ...(approvalPolicy ? { approvalPolicy } : {}) });

                await expect(kit.session.restorePendingApproval({ plan: restorePlan(kit, [fetchTool]) }))
                    .resolves.toEqual({ status: 'policy_not_attached' });
                expect(kit.received).toEqual([]);
                expect(kit.session.getPendingApproval()).toBeUndefined();
            }
        });

        it('lets only one of two concurrent restores succeed', async () => {
            const { state } = await pauseWithRegistryApproval();
            const { kit } = reload(state);

            const results = await Promise.allSettled([
                kit.session.restorePendingApproval({ plan: restorePlan(kit) }),
                kit.session.restorePendingApproval({ plan: restorePlan(kit) })
            ]);

            expect(results.map(result => result.status)).toEqual(['fulfilled', 'rejected']);
            expect(kit.ofType('approval_required')).toHaveLength(1);
        });

        it('closes a restored approval cleanly on abort', async () => {
            const { state } = await pauseWithRegistryApproval();
            const { kit } = reload(state);
            await kit.session.restorePendingApproval({ plan: restorePlan(kit) });

            await kit.session.abort();

            expect(kit.received.map(event => event.type)).toEqual([
                'agent_start', 'turn_start', 'approval_required', 'approval_resolved',
                'tool_execution_end', 'turn_end', 'agent_end'
            ]);
            expect(kit.ofType('approval_resolved')).toEqual([expect.objectContaining({ toolCallId: 'call_1', approved: false })]);
            expect(describeEntries(kit.requireLog().toPersistedState()).slice(-3)).toEqual([
                'approval:call_1:denied', 'toolResult:call_1', 'turn:end:aborted'
            ]);
            expect(kit.events.getSnapshot('s1').awaitingApproval).toBeUndefined();
            expect(kit.tools.listPendingApprovals()).toEqual([]);
        });
    });

    describe('unresolved log state', () => {
        it('discards a pending approval after model_changed and allows the next turn', async () => {
            const { state } = await pauseWithRegistryApproval(batchResponse(), [echoTool]);
            const { kit } = reload(state);
            const changed = await kit.session.restorePendingApproval({
                plan: { ...restorePlan(kit, [echoTool]), model: { ...kit.faux.model, id: 'other-model' } }
            });
            expect(changed.status).toBe('model_changed');
            await expect(kit.session.runTurn(kit.plan('t2'))).rejects.toThrow('unresolved turn');

            expect(kit.session.discardPendingApproval('model changed')).toEqual({ turnId: 't1' });

            const entries = describeEntries(kit.requireLog().toPersistedState());
            expect(entries.slice(-4)).toEqual([
                'approval:call_2:denied', 'toolResult:call_2', 'toolResult:call_3', 'turn:end:aborted'
            ]);
            expect(kit.requireLog().toPersistedState().entries.at(-1)?.payload).toMatchObject({ errorMessage: 'model changed' });
            const history = kit.session.branchHistory();
            expect(unpairedToolCalls(history)).toEqual([]);
            expect(history.find(message => message.role === 'toolResult' && message.toolCallId === 'call_2')).toMatchObject({
                isError: true,
                content: [{ type: 'text', text: 'Tool call denied: model changed' }]
            });
            expect(kit.received).toEqual([]);
            kit.faux.setResponses([fauxAssistantMessage(fauxText('next'))]);
            await expect(kit.session.runTurn(kit.plan('t2', { history }))).resolves.toMatchObject({ status: 'completed' });
            expect(kit.session.discardPendingApproval()).toBeUndefined();
        });

        it('refuses a new turn over an interrupted turn until it is closed', async () => {
            const log = new AgentSessionLog({ sessionId: 's1' });
            log.append({ kind: 'turn', turnId: 't1', phase: 'start', model: { provider: 'faux', id: 'faux-model' } });
            log.append({ kind: 'message', turnId: 't1', message: { role: 'user', content: [{ type: 'text', text: 'go' }], timestamp: 1 } });
            const kit = createSessionKit({ logState: log.toPersistedState() });
            kit.faux.setResponses([fauxAssistantMessage(fauxText('ok'))]);

            await expect(kit.session.runTurn(kit.plan('t2'))).rejects.toThrow('unresolved turn');
            expect(kit.received).toEqual([]);

            kit.session.closeInterruptedTurn();
            await expect(kit.session.runTurn(kit.plan('t2', { history: kit.session.branchHistory() })))
                .resolves.toMatchObject({ status: 'completed' });
        });
    });

    describe('close and discard write failures', () => {
        const interruptedState = () => {
            const log = new AgentSessionLog({ sessionId: 's1' });
            log.append({ kind: 'turn', turnId: 't1', phase: 'start', model: { provider: 'faux', id: 'faux-model' } });
            log.append({ kind: 'message', turnId: 't1', message: { role: 'user', content: [{ type: 'text', text: 'go' }], timestamp: 1 } });
            log.append({ kind: 'message', turnId: 't1', message: fauxAssistantMessage(fauxToolCall('echo', {}, { id: 'call_1' }), { stopReason: 'toolUse' }) });
            return log.toPersistedState();
        };
        const failingIdAt = (failOn: number[]) => {
            let calls = 0;
            return () => {
                calls += 1;
                if (failOn.includes(calls)) throw new Error('disk full');
                return `m${calls}`;
            };
        };

        it('throws and writes no turn end when closing an interrupted turn fails', () => {
            vi.spyOn(console, 'error').mockImplementation(() => undefined);
            const kit = createSessionKit({ logState: interruptedState(), logOptions: { createId: failingIdAt([1]) } });

            expect(() => kit.session.closeInterruptedTurn()).toThrow('Failed to write session log');

            expect(describeEntries(kit.requireLog().toPersistedState())).toEqual(['turn:start', 'user', 'assistant']);
            vi.restoreAllMocks();
        });

        it('stops at the first failed write when discarding and never writes the turn end', async () => {
            vi.spyOn(console, 'error').mockImplementation(() => undefined);
            const { state } = await pauseWithRegistryApproval();
            const { kit } = reload(state, {});
            const failing = createSessionKit({ logState: state, logOptions: { createId: failingIdAt([2]) } });

            expect(() => failing.session.discardPendingApproval('x')).toThrow('Failed to write session log');

            const entries = describeEntries(failing.requireLog().toPersistedState());
            expect(entries.at(-1)).toBe('approval:call_1:denied');
            expect(entries).not.toContain('turn:end:aborted');
            expect(kit.session.discardPendingApproval('x')).toEqual({ turnId: 't1' });
            vi.restoreAllMocks();
        });
    });

    describe('closing a turn from a mid-turn checkout', () => {
        it('rejects runTurn until closeInterruptedTurn(reason) and keeps the old branch intact', async () => {
            const first = createSessionKit();
            registerWriteTool(first.tools);
            first.faux.setResponses([toolCallResponse('write', { path: 'a.txt' }), fauxAssistantMessage(fauxText('after'))]);
            await first.session.runTurn(first.plan('t1'));
            await first.session.resolveToolApproval('t1', 'call_1', true);
            const state = first.requireLog().toPersistedState();
            const assistantId = state.entries.find(entry => entry.payload.kind === 'message' && entry.payload.message.role === 'assistant')?.id ?? '';
            const { kit } = reload(state);
            const log = kit.requireLog();
            const oldHead = log.getHeadId() ?? '';
            const oldBranch = log.branchMessages({ nodeId: oldHead });

            kit.session.checkout(assistantId);
            await expect(kit.session.runTurn(kit.plan('t2'))).rejects.toThrow('unresolved turn');

            expect(kit.session.closeInterruptedTurn('Branched mid-turn.')).toEqual({ turnId: 't1' });

            const closed = log.toPersistedState().entries.slice(-2).map(entry => entry.payload);
            expect(closed[0]).toMatchObject({ kind: 'message', message: { role: 'toolResult', content: [{ type: 'text', text: 'Branched mid-turn.' }] } });
            expect(closed[1]).toMatchObject({ kind: 'turn', phase: 'end', status: 'aborted', errorMessage: 'Branched mid-turn.' });
            kit.faux.setResponses([fauxAssistantMessage(fauxText('fresh'))]);
            await expect(kit.session.runTurn(kit.plan('t2', { history: kit.session.branchHistory() })))
                .resolves.toMatchObject({ status: 'completed' });
            expect(log.branchMessages({ nodeId: oldHead })).toEqual(oldBranch);
        });
    });
});
