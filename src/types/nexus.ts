import { OpenAI } from 'openai';

/**
 * Nexus 生成节点
 */
export interface NexusNode {
    id?: string;
    provider: string; // 'st_current' | 'openai' | 'custom' | ...
    model: string;
    url?: string;
    key?: string;
}

/**
 * Nexus 预设
 */
export interface NexusPreset {
    id: string;
    name?: string;
    nodes: NexusNode[];
}

/**
 * Nexus API 注册定义 (存储在 nexus.apis 中)
 */
export interface NexusAPI {
    id: string;
    name: string;
    type?: 'openai' | 'openai_compatible' | 'anthropic' | 'google';
    url: string;
    key: string;
}

/**
 * 后端生成轮询状态返回格式
 */
export interface NexusStatusResponse {
    isGenerating: boolean;
    generationId?: string | null;
    buffer: string;
    rawBuffer?: string;
    status?: 'idle' | 'running' | 'success' | 'error' | 'aborted';
    errorMessage?: string;
    lastTransactionId?: string;
    activeLeafId?: string | null;
}

/**
 * LLM 生成配置项
 */
export interface GenerateOptions {
    chatId?: string;
    nexusPresetId?: string;
    parentId?: string | null;
    settings?: Record<string, unknown>;
    signal?: AbortSignal;
    onChunk?: (chunk: string, fullText: string) => void;
    onDone?: (fullText: string) => Promise<void> | void;
    onError?: (error: Error, state?: NexusStatusResponse) => void;
    onBackendCommitted?: (info: { lastTransactionId: string; activeLeafId?: string | null; generationId?: string | null }) => Promise<void> | void;
    onActivity?: () => void;
}

/**
 * SillyTavern 预设管理器接口声明 (用于桥接 /scripts/preset-manager.js)
 */
export interface STPresetManagerModule {
    getPresetManager: (type: string) => {
        getAllPresets: () => string[];
        getSelectedPresetName: () => string | null;
        selectPreset: (name: string) => void;
    } | null;
}

/**
 * 展平后的清理后消息格式 (用于 API 传输)
 */
export interface CleanedMessage {
    role: OpenAI.Chat.ChatCompletionRole;
    content: string;
    name?: string;
}
