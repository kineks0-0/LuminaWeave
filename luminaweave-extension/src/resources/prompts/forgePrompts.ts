/**
 * Forge 提示词访问层
 *
 * - 静态系统提示：直接 re-export（无变量，调用方拿到 string 即用）
 * - 带变量的快照/指令模板：export render 函数，接受类型化 vars，内部完成渲染
 *
 * 所有 prompt 正文维护在同目录的 .md 文件中，无需转义，可直接预览。
 */

import { PromptTemplateEngine } from '../../api/core/PromptTemplateEngine.js';
import type {
    ForgeExecutorRewriteTemplateInput,
    ForgeMemorySnapshotTemplateInput,
    ForgeFileMemoryTemplateInput,
    ForgeStageSnapshotTemplateInput,
    ForgeStructuredStateTemplateInput,
    ForgeDraftTreeTemplateInput,
    ForgeWorkflowSnapshotTemplateInput,
} from '../../types/ForgePromptTypes.js';

// ── 原始模板（模块级常量，Vite 编译期内联）────────────────────────────────

import _planner from './forge-planner.md?raw';
import _conversation from './forge-conversation.md?raw';
import _analyst from './forge-analyst.md?raw';
import _executorSystem from './forge-executor-system.md?raw';
import _executorUser from './forge-executor-user.md?raw';
import _memorySnapshot from './forge-memory-snapshot.md?raw';
import _fileMemory from './forge-file-memory.md?raw';
import _stageSnapshot from './forge-stage-snapshot.md?raw';
import _structuredState from './forge-structured-state.md?raw';
import _draftTree from './forge-draft-tree.md?raw';
import _workflowSnapshot from './forge-workflow-snapshot.md?raw';

import _refNeeds from './forge-reference-needs.md?raw';
import _refAntiCliche from './forge-reference-anti-cliche.md?raw';
import _refXP from './forge-reference-xp.md?raw';
import _exeIntent from './forge-executor-intent.md?raw';
import _exeStyle from './forge-executor-style.md?raw';
import _exeXP from './forge-executor-xp.md?raw';
import _testBehavior from './forge-test-behavior.md?raw';
import _testDialogue from './forge-test-dialogue.md?raw';
import _testXP from './forge-test-xp.md?raw';

// ── 静态系统提示（无变量，直接使用）─────────────────────────────────────

export const FORGE_PLANNER_PROMPT = _planner;
export const FORGE_CONVERSATION_PROMPT = _conversation;
export const FORGE_ANALYST_PROMPT = _analyst;
export const FORGE_EXECUTOR_SYSTEM_PROMPT = _executorSystem;

export const FORGE_MAIN_REFERENCE_NEEDS_CAPTURE = _refNeeds;
export const FORGE_MAIN_REFERENCE_ANTI_CLICHE = _refAntiCliche;
export const FORGE_MAIN_REFERENCE_XP = _refXP;
export const FORGE_EXECUTOR_REFERENCE_INTENT = _exeIntent;
export const FORGE_EXECUTOR_REFERENCE_STYLE = _exeStyle;
export const FORGE_EXECUTOR_REFERENCE_XP = _exeXP;
export const FORGE_TEST_CHAT_REFERENCE_BEHAVIOR = _testBehavior;
export const FORGE_TEST_CHAT_REFERENCE_DIALOGUE = _testDialogue;
export const FORGE_TEST_CHAT_REFERENCE_XP = _testXP;

// ── 带变量的模板：类型化 render 函数 ──────────────────────────────────────

export function renderForgeExecutorUserPrompt(vars: ForgeExecutorRewriteTemplateInput): string {
    return PromptTemplateEngine.render(_executorUser, vars);
}

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
