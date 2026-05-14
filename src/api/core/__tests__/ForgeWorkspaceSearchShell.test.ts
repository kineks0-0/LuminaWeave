import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForgeWorkspaceSearchShell } from '../forge/ForgeWorkspaceSearchShell.js';
import {
    shellPermissionService,
    shellWorkspaceService,
    virtualFileSystemService
} from '../hal/shell/index.js';

const { store } = vi.hoisted(() => ({
    store: new Map<string, unknown>()
}));

vi.mock('@shared/api/BridgeDispatcher.js', () => ({
    BridgeDispatcher: {
        extensionStore: {
            getJson: vi.fn(async ({ key }: { key: string }) => store.get(key) ?? null),
            setJson: vi.fn(async ({ key, value }: { key: string; value: unknown }) => {
                store.set(key, value);
            }),
            listKeys: vi.fn(async () => Array.from(store.keys()))
        }
    }
}));

describe('ForgeWorkspaceSearchShell', () => {
    let shell: ForgeWorkspaceSearchShell;

    beforeEach(async () => {
        store.clear();
        shellWorkspaceService.resetForTests();
        shell = new ForgeWorkspaceSearchShell(virtualFileSystemService, shellPermissionService);
        const fs = await shellWorkspaceService.getFileSystem({
            projectId: 'forge_project_alpha',
            conversationId: 'conversation_alpha'
        });
        await fs.mkdir('/forge/forge_project_alpha/lorebook/entries', { recursive: true });
        await fs.writeFile('/forge/forge_project_alpha/lorebook/entries/city.json', JSON.stringify({
            id: 'city',
            content: 'A ritual city with elevator shrines.'
        }, null, 2));
        await fs.writeFile('/forge/forge_project_alpha/material.txt', 'ritual city\nclockwork harbor\n');
    });

    it('runs read-only search commands inside the current Forge project workspace', async () => {
        const result = await shell.execute({
            forgeProjectId: 'forge_project_alpha',
            conversationId: 'conversation_alpha',
            command: 'grep ritual material.txt',
            reason: 'Find material snippets'
        });

        expect(result.ok).toBe(true);
        expect(result.cwd).toBe('/workspaces/forge/forge_project_alpha');
        expect(result.mode).toBe('project-readonly');
        expect(result.result.stdout).toContain('ritual city');
        expect(result.trace).toMatchObject({
            forgeProjectId: 'forge_project_alpha',
            conversationId: 'conversation_alpha',
            reason: 'Find material snippets'
        });
    });

    it('blocks shell writes to Forge business files and suggests typed effects', async () => {
        const result = await shell.execute({
            forgeProjectId: 'forge_project_alpha',
            conversationId: 'conversation_alpha',
            command: 'echo "{}" > lorebook/entries/new.json',
            reason: 'Try writing an entry'
        });

        expect(result.ok).toBe(false);
        expect(result.result.stderr).toContain('forge.effect.apply');
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
            command: 'cat lorebook/entries/city.json',
            reason: 'Inspect entry',
            maxOutputBytes: 12
        });

        expect(result.ok).toBe(true);
        expect(result.truncated).toBe(true);
        expect(result.overflowResourceUri).toContain('trace://forge/forge_project_alpha/shell-output/');
        expect(result.result.stdout).toContain('[output truncated:');
    });
});
