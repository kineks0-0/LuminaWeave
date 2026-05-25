import type { ForgeVirtualLorebookEntry } from '../../../../types/SessionTypes.js';
import type { ForgeMemoryEntry } from '../../../../types/ForgeMemoryTypes.js';
import type { ForgeRuntimeContext } from '../../../../types/ForgeRuntimeTypes.js';
import {
    shellWorkspaceService,
    type ForgeProjectVfsEntry,
    type ShellWorkspaceService
} from '../../hal/shell/ShellWorkspaceService.js';
import {
    forgeSkillRegistry,
    type ForgeSkillLoadResult,
    type ForgeSkillMetadata,
    type ForgeSkillRegistry
} from '../skills/ForgeSkillRegistry.js';
import {
    buildForgeStableThreadLabel
} from '../agent-app/vfs/ForgeSemanticVfsMapper.js';
import {
    buildForgeAgentsFile,
    buildForgeReasoningPrompt,
    buildForgeSystemPrompt,
    buildForgeUiDslPrompt,
    FORGE_AGENT_REASONING_PROMPT_PATH,
    FORGE_AGENT_UI_DSL_PROMPT_PATH,
    FORGE_AGENT_PROMPTS_ROOT,
    resolveForgeModePrompt
} from '../agent-app/vfs/ForgePiVirtualProjectFiles.js';
import { promptPresetRegistry } from '../../hal/prompt/PromptPresetRegistry.js';
import type {
    ForgeAgentPromptMode,
    ForgeAgentSkillLoadPolicy,
    ForgeAgentSkillResource,
    ForgeAgentPromptResourceSet,
    PromptPresetProfileId
} from '../../../../types/PromptPresetTypes.js';

export type ForgeProjectSemanticVfsEntryKind = 'directory' | 'file';
export type ForgeProjectSemanticVfsEntrySource = 'virtual' | 'context' | 'session' | 'workspace' | 'resource';
export type ForgeProjectSemanticVfsWritePolicy = 'read-only' | 'protected' | 'direct-write' | 'pass-through';

export interface ForgeProjectSemanticVfsEntry {
    path: string;
    kind: ForgeProjectSemanticVfsEntryKind;
    content: string | null;
    source: ForgeProjectSemanticVfsEntrySource;
    writePolicy: ForgeProjectSemanticVfsWritePolicy;
}

export interface ForgeProjectSemanticVfsServiceDeps {
    workspaces?: ShellWorkspaceService;
    skills?: Pick<ForgeSkillRegistry, 'listProjectSkills' | 'listBuiltInSkills' | 'loadSkill'>;
}

type EntryMap = Map<string, ForgeProjectSemanticVfsEntry>;

const PROMPT_FILE_NAMES = ['PLANNER.md', 'CONVERSATION.md', 'ANALYST.md', 'EXECUTOR.md'] as const;

const INTERNAL_STORAGE_ROOTS = [
    './chat/',
    './drafts/',
    './memory/',
    './review/',
    './.pi/agent/prompts/'
];

const INTERNAL_STORAGE_FILES = new Set([
    './project.json'
]);

const INTERNAL_STORAGE_PATTERNS = [
    /^\.\/lorebook\/entries\/[^/]+\.json$/,
    /^\.\/review\/[^/]+\.json$/
];

const normalizeSemanticPath = (path: string): string => {
    const normalized = path.trim().replace(/\\/g, '/').replace(/\/+/g, '/');
    if (!normalized || normalized === '.') return './';
    if (normalized.startsWith('./')) return normalized;
    if (normalized.startsWith('/')) return normalized;
    return `./${normalized}`;
};

const normalizeDirectoryPath = (path: string): string => {
    const normalized = normalizeSemanticPath(path);
    return normalized.endsWith('/') ? normalized : `${normalized}/`;
};

const addDirectory = (
    entries: EntryMap,
    path: string,
    source: ForgeProjectSemanticVfsEntrySource = 'virtual',
    writePolicy: ForgeProjectSemanticVfsWritePolicy = 'direct-write'
): void => {
    const normalized = normalizeDirectoryPath(path);
    if (entries.has(normalized)) return;
    entries.set(normalized, {
        path: normalized,
        kind: 'directory',
        content: null,
        source,
        writePolicy
    });
};

const addFile = (
    entries: EntryMap,
    path: string,
    content: string,
    source: ForgeProjectSemanticVfsEntrySource = 'workspace',
    writePolicy: ForgeProjectSemanticVfsWritePolicy = 'direct-write'
): void => {
    const normalized = normalizeSemanticPath(path).replace(/\/$/, '');
    if (entries.has(normalized)) return;
    entries.set(normalized, {
        path: normalized,
        kind: 'file',
        content,
        source,
        writePolicy
    });
};

const isInternalRawStoragePath = (path: string): boolean =>
    INTERNAL_STORAGE_FILES.has(path)
    || INTERNAL_STORAGE_ROOTS.some(prefix => path === prefix || path.startsWith(prefix))
    || INTERNAL_STORAGE_PATTERNS.some(pattern => pattern.test(path));

const readSkillFile = (skill: ForgeSkillLoadResult): string =>
    skill.skill.files.find(file => file.path === 'SKILL.md')?.content ?? '';

const skillMetadataPath = (skill: Pick<ForgeSkillMetadata, 'name'>): string =>
    `./agent/skills/${skill.name}/SKILL.md`;

const safePathSegment = (value: string): string => {
    const normalized = value
        .trim()
        .replace(/[\\/:*?"<>|]/g, '-')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    return normalized || 'untitled';
};

const memoryPathToSemanticPath = (path: string): string => {
    const normalized = path
        .trim()
        .replace(/\\/g, '/')
        .replace(/^\.?\/*/, '')
        .replace(/^memory\//, '')
        .replace(/\.md$/i, '');
    const segments = normalized
        .split('/')
        .map(safePathSegment)
        .filter(Boolean);
    return `./memory/${(segments.length > 0 ? segments : ['untitled']).join('/')}.md`;
};

const markdownEscapeHeading = (value: string): string =>
    value.replace(/\r?\n/g, ' ').trim();

const stringifyJson = (value: unknown): string =>
    JSON.stringify(value, null, 2);

const toRecord = (value: unknown): Record<string, unknown> | null =>
    typeof value === 'object' && value !== null ? value as Record<string, unknown> : null;

const messageToMarkdown = (message: unknown, index: number): string => {
    const record = toRecord(message);
    const role = typeof record?.role === 'string'
        ? record.role
        : typeof record?.name === 'string'
            ? record.name
            : `message-${index + 1}`;
    const content = typeof record?.content === 'string'
        ? record.content
        : typeof record?.mes === 'string'
            ? record.mes
            : stringifyJson(message);
    return [`## ${markdownEscapeHeading(role)}`, '', content].join('\n');
};

const memoryEntryToMarkdown = (entry: ForgeMemoryEntry): string => [
    `# ${entry.title || entry.path}`,
    '',
    entry.content,
    '',
    `> 来源：${entry.source}；摘要：${entry.summary || '无'}`
].join('\n');

const lorebookEntryToMarkdown = (entry: ForgeVirtualLorebookEntry): string => {
    const record = toRecord(entry.entry);
    const title = typeof record?.comment === 'string' && record.comment.trim()
        ? record.comment.trim()
        : entry.id;
    const content = typeof record?.content === 'string'
        ? record.content
        : stringifyJson(entry.entry);
    return [`# ${title}`, '', content].join('\n');
};

const threadMetadataToMarkdown = (input: {
    title: string;
    alias: string;
    activeLayer?: string | null;
    collectionMode?: string | null;
    publishState?: string | null;
    messageCount: number;
}): string => [
    `# ${markdownEscapeHeading(input.title)}`,
    '',
    `- 路径：${input.alias}`,
    `- 当前层：${input.activeLayer ?? '未知'}`,
    `- 收集模式：${input.collectionMode ?? '未知'}`,
    `- 发布状态：${input.publishState ?? '未知'}`,
    `- 消息数：${input.messageCount}`
].join('\n');

const parseMessageArray = (content: string): unknown[] => {
    const parsed = JSON.parse(content) as unknown;
    return Array.isArray(parsed) ? parsed : [];
};

const workspaceLocalPath = (workspacePath: string): string =>
    workspacePath.replace(/^\/workspaces(?=\/|$)/, '') || '/';

export const normalizeForgeAgentSkillLoadPolicy = (
    loadPolicy: ForgeAgentSkillLoadPolicy | undefined
): ForgeAgentSkillLoadPolicy =>
    loadPolicy === 'always' ? 'always' : 'on_demand';

export const resolveForgeAgentPresetResources = (
    context: Pick<ForgeRuntimeContext, 'selectedPresetId'>
): ForgeAgentPromptResourceSet | undefined => {
    const profileIds: PromptPresetProfileId[] = ['forge-main', 'forge-executor', 'forge-test-chat'];
    if (context.selectedPresetId) {
        for (const profileId of profileIds) {
            const preset = promptPresetRegistry.getPreset(profileId, context.selectedPresetId);
            if (preset?.forgeAgentResources) return preset.forgeAgentResources;
        }
    }
    return promptPresetRegistry.getActivePreset('forge-main').forgeAgentResources;
};

export const listForgePresetSkillResources = (
    context: Pick<ForgeRuntimeContext, 'selectedPresetId'>
): ForgeAgentSkillResource[] =>
    (resolveForgeAgentPresetResources(context)?.skills ?? []).map(skill => ({
        ...skill,
        loadPolicy: normalizeForgeAgentSkillLoadPolicy(skill.loadPolicy)
    }));

export class ForgeProjectSemanticVfsService {
    private readonly workspaces: ShellWorkspaceService;
    private readonly skills: Pick<ForgeSkillRegistry, 'listProjectSkills' | 'listBuiltInSkills' | 'loadSkill'>;

    constructor(deps: ForgeProjectSemanticVfsServiceDeps = {}) {
        this.workspaces = deps.workspaces ?? shellWorkspaceService;
        this.skills = deps.skills ?? forgeSkillRegistry;
    }

    async listEntries(context: ForgeRuntimeContext): Promise<ForgeProjectSemanticVfsEntry[]> {
        const entries: EntryMap = new Map();

        this.addPlannedDirectories(entries);
        await this.addFilteredWorkspaceEntries(entries, context);
        await this.addPromptEntries(entries, context);
        await this.addSkillEntries(entries, context);
        this.addMemoryEntries(entries, context);
        await this.addThreadEntries(entries, context);
        this.addLorebookEntries(entries, context);

        return [...entries.values()].sort((left, right) =>
            left.path.localeCompare(right.path, 'zh-Hans-CN')
            || left.kind.localeCompare(right.kind)
        );
    }

    private addPlannedDirectories(entries: EntryMap): void {
        [
            './.forge/',
            './.forge/agent/',
            './.pi/agent/skill-overrides/',
            './agent/skills/',
            './memory/AUTO/',
            './threads/目前/',
            './lorebook/'
        ].forEach(path => addDirectory(entries, path));
    }

    private async addFilteredWorkspaceEntries(entries: EntryMap, context: ForgeRuntimeContext): Promise<void> {
        const workspaceEntries = await this.workspaces.listForgeProjectEntries({
            forgeProjectId: context.workspaceSessionId,
            conversationId: context.sessionChatId
        }).catch(() => []);

        workspaceEntries
            .filter(entry => !isInternalRawStoragePath(entry.path))
            .filter(entry => !entry.path.startsWith('./agent/skills/'))
            .forEach(entry => {
                if (entry.kind === 'directory') {
                    addDirectory(entries, entry.path, 'workspace', 'direct-write');
                } else {
                    addFile(entries, entry.path, entry.content, 'workspace', 'direct-write');
                }
            });
    }

    private async addPromptEntries(entries: EntryMap, context: ForgeRuntimeContext): Promise<void> {
        const presetResources = this.resolvePresetResources(context);
        addFile(
            entries,
            './AGENTS.md',
            presetResources?.contract.content ?? buildForgeAgentsFile(),
            presetResources?.contract ? 'resource' : 'virtual',
            'protected'
        );
        addFile(
            entries,
            './.forge/agent/SYSTEM.md',
            presetResources?.system.content ?? buildForgeSystemPrompt(),
            presetResources?.system ? 'resource' : 'virtual',
            'protected'
        );
        addFile(entries, FORGE_AGENT_UI_DSL_PROMPT_PATH, buildForgeUiDslPrompt(), 'virtual', 'protected');
        addFile(entries, FORGE_AGENT_REASONING_PROMPT_PATH, buildForgeReasoningPrompt(), 'virtual', 'protected');
        PROMPT_FILE_NAMES.forEach((fileName) => {
            const mode = fileName.replace(/\.md$/, '').toLowerCase() as ForgeAgentPromptMode;
            const modeResource = presetResources?.modes[mode];
            addFile(
                entries,
                `${FORGE_AGENT_PROMPTS_ROOT}/${fileName}`,
                modeResource?.content ?? resolveForgeModePrompt(fileName) ?? '',
                modeResource ? 'resource' : 'virtual',
                'protected'
            );
        });
    }

    private resolvePresetResources(context: ForgeRuntimeContext): ForgeAgentPromptResourceSet | undefined {
        return resolveForgeAgentPresetResources(context);
    }

    private async addSkillEntries(entries: EntryMap, context: ForgeRuntimeContext): Promise<void> {
        const projectSkills = await this.skills.listProjectSkills(context.workspaceSessionId, context.sessionChatId)
            .catch(() => []);
        const byName = new Map<string, {
            name: string;
            path: string;
            content: string;
            source: ForgeProjectSemanticVfsEntrySource;
        }>();

        projectSkills.forEach(skill => byName.set(skill.skill.name, {
            name: skill.skill.name,
            path: skill.path || skillMetadataPath(skill.skill),
            content: readSkillFile(skill),
            source: 'workspace'
        }));

        listForgePresetSkillResources(context).forEach((skill) => {
            if (byName.has(skill.name)) return;
            byName.set(skill.name, {
                name: skill.name,
                path: skill.path,
                content: skill.content,
                source: 'resource'
            });
        });

        const builtInSkills = this.skills.listBuiltInSkills();
        await Promise.all(builtInSkills.map(async (metadata) => {
            if (byName.has(metadata.name)) return;
            const loaded = await this.skills.loadSkill({
                forgeProjectId: context.workspaceSessionId,
                conversationId: context.sessionChatId,
                skillName: metadata.name,
                preferProject: false
            }).catch(() => null);
            if (loaded) {
                byName.set(metadata.name, {
                    name: metadata.name,
                    path: loaded.path || skillMetadataPath(metadata),
                    content: readSkillFile(loaded),
                    source: 'virtual'
                });
            }
        }));

        builtInSkills.forEach(metadata => addDirectory(entries, `./agent/skills/${metadata.name}/`, 'virtual', 'protected'));
        for (const skill of byName.values()) {
            addDirectory(entries, `./agent/skills/${skill.name}/`, skill.source, 'protected');
            addFile(
                entries,
                skill.path,
                skill.content,
                skill.source,
                'protected'
            );
        }
    }

    private addMemoryEntries(entries: EntryMap, context: ForgeRuntimeContext): void {
        const memoryByPath = new Map(context.forgeMemoryTree.entries.map(entry => [entry.path, entry]));
        const checklist = memoryByPath.get('AUTO/Checklist');
        const userPreference = memoryByPath.get('用户偏好')
            ?? context.forgeMemoryTree.entries.find(entry => entry.path.includes('用户偏好'));

        addFile(
            entries,
            './memory/AUTO/Checklist.md',
            checklist ? memoryEntryToMarkdown(checklist) : '# Checklist\n\n暂无自动清单记录。',
            'workspace',
            'direct-write'
        );
        addFile(
            entries,
            './memory/用户偏好.md',
            userPreference ? memoryEntryToMarkdown(userPreference) : '# 用户偏好\n\n暂无用户偏好记录。',
            'workspace',
            'direct-write'
        );

        context.forgeMemoryTree.entries.forEach((entry) => {
            if (entry.path === 'AUTO/Checklist' || entry === userPreference) return;
            addFile(entries, memoryPathToSemanticPath(entry.path), memoryEntryToMarkdown(entry), 'workspace', 'direct-write');
        });
    }

    private async addThreadEntries(entries: EntryMap, context: ForgeRuntimeContext): Promise<void> {
        const currentMessages = context.messages.length > 0
            ? context.messages
            : await this.readStoredThreadMessages(context.workspaceSessionId, context.sessionChatId);
        addFile(
            entries,
            './threads/目前/thread.md',
            threadMetadataToMarkdown({
                title: context.workspaceTitle || '当前协作线程',
                alias: './threads/目前/',
                activeLayer: context.activeLayer,
                collectionMode: context.collectionMode,
                publishState: context.publishState,
                messageCount: currentMessages.length
            }),
            'session',
            'read-only'
        );
        addFile(
            entries,
            './threads/目前/messages.md',
            [
                '# 当前协作线程',
                '',
                '动态别名：`./threads/目前/`。切换协作线程后，此路径自动指向新的当前线程。',
                '',
                ...currentMessages.map(messageToMarkdown)
            ].join('\n'),
            'session',
            'read-only'
        );

        const bindings = await this.workspaces.listForgeBindings()
            .then(items => items.filter(item => item.forgeProjectId === context.workspaceSessionId))
            .catch(() => []);
        const fs = await this.workspaces.getFileSystem({
            projectId: context.workspaceSessionId,
            conversationId: context.sessionChatId
        });

        await Promise.all(bindings
            .sort((left, right) => left.createdAt - right.createdAt || left.conversationId.localeCompare(right.conversationId))
            .map(async (binding, index) => {
                const threadRoot = workspaceLocalPath(`/workspaces/forge/${encodeURIComponent(context.workspaceSessionId)}/chat/${encodeURIComponent(binding.conversationId)}`);
                const threadJson = await fs.readFile(`${threadRoot}/thread.json`)
                    .then(content => JSON.parse(content) as { title?: unknown })
                    .catch(() => ({ title: '协作线程' }));
                const title = typeof threadJson.title === 'string' ? threadJson.title : '协作线程';
                const label = buildForgeStableThreadLabel(index, title);
                const messages = await fs.readFile(`${threadRoot}/messages.json`)
                    .then(parseMessageArray)
                    .catch(() => []);
                addFile(
                    entries,
                    `./threads/${label}/thread.md`,
                    threadMetadataToMarkdown({
                        title,
                        alias: `./threads/${label}/`,
                        messageCount: messages.length
                    }),
                    'session',
                    'read-only'
                );
                addFile(
                    entries,
                    `./threads/${label}/messages.md`,
                    [`# ${title}`, '', ...messages.map(messageToMarkdown)].join('\n'),
                    'session',
                    'read-only'
                );
            }));
    }

    private async readStoredThreadMessages(projectId: string, conversationId: string): Promise<unknown[]> {
        const fs = await this.workspaces.getFileSystem({
            projectId,
            conversationId
        });
        const threadRoot = workspaceLocalPath(`/workspaces/forge/${encodeURIComponent(projectId)}/chat/${encodeURIComponent(conversationId)}`);
        return fs.readFile(`${threadRoot}/messages.json`)
            .then(parseMessageArray)
            .catch(() => []);
    }

    private addLorebookEntries(entries: EntryMap, context: ForgeRuntimeContext): void {
        context.virtualLorebookEntries.forEach((entry) => {
            addFile(
                entries,
                `./lorebook/entries/${safePathSegment(entry.id)}.md`,
                lorebookEntryToMarkdown(entry),
                'workspace',
                'direct-write'
            );
        });
    }
}

export const forgeProjectSemanticVfsService = new ForgeProjectSemanticVfsService();
