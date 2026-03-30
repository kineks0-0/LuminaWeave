import { defineStore } from 'pinia';
import { ref } from 'vue';
import { luminaWeaveApi, LuminaWeaveAPI } from '../api';

type ChatEventName =
    | 'CHAT_CHANGED'
    | 'CHAT_UPDATED'
    | 'MESSAGE_RECEIVED'
    | 'WORLDLINE_SWITCHED'
    | 'WORLDLINE_ROLLED_BACK';

const CHAT_EVENTS: ChatEventName[] = [
    'CHAT_CHANGED',
    'CHAT_UPDATED',
    'MESSAGE_RECEIVED',
    'WORLDLINE_SWITCHED',
    'WORLDLINE_ROLLED_BACK'
];

export const useChatStore = defineStore('lumina-chat-view-model', () => {
    const messages = ref<any[]>([]);
    const isReady = ref(false);
    const isRefreshing = ref(false);
    const hasBound = ref(false);

    let apiRef: LuminaWeaveAPI | null = null;
    let refreshPromise: Promise<void> | null = null;

    const refreshFromApi = async () => {
        const api = apiRef;
        if (!api) return;
        if (refreshPromise) return refreshPromise;

        refreshPromise = (async () => {
            isRefreshing.value = true;
            try {
                messages.value = await api.getProcessedChat();
                isReady.value = true;
            } finally {
                isRefreshing.value = false;
                refreshPromise = null;
            }
        })();

        return refreshPromise;
    };

    const bind = (api: LuminaWeaveAPI = luminaWeaveApi) => {
        if (hasBound.value) return;

        apiRef = api;
        hasBound.value = true;

        const handleRefresh = () => {
            void refreshFromApi();
        };

        CHAT_EVENTS.forEach(eventName => {
            api.on(eventName, handleRefresh);
        });

        void api.waitForReady().then((ready) => {
            if (!ready) return;
            return refreshFromApi();
        });
    };

    return {
        messages,
        isReady,
        isRefreshing,
        bind,
        refreshFromApi
    };
});
