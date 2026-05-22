import type {
    ForgeAgentPromptMode,
    ForgeAgentPromptOrchestrationStep,
    ForgeAgentPromptResource,
    ForgeAgentSkillResource,
    PromptPresetDefinition
} from '../../../types/PromptPresetTypes.js';

export type ForgePromptPresetResourceRowKind = 'contract' | 'system' | 'mode_prompt' | 'skill';

export interface ForgePromptPresetResourceRow {
    id: string;
    kind: ForgePromptPresetResourceRowKind;
    label: string;
    path: string;
    title: string;
    content: string;
    skillName?: string;
    loadPolicy?: NonNullable<ForgeAgentSkillResource['loadPolicy']>;
    loadPolicyLabel?: string;
}

export interface ForgePromptPresetOrchestrationRow {
    id: string;
    kind: ForgeAgentPromptOrchestrationStep['kind'];
    label: string;
    enabled: boolean;
    path?: string;
}

export interface ForgePromptPresetSummary {
    primary: string;
    details: string[];
}

export type ForgePromptPresetResourceGroupId = 'contract' | 'system' | 'mode' | 'skills';

export interface ForgePromptPresetResourceGroup {
    id: ForgePromptPresetResourceGroupId;
    label: string;
    description: string;
    resources: ForgePromptPresetResourceRow[];
}

export interface ForgePromptPresetWorkbenchOverview {
    typeLabel: string;
    editLabel: string;
    primaryActionLabel: string;
    sourcePriority: string;
    resourceCount: number;
    orchestrationCount: number;
    skillCount: number;
}

const MODE_ORDER: ForgeAgentPromptMode[] = ['planner', 'conversation', 'analyst', 'executor'];

const MODE_LABELS: Record<ForgeAgentPromptMode, string> = {
    planner: 'Planner',
    conversation: 'Conversation',
    analyst: 'Analyst',
    executor: 'Executor'
};

const ORCHESTRATION_LABELS: Record<ForgeAgentPromptOrchestrationStep['kind'], string> = {
    contract: 'Contract',
    system: 'System',
    mode_prompt: 'Mode Prompt',
    skills: 'Skills',
    capabilities: 'Capabilities',
    context_files: 'Context Files',
    branch_messages: 'Branch Messages'
};

export const hasForgeAgentResourcePreset = (preset: PromptPresetDefinition | null | undefined): boolean =>
    Boolean(preset?.forgeAgentResources);

const buildPromptResourceRow = (
    id: string,
    kind: ForgePromptPresetResourceRowKind,
    label: string,
    resource: ForgeAgentPromptResource
): ForgePromptPresetResourceRow => ({
    id,
    kind,
    label,
    path: resource.path,
    title: resource.title || label,
    content: resource.content
});

const buildSkillResourceRow = (skill: ForgeAgentSkillResource): ForgePromptPresetResourceRow => ({
    id: `skill:${skill.name}`,
    kind: 'skill',
    label: 'Skill',
    path: skill.path,
    title: skill.title || skill.name,
    content: skill.content,
    skillName: skill.name,
    loadPolicy: skill.loadPolicy === 'always' ? 'always' : 'on_demand',
    loadPolicyLabel: skill.loadPolicy === 'always' ? '常驻' : '按需'
});

export const buildForgePromptPresetResourceRows = (preset: PromptPresetDefinition): ForgePromptPresetResourceRow[] => {
    const resources = preset.forgeAgentResources;
    if (!resources) return [];

    return [
        buildPromptResourceRow('contract', 'contract', 'Contract', resources.contract),
        buildPromptResourceRow('system', 'system', 'System', resources.system),
        ...MODE_ORDER.map(mode =>
            buildPromptResourceRow(`mode:${mode}`, 'mode_prompt', MODE_LABELS[mode], resources.modes[mode])
        ),
        ...(resources.skills || []).map(buildSkillResourceRow)
    ];
};

export const buildForgePromptPresetResourceGroups = (preset: PromptPresetDefinition): ForgePromptPresetResourceGroup[] => {
    const rows = buildForgePromptPresetResourceRows(preset);
    if (rows.length === 0) return [];

    const rowsByKind = (kind: ForgePromptPresetResourceRowKind): ForgePromptPresetResourceRow[] =>
        rows.filter(row => row.kind === kind);

    const groups: ForgePromptPresetResourceGroup[] = [
        {
            id: 'contract',
            label: 'Contract',
            description: '规定 Agent 如何工作、输出、审计和回滚，不承载模型人格。',
            resources: rowsByKind('contract')
        },
        {
            id: 'system',
            label: 'System',
            description: 'Forge Agent 的默认系统提示词，所有模式共享。',
            resources: rowsByKind('system')
        },
        {
            id: 'mode',
            label: 'Mode',
            description: 'Planner、Conversation、Analyst、Executor 的模式提示词。',
            resources: rowsByKind('mode_prompt')
        },
        {
            id: 'skills',
            label: 'Skills',
            description: '预设提供的自定义技能，统一映射到 ./agent/skills/<name>/SKILL.md。',
            resources: rowsByKind('skill')
        }
    ];

    return groups.filter(group => group.resources.length > 0 || group.id === 'skills');
};

export const buildForgePromptPresetOrchestrationRows = (preset: PromptPresetDefinition): ForgePromptPresetOrchestrationRow[] =>
    (preset.forgeAgentOrchestration?.steps || []).map((step, index) => ({
        id: `${index}:${step.kind}`,
        kind: step.kind,
        label: step.title || ORCHESTRATION_LABELS[step.kind],
        enabled: step.enabled,
        path: step.path
    }));

export const buildForgePromptPresetWorkbenchOverview = (preset: PromptPresetDefinition): ForgePromptPresetWorkbenchOverview => {
    const resourceRows = buildForgePromptPresetResourceRows(preset);
    const orchestrationRows = buildForgePromptPresetOrchestrationRows(preset);
    const isResourcePreset = hasForgeAgentResourcePreset(preset);
    return {
        typeLabel: isResourcePreset
            ? 'Agent 资源包'
            : preset.engine === 'st_preset'
                ? 'ST 预设直通'
                : '兼容条目预设',
        editLabel: preset.builtIn ? '内置只读' : '自定义可编辑',
        primaryActionLabel: preset.builtIn ? '复制为自定义预设' : '保存当前预设',
        sourcePriority: isResourcePreset ? '项目覆盖 > 当前预设 > 内置 fallback' : '',
        resourceCount: resourceRows.length,
        orchestrationCount: orchestrationRows.filter(row => row.enabled).length,
        skillCount: preset.forgeAgentResources?.skills?.length || 0
    };
};

export const summarizeForgePromptPreset = (preset: PromptPresetDefinition | null | undefined): ForgePromptPresetSummary => {
    if (!preset) {
        return {
            primary: '未绑定',
            details: []
        };
    }

    if (!preset.forgeAgentResources) {
        const enabledEntryCount = preset.entries.filter(entry => entry.enabled).length;
        return {
            primary: preset.engine === 'st_preset' ? 'ST 预设直通' : '组合预设',
            details: enabledEntryCount > 0 ? [`${enabledEntryCount} 项`] : []
        };
    }

    const orchestrationCount = preset.forgeAgentOrchestration?.steps.filter(step => step.enabled).length || 0;
    const skillCount = preset.forgeAgentResources.skills?.length || 0;
    return {
        primary: 'Agent 资源包',
        details: [
            orchestrationCount > 0 ? `${orchestrationCount} 步编排` : '未配置编排',
            skillCount > 0 ? `${skillCount} 技能` : ''
        ].filter(Boolean)
    };
};
