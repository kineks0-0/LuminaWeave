import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { luminaWeaveApi } from '../api';
import type {
    ConversationContextOption,
    ConversationSessionRef,
    ConversationSourceId,
    ConversationViewContext
} from '../types/ConversationContextTypes.js';

type SessionSwitchState = {
    isSwitching: boolean;
    targetSessionId: string | null;
    targetCharacterName: string;
    statusText: string;
    startedAt: number | null;
};

type ChatConversationSessionRef = Extract<ConversationSessionRef, { sourceId: 'chat' }>;
type ForgeConversationSessionRef = Extract<ConversationSessionRef, { sourceId: 'forge' }>;
type ConversationSelectionContext = Pick<
    ConversationViewContext,
    'source' | 'sessionId' | 'activeLeafId' | 'meta'
>;

const EMPTY_CONTEXT: ConversationSelectionContext = {
    source: 'chat',
    sessionId: null,
    activeLeafId: null,
    meta: {
        currentChatSessionId: null,
        isLive: false
    }
};

const projectConversationSelection = (context: ConversationViewContext): ConversationSelectionContext => ({
    source: context.source,
    sessionId: context.sessionId,
    activeLeafId: context.activeLeafId,
    ...(context.meta ? { meta: { ...context.meta } } : {})
});

export const useConversationContextStore = defineStore('lumina-conversation-context', () => {
    const conversationService = luminaWeaveApi.services.conversation;
    const currentContext = ref<ConversationSelectionContext>(EMPTY_CONTEXT);
    const sources = ref<ConversationContextOption[]>([]);
    const chatSessions = ref<ChatConversationSessionRef[]>([]);
    const forgeSessions = ref<ForgeConversationSessionRef[]>([]);
    const selectedViewSessionId = ref<string | null>(null);
    const hasBound = ref(false);
    const isRefreshing = ref(false);
    const sessionSwitchState = ref<SessionSwitchState>({
        isSwitching: false,
        targetSessionId: null,
        targetCharacterName: '',
        statusText: '',
        startedAt: null
    });

    let refreshPromise: Promise<void> | null = null;

    const refreshContext = async (): Promise<void> => {
        const context = await conversationService.getContext();
        currentContext.value = projectConversationSelection(context);
    };

    const refreshSessionOptions = async (): Promise<void> => {
        const [sourceOptions, allSessions] = await Promise.all([
            conversationService.listSources(),
            conversationService.listSessions()
        ]);

        sources.value = sourceOptions;
        chatSessions.value = allSessions.filter((session) => session.sourceId === 'chat');
        forgeSessions.value = allSessions.filter((session) => session.sourceId === 'forge');
    };

    const refreshFromApi = async (): Promise<void> => {
        if (refreshPromise) return refreshPromise;

        isRefreshing.value = true;
        refreshPromise = Promise.all([
            refreshContext(),
            refreshSessionOptions()
        ]).then(() => undefined).finally(() => {
            isRefreshing.value = false;
            refreshPromise = null;
        });

        return refreshPromise;
    };

    const bind = (): void => {
        if (hasBound.value) return;
        hasBound.value = true;

        luminaWeaveApi.on('CONVERSATION_CONTEXT_CHANGED', ({ context }: { context: ConversationViewContext }) => {
            currentContext.value = projectConversationSelection(context);
        });
        luminaWeaveApi.on('CONVERSATION_SESSIONS_UPDATED', ({ sources: nextSources, sessions }: {
            sources: ConversationContextOption[];
            sessions: ConversationSessionRef[];
        }) => {
            sources.value = nextSources;
            chatSessions.value = sessions.filter((session) => session.sourceId === 'chat');
            forgeSessions.value = sessions.filter((session) => session.sourceId === 'forge');
        });
        luminaWeaveApi.on('CONVERSATION_WORLDLINE_UPDATED', ({ context }: { context: ConversationViewContext }) => {
            currentContext.value = projectConversationSelection(context);
        });
        luminaWeaveApi.on('CONVERSATION_WORLDLINE_SWITCHED', ({ context }: { context: ConversationViewContext }) => {
            currentContext.value = projectConversationSelection(context);
        });
        luminaWeaveApi.on('CONVERSATION_WORLDLINE_ROLLED_BACK', ({ context }: { context: ConversationViewContext }) => {
            currentContext.value = projectConversationSelection(context);
        });

        void luminaWeaveApi.waitForReady().then((ready) => {
            if (!ready) return;
            return refreshFromApi();
        });
    };

    const activeSourceId = computed<ConversationSourceId>(() => currentContext.value.source);
    const activeSessionId = computed(() => currentContext.value.sessionId);
    const activeLeafId = computed(() => currentContext.value.activeLeafId);
    const currentChatSessionId = computed(() => {
        return currentContext.value.meta?.currentChatSessionId
            || sources.value.find((source) => source.id === 'chat')?.sessionId
            || null;
    });

    const switchSource = async (sourceId: ConversationSourceId): Promise<void> => {
        selectedViewSessionId.value = null;
        const context = await conversationService.switchContext({
            sourceId,
            sessionId: null
        });
        currentContext.value = projectConversationSelection(context);
    };

    const selectForgeSession = async (id: string | null): Promise<void> => {
        selectedViewSessionId.value = id;
        const context = await conversationService.switchContext({
            sourceId: 'forge',
            sessionId: id
        });
        currentContext.value = projectConversationSelection(context);
    };

    const selectViewSession = async (id: string | null): Promise<void> => {
        if (!id) {
            selectedViewSessionId.value = null;
            const context = await conversationService.switchContext({
                sourceId: 'chat',
                sessionId: null
            });
            currentContext.value = projectConversationSelection(context);
            return;
        }

        selectedViewSessionId.value = id;
        const isForge = forgeSessions.value.some((session) => session.id === id);
        const context = await conversationService.switchContext({
            sourceId: isForge ? 'forge' : 'chat',
            sessionId: id
        });
        currentContext.value = projectConversationSelection(context);
    };

    const syncCurrentChatSelection = (): void => {
        if (!selectedViewSessionId.value && currentContext.value.source === 'chat') {
            void refreshContext();
        }
    };

    const syncFromTab = (tabId: string): void => {
        const nextSource: ConversationSourceId = tabId === 'lumina-forge' ? 'forge' : 'chat';
        if (nextSource === currentContext.value.source && !selectedViewSessionId.value) {
            return;
        }
        selectedViewSessionId.value = null;
        void conversationService.switchContext({
            sourceId: nextSource,
            sessionId: null
        }).then((context) => {
            currentContext.value = projectConversationSelection(context);
        });
    };

    const beginSessionSwitch = (payload: {
        sessionId?: string | null;
        characterName?: string | null;
        statusText?: string | null;
    } = {}): void => {
        const characterName = (payload.characterName || '').trim();
        sessionSwitchState.value = {
            isSwitching: true,
            targetSessionId: payload.sessionId ?? null,
            targetCharacterName: characterName,
            statusText: payload.statusText?.trim() || (characterName
                ? `正在切换到 ${characterName}...`
                : '正在切换聊天...'),
            startedAt: Date.now()
        };
    };

    const updateSessionSwitch = (payload: {
        statusText?: string | null;
        sessionId?: string | null;
        characterName?: string | null;
    } = {}): void => {
        if (!sessionSwitchState.value.isSwitching) {
            return;
        }

        sessionSwitchState.value = {
            ...sessionSwitchState.value,
            targetSessionId: payload.sessionId ?? sessionSwitchState.value.targetSessionId,
            targetCharacterName: payload.characterName?.trim() || sessionSwitchState.value.targetCharacterName,
            statusText: payload.statusText?.trim() || sessionSwitchState.value.statusText
        };
    };

    const endSessionSwitch = (): void => {
        sessionSwitchState.value = {
            isSwitching: false,
            targetSessionId: null,
            targetCharacterName: '',
            statusText: '',
            startedAt: null
        };
    };

    bind();

    return {
        activeSourceId,
        activeSessionId,
        activeLeafId,
        sources,
        chatSessions,
        forgeSessions,
        currentChatSessionId,
        selectedViewSessionId,
        isRefreshing,
        sessionSwitchState,
        refreshFromApi,
        refreshSessionOptions,
        switchSource,
        selectForgeSession,
        selectViewSession,
        syncFromTab,
        syncCurrentChatSelection,
        beginSessionSwitch,
        updateSessionSwitch,
        endSessionSwitch
    };
});
