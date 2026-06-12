import type {
    ForgePiSessionEntry,
    ForgePiWorkspacePatchChange,
    ForgePiWorkspacePatchPayload
} from '@shared/ForgePiTypes.js';

export interface ForgeFeedWorkspaceChange {
    id: string;
    patchEntryId: string;
    path: string;
    kind: ForgePiWorkspacePatchChange['kind'];
    beforeHash: string | null;
    afterHash: string | null;
    beforeContentRef: string | null;
    afterContentRef: string | null;
    restoreApplied: boolean;
}

export const buildWorkspacePatchGroupsByAssistantTurn = (
    entries: ForgePiSessionEntry[]
): ForgeFeedWorkspaceChange[][] => {
    const restoredInlineChangeKeys = resolveRestoredInlineChangeKeys(entries);
    const groups: ForgeFeedWorkspaceChange[][] = [];
    let pending: ForgeFeedWorkspaceChange[] = [];

    entries.forEach((entry) => {
        if (entry.kind === 'workspace_patch' && isWorkspacePatchPayload(entry.payload) && !entry.payload.restoresEntryId) {
            pending.push(...entry.payload.changes.map((change, index) => {
                const restoreEntryId = `${entry.id}:${change.path}`;
                return {
                    id: `${entry.id}:${change.path}:${index}`,
                    patchEntryId: entry.id,
                    path: change.path,
                    kind: change.kind,
                    beforeHash: change.beforeHash,
                    afterHash: change.afterHash,
                    beforeContentRef: change.beforeContentRef ?? null,
                    afterContentRef: change.afterContentRef ?? null,
                    restoreApplied: restoredInlineChangeKeys.has(`${restoreEntryId}:before`)
                };
            }));
            return;
        }
        if (entry.kind === 'assistant') {
            groups.push(pending);
            pending = [];
        }
    });

    return groups;
};

const resolveRestoredInlineChangeKeys = (entries: ForgePiSessionEntry[]): Set<string> => new Set(
    entries
        .map((entry) => {
            const payload = entry.payload as { restoresEntryId?: unknown; restoreDirection?: unknown };
            return typeof payload.restoresEntryId === 'string' && payload.restoreDirection === 'before'
                ? `${payload.restoresEntryId}:before`
                : null;
        })
        .filter((key): key is string => Boolean(key))
);

const isWorkspacePatchPayload = (payload: unknown): payload is ForgePiWorkspacePatchPayload => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
    const value = payload as { nodeId?: unknown; changes?: unknown };
    return typeof value.nodeId === 'string' && Array.isArray(value.changes);
};
