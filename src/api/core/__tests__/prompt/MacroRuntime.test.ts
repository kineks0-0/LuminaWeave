import { describe, it, expect } from 'vitest';
import { resolveMacros } from '@/api/core/hal/prompt/macros/MacroRuntime.js';
import { StagedMacroVariables } from '@/api/core/hal/prompt/macros/StagedMacroVariables.js';
import type { MacroContext, MacroVariableSnapshot } from '@/api/core/hal/prompt/macros/MacroTypes.js';

const FIXED_NOW = new Date(2026, 9, 4, 9, 5, 7);

const createVariables = (snapshot?: Partial<MacroVariableSnapshot>): StagedMacroVariables =>
    new StagedMacroVariables({ local: {}, global: {}, ...snapshot });

const createContext = (overrides: Partial<MacroContext> = {}): MacroContext => ({
    characterName: '爱丽丝',
    userName: '玩家',
    persona: '一位旅人',
    description: '角色描述',
    personality: '角色性格',
    scenario: '场景设定',
    input: '当前输入',
    messages: [
        { role: 'user', content: '你好' },
        { role: 'assistant', content: '你好呀' }
    ],
    variables: createVariables(),
    now: FIXED_NOW,
    random: () => 0,
    pickSeed: 'chat-1',
    locale: 'en-US',
    ...overrides
});

describe('MacroRuntime 基础宏', () => {
    it('替换角色与用户相关宏', () => {
        const result = resolveMacros('{{char}} 对 {{user}} 说：{{description}}/{{personality}}/{{scenario}}/{{persona}}', createContext());

        expect(result.text).toBe('爱丽丝 对 玩家 说：角色描述/角色性格/场景设定/一位旅人');
        expect(result.trace.usedMacros).toContain('char');
    });

    it('未知宏按原文保留并给出 warning', () => {
        const result = resolveMacros('{{tool}} 与 {{char}}', createContext());

        expect(result.text).toBe('{{tool}} 与 爱丽丝');
        expect(result.trace.unresolvedMacros).toEqual(['tool']);
        expect(result.trace.warnings.some(item => item.includes('tool'))).toBe(true);
    });

    it('未闭合的宏按原文保留', () => {
        const result = resolveMacros('前缀 {{char 后缀', createContext());
        expect(result.text).toBe('前缀 {{char 后缀');
    });

    it('注释、noop、newline', () => {
        expect(resolveMacros('A{{// 一段注释}}B', createContext()).text).toBe('AB');
        expect(resolveMacros('A{{noop}}B', createContext()).text).toBe('AB');
        expect(resolveMacros('A{{newline}}B', createContext()).text).toBe('A\nB');
    });

    it('trim 移除所在行的换行', () => {
        expect(resolveMacros('A\n{{trim}}\nB', createContext()).text).toBe('AB');
    });

    it('lastMessage 系列', () => {
        expect(resolveMacros('{{lastMessage}}', createContext()).text).toBe('你好呀');
        expect(resolveMacros('{{lastUserMessage}}', createContext()).text).toBe('你好');
        expect(resolveMacros('{{lastCharMessage}}', createContext()).text).toBe('你好呀');
        expect(resolveMacros('{{firstMessage}}', createContext()).text).toBe('你好');
    });
});

describe('MacroRuntime 时间与随机', () => {
    it('时间与日期宏使用注入时钟', () => {
        expect(resolveMacros('{{time}}', createContext()).text).toBe('09:05');
        expect(resolveMacros('{{time:HH:mm:ss}}', createContext()).text).toBe('09:05:07');
        expect(resolveMacros('{{date}}', createContext()).text).toBe('2026-10-04');
        expect(resolveMacros('{{isotime}}', createContext()).text).toBe('09:05:07');
        expect(resolveMacros('{{isodate}}', createContext()).text).toBe('2026-10-04');
        expect(resolveMacros('{{weekday}}', createContext()).text).toBe('Sunday');
    });

    it('random 支持无参与多值', () => {
        expect(resolveMacros('{{random}}', createContext({ random: () => 0 })).text).toBe('0.000');
        expect(resolveMacros('{{random:A,B}}', createContext({ random: () => 0 })).text).toBe('A');
        expect(resolveMacros('{{random:A,B}}', createContext({ random: () => 0.9 })).text).toBe('B');
    });

    it('random 参数支持嵌套宏', () => {
        const result = resolveMacros('{{random:{{char}},B}}', createContext({ random: () => 0 }));
        expect(result.text).toBe('爱丽丝');
    });

    it('pick 在同一 seed 下稳定', () => {
        const first = resolveMacros('{{pick:甲,乙,丙}}', createContext({ random: () => 0 })).text;
        const second = resolveMacros('{{pick:甲,乙,丙}}', createContext({ random: () => 0.99 })).text;

        expect(first).toBe(second);
        expect(['甲', '乙', '丙']).toContain(first);
    });

    it('roll 使用注入随机源', () => {
        expect(resolveMacros('{{roll:2d6}}', createContext({ random: () => 0 })).text).toBe('2');
        expect(resolveMacros('{{roll:1d6+2}}', createContext({ random: () => 0 })).text).toBe('3');
    });
});

describe('MacroRuntime 变量宏', () => {
    it('getvar 缺省为空，setvar 同轮可见', () => {
        const context = createContext();
        expect(resolveMacros('{{getvar::hp}}', context).text).toBe('');
        expect(resolveMacros('{{setvar::hp::10}}{{getvar::hp}}', context).text).toBe('10');
    });

    it('全局变量独立于会话变量', () => {
        const context = createContext();
        expect(resolveMacros('{{setglobalvar::world::艾泽}}{{getglobalvar::world}}', context).text).toBe('艾泽');
        expect(resolveMacros('{{getvar::world}}', context).text).toBe('');
    });

    it('addvar / incvar / decvar 基于基线计算', () => {
        const createFreshContext = (): MacroContext =>
            createContext({ variables: createVariables({ local: { hp: '10' } }) });

        expect(resolveMacros('{{incvar::hp}}{{getvar::hp}}', createFreshContext()).text).toBe('11');
        expect(resolveMacros('{{addvar::hp::5}}{{getvar::hp}}', createFreshContext()).text).toBe('15');
        expect(resolveMacros('{{decvar::hp}}{{getvar::hp}}', createFreshContext()).text).toBe('9');
    });

    it('变量写入进入暂存并记录 mutation，基线不变', () => {
        const variables = createVariables({ local: { hp: '10' } });
        resolveMacros('{{setvar::hp::20}}{{setglobalvar::mood::平静}}', createContext({ variables }));

        expect(variables.get('local', 'hp')).toBe('20');
        expect(variables.get('global', 'mood')).toBe('平静');
        expect(variables.hasChanges()).toBe(true);
        expect(variables.getMutations()).toEqual([
            { scope: 'local', name: 'hp', previous: '10', value: '20' },
            { scope: 'global', name: 'mood', previous: null, value: '平静' }
        ]);
        expect(variables.toSnapshot()).toEqual({ local: { hp: '20' }, global: { mood: '平静' } });
    });
});

describe('MacroRuntime if 块', () => {
    it('基本分支', () => {
        expect(resolveMacros('{{if 1}}A{{else}}B{{/if}}', createContext()).text).toBe('A');
        expect(resolveMacros('{{if 0}}A{{else}}B{{/if}}', createContext()).text).toBe('B');
        expect(resolveMacros('{{if 0}}A{{/if}}', createContext()).text).toBe('');
        expect(resolveMacros('{{if hello}}A{{else}}B{{/if}}', createContext()).text).toBe('A');
        expect(resolveMacros('{{if false}}A{{else}}B{{/if}}', createContext()).text).toBe('B');
    });

    it('变量比较条件', () => {
        const context = createContext({ variables: createVariables({ local: { hp: '10' } }) });

        expect(resolveMacros('{{if {{getvar::hp}} >= 10}}高{{else}}低{{/if}}', context).text).toBe('高');
        expect(resolveMacros('{{if {{getvar::hp}} == 9}}高{{else}}低{{/if}}', context).text).toBe('低');
        expect(resolveMacros('{{if getvar::hp > 5}}高{{else}}低{{/if}}', context).text).toBe('高');
    });

    it('嵌套 if 块', () => {
        const text = '{{if 1}}A{{if 0}}X{{else}}Y{{/if}}B{{/if}}';
        expect(resolveMacros(text, createContext()).text).toBe('AYB');
    });

    it('分支内容中的普通宏会被解析', () => {
        expect(resolveMacros('{{if 1}}{{char}}{{/if}}', createContext()).text).toBe('爱丽丝');
    });

    it('未闭合与孤立标签按原文保留', () => {
        expect(resolveMacros('{{if 1}}A', createContext()).text).toBe('{{if 1}}A');
        expect(resolveMacros('A{{/if}}B', createContext()).text).toBe('A{{/if}}B');
    });
});

describe('StagedMacroVariables', () => {
    it('读取优先级：暂存 > 基线 > null', () => {
        const variables = createVariables({ local: { a: '1' } });

        expect(variables.get('local', 'a')).toBe('1');
        expect(variables.get('local', 'b')).toBeNull();
        variables.set('local', 'a', '2');
        expect(variables.get('local', 'a')).toBe('2');
    });

    it('toSnapshot 合并暂存与基线且不改动基线', () => {
        const base: MacroVariableSnapshot = { local: { a: '1' }, global: {} };
        const variables = new StagedMacroVariables(base);
        variables.set('local', 'b', '2');

        expect(variables.toSnapshot()).toEqual({ local: { a: '1', b: '2' }, global: {} });
        expect(base).toEqual({ local: { a: '1' }, global: {} });
    });
});
