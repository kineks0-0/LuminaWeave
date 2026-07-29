import type { LuminaChatMessage } from '@shared/LuminaMessage.js';
import { describe, expect, it, vi } from 'vitest';
import type {
    ConversationDomainEvent,
    ConversationDomainEventListener
} from '../../../api/services/ConversationDomainService.js';
import type {
    GenerationDomainEvent,
    GenerationDomainEventListener
} from '../../../api/services/GenerationDomainService.js';
import type { ConversationViewContext } from '../../../types/ConversationContextTypes.js';
import { ChatApplicationController } from '../application/ChatApplicationController.js';

const createMessage = (id: string, text: string): LuminaChatMessage => ({
    id,
    parentId: null,
    name: 'User',
    role: 'user',
    is_user: true,
    mesRaw: text,
    mes: text,
    fingerprint: `fingerprint-${id}`,
    extra: {}
});

const createContext = (
    messages: LuminaChatMessage[] = [],
    isLive = true
): ConversationViewContext => ({
    source: 'chat',
    sessionId: 'chat-1',
    activeLeafId: messages.at(-1)?.id || null,
    messages,
    timelineGraph: {},
    focusedMessage: null,
    meta: {
        currentChatSessionId: isLive ? 'chat-1' : null,
        isLive
    }
});

const createHarness = (initialContext: ConversationViewContext = createContext()) => {
    let conversationListener: ConversationDomainEventListener | null = null;
    let generationListener: GenerationDomainEventListener | null = null;
    const unsubscribeConversation = vi.fn();
    const unsubscribeGeneration = vi.fn();
    const conversation = {
        getContext: vi.fn(async () => initialContext),
        subscribe: vi.fn((listener: ConversationDomainEventListener) => {
            conversationListener = listener;
            return unsubscribeConversation;
        }),
        editMessage: vi.fn(async () => true),
        deleteMessage: vi.fn(async () => true),
        branchNode: vi.fn(async () => true)
    };
    const generation = {
        sendMessage: vi.fn(async () => true),
        regenerateLast: vi.fn(async () => undefined),
        runEditedPrompt: vi.fn(async () => undefined),
        stop: vi.fn(async () => undefined),
        isGenerating: vi.fn(() => false),
        isSyncing: vi.fn(() => false),
        getLastStreamState: vi.fn(() => null),
        subscribe: vi.fn((listener: GenerationDomainEventListener) => {
            generationListener = listener;
            return unsubscribeGeneration;
        })
    };
    const feedback = {
        confirm: vi.fn(async () => true),
        showToast: vi.fn()
    };
    const controller = new ChatApplicationController({
        conversation,
        generation,
        feedback
    });

    return {
        controller,
        conversation,
        generation,
        feedback,
        unsubscribeConversation,
        unsubscribeGeneration,
        emitConversation(event: ConversationDomainEvent): void {
            conversationListener?.(event);
        },
        emitGeneration(event: GenerationDomainEvent): void {
            generationListener?.(event);
        }
    };
};

describe('ChatApplicationController', () => {
    it('projects conversation and generation events through one subscription path', async () => {
        const initialMessage = createMessage('node-1', 'Hello');
        const harness = createHarness(createContext([initialMessage]));
        const listener = vi.fn();
        harness.controller.subscribe(listener);

        await harness.controller.start();
        harness.emitConversation({
            type: 'context_changed',
            context: createContext([initialMessage, createMessage('node-2', 'Updated')])
        });
        harness.emitGeneration({ type: 'started' });
        harness.emitGeneration({
            type: 'updated',
            state: {
                processed: 'partial',
                text: '<Chat_Reply>partial',
                filteredCount: 2,
                pendingText: 'ial'
            }
        });

        const snapshot = harness.controller.getSnapshot();
        expect(snapshot.messages.map(message => message.id)).toEqual(['node-1', 'node-2']);
        expect(snapshot.generation).toMatchObject({
            phase: 'running',
            isGenerating: true,
            stream: {
                processed: 'partial',
                pendingText: 'ial'
            }
        });
        expect(listener).toHaveBeenCalled();
    });

    it('delegates chat commands and prompt inspector intents through domain services', async () => {
        const message = createMessage('node-1', 'Before');
        const harness = createHarness(createContext([message]));
        await harness.controller.start();

        await expect(harness.controller.sendMessage('  hello  ')).resolves.toBe(true);
        await expect(harness.controller.editMessage({ message, index: 0, text: 'After' })).resolves.toBe(true);
        await expect(harness.controller.deleteMessage({ message, index: 0 })).resolves.toBe(true);
        await expect(harness.controller.regenerate()).resolves.toBe(true);
        await expect(harness.controller.branchMessage({ message, index: 0 })).resolves.toBe(true);
        await expect(harness.controller.runEditedPrompt('  custom prompt  ')).resolves.toBe(true);
        await expect(harness.controller.stopGeneration()).resolves.toBe(false);
        harness.generation.isGenerating.mockReturnValue(true);
        await expect(harness.controller.stopGeneration()).resolves.toBe(true);
        harness.controller.togglePromptInspector();

        expect(harness.generation.sendMessage).toHaveBeenCalledWith('hello');
        expect(harness.conversation.editMessage).toHaveBeenCalledWith('node-1', 'After');
        expect(harness.feedback.confirm).toHaveBeenCalledWith(expect.objectContaining({ danger: true }));
        expect(harness.conversation.deleteMessage).toHaveBeenCalledWith('node-1');
        expect(harness.generation.regenerateLast).toHaveBeenCalledTimes(1);
        expect(harness.conversation.branchNode).toHaveBeenCalledWith({
            sourceId: 'chat',
            targetNodeId: 'node-1'
        });
        expect(harness.generation.runEditedPrompt).toHaveBeenCalledWith('custom prompt');
        expect(harness.generation.stop).toHaveBeenCalledTimes(1);
        expect(harness.controller.getSnapshot().promptInspectorVisible).toBe(true);
    });

    it('rejects mutating commands while the selected conversation is read-only', async () => {
        const message = createMessage('node-1', 'Archived');
        const harness = createHarness(createContext([message], false));
        await harness.controller.start();

        await expect(harness.controller.sendMessage('hello')).resolves.toBe(false);
        await expect(harness.controller.editMessage({ message, index: 0, text: 'After' })).resolves.toBe(false);
        await expect(harness.controller.deleteMessage({ message, index: 0 })).resolves.toBe(false);
        await expect(harness.controller.regenerate()).resolves.toBe(false);
        await expect(harness.controller.branchMessage({ message, index: 0 })).resolves.toBe(false);

        expect(harness.generation.sendMessage).not.toHaveBeenCalled();
        expect(harness.conversation.editMessage).not.toHaveBeenCalled();
        expect(harness.conversation.deleteMessage).not.toHaveBeenCalled();
        expect(harness.generation.regenerateLast).not.toHaveBeenCalled();
        expect(harness.conversation.branchNode).not.toHaveBeenCalled();
    });

    it('unsubscribes and ignores later events after disposal', async () => {
        const harness = createHarness(createContext([createMessage('node-1', 'Initial')]));
        await harness.controller.start();
        const snapshotBeforeDispose = harness.controller.getSnapshot();

        harness.controller.dispose();
        harness.emitConversation({
            type: 'context_changed',
            context: createContext([createMessage('node-2', 'Ignored')])
        });
        harness.emitGeneration({ type: 'failed', message: 'Ignored failure' });

        expect(harness.unsubscribeConversation).toHaveBeenCalledTimes(1);
        expect(harness.unsubscribeGeneration).toHaveBeenCalledTimes(1);
        expect(harness.controller.getSnapshot()).toBe(snapshotBeforeDispose);
    });

    it('cleans partial subscriptions and allows retry when startup fails', async () => {
        const harness = createHarness(createContext([createMessage('node-1', 'Initial')]));
        harness.generation.subscribe
            .mockImplementationOnce(() => {
                throw new Error('generation subscription failed');
            })
            .mockImplementationOnce((listener: GenerationDomainEventListener) => {
                return harness.unsubscribeGeneration;
            });

        await expect(harness.controller.start()).rejects.toThrow('generation subscription failed');
        expect(harness.unsubscribeConversation).toHaveBeenCalledTimes(1);

        await expect(harness.controller.start()).resolves.toBeUndefined();
        expect(harness.conversation.subscribe).toHaveBeenCalledTimes(2);
        expect(harness.generation.subscribe).toHaveBeenCalledTimes(2);
    });

    it('unsubscribes and allows retry when initial context loading fails', async () => {
        const context = createContext([createMessage('node-1', 'Recovered')]);
        const harness = createHarness(context);
        harness.conversation.getContext
            .mockRejectedValueOnce(new Error('context load failed'))
            .mockResolvedValueOnce(context);

        await expect(harness.controller.start()).rejects.toThrow('context load failed');
        expect(harness.unsubscribeConversation).toHaveBeenCalledTimes(1);
        expect(harness.unsubscribeGeneration).toHaveBeenCalledTimes(1);

        await expect(harness.controller.start()).resolves.toBeUndefined();
        expect(harness.controller.getSnapshot().messages[0]?.mes).toBe('Recovered');
    });

    it('blocks conflicting mutations while generation is running but still allows stop', async () => {
        const message = createMessage('node-1', 'Before');
        const harness = createHarness(createContext([message]));
        await harness.controller.start();
        harness.generation.isGenerating.mockReturnValue(true);

        await expect(harness.controller.sendMessage('next')).resolves.toBe(false);
        await expect(harness.controller.editMessage({ message, index: 0, text: 'After' })).resolves.toBe(false);
        await expect(harness.controller.deleteMessage({ message, index: 0 })).resolves.toBe(false);
        await expect(harness.controller.regenerate()).resolves.toBe(false);
        await expect(harness.controller.branchMessage({ message, index: 0 })).resolves.toBe(false);
        await expect(harness.controller.runEditedPrompt('custom')).resolves.toBe(false);
        await expect(harness.controller.stopGeneration()).resolves.toBe(true);

        expect(harness.conversation.editMessage).not.toHaveBeenCalled();
        expect(harness.conversation.deleteMessage).not.toHaveBeenCalled();
        expect(harness.generation.regenerateLast).not.toHaveBeenCalled();
        expect(harness.conversation.branchNode).not.toHaveBeenCalled();
        expect(harness.generation.runEditedPrompt).not.toHaveBeenCalled();
        expect(harness.generation.stop).toHaveBeenCalledTimes(1);
    });
});
