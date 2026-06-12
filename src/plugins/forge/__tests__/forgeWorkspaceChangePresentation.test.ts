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

    it('keeps pending workspace patches attached to the following assistant turn across process entries', () => {
        const groups = buildWorkspacePatchGroupsByAssistantTurn([
            entry('n1', null, 'metadata', {}),
            entry('n2', 'n1', 'workspace_patch', {
                nodeId: 'n2',
                changes: [{
                    path: './agent/skills/writer/SKILL.md',
                    kind: 'update',
                    beforeHash: 'before',
                    afterHash: 'after',
                    beforeContentRef: 'inline:old',
                    afterContentRef: 'inline:new'
                }]
            }),
            entry('n3', 'n2', 'process', { role: 'process', text: '正在更新技能文件。' }),
            entry('n4', 'n3', 'assistant', { role: 'assistant', text: '技能文件已更新。' })
        ]);

        expect(groups).toEqual([[
            expect.objectContaining({
                id: 'n2:./agent/skills/writer/SKILL.md:0',
                patchEntryId: 'n2',
                path: './agent/skills/writer/SKILL.md',
                restoreApplied: false
            })
        ]]);
    });

    it('groups only active branch workspace patches when active pi node is provided', () => {
        const groups = buildWorkspacePatchGroupsByAssistantTurn([
            entry('n1', null, 'metadata', {}),
            entry('n2', 'n1', 'user', { role: 'user', text: '分支 A' }),
            entry('n3', 'n2', 'workspace_patch', {
                nodeId: 'n3',
                changes: [{
                    path: './A.md',
                    kind: 'update',
                    beforeHash: 'before-a',
                    afterHash: 'after-a',
                    beforeContentRef: 'inline:old-a',
                    afterContentRef: 'inline:new-a'
                }]
            }),
            entry('n4', 'n3', 'assistant', { role: 'assistant', text: '回复 A' }),
            entry('n5', 'n1', 'user', { role: 'user', text: '分支 B' }),
            entry('n6', 'n5', 'workspace_patch', {
                nodeId: 'n6',
                changes: [{
                    path: './B.md',
                    kind: 'update',
                    beforeHash: 'before-b',
                    afterHash: 'after-b',
                    beforeContentRef: 'inline:old-b',
                    afterContentRef: 'inline:new-b'
                }]
            }),
            entry('n7', 'n6', 'process', { role: 'process', text: '正在更新 B.md。' }),
            entry('n8', 'n7', 'assistant', { role: 'assistant', text: '回复 B' })
        ], 'n8');

        expect(groups).toEqual([[
            expect.objectContaining({
                patchEntryId: 'n6',
                path: './B.md',
                beforeHash: 'before-b',
                afterHash: 'after-b'
            })
        ]]);
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
