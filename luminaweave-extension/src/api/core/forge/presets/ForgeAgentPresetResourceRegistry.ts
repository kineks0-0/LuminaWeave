import { AgentSkillParser } from '../../agent-runtime/skills/AgentSkillParser.js';
import type { PiExtensionFactory } from '../../agent-runtime/extensions/pi/PiExtensionCompatHost.js';
import type {
    ForgeAgentExtensionResource,
    ForgeAgentPromptResource,
    ForgeAgentResourceSource,
    ForgeAgentSkillLoadPolicy,
    ForgeAgentSkillResource
} from '../../../../types/PromptPresetTypes.js';

export interface ForgeAgentPresetExtensionResource extends ForgeAgentExtensionResource {
    factory: PiExtensionFactory;
}

export interface ForgeAgentPresetLayerSkillResource extends ForgeAgentSkillResource {
    source: ForgeAgentResourceSource;
}

export interface ForgeAgentMergedPresetResources {
    system?: ForgeAgentPromptResource;
    executor?: ForgeAgentPromptResource;
    skills: ForgeAgentPresetLayerSkillResource[];
    extensions: ForgeAgentPresetExtensionResource[];
}

export interface ForgeAgentPresetResourceSources {
    presetPrompts?: Record<string, string>;
    baseSkills?: Record<string, string>;
    presetSkills?: Record<string, string>;
    baseExtensions?: Record<string, PiExtensionFactory>;
    presetExtensions?: Record<string, PiExtensionFactory>;
}

export interface ForgeAgentPresetResourceRegistry {
    resolve: (selectedPresetId?: string | null) => ForgeAgentMergedPresetResources;
}

const DEFAULT_AGENT_PRESET_FOLDER = 'forge-agent-default';

const normalizePath = (path: string): string => path.replace(/\\/g, '/');

export const resolveForgeAgentPresetFolderId = (selectedPresetId?: string | null): string => {
    if (!selectedPresetId || selectedPresetId === 'forge-agent') return DEFAULT_AGENT_PRESET_FOLDER;
    if (selectedPresetId === 'forge-main' || selectedPresetId === 'forge-executor') return DEFAULT_AGENT_PRESET_FOLDER;
    if (selectedPresetId === 'built-in:forge-main-default' || selectedPresetId === 'built-in:forge-executor-default') {
        return DEFAULT_AGENT_PRESET_FOLDER;
    }
    if (selectedPresetId.startsWith('built-in:')) return selectedPresetId.slice('built-in:'.length);
    return selectedPresetId;
};

const extractSegmentAfter = (path: string, marker: string): string | null => {
    const normalized = normalizePath(path);
    const index = normalized.indexOf(marker);
    if (index < 0) return null;
    const rest = normalized.slice(index + marker.length).split('/').filter(Boolean);
    return rest[0] ?? null;
};

const extractPresetFolder = (path: string): string | null =>
    extractSegmentAfter(path, '/presets/');

const extractSkillName = (path: string): string | null => {
    const normalized = normalizePath(path);
    const match = /\/skills\/([^/]+)\/SKILL\.md$/.exec(normalized);
    return match?.[1] ?? null;
};

const extractPromptFileName = (path: string): 'SYSTEM.md' | 'EXECUTOR.md' | null => {
    const normalized = normalizePath(path);
    if (normalized.endsWith('/agent/SYSTEM.md')) return 'SYSTEM.md';
    if (normalized.endsWith('/agent/EXECUTOR.md')) return 'EXECUTOR.md';
    return null;
};

const extractExtensionId = (path: string): string | null => {
    const normalized = normalizePath(path);
    const directoryMatch = /\/extensions\/([^/]+)\//.exec(normalized);
    if (directoryMatch?.[1]) return directoryMatch[1];
    const fileMatch = /\/extensions\/([^/.]+)\.(?:ts|js)$/.exec(normalized);
    return fileMatch?.[1] ?? null;
};

const resolveSkillTitle = (skill: NonNullable<ReturnType<AgentSkillParser['parse']>['skill']>): string =>
    skill.metadata?.title ?? skill.description ?? skill.name;

const resolveLoadPolicy = (skill: NonNullable<ReturnType<AgentSkillParser['parse']>['skill']>): ForgeAgentSkillLoadPolicy =>
    skill.metadata?.loadPolicy === 'always' ? 'always' : 'on_demand';

const resolveDefaultWriteScope = (skill: NonNullable<ReturnType<AgentSkillParser['parse']>['skill']>): string =>
    skill.metadata?.defaultWriteScope ?? 'read-only by default';

const toSemanticSkillPath = (skillName: string): string =>
    `./agent/skills/${skillName}/SKILL.md`;

const loadSkillResources = (
    sourceMap: Record<string, string>,
    source: ForgeAgentResourceSource,
    presetFolderId?: string
): ForgeAgentPresetLayerSkillResource[] => {
    const parser = new AgentSkillParser();
    const resources: ForgeAgentPresetLayerSkillResource[] = [];
    for (const [path, content] of Object.entries(sourceMap)) {
        if (source === 'preset' && extractPresetFolder(path) !== presetFolderId) continue;
        const skillName = extractSkillName(path);
        if (!skillName) continue;
        const semanticPath = toSemanticSkillPath(skillName);
        const parsed = parser.parse({ path: semanticPath, content });
        if (!parsed.skill) continue;
        resources.push({
            name: parsed.skill.name,
            path: semanticPath,
            content,
            title: resolveSkillTitle(parsed.skill),
            description: parsed.skill.description,
            loadPolicy: resolveLoadPolicy(parsed.skill),
            defaultWriteScope: resolveDefaultWriteScope(parsed.skill),
            source
        });
    }
    return resources;
};

const loadExtensionResources = (
    sourceMap: Record<string, PiExtensionFactory>,
    source: ForgeAgentResourceSource,
    presetFolderId?: string
): ForgeAgentPresetExtensionResource[] => {
    const resources: ForgeAgentPresetExtensionResource[] = [];
    for (const [path, factory] of Object.entries(sourceMap)) {
        if (source === 'preset' && extractPresetFolder(path) !== presetFolderId) continue;
        const id = extractExtensionId(path);
        if (!id) continue;
        resources.push({
            id,
            path: `./agent/extensions/${id}/index.ts`,
            source,
            factory
        });
    }
    return resources;
};

const loadPromptResources = (
    sourceMap: Record<string, string>,
    presetFolderId: string
): Pick<ForgeAgentMergedPresetResources, 'system' | 'executor'> => {
    const result: Pick<ForgeAgentMergedPresetResources, 'system' | 'executor'> = {};
    for (const [path, content] of Object.entries(sourceMap)) {
        if (extractPresetFolder(path) !== presetFolderId) continue;
        const fileName = extractPromptFileName(path);
        if (fileName === 'SYSTEM.md') {
            result.system = {
                path: './.forge/agent/SYSTEM.md',
                kind: 'system',
                title: '主模型提示词',
                content
            };
        }
        if (fileName === 'EXECUTOR.md') {
            result.executor = {
                path: './.forge/agent/EXECUTOR.md',
                kind: 'executor_prompt',
                title: '执行模型提示词',
                content
            };
        }
    }
    return result;
};

const mergeByName = <T extends { name: string; source: ForgeAgentResourceSource }>(items: T[]): T[] => {
    const byName = new Map<string, T>();
    for (const item of items) {
        byName.set(item.name, item);
    }
    return [...byName.values()].sort((left, right) => left.name.localeCompare(right.name));
};

const mergeById = <T extends { id: string; source: ForgeAgentResourceSource }>(items: T[]): T[] => {
    const byId = new Map<string, T>();
    for (const item of items) {
        byId.set(item.id, item);
    }
    return [...byId.values()].sort((left, right) => left.id.localeCompare(right.id));
};

export const createForgeAgentPresetResourceRegistry = (
    sources: ForgeAgentPresetResourceSources = {}
): ForgeAgentPresetResourceRegistry => ({
    resolve: selectedPresetId => {
        const presetFolderId = resolveForgeAgentPresetFolderId(selectedPresetId);
        const prompts = loadPromptResources(sources.presetPrompts ?? {}, presetFolderId);
        const baseSkills = loadSkillResources(sources.baseSkills ?? {}, 'base');
        const presetSkills = loadSkillResources(sources.presetSkills ?? {}, 'preset', presetFolderId);
        const baseExtensions = loadExtensionResources(sources.baseExtensions ?? {}, 'base');
        const presetExtensions = loadExtensionResources(sources.presetExtensions ?? {}, 'preset', presetFolderId);
        return {
            ...prompts,
            skills: mergeByName([...baseSkills, ...presetSkills]),
            extensions: mergeById([...baseExtensions, ...presetExtensions])
        };
    }
});

const defaultBaseSkills = import.meta.glob('../../../../resources/forge-agent/base/skills/*/SKILL.md', {
    eager: true,
    import: 'default',
    query: '?raw'
}) as Record<string, string>;

const defaultPresetPrompts = import.meta.glob('../../../../resources/forge-agent/presets/*/agent/{SYSTEM,EXECUTOR}.md', {
    eager: true,
    import: 'default',
    query: '?raw'
}) as Record<string, string>;

const defaultPresetSkills = import.meta.glob('../../../../resources/forge-agent/presets/*/skills/*/SKILL.md', {
    eager: true,
    import: 'default',
    query: '?raw'
}) as Record<string, string>;

const defaultBaseExtensions = import.meta.glob('../../../../resources/forge-agent/base/extensions/**/*.{ts,js}', {
    eager: true,
    import: 'default'
}) as Record<string, PiExtensionFactory>;

const defaultPresetExtensions = import.meta.glob('../../../../resources/forge-agent/presets/*/extensions/**/*.{ts,js}', {
    eager: true,
    import: 'default'
}) as Record<string, PiExtensionFactory>;

export const forgeAgentPresetResourceRegistry = createForgeAgentPresetResourceRegistry({
    presetPrompts: defaultPresetPrompts,
    baseSkills: defaultBaseSkills,
    presetSkills: defaultPresetSkills,
    baseExtensions: defaultBaseExtensions,
    presetExtensions: defaultPresetExtensions
});
