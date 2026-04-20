import { fetchEventSource } from '@microsoft/fetch-event-source';
import { 
    ILuminaBridge, 
    IChatService, 
    INexusService, 
    IForgeService, 
    IConversationService,
    ISettingsService, 
    IPresetService,
    IStoreService,
    IStreamingHandle 
} from '@shared/api/IBridge';
import { API_BASE, API_ROUTES } from '@shared/ApiEndpoints';
import { STClient } from '../core/st-adapter/STClient';
import type { ConversationDocument, ConversationMutation } from '@shared/ConversationTypes';
import { migrateLegacyChatArray, migrateLegacyForgeSession } from '@shared/ConversationMigration';

/**
 * HTTP 流式句柄实现
 */
class HttpStreamingHandle implements IStreamingHandle {
    private _onToken?: (token: string) => void;
    private _onCommitted?: (data: any) => void;
    private _onDone?: (data: any) => void;
    private _onError?: (error: any) => void;
    private _abortController: AbortController;
    private _isBusy: boolean = true;

    constructor() {
        this._abortController = new AbortController();
    }

    isBusy() { return this._isBusy; }

    abort() {
        this._abortController.abort();
        this._isBusy = false;
    }

    onToken(callback: (token: string) => void) { this._onToken = callback; return this; }
    onCommitted(callback: (data: any) => void) { this._onCommitted = callback; return this; }
    onDone(callback: (data: any) => void) { this._onDone = callback; return this; }
    onError(callback: (error: any) => void) { this._onError = callback; return this; }

    // 内部方法：供 Adapter 调用
    _emitToken(token: string) { this._onToken?.(token); }
    _emitCommitted(data: any) { this._onCommitted?.(data); }
    _emitDone(data: any) { this._isBusy = false; this._onDone?.(data); }
    _emitError(err: any) { this._isBusy = false; this._onError?.(err); }

    get signal() { return this._abortController.signal; }
}

/**
 * 传统的 HTTP 桥接适配器
 * 用于与原生 SillyTavern + Lumina Server 配合
 */
export class HttpBridgeAdapter implements ILuminaBridge {
    public readonly chat: IChatService;
    public readonly nexus: INexusService;
    public readonly forge: IForgeService;
    public readonly conversation: IConversationService;
    public readonly settings: ISettingsService;
    public readonly presets: IPresetService;
    public readonly extensionStore: IStoreService;

    private conversationDocumentToLegacyChat(document: ConversationDocument): any[] {
        return [{
            type: 'metadata',
            activeLeafId: document.activeLeafId,
            updatedAt: document.updatedAt,
            version: 3.0,
            pluginData: document.pluginState.chat?.pluginData || null,
            transaction: {
                lastCommittedSeq: document.transaction.lastCommittedSeq,
                lastTransactionId: document.transaction.lastTransactionId
            }
        }, ...document.nodes];
    }

    private conversationDocumentToForgeSession(document: ConversationDocument): any {
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
        const self = this;

        this.conversation = {
            async listConversations() {
                return (await self.safeFetch(`${API_BASE.LUMINA_WEAVE}${API_ROUTES.CONVERSATION.LIST}`)).json();
            },
            async getConversation(id: string) {
                return (await self.safeFetch(`${API_BASE.LUMINA_WEAVE}${API_ROUTES.CONVERSATION.GET(id)}`)).json();
            },
            async saveConversation(id: string, document: ConversationDocument) {
                return (await self.safeFetch(`${API_BASE.LUMINA_WEAVE}${API_ROUTES.CONVERSATION.SAVE(id)}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(document)
                })).json();
            },
            async mutateConversation(id: string, mutation: ConversationMutation) {
                return (await self.safeFetch(`${API_BASE.LUMINA_WEAVE}${API_ROUTES.CONVERSATION.MUTATE(id)}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(mutation)
                })).json();
            },
            async deleteConversation(id: string) {
                return (await self.safeFetch(`${API_BASE.LUMINA_WEAVE}${API_ROUTES.CONVERSATION.DELETE(id)}`, {
                    method: 'DELETE'
                })).json();
            },
            async getTransactions(id: string, query: any) {
                const q = query ? `?${new URLSearchParams(query as any).toString()}` : '';
                return (await self.safeFetch(`${API_BASE.LUMINA_WEAVE}${API_ROUTES.CONVERSATION.TRANSACTIONS(id)}${q}`)).json();
            },
            async rollbackTransaction(id: string, transactionId: string) {
                return (await self.safeFetch(`${API_BASE.LUMINA_WEAVE}${API_ROUTES.CONVERSATION.ROLLBACK_TRANSACTION(id, transactionId)}`, {
                    method: 'POST'
                })).json();
            }
        };

        this.chat = {
            async listChats() {
                const data = await self.conversation.listConversations();
                return {
                    chats: data.conversations
                        .filter((conversation) => conversation.conversationType === 'chat')
                        .map((conversation) => ({
                            chatId: conversation.id,
                            updatedAt: conversation.updatedAt,
                            messageCount: conversation.messageCount,
                            activeLeafId: conversation.activeLeafId,
                            previewMessage: conversation.previewMessage
                        }))
                };
            },
            async getChat(chatId: string) {
                const data = await self.conversation.getConversation(chatId);
                return data.document ? self.conversationDocumentToLegacyChat(data.document) : null;
            },
            async saveChat(chatId: string, payload: any) {
                const document = migrateLegacyChatArray(chatId, payload?.data || payload);
                return await self.conversation.saveConversation(chatId, document);
            },
            async patchChat(chatId: string, payload: any) {
                return await self.conversation.mutateConversation(chatId, {
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
                });
            },
            async saveMessage(chatId: string, nodeId: string, message: any) {
                return await self.conversation.mutateConversation(chatId, {
                    nodes: {
                        added: [{ ...message, id: nodeId }]
                    }
                });
            },
            async deleteMessage(chatId: string, nodeId: string) {
                return await self.conversation.mutateConversation(chatId, {
                    nodes: {
                        deletedIds: [nodeId]
                    }
                });
            },
            async getSyncStatus(chatId: string) {
                const data = await self.conversation.getTransactions(chatId);
                const transactions = Array.isArray(data.transactions) ? data.transactions : [];
                const lastTransaction = [...transactions].sort((a, b) => b.seq - a.seq)[0];
                return {
                    success: true,
                    isTransactionsCompleted: !transactions.some((item) => item.status === 'pending' || item.status === 'running'),
                    lastCommittedSeq: data.lastCommittedSeq ?? 0,
                    lastTransactionId: lastTransaction?.id || null
                };
            },
            async getTransactions(chatId: string, query: any) {
                return await self.conversation.getTransactions(chatId, query);
            },
            async rollbackTransaction(chatId: string, transactionId: string) {
                return await self.conversation.rollbackTransaction(chatId, transactionId);
            }
        };

        this.nexus = {
            generateStream(payload: any) {
                const handle = new HttpStreamingHandle();
                const url = `${API_BASE.LUMINA_WEAVE}${API_ROUTES.NEXUS.GENERATE_SSE}`;
                self._runSseWithRetry(url, 'POST', payload, handle);
                return handle;
            },
            attachStream(params: any) {
                const handle = new HttpStreamingHandle();
                const url = `${API_BASE.LUMINA_WEAVE}${API_ROUTES.NEXUS.STREAM(params.chatId)}?gid=${params.generationId}&from=${params.from || 0}`;
                self._runSseWithRetry(url, 'GET', null, handle);
                return handle;
            },
            async getStatus(chatId: string) {
                return (await self.safeFetch(`${API_BASE.LUMINA_WEAVE}${API_ROUTES.NEXUS.STATUS(chatId)}`)).json();
            },
            async stop(chatId: string) {
                await self.safeFetch(`${API_BASE.LUMINA_WEAVE}${API_ROUTES.NEXUS.STOP(chatId)}`, {
                    method: 'POST'
                });
            },
            async fetchModels(providerId: string) {
                const res = await self.safeFetch(`${API_BASE.LUMINA_WEAVE}${API_ROUTES.NEXUS.MODELS(providerId)}`);
                const data = await res.json();
                return data.models || [];
            }
        };

        this.forge = {
            async listSessions() {
                const data = await self.conversation.listConversations();
                const summaries = data.conversations.filter((conversation) => conversation.conversationType === 'forge');
                const sessions = await Promise.all(summaries.map(async (conversation) => {
                    const full = await self.conversation.getConversation(conversation.id);
                    if (full.document) {
                        return self.conversationDocumentToForgeSession(full.document);
                    }
                    return {
                        id: conversation.id,
                        title: conversation.title,
                        createdAt: conversation.createdAt,
                        updatedAt: conversation.updatedAt,
                        messageCount: conversation.messageCount,
                        selectedChatSessionId: null
                    };
                }));
                return {
                    sessions
                };
            },
            async getSession(sessionId: string) {
                const data = await self.conversation.getConversation(sessionId);
                return { session: data.document ? self.conversationDocumentToForgeSession(data.document) : null };
            },
            async saveSession(session: any) {
                const document = migrateLegacyForgeSession(session, session?.worldlineNodes);
                return await self.conversation.saveConversation(session.id, document);
            },
            async updateSession(sessionId: string, session: any) {
                const document = migrateLegacyForgeSession(session, session?.worldlineNodes);
                return await self.conversation.saveConversation(sessionId, document);
            }
        };

        this.settings = {
            async getSettings() {
                return (await self.safeFetch(`${API_BASE.LUMINA_WEAVE}${API_ROUTES.SETTINGS.GET}`)).json();
            },
            async saveSettings(settings: any) {
                return (await self.safeFetch(`${API_BASE.LUMINA_WEAVE}${API_ROUTES.SETTINGS.SAVE}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(settings)
                })).json();
            }
        };

        this.presets = {
            listPresets: async () => {
                return (await self.safeFetch(`${API_BASE.LUMINA_WEAVE}${API_ROUTES.PRESETS.LIST}`)).json();
            },
            importPreset: async (payload: { name?: string; blob: any }) => {
                return (await self.safeFetch(`${API_BASE.LUMINA_WEAVE}${API_ROUTES.PRESETS.IMPORT}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                })).json();
            },
            exportPreset: async (presetId: string) => {
                return (await self.safeFetch(`${API_BASE.LUMINA_WEAVE}${API_ROUTES.PRESETS.EXPORT(presetId)}`)).json();
            },
            restoreDefaults: async () => {
                return (await self.safeFetch(`${API_BASE.LUMINA_WEAVE}${API_ROUTES.PRESETS.RESTORE_DEFAULTS}`, {
                    method: 'POST'
                })).json();
            }
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

    private async safeFetch(url: string, options: RequestInit = {}): Promise<Response> {
        const run = async () => {
            const csrfToken = await STClient.getCsrfToken();
            const headers = {
                ...options.headers,
                'X-CSRF-Token': csrfToken
            };
            return await fetch(url, { ...options, headers });
        };

        let res = await run();
        if (res.status === 401 || res.status === 403) {
            // 尝试重试一次，自动刷新 Token 由 STClient 内部逻辑支持（或在此显式刷新）
            console.warn('[HttpBridge] CSRF 失效，尝试刷新并重试...');
            await (STClient as any).refreshCsrfToken?.();
            res = await run();
        }
        return res;
    }

    /**
     * 内部专用的 SSE 启动器 (复用了 NexusClient 的部分健壮性逻辑)
     */
    private async _runSseWithRetry(url: string, method: string, payload: any, handle: HttpStreamingHandle) {
        const runOnce = async (isRetry: boolean) => {
            const csrfToken = isRetry 
                ? await (STClient as any).refreshCsrfToken?.() 
                : await STClient.getCsrfToken();

            await fetchEventSource(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken
                },
                body: payload ? JSON.stringify(payload) : undefined,
                signal: handle.signal,
                openWhenHidden: true,
                async onopen(response: Response) {
                    if (response.ok && response.headers.get('content-type')?.includes('text/event-stream')) {
                        return;
                    }

                    // 检查是否为 CSRF 错误
                    if (response.status === 401 || response.status === 403) {
                        if (!isRetry) throw new Error('LW_INVALID_CSRF');
                    }

                    const errText = await response.text();
                    throw new Error(`SSE Open Error: ${response.status} - ${errText}`);
                },
                onmessage(ev: any) {
                    const data = ev.data?.trim();
                    if (!data || data === ': ping' || data === ': padding') return;

                    try {
                        const parsed = JSON.parse(data);
                        switch (ev.event) {
                            case 'token':
                            case 'chunk':
                            case 'delta':
                                handle._emitToken(parsed.delta || parsed.token || '');
                                break;
                            case 'committed':
                                handle._emitCommitted(parsed);
                                break;
                            case 'done':
                                handle._emitDone(parsed);
                                break;
                            case 'error':
                                handle._emitError(new Error(parsed.message || 'Backend SSE Error'));
                                break;
                        }
                    } catch (e) {
                        if (ev.event === 'token' || ev.event === 'chunk' || !ev.event) {
                            handle._emitToken(ev.data);
                        }
                    }
                },
                onclose() {
                    handle._emitDone({ status: 'closed' });
                },
                onerror(err: any) {
                    if (err instanceof Error && err.message === 'LW_INVALID_CSRF' && !isRetry) {
                        throw err; // 扔给外层触发重试
                    }
                    handle._emitError(err);
                    throw err; 
                }
            });
        };

        try {
            await runOnce(false);
        } catch (err) {
            if (err instanceof Error && err.message === 'LW_INVALID_CSRF') {
                console.warn('[HttpBridge] SSE CSRF 失效，正在重试...');
                await runOnce(true).catch(e => handle._emitError(e));
            } else if (!handle.signal.aborted) {
                handle._emitError(err);
            }
        }
    }
}
