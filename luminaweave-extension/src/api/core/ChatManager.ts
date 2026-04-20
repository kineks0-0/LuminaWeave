import { lwStorage } from '../storage.js';
import { SyncUtils, DiffVisualizer, MessageTextResolver } from './SyncUtils.js';
import { PersistenceService } from './PersistenceService.js';
import { STSyncService } from './STSyncService.js';
import { WorldlineStore } from './WorldlineStore.js';
import { LuminaChatMessage } from '@shared/LuminaMessage.js';
import { STAdapter } from './STAdapter.js';
import { STProtocol } from './st-adapter/STProtocol.js';
import { STClient } from './st-adapter/STClient.js';
import { pluginManager } from '../../core/PluginManager.js';
import { globalMemoryManager } from './MemoryManager.js';
import { LuminaWeaveAPIBase } from './LuminaWeaveAPIBase.js';

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';
export interface SyncState {
    status: SyncStatus;
    lastSync: string;
    error?: string;
    details: {
        messageCount: number;
        stCount: number;
        diffCount: number;
        duration: number;
        source: string;
    };
}

export class ChatManager extends LuminaWeaveAPIBase {
    public store: WorldlineStore;
    public sync: STSyncService;
    public persistence: PersistenceService;
    public syncState: SyncState = {
        status: 'idle',
        lastSync: 'never',
        details: {
            messageCount: 0,
            stCount: 0,
            diffCount: 0,
            duration: 0,
            source: 'Unknown'
        }
    };

    private _isActivated = false;
    private _isIndependentLoaded = false;
    private _lastChatId: string | null = null;
    public parentApi: any;

    constructor(parentApi: any) {
        super();
        this.parentApi = parentApi;
        
        // 核心内存池：管理所有消息节点的树状结构与状态
        this.store = new WorldlineStore();
        
        // ST 同步服务：负责将 Lumina 内存池与 SillyTavern 的线性列表进行双向对齐
        this.sync = new STSyncService(this.store);
        
        // 持久化服务：负责与后端独立存储进行通讯
        // 第二个参数 (() => this._isIndependentLoaded) 是加载状态提供者。
        // 其核心用意是防止在独立存储尚未加载成功时触发“空池写回”操作，从而彻底保护用户已有的分支数据。
        this.persistence = new PersistenceService(this.store, () => this._isIndependentLoaded);

        // 转发 store 事件，确保 UI 层能够响应底层数据变动
        this.store.on('UPDATED', () => this.emit('CHAT_UPDATED'));
    }

    get ctx() { return this.parentApi.ctx; }

    get _stLoading(): boolean { return this.sync.isSTLoading; }
    set _stLoading(val: boolean) { this.sync.isSTLoading = val; }

    public getSnapshotNodes(): LuminaChatMessage[] {
        return this.store.nodePool.filter(n => {
            if (!n.extra) return false;
            return Object.keys(n.extra).some(k => k.endsWith('_snapshot') || k.endsWith('_delta'));
        });
    }

    public async clearAllSnapshots(): Promise<{ cleared: number }> {
        const nodes = this.getSnapshotNodes();
        let count = 0;
        nodes.forEach(n => {
            if (n.extra) {
                Object.keys(n.extra).forEach(k => {
                    if (k.endsWith('_snapshot') || k.endsWith('_delta')) {
                        delete n.extra![k];
                        count++;
                    }
                });
            }
        });
        if (count > 0) {
            await this.persistence.saveToIndependentChat(this._lastChatId || '');
            this.emit('CHAT_UPDATED');
        }
        return { cleared: count };
    }

    get localChatData(): LuminaChatMessage[] { return this.store.nodePool; }
    get activeLeafId(): string | null { return this.store.activeLeafId; }
    set activeLeafId(val: string | null) { this.store.activeLeafId = val; }

    /**
     * 激活管理器：开始执行环境监听
     */
    activate() {
        if (this._isActivated) return;
        this._isActivated = true;
        console.log('[ChatManager] 已激活。');
    }

    private isInvalidChatId(chatId: string | null | undefined): boolean {
        return STClient.normalizeChatId(chatId) === null;
    }

    /**
     * 同步数据 (自愈增强版)
     */
    async syncFromST(retryCount: number = 0, options: { skipSave?: boolean; forceOverwrite?: boolean; skipIndependentLoad?: boolean; forceIndependentLoad?: boolean; resolveIntent?: 'st' | 'lumina'; ignoreST?: boolean } = {}): Promise<void> {
        if (!this._isActivated && !options.forceIndependentLoad) {
            console.debug('[ChatManager] 组件未激活，跳过非强制物理同步请求。');
            return;
        }
        if (this.syncState.status === 'syncing') return;

        const { chatId } = lwStorage._getContextIds();
        if (this.isInvalidChatId(chatId)) {
            const hadLiveContext = Boolean(this._lastChatId) || this.store.nodePool.length > 0 || this.store.activeLeafId !== null;
            if (hadLiveContext) {
                console.log(`[ChatManager] 检测到宿主当前聊天已关闭，清空 live store。chatId=${String(chatId)}`);
                this.store.setNodes([]);
                this.store.activeLeafId = null;
                this._lastChatId = null;
                this._isIndependentLoaded = false;
                this.syncState.details = {
                    messageCount: 0,
                    stCount: 0,
                    diffCount: 0,
                    duration: 0,
                    source: 'ST'
                };
                this.emit('DATA_RELOAD');
                this.emit('CHAT_UPDATED');
                pluginManager.callHooks('onChatLoaded', null, []);
            } else {
                this._lastChatId = null;
            }

            this.syncState.status = 'idle';
            return;
        }
        const explicitForceOverwrite = options.forceOverwrite === true;
        let forceOverwriteReason: string | null = explicitForceOverwrite ? 'EXPLICIT_ST_OVERRIDE' : null;

        // 核心增强：自动检测 ChatID 切换
        if (this._lastChatId && chatId !== this._lastChatId) {
            console.log(`[ChatManager] 检测到 ChatID 切换 (${this._lastChatId} -> ${chatId})，执行重载并清理旧数据。`);
            this.store.setNodes([]); 
            this._isIndependentLoaded = false; 
        }
        this._lastChatId = chatId;

        const startTime = Date.now();
        this.syncState.status = 'syncing';

        try {
            const policy = lwStorage.get('lumina-chat.storagePolicy', 'independent', 'Global');
            
            if (policy === 'independent' && !options.skipIndependentLoad) {
                await this.persistence.alignTransactionState(chatId);
                const alreadyHasData = this.store.nodePool.length > 0;
                if (options.forceIndependentLoad || explicitForceOverwrite || !alreadyHasData || !this._isIndependentLoaded) {
                    this._isIndependentLoaded = await this.persistence.loadFromIndependentChat();
                } else {
                    this._isIndependentLoaded = true;
                }
            } else if (policy === 'independent' && options.skipIndependentLoad) {
                this._isIndependentLoaded = true;
            }

            const hasLocalAuthority = this.store.nodePool.length > 0;
            const isBootstrapImport = !hasLocalAuthority;
            if (!forceOverwriteReason && isBootstrapImport) {
                forceOverwriteReason = 'BOOTSTRAP_EMPTY_LOCAL';
            }

            const ignoreSTSetting = Boolean(lwStorage.get('lumina-chat.syncIgnoreST', false, 'Global'));
            const ignoreST = (options.ignoreST ?? ignoreSTSetting) && hasLocalAuthority && !options.resolveIntent;
            
            let totalDiff = 0;
            let details: any = null;

            if (forceOverwriteReason) {
                const syncResult = await this.sync.syncFromST({ forceOverwrite: true });
                totalDiff = syncResult.totalDiff;
                details = syncResult.details;
            } else {
                const diffData = this.parentApi.getSyncDiff();
                details = diffData;
                totalDiff = diffData.diffCount;

                if (ignoreST) {
                    if (diffData.diffCount > 0) {
                        await this.commitToST();
                    }
                    totalDiff = 0;
                } else if (options.resolveIntent) {
                    if (options.resolveIntent === 'lumina') {
                        await this.commitToST();
                        totalDiff = 0;
                    } else if (options.resolveIntent === 'st') {
                        const syncResult = await this.sync.syncFromST({ forceOverwrite: true });
                        totalDiff = syncResult.totalDiff;
                        if (this.store.activeLeafId) {
                            this.triggerPluginTimeTravel(this.store.activeLeafId, true);
                        }
                    }
                } else {
                    if (diffData.hasDivergence) {
                        console.warn('[ChatManager] 检测到时空分歧，发射冲突信号。');
                        this.emit('CHAT_CONFLICT', diffData);
                        this.syncState.status = 'idle';
                        this.syncState.details = {
                            messageCount: this.store.nodePool.length,
                            stCount: (this.ctx as any)?.chat?.length || 0,
                            diffCount: diffData.diffCount || 0,
                            duration: Date.now() - startTime,
                            source: policy === 'independent' ? 'Independent' : 'ST'
                        };
                        return; 
                    } else {
                        const updated = diffData.updated || [];
                        const onlyInST = diffData.onlyInST || [];
                        const onlyInIndependent = diffData.onlyInIndependent || [];

                        const stOriginatedUpdates = updated.filter((u: any) => u._isSTEdit);
                        const swipeBranchSwitchUpdates = updated.filter((u: any) => u._isSwipeBranchSwitch);
                        const luminaOriginatedUpdates = updated.filter((u: any) => !u._isSTEdit && !u._isSwipeBranchSwitch);

                        if (onlyInST.length > 0 || stOriginatedUpdates.length > 0 || swipeBranchSwitchUpdates.length > 0) {
                            const syncResult = await this.sync.syncFromST();
                            totalDiff = syncResult.totalDiff;
                            if (swipeBranchSwitchUpdates.length === 0 && (onlyInIndependent.length > 0 || luminaOriginatedUpdates.length > 0)) {
                                await this.commitToST();
                            }
                        } else if (onlyInIndependent.length > 0 || luminaOriginatedUpdates.length > 0) {
                            await this.commitToST();
                        }
                    }
                }
            }

            this.syncState.details = {
                messageCount: this.store.nodePool.length,
                stCount: (this.ctx as any)?.chat?.length || 0,
                diffCount: totalDiff,
                duration: Date.now() - startTime,
                source: policy === 'independent' ? 'Independent' : 'ST'
            };

            if (!options.skipSave && policy === 'independent') {
                if (totalDiff > 0 || !!forceOverwriteReason || options.resolveIntent) {
                    await this.persistence.saveToIndependentChat(chatId);
                }
            }

            this.syncState.status = 'success';
            this.syncState.lastSync = new Date().toLocaleTimeString();

            this.emit('DATA_RELOAD');
            pluginManager.callHooks('onChatLoaded', this.store.activeLeafId, this.store.nodePool);
            
            if (this.store.activeLeafId) {
                this.triggerPluginTimeTravel(this.store.activeLeafId);
            }
        } catch (err: any) {
            this.syncState.status = 'error';
            this.syncState.error = err.message;
            throw err;
        } finally {
            if (this.syncState.status === 'syncing') {
                this.syncState.status = 'idle';
            }
        }
    }

    async saveToIndependentChat(): Promise<void> {
        const chatId = STClient.normalizeChatId(lwStorage._getContextIds().chatId);
        await this.persistence.saveToIndependentChat(chatId ?? undefined);
    }

    async appendToIndependentChat(msg: LuminaChatMessage): Promise<void> {
        const chatId = STClient.normalizeChatId(lwStorage._getContextIds().chatId);
        await this.persistence.appendToIndependentChat(msg, chatId ?? undefined);
    }

    async commitToST(): Promise<void> {
        if (!this._isActivated) return;
        await this.sync.commitToST();
    }

    /**
     * 分支切换：切换指针并物理回写 ST 以及保存独立存储
     */
    async branchFromNode(targetNodeId: string): Promise<boolean> {
        const chatId = STClient.normalizeChatId(lwStorage._getContextIds().chatId);
        console.log(`[ChatManager] 切换活跃节点至: ${targetNodeId}`);
        
        if (this.store.activeLeafId === targetNodeId) return true;

        this.store.activeLeafId = targetNodeId;
        
        try {
            await this.commitToST();
            await this.persistence.saveToIndependentChat(chatId ?? undefined);
            this.triggerPluginTimeTravel(targetNodeId, true);
            return true;
        } catch (e) {
            console.error('[ChatManager] 切换分支失败:', e);
            return false;
        }
    }

    /**
     * 物理级回滚：删除后续所有节点并物理截断 ST 对接
     */
    async rollbackFromNode(targetNodeId: string): Promise<boolean> {
        const chatId = STClient.normalizeChatId(lwStorage._getContextIds().chatId);
        console.log(`[ChatManager] 物理级回滚起点: ${targetNodeId}`);

        try {
            const currentTrace = this.store.getTrace(this.store.activeLeafId);
            const targetIndex = currentTrace.findIndex(n => n.id === targetNodeId);
            
            if (targetIndex === -1) return false;

            const nodesToDelete = currentTrace.slice(targetIndex + 1);
            nodesToDelete.forEach(n => this.store.removeNode(n.id));

            this.store.activeLeafId = targetNodeId;

            await this.commitToST();
            await this.persistence.saveToIndependentChat(chatId ?? undefined);
            this.triggerPluginTimeTravel(targetNodeId, true);
            return true;
        } catch (e) {
            console.error('[ChatManager] 回滚操作失败:', e);
            return false;
        }
    }

    /**
     * 辅助方法：触发插件的时间穿越钩子
     */
    private triggerPluginTimeTravel(nodeId: string, isBranchSwitch: boolean = false) {
        const trace = this.store.getTrace(nodeId);
        pluginManager.callHooks('onTimeTravel', nodeId, trace, { isBranchSwitch });
    }
}

export type { LuminaChatMessage };
