import { LuminaChatMessage, MessageUtils } from '@shared/LuminaMessage.js';
import { digestString } from '@shared/hash.js';
import { lwStorage } from '../../../storage.js';
import { BuiltinXMLTags, XMLInterceptor, globalXMLInterceptor } from '../../xml-view/XMLInterceptor.js';
import { DiffResult } from '@shared/api/SyncEngine.js';
import { ContextControlSettings } from '../../storage/types.js';

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
        const extraMesRaw = typeof msg.extra?.mesRaw === 'string' ? msg.extra.mesRaw : undefined;
        return msg.mesST ?? extraMesST ?? msg.mesRaw ?? extraMesRaw ?? msg.mes ?? '';
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
        const normalizedRole = typeof extra.role === 'string' ? extra.role : msg?.role;
        const isUser = msg?.is_user === true || normalizedRole === 'user';
        const pluginRaw =
            (typeof (extra as any).pluginRaw === 'string' ? (extra as any).pluginRaw : undefined)
            ?? (typeof msg?.pluginRaw === 'string' ? msg.pluginRaw : undefined);
        const mesRaw =
            (typeof (extra as any).mesRaw === 'string' ? (extra as any).mesRaw : undefined)
            ?? (typeof msg?.mesRaw === 'string' ? msg.mesRaw : undefined);
        const raw =
            (!isUser ? pluginRaw : undefined)
            ?? mesRaw
            ?? (typeof msg?.message === 'string' ? msg.message : undefined)
            ?? (typeof msg?.mes === 'string' ? msg.mes : undefined)
            ?? pluginRaw
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
        return `snap_${digestString(rawString)}`;
    }

    public static getCanonicalSnapshot(msg: any): string {
        const text = MessageTextResolver.resolveForFingerprint(msg);
        const name = msg?.name || '';
        const role = msg?.role || '';
        const isHidden = msg?.is_hidden ? '1' : '0';

        const rawString = `${name}|${role}|${isHidden}|${text}`;
        return `canon_${digestString(rawString)}`;
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
 * 差异可视化工具
 */
export type { DiffResult };

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
    public static readonly SYNC_WRITTEN_HASH_KEY = '_lw_written_hash';
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

    public static createSyncSourceMeta(writtenText?: string): Record<string, any> {
        const { chatId } = lwStorage._getContextIds();
        const meta: Record<string, any> = {
            [this.SYNC_SOURCE_KEY]: this.SYNC_SOURCE_LUMINA,
            [this.SYNC_TS_KEY]: Date.now(),
            [this.SYNC_CHAT_KEY]: chatId || null
        };
        if (typeof writtenText === 'string') {
            meta[this.SYNC_WRITTEN_HASH_KEY] = this.getSTFingerprint(writtenText);
        }
        return meta;
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
     * 判断消息是否为 Lumina 同步消息 (自写回读)
     * 优先使用写回时记录的内容哈希做状态判定：哈希一致说明这条就是插件自己刚写入且未被外部修改的回声，
     * 不再依赖时间窗；哈希不一致说明消息已被 ST 侧修改，应作为外部变更处理。
     * 仅当缺少哈希记录时才回退到旧的时间窗判定。
     */
    public static isLuminaSyncMessage(msg: LuminaChatMessage, nowTs: number = Date.now(), windowMs: number = 1600): boolean {
        const extra = msg?.extra || msg || {};
        if (extra?.[this.SYNC_SOURCE_KEY] !== this.SYNC_SOURCE_LUMINA) {
            return false;
        }

        const writtenHash = extra?.[this.SYNC_WRITTEN_HASH_KEY];
        if (typeof writtenHash === 'string' && writtenHash.length > 0) {
            const currentText = typeof msg?.mes === 'string' && msg.mes.length > 0
                ? msg.mes
                : (typeof msg?.mesST === 'string' ? msg.mesST : '');
            return writtenHash === this.getSTFingerprint(currentText);
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

    public static getFingerprint(content: string): string {
        return MessageUtils.getFingerprint(content);
    }

    public static getSTFingerprint(stWriteText: string): string {
        return MessageUtils.getFingerprint(stWriteText);
    }

    /**
     * 生成随机稳定的节点 ID
     */
    public static generateNodeId(): string {
        return MessageUtils.generateNodeId();
    }
}
