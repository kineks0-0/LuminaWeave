import type {
    ForgePiWorkspaceCheckpointPayload,
    ForgePiWorkspacePatchChange,
    ForgePiWorkspacePatchPayload
} from '@shared/ForgePiTypes.js';

export type ForgeWorkspaceFileMap = Record<string, string>;

export interface ForgeWorkspacePatchInput {
    nodeId: string;
    beforeFiles: ForgeWorkspaceFileMap;
    afterFiles: ForgeWorkspaceFileMap;
    sourceToolCallId?: string | null;
}

export class ForgeWorkspaceVersionManager {
    createPatch(input: ForgeWorkspacePatchInput): ForgePiWorkspacePatchPayload {
        const paths = Array.from(new Set([
            ...Object.keys(input.beforeFiles),
            ...Object.keys(input.afterFiles)
        ])).sort();
        const changes: ForgePiWorkspacePatchChange[] = [];
        for (const path of paths) {
                const beforeExists = Object.prototype.hasOwnProperty.call(input.beforeFiles, path);
                const afterExists = Object.prototype.hasOwnProperty.call(input.afterFiles, path);
                if (beforeExists && afterExists && input.beforeFiles[path] === input.afterFiles[path]) {
                    continue;
                }
                changes.push({
                    path,
                    kind: !beforeExists ? 'create' : !afterExists ? 'delete' : 'update',
                    beforeHash: beforeExists ? hashContent(input.beforeFiles[path]) : null,
                    afterHash: afterExists ? hashContent(input.afterFiles[path]) : null,
                    beforeContentRef: beforeExists ? inlineContentRef(input.beforeFiles[path]) : null,
                    afterContentRef: afterExists ? inlineContentRef(input.afterFiles[path]) : null
                });
        }

        return {
            nodeId: input.nodeId,
            changes,
            sourceToolCallId: input.sourceToolCallId ?? null
        };
    }

    createCheckpoint(input: {
        nodeId: string;
        files: ForgeWorkspaceFileMap;
        stateSnapshotRef: string;
        label?: string | null;
    }): ForgePiWorkspaceCheckpointPayload {
        return {
            nodeId: input.nodeId,
            fileTreeHash: hashContent(JSON.stringify(sortFileMap(input.files))),
            stateSnapshotRef: input.stateSnapshotRef,
            label: input.label ?? null
        };
    }

    replay(base: ForgeWorkspaceFileMap, patches: ForgePiWorkspacePatchPayload[]): ForgeWorkspaceFileMap {
        const next: ForgeWorkspaceFileMap = { ...base };
        for (const patch of patches) {
            for (const change of patch.changes) {
                if (change.kind === 'delete') {
                    delete next[change.path];
                    continue;
                }
                next[change.path] = resolveInlineContentRef(change.afterContentRef);
            }
        }
        return next;
    }
}

const sortFileMap = (files: ForgeWorkspaceFileMap): ForgeWorkspaceFileMap =>
    Object.fromEntries(Object.entries(files).sort(([left], [right]) => left.localeCompare(right)));

const inlineContentRef = (content: string): string => `inline:${encodeURIComponent(content)}`;

const resolveInlineContentRef = (ref: string | null | undefined): string => {
    if (!ref?.startsWith('inline:')) return '';
    return decodeURIComponent(ref.slice('inline:'.length));
};

const hashContent = (content: string): string => {
    let hash = 2166136261;
    for (let index = 0; index < content.length; index += 1) {
        hash ^= content.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return `fnv1a:${(hash >>> 0).toString(16).padStart(8, '0')}`;
};

export const forgeWorkspaceVersionManager = new ForgeWorkspaceVersionManager();
