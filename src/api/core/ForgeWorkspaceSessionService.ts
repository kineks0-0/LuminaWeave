import { WorldlineStore } from './WorldlineStore.js';
import type { LuminaChatMessage } from '../../../../shared/LuminaMessage.js';
import type {
    ForgeVirtualLorebookEntry,
    ForgeWorkspaceSession,
    ForgeWorldlineSnapshot
} from '../../types/SessionTypes.js';
import type { StagingEntry } from '../../types/ForgeRuntimeTypes.js';
import type { ForgeTimelineItem } from '../../types/ForgeTimelineTypes.js';
import type {
    ForgeDraftTree,
    ForgeDetailMode,
    ForgeEntryMode,
    ForgeLayer,
    ForgeStructuredState
} from '../../types/ForgeStructuredTypes.js';
import type { ForgeMemoryTree } from '../../types/ForgeMemoryTypes.js';
import type { ForgeAuxPanelKind, ForgeWorkflowSnapshot } from '../../types/ForgeWorkflowTypes.js';
import {
    cloneForgeMemoryTree,
    cloneDraftTree,
    cloneStructuredState,
    createEmptyForgeMemoryTree,
    createEmptyDraftTree,
    createEmptyStructuredState
} from './utils/forgeStateDefaults.js';

export interface ForgeWorkspaceSerializableState {
    workspaceSessionId: string;
    sessionChatId: string;
    workspaceTitle: string;
    workspaceCreatedAt: number;
    selectedPresetId: string;
    activeLeafId: string | null;
    worldlineNodes: LuminaChatMessage[];
    selectedChatSessionId: string | null;
    selectedChatSnapshotId: string | null;
    draftInput: string;
    timelineItems: ForgeTimelineItem[];
    stagingEntries: StagingEntry[];
    commitReadyEntries: StagingEntry[];
    virtualLorebookEntries: ForgeVirtualLorebookEntry[];
    importedLorebookId: string | null;
    workflowSnapshot: ForgeWorkflowSnapshot | null;
    detailMode: ForgeDetailMode | null;
    entryMode: ForgeEntryMode | null;
    structuredState: ForgeStructuredState;
    draftTree: ForgeDraftTree;
    forgeMemoryTree: ForgeMemoryTree;
    activeLayer: ForgeLayer;
    completedLayers: ForgeLayer[];
    publishState: 'drafting' | 'workspace_frozen';
    activeAuxPanel: ForgeAuxPanelKind;
    auxPresentationMode: 'embedded' | 'detached';
    /** 从 WorldlineManager 同步而来的快照 Map（key = nodeId）。 */
    worldlineSnapshots?: Map<string, ForgeWorldlineSnapshot>;
}

export interface HydratedForgeWorkspaceState extends ForgeWorkspaceSerializableState {
    workspaceUpdatedAt: number;
    worldlineStore: WorldlineStore;
    worldlineSnapshotMap: Map<string, ForgeWorldlineSnapshot>;
}

export class ForgeWorkspaceSessionService {
    static serialize(input: ForgeWorkspaceSerializableState): ForgeWorkspaceSession {
        return {
            id: input.workspaceSessionId || `forge_ws_${Date.now().toString(36)}`,
            sessionChatId: input.sessionChatId,
            title: input.workspaceTitle || 'Forge Workspace',
            createdAt: input.workspaceCreatedAt,
            updatedAt: Date.now(),
            presetId: input.selectedPresetId,
            activeLeafId: input.activeLeafId,
            worldlineNodes: input.worldlineNodes.map(node => ({ ...node })),
            selectedChatSessionId: input.selectedChatSessionId,
            selectedChatSnapshotId: input.selectedChatSnapshotId,
            draftInput: input.draftInput,
            timelineItems: input.timelineItems.map(item => ({ ...item })),
            stagingEntries: input.stagingEntries.map(entry => ({
                ...entry,
                layer: entry.layer || null,
                sourceTag: entry.sourceTag || null,
                sourceMessageId: entry.sourceMessageId || null,
                sourceSessionId: entry.sourceSessionId || null
            })),
            commitReadyEntries: input.commitReadyEntries.map(entry => ({
                ...entry,
                layer: entry.layer || null,
                sourceTag: entry.sourceTag || null,
                sourceMessageId: entry.sourceMessageId || null,
                sourceSessionId: entry.sourceSessionId || null
            })),
            virtualLorebookEntries: input.virtualLorebookEntries.map(item => ({
                ...item,
                entry: JSON.parse(JSON.stringify(item.entry))
            })),
            importedLorebookId: input.importedLorebookId,
            workflowSnapshot: input.workflowSnapshot,
            detailMode: input.detailMode,
            entryMode: input.entryMode,
            structuredState: cloneStructuredState(input.structuredState),
            draftTree: cloneDraftTree(input.draftTree),
            forgeMemoryTree: cloneForgeMemoryTree(input.forgeMemoryTree),
            activeLayer: input.activeLayer,
            completedLayers: [...input.completedLayers],
            publishState: input.publishState,
            activeAuxPanel: input.activeAuxPanel,
            auxPresentationMode: input.auxPresentationMode,
            workspaceMode: 'workspace',
            worldlineSnapshots: input.worldlineSnapshots
                ? Object.fromEntries(input.worldlineSnapshots)
                : undefined
        };
    }

    static hydrate(session: ForgeWorkspaceSession): HydratedForgeWorkspaceState {
        const worldlineStore = new WorldlineStore();
        worldlineStore.setNodes(session.worldlineNodes || []);
        worldlineStore.activeLeafId = session.activeLeafId || session.worldlineNodes.at(-1)?.id || null;

        return {
            workspaceSessionId: session.id,
            sessionChatId: session.sessionChatId,
            workspaceTitle: session.title,
            workspaceCreatedAt: session.createdAt || Date.now(),
            workspaceUpdatedAt: session.updatedAt || Date.now(),
            selectedPresetId: session.presetId || '',
            activeLeafId: session.activeLeafId || session.worldlineNodes.at(-1)?.id || null,
            worldlineNodes: session.worldlineNodes || [],
            selectedChatSessionId: session.selectedChatSessionId || null,
            selectedChatSnapshotId: session.selectedChatSnapshotId || null,
            draftInput: session.draftInput || '',
            timelineItems: (session.timelineItems || []).map(item => ({ ...item })),
            stagingEntries: (session.stagingEntries || []).map(entry => ({
                ...entry,
                layer: entry.layer || null,
                sourceTag: entry.sourceTag || null,
                sourceMessageId: entry.sourceMessageId || null,
                sourceSessionId: entry.sourceSessionId || null
            })),
            commitReadyEntries: (session.commitReadyEntries || []).map(entry => ({
                ...entry,
                layer: entry.layer || null,
                sourceTag: entry.sourceTag || null,
                sourceMessageId: entry.sourceMessageId || null,
                sourceSessionId: entry.sourceSessionId || null
            })),
            virtualLorebookEntries: (session.virtualLorebookEntries || []).map(item => ({
                ...item,
                entry: JSON.parse(JSON.stringify(item.entry))
            })),
            importedLorebookId: session.importedLorebookId || null,
            workflowSnapshot: session.workflowSnapshot || null,
            detailMode: session.detailMode || null,
            entryMode: session.entryMode || null,
            structuredState: cloneStructuredState(session.structuredState || createEmptyStructuredState()),
            draftTree: cloneDraftTree(session.draftTree || createEmptyDraftTree()),
            forgeMemoryTree: cloneForgeMemoryTree(session.forgeMemoryTree || createEmptyForgeMemoryTree()),
            activeLayer: session.activeLayer || 'concept',
            completedLayers: session.completedLayers || [],
            publishState: session.publishState || 'drafting',
            activeAuxPanel: session.activeAuxPanel || 'lorebook',
            auxPresentationMode: session.auxPresentationMode || 'detached',
            worldlineStore,
            worldlineSnapshotMap: session.worldlineSnapshots
                ? new Map(Object.entries(session.worldlineSnapshots))
                : new Map()
        };
    }
}
