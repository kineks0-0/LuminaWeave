import type { AgentMessage } from '@earendil-works/pi-agent-core';
import { fauxAssistantMessage, fauxText, fauxToolCall } from '@earendil-works/pi-ai';
import { describe, expect, it, vi } from 'vitest';
import { AgentSessionLog } from '@/api/core/agent-runtime/session/AgentSessionLog.js';
import type { AgentSessionPendingApproval } from '@/api/core/agent-runtime/session/AgentSessionTypes.js';

const createLog = (options: { onChange?: ConstructorParameters<typeof AgentSessionLog>[0]['onChange'] } = {}) => {
    let seq = 0;
    return new AgentSessionLog({
        sessionId: 's1',
        createId: () => `n${++seq}`,
        now: () => 1000 + seq,
        ...(options.onChange ? { onChange: options.onChange } : {})
    });
};

const user = (text: string): AgentMessage => ({ role: 'user', content: [{ type: 'text', text }], timestamp: 1 });
const assistant = (text: string): AgentMessage => fauxAssistantMessage(fauxText(text));
const toolResult = (toolCallId: string): AgentMessage => ({
    role: 'toolResult',
    toolCallId,
    toolName: 'write',
    content: [{ type: 'text', text: 'ok' }],
    isError: false,
    timestamp: 2
});

const approval = (toolCallId = 'call_1', turnId = 't1'): AgentSessionPendingApproval => ({
    sessionId: 's1',
    turnId,
    toolCallId,
    toolName: 'write',
    args: { path: 'a.txt' },
    source: 'registry'
});

const model = { provider: 'faux', id: 'faux-model' };

/** 写入一个完整回合：turn:start、user、assistant、turn:end。返回 user 节点 id。 */
const appendTurn = (log: AgentSessionLog, turnId: string, prompt: string, answer: string): string => {
    log.append({ kind: 'turn', turnId, phase: 'start', model });
    const userId = log.append({ kind: 'message', turnId, message: user(prompt) });
    log.append({ kind: 'message', turnId, message: assistant(answer) });
    log.append({ kind: 'turn', turnId, phase: 'end', status: 'completed' });
    return userId;
};

describe('AgentSessionLog', () => {
    it('deep-copies payloads on append and on read', () => {
        const log = createLog();
        const message = user('hello');
        log.append({ kind: 'message', turnId: 't1', message });
        if (message.role === 'user' && Array.isArray(message.content)) {
            message.content.push({ type: 'text', text: 'mutated' });
        }

        const read = log.branchMessages();
        expect(read).toEqual([user('hello')]);
        const first = read[0];
        if (first.role === 'user' && Array.isArray(first.content)) first.content.length = 0;
        expect(log.branchMessages()).toEqual([user('hello')]);
    });

    it('checks out nodes and appends new entries as siblings', () => {
        const log = createLog();
        const first = log.append({ kind: 'message', turnId: 't1', message: user('a') });
        const second = log.append({ kind: 'message', turnId: 't1', message: assistant('b') });
        expect(log.getHeadId()).toBe(second);

        log.checkout(first);
        expect(log.getHeadId()).toBe(first);
        log.append({ kind: 'message', turnId: 't2', message: assistant('c') });

        expect(log.branchMessages().map(message => message.role === 'assistant' ? message.content : null))
            .toEqual([null, [{ type: 'text', text: 'c' }]]);
        expect(log.branchMessages({ nodeId: second })).toHaveLength(2);
        log.checkout(null);
        expect(log.branchMessages()).toEqual([]);
        expect(() => log.checkout('missing')).toThrow();
    });

    it('branches from a user message to the parent of its turn and returns the prompt text', () => {
        const log = createLog();
        appendTurn(log, 't1', 'first', 'one');
        const firstTurnEnd = log.getHeadId();
        const userId = appendTurn(log, 't2', 'second', 'two');

        const branched = log.branchFromUserMessage(userId);

        expect(branched).toEqual({ headId: firstTurnEnd, text: 'second' });
        expect(log.getHeadId()).toBe(firstTurnEnd);
        const assistantId = log.toPersistedState().entries.find(entry => entry.kind === 'message'
            && entry.payload.kind === 'message' && entry.payload.message.role === 'assistant')?.id ?? '';
        expect(() => log.branchFromUserMessage(assistantId)).toThrow();
    });

    it('returns only message entries and applies the replay filter', () => {
        const log = createLog();
        appendTurn(log, 't1', 'first', 'one');
        log.append({ kind: 'custom', customType: 'note', data: { a: 1 } });

        expect(log.branchMessages().map(message => message.role)).toEqual(['user', 'assistant']);
        expect(log.branchMessages({
            replayFilter: message => message.role === 'assistant' ? null : message
        }).map(message => message.role)).toEqual(['user']);
    });

    it('truncates the window to start at a user message', () => {
        const log = createLog();
        log.append({ kind: 'message', turnId: 't1', message: user('u1') });
        log.append({ kind: 'message', turnId: 't1', message: fauxAssistantMessage(fauxToolCall('write', {}, { id: 'call_1' })) });
        log.append({ kind: 'message', turnId: 't1', message: toolResult('call_1') });
        log.append({ kind: 'message', turnId: 't1', message: assistant('a1') });
        log.append({ kind: 'message', turnId: 't2', message: user('u2') });
        log.append({ kind: 'message', turnId: 't2', message: assistant('a2') });

        expect(log.branchMessages({ maxMessages: 4 }).map(message => message.role)).toEqual(['user', 'assistant']);
        expect(log.branchMessages({ maxMessages: 6 })).toHaveLength(6);
        expect(log.branchMessages().length).toBe(6);
    });

    it('does not truncate when the window has no user message', () => {
        const log = createLog();
        log.append({ kind: 'message', turnId: 't1', message: user('u1') });
        log.append({ kind: 'message', turnId: 't1', message: assistant('a1') });
        log.append({ kind: 'message', turnId: 't1', message: assistant('a2') });

        expect(log.branchMessages({ maxMessages: 2 })).toHaveLength(3);
    });

    it('finds the pending approval only while it is unresolved and its turn is open', () => {
        const log = createLog();
        log.append({ kind: 'turn', turnId: 't1', phase: 'start', model });
        log.append({ kind: 'message', turnId: 't1', message: user('go') });
        const approvalId = log.append({ kind: 'approval', approval: approval() });

        expect(log.findPendingApproval()).toEqual({ approval: approval(), turnId: 't1' });
        expect(log.findInterruptedTurn()).toBeUndefined();

        log.append({ kind: 'approval', approval: approval(), resolution: { approved: true } });
        expect(log.findPendingApproval()).toBeUndefined();
        expect(log.findPendingApproval(approvalId)).toEqual({ approval: approval(), turnId: 't1' });

        log.checkout(approvalId);
        log.append({ kind: 'turn', turnId: 't1', phase: 'end', status: 'aborted' });
        expect(log.findPendingApproval()).toBeUndefined();
    });

    it('finds a turn that started but never ended', () => {
        const log = createLog();
        appendTurn(log, 't1', 'first', 'one');
        expect(log.findInterruptedTurn()).toBeUndefined();

        log.append({ kind: 'turn', turnId: 't2', phase: 'start', model });
        log.append({ kind: 'message', turnId: 't2', message: user('second') });
        expect(log.findInterruptedTurn()).toEqual({ turnId: 't2' });

        log.append({ kind: 'turn', turnId: 't2', phase: 'end', status: 'completed' });
        expect(log.findInterruptedTurn()).toBeUndefined();
    });

    it('reports the turn start model and the number of messages before it', () => {
        const log = createLog();
        appendTurn(log, 't1', 'first', 'one');
        log.append({ kind: 'turn', turnId: 't2', phase: 'start', model });
        log.append({ kind: 'message', turnId: 't2', message: user('second') });

        expect(log.getTurnStart('t2')).toEqual({ model, messagesBefore: 2 });
        expect(log.getTurnStart('missing')).toBeUndefined();
    });

    it('notifies onChange incrementally with a copy of the new entry and the head', () => {
        const onChange = vi.fn();
        const log = createLog({ onChange });

        const firstId = log.append({ kind: 'message', turnId: 't1', message: user('a') });
        const secondId = log.append({ kind: 'message', turnId: 't1', message: assistant('b') });

        expect(onChange).toHaveBeenCalledTimes(2);
        const [first, second] = onChange.mock.calls.map(call => call[0]);
        expect(first).toMatchObject({ headId: firstId, entry: { id: firstId, parentId: null, kind: 'message' } });
        expect(second).toMatchObject({ headId: secondId, entry: { id: secondId, parentId: firstId } });
        expect(second.entry).toEqual(log.toPersistedState().entries[1]);
        // 通知的是深拷贝：改动它不影响日志。
        second.entry.payload.message.content = [];
        expect(log.toPersistedState().entries[1].payload).not.toMatchObject({ message: { content: [] } });
    });

    it('notifies onChange with only the head when checking out or branching', () => {
        const onChange = vi.fn();
        const log = createLog({ onChange });
        const userId = appendTurn(log, 't1', 'first', 'one');
        onChange.mockClear();

        log.checkout(null);
        log.branchFromUserMessage(userId);

        expect(onChange.mock.calls).toEqual([[{ headId: null }], [{ headId: null }]]);
    });

    it('only sees the current branch when several branches and turns coexist', () => {
        const log = createLog();
        const firstUser = appendTurn(log, 't1', 'first', 'one');
        const trunk = log.getHeadId();
        // 分支 A：未关闭的回合 t2。
        log.append({ kind: 'turn', turnId: 't2', phase: 'start', model });
        log.append({ kind: 'message', turnId: 't2', message: user('a') });
        // 分支 B：从 trunk 分叉，t3 带未解决的审批。
        log.checkout(trunk);
        log.append({ kind: 'turn', turnId: 't3', phase: 'start', model });
        log.append({ kind: 'message', turnId: 't3', message: user('b') });
        log.append({ kind: 'approval', approval: approval('call_b', 't3') });
        const branchBHead = log.getHeadId();

        expect(log.findInterruptedTurn()).toBeUndefined();
        expect(log.findPendingApproval()?.turnId).toBe('t3');
        expect(log.getTurnStart('t2')).toBeUndefined();

        log.branchFromUserMessage(firstUser);
        expect(log.findPendingApproval()).toBeUndefined();
        expect(log.findInterruptedTurn()).toBeUndefined();
        expect(log.findPendingApproval(branchBHead ?? undefined)?.turnId).toBe('t3');
        expect(log.getTurnPayloads('t3')).toEqual([]);
        expect(log.getTurnPayloads('t3', branchBHead ?? undefined)).toHaveLength(3);
    });

    it('moves a truncated window that starts between a toolResult and an assistant forward to a user message', () => {
        const log = createLog();
        log.append({ kind: 'message', turnId: 't1', message: user('q1') });
        log.append({ kind: 'message', turnId: 't1', message: fauxAssistantMessage(fauxToolCall('write', {}, { id: 'call_1' }), { stopReason: 'toolUse' }) });
        log.append({ kind: 'message', turnId: 't1', message: toolResult('call_1') });
        log.append({ kind: 'message', turnId: 't1', message: assistant('a1') });
        log.append({ kind: 'message', turnId: 't2', message: user('q2') });
        log.append({ kind: 'message', turnId: 't2', message: assistant('a2') });

        // 窗口 4 条正好从 toolResult 开始，3 条从 assistant 开始；都必须前移到 q2。
        for (const maxMessages of [4, 3]) {
            expect(log.branchMessages({ maxMessages }).map(message => message.role)).toEqual(['user', 'assistant']);
        }
    });

    it('does not fail when onChange throws', () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const log = createLog({ onChange: () => { throw new Error('persist failed'); } });

        expect(() => log.append({ kind: 'message', turnId: 't1', message: user('a') })).not.toThrow();
        expect(log.branchMessages()).toHaveLength(1);
        vi.restoreAllMocks();
    });

    it('treats a turn with an approved but unexecuted tool as interrupted, not pending', () => {
        const log = createLog();
        log.append({ kind: 'turn', turnId: 't1', phase: 'start', model });
        log.append({ kind: 'message', turnId: 't1', message: user('go') });
        log.append({ kind: 'message', turnId: 't1', message: fauxAssistantMessage(fauxToolCall('write', {}, { id: 'call_1' }), { stopReason: 'toolUse' }) });
        log.append({ kind: 'approval', approval: approval() });
        log.append({ kind: 'approval', approval: approval(), resolution: { approved: true } });

        expect(log.findPendingApproval()).toBeUndefined();
        expect(log.findInterruptedTurn()).toEqual({ turnId: 't1' });
    });

    it('restores the full state from initialState', () => {
        const log = createLog();
        appendTurn(log, 't1', 'first', 'one');
        const state = log.toPersistedState();

        const restored = new AgentSessionLog({ sessionId: 's1', initialState: JSON.parse(JSON.stringify(state)) });

        expect(restored.toPersistedState()).toEqual(state);
        expect(restored.getHeadId()).toBe(log.getHeadId());
        expect(restored.branchMessages()).toEqual(log.branchMessages());
    });
});
