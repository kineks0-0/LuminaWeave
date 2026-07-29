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
    AgentRuntimeEventFilter,
    AgentRuntimeEventListener,
    AgentRuntimeSnapshot
} from '../../agent-runtime/events/AgentRuntimeEventBus.js';
import { AgentRuntime } from '../../agent-runtime/runtime/AgentRuntime.js';
import type {
    AgentRuntimeExtension,
    AgentRuntimeResourceDiscoveryInput,
    AgentRuntimeResourceDiscoveryResult
} from '../../agent-runtime/extensions/AgentRuntimeExtensionRunner.js';
import type {
    AgentRuntimeExtensionLoader,
    AgentRuntimeModelSelection,
    AgentRuntimeResourceScanner,
    AgentRuntimeToolEntry
} from '../../agent-runtime/runtime/AgentRuntimeTypes.js';
import type { AgentRuntimeModelProvider } from '../../agent-runtime/model/AgentRuntimeModelProvider.js';
import {
    ForgePiAgentSession,
    type ForgePiAgentSessionApprovalResult,
    type ForgePiAgentSessionDeps,
    type ForgePiAgentSessionPromptPreview
} from './session/ForgePiAgentSession.js';
import { createForgePiPresetExtensionRuntimeDeps } from './extensions/ForgePiPresetExtensionLoader.js';

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

export interface ForgePiCoreRuntimeDeps extends ForgePiAgentSessionDeps {
    model?: AgentRuntimeModelSelection;
    modelProvider?: AgentRuntimeModelProvider;
    tools?: AgentRuntimeToolEntry[];
    extensions?: AgentRuntimeExtension[];
    extensionLoader?: AgentRuntimeExtensionLoader;
    resourceScanner?: AgentRuntimeResourceScanner;
    workspace?: unknown;
    approvals?: unknown;
    permissions?: unknown;
}

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
    private readonly runtime: AgentRuntime<
        ForgePiCoreRuntimeTurnInput,
        ForgePiCoreRuntimeTurnResult,
        ForgePiCoreRuntimePromptPreview,
        ForgePiCoreRuntimeApprovalResult
    >;

    constructor(private readonly deps: ForgePiCoreRuntimeDeps = {}) {
        const presetExtensionRuntimeDeps = createForgePiPresetExtensionRuntimeDeps();
        // Forge 只把通用生命周期托管给 SDK façade；Forge 专属 session、VFS、工具和发布边界仍留在 adapter 内。
        this.runtime = new AgentRuntime({
            id: 'forge-pi-core-runtime',
            model: deps.model,
            modelProvider: deps.modelProvider,
            tools: deps.tools,
            extensions: deps.extensions,
            extensionLoader: deps.extensionLoader ?? presetExtensionRuntimeDeps.extensionLoader,
            resourceScanner: deps.resourceScanner ?? presetExtensionRuntimeDeps.resourceScanner,
            workspace: deps.workspace,
            approvals: deps.approvals,
            permissions: deps.permissions,
            resolveSessionId: input => this.resolveSessionId(input.context),
            createSession: input => {
                const session = this.getSession(input.firstInput.context);
                session.setAgentRuntimeEvents(input.events);
                if (input.tools) {
                    session.setAgentRuntimeExtensionContext({
                        runner: input.extensionRunner ?? null,
                        tools: input.tools
                    });
                }
                return {
                    runTurn: turnInput => session.prompt(turnInput),
                    previewPrompt: turnInput => session.preparePrompt(turnInput),
                    continue: () => session.continue(),
                    resolveToolApproval: (turnId, toolCallId, approved, message, options) => {
                        if (options === undefined) {
                            return session.resolveToolApproval(turnId, toolCallId, approved, message);
                        }
                        return session.resolveToolApproval(
                            turnId,
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
        return this.runtime.runTurn(input);
    }

    async previewPrompt(input: ForgePiCoreRuntimeTurnInput): Promise<ForgePiCoreRuntimePromptPreview> {
        return this.runtime.previewPrompt(input);
    }

    async discoverResources(
        input: AgentRuntimeResourceDiscoveryInput
    ): Promise<AgentRuntimeResourceDiscoveryResult> {
        return this.runtime.discoverResources(input);
    }

    async continue(sessionId: string): Promise<void> {
        await this.runtime.continue(sessionId);
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
        sessionId: string,
        turnId: string,
        toolCallId: string,
        approved: boolean,
        message?: string,
        options?: ForgeToolApprovalResolutionOptions
    ): Promise<ForgePiCoreRuntimeApprovalResult> {
        return await this.runtime.resolveToolApproval(
            sessionId,
            turnId,
            toolCallId,
            approved,
            message,
            options
        ) ?? { resolved: false, events: [], effects: [] };
    }

    abortActiveGeneration(): void {
        this.runtime.abortActiveGeneration();
    }

    subscribeToAgentRuntimeEvents(
        filter: AgentRuntimeEventFilter,
        listener: AgentRuntimeEventListener
    ): () => void {
        return this.runtime.events.subscribe(filter, listener);
    }

    getAgentRuntimeSnapshot(sessionId: string): AgentRuntimeSnapshot {
        return this.runtime.getSnapshot(sessionId);
    }

    getAgentRuntimeEvents(filter: AgentRuntimeEventFilter = {}): AgentRuntimeEvent[] {
        return this.runtime.events.getEvents(filter);
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
