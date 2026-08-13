import type { LuminaChatMessage } from '@shared/LuminaMessage.js';
import { createSSRApp, defineComponent, h, nextTick, ref } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { describe, expect, it, vi } from 'vitest';
import type { DesktopExperienceRuntime } from '../../../api/services/DesktopExperienceRuntime.js';
import type { ConversationDomainEventListener } from '../../../api/services/ConversationDomainService.js';
import type {
    GenerationDomainEvent,
    GenerationDomainEventListener
} from '../../../api/services/GenerationDomainService.js';
import type {
    CharacterChannelState,
    ConversationTimelineNode,
    ConversationViewContext
} from '../../../types/ConversationContextTypes.js';
import { DesktopModeRuntimeRegistry } from '../../../platform/desktop-mode-runtime/DesktopModeRuntimeRegistry.js';
import { createSurfaceRuntimeContext } from '../../../platform/surface/createSurfaceRuntimeContext.js';
import SurfaceRendererBoundary from '../../../platform/surface/SurfaceRendererBoundary.vue';
import { SurfaceRegistry } from '../../../platform/surface/SurfaceRegistry.js';
import type { SurfaceRendererDefinition } from '../../../platform/surface/types.js';
import {
    CHARACTER_FOCUS_CONTRACT_ID,
    characterFocusContractDefinition,
    characterFocusDesktopModeManifest,
    characterFocusPluginManifest,
    createCharacterFocusSurfaceContext
} from '../index.js';

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

const createCharacterState = (
    characterName: string,
    sessionId: string,
    status: Partial<CharacterChannelState['status']> = {}
): CharacterChannelState => {
    const session = {
        id: sessionId,
        title: `${characterName} conversation`,
        source: 'lumina-server' as const,
        createdAt: 1,
        updatedAt: 1,
        messageCount: 1,
        summary: '',
        previewMessage: '',
        activeLeafId: 'node-1',
        characterId: characterName.toLowerCase(),
        characterName,
        characterAvatarUrl: null,
        sourceId: 'chat' as const,
        characterKey: characterName.toLowerCase(),
        recentHistoryPreview: '',
        stableSessionId: sessionId
    };
    return {
        characterGroups: [{
            key: characterName.toLowerCase(),
            characterId: characterName.toLowerCase(),
            characterName,
            characterAvatarUrl: null,
            characterInitial: characterName.slice(0, 1),
            sessions: [session],
            recentSession: session,
            recentPreview: ''
        }],
        activeSessionId: sessionId,
        selectedViewSessionId: sessionId,
        currentLiveSessionId: sessionId,
        busySessionIds: [],
        expandedCharacterKey: null,
        expandedSessionGroups: {},
        capabilityFlags: {
            supportsCharacterRoster: true,
            supportsCreateSession: true,
            supportsRenameSession: true,
            supportsDeleteSession: true,
            supportsCloseCurrentSession: true,
            supportsNativeOpenSession: true,
            supportsHostHistory: true,
            supportsHostSearch: true,
            supportsFindLastMessage: true,
            supportsStableSessionId: true,
            supportsCurrentWindowInfo: true
        },
        status: {
            kind: 'idle',
            text: '',
            sessionId,
            characterName: '',
            error: null,
            ...status
        }
    };
};

const createConversationContext = (
    sessionId: string,
    messages: LuminaChatMessage[]
): ConversationViewContext => ({
    source: 'chat',
    sessionId,
    activeLeafId: messages.at(-1)?.id || null,
    messages,
    timelineGraph: {},
    focusedMessage: null,
    meta: {
        currentChatSessionId: sessionId,
        selectedChatSessionId: sessionId,
        isLive: true
    }
});

interface RuntimeHarness {
    runtime: DesktopExperienceRuntime;
    characterState: ReturnType<typeof ref<CharacterChannelState>>;
    refreshCharacter: ReturnType<typeof vi.fn>;
    openSession: ReturnType<typeof vi.fn>;
    sendMessage: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    isGenerating: ReturnType<typeof vi.fn>;
    getContext: ReturnType<typeof vi.fn>;
    getMessages: ReturnType<typeof vi.fn>;
    getGraph: ReturnType<typeof vi.fn>;
    unsubscribeConversation: ReturnType<typeof vi.fn>;
    unsubscribeGeneration: ReturnType<typeof vi.fn>;
    emitConversation(): void;
    emitGeneration(event: GenerationDomainEvent): void;
}

const createRuntimeHarness = (): RuntimeHarness => {
    const initialMessages = [createMessage('node-1', 'Initial')];
    const characterState = ref(createCharacterState('Alice', 'session-a'));
    let conversationListener: ConversationDomainEventListener | null = null;
    let generationListener: GenerationDomainEventListener | null = null;
    const unsubscribeConversation = vi.fn();
    const unsubscribeGeneration = vi.fn();
    const refreshCharacter = vi.fn(async () => undefined);
    const openSession = vi.fn(async () => undefined);
    const sendMessage = vi.fn(async () => true);
    const stop = vi.fn(async () => undefined);
    const isGenerating = vi.fn(() => false);
    const getContext = vi.fn(async () => createConversationContext(
        characterState.value.activeSessionId || 'session-a',
        initialMessages
    ));
    const getMessages = vi.fn(async () => initialMessages);
    const getGraph = vi.fn(async () => ({
        'node-1': {
            ...initialMessages[0],
            text: initialMessages[0].mes,
            timestamp: 1
        } satisfies ConversationTimelineNode
    }));

    const runtime = {
        character: {
            state: characterState,
            defaultAvatar: '',
            resolveMessageAvatar: vi.fn(() => ''),
            refresh: refreshCharacter,
            openSession,
            createSession: vi.fn(),
            renameSession: vi.fn(),
            deleteSession: vi.fn(),
            closeCurrentSession: vi.fn(),
            toggleGroup: vi.fn(),
            toggleGroupSessionExpansion: vi.fn(),
            dispose: vi.fn()
        },
        conversation: {
            subscribe: vi.fn((listener: ConversationDomainEventListener) => {
                conversationListener = listener;
                return () => {
                    unsubscribeConversation();
                    conversationListener = null;
                };
            }),
            getContext,
            getMessages
        },
        timeline: { getGraph },
        generation: {
            subscribe: vi.fn((listener: GenerationDomainEventListener) => {
                generationListener = listener;
                return () => {
                    unsubscribeGeneration();
                    generationListener = null;
                };
            }),
            sendMessage,
            stop,
            isGenerating
        }
    } as unknown as DesktopExperienceRuntime;

    return {
        runtime,
        characterState,
        refreshCharacter,
        openSession,
        sendMessage,
        stop,
        isGenerating,
        getContext,
        getMessages,
        getGraph,
        unsubscribeConversation,
        unsubscribeGeneration,
        emitConversation: () => conversationListener?.({
            type: 'context_changed',
            context: createConversationContext('session-a', initialMessages)
        }),
        emitGeneration: event => generationListener?.(event)
    };
};

const createRegisteredExample = () => {
    const surfaces = new SurfaceRegistry();
    const renderer = characterFocusPluginManifest.businessRenderers?.[CHARACTER_FOCUS_CONTRACT_ID];
    if (!renderer) {
        throw new Error('Character focus example renderer is missing');
    }
    const normalizedRenderer: SurfaceRendererDefinition<typeof CHARACTER_FOCUS_CONTRACT_ID> = {
        ...renderer,
        ownerId: characterFocusPluginManifest.id,
        kind: 'plugin-business'
    };
    surfaces.registerBatch({
        contracts: [characterFocusContractDefinition],
        businessRenderers: [normalizedRenderer]
    });
    return { surfaces, renderer: normalizedRenderer };
};

const createDeferred = <T>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(next => {
        resolve = next;
    });
    return { promise, resolve };
};

describe('Desktop Experience extension examples', () => {
    it('preflights the declarative desktop composition against an isolated registry', () => {
        const { surfaces } = createRegisteredExample();
        const modes = new DesktopModeRuntimeRegistry(surfaces);

        modes.register({
            manifest: characterFocusDesktopModeManifest,
            id: characterFocusDesktopModeManifest.id,
            name: characterFocusDesktopModeManifest.name,
            shellKind: characterFocusDesktopModeManifest.shell.kind,
            navigationModel: { id: `${characterFocusDesktopModeManifest.id}.navigation` },
            interactionPolicy: { id: `${characterFocusDesktopModeManifest.id}.policy` }
        });

        expect(modes.resolveComposition(characterFocusDesktopModeManifest.id, 'desktop')).toMatchObject({
            kind: 'group',
            children: [
                { kind: 'surface', contractId: CHARACTER_FOCUS_CONTRACT_ID },
                { kind: 'activity-slot' }
            ]
        });
        expect(surfaces.resolve({
            contractId: CHARACTER_FOCUS_CONTRACT_ID,
            desktopModeId: characterFocusDesktopModeManifest.id
        }).source).toBe('plugin-business');
    });

    it('rejects unknown contract input fields', () => {
        const { surfaces } = createRegisteredExample();

        expect(() => surfaces.parseInput(CHARACTER_FOCUS_CONTRACT_ID, {
            title: 'Current character',
            unexpected: true
        })).toThrow('[SurfaceRegistry] Invalid input for surface contract: example.characterFocus');
    });

    it('updates the renderer snapshot when the current character changes', async () => {
        const harness = createRuntimeHarness();
        const values = createCharacterFocusSurfaceContext({
            input: { title: 'Current character' },
            runtime: harness.runtime,
            onDispose: vi.fn()
        });

        await vi.waitFor(() => {
            expect(values.state.snapshot.value.characterName).toBe('Alice');
            expect(values.state.snapshot.value.messages).toHaveLength(1);
            expect(Object.keys(values.state.snapshot.value.timeline)).toEqual(['node-1']);
        });

        harness.characterState.value = createCharacterState('Beatrice', 'session-b');
        await nextTick();

        await vi.waitFor(() => {
            expect(values.state.snapshot.value.characterName).toBe('Beatrice');
            expect(values.state.snapshot.value.sessionId).toBe('session-b');
        });
    });

    it('does not combine a non-chat conversation with an expanded chat character', async () => {
        const harness = createRuntimeHarness();
        const values = createCharacterFocusSurfaceContext({
            input: { title: 'Current character' },
            runtime: harness.runtime,
            onDispose: vi.fn()
        });
        await vi.waitFor(() => expect(values.state.snapshot.value.messages).toHaveLength(1));
        const forgeMessages = [createMessage('forge-node', 'Forge')];
        harness.getContext.mockResolvedValue({
            ...createConversationContext('forge-session', forgeMessages),
            source: 'forge'
        });
        harness.getMessages.mockResolvedValue(forgeMessages);
        harness.characterState.value = {
            ...createCharacterState('Alice', 'session-a'),
            activeSessionId: null,
            selectedViewSessionId: 'forge-session',
            expandedCharacterKey: 'alice'
        };
        await nextTick();

        await vi.waitFor(() => {
            expect(values.state.snapshot.value.conversation?.source).toBe('forge');
            expect(values.state.snapshot.value.sessionId).toBe('forge-session');
        });
        expect(values.state.snapshot.value.characterName).toBe('');
        expect(values.state.snapshot.value.availableSessions).toEqual([]);
    });

    it('maps refresh, open, send and stop intents to typed runtime capabilities', async () => {
        const harness = createRuntimeHarness();
        const values = createCharacterFocusSurfaceContext({
            input: { title: 'Current character' },
            runtime: harness.runtime,
            onDispose: vi.fn()
        });

        await values.intents.refresh();
        await values.intents.openSession('session-b');
        await values.intents.sendMessage('Hello');
        await values.intents.stopGeneration();

        expect(harness.refreshCharacter).toHaveBeenCalledTimes(1);
        expect(harness.openSession).toHaveBeenCalledWith('session-b');
        expect(harness.sendMessage).toHaveBeenCalledWith('Hello');
        expect(harness.stop).toHaveBeenCalledTimes(1);
    });

    it('projects generation updates without reloading the conversation for every stream chunk', async () => {
        const harness = createRuntimeHarness();
        const values = createCharacterFocusSurfaceContext({
            input: { title: 'Current character' },
            runtime: harness.runtime,
            onDispose: vi.fn()
        });
        await vi.waitFor(() => expect(values.state.snapshot.value.messages).toHaveLength(1));
        const contextCalls = harness.getContext.mock.calls.length;
        const messageCalls = harness.getMessages.mock.calls.length;
        const graphCalls = harness.getGraph.mock.calls.length;

        harness.emitGeneration({
            type: 'updated',
            state: {
                processed: 'Hello',
                text: 'Hello',
                filteredCount: 0
            }
        });
        await nextTick();

        expect(values.state.snapshot.value.isGenerating).toBe(true);
        expect(values.state.snapshot.value.loading).toBe(false);
        expect(harness.getContext).toHaveBeenCalledTimes(contextCalls);
        expect(harness.getMessages).toHaveBeenCalledTimes(messageCalls);
        expect(harness.getGraph).toHaveBeenCalledTimes(graphCalls);
    });

    it('keeps a failed generation terminal when the runtime flag is stale', async () => {
        const harness = createRuntimeHarness();
        const values = createCharacterFocusSurfaceContext({
            input: { title: 'Current character' },
            runtime: harness.runtime,
            onDispose: vi.fn()
        });
        await vi.waitFor(() => expect(values.state.snapshot.value.messages).toHaveLength(1));
        harness.isGenerating.mockReturnValue(true);

        harness.emitGeneration({
            type: 'failed',
            message: 'Generation failed',
            status: 'error'
        });

        await vi.waitFor(() => {
            expect(values.state.snapshot.value.loading).toBe(false);
            expect(values.state.snapshot.value.isGenerating).toBe(false);
        });
    });

    it('projects character refresh failures reported through character state', async () => {
        const harness = createRuntimeHarness();
        const values = createCharacterFocusSurfaceContext({
            input: { title: 'Current character' },
            runtime: harness.runtime,
            onDispose: vi.fn()
        });
        await vi.waitFor(() => expect(values.state.snapshot.value.messages).toHaveLength(1));
        harness.refreshCharacter.mockImplementationOnce(async () => {
            harness.characterState.value = createCharacterState('Alice', 'session-a', {
                kind: 'error',
                text: 'Character refresh failed',
                error: 'refresh unavailable'
            });
        });

        await values.intents.refresh();

        expect(values.state.snapshot.value.characterName).toBe('Alice');
        expect(values.state.snapshot.value.error).toBe('refresh unavailable');
    });

    it('keeps the newest conversation snapshot when an older refresh completes later', async () => {
        const harness = createRuntimeHarness();
        const { renderer } = createRegisteredExample();
        const surface = createSurfaceRuntimeContext({
            contractId: CHARACTER_FOCUS_CONTRACT_ID,
            input: { title: 'Current character' },
            renderer,
            runtime: harness.runtime,
            theme: { desktopModeId: characterFocusDesktopModeManifest.id }
        });
        await vi.waitFor(() => expect(surface.context.state.snapshot.value.messages).toHaveLength(1));
        const olderMessages = createDeferred<LuminaChatMessage[]>();
        harness.getMessages
            .mockReturnValueOnce(olderMessages.promise)
            .mockResolvedValueOnce([createMessage('node-new', 'Newest')]);

        harness.emitConversation();
        await Promise.resolve();
        harness.emitConversation();
        await vi.waitFor(() => {
            expect(surface.context.state.snapshot.value.messages[0]?.mes).toBe('Newest');
        });
        olderMessages.resolve([createMessage('node-old', 'Older')]);
        await Promise.resolve();
        await nextTick();

        expect(surface.context.state.snapshot.value.messages[0]?.mes).toBe('Newest');
        surface.dispose();
    });

    it('cancels subscriptions and ignores pending async state after disposal', async () => {
        const harness = createRuntimeHarness();
        const { renderer } = createRegisteredExample();
        const surface = createSurfaceRuntimeContext({
            contractId: CHARACTER_FOCUS_CONTRACT_ID,
            input: { title: 'Current character' },
            renderer,
            runtime: harness.runtime,
            theme: { desktopModeId: characterFocusDesktopModeManifest.id }
        });
        await vi.waitFor(() => {
            expect(surface.context.state.snapshot.value.characterName).toBe('Alice');
            expect(surface.context.state.snapshot.value.messages[0]?.mes).toBe('Initial');
        });
        const pendingMessages = createDeferred<LuminaChatMessage[]>();
        harness.getMessages.mockReturnValueOnce(pendingMessages.promise);

        harness.emitConversation();
        await Promise.resolve();
        surface.dispose();
        pendingMessages.resolve([createMessage('node-2', 'Late')]);
        await Promise.resolve();
        await nextTick();

        expect(harness.unsubscribeConversation).toHaveBeenCalledTimes(1);
        expect(harness.unsubscribeGeneration).toHaveBeenCalledTimes(1);
        expect(surface.context.state.snapshot.value.messages[0]?.mes).toBe('Initial');
        const contextCalls = harness.getContext.mock.calls.length;
        harness.characterState.value = createCharacterState('Disposed', 'session-z');
        harness.emitGeneration({ type: 'started' });
        await nextTick();
        expect(harness.getContext).toHaveBeenCalledTimes(contextCalls);
        expect(surface.context.state.snapshot.value.characterName).toBe('Alice');
    });

    it('keeps a sibling surface renderable when a trusted renderer throws', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const ThrowingRenderer = defineComponent({
            setup(): never {
                throw new Error('example renderer failed');
            }
        });
        const app = createSSRApp(defineComponent({
            render() {
                return h('main', [
                    h(SurfaceRendererBoundary, {
                        contractId: CHARACTER_FOCUS_CONTRACT_ID,
                        ownerId: characterFocusPluginManifest.id
                    }, { default: () => h(ThrowingRenderer) }),
                    h('div', { id: 'sibling-surface' }, 'Sibling surface')
                ]);
            }
        }));

        const html = await renderToString(app);

        expect(html).toContain('id="sibling-surface"');
        expect(consoleError).toHaveBeenCalledWith(
            '[SurfaceRuntime] Renderer failed',
            expect.objectContaining({ contractId: CHARACTER_FOCUS_CONTRACT_ID })
        );
        consoleError.mockRestore();
    });
});
