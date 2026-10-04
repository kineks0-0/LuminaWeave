import { 
    type HALRuntimePorts,
    type RuntimeStreamingHandle,
    type RuntimeConversationPort,
    type RuntimeExtensionStorePort,
    type RuntimeGenerationPort,
    type RuntimePresetPort,
    type RuntimeSettingsPort,
    type RuntimeStreamingCallbacks
} from '@shared/api/HALRuntimePorts.js';
import { lwStorage } from '../../../../storage.js';
import { NexusGenerationFlow, PersistenceDelegate } from '@shared/api/NexusGenerationFlow.js';
import { BaseXMLInterceptor } from '@shared/BaseXMLInterceptor.js';
import { OpenAIProvider } from '@shared/api/llm/OpenAIProvider.js';
import type { LLMMessage } from '@shared/api/llm/ILLMProvider.js';
import { TransactionMutationResponse } from '@shared/api/TransactionTypes.js';
import type { CleanedMessage } from '../../../../../types/nexus.js';
import type { ConversationDocument, ConversationMutation } from '@shared/ConversationTypes.js';
import { createEmptyConversationDocument } from '@shared/ConversationTypes.js';
import { applyConversationMutation } from '@shared/ConversationReducer.js';
import { migrateLegacyChatArray, migrateLegacyForgeSession } from '@shared/ConversationMigration.js';
import { resolveConversationSummary } from '@shared/ConversationSummaryResolver.js';
import { IndexedDbExtensionStore } from '../browser/IndexedDbExtensionStore.js';

export interface StandaloneLocalRuntimeOptions {
    extensionStore?: RuntimeExtensionStorePort;
}

/**
 * 离线/本地桥接适配器
 * 当后端服务不可用时，降级到纯前端运行模式。
 * 使用 runtime store 与 legacy localStorage 镜像承接本地持久化，并模拟生成响应。
 */
export class StandaloneLocalRuntime implements HALRuntimePorts {
    public readonly mode = 'standalone-local' as const;
    private readonly chat: any;
    private readonly forge: any;
    public readonly generation: RuntimeGenerationPort;
    public readonly conversation: RuntimeConversationPort;
    public readonly settings: RuntimeSettingsPort;
    public readonly presets: RuntimePresetPort;
    public readonly extensionStore: RuntimeExtensionStorePort;

    private static readonly CONVERSATION_KEY = 'lumina_conversations';

    private toLLMMessages(messages: unknown): LLMMessage[] {
        if (!Array.isArray(messages)) {
            throw new Error('[StandaloneLocalRuntime] generation payload.messages must be an array');
        }

        return (messages as CleanedMessage[]).map((message) => {
            const role = message.role === 'system' || message.role === 'assistant'
                ? message.role
                : 'user';
            return {
                role,
                content: typeof message.content === 'string' ? message.content : String(message.content ?? '')
            };
        });
    }

    private readConversations(): ConversationDocument[] {
        const unified = lwStorage.get(StandaloneLocalRuntime.CONVERSATION_KEY, null, 'Global');
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
            lwStorage.set(StandaloneLocalRuntime.CONVERSATION_KEY, migrated, 'Global');
        }
        return migrated;
    }

    private writeConversations(documents: ConversationDocument[]): void {
        lwStorage.set(StandaloneLocalRuntime.CONVERSATION_KEY, documents, 'Global');
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

    private deleteConversationDocument(id: string): boolean {
        const documents = this.readConversations();
        const nextDocuments = documents.filter((conversation) => conversation.id !== id);
        if (nextDocuments.length === documents.length) {
            return false;
        }
        this.writeConversations(nextDocuments);
        return true;
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

    constructor(options: StandaloneLocalRuntimeOptions = {}) {
        this.extensionStore = options.extensionStore ?? new IndexedDbExtensionStore();
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
            deleteConversation: async (id: string) => ({
                success: this.deleteConversationDocument(id),
                id
            }),
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
        let lastTransaction: { id: string; seq: number } = { id: `local_tx_${Date.now()}`, seq: 0 };
        const localPersistence: PersistenceDelegate = {
            appendChatRecord: async (chatId, node) => {
                const result = await this.conversation.mutateConversation(chatId, {
                    nodes: { added: [node] }
                }) as any;
                lastTransaction = {
                    id: result?.transaction?.id ?? `local_tx_${Date.now()}`,
                    seq: result?.lastCommittedSeq ?? lastTransaction.seq
                };
            },
            updateChatMetadata: async (chatId, metadata) => {
                const result = await this.conversation.mutateConversation(chatId, {
                    activeLeafId: metadata.activeLeafId
                }) as any;
                lastTransaction = {
                    id: result?.transaction?.id ?? lastTransaction.id,
                    seq: result?.lastCommittedSeq ?? lastTransaction.seq
                };
            },
            commitTransaction: async () => lastTransaction
        };

        let activeProvider: OpenAIProvider | null = null;

        this.generation = {
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

                    void (async () => {
                        try {
                            const modelMessages = this.toLLMMessages(payload.messages);
                            const provider = new OpenAIProvider();
                            activeProvider = provider;

                            await provider.generateStream(
                                api.url,
                                api.key,
                                modelMessages,
                                {
                                    model: payload.nodes?.[0]?.model || api.model || 'gpt-4o',
                                    temperature: payload.settings?.temperature as number | undefined,
                                    maxTokens: payload.settings?.maxTokens as number | undefined,
                                    topP: payload.settings?.topP as number | undefined
                                },
                                {
                                    onToken: (token) => {
                                        flow.pushToken(token);
                                        handle._emitToken(token);
                                    },
                                    onDone: async () => {
                                        const newNode = await flow.finalize();
                                        const transaction = newNode.extra.transactionId as { id?: string; seq?: number } | undefined;
                                        handle._emitCommitted({
                                            lastTransactionId: transaction?.id ?? `local_tx_${Date.now()}`,
                                            seq: transaction?.seq,
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
                        } catch (err) {
                            handle._emitError(err instanceof Error ? err : new Error(String(err)));
                            activeProvider = null;
                        }
                    })();
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
                            const transaction = newNode.extra.transactionId as { id?: string; seq?: number } | undefined;
                            handle._emitCommitted({
                                lastTransactionId: transaction?.id ?? `local_tx_${Date.now()}`,
                                seq: transaction?.seq,
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
            getSettings: async () => {
                return await this.extensionStore.getJson({
                    namespace: 'lumina_weave',
                    table: 'main',
                    key: 'global-settings-mirror'
                }) ?? {};
            },
            saveSettings: async (s: any) => {
                // global-settings-mirror 已经在 storage.ts 中通过 extensionStore.setJson 被写入了。
                // 这里继续写入同一个 runtime store，避免绕开存储统计与导入导出。
                await this.extensionStore.setJson({
                    namespace: 'lumina_weave',
                    table: 'main',
                    key: 'global-settings-mirror',
                    value: s
                });
            }
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

    }
}

/**
 * 本地流句柄
 */
class LocalStreamingHandle implements RuntimeStreamingHandle {
    private callbacks: RuntimeStreamingCallbacks = {};
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
