import type { AgentMessage, AgentTool } from '@earendil-works/pi-agent-core';
import { createInitialSystemMessage, toToolDeclaration, type UserMessage } from '@earendil-works/pi-ai';
import type { AgentSessionModelRef, AgentSessionTurnPlan } from './AgentSessionTypes.js';

export interface AgentSessionTurnContext {
    turnId: string;
    systemPrompt: string;
    /** 与 pi Agent 初始 state.messages 一致：[带 toolsAdded 的 system 消息, ...history, userMessage]。 */
    transcript: AgentMessage[];
    history: AgentMessage[];
    /** 交给 agent.prompt() 的同一个对象，也是写入日志的本轮 user 消息。 */
    userMessage: AgentMessage;
    /** 适配器工具 + 包装后的 registry 工具（与运行时同一份合并结果）。 */
    tools: AgentTool[];
    toolDeclarations: Array<{ name: string; description: string; parameters: unknown }>;
    model: AgentSessionModelRef;
}

/**
 * 预览与真实运行共用的纯函数上下文构建器。
 * transcript 复现 pi Agent 构造时补首条 system 消息的规则（createInitialSystemMessage + toToolDeclaration），
 * 因此等于第一次 LLM 请求时 streamFn 收到的 context.messages。
 * 会话核心没有 beforeAgentStart 一类钩子：适配器应当用同一个 planTurn(input) 同时生成预览和运行用的 plan。
 */
export const buildTurnContext = (
    plan: AgentSessionTurnPlan,
    tools: AgentTool[],
    now: () => number
): AgentSessionTurnContext => {
    // pi 只在 messages 不以 system 开头时才用 systemPrompt 生成首条 system 消息；
    // history 混入 system 会静默替换本回合系统提示词或残留旧的工具声明，因此直接拒绝。
    if (plan.history.some(message => message.role === 'system')) {
        throw new Error('AgentSession history must not contain system messages; pass the prompt via plan.systemPrompt.');
    }
    const declarations = tools.map(toToolDeclaration);
    const userMessage: UserMessage = { role: 'user', content: [{ type: 'text', text: plan.prompt }], timestamp: now() };
    const history = plan.history.slice();
    const systemMessage = createInitialSystemMessage(plan.systemPrompt, declarations);
    return {
        turnId: plan.turnId,
        systemPrompt: plan.systemPrompt,
        transcript: [...(systemMessage ? [systemMessage] : []), ...history, userMessage],
        history,
        userMessage,
        tools,
        toolDeclarations: declarations,
        model: { provider: plan.model.provider, id: plan.model.id }
    };
};
