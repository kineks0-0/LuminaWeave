import { describe, expect, it } from 'vitest';
import { projectForgePiEntriesToTimeline } from '@/api/core/forge/agent-app/session/ForgePiTimelineProjector.js';
import type { ForgePiSessionEntry } from '@shared/ForgePiTypes.js';
import type { ForgeTimelineOperationItem } from '@/types/ForgeTimelineTypes.js';

const entry = (
    id: string,
    parentId: string | null,
    kind: ForgePiSessionEntry['kind'],
    payload: ForgePiSessionEntry['payload'],
    createdAt = Number(id.replace(/\D/g, '') || 0)
): ForgePiSessionEntry => ({
    id,
    sessionId: 'forge_project__conversation',
    parentId,
    kind,
    title: kind,
    summary: `${kind} summary`,
    createdAt,
    payload
});

describe('ForgePiTimelineProjector', () => {
    it('projects pi entries into user-visible timeline rows with pi origin', () => {
        const timeline = projectForgePiEntriesToTimeline([
            entry('n1', null, 'metadata', {}),
            entry('n2', 'n1', 'context_bundle', {
                contextBundle: { files: [], activeSkills: [], loadedExtensions: [] }
            }),
            entry('n3', 'n2', 'user', { role: 'user', text: '测试 shell' }),
            entry('n4', 'n3', 'tool_call', { toolCallId: 'call_1', toolName: 'bash', args: { command: 'ls' } }),
            entry('n5', 'n4', 'tool_result', { toolCallId: 'call_1', toolName: 'bash', result: { stdout: 'ok' } }),
            entry('n6', 'n5', 'approval_needed', { approvalId: 'approval_1', toolCallId: 'call_2', toolName: 'stageEntry' }),
            entry('n7', 'n6', 'workspace_patch', {
                nodeId: 'n7',
                changes: [{ path: 'review/staging.json', kind: 'update', beforeHash: null, afterHash: 'h1' }]
            })
        ]);

        expect(timeline.map(item => item.id)).toEqual([
            'forge_pi_n3',
            'forge_pi_n4',
            'forge_pi_n5',
            'forge_pi_n6',
            'forge_pi_n7'
        ]);
        expect(timeline[0]).toEqual(expect.objectContaining({
            operationKind: 'user_action',
            title: '用户请求',
            summary: '测试 shell',
            origin: expect.objectContaining({
                runtime: 'forge-pi',
                nodeId: 'n3',
                parentNodeId: 'n2',
                entryType: 'user'
            })
        }));
        expect(timeline[1]).toEqual(expect.objectContaining({
            status: 'running',
            origin: expect.objectContaining({ toolCallId: 'call_1' })
        }));
        expect(timeline[4]).toEqual(expect.objectContaining({
            operationKind: 'workspace_write',
            origin: expect.objectContaining({ entryType: 'workspace_patch' })
        }));
    });

    it('can project only the active branch', () => {
        const timeline = projectForgePiEntriesToTimeline([
            entry('n1', null, 'metadata', {}),
            entry('n2', 'n1', 'user', { role: 'user', text: '分支 A' }),
            entry('n3', 'n2', 'assistant', { role: 'assistant', text: '回复 A' }),
            entry('n4', 'n1', 'user', { role: 'user', text: '分支 B' })
        ], { activeNodeId: 'n4' });

        const operationRows = timeline.filter((item): item is ForgeTimelineOperationItem => item.kind === 'operation');
        expect(operationRows.map(item => item.summary)).toEqual(['分支 B']);
        expect(operationRows[0]?.origin?.nodeId).toBe('n4');
    });

    it('projects process entries as agent execution process rows', () => {
        const timeline = projectForgePiEntriesToTimeline([
            entry('n1', null, 'metadata', {}),
            entry('n2', 'n1', 'user', { role: 'user', text: '整理文件' }),
            entry('n3', 'n2', 'process', { role: 'process', text: '正在读取 3 个文件。' }),
            entry('n4', 'n3', 'assistant', { role: 'assistant', text: '已完成整理。' })
        ]);

        const operationRows = timeline.filter((item): item is ForgeTimelineOperationItem => item.kind === 'operation');

        expect(operationRows.map(item => item.title)).toEqual([
            '用户请求',
            'Agent 过程',
            'Agent 回复'
        ]);
        expect(operationRows[1]).toEqual(expect.objectContaining({
            operationKind: 'execution',
            status: 'completed',
            summary: '正在读取 3 个文件。',
            detail: '正在读取 3 个文件。',
            origin: expect.objectContaining({
                entryType: 'process',
                nodeId: 'n3',
                parentNodeId: 'n2'
            })
        }));
    });
});
