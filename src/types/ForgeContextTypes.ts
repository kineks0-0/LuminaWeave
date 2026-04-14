import type { CleanedMessage } from './nexus.js';
import type { ForgeMemoryEntry, ForgeMemoryTree } from './ForgeMemoryTypes.js';
import type { StagingEntry } from './ForgeRuntimeTypes.js';
import type { ForgeDraftTree, ForgeLayer, ForgeStructuredState } from './ForgeStructuredTypes.js';
import type { ForgeWorkflowSnapshot } from './ForgeWorkflowTypes.js';
import type { ForgeVirtualLorebookEntry } from './SessionTypes.js';

/** 模型角色标识 */
export type ForgeModelRole = 'main' | 'analyst' | 'executor';

/** 主模型上下文 — 面向用户交互，世界书只拿概述 */
export interface ForgeMainModelContext {
    role: 'main';
    conversationMessages: CleanedMessage[];
    memoryTree: ForgeMemoryTree;
    workflowSnapshot: ForgeWorkflowSnapshot;
    structuredState: ForgeStructuredState;
    draftTree: ForgeDraftTree;
    lorebookOverview: string;
    stagingEntries: StagingEntry[];
    commitReadyEntries: StagingEntry[];
}

/** 分析者上下文 — 隔离读取，截断历史 */
export interface ForgeAnalystContext {
    role: 'analyst';
    memoryTree: ForgeMemoryTree;
    recentHistory: CleanedMessage[];
    requestedEntries: ForgeVirtualLorebookEntry[];
    handoffTarget: string;
}

/** 执行者任务描述 */
export interface ForgeExecutorTask {
    instruction: string;
    targetEntryId: string;
    originalContent: string;
    entryType: string;
    description: string;
    layer: ForgeLayer;
}

/** 执行者上下文 — 定向任务，记忆只看意图相关片段 */
export interface ForgeExecutorContext {
    role: 'executor';
    task: ForgeExecutorTask;
    filteredMemory: ForgeMemoryEntry[];
}

/** 三角色上下文联合类型 */
export type ForgeRoleContext =
    | ForgeMainModelContext
    | ForgeAnalystContext
    | ForgeExecutorContext;
