import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initMockHAL } from '@/api/core/__tests__/support/halMock.js';
import { ForgeWorkspaceSearchShell } from '@/api/core/forge/shell/ForgeWorkspaceSearchShell.js';
import {
    shellPermissionService,
    shellWorkspaceService,
    virtualFileSystemService
} from '@/api/core/hal/shell/index.js';

const { store } = vi.hoisted(() => ({
    store: new Map<string, unknown>()
}));


describe('ForgeWorkspaceSearchShell', () => {
    let shell: ForgeWorkspaceSearchShell;

    beforeEach(async () => {
        store.clear();
        initMockHAL({ runtime: { extensionStore: { listKeys: vi.fn(async () => Array.from(store.keys())), getJson: vi.fn(async ({ key }: { key: string }) => store.get(key) ?? null), setJson: vi.fn(async ({ key, value }: { key: string; value: unknown }) => { store.set(key, value); }), updateJson: vi.fn(async ({ key, value }: { key: string; value: unknown }) => { store.set(key, value); }), deleteJson: vi.fn(async ({ key }: { key: string }) => { store.delete(key); }), setBlob: vi.fn(), getBlob: vi.fn() } } });
        shellWorkspaceService.resetForTests();
        shell = new ForgeWorkspaceSearchShell(virtualFileSystemService, shellPermissionService);
        const fs = await shellWorkspaceService.getFileSystem({
            projectId: 'forge_project_alpha',
            conversationId: 'conversation_alpha'
        });
        await fs.mkdir('/forge/forge_project_alpha/lorebook/entries', { recursive: true });
        await fs.mkdir('/forge/forge_project_alpha/lorebook/empty', { recursive: true });
        await fs.writeFile('/forge/forge_project_alpha/lorebook/entries/city.json', JSON.stringify({
            id: 'city',
            content: 'A ritual city with elevator shrines.'
        }, null, 2));
        await fs.writeFile('/forge/forge_project_alpha/material.txt', 'ritual city\nclockwork harbor\n');
    });

    it('lists actual Forge project VFS files as semantic project paths', async () => {
        const files = await shellWorkspaceService.listForgeProjectFiles({
            forgeProjectId: 'forge_project_alpha',
            conversationId: 'conversation_alpha'
        });

        expect(files).toEqual(expect.arrayContaining([
            expect.objectContaining({
                path: './material.txt',
                workspacePath: '/workspaces/forge/forge_project_alpha/material.txt',
                content: 'ritual city\nclockwork harbor\n'
            }),
            expect.objectContaining({
                path: './lorebook/entries/city.json',
                workspacePath: '/workspaces/forge/forge_project_alpha/lorebook/entries/city.json',
                content: expect.stringContaining('ritual city')
            })
        ]));
        expect(files.map(file => file.path)).not.toContain('./AGENTS.md');
    });

    it('lists actual Forge project VFS directories and files', async () => {
        const entries = await shellWorkspaceService.listForgeProjectEntries({
            forgeProjectId: 'forge_project_alpha',
            conversationId: 'conversation_alpha'
        });

        expect(entries).toEqual(expect.arrayContaining([
            expect.objectContaining({
                kind: 'directory',
                path: './chat/conversation_alpha/',
                workspacePath: '/workspaces/forge/forge_project_alpha/chat/conversation_alpha',
                content: null
            }),
            expect.objectContaining({
                kind: 'directory',
                path: './lorebook/empty/',
                workspacePath: '/workspaces/forge/forge_project_alpha/lorebook/empty',
                content: null
            }),
            expect.objectContaining({
                kind: 'file',
                path: './material.txt',
                workspacePath: '/workspaces/forge/forge_project_alpha/material.txt',
                content: 'ritual city\nclockwork harbor\n'
            })
        ]));
        expect(entries.every(entry => entry.path.startsWith('./'))).toBe(true);
        expect(entries.some(entry => entry.path.includes('forge_project_alpha'))).toBe(false);
    });

    it('runs read-only search commands inside the current Forge project workspace', async () => {
        const result = await shell.execute({
            forgeProjectId: 'forge_project_alpha',
            conversationId: 'conversation_alpha',
            command: 'grep ritual material.txt',
            reason: 'Find material snippets'
        });

        expect(result.ok).toBe(true);
        expect(result.cwd).toBe('./');
        expect(result.mode).toBe('project-readonly');
        expect(result.result.stdout).toContain('ritual city');
        expect(result.trace).toMatchObject({
            forgeProjectId: 'forge_project_alpha',
            conversationId: 'conversation_alpha',
            reason: 'Find material snippets'
        });
    });

    it('mounts Forge semantic VFS as the shell project root', async () => {
        const agents = await shell.execute({
            forgeProjectId: 'forge_project_alpha',
            conversationId: 'conversation_alpha',
            command: 'cat ./AGENTS.md',
            reason: 'Read default agent context'
        });
        const planner = await shell.execute({
            forgeProjectId: 'forge_project_alpha',
            conversationId: 'conversation_alpha',
            command: 'cat ./.forge/agent/PLANNER.md',
            reason: 'Read planner prompt'
        });
        const system = await shell.execute({
            forgeProjectId: 'forge_project_alpha',
            conversationId: 'conversation_alpha',
            command: 'cat ./.forge/agent/SYSTEM.md',
            reason: 'Read system prompt'
        });
        const listing = await shell.execute({
            forgeProjectId: 'forge_project_alpha',
            conversationId: 'conversation_alpha',
            command: 'find ./.forge -maxdepth 4 -type f',
            reason: 'List semantic project files'
        });

        expect(agents.ok).toBe(true);
        expect(agents.result.stdout).toContain('工作契约');
        expect(planner.ok).toBe(true);
        expect(planner.result.stdout).toContain('Planner');
        expect(system.ok).toBe(true);
        expect(system.result.stdout).toContain('Forge');
        expect(listing.ok).toBe(true);
        expect(listing.result.stdout).toContain('./.forge/agent/SYSTEM.md');
        expect(listing.result.stdout).toContain('./.forge/agent/PLANNER.md');
        expect(listing.result.stdout).not.toContain('./.forge/PLANNER.md');
        expect(listing.result.stdout).not.toContain('./.pi/agent/prompts/');
        expect(listing.result.stdout).not.toContain('./chat/');
        expect(listing.result.stdout).not.toContain('conversation_alpha');
    });

    it('blocks redirect writes in project-readonly and suggests project-write-request mode', async () => {
        const result = await shell.execute({
            forgeProjectId: 'forge_project_alpha',
            conversationId: 'conversation_alpha',
            command: 'echo "{}" > lorebook/entries/new.json',
            reason: 'Try writing an entry'
        });

        expect(result.ok).toBe(false);
        expect(result.result.stderr).toContain('project-write-request');
        expect(result.trace.deniedReason).toContain('redirection is blocked');
    });

    it('blocks absolute paths outside the current Forge project', async () => {
        const result = await shell.execute({
            forgeProjectId: 'forge_project_alpha',
            conversationId: 'conversation_alpha',
            command: 'cat /workspaces/forge/other_project/project.json',
            reason: 'Check another project'
        });

        expect(result.ok).toBe(false);
        expect(result.diagnostics[0]).toContain('outside current Forge project');
    });

    it('truncates oversized output and returns a trace resource URI', async () => {
        const result = await shell.execute({
            forgeProjectId: 'forge_project_alpha',
            conversationId: 'conversation_alpha',
            command: 'cat ./material.txt',
            reason: 'Inspect material',
            maxOutputBytes: 12
        });

        expect(result.ok).toBe(true);
        expect(result.truncated).toBe(true);
        expect(result.overflowResourceUri).toContain('trace://forge/forge_project_alpha/shell-output/');
        expect(result.result.stdout).toContain('[output truncated:');
    });

    it('accepts semantic current-thread paths in shell commands', async () => {
        const fs = await shellWorkspaceService.getFileSystem({
            projectId: 'forge_project_alpha',
            conversationId: 'conversation_alpha'
        });
        await fs.mkdir('/forge/forge_project_alpha/chat/conversation_alpha', { recursive: true });
        await fs.writeFile('/forge/forge_project_alpha/chat/conversation_alpha/messages.json', '[{"role":"user","content":"hello"}]');

        const result = await shell.execute({
            forgeProjectId: 'forge_project_alpha',
            conversationId: 'conversation_alpha',
            command: 'cat ./threads/目前/messages.md',
            reason: 'Read current thread'
        });

        expect(result.ok).toBe(true);
        expect(result.result.stdout).toContain('hello');
        expect(result.result.stdout).not.toContain('conversation_alpha');
    });

    it('rewrites relative raw thread paths from shell output to semantic aliases', async () => {
        const fs = await shellWorkspaceService.getFileSystem({
            projectId: 'forge_project_alpha',
            conversationId: 'conversation_alpha'
        });
        await fs.mkdir('/forge/forge_project_alpha/chat/conversation_alpha', { recursive: true });
        await fs.writeFile('/forge/forge_project_alpha/chat/conversation_alpha/messages.json', '[{"role":"user","content":"hello"}]');

        const result = await shell.execute({
            forgeProjectId: 'forge_project_alpha',
            conversationId: 'conversation_alpha',
            command: 'find . -maxdepth 4 -name messages.md',
            reason: 'List thread messages file'
        });

        expect(result.ok).toBe(true);
        expect(result.result.stdout).toContain('./threads/目前/messages.md');
        expect(result.result.stdout).not.toContain('conversation_alpha');
        expect(result.result.stdout).not.toContain('./chat/');
    });

    it('accepts stable historical thread paths in shell commands', async () => {
        await shellWorkspaceService.bindForgeConversation({
            forgeProjectId: 'forge_project_alpha',
            conversationId: 'conversation_alpha'
        });
        await shellWorkspaceService.bindForgeConversation({
            forgeProjectId: 'forge_project_alpha',
            conversationId: 'conversation_beta'
        });
        await shellWorkspaceService.writeForgeConversationProjection({
            forgeProjectId: 'forge_project_alpha',
            conversationId: 'conversation_alpha',
            workspaceSessionId: 'forge_project_alpha',
            workspacePath: '/workspaces/forge/forge_project_alpha/chat/conversation_alpha',
            title: '目前线程',
            createdAt: 1,
            updatedAt: 1,
            activeLeafId: null,
            messages: [{ role: 'user', content: 'current' }]
        });
        await shellWorkspaceService.writeForgeConversationProjection({
            forgeProjectId: 'forge_project_alpha',
            conversationId: 'conversation_beta',
            workspaceSessionId: 'forge_project_alpha',
            workspacePath: '/workspaces/forge/forge_project_alpha/chat/conversation_beta',
            title: '历史线程',
            createdAt: 2,
            updatedAt: 2,
            activeLeafId: null,
            messages: [{ role: 'user', content: 'historical' }]
        });

        const result = await shell.execute({
            forgeProjectId: 'forge_project_alpha',
            conversationId: 'conversation_alpha',
            command: 'cat ./threads/02历史线程/messages.md',
            reason: 'Read historical thread'
        });

        expect(result.ok).toBe(true);
        expect(result.result.stdout).toContain('historical');
        expect(result.result.stdout).not.toContain('conversation_beta');
    });
});
