import { STSwipeInfo, LuminaChatMessage, MessageUtils } from '../../../../../shared/LuminaMessage.js';
import { BuiltinXMLTags, XMLInterceptor, globalXMLInterceptor } from '../XMLInterceptor.js';
import { StoredChatMessage } from '../types.js';

export class STProtocol {
    public static normalize(text: string): string {
        const cleaned = globalXMLInterceptor.processAndCleanText(text, false);
        return MessageUtils.normalize(cleaned);
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
        return this.normalizeForFingerprint(stWrite);
    }

    public static resolveForSync(msg: Partial<LuminaChatMessage>): string {
        return this.resolveForSTWrite(msg);
    }

    public static normalizeRole(role: unknown, isUser: boolean): 'system' | 'assistant' | 'user' {
        if (isUser) return 'user';
        if (role === 'system') return 'system';
        if (role === 'user') return 'user';
        if (role === 'assistant') return 'assistant';
        if (role === 'char') return 'assistant';
        return 'assistant';
    }

    /**
     * 解析指纹用 Canonical Content Text：以 mesRaw 为核心，不读取 mesST
     */
    public static resolveForFingerprint(msg: LuminaChatMessage | StoredChatMessage | any): string {
        const extra = (msg?.extra || {}) as Record<string, unknown>;
        const normalizedRole = typeof extra.role === 'string' ? extra.role : (msg as any)?.role;
        const isUser = (msg as any)?.is_user === true || normalizedRole === 'user';
        const pluginRaw =
            (typeof extra.pluginRaw === 'string' ? extra.pluginRaw : undefined)
            ?? (typeof (msg as any)?.pluginRaw === 'string' ? (msg as any).pluginRaw : undefined);
        const mesRaw =
            (typeof extra.mesRaw === 'string' ? extra.mesRaw : undefined)
            ?? (typeof (msg as any)?.mesRaw === 'string' ? (msg as any).mesRaw : undefined);
        const raw =
            (!isUser ? pluginRaw : undefined)
            ?? mesRaw
            ?? (typeof (msg as any)?.message === 'string' ? (msg as any).message : undefined)
            ?? (typeof (msg as any)?.mes === 'string' ? (msg as any).mes : undefined)
            ?? pluginRaw
            ?? '';

        const cleaned = globalXMLInterceptor.processAndCleanText(raw, false);
        return this.normalizeForFingerprint(cleaned);
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

        // 2. 统一标签清洗 (剥离 Story_Summary, Chat_Reply, 丢弃 thinking, 保留 V)
        let cleaned = globalXMLInterceptor.processAndCleanText(text, false);

        // 3. 终极清理 (不可见字符处理)
        return this.normalize(cleaned);
    }

    public static cleanContent(text: string): string {
        return this.normalize(text);
    }

    private static _hashFingerprint(cleaned: string): string {
        return MessageUtils.getFingerprint(cleaned);
    }

    public static getFingerprint(content: string): string {
        return MessageUtils.getFingerprint(content);
    }

    public static getSTFingerprint(stWriteText: string): string {
        const cleaned = this.normalizeForFingerprint(stWriteText);
        return this._hashFingerprint(cleaned);
    }

    public static generateNodeId(): string {
        return MessageUtils.generateNodeId();
    }

    public static identifyMessage(m: LuminaChatMessage | StoredChatMessage | any): { id: string; fingerprint: string } {
        if (!m) return { id: this.generateNodeId(), fingerprint: 'fp_00000000' };

        const extra = (m.extra || {}) as Record<string, any>;
        const rawContent = this.resolveForFingerprint(m);
        const fingerprint = extra.fingerprint || (m as any).fingerprint || this.getFingerprint(rawContent);

        let id = extra.id as string | undefined || (m as any).id as string | undefined;

        if (!id && (m as any).message_id !== undefined && (m as any).message_id !== null) {
            const swipeId =
                typeof extra.swipe_id === 'number'
                    ? extra.swipe_id
                    : (typeof (m as any).swipe_id === 'number' ? (m as any).swipe_id : undefined);
            const swipeCount =
                typeof extra.swipeCount === 'number'
                    ? extra.swipeCount
                    : (Array.isArray((m as any).swipes) ? (m as any).swipes.length : 0);

            if (swipeCount > 1 && swipeId !== undefined && swipeId >= 0) {
                id = `st_msg_${(m as any).message_id}_swipe_${swipeId}`;
            } else {
                id = `st_msg_${(m as any).message_id}`;
            }
        }

        if (!id) {
            id = this.generateNodeId();
        }

        return { id, fingerprint };
    }

    public static getStateSnapshot(msg: Partial<LuminaChatMessage>): string {
        const text = this.resolveForSTWrite(msg);
        const normText = this.normalize(text);
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

    public static getCanonicalSnapshot(msg: LuminaChatMessage | StoredChatMessage | any): string {
        const text = this.resolveForFingerprint(msg);
        const name = (msg as any)?.name || '';
        const role = (msg as any)?.role || '';
        const isHidden = (msg as any)?.is_hidden ? '1' : '0';

        const rawString = `${name}|${role}|${isHidden}|${text}`;
        let hash = 0;
        for (let i = 0; i < rawString.length; i++) {
            hash = ((hash << 5) - hash) + rawString.charCodeAt(i);
            hash |= 0;
        }
        return `canon_${Math.abs(hash).toString(16).substring(0, 8)}`;
    }

    public static isStateEqual(a: Partial<LuminaChatMessage>, b: Partial<LuminaChatMessage>): boolean {
        return this.getStateSnapshot(a) === this.getStateSnapshot(b);
    }

    public static isCanonicalEqual(a: LuminaChatMessage | StoredChatMessage | any, b: LuminaChatMessage | StoredChatMessage | any): boolean {
        return this.getCanonicalSnapshot(a) === this.getCanonicalSnapshot(b);
    }

    /**
     * 增强版同步逻辑 (扩展侧专项)
     * 包装了 shared 层的 syncCore，并补充 ST 特有字段。
     * 该方法确保了节点在进入 WorldlineStore 之前，其派生字段 (mes, mesST) 与指纹是完全对齐的。
     */
    public static syncMessageCalculatedFields(msg: LuminaChatMessage, options: { force?: boolean; skipFingerprint?: boolean } = {}): void {
        // 1. 调用共享层核心逻辑 (同步 mesRaw, mes, fingerprint)
        MessageUtils.syncCore(msg, globalXMLInterceptor, options);

        // 2. 同步 ST 特有内容 mesST
        // 如果 mesST 缺失，根据 ST 优先级策略 (mesST > mesRaw > mes) 进行初始化
        if (!msg.mesST) {
            msg.mesST = this.resolveForSTWrite(msg);
        }

        // 3. 同步 ST 指纹 (用于外部编辑检测)
        if (!options.skipFingerprint) {
            const stFp = this.getSTFingerprint(msg.mesST || '');
            msg.stFingerprint = stFp;
            if (msg.extra) {
                msg.extra.stFingerprint = stFp;
                // 同时在 extra 中保留一份冗余副本以保证持久化兼容性
                msg.extra.mesRaw = msg.mesRaw;
                msg.extra.mesST = msg.mesST;
            }
        }
    }

    /**
     * 将 ST 的原始消息对象规范化为 Lumina 的 LuminaChatMessage
     */
    public static fromST(m: Record<string, any>, defaultCharId?: string | number): LuminaChatMessage {
        const extra: Record<string, unknown> = { ...(m.extra || {}) };

        const isUser = m.role === 'user';
        const role = this.normalizeRole(extra.role ?? m.role, isUser);
        const name = m.name || (isUser ? 'You' : 'Assistant');
        const charId = (extra.characterId as string | number | undefined) || defaultCharId;
        const stWriteText = (m.message as string | undefined) ?? '';
        const displayText = (m.mes as string | undefined) ?? stWriteText;
        const swipeId =
            typeof extra.swipe_id === 'number'
                ? extra.swipe_id
                : (typeof m.swipe_id === 'number' ? m.swipe_id : undefined);
        const swipeCount =
            typeof extra.swipeCount === 'number'
                ? extra.swipeCount
                : (Array.isArray(m.swipes) ? m.swipes.length : undefined);
        if (m.message_id !== undefined && extra.message_id === undefined) {
            extra.message_id = m.message_id;
        }
        if (swipeId !== undefined && extra.swipe_id === undefined) {
            extra.swipe_id = swipeId;
        }
        if (swipeCount !== undefined && extra.swipeCount === undefined) {
            extra.swipeCount = swipeCount;
        }
        if (typeof extra.activeSwipeText !== 'string') {
            extra.activeSwipeText = stWriteText;
        }
        
        // 1. 基础物理标识识别
        const { id, fingerprint } = this.identifyMessage(m);

        // 2. 构造初始对象 (仅保留原始数据字段)
        const msg: LuminaChatMessage = {
            id,
            parentId: null, 
            name,
            role,
            is_user: isUser,
            mesRaw: (extra.mesRaw as string | undefined) ?? stWriteText,
            mes: displayText,
            is_hidden: m.is_hidden || false,
            fingerprint,
            stFingerprint: (extra.stFingerprint as string | undefined),
            characterId: charId,
            pluginRaw: (extra.pluginRaw as string | undefined) || null,
            mesSummary: (extra.mesSummary as string | undefined),
            thinkingText: (extra.thinkingText as string | undefined) || null,
            mesST: (extra.mesST as string | undefined) ?? stWriteText,
            swipe_id: swipeId,
            swipes: Array.isArray(m.swipes) ? [...m.swipes] : undefined,
            swipes_info: Array.isArray(m.swipes_info) ? [...m.swipes_info] as STSwipeInfo[] : undefined,
            extra: { ...extra, role } as Record<string, unknown>
        };

        // 3. 运行自动对齐管道：补全清洗后的 mes, 矫正 fingerprint
        this.syncMessageCalculatedFields(msg);

        return msg;
    }

    /**
     * 将 Lumina 的消息对象转换为 ST 可接受的回写格式
     */
    public static toST(m: LuminaChatMessage, index: number = 0): any {
        const finalMessageText = m.mesST || this.extractMessageText(m, false);
        const normalizedRole = this.normalizeRole(m.role, !!m.is_user);

        const item = {
            message_id: index,
            role: normalizedRole,
            message: finalMessageText,
            name: m.name,
            is_hidden: m.is_hidden || false,
            data: (m.extra.data as Record<string, unknown> | undefined) || {},
            extra: {
                ...m.extra,
                id: m.id,
                fingerprint: m.fingerprint,
                stFingerprint: m.stFingerprint || this.getSTFingerprint(finalMessageText),
                mesRaw: m.mesRaw || m.mes,
                mesST: m.mesST,
                mesSummary: m.mesSummary,
                thinkingText: m.thinkingText || null,
                role: normalizedRole,
                pluginRaw: m.pluginRaw || null,
                characterId: m.characterId
            }
        };

        return item;
    }

    /**
     * 获取用于独立存储的精简格式
     */
    public static toStorage(m: LuminaChatMessage): StoredChatMessage {
        const stored: StoredChatMessage = {
            id: m.id,
            parentId: m.parentId,
            name: m.name,
            role: m.role,
            is_user: m.is_user,
            mesRaw: m.mesRaw,
            mesSummary: m.mesSummary,
            thinkingText: m.thinkingText || null,
            mesST: m.mesST,
            is_hidden: m.is_hidden,
            pluginRaw: m.pluginRaw,
            fingerprint: m.fingerprint,
            characterId: m.characterId,
            extra: { ...m.extra } as Record<string, unknown>
        };

        const stKeys = [
            'swipes', 'swipes_info',
            'mesRaw', 'characterId', 'send_date', 'id', 'fingerprint', 'pluginRaw',
            'mesSummary'
        ];

        for (const key of stKeys) {
            delete stored.extra[key];
        }

        return stored;
    }
}
