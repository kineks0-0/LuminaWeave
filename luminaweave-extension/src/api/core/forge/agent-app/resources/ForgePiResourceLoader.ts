import type { ForgePiContextBundleSummary } from '@shared/ForgePiTypes.js';
import type { ForgeRuntimeContext } from '../../../../../types/ForgeRuntimeTypes.js';
import {
    forgeCapabilityRegistry,
    type ForgeCapabilityRegistry
} from '../../skills/ForgeCapabilityRegistry.js';
import {
    forgeSkillRegistry,
    type ForgeSkillRegistry
} from '../../skills/ForgeSkillRegistry.js';
import {
    buildForgeAgentsFile,
    buildForgeReasoningPrompt,
    buildForgeSystemPrompt,
    buildForgeUiDslPrompt,
    FORGE_AGENT_REASONING_PROMPT_PATH,
    FORGE_AGENT_UI_DSL_PROMPT_PATH
} from '../vfs/ForgePiVirtualProjectFiles.js';
import {
    listForgePresetSkillResources
} from '../../project/ForgeProjectSemanticVfsService.js';
import {
    forgeSemanticVfsProvider,
    type ForgeSemanticVfsReader
} from '../vfs/ForgeSemanticVfsProvider.js';
import { formatAgentSkillCatalogLine } from '../../../agent-runtime/skills/AgentSkillParser.js';
import { promptPresetRegistry } from '../../../hal/prompt/PromptPresetRegistry.js';
import { forgeAgentPresetResourceRegistry } from '../../presets/ForgeAgentPresetResourceRegistry.js';

const safeMemoryPathSegment = (value: string): string => {
    const normalized = value
        .replace(/[<>:"|?*\u0000-\u001F]/g, '-')
        .replace(/\s+/g, '-')
        .replace(/^\.+$/, '')
        .trim();
    return normalized || 'untitled';
};

export interface ForgePiResourceLoaderDeps {
    capabilities?: ForgeCapabilityRegistry;
    skills?: ForgeSkillRegistry;
    semanticVfs?: ForgeSemanticVfsReader;
}

export class ForgePiResourceLoader {
    private readonly capabilities: ForgeCapabilityRegistry;
    private readonly skills: ForgeSkillRegistry;
    private readonly semanticVfs: ForgeSemanticVfsReader;

    constructor(deps: ForgePiResourceLoaderDeps = {}) {
        this.capabilities = deps.capabilities ?? forgeCapabilityRegistry;
        this.skills = deps.skills ?? forgeSkillRegistry;
        this.semanticVfs = deps.semanticVfs ?? forgeSemanticVfsProvider;
    }

    async buildContextBundle(context: ForgeRuntimeContext): Promise<ForgePiContextBundleSummary> {
        const agentsFile = await this.readSemanticFile(context, './AGENTS.md', () => this.buildAgentsFile());
        const systemPrompt = await this.readSemanticFile(context, './.forge/agent/SYSTEM.md', () => this.buildSystemPromptFile());
        const uiDslPrompt = await this.readSemanticFile(context, FORGE_AGENT_UI_DSL_PROMPT_PATH, () => buildForgeUiDslPrompt());
        const reasoningPrompt = await this.readSemanticFile(context, FORGE_AGENT_REASONING_PROMPT_PATH, () => buildForgeReasoningPrompt());
        const projectSkills = await this.skills.listProjectSkills(context.workspaceSessionId, context.sessionChatId)
            .catch(() => []);
        const presetSkills = listForgePresetSkillResources(context);
        const builtInSkills = this.skills.listBuiltInSkills();
        const activeSkills = [
            ...projectSkills.map(item => this.formatSkillRef({
                name: item.skill.name,
                title: item.skill.description || item.skill.name,
                path: item.path
            })),
            ...presetSkills.map(item => this.formatSkillRef({
                name: item.name,
                title: `[${item.source ?? 'preset'}] ${item.title || item.description || item.name}`,
                path: item.path
            })),
            ...builtInSkills.map(item => this.formatSkillRef({
                name: item.name,
                title: item.title || item.description || item.name,
                path: `./agent/skills/${item.name}/SKILL.md`
            }))
        ].filter((value, index, all) => value && all.indexOf(value) === index);
        const alwaysSkillFiles = presetSkills
            .filter(skill => skill.loadPolicy === 'always')
            .map(skill => ({
                path: skill.path,
                title: skill.title || skill.name,
                content: skill.content
            }));

        return {
            files: [
                { path: './AGENTS.md', title: 'Agent 工作契约', content: agentsFile },
                { path: './.forge/agent/SYSTEM.md', title: '主模型提示词', content: systemPrompt },
                { path: FORGE_AGENT_UI_DSL_PROMPT_PATH, title: 'Forge <V> DSL', content: uiDslPrompt },
                { path: FORGE_AGENT_REASONING_PROMPT_PATH, title: '推理与可见工作笔记边界', content: reasoningPrompt },
                { path: './.pi/agent/context/project.md', title: '项目概况', content: this.buildProjectFile(context) },
                { path: './.pi/agent/context/workflow.md', title: '阶段状态', content: this.buildWorkflowFile(context) },
                { path: './.pi/agent/context/write-boundary.md', title: '写入边界', content: this.buildWriteBoundaryFile(context) },
                { path: './.pi/agent/context/capability-index.md', title: '能力索引', content: this.buildCapabilityIndexFile() },
                { path: './.pi/agent/context/memory-index.md', title: '项目长期记忆索引', content: this.buildMemoryIndexFile(context) },
                { path: './.pi/agent/context/project-resources.md', title: '项目资源索引', content: this.buildProjectResourcesFile(context) },
                ...alwaysSkillFiles
            ],
            activeSkills,
            loadedExtensions: this.listLoadedExtensions()
        };
    }

    buildSystemPrompt(input: {
        systemFragments: string[];
        contextBundle: ForgePiContextBundleSummary;
    }): string {
        const renderContextFiles = (files: ForgePiContextBundleSummary['files']): string => files.map(file => [
            `<pi_context_file path="${this.escapeAttribute(file.path)}" title="${this.escapeAttribute(file.title)}">`,
            file.content,
            '</pi_context_file>'
        ].join('\n')).join('\n\n');
        const skills = input.contextBundle.activeSkills.length > 0
            ? `当前可用中文技能：${input.contextBundle.activeSkills.join('、')}`
            : '';
        const dynamicContextStart = input.contextBundle.files.findIndex(file => file.path === './.pi/agent/context/project.md');
        const coreFiles = dynamicContextStart >= 0
            ? input.contextBundle.files.slice(0, dynamicContextStart)
            : input.contextBundle.files;
        const contextFiles = dynamicContextStart >= 0
            ? input.contextBundle.files.slice(dynamicContextStart)
            : [];
        return [
            ...input.systemFragments,
            renderContextFiles(coreFiles),
            skills,
            renderContextFiles(contextFiles)
        ].filter(Boolean).join('\n\n');
    }

    private buildProjectFile(context: ForgeRuntimeContext): string {
        return [
            `# ${context.workspaceTitle || 'Forge Project'}`,
            '',
            '- 项目根：./',
            '- 当前协作线程：./threads/目前/',
            `- 当前层：${context.activeLayer ?? '未指定'}`,
            `- 采集模式：${context.collectionMode}`,
            `- 细节模式：${context.detailMode ?? '未指定'}`,
            `- 发布状态：${context.publishState}`
        ].join('\n');
    }

    private formatSkillRef(input: { name: string; title: string; path: string }): string {
        return formatAgentSkillCatalogLine({
            name: input.name,
            description: input.title,
            title: input.title,
            path: input.path
        });
    }

    private buildWorkflowFile(context: ForgeRuntimeContext): string {
        const snapshot = context.workflowSnapshot;
        return [
            '# 阶段状态',
            '',
            `- 当前阶段：${snapshot?.stage ?? 'unknown'}`,
            `- Intent：${snapshot?.intent ?? 'unknown'}`,
            `- 阶段原因：${snapshot?.reason ?? '无'}`,
            `- 已完成层：${context.completedLayers.join(', ') || '无'}`,
            '',
            'Graph 只提供阶段、状态和边界指引；最终工具选择和提示词合成由 pi runtime 负责。'
        ].join('\n');
    }

    private buildWriteBoundaryFile(context: ForgeRuntimeContext): string {
        return [
            '# Forge 写入边界',
            '',
            `- 待审阅：${context.stagingEntries.length}`,
            `- Commit-ready：${context.commitReadyEntries.length}`,
            '- 项目 VFS：write / edit / delete 默认直接应用，返回本轮文件变更摘要，并由 Git 记录版本历史。',
            '- 宿主边界：真实 ST 世界书发布、导出或覆盖宿主数据仍需要用户确认。'
        ].join('\n');
    }

    private buildCapabilityIndexFile(): string {
        const rows = this.capabilities.listCapabilities().map(item => [
            `## ${item.title} (${item.id})`,
            `- 摘要：${item.summary}`,
            `- 风险：${item.risk}`,
            `- 加载方式：${item.loadAs}`,
            `- Namespace：${item.namespace ?? '无'}`,
            `- Skill：${item.skillName ?? '无'}`,
            item.skillName ? `- Skill path：./agent/skills/${item.skillName}/SKILL.md` : '- Skill path：无',
            `- Shell profile：${item.shellProfile ?? '无'}`
        ].join('\n'));
        return ['# 能力索引', '', ...rows].join('\n\n');
    }

    private buildMemoryIndexFile(context: ForgeRuntimeContext): string {
        const entries = context.forgeMemoryTree.entries.slice(0, 80);
        const rows = entries.map(entry => {
            const path = this.formatMemoryPath(entry.path);
            return [
                `## ${entry.title || path}`,
                `- Path：${path}`,
                `- Source：${entry.source}`,
                `- Updated：${entry.updatedAt}`,
                `- Summary：${entry.summary || '无摘要'}`
            ].join('\n');
        });

        return [
            '# 项目长期记忆索引',
            '',
            '这些是 Forge 项目的长期记忆索引。需要正文时读取对应 ./memory/**/*.md 文件，不要假设索引包含完整内容。',
            '',
            `- 总数：${context.forgeMemoryTree.entries.length}`,
            entries.length < context.forgeMemoryTree.entries.length ? `- 已显示：${entries.length}` : '',
            '',
            ...rows
        ].filter(Boolean).join('\n\n');
    }

    private formatMemoryPath(path: string): string {
        const normalized = path
            .trim()
            .replace(/\\/g, '/')
            .replace(/^\.?\/*/, '')
            .replace(/^memory\//, '')
            .replace(/\.md$/i, '');
        const segments = normalized
            .split('/')
            .map(safeMemoryPathSegment)
            .filter(Boolean);
        return `./memory/${(segments.length > 0 ? segments : ['untitled']).join('/')}.md`;
    }

    private buildAgentsFile(): string {
        return buildForgeAgentsFile();
    }

    private buildSystemPromptFile(): string {
        return buildForgeSystemPrompt();
    }

    private listLoadedExtensions(): string[] {
        const presetId = promptPresetRegistry.getActivePresetId('forge-agent');
        return forgeAgentPresetResourceRegistry
            .resolve(presetId)
            .extensions
            .map(extension => `${extension.source}:${extension.id}`);
    }

    private async readSemanticFile(
        context: ForgeRuntimeContext,
        path: string,
        fallback: () => string
    ): Promise<string> {
        return this.semanticVfs.readFile(context, path).catch(() => fallback());
    }

    private buildProjectResourcesFile(context: ForgeRuntimeContext): string {
        return [
            '# 项目资源索引',
            '',
            `- 虚拟世界书条目：${context.virtualLorebookEntries.length}`,
            `- 项目记忆：${context.forgeMemoryTree.entries.length}`,
            `- 草稿节点：${context.draftTree.nodes.length}`,
            '',
            ...context.virtualLorebookEntries.slice(0, 20).map(item => {
                const entry = item.entry as { comment?: unknown; content?: unknown };
                return `- ${item.id}: ${String(entry.comment || entry.content || '未命名条目').slice(0, 80)}`;
            })
        ].join('\n');
    }

    private escapeAttribute(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }
}

export const forgePiResourceLoader = new ForgePiResourceLoader();
