import { LuminaChatMessage, MessageUtils } from '../../../../shared/LuminaMessage.js';
import { lwStorage } from '../storage.js';
import { BuiltinXMLTags, XMLInterceptor, globalXMLInterceptor } from './XMLInterceptor.js';
import { ContextControlSettings } from './types.js';
import { STClient } from './st-adapter/STClient.js';
import { STProtocol } from './st-adapter/STProtocol.js';

export class MessageTextResolver {
    public static normalize(text: string): string {
        return MessageUtils.normalize(text);
    }

    public static normalizeForFingerprint(text: string): string {
        return MessageUtils.normalizeForFingerprint(text);
    }

    /**
     * 解析写回 ST 的文本，优先级：mesST > mesRaw > mes
     */
    public static resolveForSTWrite(msg: Partial<LuminaChatMessage>): string {
        const extraMesST = typeof msg.extra?.mesST === 'string' ? msg.extra.mesST : undefined;
        return msg.mesST ?? extraMesST ?? msg.mesRaw ?? msg.mes ?? '';
    }

    public static resolveForSTFingerprint(msg: Partial<LuminaChatMessage>): string {
        const stWrite = this.resolveForSTWrite(msg);
        return MessageTextResolver.normalizeForFingerprint(stWrite);
    }

    public static resolveForSync(msg: Partial<LuminaChatMessage>): string {
        return this.resolveForSTWrite(msg);
    }

    /**
     * 解析指纹用 Canonical Content Text：以 mesRaw 为核心，不读取 mesST
     */
    public static resolveForFingerprint(msg: any): string {
        const extra = (msg?.extra || {}) as Record<string, unknown>;
        const raw =
            (typeof (extra as any).mesRaw === 'string' ? (extra as any).mesRaw : undefined)
            ?? (typeof msg?.mesRaw === 'string' ? msg.mesRaw : undefined)
            ?? (typeof msg?.message === 'string' ? msg.message : undefined)
            ?? (typeof msg?.mes === 'string' ? msg.mes : undefined)
            ?? (typeof msg?.pluginRaw === 'string' ? msg.pluginRaw : undefined)
            ?? '';

        const cleaned = globalXMLInterceptor.processAndCleanText(raw, false);
        return MessageTextResolver.normalizeForFingerprint(cleaned);
    }

    /**
     * 提取消息文本的底层物理实现
     * 职责：根据优先级与模式从原始数据中提取呈现内容。
     */
    public static extractMessageText(msg: LuminaChatMessage, useCompressed: boolean = false): string {
        let text = '';

        // 1. 优先级选取候选文本
        if (msg.is_user === false) {
            // 尝试获取 AI 原始输出
            text = msg?.pluginRaw ?? msg?.mesRaw ?? msg?.extra?.mesRaw ?? msg?.mes ?? '';
        } else {
            // 用户消息回退
            text = msg?.mes ?? msg?.mesRaw ?? msg?.extra?.mesRaw ?? '';
        }

        // 2. 统一策略清洗 (对齐流式过滤偏好)
        const policy = SyncUtils.getStreamingPolicy();
        let cleaned = globalXMLInterceptor.cleanText(text, policy);

        // 3. 终极清理 (不可见字符处理)
        return MessageTextResolver.normalize(cleaned);
    }

    /**
     * 统一的内容清洗逻辑
     */
    public static cleanContent(text: string): string {
        return MessageTextResolver.normalize(text);
    }
}

export class MessageComparator {
    /**
     * 基于 name, role, is_hidden 和写回 ST 文本生成状态快照 Hash
     */
    public static getStateSnapshot(msg: Partial<LuminaChatMessage>): string {
        const text = MessageTextResolver.resolveForSTWrite(msg);
        const normText = MessageTextResolver.normalize(text);
        const name = msg.name || '';
        const role = msg.role || '';
        const isHidden = msg.is_hidden ? '1' : '0';
        
        const rawString = `${name}|${role}|${isHidden}|${normText}`;
        let hash = 0;
        for (let i = 0; i < rawString.length; i++) {
            hash = ((hash << 5) - hash) + rawString.charCodeAt(i);
            hash |= 0;
        }
        return `snap_${Math.abs(hash).toString(16).substring(0, 8)}`;
    }

    public static getCanonicalSnapshot(msg: any): string {
        const text = MessageTextResolver.resolveForFingerprint(msg);
        const name = msg?.name || '';
        const role = msg?.role || '';
        const isHidden = msg?.is_hidden ? '1' : '0';

        const rawString = `${name}|${role}|${isHidden}|${text}`;
        let hash = 0;
        for (let i = 0; i < rawString.length; i++) {
            hash = ((hash << 5) - hash) + rawString.charCodeAt(i);
            hash |= 0;
        }
        return `canon_${Math.abs(hash).toString(16).substring(0, 8)}`;
    }

    /**
     * 比较两个消息状态是否相等
     */
    public static isStateEqual(a: Partial<LuminaChatMessage>, b: Partial<LuminaChatMessage>): boolean {
        return this.getStateSnapshot(a) === this.getStateSnapshot(b);
    }

    public static isCanonicalEqual(a: any, b: any): boolean {
        return this.getCanonicalSnapshot(a) === this.getCanonicalSnapshot(b);
    }
}

/**
 * 同步工具类 (SyncUtils)
 * 职责：
 * 1. 统一生成消息指纹 (ID)
 * 2. 判定消息内容相等性
 * 3. 规范化 SillyTavern 消息列表并关联指纹
 * 4. 对比影子数据库与 ST 内存状态差异
 * 5. 计算并应用差量更新 (Delta Sync)
 * 
 * 本类为无状态工具集，仅提供静态算法支持。
 */
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

export class DiffVisualizer {
    public static generateDiffRows(diffResult: DiffResult): any[] {
        const rows = [];
        const maxLen = Math.max(diffResult.independentSequence.length, diffResult.stSequence.length);
        let leftLineNo = 1;
        let rightLineNo = 1;

        for (let i = 0; i < maxLen; i++) {
            const left = diffResult.independentSequence[i];
            const right = diffResult.stSequence[i];
            const leftExists = !!left;
            const rightExists = !!right;

            const leftText = leftExists ? left.mes : '';
            const rightText = rightExists ? right.mes : '';

            const isHiddenEqual = leftExists && rightExists && (!!left.is_hidden === !!right.is_hidden);
            const isNameEqual = leftExists && rightExists && MessageTextResolver.normalize(left.name ?? '') === MessageTextResolver.normalize(right.name ?? '');
            const isRoleEqual = leftExists && rightExists && MessageTextResolver.normalize(left.role ?? '') === MessageTextResolver.normalize(right.role ?? '');

            const leftStFp = leftExists
                ? (typeof left.stFingerprint === 'string' && left.stFingerprint ? left.stFingerprint : SyncUtils.getSTFingerprint(String(leftText ?? '')))
                : '';
            const rightStFp = rightExists
                ? (typeof right.stFingerprint === 'string' && right.stFingerprint ? right.stFingerprint : SyncUtils.getSTFingerprint(String(rightText ?? '')))
                : '';

            const isSame = leftExists && rightExists && isHiddenEqual && isNameEqual && isRoleEqual && leftStFp === rightStFp;
            const isModified = leftExists && rightExists && !isSame;
            const onlyLocal = leftExists && !rightExists;
            const onlySt = !leftExists && rightExists;

            rows.push({
                index: i,
                leftLine: leftExists ? String(leftLineNo++) : '',
                rightLine: rightExists ? String(rightLineNo++) : '',
                leftSign: isSame ? ' ' : onlyLocal || isModified ? '+' : ' ',
                rightSign: isSame ? ' ' : onlySt || isModified ? '+' : ' ',
                leftText,
                rightText,
                leftClass: onlyLocal ? 'is-add' : isModified ? 'is-mod' : leftExists ? 'is-same' : 'is-empty',
                rightClass: onlySt ? 'is-add' : isModified ? 'is-mod' : rightExists ? 'is-same' : 'is-empty'
            });
        }
        return rows;
    }
}

export class SyncUtils {
    /**
     * 获取流式策略配置
     */
    public static getStreamingPolicy(): { filterChatReply: boolean, allowTopLevel: boolean, implicitThinking: boolean, aggressiveThinking: boolean } {
        return {
            filterChatReply: Boolean(lwStorage.get('lumina-chat.filterChatReply', false, 'Global')),
            allowTopLevel: Boolean(lwStorage.get('lumina-chat.allowTopLevelInFilter', true, 'Global')),
            implicitThinking: Boolean(lwStorage.get('lumina-chat.implicitStartThinking', false, 'Global')),
            aggressiveThinking: Boolean(lwStorage.get('lumina-chat.aggressiveThinking', false, 'Global'))
        };
    }

    public static readonly SYNC_SOURCE_KEY = '_lw_sync_source';
    public static readonly SYNC_TS_KEY = '_lw_sync_ts';
    public static readonly SYNC_CHAT_KEY = '_lw_sync_chat_id';
    public static readonly SYNC_SOURCE_LUMINA = 'lumina';

    /**
     * 从全局存储中加载 DCC 配置
     */
    public static getDccSettings(): ContextControlSettings {
        const fullMode = lwStorage.get('lumina-chat.contextControl.fullMode', 'count', 'Global') as 'count' | 'token' | 'char';
        const summaryMode = lwStorage.get('lumina-chat.contextControl.summaryMode', 'count', 'Global') as 'count' | 'token' | 'char';

        return {
            fullMode,
            fullValueCount: Number(lwStorage.get('lumina-chat.contextControl.fullValueCount', 10, 'Global')),
            fullValueToken: Number(lwStorage.get('lumina-chat.contextControl.fullValueToken', 2000, 'Global')),
            fullValueChar: Number(lwStorage.get('lumina-chat.contextControl.fullValueChar', 5000, 'Global')),
            summaryMode,
            summaryValueCount: Number(lwStorage.get('lumina-chat.contextControl.summaryValueCount', 30, 'Global')),
            summaryValueToken: Number(lwStorage.get('lumina-chat.contextControl.summaryValueToken', 4000, 'Global')),
            summaryValueChar: Number(lwStorage.get('lumina-chat.contextControl.summaryValueChar', 10000, 'Global')),
            tokenSplitAllowed: Boolean(lwStorage.get('lumina-chat.contextControl.tokenSplitAllowed', false, 'Global')),
            tokenMaxFloat: Number(lwStorage.get('lumina-chat.contextControl.tokenMaxFloat', 200, 'Global')),
            enableFallbackSummary: Boolean(lwStorage.get('lumina-chat.contextControl.enableFallbackSummary', false, 'Global'))
        };
    }

    public static createSyncSourceMeta(): Record<string, any> {
        const { chatId } = lwStorage._getContextIds();
        return {
            [this.SYNC_SOURCE_KEY]: this.SYNC_SOURCE_LUMINA,
            [this.SYNC_TS_KEY]: Date.now(),
            [this.SYNC_CHAT_KEY]: chatId || null
        };
    }

    /**
     * 将来源节点状态合并到目标 Lumina 节点。
     * @param target 目标节点 (LuminaChatMessage)
     * @param source 来源节点
     * @param isSourceST 来源是否为 SillyTavern。如果为 true，ST 的 mes/name/is_hidden 将覆盖 target，而 extra 保留 target 的权威状态。
     */
    public static mergeNodeState(target: LuminaChatMessage, source: Partial<LuminaChatMessage>, isSourceST: boolean = true): void {
        if (isSourceST) {
            // ST 权威字段：mes, name, is_hidden, role
            if (source.mes !== undefined) target.mes = source.mes;
            if (source.name !== undefined) target.name = source.name;
            if (source.role !== undefined) target.role = source.role;
            if (source.is_hidden !== undefined) target.is_hidden = source.is_hidden;
            // Lumina 权威字段：extra (不覆盖 target.extra)
        } else {
            // 常规合并
            if (source.mes !== undefined) target.mes = source.mes;
            if (source.name !== undefined) target.name = source.name;
            if (source.role !== undefined) target.role = source.role;
            if (source.is_hidden !== undefined) target.is_hidden = source.is_hidden;
            if (source.extra !== undefined) {
                target.extra = { ...target.extra, ...source.extra };
            }
        }
    }

    /**
     * 判断消息是否为 Lumina 同步消息
     */
    public static isLuminaSyncMessage(msg: LuminaChatMessage, nowTs: number = Date.now(), windowMs: number = 1600): boolean {
        const extra = msg?.extra || msg || {};
        if (extra?.[this.SYNC_SOURCE_KEY] !== this.SYNC_SOURCE_LUMINA) {
            return false;
        }
        const markedTs = Number(extra?.[this.SYNC_TS_KEY]);
        if (!Number.isFinite(markedTs)) return false;
        const delta = nowTs - markedTs;
        return delta >= 0 && delta <= windowMs;
    }

    /**
     * 提取剧情概况
     */
    public static extractSummary(msg: LuminaChatMessage): string | null {
        // 1. 优先使用已有的 mesSummary
        if (msg.mesSummary) return msg.mesSummary;

        // 2. 从 pluginRaw 或 mesRaw 中寻找标签
        const rawSource = msg.pluginRaw || msg.mesRaw || msg.extra?.mesRaw;
        if (rawSource) {
            const summaryBlocks = XMLInterceptor.extractTagContent(rawSource, BuiltinXMLTags.STORY_SUMMARY);
            if (summaryBlocks.length > 0) return summaryBlocks.join('\n');

            // 3. 补托：尝试从 Current_Plan 提取
            const planBlocks = XMLInterceptor.extractTagContent(rawSource, 'Current_Plan');
            if (planBlocks.length > 0) return planBlocks.join('\n');
        }
        
        return null;
    }

    /**
     * 转换为可比较的消息对象
     */
    private static toComparableMessage(msg: LuminaChatMessage, side: 'st' | 'lumina'): {
        id: string;
        name: string;
        role: string;
        mes: string;
        mesRaw: string;
        fingerprint: string;
        stFingerprint: string;
        stFingerprintStored: string;
        mesSTStored: string;
        is_hidden?: boolean;
        mesST?: string;
    } {
        const { id, fingerprint } = this.identifyMessage(msg);
        const finalMes = side === 'st'
            ? MessageTextResolver.normalize(msg.mes ?? MessageTextResolver.resolveForSync(msg))
            : MessageTextResolver.normalize(MessageTextResolver.resolveForSync(msg));

        const stFingerprintStored =
            (typeof msg?.extra?.stFingerprint === 'string' ? msg.extra.stFingerprint : '')
            || (typeof msg.stFingerprint === 'string' ? msg.stFingerprint : '');
        const mesSTStored =
            (typeof msg?.extra?.mesST === 'string' ? msg.extra.mesST : '')
            || (typeof msg.mesST === 'string' ? msg.mesST : '');

        const compareText = side === 'st'
            ? (msg.mes ?? MessageTextResolver.resolveForSTWrite(msg))
            : (msg.mesST ?? (typeof msg?.extra?.mesST === 'string' ? msg.extra.mesST : undefined) ?? MessageTextResolver.resolveForSTWrite(msg));
        const stFingerprint = this.getSTFingerprint(compareText);
        const normalizedRole = STProtocol.normalizeRole(msg.role, msg.is_user === true || msg.role === 'user');

        return {
            id,
            name: msg?.name || '',
            role: normalizedRole,
            mes: finalMes,
            mesRaw: msg.mesRaw || '',
            fingerprint,
            stFingerprint,
            stFingerprintStored,
            mesSTStored,
            is_hidden: msg.is_hidden,
            mesST: msg.mesST
        };
    }

    public static getFingerprint(content: string): string {
        return MessageUtils.getFingerprint(content);
    }

    public static getSTFingerprint(stWriteText: string): string {
        return MessageUtils.getFingerprint(stWriteText);
    }

    private static _hashFingerprint(cleaned: string): string {
        return MessageUtils.getFingerprint(cleaned);
    }

    /**
     * 生成随机稳定的节点 ID
     */
    public static generateNodeId(): string {
        return MessageUtils.generateNodeId();
    }

    /**
     * 统一标识消息 (Identity Resolver)
     */
    public static identifyMessage(m: any): { id: string; fingerprint: string } {
        if (!m) return { id: this.generateNodeId(), fingerprint: 'fp_00000000' };

        const extra = m.extra || {};
        const rawContent = MessageTextResolver.resolveForFingerprint(m);
        const fingerprint = extra.fingerprint || m.fingerprint || this.getFingerprint(rawContent);

        let id = extra.id as string | undefined || m.id as string | undefined;

        if (!id) {
            id = this.generateNodeId();
        }

        return { id, fingerprint };
    }

    /**
     * 确保消息数组中的每一条都有指纹 ID
     */
    public static ensureFingerprints(messages: LuminaChatMessage[]): LuminaChatMessage[] {
        const { charId } = lwStorage._getContextIds();

        return messages.map((m) => {
            const { id, fingerprint } = this.identifyMessage(m);
            m.id = id;
            m.fingerprint = fingerprint;
            m.stFingerprint = m.stFingerprint || this.getSTFingerprint(MessageTextResolver.resolveForSTWrite(m));
            m.characterId = m.characterId || charId;
            const isUser = m.is_user === true || m.role === 'user';
            const normalizedRole = STProtocol.normalizeRole(m.role, isUser);
            m.role = normalizedRole;
            m.extra = m.extra || {};
            m.extra.role = normalizedRole;
            return m;
        });
    }

    /**
     * 对比两个节点池的差异 (Diff Engine)
     */
    public static comparePools(localNodes: LuminaChatMessage[], remoteNodes: LuminaChatMessage[]): {
        added: LuminaChatMessage[],
        updated: LuminaChatMessage[],
        deletedIds: string[]
    } {
        const remoteMap = new Map(remoteNodes.map(n => [n.id, n]));
        const localMap = new Map(localNodes.map(n => [n.id, n]));

        const added: LuminaChatMessage[] = [];
        const updated: LuminaChatMessage[] = [];
        const deletedIds: string[] = [];

        for (const local of localNodes) {
            const remote = remoteMap.get(local.id);
            if (!remote) {
                added.push(local);
            } else if (local.fingerprint !== remote.fingerprint) {
                updated.push(local);
            }
        }

        for (const remote of remoteNodes) {
            if (!localMap.has(remote.id)) {
                deletedIds.push(remote.id);
            }
        }

        return { added, updated, deletedIds };
    }

    /**
     * 计算并汇总 Lumina 与 ST 的同步分歧
     */
    public static compareStates(localChat: LuminaChatMessage[], stChat: LuminaChatMessage[]): DiffResult {
        const onlyInIndependent: any[] = [];
        const onlyInST: any[] = [];
        const updated: any[] = [];

        const localSequence = localChat.map((m) => this.toComparableMessage(m, 'lumina'));
        const stSequence = stChat.map((m) => this.toComparableMessage(m, 'st'));
        
        const stMsgMap = new Map(stSequence.map(m => [m.id, m]));
        const localMsgMap = new Map(localSequence.map(m => [m.id, m]));

        for (const local of localSequence) {
            const stNode = stMsgMap.get(local.id!);
            if (!stNode) {
                onlyInIndependent.push(local);
            } else {
                const metaDiff =
                    MessageTextResolver.normalize(local.name) !== MessageTextResolver.normalize(stNode.name)
                    || MessageTextResolver.normalize(local.role) !== MessageTextResolver.normalize(stNode.role)
                    || (!!local.is_hidden) !== (!!stNode.is_hidden);
                const isDiff =
                    metaDiff
                    || local.stFingerprint !== stNode.stFingerprint;
                
                if (isDiff) {
                    const baselineFp =
                        (typeof stNode.stFingerprintStored === 'string' ? stNode.stFingerprintStored : '')
                        || (typeof stNode.mesSTStored === 'string' && stNode.mesSTStored ? this.getSTFingerprint(stNode.mesSTStored) : '');
                    const isSTEdit =
                        (baselineFp !== '' && baselineFp === local.stFingerprint && stNode.stFingerprint !== baselineFp)
                        || (local.fingerprint === stNode.fingerprint && local.stFingerprint !== stNode.stFingerprint);
                    
                    updated.push({
                        ...local,
                        _isSTEdit: isSTEdit
                    });
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
     * 执行差量写入 (Delta Apply)
     */
    public static async applyDelta(
        diffResult: DiffResult,
        localTrace: LuminaChatMessage[],
        stChat: LuminaChatMessage[],
        stIdToIndex?: Map<string, number>
    ): Promise<void> {
        console.log(`[SyncEngine] 开始应用差量更新 (Lumina:${localTrace.length} vs ST:${stChat.length})...`);

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

        // 1. 处理在分歧点之前的部分属性更新
        for (const updatedMsg of diffResult.updated) {
            // 找到在 localTrace 中的索引
            const index = localTrace.findIndex(m => m.id === updatedMsg.id);
            if (index !== -1 && (divergenceIndex === -1 || index < divergenceIndex)) {
                const localMsg = localTrace[index];
                const stIndex = resolveStIndex(localMsg.id, index);
                if (stIndex === null) continue;
                const expectedContent = localMsg.mesST || MessageTextResolver.extractMessageText(localMsg, false);
                
                console.log(`[SyncEngine] 节点 ${localMsg.id} 需要更新. local is_hidden=${localMsg.is_hidden}`);
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
                        stFingerprint: localMsg.stFingerprint || this.getSTFingerprint(expectedContent),
                        mesRaw: localMsg.mesRaw,
                        compressionState: localMsg.extra?.compressionState,
                        mesSummary: localMsg.mesSummary,
                        pluginRaw: localMsg.pluginRaw,
                        is_hidden: localMsg.is_hidden
                    }
                });
            }
        }

        // 处理分歧点：截断并追加
        if (divergenceIndex !== -1) {
            // 1. 记录需要删除的 ST 消息索引 (从分歧点到结尾)
            for (let i = divergenceIndex; i < stChat.length; i++) {
                const stNode = stChat[i];
                const stIndex = resolveStIndex(stNode.id, i);
                if (stIndex !== null) indicesToDelete.push(stIndex);
            }
            
            // 2. 记录需要追加的 Local 消息 (从分歧点到结尾)
            for (let i = divergenceIndex; i < localTrace.length; i++) {
                const localMsg = localTrace[i];
                const message = localMsg.mesST || MessageTextResolver.extractMessageText(localMsg, false);
                messagesToAppend.push({
                    role: localMsg.role,
                    name: localMsg.name,
                    message,
                    is_hidden: localMsg.is_hidden || false,
                    extra: {
                        ...localMsg.extra,
                        ...this.createSyncSourceMeta(),
                        id: localMsg.id,
                        fingerprint: localMsg.fingerprint,
                        stFingerprint: localMsg.stFingerprint || this.getSTFingerprint(message),
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
}
