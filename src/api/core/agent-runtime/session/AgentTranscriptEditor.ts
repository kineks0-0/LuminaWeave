import type { AgentMessage } from '@earendil-works/pi-agent-core';
import type { AssistantMessage, ToolResultMessage } from '@earendil-works/pi-ai';
import { toToolResultMessage } from './AgentSessionContent.js';
import { errorOutcome } from './AgentSessionInternals.js';

// pi 消息记录的纯数组修补函数：不读写 agent.state，不通知观察者，也不修改入参数组；
// 由 AgentSession 负责把结果写回 agent.state.messages 并决定何时通知。

/**
 * 移除最后一条匹配 toolCallId 的 toolResult（审批占位），返回新数组与被移除的位置；找不到时 index 为 undefined。
 * 必须从末尾向前找：provider 只保证单条 assistant 消息内 toolCallId 唯一，OpenAI 兼容代理与本地模型
 * 常跨回合复用 call_0/call_1，history 里可能有同 id 的旧结果；本回合占位一定是最后出现的那条。
 */
export const removeLastToolResult = (
    messages: AgentMessage[],
    toolCallId: string
): { messages: AgentMessage[]; index: number | undefined } => {
    for (let cursor = messages.length - 1; cursor >= 0; cursor -= 1) {
        const message = messages[cursor];
        if (message.role === 'toolResult' && message.toolCallId === toolCallId) {
            return { messages: [...messages.slice(0, cursor), ...messages.slice(cursor + 1)], index: cursor };
        }
    }
    return { messages, index: undefined };
};

export const insertToolResultAt = (
    messages: AgentMessage[],
    index: number,
    result: ToolResultMessage
): AgentMessage[] => [...messages.slice(0, index), result, ...messages.slice(index)];

/**
 * 某个 toolCall 的结果应插入的位置：发起该调用的 assistant 消息之后、紧随其后的已有 toolResult 段之后。
 * 同样从末尾向前找发起消息（toolCallId 可能跨回合复用）；找不到时返回 undefined。
 * 用于消息记录中没有占位位置可用的场景，即重载后恢复等待中的审批。
 *
 * 前提：传入的是日志中已提交的前缀。按 A2b-2 的游标规则，暂停时排在等待调用之后、被跳过的那些结果
 * 尚未写入，因此返回值就是占位原位置。若传入的消息里已含等待调用之后的结果，返回值会排在它们之后，
 * 与运行时“插回占位原位置”的行为不一致。
 */
export const findToolResultInsertIndex = (messages: AgentMessage[], toolCallId: string): number | undefined => {
    for (let cursor = messages.length - 1; cursor >= 0; cursor -= 1) {
        const message = messages[cursor];
        if (message.role !== 'assistant') continue;
        if (!message.content.some(part => part.type === 'toolCall' && part.id === toolCallId)) continue;
        let index = cursor + 1;
        while (index < messages.length && messages[index].role === 'toolResult') index += 1;
        return index;
    }
    return undefined;
};

/**
 * 为 historyEnd 之后缺少结果的 toolCall 补 isError toolResult（文案为 text），保证消息记录自洽；
 * 返回新数组与补入的消息（未补时 messages 为入参原数组）。
 * 主要来源是中止：pi 顺序执行时在 abort 后直接 break，同批次剩余调用既不执行也不产生结果。
 * 只处理正常结束的 assistant 消息；error/aborted 的 assistant 消息在 pi-ai 重放时整条被跳过，
 * 为它们补结果反而会制造孤立 toolResult。
 */
export const fillMissingToolResults = (
    messages: AgentMessage[],
    historyEnd: number,
    text: string
): { messages: AgentMessage[]; filled: ToolResultMessage[] } => {
    const next: AgentMessage[] = [];
    const filled: ToolResultMessage[] = [];
    let index = 0;
    while (index < messages.length) {
        const message = messages[index];
        next.push(message);
        index += 1;
        if (
            index <= historyEnd
            || message.role !== 'assistant'
            || message.stopReason === 'error'
            || message.stopReason === 'aborted'
        ) continue;
        const answered = new Set<string>();
        while (index < messages.length) {
            const candidate = messages[index];
            if (candidate.role !== 'toolResult') break;
            answered.add(candidate.toolCallId);
            next.push(candidate);
            index += 1;
        }
        for (const part of message.content) {
            if (part.type !== 'toolCall' || answered.has(part.id)) continue;
            const result = toToolResultMessage({ toolCallId: part.id, toolName: part.name }, errorOutcome(text));
            next.push(result);
            filled.push(result);
        }
    }
    return { messages: filled.length > 0 ? next : messages, filled };
};

/** 去掉开头的 system 消息（pi 由 systemPrompt 生成），得到对外的消息记录副本。 */
export const stripSystemMessage = (messages: AgentMessage[]): AgentMessage[] =>
    messages[0]?.role === 'system' ? messages.slice(1) : messages.slice();

export const lastAssistant = (messages: AgentMessage[]): AssistantMessage | undefined => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (message.role === 'assistant') return message;
    }
    return undefined;
};
