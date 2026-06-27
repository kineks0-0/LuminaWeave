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
    ForgeUserCommand,
    ForgeToolApprovalResolutionOptions
} from '../../../../types/ForgeRuntimeTypes.js';
import type {
    AgentRuntimeEvent,
    AgentRuntimeSnapshot
} from '../../agent-runtime/events/AgentRuntimeEventBus.js';
import { AgentRuntimeCore } from '../../agent-runtime/runtime/AgentRuntimeCore.js';
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
    onRuntimeEvent?: (event: ForgeRuntimeEvent) => void;
}

export interface ForgePiCoreRuntimeTurnResult {
    events: ForgeRuntimeEvent[];
    effects: ForgeRuntimeEffect[];
    agentRuntimeSnapshot?: AgentRuntimeSnapshot;
    piSessionState: {
        tree: ForgePiTreeNode[];
        entries: ForgePiSessionEntry[];
        activeNodeId: string | null;
        contextBundleSummary: ForgePiContextBundleSummary;
        loadedExtensions: string[];
    };
}

export interface ForgePiCoreRuntimeApprovalResult extends ForgePiAgentSessionApprovalResult {
    agentRuntimeSnapshot?: AgentRuntimeSnapshot;
}

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
    private readonly core: AgentRuntimeCore<
        ForgePiCoreRuntimeTurnInput,
        ForgePiCoreRuntimeTurnResult,
        ForgePiCoreRuntimePromptPreview,
        ForgePiCoreRuntimeApprovalResult
    >;

    constructor(private readonly deps: ForgePiCoreRuntimeDeps = {}) {
        this.core = new AgentRuntimeCore({
            resolveSessionId: input => this.resolveSessionId(input.context),
            createSession: input => {
                const session = this.getSession(input.firstInput.context);
                session.setAgentRuntimeEvents(input.events);
                return {
                    runTurn: turnInput => session.prompt(turnInput),
                    previewPrompt: turnInput => session.preparePrompt(turnInput),
                    continue: () => session.continue(),
                    resolveToolApproval: (toolCallId, approved, message, options) => {
                        if (options === undefined) {
                            return session.resolveToolApproval(toolCallId, approved, message);
                        }
                        return session.resolveToolApproval(
                            toolCallId,
                            approved,
                            message,
                            options as ForgeToolApprovalResolutionOptions
                        );
                    },
                    abort: () => session.abort()
                };
            }
        });
    }

    async runTurn(input: ForgePiCoreRuntimeTurnInput): Promise<ForgePiCoreRuntimeTurnResult> {
        const result = await this.core.runTurn(input);
        return {
            ...result,
            agentRuntimeSnapshot: this.getAgentRuntimeSnapshot()
        };
    }

    async previewPrompt(input: ForgePiCoreRuntimeTurnInput): Promise<ForgePiCoreRuntimePromptPreview> {
        return this.core.previewPrompt(input);
    }

    async continue(sessionId: string): Promise<void> {
        await this.core.continue(sessionId);
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

    async resolveToolApproval(
        toolCallId: string,
        approved: boolean,
        message?: string,
        options?: ForgeToolApprovalResolutionOptions
    ): Promise<ForgePiCoreRuntimeApprovalResult> {
        const result = await this.core.resolveToolApproval(toolCallId, approved, message, options)
            ?? { resolved: false, events: [], effects: [] };
        return {
            ...result,
            agentRuntimeSnapshot: this.getAgentRuntimeSnapshot()
        };
    }

    abortActiveGeneration(): void {
        this.core.abortActiveGeneration();
    }

    getAgentRuntimeSnapshot(): AgentRuntimeSnapshot {
        return this.core.events.getSnapshot();
    }

    getAgentRuntimeEvents(): AgentRuntimeEvent[] {
        return this.core.events.getEvents();
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
