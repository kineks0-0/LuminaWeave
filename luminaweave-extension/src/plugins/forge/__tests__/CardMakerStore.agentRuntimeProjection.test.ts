import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useForgeStore } from '../../../stores/useForgeStore.js';
import type {
    AgentRuntimeEvent,
    AgentRuntimeSnapshot
} from '../../../api/core/agent-runtime/events/AgentRuntimeEventBus.js';

const runtimeClientMock = vi.hoisted(() => {
    type Listener = (event: unknown, snapshot: unknown) => void;
    let listener: Listener | null = null;
    const unsubscribe = vi.fn(() => {
        listener = null;
    });
    return {
        subscribe: vi.fn((_filter: unknown, nextListener: Listener) => {
            listener = nextListener;
            return unsubscribe;
        }),
        unsubscribe,
        emit(event: unknown, snapshot: unknown): void {
            listener?.(event, snapshot);
        },
        reset(): void {
            listener = null;
            unsubscribe.mockClear();
            this.subscribe.mockClear();
        }
    };
});

const resolveToolApprovalMock = vi.hoisted(() => vi.fn().mockResolvedValue({ resolved: true }));

vi.mock('../../../api/core/forge/runtime/ForgePiRuntimeClient.js', () => ({
    forgePiRuntimeClient: {
        subscribeToAgentRuntimeEvents: runtimeClientMock.subscribe,
        runTurn: vi.fn(),
        previewPrompt: vi.fn(),
        resolveToolApproval: resolveToolApprovalMock,
        checkout: vi.fn(),
        branchFromUserNode: vi.fn()
    }
}));

import { useCardMakerStore } from '../CardMakerStore.js';

const createSnapshot = (
    sessionId: string,
    activeTurnId: string,
    errorMessage?: string
): AgentRuntimeSnapshot => ({
    sessionId,
    activeTurnId,
    isStreaming: true,
    pendingToolCalls: [],
    messages: [],
    errorMessage,
    activeTools: []
});

const flushProjectionQueue = async (): Promise<void> => {
    await Promise.resolve();
    await Promise.resolve();
};

describe('CardMakerStore agent runtime projection subscription', () => {
    beforeEach(() => {
        runtimeClientMock.reset();
        resolveToolApprovalMock.mockReset();
        resolveToolApprovalMock.mockResolvedValue({ resolved: true });
        setActivePinia(createPinia());
    });

    it('只投影当前 session 与 turn，并在 store 销毁时取消订阅', async () => {
        const store = useCardMakerStore();
        store.forgeProjectId = 'project-1';
        store.sessionChatId = 'thread-1';
        const sessionId = 'project-1__thread-1';
        const turnId = 'turn-1';
        const agentStart: AgentRuntimeEvent = {
            type: 'agent_start',
            sessionId,
            turnId
        };

        expect(runtimeClientMock.subscribe).toHaveBeenCalledOnce();
        expect(runtimeClientMock.subscribe).toHaveBeenCalledWith({}, expect.any(Function));

        runtimeClientMock.emit(agentStart, createSnapshot(sessionId, turnId));
        await flushProjectionQueue();
        expect(store.agentRuntimeSnapshot).toEqual(expect.objectContaining({
            sessionId,
            activeTurnId: turnId
        }));

        runtimeClientMock.emit({
            type: 'turn_start',
            sessionId: 'project-2__thread-2',
            turnId
        } satisfies AgentRuntimeEvent, createSnapshot('project-2__thread-2', turnId, 'wrong session'));
        runtimeClientMock.emit({
            type: 'turn_start',
            sessionId,
            turnId: 'turn-2'
        } satisfies AgentRuntimeEvent, createSnapshot(sessionId, 'turn-2', 'wrong turn'));
        await flushProjectionQueue();
        expect(store.agentRuntimeSnapshot?.errorMessage).toBeUndefined();

        store.$dispose();
        expect(runtimeClientMock.unsubscribe).toHaveBeenCalledOnce();

        runtimeClientMock.emit({
            type: 'turn_start',
            sessionId,
            turnId
        } satisfies AgentRuntimeEvent, createSnapshot(sessionId, turnId, 'after dispose'));
        await flushProjectionQueue();
        expect(store.agentRuntimeSnapshot?.errorMessage).toBeUndefined();
    });

    it('缺少 pending approval 的精确身份时拒绝续跑', async () => {
        const store = useCardMakerStore();

        await expect(store.resolveToolApproval('missing-tool-call', true)).resolves.toBe(false);
        expect(resolveToolApprovalMock).not.toHaveBeenCalled();

        const forgeStore = useForgeStore();
        forgeStore.upsertToolApproval({
            id: 'approval-missing-session',
            requestId: 'turn-2',
            toolCallId: 'missing-session-tool-call',
            toolName: 'write',
            args: { path: 'card.md' },
            reason: '需要授权',
            source: 'conversation',
            status: 'pending',
            createdAt: Date.now(),
            sessionId: null
        });

        await expect(store.resolveToolApproval('missing-session-tool-call', true)).resolves.toBe(false);
        expect(resolveToolApprovalMock).not.toHaveBeenCalled();
    });

    it('从 pending approval 记录透传 session、turn 和 tool 身份', async () => {
        const store = useCardMakerStore();
        const forgeStore = useForgeStore();
        forgeStore.upsertToolApproval({
            id: 'approval-exact',
            requestId: 'turn-exact',
            toolCallId: 'tool-exact',
            toolName: 'write',
            args: { path: 'card.md' },
            reason: '需要授权',
            source: 'conversation',
            status: 'pending',
            createdAt: Date.now(),
            sessionId: 'project-exact__thread-exact'
        });

        await expect(store.resolveToolApproval('tool-exact', true, '允许')).resolves.toBe(true);
        expect(resolveToolApprovalMock).toHaveBeenCalledWith(
            'project-exact__thread-exact',
            'turn-exact',
            'tool-exact',
            true,
            '允许',
            undefined
        );
    });
});
