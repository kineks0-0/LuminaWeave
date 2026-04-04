import { LuminaWeaveAPIBase } from './LuminaWeaveAPIBase.js';
import { SyncUtils } from './SyncUtils.js';
import { LuminaChatMessage } from './ChatManager.js';

export interface TimelineNode extends LuminaChatMessage {
    text: string; // 兼容旧版 UI 字段
    timestamp: number; // 兼容旧版 UI 字段
    _original?: LuminaChatMessage;
}

/**
 * TimelineManager (世界线管理器)
 * 职责：作为视图适配器，负责将底层的 WorldlineStore 数据转换为 UI 友好的格式。
 * 本组件已重构为无状态模式，不再持有图谱副本。
 */
export class TimelineManager extends LuminaWeaveAPIBase {
    private parentApi: any;
    public isSyncing: boolean = false;

    constructor(parentApi: any) {
        super();
        this.parentApi = parentApi;
    }

    /**
     * 同步当前聊天分支 (触发视图重新计算信号)
     */
    async syncTimelineWithCurrentChat(): Promise<void> {
        this.isSyncing = true;
        try {
            const store = this.parentApi.chatManager.store;
            const localPool = store.nodePool;
            const activeLeafId = store.activeLeafId;

            // 动态转换并构建临时视图对象，不再持久化在内存中
            const chatGraph: Record<string, TimelineNode> = {};

            localPool.forEach((msg: LuminaChatMessage) => {
                const id = msg.id;
                if (!id) return;

                const node: TimelineNode = {
                    ...msg,
                    text: msg.mes || msg.mesRaw || '',
                    timestamp: msg.extra?.send_date || Date.now(),
                    _original: msg
                };
                chatGraph[id] = node;
            });

            // 触发更新事件，UI 订阅者将收到最新的转换后图谱
            this.emit('TIMELINE_UPDATED', { 
                graph: chatGraph, 
                activeId: activeLeafId 
            });
        } finally {
            this.isSyncing = false;
        }
    }

    /**
     * 辅助方法：生成稳定指纹
     */
    public generateStableIds(messages: LuminaChatMessage[]): string[] {
        return messages.map((msg: LuminaChatMessage) => SyncUtils.getFingerprint(msg.mesRaw || msg.mes || ''));
    }

    /**
     * 获取指定分支的完整链
     * 转发至权威存储层 WorldlineStore
     */
    getTrace(leafId: string): TimelineNode[] {
        const store = this.parentApi.chatManager.store;
        const rawTrace = store.getTrace(leafId);
        
        // 转换为 UI 兼容的 TimelineNode 格式
        return rawTrace.map((msg: LuminaChatMessage) => ({
            ...msg,
            text: msg.mes || msg.mesRaw || '',
            timestamp: msg.extra?.send_date || Date.now(),
            _original: msg
        }));
    }
}
