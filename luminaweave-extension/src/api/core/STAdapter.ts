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
                    const baselineFp =
                        (typeof stNode.stFingerprintStored === 'string' ? stNode.stFingerprintStored : '')
                        || (typeof stNode.mesSTStored === 'string' && stNode.mesSTStored ? STProtocol.getSTFingerprint(stNode.mesSTStored) : '');
                    const isSTEdit =
                        (baselineFp !== '' && baselineFp === local.stFingerprint && stNode.stFingerprint !== baselineFp)
                        || (local.fingerprint === stNode.fingerprint && local.stFingerprint !== stNode.stFingerprint);
                    updated.push({ ...local, _isSTEdit: isSTEdit });
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

        const luminaOriginatedUpdates = updated.filter(u => !u._isSTEdit);

        return {
            onlyInIndependent,
            onlyInST,
            updated,
            independentSequence: localSequence,
            stSequence,
            diffCount: onlyInIndependent.length + onlyInST.length + updated.length,
            hasConflict: onlyInIndependent.length > 0 || onlyInST.length > 0 || updated.length > 0,
            hasDivergence: (onlyInIndependent.length > 0 || luminaOriginatedUpdates.length > 0) && onlyInST.length > 0,
            divergenceIndex
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

        const updates: { index: number, content: string, name?: string, role?: string, is_hidden?: boolean, extra: any }[] = [];
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
                    message: message,
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
            ? STProtocol.normalize(msg.mes ?? STProtocol.resolveForSync(msg))
            : STProtocol.normalize(STProtocol.resolveForSync(msg));
        const normalizedRole = STProtocol.normalizeRole(msg.role, msg.is_user === true || msg.role === 'user');
        const stFingerprintStored =
            (typeof msg?.extra?.stFingerprint === 'string' ? msg.extra.stFingerprint : '')
            || (typeof msg.stFingerprint === 'string' ? msg.stFingerprint : '');
        const mesSTStored =
            (typeof msg?.extra?.mesST === 'string' ? msg.extra.mesST : '')
            || (typeof msg.mesST === 'string' ? msg.mesST : '');
        const compareText = side === 'st'
            ? (msg.mes ?? STProtocol.resolveForSTWrite(msg))
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
            mesST: msg.mesST
        };
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
