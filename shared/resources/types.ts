export type RuntimeHostKind = 'st-plugin' | 'standalone-web' | 'desktop-native';

export type ResourceSourceKind = 'st' | 'lumina-local' | 'subscription';

export type ResourceType = 'character' | 'worldbook' | 'preset' | 'regex' | 'memory';

export type ResourceOrigin = ResourceSourceKind | 'import' | 'unknown';

export interface ResourceRef {
    sourceId: string;
    resourceType: ResourceType;
    resourceId: string;
    revision?: string | number | null;
    path: string;
    writable: boolean;
    origin?: ResourceOrigin;
    forkedFrom?: ResourceRef | null;
}

export interface ResourceDiagnostic {
    level: 'info' | 'warning' | 'error';
    code: string;
    message: string;
}

export interface ResourceCapabilities {
    readable: boolean;
    writable: boolean;
    forkable: boolean;
    importable: boolean;
    exportable: boolean;
    searchable: boolean;
}

export interface ResourceSummary {
    id: string;
    type: ResourceType;
    name: string;
    description?: string;
    enabled?: boolean;
    entryCount?: number;
    keywords?: string[];
    updatedAt?: string | number | null;
    format: string;
}

export interface ResourceDocument<TPayload = unknown> {
    ref: ResourceRef;
    raw: TPayload;
    summary: ResourceSummary;
    capabilities: ResourceCapabilities;
    diagnostics?: ResourceDiagnostic[];
}

export interface PromptHistorySourceSelection {
    mode?: 'full' | 'windowed';
    maxMessages?: number;
}

export interface PromptToggleSourceSelection {
    enabled?: boolean;
}

export interface PromptWorldbookSourceSelection extends PromptToggleSourceSelection {
    includedRefs?: ResourceRef[];
    excludedRefs?: ResourceRef[];
}

export interface PromptSourceSelection {
    history?: PromptHistorySourceSelection;
    memory?: PromptToggleSourceSelection;
    worldbook?: PromptWorldbookSourceSelection;
    examples?: PromptToggleSourceSelection;
}

export interface ResourceListQuery {
    sourceId?: string;
    resourceType?: ResourceType;
    search?: string;
}

export interface ResourceSearchParams extends ResourceListQuery {
    path?: string;
    content?: string;
}

export interface ResourceSourceStatus {
    available: boolean;
    reason?: string;
}

export interface ResourceSourceDescriptor {
    id: string;
    kind: ResourceSourceKind;
    label: string;
    status: ResourceSourceStatus;
    capabilities: ResourceCapabilities;
}

export interface ResourceWriteOptions {
    policy?: 'write_original' | 'fork_to_local' | 'ask';
    targetSourceId?: string;
}

export interface ResourceSaveResult<TPayload = unknown> {
    status: 'saved' | 'requires_policy' | 'forked' | 'rejected';
    document?: ResourceDocument<TPayload>;
    diagnostics?: ResourceDiagnostic[];
}

export interface STCharacterRawPayload {
    kind: 'character';
    raw: Record<string, unknown>;
}

export interface STWorldbookRawPayload {
    kind: 'worldbook';
    raw: Record<string, unknown>;
}

export interface STPresetRawPayload {
    kind: 'preset';
    raw: Record<string, unknown>;
}

export type STResourceRawPayload = STCharacterRawPayload | STWorldbookRawPayload | STPresetRawPayload;

export interface VFSPathResolution {
    kind: 'root' | 'source-root' | 'source-type' | 'resource' | 'library-root' | 'library-type';
    sourceId?: string;
    resourceType?: ResourceType;
    resourceId?: string;
    path: string;
}

export interface VFSStat {
    path: string;
    type: 'directory' | 'file';
    readable: boolean;
    writable: boolean;
    size?: number;
    ref?: ResourceRef;
    summary?: ResourceSummary;
}

export interface VFSDirEntry extends VFSStat {
    name: string;
}

export interface VFSSearchResult {
    path: string;
    ref?: ResourceRef;
    line?: number;
    preview: string;
    summary?: ResourceSummary;
}

export type VFSCommandName =
    | 'ls'
    | 'cat'
    | 'grep'
    | 'find'
    | 'tree'
    | 'stat'
    | 'echo'
    | 'write'
    | 'edit'
    | 'tee'
    | 'jq'
    | 'json-set'
    | 'help'
    | 'clear';

export type VFSCommandManualLocale = 'en-US' | 'zh-CN';

export interface VFSLocalizedText {
    'en-US': string;
    'zh-CN': string;
}

export interface VFSCommandExample {
    command: string;
    output: string;
    note?: VFSLocalizedText;
}

export interface VFSCommandDefinition {
    name: VFSCommandName;
    summary: VFSLocalizedText;
    usage: string;
    examples: [VFSCommandExample, VFSCommandExample, ...VFSCommandExample[]];
}

export interface VFSCompletionCandidate {
    value: string;
    display: string;
    type: 'command' | 'path';
    isDirectory?: boolean;
}

export interface VFSCompletionResult {
    replacement: string;
    replacementStart: number;
    replacementEnd: number;
    candidates: VFSCompletionCandidate[];
    completed: boolean;
}

export interface VFSCommandRequest {
    command: VFSCommandName;
    args: string[];
}

export interface VFSCommandResult {
    command: VFSCommandName;
    ok: boolean;
    text: string;
    entries?: VFSDirEntry[];
    stat?: VFSStat;
    matches?: VFSSearchResult[];
    diagnostics?: ResourceDiagnostic[];
    error?: string;
}

export type ShellSessionKind = 'user-terminal' | 'chat-agent' | 'forge-agent' | 'sub-agent';

export type ShellOwnerType = 'user' | 'chat' | 'forge' | 'agent';

export type ShellPermissionOperation = 'read' | 'write' | 'import' | 'export' | 'network';

export type ShellPermissionStatus = 'pending' | 'approved' | 'rejected' | 'revoked' | 'expired';

export interface ShellSessionRef {
    shellSessionId: string;
    kind: ShellSessionKind;
    ownerType: ShellOwnerType;
    ownerId: string;
    projectId?: string;
    conversationId?: string;
    parentShellSessionId?: string;
}

export interface ShellPermissionScope {
    pathPrefix?: string;
    resourceRef?: ResourceRef;
    sourceId?: string;
    resourceType?: ResourceType;
    urlPrefix?: string;
    allNetwork?: boolean;
}

export interface ShellPermissionRequest {
    requestId: string;
    session: ShellSessionRef;
    operation: ShellPermissionOperation;
    scope: ShellPermissionScope;
    reason: string;
    decisionReason?: string;
    createdAt: number;
    expiresAt?: number | null;
    status: ShellPermissionStatus;
}

export interface ShellPermissionGrant {
    grantId: string;
    requestId?: string;
    session: ShellSessionRef;
    operation: ShellPermissionOperation;
    scope: ShellPermissionScope;
    reason?: string;
    createdAt: number;
    expiresAt?: number | null;
    status: ShellPermissionStatus;
}

export interface ShellPermissionDecision {
    allowed: boolean;
    reason?: string;
    grant?: ShellPermissionGrant;
}

export interface ShellExecResult {
    stdout: string;
    stderr: string;
    exitCode: number;
    diagnostics?: ResourceDiagnostic[];
}
