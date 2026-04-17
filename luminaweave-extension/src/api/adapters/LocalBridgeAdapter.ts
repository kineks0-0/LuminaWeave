import { 
    ILuminaBridge, 
    IStreamingHandle, 
    IChatService, 
    INexusService, 
    IForgeService, 
    IConversationService,
    ISettingsService, 
    IPresetService,
    IStoreService,
    IStreamingCallbacks
} from '../../../../shared/api/IBridge.js';
import { lwStorage } from '../storage.js';
import { NexusGenerationFlow, PersistenceDelegate } from '../../../../shared/api/NexusGenerationFlow.js';
import { BaseXMLInterceptor } from '../../../../shared/BaseXMLInterceptor.js';
import { promptBuilder } from '../core/PromptBuilder.js';
import { OpenAIProvider } from '../../../../shared/api/llm/OpenAIProvider.js';
import { LLMMessage } from '../../../../shared/api/llm/ILLMProvider.js';
import { TransactionMutationResponse } from '../../../../shared/api/TransactionTypes.js';
import type { ConversationDocument, ConversationMutation } from '../../../../shared/ConversationTypes.js';
import { createEmptyConversationDocument } from '../../../../shared/ConversationTypes.js';
import { applyConversationMutation } from '../../../../shared/ConversationReducer.js';
import { migrateLegacyChatArray, migrateLegacyForgeSession } from '../../../../shared/ConversationMigration.js';
import { resolveConversationSummary } from '../../../../shared/ConversationSummaryResolver.js';

/**
 * 离线/本地桥接适配器
 * 当后端服务不可用时，降级到纯前端运行模式。
 * 使用 localStorage 进行持久化，并模拟生成响应。
 */
export class LocalBridgeAdapter implements ILuminaBridge {
    public readonly chat: IChatService;
    public readonly nexus: INexusService;
    public readonly forge: IForgeService;
    public readonly conversation: IConversationService;
    public readonly settings: ISettingsService;
    public readonly presets: IPresetService;
    public readonly extensionStore: IStoreService;

    private static readonly CONVERSATION_KEY = 'lumina_conversations';

    private readConversations(): ConversationDocument[] {
        const unified = lwStorage.get(LocalBridgeAdapter.CONVERSATION_KEY, null, 'Global');
        if (Array.isArray(unified)) {
            return unified;
        }

        const migrated: ConversationDocument[] = [];
        const legacyChats = lwStorage.get('lumina-chats', [], 'Global');
        if (Array.isArray(legacyChats)) {
            for (const entry of legacyChats) {
                if (entry?.id && Array.isArray(entry?.data)) {
                    migrated.push(migrateLegacyChatArray(entry.id, entry.data));
                }
            }
        }

        const legacyForgeSessions = lwStorage.get('lumina-forge.sessions', [], 'Global');
        if (Array.isArray(legacyForgeSessions)) {
            for (const session of legacyForgeSessions) {
                if (session?.id) {
                    migrated.push(migrateLegacyForgeSession(session, session?.worldlineNodes));
                }
            }
        }

        if (migrated.length > 0) {
            lwStorage.set(LocalBridgeAdapter.CONVERSATION_KEY, migrated, 'Global');
        }
        return migrated;
    }

    private writeConversations(documents: ConversationDocument[]): void {
        lwStorage.set(LocalBridgeAdapter.CONVERSATION_KEY, documents, 'Global');
    }

    private upsertConversation(document: ConversationDocument): ConversationDocument {
        const documents = this.readConversations();
        const index = documents.findIndex((item) => item.id === document.id);
        const normalized = {
            ...document,
            summary: resolveConversationSummary(document)
        };
        if (index >= 0) {
            documents[index] = normalized;
        } else {
            documents.push(normalized);
        }
        this.writeConversations(documents);
        return normalized;
    }

    private getConversationDocument(id: string): ConversationDocument | null {
        return this.readConversations().find((conversation) => conversation.id === id) || null;
    }

    private commitConversation(id: string, document: ConversationDocument, scope: 'chat.save' | 'chat.patch') {
        const nextSeq = (document.transaction?.lastCommittedSeq || 0) + 1;
        const committed = {
            ...document,
            transaction: {
                lastCommittedSeq: nextSeq,
                lastTransactionId: `local_tx_${Date.now()}`
            },
            updatedAt: Date.now(),
            summary: resolveConversationSummary(document)
        };
        const saved = this.upsertConversation(committed);
        return {
            success: true,
            document: saved,
            summary: resolveConversationSummary(saved),
            lastCommittedSeq: nextSeq,
                    transaction: {
                        id: committed.transaction.lastTransactionId!,
                        chatId: id,
                        seq: nextSeq,
                        status: 'committed' as const,
                        scope: scope,
                payloadDigest: '',
                idempotencyKey: `${scope}:${id}:${nextSeq}`,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                error: null
            }
        };
    }

    private conversationToLegacyChat(document: ConversationDocument): any[] {
        return [{
            type: 'metadata',
            activeLeafId: document.activeLeafId,
            updatedAt: document.updatedAt,
            version: 3.0,
            pluginData: document.pluginState.chat?.pluginData || null,
            transaction: document.transaction
        }, ...document.nodes];
    }

    private conversationToForgeSession(document: ConversationDocument): any {
        const forge = document.pluginState.forge || {};
        return {
            id: document.id,
            sessionChatId: forge.sessionChatId || document.legacy?.legacyChatId || document.id,
            title: document.title,
            createdAt: document.createdAt,
            updatedAt: document.updatedAt,
            presetId: forge.presetId || '',
            activeLeafId: document.activeLeafId,
            worldlineNodes: document.nodes,
            selectedChatSessionId: forge.selectedChatSessionId || null,
            selectedChatSnapshotId: forge.selectedChatSnapshotId || null,
            draftInput: forge.draftInput || '',
            stagingEntries: forge.stagingEntries || [],
            commitReadyEntries: forge.commitReadyEntries || [],
            virtualLorebookEntries: forge.virtualLorebookEntries || [],
            importedLorebookId: forge.importedLorebookId || null,
            workflowSnapshot: forge.workflowSnapshot || null,
            detailMode: forge.detailMode || null,
            entryMode: forge.entryMode || null,
            structuredState: forge.structuredState,
            draftTree: forge.draftTree,
            forgeMemoryTree: forge.forgeMemoryTree,
            activeLayer: forge.activeLayer || 'concept',
            completedLayers: forge.completedLayers || [],
            publishState: forge.publishState || 'drafting',
            activeAuxPanel: forge.activeAuxPanel,
            auxPresentationMode: forge.auxPresentationMode,
            worldlineSnapshots: forge.worldlineSnapshots,
            workspaceMode: 'workspace'
        };
    }

    constructor() {
        this.conversation = {
            listConversations: async () => ({
                conversations: this.readConversations().map((document) => resolveConversationSummary(document))
            }),
            getConversation: async (id: string) => ({
                document: this.getConversationDocument(id)
            }),
            saveConversation: async (id: string, document: ConversationDocument) => {
                return this.commitConversation(id, { ...document, id }, 'chat.save');
            },
            mutateConversation: async (id: string, mutation: ConversationMutation) => {
                const current = this.getConversationDocument(id) || createEmptyConversationDocument({
                    id,
                    conversationType: id.startsWith('lw_card_') ? 'forge' : 'chat'
                });
                const next = applyConversationMutation(current, mutation);
                return this.commitConversation(id, next, 'chat.patch');
            },
            getTransactions: async (id: string) => {
                const document = this.getConversationDocument(id);
                if (!document?.transaction?.lastTransactionId) {
                    return { success: true, transactions: [], lastCommittedSeq: 0 };
                }
                return {
                    success: true,
                    transactions: [{
                        id: document.transaction.lastTransactionId,
                        chatId: id,
                        seq: document.transaction.lastCommittedSeq,
                        status: 'committed',
                        scope: 'chat.save',
                        payloadDigest: '',
                        idempotencyKey: document.transaction.lastTransactionId,
                        createdAt: document.updatedAt,
                        updatedAt: document.updatedAt,
                        error: null
                    }],
                    lastCommittedSeq: document.transaction.lastCommittedSeq
                };
            },
            rollbackTransaction: async (id: string) => ({
                success: true,
                lastCommittedSeq: this.getConversationDocument(id)?.transaction.lastCommittedSeq || 0
            })
        };

        this.chat = {
            listChats: async () => {
                return {
                    chats: this.readConversations()
                        .filter((document) => document.conversationType === 'chat')
                        .map((document) => ({
                            chatId: document.id,
                            updatedAt: document.updatedAt,
                            messageCount: document.nodes.length,
                            activeLeafId: document.activeLeafId,
                            previewMessage: resolveConversationSummary(document).previewMessage
                        }))
                };
            },
            getChat: async (chatId: string) => {
                const data = await this.conversation.getConversation(chatId);
                return data.document ? this.conversationToLegacyChat(data.document) : null;
            },
            saveChat: async (chatId: string, payload: any): Promise<TransactionMutationResponse> => {
                const document = migrateLegacyChatArray(chatId, payload?.data || payload);
                return await this.conversation.saveConversation(chatId, document) as any;
            },
            patchChat: async (chatId: string, payload: any): Promise<TransactionMutationResponse> => {
                return await this.conversation.mutateConversation(chatId, {
                    nodes: {
                        added: Array.isArray(payload?.added) ? payload.added : [],
                        updated: Array.isArray(payload?.updated) ? payload.updated : [],
                        deletedIds: Array.isArray(payload?.deletedIds) ? payload.deletedIds : []
                    },
                    activeLeafId: payload?.metadata?.activeLeafId,
                    pluginState: payload?.metadata?.pluginData ? {
                        chat: {
                            pluginData: payload.metadata.pluginData
                        }
                    } : undefined,
                    updatedAt: payload?.metadata?.updatedAt
                }) as any;
            },
            saveMessage: async (chatId: string, nodeId: string, message: any) => {
                return await this.conversation.mutateConversation(chatId, {
                    nodes: {
                        added: [{ ...message, id: nodeId }]
                    }
                });
            },
            deleteMessage: async (chatId: string, nodeId: string) => {
                return await this.conversation.mutateConversation(chatId, {
                    nodes: {
                        deletedIds: [nodeId]
                    }
                });
            },
            getSyncStatus: async (chatId: string) => {
                const transactions = await this.conversation.getTransactions(chatId);
                return {
                    success: true,
                    isTransactionsCompleted: true,
                    lastCommittedSeq: transactions.lastCommittedSeq || 0,
                    lastTransactionId: transactions.transactions?.[0]?.id || null
                };
            },
            getTransactions: async (chatId: string) => this.conversation.getTransactions(chatId),
            rollbackTransaction: async (chatId: string, transactionId: string) => this.conversation.rollbackTransaction(chatId, transactionId)
        };

        const interceptor = new BaseXMLInterceptor();
        const localPersistence: PersistenceDelegate = {
            appendChatRecord: async (chatId, node) => {
                // 模拟本地写入逻辑
                console.log(`[LocalBridge] Persisted message node into local storage: ${node.id}`);
            },
            updateChatMetadata: async (chatId, metadata) => {
                console.log(`[LocalBridge] Update metadata: ${JSON.stringify(metadata)}`);
            },
            commitTransaction: async (chatId, scope, payload, idempotencyKey) => {
                return { id: `local_tx_${Date.now()}`, seq: 0 };
            }
        };

        let activeProvider: OpenAIProvider | null = null;

        this.nexus = {
            generateStream: (payload: any) => {
                const handle = new LocalStreamingHandle();
                
                // 1. 尝试从本地镜像加载 API 配置
                const apiConfig = lwStorage.get('nexus.apis', [], 'Global');
                const selectedApiId = payload.nodes?.[0]?.provider;
                const api = apiConfig.find((a: any) => a.id === selectedApiId) || apiConfig[0];

                const flow = new NexusGenerationFlow(
                    {
                        chatId: payload.chatId,
                        parentId: payload.parentId || null,
                        charName: payload.charName || 'Assistant',
                        characterId: payload.characterId,
                        policy: payload.settings?.policy || { allowTopLevel: true }
                    },
                    interceptor,
                    localPersistence
                );

                // --- 逻辑分层：真实 API 调用 vs Mock 演示 ---
                if (api && api.key && api.url) {
                    console.info(`[LocalBridge] 离线生成：检测到 API 配置 (${api.id})，发起真实请求...`);
                    
                    // A. 构建提示词 (在前端执行宏替换与组装)
                    const forgeMessages = payload.messages; // 假设传入的是已简化的消息
                    const modelMessages: LLMMessage[] = promptBuilder.build(forgeMessages) as any; // 简单转换，实际建议映射

                    const provider = new OpenAIProvider();
                    activeProvider = provider;

                    provider.generateStream(
                        api.url,
                        api.key,
                        modelMessages,
                        {
                            model: payload.nodes?.[0]?.model || 'gpt-4o',
                            temperature: payload.settings?.temperature
                        },
                        {
                            onToken: (token) => {
                                flow.pushToken(token);
                                handle._emitToken(token);
                            },
                            onDone: async () => {
                                const newNode = await flow.finalize();
                                handle._emitCommitted({
                                    lastTransactionId: (newNode.extra.transactionId as any).id,
                                    activeLeafId: newNode.id,
                                    node: newNode
                                });
                                handle._emitDone({ status: 'success', node: newNode });
                                activeProvider = null;
                            },
                            onError: (err) => {
                                handle._emitError(err);
                                activeProvider = null;
                            }
                        }
                    );
                } else {
                    console.warn('[LocalBridge] 离线生成：未检测到有效 API Key，进入 Mock 模式...');
                    const mockTokens = [
                        '【离线演示模式】未检测到有效的 API 密钥。\n\n',
                        '这是由前端 Mock 引擎生成的回复。',
                        '请在设置中心配置 OpenAI 兼容接口，并确保后端曾成功加载过配置，以便前端在离线时能自动恢复密钥。'
                    ];

                    let idx = 0;
                    const interval = setInterval(async () => {
                        if (idx < mockTokens.length) {
                            const token = mockTokens[idx++];
                            flow.pushToken(token);
                            handle._emitToken(token);
                        } else {
                            clearInterval(interval);
                            const newNode = await flow.finalize();
                            handle._emitCommitted({
                                lastTransactionId: (newNode.extra.transactionId as any).id,
                                activeLeafId: newNode.id,
                                node: newNode
                            });
                            handle._emitDone({ status: 'success', node: newNode });
                        }
                    }, 300);
                }

                return handle;
            },
            attachStream: (params: any) => {
                const handle = new LocalStreamingHandle();
                setTimeout(() => {
                    handle._emitError(new Error('Offline mode does not support attaching to sessions'));
                }, 0);
                return handle;
            },
            getStatus: async (chatId: string) => ({ isGenerating: false, status: 'idle' }),
            stop: async (chatId: string) => {
                if (activeProvider) {
                    activeProvider.abort();
                    activeProvider = null;
                }
            },
            fetchModels: async (providerId: string) => {
                const apiConfig = lwStorage.get('nexus.apis', [], 'Global');
                const api = apiConfig.find((a: any) => a.id === providerId);
                
                if (api && api.key && api.url) {
                    try {
                        console.info(`[LocalBridge] 离线获取模型列表：检测到 API 配置 (${api.id})，发起请求...`);
                        const provider = new OpenAIProvider();
                        return await provider.fetchModels(api.url, api.key);
                    } catch (err) {
                        console.error('[LocalBridge] Failed to fetch models offline:', err);
                        return [];
                    }
                }
                
                console.warn('[LocalBridge] 离线获取模型列表：未找到有效 API 配置，返回 Mock。');
                return ['Offline-Mock-Model'];
            }
        };

        this.forge = {
            listSessions: async () => ({
                sessions: this.readConversations()
                    .filter((document) => document.conversationType === 'forge')
                    .map((document) => this.conversationToForgeSession(document))
            }),
            getSession: async (id: string) => {
                const data = await this.conversation.getConversation(id);
                return { session: data.document ? this.conversationToForgeSession(data.document) : null };
            },
            saveSession: async (session: any) => {
                const document = migrateLegacyForgeSession(session, session?.worldlineNodes);
                return await this.conversation.saveConversation(session.id, document);
            },
            updateSession: async (id: string, session: any) => {
                const document = migrateLegacyForgeSession(session, session?.worldlineNodes);
                return await this.conversation.saveConversation(id, document);
            }
        };

        this.settings = {
            getSettings: async () => lwStorage.get('lumina-settings', {}, 'Global'),
            saveSettings: async (s: any) => lwStorage.set('lumina-settings', s, 'Global')
        };

        this.presets = {
            listPresets: async () => lwStorage.get('lumina-presets', [], 'Global'),
            importPreset: async (p) => {
                const presets = lwStorage.get('lumina-presets', [], 'Global');
                presets.push(p);
                lwStorage.set('lumina-presets', presets, 'Global');
                return { success: true };
            },
            exportPreset: async (id) => ({ blob: {} }),
            restoreDefaults: async () => ({ success: true })
        };

        this.extensionStore = {
            async getJson({ namespace, key, table = 'main' }: { namespace: string; key: string; table?: string }) {
                const k = `tt_ext_store_${namespace}_${table}_${key}`;
                const val = localStorage.getItem(k);
                return val ? JSON.parse(val) : null;
            },
            async setJson({ namespace, key, value, table = 'main' }: { namespace: string; key: string; value: any; table?: string }) {
                const k = `tt_ext_store_${namespace}_${table}_${key}`;
                localStorage.setItem(k, JSON.stringify(value));
            },
            async updateJson({ namespace, key, value, table = 'main' }: { namespace: string; key: string; value: any; table?: string }) {
                const k = `tt_ext_store_${namespace}_${table}_${key}`;
                const old = localStorage.getItem(k);
                const oldVal = old ? JSON.parse(old) : {};
                const newVal = (typeof value === 'object' && value !== null && typeof oldVal === 'object')
                    ? { ...oldVal, ...value }
                    : value;
                localStorage.setItem(k, JSON.stringify(newVal));
            },
            async deleteJson({ namespace, key, table = 'main' }: { namespace: string; key: string; table?: string }) {
                const k = `tt_ext_store_${namespace}_${table}_${key}`;
                localStorage.removeItem(k);
            },
            async listKeys({ namespace, table = 'main' }: { namespace: string; table?: string }) {
                const prefix = `tt_ext_store_${namespace}_${table}_`;
                return Object.keys(localStorage).filter(k => k.startsWith(prefix)).map(k => k.replace(prefix, ''));
            },
            async setBlob({ namespace, key, data, table = 'main' }: { namespace: string; key: string; data: any; table?: string }) {
                let base64 = '';
                if (data instanceof Blob) {
                    base64 = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.readAsDataURL(data);
                    });
                } else if (data instanceof ArrayBuffer || (ArrayBuffer.isView(data))) {
                     base64 = btoa(String.fromCharCode(...new Uint8Array(data as any)));
                } else {
                     base64 = String(data);
                }
                const k = `tt_ext_store_blob_${namespace}_${table}_${key}`;
                localStorage.setItem(k, base64);
            },
            async getBlob({ namespace, key, table = 'main' }: { namespace: string; key: string; table?: string }) {
                const k = `tt_ext_store_blob_${namespace}_${table}_${key}`;
                const base64 = localStorage.getItem(k);
                if (!base64) return null;
                if (base64.startsWith('data:')) {
                    const res = await fetch(base64);
                    return await res.blob();
                }
                return new Blob([base64]);
            }
        };
    }
}

/**
 * 本地流句柄
 */
class LocalStreamingHandle implements IStreamingHandle {
    private callbacks: IStreamingCallbacks = {};
    private isAborted = false;
    private _busy = true;

    isBusy() { return this._busy; }
    abort() { this.isAborted = true; this._busy = false; }
    onToken(cb: any) { this.callbacks.onToken = cb; return this; }
    onCommitted(cb: any) { this.callbacks.onCommitted = cb; return this; }
    onDone(cb: any) { this.callbacks.onDone = cb; return this; }
    onError(cb: any) { this.callbacks.onError = cb; return this; }

    _emitToken(t: string) { if (!this.isAborted) this.callbacks.onToken?.(t); }
    _emitCommitted(d: any) { if (!this.isAborted) this.callbacks.onCommitted?.(d); }
    _emitDone(d: any) { this._busy = false; if (!this.isAborted) this.callbacks.onDone?.(d); }
    _emitError(e: any) { this._busy = false; if (!this.isAborted) this.callbacks.onError?.(e); }
}
