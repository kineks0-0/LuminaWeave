import { describe, expect, it } from 'vitest';
import { buildWorkspaceChangeRestorePatch } from '../store/forgeWorkspaceChangeActions.js';
import type { ForgeFeedWorkspaceChange } from '../project/forgeWorkspaceChangePresentation.js';

const change = (overrides: Partial<ForgeFeedWorkspaceChange> = {}): ForgeFeedWorkspaceChange => ({
    id: 'patch-1:./card.md:0',
    patchEntryId: 'patch-1',
    path: './card.md',
    kind: 'update',
    beforeHash: 'before-hash',
    afterHash: 'after-hash',
    beforeContentRef: 'inline:before',
    afterContentRef: 'inline:after',
    restoreApplied: false,
    ...overrides
});

describe('forgeWorkspaceChangeActions', () => {
    it('builds a restore patch from a projected workspace change without UI-owned mutation logic', () => {
        const patch = buildWorkspaceChangeRestorePatch(change(), () => 123);

        expect(patch).toEqual({
            nodeId: 'workspace-restore-3f-patch-1',
            sourceToolCallId: 'workspace-change-restore:patch-1:./card.md',
            restoresEntryId: 'patch-1:./card.md',
            restoreDirection: 'before',
            changes: [{
                path: './card.md',
                kind: 'update',
                beforeHash: 'after-hash',
                afterHash: 'before-hash',
                beforeContentRef: 'inline:after',
                afterContentRef: 'inline:before'
            }]
        });
    });
});
