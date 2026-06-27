export type ForgePiRuntimeEventType =
    | 'session_created'
    | 'session_info'
    | 'metadata'
    | 'context_bundle'
    | 'user'
    | 'process'
    | 'assistant'
    | 'tool_call'
    | 'tool_result'
    | 'approval_needed'
    | 'approval_resolved'
    | 'staging_proposal'
    | 'branch_summary'
    | 'label'
    | 'checkout';

export type ForgePiTurnCommand = 'conversation' | 'planner' | 'analyst' | 'executor' | 'review' | 'export_prepare';

export interface ForgePiContextFile {
    path: string;
    title: string;
    content: string;
}

export interface ForgePiContextBundleSummary {
    files: ForgePiContextFile[];
    activeSkills: string[];
    loadedExtensions: string[];
}

export interface ForgePiTreeNode {
    id: string;
    sessionId: string;
    parentId: string | null;
    kind: ForgePiRuntimeEventType;
    title: string;
    summary: string;
    createdAt: number;
    payload: unknown;
    children?: ForgePiTreeNode[];
}

export interface ForgePiMessagePayload {
    role: 'user' | 'process' | 'assistant' | 'system' | 'toolResult';
    text?: string;
    agentMessage?: unknown;
}

export interface ForgePiContextBundlePayload {
    contextBundle: ForgePiContextBundleSummary;
}

export interface ForgePiToolCallPayload {
    requestId?: string;
    toolCallId: string;
    toolName: string;
    args: unknown;
}

export interface ForgePiToolResultPayload {
    requestId?: string;
    toolCallId: string;
    toolName: string;
    result: unknown;
    isError?: boolean;
    agentMessage?: unknown;
}

export interface ForgePiApprovalPayload {
    approvalId?: string | null;
    toolCallId: string;
    toolName: string;
    approved?: boolean;
    reason?: string;
    message?: string | null;
    args?: unknown;
    approvalKind?: 'network' | 'tool';
    displaySurface?: 'composer' | 'review';
    shellPermissionRequestId?: string | null;
    forgeProjectId?: string | null;
    conversationId?: string | null;
    sessionId?: string | null;
}

export interface ForgePiStagingProposalPayload {
    targetEntryId: string;
    title: string;
    content: string;
    originalContent?: string;
    sourceToolCallId?: string | null;
}

export interface ForgeWorkspaceChangedFile {
    path: string;
    workspacePath?: string;
    kind: 'create' | 'update' | 'delete';
    beforeHash: string | null;
    afterHash: string | null;
}

export interface ForgeTurnWorkspaceWriteSummary {
    turnId?: string;
    sourceToolCallId: string;
    changedFiles: ForgeWorkspaceChangedFile[];
    writeCount: number;
    errors: Array<{
        path: string;
        error: string;
    }>;
    gitCommitHash?: string | null;
    gitParentHash?: string | null;
}

export interface ForgePiBranchSummaryPayload {
    branchRootNodeId: string | null;
    activeNodeId: string | null;
    title: string;
    summary: string;
}

export interface ForgePiLabelPayload {
    label: string;
    color?: string | null;
}

export type ForgePiSessionEntryPayload =
    | ForgePiMessagePayload
    | ForgePiContextBundlePayload
    | ForgePiToolCallPayload
    | ForgePiToolResultPayload
    | ForgePiApprovalPayload
    | ForgePiStagingProposalPayload
    | ForgePiBranchSummaryPayload
    | ForgePiLabelPayload
    | Record<string, unknown>;

export interface ForgePiSessionEntry {
    id: string;
    sessionId: string;
    parentId: string | null;
    kind: ForgePiRuntimeEventType;
    title: string;
    summary: string;
    createdAt: number;
    payload: ForgePiSessionEntryPayload;
}

export interface ForgePiPersistedSessionState {
    sessionId: string;
    activeNodeId: string | null;
    entries: ForgePiSessionEntry[];
    contextBundleSummary?: ForgePiContextBundleSummary | null;
    loadedExtensions?: string[];
    version: 1;
}

export interface ForgeTimelinePiOrigin {
    runtime: 'forge-pi';
    sessionId: string;
    nodeId: string;
    parentNodeId: string | null;
    entryType: ForgePiRuntimeEventType;
    toolCallId?: string;
}

export interface ForgePiBranchFromUserResult {
    activeNodeId: string | null;
    input: string;
    userNodeId: string;
}

export interface ForgePiSessionRef {
    sessionId: string;
    forgeProjectId: string;
    conversationId: string;
    workspacePath: string;
    sessionPath: string;
    activeNodeId: string | null;
    createdAt: number;
    updatedAt: number;
}

export interface ForgePiCreateSessionRequest {
    forgeProjectId: string;
    conversationId: string;
    workspacePath: string;
}

export interface ForgePiSessionResponse {
    session: ForgePiSessionRef;
    tree: ForgePiTreeNode[];
    contextBundle?: ForgePiContextBundleSummary | null;
}

export interface ForgePiTurnRequest {
    input: string;
    command: ForgePiTurnCommand;
    parentNodeId?: string | null;
    contextBundle?: ForgePiContextBundleSummary;
}

export interface ForgePiRuntimeEvent {
    id: string;
    sessionId: string;
    type: ForgePiRuntimeEventType;
    nodeId: string;
    parentId: string | null;
    createdAt: number;
    payload: unknown;
}

export interface ForgePiTurnResponse {
    session: ForgePiSessionRef;
    tree: ForgePiTreeNode[];
    events: ForgePiRuntimeEvent[];
}

export interface ForgePiApprovalRequest {
    approved: boolean;
    message?: string | null;
}

export interface ForgePiApprovalResponse {
    session: ForgePiSessionRef;
    tree: ForgePiTreeNode[];
    event: ForgePiRuntimeEvent & {
        type: 'approval_resolved';
        toolCallId: string;
        approved: boolean;
    };
}

export interface ForgePiCheckoutRequest {
    nodeId: string;
}
