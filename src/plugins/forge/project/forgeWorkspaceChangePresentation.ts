import type {
    ForgePiSessionEntry,
    ForgeTurnWorkspaceWriteSummary,
    ForgeWorkspaceChangedFile
} from '@shared/ForgePiTypes.js';
import { resolveForgePiActiveBranchEntries } from '../store/forgeStoreHelpers.js';
import { isRecord } from '@shared/CommonUtils.js';

export interface ForgeFeedWorkspaceChange {
    id: string;
    sourceEntryId: string;
    sourceToolCallId: string;
    path: string;
    kind: ForgeWorkspaceChangedFile['kind'];
    beforeHash: string | null;
    afterHash: string | null;
    gitCommitHash: string | null;
}

export const buildWorkspaceWriteGroupsByAssistantTurn = (
    entries: ForgePiSessionEntry[],
    activeNodeId?: string | null
): ForgeFeedWorkspaceChange[][] => {
    const activeEntries = resolveForgePiActiveBranchEntries(entries, activeNodeId);
    const groups: ForgeFeedWorkspaceChange[][] = [];
    let pending: ForgeFeedWorkspaceChange[] = [];

    activeEntries.forEach((entry) => {
        if (entry.kind === 'tool_result') {
            const summary = readWorkspaceWriteSummary(entry.payload);
            if (!summary) return;
            pending.push(...summary.changedFiles.map((change, index) => ({
                id: `${entry.id}:${change.path}:${index}`,
                sourceEntryId: entry.id,
                sourceToolCallId: summary.sourceToolCallId,
                path: change.path,
                kind: change.kind,
                beforeHash: change.beforeHash,
                afterHash: change.afterHash,
                gitCommitHash: summary.gitCommitHash ?? null
            })));
            return;
        }
        if (entry.kind === 'assistant') {
            groups.push(pending);
            pending = [];
        }
    });

    return groups;
};

const readWorkspaceWriteSummary = (payload: unknown): ForgeTurnWorkspaceWriteSummary | null => {
    if (!isRecord(payload)) return null;
    const result = isRecord(payload.result) ? payload.result : payload;
    const summary = result.workspaceWriteSummary;
    if (!isWorkspaceWriteSummary(summary)) return null;
    return summary;
};

const isWorkspaceWriteSummary = (value: unknown): value is ForgeTurnWorkspaceWriteSummary => {
    if (!isRecord(value)) return false;
    return typeof value.sourceToolCallId === 'string'
        && Array.isArray(value.changedFiles)
        && typeof value.writeCount === 'number'
        && Array.isArray(value.errors);
};

