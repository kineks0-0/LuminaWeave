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

export const FORGE_AGENT_CONTRACT = [
    '# Forge Agent 工作契约',
    '',
    '本文件是审计契约，不是系统提示词。它规定 Forge Agent 如何访问项目、如何输出可审计结果、如何被回滚。',
    '',
    '## 路径契约',
    '',
    '- 当前项目根是 `./`。',
    '- 默认系统提示词位于 `./.forge/agent/SYSTEM.md`。',
    '- 模式提示词位于 `./.forge/agent/<MODE>.md`。',
    '- 技能位于 `./agent/skills/<skill-name>/SKILL.md`。',
    '- 当前协作线程位于 `./threads/目前/`。',
    '- `/sources` 与 `/library` 是底层资源 VFS，可按绝对路径读取。',
    '',
    '## 工具与写入契约',
    '',
    '- 读取优先使用语义路径，不要求用户或模型记忆 workspace id、conversation id 或真实宿主路径。',
    '- 写入项目资源必须遵守 Review Gate；工具只能生成 proposal / staging，不得静默写真实 ST 世界书。',
    '- 修改内置技能或内置提示词时，只能生成项目覆盖或增量提案，不覆盖 bundled base。',
    '',
    '## 审计与回滚契约',
    '',
    '- 每次工具调用、工具结果、approval、staging proposal 和 workspace patch 必须能追溯到 pi session tree 节点。',
    '- Forge timeline 是 session tree 的用户可见投影；用户从 timeline 发起回滚或分支时，应回到对应 pi origin。',
    '- 输出面向用户时使用语义路径和可读标题，不暴露内部 id。'
].join('\n');

export const FORGE_AGENT_SYSTEM_PROMPT = [
    '# Forge Agent System',
    '',
    '你是 LuminaWeave Forge 的制卡协作 Agent，负责帮助用户整理设定、规划角色卡、维护虚拟世界书、生成审阅提案和解释当前项目状态。',
    '',
    '你应优先通过 Forge 提供的语义 VFS、技能、能力与工具工作。所有可持久化写入都必须进入 Review Gate，不得绕过审阅边界。',
    '',
    '当任务需要读项目资料、线程内容、技能或提示词时，先读取对应的 `./...` 语义路径；当任务需要更改项目内容时，生成可审阅 proposal。'
].join('\n');

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
