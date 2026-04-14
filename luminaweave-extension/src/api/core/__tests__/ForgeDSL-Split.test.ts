import { describe, expect, it } from 'vitest';
import { splitToSegments } from '../LVParser';

describe('Forge DSL Robust Splitting', () => {
    const splitRegex = /[|｜丨]/;
    const splitOptions = (str: string) => str.split(splitRegex).map(s => s.trim()).filter(Boolean);

    describe('Core Splitting Logic (Used inside Components)', () => {
        it('should correctly split strings with various pipe characters', () => {
            const input = "选项A|选项B｜选项C丨选项D";
            const result = splitOptions(input);
            expect(result).toEqual(['选项A', '选项B', '选项C', '选项D']);
        });
    });

    describe('Function Style DSL (Parser + Component Logic)', () => {
        it('should extract and THEN split the user\'s complex string correctly', () => {
            const input = '<V>ForgeChoiceGroup("deep_explore", "entry_point", "这次，我们从何切入？", "他守护的某人（现实中的羁绊）｜纠缠他的梦魇（内在的恐惧/敌人）｜一件有故事的遗物（力量的象征与代价）｜一句标志性的独白（角色的心境与哲学）")</V>';
            const segments = splitToSegments(input);
            const props = segments[0].components![0].props;
            
            // 1. 验证解析器提取正确
            expect(props.options).toBe('他守护的某人（现实中的羁绊）｜纠缠他的梦魇（内在的恐惧/敌人）｜一件有故事的遗物（力量的象征与代价）｜一句标志性的独白（角色的心境与哲学）');
            
            // 2. 验证组件内部拆分逻辑正确
            const options = splitOptions(props.options as string);
            expect(options.length).toBe(4);
            expect(options[0]).toBe('他守护的某人（现实中的羁绊）');
            expect(options[3]).toBe('一句标志性的独白（角色的心境与哲学）');
        });

        it('should extract strings containing CJK radical pipe correctly', () => {
            const input = '<V>ForgeChoiceGroup("id", "key", "label", "选项A丨选项B")</V>';
            const segments = splitToSegments(input);
            const props = segments[0].components![0].props;
            expect(props.options).toBe('选项A丨选项B');
        });
    });

    describe('Pipeline Style DSL (Parser Logic)', () => {
        it('should split fields in pipeline DSL using half-width pipe', () => {
            const input = '<V>FCG|form|key|label|Opt1|Opt2</V>';
            const segments = splitToSegments(input);
            const comp = segments[0].components![0];
            expect(comp.component).toBe('ForgeChoiceGroup');
            expect(comp.props.label).toBe('label');
        });

        it('should split fields in pipeline DSL using full-width pipe', () => {
            const input = '<V>FCG｜form｜key｜label｜Opt1｜Opt2</V>';
            const segments = splitToSegments(input);
            const comp = segments[0].components![0];
            expect(comp.component).toBe('ForgeChoiceGroup');
            expect(comp.props.label).toBe('label');
        });

        it('should split fields in pipeline DSL using CJK radical pipe', () => {
            const input = '<V>FCG丨form丨key丨label丨Opt1丨Opt2</V>';
            const segments = splitToSegments(input);
            const comp = segments[0].components![0];
            expect(comp.component).toBe('ForgeChoiceGroup');
            expect(comp.props.label).toBe('label');
        });

        it('should handle mixed pipe characters in pipeline DSL', () => {
            const input = '<V>FCG|form｜key丨label|Opt1</V>';
            const segments = splitToSegments(input);
            const comp = segments[0].components![0];
            expect(comp.component).toBe('ForgeChoiceGroup');
            expect(comp.props.fieldKey).toBe('key');
            expect(comp.props.label).toBe('label');
        });
    });
});
