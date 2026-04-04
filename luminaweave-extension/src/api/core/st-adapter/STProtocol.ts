import { LuminaChatMessage } from '../ChatManager.js';
import { BuiltinXMLTags, XMLInterceptor, globalXMLInterceptor } from '../XMLInterceptor.js';
import { STSwipeInfo, StoredChatMessage } from '../types.js';

export class STProtocol {
    /**
     * 规范化文本，移除不可见字符并清除首尾空格
     */
    public static normalize(text: string): string {
        return (text || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
    }

    /**
     * 指纹用规范化：去零宽 + 空白折叠 + trim
     */
    public static normalizeForFingerprint(text: string): string {
        return (text || '')
            .replace(/[\u200B-\u200D\uFEFF]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
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
        let hash = 0;
        for (let i = 0; i < cleaned.length; i++) {
            hash = ((hash << 5) - hash) + cleaned.charCodeAt(i);
            hash |= 0;
        }
        const contentHash = Math.abs(hash);
        return `fp_${contentHash.toString(16).substring(0, 8)}`;
    }

    public static getFingerprint(content: string): string {
        const cleaned = this.normalizeForFingerprint(content);
        return this._hashFingerprint(cleaned);
    }

    public static getSTFingerprint(stWriteText: string): string {
        const cleaned = this.normalizeForFingerprint(stWriteText);
        return this._hashFingerprint(cleaned);
    }

    public static generateNodeId(): string {
        return 'node_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36).substring(4);
    }

    public static identifyMessage(m: any): { id: string; fingerprint: string } {
        if (!m) return { id: this.generateNodeId(), fingerprint: 'fp_00000000' };

        const extra = m.extra || {};
        const rawContent = this.resolveForFingerprint(m);
        const fingerprint = extra.fingerprint || m.fingerprint || this.getFingerprint(rawContent);

        let id = extra.id as string | undefined || m.id as string | undefined;

        if (!id && m.message_id !== undefined && m.message_id !== null) {
            id = `st_msg_${m.message_id}`;
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

    public static getCanonicalSnapshot(msg: any): string {
        const text = this.resolveForFingerprint(msg);
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

    public static isStateEqual(a: Partial<LuminaChatMessage>, b: Partial<LuminaChatMessage>): boolean {
        return this.getStateSnapshot(a) === this.getStateSnapshot(b);
    }

    public static isCanonicalEqual(a: any, b: any): boolean {
        return this.getCanonicalSnapshot(a) === this.getCanonicalSnapshot(b);
    }

    /**
     * 将 ST 的原始消息对象规范化为 Lumina 的 LuminaChatMessage
     */
    public static fromST(m: any, defaultCharId?: string | number): LuminaChatMessage {
        const extra: Record<string, unknown> = { ...(m.extra || {}) };

        const is_user = m.role === 'user';
        const isUser = is_user !== undefined ? is_user : (m.role === 'user');

        let rawContent = '';
        const pluginRaw = (extra.pluginRaw as string | undefined) || null;
        
        if (!isUser && pluginRaw) {
            const extracted = XMLInterceptor.extractTagContent(pluginRaw, BuiltinXMLTags.CHAT_REPLY);
            if (extracted.length > 0) {
                rawContent = extracted.join('\n');
            } else {
                rawContent = globalXMLInterceptor.processAndCleanText(pluginRaw, false);
            }
        } else {
            rawContent = (extra.mesRaw as string | undefined) ?? m.message ?? '';
        }

        let mesContent = m.message;

        rawContent = this.normalize(rawContent);
        mesContent = this.normalize(mesContent);
        const stDisplayContent = this.normalize((extra.mesST as string | undefined) ?? m.message ?? '');

        const charId = (extra.characterId as string | number | undefined) || defaultCharId;
        
        const { id, fingerprint } = this.identifyMessage(m);
        const stFingerprint = typeof extra.stFingerprint === 'string'
            ? extra.stFingerprint
            : this.getSTFingerprint(mesContent);
        
        const rawRole = (extra.role as string | undefined) ?? m.role;
        const role = this.normalizeRole(rawRole, isUser);

        const name = m.name || (isUser ? 'You' : 'Assistant');

        return {
            id,
            parentId: null, 
            name: name,
            role: role,
            is_user: isUser,
            mes: mesContent,
            mesRaw: rawContent,
            is_hidden: m.is_hidden || false,
            fingerprint: fingerprint,
            stFingerprint,
            characterId: charId,
            pluginRaw: (extra.pluginRaw as string | undefined) || null,
            mesSummary: (extra.mesSummary as string | undefined),
            mesST: stDisplayContent,
            extra: { ...extra, role } as Record<string, unknown>
        };
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
            mesST: m.mesST,
            is_hidden: m.is_hidden,
            pluginRaw: m.pluginRaw,
            fingerprint: m.fingerprint,
            characterId: m.characterId,
            extra: { ...m.extra } as Record<string, unknown>
        };

        const stKeys = [
            'swipes', 'swipe_id', 'swipes_info', 'message_id',
            'mesRaw', 'characterId', 'send_date', 'id', 'fingerprint', 'pluginRaw',
            'mesSummary'
        ];

        for (const key of stKeys) {
            delete stored.extra[key];
        }

        return stored;
    }
}
