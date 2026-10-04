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
import { AgentSessionTree } from '../../../agent-runtime/session/AgentSessionTree.js';
import {
    sanitizeForgePiAgentMessageForReplay,
    type ForgePiReplayTarget
} from './ForgePiMessageSanitizer.js';

export interface ForgePiSessionMetadata {
    sessionId: string;
    forgeProjectId: string;
    conversationId: string;
    workspaceTitle: string;
}

export type ForgePiSessionManagerEntryPayload = SharedForgePiSessionEntryPayload & {
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

export interface ForgePiBranchMessageOptions extends ForgePiReplayTarget {
    nodeId?: string | null;
    maxMessages?: number;
    preserveToolPairs?: boolean;
}

export class ForgePiSessionManager {
    private readonly tree: AgentSessionTree<ForgePiRuntimeEventType, Record<string, unknown>>;
    private latestContextBundle: ForgePiContextBundleSummary | null = null;

    constructor(
        private readonly metadata: ForgePiSessionMetadata,
        deps: ForgePiSessionManagerDeps = {}
    ) {
        this.tree = new AgentSessionTree({
            sessionId: metadata.sessionId,
            now: deps.now,
            createNodeId: deps.createNodeId,
            initialState: deps.initialState
                ? {
                    sessionId: deps.initialState.sessionId,
                    activeNodeId: deps.initialState.activeNodeId,
                    entries: deps.initialState.entries.map(entry => ({
                        ...entry,
                        payload: this.clonePayload(entry.payload)
                    })),
                    version: 1
                }
                : null
        });
        this.latestContextBundle = deps.initialState?.contextBundleSummary ?? this.findLatestContextBundle();
    }

    ensureMetadata(): void {
        if (this.getEntries().some(entry => entry.kind === 'metadata')) return;
        this.append('metadata', 'Forge pi session', this.metadata.workspaceTitle, {
            forgeProjectId: this.metadata.forgeProjectId,
            conversationId: this.metadata.conversationId
        }, null);
    }

    append(
        kind: ForgePiRuntimeEventType,
        title: string,
        summary: string,
        payload: ForgePiSessionManagerEntryPayload | unknown,
        parentId: string | null = this.tree.getActiveNodeId(),
        createdAt?: number
    ): ForgePiTreeNode {
        const node = this.tree.append(
            kind,
            title,
            summary,
            this.clonePayload(payload),
            parentId,
            createdAt
        );
        if (kind === 'context_bundle') {
            this.latestContextBundle = this.extractContextBundle(node.payload);
        }
        return node as ForgePiTreeNode;
    }

    checkout(nodeId: string | null): void {
        this.tree.checkout(nodeId);
    }

    createBranchFromUserNode(userNodeId: string): ForgePiBranchFromUserResult {
        return this.tree.branchFromUserNode(userNodeId, {
            userKind: 'user',
            extractInput: payload => this.extractPayloadText(payload)
        });
    }

    getActiveNodeId(): string | null {
        return this.tree.getActiveNodeId();
    }

    getBranchMessages(input: string | null | ForgePiBranchMessageOptions = this.getActiveNodeId()): AgentMessage[] {
        const options: ForgePiBranchMessageOptions = typeof input === 'object' && input !== null
            ? input
            : { nodeId: input };
        const nodeId = options.nodeId === undefined ? this.getActiveNodeId() : options.nodeId;
        return this.tree.getBranchMessages({
            nodeId,
            maxMessages: options.maxMessages ?? 30,
            preserveToolPairs: options.preserveToolPairs ?? true,
            extractMessage: payload => this.extractAgentMessage(payload, options)
        });
    }

    getSnapshot(): ForgePiSessionSnapshot {
        return {
            tree: this.getFlatTreeNodes(),
            entries: this.getEntries(),
            activeNodeId: this.getActiveNodeId(),
            contextBundleSummary: this.latestContextBundle,
            loadedExtensions: this.latestContextBundle?.loadedExtensions ?? []
        };
    }

    getEntries(): ForgePiSessionEntry[] {
        return this.tree.getEntries().map(entry => this.cloneEntry(entry as ForgePiSessionEntry));
    }

    getBranch(nodeId: string | null): ForgePiSessionEntry[] {
        return this.tree.getBranch(nodeId).map(entry => this.cloneEntry(entry as ForgePiSessionEntry));
    }

    getTree(): ForgePiTreeNode[] {
        return this.tree.getTree() as ForgePiTreeNode[];
    }

    private getFlatTreeNodes(): ForgePiTreeNode[] {
        return this.getEntries().map(entry => ({
            ...entry,
            payload: this.clonePayload(entry.payload),
            children: []
        }));
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

    private clonePayload(payload: unknown): ForgePiSessionManagerEntryPayload {
        if (!this.isRecord(payload)) return {};
        return { ...payload } as ForgePiSessionManagerEntryPayload;
    }

    private toTreeNode(entry: ForgePiSessionEntry): ForgePiTreeNode {
        return {
            ...entry,
            payload: this.clonePayload(entry.payload),
            children: []
        };
    }

    private findLatestContextBundle(): ForgePiContextBundleSummary | null {
        for (const entry of [...this.getEntries()].reverse()) {
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

    private extractAgentMessage(payload: unknown, target: ForgePiReplayTarget = {}): AgentMessage | null {
        if (!this.isRecord(payload)) return null;
        const message = this.isAgentMessage(payload.replayAgentMessage)
            ? payload.replayAgentMessage
            : this.isAgentMessage(payload.agentMessage)
                ? payload.agentMessage
                : null;
        return message ? sanitizeForgePiAgentMessageForReplay(message, target) : null;
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
