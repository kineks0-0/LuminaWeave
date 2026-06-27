import type { ForgeTimelineOperationItem, ForgeTimelineOperationStatus } from '../../../types/ForgeTimelineTypes.js';
import type { ForgeFeedWorkspaceChange } from './forgeWorkspaceChangePresentation.js';

export type ForgeAgentProcessStepTone = 'model' | 'tool' | 'file' | 'system' | 'gate';

export interface ForgeAgentProcessStep {
    id: string;
    title: string;
    detail: string | null;
    status: ForgeTimelineOperationStatus;
    tone: ForgeAgentProcessStepTone;
}

export interface ForgeAgentProcessSummary {
    label: string;
    readCount: number;
    editCount: number;
    fileChangeCount: number;
    replyCount: number;
}

export interface ForgeAgentProcessPresentation {
    id: string;
    isDone: boolean;
    summary: ForgeAgentProcessSummary;
    processBlocks: string[];
    steps: ForgeAgentProcessStep[];
}

export interface BuildForgeAgentProcessPresentationInput {
    id: string;
    operations: ForgeTimelineOperationItem[];
    workspaceChanges?: ForgeFeedWorkspaceChange[];
    streamProcessText?: string | null;
    hasAssistantReply?: boolean;
}

const TOOL_CALL_TITLE_PREFIX = '工具调用 · ';
const TOOL_RESULT_TITLE_PREFIX = '工具结果 · ';

const LEGACY_TOOL_NAME_ALIASES = new Map<string, string>([
    ['readFile', 'read'],
    ['writeFile', 'write'],
    ['editFile', 'edit'],
    ['deleteFile', 'delete']
]);

const READ_TOOL_NAMES = new Set(['read']);
const EDIT_TOOL_NAMES = new Set(['write', 'edit', 'delete']);

export const buildForgeAgentProcessPresentation = ({
    id,
    operations,
    workspaceChanges = [],
    streamProcessText,
    hasAssistantReply = false
}: BuildForgeAgentProcessPresentationInput): ForgeAgentProcessPresentation => {
    const toolCalls = operations.filter(operation => operation.origin?.entryType === 'tool_call');
    const readCount = countUniqueToolCalls(toolCalls, READ_TOOL_NAMES);
    const editToolCount = countUniqueToolCalls(toolCalls, EDIT_TOOL_NAMES);
    const editCount = editToolCount > 0 ? editToolCount : workspaceChanges.length;
    const replyCount = hasAssistantReply ? 1 : 0;
    const isDone = hasAssistantReply || operations.every(operation => operation.status !== 'running');
    const processBlocks = buildProcessTextBlocks({
        operations,
        streamProcessText: streamProcessText?.trim() || null
    });
    const steps = buildProcessSteps({
        id,
        operations,
        workspaceChanges,
        isDone
    });

    return {
        id,
        isDone,
        summary: {
            label: buildSummaryLabel({
                readCount,
                editCount,
                fileChangeCount: workspaceChanges.length,
                replyCount,
                fallbackStepCount: steps.length || processBlocks.length || operations.length
            }),
            readCount,
            editCount,
            fileChangeCount: workspaceChanges.length,
            replyCount
        },
        processBlocks,
        steps
    };
};

const buildProcessTextBlocks = ({
    operations,
    streamProcessText
}: {
    operations: ForgeTimelineOperationItem[];
    streamProcessText: string | null;
}): string[] => {
    const blocks: string[] = [];
    const appendBlock = (value: string | null): void => {
        if (!value || blocks.includes(value)) return;
        blocks.push(value);
    };
    appendBlock(streamProcessText);
    operations.forEach((operation) => {
        if (operation.origin?.entryType !== 'process') return;
        appendBlock(cleanDetail(operation.detail || operation.summary));
    });
    return blocks;
};

const buildProcessSteps = ({
    id,
    operations,
    workspaceChanges,
    isDone
}: {
    id: string;
    operations: ForgeTimelineOperationItem[];
    workspaceChanges: ForgeFeedWorkspaceChange[];
    isDone: boolean;
}): ForgeAgentProcessStep[] => {
    const steps: ForgeAgentProcessStep[] = [];
    const emittedToolCallKeys = new Set<string>();

    operations.forEach((operation) => {
        const entryType = operation.origin?.entryType;
        if (entryType === 'process') {
            return;
        }

        if (entryType === 'tool_call') {
            const parsedTool = parseToolOperation(operation);
            const toolKey = parsedTool.toolCallId || operation.origin?.toolCallId || operation.id;
            emittedToolCallKeys.add(toolKey);
            steps.push({
                id: `${operation.id}:tool-call`,
                title: resolveToolStepTitle(parsedTool.toolName, isDone ? 'completed' : operation.status),
                detail: parsedTool.path || cleanDetail(operation.summary),
                status: isDone ? 'completed' : operation.status,
                tone: 'tool'
            });
            return;
        }

        if (entryType === 'tool_result') {
            const parsedTool = parseToolOperation(operation);
            const toolKey = parsedTool.toolCallId || operation.origin?.toolCallId || operation.id;
            if (emittedToolCallKeys.has(toolKey)) return;
            steps.push({
                id: `${operation.id}:tool-result`,
                title: resolveToolStepTitle(parsedTool.toolName, operation.status),
                detail: parsedTool.path || cleanDetail(operation.summary),
                status: operation.status,
                tone: operation.status === 'failed' ? 'system' : 'tool'
            });
            return;
        }

        if (entryType === 'approval_needed' || entryType === 'approval_resolved' || entryType === 'staging_proposal') {
            steps.push({
                id: `${operation.id}:gate`,
                title: operation.title,
                detail: cleanDetail(operation.summary),
                status: operation.status,
                tone: 'gate'
            });
        }
    });

    workspaceChanges.forEach((change) => {
        steps.push({
            id: `${change.id}:file-change`,
            title: `${change.path} 文件被更改`,
            detail: `${workspaceChangeKindLabel(change.kind)} · 已记录到文件变更`,
            status: 'completed',
            tone: 'file'
        });
    });

    const fallbackOperations = operations.filter(operation => operation.origin?.entryType !== 'process');
    if (steps.length === 0 && fallbackOperations.length > 0) {
        fallbackOperations.forEach((operation) => {
            steps.push({
                id: `${operation.id}:operation`,
                title: operation.title,
                detail: cleanDetail(operation.summary),
                status: isDone ? 'completed' : operation.status,
                tone: operation.operationKind === 'gate' ? 'gate' : 'system'
            });
        });
    }

    return steps;
};

const countUniqueToolCalls = (
    operations: ForgeTimelineOperationItem[],
    targetToolNames: Set<string>
): number => {
    const keys = new Set<string>();
    operations.forEach((operation) => {
        const parsedTool = parseToolOperation(operation);
        if (!parsedTool.toolName || !targetToolNames.has(parsedTool.toolName)) return;
        keys.add(parsedTool.toolCallId || operation.origin?.toolCallId || operation.id);
    });
    return keys.size;
};

const buildSummaryLabel = ({
    readCount,
    editCount,
    fileChangeCount,
    replyCount,
    fallbackStepCount
}: {
    readCount: number;
    editCount: number;
    fileChangeCount: number;
    replyCount: number;
    fallbackStepCount: number;
}): string => {
    const parts: string[] = [];
    if (readCount > 0) parts.push(`读取 ${readCount} 个文件`);
    if (editCount > 0) {
        parts.push(editCount === fileChangeCount && readCount === 0 ? `更改 ${editCount} 个文件` : `编辑 ${editCount} 个文件`);
    }
    if (replyCount > 0) parts.push(`生成 ${replyCount} 条回复`);
    if (parts.length === 0) parts.push(`运行 ${fallbackStepCount} 步`);
    return parts.join(' · ');
};

const parseToolOperation = (operation: ForgeTimelineOperationItem): {
    toolName: string | null;
    toolCallId: string | null;
    path: string | null;
} => {
    const detailRecord = parseRecordJson(operation.detail);
    const rawToolName = readString(detailRecord, 'toolName') ?? readToolNameFromTitle(operation.title);
    const args = readRecord(detailRecord, 'args');
    return {
        toolName: rawToolName ? normalizeToolName(rawToolName) : null,
        toolCallId: readString(detailRecord, 'toolCallId'),
        path: readString(args, 'path')
    };
};

const readToolNameFromTitle = (title: string): string | null => {
    if (title.startsWith(TOOL_CALL_TITLE_PREFIX)) return title.slice(TOOL_CALL_TITLE_PREFIX.length);
    if (title.startsWith(TOOL_RESULT_TITLE_PREFIX)) return title.slice(TOOL_RESULT_TITLE_PREFIX.length);
    return null;
};

const normalizeToolName = (toolName: string): string => LEGACY_TOOL_NAME_ALIASES.get(toolName) ?? toolName;

const resolveToolStepTitle = (toolName: string | null, status: ForgeTimelineOperationStatus): string => {
    const prefix = status === 'running' ? '正在' : '已';
    if (toolName && READ_TOOL_NAMES.has(toolName)) return status === 'running' ? '正在读取文件' : '已读取文件';
    if (toolName && EDIT_TOOL_NAMES.has(toolName)) return status === 'running' ? '正在编辑文件' : '已编辑文件';
    if (toolName === 'bash') return status === 'running' ? '正在执行命令' : '已执行命令';
    if (status === 'failed') return '工具执行失败';
    if (status === 'cancelled') return '工具调用已取消';
    if (status === 'blocked') return '等待工具授权';
    return `${prefix}调用工具`;
};

const workspaceChangeKindLabel = (kind: ForgeFeedWorkspaceChange['kind']): string => {
    if (kind === 'create') return '新增';
    if (kind === 'delete') return '删除';
    return '更新';
};

const parseRecordJson = (value: string | null | undefined): Record<string, unknown> | null => {
    if (!value) return null;
    try {
        const parsed = JSON.parse(value);
        return isRecord(parsed) ? parsed : null;
    } catch {
        return null;
    }
};

const readRecord = (record: Record<string, unknown> | null, key: string): Record<string, unknown> | null => {
    if (!record) return null;
    const value = record[key];
    return isRecord(value) ? value : null;
};

const readString = (record: Record<string, unknown> | null, key: string): string | null => {
    if (!record) return null;
    const value = record[key];
    return typeof value === 'string' ? value : null;
};

const cleanDetail = (value: string | null | undefined): string | null => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);
