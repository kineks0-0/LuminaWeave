import { describe, expect, it, vi } from 'vitest';
import { ForgeStagingActionController } from '../store/ForgeStagingActionController.js';

describe('ForgeStagingActionController', () => {
    it('routes staging entry writes through runtime effects', async () => {
        const applyRuntimeEffects = vi.fn().mockResolvedValue(undefined);
        const controller = new ForgeStagingActionController({ applyRuntimeEffects });
        const entry = {
            id: 'staging-1',
            targetEntryId: 'entry-1',
            title: '测试条目',
            content: '内容'
        } as any;

        controller.upsertStagingEntry(entry);
        controller.removeStagingEntry('staging-1');
        controller.moveStagingToCommitReady('staging-1');
        controller.moveCommitReadyToStaging('commit-1');

        expect(applyRuntimeEffects).toHaveBeenNthCalledWith(1, [{ type: 'upsert_staging_entry', entry }]);
        expect(applyRuntimeEffects).toHaveBeenNthCalledWith(2, [{ type: 'remove_staging_entry', stagingId: 'staging-1' }]);
        expect(applyRuntimeEffects).toHaveBeenNthCalledWith(3, [{ type: 'move_staging_to_commit_ready', stagingId: 'staging-1' }]);
        expect(applyRuntimeEffects).toHaveBeenNthCalledWith(4, [{ type: 'move_commit_ready_to_staging', entryId: 'commit-1' }]);
    });
});
