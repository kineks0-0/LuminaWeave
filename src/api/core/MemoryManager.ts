import { STClient } from './st-adapter/STClient.js';
import type { LuminaChatMessage } from './ChatManager';

/**
 * 状态提供者接口
 * 插件通过实现此接口来参与全局状态的快照与恢复
 */
export interface StateProvider {
    id: string; // 唯一标识，如 'director-store'
    exportSnapshot: () => unknown;
    importSnapshot: (snapshot: unknown) => void;
    reset: () => void;
}

/**
 * 增量状态提供者接口
 * 用于支持 Mutation 等基于指令的增量更新逻辑
 */
export interface IncrementalProvider extends StateProvider {
    flushDeltas: () => unknown[];
    applyDelta: (delta: unknown) => void;
}

/**
 * 全局记忆管理器 (核心)
 * 负责跨节点（聊天分支）的状态快照、回溯与重播逻辑。
 */
export class MemoryManager {
    private providers: Map<string, StateProvider | IncrementalProvider> = new Map();

    /**
     * 注册一个状态提供者
     */
    public registerProvider(provider: StateProvider | IncrementalProvider) {
        this.providers.set(provider.id, provider);
        console.log(`[MemoryManager] Registered state provider: ${provider.id}`);
    }

    /**
     * 捕获当前状态并绑定到消息节点(onMessageAdding 钩子)
     * @param msg 当前正在添加的消息对象     
     * @param trace 当前消息的溯源链路 (不包含当前消息)
     * @param forceSnapshot 是否强制执行全量快照 (用于时空重载等场景)
     */
    public captureState(msg: LuminaChatMessage, trace: LuminaChatMessage[], forceSnapshot: boolean = false) {
        const nodeDepth = trace.length;

        // 1. 处理增量 (Deltas) - 虽然 onMessageAdding 主要是为了初始化节点，但如果已有缓存则尝试冲刷一次 
        this.commitDeltas(msg);

        // 2. 判定是否执行全量快照 (Snapshots)
        // 核心规则：仅在强制模式或检测到是“分支分形点”时执行快照。        
        // 去除 nodeDepth === 0 和 nodeDepth % 10 === 0，实现极简存储与全量重构。
        const isBranchPoint = msg.parentId && trace.length > 0 && trace[trace.length - 1].id !== msg.parentId;
        const shouldSnapshot = forceSnapshot || isBranchPoint;

        if (shouldSnapshot) {
            this.providers.forEach(provider => {
                const snapshot = provider.exportSnapshot();
                if (snapshot !== undefined) {
                    if (!msg.extra) msg.extra = {};
                    msg.extra[`${provider.id}_snapshot`] = snapshot;
                }
            });
            console.log(`[MemoryManager] Snapshot captured at node ${msg.id} (depth ${nodeDepth}).`);
        }
    }

    /**
     * 将解析出的所有增量变动提交给指定消息
     * 常用场景：在生成结束 (onGenerationEnded) 时，将生成过程中产生的指令归口同步。
     */
    public commitDeltas(msg: LuminaChatMessage) {
        this.providers.forEach(provider => {
            if ('flushDeltas' in provider) {
                const deltas = (provider as IncrementalProvider).flushDeltas();
                if (deltas.length > 0) {
                    if (!msg.extra) msg.extra = {};
                    // 如果已存在 delta（极少见），则进行拼接。
                    const existing = msg.extra[`${provider.id}_delta`] || [];
                    msg.extra[`${provider.id}_delta`] = [...existing, ...deltas];
                    console.debug(`[MemoryManager] Committed ${deltas.length} deltas to node ${msg.id} for provider ${provider.id}.`);
                }
            }
        });
    }

    /**
     * 根据节点链路恢复状态 (onMessageSelected 钩子)
     * @param nodeId 目标节点 ID
     * @param trace 目标节点的溯源链路 (包含目标节点本身)
     */
    public restoreState(nodeId: string, trace: LuminaChatMessage[]) {
        console.log(`[MemoryManager] Restoring state for node ${nodeId}, trace length: ${trace.length}`);

        // 1. 初始化：重置所有提供者到干净状态
        this.providers.forEach(p => p.reset());

        // 2. 寻找最近的快照点
        let snapshotIndex = -1;
        for (let i = trace.length - 1; i >= 0; i--) {
            const hasSnapshot = Array.from(this.providers.keys()).some(id => trace[i].extra?.[`${id}_snapshot`]);
            if (hasSnapshot) {
                snapshotIndex = i;
                break;
            }
        }

        // 3. 载入快照
        if (snapshotIndex !== -1) {
            const extra = trace[snapshotIndex].extra;
            this.providers.forEach(provider => {
                const snapshot = extra?.[`${provider.id}_snapshot`];
                if (snapshot) {
                    provider.importSnapshot(snapshot);
                }
            });
            console.log(`[MemoryManager] Base snapshot loaded from depth ${snapshotIndex}.`);
        }

        // 4. 从快照点向下重播增量 (Deltas)
        const replayStartIndex = snapshotIndex !== -1 ? snapshotIndex + 1 : 0;
        for (let i = replayStartIndex; i < trace.length; i++) {
            const extra = trace[i].extra;
            if (!extra) continue;

            this.providers.forEach(provider => {
                const deltas = extra[`${provider.id}_delta`];
                if (Array.isArray(deltas) && 'applyDelta' in provider) {
                    deltas.forEach(d => (provider as IncrementalProvider).applyDelta(d));
                }
            });
        }

        console.log(`[MemoryManager] State restoration complete.`);
    }

    /**
     * 重置所有已注册的状态提供者
     */
    public resetAll() {
        this.providers.forEach(p => p.reset());
        console.log(`[MemoryManager] All providers reset.`);
    }
}

/**
 * 全局记忆管理器单例
 */
export const globalMemoryManager = new MemoryManager();
