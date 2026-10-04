import { ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { ConversationDomainService } from '../ConversationDomainService.js';
import { DesktopActivityRuntime, DesktopExperienceRuntime, DesktopTimelineRuntime } from '../DesktopExperienceRuntime.js';
import { GenerationDomainService } from '../GenerationDomainService.js';
import type { CharacterChannelState } from '../../../types/ConversationContextTypes.js';

const createCharacterState = (): CharacterChannelState => ({
    characterGroups: [],
    activeSessionId: null,
    selectedViewSessionId: null,
    currentLiveSessionId: null,
    busySessionIds: [],
    expandedCharacterKey: null,
    expandedSessionGroups: {},
    capabilityFlags: {
        supportsCharacterRoster: false,
        supportsCreateSession: false,
        supportsRenameSession: false,
        supportsDeleteSession: false,
        supportsCloseCurrentSession: false,
        supportsNativeOpenSession: false,
        supportsHostHistory: false,
        supportsHostSearch: false,
        supportsFindLastMessage: false,
        supportsStableSessionId: false,
        supportsCurrentWindowInfo: false,
        supportsCharacterImport: false
    },
    status: { kind: 'idle', text: '', sessionId: null, characterName: '', error: null }
});

const createConversation = (): ConversationDomainService => new ConversationDomainService({
    listConversationSources: vi.fn(async () => []),
    listConversationSessions: vi.fn(async () => []),
    getConversationContext: vi.fn(async () => ({
        source: 'chat',
        sessionId: null,
        activeLeafId: null,
        messages: [],
        timelineGraph: {},
        focusedMessage: null
    })),
    getConversationMessages: vi.fn(async () => []),
    getConversationTimelineGraph: vi.fn(async () => ({ node_1: { id: 'node_1' } })),
    switchConversationContext: vi.fn(),
    createChatSession: vi.fn(),
    renameChatSession: vi.fn(),
    deleteChatSession: vi.fn(),
    switchConversationNode: vi.fn(async () => true),
    branchConversationNode: vi.fn(async () => true),
    rollbackConversationNode: vi.fn(async () => true)
} as never, vi.fn(async () => true), { subscribe: vi.fn(() => vi.fn()) }, {
    mutateChatRecord: vi.fn(async () => ({ success: true }))
});

const createGeneration = (): GenerationDomainService => new GenerationDomainService({
    sendMessage: vi.fn(async () => true),
    regenerateLast: vi.fn(),
    runEditedPrompt: vi.fn(),
    abortGenerate: vi.fn(),
    isGenerating: vi.fn(() => false),
    isSyncing: vi.fn(() => false),
    getLastStreamState: vi.fn(() => null),
    getLastPromptPayload: vi.fn(() => null),
    probePrompt: vi.fn(async () => null),
    subscribePromptInspection: vi.fn(() => vi.fn()),
    subscribe: vi.fn(() => vi.fn())
});

describe('DesktopExperienceRuntime', () => {
    it('exposes domain runtimes and delegates timeline and activity commands', async () => {
        const conversation = createConversation();
        const generation = createGeneration();
        const character = {
            state: ref(createCharacterState()),
            defaultAvatar: '/default.png',
            resolveMessageAvatar: vi.fn(() => '/avatar.png'),
            refresh: vi.fn(async () => undefined),
            openSession: vi.fn(async () => undefined),
            createSession: vi.fn(async () => undefined),
            importCharacterCard: vi.fn(async () => undefined),
            renameSession: vi.fn(async () => undefined),
            deleteSession: vi.fn(async () => undefined),
            duplicateSession: vi.fn(async () => undefined),
            closeCurrentSession: vi.fn(async () => true),
            toggleGroup: vi.fn(),
            toggleGroupSessionExpansion: vi.fn(),
            dispose: vi.fn()
        };
        const launchActivity = vi.fn();
        const confirm = vi.fn(async () => true);
        const showToast = vi.fn();
        const subscribeChatPresentationCommands = vi.fn(() => vi.fn());
        const runtime = new DesktopExperienceRuntime({
            conversation,
            generation,
            character,
            timeline: new DesktopTimelineRuntime(conversation),
            activity: new DesktopActivityRuntime(
                { launchActivity },
                { confirm, showToast },
                { subscribe: subscribeChatPresentationCommands }
            )
        });
        const intent = {
            id: 'chat',
            title: 'Chat',
            role: 'primary' as const,
            target: { kind: 'surface' as const, contractId: 'chat.main' as const },
            activity: { size: 'default' as const, pageType: 'nested' as const }
        };

        await expect(runtime.timeline.getGraph({ sourceId: 'chat' })).resolves.toEqual({
            node_1: { id: 'node_1' }
        });
        runtime.activity.launch(intent);
        const activityConfirm = Reflect.get(runtime.activity, 'confirm');
        const activityShowToast = Reflect.get(runtime.activity, 'showToast');
        expect(typeof activityConfirm).toBe('function');
        expect(typeof activityShowToast).toBe('function');
        if (typeof activityConfirm !== 'function' || typeof activityShowToast !== 'function') return;
        await expect(activityConfirm.call(runtime.activity, '确认操作')).resolves.toBe(true);
        activityShowToast.call(runtime.activity, '操作完成', 'success');
        const unsubscribePresentationCommands = runtime.activity.subscribeChatPresentationCommands(vi.fn());
        unsubscribePresentationCommands();

        expect(runtime.conversation).toBe(conversation);
        expect(runtime.generation).toBe(generation);
        expect(runtime.character).toBe(character);
        expect(launchActivity).toHaveBeenCalledWith(intent);
        expect(confirm).toHaveBeenCalledWith('确认操作');
        expect(showToast).toHaveBeenCalledWith('操作完成', 'success', undefined, 3000);
        expect(subscribeChatPresentationCommands).toHaveBeenCalledTimes(1);
    });
});
