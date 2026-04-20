import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { luminaWeaveApi } from '../api';
import type {
    ConversationContext,
    ConversationContextOption,
    ConversationSessionRef,
    ConversationSourceId
} from '../types/ConversationContextTypes.js';

type SessionSwitchState = {
    isSwitching: boolean;
    targetSessionId: string | null;
    targetCharacterName: string;
    statusText: string;
    startedAt: number | null;
};

const EMPTY_CONTEXT: ConversationContext = {
    source: 'chat',
    sessionId: null,
    activeLeafId: null,
    messages: [],
    timelineGraph: {},
    focusedMessage: null,
    meta: {
        currentChatSessionId: null,
        isLive: false
    }
};

export const useConversationContextStore = defineStore('lumina-conversation-context', () => {
    const currentContext = ref<ConversationContext>(EMPTY_CONTEXT);
    const sources = ref<ConversationContextOption[]>([]);
    const chatSessions = ref<ConversationSessionRef[]>([]);
    const forgeSessions = ref<ConversationSessionRef[]>([]);
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
        const context = await luminaWeaveApi.getConversationContext();
        currentContext.value = context;
    };

    const refreshSessionOptions = async (): Promise<void> => {
        const [sourceOptions, allSessions] = await Promise.all([
            luminaWeaveApi.listConversationSources(),
            luminaWeaveApi.listConversationSessions()
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

        luminaWeaveApi.on('CONVERSATION_CONTEXT_CHANGED', ({ context }: { context: ConversationContext }) => {
            currentContext.value = context;
        });
        luminaWeaveApi.on('CONVERSATION_SESSIONS_UPDATED', ({ sources: nextSources, sessions }: {
            sources: ConversationContextOption[];
            sessions: ConversationSessionRef[];
        }) => {
            sources.value = nextSources;
            chatSessions.value = sessions.filter((session) => session.sourceId === 'chat');
            forgeSessions.value = sessions.filter((session) => session.sourceId === 'forge');
        });
        luminaWeaveApi.on('CONVERSATION_WORLDLINE_UPDATED', ({ context }: { context: ConversationContext }) => {
            currentContext.value = context;
        });
        luminaWeaveApi.on('CONVERSATION_WORLDLINE_SWITCHED', ({ context }: { context: ConversationContext }) => {
            currentContext.value = context;
        });
        luminaWeaveApi.on('CONVERSATION_WORLDLINE_ROLLED_BACK', ({ context }: { context: ConversationContext }) => {
            currentContext.value = context;
        });

        void luminaWeaveApi.waitForReady().then((ready) => {
            if (!ready) return;
            return refreshFromApi();
        });
    };

    const activeSourceId = computed<ConversationSourceId>(() => currentContext.value.source);
    const activeSessionId = computed(() => currentContext.value.sessionId);
    const activeLeafId = computed(() => currentContext.value.activeLeafId);
    const activeMessages = computed(() => currentContext.value.messages);
    const activeTimelineGraph = computed(() => currentContext.value.timelineGraph);
    const focusedMessage = computed(() => currentContext.value.focusedMessage);
    const currentChatSessionId = computed(() => {
        return currentContext.value.meta?.currentChatSessionId
            || sources.value.find((source) => source.id === 'chat')?.sessionId
            || null;
    });

    const switchSource = async (sourceId: ConversationSourceId): Promise<void> => {
        selectedViewSessionId.value = null;
        currentContext.value = await luminaWeaveApi.switchConversationContext({
            sourceId,
            sessionId: null
        });
    };

    const selectForgeSession = async (id: string | null): Promise<void> => {
        selectedViewSessionId.value = id;
        currentContext.value = await luminaWeaveApi.switchConversationContext({
            sourceId: 'forge',
            sessionId: id
        });
    };

    const selectViewSession = async (id: string | null): Promise<void> => {
        if (!id) {
            selectedViewSessionId.value = null;
            currentContext.value = await luminaWeaveApi.switchConversationContext({
                sourceId: 'chat',
                sessionId: null
            });
            return;
        }

        selectedViewSessionId.value = id;
        const isForge = forgeSessions.value.some((session) => session.id === id);
        currentContext.value = await luminaWeaveApi.switchConversationContext({
            sourceId: isForge ? 'forge' : 'chat',
            sessionId: id
        });
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
        void luminaWeaveApi.switchConversationContext({
            sourceId: nextSource,
            sessionId: null
        }).then((context) => {
            currentContext.value = context;
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
        activeMessages,
        activeTimelineGraph,
        focusedMessage,
        sources,
        chatSessions,
        forgeSessions,
        currentChatSessionId,
        currentContext,
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
