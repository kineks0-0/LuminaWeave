import type {
    ForgePiContextBundleSummary,
    ForgePiBranchFromUserResult,
    ForgePiPersistedSessionState,
    ForgePiRuntimeEventType,
    ForgePiSessionEntry,
    ForgePiSessionEntryPayload as SharedForgePiSessionEntryPayload,
    ForgePiTreeNode
} from '@shared/ForgePiTypes.js';
import type { AgentMessage } from '@earendil-works/pi-agent-core';

export interface ForgePiSessionMetadata {
    sessionId: string;
    forgeProjectId: string;
    conversationId: string;
    workspaceTitle: string;
}

export type ForgePiSessionEntryPayload = SharedForgePiSessionEntryPayload & {
    agentMessage?: AgentMessage;
    contextBundle?: ForgePiContextBundleSummary;
    text?: string;
    [key: string]: unknown;
};

export interface ForgePiSessionSnapshot {
    tree: ForgePiTreeNode[];
    entries: ForgePiSessionEntry[];
    activeNodeId: string | null;
    contextBundleSummary?: ForgePiContextBundleSummary | null;
    loadedExtensions?: string[];
}

export interface ForgePiSessionManagerDeps {
    now?: () => number;
    createNodeId?: () => string;
    initialState?: ForgePiPersistedSessionState | null;
}

export class ForgePiSessionManager {
    private readonly now: () => number;
    private readonly createNodeId: () => string;
    private readonly entries: ForgePiSessionEntry[] = [];
    private activeNodeId: string | null = null;
    private latestContextBundle: ForgePiContextBundleSummary | null = null;

    constructor(
        private readonly metadata: ForgePiSessionMetadata,
        deps: ForgePiSessionManagerDeps = {}
    ) {
        this.now = deps.now ?? Date.now;
        this.createNodeId = deps.createNodeId ?? (() => {
            if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
                return `pi_node_${crypto.randomUUID()}`;
            }
            return `pi_node_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
        });
        if (deps.initialState?.entries) {
            this.entries.push(...deps.initialState.entries.map(entry => this.cloneEntry(entry)));
            this.activeNodeId = deps.initialState.activeNodeId;
            this.latestContextBundle = deps.initialState.contextBundleSummary ?? this.findLatestContextBundle();
        }
    }

    ensureMetadata(): void {
        if (this.entries.some(entry => entry.kind === 'metadata')) return;
        this.append('metadata', 'Forge pi session', this.metadata.workspaceTitle, {
            forgeProjectId: this.metadata.forgeProjectId,
            conversationId: this.metadata.conversationId
        }, null);
    }

    append(
        kind: ForgePiRuntimeEventType,
        title: string,
        summary: string,
        payload: ForgePiSessionEntryPayload | unknown,
        parentId: string | null = this.activeNodeId,
        createdAt = this.now()
    ): ForgePiTreeNode {
        const entry: ForgePiSessionEntry = {
            id: this.createNodeId(),
            sessionId: this.metadata.sessionId,
            parentId,
            kind,
            title,
            summary: String(summary || '').slice(0, 240),
            createdAt,
            payload: this.clonePayload(payload)
        };
        this.entries.push(entry);
        this.activeNodeId = entry.id;
        if (kind === 'context_bundle') {
            this.latestContextBundle = this.extractContextBundle(entry.payload);
        }
        return this.toTreeNode(entry);
    }

    checkout(nodeId: string | null): void {
        if (nodeId !== null && !this.entries.some(entry => entry.id === nodeId)) {
            throw new Error(`Forge pi session node not found: ${nodeId}`);
        }
        this.activeNodeId = nodeId;
    }

    createBranchFromUserNode(userNodeId: string): ForgePiBranchFromUserResult {
        const userEntry = this.entries.find(entry => entry.id === userNodeId);
        if (!userEntry) {
            throw new Error(`Forge pi session user node not found: ${userNodeId}`);
        }
        if (userEntry.kind !== 'user') {
            throw new Error(`Forge pi session branch target is not a user node: ${userNodeId}`);
        }
        this.activeNodeId = userEntry.parentId;
        return {
            activeNodeId: this.activeNodeId,
            input: this.extractPayloadText(userEntry.payload),
            userNodeId
        };
    }

    getActiveNodeId(): string | null {
        return this.activeNodeId;
    }

    getBranchMessages(nodeId: string | null = this.activeNodeId): AgentMessage[] {
        const branch = this.getBranch(nodeId);
        return branch
            .map(entry => this.extractAgentMessage(entry.payload))
            .filter((message): message is AgentMessage => Boolean(message));
    }

    getSnapshot(): ForgePiSessionSnapshot {
        return {
            tree: this.entries.map(entry => this.toTreeNode(entry)),
            entries: this.entries.map(entry => this.cloneEntry(entry)),
            activeNodeId: this.activeNodeId,
            contextBundleSummary: this.latestContextBundle,
            loadedExtensions: this.latestContextBundle?.loadedExtensions ?? []
        };
    }

    getEntries(): ForgePiSessionEntry[] {
        return this.entries.map(entry => this.cloneEntry(entry));
    }

    getBranch(nodeId: string | null): ForgePiSessionEntry[] {
        if (!nodeId) return [];
        const byId = new Map(this.entries.map(entry => [entry.id, entry]));
        const branch: ForgePiSessionEntry[] = [];
        let current: ForgePiSessionEntry | undefined = byId.get(nodeId);
        while (current) {
            branch.push(current);
            current = current.parentId ? byId.get(current.parentId) : undefined;
        }
        return branch.reverse();
    }

    getTree(): ForgePiTreeNode[] {
        const byId = new Map<string, ForgePiTreeNode>();
        const roots: ForgePiTreeNode[] = [];
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
            parent.children = [...(parent.children ?? []), node];
        }
        const sortNodes = (nodes: ForgePiTreeNode[]): ForgePiTreeNode[] => nodes
            .sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id))
            .map(node => ({
                ...node,
                children: node.children ? sortNodes(node.children) : []
            }));
        return sortNodes(roots);
    }

    toPersistedState(): ForgePiPersistedSessionState {
        const snapshot = this.getSnapshot();
        return {
            sessionId: this.metadata.sessionId,
            activeNodeId: snapshot.activeNodeId,
            entries: snapshot.entries,
            contextBundleSummary: snapshot.contextBundleSummary ?? null,
            loadedExtensions: snapshot.loadedExtensions ?? [],
            version: 1
        };
    }

    private cloneEntry(entry: ForgePiSessionEntry): ForgePiSessionEntry {
        return {
            ...entry,
            payload: this.clonePayload(entry.payload)
        };
    }

    private clonePayload(payload: unknown): ForgePiSessionEntryPayload {
        if (!this.isRecord(payload)) return {};
        return { ...payload } as ForgePiSessionEntryPayload;
    }

    private toTreeNode(entry: ForgePiSessionEntry): ForgePiTreeNode {
        return {
            ...entry,
            payload: this.clonePayload(entry.payload),
            children: []
        };
    }

    private findLatestContextBundle(): ForgePiContextBundleSummary | null {
        for (const entry of [...this.entries].reverse()) {
            if (entry.kind !== 'context_bundle') continue;
            const bundle = this.extractContextBundle(entry.payload);
            if (bundle) return bundle;
        }
        return null;
    }

    private extractContextBundle(payload: unknown): ForgePiContextBundleSummary | null {
        if (!this.isRecord(payload)) return null;
        if (this.isContextBundle(payload.contextBundle)) return payload.contextBundle;
        if (this.isContextBundle(payload)) return payload;
        return null;
    }

    private isContextBundle(value: unknown): value is ForgePiContextBundleSummary {
        if (!this.isRecord(value)) return false;
        return Array.isArray(value.files) && Array.isArray(value.activeSkills) && Array.isArray(value.loadedExtensions);
    }

    private extractAgentMessage(payload: unknown): AgentMessage | null {
        if (!this.isRecord(payload)) return null;
        return this.isAgentMessage(payload.agentMessage) ? payload.agentMessage : null;
    }

    private isAgentMessage(value: unknown): value is AgentMessage {
        if (!this.isRecord(value)) return false;
        return typeof value.role === 'string';
    }

    private extractPayloadText(payload: unknown): string {
        if (!this.isRecord(payload)) return '';
        if (typeof payload.text === 'string') return payload.text;
        const agentMessage = this.extractAgentMessage(payload);
        if (!agentMessage) return '';
        if (agentMessage.role === 'user' && typeof agentMessage.content === 'string') return agentMessage.content;
        if (agentMessage.role !== 'assistant' || !Array.isArray(agentMessage.content)) return '';
        return agentMessage.content
            .filter((part): part is { type: 'text'; text: string } =>
                this.isRecord(part) && part.type === 'text' && typeof part.text === 'string'
            )
            .map(part => part.text)
            .join('');
    }

    private isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === 'object' && value !== null;
    }
}
