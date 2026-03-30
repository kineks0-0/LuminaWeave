import { LuminaChatMessage } from './ChatManager';
import { SyncEngine } from './SyncEngine';
import { STSwipeInfo, StoredChatMessage } from './types';
import { lwStorage } from '../storage.js';
import { BuiltinXMLTags, XMLInterceptor } from './XMLInterceptor';

/**
 * ChatConverter - 负责 SillyTavern 与 Lumina 之间的数据协议转换
 * 核心原则：始终以原始文本 (Raw Data) 为转换与比对的基准
 */
export class ChatConverter {
    /**
     * 将 ST 的原始消息对象规范化为 Lumina 的 LuminaChatMessage
     * @param m ST 原始消息 (TavernHelper 提供的 ChatMessage 类型)
     */
    static fromST(m: ChatMessage): LuminaChatMessage {
        const extra: Record<string, unknown> = { ...(m.extra || {}) };

        // 优先从 extra 中获取插件指定的 mesRaw，否则使用标准的 m.message
        // Note: TavernHelper 的 ChatMessage 使用 message 字段，而不是 mes
        let rawContent = (extra.mesRaw as string | undefined) ?? m.message;
        let mesContent = m.message;
        const is_user = m.role === 'user';

        if (!rawContent || rawContent === '') {
            rawContent = mesContent || '';
        }

        // 标准化处理：移除不可见字符，确保存核一致
        rawContent = rawContent.replace(/[\u200B-\u200D\uFEFF]/g, '');

        // 业务字段提取与标准化
        const send_date_raw = m.extra?.send_date || (extra.send_date as string | number | undefined) || Date.now();
        let send_date: number;
        // 统一化处理：将 ISO 字符串或其它格式转换为纯数字时间戳
        if (typeof send_date_raw === 'string') {
            const parsed = Date.parse(send_date_raw);
            send_date = isNaN(parsed) ? Date.now() : parsed;
        } else {
            send_date = Number(send_date_raw);
        }

        const charId = (extra.characterId as string | number | undefined) || (lwStorage as any)._getContextIds()?.charId;

        // 核心：ID 与指纹的稳定提取
        // 优先从 ST 的 extra 中提取持久化 ID，如果没有则回退到 ST 原生所在的 message_id，或者生成随机 ID
        let stableId = extra.id as string | undefined;
        if (!stableId) {
            if (m.message_id !== undefined && m.message_id !== null) {
                stableId = `st_msg_${m.message_id}`;
            } else {
                stableId = m.message_id;
            }
        }
        const id = stableId || SyncEngine.generateNodeId();
        
        const fingerprint = extra.fingerprint as string | undefined || SyncEngine.getFingerprint(rawContent);

        // 核心修复：适配 ST 多用户身份以及 is_user 的判定
        const isUser = is_user !== undefined ? is_user : (m.role === 'user');

        // 修复：确保能够正确获取并维持 name，对于从 ST 加载的消息，m.name 通常是存在的
        const name = m.name || (isUser ? 'You' : 'Assistant');

        return {
            id,
            parentId: null, // 由 Manager 在链接时维护
            name: name,
            role: m.role || 'assistant',
            is_user: isUser,     // 从 ST 的 is_user 或 role 中提取
            mes: mesContent,     // Lumina 内部存储的 mes 应是原始的，显示时再动态应用正则
            mesRaw: rawContent,  // 显式保留原始备份
            fingerprint: fingerprint,
            send_date: send_date,
            characterId: charId,
            message_id: m.message_id !== undefined ? m.message_id : null,
            pluginRaw: (extra.pluginRaw as string | undefined) || null,
            extra: { ...extra } as Record<string, any> // 写入 ChatMessage 时，保持 Record<string, any> 兼容原有使用
        };
    }

    /**
     * 将 Lumina 的消息对象转换为 ST 可接受的回写格式
     */
    static toST(m: LuminaChatMessage): any {
        const mes_chat = XMLInterceptor.extractTagContent(m.mesRaw || m.mes, BuiltinXMLTags.CHAT_REPLY);
        const chat_reply = mes_chat.join('');
        const item: any = {
            message_id: m.message_id!, // 由 STBridge 处理具体索引
            role: m.role as 'system' | 'assistant' | 'user',
            message: chat_reply,  // 写入 ST 的核心展示字段 (原始数据) - 注意使用的是 message
            name: m.name,
            is_hidden: (m.extra.is_hidden as boolean | undefined) || false,
            data: (m.extra.data as Record<string, unknown> | undefined) || {},
            extra: {
                ...m.extra,
                id: m.id,            // 关键：将持久化 ID 注入 ST 侧的 extra
                fingerprint: m.fingerprint, // 关键：将当前内容指纹注入 ST 侧的 extra
                mesRaw: m.mesRaw || m.mes,
                pluginRaw: m.pluginRaw || null,
                send_date: m.send_date,
                characterId: m.characterId
            }
        };

        return item;
    }

    /**
     * 获取用于独立存储的精简格式
     * 核心原则：移除所有 SillyTavern 专有字段，仅保留 Lumina 树状结构必需数据
     */
    static toStorage(m: LuminaChatMessage): StoredChatMessage {
        // 创建精简对象
        const stored: StoredChatMessage = {
            id: m.id,
            parentId: m.parentId,
            name: m.name, // 修复：必须将 name 持久化到独立存储中
            role: m.role,
            is_user: m.is_user,
            mesRaw: m.mesRaw,
            pluginRaw: m.pluginRaw,
            fingerprint: m.fingerprint,
            send_date: m.send_date,
            characterId: m.characterId,
            extra: { ...m.extra } as Record<string, unknown>
        };

        // 彻底移除 ST 冗余字段（即便它们在 extra 中）
        const stKeys = [
            'swipes', 'swipe_id', 'swipes_info', 'message_id',
            'mesRaw', 'characterId', 'send_date', 'id', 'fingerprint', 'pluginRaw'
        ];

        for (const key of stKeys) {
            delete stored.extra[key];
        }

        // 确保 send_date 始终为数字
        if (typeof stored.send_date === 'string') {
            const parsed = Date.parse(stored.send_date);
            if (!isNaN(parsed)) stored.send_date = parsed;
        }

        return stored;
    }
}

