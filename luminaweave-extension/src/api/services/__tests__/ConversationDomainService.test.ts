import { describe, expect, it, vi } from 'vitest';
import { ConversationDomainService } from '../ConversationDomainService.js';

const createCoreConversationService = () => ({
    listConversationSources: vi.fn(async () => [{ id: 'chat', label: 'Chat' }]),
    listConversationSessions: vi.fn(async () => [{ id: 'session-1', sourceId: 'chat', title: 'Session 1' }]),
    getConversationContext: vi.fn(async () => ({ source: 'chat', sessionId: null, activeLeafId: null })),
    getConversationMessages: vi.fn(async () => [{ id: 'node-1', mes: 'Hello' }]),
    getConversationTimelineGraph: vi.fn(async () => ({ 'node-1': { id: 'node-1' } })),
    switchConversationContext: vi.fn(async () => ({ source: 'forge', sessionId: 'forge-1' })),
    createChatSession: vi.fn(async () => ({ success: true, sessionId: 'new-chat' })),
    renameChatSession: vi.fn(async () => ({ success: true })),
    deleteChatSession: vi.fn(async () => ({ success: true })),
    switchConversationNode: vi.fn(async () => true),
    branchConversationNode: vi.fn(async () => true),
    rollbackConversationNode: vi.fn(async () => true)
});

const createEventSource = () => ({
    subscribe: vi.fn(() => vi.fn())
});

const createMessageCommands = () => ({
    mutateChatRecord: vi.fn(async () => ({ success: true, events: [] }))
});

describe('ConversationDomainService', () => {
    it('waits for runtime readiness before reading conversation context', async () => {
        const core = createCoreConversationService();
        const waitForReady = vi.fn(async () => true);
        const service = new ConversationDomainService(core as never, waitForReady, createEventSource(), createMessageCommands());

        await expect(service.getContext({ sourceId: 'chat' })).resolves.toEqual({
            source: 'chat',
            sessionId: null,
            activeLeafId: null
        });

        expect(waitForReady).toHaveBeenCalledTimes(1);
        expect(core.getConversationContext).toHaveBeenCalledWith({ sourceId: 'chat' });
    });

    it('delegates session listing and context switching to the core conversation service', async () => {
        const core = createCoreConversationService();
        const service = new ConversationDomainService(
            core as never,
            vi.fn(async () => true),
            createEventSource(),
            createMessageCommands()
        );

        await service.listSessions('forge');
        await service.switchContext({ sourceId: 'forge', sessionId: 'forge-1' });

        expect(core.listConversationSessions).toHaveBeenCalledWith('forge');
        expect(core.switchConversationContext).toHaveBeenCalledWith({ sourceId: 'forge', sessionId: 'forge-1' });
    });

    it('delegates worldline commands without owning mutation logic', async () => {
        const core = createCoreConversationService();
        const service = new ConversationDomainService(
            core as never,
            vi.fn(async () => true),
            createEventSource(),
            createMessageCommands()
        );
        const input = { sourceId: 'chat' as const, targetNodeId: 'node-1' };

        await expect(service.switchNode(input)).resolves.toBe(true);
        await expect(service.branchNode(input)).resolves.toBe(true);
        await expect(service.rollbackNode(input)).resolves.toBe(true);

        expect(core.switchConversationNode).toHaveBeenCalledWith(input);
        expect(core.branchConversationNode).toHaveBeenCalledWith(input);
        expect(core.rollbackConversationNode).toHaveBeenCalledWith(input);
    });

    it('returns the event source unsubscribe function to runtime consumers', () => {
        const core = createCoreConversationService();
        const unsubscribe = vi.fn();
        const eventSource = {
            subscribe: vi.fn(() => unsubscribe)
        };
        const listener = vi.fn();
        const service = new ConversationDomainService(
            core as never,
            vi.fn(async () => true),
            eventSource,
            createMessageCommands()
        );

        expect(service.subscribe(listener)).toBe(unsubscribe);
        expect(eventSource.subscribe).toHaveBeenCalledWith(listener);
    });

    it('delegates message editing and deletion through the command port after readiness', async () => {
        const core = createCoreConversationService();
        const waitForReady = vi.fn(async () => true);
        const messageCommands = createMessageCommands();
        const service = new ConversationDomainService(
            core as never,
            waitForReady,
            createEventSource(),
            messageCommands
        );

        await expect(service.editMessage('node-1', 'Updated')).resolves.toBe(true);
        await expect(service.deleteMessage('node-1')).resolves.toBe(true);

        expect(waitForReady).toHaveBeenCalledTimes(2);
        expect(messageCommands.mutateChatRecord).toHaveBeenNthCalledWith(1, 'node-1', 'edit', 'Updated');
        expect(messageCommands.mutateChatRecord).toHaveBeenNthCalledWith(2, 'node-1', 'delete');
    });
});
