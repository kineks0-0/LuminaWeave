import type {
    AgentRuntimeEvent,
    AgentRuntimeMessage,
    AgentRuntimeSnapshot
} from '../../../api/core/agent-runtime/events/AgentRuntimeEventBus.js';
import type {
    ForgeAgentRuntimeMessageBlock,
    ForgeRuntimeContext,
    ForgeRuntimeEffect
} from '../../../types/ForgeRuntimeTypes.js';

export interface ForgeAgentRuntimeMessageProjection {
    messageId: string;
    turnId: string;
    rawText: string;
    displayText: string;
    thinkingText: string;
    blocks: ForgeAgentRuntimeMessageBlock[];
}

export interface BuildForgeAgentRuntimePresentationEffectsInput {
    event: AgentRuntimeEvent;
    snapshot: AgentRuntimeSnapshot;
    context: ForgeRuntimeContext;
    timestamp?: number;
}

interface IndexedBlock {
    inputIndex: number;
    contentIndex: number;
    block: ForgeAgentRuntimeMessageBlock;
}

export const projectForgeAgentRuntimeMessage = (
    message: AgentRuntimeMessage
): ForgeAgentRuntimeMessageProjection => {
    const indexedBlocks: IndexedBlock[] = [];
    message.blocks.forEach((block, inputIndex) => {
        const contentIndex = typeof block.contentIndex === 'number'
            ? block.contentIndex
            : inputIndex;
        if (block.type === 'text' && typeof block.text === 'string') {
            indexedBlocks.push({
                inputIndex,
                contentIndex,
                block: { type: 'text', contentIndex, text: block.text }
            });
            return;
        }
        if (block.type === 'thinking' && typeof block.text === 'string') {
            indexedBlocks.push({
                inputIndex,
                contentIndex,
                block: { type: 'thinking', contentIndex, text: block.text }
            });
            return;
        }
        if (
            block.type === 'toolCall'
            && typeof block.id === 'string'
            && typeof block.toolName === 'string'
        ) {
            indexedBlocks.push({
                inputIndex,
                contentIndex,
                block: {
                    type: 'toolCall',
                    contentIndex,
                    toolCallId: block.id,
                    toolName: block.toolName,
                    args: block.args
                }
            });
        }
    });
    indexedBlocks.sort((left, right) => (
        left.contentIndex - right.contentIndex || left.inputIndex - right.inputIndex
    ));
    const blocks = indexedBlocks.map(item => item.block);
    const displayText = blocks
        .filter((block): block is Extract<ForgeAgentRuntimeMessageBlock, { type: 'text' }> => block.type === 'text')
        .map(block => block.text)
        .join('');
    const thinkingText = blocks
        .filter((block): block is Extract<ForgeAgentRuntimeMessageBlock, { type: 'thinking' }> => block.type === 'thinking')
        .map(block => block.text)
        .filter(text => text.length > 0)
        .join('\n\n');

    return {
        messageId: message.id,
        turnId: message.turnId,
        rawText: displayText,
        displayText,
        thinkingText,
        blocks
    };
};

export const buildForgeAgentRuntimePresentationEffects = (
    input: BuildForgeAgentRuntimePresentationEffectsInput
): ForgeRuntimeEffect[] => {
    const timestamp = input.timestamp ?? Date.now();
    const effects = buildEventEffects(input.event, input.snapshot, input.context, timestamp);
    effects.push({
        type: 'set_agent_runtime_snapshot',
        requestId: resolveEventTurnId(input.event),
        snapshot: input.snapshot
    });
    return effects;
};

const buildEventEffects = (
    event: AgentRuntimeEvent,
    snapshot: AgentRuntimeSnapshot,
    context: ForgeRuntimeContext,
    timestamp: number
): ForgeRuntimeEffect[] => {
    if (event.type === 'message_update') {
        const message = snapshot.messages.find(item => (
            item.turnId === event.turnId && item.id === event.messageId
        ));
        if (!message) return [];
        const projection = projectForgeAgentRuntimeMessage(message);
        return [
            createMessageProjectionEffect(event.sessionId, projection, 'streaming', false, timestamp),
            createModelRequestStreamEffect(event.turnId, projection)
        ];
    }

    if (event.type === 'turn_end') {
        if (event.errorMessage) {
            return [
                {
                    type: 'project_agent_turn_error',
                    sessionId: event.sessionId,
                    turnId: event.turnId,
                    message: event.errorMessage
                },
                {
                    type: 'fail_model_request',
                    requestId: event.turnId,
                    message: event.errorMessage
                }
            ];
        }
        const message = findLastAssistantMessage(snapshot, event.turnId);
        const projection = message
            ? projectForgeAgentRuntimeMessage(message)
            : createEmptyMessageProjection(event.turnId);
        const completionEffects: ForgeRuntimeEffect[] = [];
        if (message) {
            completionEffects.push(
                createMessageProjectionEffect(event.sessionId, projection, 'complete', true, timestamp)
            );
        }
        completionEffects.push({
            type: 'complete_model_request',
            requestId: event.turnId,
            responseRaw: projection.rawText,
            responseDisplay: projection.displayText,
            responseThinking: projection.thinkingText,
            completedAt: timestamp
        });
        return completionEffects;
    }

    if (event.type === 'tool_execution_start') {
        const dedupeKey = buildToolOperationKey(event);
        return [
            {
                type: 'upsert_running_operation',
                dedupeKey,
                operationKind: 'execution',
                title: `正在调用工具 · ${event.toolName}`,
                summary: formatPayload(event.args),
                detail: formatPayload(event.args, true),
                sourceTag: `tool:${event.toolName}`,
                layer: context.activeLayer
            },
            createToolTraceEffect({
                turnId: event.turnId,
                toolCallId: event.toolCallId,
                toolName: event.toolName,
                type: 'tool_call',
                payload: event.args,
                timestamp
            })
        ];
    }

    if (event.type === 'tool_execution_update') {
        return [{
            type: 'upsert_running_operation',
            dedupeKey: buildToolOperationKey(event),
            operationKind: 'execution',
            title: `正在调用工具 · ${event.toolName}`,
            summary: summarizeToolUpdate(event.content),
            detail: formatPayload(event.content, true),
            sourceTag: `tool:${event.toolName}`,
            layer: context.activeLayer
        }];
    }

    if (event.type === 'tool_execution_end') {
        const presentation = resolveToolEndPresentation(event.status, event.toolName);
        const summary = event.errorMessage
            ?? (event.result ? formatPayload(event.result) : presentation.summary);
        return [
            {
                type: 'finish_operation',
                dedupeKey: buildToolOperationKey(event),
                status: presentation.status,
                operationKind: event.status === 'failed' ? 'system' : 'execution',
                title: presentation.title,
                summary,
                detail: event.result ? formatPayload(event.result, true) : event.errorMessage,
                sourceTag: `tool:${event.toolName}`,
                layer: context.activeLayer
            },
            createToolTraceEffect({
                turnId: event.turnId,
                toolCallId: event.toolCallId,
                toolName: event.toolName,
                type: 'tool_result',
                payload: {
                    status: event.status,
                    result: event.result,
                    errorMessage: event.errorMessage
                },
                timestamp
            })
        ];
    }

    return [];
};

const createMessageProjectionEffect = (
    sessionId: string,
    projection: ForgeAgentRuntimeMessageProjection,
    status: 'streaming' | 'complete',
    commit: boolean,
    timestamp: number
): ForgeRuntimeEffect => ({
    type: 'project_agent_message',
    sessionId,
    turnId: projection.turnId,
    messageId: projection.messageId,
    rawText: projection.rawText,
    displayText: projection.displayText,
    thinkingText: projection.thinkingText,
    blocks: projection.blocks,
    status,
    commit,
    timestamp
});

const createModelRequestStreamEffect = (
    turnId: string,
    projection: ForgeAgentRuntimeMessageProjection
): ForgeRuntimeEffect => ({
    type: 'update_model_request_stream',
    requestId: turnId,
    responseRaw: projection.rawText,
    responseDisplay: projection.displayText,
    responseThinking: projection.thinkingText
});

const createToolTraceEffect = (input: {
    turnId: string;
    toolCallId: string;
    toolName: string;
    type: 'tool_call' | 'tool_result';
    payload: unknown;
    timestamp: number;
}): ForgeRuntimeEffect => ({
    type: 'append_model_request_tool_event',
    requestId: input.turnId,
    event: {
        id: `${input.turnId}:${input.toolCallId}:${input.type}:${input.timestamp}`,
        type: input.type,
        toolCallId: input.toolCallId,
        toolName: input.toolName,
        payload: input.payload,
        createdAt: input.timestamp
    }
});

const findLastAssistantMessage = (
    snapshot: AgentRuntimeSnapshot,
    turnId: string
): AgentRuntimeMessage | undefined => [...snapshot.messages]
    .reverse()
    .find(message => message.turnId === turnId && message.role === 'assistant');

const createEmptyMessageProjection = (turnId: string): ForgeAgentRuntimeMessageProjection => ({
    messageId: '',
    turnId,
    rawText: '',
    displayText: '',
    thinkingText: '',
    blocks: []
});

const buildToolOperationKey = (event: {
    sessionId: string;
    turnId: string;
    toolCallId: string;
}): string => `forge-agent-tool:${event.sessionId}:${event.turnId}:${event.toolCallId}`;

const resolveToolEndPresentation = (
    status: Extract<AgentRuntimeEvent, { type: 'tool_execution_end' }>['status'],
    toolName: string
): {
    status: 'completed' | 'failed' | 'cancelled';
    title: string;
    summary: string;
} => {
    if (status === 'denied') {
        return {
            status: 'cancelled',
            title: `已拒绝工具调用 · ${toolName}`,
            summary: 'Tool execution denied.'
        };
    }
    if (status === 'failed') {
        return {
            status: 'failed',
            title: `工具调用失败 · ${toolName}`,
            summary: 'Tool execution failed.'
        };
    }
    return {
        status: 'completed',
        title: `已完成工具 · ${toolName}`,
        summary: 'Tool execution completed.'
    };
};

const summarizeToolUpdate = (
    content: Extract<AgentRuntimeEvent, { type: 'tool_execution_update' }>['content']
): string => {
    const text = content
        .map(block => block.text)
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
        .join('\n');
    return text || 'Tool execution updated.';
};

const formatPayload = (payload: unknown, pretty = false): string => {
    try {
        const serialized = JSON.stringify(payload, null, pretty ? 2 : undefined);
        return (serialized ?? '').slice(0, pretty ? 4000 : 240);
    } catch {
        return 'Unserializable tool payload.';
    }
};

const resolveEventTurnId = (event: AgentRuntimeEvent): string | undefined => (
    event.type === 'queue_update' ? event.activeTurnId : event.turnId
);
