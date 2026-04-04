import { WorldlineStore, WorldlineEvent } from './WorldlineStore.js';
import { ContextCompactor } from './ContextCompactor.js';
import { SyncUtils } from './SyncUtils.js';
import { LuminaWeaveAPIBase } from './LuminaWeaveAPIBase.js';

/**
 * DCCManager
 * 响应式 DCC 协调器，负责监听 Store 变动并自动执行上下文压实计算。
 */
export class DCCManager extends LuminaWeaveAPIBase {
    private _debounceTimer: any = null;
    private _isCalculating: boolean = false;

    constructor(private store: WorldlineStore) {
        super();
        // 1. 监听物理变动与分支切换
        this.store.on(WorldlineEvent.UPDATED, () => this.scheduleCompact());
        this.store.on(WorldlineEvent.SWITCHED, () => this.scheduleCompact());
        
        console.debug('[DCCManager] 响应式 DCC 协调器已就绪。');
    }

    /**
     * 预约一次压实计算 (防抖处理以应对批量导入或快速编辑)
     * @param delayMs 延迟时间，默认 150ms
     */
    public scheduleCompact(delayMs: number = 150): void {
        if (this._debounceTimer) clearTimeout(this._debounceTimer);
        this._debounceTimer = setTimeout(() => this.runCompact(), delayMs);
    }

    /**
     * 执行压实逻辑
     */
    public async runCompact(): Promise<void> {
        if (this._isCalculating) return;
        
        const activeLeafId = this.store.activeLeafId;
        if (!activeLeafId) return;

        const trace = this.store.getTrace(activeLeafId);
        if (trace.length === 0) return;

        this._isCalculating = true;
        try {
            const settings = SyncUtils.getDccSettings();
            
            // 执行核心压实算法 (内部有摘要复用逻辑)
            console.debug(`[DCCManager] 自动触发压实计算 (链路长度: ${trace.length})`);
            await ContextCompactor.compact(trace, settings);
            
            // 触发事件，通知 UI (如 Timeline 或 HistoryNode) 刷新显示状态
            this.emit('DCC_COMPLETED', { traceLength: trace.length });
        } catch (err) {
            console.error('[DCCManager] 自动压实计算失败:', err);
        } finally {
            this._isCalculating = false;
        }
    }
}
