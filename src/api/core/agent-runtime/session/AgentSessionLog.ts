import type { AgentMessage } from '@earendil-works/pi-agent-core';
import { AgentSessionTree } from './AgentSessionTree.js';
import type {
    AgentSessionLogChange,
    AgentSessionLogEntry,
    AgentSessionLogKind,
    AgentSessionLogPayload,
    AgentSessionLogState,
    AgentSessionModelRef,
    AgentSessionPendingApproval
} from './AgentSessionTypes.js';

const DEFAULT_MAX_MESSAGES = 30;
const SUMMARY_LENGTH = 120;

export interface AgentSessionLogOptions {
    sessionId: string;
    initialState?: AgentSessionLogState;
    /**
     * 日志每次变更后同步调用，由适配器负责持久化；回调异常被隔离，不影响会话。
     * 增量约定：只带新条目与当前 head，避免每次追加都全量克隆。适配器首次加载时先用 toPersistedState()
     * 取基线，再叠加之后的每次 change（entry 追加到列表末尾，headId 覆盖当前 head；entry 为空表示仅 head 移动）。
     */
    onChange?: (change: AgentSessionLogChange) => void;
    createId?: () => string;
    now?: () => number;
}

export interface AgentSessionLogBranchOptions {
    nodeId?: string;
    /** 默认 30；不大于 0 或为 Infinity 时不截断。 */
    maxMessages?: number;
    replayFilter?: (message: AgentMessage) => AgentMessage | null;
}

/**
 * 建在 AgentSessionTree 之上的通用会话日志：消息、回合边界、审批与适配器自定义条目。
 * 树本身只浅拷贝 payload，日志层在写入、读取和加载时都做 JSON 深拷贝，
 * 使内存中的条目与持久化后重新加载的条目形状一致（undefined 字段被丢弃）。
 */
export class AgentSessionLog {
    readonly sessionId: string;
    private readonly tree: AgentSessionTree<AgentSessionLogKind, AgentSessionLogPayload>;
    private readonly onChange: ((change: AgentSessionLogChange) => void) | undefined;

    constructor(options: AgentSessionLogOptions) {
        this.sessionId = options.sessionId;
        this.onChange = options.onChange;
        this.tree = new AgentSessionTree<AgentSessionLogKind, AgentSessionLogPayload>({
            sessionId: options.sessionId,
            ...(options.now ? { now: options.now } : {}),
            ...(options.createId ? { createNodeId: options.createId } : {}),
            ...(options.initialState ? { initialState: cloneJson(options.initialState) } : {})
        });
    }

    /**
     * 追加条目并返回节点 id；parentId 默认为当前 head。
     * 回合进行中请走 AgentSession.appendCustom（沿回合的 tailId 追加），直接 append 会挂到 head 下，
     * 可能把回合自己的写入链拆开。
     */
    append(payload: AgentSessionLogPayload, parentId: string | null = this.tree.getActiveNodeId()): string {
        const copy = cloneJson(payload);
        const node = this.tree.append(copy.kind, titleOf(copy), summaryOf(copy), copy, parentId);
        if (!this.onChange) return node.id;
        this.notifyChange({
            entry: cloneJson({
                id: node.id,
                sessionId: node.sessionId,
                parentId: node.parentId,
                kind: node.kind,
                title: node.title,
                summary: node.summary,
                createdAt: node.createdAt,
                payload: node.payload
            }),
            headId: node.id
        });
        return node.id;
    }

    getHeadId(): string | null {
        return this.tree.getActiveNodeId();
    }

    checkout(nodeId: string | null): void {
        this.tree.checkout(nodeId);
        this.notifyChange({ headId: nodeId });
    }

    /**
     * 从某个 user 消息节点分叉，返回该消息文本。
     * 若它是某回合 turn:start 之后的首条消息，head 移到该 turn:start 的父节点，而不是 turn:start 本身：
     * 否则新回合会挂在一个没有 turn:end 的旧 turn:start 下，被 findInterruptedTurn 误判为中断回合。
     */
    branchFromUserMessage(nodeId: string): { headId: string | null; text: string } {
        const entries = this.tree.getEntries();
        const entry = entries.find(item => item.id === nodeId);
        if (!entry) throw new Error(`Agent session log node not found: ${nodeId}`);
        const { payload } = entry;
        if (payload.kind !== 'message' || payload.message.role !== 'user') {
            throw new Error(`Agent session log node is not a user message: ${nodeId}`);
        }
        const parent = entry.parentId ? entries.find(item => item.id === entry.parentId) : undefined;
        const headId = parent
            && parent.payload.kind === 'turn'
            && parent.payload.phase === 'start'
            && parent.payload.turnId === payload.turnId
            ? parent.parentId
            : entry.parentId;
        this.tree.checkout(headId);
        this.notifyChange({ headId });
        return { headId, text: userText(payload.message) };
    }

    /** 沿当前分支（或指定节点）返回可回放的消息：仅 message 条目，经 replayFilter 过滤后按窗口截断。 */
    branchMessages(options: AgentSessionLogBranchOptions = {}): AgentMessage[] {
        const messages: AgentMessage[] = [];
        for (const entry of this.branch(options.nodeId)) {
            if (entry.payload.kind !== 'message') continue;
            const message = options.replayFilter
                ? options.replayFilter(cloneJson(entry.payload.message))
                : cloneJson(entry.payload.message);
            if (message) messages.push(message);
        }
        return trimToUserWindow(messages, options.maxMessages ?? DEFAULT_MAX_MESSAGES);
    }

    /**
     * 分支上最近一个回合中未解决的审批。resolution 条目、该回合的 turn:end 都会结束它；
     * 之后又开始了新回合时，旧审批视为已被放弃。
     */
    findPendingApproval(nodeId?: string): { approval: AgentSessionPendingApproval; turnId: string } | undefined {
        let pending: { approval: AgentSessionPendingApproval; turnId: string } | undefined;
        for (const { payload } of this.branch(nodeId)) {
            if (payload.kind === 'approval') {
                if (!payload.resolution) {
                    pending = { approval: payload.approval, turnId: payload.approval.turnId };
                } else if (
                    pending
                    && pending.turnId === payload.approval.turnId
                    && pending.approval.toolCallId === payload.approval.toolCallId
                ) {
                    pending = undefined;
                }
            } else if (payload.kind === 'turn') {
                if (payload.phase === 'start' || pending?.turnId === payload.turnId) pending = undefined;
            }
        }
        return pending ? cloneJson(pending) : undefined;
    }

    /** 分支上最近一个回合：有 turn:start、没有 turn:end，也没有未解决的审批（重载时被中断）。 */
    findInterruptedTurn(nodeId?: string): { turnId: string } | undefined {
        let open: string | undefined;
        for (const { payload } of this.branch(nodeId)) {
            if (payload.kind !== 'turn') continue;
            if (payload.phase === 'start') open = payload.turnId;
            else if (payload.turnId === open) open = undefined;
        }
        if (open === undefined || this.findPendingApproval(nodeId)?.turnId === open) return undefined;
        return { turnId: open };
    }

    /** 分支上属于某回合的全部条目载荷（message / turn / approval / custom），按分支顺序，深拷贝。 */
    getTurnPayloads(turnId: string, nodeId?: string): AgentSessionLogPayload[] {
        return this.branch(nodeId)
            .map(entry => entry.payload)
            .filter(payload => (payload.kind === 'approval' ? payload.approval.turnId : payload.turnId) === turnId)
            .map(cloneJson);
    }

    /** 分支上某回合 turn:start 记录的模型，以及它之前的 message 条目数（不经 replayFilter）。 */
    getTurnStart(turnId: string, nodeId?: string): { model: AgentSessionModelRef; messagesBefore: number } | undefined {
        let found: { model: AgentSessionModelRef; messagesBefore: number } | undefined;
        let messageCount = 0;
        for (const { payload } of this.branch(nodeId)) {
            if (payload.kind === 'message') messageCount += 1;
            if (payload.kind === 'turn' && payload.phase === 'start' && payload.turnId === turnId) {
                found = { model: { ...payload.model }, messagesBefore: messageCount };
            }
        }
        return found;
    }

    toPersistedState(): AgentSessionLogState {
        return cloneJson(this.tree.toPersistedState());
    }

    private notifyChange(change: AgentSessionLogChange): void {
        if (!this.onChange) return;
        try {
            this.onChange(change);
        } catch (error: unknown) {
            console.error({ error }, 'Agent session log onChange failed.');
        }
    }

    private branch(nodeId: string | undefined): AgentSessionLogEntry[] {
        return this.tree.getBranch(nodeId === undefined ? this.tree.getActiveNodeId() : nodeId);
    }
}

/**
 * 截断窗口：保留最后 maxMessages 条，窗口必须以 user 消息开头（不能从 toolResult 或 assistant 开始），
 * 因此向后跳到窗口内第一条 user 消息；窗口内没有 user 消息时不截断。
 */
const trimToUserWindow = (messages: AgentMessage[], maxMessages: number): AgentMessage[] => {
    if (!(maxMessages > 0) || !Number.isFinite(maxMessages) || messages.length <= maxMessages) return messages;
    const start = messages.length - maxMessages;
    for (let index = start; index < messages.length; index += 1) {
        if (messages[index].role === 'user') return messages.slice(index);
    }
    return messages;
};

const cloneJson = <T>(value: T): T => structuredClone(value) as T;

const userText = (message: AgentMessage): string => {
    if (message.role !== 'user') return '';
    if (typeof message.content === 'string') return message.content;
    return message.content
        .map(part => part.type === 'text' ? part.text : '')
        .join('');
};

const messageText = (message: AgentMessage): string => {
    if (message.role === 'user') return userText(message);
    if (message.role === 'assistant' || message.role === 'toolResult') {
        return message.content.map(part => part.type === 'text' ? part.text : '').join('');
    }
    return '';
};

const titleOf = (payload: AgentSessionLogPayload): string => {
    switch (payload.kind) {
        case 'message':
            return payload.message.role;
        case 'turn':
            return `turn:${payload.phase}`;
        case 'approval':
            return payload.resolution ? 'approval:resolved' : 'approval';
        case 'custom':
            return payload.customType;
    }
};

const summaryOf = (payload: AgentSessionLogPayload): string => {
    switch (payload.kind) {
        case 'message':
            return messageText(payload.message).slice(0, SUMMARY_LENGTH);
        case 'approval':
            return payload.approval.toolName;
        case 'turn':
            return payload.phase === 'end' ? payload.status : `${payload.model.provider}/${payload.model.id}`;
        case 'custom':
            return '';
    }
};
