import { LuminaWeaveAPIBase } from './LuminaWeaveAPIBase.js';
import { lwStorage } from '../storage.js';
import { ChatConverter } from './ChatConverter.js';
import { SyncEngine } from './SyncEngine.js';
import { WorldlineStore, WorldlineEvent } from './WorldlineStore.js';
import { PersistenceService } from './PersistenceService.js';
import { STSyncService } from './STSyncService.js';
import { STBridge } from './STBridge.js';
import { pluginManager } from '../../core/PluginManager.js';
import { STSwipeInfo } from './types.js';

export interface LuminaChatMessage {
    id: string;                // 节点唯一 ID (UUID 或稳定随机串)，不随内容改变，是持久化与索引的关键
    parentId: string | null;   // 父节点 ID，构建树状结构
    name: string;
    role: string;
    is_user?: boolean;         // 是否为用户消息
    mesRaw: string;            // 原始对话内容: 用于编辑、同步与指纹生成
    mes: string;               // 显示对话内容: 经过正则/插件处理后的文本
    is_hidden?: boolean;       // 是否隐藏 (不发送给大模型): ST 原生可见性控制
    pluginRaw?: string | null;  // 原始回复数据: 保存 LLM 的原始输出（含 XML 标签），mesRaw 仅为从中提取的对话部分
    fingerprint: string;       // 内容指纹: 仅由内容生成，用于检测内容是否发生变化
    send_date: number;
    characterId?: string | number; 
    extra: Record<string, any>; // 扩展元数据
    avatarUrl?: string;        // UI 渲染用的头像 URL
    
    // 以下为 SillyTavern 兼容性字段，仅在内存/同步期间存在，不建议持久化至独立存储
    message_id?: number | null; 
    swipe_id?: number;
    swipes?: string[];
    swipes_info?: STSwipeInfo[];
}

export interface ChatSyncState {
    status: 'idle' | 'syncing' | 'success' | 'error';
    lastSync: string | null;
    error: string | null;
    policy: string;
    details: {
        messageCount: number;
        stCount: number;
        diffCount: number;
        duration: number;
        source: string;
        storageType?: string;
    };
}

/**
 * ChatManager (重构后)
 * 角色：作为旧版 API 的兼容性转发层，协调各专业化 Service
 */
export class ChatManager extends LuminaWeaveAPIBase {
    // 核心 Store 与 Services
    public store: WorldlineStore;
    public persistence: PersistenceService;
    public sync: STSyncService;

    // 兼容性字段代理
    public syncState: ChatSyncState;
    public _committing = false; // 用于某些 legacy 锁判定
    private _lastChatId: string | null = null; // 追踪当前加载的 ChatID
    private _isIndependentLoaded = false;

    public get isIndependentLoaded(): boolean {
        return this._isIndependentLoaded;
    }

    constructor(public parentApi?: any) {
        super();
        this.store = new WorldlineStore();
        this.persistence = new PersistenceService(this.store, () => this.isIndependentLoaded);
        this.sync = new STSyncService(this.store);

        this.syncState = {
            status: 'idle',
            lastSync: null,
            error: null,
            policy: 'independent',
            details: { messageCount: 0, stCount: 0, diffCount: 0, duration: 0, source: 'ST' }
        };

        // 转发 Store 事件
        this.store.on(WorldlineEvent.SWITCHED, (id: string | null) => this.emit('CHAT_UPDATED'));
        this.store.on(WorldlineEvent.UPDATED, () => this.emit('CHAT_UPDATED'));
    }

    // --- 兼容性属性代理 ---
    
    get localChatData(): LuminaChatMessage[] { return this.store.nodePool; }
    get activeLeafId(): string | null { return this.store.activeLeafId; }
    set activeLeafId(val: string | null) { this.store.activeLeafId = val; }
    get _stLoading(): boolean { return this.sync.isSTLoading; }
    set _stLoading(val: boolean) { this.sync.isSTLoading = val; }

    /**
     * 同步数据 (兼容旧版调用)
     */
    async syncFromST(retryCount: number = 0, options: { skipSave?: boolean; forceOverwrite?: boolean; skipIndependentLoad?: boolean; forceIndependentLoad?: boolean; resolveIntent?: 'st' | 'lumina' } = {}): Promise<void> {
        if (this.syncState.status === 'syncing') return;

        const { chatId } = lwStorage._getContextIds();
        const explicitForceOverwrite = options.forceOverwrite === true;
        let forceOverwriteReason: string | null = explicitForceOverwrite ? 'EXPLICIT_ST_OVERRIDE' : null;
        // 核心增强：自动检测 ChatID 切换
        if (this._lastChatId && chatId !== this._lastChatId) {
            console.log(`[ChatManager] 检测到 ChatID 切换 (${this._lastChatId} -> ${chatId})，执行重载并清理旧数据。`);
            this.store.setNodes([]); // 显式清理旧数据池
            this._isIndependentLoaded = false; // 切换时重置加载状态
        }
        this._lastChatId = chatId;

        const startTime = Date.now();
        this.syncState.status = 'syncing';

        try {
            // 1. 如果是独立模式，优先加载独立存储
            const policy = lwStorage.get('lumina-chat.storagePolicy', 'independent', 'Global');
            let independentLoaded = false;
            
            // 只有当不跳过加载且（强制覆盖或本地池为空或明确要求强制加载）时才从磁盘加载
            if (policy === 'independent' && !options.skipIndependentLoad) {
                // 核心修复：从后端拉取全量数据前，确保插件已同步并对齐最新的事务操作 ID
                await this.persistence.alignTransactionState(chatId);

                const alreadyHasData = this.store.nodePool.length > 0;
                if (options.forceIndependentLoad || explicitForceOverwrite || !alreadyHasData || !this._isIndependentLoaded) {
                    this._isIndependentLoaded = await this.persistence.loadFromIndependentChat();
                    independentLoaded = this._isIndependentLoaded;
                } else {
                    independentLoaded = true; // 视为已加载
                    this._isIndependentLoaded = true;
                }
            } else if (policy === 'independent' && options.skipIndependentLoad) {
                independentLoaded = true;
                this._isIndependentLoaded = true;
            }

            const hasLocalAuthority = this.store.nodePool.length > 0;
            const isBootstrapImport = !hasLocalAuthority;
            if (!forceOverwriteReason && isBootstrapImport) {
                forceOverwriteReason = 'BOOTSTRAP_EMPTY_LOCAL';
            } else if (!forceOverwriteReason && hasLocalAuthority) {
                console.log('[ChatManager] 同步决策: LOCAL_AUTHORITATIVE_SKIP_IMPORT');
            }
            
            let totalDiff = 0;
            let details: any = null;

            if (forceOverwriteReason) {
                console.log(`[ChatManager] 执行 ST 强覆盖同步: ${forceOverwriteReason}`);
                const syncResult = await this.sync.syncFromST({ forceOverwrite: true });
                totalDiff = syncResult.totalDiff;
                details = syncResult.details;
            } else {
                // 1.2 插件已有数据，先做前置冲突嗅探
                const messages = STBridge.getMessages();
                
                // 修复：在执行比较前，如果独立存储已经加载，尝试将独立存储的 name/role 补回给本地节点池
                // 以防刚加载完还没完全刷新时丢失
                if (independentLoaded) {
                    const stRawMap = new Map(messages.map((m: LuminaChatMessage) => [m.fingerprint, m]));
                    for (const node of this.store.nodePool) {
                        const raw = stRawMap.get(node.fingerprint);
                        if (raw && raw.name && raw.name !== node.name) {
                            node.name = raw.name;
                        }
                    }
                }

                const activeTrace = this.store.getTrace(this.store.activeLeafId);
                const localForCompare = activeTrace.length > 0 ? activeTrace : this.store.nodePool;
                const diffData = SyncEngine.compareStates(localForCompare, messages);
                details = diffData;
                totalDiff = diffData.diffCount;

                // 如果用户有明确的冲突决议意图
                if (options.resolveIntent) {
                    if (options.resolveIntent === 'lumina') {
                        console.log('[ChatManager] 用户决议：以 Lumina 版本为准，写回 ST');
                        await this.commitToST();
                        totalDiff = 0; // 解决完毕
                    } else if (options.resolveIntent === 'st') {
                        console.log('[ChatManager] 用户决议：以 ST 版本为准，覆盖本地');
                        forceOverwriteReason = 'EXPLICIT_ST_OVERRIDE';
                        console.log(`[ChatManager] 执行 ST 强覆盖同步: ${forceOverwriteReason}`);
                        const syncResult = await this.sync.syncFromST({ forceOverwrite: true });
                        totalDiff = syncResult.totalDiff;

                        // 冲突解决后的核心修复：强制重新触发状态恢复，因为节点及其元数据可能已发生质变
                        if (this.store.activeLeafId) {
                            this.triggerPluginTimeTravel(this.store.activeLeafId, true);
                        }
                    }
                } else {
                    // 没有明确决议意图时的自动处理
                    if (diffData.hasDivergence) {
                        // 1.2.1 遇到无法合并的冲突时提醒用户
                        this.syncState.status = 'error';
                        this.syncState.error = '检测到时空分歧（ST 侧与本地均有独特改动）。';
                        this.emit('CHAT_CONFLICT', diffData);
                        return; // 终止同步，等待用户操作
                    } else if (diffData.onlyInST.length > 0 && diffData.onlyInIndependent.length === 0) {
                        // 只有 ST 有新数据（如其他插件生成的），安全合并进来
                        console.log('[ChatManager] 检测到 ST 有新数据，执行安全拉取合并...');
                        const syncResult = await this.sync.syncFromST();
                        totalDiff = syncResult.totalDiff;
                    } else if (diffData.onlyInIndependent.length > 0 && diffData.onlyInST.length === 0) {
                        // 插件有新数据，ST 没有（或落后），以插件为准推送到 ST
                        console.log('[ChatManager] 检测到本地数据领先，尝试向 ST 同步...');
                        await this.commitToST();
                    } else {
                        // 完全一致
                        console.log('[ChatManager] 数据一致，无需同步。');
                    }
                }
            }

            // 3. 实时准备详情（无论成功失败，都应先填充 UI 元数据）
            this.syncState.details = {
                messageCount: this.store.nodePool.length,
                stCount: (this.ctx as any)?.chat?.length || 0,
                diffCount: totalDiff,
                duration: Date.now() - startTime,
                source: policy === 'independent' ? 'Independent' : 'ST'
            };

            // 5. 保存 (锚定当前 chatId)
            // 核心修复：保存逻辑已下沉至 PersistenceService 内部卫检执行 (isIndependentLoaded)
            if (!options.skipSave && policy === 'independent') {
                if (totalDiff > 0 || !!forceOverwriteReason || options.resolveIntent) {
                    await this.persistence.saveToIndependentChat(chatId);
                }
            }

            this.syncState.status = 'success';
            this.syncState.lastSync = new Date().toLocaleTimeString();

            console.log(`[ChatManager] 同步完成: ${this.syncState.lastSync}, 节点数=${this.store.nodePool.length}`);
            this.emit('DATA_RELOAD');

            // --- 核心增强：通知插件对话加载完成 ---
            pluginManager.callHooks('onChatLoaded', this.store.activeLeafId, this.store.nodePool);
            
            // 如果有选中节点，也触发一次状态恢复
            if (this.store.activeLeafId) {
                this.triggerPluginTimeTravel(this.store.activeLeafId);
            }
        } catch (err: any) {
            this.syncState.status = 'error';
            this.syncState.error = err.message;
        }
    }

    async saveToIndependentChat(): Promise<void> {
        const { chatId } = lwStorage._getContextIds();
        await this.persistence.saveToIndependentChat(chatId);
    }

    async appendToIndependentChat(msg: LuminaChatMessage): Promise<void> {
        const { chatId } = lwStorage._getContextIds();
        await this.persistence.appendToIndependentChat(msg, chatId);
    }

    async commitToST(): Promise<void> {
        await this.sync.commitToST();
    }

    /**
     * 分支切换：切换指针并物理回写 ST 以及保存独立存储
     */
    async branchFromNode(targetNodeId: string): Promise<boolean> {
        if (!this.store.hasNode(targetNodeId)) return false;

        const syncService = this.sync;
        syncService.pauseAutoSync();
        try {
            // 1. 切换逻辑指针
            this.store.activeLeafId = targetNodeId;

            // 2. 触发时空重构 (Time Travel)
            this.triggerPluginTimeTravel(targetNodeId);

            // 3. 立即保存独立存储 (确保存储中的指针已更新，防止外部事件触发重载导致回退)
            const { chatId } = lwStorage._getContextIds();
            await this.persistence.saveToIndependentChat(chatId);

            // 4. 物理同步至 ST
            await this.sync.commitToST();

            return true;
        } finally {
            syncService.resumeAutoSync();
        }
    }

    /**
     * 物理回滚：剪枝并更新指针
     */
    async rollbackFromNode(targetNodeId: string): Promise<boolean> {
        if (!this.store.hasNode(targetNodeId)) return false;

        const syncService = this.sync;
        syncService.pauseAutoSync();
        try {
            // 1. 执行物理剪枝
            this.store.removeSubtree(targetNodeId);

            // 2. 切换指针
            this.store.activeLeafId = targetNodeId;

            // 3. 触发时空重构 (Time Travel)
            this.triggerPluginTimeTravel(targetNodeId);

            // 4. 立即保存独立存储
            const { chatId } = lwStorage._getContextIds();
            await this.persistence.saveToIndependentChat(chatId);

            // 5. 物理同步至 ST 
            await this.sync.commitToST();

            return true;
        } finally {
            syncService.resumeAutoSync();
        }
    }

    /**
     * 兼容性代理：获取精简版数据
     */
    getSafeChatDataForStorage(): any[] {
        const messages = this.store.nodePool.map(m => ChatConverter.toStorage(m));
        const metadata = {
            type: 'metadata',
            activeLeafId: this.store.activeLeafId,
            version: 2
        };
        return [metadata, ...messages];
    }

    private _lastRestoredNodeId: string | null = null;

    /**
     * 根据当前世界线位置触发插件层面的状态回溯 (Time Travel)
     */
    private triggerPluginTimeTravel(targetNodeId: string, force: boolean = false) {
        if (!force && this._lastRestoredNodeId === targetNodeId) {
            console.log(`[ChatManager] 时空回溯跳过: 目标节点 ${targetNodeId} 已经是当前状态。`);
            return;
        }

        const trace = this.store.getTrace(targetNodeId);
        if (trace.length === 0) return;

        console.log(`[ChatManager] 触发插件时空回溯: ${targetNodeId}`);
        pluginManager.callHooks('onMessageSelected', targetNodeId, trace);
        this._lastRestoredNodeId = targetNodeId;
    }
}
