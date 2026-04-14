import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { luminaWeaveApi } from '../api';
import { useCardMakerStore } from '../plugins/forge/CardMakerStore';
import { LorebookTimelineResolver } from '../api/core/LorebookTimelineResolver';
import { MemoryViewResolver } from '../api/core/MemoryViewResolver';
import type { ResolveMemoryViewParams } from '../api/core/MemoryViewResolver';
import { useConversationContextStore } from './useConversationContextStore';

let hasBoundLorebookListeners = false;
const sharedLorebookRevision = ref(0);

export const useConversationViewStore = defineStore('lumina-conversation-view', () => {
    const forgeStore = useCardMakerStore();
    const contextStore = useConversationContextStore();
    const lorebookManager = luminaWeaveApi.lorebookManager;

    const bumpLorebookRevision = () => {
        sharedLorebookRevision.value += 1;
    };

    if (!hasBoundLorebookListeners) {
        luminaWeaveApi.on('LOREBOOK_SYNCED', bumpLorebookRevision);
        lorebookManager.on('UPDATED', bumpLorebookRevision);
        hasBoundLorebookListeners = true;
    }

    const activeMessages = computed(() => {
        return contextStore.activeMessages;
    });

    const activeLorebookView = computed(() => {
        void sharedLorebookRevision.value;
        const sourceId = contextStore.activeSourceId;
        const activeLeafId = contextStore.activeLeafId;
        const sessionId = contextStore.activeSessionId;
        const selectedBookId = lorebookManager.selectedBook;
        const snapshots = lorebookManager.getSnapshotsForBook(selectedBookId);

        return LorebookTimelineResolver.resolve({
            mode: lorebookManager.versionMode,
            context: {
                bookId: selectedBookId,
                sourceId,
                activeLeafId,
                sessionId
            },
            liveEntries: lorebookManager.entries,
            snapshots,
            pinnedSnapshotKey: lorebookManager.pinnedSnapshotKey,
            manualSnapshotKey: lorebookManager.manualSnapshotKey
        });
    });

    const buildResolveParams = (): ResolveMemoryViewParams => ({
        sourceId: contextStore.activeSourceId,
        sessionId: contextStore.activeSessionId,
        activeLeafId: contextStore.activeLeafId,
        messageCount: activeMessages.value.length,
        lorebook: {
            selectedBookId: lorebookManager.selectedBook,
            resolvedView: activeLorebookView.value
        },
        forge: {
            workspaceTitle: forgeStore.workspaceTitle,
            selectedChatSessionId: forgeStore.selectedChatSessionId,
            selectedChatSnapshotId: forgeStore.selectedChatSnapshotId
        }
    });

    const sessionSummary = computed(() => MemoryViewResolver.buildSessionSummary(buildResolveParams()));

    const memorySnapshot = computed(() => MemoryViewResolver.buildSnapshot(buildResolveParams()));

    return {
        activeMessages,
        activeLorebookView,
        sessionSummary,
        memorySnapshot,
        buildResolveParams
    };
});
