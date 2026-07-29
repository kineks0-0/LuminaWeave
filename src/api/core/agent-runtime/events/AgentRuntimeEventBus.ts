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

export interface AgentRuntimeEventFilter {
    sessionId?: string;
    turnId?: string;
}

export interface AgentRuntimeContentBlock {
    type: string;
    id?: string;
    contentIndex?: number;
    text?: string;
    [key: string]: unknown;
}

export interface AgentRuntimeMessage {
    id: string;
    turnId: string;
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
    turnId: string;
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
    sessionId: string;
    activeTurnId?: string;
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

interface AgentRuntimeScopedEvent {
    sessionId: string;
    turnId: string;
}

export type AgentRuntimeEvent =
    | (AgentRuntimeScopedEvent & { type: 'agent_start' })
    | (AgentRuntimeScopedEvent & { type: 'turn_start' })
    | (AgentRuntimeScopedEvent & {
        type: 'message_start';
        message: AgentRuntimeMessage;
    })
    | (AgentRuntimeScopedEvent & {
        type: 'message_update';
        messageId: string;
        block: AgentRuntimeContentBlock;
    })
    | (AgentRuntimeScopedEvent & {
        type: 'message_end';
        messageId: string;
    })
    | (AgentRuntimeScopedEvent & {
        type: 'tool_execution_start';
        toolCallId: string;
        toolName: string;
        args: unknown;
    })
    | (AgentRuntimeScopedEvent & {
        type: 'tool_execution_update';
        toolCallId: string;
        toolName: string;
        content: AgentRuntimeContentBlock[];
    })
    | (AgentRuntimeScopedEvent & {
        type: 'tool_execution_end';
        toolCallId: string;
        toolName: string;
        status: 'completed' | 'failed' | 'denied';
        result?: AgentRuntimeToolResult;
        errorMessage?: string;
    })
    | (AgentRuntimeScopedEvent & {
        type: 'turn_end';
        errorMessage?: string;
    })
    | (AgentRuntimeScopedEvent & { type: 'agent_end' })
    | {
        type: 'queue_update';
        sessionId: string;
        queuedTurns: number;
        activeTurnId?: string;
    };

export type AgentRuntimeEventListener = (event: AgentRuntimeEvent, snapshot: AgentRuntimeSnapshot) => void;

interface AgentRuntimeSubscription {
    filter: AgentRuntimeEventFilter;
    listener: AgentRuntimeEventListener;
}

export class AgentRuntimeEventBus {
    private readonly events: AgentRuntimeEvent[] = [];
    private readonly subscriptions = new Set<AgentRuntimeSubscription>();
    private readonly snapshots = new Map<string, AgentRuntimeSnapshot>();
    private readonly activeTools: AgentRuntimeToolSummary[];

    constructor(options: CreateAgentRuntimeEventBusOptions = {}) {
        this.activeTools = clone(options.activeTools ?? []);
    }

    subscribe(filter: AgentRuntimeEventFilter, listener: AgentRuntimeEventListener): () => void {
        const subscription = { filter: clone(filter), listener };
        this.subscriptions.add(subscription);
        return () => {
            this.subscriptions.delete(subscription);
        };
    }

    emit(event: AgentRuntimeEvent): void {
        const storedEvent = clone(event);
        this.events.push(storedEvent);
        const currentSnapshot = this.snapshots.get(storedEvent.sessionId)
            ?? this.createSnapshot(storedEvent.sessionId);
        const nextSnapshot = reduceSnapshot(currentSnapshot, storedEvent);
        this.snapshots.set(storedEvent.sessionId, nextSnapshot);
        const listenerSnapshot = clone(nextSnapshot);
        for (const subscription of this.subscriptions) {
            if (!matchesFilter(storedEvent, subscription.filter)) continue;
            try {
                subscription.listener(clone(storedEvent), clone(listenerSnapshot));
            } catch (error: unknown) {
                console.error({ error }, 'Agent runtime event subscription failed.');
            }
        }
    }

    getEvents(filter: AgentRuntimeEventFilter = {}): AgentRuntimeEvent[] {
        return clone(this.events.filter(event => matchesFilter(event, filter)));
    }

    getSnapshot(sessionId: string): AgentRuntimeSnapshot {
        return clone(this.snapshots.get(sessionId) ?? this.createSnapshot(sessionId));
    }

    private createSnapshot(sessionId: string): AgentRuntimeSnapshot {
        return {
            sessionId,
            activeTurnId: undefined,
            isStreaming: false,
            streamingMessage: undefined,
            pendingToolCalls: [],
            messages: [],
            errorMessage: undefined,
            activeTools: clone(this.activeTools),
            queue: undefined
        };
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
                activeTurnId: event.turnId,
                errorMessage: undefined
            };
        case 'turn_start':
            return {
                ...snapshot,
                activeTurnId: event.turnId,
                isStreaming: true,
                errorMessage: undefined
            };
        case 'message_start': {
            const message = {
                ...event.message,
                turnId: event.turnId,
                blocks: [...event.message.blocks],
                status: 'streaming' as const
            };
            return {
                ...snapshot,
                activeTurnId: event.turnId,
                isStreaming: true,
                streamingMessage: message,
                messages: [...snapshot.messages, message]
            };
        }
        case 'message_update':
            return updateMessage(snapshot, event, message => ({
                ...message,
                blocks: upsertMessageBlock(message.blocks, event.block),
                status: message.status ?? 'streaming'
            }));
        case 'message_end':
            return updateMessage(snapshot, event, message => ({
                ...message,
                status: 'complete'
            }), true);
        case 'tool_execution_start': {
            const alreadyPending = snapshot.pendingToolCalls.some(toolCall =>
                toolCall.turnId === event.turnId && toolCall.toolCallId === event.toolCallId
            );
            if (alreadyPending) return snapshot;
            return {
                ...snapshot,
                pendingToolCalls: [
                    ...snapshot.pendingToolCalls,
                    {
                        turnId: event.turnId,
                        toolCallId: event.toolCallId,
                        toolName: event.toolName,
                        args: event.args,
                        status: 'running',
                        updates: []
                    }
                ]
            };
        }
        case 'tool_execution_update':
            return {
                ...snapshot,
                pendingToolCalls: snapshot.pendingToolCalls.map(toolCall =>
                    toolCall.turnId === event.turnId && toolCall.toolCallId === event.toolCallId
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
                pendingToolCalls: snapshot.pendingToolCalls.filter(toolCall =>
                    toolCall.turnId !== event.turnId || toolCall.toolCallId !== event.toolCallId
                ),
                errorMessage: snapshot.activeTurnId === event.turnId
                    ? event.errorMessage ?? snapshot.errorMessage
                    : snapshot.errorMessage
            };
        case 'turn_end':
            if (snapshot.activeTurnId !== event.turnId) return snapshot;
            return {
                ...snapshot,
                isStreaming: false,
                streamingMessage: undefined,
                errorMessage: event.errorMessage ?? snapshot.errorMessage
            };
        case 'agent_end':
            if (snapshot.activeTurnId !== event.turnId) return snapshot;
            return {
                ...snapshot,
                activeTurnId: undefined,
                isStreaming: false,
                streamingMessage: undefined,
                pendingToolCalls: snapshot.pendingToolCalls.filter(toolCall => toolCall.turnId !== event.turnId)
            };
        case 'queue_update':
            return {
                ...snapshot,
                activeTurnId: event.activeTurnId,
                queue: {
                    queuedTurns: event.queuedTurns,
                    activeTurnId: event.activeTurnId
                }
            };
    }
};

const updateMessage = (
    snapshot: AgentRuntimeSnapshot,
    event: Extract<AgentRuntimeEvent, { type: 'message_update' | 'message_end' }>,
    update: (message: AgentRuntimeMessage) => AgentRuntimeMessage,
    clearStreaming = false
): AgentRuntimeSnapshot => {
    let updatedStreamingMessage = snapshot.streamingMessage;
    const messages = snapshot.messages.map(message => {
        if (message.turnId !== event.turnId || message.id !== event.messageId) return message;
        const updated = update(message);
        if (snapshot.streamingMessage?.turnId === event.turnId && snapshot.streamingMessage.id === event.messageId) {
            updatedStreamingMessage = updated;
        }
        return updated;
    });
    const shouldClearStreaming = clearStreaming
        && snapshot.streamingMessage?.turnId === event.turnId
        && snapshot.streamingMessage.id === event.messageId;
    return {
        ...snapshot,
        streamingMessage: shouldClearStreaming ? undefined : updatedStreamingMessage,
        messages
    };
};

const matchesFilter = (event: AgentRuntimeEvent, filter: AgentRuntimeEventFilter): boolean => {
    if (filter.sessionId !== undefined && event.sessionId !== filter.sessionId) return false;
    if (filter.turnId === undefined) return true;
    return resolveEventTurnId(event) === filter.turnId;
};

const resolveEventTurnId = (event: AgentRuntimeEvent): string | undefined =>
    event.type === 'queue_update' ? event.activeTurnId : event.turnId;

const upsertMessageBlock = (
    blocks: AgentRuntimeContentBlock[],
    nextBlock: AgentRuntimeContentBlock
): AgentRuntimeContentBlock[] => {
    const existingIndex = findMessageBlockIndex(blocks, nextBlock);
    if (existingIndex < 0) return [...blocks, nextBlock];
    return blocks.map((block, index) => index === existingIndex ? nextBlock : block);
};

const findMessageBlockIndex = (
    blocks: AgentRuntimeContentBlock[],
    nextBlock: AgentRuntimeContentBlock
): number => {
    if (typeof nextBlock.id === 'string' && nextBlock.id.length > 0) {
        return blocks.findIndex(block => block.id === nextBlock.id);
    }
    if (typeof nextBlock.contentIndex === 'number') {
        return blocks.findIndex(block => block.contentIndex === nextBlock.contentIndex);
    }
    return blocks.findIndex(block => block.type === nextBlock.type);
};

const clone = <T>(value: T): T => {
    if (value === undefined || value === null) return value;
    return JSON.parse(JSON.stringify(value)) as T;
};
