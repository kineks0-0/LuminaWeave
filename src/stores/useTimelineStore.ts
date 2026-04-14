import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { luminaWeaveApi, LuminaWeaveAPI, TimelineNode } from '../api';
import { useCardMakerStore } from '../plugins/forge/CardMakerStore';
import { useConversationContextStore } from './useConversationContextStore';

type TimelineGraph = Record<string, TimelineNode>;
type TimelineEventName = 'TIMELINE_UPDATED' | 'MESSAGE_RECEIVED' | 'CHAT_CHANGED';
export type TimelineSourceId = 'chat' | 'forge';

export interface TimelineSourceOption {
    id: TimelineSourceId;
    label: string;
    description: string;
    count: number;
    activeLeafId: string | null;
}

export interface TimelineActiveContext {
    sourceId: TimelineSourceId;
    activeLeafId: string | null;
    sessionId: string | null;
}

const TIMELINE_EVENTS: TimelineEventName[] = [
    'TIMELINE_UPDATED',
    'MESSAGE_RECEIVED',
    'CHAT_CHANGED'
];

export const useTimelineStore = defineStore('lumina-timeline-view-model', () => {
    const graph = ref<TimelineGraph>({});
    const activeLeafId = ref<string | null>(null);
    const isReady = ref(false);
    const revision = ref(0);
    const contextStore = useConversationContextStore();
    const activeSourceId = computed<TimelineSourceId>(() => contextStore.activeSourceId);
    const sources = computed<TimelineSourceOption[]>(() => contextStore.sources);
    const activeContext = computed<TimelineActiveContext>(() => {
        return {
            sourceId: contextStore.activeSourceId,
            activeLeafId: contextStore.activeLeafId,
            sessionId: contextStore.activeSessionId
        };
    });

    let apiRef: LuminaWeaveAPI | null = null;
    let bindCount = 0;
    let refreshPromise: Promise<void> | null = null;
    let stopForgeWatcher: (() => void) | null = null;

    const handleRefresh = () => {
        void refreshFromApi();
    };

    const refreshFromApi = async () => {
        const api = apiRef;
        if (!api) return;
        if (refreshPromise) return refreshPromise;

        refreshPromise = Promise.resolve().then(() => {
            if (activeSourceId.value === 'forge') {
                graph.value = { ...(contextStore.activeTimelineGraph as TimelineGraph) };
                activeLeafId.value = contextStore.activeLeafId;
            } else {
                graph.value = { ...(contextStore.activeTimelineGraph as TimelineGraph) };
                activeLeafId.value = contextStore.activeLeafId;
            }

            isReady.value = true;
            revision.value += 1;
        }).finally(() => {
            refreshPromise = null;
        });

        return refreshPromise;
    };

    const bind = (api: LuminaWeaveAPI = luminaWeaveApi) => {
        bindCount++;
        if (bindCount > 1) return;

        apiRef = api;

        TIMELINE_EVENTS.forEach(eventName => {
            api.on(eventName, handleRefresh);
        });

        const forgeStore = useCardMakerStore();
        stopForgeWatcher = watch(
            () => [forgeStore.timelineRevision, forgeStore.sessionChatId, forgeStore.activeLeafId, forgeStore.messageCount],
            () => {
                void refreshFromApi();
            },
            { immediate: true }
        );

        void api.waitForReady().then((ready) => {
            if (!ready) return;
            return refreshFromApi();
        });
    };

    const unbind = () => {
        if (bindCount === 0) return;
        bindCount--;
        if (bindCount > 0) return;

        if (apiRef) {
            TIMELINE_EVENTS.forEach(eventName => {
                apiRef!.off(eventName, handleRefresh);
            });
            apiRef = null;
        }

        stopForgeWatcher?.();
        stopForgeWatcher = null;
    };

    const branchFromNode = async (targetNodeId: string) => {
        const api = apiRef ?? luminaWeaveApi;
        if (activeSourceId.value === 'forge') {
            await useCardMakerStore().branchFromNode(targetNodeId);
        } else {
            await api.branchFromNode(targetNodeId);
        }
        await refreshFromApi();
    };

    const rollbackFromNode = async (targetNodeId: string) => {
        const api = apiRef ?? luminaWeaveApi;
        if (activeSourceId.value === 'forge') {
            await useCardMakerStore().rollbackFromNode(targetNodeId);
        } else {
            await api.rollbackFromNode(targetNodeId);
        }
        await refreshFromApi();
    };

    const switchToNode = async (targetNodeId: string) => {
        const api = apiRef ?? luminaWeaveApi;
        if (activeSourceId.value === 'forge') {
            useCardMakerStore().switchToNode(targetNodeId);
        } else {
            api.activeLeafId = targetNodeId;
        }
        await refreshFromApi();
    };

    const switchSource = async (sourceId: TimelineSourceId) => {
        await contextStore.switchSource(sourceId);
        await refreshFromApi();
    };

    return {
        graph,
        activeLeafId,
        isReady,
        revision,
        activeSourceId,
        sources,
        activeContext,
        bind,
        unbind,
        refreshFromApi,
        branchFromNode,
        rollbackFromNode,
        switchToNode,
        switchSource
    };
});
