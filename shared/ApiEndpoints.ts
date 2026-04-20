export const API_BASE = {
    LUMINA_WEAVE: '/api/plugins/luminaweave'
};

export const API_ROUTES = {
    SETTINGS: {
        GET: '/settings',
        SAVE: '/settings/save'
    },
    PRESETS: {
        LIST: '/presets',
        GET: (presetId: string) => `/presets/${presetId}`,
        CREATE: '/presets',
        UPDATE: (presetId: string) => `/presets/${presetId}`,
        DELETE: (presetId: string) => `/presets/${presetId}`,
        EXPORT: (presetId: string) => `/presets/${presetId}/export`,
        IMPORT: '/presets/import',
        RESTORE_DEFAULTS: '/presets/restore-defaults'
    },
    PROMPT: {
        COMPILE: '/prompt/compile'
    },
    CHAT: {
        LIST: '/chat',
        GET: (chatId: string) => `/chat/${chatId}`,
        SYNC_STATUS: (chatId: string) => `/chat/${chatId}/sync-status`,
        TRANSACTIONS: (chatId: string) => `/chat/${chatId}/transactions`,
        ROLLBACK_TRANSACTION: (chatId: string, txId: string) => `/chat/${chatId}/transactions/${txId}/rollback`,
        SAVE: (chatId: string) => `/chat/save/${chatId}`,
        PATCH: (chatId: string) => `/chat/${chatId}`,
        SAVE_MESSAGE: (chatId: string, nodeId: string) => `/chat/${chatId}/messages/${nodeId}`,
        DELETE_MESSAGE: (chatId: string, nodeId: string) => `/chat/${chatId}/messages/${nodeId}`
    },
    FORGE: {
        LIST: '/forge/sessions',
        GET: (sessionId: string) => `/forge/sessions/${sessionId}`,
        SAVE: '/forge/sessions',
        UPDATE: (sessionId: string) => `/forge/sessions/${sessionId}`
    },
    CONVERSATION: {
        LIST: '/conversations',
        GET: (id: string) => `/conversations/${id}`,
        SAVE: (id: string) => `/conversations/${id}`,
        MUTATE: (id: string) => `/conversations/${id}`,
        DELETE: (id: string) => `/conversations/${id}`,
        TRANSACTIONS: (id: string) => `/conversations/${id}/transactions`,
        ROLLBACK_TRANSACTION: (id: string, txId: string) => `/conversations/${id}/transactions/${txId}/rollback`
    },
    NEXUS: {
        MODELS: (providerId: string) => `/nexus/models/${providerId}`,
        GENERATE: '/nexus/generate',
        GENERATE_SSE: '/nexus/generate-sse',
        GENERATE_WS: '/nexus/generate-ws',
        STREAM: (chatId: string) => `/nexus/stream/${chatId}`,
        STATUS: (chatId: string) => `/nexus/status/${chatId}`,
        STOP: (chatId: string) => `/nexus/stop/${chatId}`
    }
} as const;

// 通用结构体定义
export interface ChatSavePayload {
    data?: any[];
    transactionContext?: {
        expectedSeq?: number;
        idempotencyKey?: string;
        lastTransactionId?: string;
    };
    [key: string]: any;
}

export interface ChatPatchPayload {
    added?: any[];
    updated?: any[];
    deletedIds?: string[];
    metadata?: any;
    transactionContext?: {
        expectedSeq?: number;
        idempotencyKey?: string;
        lastTransactionId?: string;
    };
}

export const WS_PORT = 3100;
export const WS_URL = (host: string) => `ws://${host}:${WS_PORT}`;
