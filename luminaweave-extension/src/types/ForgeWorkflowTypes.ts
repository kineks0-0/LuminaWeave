import type {
    ForgeCollectionMode,
    ForgeDetailMode,
    ForgeEntryMode,
    ForgeLayer,
    ForgeStage,
    ForgeStructuredState
} from './ForgeStructuredTypes.js';
import type { StagingEntry } from './ForgeRuntimeTypes.js';

export type ForgeWorkflowIntent =
    | 'conversation'
    | 'planning'
    | 'analysis'
    | 'edit'
    | 'review'
    | 'test'
    | 'export';
export type ForgeModelRoute = 'main' | 'executor';
export type LegacyForgeWorkflowPromptMode = 'planner' | 'conversation' | 'analyst' | 'executor';
export type ForgeVisiblePhase =
    | 'alignment'
    | 'entity_world'
    | 'state_topology'
    | 'narrative_style'
    | 'variables_index'
    | 'output_delivery'
    | 'kickoff'
    | 'build'
    | 'finalize';

export type ForgeAuxPanelKind = 'lorebook' | 'memory' | 'review' | 'export' | 'post_tracks' | 'test_chat' | 'dev_requests' | 'agent_inspector' | 'semantic_vfs' | 'workspace_versions';

export type ForgeWorkflowAction =
    | 'choose_detail_mode'
    | 'choose_entry_mode'
    | 'collect_form'
    | 'advance_layer'
    | 'review_drafts'
    | 'freeze_workspace'
    | 'chat';

export interface ForgeWorkflowSnapshot {
    stage: ForgeStage;
    visiblePhase: ForgeVisiblePhase;
    detailMode: ForgeDetailMode | null;
    collectionMode: ForgeCollectionMode;
    activeLayer: ForgeLayer;
    subLayer: ForgeLayer | null;
    intent: ForgeWorkflowIntent;
    reason: string;
    recommendedAction: string;
    shouldGenerate: boolean;
    requiresUserDecision: boolean;
    allowedActions: ForgeWorkflowAction[];
    missingFields: string[];
    nextRecommendedLayer: ForgeLayer | null;
    entryMode: ForgeEntryMode | null;
    stagingCount: number;
    commitReadyCount: number;
    stagingEntries: StagingEntry[];
    commitReadyEntries: StagingEntry[];
    draftCount: number;
    completedLayers: ForgeLayer[];
    updatedAt: number;
}

export interface ForgeWorkflowTurnInput {
    userInput: string;
    messageCount: number;
    stagingCount: number;
    commitReadyCount: number;
    stagingEntries: StagingEntry[];
    commitReadyEntries: StagingEntry[];
    draftCount?: number;
    hasReferenceChat: boolean;
    activeLeafId: string | null;
    detailMode?: ForgeDetailMode | null;
    collectionMode?: ForgeCollectionMode | null;
    entryMode?: ForgeEntryMode | null;
    activeLayer?: ForgeLayer | null;
    completedLayers?: ForgeLayer[];
    structuredState?: ForgeStructuredState;
}
