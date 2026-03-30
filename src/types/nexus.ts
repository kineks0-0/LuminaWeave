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
    url: string;
    key: string;
}

/**
 * 后端生成轮询状态返回格式
 */
export interface NexusStatusResponse {
    isGenerating: boolean;
    buffer: string;
    rawBuffer?: string;
    status?: 'success' | 'error' | 'aborted';
    errorMessage?: string;
}

/**
 * LLM 生成配置项
 */
export interface GenerateOptions {
    nexusPresetId?: string;
    parentId?: string | null;
    settings?: Record<string, any>;
    signal?: AbortSignal;
    onChunk?: (chunk: string) => void;
    onDone?: (fullText: string) => Promise<void> | void;
    onError?: (error: Error, state?: NexusStatusResponse) => void;
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
