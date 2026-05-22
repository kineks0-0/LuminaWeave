import {
    FORGE_ANALYST_PROMPT,
    FORGE_AGENT_CONTRACT,
    FORGE_AGENT_SYSTEM_PROMPT,
    FORGE_CONVERSATION_PROMPT,
    FORGE_EXECUTOR_SYSTEM_PROMPT,
    FORGE_PLANNER_PROMPT
} from '../../../../../resources/prompts/forgePrompts.js';
import type { ForgeRuntimeContext } from '../../../../../types/ForgeRuntimeTypes.js';

export const FORGE_AGENT_DEFAULT_CONTEXT_PATH = './AGENTS.md';
export const FORGE_AGENT_SYSTEM_PROMPT_PATH = './.forge/agent/SYSTEM.md';
export const FORGE_AGENT_PROMPTS_ROOT = './.forge/agent';

export const buildForgeAgentsFile = (): string => FORGE_AGENT_CONTRACT;

export const buildForgeSystemPrompt = (): string => FORGE_AGENT_SYSTEM_PROMPT;

export const resolveForgePromptFileName = (context: Pick<ForgeRuntimeContext, 'workflowSnapshot'>): string => {
    const mode = context.workflowSnapshot?.promptMode ?? 'conversation';
    if (mode === 'planner') return 'PLANNER.md';
    if (mode === 'analyst') return 'ANALYST.md';
    if (mode === 'executor') return 'EXECUTOR.md';
    return 'CONVERSATION.md';
};

export const resolveForgeModePromptPath = (context: Pick<ForgeRuntimeContext, 'workflowSnapshot'>): string =>
    `${FORGE_AGENT_PROMPTS_ROOT}/${resolveForgePromptFileName(context)}`;

export const resolveForgeModePrompt = (pathOrMode: string): string | null => {
    const normalized = pathOrMode.trim().toUpperCase();
    if (normalized === 'PLANNER' || normalized === 'PLANNER.MD' || normalized.endsWith('/PLANNER.MD')) return FORGE_PLANNER_PROMPT;
    if (normalized === 'ANALYST' || normalized === 'ANALYST.MD' || normalized.endsWith('/ANALYST.MD')) return FORGE_ANALYST_PROMPT;
    if (normalized === 'EXECUTOR' || normalized === 'EXECUTOR.MD' || normalized.endsWith('/EXECUTOR.MD')) return FORGE_EXECUTOR_SYSTEM_PROMPT;
    if (normalized === 'CONVERSATION' || normalized === 'CONVERSATION.MD' || normalized.endsWith('/CONVERSATION.MD')) return FORGE_CONVERSATION_PROMPT;
    return null;
};

export const readForgeVirtualProjectFile = (path: string): string | null => {
    const normalized = path.trim().replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
    if (normalized === FORGE_AGENT_DEFAULT_CONTEXT_PATH || normalized === 'AGENTS.md') {
        return buildForgeAgentsFile();
    }
    if (normalized === FORGE_AGENT_SYSTEM_PROMPT_PATH || normalized === '.forge/agent/SYSTEM.md') {
        return buildForgeSystemPrompt();
    }
    if (normalized.startsWith(`${FORGE_AGENT_PROMPTS_ROOT}/`)) {
        return resolveForgeModePrompt(normalized);
    }
    return null;
};
