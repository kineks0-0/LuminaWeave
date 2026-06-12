import type { AgentMessage } from '@earendil-works/pi-agent-core';

export interface AgentSessionTreeEntry<TKey extends string, TPayload extends Record<string, unknown>> {
    id: string;
    sessionId: string;
    parentId: string | null;
    kind: TKey;
    title: string;
    summary: string;
    createdAt: number;
    payload: TPayload;
}

export type AgentSessionTreeNode<TKey extends string, TPayload extends Record<string, unknown>> =
    AgentSessionTreeEntry<TKey, TPayload> & {
        children: Array<AgentSessionTreeNode<TKey, TPayload>>;
    };

export interface AgentSessionTreePersistedState<TKey extends string, TPayload extends Record<string, unknown>> {
    sessionId: string;
    activeNodeId: string | null;
    entries: Array<AgentSessionTreeEntry<TKey, TPayload>>;
    version: 1;
}

export interface AgentSessionTreeOptions<TKey extends string, TPayload extends Record<string, unknown>> {
    sessionId: string;
    now?: () => number;
    createNodeId?: () => string;
    initialState?: AgentSessionTreePersistedState<TKey, TPayload> | null;
}

export interface AgentSessionBranchFromUserOptions<TKey extends string, TPayload extends Record<string, unknown>> {
    userKind: TKey;
    extractInput: (payload: TPayload) => string;
}

export interface AgentSessionBranchFromUserResult {
    activeNodeId: string | null;
    input: string;
    userNodeId: string;
}

export interface AgentSessionBranchMessageOptions<TKey extends string, TPayload extends Record<string, unknown>> {
    nodeId?: string | null;
    maxMessages?: number;
    preserveToolPairs?: boolean;
    extractMessage: (payload: TPayload, entry: AgentSessionTreeEntry<TKey, TPayload>) => AgentMessage | null;
}

export class AgentSessionTree<TKey extends string, TPayload extends Record<string, unknown>> {
    private readonly now: () => number;
    private readonly createNodeId: () => string;
    private readonly entries: Array<AgentSessionTreeEntry<TKey, TPayload>> = [];
    private activeNodeId: string | null = null;

    constructor(private readonly options: AgentSessionTreeOptions<TKey, TPayload>) {
        this.now = options.now ?? Date.now;
        this.createNodeId = options.createNodeId ?? (() => {
            if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
                return `agent_node_${crypto.randomUUID()}`;
            }
            return `agent_node_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
        });
        if (options.initialState?.entries) {
            this.entries.push(...options.initialState.entries.map(entry => this.cloneEntry(entry)));
            this.activeNodeId = options.initialState.activeNodeId;
        }
    }

    append(
        kind: TKey,
        title: string,
        summary: string,
        payload: TPayload,
        parentId: string | null = this.activeNodeId,
        createdAt = this.now()
    ): AgentSessionTreeNode<TKey, TPayload> {
        const entry: AgentSessionTreeEntry<TKey, TPayload> = {
            id: this.createNodeId(),
            sessionId: this.options.sessionId,
            parentId,
            kind,
            title,
            summary: String(summary || '').slice(0, 240),
            createdAt,
            payload: this.clonePayload(payload)
        };
        this.entries.push(entry);
        this.activeNodeId = entry.id;
        return this.toTreeNode(entry);
    }

    checkout(nodeId: string | null): void {
        if (nodeId !== null && !this.entries.some(entry => entry.id === nodeId)) {
            throw new Error(`Agent session node not found: ${nodeId}`);
        }
        this.activeNodeId = nodeId;
    }

    branchFromUserNode(
        userNodeId: string,
        options: AgentSessionBranchFromUserOptions<TKey, TPayload>
    ): AgentSessionBranchFromUserResult {
        const entry = this.entries.find(item => item.id === userNodeId);
        if (!entry) throw new Error(`Agent session user node not found: ${userNodeId}`);
        if (entry.kind !== options.userKind) {
            throw new Error(`Agent session branch target is not a user node: ${userNodeId}`);
        }
        this.activeNodeId = entry.parentId;
        return {
            activeNodeId: this.activeNodeId,
            input: options.extractInput(this.clonePayload(entry.payload)),
            userNodeId
        };
    }

    getActiveNodeId(): string | null {
        return this.activeNodeId;
    }

    getEntries(): Array<AgentSessionTreeEntry<TKey, TPayload>> {
        return this.entries.map(entry => this.cloneEntry(entry));
    }

    getBranch(nodeId: string | null = this.activeNodeId): Array<AgentSessionTreeEntry<TKey, TPayload>> {
        if (!nodeId) return [];
        const byId = new Map(this.entries.map(entry => [entry.id, entry]));
        const branch: Array<AgentSessionTreeEntry<TKey, TPayload>> = [];
        let current: AgentSessionTreeEntry<TKey, TPayload> | undefined = byId.get(nodeId);
        while (current) {
            branch.push(current);
            current = current.parentId ? byId.get(current.parentId) : undefined;
        }
        return branch.reverse().map(entry => this.cloneEntry(entry));
    }

    getBranchMessages(options: AgentSessionBranchMessageOptions<TKey, TPayload>): AgentMessage[] {
        const nodeId = options.nodeId === undefined ? this.activeNodeId : options.nodeId;
        const messages = this.getBranch(nodeId)
            .map(entry => options.extractMessage(this.clonePayload(entry.payload), entry))
            .filter((message): message is AgentMessage => Boolean(message));
        return this.trimMessages(messages, {
            maxMessages: options.maxMessages ?? 30,
            preserveToolPairs: options.preserveToolPairs ?? true
        });
    }

    getTree(): Array<AgentSessionTreeNode<TKey, TPayload>> {
        const byId = new Map<string, AgentSessionTreeNode<TKey, TPayload>>();
        const roots: Array<AgentSessionTreeNode<TKey, TPayload>> = [];
        for (const entry of this.entries) {
            byId.set(entry.id, this.toTreeNode(entry));
        }
        for (const node of byId.values()) {
            if (!node.parentId) {
                roots.push(node);
                continue;
            }
            const parent = byId.get(node.parentId);
            if (!parent) {
                roots.push(node);
                continue;
            }
            parent.children = [...parent.children, node];
        }
        return this.sortNodes(roots);
    }

    toPersistedState(): AgentSessionTreePersistedState<TKey, TPayload> {
        return {
            sessionId: this.options.sessionId,
            activeNodeId: this.activeNodeId,
            entries: this.getEntries(),
            version: 1
        };
    }

    private trimMessages(
        messages: AgentMessage[],
        options: { maxMessages: number; preserveToolPairs: boolean }
    ): AgentMessage[] {
        if (options.maxMessages <= 0 || messages.length <= options.maxMessages) return messages;
        let startIndex = Math.max(0, messages.length - options.maxMessages);
        if (options.preserveToolPairs) {
            while (startIndex > 0 && this.isToolResultMessage(messages[startIndex])) {
                startIndex -= 1;
            }
        }
        return messages.slice(startIndex);
    }

    private isToolResultMessage(message: AgentMessage): boolean {
        return message.role === 'toolResult';
    }

    private sortNodes(nodes: Array<AgentSessionTreeNode<TKey, TPayload>>): Array<AgentSessionTreeNode<TKey, TPayload>> {
        return [...nodes]
            .sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id))
            .map(node => ({
                ...node,
                payload: this.clonePayload(node.payload),
                children: this.sortNodes(node.children)
            }));
    }

    private cloneEntry(entry: AgentSessionTreeEntry<TKey, TPayload>): AgentSessionTreeEntry<TKey, TPayload> {
        return {
            ...entry,
            payload: this.clonePayload(entry.payload)
        };
    }

    private toTreeNode(entry: AgentSessionTreeEntry<TKey, TPayload>): AgentSessionTreeNode<TKey, TPayload> {
        return {
            ...entry,
            payload: this.clonePayload(entry.payload),
            children: []
        };
    }

    private clonePayload(payload: TPayload): TPayload {
        return { ...payload };
    }
}
