import { WorldlineStore } from './WorldlineStore.js';
import { ForgeWorkspaceSessionService } from './ForgeWorkspaceSessionService.js';
import { forgeSessionRepository } from './ForgeSessionRepository.js';
import type { LuminaChatMessage } from '@shared/LuminaMessage.js';
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

// ────────────────── Helpers ──────────────────

export const buildMessageTimelineItems = (nodes: LuminaChatMessage[]): ForgeTimelineItem[] => {
    return nodes
        .map<ForgeTimelineItem>((node) => ({
            id: `forge_msg_${node.id}`,
            kind: 'message',
            messageId: node.id,
            createdAt: Number(node.createdAt || node.extra?.send_date || Date.now()),
            updatedAt: Number(node.createdAt || node.extra?.send_date || Date.now())
        }))
        .sort((left, right) => {
            if (left.createdAt === right.createdAt) {
                return left.id.localeCompare(right.id);
            }
            return left.createdAt - right.createdAt;
        });
};

// ────────────────── Deps Interface ──────────────────

export interface SessionControllerDeps {
    // --- ID & Title ---
    getSessionChatId(): string;
    setSessionChatId(id: string): void;
    getWorkspaceSessionId(): string;
    setWorkspaceSessionId(id: string): void;
    getWorkspaceTitle(): string;
    setWorkspaceTitle(title: string): void;
    getWorkspaceCreatedAt(): number;
    setWorkspaceCreatedAt(ts: number): void;
    setWorkspaceUpdatedAt(ts: number): void;

    // --- Preset & Chat Reference ---
    getSelectedPresetId(): string;
    setSelectedPresetId(id: string): void;
    getSelectedChatSessionId(): string | null;
    setSelectedChatSessionId(id: string | null): void;
    getSelectedChatSnapshotId(): string | null;
    setSelectedChatSnapshotId(id: string | null): void;

    // --- Input & Stream ---
    getInput(): string;
    setInput(text: string): void;
    resetStreamState(): void;

    // --- WorldlineStore ---
    getWorldlineStore(): WorldlineStore;
    setWorldlineStore(store: WorldlineStore): void;
    setupWorldlineStoreListeners(store: WorldlineStore): void;
    getActiveLeafId(): string | null;

    // --- ForgeStore Proxies ---
    getTimelineItems(): ForgeTimelineItem[];
    replaceTimelineItems(items: ForgeTimelineItem[]): void;
    getStagingEntries(): StagingEntry[];
    setStagingEntries(entries: StagingEntry[]): void;
    getCommitReadyEntries(): StagingEntry[];
    setCommitReadyEntries(entries: StagingEntry[]): void;
    setCurrentSessionId(id: string): void;
    setIsProcessing(val: boolean): void;
    clearAll(): void;

    // --- Virtual Lorebook ---
    getVirtualLorebookEntries(): ForgeVirtualLorebookEntry[];
    setVirtualLorebookEntries(entries: ForgeVirtualLorebookEntry[]): void;
    getImportedLorebookId(): string | null;
    setImportedLorebookId(id: string | null): void;

    // --- Structured State ---
    getStructuredState(): ForgeStructuredState;
    setStructuredState(state: ForgeStructuredState): void;
    getDraftTree(): ForgeDraftTree;
    setDraftTree(tree: ForgeDraftTree): void;
    getForgeMemoryTree(): ForgeMemoryTree;
    setForgeMemoryTree(tree: ForgeMemoryTree): void;
    getDetailMode(): ForgeDetailMode | null;
    setDetailMode(mode: ForgeDetailMode | null): void;
    getEntryMode(): ForgeEntryMode | null;
    setEntryMode(mode: ForgeEntryMode | null): void;
    getActiveLayer(): ForgeLayer;
    setActiveLayer(layer: ForgeLayer): void;
    getCompletedLayers(): ForgeLayer[];
    setCompletedLayers(layers: ForgeLayer[]): void;
    getPublishState(): 'drafting' | 'workspace_frozen';
    setPublishState(state: 'drafting' | 'workspace_frozen'): void;

    // --- Aux Panel ---
    getActiveAuxPanel(): ForgeAuxPanelKind;
    setActiveAuxPanel(panel: ForgeAuxPanelKind): void;
    getAuxPresentationMode(): 'embedded' | 'detached' | 'widget' | 'hidden';
    setAuxPresentationMode(mode: 'embedded' | 'detached' | 'widget' | 'hidden'): void;
    setWorkspacePage(page: 'workspace' | 'session-browser'): void;

    // --- Workflow ---
    getWorkflowSnapshot(): ForgeWorkflowSnapshot | null;
    setWorkflowSnapshot(snapshot: ForgeWorkflowSnapshot | null): void;

    // --- Actions ---
    syncDraftTree(): void;
    bumpTimelineRevision(): void;
    generateSessionChatId(): string;

    // --- Worldline Snapshots ---
    getWorldlineSnapshotMap(): Map<string, ForgeWorldlineSnapshot>;
    setWorldlineSnapshotMap(map: Map<string, ForgeWorldlineSnapshot>): void;
}

// ────────────────── Controller ──────────────────

export class ForgeSessionController {
    constructor(private deps: SessionControllerDeps) {}

    serializeSession(): ForgeWorkspaceSession {
        const d = this.deps;
        return ForgeWorkspaceSessionService.serialize({
            workspaceSessionId: d.getWorkspaceSessionId() || `forge_ws_${Date.now().toString(36)}`,
            sessionChatId: d.getSessionChatId(),
            workspaceTitle: d.getWorkspaceTitle() || 'Forge Workspace',
            workspaceCreatedAt: d.getWorkspaceCreatedAt(),
            selectedPresetId: d.getSelectedPresetId(),
            activeLeafId: d.getActiveLeafId(),
            worldlineNodes: d.getWorldlineStore().nodePool.map(node => ({ ...node })),
            selectedChatSessionId: d.getSelectedChatSessionId(),
            selectedChatSnapshotId: d.getSelectedChatSnapshotId(),
            draftInput: d.getInput(),
            timelineItems: d.getTimelineItems().map(item => ({ ...item })),
            stagingEntries: d.getStagingEntries().map(entry => ({ ...entry })),
            commitReadyEntries: d.getCommitReadyEntries().map(entry => ({ ...entry })),
            virtualLorebookEntries: d.getVirtualLorebookEntries().map(item => ({
                ...item,
                entry: JSON.parse(JSON.stringify(item.entry))
            })),
            importedLorebookId: d.getImportedLorebookId(),
            workflowSnapshot: d.getWorkflowSnapshot(),
            detailMode: d.getDetailMode(),
            entryMode: d.getEntryMode(),
            structuredState: cloneStructuredState(d.getStructuredState()),
            draftTree: cloneDraftTree(d.getDraftTree()),
            forgeMemoryTree: cloneForgeMemoryTree(d.getForgeMemoryTree()),
            activeLayer: d.getActiveLayer(),
            completedLayers: [...d.getCompletedLayers()],
            publishState: d.getPublishState(),
            activeAuxPanel: d.getActiveAuxPanel(),
            auxPresentationMode: d.getAuxPresentationMode(),
            worldlineSnapshots: d.getWorldlineSnapshotMap()
        });
    }

    async persistWorkspaceSession(): Promise<void> {
        if (!this.deps.getWorkspaceSessionId()) return;
        try {
            const serialized = this.serializeSession();
            this.deps.setWorkspaceUpdatedAt(serialized.updatedAt);
            await forgeSessionRepository.saveSession(serialized);
        } catch (e) {
            console.error('[Forge-Session] 持久化工作区失败:', e);
        }
    }

    async flushWorkspaceSession(): Promise<void> {
        await this.persistWorkspaceSession();
    }

    restoreForgeAuxState(session: ForgeWorkspaceSession): void {
        const d = this.deps;
        d.replaceTimelineItems((session.timelineItems && session.timelineItems.length > 0)
            ? session.timelineItems.map(item => ({ ...item }))
            : buildMessageTimelineItems(session.worldlineNodes || []));
        d.setStagingEntries(session.stagingEntries.map(entry => ({
            ...entry,
            layer: entry.layer || null,
            sourceTag: entry.sourceTag || null,
            sourceMessageId: entry.sourceMessageId || null,
            sourceSessionId: entry.sourceSessionId || null
        })));
        d.setCommitReadyEntries((session.commitReadyEntries || []).map(entry => ({
            ...entry,
            layer: entry.layer || null,
            sourceTag: entry.sourceTag || null,
            sourceMessageId: entry.sourceMessageId || null,
            sourceSessionId: entry.sourceSessionId || null
        })));
        d.setCurrentSessionId(session.id);
        d.setIsProcessing(false);
        d.setVirtualLorebookEntries((session.virtualLorebookEntries || []).map(item => ({
            ...item,
            entry: JSON.parse(JSON.stringify(item.entry))
        })));
        d.setImportedLorebookId(session.importedLorebookId || null);
        d.setStructuredState(cloneStructuredState(session.structuredState || createEmptyStructuredState()));
        d.setDraftTree(cloneDraftTree(session.draftTree || createEmptyDraftTree()));
        d.setDetailMode(session.detailMode || null);
        d.setEntryMode(session.entryMode || null);
        d.setForgeMemoryTree(cloneForgeMemoryTree(session.forgeMemoryTree || createEmptyForgeMemoryTree()));
        d.setActiveLayer(session.activeLayer || 'concept');
        d.setCompletedLayers(session.completedLayers || []);
        d.setPublishState(session.publishState || 'drafting');
        d.setActiveAuxPanel(session.activeAuxPanel || 'lorebook');
        d.setAuxPresentationMode(session.auxPresentationMode || 'detached');
        d.syncDraftTree();
    }

    hydrateFromSession(session: ForgeWorkspaceSession): void {
        const d = this.deps;
        const hydrated = ForgeWorkspaceSessionService.hydrate(session);

        d.setSessionChatId(hydrated.sessionChatId || d.generateSessionChatId());
        d.setWorkspaceSessionId(hydrated.workspaceSessionId);
        d.setWorkspaceTitle(hydrated.workspaceTitle);
        d.setWorkspaceCreatedAt(hydrated.workspaceCreatedAt || Date.now());
        d.setWorkspaceUpdatedAt(hydrated.workspaceUpdatedAt || Date.now());
        d.setSelectedPresetId(hydrated.selectedPresetId || d.getSelectedPresetId());
        d.setSelectedChatSessionId(hydrated.selectedChatSessionId || null);
        d.setSelectedChatSnapshotId(hydrated.selectedChatSnapshotId || null);
        d.setInput(hydrated.draftInput || '');
        d.setWorkflowSnapshot(hydrated.workflowSnapshot || null);
        d.resetStreamState();
        d.setWorkspacePage('workspace');
        d.setWorldlineStore(hydrated.worldlineStore);
        d.setupWorldlineStoreListeners(hydrated.worldlineStore);
        d.setWorldlineSnapshotMap(hydrated.worldlineSnapshotMap);
        this.restoreForgeAuxState(session);
        d.bumpTimelineRevision();
    }

    async createWorkspaceSession(title?: string): Promise<ForgeWorkspaceSession> {
        const d = this.deps;
        await this.flushWorkspaceSession();

        const newChatId = d.generateSessionChatId();
        const created = await forgeSessionRepository.createSession({
            sessionChatId: newChatId,
            title: title || `Forge Workspace ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
            presetId: d.getSelectedPresetId(),
            selectedChatSessionId: d.getSelectedChatSessionId(),
            selectedChatSnapshotId: d.getSelectedChatSnapshotId(),
            stagingEntries: [],
            commitReadyEntries: [],
            virtualLorebookEntries: [],
            importedLorebookId: null,
            detailMode: null,
            entryMode: null,
            structuredState: createEmptyStructuredState(),
            draftTree: createEmptyDraftTree(),
            forgeMemoryTree: createEmptyForgeMemoryTree(),
            activeLayer: 'concept' as ForgeLayer,
            completedLayers: [],
            publishState: 'drafting' as const,
            activeAuxPanel: d.getActiveAuxPanel(),
            auxPresentationMode: d.getAuxPresentationMode(),
            workspaceMode: 'workspace' as const
        });

        this.hydrateFromSession(created);
        return created;
    }

    renameWorkspaceSession(title: string): boolean {
        const wsId = this.deps.getWorkspaceSessionId();
        if (!wsId) return false;
        const updated = forgeSessionRepository.renameSession(wsId, title);
        if (!updated) return false;
        this.deps.setWorkspaceTitle(updated.title);
        this.deps.setWorkspaceUpdatedAt(updated.updatedAt);
        return true;
    }

    async openWorkspaceSession(id: string): Promise<boolean> {
        await this.flushWorkspaceSession();
        const session = await forgeSessionRepository.loadSession(id);
        if (!session) return false;
        this.hydrateFromSession(session);
        forgeSessionRepository.setActiveSessionId(session.id);
        return true;
    }

    resetSession(): void {
        const d = this.deps;
        this.flushWorkspaceSession();
        d.setWorkspaceSessionId('');
        d.setSessionChatId(d.generateSessionChatId());
        d.setWorldlineStore(new WorldlineStore());
        d.setInput('');
        d.setWorkflowSnapshot(null);
        d.setDetailMode(null);
        d.setEntryMode(null);
        d.setActiveLayer('concept');
        d.setCompletedLayers([]);
        d.setStructuredState(createEmptyStructuredState());
        d.setDraftTree(createEmptyDraftTree());
        d.setForgeMemoryTree(createEmptyForgeMemoryTree());
        d.setPublishState('drafting');
        d.setActiveAuxPanel('lorebook');
        d.setAuxPresentationMode('detached');
        d.setWorkspacePage('workspace');
        d.resetStreamState();
        d.clearAll();
        d.bumpTimelineRevision();
        this.createWorkspaceSession();
    }

    async ensureWorkspaceSession(): Promise<void> {
        await forgeSessionRepository.refreshFromServer();
        const activeId = forgeSessionRepository.getActiveSessionId();
        if (activeId && await this.openWorkspaceSession(activeId)) {
            return;
        }

        const sessions = forgeSessionRepository.listSessions();
        if (sessions.length > 0 && await this.openWorkspaceSession(sessions[0].id)) {
            return;
        }

        await this.createWorkspaceSession();
    }
}
