import { lwStorage } from '../storage.js';
import { STProtocol } from './st-adapter/STProtocol.js';
import { LuminaChatMessage as LuminaChatMessage } from './ChatManager.js';
import { WorldlineStore } from './WorldlineStore.js';
import { SyncUtils } from './SyncUtils.js';
import { STClient } from './st-adapter/STClient.js';
import { pluginManager } from '../../core/PluginManager.js';
import { TransactionContextPayload, TransactionErrorPayload, TransactionMutationResponse, TransactionQueryResponse, TransactionScope } from './TransactionProtocol.js';

/**
 * PersistenceService
 * 负责对话数据的物理持久化逻辑 (JSONL 存储与加载)
 */
export class PersistenceService {
    private _opQueue: Promise<unknown> = Promise.resolve();
    private _lastCommittedSeqByChat: Map<string, number> = new Map();
    // integratedTxIdByChat 表示当前本地节点池所集成（对齐）的服务器事务 ID
    private _integratedTxIdByChat: Map<string, string> = new Map();

    // private _opQueue: Promise<any> = Promise.resolve();

    constructor(
        private store: WorldlineStore,
        private isLoadedProvider: () => boolean
    ) { }

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

    private _setIntegratedTxId(chatId: string, txId: string): void {
        this._integratedTxIdByChat.set(chatId, txId);
    }

    private _buildTransactionContext(chatId: string, scope: TransactionScope, payloadDigest: string): TransactionContextPayload {
        const expectedSeq = this._getLastCommittedSeq(chatId);
        const lastTransactionId = this.getIntegratedTxId(chatId);
        return {
            expectedSeq,
            idempotencyKey: `${scope}:${chatId}:${payloadDigest}`,
            lastTransactionId
        };
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
        this._setLastCommittedSeq(chatId, seq);
        const context = lwStorage._getContextIds();
        if (context.chatId !== chatId) return;
        await lwStorage.set('lumina-chat.lastCommittedTxnSeq', seq, 'Chat');
    }

    private async _handleTransactionResponse(chatId: string, res: Response): Promise<void> {
        if (!res.ok) {
            if (res.status === 409) {
                const conflict = await res.json() as TransactionMutationResponse;
                const conflictSeq = typeof conflict.lastCommittedSeq === 'number' ? conflict.lastCommittedSeq : 0;
                await this._persistLastCommittedSeq(chatId, conflictSeq);
                const detail = conflict.error?.message || '事务序列冲突';
                throw new Error(`TXN_SEQUENCE_CONFLICT:${detail}`);
            }
            throw new Error(`REQUEST_FAILED:${res.status}`);
        }
        const payload = await res.json() as TransactionMutationResponse;
        const committedSeq = typeof payload.lastCommittedSeq === 'number'
            ? payload.lastCommittedSeq
            : (typeof payload.transaction?.seq === 'number' ? payload.transaction.seq : null);
        if (typeof committedSeq === 'number') {
            await this._persistLastCommittedSeq(chatId, committedSeq);
        }
        if (payload.transaction?.id) {
            this._setIntegratedTxId(chatId, payload.transaction.id);
        }
        const txError = payload.error as TransactionErrorPayload | undefined;
        if (txError && txError.code === 'TXN_SEQUENCE_CONFLICT') {
            const detail = txError.message || '事务序列冲突';
            throw new Error(`TXN_SEQUENCE_CONFLICT:${detail}`);
        }
    }

    private async _queryLatestTransaction(chatId: string, scope: TransactionScope, idempotencyKey: string, csrfToken: string): Promise<TransactionQueryResponse | null> {
        const query = new URLSearchParams({
            scope,
            idempotencyKey
        }).toString();
        const res = await fetch(`/api/plugins/luminaweave/chat/${chatId}/transactions?${query}`, {
            headers: { 'X-CSRF-Token': csrfToken }
        });
        if (!res.ok) return null;
        return await res.json() as TransactionQueryResponse;
    }

    private async _queryTransactionsAfterSeq(chatId: string, afterSeq: number, scope: TransactionScope, csrfToken: string): Promise<TransactionQueryResponse | null> {
        const query = new URLSearchParams({
            afterSeq: String(afterSeq),
            scope
        }).toString();
        const res = await fetch(`/api/plugins/luminaweave/chat/${chatId}/transactions?${query}`, {
            headers: { 'X-CSRF-Token': csrfToken }
        });
        if (!res.ok) return null;
        return await res.json() as TransactionQueryResponse;
    }

    private async _runReconciliationCompensation(chatId: string, scope: TransactionScope, idempotencyKey: string, csrfToken: string): Promise<void> {
        const knownSeq = this._getLastCommittedSeq(chatId);
        let queryPayload = await this._queryTransactionsAfterSeq(chatId, knownSeq, scope, csrfToken);
        if (!queryPayload) {
            queryPayload = await this._queryLatestTransaction(chatId, scope, idempotencyKey, csrfToken);
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
        const rollbackRes = await fetch(`/api/plugins/luminaweave/chat/${chatId}/transactions/${tx.id}/rollback`, {
            method: 'POST',
            headers: { 'X-CSRF-Token': csrfToken }
        });
        if (!rollbackRes.ok) return;
        const rollbackPayload = await rollbackRes.json() as TransactionMutationResponse;
        const rollbackSeq = typeof rollbackPayload.lastCommittedSeq === 'number'
            ? rollbackPayload.lastCommittedSeq
            : null;
        if (typeof rollbackSeq === 'number') {
            await this._persistLastCommittedSeq(chatId, rollbackSeq);
        }
    }

    private async _mutateWithCompensation(
        chatId: string,
        scope: TransactionScope,
        payloadDigest: string,
        csrfToken: string,
        sender: (ctx: TransactionContextPayload) => Promise<Response>
    ): Promise<void> {
        const transactionContext = this._buildTransactionContext(chatId, scope, payloadDigest);
        try {
            const firstRes = await sender(transactionContext);
            await this._handleTransactionResponse(chatId, firstRes);
            return;
        } catch (error) {
            const isConflict = error instanceof Error && error.message.startsWith('TXN_SEQUENCE_CONFLICT:');
            if (!isConflict) throw error;
        }
        await this._runReconciliationCompensation(chatId, scope, transactionContext.idempotencyKey, csrfToken);
        const retryContext = this._buildTransactionContext(chatId, scope, payloadDigest);
        const retryRes = await sender(retryContext);
        await this._handleTransactionResponse(chatId, retryRes);
    }

     /**
     * 等待后端所有事务完成
     */
    private async _waitForTransactions(chatId: string, maxWaitMs = 10000): Promise<boolean> {
        const start = Date.now();
        while (Date.now() - start < maxWaitMs) {
            try {
                const csrfToken = await STClient.getCsrfToken();
                const res = await fetch(`/api/plugins/luminaweave/chat/${chatId}/sync-status`, {
                    headers: { 'X-CSRF-Token': csrfToken }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.success && data.isTransactionsCompleted) {
                        return true;
                    }
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
                const csrfToken = await STClient.getCsrfToken();
                // 2. 请求当前最新的事务状态
                const res = await fetch(`/api/plugins/luminaweave/chat/${chatId}/sync-status`, {
                    headers: { 'X-CSRF-Token': csrfToken }
                });
                
                if (res.ok) {
                    const data = await res.json();
                    if (data.success) {
                        const remoteSeq = typeof data.lastCommittedSeq === 'number' ? data.lastCommittedSeq : 0;
                        const remoteTxId = data.lastTransactionId || '';
                        
                        // 3. 同步本地 ID 到前端存储
                        console.log(`[PersistenceService] 执行事务对齐: LocalSeq=${this._getLastCommittedSeq(chatId)}, RemoteSeq=${remoteSeq}, RemoteTxId=${remoteTxId}`);
                        await this._persistLastCommittedSeq(chatId, remoteSeq);
                        if (remoteTxId) {
                            this._setIntegratedTxId(chatId, remoteTxId);
                        }
                    }
                }
            } catch (e) {
                console.warn(`[PersistenceService] 事务 ID 对齐失败 [ID: ${chatId}]`, e);
            }
        });
    }

    /**
     * 从独立存储加载数据并灌入 Store
     */
    async loadFromIndependentChat(): Promise<boolean> {
        return this._enqueue(async () => {
            const contextIds = (lwStorage as unknown as { _getContextIds: () => { chatId: string } })._getContextIds();
            const chatId = contextIds.chatId;
            if (chatId === 'default') return false;

            await this._waitForTransactions(chatId);

            try {
                const csrfToken = await STClient.getCsrfToken();
                const res = await fetch(`/api/plugins/luminaweave/chat/${chatId}`, {
                    headers: { 'X-CSRF-Token': csrfToken }
                });
                if (res.status === 200) {
                    const data = await res.json();
                    if (Array.isArray(data)) {
                        let messages = data;
                        let activeLeafId: string | null = null;
                        let metadata: any = null;

                        if (data.length > 0 && data[0].type === 'metadata') {
                            metadata = data[0];
                            activeLeafId = metadata.activeLeafId || null;
                            messages = data.slice(1);
                        }
                        const remoteCommittedSeq = this._extractLastCommittedSeq(metadata);
                        if (typeof remoteCommittedSeq === 'number') {
                            await this._persistLastCommittedSeq(chatId, remoteCommittedSeq);
                        } else {
                            const localSavedSeq = lwStorage.get('lumina-chat.lastCommittedTxnSeq', 0, 'Chat');
                            if (typeof localSavedSeq === 'number') this._setLastCommittedSeq(chatId, localSavedSeq);
                        }
                        const remoteLastTxId = this._extractLastTransactionId(metadata);
                        if (remoteLastTxId) {
                            this._setIntegratedTxId(chatId, remoteLastTxId);
                        }

                        const normalizedNodes = SyncUtils.ensureFingerprints(messages);

                        // 补充：确保反序列化时恢复基础角色属性，因为独立存储可能没有完整的 metadata
                        normalizedNodes.forEach(n => {
                            if (!n.name) {
                                n.name = n.is_user ? 'You' : 'Assistant';
                            }
                        });

                        this.store.setNodes(normalizedNodes);

                        if (activeLeafId) {
                            this.store.activeLeafId = activeLeafId;
                        } else if (normalizedNodes.length > 0) {
                            this.store.activeLeafId = normalizedNodes[normalizedNodes.length - 1].id;
                        }

                        console.log(`[PersistenceService] 已从独立存储加载 ${normalizedNodes.length} 条消息`);

                        if (metadata && metadata.pluginData) {
                            pluginManager.callHooks('onMetadataImport' as any, metadata.pluginData);
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
                        }
                        return true;
                    }
                } else if (res.status === 404) {
                    // 核心修复：新建对话时，虽然没有独立存储，也应触发插件重置钩子
                    pluginManager.callHooks('onMetadataImport' as any, null);
                    return true;
                }
            } catch (e) {
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
            const chatId = targetChatId || lwStorage._getContextIds().chatId;
            if (chatId === 'default') return;

            if (!this.isLoadedProvider()) {
                console.warn(`[PersistenceService] 拒绝物理写回: 当前会话 [ID: ${chatId}] 的独立存储数据尚未同步成功或初始化中。为了保护分支数据，本次保存已拦截。`);
                return;
            }

            await this._waitForTransactions(chatId);

            try {
                const csrfToken = await STClient.getCsrfToken();

                // 1. 获取后端当前状态 (快照对比)
                const res = await fetch(`/api/plugins/luminaweave/chat/${chatId}`, {
                    headers: { 'X-CSRF-Token': csrfToken }
                });
                let remoteData: any[] = [];
                if (res.ok) {
                    remoteData = await res.json();
                }
                const remoteMetadata = remoteData.find(d => d.type === 'metadata') || null;
                const remoteCommittedSeq = this._extractLastCommittedSeq(remoteMetadata);
                if (typeof remoteCommittedSeq === 'number') {
                    await this._persistLastCommittedSeq(chatId, remoteCommittedSeq);
                }

                // 2. 预处理数据 (过滤 metadata)
                const remoteNodes = remoteData.filter(d => d.type !== 'metadata');
                const localNodes = this.store.nodePool;

                // 3. 分析差异
                const diff = SyncUtils.comparePools(localNodes, remoteNodes);
                const metadataChanged = (remoteMetadata?.activeLeafId || null) !== (this.store.activeLeafId || null);

                // 4. 执行同步策略
                if (forceFull || remoteNodes.length === 0) {
                    console.log(`[PersistenceService] 执行全量覆盖保存 [ID: ${chatId}]`);
                    const payload = this._prepareStoragePayload();
                    const payloadDigest = this._digestPayload(payload);
                    await this._mutateWithCompensation(chatId, 'chat.save', payloadDigest, csrfToken, async (transactionContext) => {
                        return await fetch(`/api/plugins/luminaweave/chat/save/${chatId}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
                            body: JSON.stringify({ data: payload, transactionContext })
                        });
                    });
                    return;
                }

                if (diff.added.length > 0 || diff.updated.length > 0 || diff.deletedIds.length > 0 || metadataChanged) {
                    console.log(`[PersistenceService] 执行 PATCH 增量同步 (新增: ${diff.added.length}, 更新: ${diff.updated.length}, 删除: ${diff.deletedIds.length})`);

                    const pluginMetadata: Record<string, any> = {};
                    pluginManager.callHooks('onMetadataExport', pluginMetadata);

                    const patchPayload = {
                        added: diff.added.map(m => STProtocol.toStorage(m)),
                        updated: diff.updated.map(m => STProtocol.toStorage(m)),
                        deletedIds: diff.deletedIds,
                        metadata: {
                            activeLeafId: this.store.activeLeafId,
                            updatedAt: Date.now(),
                            pluginData: pluginMetadata
                        }
                    };
                    const payloadDigest = this._digestPayload(patchPayload);
                    await this._mutateWithCompensation(chatId, 'chat.patch', payloadDigest, csrfToken, async (transactionContext) => {
                        const requestBody = {
                            ...patchPayload,
                            transactionContext
                        };
                        return await fetch(`/api/plugins/luminaweave/chat/${chatId}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
                            body: JSON.stringify(requestBody)
                        });
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

    private _prepareStoragePayload(): any[] {
        const pluginMetadata: Record<string, any> = {};
        pluginManager.callHooks('onMetadataExport', pluginMetadata);

        const messages = this.store.nodePool.map(m => {
            const stored = STProtocol.toStorage(m);
            // 节点注入状态快照 (仅在活跃节点或关键节点)
            if (m.id === this.store.activeLeafId) {
                stored.extra = stored.extra || {};
                stored.extra.tier1Snapshot = pluginMetadata.tier1;
                stored.extra.tier3Snapshot = pluginMetadata.tier3;
                stored.extra.nextPlan = pluginMetadata.nextPlan;
            }
            return stored;
        });

        const metadata = {
            type: 'metadata',
            activeLeafId: this.store.activeLeafId,
            version: 3.0, // 版本升级
            updatedAt: Date.now(),
            pluginData: pluginMetadata
        };

        return [metadata, ...messages];
    }
}
