import { beforeEach, describe, expect, it } from 'vitest';
import { initMockHAL } from '@/api/core/__tests__/support/halMock.js';
import { ShellWorkspaceService, forgeWorkspacePath } from '@/api/core/hal/shell/ShellWorkspaceService.js';
import { ForgeWorkspaceGitService } from '@/api/core/forge/project/ForgeWorkspaceGitService.js';
import { ForgeWorkspaceWriteService } from '@/api/core/forge/project/ForgeWorkspaceWriteService.js';

describe('ForgeWorkspaceWriteService', () => {
    let workspaces: ShellWorkspaceService;
    let service: ForgeWorkspaceWriteService;

    beforeEach(() => {
        initMockHAL();
        workspaces = new ShellWorkspaceService({
            filesystemName: `lw-write-service-${Date.now()}-${Math.random().toString(36).slice(2)}`
        });
        service = new ForgeWorkspaceWriteService({
            workspaces,
            git: new ForgeWorkspaceGitService()
        });
    });

    it('writes current VFS content, commits real changes, and skips unchanged writes', async () => {
        const first = await service.write({
            forgeProjectId: 'project-write',
            conversationId: 'conversation-write',
            sourceToolCallId: 'call_write',
            displayPath: './card.md',
            workspacePath: `${forgeWorkspacePath('project-write')}/card.md`,
            contentAfter: 'hello',
            command: 'write ./card.md'
        });

        expect(first).toMatchObject({
            applied: true,
            path: './card.md',
            workspaceWriteSummary: {
                sourceToolCallId: 'call_write',
                writeCount: 1,
                changedFiles: [expect.objectContaining({
                    path: './card.md',
                    kind: 'create'
                })],
                errors: [],
                gitParentHash: null
            }
        });
        expect(first.gitCommitHash).toMatch(/^[0-9a-f]{40}$/);
        expect(first.workspaceWriteSummary.gitCommitHash).toBe(first.gitCommitHash);

        const unchanged = await service.write({
            forgeProjectId: 'project-write',
            conversationId: 'conversation-write',
            sourceToolCallId: 'call_write_same',
            displayPath: './card.md',
            workspacePath: `${forgeWorkspacePath('project-write')}/card.md`,
            contentAfter: 'hello',
            command: 'write ./card.md'
        });

        expect(unchanged.applied).toBe(true);
        expect(unchanged.changedFiles).toEqual([]);
        expect(unchanged.gitCommitHash).toBeNull();
        expect(unchanged.workspaceWriteSummary.writeCount).toBe(0);

        const second = await service.write({
            forgeProjectId: 'project-write',
            conversationId: 'conversation-write',
            sourceToolCallId: 'call_edit',
            displayPath: './card.md',
            workspacePath: `${forgeWorkspacePath('project-write')}/card.md`,
            contentAfter: 'hello2',
            command: 'edit ./card.md'
        });

        expect(second.gitCommitHash).toMatch(/^[0-9a-f]{40}$/);
        expect(second.gitParentHash).toBe(first.gitCommitHash);
        expect(second.workspaceWriteSummary.changedFiles).toEqual([
            expect.objectContaining({
                path: './card.md',
                kind: 'update'
            })
        ]);
    });
});
