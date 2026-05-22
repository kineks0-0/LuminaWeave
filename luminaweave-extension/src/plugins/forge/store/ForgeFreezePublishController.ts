import type { StagingEntry } from '../../../types/ForgeRuntimeTypes.js';
import type { ForgeVirtualLorebookEntry } from '../../../types/SessionTypes.js';

export interface ForgeFreezePublishControllerDeps {
    getIsCommitting(): boolean;
    setIsCommitting(value: boolean): void;
    getCommitReadyEntries(): StagingEntry[];
    getExistingVirtualEntry(targetEntryId: string): Pick<ForgeVirtualLorebookEntry, 'entry'> | null;
    buildFrozenContent(entry: StagingEntry, existingEntry?: LuminaLorebookEntry): LuminaLorebookEntry;
    upsertVirtualLorebookEntry(payload: { id?: string; entry: LuminaLorebookEntry; sourceBookId?: string | null }): string;
    removeVirtualLorebookEntry(id: string): boolean;
    removeCommitReadyEntry(id: string): void;
    setPublishState(value: 'drafting' | 'workspace_frozen'): void;
    addWorkspaceWriteOperation(successCount: number): void;
    syncDraftTree(): void;
    refreshWorkflowSnapshot(): Promise<unknown>;
    persistWorkspaceSession(): void | Promise<void>;
    setLastError(message: string | null): void;
    dispatchWorkspaceCommand(command: { type: 'freeze_workspace' }): Promise<unknown>;
}

export class ForgeFreezePublishController {
    constructor(private readonly deps: ForgeFreezePublishControllerDeps) {}

    async freezeCommitReadyEntriesToWorkspaceInternal(): Promise<boolean> {
        if (this.deps.getIsCommitting() || this.deps.getCommitReadyEntries().length === 0) {
            return false;
        }

        this.deps.setIsCommitting(true);
        this.deps.setLastError(null);

        try {
            const pendingEntries = [...this.deps.getCommitReadyEntries()];
            let successCount = 0;

            for (const stagedEntry of pendingEntries) {
                if (stagedEntry.operation === 'delete') {
                    this.deps.removeVirtualLorebookEntry(stagedEntry.targetEntryId);
                    this.deps.removeCommitReadyEntry(stagedEntry.id);
                    successCount += 1;
                    continue;
                }
                const existingVirtualEntry = this.deps.getExistingVirtualEntry(stagedEntry.targetEntryId);
                const nextEntry = this.deps.buildFrozenContent(stagedEntry, existingVirtualEntry?.entry);

                this.deps.upsertVirtualLorebookEntry({ id: stagedEntry.targetEntryId, entry: nextEntry });
                this.deps.removeCommitReadyEntry(stagedEntry.id);
                successCount += 1;
            }

            if (successCount > 0) {
                this.deps.setPublishState('workspace_frozen');
                this.deps.addWorkspaceWriteOperation(successCount);
            }

            this.deps.syncDraftTree();
            this.deps.setLastError(null);
            await this.deps.refreshWorkflowSnapshot();
            void this.deps.persistWorkspaceSession();
            return successCount > 0;
        } catch (error: any) {
            this.deps.setLastError(error?.message || '冻结到项目 VFS 失败');
            return false;
        } finally {
            this.deps.setIsCommitting(false);
        }
    }

    async freezeCommitReadyEntriesToWorkspace(): Promise<boolean> {
        if (this.deps.getCommitReadyEntries().length === 0) {
            return false;
        }
        await this.deps.dispatchWorkspaceCommand({ type: 'freeze_workspace' });
        return true;
    }
}
