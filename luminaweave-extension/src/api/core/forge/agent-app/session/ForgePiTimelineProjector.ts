import type {
    ForgePiRuntimeEventType,
    ForgePiSessionEntry,
    ForgeTimelinePiOrigin
} from '@shared/ForgePiTypes.js';
import type {
    ForgeTimelineItem,
    ForgeTimelineOperationItem,
    ForgeTimelineOperationKind,
    ForgeTimelineOperationStatus
} from '../../../../../types/ForgeTimelineTypes.js';

export interface ForgePiTimelineProjectionOptions {
    activeNodeId?: string | null;
}

const HIDDEN_ENTRY_KINDS = new Set<ForgePiRuntimeEventType>([
    'metadata',
    'session_info',
    'context_bundle',
    'checkout'
]);

export const projectForgePiEntriesToTimeline = (
    entries: ForgePiSessionEntry[],
    options: ForgePiTimelineProjectionOptions = {}
): ForgeTimelineItem[] => {
    const branchEntryIds = options.activeNodeId
        ? resolveBranchEntryIds(entries, options.activeNodeId)
        : null;

    return entries
        .filter(entry => !branchEntryIds || branchEntryIds.has(entry.id))
        .filter(entry => !HIDDEN_ENTRY_KINDS.has(entry.kind))
        .map(entry => createOperationItem(entry))
        .sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id));
};

const resolveBranchEntryIds = (entries: ForgePiSessionEntry[], activeNodeId: string): Set<string> => {
    const byId = new Map(entries.map(entry => [entry.id, entry]));
    const ids = new Set<string>();
    let current = byId.get(activeNodeId);
    while (current) {
        ids.add(current.id);
        current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return ids;
};

const createOperationItem = (entry: ForgePiSessionEntry): ForgeTimelineOperationItem => {
    const presentation = resolvePresentation(entry);
    return {
        id: `forge_pi_${entry.id}`,
        kind: 'operation',
        operationKind: presentation.operationKind,
        status: presentation.status,
        title: presentation.title,
        summary: presentation.summary || entry.summary,
        detail: presentation.detail,
        sourceTag: `pi:${entry.kind}`,
        dedupeKey: null,
        targetEntryId: resolveTargetEntryId(entry.payload),
        relatedMessageId: null,
        layer: null,
        origin: createOrigin(entry),
        createdAt: entry.createdAt,
        updatedAt: entry.createdAt,
        completedAt: presentation.status === 'running' ? null : entry.createdAt
    };
};

const createOrigin = (entry: ForgePiSessionEntry): ForgeTimelinePiOrigin => ({
    runtime: 'forge-pi',
    sessionId: entry.sessionId,
    nodeId: entry.id,
    parentNodeId: entry.parentId,
    entryType: entry.kind,
    toolCallId: resolveToolCallId(entry.payload)
});

const resolvePresentation = (entry: ForgePiSessionEntry): {
    operationKind: ForgeTimelineOperationKind;
    status: ForgeTimelineOperationStatus;
    title: string;
    summary: string;
    detail: string | null;
} => {
    if (entry.kind === 'user') {
        return {
            operationKind: 'user_action',
            status: 'completed',
            title: '用户请求',
            summary: extractText(entry.payload) || entry.summary,
            detail: extractText(entry.payload) || null
        };
    }
    if (entry.kind === 'assistant') {
        return {
            operationKind: 'execution',
            status: 'completed',
            title: 'Agent 回复',
            summary: extractText(entry.payload) || entry.summary,
            detail: extractText(entry.payload) || null
        };
    }
    if (entry.kind === 'process') {
        return {
            operationKind: 'execution',
            status: 'completed',
            title: 'Agent 过程',
            summary: extractText(entry.payload) || entry.summary,
            detail: extractText(entry.payload) || null
        };
    }
    if (entry.kind === 'tool_call') {
        return {
            operationKind: 'execution',
            status: 'running',
            title: `工具调用 · ${resolveToolName(entry.payload) ?? 'unknown'}`,
            summary: entry.summary,
            detail: stringifyPayload(entry.payload)
        };
    }
    if (entry.kind === 'tool_result') {
        return {
            operationKind: isErrorPayload(entry.payload) ? 'system' : 'execution',
            status: isErrorPayload(entry.payload) ? 'failed' : 'completed',
            title: `工具结果 · ${resolveToolName(entry.payload) ?? 'unknown'}`,
            summary: entry.summary,
            detail: stringifyPayload(entry.payload)
        };
    }
    if (entry.kind === 'approval_needed' || entry.kind === 'approval_resolved') {
        return {
            operationKind: 'gate',
            status: entry.kind === 'approval_needed' ? 'blocked' : resolveApprovalStatus(entry.payload),
            title: entry.kind === 'approval_needed' ? '等待审阅授权' : '审阅授权结果',
            summary: entry.summary,
            detail: stringifyPayload(entry.payload)
        };
    }
    if (entry.kind === 'staging_proposal') {
        return {
            operationKind: 'gate',
            status: 'blocked',
            title: '暂存建议',
            summary: entry.summary,
            detail: stringifyPayload(entry.payload)
        };
    }
    if (entry.kind === 'workspace_patch' || entry.kind === 'workspace_checkpoint') {
        return {
            operationKind: 'workspace_write',
            status: 'completed',
            title: entry.kind === 'workspace_patch' ? '工作区变更记录' : '工作区版本检查点',
            summary: entry.summary,
            detail: stringifyPayload(entry.payload)
        };
    }
    return {
        operationKind: 'system',
        status: 'completed',
        title: entry.title,
        summary: entry.summary,
        detail: stringifyPayload(entry.payload)
    };
};

const resolveApprovalStatus = (payload: unknown): ForgeTimelineOperationStatus => {
    if (!isRecord(payload) || typeof payload.approved !== 'boolean') return 'completed';
    return payload.approved ? 'completed' : 'cancelled';
};

const resolveToolCallId = (payload: unknown): string | undefined =>
    isRecord(payload) && typeof payload.toolCallId === 'string' ? payload.toolCallId : undefined;

const resolveToolName = (payload: unknown): string | null =>
    isRecord(payload) && typeof payload.toolName === 'string' ? payload.toolName : null;

const resolveTargetEntryId = (payload: unknown): string | null =>
    isRecord(payload) && typeof payload.targetEntryId === 'string' ? payload.targetEntryId : null;

const isErrorPayload = (payload: unknown): boolean =>
    isRecord(payload) && payload.isError === true;

const extractText = (payload: unknown): string => {
    if (!isRecord(payload)) return '';
    if (typeof payload.text === 'string') return payload.text;
    return '';
};

const stringifyPayload = (payload: unknown): string | null => {
    if (!isRecord(payload)) return null;
    try {
        return JSON.stringify(payload, null, 2);
    } catch {
        return null;
    }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;
