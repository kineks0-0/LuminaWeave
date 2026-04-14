import { defineStore } from 'pinia';
import { ref } from 'vue';
import { luminaWeaveApi, LuminaWeaveAPI } from '../api';

type ChatEventName =
    | 'CHAT_CHANGED'
    | 'CHAT_UPDATED'
    | 'MESSAGE_RECEIVED'
    | 'MESSAGE_LIST_UPDATED'
    | 'WORLDLINE_SWITCHED'
    | 'WORLDLINE_ROLLED_BACK';

const CHAT_EVENTS: ChatEventName[] = [
    'CHAT_CHANGED',
    'MESSAGE_LIST_UPDATED',
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

    const refreshFromApi = () => {
        const api = apiRef;
        if (!api) return;
        
        // 核心优化：直接从同步快照中获取数据，不再需要 await
        messages.value = api.getProcessedChat();
        isReady.value = true;
    };

    const bind = (api: LuminaWeaveAPI = luminaWeaveApi) => {
        if (hasBound.value) return;

        apiRef = api;
        hasBound.value = true;

        // 核心重构：建立单向数据流 (UDF) 订阅
        // 消息列表现在完全由 API 层的 MessageListManager 推送
        api.on('MESSAGE_LIST_UPDATED', (newList: any[]) => {
            console.log('[useChatStore] 接收到消息列表推送更新，节点数:', newList.length);
            messages.value = newList;
            isReady.value = true;
        });

        // 辅助事件：当对话发生剧烈变化（如加载新对话）时执行一次显式重刷
        api.on('CHAT_CHANGED', () => refreshFromApi());
        api.on('WORLDLINE_SWITCHED', () => refreshFromApi());

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
