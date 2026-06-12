import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initMockHAL } from '@/api/core/__tests__/support/halMock.js';
import { AgentSkillParser } from '@/api/core/agent-runtime/skills/AgentSkillParser.js';
import { ForgeSkillRegistry } from '@/api/core/forge/skills/ForgeSkillRegistry.js';
import { ShellWorkspaceService } from '@/api/core/hal/shell/ShellWorkspaceService.js';

const { store } = vi.hoisted(() => ({
    store: new Map<string, unknown>()
}));


describe('ForgeSkillRegistry', () => {
    let workspaces: ShellWorkspaceService;
    let registry: ForgeSkillRegistry;

    beforeEach(() => {
        store.clear();
        initMockHAL({ runtime: { extensionStore: { listKeys: vi.fn(async () => Array.from(store.keys())), getJson: vi.fn(async ({ key }: { key: string }) => store.get(key) ?? null), setJson: vi.fn(async ({ key, value }: { key: string; value: unknown }) => { store.set(key, value); }), updateJson: vi.fn(async ({ key, value }: { key: string; value: unknown }) => { store.set(key, value); }), deleteJson: vi.fn(async ({ key }: { key: string }) => { store.delete(key); }), setBlob: vi.fn(), getBlob: vi.fn() } } });
        workspaces = new ShellWorkspaceService();
        registry = new ForgeSkillRegistry(workspaces);
    });

    it('lists concise built-in Forge skills', () => {
        const skills = registry.listBuiltInSkills();

        expect(skills.map(skill => skill.name)).toContain('virtual-lorebook-editor');
        expect(skills.map(skill => skill.name)).toContain('material-analyzer');
        expect(skills.every(skill => /[\u4e00-\u9fff]/.test(`${skill.title}${skill.description}`))).toBe(true);
        expect(skills.every(skill => skill.builtIn)).toBe(true);
        expect(skills.every(skill => skill.resourcePath.startsWith('src/resources/forge-agent/base/skills/'))).toBe(true);
        expect(skills.every(skill => skill.resourcePath.endsWith('/SKILL.md'))).toBe(true);
        expect(skills.every(skill => !('instructions' in skill))).toBe(true);
    });

    it('exposes built-in Forge skills as standard SKILL.md files', async () => {
        const parser = new AgentSkillParser();

        for (const metadata of registry.listBuiltInSkills()) {
            const loaded = await registry.loadSkill({
                forgeProjectId: 'forge_project_alpha',
                skillName: metadata.name,
                preferProject: false
            });
            const content = loaded?.skill.files.find(file => file.path === 'SKILL.md')?.content ?? '';
            const parsed = parser.parse({
                path: loaded?.path ?? `./agent/skills/${metadata.name}/SKILL.md`,
                content
            });

            expect(parsed.diagnostics, metadata.name).toEqual([]);
            expect(parsed.skill).toMatchObject({
                name: metadata.name,
                description: metadata.description,
                path: `./agent/skills/${metadata.name}/SKILL.md`
            });
        }
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
            path: './agent/skills/virtual-lorebook-editor/SKILL.md'
        });
        expect(installed[0].skill.files[0].content).toContain('虚拟世界书编辑器');

        const parsed = new AgentSkillParser().parse({
            path: installed[0].path,
            content: installed[0].skill.files[0].content
        });
        expect(parsed.diagnostics).toEqual([]);
        expect(parsed.skill?.name).toBe('virtual-lorebook-editor');

        const fs = await workspaces.getFileSystem({ projectId: 'forge_project_alpha' });
        await expect(fs.readFile('/forge/forge_project_alpha/agent/skills/virtual-lorebook-editor/SKILL.md'))
            .resolves.toContain('不要直接发布到真实 ST 世界书');
    });

    it('falls back to built-in skills when no project skill exists', async () => {
        const loaded = await registry.loadSkill({
            forgeProjectId: 'forge_project_beta',
            skillName: 'memory-curator'
        });

        expect(loaded).toMatchObject({
            source: 'built-in',
            path: './agent/skills/memory-curator/SKILL.md'
        });
        expect(loaded?.skill.files[0].content).toContain('项目记忆整理员');
    });

    it('loads project skills from the pi-style agent skill path', async () => {
        const fs = await workspaces.getFileSystem({
            projectId: 'forge_project_alpha',
            conversationId: 'conversation_alpha'
        });
        await fs.mkdir('/forge/forge_project_alpha/agent/skills/custom-skill', { recursive: true });
        await fs.writeFile('/forge/forge_project_alpha/agent/skills/custom-skill/SKILL.md', '# 自定义技能\n\n项目级操作手册');

        const loaded = await registry.loadSkill({
            forgeProjectId: 'forge_project_alpha',
            conversationId: 'conversation_alpha',
            skillName: 'custom-skill'
        });

        expect(loaded).toMatchObject({
            source: 'project',
            path: './agent/skills/custom-skill/SKILL.md'
        });
        expect(loaded?.skill.files[0].content).toContain('项目级操作手册');
    });

    it('rejects invalid skill names before reading project paths', async () => {
        await expect(registry.loadProjectSkill('forge_project_alpha', '../escape')).rejects.toThrow('Invalid Forge skill name');
    });
});
