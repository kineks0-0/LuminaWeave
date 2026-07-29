import type { AgentSkillDefinition } from '../../hal/shell/AgentBashToolService.js';
import { AgentSkillParser } from '../../agent-runtime/skills/AgentSkillParser.js';
import {
    forgeWorkspacePath,
    type ShellWorkspaceService,
    shellWorkspaceService
} from '../../hal/shell/ShellWorkspaceService.js';
import { forgeAgentPresetResourceRegistry } from '../presets/ForgeAgentPresetResourceRegistry.js';
import type { ForgeAgentPresetLayerSkillResource } from '../presets/ForgeAgentPresetResourceRegistry.js';

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

const baseSkillResources = (): ForgeAgentPresetLayerSkillResource[] =>
    forgeAgentPresetResourceRegistry.resolve('__base_only__').skills
        .filter(skill => skill.source === 'base');

const toMetadata = (skill: ForgeAgentPresetLayerSkillResource): ForgeSkillMetadata => ({
    name: skill.name,
    title: skill.title ?? skill.name,
    description: skill.description ?? skill.title ?? skill.name,
    defaultWriteScope: skill.defaultWriteScope ?? 'read-only by default',
    resourcePath: skill.path,
    builtIn: true
});

export class ForgeSkillRegistry {
    private readonly skillParser = new AgentSkillParser();

    constructor(private readonly workspaces: ShellWorkspaceService = shellWorkspaceService) {}

    listBuiltInSkills(): ForgeSkillMetadata[] {
        return baseSkillResources().map(toMetadata);
    }

    getBuiltInSkill(name: string): AgentSkillDefinition | null {
        const skill = baseSkillResources().find(item => item.name === normalizeSkillName(name));
        if (!skill) return null;
        return {
            name: skill.name,
            description: skill.description ?? skill.title ?? skill.name,
            files: [{
                path: 'SKILL.md',
                content: skill.content
            }]
        };
    }

    async materializeBuiltInSkills(input: {
        forgeProjectId: string;
        conversationId?: string;
        skillNames?: string[];
        overwrite?: boolean;
    }): Promise<ForgeSkillLoadResult[]> {
        const builtInSkills = baseSkillResources();
        const selected = new Set((input.skillNames ?? builtInSkills.map(skill => skill.name)).map(assertSkillName));
        const fs = await this.workspaces.getFileSystem({
            projectId: input.forgeProjectId,
            conversationId: input.conversationId
        });
        const installed: ForgeSkillLoadResult[] = [];
        const projectRoot = stripWorkspaceRoot(forgeWorkspacePath(input.forgeProjectId));
        await fs.mkdir(`${projectRoot}/agent/skills`, { recursive: true });

        for (const metadata of builtInSkills) {
            if (!selected.has(metadata.name)) continue;
            const root = `${projectRoot}/agent/skills/${metadata.name}`;
            const skillPath = `${root}/SKILL.md`;
            await fs.mkdir(root, { recursive: true });
            const exists = await fs.exists(skillPath);
            if (input.overwrite || !exists) {
                await fs.writeFile(skillPath, metadata.content);
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
        const builtIn = baseSkillResources().find(skill => skill.name === normalizedName);
        const parsed = this.skillParser.parse({
            path: semanticSkillPath(normalizedName),
            content
        });
        return {
            source: 'project',
            path: semanticSkillPath(normalizedName),
            skill: {
                name: normalizedName,
                description: builtIn?.description ?? parsed.skill?.description ?? this.extractDescription(content),
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
