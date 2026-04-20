import { lwStorage } from '../storage.js';
import { STProtocol } from './st-adapter/STProtocol.js';
import { STClient } from './st-adapter/STClient.js';
import { LuminaChatMessage } from '@shared/LuminaMessage.js';
import { WorldlineStore } from './WorldlineStore.js';
import { SyncUtils } from './SyncUtils.js';
import { pluginManager } from '../../core/PluginManager.js';
import { 
    TransactionEngine, 
    ISequenceStorage 
} from '@shared/api/TransactionEngine.js';
import { 
    TransactionScope,
    TransactionContextPayload,
    TransactionMutationResponse,
    TransactionQueryResponse,
    TransactionErrorPayload
} from '@shared/api/TransactionTypes.js';
import { BridgeDispatcher } from '@shared/api/BridgeDispatcher.js';
import { ConversationDocument, ConversationMutation, createEmptyConversationDocument } from '@shared/ConversationTypes.js';

/**
 * PersistenceService
 * 负责对话数据的物理持久化逻辑 (JSONL 存储与加载)
 */
export class PersistenceService {
    private _opQueue: Promise<unknown> = Promise.resolve();
    private _lastCommittedSeqByChat: Map<string, number> = new Map();
    // integratedTxIdByChat 表示当前本地节点池所集成（对齐）的服务器事务 ID
    private _integratedTxIdByChat: Map<string, string> = new Map();

    private _txEngine: TransactionEngine;

    constructor(
        private store: WorldlineStore,
        private isLoadedProvider: () => boolean
    ) { 
        const sequenceStorage: ISequenceStorage = {
            getSequence: async (chatId) => this._getLastCommittedSeq(chatId),
            setSequence: async (chatId, seq) => this.persistLastCommittedSeq(chatId, seq),
            getTransactionId: async (chatId) => this.getIntegratedTxId(chatId) ?? null,
            setTransactionId: async (chatId, txId) => this.setIntegratedTxId(chatId, txId)
        };
        this._txEngine = new TransactionEngine(sequenceStorage);
    }

    /**
     * 将操作排入队列执行，物理上消除并发 IO 导致的 Race Condition
     */
    private _enqueue<T>(op: () => Promise<T>): Promise<T> {
        const nextOp = this._opQueue.then(() => op());
        this._opQueue = nextOp.catch(() => { });
        return nextOp;
    }

    private _digestPayload(payload: unknown): string {
        const text = JSON.stringify(payload) || '';
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            hash = ((hash << 5) - hash) + text.charCodeAt(i);
            hash |= 0;
        }
        return `dg_${Math.abs(hash).toString(16)}`;
    }

    private _getLastCommittedSeq(chatId: string): number {
        return this._lastCommittedSeqByChat.get(chatId) ?? 0;
    }

    private _setLastCommittedSeq(chatId: string, seq: number): void {
        this._lastCommittedSeqByChat.set(chatId, seq);
    }

    public getIntegratedTxId(chatId: string): string | undefined {
        return this._integratedTxIdByChat.get(chatId);
    }

    public setIntegratedTxId(chatId: string, txId: string): void {
        this._integratedTxIdByChat.set(chatId, txId);
    }

    public async persistLastCommittedSeq(chatId: string, seq: number): Promise<void> {
        this._setLastCommittedSeq(chatId, seq);
        const context = lwStorage._getContextIds();
        if (context.chatId !== chatId) return;
        await lwStorage.set('lumina-chat.lastCommittedTxnSeq', seq, 'Chat');
    }

    private _buildTransactionContext(chatId: string, scope: TransactionScope, payloadDigest: string): Promise<TransactionContextPayload> {
        return this._txEngine.buildContext(chatId, scope, payloadDigest);
    }

    private _extractLastCommittedSeq(metadata: unknown): number | null {
        if (!metadata || typeof metadata !== 'object') return null;
        const transaction = (metadata as Record<string, unknown>).transaction as Record<string, unknown> | undefined;
        if (!transaction || typeof transaction !== 'object') return null;
        const seq = transaction.lastCommittedSeq;
        return typeof seq === 'number' ? seq : null;
    }

    private _extractLastTransactionId(metadata: unknown): string | null {
        if (metadata && typeof metadata === 'object' && (metadata as any).transaction && typeof (metadata as any).transaction.lastTransactionId === 'string') {
            return (metadata as any).transaction.lastTransactionId;
        }
        return null;
    }

    private async _persistLastCommittedSeq(chatId: string, seq: number): Promise<void> {
        await this.persistLastCommittedSeq(chatId, seq);
    }

    private async _handleTransactionResponse(chatId: string, payload: TransactionMutationResponse): Promise<void> {
        await this._txEngine.handleResponse(chatId, payload);
    }

    private async _queryLatestTransaction(chatId: string, scope: TransactionScope, idempotencyKey: string): Promise<TransactionQueryResponse | null> {
        try {
            return await BridgeDispatcher.conversation.getTransactions(chatId, { scope, idempotencyKey });
        } catch (e) {
            console.warn(`[PersistenceService] 查询最新事务失败`, e);
            return null;
        }
    }

    private async _queryTransactionsAfterSeq(chatId: string, afterSeq: number, scope: TransactionScope): Promise<TransactionQueryResponse | null> {
        try {
            return await BridgeDispatcher.conversation.getTransactions(chatId, { afterSeq: String(afterSeq), scope });
        } catch (e) {
            console.warn(`[PersistenceService] 查询增量事务失败`, e);
            return null;
        }
    }

    private async _runReconciliationCompensation(chatId: string, scope: TransactionScope, idempotencyKey: string): Promise<void> {
        const knownSeq = this._getLastCommittedSeq(chatId);
        let queryPayload = await this._queryTransactionsAfterSeq(chatId, knownSeq, scope);
        if (!queryPayload) {
            queryPayload = await this._queryLatestTransaction(chatId, scope, idempotencyKey);
        }
        if (!queryPayload) return;
        const transactions = Array.isArray(queryPayload.transactions)
            ? queryPayload.transactions
            : [];
        let resolvedSeq = typeof queryPayload.lastCommittedSeq === 'number'
            ? queryPayload.lastCommittedSeq
            : null;
        for (const tx of transactions) {
            if (tx.status === 'committed') {
                resolvedSeq = typeof resolvedSeq === 'number' ? Math.max(resolvedSeq, tx.seq) : tx.seq;
            }
        }
        if (typeof resolvedSeq === 'number') {
            await this._persistLastCommittedSeq(chatId, resolvedSeq);
        }
        let tx = transactions
            .filter(item => item.idempotencyKey === idempotencyKey && (item.status === 'pending' || item.status === 'running'))
            .sort((a, b) => b.seq - a.seq)[0];
        if (!tx && queryPayload.transaction && queryPayload.transaction.idempotencyKey === idempotencyKey) {
            const latestTx = queryPayload.transaction;
            if (latestTx.status === 'pending' || latestTx.status === 'running') {
                tx = latestTx;
            }
        }
        if (!tx) return;
        try {
            const rollbackPayload = await BridgeDispatcher.conversation.rollbackTransaction(chatId, tx.id) as TransactionMutationResponse;
            const rollbackSeq = typeof rollbackPayload.lastCommittedSeq === 'number'
                ? rollbackPayload.lastCommittedSeq
                : null;
            if (typeof rollbackSeq === 'number') {
                await this._persistLastCommittedSeq(chatId, rollbackSeq);
            }
        } catch (e) {
            console.warn(`[PersistenceService] 回滚事务失败`, e);
        }
    }

    private async _mutateWithCompensation(
        chatId: string,
        scope: TransactionScope,
        payloadDigest: string,
        sender: (ctx: TransactionContextPayload) => Promise<any>
    ): Promise<void> {
        const transactionContext = await this._buildTransactionContext(chatId, scope, payloadDigest);
        try {
            const payload = await sender(transactionContext);
            await this._handleTransactionResponse(chatId, payload);
            return;
        } catch (error) {
            const isConflict = error instanceof Error && error.message.startsWith('TXN_SEQUENCE_CONFLICT:');
            if (!isConflict) throw error;
        }
        await this._runReconciliationCompensation(chatId, scope, transactionContext.idempotencyKey);
        const retryContext = await this._buildTransactionContext(chatId, scope, payloadDigest);
        const retryPayload = await sender(retryContext);
        await this._handleTransactionResponse(chatId, retryPayload);
    }

     /**
     * 等待后端所有事务完成
     */
    private async _waitForTransactions(chatId: string, maxWaitMs = 10000): Promise<boolean> {
        const start = Date.now();
        while (Date.now() - start < maxWaitMs) {
            try {
                const data = await BridgeDispatcher.conversation.getTransactions(chatId);
                const transactions = Array.isArray(data.transactions) ? data.transactions : [];
                if (!transactions.some((item) => item.status === 'pending' || item.status === 'running')) {
                    return true;
                }
            } catch (e) {
                console.warn(`[PersistenceService] 获取事务状态失败`, e);
            }
            await new Promise(r => setTimeout(r, 500));
        }
        console.warn(`[PersistenceService] 等待事务完成超时 (${maxWaitMs}ms) [ID: ${chatId}]`);
        return false;
    }

    /**
     * 事务 ID 对齐：主动从后端请求并刷新本地 Sequence
     */
    async alignTransactionState(chatId: string): Promise<void> {
        return this._enqueue(async () => {
            // 1. 等待正在进行的事务完成 (最大 10s)
            await this._waitForTransactions(chatId);

            try {
                // 2. 请求当前最新的事务状态
                const data = await BridgeDispatcher.conversation.getTransactions(chatId);
                const transactions = Array.isArray(data.transactions) ? data.transactions : [];
                const latest = [...transactions].sort((a, b) => b.seq - a.seq)[0];
                const remoteSeq = typeof data.lastCommittedSeq === 'number' ? data.lastCommittedSeq : 0;
                const remoteTxId = latest?.id || '';

                console.log(`[PersistenceService] 执行事务对齐: LocalSeq=${this._getLastCommittedSeq(chatId)}, RemoteSeq=${remoteSeq}, RemoteTxId=${remoteTxId}`);
                await this._txEngine.alignState(chatId, remoteSeq, remoteTxId);
            } catch (e) {
                console.warn(`[PersistenceService] 事务 ID 对齐失败 [ID: ${chatId}]`, e);
            }
        });
    }

    private async _fetchIndependentChatSnapshot(chatId: string): Promise<{
        messages: LuminaChatMessage[];
        activeLeafId: string | null;
        metadata: any | null;
        exists: boolean;
    }> {
        await this._waitForTransactions(chatId);

        try {
            const data = await BridgeDispatcher.conversation.getConversation(chatId);
            if (data?.document) {
                const metadata = {
                    activeLeafId: data.document.activeLeafId,
                    updatedAt: data.document.updatedAt,
                    pluginData: data.document.pluginState.chat?.pluginData || null,
                    transaction: data.document.transaction
                };
                const remoteCommittedSeq = this._extractLastCommittedSeq(metadata);
                if (typeof remoteCommittedSeq === 'number') {
                    await this._persistLastCommittedSeq(chatId, remoteCommittedSeq);
                } else if (lwStorage._getContextIds().chatId === chatId) {
                    const localSavedSeq = lwStorage.get('lumina-chat.lastCommittedTxnSeq', 0, 'Chat');
                    if (typeof localSavedSeq === 'number') this._setLastCommittedSeq(chatId, localSavedSeq);
                }

                const remoteLastTxId = this._extractLastTransactionId(metadata);
                if (remoteLastTxId) {
                    this.setIntegratedTxId(chatId, remoteLastTxId);
                }

                const normalizedNodes = SyncUtils.ensureFingerprints(data.document.nodes);
                normalizedNodes.forEach(n => {
                    if (!n.name) {
                        n.name = n.is_user ? 'You' : 'Assistant';
                    }
                });

                return {
                    messages: normalizedNodes,
                    activeLeafId: data.document.activeLeafId || normalizedNodes[normalizedNodes.length - 1]?.id || null,
                    metadata,
                    exists: true
                };
            }

            return {
                messages: [],
                activeLeafId: null,
                metadata: null,
                exists: true
            };
        } catch (e: any) {
            if (e?.message?.includes('404')) {
                return {
                    messages: [],
                    activeLeafId: null,
                    metadata: null,
                    exists: false
                };
            }
            throw e;
        }
    }

    private async _prepareConversationDocument(chatId: string): Promise<ConversationDocument> {
        const existing = (await BridgeDispatcher.conversation.getConversation(chatId)).document;
        const pluginMetadata: Record<string, any> = {};
        pluginManager.callHooks('onMetadataExport', pluginMetadata);

        const base = existing || createEmptyConversationDocument({
            id: chatId,
            conversationType: 'chat',
            title: `Conversation ${chatId.slice(0, 12)}`
        });

        const nodes = this.store.nodePool.map((message) => {
            const stored = STProtocol.toStorage(message);
            if (message.id === this.store.activeLeafId) {
                stored.extra = stored.extra || {};
                stored.extra.tier1Snapshot = pluginMetadata.tier1;
                stored.extra.tier3Snapshot = pluginMetadata.tier3;
                stored.extra.nextPlan = pluginMetadata.nextPlan;
            }
            return stored as unknown as LuminaChatMessage;
        });

        return {
            ...base,
            id: chatId,
            activeLeafId: this.store.activeLeafId,
            updatedAt: Date.now(),
            nodes,
            pluginState: {
                ...base.pluginState,
                chat: {
                    ...(base.pluginState.chat || {}),
                    pluginData: pluginMetadata
                }
            },
            transaction: base.transaction,
            summary: {
                previewMessage: base.summary?.previewMessage || '',
                messageCount: nodes.length
            }
        };
    }

    /**
     * 从独立存储加载数据并灌入 Store
     */
    async loadFromIndependentChat(
        targetChatId?: string,
        options: { applyMetadataHooks?: boolean } = {}
    ): Promise<boolean> {
        return this._enqueue(async () => {
            const contextIds = (lwStorage as unknown as { _getContextIds: () => { chatId: string } })._getContextIds();
            const chatId = STClient.normalizeChatId(targetChatId || contextIds.chatId);
            if (!chatId) return false;
            const applyMetadataHooks = options.applyMetadataHooks !== false;

            try {
                const snapshot = await this._fetchIndependentChatSnapshot(chatId);
                this.store.setNodes(snapshot.messages);
                this.store.activeLeafId = snapshot.activeLeafId;

                console.log(`[PersistenceService] 已从独立存储加载 ${snapshot.messages.length} 条消息`);

                if (!applyMetadataHooks) {
                    return true;
                }

                if (snapshot.metadata && snapshot.metadata.pluginData) {
                    pluginManager.callHooks('onMetadataImport' as any, snapshot.metadata.pluginData);
                } else if (this.store.activeLeafId) {
                    const activeNode = this.store.getNode(this.store.activeLeafId);
                    if (activeNode && activeNode.extra) {
                        const recoveredData = {
                            tier1: activeNode.extra.tier1Snapshot,
                            tier3: activeNode.extra.tier3Snapshot,
                            nextPlan: activeNode.extra.nextPlan
                        };
                        pluginManager.callHooks('onMetadataImport' as any, recoveredData);
                    }
                } else {
                    pluginManager.callHooks('onMetadataImport' as any, null);
                }
                return true;
            } catch (e: any) {
                if (e?.message?.includes('404')) {
                    if (applyMetadataHooks) {
                        pluginManager.callHooks('onMetadataImport' as any, null);
                    }
                    return true;
                }
                console.warn('[PersistenceService] 加载失败:', e);
            }
            return false;
        });
    }

    /**
     * 增量同步本地节点池到后端
     * @param targetChatId 目标会话 ID
     * @param forceFull 是否强制全量覆盖
     */
    async syncToIndependentChat(targetChatId?: string, forceFull = false): Promise<void> {
        return this._enqueue(async () => {
            const chatId = STClient.normalizeChatId(targetChatId || lwStorage._getContextIds().chatId);
            if (!chatId) return;

            if (!this.isLoadedProvider()) {
                console.warn(`[PersistenceService] 拒绝物理写回: 当前会话 [ID: ${chatId}] 的独立存储数据尚未同步成功或初始化中。为了保护分支数据，本次保存已拦截。`);
                return;
            }

            await this._waitForTransactions(chatId);

            try {
                // 1. 获取后端当前状态 (快照对比)
                let remoteDocument: ConversationDocument | null = null;
                try {
                    const data = await BridgeDispatcher.conversation.getConversation(chatId);
                    remoteDocument = data.document;
                } catch (e) {
                    // ignore error, assume empty
                }
                const remoteMetadata = remoteDocument ? {
                    activeLeafId: remoteDocument.activeLeafId,
                    updatedAt: remoteDocument.updatedAt,
                    pluginData: remoteDocument.pluginState.chat?.pluginData || null,
                    transaction: remoteDocument.transaction
                } : null;
                const remoteCommittedSeq = this._extractLastCommittedSeq(remoteMetadata);
                if (typeof remoteCommittedSeq === 'number') {
                    await this._persistLastCommittedSeq(chatId, remoteCommittedSeq);
                }

                // 2. 预处理数据 (过滤 metadata)
                const remoteNodes = remoteDocument?.nodes || [];
                const localNodes = this.store.nodePool;
                const hasLocalChanges = localNodes.some(n => n.syncStatus === 'local');

                // 3. 分析差异
                const metadataChanged = (remoteMetadata?.activeLeafId || null) !== (this.store.activeLeafId || null);

                // 4. 执行同步策略
                // 核心优化：如果没有本地变更且元数据未变，且非强制全量，则跳过同步
                if (!hasLocalChanges && !metadataChanged && !forceFull && remoteNodes.length > 0) {
                    return;
                }

                const diff = SyncUtils.comparePools(localNodes, remoteNodes);
                if (forceFull || remoteNodes.length === 0) {
                    console.log(`[PersistenceService] 执行全量覆盖保存 [ID: ${chatId}]`);
                    const payload = await this._prepareConversationDocument(chatId);
                    const payloadDigest = TransactionEngine.digest(payload);
                    await this._mutateWithCompensation(chatId, 'chat.save', payloadDigest, async (transactionContext) => {
                        return await BridgeDispatcher.conversation.saveConversation(chatId, {
                            ...payload,
                            transaction: {
                                ...payload.transaction,
                                lastCommittedSeq: transactionContext.expectedSeq,
                                lastTransactionId: transactionContext.lastTransactionId || payload.transaction.lastTransactionId
                            }
                        }) as any;
                    });
                    
                    // 全量同步后的状态清理
                    this.store.nodePool.forEach(n => {
                        n.syncStatus = 'synced';
                    });
                    return;
                }

                if (diff.added.length > 0 || diff.updated.length > 0 || diff.deletedIds.length > 0 || metadataChanged) {
                    console.log(`[PersistenceService] 执行 PATCH 增量同步 (新增: ${diff.added.length}, 更新: ${diff.updated.length}, 删除: ${diff.deletedIds.length})`);

                    const pluginMetadata: Record<string, any> = {};
                    pluginManager.callHooks('onMetadataExport', pluginMetadata);

                    const patchPayload: ConversationMutation = {
                        nodes: {
                            added: diff.added.map(m => STProtocol.toStorage(m) as unknown as LuminaChatMessage),
                            updated: diff.updated.map(m => STProtocol.toStorage(m) as unknown as LuminaChatMessage),
                            deletedIds: diff.deletedIds
                        },
                        activeLeafId: this.store.activeLeafId,
                        updatedAt: Date.now(),
                        pluginState: {
                            chat: {
                                pluginData: pluginMetadata
                            }
                        }
                    };
                    const payloadDigest = TransactionEngine.digest(patchPayload);
                    await this._mutateWithCompensation(chatId, 'chat.patch', payloadDigest, async (_transactionContext) => {
                        const payload = await BridgeDispatcher.conversation.mutateConversation(chatId, patchPayload) as any;
                        
                        // 标记成功同步
                        [...diff.added, ...diff.updated].forEach(n => {
                            n.syncStatus = 'synced';
                        });
                        return payload;
                    });
                }
            } catch (e) {
                console.error('[PersistenceService] 同步失败:', e);
                // 发生错误时，如果不强制全量，可以考虑重试或记录
            }
        });
    }

    /**
     * 兼容性保留：执行保存动作
     */
    async saveToIndependentChat(targetChatId?: string): Promise<void> {
        return this.syncToIndependentChat(targetChatId, true);
    }

    /**
     * 增量追加单条消息 (重定向到同步逻辑)
     */
    async appendToIndependentChat(msg: LuminaChatMessage, targetChatId?: string): Promise<void> {
        // 先确保消息有 ID 和指纹
        if (!msg.fingerprint) msg.fingerprint = SyncUtils.getFingerprint(msg.mesRaw);
        return this.syncToIndependentChat(targetChatId, false);
    }

}
