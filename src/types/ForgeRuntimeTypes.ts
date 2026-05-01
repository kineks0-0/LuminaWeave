import type { LuminaChatMessage } from '@shared/LuminaMessage.js';
import type { CleanedMessage } from './nexus.js';
import type { ForgeMemoryTree } from './ForgeMemoryTypes.js';
import type { MemorySnapshot } from './MemorySnapshotTypes.js';
import type { ForgeVirtualLorebookEntry } from './SessionTypes.js';
import type {
    ForgeCollectionMode,
    ForgeDetailMode,
    ForgeDraftTree,
    ForgeEntryMode,
    ForgeLayer,
    ForgeStructuredState
} from './ForgeStructuredTypes.js';
import type { ForgeTimelineItem, ForgeTimelineOperationKind, ForgeTimelineOperationStatus } from './ForgeTimelineTypes.js';
import type { ForgeWorkflowPromptMode, ForgeWorkflowSnapshot } from './ForgeWorkflowTypes.js';
import type { PromptPresetGenerationSettings } from './PromptPresetTypes.js';

export interface StagingEntry {
    id: string;
    originalContent: string;
    proposedContent: string;
    description: string;
    targetEntryId: string;
    timestamp: number;
    category?: string; // e.g. "interaction_paradigm", "aesthetic_program"
    layer: ForgeLayer | null;
    sourceTag: string | null;
    sourceMessageId: string | null;
    sourceSessionId: string | null;
}

export type ForgeModelRequestSource = 'planner' | 'conversation' | 'analyst' | 'executor' | 'test_chat';
export type ForgeModelRequestStatus = 'queued' | 'streaming' | 'completed' | 'failed' | 'aborted';

export interface ForgeRequestNodeSummaryItem {
    provider: string;
    model: string | null;
    label: string;
}

export interface ForgeRequestLorebookEntrySummary {
    id: string;
    title: string;
    comment: string;
    keywords: string[];
    disabled: boolean;
}

export interface ForgeRequestContextSnapshot {
    kind: 'forge-runtime' | 'forge-test-chat';
    workspaceTitle: string | null;
    detailMode: ForgeDetailMode | null;
    activeLayer: ForgeLayer | null;
    sourceCommand: ForgeUserCommand | null;
    workflowSnapshot: ForgeWorkflowSnapshot | null;
    historyMessages: CleanedMessage[];
    referenceChatSessionId: string | null;
    referenceChatSnapshotId: string | null;
    lorebookEntries: ForgeRequestLorebookEntrySummary[];
    memorySnapshot: MemorySnapshot | null;
    selectedPresetId: string | null;
    testChatPresetId: string | null;
    nexusPresetId: string | null;
}

export interface ForgeModelRequestTrace {
    id: string;
    source: ForgeModelRequestSource;
    status: ForgeModelRequestStatus;
    workspaceSessionId: string;
    requestPrompt: CleanedMessage[];
    requestParameters: PromptPresetGenerationSettings;
    contextSnapshot: ForgeRequestContextSnapshot;
    responseRaw: string;
    responseDisplay: string;
    responseThinking: string;
    requestedAt: number;
    firstResponseAt: number | null;
    completedAt: number | null;
    errorMessage: string | null;
    presetId: string | null;
    nodeSummary: ForgeRequestNodeSummaryItem[];
}

export type ForgeUserCommand =
    | { type: 'choose_entry_mode'; mode: ForgeEntryMode }
    | { type: 'choose_detail_mode'; mode: ForgeDetailMode }
    | { type: 'submit_form'; formId: string; userInput?: string }
    | { type: 'advance_layer'; layer: ForgeLayer }
    | { type: 'send_user_input'; input: string }
    | { type: 'approve_staging'; stagingId: string }
    | { type: 'reject_staging'; stagingId: string }
    | { type: 'return_commit_ready'; entryId: string }
    | { type: 'freeze_workspace' }
    | { type: 'attach_reference_chat'; chatSessionId: string | null }
    | { type: 'refresh_workflow'; userInput?: string }
    | { type: 'noop' };

export interface ForgeRuntimeContext {
    workspaceSessionId: string;
    sessionChatId: string;
    workspaceTitle: string;
    selectedPresetId: string;
    selectedChatSessionId: string | null;
    selectedChatSnapshotId: string | null;
    detailMode: ForgeDetailMode | null;
    collectionMode: ForgeCollectionMode;
    entryMode: ForgeEntryMode | null;
    activeLayer: ForgeLayer;
    completedLayers: ForgeLayer[];
    workflowSnapshot: ForgeWorkflowSnapshot | null;
    publishState: 'drafting' | 'workspace_frozen';
    activeLeafId: string | null;
    worldlineNodes: LuminaChatMessage[];
    messages: LuminaChatMessage[];
    timelineItems: ForgeTimelineItem[];
    structuredState: ForgeStructuredState;
    draftTree: ForgeDraftTree;
    forgeMemoryTree: ForgeMemoryTree;
    stagingEntries: StagingEntry[];
    commitReadyEntries: StagingEntry[];
    virtualLorebookEntries: ForgeVirtualLorebookEntry[];
    latestUserInput: string;
    latestUserCommand: ForgeUserCommand;
}

export type ForgeRuntimeEffect =
    | { type: 'append_message'; role: 'user' | 'assistant'; content: string; sourceTag?: string | null }
    | {
        type: 'upsert_running_operation';
        dedupeKey: string;
        operationKind: ForgeTimelineOperationKind;
        title: string;
        summary: string;
        detail?: string | null;
        sourceTag?: string | null;
        targetEntryId?: string | null;
        relatedMessageId?: string | null;
        layer?: ForgeLayer | null;
    }
    | {
        type: 'complete_operation';
        dedupeKey: string;
        operationKind: ForgeTimelineOperationKind;
        title: string;
        summary: string;
        detail?: string | null;
        sourceTag?: string | null;
        targetEntryId?: string | null;
        relatedMessageId?: string | null;
        layer?: ForgeLayer | null;
    }
    | {
        type: 'add_operation';
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
    }
    | { type: 'set_entry_mode'; mode: ForgeEntryMode }
    | { type: 'set_detail_mode'; mode: ForgeDetailMode }
    | { type: 'set_collection_mode'; mode: ForgeCollectionMode }
    | { type: 'set_active_layer'; layer: ForgeLayer }
    | {
        type: 'prefill_structured_form';
        formId?: string | null;
        layer?: ForgeLayer | null;
        fields: Array<{
            fieldKey: string;
            value: string | string[];
        }>;
        overwrite?: boolean;
    }
    | { type: 'submit_form_result'; formId: string }
    | { type: 'memory_upsert'; path: string; title: string; content: string; summary?: string; source?: 'user' | 'planner' | 'analyst' | 'system'; dedupeKey?: string }
    | { type: 'memory_remove'; path: string; dedupeKey?: string }
    | { type: 'memory_read'; path: string; summary: string; dedupeKey?: string }
    | { type: 'history_read'; target: string; summary: string; dedupeKey?: string }
    | { type: 'lorebook_read'; target: string; summary: string; dedupeKey?: string }
    | {
        type: 'upsert_staging_entry';
        entry: Omit<StagingEntry, 'id' | 'timestamp'> & { id?: string; timestamp?: number }
    }
    | { type: 'move_staging_to_commit_ready'; stagingId: string }
    | { type: 'remove_staging_entry'; stagingId: string }
    | { type: 'move_commit_ready_to_staging'; entryId: string }
    | { type: 'freeze_workspace' }
    | { type: 'attach_reference_chat'; chatSessionId: string | null }
    | { type: 'refresh_workflow'; userInput?: string }
    | { type: 'log_operation_prompt'; dedupeKey: string; prompt: any[] }
    | { type: 'set_active_model_request'; requestId: string }
    | { type: 'mark_model_request_first_response'; requestId: string; firstResponseAt?: number }
    | {
        type: 'update_model_request_stream';
        requestId: string;
        responseRaw: string;
        responseDisplay: string;
        responseThinking: string;
    }
    | {
        type: 'complete_model_request';
        requestId: string;
        responseRaw: string;
        responseDisplay: string;
        responseThinking: string;
        completedAt?: number;
    }
    | { type: 'fail_model_request'; requestId: string; message: string }
    | { type: 'persist_session' };

export interface ForgeExecutionRequest {
    requestId: string;
    traceSource: ForgeModelRequestSource;
    contextSnapshot: ForgeRequestContextSnapshot;
    nodeSummary: ForgeRequestNodeSummaryItem[];
    generationSettings: PromptPresetGenerationSettings;
    mode: ForgeWorkflowPromptMode;
    messages: CleanedMessage[];
    sessionChatId: string;
    charName: string;
    presetId?: string;
    sourceCommand: ForgeUserCommand;
}

export type ForgeRuntimeEventSource = 'planner' | 'analyst' | 'executor' | 'conversation' | 'system' | 'user';

export type ForgeRuntimeEvent =
    | { type: 'request_started'; requestId: string; requestedAt: number; nodeSummary: ForgeRequestNodeSummaryItem[] }
    | { type: 'trace'; requestId: string; tag: string; status: string; timestamp: number }
    | {
        type: 'action_completed';
        actionType: 'skill' | 'plan' | 'update' | 'memory' | 'context' | 'handoff' | 'prefill';
        raw: string;
        content: string;
        source: ForgeRuntimeEventSource;
    }
    | { type: 'prompt_ready'; requestId: string; prompt: any[] }
    | { type: 'first_response'; requestId: string; firstResponseAt: number }
    | { type: 'stream_chunk'; requestId: string; displayText: string; thinkingText: string; rawText: string }
    | { type: 'stream_done'; requestId: string; rawText: string; displayText: string; thinkingText: string; completedAt: number }
    | { type: 'stream_error'; requestId: string; message: string };

export interface ForgeExecutionResult {
    rawText: string;
    events: ForgeRuntimeEvent[];
    effects: ForgeRuntimeEffect[];
}

export interface ForgeRuntimeDecision {
    workflowSnapshot: ForgeWorkflowSnapshot;
    executionRequest: ForgeExecutionRequest | null;
    effects: ForgeRuntimeEffect[];
    requiresGeneration: boolean;
    requiresUserDecision: boolean;
}
