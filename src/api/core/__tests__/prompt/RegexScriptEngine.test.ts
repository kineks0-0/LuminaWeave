import { describe, it, expect } from 'vitest';
import { REGEX_PLACEMENTS, type RegexScript } from '@/types/RegexScriptTypes.js';
import { RegexScriptEngine } from '@/api/core/hal/regex/RegexScriptEngine.js';
import { parseRegexScripts, serializeRegexScripts } from '@/api/core/hal/regex/RegexScriptDocument.js';

const createScript = (overrides: Partial<RegexScript> = {}): RegexScript => ({
    id: 'r1',
    scriptName: '测试脚本',
    enabled: true,
    findRegex: '/foo/g',
    replaceString: 'bar',
    trimStrings: [],
    placement: [REGEX_PLACEMENTS.userInput],
    markdownOnly: false,
    promptOnly: false,
    runOnEdit: false,
    substituteRegex: 0,
    minDepth: null,
    maxDepth: null,
    ...overrides
});

describe('RegexScriptEngine 应用语义', () => {
    it('按 placement 过滤脚本', () => {
        const engine = new RegexScriptEngine([createScript()]);

        expect(engine.apply('foo', { source: REGEX_PLACEMENTS.userInput, destination: 'prompt' }).text).toBe('bar');
        expect(engine.apply('foo', { source: REGEX_PLACEMENTS.aiOutput, destination: 'prompt' }).text).toBe('foo');
    });

    it('跳过禁用脚本', () => {
        const engine = new RegexScriptEngine([createScript({ enabled: false })]);

        expect(engine.apply('foo', { source: REGEX_PLACEMENTS.userInput, destination: 'prompt' }).text).toBe('foo');
    });

    it('markdownOnly 只作用于显示，promptOnly 只作用于提示词', () => {
        const displayOnly = new RegexScriptEngine([createScript({ markdownOnly: true })]);
        const promptOnly = new RegexScriptEngine([createScript({ promptOnly: true })]);
        const options = { source: REGEX_PLACEMENTS.userInput, destination: 'prompt' as const };
        const displayOptions = { source: REGEX_PLACEMENTS.userInput, destination: 'display' as const };

        expect(displayOnly.apply('foo', options).text).toBe('foo');
        expect(displayOnly.apply('foo', displayOptions).text).toBe('bar');
        expect(promptOnly.apply('foo', options).text).toBe('bar');
        expect(promptOnly.apply('foo', displayOptions).text).toBe('foo');
    });

    it('edit 目标只应用 runOnEdit 脚本', () => {
        const withoutEdit = new RegexScriptEngine([createScript()]);
        const withEdit = new RegexScriptEngine([createScript({ runOnEdit: true })]);
        const options = { source: REGEX_PLACEMENTS.userInput, destination: 'edit' as const };

        expect(withoutEdit.apply('foo', options).text).toBe('foo');
        expect(withEdit.apply('foo', options).text).toBe('bar');
    });

    it('按 minDepth / maxDepth 过滤', () => {
        const engine = new RegexScriptEngine([
            createScript({ placement: [REGEX_PLACEMENTS.aiOutput], minDepth: 2, maxDepth: 4 })
        ]);
        const applyAt = (depth?: number): string => engine.apply('foo', {
            source: REGEX_PLACEMENTS.aiOutput,
            destination: 'prompt',
            ...(depth === undefined ? {} : { depth })
        }).text;

        expect(applyAt(undefined)).toBe('bar');
        expect(applyAt(1)).toBe('foo');
        expect(applyAt(3)).toBe('bar');
        expect(applyAt(5)).toBe('foo');
    });

    it('支持字面量 flags 与捕获组替换', () => {
        const engine = new RegexScriptEngine([
            createScript({ findRegex: '/(\\w+)@(\\w+)/g', replaceString: '$2#$1' })
        ]);

        expect(engine.apply('alice@wonder', { source: REGEX_PLACEMENTS.userInput, destination: 'prompt' }).text)
            .toBe('wonder#alice');
    });

    it('按数组顺序链式应用，后一条看到前一条结果', () => {
        const engine = new RegexScriptEngine([
            createScript({ id: 'r1', findRegex: '/a/g', replaceString: 'b' }),
            createScript({ id: 'r2', findRegex: '/b/g', replaceString: 'c' })
        ]);
        const result = engine.apply('a', { source: REGEX_PLACEMENTS.userInput, destination: 'prompt' });

        expect(result.text).toBe('c');
        expect(result.applied).toEqual(['r1', 'r2']);
    });

    it('无法编译的脚本跳过并警告', () => {
        const engine = new RegexScriptEngine([createScript({ findRegex: '/(/g' })]);
        const result = engine.apply('foo', { source: REGEX_PLACEMENTS.userInput, destination: 'prompt' });

        expect(result.text).toBe('foo');
        expect(result.applied).toEqual([]);
        expect(result.warnings.some(item => item.includes('无法编译'))).toBe(true);
    });

    it('trimStrings 在替换后裁剪结果', () => {
        const engine = new RegexScriptEngine([
            createScript({ findRegex: '/x/g', replaceString: 'y', trimStrings: ['yy'] })
        ]);

        expect(engine.apply('xyy', { source: REGEX_PLACEMENTS.userInput, destination: 'prompt' }).text).toBe('y');
    });

    it('substituteRegex 非 0 时对匹配与替换串做宏替换', () => {
        const engine = new RegexScriptEngine([
            createScript({ findRegex: '/{{char}}/g', replaceString: '{{char}}', substituteRegex: 1 })
        ]);
        const result = engine.apply('Alice', {
            source: REGEX_PLACEMENTS.userInput,
            destination: 'prompt',
            resolveSubstitution: text => text.replace('{{char}}', 'Alice')
        });

        expect(result.text).toBe('Alice');
    });

    it('escaped 模式按 raw 处理并警告', () => {
        const engine = new RegexScriptEngine([
            createScript({ findRegex: '/x/g', replaceString: '{{char}}', substituteRegex: 2 })
        ]);
        const result = engine.apply('x', {
            source: REGEX_PLACEMENTS.userInput,
            destination: 'prompt',
            resolveSubstitution: text => text.replace('{{char}}', 'Alice')
        });

        expect(result.text).toBe('Alice');
        expect(result.warnings.some(item => item.includes('escaped'))).toBe(true);
    });

    it('超过输入长度上限时跳过并警告', () => {
        const engine = new RegexScriptEngine([createScript()]);
        const longText = 'a'.repeat(100_001);
        const result = engine.apply(longText, { source: REGEX_PLACEMENTS.userInput, destination: 'prompt' });

        expect(result.text).toBe(longText);
        expect(result.applied).toEqual([]);
        expect(result.warnings.some(item => item.includes('字符'))).toBe(true);
    });
});

describe('RegexScriptDocument 解析与序列化', () => {
    it('解析 ST 数组并取反 disabled', () => {
        const result = parseRegexScripts([
            {
                id: 123,
                scriptName: '去状态栏',
                findRegex: '/<状态>[\\s\\S]*?<\\/状态>/g',
                replaceString: '',
                trimStrings: ['\n\n'],
                placement: [1, 5],
                disabled: true,
                markdownOnly: true,
                promptOnly: false,
                runOnEdit: true,
                substituteRegex: 2,
                minDepth: 0,
                maxDepth: 4,
                custom_field: 'keep'
            }
        ]);

        expect(result.diagnostics).toEqual([]);
        expect(result.scripts).toHaveLength(1);
        const script = result.scripts[0];
        expect(script.id).toBe('123');
        expect(script.enabled).toBe(false);
        expect(script.scriptName).toBe('去状态栏');
        expect(script.placement).toEqual([1, 5]);
        expect(script.markdownOnly).toBe(true);
        expect(script.runOnEdit).toBe(true);
        expect(script.substituteRegex).toBe(2);
        expect(script.minDepth).toBe(0);
        expect(script.maxDepth).toBe(4);
        expect(script.custom_field).toBe('keep');
    });

    it('接受单对象与 snake_case 回退', () => {
        const result = parseRegexScripts({
            script_name: '兼容脚本',
            find_regex: '/a/g',
            replace_string: 'b',
            run_on_edit: true,
            substitute_regex: 1,
            min_depth: 2,
            trim_strings: ['c']
        });

        expect(result.scripts[0].scriptName).toBe('兼容脚本');
        expect(result.scripts[0].findRegex).toBe('/a/g');
        expect(result.scripts[0].runOnEdit).toBe(true);
        expect(result.scripts[0].substituteRegex).toBe(1);
        expect(result.scripts[0].minDepth).toBe(2);
        expect(result.scripts[0].trimStrings).toEqual(['c']);
    });

    it('过滤非法 placement 值', () => {
        const result = parseRegexScripts([{ scriptName: 'x', placement: [1, 9, 'z', 5, 1] }]);

        expect(result.scripts[0].placement).toEqual([1, 5]);
    });

    it('跳过非法条目并保留合法条目', () => {
        const result = parseRegexScripts([null, 42, { scriptName: 'ok' }]);

        expect(result.scripts).toHaveLength(1);
        expect(result.scripts[0].scriptName).toBe('ok');
        expect(result.diagnostics.filter(item => item.code === 'regex.script_invalid')).toHaveLength(2);
    });

    it('非数组非对象报 invalid_format', () => {
        const result = parseRegexScripts('nope');

        expect(result.scripts).toEqual([]);
        expect(result.diagnostics[0].code).toBe('regex.invalid_format');
    });

    it('序列化保持 ST 字段与 disabled 取反', () => {
        const parsed = parseRegexScripts([
            { id: 'r1', scriptName: 'x', findRegex: '/a/g', replaceString: 'b', placement: [1], disabled: true }
        ]).scripts;
        const serialized = serializeRegexScripts(parsed);

        expect(serialized[0].disabled).toBe(true);
        expect(serialized[0].findRegex).toBe('/a/g');
        expect(serialized[0].scriptName).toBe('x');
        expect(serialized[0].placement).toEqual([1]);

        const reparsed = parseRegexScripts(serialized);
        expect(reparsed.scripts[0].enabled).toBe(false);
        expect(reparsed.scripts[0].findRegex).toBe('/a/g');
    });
});
