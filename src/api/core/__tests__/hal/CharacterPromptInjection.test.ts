import { describe, expect, it } from 'vitest';
import {
    buildCharacterCardSystemMessage,
    injectCharacterPromptMessages
} from '@/api/core/hal/prompt/CharacterPromptInjection.js';

const entry = (partial: Partial<LuminaLorebookEntry>): LuminaLorebookEntry => ({
    uid: 'entry',
    comment: '条目',
    key: [],
    keysecondary: [],
    content: '',
    constant: false,
    selective: false,
    selectiveLogic: 0,
    disable: false,
    position: 0,
    depth: 0,
    order: 0,
    probability: 100,
    scan_depth: 0,
    ...partial
});

const CHAR_CARD = {
    name: '爱丽丝',
    description: '{{char}}是一名骑士。',
    personality: '冷静',
    scenario: '',
    systemPrompt: ''
};

describe('CharacterPromptInjection', () => {
    it('builds a character card system message with only non-empty sections', () => {
        expect(buildCharacterCardSystemMessage(CHAR_CARD, '爱丽丝')).toContain('# 角色卡');
        expect(buildCharacterCardSystemMessage(CHAR_CARD, '爱丽丝')).toContain('## 角色描述');
        expect(buildCharacterCardSystemMessage(CHAR_CARD, '爱丽丝')).not.toContain('## 场景');
        expect(buildCharacterCardSystemMessage(null)).toBeNull();
    });

    it('prepends persona and character card with local macro resolution', () => {
        const result = injectCharacterPromptMessages({
            messages: [{ role: 'user', content: '你好' }],
            charCard: CHAR_CARD,
            personaDescription: '{{user}}是一个旅行者。',
            userName: '林',
            charName: '爱丽丝'
        });

        expect(result.messages[0]).toMatchObject({ role: 'system' });
        expect(result.messages[0].content).toBe('# 用户设定\n林是一个旅行者。');
        expect(result.messages[1].content).toContain('爱丽丝是一名骑士。');
        expect(result.messages[2]).toEqual({ role: 'user', content: '你好' });
        expect(result.trace.map((item) => item.sourceKind)).toEqual(['persona', 'character']);
    });

    it('activates constant and keyword character book entries as system messages', () => {
        const result = injectCharacterPromptMessages({
            messages: [
                { role: 'assistant', content: '欢迎来到森林。' },
                { role: 'user', content: '我看向森林' }
            ],
            charCard: null,
            worldbookEntries: [
                entry({ uid: 'rule', comment: '规则', content: '不要离开道路。', constant: true }),
                entry({ uid: 'forest', comment: '森林', content: '森林里有座塔。', key: ['森林'], position: 1 })
            ],
            userName: 'User',
            charName: '旁白'
        });

        const contents = result.messages.map((message) => message.content);
        expect(contents).toContain('[World Info: rule]\n不要离开道路。');
        expect(contents).toContain('[World Info: forest]\n森林里有座塔。');
        expect(result.messages.at(-1)).toEqual({ role: 'user', content: '我看向森林' });
        expect(result.trace.some((item) => item.sourceKind === 'worldbook')).toBe(true);
    });

    it('inserts at_depth entries relative to the latest message', () => {
        const result = injectCharacterPromptMessages({
            messages: [
                { role: 'assistant', content: '第一段' },
                { role: 'user', content: '第二段' }
            ],
            charCard: null,
            worldbookEntries: [
                entry({ uid: 'depth', comment: '深度', content: '深度设定', constant: true, position: 4, depth: 1 })
            ],
            userName: 'User',
            charName: '旁白'
        });

        expect(result.messages).toHaveLength(3);
        expect(result.messages[1]).toEqual({ role: 'system', content: '[World Info: depth]\n深度设定' });
        expect(result.messages[2]).toEqual({ role: 'user', content: '第二段' });
    });

    it('keeps messages unchanged when there is no character context', () => {
        const messages = [{ role: 'user' as const, content: '你好' }];
        const result = injectCharacterPromptMessages({ messages, charCard: null });

        expect(result.messages).toEqual(messages);
        expect(result.trace).toEqual([]);
    });
});
