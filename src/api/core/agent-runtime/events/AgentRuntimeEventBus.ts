import type { AgentRuntimeToolResult } from '../tools/AgentToolRegistry.js';

export type AgentRuntimeEventType =
    | 'agent_start'
    | 'turn_start'
    | 'message_start'
    | 'message_update'
    | 'message_end'
    | 'tool_execution_start'
    | 'tool_execution_update'
    | 'tool_execution_end'
    | 'turn_end'
    | 'agent_end'
    | 'queue_update';

export interface AgentRuntimeContentBlock {
    type: string;
    text?: string;
    [key: string]: unknown;
}

export interface AgentRuntimeMessage {
    id: string;
    role: 'system' | 'user' | 'assistant' | 'tool' | 'custom';
    blocks: AgentRuntimeContentBlock[];
    status?: 'streaming' | 'complete';
    customType?: string;
    details?: unknown;
}

export interface AgentRuntimeToolSummary {
    name: string;
    description: string;
    needsApproval: boolean | 'dynamic';
}

export interface AgentRuntimePendingToolCall {
    toolCallId: string;
    toolName: string;
    args: unknown;
    status: 'running';
    updates: AgentRuntimeContentBlock[][];
}

export interface AgentRuntimeQueueSnapshot {
    queuedTurns: number;
    activeTurnId?: string;
}

export interface AgentRuntimeSnapshot {
    isStreaming: boolean;
    streamingMessage?: AgentRuntimeMessage;
    pendingToolCalls: AgentRuntimePendingToolCall[];
    messages: AgentRuntimeMessage[];
    errorMessage?: string;
    activeTools: AgentRuntimeToolSummary[];
    queue?: AgentRuntimeQueueSnapshot;
}

export interface CreateAgentRuntimeEventBusOptions {
    activeTools?: AgentRuntimeToolSummary[];
}

export type AgentRuntimeEvent =
    | {
        type: 'agent_start';
        sessionId: string;
    }
    | {
        type: 'turn_start';
        turnId: string;
    }
    | {
        type: 'message_start';
        message: AgentRuntimeMessage;
    }
    | {
        type: 'message_update';
        messageId: string;
        block: AgentRuntimeContentBlock;
    }
    | {
        type: 'message_end';
        messageId: string;
    }
    | {
        type: 'tool_execution_start';
        toolCallId: string;
        toolName: string;
        args: unknown;
    }
    | {
        type: 'tool_execution_update';
        toolCallId: string;
        content: AgentRuntimeContentBlock[];
    }
    | {
        type: 'tool_execution_end';
        toolCallId: string;
        status: 'completed' | 'failed' | 'denied';
        result?: AgentRuntimeToolResult;
        errorMessage?: string;
    }
    | {
        type: 'turn_end';
        turnId: string;
        errorMessage?: string;
    }
    | {
        type: 'agent_end';
        sessionId: string;
    }
    | {
        type: 'queue_update';
        queuedTurns: number;
        activeTurnId?: string;
    };

export type AgentRuntimeEventListener = (event: AgentRuntimeEvent, snapshot: AgentRuntimeSnapshot) => void;

export class AgentRuntimeEventBus {
    private readonly events: AgentRuntimeEvent[] = [];
    private readonly listeners = new Set<AgentRuntimeEventListener>();
    private snapshot: AgentRuntimeSnapshot;

    constructor(options: CreateAgentRuntimeEventBusOptions = {}) {
        this.snapshot = {
            isStreaming: false,
            streamingMessage: undefined,
            pendingToolCalls: [],
            messages: [],
            errorMessage: undefined,
            activeTools: clone(options.activeTools ?? []),
            queue: undefined
        };
    }

    subscribe(listener: AgentRuntimeEventListener): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    emit(event: AgentRuntimeEvent): void {
        const storedEvent = clone(event);
        this.events.push(storedEvent);
        this.snapshot = reduceSnapshot(this.snapshot, storedEvent);
        const snapshot = this.getSnapshot();
        for (const listener of this.listeners) {
            listener(storedEvent, snapshot);
        }
    }

    getEvents(): AgentRuntimeEvent[] {
        return clone(this.events);
    }

    getSnapshot(): AgentRuntimeSnapshot {
        return clone(this.snapshot);
    }
}

const reduceSnapshot = (
    snapshot: AgentRuntimeSnapshot,
    event: AgentRuntimeEvent
): AgentRuntimeSnapshot => {
    switch (event.type) {
        case 'agent_start':
            return {
                ...snapshot,
                errorMessage: undefined
            };
        case 'turn_start':
            return {
                ...snapshot,
                isStreaming: true,
                errorMessage: undefined
            };
        case 'message_start': {
            const message = {
                ...event.message,
                blocks: [...event.message.blocks],
                status: 'streaming' as const
            };
            return {
                ...snapshot,
                isStreaming: true,
                streamingMessage: message,
                messages: [...snapshot.messages, message]
            };
        }
        case 'message_update':
            return updateMessage(snapshot, event.messageId, message => ({
                ...message,
                blocks: [...message.blocks, event.block],
                status: message.status ?? 'streaming'
            }));
        case 'message_end':
            return updateMessage(snapshot, event.messageId, message => ({
                ...message,
                status: 'complete'
            }), true);
        case 'tool_execution_start':
            return {
                ...snapshot,
                pendingToolCalls: [
                    ...snapshot.pendingToolCalls,
                    {
                        toolCallId: event.toolCallId,
                        toolName: event.toolName,
                        args: event.args,
                        status: 'running',
                        updates: []
                    }
                ]
            };
        case 'tool_execution_update':
            return {
                ...snapshot,
                pendingToolCalls: snapshot.pendingToolCalls.map(toolCall =>
                    toolCall.toolCallId === event.toolCallId
                        ? {
                            ...toolCall,
                            updates: [...toolCall.updates, event.content]
                        }
                        : toolCall
                )
            };
        case 'tool_execution_end':
            return {
                ...snapshot,
                pendingToolCalls: snapshot.pendingToolCalls.filter(toolCall => toolCall.toolCallId !== event.toolCallId),
                errorMessage: event.errorMessage ?? snapshot.errorMessage
            };
        case 'turn_end':
            return {
                ...snapshot,
                isStreaming: false,
                streamingMessage: undefined,
                errorMessage: event.errorMessage ?? snapshot.errorMessage
            };
        case 'agent_end':
            return {
                ...snapshot,
                isStreaming: false,
                streamingMessage: undefined,
                pendingToolCalls: []
            };
        case 'queue_update':
            return {
                ...snapshot,
                queue: {
                    queuedTurns: event.queuedTurns,
                    activeTurnId: event.activeTurnId
                }
            };
    }
};

const updateMessage = (
    snapshot: AgentRuntimeSnapshot,
    messageId: string,
    update: (message: AgentRuntimeMessage) => AgentRuntimeMessage,
    clearStreaming = false
): AgentRuntimeSnapshot => {
    let updatedStreamingMessage = snapshot.streamingMessage;
    const messages = snapshot.messages.map(message => {
        if (message.id !== messageId) return message;
        const updated = update(message);
        updatedStreamingMessage = updated;
        return updated;
    });
    return {
        ...snapshot,
        streamingMessage: clearStreaming ? undefined : updatedStreamingMessage,
        messages
    };
};

const clone = <T>(value: T): T => {
    if (value === undefined || value === null) return value;
    return JSON.parse(JSON.stringify(value)) as T;
};
