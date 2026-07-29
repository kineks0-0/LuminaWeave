import {
    FORGE_AGENT_CONTRACT,
    FORGE_AGENT_SYSTEM_PROMPT,
    FORGE_EXECUTOR_SYSTEM_PROMPT,
    FORGE_REASONING_PROMPT,
    renderForgeUiDslPrompt
} from '../../../../../resources/prompts/forgePrompts.js';
import { lwStorage } from '../../../../storage.js';
import {
    viewComponentRegistry,
    type ViewSyntaxStyle
} from '../../../xml-view/ViewComponentRegistry.js';

export const FORGE_AGENT_DEFAULT_CONTEXT_PATH = './AGENTS.md';
export const FORGE_AGENT_SYSTEM_PROMPT_PATH = './.forge/agent/SYSTEM.md';
export const FORGE_AGENT_EXECUTOR_PROMPT_PATH = './.forge/agent/EXECUTOR.md';
export const FORGE_AGENT_UI_DSL_PROMPT_PATH = './.forge/agent/UI_DSL.md';
export const FORGE_AGENT_REASONING_PROMPT_PATH = './.forge/agent/REASONING.md';
export const FORGE_AGENT_PROMPTS_ROOT = './.forge/agent';

export const buildForgeAgentsFile = (): string => FORGE_AGENT_CONTRACT;

export const buildForgeSystemPrompt = (): string => FORGE_AGENT_SYSTEM_PROMPT;

export const buildForgeExecutorPrompt = (): string => FORGE_EXECUTOR_SYSTEM_PROMPT;

const getLuminaViewSyntaxStyle = (): ViewSyntaxStyle => {
    const value = lwStorage?.get
        ? lwStorage.get('lumina-settings.luminaViewSyntaxStyle', 'functional', 'Global')
        : 'functional';
    return value === 'pipe' ? 'pipe' : 'functional';
};

export const buildForgeUiDslPrompt = (): string => {
    const syntaxStyle = getLuminaViewSyntaxStyle();
    const syntaxGuidance = syntaxStyle === 'pipe'
        ? [
            '使用管道式 DSL：`Code|参数1|参数2`。',
            '只能输出管道式，不要输出函数式。',
            '示例：`FI|role_core_profile/name|角色姓名|例如：林雾`。'
        ].join('\n')
        : [
            '使用函数式 DSL：`ComponentName("参数1", "参数2")`。',
            '参数按位置顺序传入，不得使用 XML 标签式或 `key=value` 属性式写法。',
            '示例：`ForgeInput("role_core_profile/name", "角色姓名", "例如：林雾")`。'
        ].join('\n');
    const exampleBlock = syntaxStyle === 'pipe'
        ? [
            'FSC|启动摘要|先确认方向和偏好，再进入最小角色骨架。|细致共创',
            'FCG|kickoff_intent/direction|这次更想从哪种旅行感切入？|角色先行::邂逅人物|风景先行::沿途风景',
            'FFC|kickoff_intent/facets|你现在更在意哪些维度？|人物关系|空间变化|情绪流动',
            'FI|role_core_profile/name|角色姓名|例如：林雾',
            'FM|role_core_profile|name,identity,background'
        ].join('\n')
        : [
            'ForgeSummaryCard("启动摘要", "先确认方向和偏好，再进入最小角色骨架。", "细致共创")',
            'ForgeChoiceGroup("kickoff_intent/direction", "这次更想从哪种旅行感切入？", "角色先行::邂逅人物", "风景先行::沿途风景")',
            'ForgeFacetChecklist("kickoff_intent/facets", "你现在更在意哪些维度？", "人物关系", "空间变化", "情绪流动")',
            'ForgeInput("role_core_profile/name", "角色姓名", "例如：林雾")',
            'ForgeMissingFields("role_core_profile", "name,identity,background")'
        ].join('\n');
    return renderForgeUiDslPrompt({
        syntaxLabel: syntaxStyle === 'pipe' ? '管道式 DSL' : '函数式 DSL',
        syntaxGuidance,
        exampleBlock,
        componentDocumentation: viewComponentRegistry.getDocumentation(syntaxStyle)
    });
};

export const buildForgeReasoningPrompt = (): string => FORGE_REASONING_PROMPT;

export const readForgeVirtualProjectFile = (path: string): string | null => {
    const normalized = path.trim().replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
    if (normalized === FORGE_AGENT_DEFAULT_CONTEXT_PATH || normalized === 'AGENTS.md') {
        return buildForgeAgentsFile();
    }
    if (normalized === FORGE_AGENT_SYSTEM_PROMPT_PATH || normalized === '.forge/agent/SYSTEM.md') {
        return buildForgeSystemPrompt();
    }
    if (normalized === FORGE_AGENT_EXECUTOR_PROMPT_PATH || normalized === '.forge/agent/EXECUTOR.md') {
        return buildForgeExecutorPrompt();
    }
    if (normalized === FORGE_AGENT_UI_DSL_PROMPT_PATH || normalized === '.forge/agent/UI_DSL.md') {
        return buildForgeUiDslPrompt();
    }
    if (normalized === FORGE_AGENT_REASONING_PROMPT_PATH || normalized === '.forge/agent/REASONING.md') {
        return buildForgeReasoningPrompt();
    }
    return null;
};
