import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { chatSessionIndexService } from '../api/core/conversation/ChatSessionIndexService.js';
import { forgeSessionRepository } from '../api/core/forge/project/ForgeSessionRepository.js';
import { STClient } from '../api/core/host-drivers/st/STClient.js';
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

    const getForgeProjectId = (session: ForgeWorkspaceSessionRef): string => session.forgeProjectId || session.id;
    const toForgeProjectRef = (session: ForgeWorkspaceSessionRef): ForgeWorkspaceSessionRef => ({
        ...session,
        title: session.projectTitle || session.title
    });

    const forgeProjects = computed<ForgeWorkspaceSessionRef[]>(() => {
        const byProject = new Map<string, ForgeWorkspaceSessionRef>();
        forgeSessions.value.forEach((session) => {
            const projectId = getForgeProjectId(session);
            const existing = byProject.get(projectId);
            if (!existing || session.updatedAt > existing.updatedAt) {
                byProject.set(projectId, toForgeProjectRef(session));
            } else if (session.projectTitle && !existing.projectTitle) {
                byProject.set(projectId, {
                    ...existing,
                    projectTitle: session.projectTitle,
                    title: session.projectTitle
                });
            }
        });
        return Array.from(byProject.values()).sort((a, b) => b.updatedAt - a.updatedAt);
    });

    const selectedForgeProjectId = computed(() => {
        const selected = forgeSessions.value.find((session) => session.id === selectedForgeSessionId.value);
        return selected ? getForgeProjectId(selected) : getForgeProjectId(forgeProjects.value[0] || ({ id: '' } as ForgeWorkspaceSessionRef)) || null;
    });

    const getForgeProjectThreads = (projectId: string | null): ForgeWorkspaceSessionRef[] => {
        if (!projectId) return [];
        return forgeSessions.value
            .filter((session) => getForgeProjectId(session) === projectId)
            .sort((a, b) => b.updatedAt - a.updatedAt);
    };

    const selectedForgeProjectThreads = computed(() => getForgeProjectThreads(selectedForgeProjectId.value));

    const createForgeProjectThread = async (projectId: string, title?: string) => {
        const created = await forgeSessionRepository.createThread(projectId, { title });
        selectForgeSession(created.id);
        await refresh();
        return created;
    };

    const renameForgeProject = async (projectId: string, title: string): Promise<boolean> => {
        const renamed = await forgeSessionRepository.renameProject(projectId, title);
        await refresh();
        return renamed;
    };

    const renameForgeThread = async (id: string, title: string): Promise<boolean> => {
        const renamed = await forgeSessionRepository.renameThread(id, title);
        await refresh();
        return Boolean(renamed);
    };

    const deleteForgeThread = async (id: string): Promise<boolean> => {
        const selectedProjectBeforeDelete = selectedForgeProjectId.value;
        const wasSelected = selectedForgeSessionId.value === id;
        const deleted = await forgeSessionRepository.deleteThread(id);
        await refresh();
        if (deleted && wasSelected) {
            const nextThread = getForgeProjectThreads(selectedProjectBeforeDelete).find((thread) => thread.id !== id)
                || forgeSessions.value.find((thread) => thread.id !== id)
                || null;
            selectForgeSession(nextThread?.id ?? null);
        }
        return deleted;
    };

    const deleteForgeProject = async (projectId: string): Promise<boolean> => {
        const selectedWasInProject = selectedForgeProjectId.value === projectId;
        const deleted = await forgeSessionRepository.deleteProject(projectId);
        await refresh();
        if (selectedWasInProject) {
            selectForgeSession(forgeSessions.value[0]?.id ?? null);
        }
        return deleted;
    };

    return {
        chatSessions,
        forgeSessions,
        forgeProjects,
        selectedChatSessionId,
        selectedForgeSessionId,
        selectedForgeProjectId,
        selectedForgeProjectThreads,
        isLoading,
        refresh,
        selectChatSession,
        selectForgeSession,
        getForgeProjectThreads,
        createForgeProjectThread,
        renameForgeProject,
        renameForgeThread,
        deleteForgeThread,
        deleteForgeProject
    };
});
