import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { luminaWeaveApi, LuminaWeaveAPI, TimelineNode } from '../api';
import { useConversationContextStore } from './useConversationContextStore';

type TimelineGraph = Record<string, TimelineNode>;
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

    const handleRefresh = () => {
        void refreshFromApi();
    };

    const refreshFromApi = async () => {
        const api = apiRef;
        if (!api) return;
        if (refreshPromise) return refreshPromise;

        refreshPromise = Promise.resolve().then(async () => {
            const context = await api.getConversationContext();
            graph.value = { ...(context.timelineGraph as TimelineGraph) };
            activeLeafId.value = context.activeLeafId;
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

        api.on('CONVERSATION_CONTEXT_CHANGED', handleRefresh);
        api.on('CONVERSATION_WORLDLINE_UPDATED', handleRefresh);
        api.on('CONVERSATION_WORLDLINE_SWITCHED', handleRefresh);
        api.on('CONVERSATION_WORLDLINE_ROLLED_BACK', handleRefresh);

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
            apiRef.off('CONVERSATION_CONTEXT_CHANGED', handleRefresh);
            apiRef.off('CONVERSATION_WORLDLINE_UPDATED', handleRefresh);
            apiRef.off('CONVERSATION_WORLDLINE_SWITCHED', handleRefresh);
            apiRef.off('CONVERSATION_WORLDLINE_ROLLED_BACK', handleRefresh);
            apiRef = null;
        }
    };

    const branchFromNode = async (targetNodeId: string) => {
        const api = apiRef ?? luminaWeaveApi;
        await api.branchConversationNode({ targetNodeId });
        await refreshFromApi();
    };

    const rollbackFromNode = async (targetNodeId: string) => {
        const api = apiRef ?? luminaWeaveApi;
        await api.rollbackConversationNode({ targetNodeId });
        await refreshFromApi();
    };

    const switchToNode = async (targetNodeId: string) => {
        const api = apiRef ?? luminaWeaveApi;
        await api.switchConversationNode({ targetNodeId });
        await refreshFromApi();
    };

    const switchSource = async (sourceId: TimelineSourceId) => {
        const api = apiRef ?? luminaWeaveApi;
        await api.switchConversationContext({ sourceId, sessionId: null });
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
