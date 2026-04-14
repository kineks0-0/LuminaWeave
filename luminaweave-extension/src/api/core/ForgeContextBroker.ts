import type { ForgeVirtualLorebookEntry } from '../../types/SessionTypes.js';
import type { StagingEntry } from '../../types/ForgeRuntimeTypes.js';
import type { ForgeDraftTree, ForgeStructuredState, ForgeLayer } from '../../types/ForgeStructuredTypes.js';
import type { ForgeMemoryTree, ForgeMemoryEntry } from '../../types/ForgeMemoryTypes.js';
import type { ForgeWorkflowSnapshot } from '../../types/ForgeWorkflowTypes.js';
import type { CleanedMessage } from '../../types/nexus.js';
import type {
    ForgeMainModelContext,
    ForgeAnalystContext,
    ForgeExecutorContext,
    ForgeExecutorTask
} from '../../types/ForgeContextTypes.js';
import { findVirtualLorebookEntry } from './utils/forgeVirtualLorebook.js';

// ────────────────── Types ──────────────────

export interface OriginalContentSources {
    virtualLorebookEntries: ForgeVirtualLorebookEntry[];
    commitReadyEntries: StagingEntry[];
    stagingEntries: StagingEntry[];
    draftTree: ForgeDraftTree;
}

// ────────────────── Core Lookup ──────────────────

/**
 * 统一 4 源原始内容查找。
 * 查找优先级：虚拟世界书 > commitReady > staging > draftTree
 */
export function resolveOriginalContent(
    targetEntryId: string | null,
    sources: OriginalContentSources
): string {
    if (!targetEntryId) return '';

    const virtualEntry = findVirtualLorebookEntry(sources.virtualLorebookEntries, targetEntryId);
    if (virtualEntry?.entry.content) {
        return virtualEntry.entry.content;
    }

    const commitReadyEntry = sources.commitReadyEntries.find(item => item.targetEntryId === targetEntryId);
    if (commitReadyEntry?.originalContent) {
        return commitReadyEntry.originalContent;
    }

    const stagingEntry = sources.stagingEntries.find(item => item.targetEntryId === targetEntryId);
    if (stagingEntry?.originalContent) {
        return stagingEntry.originalContent;
    }

    const draftNode = sources.draftTree.nodes.find(node =>
        node.sourceEntryId === targetEntryId ||
        node.id === targetEntryId
    );
    return draftNode?.content || '';
}

// ────────────────── Role Context Builders ──────────────────

export function buildMainModelContext(params: {
    conversationMessages: CleanedMessage[];
    memoryTree: ForgeMemoryTree;
    workflowSnapshot: ForgeWorkflowSnapshot;
    structuredState: ForgeStructuredState;
    draftTree: ForgeDraftTree;
    lorebookOverview: string;
    stagingEntries: StagingEntry[];
    commitReadyEntries: StagingEntry[];
}): ForgeMainModelContext {
    return {
        role: 'main',
        conversationMessages: params.conversationMessages,
        memoryTree: params.memoryTree,
        workflowSnapshot: params.workflowSnapshot,
        structuredState: params.structuredState,
        draftTree: params.draftTree,
        lorebookOverview: params.lorebookOverview,
        stagingEntries: params.stagingEntries,
        commitReadyEntries: params.commitReadyEntries
    };
}

export function buildAnalystContext(params: {
    memoryTree: ForgeMemoryTree;
    recentHistory: CleanedMessage[];
    requestedEntries: ForgeVirtualLorebookEntry[];
    handoffTarget: string;
    maxRecentMessages?: number;
}): ForgeAnalystContext {
    const maxMessages = params.maxRecentMessages ?? 10;
    return {
        role: 'analyst',
        memoryTree: params.memoryTree,
        recentHistory: params.recentHistory.slice(-maxMessages),
        requestedEntries: params.requestedEntries,
        handoffTarget: params.handoffTarget
    };
}

export function buildExecutorContext(params: {
    task: ForgeExecutorTask;
    memoryTree: ForgeMemoryTree;
    activeLayer: ForgeLayer;
}): ForgeExecutorContext {
    const filteredMemory = filterMemoryForExecutor(params.memoryTree, params.activeLayer);
    return {
        role: 'executor',
        task: params.task,
        filteredMemory
    };
}

/**
 * 为 executor 角色过滤记忆：
 * - AUTO/Checklist（系统进度清单）
 * - session/*（会话记忆）
 * - intent/*（意图记忆）
 * - user/*（用户偏好记忆）
 * - activeLayer/*（当前层级相关记忆）
 */
function filterMemoryForExecutor(
    memoryTree: ForgeMemoryTree,
    activeLayer: ForgeLayer
): ForgeMemoryEntry[] {
    const allowedPrefixes = [
        'AUTO/',
        'session/',
        'intent/',
        'user/',
        '启动/',
        '约束/',
        '设定决议/',
        `${activeLayer}/`
    ];

    return memoryTree.entries.filter(entry =>
        allowedPrefixes.some(prefix => entry.path.startsWith(prefix)) ||
        entry.source === 'user' ||
        entry.source === 'system'
    );
}
