import { describe, expect, it, vi } from 'vitest';
import { ForgeFreezePublishController } from '../store/ForgeFreezePublishController.js';
import type { StagingEntry } from '../../../types/ForgeRuntimeTypes.js';

const createStagingEntry = (id: string, targetEntryId: string): StagingEntry => ({
    id,
    targetEntryId,
    originalContent: '',
    proposedContent: `content-${id}`,
    description: `desc-${id}`,
    timestamp: 100,
    layer: 'concept',
    sourceTag: 'test',
    sourceMessageId: null,
    sourceSessionId: null
});

describe('ForgeFreezePublishController', () => {
    it('does not freeze while already committing or without commit-ready entries', async () => {
        const setCommitting = vi.fn();
        const controller = new ForgeFreezePublishController({
            getIsCommitting: () => true,
            setIsCommitting: setCommitting,
            getCommitReadyEntries: () => [createStagingEntry('s1', 'entry-1')],
            getExistingVirtualEntry: () => null,
            buildFrozenContent: vi.fn(),
            upsertVirtualLorebookEntry: vi.fn(),
            removeVirtualLorebookEntry: vi.fn(),
            removeCommitReadyEntry: vi.fn(),
            setPublishState: vi.fn(),
            addWorkspaceWriteOperation: vi.fn(),
            syncDraftTree: vi.fn(),
            refreshWorkflowSnapshot: vi.fn(),
            persistWorkspaceSession: vi.fn(),
            setLastError: vi.fn(),
            dispatchWorkspaceCommand: vi.fn()
        });

        await expect(controller.freezeCommitReadyEntriesToWorkspaceInternal()).resolves.toBe(false);
        expect(setCommitting).not.toHaveBeenCalled();
    });

    it('freezes each commit-ready entry into virtual lorebook workspace', async () => {
        const entry = createStagingEntry('s1', 'entry-1');
        const setCommitting = vi.fn();
        const setLastError = vi.fn();
        const upsertVirtualLorebookEntry = vi.fn();
        const removeCommitReadyEntry = vi.fn();
        const addWorkspaceWriteOperation = vi.fn();
        const syncDraftTree = vi.fn();
        const refreshWorkflowSnapshot = vi.fn().mockResolvedValue(undefined);
        const persistWorkspaceSession = vi.fn();
        const controller = new ForgeFreezePublishController({
            getIsCommitting: () => false,
            setIsCommitting: setCommitting,
            getCommitReadyEntries: () => [entry],
            getExistingVirtualEntry: () => ({ entry: { comment: 'old' } as any }),
            buildFrozenContent: vi.fn().mockReturnValue({ comment: 'new', content: 'content-s1' }),
            upsertVirtualLorebookEntry,
            removeVirtualLorebookEntry: vi.fn(),
            removeCommitReadyEntry,
            setPublishState: vi.fn(),
            addWorkspaceWriteOperation,
            syncDraftTree,
            refreshWorkflowSnapshot,
            persistWorkspaceSession,
            setLastError,
            dispatchWorkspaceCommand: vi.fn()
        });

        await expect(controller.freezeCommitReadyEntriesToWorkspaceInternal()).resolves.toBe(true);

        expect(setCommitting).toHaveBeenNthCalledWith(1, true);
        expect(setCommitting).toHaveBeenLastCalledWith(false);
        expect(upsertVirtualLorebookEntry).toHaveBeenCalledWith({
            id: 'entry-1',
            entry: { comment: 'new', content: 'content-s1' }
        });
        expect(removeCommitReadyEntry).toHaveBeenCalledWith('s1');
        expect(addWorkspaceWriteOperation).toHaveBeenCalledWith(1);
        expect(syncDraftTree).toHaveBeenCalledTimes(1);
        expect(refreshWorkflowSnapshot).toHaveBeenCalledTimes(1);
        expect(persistWorkspaceSession).toHaveBeenCalledTimes(1);
        expect(setLastError).toHaveBeenLastCalledWith(null);
    });

    it('dispatches freeze command only when commit-ready entries exist', async () => {
        const dispatchWorkspaceCommand = vi.fn().mockResolvedValue({});
        const controller = new ForgeFreezePublishController({
            getIsCommitting: () => false,
            setIsCommitting: vi.fn(),
            getCommitReadyEntries: () => [createStagingEntry('s1', 'entry-1')],
            getExistingVirtualEntry: () => null,
            buildFrozenContent: vi.fn(),
            upsertVirtualLorebookEntry: vi.fn(),
            removeVirtualLorebookEntry: vi.fn(),
            removeCommitReadyEntry: vi.fn(),
            setPublishState: vi.fn(),
            addWorkspaceWriteOperation: vi.fn(),
            syncDraftTree: vi.fn(),
            refreshWorkflowSnapshot: vi.fn(),
            persistWorkspaceSession: vi.fn(),
            setLastError: vi.fn(),
            dispatchWorkspaceCommand
        });

        await expect(controller.freezeCommitReadyEntriesToWorkspace()).resolves.toBe(true);
        expect(dispatchWorkspaceCommand).toHaveBeenCalledWith({ type: 'freeze_workspace' });
    });

    it('freezes delete entries by removing virtual lorebook workspace entries', async () => {
        const entry: StagingEntry = {
            ...createStagingEntry('s1', 'entry-1'),
            operation: 'delete',
            originalContent: 'old content',
            proposedContent: ''
        };
        const removeVirtualLorebookEntry = vi.fn().mockReturnValue(true);
        const removeCommitReadyEntry = vi.fn();
        const upsertVirtualLorebookEntry = vi.fn();
        const controller = new ForgeFreezePublishController({
            getIsCommitting: () => false,
            setIsCommitting: vi.fn(),
            getCommitReadyEntries: () => [entry],
            getExistingVirtualEntry: vi.fn(),
            buildFrozenContent: vi.fn(),
            upsertVirtualLorebookEntry,
            removeVirtualLorebookEntry,
            removeCommitReadyEntry,
            setPublishState: vi.fn(),
            addWorkspaceWriteOperation: vi.fn(),
            syncDraftTree: vi.fn(),
            refreshWorkflowSnapshot: vi.fn().mockResolvedValue(undefined),
            persistWorkspaceSession: vi.fn(),
            setLastError: vi.fn(),
            dispatchWorkspaceCommand: vi.fn()
        });

        await expect(controller.freezeCommitReadyEntriesToWorkspaceInternal()).resolves.toBe(true);

        expect(removeVirtualLorebookEntry).toHaveBeenCalledWith('entry-1');
        expect(upsertVirtualLorebookEntry).not.toHaveBeenCalled();
        expect(removeCommitReadyEntry).toHaveBeenCalledWith('s1');
    });
});
