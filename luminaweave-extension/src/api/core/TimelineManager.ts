import { LuminaWeaveAPIBase } from './LuminaWeaveAPIBase.js';
import { SyncEngine } from './SyncEngine.js';
import { LuminaChatMessage as LuminaChatMessage } from './ChatManager.js';

export interface TimelineNode extends LuminaChatMessage {
    text: string; // 兼容旧版 UI 字段
    timestamp: number; // 兼容旧版 UI 字段
    _original?: LuminaChatMessage;
}

/**
 * TimelineManager (世界线管理器)
 * 负责解析 ST 消息链路并构建非循环图谱
 */
export class TimelineManager extends LuminaWeaveAPIBase {
    private parentApi: { chatManager: { localChatData: LuminaChatMessage[], activeLeafId: string | null } };
    public chatGraph: Record<string, TimelineNode> = {};
    public activeLeafId: string | null = null;
    public isSyncing: boolean = false;

    constructor(parentApi: any) {
        super();
        this.parentApi = parentApi;
    }

    /**
     * 同步当前聊天分支
     */
    async syncTimelineWithCurrentChat(): Promise<void> {
        this.isSyncing = true;
        try {
            // 核心修复：以本地影子系统的节点池为基准构建全量图谱，而不是仅监听 ST 的线性视图
            const localPool = this.parentApi.chatManager.localChatData || [];

            this.chatGraph = {};

            // 首先将所有节点存入索引
            localPool.forEach((msg: LuminaChatMessage) => {
            const id = msg.id || msg.fingerprint;
            if (!id) return;

            const node: TimelineNode = {
                ...msg,
                id: id,
                fingerprint: id,
                parentId: msg.parentId || null,
                role: msg.role,
                text: msg.mes || msg.mesRaw || '',
                timestamp: msg.send_date || Date.now(),
                _original: msg
            };
            this.chatGraph[id] = node;
        });

        this.activeLeafId = this.parentApi.chatManager.activeLeafId;

        // 核心修复：更鲁棒的指针找回机制
        // 如果 activeLeafId 无效或为空，且图谱有数据，自动回归到物理末尾或池末尾以防面板空白
        const hasData = Object.keys(this.chatGraph).length > 0;
        if (hasData && (!this.activeLeafId || !this.chatGraph[this.activeLeafId])) {
            console.warn('[TimelineManager] activeLeafId 丢失或无效，正在尝试自动校准');
                // 优先寻找池中最后一个节点，因为它通常是最近添加的
                if (localPool.length > 0) {
                const lastMsgId = localPool[localPool.length - 1].id;
                if (this.chatGraph[lastMsgId]) {
                    this.activeLeafId = lastMsgId;
                    this.parentApi.chatManager.activeLeafId = this.activeLeafId;
                    console.log('[TimelineManager] 已校准指针至末尾节点:', this.activeLeafId);
                }
            }
        }

        this.emit('TIMELINE_UPDATED', { graph: this.chatGraph, activeId: this.activeLeafId });
    } finally {
        this.isSyncing = false;
    }
    }


    /**
     * 辅助方法：为整个消息数组批量生成稳定指纹
     */
    public generateStableIds(messages: LuminaChatMessage[]): string[] {
    return messages.map((msg) => SyncEngine.getFingerprint(msg.mesRaw || msg.mes || ''));
}

/**
 * 获取指定分支的完整链
 */
getTrace(leafId: string): TimelineNode[] {
    const trace: TimelineNode[] = [];
    let currId: string | number | null = leafId;
    const visited = new Set<string | number>();

    while (currId !== null) {
        const node: TimelineNode | undefined = this.chatGraph[currId.toString()];
        if (!node || visited.has(currId)) break;

        visited.add(currId);
        trace.unshift(node);
        currId = node.parentId;
    }
    return trace;
}
}
