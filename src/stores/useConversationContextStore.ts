import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { luminaWeaveApi } from '../api';
import { lwStorage } from '../api/storage';
import { useCardMakerStore } from '../plugins/forge/CardMakerStore';
import type { LuminaChatMessage } from '../../../shared/LuminaMessage.js';
import type {
    ConversationContext,
    ConversationContextOption,
    ConversationContextSource
} from '../types/ConversationContextTypes.js';
import { useChatStore } from './useChatStore';
import { useSessionIndexStore } from './useSessionIndexStore';

const normalizeChatSessionId = (chatId: string | null | undefined): string | null => {
    if (!chatId || chatId === 'null' || chatId === 'undefined' || chatId === 'default') {
        return null;
    }
    return chatId;
};

export const useConversationContextStore = defineStore('lumina-conversation-context', () => {
    const chatStore = useChatStore();
    const forgeStore = useCardMakerStore();
    const sessionIndexStore = useSessionIndexStore();
    const activeSourceId = ref<ConversationContextSource>('chat');

    const currentChatSessionId = computed(() => {
        const contextChatId = normalizeChatSessionId(lwStorage._getContextIds().chatId);
        return contextChatId || sessionIndexStore.selectedChatSessionId || null;
    });

    const chatTimelineGraph = computed<Record<string, LuminaChatMessage>>(() => {
        return luminaWeaveApi.getTimelineNodes() as Record<string, LuminaChatMessage>;
    });

    const sources = computed<ConversationContextOption[]>(() => [
        {
            id: 'chat',
            label: '剧情演播',
            description: '当前 ST 主聊天',
            count: Object.keys(chatTimelineGraph.value).length,
            sessionId: currentChatSessionId.value,
            activeLeafId: luminaWeaveApi.activeLeafId
        },
        {
            id: 'forge',
            label: '制卡工坊',
            description: 'Forge 工作会话',
            count: Object.keys(forgeStore.timelineGraph).length,
            sessionId: forgeStore.workspaceSessionId || forgeStore.sessionChatId || null,
            activeLeafId: forgeStore.activeLeafId
        }
    ]);

    const activeSessionId = computed(() => {
        return activeSourceId.value === 'forge'
            ? (forgeStore.workspaceSessionId || forgeStore.sessionChatId || null)
            : currentChatSessionId.value;
    });

    const activeLeafId = computed(() => {
        return activeSourceId.value === 'forge'
            ? forgeStore.activeLeafId
            : luminaWeaveApi.activeLeafId;
    });

    const activeMessages = computed(() => {
        return activeSourceId.value === 'forge'
            ? forgeStore.messages
            : chatStore.messages;
    });

    const activeTimelineGraph = computed<Record<string, LuminaChatMessage>>(() => {
        return activeSourceId.value === 'forge'
            ? forgeStore.timelineGraph
            : chatTimelineGraph.value;
    });

    const focusedMessage = computed(() => {
        const leafId = activeLeafId.value;
        if (!leafId) return null;
        return activeMessages.value.find((message: LuminaChatMessage) => message.id === leafId) || null;
    });

    const currentContext = computed<ConversationContext>(() => ({
        source: activeSourceId.value,
        sessionId: activeSessionId.value,
        activeLeafId: activeLeafId.value,
        messages: activeMessages.value,
        timelineGraph: activeTimelineGraph.value,
        focusedMessage: focusedMessage.value
    }));

    const refreshSessionOptions = async (): Promise<void> => {
        await sessionIndexStore.refresh();
        const currentChatId = currentChatSessionId.value;
        if (currentChatId) {
            sessionIndexStore.selectChatSession(currentChatId);
        }
    };

    const switchSource = async (sourceId: ConversationContextSource): Promise<void> => {
        activeSourceId.value = sourceId;
        if (sourceId === 'forge') {
            const selectedForgeId = sessionIndexStore.selectedForgeSessionId;
            if (selectedForgeId && selectedForgeId !== forgeStore.workspaceSessionId) {
                forgeStore.openWorkspaceSession(selectedForgeId);
            }
        } else {
            const currentChatId = currentChatSessionId.value;
            if (currentChatId) {
                sessionIndexStore.selectChatSession(currentChatId);
            }
        }
    };

    const selectForgeSession = async (id: string | null): Promise<void> => {
        sessionIndexStore.selectForgeSession(id);
        if (id && id !== forgeStore.workspaceSessionId) {
            forgeStore.openWorkspaceSession(id);
        }
        activeSourceId.value = 'forge';
    };

    const syncCurrentChatSelection = (): void => {
        const currentChatId = currentChatSessionId.value;
        if (currentChatId) {
            sessionIndexStore.selectChatSession(currentChatId);
        }
    };

    const selectedViewSessionId = ref<string | null>(null);

    const selectViewSession = (id: string | null): void => {
        selectedViewSessionId.value = id;
        if (!id) {
            activeSourceId.value = 'chat';
            return;
        }
        const isForge = sessionIndexStore.forgeSessions.some(s => s.id === id);
        activeSourceId.value = isForge ? 'forge' : 'chat';
        if (isForge) {
            forgeStore.openWorkspaceSession(id);
        } else {
            sessionIndexStore.selectChatSession(id);
        }
    };

    /** 由 App.vue 在 watch(activeMainTab) 中调用，传统模式自动跟随 Tab 切换来源 */
    const syncFromTab = (tabId: string): void => {
        activeSourceId.value = tabId === 'lumina-forge' ? 'forge' : 'chat';
    };

    return {
        activeSourceId,
        activeSessionId,
        activeLeafId,
        activeMessages,
        activeTimelineGraph,
        focusedMessage,
        sources,
        currentChatSessionId,
        currentContext,
        selectedViewSessionId,
        refreshSessionOptions,
        switchSource,
        selectForgeSession,
        selectViewSession,
        syncFromTab,
        syncCurrentChatSelection
    };
});
