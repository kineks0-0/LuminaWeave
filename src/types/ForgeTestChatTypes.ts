/**
 * Forge 测试聊天相关类型定义
 *
 * 预设系统允许用户配置：
 * - 角色卡来源（from_st / custom / none）
 * - 提示词顺序与启用状态
 * - 自定义 prompt 条目
 */

// ──────────────────────────────────────────────
// 角色卡信息
// ──────────────────────────────────────────────

export interface ForgeTestChatCharCard {
    name: string;
    description: string;
    personality: string;
    scenario: string;
    systemPrompt: string;
}

// ──────────────────────────────────────────────
// 预设：提示词槽位与条目
// ──────────────────────────────────────────────

/**
 * 内置提示词槽位
 * - char_* 系列：来自角色卡信息（charCardMode 决定来源）
 * - world_info：虚拟世界书条目（始终来自 virtualLorebookEntries）
 * - chat_history：对话历史（固定追加在末尾，不可移除）
 */
export type ForgeTestChatPromptSlot =
    | 'char_system_prompt'   // 角色卡 systemPrompt 字段
    | 'char_description'     // 角色卡 description
    | 'char_personality'     // 角色卡 personality
    | 'scenario'             // 角色卡 scenario
    | 'world_info'           // 虚拟世界书条目
    | 'chat_history';        // 对话历史（固定末尾）

export interface ForgeTestChatSlotEntry {
    type: 'slot';
    slot: ForgeTestChatPromptSlot;
    enabled: boolean;
}

export interface ForgeTestChatCustomEntry {
    type: 'custom';
    id: string;
    enabled: boolean;
    prompt: {
        role: 'system' | 'user' | 'assistant';
        content: string;
    };
}

export type ForgeTestChatPromptEntry = ForgeTestChatSlotEntry | ForgeTestChatCustomEntry;

// ──────────────────────────────────────────────
// 预设
// ──────────────────────────────────────────────

/**
 * charCardMode:
 * - 'from_st'：从 ST 当前角色卡读取（EnvDetector.ctx）
 * - 'custom'：使用 customCharCard 字段
 * - 'none'：不注入任何角色卡信息
 */
export type ForgeTestChatCharCardMode = 'from_st' | 'custom' | 'none';

export interface ForgeTestChatPreset {
    id: string;
    name: string;
    /** 是否为内置预设（内置预设不可删除） */
    builtIn?: boolean;
    charCardMode: ForgeTestChatCharCardMode;
    /** charCardMode === 'custom' 时有效 */
    customCharCard?: Partial<ForgeTestChatCharCard>;
    /** 提示词顺序与启用状态 */
    promptEntries: ForgeTestChatPromptEntry[];
    createdAt: number;
    updatedAt: number;
}

// ──────────────────────────────────────────────
// 内置预设工厂
// ──────────────────────────────────────────────

export function createBuiltInPresets(): ForgeTestChatPreset[] {
    const now = Date.now();
    return [
        {
            id: 'built-in:roleplay',
            name: '角色扮演',
            builtIn: true,
            charCardMode: 'from_st',
            promptEntries: [
                { type: 'slot', slot: 'char_system_prompt', enabled: true },
                { type: 'slot', slot: 'char_description', enabled: true },
                { type: 'slot', slot: 'char_personality', enabled: true },
                { type: 'slot', slot: 'scenario', enabled: true },
                { type: 'slot', slot: 'world_info', enabled: true },
                { type: 'slot', slot: 'chat_history', enabled: true }
            ],
            createdAt: now,
            updatedAt: now
        },
        {
            id: 'built-in:world-only',
            name: '纯世界书',
            builtIn: true,
            charCardMode: 'none',
            promptEntries: [
                { type: 'slot', slot: 'world_info', enabled: true },
                { type: 'slot', slot: 'chat_history', enabled: true }
            ],
            createdAt: now,
            updatedAt: now
        }
    ];
}

// ──────────────────────────────────────────────
// 聊天消息（供 SimpleChatView 使用，与 SimpleChatMessage 同构）
// ──────────────────────────────────────────────

export interface ForgeTestChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    isStreaming?: boolean;
}
