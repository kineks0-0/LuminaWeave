import type {
    ForgePiContextBundleSummary,
    ForgePiSessionEntry,
    ForgePiTurnResponse
} from '@shared/ForgePiTypes.js';
import type {
    AgentRuntimeEvent,
    AgentRuntimeEventFilter,
    AgentRuntimeEventListener,
    AgentRuntimeSnapshot
} from '../../agent-runtime/events/AgentRuntimeEventBus.js';
import type {
    ForgeExecutionRequest,
    ForgeRuntimeContext,
    ForgeRuntimeEvent as ForgeRuntimeEventType,
    ForgeUserCommand,
    ForgeToolApprovalResolutionOptions
} from '../../../../types/ForgeRuntimeTypes.js';
import {
    forgePiCoreRuntime,
    type ForgePiCoreRuntime,
    type ForgePiCoreRuntimeApprovalResult,
    type ForgePiCoreRuntimeBranchFromUserResult,
    type ForgePiCoreRuntimePromptPreview,
    type ForgePiCoreRuntimeSessionStateResult,
    type ForgePiCoreRuntimeTurnResult
} from '../agent-app/ForgePiCoreRuntime.js';

export interface ForgePiRuntimeClientDeps {
    runtime?: ForgePiCoreRuntime;
}

export interface ForgePiRuntimeClientTurnInput {
    command: ForgeUserCommand;
    commandInput?: string;
    context: ForgeRuntimeContext;
    request: ForgeExecutionRequest;
    onRuntimeEvent?: (event: ForgeRuntimeEventType) => void;
}

export interface ForgePiRuntimeClientTurnResult {
    events: ForgeRuntimeEventType[];
    effects?: ForgePiCoreRuntimeTurnResult['effects'];
    piSessionState: {
        tree: ForgePiTurnResponse['tree'];
        entries: ForgePiSessionEntry[];
        activeNodeId: string | null;
        contextBundleSummary: ForgePiContextBundleSummary;
        loadedExtensions: string[];
    };
}

export interface ForgePiRuntimeClientApprovalResult extends ForgePiCoreRuntimeApprovalResult {}

export interface ForgePiRuntimeClientPromptPreview extends ForgePiCoreRuntimePromptPreview {}
export interface ForgePiRuntimeClientSessionStateResult extends ForgePiCoreRuntimeSessionStateResult {}
export interface ForgePiRuntimeClientBranchFromUserResult extends ForgePiCoreRuntimeBranchFromUserResult {}

export class ForgePiRuntimeClient {
    private readonly runtime: ForgePiCoreRuntime;

    constructor(deps: ForgePiRuntimeClientDeps = {}) {
        this.runtime = deps.runtime ?? forgePiCoreRuntime;
    }

    async runTurn(input: ForgePiRuntimeClientTurnInput): Promise<ForgePiRuntimeClientTurnResult> {
        const result = await this.runtime.runTurn(input);
        return {
            events: result.events,
            effects: result.effects,
            piSessionState: {
                tree: result.piSessionState.tree,
                entries: result.piSessionState.entries,
                activeNodeId: result.piSessionState.activeNodeId,
                contextBundleSummary: result.piSessionState.contextBundleSummary,
                loadedExtensions: result.piSessionState.loadedExtensions
            }
        };
    }

    async previewPrompt(input: ForgePiRuntimeClientTurnInput): Promise<ForgePiRuntimeClientPromptPreview> {
        return this.runtime.previewPrompt(input);
    }

    async resolveToolApproval(
        sessionId: string,
        turnId: string,
        toolCallId: string,
        approved: boolean,
        message?: string,
        options?: ForgeToolApprovalResolutionOptions
    ): Promise<ForgePiRuntimeClientApprovalResult> {
        return options === undefined
            ? this.runtime.resolveToolApproval(sessionId, turnId, toolCallId, approved, message)
            : this.runtime.resolveToolApproval(sessionId, turnId, toolCallId, approved, message, options);
    }

    subscribeToAgentRuntimeEvents(
        filter: AgentRuntimeEventFilter,
        listener: AgentRuntimeEventListener
    ): () => void {
        return this.runtime.subscribeToAgentRuntimeEvents(filter, listener);
    }

    getAgentRuntimeSnapshot(sessionId: string): AgentRuntimeSnapshot {
        return this.runtime.getAgentRuntimeSnapshot(sessionId);
    }

    getAgentRuntimeEvents(filter: AgentRuntimeEventFilter = {}): AgentRuntimeEvent[] {
        return this.runtime.getAgentRuntimeEvents(filter);
    }

    checkout(input: {
        context: ForgeRuntimeContext;
        nodeId: string | null;
    }): ForgePiRuntimeClientSessionStateResult {
        return this.runtime.checkout(input);
    }

    branchFromUserNode(input: {
        context: ForgeRuntimeContext;
        userNodeId: string;
    }): ForgePiRuntimeClientBranchFromUserResult {
        return this.runtime.branchFromUserNode(input);
    }
}

export const forgePiRuntimeClient = new ForgePiRuntimeClient();
