/**
 * Lumina 独立存储中的精简消息结构
 * 核心原则：移除所有 SillyTavern 专有字段，仅保留 Lumina 树状结构必需数据
 */
export interface StoredChatMessage {
    id: string;
    parentId: string | null;
    name: string;
    role: string;
    is_user?: boolean;
    mesRaw: string;
    pluginRaw?: string | null;
    fingerprint: string;
    send_date: number;
    characterId?: string | number;
    extra: Record<string, unknown>;
}




/**
 * Swipe 详细信息接口补充
 */
export interface STSwipeInfo {
    send_date?: string | number;
    extra?: Record<string, unknown>;
    mes?: string;
}

