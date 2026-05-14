import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForgeSkillRegistry } from '../forge/ForgeSkillRegistry.js';
import { ShellWorkspaceService } from '../hal/shell/ShellWorkspaceService.js';

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

describe('ForgeSkillRegistry', () => {
    let workspaces: ShellWorkspaceService;
    let registry: ForgeSkillRegistry;

    beforeEach(() => {
        store.clear();
        workspaces = new ShellWorkspaceService();
        registry = new ForgeSkillRegistry(workspaces);
    });

    it('lists concise built-in Forge skills', () => {
        const skills = registry.listBuiltInSkills();

        expect(skills.map(skill => skill.name)).toContain('virtual-lorebook-editor');
        expect(skills.map(skill => skill.name)).toContain('material-analyzer');
        expect(skills.every(skill => skill.builtIn)).toBe(true);
        expect(skills.every(skill => !('instructions' in skill))).toBe(true);
    });

    it('materializes selected built-in skills into the project workspace', async () => {
        const installed = await registry.materializeBuiltInSkills({
            forgeProjectId: 'forge_project_alpha',
            conversationId: 'conversation_alpha',
            skillNames: ['virtual-lorebook-editor']
        });

        expect(installed).toHaveLength(1);
        expect(installed[0]).toMatchObject({
            source: 'project',
            path: '/workspaces/forge/forge_project_alpha/skills/virtual-lorebook-editor'
        });
        expect(installed[0].skill.files[0].content).toContain('Virtual Lorebook Editor');

        const fs = await workspaces.getFileSystem({ projectId: 'forge_project_alpha' });
        await expect(fs.readFile('/forge/forge_project_alpha/skills/virtual-lorebook-editor/SKILL.md'))
            .resolves.toContain('Never publish directly to a real ST worldbook');
    });

    it('falls back to built-in skills when no project skill exists', async () => {
        const loaded = await registry.loadSkill({
            forgeProjectId: 'forge_project_beta',
            skillName: 'memory-curator'
        });

        expect(loaded).toMatchObject({
            source: 'built-in',
            path: 'builtin://forge/skills/memory-curator'
        });
        expect(loaded?.skill.files[0].content).toContain('Memory Curator');
    });

    it('rejects invalid skill names before reading project paths', async () => {
        await expect(registry.loadProjectSkill('forge_project_alpha', '../escape')).rejects.toThrow('Invalid Forge skill name');
    });
});
