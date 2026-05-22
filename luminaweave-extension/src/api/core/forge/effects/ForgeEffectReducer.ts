import type {
    ForgeCollectionMode,
    ForgeDetailMode,
    ForgeEntryMode,
    ForgeLayer
} from '../../../../types/ForgeStructuredTypes.js';
import type { ForgeMemorySource } from '../../../../types/ForgeMemoryTypes.js';
import type {
    ForgeRuntimeEffect,
    ForgePiModelRequestTrace,
    ForgeModelRequestToolEvent,
    ForgeModelRequestToolSummary,
    ForgeToolApprovalRequest,
    StagingEntry
} from '../../../../types/ForgeRuntimeTypes.js';
import type {
    ForgePiContextBundleSummary,
    ForgePiTreeNode
} from '@shared/ForgePiTypes.js';
import { annotateSuspiciousStagingEntry } from './ForgeStagingSafety.js';
import type {
    ForgeTimelineOperationKind,
    ForgeTimelineOperationStatus
} from '../../../../types/ForgeTimelineTypes.js';

export interface ForgeEffectTarget {
    // --- 消息 ---
    addAssistantViewMessage(content: string): void;
    createAndAppendUserMessage(content: string): void;

    // --- Timeline 操作 ---
    upsertRunningOperation(payload: {
        dedupeKey: string;
        operationKind: ForgeTimelineOperationKind;
        title: string;
        summary: string;
        detail?: string | null;
        sourceTag?: string | null;
        targetEntryId?: string | null;
        relatedMessageId?: string | null;
        layer?: ForgeLayer | null;
    }): void;
    completeOperationByKey(payload: {
        dedupeKey: string;
        operationKind: ForgeTimelineOperationKind;
        title: string;
        summary: string;
        detail?: string | null;
        sourceTag?: string | null;
        targetEntryId?: string | null;
        relatedMessageId?: string | null;
        layer?: ForgeLayer | null;
    }): void;
    addOperationTimelineItem(payload: {
        operationKind: ForgeTimelineOperationKind;
        status: ForgeTimelineOperationStatus;
        title: string;
        summary: string;
        detail?: string | null;
        sourceTag?: string | null;
        layer?: ForgeLayer | null;
    }): void;
    updateOperationPrompt(dedupeKey: string, prompt: unknown[]): void;
    setActiveModelRequestTrace(requestId: string | null): void;
    markModelRequestFirstResponse(requestId: string, firstResponseAt?: number): void;
    updateModelRequestStream(payload: {
        requestId: string;
        responseRaw: string;
        responseDisplay: string;
        responseThinking: string;
    }): void;
    completeModelRequestTrace(payload: {
        requestId: string;
        responseRaw: string;
        responseDisplay: string;
        responseThinking: string;
        completedAt?: number;
    }): void;
    failModelRequestTrace(requestId: string, message: string): void;
    appendModelRequestToolEvent(requestId: string, event: ForgeModelRequestToolEvent): void;
    setModelRequestToolSetSummary(requestId: string, tools: ForgeModelRequestToolSummary[]): void;
    setModelRequestPiTrace(requestId: string, trace: ForgePiModelRequestTrace): void;
    setForgePiSessionState(payload: {
        tree: ForgePiTreeNode[];
        activeNodeId: string | null;
        contextBundleSummary?: ForgePiContextBundleSummary | null;
        loadedExtensions?: string[];
    }): void;
    upsertToolApproval(approval: ForgeToolApprovalRequest): void;
    resolveToolApproval(toolCallId: string, approved: boolean, message?: string): void;

    // --- 模式 & 状态 ---
    setEntryMode(mode: ForgeEntryMode): void;
    setDetailMode(mode: ForgeDetailMode): void;
    setCollectionMode(mode: ForgeCollectionMode): void;
    /**
     * 设置活跃层，并视条件生成表单 DSL 消息。
     * 内部判断是否跳过 kickoff 表单。
     */
    setActiveLayerAndEmitForm(layer: ForgeLayer): void;

    // --- 结构化表单 ---
    prefillStructuredForm(payload: {
        formId?: string | null;
        layer?: ForgeLayer | null;
        fields: Array<{ fieldKey: string; value: string | string[] }>;
        overwrite?: boolean;
    }): void;
    applySubmittedFormResult(formId: string): void;

    // --- 记忆 ---
    upsertForgeMemory(path: string, title: string, content: string, source: ForgeMemorySource, summary?: string): void;
    removeForgeMemory(path: string): void;
    upsertVirtualLorebookEntry(payload: { id?: string; entry: LuminaLorebookEntry; sourceBookId?: string | null }): string;
    removeVirtualLorebookEntry(id: string): boolean;

    // --- 暂存区 & 世界书 ---
    upsertStagingEntry(entry: Omit<StagingEntry, 'id' | 'timestamp'> & { id?: string; timestamp?: number }): void;
    autoMergeEntryToVirtualLorebook(entry: Omit<StagingEntry, 'id' | 'timestamp'> & { id?: string; timestamp?: number }): void;
    moveStagingToCommitReady(stagingId: string): void;
    removeStagingEntry(stagingId: string): void;
    moveCommitReadyToStaging(entryId: string): void;
    syncDraftTree(): void;
    freezeWorkspace(): Promise<void>;

    // --- 参考聊天 ---
    setReferenceChat(chatSessionId: string | null): void;

    // --- 工作流 & 持久化 ---
    refreshWorkflowSnapshot(userInput?: string): Promise<void>;
    persistSession(): void;

    // --- 查询 ---
    getActiveLayer(): ForgeLayer;
}

export async function applyForgeEffects(
    effects: ForgeRuntimeEffect[],
    target: ForgeEffectTarget
): Promise<void> {
    let projectResourceWriteSinceLastPersist = false;
    const markProjectResourceWrite = (): void => {
        projectResourceWriteSinceLastPersist = true;
    };
    const persistProjectResourceWrites = (): void => {
        target.persistSession();
        projectResourceWriteSinceLastPersist = false;
    };

    for (const effect of effects) {
        switch (effect.type) {
        case 'append_message':
            if (effect.role === 'assistant') {
                target.addAssistantViewMessage(effect.content);
            } else {
                target.createAndAppendUserMessage(effect.content);
            }
            break;
        case 'upsert_running_operation':
            target.upsertRunningOperation({
                dedupeKey: effect.dedupeKey,
                operationKind: effect.operationKind,
                title: effect.title,
                summary: effect.summary,
                detail: effect.detail,
                sourceTag: effect.sourceTag,
                targetEntryId: effect.targetEntryId,
                relatedMessageId: effect.relatedMessageId,
                layer: effect.layer
            });
            break;
        case 'complete_operation':
            target.completeOperationByKey({
                dedupeKey: effect.dedupeKey,
                operationKind: effect.operationKind,
                title: effect.title,
                summary: effect.summary,
                detail: effect.detail,
                sourceTag: effect.sourceTag,
                targetEntryId: effect.targetEntryId,
                relatedMessageId: effect.relatedMessageId,
                layer: effect.layer
            });
            break;
        case 'add_operation':
            target.addOperationTimelineItem(effect);
            break;
        case 'set_entry_mode':
            target.setEntryMode(effect.mode);
            break;
        case 'set_detail_mode':
            target.setDetailMode(effect.mode);
            break;
        case 'set_collection_mode':
            target.setCollectionMode(effect.mode);
            break;
        case 'set_active_layer':
            target.setActiveLayerAndEmitForm(effect.layer);
            break;
        case 'prefill_structured_form':
            target.prefillStructuredForm({
                formId: effect.formId,
                layer: effect.layer,
                fields: effect.fields,
                overwrite: effect.overwrite
            });
            break;
        case 'submit_form_result':
            target.applySubmittedFormResult(effect.formId);
            break;
        case 'memory_upsert':
            target.upsertForgeMemory(effect.path, effect.title, effect.content, effect.source || 'system', effect.summary);
            markProjectResourceWrite();
            // 更新已有的 running 操作（而非新增），若无 dedupeKey 则新增一条完成记录
            if (effect.dedupeKey) {
                target.completeOperationByKey({
                    dedupeKey: effect.dedupeKey,
                    operationKind: 'memory_update',
                    title: `已更新记忆：${effect.title}`,
                    summary: effect.summary || effect.path,
                    detail: effect.content,
                    sourceTag: effect.source || 'memory_upsert',
                    layer: target.getActiveLayer()
                });
            } else {
                target.addOperationTimelineItem({
                    operationKind: 'memory_update',
                    status: 'completed',
                    title: `已更新记忆：${effect.title}`,
                    summary: effect.summary || effect.path,
                    detail: effect.content,
                    sourceTag: effect.source || 'memory_upsert',
                    layer: target.getActiveLayer()
                });
            }
            break;
        case 'memory_remove':
            target.removeForgeMemory(effect.path);
            markProjectResourceWrite();
            if (effect.dedupeKey) {
                target.completeOperationByKey({
                    dedupeKey: effect.dedupeKey,
                    operationKind: 'memory_update',
                    title: '已移除记忆条目',
                    summary: effect.path,
                    sourceTag: 'memory_remove',
                    layer: target.getActiveLayer()
                });
            } else {
                target.addOperationTimelineItem({
                    operationKind: 'memory_update',
                    status: 'completed',
                    title: '已移除记忆条目',
                    summary: effect.path,
                    sourceTag: 'memory_remove',
                    layer: target.getActiveLayer()
                });
            }
            break;
        case 'virtual_lorebook_upsert':
            target.upsertVirtualLorebookEntry({
                id: effect.id,
                entry: effect.entry,
                sourceBookId: effect.sourceBookId ?? null
            });
            markProjectResourceWrite();
            break;
        case 'virtual_lorebook_remove':
            if (target.removeVirtualLorebookEntry(effect.id)) {
                markProjectResourceWrite();
            }
            break;
        case 'memory_read':
            if (effect.dedupeKey) {
                target.completeOperationByKey({
                    dedupeKey: effect.dedupeKey,
                    operationKind: 'context_read',
                    title: '读取 Forge 记忆',
                    summary: effect.summary,
                    detail: effect.path,
                    sourceTag: 'memory_read',
                    layer: target.getActiveLayer()
                });
            } else {
                target.addOperationTimelineItem({
                    operationKind: 'context_read',
                    status: 'completed',
                    title: '读取 Forge 记忆',
                    summary: effect.summary,
                    detail: effect.path,
                    sourceTag: 'memory_read',
                    layer: target.getActiveLayer()
                });
            }
            break;
        case 'history_read':
            if (effect.dedupeKey) {
                target.completeOperationByKey({
                    dedupeKey: effect.dedupeKey,
                    operationKind: 'context_read',
                    title: '读取历史对话',
                    summary: effect.summary,
                    detail: effect.target,
                    sourceTag: 'history_read',
                    layer: target.getActiveLayer()
                });
            } else {
                target.addOperationTimelineItem({
                    operationKind: 'context_read',
                    status: 'completed',
                    title: '读取历史对话',
                    summary: effect.summary,
                    detail: effect.target,
                    sourceTag: 'history_read',
                    layer: target.getActiveLayer()
                });
            }
            break;
        case 'lorebook_read':
            if (effect.dedupeKey) {
                target.completeOperationByKey({
                    dedupeKey: effect.dedupeKey,
                    operationKind: 'context_read',
                    title: '读取虚拟世界书',
                    summary: effect.summary,
                    detail: effect.target,
                    sourceTag: 'lorebook_read',
                    layer: target.getActiveLayer()
                });
            } else {
                target.addOperationTimelineItem({
                    operationKind: 'context_read',
                    status: 'completed',
                    title: '读取虚拟世界书',
                    summary: effect.summary,
                    detail: effect.target,
                    sourceTag: 'lorebook_read',
                    layer: target.getActiveLayer()
                });
            }
            break;
        case 'upsert_staging_entry':
            target.upsertStagingEntry(annotateSuspiciousStagingEntry(effect.entry));
            markProjectResourceWrite();
            break;
        case 'stage_from_shell_write':
            for (const entry of effect.entries) {
                target.upsertStagingEntry(annotateSuspiciousStagingEntry({
                    targetEntryId: entry.path,
                    proposedContent: entry.content,
                    description: `Shell: ${entry.command.slice(0, 80)}`,
                    originalContent: entry.originalContent,
                    layer: target.getActiveLayer() ?? 'concept',
                    sourceTag: 'shell-write',
                    sourceMessageId: null,
                    sourceSessionId: null
                }));
            }
            markProjectResourceWrite();
            target.syncDraftTree();
            break;
        case 'move_staging_to_commit_ready':
            target.moveStagingToCommitReady(effect.stagingId);
            target.syncDraftTree();
            markProjectResourceWrite();
            break;
        case 'remove_staging_entry':
            target.removeStagingEntry(effect.stagingId);
            target.syncDraftTree();
            markProjectResourceWrite();
            break;
        case 'move_commit_ready_to_staging':
            target.moveCommitReadyToStaging(effect.entryId);
            target.syncDraftTree();
            markProjectResourceWrite();
            break;
        case 'freeze_workspace':
            await target.freezeWorkspace();
            markProjectResourceWrite();
            break;
        case 'attach_reference_chat':
            target.setReferenceChat(effect.chatSessionId);
            markProjectResourceWrite();
            break;
        case 'refresh_workflow':
            await target.refreshWorkflowSnapshot(effect.userInput);
            break;
        case 'persist_session':
            persistProjectResourceWrites();
            break;
        case 'log_operation_prompt':
            target.updateOperationPrompt(effect.dedupeKey, effect.prompt);
            break;
        case 'set_active_model_request':
            target.setActiveModelRequestTrace(effect.requestId);
            break;
        case 'mark_model_request_first_response':
            target.markModelRequestFirstResponse(effect.requestId, effect.firstResponseAt);
            break;
        case 'update_model_request_stream':
            target.updateModelRequestStream(effect);
            break;
        case 'complete_model_request':
            target.completeModelRequestTrace(effect);
            break;
        case 'fail_model_request':
            target.failModelRequestTrace(effect.requestId, effect.message);
            break;
        case 'append_model_request_tool_event':
            target.appendModelRequestToolEvent(effect.requestId, effect.event);
            break;
        case 'set_model_request_tool_set_summary':
            target.setModelRequestToolSetSummary(effect.requestId, effect.tools);
            break;
        case 'set_model_request_pi_trace':
            target.setModelRequestPiTrace(effect.requestId, effect.trace);
            break;
        case 'set_forge_pi_session_state':
            target.setForgePiSessionState({
                tree: effect.tree,
                activeNodeId: effect.activeNodeId,
                contextBundleSummary: effect.contextBundleSummary,
                loadedExtensions: effect.loadedExtensions
            });
            break;
        case 'upsert_tool_approval':
            target.upsertToolApproval(effect.approval);
            break;
        case 'resolve_tool_approval':
            target.resolveToolApproval(effect.toolCallId, effect.approved, effect.message);
            break;
        default:
            break;
        }
    }

    if (projectResourceWriteSinceLastPersist) {
        persistProjectResourceWrites();
    }
}
