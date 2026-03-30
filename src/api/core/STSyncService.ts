import { STBridge } from './STBridge.js';
import { SyncEngine } from './SyncEngine.js';
import { WorldlineStore, WorldlineEvent } from './WorldlineStore.js';
import { LuminaChatMessage } from './ChatManager.js';
import { lwStorage } from '../storage.js';

/**
 * STSyncService
 * 负责影子系统与 SillyTavern 环境的物理同步
 */
export class STSyncService {
    private _committing: boolean = false;
    private _stLoading: boolean = false;
    private _autoSyncPaused: boolean = false;
    private _stGenerating: boolean = false;

    constructor(private store: WorldlineStore) {}

    public get isSTLoading(): boolean { return this._stLoading; }
    public set isSTLoading(val: boolean) { this._stLoading = val; }

    public get isSTGenerating(): boolean { return this._stGenerating; }
    public set isSTGenerating(val: boolean) { this._stGenerating = val; }

    public get isAutoSyncPaused(): boolean { return this._autoSyncPaused; }
    public pauseAutoSync(): void { this._autoSyncPaused = true; }
    public resumeAutoSync(): void { this._autoSyncPaused = false; }

    private _repairLinks(nodeInStore: LuminaChatMessage, targetParentId: string | null, stNode: any): boolean {
        let nodeChanged = false;
        
        if (nodeInStore.id === targetParentId) {
            console.warn(`[STSyncService] 跳过自引关联: ${nodeInStore.id}`);
        } else if (nodeInStore.parentId !== targetParentId) {
            console.debug(`[STSyncService] 修复节点关联: ${nodeInStore.id} -> ${targetParentId}`);
            nodeInStore.parentId = targetParentId;
            nodeChanged = true;
        }
        
        // 更新 ST 侧状态 (如时间戳，message_id)
        if (stNode.send_date && nodeInStore.send_date !== stNode.send_date) {
            nodeInStore.send_date = stNode.send_date;
            nodeChanged = true;
        }
        if (stNode.message_id !== undefined && nodeInStore.message_id !== stNode.message_id) {
            nodeInStore.message_id = stNode.message_id;
            nodeChanged = true;
        }
        
        return nodeChanged;
    }

    private _deduplicateNodes(): { count: number, changed: boolean } {
        let deduplicatedCount = 0;
        let changed = false;
        // 遍历所有节点，按 parentId 分组检查子节点指纹
        const parentToChildren = new Map<string | null, LuminaChatMessage[]>();
        for (const node of this.store.nodePool) {
            const children = parentToChildren.get(node.parentId) || [];
            children.push(node);
            parentToChildren.set(node.parentId, children);
        }
        
        for (const [parentId, children] of parentToChildren.entries()) {
            if (children.length <= 1) continue;
            
            const fingerprintMap = new Map<string, LuminaChatMessage>();
            for (const child of children) {
                if (!child.fingerprint) continue;
                
                const existing = fingerprintMap.get(child.fingerprint);
                if (existing) {
                    // 发现重复节点！保留 existing，将 child 移除
                    console.log(`[STSyncService] 去重验证: 移除同源重复节点 ${child.id} (保留 ${existing.id})`);
                    // 将以 child 为父节点的所有子节点转移给 existing
                    const childsChildren = parentToChildren.get(child.id) || [];
                    for (const cc of childsChildren) {
                        cc.parentId = existing.id;
                        this.store.upsertNode(cc, true);
                    }
                    this.store.removeNode(child.id, true);
                    deduplicatedCount++;
                    changed = true;
                } else {
                    fingerprintMap.set(child.fingerprint, child);
                }
            }
        }
        return { count: deduplicatedCount, changed };
    }

    async syncFromST(options: { forceOverwrite?: boolean } = {}): Promise<{ totalDiff: number; details?: any }> {
        const messages = STBridge.getMessages();
        const previousActiveLeafId = this.store.activeLeafId;
        const nowTs = Date.now();
        const suppressLoopbackWindowMs = Number(lwStorage.get('lumina-chat.syncLoopbackWindowMs', 1600, 'Global')) || 1600;

        console.log(`[STSyncService] syncFromST: ST 消息数=${messages.length}, 本地池数=${this.store.nodePool.length}, forceOverwrite=${options.forceOverwrite}`);

        if (options.forceOverwrite) {
            console.log('[STSyncService] 执行强行分支对齐 (Force Branch Alignment)...');
            // 注意：我们不再调用 setNodes()，而是遍历 ST 消息序列，
            // 确保它们物理存在并强制按照 ST 的线性顺序进行 parentId 重新绑定。
            let prevNode: LuminaChatMessage | null = null;
            for (const stNode of messages) {
                stNode.parentId = prevNode ? prevNode.id : null;
                
                // 核心修复：如果是强制覆盖，检测本地是否已存在该节点
                const existing = this.store.getNode(stNode.id);
                if (existing && existing.extra) {
                    // 合并元数据，优先保留本地特有的插件指令增量与快照
                    stNode.extra = {
                        ...existing.extra,
                        ...stNode.extra // ST 侧的新数据覆盖同名冲突
                    };
                    console.debug(`[STSyncService] 强行对齐时合并元数据: ${stNode.id}`);
                }

                // 使用 upsert 确保节点存在且链接正确
                this.store.upsertNode(stNode, true);
                prevNode = stNode;
            }
            if (prevNode) {
                this.store.activeLeafId = prevNode.id;
            } else {
                this.store.activeLeafId = null;
            }
            this.store.emit(WorldlineEvent.UPDATED);
            return { totalDiff: 0 };
        }

        let lastNodeInStore: LuminaChatMessage | null = null;
        let changed = false;
        let externalNewNodesAdded = 0;
        let loopbackSuppressed = 0;
        const processedIds = new Set<string>();
        const fingerprintToNode = new Map<string, LuminaChatMessage[]>();
        for (const node of this.store.nodePool) {
            if (!node.fingerprint) continue;
            const bucket = fingerprintToNode.get(node.fingerprint) || [];
            bucket.push(node);
            fingerprintToNode.set(node.fingerprint, bucket);
        }

        for (let i = 0; i < messages.length; i++) {
            const stNode = messages[i];
            const msgNode = stNode;
            if (processedIds.has(stNode.id)) {
                console.warn(`[STSyncService] 拦截到 ST 原始数据中的重复 ID, 已跳过以防环: ${stNode.id}`);
                continue;
            }
            processedIds.add(stNode.id);
            let nodeInStore = this.store.getNode(stNode.id);
            
            // 优化：双重匹配机制 (parentId + fingerprint)
            let dedupCandidate: LuminaChatMessage | null = null;
            if (!nodeInStore && stNode.fingerprint) {
                const candidates = fingerprintToNode.get(stNode.fingerprint) || [];
                const targetParentId: string | null = lastNodeInStore ? lastNodeInStore.id : null;
                // 优先查找同父级下指纹相同的节点
                const exactMatch: LuminaChatMessage | undefined = candidates.find(c => c.parentId === targetParentId);
                if (exactMatch) {
                    dedupCandidate = exactMatch;
                } else if (candidates.length > 0) {
                    // 如果没有同父级的，退而求其次找第一个，但后续会修正 parentId
                    dedupCandidate = candidates[0];
                }
            }

            const isLoopback = SyncEngine.isLuminaSyncMessage(msgNode, nowTs, suppressLoopbackWindowMs)
                || SyncEngine.isLuminaSyncMessage(stNode, nowTs, suppressLoopbackWindowMs);

            if (!nodeInStore && dedupCandidate) {
                nodeInStore = dedupCandidate;
            }

            if (nodeInStore) {
                const targetParentId = lastNodeInStore ? lastNodeInStore.id : null;
                let nodeChanged = this._repairLinks(nodeInStore, targetParentId, stNode);
                
                // 核心修复：如果是从 ST 拉取的，且 ST 侧的名字或角色有更新，应同步回本地
                if (stNode.name && stNode.name !== nodeInStore.name) {
                    nodeInStore.name = stNode.name;
                    nodeChanged = true;
                }
                if (stNode.role && stNode.role !== nodeInStore.role) {
                    nodeInStore.role = stNode.role;
                    nodeChanged = true;
                }
                
                if (nodeChanged) {
                    this.store.upsertNode(nodeInStore, true); // 静默更新
                    changed = true;
                }
                lastNodeInStore = nodeInStore;
            } else {
                if (isLoopback) {
                    loopbackSuppressed++;
                    continue;
                }
                stNode.parentId = lastNodeInStore ? lastNodeInStore.id : null;
                this.store.upsertNode(stNode, true);
                lastNodeInStore = stNode;
                externalNewNodesAdded++;
                changed = true;
                if (stNode.fingerprint) {
                    const bucket = fingerprintToNode.get(stNode.fingerprint) || [];
                    bucket.push(stNode);
                    fingerprintToNode.set(stNode.fingerprint, bucket);
                }
            }
        }

        // 去重验证 (Deduplication Pass)
        let deduplicatedCount = 0;
        if (changed || externalNewNodesAdded > 0) {
            const result = this._deduplicateNodes();
            deduplicatedCount = result.count;
            if (result.changed) {
                changed = true;
            }
        }

        if (changed) {
            console.log(`[STSyncService] 同步完成，变化检测：新增=${externalNewNodesAdded}, 抑制回灌=${loopbackSuppressed}, 去重清理=${deduplicatedCount}, 结构已对齐。`);
            this.store.emit(WorldlineEvent.UPDATED); // 统一触发一次 UI 更新
        }
        
        if (previousActiveLeafId && this.store.hasNode(previousActiveLeafId) && externalNewNodesAdded === 0) {
            this.store.activeLeafId = previousActiveLeafId;
        } else if (externalNewNodesAdded > 0 && lastNodeInStore) {
            this.store.activeLeafId = lastNodeInStore.id;
        } else if (previousActiveLeafId && this.store.hasNode(previousActiveLeafId)) {
            this.store.activeLeafId = previousActiveLeafId;
        } else if (lastNodeInStore) {
            this.store.activeLeafId = lastNodeInStore.id;
        } else {
            this.store.activeLeafId = null;
        }

        const activeTrace = this.store.getTrace(this.store.activeLeafId);
        const localForCompare = activeTrace.length > 0 ? activeTrace : this.store.nodePool;
        const diffData = SyncEngine.compareStates(localForCompare, messages);
        return { 
            totalDiff: diffData.onlyInST.length, 
            details: diffData 
        };
    }

    async commitToST(): Promise<void> {
        if (this._committing) {
            console.log('[STSyncService] commitToST 已在运行中，跳过。');
            return;
        }
        this._committing = true;
        this.pauseAutoSync();

        try {
            console.log('[STSyncService] 开始回写 ST...');
            const activeTrace = this.store.getTrace(this.store.activeLeafId);
            
            if (activeTrace.length === 0 && this.store.nodePool.length > 0) {
                console.warn('[STSyncService] 活跃链路为空，取消同步。');
                return;
            }

            // 检查 trace 是否存在明显的异常重复（例如连续相同的指纹超过 10 个且跨度巨大）
            // 这只是一个简单的安全卫检
            if (activeTrace.length > 100) {
                let dupCount = 0;
                for (let i = 1; i < activeTrace.length; i++) {
                    if (activeTrace[i].fingerprint === activeTrace[i-1].fingerprint) dupCount++;
                }
                if (dupCount > activeTrace.length * 0.5) {
                    console.error('[STSyncService] 检测到 trace 中存在大量重复内容，可能存在数据损坏，已拦截同步。', { traceLen: activeTrace.length, dupCount });
                    return;
                }
            }

            const stCurrent = STBridge.getMessages();
            console.log(`[STSyncService] 应用差量: Trace(${activeTrace.length}) -> ST(${stCurrent.length})`);
            await SyncEngine.applyDelta(activeTrace, stCurrent);
            console.log('[STSyncService] ST 同步完成。');
        } catch (err) {
            console.error('[STSyncService] 同步失败:', err);
            throw err;
        } finally {
            this._committing = false;
            setTimeout(() => this.resumeAutoSync(), 500);
        }
    }
}
