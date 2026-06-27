import { defineStore } from 'pinia';
import type {
    ForgeTimelineItem,
    ForgeTimelineOperationItem,
    ForgeTimelineOperationKind,
    ForgeTimelineOperationStatus
} from '../types/ForgeTimelineTypes.js';
import type {
    ForgeModelRequestTrace,
    ForgeModelRequestToolEvent,
    ForgeModelRequestToolSummary,
    ForgeModelRequestStatus,
    ForgeToolApprovalRequest,
    StagingEntry
} from '../types/ForgeRuntimeTypes.js';
import type {
    ForgePiContextBundleSummary,
    ForgePiPersistedSessionState,
    ForgePiSessionEntry,
    ForgePiTreeNode
} from '@shared/ForgePiTypes.js';
import type { AgentRuntimeSnapshot } from '../api/core/agent-runtime/events/AgentRuntimeEventBus.js';

const clonePiPayload = <TPayload>(payload: TPayload): TPayload => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return payload;
    }
    return { ...(payload as Record<string, unknown>) } as TPayload;
};

const clonePiEntry = (entry: ForgePiSessionEntry): ForgePiSessionEntry => ({
    ...entry,
    payload: clonePiPayload(entry.payload)
});

const clonePiTreeNode = (node: ForgePiTreeNode): ForgePiTreeNode => ({
    ...node,
    payload: clonePiPayload(node.payload),
    children: node.children?.map(clonePiTreeNode) ?? []
});

const cloneAgentRuntimeSnapshot = (snapshot: AgentRuntimeSnapshot): AgentRuntimeSnapshot =>
    JSON.parse(JSON.stringify(snapshot)) as AgentRuntimeSnapshot;

const buildPiTreeFromEntries = (entries: ForgePiSessionEntry[]): ForgePiTreeNode[] => {
    const byId = new Map<string, ForgePiTreeNode>();
    const roots: ForgePiTreeNode[] = [];
    entries.forEach((entry) => {
        byId.set(entry.id, { ...clonePiEntry(entry), children: [] });
    });
    entries.forEach((entry) => {
        const node = byId.get(entry.id);
        if (!node) return;
        if (!entry.parentId) {
            roots.push(node);
            return;
        }
        const parent = byId.get(entry.parentId);
        if (parent) {
            parent.children = [...(parent.children ?? []), node];
        } else {
            roots.push(node);
        }
    });
    return roots;
};

export const useForgeStore = defineStore('forge', {
    state: () => ({
        // Forge 统一时间线：消息与执行事件统一按时间顺序展示
        timelineItems: [] as ForgeTimelineItem[],
        // 暂存区：等待用户批准的修改
        stagingArea: [] as StagingEntry[],
        // 写回准备区：已通过本轮审阅，等待最终提交
        commitReadyEntries: [] as StagingEntry[],
        // Forge 模型请求调试 trace（瞬态，不持久化）
        modelRequestTraces: [] as ForgeModelRequestTrace[],
        activeModelRequestTraceId: null as string | null,
  // Legacy staging queues for manual export/publish flows; AI project writes now use project VFS plus Git history.
        toolApprovals: [] as ForgeToolApprovalRequest[],
        // Forge pi-core runtime tree/context state（由前端 pi-agent-core 浏览器适配层派生）
        piSessionTree: [] as ForgePiTreeNode[],
        piSessionEntries: [] as ForgePiSessionEntry[],
        activePiNodeId: null as string | null,
        piContextBundleSummary: null as ForgePiContextBundleSummary | null,
        piLoadedSkills: [] as string[],
        piLoadedExtensions: [] as string[],
        agentRuntimeSnapshot: null as AgentRuntimeSnapshot | null,
        // 当前制卡会话 ID
        currentSessionId: null as string | null,
        // 是否正在进行制卡任务
        isProcessing: false,
    }),

    getters: {
        pendingToolApprovals: (state): ForgeToolApprovalRequest[] =>
            state.toolApprovals.filter(item => item.status === 'pending'),
        composerToolApprovals: (state): ForgeToolApprovalRequest[] =>
            state.toolApprovals.filter(item => item.status === 'pending' && item.displaySurface === 'composer'),
        composerToolApprovalsForSession: (state): ((input: {
            forgeProjectId?: string | null;
            conversationId?: string | null;
        }) => ForgeToolApprovalRequest[]) =>
            (input) => state.toolApprovals.filter(item =>
                item.status === 'pending'
                && item.displaySurface === 'composer'
                && item.forgeProjectId === (input.forgeProjectId ?? null)
                && item.conversationId === (input.conversationId ?? null)
            ),
        reviewToolApprovals: (state): ForgeToolApprovalRequest[] =>
            state.toolApprovals.filter(item =>
                item.status === 'pending' && (item.displaySurface ?? 'review') === 'review'
            )
    },

    actions: {
        replaceTrace(trace: ForgeModelRequestTrace) {
            const existingIndex = this.modelRequestTraces.findIndex(item => item.id === trace.id);
            if (existingIndex >= 0) {
                this.modelRequestTraces.splice(existingIndex, 1);
            }
            this.modelRequestTraces.push(trace);
        },

        replaceTimelineItems(items: ForgeTimelineItem[]) {
            this.timelineItems = [...items].sort((left, right) => {
                if (left.createdAt === right.createdAt) {
                    return left.id.localeCompare(right.id);
                }
                return left.createdAt - right.createdAt;
            });
        },

        createModelRequestTrace(payload: ForgeModelRequestTrace) {
            this.replaceTrace({
                ...payload,
                toolEvents: payload.toolEvents ?? [],
                piModelTraces: payload.piModelTraces ?? [],
                agentRuntimeSnapshot: payload.agentRuntimeSnapshot
                    ? cloneAgentRuntimeSnapshot(payload.agentRuntimeSnapshot)
                    : null
            });
            this.activeModelRequestTraceId = payload.id;
            return payload;
        },

        setActiveModelRequestTrace(requestId: string | null) {
            this.activeModelRequestTraceId = requestId;
        },

        markModelRequestFirstResponse(requestId: string, firstResponseAt = Date.now()) {
            const index = this.modelRequestTraces.findIndex(item => item.id === requestId);
            if (index < 0) return;
            const existing = this.modelRequestTraces[index];
            this.replaceTrace({
                ...existing,
                status: existing.status === 'completed' || existing.status === 'failed' || existing.status === 'aborted'
                    ? existing.status
                    : 'streaming',
                firstResponseAt: existing.firstResponseAt ?? firstResponseAt
            });
        },

        updateModelRequestStream(payload: {
            requestId: string;
            responseRaw: string;
            responseDisplay: string;
            responseThinking: string;
            status?: ForgeModelRequestStatus;
        }) {
            const index = this.modelRequestTraces.findIndex(item => item.id === payload.requestId);
            if (index < 0) return;
            const existing = this.modelRequestTraces[index];
            this.replaceTrace({
                ...existing,
                status: payload.status ?? 'streaming',
                responseRaw: payload.responseRaw,
                responseDisplay: payload.responseDisplay,
                responseThinking: payload.responseThinking
            });
        },

        completeModelRequestTrace(payload: {
            requestId: string;
            responseRaw: string;
            responseDisplay: string;
            responseThinking: string;
            completedAt?: number;
        }) {
            const index = this.modelRequestTraces.findIndex(item => item.id === payload.requestId);
            if (index < 0) return;
            const existing = this.modelRequestTraces[index];
            this.replaceTrace({
                ...existing,
                status: 'completed',
                responseRaw: payload.responseRaw,
                responseDisplay: payload.responseDisplay,
                responseThinking: payload.responseThinking,
                completedAt: payload.completedAt ?? Date.now(),
                errorMessage: null
            });
        },

        failModelRequestTrace(requestId: string, message: string) {
            const index = this.modelRequestTraces.findIndex(item => item.id === requestId);
            if (index < 0) return;
            const existing = this.modelRequestTraces[index];
            this.replaceTrace({
                ...existing,
                status: 'failed',
                completedAt: existing.completedAt ?? Date.now(),
                errorMessage: message
            });
        },

        appendModelRequestToolEvent(requestId: string, event: ForgeModelRequestToolEvent) {
            const index = this.modelRequestTraces.findIndex(item => item.id === requestId);
            if (index < 0) return;
            const existing = this.modelRequestTraces[index];
            const toolEvents = [...(existing.toolEvents ?? []), event]
                .sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id));
            this.replaceTrace({
                ...existing,
                toolEvents
            });
        },

        setModelRequestToolSetSummary(requestId: string, tools: ForgeModelRequestToolSummary[]) {
            const index = this.modelRequestTraces.findIndex(item => item.id === requestId);
            if (index < 0) return;
            const existing = this.modelRequestTraces[index];
            this.replaceTrace({
                ...existing,
                toolSetSummary: tools.map(tool => ({ ...tool }))
            });
        },

        setModelRequestPiTrace(requestId: string, trace: ForgeModelRequestTrace['piModelTrace']) {
            const index = this.modelRequestTraces.findIndex(item => item.id === requestId);
            if (index < 0 || !trace) return;
            const existing = this.modelRequestTraces[index];
            const piModelTraces = [...(existing.piModelTraces ?? [])];
            const traceIndex = piModelTraces.findIndex(item => item.traceId === trace.traceId);
            if (traceIndex >= 0) {
                piModelTraces.splice(traceIndex, 1, trace);
            } else {
                piModelTraces.push(trace);
            }
            this.replaceTrace({
                ...existing,
                piModelTrace: trace,
                piModelTraces
            });
        },

        setAgentRuntimeSnapshot(payload: {
            requestId?: string | null;
            snapshot: AgentRuntimeSnapshot;
        }) {
            const snapshot = cloneAgentRuntimeSnapshot(payload.snapshot);
            this.agentRuntimeSnapshot = snapshot;
            const requestId = payload.requestId ?? this.activeModelRequestTraceId;
            if (!requestId) return;
            const index = this.modelRequestTraces.findIndex(item => item.id === requestId);
            if (index < 0) return;
            const existing = this.modelRequestTraces[index];
            this.replaceTrace({
                ...existing,
                agentRuntimeSnapshot: cloneAgentRuntimeSnapshot(snapshot)
            });
        },

        upsertToolApproval(approval: ForgeToolApprovalRequest) {
            const existingIndex = this.toolApprovals.findIndex(item => item.toolCallId === approval.toolCallId);
            const next: ForgeToolApprovalRequest = {
                ...approval,
                status: approval.status || 'pending',
                resolvedAt: approval.resolvedAt ?? null,
                message: approval.message ?? null,
                displaySurface: approval.displaySurface ?? 'review',
                approvalKind: approval.approvalKind ?? 'tool',
                shellPermissionRequestId: approval.shellPermissionRequestId ?? null,
                forgeProjectId: approval.forgeProjectId ?? null,
                conversationId: approval.conversationId ?? null,
                sessionId: approval.sessionId ?? null
            };

            if (existingIndex >= 0) {
                this.toolApprovals.splice(existingIndex, 1, {
                    ...this.toolApprovals[existingIndex],
                    ...next
                });
                return;
            }

            this.toolApprovals.push(next);
        },

        resolveToolApproval(toolCallId: string, approved: boolean, message?: string) {
            const existingIndex = this.toolApprovals.findIndex(item => item.toolCallId === toolCallId);
            if (existingIndex < 0) return;
            const existing = this.toolApprovals[existingIndex];
            this.toolApprovals.splice(existingIndex, 1, {
                ...existing,
                status: approved ? 'approved' : 'rejected',
                resolvedAt: Date.now(),
                message: message ?? existing.message ?? null
            });
        },

        setForgePiSessionState(payload: {
            tree: ForgePiTreeNode[];
            entries?: ForgePiSessionEntry[];
            activeNodeId: string | null;
            contextBundleSummary?: ForgePiContextBundleSummary | null;
            loadedExtensions?: string[];
        }) {
            this.piSessionTree = payload.tree.map(clonePiTreeNode);
            this.piSessionEntries = (payload.entries ?? []).map(clonePiEntry);
            this.activePiNodeId = payload.activeNodeId;
            this.piContextBundleSummary = payload.contextBundleSummary
                ? {
                    files: payload.contextBundleSummary.files.map(file => ({ ...file })),
                    activeSkills: [...payload.contextBundleSummary.activeSkills],
                    loadedExtensions: [...payload.contextBundleSummary.loadedExtensions]
                }
                : null;
            this.piLoadedSkills = [...(payload.contextBundleSummary?.activeSkills ?? [])];
            this.piLoadedExtensions = [...(payload.loadedExtensions ?? payload.contextBundleSummary?.loadedExtensions ?? [])];
        },

        setForgePiPersistedSessionState(payload: ForgePiPersistedSessionState | null | undefined) {
            if (!payload) {
                this.piSessionEntries = [];
                this.piSessionTree = [];
                this.activePiNodeId = null;
                this.piContextBundleSummary = null;
                this.piLoadedSkills = [];
                this.piLoadedExtensions = [];
                this.agentRuntimeSnapshot = null;
                return;
            }
            this.piSessionEntries = payload.entries.map(clonePiEntry);
            this.piSessionTree = buildPiTreeFromEntries(payload.entries);
            this.activePiNodeId = payload.activeNodeId;
            this.piContextBundleSummary = payload.contextBundleSummary
                ? {
                    files: payload.contextBundleSummary.files.map(file => ({ ...file })),
                    activeSkills: [...payload.contextBundleSummary.activeSkills],
                    loadedExtensions: [...payload.contextBundleSummary.loadedExtensions]
                }
                : null;
            this.piLoadedSkills = [...(payload.contextBundleSummary?.activeSkills ?? [])];
            this.piLoadedExtensions = [...(payload.loadedExtensions ?? payload.contextBundleSummary?.loadedExtensions ?? [])];
        },

        abortModelRequestTrace(requestId: string) {
            const index = this.modelRequestTraces.findIndex(item => item.id === requestId);
            if (index < 0) return;
            const existing = this.modelRequestTraces[index];
            this.replaceTrace({
                ...existing,
                status: 'aborted',
                completedAt: existing.completedAt ?? Date.now()
            });
        },

        clearModelRequestTraces() {
            this.modelRequestTraces = [];
            this.activeModelRequestTraceId = null;
        },

        ensureMessageTimelineItem(messageId: string, createdAt: number) {
            const existingIndex = this.timelineItems.findIndex(item => item.kind === 'message' && item.messageId === messageId);
            if (existingIndex >= 0) {
                const existing = this.timelineItems[existingIndex];
                this.timelineItems.splice(existingIndex, 1, {
                    ...existing,
                    updatedAt: createdAt
                });
                return;
            }

            this.timelineItems.push({
                id: `forge_msg_${messageId}`,
                kind: 'message',
                messageId,
                createdAt,
                updatedAt: createdAt
            });
        },

        addOperationTimelineItem(payload: {
            operationKind: ForgeTimelineOperationKind;
            status: ForgeTimelineOperationStatus;
            title: string;
            summary: string;
            detail?: string | null;
            sourceTag?: string | null;
            dedupeKey?: string | null;
            targetEntryId?: string | null;
            relatedMessageId?: string | null;
            layer?: string | null;
            completedAt?: number | null;
        }): ForgeTimelineOperationItem {
            const now = Date.now();
            const item: ForgeTimelineOperationItem = {
                id: Math.random().toString(36).substring(2, 11),
                kind: 'operation',
                operationKind: payload.operationKind,
                status: payload.status,
                title: payload.title,
                summary: payload.summary,
                detail: payload.detail || null,
                sourceTag: payload.sourceTag || null,
                dedupeKey: payload.dedupeKey || null,
                targetEntryId: payload.targetEntryId || null,
                relatedMessageId: payload.relatedMessageId || null,
                layer: (payload.layer as ForgeTimelineOperationItem['layer']) || null,
                createdAt: now,
                updatedAt: now,
                completedAt: payload.completedAt ?? (payload.status === 'completed' ? now : null)
            };
            this.timelineItems.push(item);
            return item;
        },

        upsertRunningOperation(payload: {
            dedupeKey: string;
            operationKind: ForgeTimelineOperationKind;
            title: string;
            summary: string;
            detail?: string | null;
            sourceTag?: string | null;
            targetEntryId?: string | null;
            relatedMessageId?: string | null;
            layer?: string | null;
        }): ForgeTimelineOperationItem {
            const existingIndex = this.timelineItems.findIndex(item =>
                item.kind === 'operation' &&
                item.dedupeKey === payload.dedupeKey &&
                item.status === 'running'
            );

            if (existingIndex >= 0) {
                const existing = this.timelineItems[existingIndex] as ForgeTimelineOperationItem;
                const next: ForgeTimelineOperationItem = {
                    ...existing,
                    operationKind: payload.operationKind,
                    title: payload.title,
                    summary: payload.summary,
                    detail: payload.detail ?? existing.detail ?? null,
                    sourceTag: payload.sourceTag ?? existing.sourceTag ?? null,
                    targetEntryId: payload.targetEntryId ?? existing.targetEntryId ?? null,
                    relatedMessageId: payload.relatedMessageId ?? existing.relatedMessageId ?? null,
                    layer: (payload.layer as ForgeTimelineOperationItem['layer']) ?? existing.layer ?? null,
                    updatedAt: Date.now()
                };
                this.timelineItems.splice(existingIndex, 1, next);
                return next;
            }

            return this.addOperationTimelineItem({
                ...payload,
                status: 'running'
            });
        },

        completeOperationByKey(payload: {
            dedupeKey: string;
            operationKind: ForgeTimelineOperationKind;
            title: string;
            summary: string;
            detail?: string | null;
            sourceTag?: string | null;
            targetEntryId?: string | null;
            relatedMessageId?: string | null;
            layer?: string | null;
        }): ForgeTimelineOperationItem {
            const activeIndex = this.timelineItems.findIndex(item =>
                item.kind === 'operation' &&
                item.dedupeKey === payload.dedupeKey &&
                item.status === 'running'
            );

            if (activeIndex >= 0) {
                const existing = this.timelineItems[activeIndex] as ForgeTimelineOperationItem;
                const now = Date.now();
                const next: ForgeTimelineOperationItem = {
                    ...existing,
                    operationKind: payload.operationKind,
                    status: 'completed',
                    title: payload.title,
                    summary: payload.summary,
                    detail: payload.detail ?? existing.detail ?? null,
                    sourceTag: payload.sourceTag ?? existing.sourceTag ?? null,
                    targetEntryId: payload.targetEntryId ?? existing.targetEntryId ?? null,
                    relatedMessageId: payload.relatedMessageId ?? existing.relatedMessageId ?? null,
                    layer: (payload.layer as ForgeTimelineOperationItem['layer']) ?? existing.layer ?? null,
                    updatedAt: now,
                    completedAt: now
                };
                this.timelineItems.splice(activeIndex, 1, next);
                return next;
            }

            const existingCompletedIndex = [...this.timelineItems].reverse().findIndex(item =>
                item.kind === 'operation' &&
                item.dedupeKey === payload.dedupeKey &&
                item.status === 'completed' &&
                item.title === payload.title &&
                item.summary === payload.summary &&
                (item.detail || null) === (payload.detail || null) &&
                (item.sourceTag || null) === (payload.sourceTag || null) &&
                (item.targetEntryId || null) === (payload.targetEntryId || null)
            );

            if (existingCompletedIndex >= 0) {
                const actualIndex = this.timelineItems.length - 1 - existingCompletedIndex;
                const existing = this.timelineItems[actualIndex] as ForgeTimelineOperationItem;
                return existing;
            }

            return this.addOperationTimelineItem({
                ...payload,
                status: 'completed'
            });
        },

        /**
         * 将所有仍处于 running 状态的操作条目标记为 failed。
         * 在命令调度结束（无论成功或异常）的 finally 块中调用，
         * 防止超时/报错时操作状态永远停留在"进行中"。
         */
        failRunningOperations(reason?: string) {
            const now = Date.now();
            this.timelineItems.forEach((item, index) => {
                if (item.kind !== 'operation') return;
                const op = item as ForgeTimelineOperationItem;
                if (op.status !== 'running') return;
                this.timelineItems.splice(index, 1, {
                    ...op,
                    status: 'failed' as ForgeTimelineOperationStatus,
                    detail: reason ? `${op.detail ?? ''}（${reason}）`.trim() : op.detail,
                    updatedAt: now,
                    completedAt: now
                });
            });
        },

        updateOperationPrompt(dedupeKey: string, prompt: any[]) {
            const index = this.timelineItems.findIndex(item =>
                item.kind === 'operation' &&
                item.dedupeKey === dedupeKey
            );
            if (index >= 0) {
                const existing = this.timelineItems[index] as ForgeTimelineOperationItem;
                this.timelineItems.splice(index, 1, {
                    ...existing,
                    requestPrompt: prompt,
                    updatedAt: Date.now()
                });
            }
        },

        addToStaging(entry: Omit<StagingEntry, 'id' | 'timestamp'>) {
            this.stagingArea.push({
                ...entry,
                id: Math.random().toString(36).substring(2, 9),
                timestamp: Date.now(),
                layer: entry.layer || null,
                sourceTag: entry.sourceTag || null,
                sourceMessageId: entry.sourceMessageId || null,
                sourceSessionId: entry.sourceSessionId || null
            });
        },

        upsertStagingEntry(entry: Omit<StagingEntry, 'id' | 'timestamp'> & Partial<Pick<StagingEntry, 'id' | 'timestamp'>>) {
            const existingIndex = this.stagingArea.findIndex(item => item.targetEntryId === entry.targetEntryId);
            const nextEntry: StagingEntry = {
                ...entry,
                id: entry.id || (existingIndex >= 0
                    ? this.stagingArea[existingIndex].id
                    : Math.random().toString(36).substring(2, 9)),
                operation: entry.operation || this.stagingArea[existingIndex]?.operation || 'upsert',
                timestamp: entry.timestamp || Date.now(),
                layer: entry.layer || this.stagingArea[existingIndex]?.layer || null,
                sourceTag: entry.sourceTag || this.stagingArea[existingIndex]?.sourceTag || null,
                sourceMessageId: entry.sourceMessageId || this.stagingArea[existingIndex]?.sourceMessageId || null,
                sourceSessionId: entry.sourceSessionId || this.stagingArea[existingIndex]?.sourceSessionId || null
            };

            if (existingIndex >= 0) {
                this.stagingArea.splice(existingIndex, 1, nextEntry);
                return;
            }

            this.stagingArea.push(nextEntry);
        },

        removeFromStaging(id: string) {
            this.stagingArea = this.stagingArea.filter(e => e.id !== id);
        },

        moveToCommitReady(id: string) {
            const entry = this.stagingArea.find(e => e.id === id);
            if (!entry) return;
            this.stagingArea = this.stagingArea.filter(e => e.id !== id);
            this.commitReadyEntries.push({ ...entry });
        },

        moveBackToStaging(id: string) {
            const entry = this.commitReadyEntries.find(e => e.id === id);
            if (!entry) return;
            this.commitReadyEntries = this.commitReadyEntries.filter(e => e.id !== id);
            this.stagingArea.push({ ...entry });
        },

        removeFromCommitReady(id: string) {
            this.commitReadyEntries = this.commitReadyEntries.filter(e => e.id !== id);
        },

        clearAll() {
            this.timelineItems = [];
            this.stagingArea = [];
            this.commitReadyEntries = [];
            this.toolApprovals = [];
            this.piSessionTree = [];
            this.piSessionEntries = [];
            this.activePiNodeId = null;
            this.piContextBundleSummary = null;
            this.piLoadedSkills = [];
            this.piLoadedExtensions = [];
            this.agentRuntimeSnapshot = null;
            this.clearModelRequestTraces();
            this.isProcessing = false;
        }
    }
});
