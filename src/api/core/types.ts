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
    mesSummary?: string;       // 剧情概况字段 (由 Story_Summary 标签或 AI 填充)
    thinkingText?: string | null; // 独立思维链字段
    mesST?: string;            // ST 侧实际呈现文本，包含上下文压缩和处理结果
    is_hidden?: boolean;
    isPinned?: boolean;        // 是否钉固（豁免隐藏区）
    pluginRaw?: string | null;
    fingerprint: string;
    characterId?: string | number;
    extra: Record<string, unknown>;
}




/**
 * 上下文控制设置 (DCC)
 */
export interface ContextControlSettings {
    fullMode: 'count' | 'token' | 'char';
    fullValueCount?: number;
    fullValueToken?: number;
    fullValueChar?: number;
    summaryMode: 'count' | 'token' | 'char';
    summaryValueCount?: number;
    summaryValueToken?: number;
    summaryValueChar?: number;
    tokenSplitAllowed: boolean;
    tokenMaxFloat: number;
    enableFallbackSummary: boolean; // 新增：是否启用无标签摘要兜底（截断前100字）
}
