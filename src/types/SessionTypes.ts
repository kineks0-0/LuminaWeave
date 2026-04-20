import type { LuminaChatMessage } from '@shared/LuminaMessage.js';
import type { ForgeMemoryTree } from './ForgeMemoryTypes.js';
import type { StagingEntry } from './ForgeRuntimeTypes.js';
import type { ForgeTimelineItem } from './ForgeTimelineTypes.js';
import type { ForgeAuxPanelKind, ForgeWorkflowSnapshot } from './ForgeWorkflowTypes.js';
import type { ForgeDetailMode, ForgeDraftTree, ForgeEntryMode, ForgeLayer, ForgeStructuredState } from './ForgeStructuredTypes.js';

/** 世界线节点工作区快照 — 用于回滚恢复 */
export interface ForgeWorldlineSnapshot {
    nodeId: string;
    createdAt: number;
    virtualLorebookEntries: ForgeVirtualLorebookEntry[];
    commitReadyEntries: StagingEntry[];
    stagingEntries: StagingEntry[];
    structuredState: ForgeStructuredState;
    draftTree: ForgeDraftTree;
    memoryTree: ForgeMemoryTree;
    workflowSnapshot: ForgeWorkflowSnapshot;
    activeLayer: ForgeLayer;
    completedLayers: ForgeLayer[];
}

export interface ChatSessionRef {
    id: string;
    title: string;
    source: 'lumina-server' | 'st-current';
    createdAt: number;
    updatedAt: number;
    messageCount: number;
    summary: string;
    previewMessage: string;
    activeLeafId: string | null;
    characterId?: string | number | null;
    characterName?: string;
    characterAvatarUrl?: string | null;
}

export interface ChatSessionSnapshot {
    id: string;
    chatSessionId: string;
    activeLeafId: string | null;
    messages: LuminaChatMessage[];
    timelineGraph: Record<string, LuminaChatMessage>;
    createdAt: number;
}

export interface ForgeWorkspaceSessionRef {
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    messageCount: number;
    selectedChatSessionId: string | null;
}

export interface ForgeVirtualLorebookEntry {
    id: string;
    entry: LuminaLorebookEntry;
    sourceBookId: string | null;
    createdAt: number;
    updatedAt: number;
}

export interface ForgeWorkspaceSession {
    id: string;
    sessionChatId: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    presetId: string;
    activeLeafId: string | null;
    worldlineNodes: LuminaChatMessage[];
    selectedChatSessionId: string | null;
    selectedChatSnapshotId: string | null;
    draftInput: string;
    timelineItems?: ForgeTimelineItem[];
    stagingEntries: StagingEntry[];
    commitReadyEntries?: StagingEntry[];
    virtualLorebookEntries?: ForgeVirtualLorebookEntry[];
    importedLorebookId?: string | null;
    workflowSnapshot?: ForgeWorkflowSnapshot | null;
    detailMode?: ForgeDetailMode | null;
    entryMode?: ForgeEntryMode | null;
    structuredState?: ForgeStructuredState;
    draftTree?: ForgeDraftTree;
    forgeMemoryTree?: ForgeMemoryTree;
    activeLayer?: ForgeLayer | null;
    completedLayers?: ForgeLayer[];
    publishState?: 'drafting' | 'workspace_frozen';
    activeAuxPanel?: ForgeAuxPanelKind;
    auxPresentationMode?: 'embedded' | 'detached' | 'widget' | 'hidden';
    /** 世界线节点快照 Map（key = nodeId）。可选，用于回滚恢复。 */
    worldlineSnapshots?: Record<string, ForgeWorldlineSnapshot>;
    workspaceMode: 'workspace';
}
