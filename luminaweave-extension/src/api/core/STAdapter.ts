import { LuminaChatMessage } from '../../../../shared/LuminaMessage.js';
import { STProtocol } from './st-adapter/STProtocol.js';
import { STClient } from './st-adapter/STClient.js';
import { MessageListGateway } from './MessageListGateway.js';

export interface DiffResult {
    onlyInIndependent: any[];
    onlyInST: any[];
    updated: any[];
    independentSequence: any[];
    stSequence: any[];
    diffCount: number;
    hasConflict: boolean;
    hasDivergence: boolean;
    divergenceIndex: number;
}

export class STAdapter {
    private static isComparableStateEqual(left: any, right: any): boolean {
        return (
            left.fingerprint === right.fingerprint
            && left.stFingerprint === right.stFingerprint
            && STProtocol.normalize(left.name) === STProtocol.normalize(right.name)
            && STProtocol.normalize(left.role) === STProtocol.normalize(right.role)
            && (!!left.is_hidden) === (!!right.is_hidden)
        );
    }

    private static collectSemanticNoopPairs(localOnly: any[], stOnly: any[]): { localIds: Set<string>; stIds: Set<string> } {
        const localIds = new Set<string>();
        const stIds = new Set<string>();
        const stBuckets = new Map<string, any[]>();

        for (const item of stOnly) {
            const key = [
                item.fingerprint ?? '',
                item.stFingerprint ?? '',
                STProtocol.normalize(item.name),
                STProtocol.normalize(item.role),
                item.is_hidden ? '1' : '0'
            ].join('|');
            const bucket = stBuckets.get(key) ?? [];
            bucket.push(item);
            stBuckets.set(key, bucket);
        }

        for (const item of localOnly) {
            const key = [
                item.fingerprint ?? '',
                item.stFingerprint ?? '',
                STProtocol.normalize(item.name),
                STProtocol.normalize(item.role),
                item.is_hidden ? '1' : '0'
            ].join('|');
            const bucket = stBuckets.get(key);
            if (!bucket?.length) continue;
            const match = bucket.shift();
            if (!match) continue;
            localIds.add(item.id);
            stIds.add(match.id);
        }

        return { localIds, stIds };
    }

    /**
     * 比较本地状态和 ST 状态
     */
    public static compareStates(localChat: LuminaChatMessage[], stChat: LuminaChatMessage[]): DiffResult {
        const onlyInIndependent: any[] = [];
        const onlyInST: any[] = [];
        const updated: any[] = [];

        const localSequence = localChat.map(m => this.toComparableMessage(m, 'lumina'));
        const stSequence = stChat.map(m => this.toComparableMessage(m, 'st'));
        
        const stMsgMap = new Map(stSequence.map(m => [m.id, m]));
        const localMsgMap = new Map(localSequence.map(m => [m.id, m]));

        for (const local of localSequence) {
            const stNode = stMsgMap.get(local.id!);
            if (!stNode) {
                onlyInIndependent.push(local);
            } else {
                const metaDiff =
                    STProtocol.normalize(local.name) !== STProtocol.normalize(stNode.name)
                    || STProtocol.normalize(local.role) !== STProtocol.normalize(stNode.role)
                    || (!!local.is_hidden) !== (!!stNode.is_hidden);
                const isDiff =
                    metaDiff
                    || local.stFingerprint !== stNode.stFingerprint;
                
                if (isDiff) {
                    const isSwipeBranchSwitch = this.isSwipeBranchSwitch(local, stNode);
                    const baselineFp =
                        (typeof stNode.stFingerprintStored === 'string' ? stNode.stFingerprintStored : '')
                        || (typeof stNode.mesSTStored === 'string' && stNode.mesSTStored ? STProtocol.getSTFingerprint(stNode.mesSTStored) : '');
                    const isSTEdit =
                        !isSwipeBranchSwitch
                        && (
                            (baselineFp !== '' && baselineFp === local.stFingerprint && stNode.stFingerprint !== baselineFp)
                            || (local.fingerprint === stNode.fingerprint && local.stFingerprint !== stNode.stFingerprint)
                        );
                    updated.push({ ...local, _isSTEdit: isSTEdit, _isSwipeBranchSwitch: isSwipeBranchSwitch });
                }
            }
        }

        for (const st of stSequence) {
            if (!localMsgMap.has(st.id)) {
                onlyInST.push(st);
            }
        }

        const maxLen = Math.max(localSequence.length, stSequence.length);
        let divergenceIndex = -1;

        for (let i = 0; i < maxLen; i++) {
            const left = localSequence[i];
            const right = stSequence[i];
            if (!left || !right || left.id !== right.id) {
                divergenceIndex = i;
                break;
            }
        }

        const swipeBranchSwitches = this.collectSwipeBranchSwitches(localSequence, stSequence);
        const semanticNoopPairs = this.collectSemanticNoopPairs(onlyInIndependent, onlyInST);
        const effectiveUpdated = updated.filter(u => !u._isSwipeBranchSwitch);
        const luminaOriginatedUpdates = effectiveUpdated.filter(u => !u._isSTEdit);
        const effectiveOnlyInIndependent = onlyInIndependent.filter(
            item => !swipeBranchSwitches.localIds.has(item.id) && !semanticNoopPairs.localIds.has(item.id)
        );
        const effectiveOnlyInST = onlyInST.filter(
            item => !swipeBranchSwitches.stIds.has(item.id) && !semanticNoopPairs.stIds.has(item.id)
        );
        const effectiveDiffCount = effectiveOnlyInIndependent.length + effectiveOnlyInST.length + effectiveUpdated.length;
        const hasStructuralDiff = effectiveDiffCount > 0
            ? localSequence.some((left, index) => {
                const right = stSequence[index];
                if (!left || !right) return true;
                if (left.id === right.id) return false;
                return !this.isComparableStateEqual(left, right);
            }) || localSequence.length !== stSequence.length
            : false;

        return {
            onlyInIndependent: effectiveOnlyInIndependent,
            onlyInST: effectiveOnlyInST,
            updated: effectiveUpdated,
            independentSequence: localSequence,
            stSequence,
            diffCount: effectiveDiffCount,
            hasConflict: effectiveDiffCount > 0,
            hasDivergence: (effectiveOnlyInIndependent.length > 0 || luminaOriginatedUpdates.length > 0) && effectiveOnlyInST.length > 0,
            divergenceIndex: hasStructuralDiff ? divergenceIndex : -1
        };
    }

    /**
     * 将状态应用于 ST 环境
     */
    public static async applyDelta(
        diffResult: DiffResult,
        localTrace: LuminaChatMessage[],
        stChat: LuminaChatMessage[],
        stIdToIndex?: Map<string, number>
    ): Promise<void> {
        console.log(`[STAdapter] 开始应用差量更新 (Lumina:${localTrace.length} vs ST:${stChat.length})...`);

        const updates: {
            index: number;
            content: string;
            name?: string;
            role?: string;
            is_hidden?: boolean;
            expectedSwipeId?: number;
            expectedActiveSwipeText?: string;
            extra: any;
        }[] = [];
        const messagesToAppend: any[] = [];
        const indicesToDelete: number[] = [];

        const divergenceIndex = diffResult.divergenceIndex;
        const resolveStIndex = (id: string, fallbackIndex: number): number | null => {
            if (stIdToIndex) {
                const idx = stIdToIndex.get(id);
                return idx === undefined ? null : idx;
            }
            return fallbackIndex;
        };

        for (const updatedMsg of diffResult.updated) {
            const index = localTrace.findIndex(m => m.id === updatedMsg.id);
            if (index !== -1 && (divergenceIndex === -1 || index < divergenceIndex)) {
                const localMsg = localTrace[index];
                const stIndex = resolveStIndex(localMsg.id, index);
                if (stIndex === null) continue;
                const expectedContent = localMsg.mesST || STProtocol.extractMessageText(localMsg, false);
                
                updates.push({
                    index: stIndex,
                    content: expectedContent,
                    name: localMsg.name,
                    role: localMsg.role,
                    is_hidden: localMsg.is_hidden || false,
                    expectedSwipeId: typeof localMsg.extra?.swipe_id === 'number' ? localMsg.extra.swipe_id : undefined,
                    expectedActiveSwipeText:
                        typeof localMsg.extra?.activeSwipeText === 'string'
                            ? localMsg.extra.activeSwipeText
                            : localMsg.mesST,
                    extra: {
                        ...localMsg.extra,
                        ...this.createSyncSourceMeta(),
                        id: localMsg.id,
                        fingerprint: localMsg.fingerprint,
                        stFingerprint: localMsg.stFingerprint || STProtocol.getSTFingerprint(expectedContent),
                        mesRaw: localMsg.mesRaw,
                        compressionState: localMsg.extra?.compressionState,
                        mesSummary: localMsg.mesSummary,
                        pluginRaw: localMsg.pluginRaw,
                        is_hidden: localMsg.is_hidden
                    }
                });
            }
        }

        if (divergenceIndex !== -1) {
            for (let i = divergenceIndex; i < stChat.length; i++) {
                const stNode = stChat[i];
                const stIndex = resolveStIndex(stNode.id, i);
                if (stIndex !== null) indicesToDelete.push(stIndex);
            }
            
            for (let i = divergenceIndex; i < localTrace.length; i++) {
                const localMsg = localTrace[i];
                const message = localMsg.mesST || STProtocol.extractMessageText(localMsg, false);
                messagesToAppend.push({
                    role: localMsg.role,
                    name: localMsg.name,
                    mesST: message,
                    mesRaw: localMsg.mesRaw,
                    is_hidden: localMsg.is_hidden || false,
                    extra: {
                        ...localMsg.extra,
                        ...this.createSyncSourceMeta(),
                        id: localMsg.id,
                        fingerprint: localMsg.fingerprint,
                        stFingerprint: localMsg.stFingerprint || STProtocol.getSTFingerprint(message),
                        mesRaw: localMsg.mesRaw,
                        compressionState: localMsg.extra?.compressionState,
                        mesSummary: localMsg.mesSummary,
                        pluginRaw: localMsg.pluginRaw,
                        is_hidden: localMsg.is_hidden
                    }
                });
            }
        }

        if (updates.length > 0) await STClient.updateMessages(updates, true);
        if (indicesToDelete.length > 0) await STClient.deleteMessages(indicesToDelete, true);
        if (messagesToAppend.length > 0) await STClient.appendMessages(messagesToAppend, true);
        
        await STClient.flush();
    }

    public static createSyncSourceMeta(): Record<string, any> {
        // 使用 window.SillyTavern.getContext().chatId 等获取，暂时简化
        const chatId = typeof window !== 'undefined' && (window as any).SillyTavern ? (window as any).SillyTavern.getContext()?.chatId : null;
        return {
            '_lw_sync_source': 'lumina',
            '_lw_sync_ts': Date.now(),
            '_lw_sync_chat_id': chatId || null
        };
    }

    private static toComparableMessage(msg: LuminaChatMessage, side: 'st' | 'lumina'): any {
        const { id, fingerprint } = STProtocol.identifyMessage(msg);
        const finalMes = side === 'st'
            ? STProtocol.normalize(msg.mes ?? msg.mesST ?? STProtocol.resolveForSync(msg))
            : STProtocol.normalize(STProtocol.resolveForSync(msg));
        const normalizedRole = STProtocol.normalizeRole(msg.role, msg.is_user === true || msg.role === 'user');
        const stFingerprintStored =
            (typeof msg?.extra?.stFingerprint === 'string' ? msg.extra.stFingerprint : '')
            || (typeof msg.stFingerprint === 'string' ? msg.stFingerprint : '');
        const mesSTStored =
            (typeof msg?.extra?.mesST === 'string' ? msg.extra.mesST : '')
            || (typeof msg.mesST === 'string' ? msg.mesST : '');
        const compareText = side === 'st'
            ? (msg.mesST ?? STProtocol.resolveForSTWrite(msg))
            : (msg.mesST ?? (typeof msg?.extra?.mesST === 'string' ? msg.extra.mesST : undefined) ?? STProtocol.resolveForSTWrite(msg));
        return {
            id,
            name: msg?.name || '',
            role: normalizedRole,
            mes: finalMes,
            mesRaw: msg.mesRaw || '',
            fingerprint,
            stFingerprint: STProtocol.getSTFingerprint(compareText),
            stFingerprintStored,
            mesSTStored,
            is_hidden: msg.is_hidden,
            mesST: msg.mesST,
            message_id: msg.extra?.message_id,
            swipe_id: msg.extra?.swipe_id,
            swipeCount: msg.extra?.swipeCount,
            activeSwipeText: msg.extra?.activeSwipeText,
            parentId: msg.parentId ?? null
        };
    }

    private static isSwipeBranchSwitch(local: any, stNode: any): boolean {
        const localMessageId = typeof local?.message_id === 'number' ? local.message_id : undefined;
        const stMessageId = typeof stNode?.message_id === 'number' ? stNode.message_id : undefined;
        if (localMessageId === undefined || stMessageId === undefined || localMessageId !== stMessageId) {
            return false;
        }

        const localSwipeCount = typeof local?.swipeCount === 'number' ? local.swipeCount : 0;
        const stSwipeCount = typeof stNode?.swipeCount === 'number' ? stNode.swipeCount : 0;
        if (localSwipeCount <= 1 && stSwipeCount <= 1) {
            return false;
        }

        const localSwipeId = typeof local?.swipe_id === 'number' ? local.swipe_id : undefined;
        const stSwipeId = typeof stNode?.swipe_id === 'number' ? stNode.swipe_id : undefined;
        if (localSwipeId !== undefined && stSwipeId !== undefined && localSwipeId !== stSwipeId) {
            return true;
        }

        return local.id !== stNode.id && local.parentId === stNode.parentId;
    }

    private static collectSwipeBranchSwitches(localSequence: any[], stSequence: any[]): { localIds: Set<string>; stIds: Set<string> } {
        const localIds = new Set<string>();
        const stIds = new Set<string>();
        const maxLen = Math.max(localSequence.length, stSequence.length);

        for (let i = 0; i < maxLen; i++) {
            const local = localSequence[i];
            const stNode = stSequence[i];
            if (!local || !stNode) continue;
            if (!this.isSwipeBranchSwitch(local, stNode)) continue;
            localIds.add(local.id);
            stIds.add(stNode.id);
        }

        return { localIds, stIds };
    }

    // 暴露常用的高阶接口
    public static async pullMessages(options: { ensureStableIds?: boolean } = {}): Promise<LuminaChatMessage[]> {
        const snap = await MessageListGateway.getSnapshot(options);
        return snap.lumina;
    }

    public static getSnapshotSync() {
        return MessageListGateway.getSnapshotSync();
    }

    public static async getSnapshot(options: { ensureStableIds?: boolean } = {}) {
        return await MessageListGateway.getSnapshot(options);
    }
}
