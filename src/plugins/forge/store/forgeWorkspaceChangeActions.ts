import type {
    ForgePiWorkspacePatchChange,
    ForgePiWorkspacePatchPayload
} from '@shared/ForgePiTypes.js';
import type { ForgeFeedWorkspaceChange } from '../project/forgeWorkspaceChangePresentation.js';

const resolveRestorePatchKind = (
    beforeContentRef: string | null,
    afterContentRef: string | null
): ForgePiWorkspacePatchChange['kind'] => {
    if (beforeContentRef === null && afterContentRef !== null) return 'create';
    if (beforeContentRef !== null && afterContentRef === null) return 'delete';
    return 'update';
};

export const buildWorkspaceChangeRestorePatch = (
    change: ForgeFeedWorkspaceChange,
    now: () => number = Date.now
): ForgePiWorkspacePatchPayload => {
    const beforeContentRef = change.afterContentRef;
    const afterContentRef = change.beforeContentRef;
    return {
        nodeId: `workspace-restore-${now().toString(36)}-${change.patchEntryId}`,
        sourceToolCallId: `workspace-change-restore:${change.patchEntryId}:${change.path}`,
        restoresEntryId: `${change.patchEntryId}:${change.path}`,
        restoreDirection: 'before',
        changes: [{
            path: change.path,
            kind: resolveRestorePatchKind(beforeContentRef, afterContentRef),
            beforeHash: change.afterHash,
            afterHash: change.beforeHash,
            beforeContentRef,
            afterContentRef
        }]
    };
};
