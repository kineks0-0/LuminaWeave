import { defineStore } from 'pinia';
import type {
    ForgeTimelineItem,
    ForgeTimelineOperationItem,
    ForgeTimelineOperationKind,
    ForgeTimelineOperationStatus
} from '../types/ForgeTimelineTypes.js';
import type { StagingEntry } from '../types/ForgeRuntimeTypes.js';

export const useForgeStore = defineStore('forge', {
    state: () => ({
        // Forge 统一时间线：消息与执行事件统一按时间顺序展示
        timelineItems: [] as ForgeTimelineItem[],
        // 暂存区：等待用户批准的修改
        stagingArea: [] as StagingEntry[],
        // 写回准备区：已通过本轮审阅，等待最终提交
        commitReadyEntries: [] as StagingEntry[],
        // 当前制卡会话 ID
        currentSessionId: null as string | null,
        // 是否正在进行制卡任务
        isProcessing: false,
    }),

    actions: {
        replaceTimelineItems(items: ForgeTimelineItem[]) {
            this.timelineItems = [...items].sort((left, right) => {
                if (left.createdAt === right.createdAt) {
                    return left.id.localeCompare(right.id);
                }
                return left.createdAt - right.createdAt;
            });
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
            this.isProcessing = false;
        }
    }
});
