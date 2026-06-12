import { describe, expect, it } from 'vitest';
import type { ForgeTimelineOperationItem } from '../../../types/ForgeTimelineTypes.js';
import type { ForgeFeedWorkspaceChange } from '../project/forgeWorkspaceChangePresentation.js';
import { buildForgeAgentProcessPresentation } from '../project/forgeAgentProcessPresentation.js';

const operation = (
    id: string,
    status: ForgeTimelineOperationItem['status'],
    title: string,
    summary: string,
    detail: string | null,
    entryType: NonNullable<ForgeTimelineOperationItem['origin']>['entryType'] = 'tool_call'
): ForgeTimelineOperationItem => ({
    id,
    kind: 'operation',
    operationKind: entryType === 'workspace_patch' ? 'workspace_write' : 'execution',
    status,
    title,
    summary,
    detail,
    sourceTag: `pi:${entryType}`,
    dedupeKey: null,
    targetEntryId: null,
    relatedMessageId: null,
    layer: null,
    requestPrompt: null,
    origin: {
        runtime: 'forge-pi',
        sessionId: 'forge_project__conversation',
        nodeId: id,
        parentNodeId: null,
        entryType
    },
    createdAt: Number(id.replace(/\D/g, '') || 0),
    updatedAt: Number(id.replace(/\D/g, '') || 0),
    completedAt: status === 'running' ? null : Number(id.replace(/\D/g, '') || 0)
});

const toolDetail = (toolName: string, path: string): string => JSON.stringify({
    toolCallId: `call-${toolName}`,
    toolName,
    args: { path }
});

const workspaceChange = (path: string): ForgeFeedWorkspaceChange => ({
    id: `patch:${path}:0`,
    patchEntryId: 'patch-1',
    path,
    kind: 'update',
    beforeHash: 'before',
    afterHash: 'after',
    beforeContentRef: 'inline:old',
    afterContentRef: 'inline:new',
    restoreApplied: false
});

describe('forgeAgentProcessPresentation', () => {
    it('builds a running process section from stream process text and tool calls', () => {
        const presentation = buildForgeAgentProcessPresentation({
            id: 'process-running',
            operations: [
                operation('op1', 'running', '工具调用 · read', '读取文件', toolDetail('read', './xx.md')),
                operation('op2', 'running', '工具调用 · edit', '编辑文件', toolDetail('edit', './xx.md'))
            ],
            streamProcessText: '让我思考一下，用户希望我先读一下文件确定当前内容。',
            hasAssistantReply: false,
            workspaceChanges: []
        });

        expect(presentation.isDone).toBe(false);
        expect(presentation.summary.label).toBe('读取 1 个文件 · 编辑 1 个文件');
        expect(presentation.processBlocks).toEqual([
            '让我思考一下，用户希望我先读一下文件确定当前内容。'
        ]);
        expect(presentation.steps.map(step => step.title)).toEqual([
            '正在读取文件',
            '正在编辑文件'
        ]);
    });

    it('renders persisted model process content as direct text instead of a model step', () => {
        const presentation = buildForgeAgentProcessPresentation({
            id: 'process-text-only',
            operations: [
                operation('op1', 'completed', 'Agent 过程', '我需要确认当前文件结构。', '我需要确认当前文件结构。', 'process')
            ],
            workspaceChanges: [],
            hasAssistantReply: true
        });

        expect(presentation.processBlocks).toEqual(['我需要确认当前文件结构。']);
        expect(presentation.steps.map(step => step.title)).not.toContain('模型过程');
        expect(presentation.steps).toEqual([]);
    });

    it('marks a completed assistant turn as done even when persisted tool_call rows are still running', () => {
        const presentation = buildForgeAgentProcessPresentation({
            id: 'process-completed',
            operations: [
                operation('op1', 'running', '工具调用 · read', '读取文件', toolDetail('read', './xx.md')),
                operation('op2', 'completed', '工具结果 · read', '读取完成', toolDetail('read', './xx.md'), 'tool_result'),
                operation('op3', 'running', '工具调用 · edit', '编辑文件', toolDetail('edit', './xx.md')),
                operation('op4', 'completed', '工作区变更记录', '1 file change(s)', '{"nodeId":"patch-1"}', 'workspace_patch')
            ],
            workspaceChanges: [workspaceChange('./xx.md')],
            hasAssistantReply: true
        });

        expect(presentation.isDone).toBe(true);
        expect(presentation.summary.label).toBe('读取 1 个文件 · 编辑 1 个文件 · 生成 1 条回复');
        expect(presentation.steps.map(step => step.title)).toEqual([
            '已读取文件',
            '已编辑文件',
            './xx.md 文件被更改',
            '已生成 workspace_patch'
        ]);
    });

    it('falls back to a file-change summary when only workspace patch rows are available', () => {
        const presentation = buildForgeAgentProcessPresentation({
            id: 'process-patch-only',
            operations: [
                operation('op1', 'completed', '工作区变更记录', '2 file change(s)', '{"nodeId":"patch-1"}', 'workspace_patch')
            ],
            workspaceChanges: [workspaceChange('./a.md'), workspaceChange('./b.md')],
            hasAssistantReply: true
        });

        expect(presentation.summary.label).toBe('更改 2 个文件 · 生成 1 条回复');
        expect(presentation.steps.map(step => step.title)).toEqual([
            './a.md 文件被更改',
            './b.md 文件被更改',
            '已生成 workspace_patch'
        ]);
    });
});
