import { describe, expect, it } from 'vitest';
import type { ForgePiSessionEntry } from '@shared/ForgePiTypes.js';
import { buildWorkspaceWriteGroupsByAssistantTurn } from '../project/forgeWorkspaceChangePresentation.js';

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

const toolResult = (
    id: string,
    parentId: string | null,
    path: string,
    kind: 'create' | 'update' | 'delete',
    gitCommitHash = 'commit-a'
): ForgePiSessionEntry => entry(id, parentId, 'tool_result', {
    type: 'tool_result',
    toolCallId: `call_${id}`,
    toolName: 'write',
    result: {
        path,
        applied: true,
        workspaceWriteSummary: {
            sourceToolCallId: `call_${id}`,
            changedFiles: [{
                path,
                kind,
                beforeHash: kind === 'create' ? null : 'before',
                afterHash: kind === 'delete' ? null : 'after'
            }],
            writeCount: 1,
            errors: [],
            gitCommitHash,
            gitParentHash: null
        }
    }
});

describe('forgeWorkspaceChangePresentation', () => {
    it('groups workspace write summaries by the assistant turn that follows them', () => {
        const groups = buildWorkspaceWriteGroupsByAssistantTurn([
            entry('n1', null, 'metadata', {}),
            toolResult('n2', 'n1', './card.md', 'update'),
            entry('n3', 'n2', 'assistant', { role: 'assistant', text: '已更新卡片' }),
            toolResult('n4', 'n3', './memory/AUTO/Checklist.md', 'create', 'commit-b'),
            entry('n5', 'n4', 'assistant', { role: 'assistant', text: '已更新检查清单' })
        ]);

        expect(groups).toEqual([
            [expect.objectContaining({
                id: 'n2:./card.md:0',
                sourceEntryId: 'n2',
                sourceToolCallId: 'call_n2',
                path: './card.md',
                kind: 'update',
                gitCommitHash: 'commit-a'
            })],
            [expect.objectContaining({
                id: 'n4:./memory/AUTO/Checklist.md:0',
                sourceEntryId: 'n4',
                path: './memory/AUTO/Checklist.md',
                kind: 'create',
                gitCommitHash: 'commit-b'
            })]
        ]);
    });

    it('keeps pending workspace writes attached to the following assistant turn across process entries', () => {
        const groups = buildWorkspaceWriteGroupsByAssistantTurn([
            entry('n1', null, 'metadata', {}),
            toolResult('n2', 'n1', './agent/skills/writer/SKILL.md', 'update'),
            entry('n3', 'n2', 'process', { role: 'process', text: '正在更新技能文件。' }),
            entry('n4', 'n3', 'assistant', { role: 'assistant', text: '技能文件已更新。' })
        ]);

        expect(groups).toEqual([[
            expect.objectContaining({
                sourceEntryId: 'n2',
                path: './agent/skills/writer/SKILL.md'
            })
        ]]);
    });

    it('groups only active branch workspace writes when active pi node is provided', () => {
        const groups = buildWorkspaceWriteGroupsByAssistantTurn([
            entry('n1', null, 'metadata', {}),
            entry('n2', 'n1', 'user', { role: 'user', text: '分支 A' }),
            toolResult('n3', 'n2', './A.md', 'update', 'commit-a'),
            entry('n4', 'n3', 'assistant', { role: 'assistant', text: '回复 A' }),
            entry('n5', 'n1', 'user', { role: 'user', text: '分支 B' }),
            toolResult('n6', 'n5', './B.md', 'update', 'commit-b'),
            entry('n7', 'n6', 'process', { role: 'process', text: '正在更新 B.md。' }),
            entry('n8', 'n7', 'assistant', { role: 'assistant', text: '回复 B' })
        ], 'n8');

        expect(groups).toEqual([[
            expect.objectContaining({
                sourceEntryId: 'n6',
                path: './B.md',
                beforeHash: 'before',
                afterHash: 'after',
                gitCommitHash: 'commit-b'
            })
        ]]);
    });
});
