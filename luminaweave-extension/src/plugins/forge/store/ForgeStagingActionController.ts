import type { ForgeRuntimeEffect, StagingEntry } from '../../../types/ForgeRuntimeTypes.js';

type StagingEntryInput = Omit<StagingEntry, 'id' | 'timestamp'> & Partial<Pick<StagingEntry, 'id' | 'timestamp'>>;

export interface ForgeStagingActionControllerDeps {
    applyRuntimeEffects(effects: ForgeRuntimeEffect[]): Promise<void>;
}

export class ForgeStagingActionController {
    constructor(private readonly deps: ForgeStagingActionControllerDeps) {}

    upsertStagingEntry(entry: StagingEntryInput): void {
        void this.deps.applyRuntimeEffects([{ type: 'upsert_staging_entry', entry }]);
    }

    removeStagingEntry(id: string): void {
        void this.deps.applyRuntimeEffects([{ type: 'remove_staging_entry', stagingId: id }]);
    }

    moveStagingToCommitReady(id: string): void {
        void this.deps.applyRuntimeEffects([{ type: 'move_staging_to_commit_ready', stagingId: id }]);
    }

    moveCommitReadyToStaging(id: string): void {
        void this.deps.applyRuntimeEffects([{ type: 'move_commit_ready_to_staging', entryId: id }]);
    }
}
