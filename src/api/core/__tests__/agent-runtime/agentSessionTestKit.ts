import type { AgentMessage, AgentTool } from '@earendil-works/pi-agent-core';
import { Type, fauxAssistantMessage, fauxToolCall } from '@earendil-works/pi-ai';
import { vi } from 'vitest';
import {
    AgentRuntimeEventBus,
    type AgentRuntimeEvent
} from '@/api/core/agent-runtime/events/AgentRuntimeEventBus.js';
import { AgentToolRegistry } from '@/api/core/agent-runtime/tools/AgentToolRegistry.js';
import { AgentSession } from '@/api/core/agent-runtime/session/AgentSession.js';
import { AgentSessionLog, type AgentSessionLogOptions } from '@/api/core/agent-runtime/session/AgentSessionLog.js';
import type {
    AgentSessionApprovalPolicy,
    AgentSessionLogChange,
    AgentSessionLogState,
    AgentSessionObserver,
    AgentSessionTurnPlan
} from '@/api/core/agent-runtime/session/AgentSessionTypes.js';
import { createFauxAgentModel } from '@/api/core/agent-runtime/testing/index.js';

// A2b-2 会话日志 / 预览 / 恢复测试共用的脚手架。每次调用模拟一次“页面加载”：新的总线、registry、日志与会话。

export interface SessionKitOptions {
    approvalPolicy?: AgentSessionApprovalPolicy;
    observer?: AgentSessionObserver;
    logState?: AgentSessionLogState;
    withLog?: boolean;
    /** 覆盖日志构造选项（例如注入会抛错的 createId）。 */
    logOptions?: Partial<AgentSessionLogOptions>;
    now?: () => number;
}

export const createSessionKit = (options: SessionKitOptions = {}) => {
    const events = new AgentRuntimeEventBus();
    const tools = new AgentToolRegistry({ events });
    const faux = createFauxAgentModel();
    const logChanges: AgentSessionLogChange[] = [];
    const log = options.withLog === false
        ? undefined
        : new AgentSessionLog({
            sessionId: 's1',
            ...(options.logState ? { initialState: options.logState } : {}),
            onChange: change => logChanges.push(change),
            ...options.logOptions
        });
    const session = new AgentSession({
        sessionId: 's1',
        events,
        tools,
        ...(log ? { log } : {}),
        ...(options.approvalPolicy ? { approvalPolicy: options.approvalPolicy } : {}),
        ...(options.observer ? { observer: options.observer } : {}),
        ...(options.now ? { now: options.now } : {})
    });
    const received: AgentRuntimeEvent[] = [];
    events.subscribe({}, event => {
        received.push(event);
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
    const requireLog = (): AgentSessionLog => {
        if (!log) throw new Error('kit created without log');
        return log;
    };
    return { events, tools, faux, log, requireLog, logChanges, session, received, plan, ofType };
};

export const echoTool: AgentTool = {
    name: 'echo',
    label: 'Echo',
    description: 'Echo text.',
    parameters: Type.Object({ text: Type.String() }),
    execute: async (_toolCallId, params) => ({
        content: [{ type: 'text', text: JSON.stringify(params) }],
        details: undefined
    })
};

export const registerWriteTool = (tools: AgentToolRegistry, execute = vi.fn(async () => ({
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

export const toolCallResponse = (toolName: string, args: Record<string, string>, id = 'call_1') =>
    fauxAssistantMessage(fauxToolCall(toolName, args, { id }), { stopReason: 'toolUse' });

/** 同一批三个调用：call_1 普通（echo）、call_2 需审批（write）、call_3 排在等待调用之后被跳过（echo）。 */
export const batchResponse = () => fauxAssistantMessage([
    fauxToolCall('echo', { text: 'first' }, { id: 'call_1' }),
    fauxToolCall('write', { path: 'a.txt' }, { id: 'call_2' }),
    fauxToolCall('echo', { text: 'last' }, { id: 'call_3' })
], { stopReason: 'toolUse' });

/** 去掉所有 timestamp 字段并做 JSON 规范化（丢弃 undefined），用于跨运行的深度比较。 */
export const withoutTimestamps = <T>(value: T): unknown =>
    JSON.parse(JSON.stringify(value, (key, nested: unknown) => key === 'timestamp' ? undefined : nested));

export const logMessages = (state: AgentSessionLogState): AgentMessage[] =>
    state.entries.flatMap(entry => entry.payload.kind === 'message' ? [entry.payload.message] : []);

/** 日志条目的简短描述，便于断言写入顺序。 */
export const describeEntries = (state: AgentSessionLogState): string[] =>
    state.entries.map(({ payload }) => {
        switch (payload.kind) {
            case 'message': {
                const { message } = payload;
                if (message.role === 'toolResult') return `toolResult:${message.toolCallId}`;
                return message.role;
            }
            case 'turn':
                return payload.phase === 'start' ? 'turn:start' : `turn:end:${payload.status}`;
            case 'approval':
                return payload.resolution
                    ? `approval:${payload.approval.toolCallId}:${payload.resolution.approved ? 'approved' : 'denied'}`
                    : `approval:${payload.approval.toolCallId}`;
            case 'custom':
                return `custom:${payload.customType}`;
        }
    });

/** 每条正常完成的 assistant 消息里的 toolCall 都必须在其后紧跟的 toolResult 段中有结果。 */
export const unpairedToolCalls = (messages: AgentMessage[]): string[] => {
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
