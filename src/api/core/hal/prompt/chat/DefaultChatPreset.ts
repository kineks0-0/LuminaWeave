import {
    DEFAULT_CHAT_COMPLETION_BEHAVIOR,
    DEFAULT_CHAT_COMPLETION_ENTRY,
    DEFAULT_CHAT_COMPLETION_SAMPLING,
    ST_GLOBAL_ORDER_ID,
    type ChatCompletionPreset,
    type ChatCompletionPresetEntry
} from '../../../../../types/ChatCompletionPresetTypes.js';

const marker = (identifier: string, name: string): ChatCompletionPresetEntry => ({
    ...DEFAULT_CHAT_COMPLETION_ENTRY,
    identifier,
    name,
    marker: true,
    systemPrompt: true,
    content: ''
});

/** 无自定义预设时的内置默认（ST Chat Completion 结构，不含具体人设文案）。 */
export const createDefaultChatPreset = (): ChatCompletionPreset => {
    const prompts: ChatCompletionPresetEntry[] = [
        {
            ...DEFAULT_CHAT_COMPLETION_ENTRY,
            identifier: 'main',
            name: '主提示词',
            systemPrompt: true,
            content: "Write {{char}}'s next reply in this fictional roleplay between {{char}} and {{user}}. Stay in character, keep the scene moving, and reply in the user's language."
        },
        marker('worldInfoBefore', '世界书 (before)'),
        marker('personaDescription', '用户设定'),
        marker('charDescription', '角色描述'),
        marker('charPersonality', '角色性格'),
        marker('scenario', '场景'),
        marker('worldInfoAfter', '世界书 (after)'),
        marker('dialogueExamples', '示例对话'),
        marker('chatHistory', '对话历史'),
        { ...DEFAULT_CHAT_COMPLETION_ENTRY, identifier: 'jailbreak', name: '越狱', systemPrompt: true, content: '' }
    ];
    return {
        name: 'Lumina 默认（Chat Completion）',
        prompts,
        promptOrder: [{
            characterId: ST_GLOBAL_ORDER_ID,
            order: prompts.map(item => ({ identifier: item.identifier, enabled: true }))
        }],
        sampling: { ...DEFAULT_CHAT_COMPLETION_SAMPLING },
        behavior: { ...DEFAULT_CHAT_COMPLETION_BEHAVIOR }
    };
};
