import { describe, expect, it } from 'vitest';
import type { ForgePiSessionEntry } from '@shared/ForgePiTypes.js';
import { buildWorkspacePatchGroupsByAssistantTurn } from '../project/forgeWorkspaceChangePresentation.js';

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

describe('forgeWorkspaceChangePresentation', () => {
    it('groups workspace patches by the assistant turn that follows them', () => {
        const groups = buildWorkspacePatchGroupsByAssistantTurn([
            entry('n1', null, 'metadata', {}),
            entry('n2', 'n1', 'workspace_patch', {
                nodeId: 'n2',
                changes: [{
                    path: './card.md',
                    kind: 'update',
                    beforeHash: 'before',
                    afterHash: 'after',
                    beforeContentRef: 'inline:old',
                    afterContentRef: 'inline:new'
                }]
            }),
            entry('n3', 'n2', 'assistant', { role: 'assistant', text: '已更新卡片' }),
            entry('n4', 'n3', 'workspace_patch', {
                nodeId: 'n4',
                changes: [{
                    path: './memory/AUTO/Checklist.md',
                    kind: 'create',
                    beforeHash: null,
                    afterHash: 'after',
                    beforeContentRef: null,
                    afterContentRef: 'inline:new'
                }]
            }),
            entry('n5', 'n4', 'assistant', { role: 'assistant', text: '已更新检查清单' })
        ]);

        expect(groups).toEqual([
            [expect.objectContaining({
                id: 'n2:./card.md:0',
                patchEntryId: 'n2',
                path: './card.md',
                kind: 'update',
                restoreApplied: false
            })],
            [expect.objectContaining({
                id: 'n4:./memory/AUTO/Checklist.md:0',
                patchEntryId: 'n4',
                path: './memory/AUTO/Checklist.md',
                kind: 'create',
                restoreApplied: false
            })]
        ]);
    });

    it('marks inline restored changes without showing restore patches as new assistant changes', () => {
        const groups = buildWorkspacePatchGroupsByAssistantTurn([
            entry('n1', null, 'metadata', {}),
            entry('n2', 'n1', 'workspace_patch', {
                nodeId: 'n2',
                changes: [{
                    path: './card.md',
                    kind: 'update',
                    beforeHash: 'before',
                    afterHash: 'after',
                    beforeContentRef: 'inline:old',
                    afterContentRef: 'inline:new'
                }]
            }),
            entry('n3', 'n2', 'workspace_patch', {
                nodeId: 'n3',
                restoresEntryId: 'n2:./card.md',
                restoreDirection: 'before',
                changes: [{
                    path: './card.md',
                    kind: 'update',
                    beforeHash: 'after',
                    afterHash: 'before',
                    beforeContentRef: 'inline:new',
                    afterContentRef: 'inline:old'
                }]
            }),
            entry('n4', 'n3', 'assistant', { role: 'assistant', text: '已撤回变更' })
        ]);

        expect(groups).toEqual([
            [expect.objectContaining({
                patchEntryId: 'n2',
                path: './card.md',
                restoreApplied: true
            })]
        ]);
    });
});
