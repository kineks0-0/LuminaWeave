import { LuminaChatMessage } from '../LuminaMessage.js';
import { TransactionMutationResponse, TransactionQueryResponse } from './TransactionTypes.js';
import type {
    ConversationDocument,
    ConversationListResponse,
    ConversationGetResponse,
    ConversationMutation,
    ConversationMutationResult,
    ConversationDeleteResult
} from '../ConversationTypes.js';

/**
 * 流式处理句柄
 * 无论底层是 SSE、轮询还是 Tauri 事件，都暴露此统一接口
 */
export interface IStreamingHandle {
    /** 检查是否正在进行中 */
    isBusy: () => boolean;
    /** 中止当前流 */
    abort: () => void;
    /** 订阅 Token/Delta */
    onToken: (callback: (token: string) => void) => IStreamingHandle;
    /** 订阅后端事务提交事件 */
    onCommitted: (callback: (data: any) => void) => IStreamingHandle;
    /** 订阅完成事件 */
    onDone: (callback: (data: any) => void) => IStreamingHandle;
    /** 订阅错误事件 */
    onError: (callback: (error: any) => void) => IStreamingHandle;
}

export interface IStreamingCallbacks {
    onToken?: (token: string) => void;
    onCommitted?: (data: any) => void;
    onDone?: (data: any) => void;
    onError?: (error: any) => void;
}

/**
 * 对话服务接口
 */
export interface IChatService {
    listChats(): Promise<any>;
    getChat(chatId: string): Promise<any>;
    saveChat(chatId: string, payload: any): Promise<TransactionMutationResponse>;
    patchChat(chatId: string, payload: any): Promise<TransactionMutationResponse>;
    saveMessage(chatId: string, nodeId: string, message: any): Promise<any>;
    deleteMessage(chatId: string, nodeId: string): Promise<any>;
    getSyncStatus(chatId: string): Promise<any>;
    getTransactions(chatId: string, query?: Record<string, any>): Promise<TransactionQueryResponse>;
    rollbackTransaction(chatId: string, transactionId: string): Promise<TransactionMutationResponse>;
}

/**
 * Nexus 生成服务接口
 */
export interface INexusService {
    generateStream(payload: any): IStreamingHandle;
    attachStream(params: any): IStreamingHandle;
    stop(chatId: string): Promise<void>;
    fetchModels(providerId: string): Promise<any>;
    getStatus(chatId: string): Promise<any>;
}

/**
 * Forge (制卡) 服务接口
 */
export interface IForgeService {
    listSessions(): Promise<any>;
    getSession(sessionId: string): Promise<any>;
    saveSession(session: any): Promise<any>;
    updateSession(sessionId: string, session: any): Promise<any>;
}

/**
 * 统一会话服务接口
 */
export interface IConversationService {
    listConversations(): Promise<ConversationListResponse>;
    getConversation(id: string): Promise<ConversationGetResponse>;
    saveConversation(id: string, document: ConversationDocument): Promise<ConversationMutationResult>;
    mutateConversation(id: string, mutation: ConversationMutation): Promise<ConversationMutationResult>;
    deleteConversation(id: string): Promise<ConversationDeleteResult>;
    getTransactions(id: string, query?: Record<string, any>): Promise<TransactionQueryResponse>;
    rollbackTransaction(id: string, transactionId: string): Promise<TransactionMutationResponse>;
}

/**
 * 设置服务接口
 */
export interface ISettingsService {
    getSettings(): Promise<any>;
    saveSettings(settings: any): Promise<any>;
}

/**
 * 预设服务接口
 */
export interface IPresetService {
    listPresets(): Promise<any>;
    importPreset(payload: { name?: string; blob: any }): Promise<any>;
    exportPreset(presetId: string): Promise<any>;
    restoreDefaults(): Promise<any>;
}

/**
 * 扩展存储服务接口 (针对 TauriTavern 原生扩展存储)
 */
export interface IStoreService {
    getJson(params: { namespace: string; key: string; table?: string }): Promise<any>;
    setJson(params: { namespace: string; key: string; value: any; table?: string }): Promise<void>;
    updateJson(params: { namespace: string; key: string; value: any; table?: string }): Promise<void>;
    deleteJson(params: { namespace: string; key: string; table?: string }): Promise<void>;
    listKeys(params: { namespace: string; table?: string }): Promise<string[]>;
    setBlob(params: { namespace: string; key: string; data: any; table?: string }): Promise<void>;
    getBlob(params: { namespace: string; key: string; table?: string }): Promise<any>;
}

/**
 * 宿主桥接总接口
 */
export interface ILuminaBridge {
    readonly chat: IChatService;
    readonly nexus: INexusService;
    readonly forge: IForgeService;
    readonly conversation: IConversationService;
    readonly settings: ISettingsService;
    readonly presets: IPresetService;
    readonly extensionStore: IStoreService;
}
