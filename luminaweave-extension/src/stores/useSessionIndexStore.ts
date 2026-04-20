import { defineStore } from 'pinia';
import { ref } from 'vue';
import { chatSessionIndexService } from '../api/core/ChatSessionIndexService.js';
import { forgeSessionRepository } from '../api/core/ForgeSessionRepository.js';
import { STClient } from '../api/core/st-adapter/STClient.js';
import { lwStorage } from '../api/storage.js';
import type { ChatSessionRef, ForgeWorkspaceSessionRef } from '../types/SessionTypes.js';

export const useSessionIndexStore = defineStore('lumina-session-index', () => {
    const chatSessions = ref<ChatSessionRef[]>([]);
    const forgeSessions = ref<ForgeWorkspaceSessionRef[]>([]);
    const selectedChatSessionId = ref<string | null>(null);
    const selectedForgeSessionId = ref<string | null>(forgeSessionRepository.getActiveSessionId());
    const isLoading = ref(false);

    const refresh = async (): Promise<void> => {
        isLoading.value = true;
        try {
            await forgeSessionRepository.refreshFromServer();
            chatSessions.value = await chatSessionIndexService.listChatSessions();
            forgeSessions.value = forgeSessionRepository.listSessions();
            const currentChatId = STClient.normalizeChatId(lwStorage._getContextIds().chatId);
            const matchedCurrentChat = chatSessions.value.find(chat => chat.id === currentChatId);
            if (matchedCurrentChat) {
                selectedChatSessionId.value = matchedCurrentChat.id;
            } else {
                selectedChatSessionId.value = null;
            }
            if (!selectedForgeSessionId.value && forgeSessions.value.length > 0) {
                selectedForgeSessionId.value = forgeSessions.value[0].id;
            }
        } finally {
            isLoading.value = false;
        }
    };

    const selectChatSession = (id: string | null): void => {
        selectedChatSessionId.value = id;
    };

    const selectForgeSession = (id: string | null): void => {
        selectedForgeSessionId.value = id;
        forgeSessionRepository.setActiveSessionId(id);
    };

    return {
        chatSessions,
        forgeSessions,
        selectedChatSessionId,
        selectedForgeSessionId,
        isLoading,
        refresh,
        selectChatSession,
        selectForgeSession
    };
});
