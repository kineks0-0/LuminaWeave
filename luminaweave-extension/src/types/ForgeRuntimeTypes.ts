import type { LuminaChatMessage } from '../../../shared/LuminaMessage.js';
import type { CleanedMessage } from './nexus.js';
import type { ForgeMemoryTree } from './ForgeMemoryTypes.js';
import type { ForgeVirtualLorebookEntry } from './SessionTypes.js';
import type {
    ForgeDetailMode,
    ForgeDraftTree,
    ForgeEntryMode,
    ForgeLayer,
    ForgeStructuredState
} from './ForgeStructuredTypes.js';
import type { ForgeTimelineItem, ForgeTimelineOperationKind, ForgeTimelineOperationStatus } from './ForgeTimelineTypes.js';
import type { ForgeWorkflowPromptMode, ForgeWorkflowSnapshot } from './ForgeWorkflowTypes.js';

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
    | { type: 'persist_session' };

export interface ForgeExecutionRequest {
    mode: ForgeWorkflowPromptMode;
    messages: CleanedMessage[];
    sessionChatId: string;
    charName: string;
    presetId?: string;
    sourceCommand: ForgeUserCommand;
}

export type ForgeRuntimeEvent =
    | { type: 'trace'; tag: string; status: string; timestamp: number }
    | { type: 'action_completed'; actionType: 'skill' | 'plan' | 'update' | 'memory' | 'context' | 'handoff' | 'prefill'; raw: string; content: string }
    | { type: 'prompt_ready'; prompt: any[] }
    | { type: 'stream_chunk'; displayText: string; thinkingText: string; rawText: string }
    | { type: 'stream_done'; rawText: string; displayText: string; thinkingText: string }
    | { type: 'stream_error'; message: string };

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
