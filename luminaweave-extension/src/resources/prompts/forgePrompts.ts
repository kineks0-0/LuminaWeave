/**
 * Forge 提示词访问层
 *
 * - 静态系统提示：直接 re-export（无变量，调用方拿到 string 即用）
 * - 带变量的快照/指令模板：export render 函数，接受类型化 vars，内部完成渲染
 *
 * 所有 prompt 正文维护在同目录的 .md 文件中，无需转义，可直接预览。
 */

import { PromptTemplateEngine } from '../../api/core/hal/prompt/PromptTemplateEngine.js';
import type {
    ForgeMemorySnapshotTemplateInput,
    ForgeFileMemoryTemplateInput,
    ForgeStageSnapshotTemplateInput,
    ForgeStructuredStateTemplateInput,
    ForgeDraftTreeTemplateInput,
    ForgeWorkflowSnapshotTemplateInput,
} from '../../types/ForgePromptTypes.js';

// ── 原始模板（模块级常量，Vite 编译期内联）────────────────────────────────

import _agentContract from '../forge-agent/base/AGENTS.md?raw';
import _agentSystem from '../forge-agent/base/agent/SYSTEM.md?raw';
import _planner from '../forge-agent/presets/forge-main-default/agent/PLANNER.md?raw';
import _conversation from '../forge-agent/presets/forge-main-default/agent/CONVERSATION.md?raw';
import _analyst from '../forge-agent/presets/forge-main-default/agent/ANALYST.md?raw';
import _executorSystem from '../forge-agent/presets/forge-main-default/agent/EXECUTOR.md?raw';
import _uiDsl from '../forge-agent/base/agent/UI_DSL.md?raw';
import _reasoning from '../forge-agent/base/agent/REASONING.md?raw';
import _memorySnapshot from './forge-memory-snapshot.md?raw';
import _fileMemory from './forge-file-memory.md?raw';
import _stageSnapshot from './forge-stage-snapshot.md?raw';
import _structuredState from './forge-structured-state.md?raw';
import _draftTree from './forge-draft-tree.md?raw';
import _workflowSnapshot from './forge-workflow-snapshot.md?raw';

import _refNeeds from '../forge-agent/presets/forge-main-default/skills/reference-needs-capture/SKILL.md?raw';
import _refAntiCliche from '../forge-agent/presets/forge-main-default/skills/reference-anti-cliche/SKILL.md?raw';
import _refXP from '../forge-agent/presets/forge-main-default/skills/reference-xp-capture/SKILL.md?raw';
import _creationStyleGuide from '../forge-agent/presets/forge-main-default/skills/creation-style-guide/SKILL.md?raw';
import _outputVoiceGuard from '../forge-agent/presets/forge-main-default/skills/output-voice-guard/SKILL.md?raw';
import _nsfwWritingIntensify from '../forge-agent/presets/forge-main-default/skills/nsfw-writing-intensify/SKILL.md?raw';

// ── 静态系统提示（无变量，直接使用）─────────────────────────────────────

export const FORGE_AGENT_CONTRACT = _agentContract;
export const FORGE_AGENT_SYSTEM_PROMPT = _agentSystem;

export const FORGE_PLANNER_PROMPT = _planner;
export const FORGE_CONVERSATION_PROMPT = _conversation;
export const FORGE_ANALYST_PROMPT = _analyst;
export const FORGE_EXECUTOR_SYSTEM_PROMPT = _executorSystem;
export const FORGE_REASONING_PROMPT = _reasoning;

export const FORGE_MAIN_REFERENCE_NEEDS_CAPTURE = _refNeeds;
export const FORGE_MAIN_REFERENCE_ANTI_CLICHE = _refAntiCliche;
export const FORGE_MAIN_REFERENCE_XP = _refXP;
export const FORGE_MAIN_CREATION_STYLE_GUIDE = _creationStyleGuide;
export const FORGE_MAIN_OUTPUT_VOICE_GUARD = _outputVoiceGuard;
export const FORGE_MAIN_NSFW_WRITING_INTENSIFY = _nsfwWritingIntensify;

export function renderForgeUiDslPrompt(vars: {
    syntaxLabel: string;
    syntaxGuidance: string;
    exampleBlock: string;
    componentDocumentation: string;
}): string {
    return PromptTemplateEngine.render(_uiDsl, vars);
}

// ── 带变量的模板：类型化 render 函数 ──────────────────────────────────────

export function renderForgeMemorySnapshot(vars: ForgeMemorySnapshotTemplateInput): string {
    return PromptTemplateEngine.render(_memorySnapshot, vars);
}

export function renderForgeFileMemory(vars: ForgeFileMemoryTemplateInput): string {
    return PromptTemplateEngine.render(_fileMemory, vars);
}

export function renderForgeStageSnapshot(vars: ForgeStageSnapshotTemplateInput): string {
    return PromptTemplateEngine.render(_stageSnapshot, vars);
}

export function renderForgeStructuredState(vars: ForgeStructuredStateTemplateInput): string {
    return PromptTemplateEngine.render(_structuredState, vars);
}

export function renderForgeDraftTree(vars: ForgeDraftTreeTemplateInput): string {
    return PromptTemplateEngine.render(_draftTree, vars);
}

export function renderForgeWorkflowSnapshot(vars: ForgeWorkflowSnapshotTemplateInput): string {
    return PromptTemplateEngine.render(_workflowSnapshot, vars);
}
