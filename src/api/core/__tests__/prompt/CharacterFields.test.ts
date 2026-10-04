import { describe, it, expect } from 'vitest';
import { parseDialogueExamples, resolveCharacterFields } from '@/api/core/hal/prompt/CharacterFields.js';

describe('resolveCharacterFields', () => {
    it('解析 v2 角色卡全字段', () => {
        const fields = resolveCharacterFields({
            spec: 'chara_card_v2',
            data: {
                name: '爱丽丝',
                description: '角色描述',
                personality: '角色性格',
                scenario: '场景',
                system_prompt: '系统指令',
                post_history_instructions: '历史后指令',
                mes_example: '{{user}}: 你好\n{{char}}: 你好呀',
                first_mes: '初次见面',
                extensions: {
                    depth_prompt: {
                        prompt: '深层设定',
                        depth: 4,
                        role: 'assistant',
                        position: 1
                    }
                }
            }
        });

        expect(fields).toEqual({
            name: '爱丽丝',
            description: '角色描述',
            personality: '角色性格',
            scenario: '场景',
            systemPrompt: '系统指令',
            postHistoryInstructions: '历史后指令',
            dialogueExamples: '{{user}}: 你好\n{{char}}: 你好呀',
            depthPrompt: { prompt: '深层设定', depth: 4, role: 'assistant', position: 1 },
            firstMessage: '初次见面'
        });
    });

    it('兼容 flat 卡片与 camelCase 字段', () => {
        const fields = resolveCharacterFields({
            name: 'Bob',
            systemPrompt: '指令',
            mesExample: '示例',
            firstMessage: '你好'
        });

        expect(fields.name).toBe('Bob');
        expect(fields.systemPrompt).toBe('指令');
        expect(fields.dialogueExamples).toBe('示例');
        expect(fields.firstMessage).toBe('你好');
    });

    it('缺省字段返回空串，depth_prompt 缺失或为空时为 null', () => {
        const fields = resolveCharacterFields({ data: { name: 'X' } });

        expect(fields.description).toBe('');
        expect(fields.depthPrompt).toBeNull();
        expect(resolveCharacterFields({ data: { extensions: { depth_prompt: { prompt: '  ' } } } }).depthPrompt).toBeNull();
    });

    it('非法 depth role 回退 system，非法 depth 回退 4', () => {
        const fields = resolveCharacterFields({
            data: {
                extensions: {
                    depth_prompt: { prompt: '深层', role: 'tool', depth: 'abc' }
                }
            }
        });

        expect(fields.depthPrompt).toEqual({ prompt: '深层', depth: 4, role: 'system', position: 0 });
    });
});

describe('parseDialogueExamples', () => {
    it('按 <START> 分块并按前缀切换说话人', () => {
        const messages = parseDialogueExamples(
            '<START>\n{{user}}: 你好\n{{char}}: 你好呀\n<START>\n{{user}}: 再见\n{{char}}: 再见啦',
            { charName: '爱丽丝', userName: '玩家' }
        );

        expect(messages).toEqual([
            { role: 'user', content: '你好' },
            { role: 'assistant', content: '你好呀' },
            { role: 'user', content: '再见' },
            { role: 'assistant', content: '再见啦' }
        ]);
    });

    it('支持字面名字前缀与多行续行', () => {
        const messages = parseDialogueExamples(
            '爱丽丝: 第一行\n第二行\n玩家: 回应',
            { charName: '爱丽丝', userName: '玩家' }
        );

        expect(messages).toEqual([
            { role: 'assistant', content: '第一行\n第二行' },
            { role: 'user', content: '回应' }
        ]);
    });

    it('无前缀的块按角色发言处理', () => {
        const messages = parseDialogueExamples('<START>\n今天天气不错。', {});

        expect(messages).toEqual([{ role: 'assistant', content: '今天天气不错。' }]);
    });

    it('空文本返回空数组', () => {
        expect(parseDialogueExamples('   ')).toEqual([]);
    });
});
