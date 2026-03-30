import { defineStore } from 'pinia';
import { ref } from 'vue';
import { luminaWeaveApi, LuminaWeaveAPI, TimelineNode } from '../api';

type TimelineGraph = Record<string, TimelineNode>;
type TimelineEventName = 'TIMELINE_UPDATED' | 'MESSAGE_RECEIVED' | 'CHAT_CHANGED';

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

        refreshPromise = Promise.resolve().then(() => {
            graph.value = { ...(api.getTimelineNodes() as TimelineGraph) };
            activeLeafId.value = api.activeLeafId;
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
    };

    const branchFromNode = async (targetNodeId: string) => {
        const api = apiRef ?? luminaWeaveApi;
        await api.branchFromNode(targetNodeId);
        await refreshFromApi();
    };

    const rollbackFromNode = async (targetNodeId: string) => {
        const api = apiRef ?? luminaWeaveApi;
        await api.rollbackFromNode(targetNodeId);
        await refreshFromApi();
    };

    return {
        graph,
        activeLeafId,
        isReady,
        revision,
        bind,
        unbind,
        refreshFromApi,
        branchFromNode,
        rollbackFromNode
    };
});
