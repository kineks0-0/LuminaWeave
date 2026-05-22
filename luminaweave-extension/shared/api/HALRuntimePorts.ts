import { TransactionMutationResponse, TransactionQueryResponse } from './TransactionTypes.js';
import type {
    ConversationDocument,
    ConversationListResponse,
    ConversationGetResponse,
    ConversationMutation,
    ConversationMutationResult,
    ConversationDeleteResult
} from '../ConversationTypes.js';

export type HALRuntimeMode = 'st-plugin-enhanced' | 'tauri-native' | 'standalone-local';

/**
 * Streaming handle shared by HAL runtime implementations.
 */
export interface RuntimeStreamingHandle {
    isBusy: () => boolean;
    abort: () => void;
    onToken: (callback: (token: string) => void) => RuntimeStreamingHandle;
    onCommitted: (callback: (data: any) => void) => RuntimeStreamingHandle;
    onDone: (callback: (data: any) => void) => RuntimeStreamingHandle;
    onError: (callback: (error: any) => void) => RuntimeStreamingHandle;
}

export interface RuntimeStreamingCallbacks {
    onToken?: (token: string) => void;
    onCommitted?: (data: any) => void;
    onDone?: (data: any) => void;
    onError?: (error: any) => void;
}

export interface RuntimeConversationPort {
    listConversations(): Promise<ConversationListResponse>;
    getConversation(id: string): Promise<ConversationGetResponse>;
    saveConversation(id: string, document: ConversationDocument): Promise<ConversationMutationResult>;
    mutateConversation(id: string, mutation: ConversationMutation): Promise<ConversationMutationResult>;
    deleteConversation(id: string): Promise<ConversationDeleteResult>;
    getTransactions(id: string, query?: Record<string, any>): Promise<TransactionQueryResponse>;
    rollbackTransaction(id: string, transactionId: string): Promise<TransactionMutationResponse>;
}

export interface RuntimeGenerationPort {
    generateStream(payload: any): RuntimeStreamingHandle;
    attachStream(params: any): RuntimeStreamingHandle;
    stop(chatId: string): Promise<void>;
    fetchModels(providerId: string): Promise<any>;
    getStatus(chatId: string): Promise<any>;
}

export interface RuntimeSettingsPort {
    getSettings(): Promise<any>;
    saveSettings(settings: any): Promise<any>;
}

export interface RuntimePresetPort {
    listPresets(): Promise<any>;
    importPreset(payload: { name?: string; blob: any }): Promise<any>;
    exportPreset(presetId: string): Promise<any>;
    restoreDefaults(): Promise<any>;
}

export interface RuntimeExtensionStorePort {
    getJson(params: { namespace: string; key: string; table?: string }): Promise<any>;
    setJson(params: { namespace: string; key: string; value: any; table?: string }): Promise<void>;
    updateJson(params: { namespace: string; key: string; value: any; table?: string }): Promise<void>;
    deleteJson(params: { namespace: string; key: string; table?: string }): Promise<void>;
    listKeys(params: { namespace: string; table?: string }): Promise<string[]>;
    setBlob(params: { namespace: string; key: string; data: any; table?: string }): Promise<void>;
    getBlob(params: { namespace: string; key: string; table?: string }): Promise<any>;
}

export interface HALRuntimePorts {
    readonly mode: HALRuntimeMode;
    readonly conversation: RuntimeConversationPort;
    readonly generation: RuntimeGenerationPort;
    readonly settings: RuntimeSettingsPort;
    readonly presets: RuntimePresetPort;
    readonly extensionStore: RuntimeExtensionStorePort;
}
