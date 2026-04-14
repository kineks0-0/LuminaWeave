import { LuminaChatMessage } from '../../../../shared/LuminaMessage.js';
import { WorldlineStore, WorldlineEvent } from './WorldlineStore.js';
import { LuminaWeaveAPIBase } from './LuminaWeaveAPIBase.js';

export interface MessageListUpdatePayload {
    messages: LuminaChatMessage[];
    activeLeafId: string | null;
}

/**
 * MessageListManager
 * 职责：作为主消息列表的响应式状态中心，根据 WorldlineStore 自动重算并推送扁平化的链路数据。
 * 实现 UDF (单向数据流)：Store -> Manager -> UI
 *
 * 边界：
 * - 负责当前 active leaf 对应链路的消息视图加工
 * - 负责头像、显示文本等消息级展示加工
 * - 不负责会话索引、记忆快照、世界书解析或 Prompt 构建
 */
export class MessageListManager extends LuminaWeaveAPIBase {
    private _messages: LuminaChatMessage[] = [];
    private _isSyncing = false;

    constructor(
        private store: WorldlineStore,
        private avatarResolver: (msg: LuminaChatMessage) => string,
        private regexProcessor?: (text: string, isUser: boolean, depth: number) => string
    ) {
        super();
        this.initListeners();
    }

    private initListeners() {
        // 核心：直接订阅底层存储变动
        this.store.on(WorldlineEvent.SWITCHED, () => this.invalidate());
        this.store.on(WorldlineEvent.UPDATED, () => this.invalidate());
    }

    /**
     * 使当前视图数据失效并触发现计算
     */
    private invalidate() {
        if (this._isSyncing) return;
        this._isSyncing = true;
        
        // 使用微任务调度，防止多节点连刷导致的冗余计算
        Promise.resolve().then(() => {
            this.recalculate();
            this._isSyncing = false;
        });
    }

    private recalculate() {
        const activeLeafId = this.store.activeLeafId;
        const trace = this.store.getTrace(activeLeafId || null);
        
        // 核心加工逻辑：头像、正则、元数据补全
        const processed = trace.map((msg, index) => {
            const depth = trace.length - 1 - index;
            const updated = { ...msg };
            
            // 1. 头像解析 (SSOT: Avatar 由 Manager 统一提供)
            updated.avatarUrl = this.avatarResolver(updated);
            
            // 2. 正则处理 (如果提供)
            if (this.regexProcessor && updated.mesRaw) {
                updated.mes = this.regexProcessor(updated.mesRaw, !!updated.is_user, depth);
            }
            
            return updated;
        });

        this._messages = processed;
        
        // 核心：发射推送负载
        this.emit('MESSAGE_LIST_UPDATED', processed);
        // 兼容旧版事件名
        this.emit('CHAT_UPDATED', processed);
    }

    /**
     * 获取当前消息列表快照
     */
    public get messages(): LuminaChatMessage[] {
        // 如果从未计算过（冷启动），立即同步计算一次
        if (this._messages.length === 0 && this.store.activeLeafId) {
            this.recalculate();
        }
        return this._messages;
    }

    /** 转发 WorldlineStore 的活跃指针 */
    public get activeLeafId(): string | null {
        return this.store.activeLeafId;
    }

    public getSnapshot(): MessageListUpdatePayload {
        return {
            messages: this.messages,
            activeLeafId: this.activeLeafId
        };
    }
}
