import type {
    ForgePiContextBundleSummary,
    ForgePiSessionEntry,
    ForgePiTreeNode
} from '@shared/ForgePiTypes.js';
import type {
    ForgeExecutionRequest,
    ForgeRuntimeContext,
    ForgeRuntimeEffect,
    ForgeRuntimeEvent,
    ForgeUserCommand
} from '../../../../types/ForgeRuntimeTypes.js';
import {
    ForgePiAgentSession,
    type ForgePiAgentSessionApprovalResult,
    type ForgePiAgentSessionDeps,
    type ForgePiAgentSessionPromptPreview
} from './session/ForgePiAgentSession.js';

export interface ForgePiCoreRuntimeTurnInput {
    command: ForgeUserCommand;
    commandInput?: string;
    context: ForgeRuntimeContext;
    request: ForgeExecutionRequest;
}

export interface ForgePiCoreRuntimeTurnResult {
    events: ForgeRuntimeEvent[];
    effects: ForgeRuntimeEffect[];
    piSessionState: {
        tree: ForgePiTreeNode[];
        entries: ForgePiSessionEntry[];
        activeNodeId: string | null;
        contextBundleSummary: ForgePiContextBundleSummary;
        loadedExtensions: string[];
    };
}

export interface ForgePiCoreRuntimeApprovalResult extends ForgePiAgentSessionApprovalResult {}

export interface ForgePiCoreRuntimePromptPreview extends ForgePiAgentSessionPromptPreview {}

export interface ForgePiCoreRuntimeDeps extends ForgePiAgentSessionDeps {}

export interface ForgePiCoreRuntimeSessionStateResult {
    piSessionState: {
        tree: ForgePiTreeNode[];
        entries: ForgePiSessionEntry[];
        activeNodeId: string | null;
        contextBundleSummary?: ForgePiContextBundleSummary | null;
        loadedExtensions?: string[];
    };
}

export interface ForgePiCoreRuntimeBranchFromUserResult extends ForgePiCoreRuntimeSessionStateResult {
    input: string;
    userNodeId: string;
}

export class ForgePiCoreRuntime {
    private readonly sessions = new Map<string, ForgePiAgentSession>();

    constructor(private readonly deps: ForgePiCoreRuntimeDeps = {}) {}

    async runTurn(input: ForgePiCoreRuntimeTurnInput): Promise<ForgePiCoreRuntimeTurnResult> {
        return this.getSession(input.context).prompt(input);
    }

    async previewPrompt(input: ForgePiCoreRuntimeTurnInput): Promise<ForgePiCoreRuntimePromptPreview> {
        return this.getSession(input.context).preparePrompt(input);
    }

    async continue(sessionId: string): Promise<void> {
        await this.sessions.get(sessionId)?.continue();
    }

    checkout(input: {
        context: ForgeRuntimeContext;
        nodeId: string | null;
    }): ForgePiCoreRuntimeSessionStateResult {
        const snapshot = this.getSession(input.context).checkout(input.nodeId);
        return { piSessionState: snapshot };
    }

    branchFromUserNode(input: {
        context: ForgeRuntimeContext;
        userNodeId: string;
    }): ForgePiCoreRuntimeBranchFromUserResult {
        const result = this.getSession(input.context).branchFromUserNode(input.userNodeId);
        return {
            input: result.input,
            userNodeId: result.userNodeId,
            piSessionState: result.piSessionState
        };
    }

    async resolveToolApproval(toolCallId: string, approved: boolean, message?: string): Promise<ForgePiCoreRuntimeApprovalResult> {
        for (const session of this.sessions.values()) {
            const resolved = await session.resolveToolApproval(toolCallId, approved, message);
            if (resolved.resolved) return resolved;
        }
        return { resolved: false, events: [], effects: [] };
    }

    abortActiveGeneration(): void {
        for (const session of this.sessions.values()) {
            session.abort();
        }
    }

    private getSession(context: ForgeRuntimeContext): ForgePiAgentSession {
        const sessionId = this.resolveSessionId(context);
        const existing = this.sessions.get(sessionId);
        if (existing) return existing;
        const created = new ForgePiAgentSession(sessionId, {
            forgeProjectId: context.workspaceSessionId,
            conversationId: context.sessionChatId,
            workspaceTitle: context.workspaceTitle
        }, {
            ...this.deps,
            initialState: context.piSession ?? this.deps.initialState ?? null
        });
        this.sessions.set(sessionId, created);
        return created;
    }

    private resolveSessionId(context: ForgeRuntimeContext): string {
        return `${context.workspaceSessionId}__${context.sessionChatId}`;
    }
}

export const forgePiCoreRuntime = new ForgePiCoreRuntime();
