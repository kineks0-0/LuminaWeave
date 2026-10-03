import type { AgentToolResult } from '@earendil-works/pi-agent-core';
import type { ImageContent, JsonValue, TextContent, ToolResultMessage } from '@earendil-works/pi-ai';
import type { AgentRuntimeContentBlock } from '../events/AgentRuntimeEventBus.js';
import { toJsonValue } from '../runtime/AgentJsonValue.js';
import type { AgentRuntimeToolResult } from '../tools/AgentToolRegistry.js';
import { isRecord, type AgentSessionToolOutcome } from './AgentSessionInternals.js';

// 会话内纯内容转换：SDK 工具结果 ↔ pi 内容 / toolResult 消息，以及投影到总线的内容块。无状态、无副作用。

/** pi 只接受 text / image 内容；其他块类型无法交给模型，直接丢弃。 */
export const toPiContent = (content: AgentRuntimeToolResult['content']): Array<TextContent | ImageContent> =>
    content.flatMap((part): Array<TextContent | ImageContent> => {
        if (part.type === 'text' && typeof part.text === 'string') return [{ type: 'text', text: part.text }];
        if (part.type === 'image' && typeof part.data === 'string' && typeof part.mimeType === 'string') {
            return [{ type: 'image', data: part.data, mimeType: part.mimeType }];
        }
        return [];
    });

export const toPiToolResult = (result: AgentRuntimeToolResult): AgentToolResult => ({
    content: toPiContent(result.content),
    details: toJsonValue(result.details)
});

export const toToolResultMessage = (
    toolCall: { toolCallId: string; toolName: string },
    outcome: AgentSessionToolOutcome
): ToolResultMessage => {
    const details: JsonValue | undefined = toJsonValue(outcome.result.details);
    return {
        role: 'toolResult',
        toolCallId: toolCall.toolCallId,
        toolName: toolCall.toolName,
        content: toPiContent(outcome.result.content),
        ...(details !== undefined ? { details } : {}),
        isError: outcome.isError,
        timestamp: Date.now()
    };
};

const isContentPart = (value: unknown): value is AgentRuntimeContentBlock =>
    isRecord(value)
    && typeof value.type === 'string'
    && (value.text === undefined || typeof value.text === 'string');

export const toBusContent = (content: unknown): AgentRuntimeContentBlock[] => {
    const json = toJsonValue(content);
    return Array.isArray(json) ? json.filter(isContentPart) : [];
};

export const toBusToolResult = (result: AgentRuntimeToolResult): AgentRuntimeToolResult => ({
    content: toBusContent(result.content),
    details: toJsonValue(result.details)
});

export const toBusToolResultFromUnknown = (result: unknown): AgentRuntimeToolResult => ({
    content: toBusContent(isRecord(result) ? result.content : undefined),
    details: isRecord(result) ? toJsonValue(result.details) : undefined
});

export const summarizeContent = (content: AgentRuntimeToolResult['content']): string =>
    content
        .map(part => part.text)
        .filter((text): text is string => typeof text === 'string' && text.length > 0)
        .join('\n') || 'Tool execution failed.';
