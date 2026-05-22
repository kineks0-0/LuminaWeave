import { describe, expect, it } from 'vitest';
import { ForgeWorkspaceVersionManager } from '@/api/core/forge/project/ForgeWorkspaceVersionManager.js';

describe('ForgeWorkspaceVersionManager', () => {
    it('creates deterministic patch payloads and replays them onto a file map', () => {
        const manager = new ForgeWorkspaceVersionManager();
        const patch = manager.createPatch({
            nodeId: 'node_patch',
            beforeFiles: {
                'a.md': 'old',
                'remove.md': 'gone'
            },
            afterFiles: {
                'a.md': 'new',
                'create.md': 'fresh'
            },
            sourceToolCallId: 'call_write'
        });

        expect(patch).toEqual({
            nodeId: 'node_patch',
            sourceToolCallId: 'call_write',
            changes: [
                expect.objectContaining({ path: 'a.md', kind: 'update', beforeHash: expect.any(String), afterHash: expect.any(String) }),
                expect.objectContaining({ path: 'create.md', kind: 'create', beforeHash: null, afterHash: expect.any(String) }),
                expect.objectContaining({ path: 'remove.md', kind: 'delete', beforeHash: expect.any(String), afterHash: null })
            ]
        });
        expect(manager.replay({ 'a.md': 'old', 'remove.md': 'gone' }, [patch])).toEqual({
            'a.md': 'new',
            'create.md': 'fresh'
        });
    });

    it('creates checkpoints with stable file tree hashes', () => {
        const manager = new ForgeWorkspaceVersionManager();

        const left = manager.createCheckpoint({
            nodeId: 'node_checkpoint',
            files: { b: '2', a: '1' },
            stateSnapshotRef: 'snapshot://one',
            label: 'before branch'
        });
        const right = manager.createCheckpoint({
            nodeId: 'node_checkpoint',
            files: { a: '1', b: '2' },
            stateSnapshotRef: 'snapshot://one',
            label: 'before branch'
        });

        expect(left.fileTreeHash).toBe(right.fileTreeHash);
        expect(left).toEqual(expect.objectContaining({
            nodeId: 'node_checkpoint',
            stateSnapshotRef: 'snapshot://one',
            label: 'before branch'
        }));
    });
});
