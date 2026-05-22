import { describe, expect, it } from 'vitest';
import type { ForgePiSessionEntry } from '@shared/ForgePiTypes.js';
import {
    buildWorkspaceVersionRows,
    countBranchDiffChanges,
    createRestoreStagingEntries,
    resolvePatchChangeContents
} from '../project/forgeWorkspaceVersionPresentation.js';

const entry = (
    id: string,
    parentId: string | null,
    kind: ForgePiSessionEntry['kind'],
    payload: ForgePiSessionEntry['payload']
): ForgePiSessionEntry => ({
    id,
    sessionId: 'forge_project__conversation',
    parentId,
    kind,
    title: kind,
    summary: `${kind} summary`,
    createdAt: Number(id.replace(/\D/g, '') || 0),
    payload
});

describe('forgeWorkspaceVersionPresentation', () => {
    it('projects patch and checkpoint rows with active branch flags', () => {
        const rows = buildWorkspaceVersionRows([
            entry('n1', null, 'metadata', {}),
            entry('n2', 'n1', 'user', { text: 'branch A' }),
            entry('n3', 'n2', 'workspace_patch', {
                nodeId: 'n3',
                changes: [{
                    path: 'review/staging.json',
                    kind: 'update',
                    beforeHash: 'before',
                    afterHash: 'after',
                    beforeContentRef: 'inline:old',
                    afterContentRef: 'inline:new'
                }]
            }),
            entry('n4', 'n1', 'user', { text: 'branch B' }),
            entry('n5', 'n4', 'workspace_checkpoint', {
                nodeId: 'n5',
                fileTreeHash: 'hash',
                stateSnapshotRef: 'snapshot',
                label: 'B'
            })
        ], 'n3');

        expect(rows).toHaveLength(2);
        expect(rows.find(row => row.id === 'n3')).toEqual(expect.objectContaining({
            kind: 'patch',
            isOnActiveBranch: true
        }));
        expect(rows.find(row => row.id === 'n5')).toEqual(expect.objectContaining({
            kind: 'checkpoint',
            isOnActiveBranch: false
        }));
        expect(countBranchDiffChanges(rows)).toEqual({
            activeBranchChanges: 1,
            otherBranchChanges: 0
        });
    });

    it('creates reviewable staging restore entries from inline patch content', () => {
        const [row] = buildWorkspaceVersionRows([
            entry('n1', null, 'workspace_patch', {
                nodeId: 'n1',
                changes: [{
                    path: 'review/staging.json',
                    kind: 'update',
                    beforeHash: 'before',
                    afterHash: 'after',
                    beforeContentRef: 'inline:%7B%22old%22%3Atrue%7D',
                    afterContentRef: 'inline:%7B%22new%22%3Atrue%7D'
                }, {
                    path: 'created.json',
                    kind: 'create',
                    beforeHash: null,
                    afterHash: 'created',
                    beforeContentRef: null,
                    afterContentRef: 'inline:created'
                }]
            })
        ], 'n1');

        expect(row?.kind).toBe('patch');
        if (!row || row.kind !== 'patch') return;

        expect(createRestoreStagingEntries(row, 'before')).toEqual([
            expect.objectContaining({
                operation: 'upsert',
                targetEntryId: 'review/staging.json',
                originalContent: '{"new":true}',
                proposedContent: '{"old":true}',
                sourceTag: 'workspace-version-restore'
            }),
            expect.objectContaining({
                operation: 'delete',
                targetEntryId: 'created.json',
                originalContent: 'created',
                proposedContent: ''
            })
        ]);
        expect(createRestoreStagingEntries(row, 'after')).toEqual([
            expect.objectContaining({
                operation: 'upsert',
                targetEntryId: 'review/staging.json',
                originalContent: '{"old":true}',
                proposedContent: '{"new":true}'
            }),
            expect.objectContaining({
                operation: 'upsert',
                targetEntryId: 'created.json',
                originalContent: '',
                proposedContent: 'created'
            })
        ]);
        expect(resolvePatchChangeContents(row.changes[0])).toEqual({
            before: '{"old":true}',
            after: '{"new":true}'
        });
    });
});
