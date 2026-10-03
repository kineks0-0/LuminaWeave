import type { LuminaChatMessage } from '@shared/LuminaMessage.js';
import { describe, expect, it, vi } from 'vitest';
import type {
    ConversationDomainEvent,
    ConversationDomainEventListener
} from '../../../api/services/ConversationDomainService.js';
import type {
    GenerationDomainEvent,
    GenerationDomainEventListener,
    PromptInspectionEvent,
    PromptInspectionEventListener
} from '../../../api/services/GenerationDomainService.js';
import type {
    ChatPresentationCommand,
    ChatPresentationCommandListener
} from '../../../api/services/ChatPresentationCommandService.js';
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
    let promptInspectionListener: PromptInspectionEventListener | null = null;
    let presentationCommandListener: ChatPresentationCommandListener | null = null;
    const unsubscribeConversation = vi.fn();
    const unsubscribeGeneration = vi.fn();
    const unsubscribePromptInspection = vi.fn();
    const unsubscribePresentationCommands = vi.fn();
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
        getLastPromptPayload: vi.fn(() => null),
        probePrompt: vi.fn(async () => null),
        subscribe: vi.fn((listener: GenerationDomainEventListener) => {
            generationListener = listener;
            return unsubscribeGeneration;
        }),
        subscribePromptInspection: vi.fn((listener: PromptInspectionEventListener) => {
            promptInspectionListener = listener;
            return unsubscribePromptInspection;
        })
    };
    const feedback = {
        confirm: vi.fn(async () => true),
        showToast: vi.fn()
    };
    const activity = {
        subscribeChatPresentationCommands: vi.fn((listener: ChatPresentationCommandListener) => {
            presentationCommandListener = listener;
            return unsubscribePresentationCommands;
        })
    };
    const controller = new ChatApplicationController({
        conversation,
        generation,
        feedback,
        activity
    });

    return {
        controller,
        conversation,
        generation,
        feedback,
        activity,
        unsubscribeConversation,
        unsubscribeGeneration,
        unsubscribePromptInspection,
        unsubscribePresentationCommands,
        emitConversation(event: ConversationDomainEvent): void {
            conversationListener?.(event);
        },
        emitGeneration(event: GenerationDomainEvent): void {
            generationListener?.(event);
        },
        emitPromptInspection(event: PromptInspectionEvent): void {
            promptInspectionListener?.(event);
        },
        emitPresentationCommand(command: ChatPresentationCommand): void {
            presentationCommandListener?.(command);
        }
    };
};

describe('ChatApplicationController', () => {
    const streamState = (processed: string) => ({
        processed,
        text: processed,
        filteredCount: 0,
        pendingText: ''
    });

    it('keeps the finished stream visible until the final message arrives', async () => {
        const userMessage = createMessage('node-1', 'Hello');
        const harness = createHarness(createContext([userMessage]));
        await harness.controller.start();

        harness.emitGeneration({ type: 'started' });
        harness.emitGeneration({ type: 'updated', state: streamState('Final reply') });
        harness.emitGeneration({ type: 'ended', finalText: '' });

        expect(harness.controller.getSnapshot().generation).toMatchObject({
            phase: 'settling',
            isGenerating: false,
            stream: { processed: 'Final reply' }
        });

        harness.emitConversation({ type: 'context_changed', context: createContext([userMessage]) });
        expect(harness.controller.getSnapshot().generation.phase).toBe('settling');

        const reply = { ...createMessage('node-2', 'Final reply'), is_user: false, role: 'assistant' as const };
        harness.emitConversation({ type: 'context_changed', context: createContext([userMessage, reply]) });
        const snapshot = harness.controller.getSnapshot();
        expect(snapshot.messages.map(message => message.id)).toEqual(['node-1', 'node-2']);
        expect(snapshot.generation).toMatchObject({ phase: 'ended', stream: null });
    });

    it('clears a settling stream after a bounded timeout when no message arrives', async () => {
        vi.useFakeTimers();
        try {
            const harness = createHarness();
            await harness.controller.start();
            harness.emitGeneration({ type: 'started' });
            harness.emitGeneration({ type: 'updated', state: streamState('Orphan') });
            harness.emitGeneration({ type: 'ended', finalText: '' });
            expect(harness.controller.getSnapshot().generation.phase).toBe('settling');

            vi.advanceTimersByTime(1600);
            expect(harness.controller.getSnapshot().generation).toMatchObject({ phase: 'ended', stream: null });
        } finally {
            vi.useRealTimers();
        }
    });

    it('ends immediately when the stream produced no visible text', async () => {
        const harness = createHarness();
        await harness.controller.start();
        harness.emitGeneration({ type: 'started' });
        harness.emitGeneration({ type: 'ended', finalText: '' });
        expect(harness.controller.getSnapshot().generation).toMatchObject({ phase: 'ended', stream: null });
    });

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

    it('shares the composer draft and clears it after a successful send', async () => {
        const harness = createHarness();
        await harness.controller.start();

        harness.controller.intents.setComposerDraft('Choice command');
        expect(harness.controller.getSnapshot().composerDraft).toBe('Choice command');

        await expect(harness.controller.intents.sendMessage('Choice command')).resolves.toBe(true);
        expect(harness.controller.getSnapshot().composerDraft).toBe('');

        harness.controller.intents.setComposerDraft('Keep on failure');
        harness.generation.sendMessage.mockResolvedValueOnce(false);
        await expect(harness.controller.intents.sendMessage('Keep on failure')).resolves.toBe(false);
        expect(harness.controller.getSnapshot().composerDraft).toBe('Keep on failure');
    });

    it('projects typed scroll and composer focus commands through revisioned snapshot requests', async () => {
        const harness = createHarness();
        await harness.controller.start();

        harness.emitPresentationCommand({ type: 'scroll_to_bottom', force: true });
        expect(harness.controller.getSnapshot().presentation.scrollRequest).toEqual({
            revision: 1,
            force: true
        });

        harness.emitPresentationCommand({ type: 'focus_composer', text: 'Timeline message' });
        expect(harness.controller.getSnapshot()).toMatchObject({
            composerDraft: 'Timeline message',
            presentation: {
                composerFocusRequest: { revision: 1 }
            }
        });

        harness.emitPresentationCommand({ type: 'focus_composer' });
        expect(harness.controller.getSnapshot()).toMatchObject({
            composerDraft: 'Timeline message',
            presentation: {
                composerFocusRequest: { revision: 2 }
            }
        });
    });

    it('projects prompt inspection events and probes through the shared snapshot', async () => {
        const harness = createHarness();
        await harness.controller.start();
        const initialPromptInspection = Reflect.get(harness.controller.getSnapshot(), 'promptInspection');
        expect(initialPromptInspection).toBeDefined();
        if (!initialPromptInspection) return;

        harness.emitPromptInspection({
            source: 'lumina',
            payload: { messages: [{ role: 'user', content: 'hello' }] }
        });
        const probePrompt = Reflect.get(harness.controller.intents, 'probePrompt');
        expect(typeof probePrompt).toBe('function');
        if (typeof probePrompt !== 'function') return;
        await expect(probePrompt()).resolves.toBe(false);

        expect(harness.controller.getSnapshot().promptInspection).toMatchObject({
            source: 'lumina',
            payload: { messages: [{ role: 'user', content: 'hello' }] },
            isProbing: false,
            errorMessage: ''
        });
        expect(harness.generation.probePrompt).toHaveBeenCalledTimes(1);
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
        expect(harness.unsubscribePromptInspection).toHaveBeenCalledTimes(1);
        expect(harness.unsubscribePresentationCommands).toHaveBeenCalledTimes(1);
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
