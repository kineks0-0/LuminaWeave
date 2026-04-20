import { 
    ILuminaBridge, 
    IStreamingHandle, 
    IStreamingCallbacks,
    IStoreService,
    IConversationService
} from '@shared/api/IBridge.js';
import { EnvDetector } from '../core/EnvDetector.js';
import { globalNexusOrchestrator } from '@shared/api/llm/NexusOrchestrator.js';
import { lwStorage } from '../storage.js';
import { STClient } from '../core/st-adapter/STClient.js';
import { LocalNexusHandler } from '../core/LocalNexusHandler.js';
import { PersistenceDelegate } from '@shared/api/NexusGenerationFlow.js';
import type { ConversationDocument, ConversationMutation } from '@shared/ConversationTypes.js';
import { createEmptyConversationDocument } from '@shared/ConversationTypes.js';
import { applyConversationMutation } from '@shared/ConversationReducer.js';
import { migrateLegacyChatArray, migrateLegacyForgeSession } from '@shared/ConversationMigration.js';
import { resolveConversationSummary } from '@shared/ConversationSummaryResolver.js';

/**
 * TauriBridgeAdapter
 * 适配 TauriTavern (Android/Native) 环境
 * 使用 window.__TAURITAVERN__.invoke 与原生后端通信
 */
export class TauriBridgeAdapter implements ILuminaBridge {
    public readonly conversation: IConversationService;
    private static readonly CONVERSATION_NAMESPACE = 'lumina_conversations';

    private get bridge() {
        return EnvDetector.tauriBridge;
    }

    private async readUnifiedConversation(id: string): Promise<ConversationDocument | null> {
        const direct = await this.extensionStore.getJson({ namespace: TauriBridgeAdapter.CONVERSATION_NAMESPACE, key: id });
        if (direct) return direct;

        const legacyChat = await this.extensionStore.getJson({ namespace: 'lumina_chats', key: id });
        if (legacyChat?.data && Array.isArray(legacyChat.data)) {
            const migrated = migrateLegacyChatArray(id, legacyChat.data);
            await this.extensionStore.setJson({ namespace: TauriBridgeAdapter.CONVERSATION_NAMESPACE, key: id, value: migrated });
            return migrated;
        }

        const legacyForge = await this.extensionStore.getJson({ namespace: 'lumina_forge', key: id });
        if (legacyForge?.id) {
            const migrated = migrateLegacyForgeSession(legacyForge, legacyForge?.worldlineNodes);
            await this.extensionStore.setJson({ namespace: TauriBridgeAdapter.CONVERSATION_NAMESPACE, key: migrated.id, value: migrated });
            return migrated;
        }

        return null;
    }

    private async listUnifiedConversationIds(): Promise<string[]> {
        const unified = await this.extensionStore.listKeys({ namespace: TauriBridgeAdapter.CONVERSATION_NAMESPACE });
        if (unified.length > 0) return unified;

        const [legacyChats, legacyForge] = await Promise.all([
            this.extensionStore.listKeys({ namespace: 'lumina_chats' }),
            this.extensionStore.listKeys({ namespace: 'lumina_forge' })
        ]);
        return Array.from(new Set([...legacyChats, ...legacyForge]));
    }

    private isMissingStoreEntryError(error: unknown): boolean {
        const message = error instanceof Error ? error.message : String(error ?? '');
        const normalized = message.toLowerCase();
        return normalized.includes('not found')
            || normalized.includes('chat not found')
            || normalized.includes('failed to delete chat');
    }

    constructor() {
        this.conversation = {
            listConversations: async () => {
                const ids = await this.listUnifiedConversationIds();
                const documents = (await Promise.all(ids.map((id) => this.readUnifiedConversation(id))))
                    .filter((document): document is ConversationDocument => Boolean(document));
                return {
                    conversations: documents.map((document) => resolveConversationSummary(document))
                };
            },
            getConversation: async (id: string) => ({
                document: await this.readUnifiedConversation(id)
            }),
            saveConversation: async (id: string, document: ConversationDocument) => {
                const nextSeq = (document.transaction?.lastCommittedSeq || 0) + 1;
                const saved: ConversationDocument = {
                    ...document,
                    id,
                    transaction: {
                        lastCommittedSeq: nextSeq,
                        lastTransactionId: `tauri_tx_${Date.now()}`
                    },
                    updatedAt: Date.now(),
                    summary: resolveConversationSummary(document)
                };
                await this.extensionStore.setJson({ namespace: TauriBridgeAdapter.CONVERSATION_NAMESPACE, key: id, value: saved });
                return {
                    success: true,
                    document: saved,
                    summary: resolveConversationSummary(saved),
                    lastCommittedSeq: nextSeq
                };
            },
            mutateConversation: async (id: string, mutation: ConversationMutation) => {
                const current = await this.readUnifiedConversation(id) || createEmptyConversationDocument({
                    id,
                    conversationType: id.startsWith('lw_card_') ? 'forge' : 'chat'
                });
                const next = applyConversationMutation(current, mutation);
                return await this.conversation.saveConversation(id, next);
            },
            deleteConversation: async (id: string) => {
                const keys = await this.extensionStore.listKeys({ namespace: TauriBridgeAdapter.CONVERSATION_NAMESPACE });
                if (!keys.includes(id)) {
                    return {
                        success: true,
                        id
                    };
                }

                try {
                    await this.extensionStore.deleteJson({ namespace: TauriBridgeAdapter.CONVERSATION_NAMESPACE, key: id });
                } catch (error) {
                    if (!this.isMissingStoreEntryError(error)) {
                        throw error;
                    }
                }

                return {
                    success: true,
                    id
                };
            },
            getTransactions: async (id: string) => {
                const document = await this.readUnifiedConversation(id);
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
                lastCommittedSeq: (await this.readUnifiedConversation(id))?.transaction.lastCommittedSeq || 0
            })
        };
    }


    private async waitReady(): Promise<void> {
        const ready = EnvDetector.tauriReady;
        if (ready) await ready;
    }

    private async invoke(cmd: string, args: any = {}): Promise<any> {
        await this.waitReady();
        const invokeFn = EnvDetector.tauriInvoke;
        if (!invokeFn) {
            throw new Error(`[Lumina Tauri] Native invoke function not found. Environment: ${EnvDetector.isTauriTavern ? 'Tauri-like' : 'Non-Tauri'}`);
        }
        return await invokeFn(cmd, args);
    }

    // 辅助方法：将 REST 风格请求转换为 Tauri 插件请求
    private async pluginRequest(method: string, url: string, body?: any): Promise<any> {
        return await this.invoke('plugin_request', {
            method,
            url,
            body: body ? JSON.stringify(body) : undefined,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    private static readonly HEX_PREFIX = '_ltx_';

    private encodeKey(key: string): string {
        // 如果全是安全字符且不含我们的前缀，则保持原样
        if (/^[a-z0-9_.-]+$/i.test(key) && !key.startsWith(TauriBridgeAdapter.HEX_PREFIX)) {
            return key;
        }
        
        // 否则使用 hex 编码以确保 ABI 合规性 [A-Za-z0-9_.-]
        const encoder = new TextEncoder();
        const bytes = encoder.encode(key);
        let hex = '';
        for (const b of bytes) {
            hex += b.toString(16).padStart(2, '0');
        }
        return `${TauriBridgeAdapter.HEX_PREFIX}${hex}`;
    }

    private decodeKey(key: string): string {
        if (!key.startsWith(TauriBridgeAdapter.HEX_PREFIX)) return key;
        
        try {
            const hex = key.slice(TauriBridgeAdapter.HEX_PREFIX.length);
            const bytes = new Uint8Array(hex.length / 2);
            for (let i = 0; i < hex.length; i += 2) {
                bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
            }
            const decoder = new TextDecoder();
            return decoder.decode(bytes);
        } catch (e) {
            console.warn('[Lumina Bridge] Failed to decode key:', key, e);
            return key;
        }
    }

    private safeNs(ns: string): string {
        return this.encodeKey(ns);
    }

    private safeKey(key: string): string {
        return this.encodeKey(key);
    }

    private getStore() {
        return (window as any).__TAURITAVERN__?.api?.extension?.store;
    }

    private getChatApi() {
        return (window as any).__TAURITAVERN__?.api?.chat;
    }

    private getCharacterName(): string {
        const ctx = EnvDetector.ctx as any;
        // 优先从官方上下文获取 characterName，用于 Native 端的隔离识别
        return ctx?.characterName || ctx?.name || 'Global';
    }

    /**
     * 判断错误是否源于后端指令不可用或不兼容 (ABI 冲突/校验失败)
     */
    private isCommandIncompatible(err: any): boolean {
        const msg = (err?.message || String(err)).toLowerCase();
        // 兼容多种形态的“未找到”消息，涵盖指令缺失、存储项缺失及物理路径缺失 (os error 3)
        return msg.includes('not found') || 
               msg.includes('notfound') || 
               msg.includes('os error 3') || 
               msg.includes('系统找不到指定的路径') || 
               msg.includes('missing required key') || 
               msg.includes('invalid args');
    }

    chat = {
        getChat: async (chatId: string) => {
            const characterName = this.getCharacterName();
            try {
                // 策略升级：镜像先行 (Mirror-First)
                // 优先从 Lumina 自己的扩展存储中读取备份。
                // 理由：Lumina 的备份使用了可逆 Hex 编码，不受物理路径编码限制，且读取操作已被我们的防御性查询保护，不会弹窗。
                const data = await this.extensionStore.getJson({ 
                    namespace: 'lumina_chats', 
                    key: chatId 
                });
                
                if (data) {
                    // 如果镜像存在，直接返回数据，完全绕过可能报错的原生 invoke 调用
                    if (typeof data === 'object' && 'data' in data && Array.isArray(data.data)) {
                        return data.data;
                    }
                    return data;
                }

                // 如果镜像不存在（说明是首次从原生迁移或尚未保存过的旧会话），再尝试从原生列表预检
                const nativeChats = await this.chat.listChats();
                const existsInNative = Array.isArray(nativeChats) && nativeChats.includes(chatId);

                if (existsInNative) {
                    // 只有确定镜像没有且原生存在，才发起 invoke
                    return await this.invoke('get_chat', { chatId, fileName: chatId, characterName });
                }
                
                return null;
            } catch (err: any) {
                // 最后的保底拦截：如果 native 调用还是由于某些原因进来了并报了错
                if (this.isCommandIncompatible(err)) {
                    console.info(`[Lumina Bridge] get_chat 最终降级拦截 (原因: ${err?.message || '异常'})`);
                    return null;
                }
                throw err;
            }
        },
        saveChat: async (chatId: string, payload: any) => {
            const characterName = this.getCharacterName();
            try {
                return await this.invoke('save_chat', { chatId, fileName: chatId, characterName, ...payload });
            } catch (err: any) {
                if (this.isCommandIncompatible(err)) {
                    console.info(`[Lumina Bridge] save_chat 降级至 extensionStore (原因: ABI 冲突)`);
                    await this.extensionStore.setJson({ 
                        namespace: 'lumina_chats', 
                        key: chatId, 
                        value: payload 
                    });
                    // 返回模拟响应，满足 PersistenceService 对事务结果的期待
                    const seq = payload.transactionContext?.expectedSeq ?? 0;
                    return { 
                        success: true, 
                        lastCommittedSeq: seq,
                        transaction: { 
                            id: `local_tx_${Date.now()}`, 
                            seq, 
                            status: 'committed',
                            chatId,
                            scope: 'chat.save',
                            createdAt: Date.now(),
                            updatedAt: Date.now(),
                            payloadDigest: '',
                            idempotencyKey: payload.transactionContext?.idempotencyKey || '',
                            error: null
                        }
                    };
                }
                throw err;
            }
        },
        patchChat: async (chatId: string, payload: any) => {
            const characterName = this.getCharacterName();
            try {
                return await this.invoke('patch_chat', { chatId, fileName: chatId, characterName, ...payload });
            } catch (err: any) {
                if (this.isCommandIncompatible(err)) {
                    console.info(`[Lumina Bridge] patch_chat 降级至 extensionStore (原因: ABI 冲突)`);
                    await this.extensionStore.updateJson({ 
                        namespace: 'lumina_chats', 
                        key: chatId, 
                        value: payload 
                    });
                    // 返回模拟响应
                    const seq = payload.transactionContext?.expectedSeq ?? 0;
                    return { 
                        success: true, 
                        lastCommittedSeq: seq,
                        transaction: { 
                            id: `local_tx_${Date.now()}`, 
                            seq,
                            status: 'committed',
                            chatId,
                            scope: 'chat.patch',
                            createdAt: Date.now(),
                            updatedAt: Date.now(),
                            payloadDigest: '',
                            idempotencyKey: payload.transactionContext?.idempotencyKey || '',
                            error: null
                        }
                    };
                }
                throw err;
            }
        },
        saveMessage: async (chatId: string, nodeId: string, message: any) => {
            try {
                return await this.invoke('save_message', { chatId, nodeId, message });
            } catch (err: any) {
                if (this.isCommandIncompatible(err)) {
                    console.info(`[Lumina Bridge] save_message 降级至 extensionStore (原因: ABI 冲突)`);
                    return await this.extensionStore.setJson({ 
                        namespace: this.safeNs(`lw_nodes_${chatId}`), 
                        key: nodeId, 
                        value: message 
                    });
                }
                throw err;
            }
        },
        deleteMessage: async (chatId: string, nodeId: string) => {
            try {
                return await this.invoke('delete_message', { chatId, nodeId });
            } catch (err: any) {
                if (this.isCommandIncompatible(err)) {
                    return await this.extensionStore.deleteJson({ 
                        namespace: this.safeNs(`lw_nodes_${chatId}`), 
                        key: nodeId 
                    });
                }
                throw err;
            }
        },
        listChats: async () => {
            try {
                return await this.invoke('list_chats');
            } catch (err: any) {
                if (this.isCommandIncompatible(err)) {
                    console.info(`[Lumina Bridge] list_chats 降级至 extensionStore`);
                    const keys = await this.extensionStore.listKeys({ namespace: 'lumina_chats' });
                    return keys.map((k: string) => this.decodeKey(k));
                }
                throw err;
            }
        },
        getSyncStatus: async (chatId: string) => {
            const characterName = this.getCharacterName();
            const api = this.getChatApi();
            try {
                // 优先尝试从官方 api.chat 获取当前窗口信息
                if (api?.current) {
                    try {
                        const info = await api.current.windowInfo();
                        const ref = api.current.ref();
                        // 如果当前正是我们需要的内容，则利用窗口信息直接返回对齐状态
                        if (ref && (ref.fileName === chatId || ref.chatId === chatId)) {
                            return {
                                success: true,
                                isTransactionsCompleted: true,
                                lastCommittedSeq: info.totalCount,
                                lastTransactionId: `st_${info.totalCount}`
                            };
                        }
                    } catch (e) {
                        // 如果 api 调用失败（如尚未就绪），降级到 invoke
                    }
                }
                return await this.invoke('get_sync_status', { chatId, characterName });
            } catch (err: any) {
                if (this.isCommandIncompatible(err)) {
                    // 核心修复：降级时必须显式返回 success 和 completed 状态，否则 PersistenceService 会陷入 10s 超时等待
                    return { success: true, isTransactionsCompleted: true, synced: true, pending: [], chatId };
                }
                throw err;
            }
        },
        getTransactions: async (chatId: string, params: any) => {
            try {
                return await this.invoke('get_transactions', { chatId, ...params });
            } catch (err: any) {
                if (this.isCommandIncompatible(err)) return { success: true, transactions: [] };
                throw err;
            }
        },
        rollbackTransaction: async (chatId: string, transactionId: string) => {
            try {
                return await this.invoke('rollback_transaction', { chatId, transactionId });
            } catch (err: any) {
                if (this.isCommandIncompatible(err)) return { success: true };
                throw err;
            }
        }
    };

    nexus = {
        generateStream: (payload: any) => {
            // 在 TauriTavern 且无插件环境下，如果 provider 是自定义的，优先尝试本地生成
            if (payload.nodes?.length > 0) {
                const firstNode = payload.nodes[0];
                if (String(firstNode.provider).startsWith('nx_')) {
                    console.log('[Lumina Bridge] 自定义 API 检测，进入本地流式生成模式...');
                    
                    // 构造本地持久化委托，复用 Bridge 已有的 chat 接口
                    const delegate: PersistenceDelegate = {
                        appendChatRecord: async (cid, node) => {
                            await this.chat.saveMessage(cid, node.id, node);
                        },
                        updateChatMetadata: async (cid, metadata) => {
                            await this.chat.patchChat(cid, { metadata });
                        },
                        commitTransaction: async (cid, scope, payloadText, idempotencyKey) => {
                            // 构造一个模拟事务返回，因为本地模式下事务由 Bridge 指令底层处理（如果是 Native）
                            // 或者如果是完全脱离模式，这里可以通过 patchChat 模拟事务提交
                            const res = await this.chat.patchChat(cid, { 
                                transaction: { scope, payloadText, idempotencyKey } 
                            });
                            return res?.transaction || { id: `local_${Date.now()}` };
                        }
                    };

                    return new LocalNexusHandler(payload, delegate);
                }
            }
            return this.createTauriStream('generate_stream', { payload });
        },
        attachStream: (params: any) => {
            return this.createTauriStream('attach_stream', { params });
        },
        stop: async (chatId: string) => {
            await this.invoke('stop_generation', { chatId });
        },
        fetchModels: async (providerId: string) => {
            // 优先检查是否为 Lumina 自定义 API (nx_ 开头)
            if (providerId.startsWith('nx_')) {
                const apis = lwStorage.get('nexus.apis', [], 'Global');
                const api = apis.find((a: any) => a.id === providerId);
                if (api) {
                    console.log(`[Lumina Bridge] 本地优先拉取模型: ${api.name}`);
                    const models = await globalNexusOrchestrator.listModelsForProvider(api);
                    if (models && models.length > 0) return models;
                }
            }
            
            // 回退到 native 模式 (使用修正后的指令名)
            try {
                return await this.invoke('fetch_provider_models', { providerId });
            } catch (err: any) {
                if (this.isCommandIncompatible(err)) {
                    throw new Error(`Native command fetch_provider_models failed. Provider: ${providerId}`);
                }
                throw err;
            }
        },
        getStatus: async (chatId: string) => {
            try {
                return await this.invoke('fetch_status', { chatId });
            } catch (err: any) {
                if (this.isCommandIncompatible(err)) return null;
                throw err;
            }
        }
    };


    forge = {
        listSessions: async () => {
            try {
                return await this.invoke('forge_list_sessions');
            } catch (err: any) {
                if (this.isCommandIncompatible(err)) {
                    console.info('[Lumina Bridge] forge_list_sessions 降级至 extensionStore');
                    const keys = await this.extensionStore.listKeys({ namespace: 'lumina_forge' });
                    if (!keys || !Array.isArray(keys)) return [];
                    
                    // 并行拉取，注意解码 Key
                    const sessions = await Promise.all(keys.map((k: string) => this.forge.getSession(this.decodeKey(k))));
                    return sessions.filter(s => !!s);
                }
                throw err;
            }
        },
        getSession: async (sessionId: string) => {
            try {
                return await this.invoke('forge_get_session', { sessionId });
            } catch (err: any) {
                if (this.isCommandIncompatible(err)) {
                    console.info(`[Lumina Bridge] forge_get_session 降级至 extensionStore`);
                    return await this.extensionStore.getJson({ namespace: 'lumina_forge', key: sessionId });
                }
                throw err;
            }
        },
        saveSession: async (session: any) => {
            try {
                return await this.invoke('forge_save_session', { session });
            } catch (err: any) {
                if (this.isCommandIncompatible(err)) {
                    console.info(`[Lumina Bridge] forge_save_session 降级至 extensionStore`);
                    return await this.extensionStore.setJson({ namespace: 'lumina_forge', key: session.id, value: session });
                }
                throw err;
            }
        },
        updateSession: async (sessionId: string, session: any) => {
            try {
                return await this.invoke('forge_update_session', { sessionId, session });
            } catch (err: any) {
                if (this.isCommandIncompatible(err)) {
                    console.info(`[Lumina Bridge] forge_update_session 降级至 extensionStore`);
                    return await this.extensionStore.setJson({ namespace: 'lumina_forge', key: sessionId, value: session });
                }
                throw err;
            }
        }
    };

    settings = {
        getSettings: async () => {
            try {
                return await this.invoke('get_settings');
            } catch (err: any) {
                if (this.isCommandIncompatible(err)) {
                    console.info(`[Lumina Bridge] get_settings 降级至 extensionStore`);
                    return (await this.extensionStore.getJson({ namespace: 'lumina_weave', key: 'settings' })) || {};
                }
                console.warn('[Lumina Bridge] get_settings unexpected error', err);
                throw err;
            }
        },
        saveSettings: async (settings: any) => {
            try {
                return await this.invoke('save_settings', { settings });
            } catch (err: any) {
                if (this.isCommandIncompatible(err)) {
                    console.info(`[Lumina Bridge] save_settings 降级至 extensionStore`);
                    return await this.extensionStore.setJson({ namespace: 'lumina_weave', key: 'settings', value: settings });
                }
                throw err;
            }
        }
    };

    presets = {
        listPresets: async () => {
            // 修复：传递 apiId 参数
            const apiId = STClient.getMainApi();
            return await this.invoke('list_presets', { apiId });
        },
        importPreset: async (payload: { name?: string; blob: any }) => {
            return await this.invoke('import_preset', payload);
        },
        exportPreset: async (presetId: string) => {
            return await this.invoke('export_preset', { presetId });
        },
        restoreDefaults: async () => {
            return await this.invoke('restore_presets_defaults');
        }
    };

    extensionStore = {
        getJson: async (params: { namespace: string; key: string; table?: string }) => {
            const store = this.getStore();
            const safeParams = { ...params, key: this.safeKey(params.key) };
            
            try {
                // 防御性设计：在某些系统上直接 get 一个不存在的 Key 会触发后端警告日志。
                // 我们通过先 listKeys 确认存在，来规避这一噪音。
                const keys = await this.extensionStore.listKeys({ namespace: params.namespace, table: params.table });
                if (!keys || !keys.includes(params.key)) {
                    return null;
                }

                if (store?.getJson) return await store.getJson(safeParams);
                return await this.invoke('get_extension_store_json', safeParams);
            } catch (err: any) {
                if (this.isCommandIncompatible(err)) return null;
                console.warn('[Lumina Bridge] get_extension_store_json unexpected error', err);
                throw err;
            }
        },
        setJson: async (params: { namespace: string; key: string; value: any; table?: string }) => {
            const store = this.getStore();
            const safeParams = { ...params, key: this.safeKey(params.key) };
            try {
                if (store?.setJson) return await store.setJson(safeParams);
                return await this.invoke('set_extension_store_json', safeParams);
            } catch (err: any) {
                if (!this.isCommandIncompatible(err)) throw err;
            }
        },
        updateJson: async (params: { namespace: string; key: string; value: any; table?: string }) => {
            const store = this.getStore();
            const safeParams = { ...params, key: this.safeKey(params.key) };
            try {
                if (store?.updateJson) return await store.updateJson(safeParams);
                return await this.invoke('update_extension_store_json', safeParams);
            } catch (err: any) {
                if (!this.isCommandIncompatible(err)) throw err;
            }
        },
        renameKey: async (params: { namespace: string; key: string; newKey: string; table?: string }) => {
            const store = this.getStore();
            const safeParams = { 
                ...params, 
                key: this.safeKey(params.key), 
                newKey: this.safeKey(params.newKey) 
            };
            try {
                if (store?.renameKey) return await store.renameKey(safeParams);
                // 兼容性：renameKey 在底层可能是 rename_extension_store_key 或 update_extension_store_key
                return await this.invoke('rename_extension_store_key', safeParams);
            } catch (err: any) {
                if (!this.isCommandIncompatible(err)) throw err;
            }
        },
        deleteJson: async (params: { namespace: string; key: string; table?: string }) => {
            const store = this.getStore();
            const safeParams = { ...params, key: this.safeKey(params.key) };
            try {
                if (store?.deleteJson) return await store.deleteJson(safeParams);
                return await this.invoke('delete_extension_store_json', safeParams);
            } catch (err: any) {
                if (!this.isCommandIncompatible(err)) throw err;
            }
        },
        listKeys: async (params: { namespace: string; table?: string }) => {
            const store = this.getStore();
            const safeParams = { ...params, namespace: this.safeNs(params.namespace) };
            try {
                const keys = (store?.listKeys) 
                    ? await store.listKeys(safeParams)
                    : await this.invoke('list_extension_store_keys', safeParams);
                
                return (keys || []).map((k: string) => this.decodeKey(k));
            } catch (err: any) {
                if (this.isCommandIncompatible(err)) return [];
                throw err;
            }
        },
        listTables: async (params: { namespace: string }) => {
            const store = this.getStore();
            try {
                if (store?.listTables) return await store.listTables(params);
                return await this.invoke('list_extension_store_tables', params);
            } catch (err: any) {
                if (this.isCommandIncompatible(err)) return [];
                throw err;
            }
        },
        deleteTable: async (params: { namespace: string; table: string }) => {
            const store = this.getStore();
            try {
                if (store?.deleteTable) return await store.deleteTable(params);
                return await this.invoke('delete_extension_store_table', params);
            } catch (err: any) {
                if (!this.isCommandIncompatible(err)) throw err;
            }
        },
        setBlob: async (params: { namespace: string; key: string; data: any; table?: string }) => {
            const store = this.getStore();
            const safeParams = { ...params, key: this.safeKey(params.key) };
            try {
                if (store?.setBlob) return await store.setBlob(safeParams);
                return await this.invoke('set_extension_store_blob', safeParams);
            } catch (err: any) {
                if (!this.isCommandIncompatible(err)) throw err;
            }
        },
        getBlob: async (params: { namespace: string; key: string; table?: string }) => {
            const store = this.getStore();
            const safeParams = { ...params, key: this.safeKey(params.key) };
            
            try {
                // 防御性读取：Blob 存储同样适用
                const keys = await this.extensionStore.listBlobKeys({ namespace: params.namespace, table: params.table });
                if (!keys || !keys.includes(params.key)) {
                    return null;
                }

                if (store?.getBlob) return await store.getBlob(safeParams);
                const res = await this.invoke('get_extension_store_blob', safeParams);
                // 容错：如果后端返回的是 base64 字符串（常见于 invoke 降级路径），转换为 Blob
                if (typeof res === 'string' && res.length > 100 && !res.startsWith('blob:')) {
                    const byteCharacters = atob(res);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    const byteArray = new Uint8Array(byteNumbers);
                    return new Blob([byteArray]);
                }
                return res;
            } catch (err: any) {
                if (this.isCommandIncompatible(err)) return null;
                console.warn('[Lumina Bridge] get_extension_store_blob unexpected error', err);
                throw err;
            }
        },
        deleteBlob: async (params: { namespace: string; key: string; table?: string }) => {
            const store = this.getStore();
            const safeParams = { ...params, key: this.safeKey(params.key) };
            try {
                if (store?.deleteBlob) return await store.deleteBlob(safeParams);
                return await this.invoke('delete_extension_store_blob', safeParams);
            } catch (err: any) {
                if (!this.isCommandIncompatible(err)) throw err;
            }
        },
        listBlobKeys: async (params: { namespace: string; table?: string }) => {
            const store = this.getStore();
            const safeParams = { ...params, namespace: this.safeNs(params.namespace) };
            try {
                const keys = (store?.listBlobKeys)
                    ? await store.listBlobKeys(safeParams)
                    : await this.invoke('list_extension_store_blob_keys', safeParams);
                
                return (keys || []).map((k: string) => this.decodeKey(k));
            } catch (err: any) {
                if (this.isCommandIncompatible(err)) return [];
                throw err;
            }
        }
    };

    /**
     * 创建基于 Tauri 事件系统的流句柄
     */
    private createTauriStream(cmd: string, args: any): IStreamingHandle {
        let callbacks: IStreamingCallbacks = {};
        let isAborted = false;
        let isBusy = true;
        let unlistenFunc: (() => void) | null = null;

        const handle = {
            isBusy: () => isBusy,
            onToken: (cb: any) => { callbacks.onToken = cb; return handle; },
            onCommitted: (cb: any) => { callbacks.onCommitted = cb; return handle; },
            onDone: (cb: any) => { callbacks.onDone = cb; return handle; },
            onError: (cb: any) => { callbacks.onError = cb; return handle; },
            abort: () => {
                isAborted = true;
                isBusy = false;
                if (unlistenFunc) unlistenFunc();
                // 通知后端中止
                this.invoke('stop_generation', args).catch(() => {});
            }
        };

        // 异步启动并监听事件
        (async () => {
            try {
                await this.waitReady();
                
                // 探测可用的监听函数 (兼容标准 Tauri 与 TauriTavern)
                const bridge = EnvDetector.tauriBridge;
                const w = window as any;
                const listenFn = (bridge && typeof bridge.listen === 'function') 
                    ? bridge.listen.bind(bridge) 
                    : (typeof w.listen === 'function' ? w.listen.bind(w) : null);

                if (!listenFn) {
                    isBusy = false;
                    callbacks.onError?.(new Error('Native streaming (listen) not supported in this environment'));
                    return;
                }

                // 发起请求 (注意：TauriTavern 中通常直接返回 streamId)
                const streamId = await this.invoke(cmd, args);
                
                // 监听来自该 streamId 的事件
                unlistenFunc = await listenFn(`stream-${streamId}`, (event: any) => {
                    if (isAborted) return;
                    const { type, data } = event.payload || event; // 兼容不同版本的 payload 包装
                    switch (type) {
                        case 'token': callbacks.onToken?.(data); break;
                        case 'delta': callbacks.onToken?.(data); break;
                        case 'committed': callbacks.onCommitted?.(data); break;
                        case 'done': 
                            isBusy = false;
                            callbacks.onDone?.(data); 
                            if (unlistenFunc) unlistenFunc();
                            break;
                        case 'error': 
                            isBusy = false;
                            callbacks.onError?.(new Error(data.message || 'Stream error'));
                            if (unlistenFunc) unlistenFunc();
                            break;
                    }
                });
            } catch (err) {
                isBusy = false;
                callbacks.onError?.(err as Error);
            }
        })();

        return handle;
    }
}
