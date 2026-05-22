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
    buildForgeSystemPrompt,
    resolveForgeModePrompt,
    resolveForgeModePromptPath
} from '../vfs/ForgePiVirtualProjectFiles.js';
import {
    listForgePresetSkillResources
} from '../../project/ForgeProjectSemanticVfsService.js';
import {
    forgeSemanticVfsProvider,
    type ForgeSemanticVfsReader
} from '../vfs/ForgeSemanticVfsProvider.js';

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
        const modePromptPath = resolveForgeModePromptPath(context);
        const modePrompt = await this.readSemanticFile(context, modePromptPath, () => this.resolveModePrompt(context));
        const projectSkills = await this.skills.listProjectSkills(context.workspaceSessionId, context.sessionChatId)
            .catch(() => []);
        const presetSkills = listForgePresetSkillResources(context);
        const builtInSkills = this.skills.listBuiltInSkills();
        const activeSkills = [
            ...projectSkills.map(item => item.skill.description || item.skill.name),
            ...presetSkills.map(item => item.title || item.description || item.name),
            ...builtInSkills.map(item => item.title || item.name)
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
                { path: './.forge/agent/SYSTEM.md', title: '默认系统提示词', content: systemPrompt },
                {
                    path: modePromptPath,
                    title: '当前模式提示词',
                    content: modePrompt
                },
                { path: './.pi/agent/context/project.md', title: '项目概况', content: this.buildProjectFile(context) },
                { path: './.pi/agent/context/workflow.md', title: '阶段状态', content: this.buildWorkflowFile(context) },
                { path: './.pi/agent/context/review-gate.md', title: 'Review Gate 状态', content: this.buildReviewGateFile(context) },
                { path: './.pi/agent/context/capability-index.md', title: '能力索引', content: this.buildCapabilityIndexFile() },
                { path: './.pi/agent/context/project-resources.md', title: '项目资源索引', content: this.buildProjectResourcesFile(context) },
                ...alwaysSkillFiles,
                { path: './threads/目前/messages.md', title: '当前协作线程', content: this.buildCurrentThreadFile(context) }
            ],
            activeSkills,
            loadedExtensions: ['@luminaweave/pi-forge-browser']
        };
    }

    buildSystemPrompt(input: {
        systemFragments: string[];
        contextBundle: ForgePiContextBundleSummary;
    }): string {
        const contextFiles = input.contextBundle.files.map(file => [
            `<pi_context_file path="${this.escapeAttribute(file.path)}" title="${this.escapeAttribute(file.title)}">`,
            file.content,
            '</pi_context_file>'
        ].join('\n')).join('\n\n');
        const skills = input.contextBundle.activeSkills.length > 0
            ? `当前可用中文技能：${input.contextBundle.activeSkills.join('、')}`
            : '';
        return [
            ...input.systemFragments,
            skills,
            contextFiles
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

    private buildWorkflowFile(context: ForgeRuntimeContext): string {
        const snapshot = context.workflowSnapshot;
        return [
            '# 阶段状态',
            '',
            `- 当前阶段：${snapshot?.stage ?? 'unknown'}`,
            `- Prompt 模式：${snapshot?.promptMode ?? 'unknown'}`,
            `- 阶段原因：${snapshot?.reason ?? '无'}`,
            `- 已完成层：${context.completedLayers.join(', ') || '无'}`,
            '',
            'Graph 只提供阶段、状态和边界指引；最终工具选择和提示词合成由 pi runtime 负责。'
        ].join('\n');
    }

    private buildReviewGateFile(context: ForgeRuntimeContext): string {
        return [
            '# Review Gate 状态',
            '',
            `- 待审阅：${context.stagingEntries.length}`,
            `- Commit-ready：${context.commitReadyEntries.length}`,
            '- 写入边界：工具只能生成 proposal 或 staging effect，不能静默写真实 ST 世界书。'
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

    private buildAgentsFile(): string {
        return buildForgeAgentsFile();
    }

    private buildSystemPromptFile(): string {
        return buildForgeSystemPrompt();
    }

    private async readSemanticFile(
        context: ForgeRuntimeContext,
        path: string,
        fallback: () => string
    ): Promise<string> {
        return this.semanticVfs.readFile(context, path).catch(() => fallback());
    }

    private resolveModePrompt(context: ForgeRuntimeContext): string {
        const mode = context.workflowSnapshot?.promptMode ?? 'conversation';
        return resolveForgeModePrompt(mode) ?? '';
    }

    private buildCurrentThreadFile(context: ForgeRuntimeContext): string {
        const lines = context.messages.slice(-30).map((message, index) => {
            const value = message as { role?: unknown; name?: unknown; content?: unknown; mes?: unknown };
            const role = typeof value.role === 'string'
                ? value.role
                : typeof value.name === 'string'
                    ? value.name
                    : `message-${index + 1}`;
            const text = typeof value.content === 'string'
                ? value.content
                : typeof value.mes === 'string'
                    ? value.mes
                    : JSON.stringify(message);
            return `## ${role}\n\n${text}`;
        });
        return [
            '# 当前协作线程',
            '',
            '动态别名：`./threads/目前/`。切换协作线程后，此路径自动指向新的当前线程。',
            '',
            ...lines
        ].join('\n');
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
