import type { ForgeModelRole } from './ForgeContextTypes.js';
import type { ForgeLayer } from './ForgeStructuredTypes.js';

export type ForgeTimelineOperationKind =
    | 'analysis'
    | 'plan'
    | 'execution'
    | 'workspace_write'
    | 'context_read'
    | 'memory_update'
    | 'gate'
    | 'user_action'
    | 'system';

export type ForgeTimelineOperationStatus =
    | 'running'
    | 'completed'
    | 'blocked'
    | 'failed'
    | 'cancelled';

/** 操作子步骤（Codex 风格嵌套展示） */
export interface ForgeOperationSubStep {
    id: string;
    label: string;
    status: ForgeTimelineOperationStatus;
    detail?: string;
    timestamp: number;
}

export interface ForgeTimelineMessageItem {
    id: string;
    kind: 'message';
    messageId: string;
    createdAt: number;
    updatedAt: number;
}

export interface ForgeTimelineOperationItem {
    id: string;
    kind: 'operation';
    operationKind: ForgeTimelineOperationKind;
    status: ForgeTimelineOperationStatus;
    title: string;
    summary: string;
    detail?: string | null;
    sourceTag?: string | null;
    dedupeKey?: string | null;
    targetEntryId?: string | null;
    relatedMessageId?: string | null;
    layer?: ForgeLayer | null;
    requestPrompt?: any[] | null;
    role?: ForgeModelRole;
    subSteps?: ForgeOperationSubStep[];
    createdAt: number;
    updatedAt: number;
    completedAt?: number | null;
}

export type ForgeTimelineItem = ForgeTimelineMessageItem | ForgeTimelineOperationItem;
