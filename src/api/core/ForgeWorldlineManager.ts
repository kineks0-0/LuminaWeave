import { WorldlineStore } from './WorldlineStore.js';
import type { ForgeWorldlineSnapshot, ForgeVirtualLorebookEntry } from '../../types/SessionTypes.js';
import type { StagingEntry } from '../../types/ForgeRuntimeTypes.js';
import type { ForgeTimelineItem } from '../../types/ForgeTimelineTypes.js';
import type {
    ForgeDraftTree,
    ForgeLayer,
    ForgeStructuredState
} from '../../types/ForgeStructuredTypes.js';
import type { ForgeMemoryTree } from '../../types/ForgeMemoryTypes.js';
import type { ForgeWorkflowSnapshot } from '../../types/ForgeWorkflowTypes.js';
import {
    cloneForgeMemoryTree,
    cloneDraftTree,
    cloneStructuredState
} from './utils/forgeStateDefaults.js';

// ────────────────── Deps Interface ──────────────────

export interface WorldlineManagerDeps {
    getWorldlineStore(): WorldlineStore;
    getActiveLeafId(): string | null;
    bumpTimelineRevision(): void;
    refreshWorkflowSnapshot(): Promise<void>;
    persistWorkspaceSession(): Promise<void>;

    // Timeline cleanup
    getTimelineItems(): ForgeTimelineItem[];
    replaceTimelineItems(items: ForgeTimelineItem[]): void;

    // Snapshot sources
    getVirtualLorebookEntries(): ForgeVirtualLorebookEntry[];
    getCommitReadyEntries(): StagingEntry[];
    getStagingEntries(): StagingEntry[];
    getStructuredState(): ForgeStructuredState;
    getDraftTree(): ForgeDraftTree;
    getForgeMemoryTree(): ForgeMemoryTree;
    getWorkflowSnapshot(): ForgeWorkflowSnapshot;
    getActiveLayer(): ForgeLayer;
    getCompletedLayers(): ForgeLayer[];

    // Snapshot restore targets
    setVirtualLorebookEntries(entries: ForgeVirtualLorebookEntry[]): void;
    setCommitReadyEntries(entries: StagingEntry[]): void;
    setStagingEntries(entries: StagingEntry[]): void;
    setStructuredState(state: ForgeStructuredState): void;
    setDraftTree(tree: ForgeDraftTree): void;
    setForgeMemoryTree(tree: ForgeMemoryTree): void;
    setWorkflowSnapshot(snapshot: ForgeWorkflowSnapshot): void;
    setActiveLayer(layer: ForgeLayer): void;
    setCompletedLayers(layers: ForgeLayer[]): void;
    syncDraftTree(): void;
}

// ────────────────── Manager ──────────────────

export class ForgeWorldlineManager {
    private snapshots = new Map<string, ForgeWorldlineSnapshot>();
    private readonly _bump: () => void;

    constructor(private deps: WorldlineManagerDeps) {
        this._bump = () => this.deps.bumpTimelineRevision();
    }

    setupListeners(store: WorldlineStore): void {
        store.off('UPDATED', this._bump);
        store.off('ROLLED_BACK', this._bump);
        store.off('SWITCHED', this._bump);
        store.on('UPDATED', this._bump);
        store.on('ROLLED_BACK', this._bump);
        store.on('SWITCHED', this._bump);
    }

    switchToNode(targetNodeId: string): void {
        const ws = this.deps.getWorldlineStore();
        if (!ws.hasNode(targetNodeId)) return;
        // 切换前自动为当前活动节点捕获快照（若尚不存在）
        const currentLeaf = this.deps.getActiveLeafId();
        if (currentLeaf && !this.snapshots.has(currentLeaf)) {
            this.captureSnapshot(currentLeaf);
        }
        ws.activeLeafId = targetNodeId;
        this.deps.bumpTimelineRevision();
        void this.deps.refreshWorkflowSnapshot();
    }

    async branchFromNode(targetNodeId: string): Promise<boolean> {
        const ws = this.deps.getWorldlineStore();
        if (!ws.hasNode(targetNodeId)) return false;
        this.switchToNode(targetNodeId);
        return true;
    }

    async rollbackFromNode(targetNodeId: string): Promise<boolean> {
        const ws = this.deps.getWorldlineStore();
        const trace = ws.getTrace(ws.activeLeafId);
        const targetIndex = trace.findIndex(node => node.id === targetNodeId);
        if (targetIndex === -1) return false;

        const removedIds = new Set(trace.slice(targetIndex + 1).map(node => node.id));

        trace.slice(targetIndex + 1).reverse().forEach(node => {
            ws.removeNode(node.id, true);
        });

        if (removedIds.size > 0) {
            this.deps.replaceTimelineItems(
                this.deps.getTimelineItems().filter(item =>
                    item.kind !== 'message' || !removedIds.has((item as any).messageId)
                )
            );
        }

        ws.activeLeafId = targetNodeId;
        this.deps.bumpTimelineRevision();

        // 若目标节点有快照，恢复工作区状态
        const snapshot = this.snapshots.get(targetNodeId);
        if (snapshot) {
            this.restoreFromSnapshot(snapshot);
        }

        await this.deps.refreshWorkflowSnapshot();
        await this.deps.persistWorkspaceSession();
        return true;
    }

    // ────── 快照能力 ──────

    captureSnapshot(nodeId: string): ForgeWorldlineSnapshot {
        const d = this.deps;
        const snapshot: ForgeWorldlineSnapshot = {
            nodeId,
            createdAt: Date.now(),
            virtualLorebookEntries: d.getVirtualLorebookEntries().map(item => ({
                ...item,
                entry: JSON.parse(JSON.stringify(item.entry))
            })),
            commitReadyEntries: d.getCommitReadyEntries().map(e => ({ ...e })),
            stagingEntries: d.getStagingEntries().map(e => ({ ...e })),
            structuredState: cloneStructuredState(d.getStructuredState()),
            draftTree: cloneDraftTree(d.getDraftTree()),
            memoryTree: cloneForgeMemoryTree(d.getForgeMemoryTree()),
            workflowSnapshot: d.getWorkflowSnapshot(),
            activeLayer: d.getActiveLayer(),
            completedLayers: [...d.getCompletedLayers()]
        };
        this.snapshots.set(nodeId, snapshot);
        return snapshot;
    }

    restoreFromSnapshot(snapshot: ForgeWorldlineSnapshot): void {
        const d = this.deps;
        d.setVirtualLorebookEntries(snapshot.virtualLorebookEntries.map(item => ({
            ...item,
            entry: JSON.parse(JSON.stringify(item.entry))
        })));
        d.setCommitReadyEntries(snapshot.commitReadyEntries.map(e => ({ ...e })));
        d.setStagingEntries(snapshot.stagingEntries.map(e => ({ ...e })));
        d.setStructuredState(cloneStructuredState(snapshot.structuredState));
        d.setDraftTree(cloneDraftTree(snapshot.draftTree));
        d.setForgeMemoryTree(cloneForgeMemoryTree(snapshot.memoryTree));
        d.setWorkflowSnapshot(snapshot.workflowSnapshot);
        d.setActiveLayer(snapshot.activeLayer);
        d.setCompletedLayers([...snapshot.completedLayers]);
        d.syncDraftTree();
    }

    async rollbackWithSnapshot(nodeId: string): Promise<boolean> {
        const snapshot = this.snapshots.get(nodeId);
        if (!snapshot) {
            return this.rollbackFromNode(nodeId);
        }

        const success = await this.rollbackFromNode(nodeId);
        if (success) {
            this.restoreFromSnapshot(snapshot);
        }
        return success;
    }

    getSnapshot(nodeId: string): ForgeWorldlineSnapshot | undefined {
        return this.snapshots.get(nodeId);
    }

    getSnapshotMap(): Map<string, ForgeWorldlineSnapshot> {
        return this.snapshots;
    }

    setSnapshotMap(map: Map<string, ForgeWorldlineSnapshot>): void {
        this.snapshots = map;
    }
}
