import type {
    ForgePiSessionEntry,
    ForgePiWorkspaceCheckpointPayload,
    ForgePiWorkspacePatchChange,
    ForgePiWorkspacePatchPayload
} from '@shared/ForgePiTypes.js';
import type { StagingEntry } from '../../../types/ForgeRuntimeTypes.js';

export interface PatchVersionRow {
    kind: 'patch';
    id: string;
    title: string;
    summary: string;
    createdAt: number;
    nodeId: string;
    parentNodeId: string | null;
    isOnActiveBranch: boolean;
    sourceToolCallId: string | null;
    changes: ForgePiWorkspacePatchChange[];
}

export interface CheckpointVersionRow {
    kind: 'checkpoint';
    id: string;
    title: string;
    summary: string;
    createdAt: number;
    nodeId: string;
    parentNodeId: string | null;
    isOnActiveBranch: boolean;
    fileTreeHash: string;
    stateSnapshotRef: string;
    label: string | null;
}

export type WorkspaceVersionRow = PatchVersionRow | CheckpointVersionRow;
export type WorkspaceVersionRestoreDirection = 'before' | 'after';
export type WorkspaceVersionStagingEntryInput = Omit<StagingEntry, 'id' | 'timestamp'>;

export const buildWorkspaceVersionRows = (
    entries: ForgePiSessionEntry[],
    activeNodeId: string | null
): WorkspaceVersionRow[] => {
    const branchEntryIds = resolveBranchEntryIds(entries, activeNodeId);
    return entries
        .map(entry => toVersionRow(entry, branchEntryIds))
        .filter((row): row is WorkspaceVersionRow => row !== null)
        .sort((left, right) => right.createdAt - left.createdAt || right.id.localeCompare(left.id));
};

export const createRestoreStagingEntries = (
    row: PatchVersionRow,
    direction: WorkspaceVersionRestoreDirection
): WorkspaceVersionStagingEntryInput[] =>
    row.changes
        .map(change => createRestoreEntry(row, change, direction))
        .filter((entry): entry is WorkspaceVersionStagingEntryInput => entry !== null);

export const countBranchDiffChanges = (rows: WorkspaceVersionRow[]): {
    activeBranchChanges: number;
    otherBranchChanges: number;
} => rows.reduce((acc, row) => {
    const count = row.kind === 'patch' ? row.changes.length : 0;
    if (row.isOnActiveBranch) {
        acc.activeBranchChanges += count;
    } else {
        acc.otherBranchChanges += count;
    }
    return acc;
}, { activeBranchChanges: 0, otherBranchChanges: 0 });

export const canRestorePatchRow = (
    row: PatchVersionRow,
    direction: WorkspaceVersionRestoreDirection
): boolean => createRestoreStagingEntries(row, direction).length > 0;

export const resolvePatchChangeContents = (change: ForgePiWorkspacePatchChange): {
    before: string | null;
    after: string | null;
} => ({
    before: resolveInlineContentRef(change.beforeContentRef),
    after: resolveInlineContentRef(change.afterContentRef)
});

const toVersionRow = (
    entry: ForgePiSessionEntry,
    branchEntryIds: Set<string> | null
): WorkspaceVersionRow | null => {
    const isOnActiveBranch = branchEntryIds ? branchEntryIds.has(entry.id) : true;
    if (entry.kind === 'workspace_patch' && isPatchPayload(entry.payload)) {
        return {
            kind: 'patch',
            id: entry.id,
            title: entry.title || '工作区变更记录',
            summary: entry.summary,
            createdAt: entry.createdAt,
            nodeId: entry.payload.nodeId,
            parentNodeId: entry.parentId,
            isOnActiveBranch,
            sourceToolCallId: entry.payload.sourceToolCallId ?? null,
            changes: entry.payload.changes
        };
    }
    if (entry.kind === 'workspace_checkpoint' && isCheckpointPayload(entry.payload)) {
        return {
            kind: 'checkpoint',
            id: entry.id,
            title: entry.title || '工作区版本检查点',
            summary: entry.summary,
            createdAt: entry.createdAt,
            nodeId: entry.payload.nodeId,
            parentNodeId: entry.parentId,
            isOnActiveBranch,
            fileTreeHash: entry.payload.fileTreeHash,
            stateSnapshotRef: entry.payload.stateSnapshotRef,
            label: entry.payload.label ?? null
        };
    }
    return null;
};

const createRestoreEntry = (
    row: PatchVersionRow,
    change: ForgePiWorkspacePatchChange,
    direction: WorkspaceVersionRestoreDirection
): WorkspaceVersionStagingEntryInput | null => {
    const proposedContent = resolveInlineContentRef(direction === 'before'
        ? change.beforeContentRef
        : change.afterContentRef);
    const originalContent = resolveInlineContentRef(direction === 'before'
        ? change.afterContentRef
        : change.beforeContentRef);
    const isDelete = proposedContent === null;
    return {
        operation: isDelete ? 'delete' : 'upsert',
        targetEntryId: change.path,
        originalContent: originalContent ?? '',
        proposedContent: proposedContent ?? '',
        description: direction === 'before'
            ? `文件版本恢复：回到 ${compactId(row.nodeId)} 变更前`
            : `文件版本恢复：应用 ${compactId(row.nodeId)} 变更后`,
        layer: null,
        sourceTag: 'workspace-version-restore',
        sourceMessageId: null,
        sourceSessionId: row.nodeId
    };
};

const resolveBranchEntryIds = (
    entries: ForgePiSessionEntry[],
    activeNodeId: string | null
): Set<string> | null => {
    if (!activeNodeId) return null;
    const byId = new Map(entries.map(entry => [entry.id, entry]));
    const ids = new Set<string>();
    let current = byId.get(activeNodeId);
    while (current) {
        ids.add(current.id);
        current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return ids;
};

const resolveInlineContentRef = (ref: string | null | undefined): string | null => {
    if (!ref?.startsWith('inline:')) return null;
    return decodeURIComponent(ref.slice('inline:'.length));
};

const isPatchPayload = (value: unknown): value is ForgePiWorkspacePatchPayload =>
    isRecord(value)
    && typeof value.nodeId === 'string'
    && Array.isArray(value.changes)
    && value.changes.every(isPatchChange)
    && (typeof value.sourceToolCallId === 'string' || value.sourceToolCallId === null || value.sourceToolCallId === undefined);

const isPatchChange = (value: unknown): value is ForgePiWorkspacePatchChange =>
    isRecord(value)
    && typeof value.path === 'string'
    && (value.kind === 'create' || value.kind === 'update' || value.kind === 'delete')
    && (typeof value.beforeHash === 'string' || value.beforeHash === null)
    && (typeof value.afterHash === 'string' || value.afterHash === null);

const isCheckpointPayload = (value: unknown): value is ForgePiWorkspaceCheckpointPayload =>
    isRecord(value)
    && typeof value.nodeId === 'string'
    && typeof value.fileTreeHash === 'string'
    && typeof value.stateSnapshotRef === 'string'
    && (typeof value.label === 'string' || value.label === null || value.label === undefined);

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

export const compactId = (value: string): string =>
    value.length > 12 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;
