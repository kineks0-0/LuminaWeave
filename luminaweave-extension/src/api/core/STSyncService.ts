import { WorldlineStore, WorldlineEvent } from './WorldlineStore';
import { LuminaChatMessage } from './ChatManager';
import { lwStorage } from '../storage';
import { ContextCompactor } from './ContextCompactor';
import { ContextControlSettings } from './types';
import { STAdapter } from './STAdapter';
import { STProtocol } from './st-adapter/STProtocol';
import { SyncUtils } from './SyncUtils';

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

    private _repairLinks(nodeInStore: LuminaChatMessage, targetParentId: string | null, stNode: any, ignoreST: boolean): boolean {
        let nodeChanged = false;
        
        if (nodeInStore.id === targetParentId) {
            console.warn(`[STSyncService] 跳过自引关联: ${nodeInStore.id}`);
        } else if (nodeInStore.parentId !== targetParentId) {
            console.debug(`[STSyncService] 修复节点关联: ${nodeInStore.id} -> ${targetParentId}`);
            nodeInStore.parentId = targetParentId;
            nodeChanged = true;
        }

        if (!ignoreST) {
            const stWriteText = STProtocol.normalize(stNode?.mes ?? '');
            const localWriteText = STProtocol.normalize(STProtocol.resolveForSTWrite(nodeInStore));
            const stExtraMesRaw = typeof stNode?.extra?.mesRaw === 'string' ? stNode.extra.mesRaw : undefined;
            const stHasStableFingerprint = typeof stNode?.extra?.fingerprint === 'string' && stNode.extra.fingerprint.length > 0;
            const stHasStableStFingerprint = typeof stNode?.extra?.stFingerprint === 'string' && stNode.extra.stFingerprint.length > 0;
            const stFingerprint = stHasStableStFingerprint ? stNode.extra.stFingerprint : STProtocol.getSTFingerprint(stWriteText);
            const localStFingerprint =
                nodeInStore.stFingerprint
                || (typeof nodeInStore?.extra?.stFingerprint === 'string' ? nodeInStore.extra.stFingerprint : '')
                || STProtocol.getSTFingerprint(localWriteText);

            const stActualState = { ...stNode, mesST: stWriteText };
            const isStateEqual = STProtocol.isStateEqual(nodeInStore, stActualState);
            const isSTFingerprintChanged = localStFingerprint !== stFingerprint;
            const isUserEditedInST = isSTFingerprintChanged && (!isStateEqual || stWriteText !== localWriteText);
            const isFingerprintChanged = stHasStableFingerprint && nodeInStore.fingerprint !== stNode.extra.fingerprint;

            if (isUserEditedInST || isFingerprintChanged || isSTFingerprintChanged) {
                // Inline mergeNodeState equivalent
                if (stNode.mes !== undefined) nodeInStore.mes = stNode.mes;
                if (stNode.name !== undefined) nodeInStore.name = stNode.name;
                if (stNode.role !== undefined) nodeInStore.role = stNode.role;
                if (stNode.is_hidden !== undefined) nodeInStore.is_hidden = stNode.is_hidden;

                nodeInStore.mesST = stWriteText;
                nodeInStore.extra = { ...(stNode.extra || {}), ...(nodeInStore.extra || {}) };
                nodeInStore.extra.mesST = stWriteText;
                nodeInStore.stFingerprint = stFingerprint;
                nodeInStore.extra.stFingerprint = stFingerprint;

                if (stExtraMesRaw) {
                    const nextMesRaw = STProtocol.normalize(stExtraMesRaw);
                    if (nextMesRaw && nodeInStore.mesRaw !== nextMesRaw) {
                        nodeInStore.mesRaw = nextMesRaw;
                        nodeInStore.extra.mesRaw = nextMesRaw;
                    }
                } else if (isUserEditedInST) {
                    if (stWriteText && nodeInStore.mesRaw !== stWriteText) {
                        nodeInStore.mesRaw = stWriteText;
                        nodeInStore.extra.mesRaw = stWriteText;
                    }
                }

                if (stHasStableFingerprint) {
                    nodeInStore.fingerprint = stNode.extra.fingerprint;
                } else if (isUserEditedInST) {
                    const canonicalForFp = STProtocol.resolveForFingerprint({ mesRaw: nodeInStore.mesRaw, extra: { mesRaw: nodeInStore.mesRaw } });
                    nodeInStore.fingerprint = STProtocol.getFingerprint(canonicalForFp);
                    nodeInStore.extra.fingerprint = nodeInStore.fingerprint;
                }

                nodeChanged = true;
            }

            if (stNode.mesSummary !== undefined && nodeInStore.mesSummary !== stNode.mesSummary) {
                nodeInStore.mesSummary = stNode.mesSummary;
                nodeChanged = true;
            }
            if (stNode.extra?.compressionState !== nodeInStore.extra?.compressionState) {
                nodeInStore.extra = nodeInStore.extra || {};
                nodeInStore.extra.compressionState = stNode.extra?.compressionState;
                nodeChanged = true;
            }
        }
        
        return nodeChanged;
    }


    async syncFromST(options: { forceOverwrite?: boolean; ignoreST?: boolean } = {}): Promise<{ totalDiff: number; details?: any }> {
        const snapshot = await STAdapter.getSnapshot({ ensureStableIds: true });
        const messages = snapshot.lumina;
        const previousActiveLeafId = this.store.activeLeafId;
        const nowTs = Date.now();
        const suppressLoopbackWindowMs = Number(lwStorage.get('lumina-chat.syncLoopbackWindowMs', 1600, 'Global')) || 1600;
        const ignoreSTSetting = Boolean(lwStorage.get('lumina-chat.syncIgnoreST', false, 'Global'));
        const hasLocalAuthority = this.store.nodePool.length > 0;
        const ignoreST = (options.ignoreST ?? ignoreSTSetting) && hasLocalAuthority;

        console.log(`[STSyncService] syncFromST: ST 消息数=${messages.length}, 本地池数=${this.store.nodePool.length}, forceOverwrite=${options.forceOverwrite}, ignoreST=${ignoreST}`);

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
                    // 落实插件权威：合并元数据时优先保留本地特有数据 (如快照、变更量)
                    stNode.extra = {
                        ...(stNode.extra || {}),
                        ...(existing.extra || {}) 
                    };
                    console.debug(`[STSyncService] 强行对齐时落实插件权威，合并元数据: ${stNode.id}`);
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
                }
                if (!dedupCandidate && lastNodeInStore && lastNodeInStore.fingerprint === stNode.fingerprint) {
                    dedupCandidate = lastNodeInStore;
                }
            }

            const isLoopback = SyncUtils.isLuminaSyncMessage(msgNode, nowTs, suppressLoopbackWindowMs)
                || SyncUtils.isLuminaSyncMessage(stNode, nowTs, suppressLoopbackWindowMs);

            if (!nodeInStore && dedupCandidate) {
                nodeInStore = dedupCandidate;
            }

            if (nodeInStore) {
                const targetParentId = lastNodeInStore ? lastNodeInStore.id : null;
                let nodeChanged = this._repairLinks(nodeInStore, targetParentId, stNode, ignoreST);
                
                if (nodeChanged) {
                    this.store.upsertNode(nodeInStore, true); // 静默更新
                    changed = true;
                }
                lastNodeInStore = nodeInStore;
            } else {
                if (ignoreST) {
                    continue;
                }
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
            const result = this.store.selfDeduplicate();
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
        // 确保对比前能获取到 ST 呈现的最准确的 mesST
        const diffData = STAdapter.compareStates(localForCompare, messages);
        return { 
            totalDiff: diffData.diffCount, 
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

            // 1. 获取动态上下文压缩设置
            const settings = SyncUtils.getDccSettings();

            // 2. 执行压缩计算
            console.log(`[STSyncService] 执行上下文压缩逻辑 (${settings.fullMode}, ${settings.summaryMode})...`);
            const compactedTrace = await ContextCompactor.compact(activeTrace, settings);
            
            const snapshot = await STAdapter.getSnapshot({ ensureStableIds: true });
            const stCurrent = snapshot.lumina;
            console.log(`[STSyncService] 应用差量: Trace(${compactedTrace.length}) -> ST(${stCurrent.length})`);
            const diffData = STAdapter.compareStates(compactedTrace, stCurrent);
            await STAdapter.applyDelta(diffData, compactedTrace, stCurrent, snapshot.idToIndex);
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
