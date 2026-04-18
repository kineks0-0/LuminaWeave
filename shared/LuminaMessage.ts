export interface STSwipeInfo {
    text: string;
    send_date: number;
    gen_started?: number;
    gen_finished?: number;
    extra?: Record<string, any>;
}

export type LuminaConversationType = 'chat' | 'forge';
export type LuminaNodeKind = 'message' | 'artifact' | 'system';

export interface LuminaChatMessage {
    id: string;                // 节点唯一 ID
    parentId: string | null;   // 父节点 ID
    name: string;
    role: string;
    conversationType?: LuminaConversationType; // 对话来源类型
    conversationId?: string;   // 对话实例 ID
    nodeKind?: LuminaNodeKind; // 节点类型，默认 message
    is_user?: boolean;         // 是否为用户消息
    mesRaw: string;            // 原始对话内容 (从 XML 提取)
    mes: string;               // 显示对话内容 (清洗后)
    mesST?: string;            // ST 侧呈现内容
    mesSummary?: string;       // 剧情概况
    thinkingText?: string | null; // 独立思维链文本，仅保存在 Lumina 本地
    is_hidden?: boolean;       // 是否隐藏
    isPinned?: boolean;        // 是否钉固（钉固消息豁免隐藏区，始终以摘要形式保留在上下文）
    pluginRaw?: string | null;  // 原始回复数据 (含 XML)
    fingerprint: string;       // 内容指纹
    stFingerprint?: string;    // ST 指纹
    characterId?: string | number; 
    extra: Record<string, any>; // 额外元数据
    avatarUrl?: string; 
    createdAt?: number;        // 创建时间
    syncStatus?: 'local' | 'synced' | 'streaming'; // 同步状态记录 (前端内部使用)
    
    // 兼容字段
    swipe_id?: number;
    swipes?: string[];
    swipes_info?: STSwipeInfo[];
}

/**
 * 消息处理工具集 (前后端共享)
 */
export class MessageUtils {
    /**
     * 基础规范化
     */
    public static normalize(text: string): string {
        return (text || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
    }

    /**
     * 指纹用规范化
     */
    public static normalizeForFingerprint(text: string): string {
        return (text || '')
            .replace(/[\u200B-\u200D\uFEFF]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * 生成内容指纹 (简单 Hash)
     */
    public static getFingerprint(content: string): string {
        const cleaned = this.normalizeForFingerprint(content);
        let hash = 0;
        for (let i = 0; i < cleaned.length; i++) {
            hash = ((hash << 5) - hash) + cleaned.charCodeAt(i);
            hash |= 0;
        }
        return `fp_${Math.abs(hash).toString(16).substring(0, 8)}`;
    }

    /**
     * 生成节点 ID
     */
    public static generateNodeId(): string {
        return 'node_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36).substring(4);
    }

    /**
     * 核心同步管道：确保 mesRaw, mes 和 fingerprint 的一致性 (前后端共享)
     * @param msg 消息对象
     * @param interceptor XML 拦截器实例
     * @param options 同步选项
     */
    public static syncCore(msg: LuminaChatMessage, interceptor: any, options: { force?: boolean; skipFingerprint?: boolean } = {}): void {
        const isAI = msg.is_user === false;
        
        // 1. 确定计算指纹的原始输入源
        // 对于 AI，优先使用 pluginRaw (含 XML)；对于用户，优先使用 mesRaw
        const sourceForFp = isAI 
            ? (msg.pluginRaw || msg.mesRaw || '') 
            : (msg.mesRaw || msg.mes || '');
        
        // 2. 检查指纹一致性以跳过冗余计算
        if (!options.force && !options.skipFingerprint && msg.fingerprint && !(isAI && msg.pluginRaw)) {
            const currentFp = this.getFingerprint(sourceForFp);
            if (msg.fingerprint === currentFp && msg.mes && msg.mesRaw) {
                return; // 内容未变且字段完整，跳过
            }
        }

        // 3. 同步 mesRaw (原始内容)
        if (isAI && msg.pluginRaw) {
            // 对于 AI 消息，pluginRaw 是权威源码。即便 mesRaw 已有值 (例如来自持久化旧数据)，也应以 pluginRaw 为准进行提取
            const extracted = (interceptor.constructor as any).extractTagContent(msg.pluginRaw, 'Chat_Reply');
            const nextMesRaw = (extracted && extracted.length > 0) ? extracted.join('\n') : interceptor.cleanText(msg.pluginRaw, { allowTopLevel: true });
            const nextThinking = (interceptor.constructor as any).extractTagContent(msg.pluginRaw, 'thinking').join('\n\n').trim();
            
            if (msg.mesRaw !== nextMesRaw) {
                msg.mesRaw = nextMesRaw;
            }
            msg.thinkingText = nextThinking || null;
        } else if (!msg.mesRaw && msg.mes) {
            msg.mesRaw = msg.mes;
        }

        // 4. 同步 mes (呈现内容)
        // 使用 interceptor 执行排除 Chat_Reply 标签的最终提纯
        const rawToClean = msg.mesRaw || msg.pluginRaw || '';
        if (rawToClean) {
            msg.mes = interceptor.cleanText(rawToClean, { filterChatReply: true });
        }

        // 5. 更新指纹
        if (!options.skipFingerprint) {
            const finalFp = this.getFingerprint(sourceForFp);
            msg.fingerprint = finalFp;
            if (msg.extra) {
                msg.extra.fingerprint = finalFp;
            }
        }
    }
}
