import type { AssistantMessage } from '@earendil-works/pi-ai';
import type { AgentRuntimeContentBlock } from '../events/AgentRuntimeEventBus.js';

/** 把 pi assistant 消息（含流式 partial）投影为总线内容块；块按 contentIndex 与 pi content 一一对应。 */
export const projectAssistantBlocks = (message: AssistantMessage): AgentRuntimeContentBlock[] =>
    message.content.map((part, contentIndex): AgentRuntimeContentBlock => {
        switch (part.type) {
            case 'text':
                return { type: 'text', contentIndex, text: part.text };
            case 'thinking':
                return { type: 'thinking', contentIndex, text: part.thinking, redacted: part.redacted === true };
            case 'toolCall':
                return { type: 'toolCall', id: part.id, contentIndex, toolName: part.name, args: part.arguments };
        }
    });

/**
 * 块级去重 key：流式期间每次 message_update 都会重投影整条消息，
 * session 只为 key 变化的块发事件。块只含可序列化值，JSON 即可区分内容变化。
 */
export const blockKey = (block: AgentRuntimeContentBlock): string => JSON.stringify(block);
