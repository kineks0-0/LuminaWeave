import { beforeEach, describe, expect, it } from 'vitest';
import { initMockHAL } from '@/api/core/__tests__/support/halMock.js';
import { ShellWorkspaceService } from '@/api/core/hal/shell/ShellWorkspaceService.js';
import { ForgeWorkspaceGitService } from '@/api/core/forge/project/ForgeWorkspaceGitService.js';

describe('ForgeWorkspaceGitService', () => {
    let workspaces: ShellWorkspaceService;
    let git: ForgeWorkspaceGitService;

    beforeEach(() => {
        initMockHAL();
        workspaces = new ShellWorkspaceService({
            filesystemName: `lw-git-service-${Date.now()}-${Math.random().toString(36).slice(2)}`
        });
        git = new ForgeWorkspaceGitService();
    });

    it('commits current VFS changes, skips empty commits, and exposes log/diff', async () => {
        const fs = await workspaces.getFileSystem({ projectId: 'project-git' });
        const repoRoot = '/forge/project-git';

        await fs.writeFile(`${repoRoot}/README.md`, 'hello');
        const first = await git.commitAll({
            fs,
            repoRoot,
            message: 'write readme'
        });

        expect(first.committed).toBe(true);
        expect(first.hash).toMatch(/^[0-9a-f]{40}$/);
        expect(first.parentHash).toBeNull();
        expect(first.changedFiles).toEqual([
            expect.objectContaining({
                path: 'README.md',
                status: 'added'
            })
        ]);

        const empty = await git.commitAll({
            fs,
            repoRoot,
            message: 'empty write'
        });
        expect(empty.committed).toBe(false);
        expect(empty.hash).toBe(first.hash);

        await fs.writeFile(`${repoRoot}/README.md`, 'hello2');
        const second = await git.commitAll({
            fs,
            repoRoot,
            message: 'update readme'
        });
        expect(second.committed).toBe(true);
        expect(second.parentHash).toBe(first.hash);

        const log = await git.log({ fs, repoRoot, limit: 5 });
        expect(log.map(entry => entry.message.trim())).toEqual(['update readme', 'write readme']);
        expect(log[0].changedFiles).toEqual([
            expect.objectContaining({
                path: 'README.md',
                status: 'modified'
            })
        ]);

        const diff = await git.diff({
            fs,
            repoRoot,
            baseHash: log[1].hash,
            headHash: log[0].hash
        });
        expect(diff.text).toContain('-hello');
        expect(diff.text).toContain('+hello2');
    });
});
