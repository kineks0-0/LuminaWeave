import type { AgentSkillDefinition } from '../../hal/shell/AgentBashToolService.js';
import {
    forgeWorkspacePath,
    type ShellWorkspaceService,
    shellWorkspaceService
} from '../../hal/shell/ShellWorkspaceService.js';
import _exportPreparer from '../../../../resources/forge-skills/export-preparer.md?raw';
import _forgeProjectWriter from '../../../../resources/forge-skills/forge-project-writer.md?raw';
import _materialAnalyzer from '../../../../resources/forge-skills/material-analyzer.md?raw';
import _memoryCurator from '../../../../resources/forge-skills/memory-curator.md?raw';
import _testChatRunner from '../../../../resources/forge-skills/test-chat-runner.md?raw';
import _virtualLorebookEditor from '../../../../resources/forge-skills/virtual-lorebook-editor.md?raw';
import _workspacePatchAuditor from '../../../../resources/forge-skills/workspace-patch-auditor.md?raw';

export interface ForgeSkillMetadata {
    name: string;
    title: string;
    description: string;
    defaultWriteScope: string;
    resourcePath: string;
    builtIn: boolean;
}

export interface ForgeSkillLoadResult {
    skill: AgentSkillDefinition;
    source: 'built-in' | 'project';
    path: string;
}

const normalizeSkillName = (name: string): string => name.trim().toLowerCase();

const assertSkillName = (name: string): string => {
    const normalized = normalizeSkillName(name);
    if (!/^[a-z0-9][a-z0-9-]*$/.test(normalized)) {
        throw new Error(`Invalid Forge skill name: ${name}`);
    }
    return normalized;
};

const stripWorkspaceRoot = (path: string): string =>
    path.replace(/^\/workspaces(?=\/|$)/, '') || '/';

const semanticSkillPath = (skillName: string): string =>
    `./agent/skills/${skillName}/SKILL.md`;

const builtInSkill = (
    input: Omit<ForgeSkillMetadata, 'builtIn'> & { instructions: string }
): ForgeSkillMetadata & { instructions: string } => ({
    ...input,
    builtIn: true
});

const BUILT_IN_SKILLS = [
    builtInSkill({
        name: 'forge-project-writer',
        title: 'Forge 项目写入员',
        description: '通过 direct write tools 与 VFS 快照维护 project.json、草稿、项目补丁和记忆。',
        defaultWriteScope: '/workspaces/forge/<projectId>/',
        resourcePath: 'src/resources/forge-skills/forge-project-writer.md',
        instructions: _forgeProjectWriter
    }),
    builtInSkill({
        name: 'virtual-lorebook-editor',
        title: '虚拟世界书编辑器',
        description: '在 Forge 项目工作区内创建、拆分、合并、重写虚拟世界书条目。',
        defaultWriteScope: '/workspaces/forge/<projectId>/lorebook/entries/',
        resourcePath: 'src/resources/forge-skills/virtual-lorebook-editor.md',
        instructions: _virtualLorebookEditor
    }),
    builtInSkill({
        name: 'memory-curator',
        title: '项目记忆整理员',
        description: '把用户偏好、硬性约束、禁忌和设定决议整理进项目记忆树。',
        defaultWriteScope: '/workspaces/forge/<projectId>/memory/tree.json',
        resourcePath: 'src/resources/forge-skills/memory-curator.md',
        instructions: _memoryCurator
    }),
    builtInSkill({
        name: 'workspace-patch-auditor',
        title: '工作区补丁审计员',
        description: '把草稿和生成变更转换为可 diff、可撤回的 workspace_patch 审计记录。',
        defaultWriteScope: '/workspaces/forge/<projectId>/',
        resourcePath: 'src/resources/forge-skills/workspace-patch-auditor.md',
        instructions: _workspacePatchAuditor
    }),
    builtInSkill({
        name: 'test-chat-runner',
        title: '测试聊天验证员',
        description: '基于项目资源运行验证对话，并记录 trace 与测试发现。',
        defaultWriteScope: 'trace only',
        resourcePath: 'src/resources/forge-skills/test-chat-runner.md',
        instructions: _testChatRunner
    }),
    builtInSkill({
        name: 'export-preparer',
        title: '导出准备员',
        description: '准备导出包 metadata 与检查项，不写真实 ST 世界书。',
        defaultWriteScope: '/workspaces/forge/<projectId>/export/',
        resourcePath: 'src/resources/forge-skills/export-preparer.md',
        instructions: _exportPreparer
    }),
    builtInSkill({
        name: 'material-analyzer',
        title: '素材分析员',
        description: '检查上传素材或项目素材文件，提取可复用设定片段。',
        defaultWriteScope: 'read-only by default',
        resourcePath: 'src/resources/forge-skills/material-analyzer.md',
        instructions: _materialAnalyzer
    })
] as const;

export class ForgeSkillRegistry {
    constructor(private readonly workspaces: ShellWorkspaceService = shellWorkspaceService) {}

    listBuiltInSkills(): ForgeSkillMetadata[] {
        return BUILT_IN_SKILLS.map(({ instructions: _instructions, ...metadata }) => ({ ...metadata }));
    }

    getBuiltInSkill(name: string): AgentSkillDefinition | null {
        const skill = BUILT_IN_SKILLS.find(item => item.name === normalizeSkillName(name));
        if (!skill) return null;
        return {
            name: skill.name,
            description: skill.description,
            files: [{
                path: 'SKILL.md',
                content: skill.instructions
            }]
        };
    }

    async materializeBuiltInSkills(input: {
        forgeProjectId: string;
        conversationId?: string;
        skillNames?: string[];
        overwrite?: boolean;
    }): Promise<ForgeSkillLoadResult[]> {
        const selected = new Set((input.skillNames ?? BUILT_IN_SKILLS.map(skill => skill.name)).map(assertSkillName));
        const fs = await this.workspaces.getFileSystem({
            projectId: input.forgeProjectId,
            conversationId: input.conversationId
        });
        const installed: ForgeSkillLoadResult[] = [];
        const projectRoot = stripWorkspaceRoot(forgeWorkspacePath(input.forgeProjectId));
        await fs.mkdir(`${projectRoot}/agent/skills`, { recursive: true });

        for (const metadata of BUILT_IN_SKILLS) {
            if (!selected.has(metadata.name)) continue;
            const root = `${projectRoot}/agent/skills/${metadata.name}`;
            const skillPath = `${root}/SKILL.md`;
            await fs.mkdir(root, { recursive: true });
            const exists = await fs.exists(skillPath);
            if (input.overwrite || !exists) {
                await fs.writeFile(skillPath, metadata.instructions);
            }
            const loaded = await this.loadProjectSkill(input.forgeProjectId, metadata.name, input.conversationId);
            if (loaded) installed.push(loaded);
        }

        await this.workspaces.persist();
        return installed;
    }

    async listProjectSkills(forgeProjectId: string, conversationId?: string): Promise<ForgeSkillLoadResult[]> {
        const fs = await this.workspaces.getFileSystem({ projectId: forgeProjectId, conversationId });
        const skillsRoot = `${stripWorkspaceRoot(forgeWorkspacePath(forgeProjectId))}/agent/skills`;
        const names = await fs.readdir(skillsRoot).catch(() => []);
        const loaded = await Promise.all(names.map(name => this.loadProjectSkill(forgeProjectId, name, conversationId)));
        return loaded.filter((skill: ForgeSkillLoadResult | null): skill is ForgeSkillLoadResult => Boolean(skill));
    }

    async loadProjectSkill(
        forgeProjectId: string,
        skillName: string,
        conversationId?: string
    ): Promise<ForgeSkillLoadResult | null> {
        const normalizedName = assertSkillName(skillName);
        const fs = await this.workspaces.getFileSystem({ projectId: forgeProjectId, conversationId });
        const root = `${stripWorkspaceRoot(forgeWorkspacePath(forgeProjectId))}/agent/skills/${normalizedName}`;
        const skillPath = `${root}/SKILL.md`;
        const content = await fs.readFile(skillPath).catch(() => null);
        if (typeof content !== 'string') return null;
        const builtIn = BUILT_IN_SKILLS.find(skill => skill.name === normalizedName);
        return {
            source: 'project',
            path: semanticSkillPath(normalizedName),
            skill: {
                name: normalizedName,
                description: builtIn?.description ?? this.extractDescription(content),
                files: [{
                    path: 'SKILL.md',
                    content
                }]
            }
        };
    }

    async loadSkill(input: {
        forgeProjectId: string;
        skillName: string;
        conversationId?: string;
        preferProject?: boolean;
    }): Promise<ForgeSkillLoadResult | null> {
        if (input.preferProject !== false) {
            const projectSkill = await this.loadProjectSkill(input.forgeProjectId, input.skillName, input.conversationId);
            if (projectSkill) return projectSkill;
        }
        const builtIn = this.getBuiltInSkill(input.skillName);
        if (!builtIn) return null;
        return {
            source: 'built-in',
            path: semanticSkillPath(builtIn.name),
            skill: builtIn
        };
    }

    private extractDescription(content: string): string {
        const title = content.split(/\r?\n/).find(line => line.startsWith('# '));
        return title ? title.replace(/^#\s+/, '').trim() : 'Project Forge skill';
    }
}

export const forgeSkillRegistry = new ForgeSkillRegistry();
