import { describe, expect, it } from 'vitest';
import { viewComponentRegistry } from '../ViewComponentRegistry';

describe('ViewComponentRegistry documentation', () => {
    it('Forge 示例应使用可读占位词，而不是泛化的“示例”', () => {
        const docs = viewComponentRegistry.getDocumentation('functional');

        expect(docs).toContain('ForgeChoiceGroup("kickoff_intent", "direction", "标题内容", "选项1|选项2|选项3")');
        expect(docs).toContain('ForgeForm("kickoff_intent", "标题内容", "补充说明内容", "concept")');
        expect(docs).toContain('`formId`: 表单 ID');
        expect(docs).toContain('`fieldKey`: 字段键');
        expect(docs).toContain('`tone`: 摘要卡的语气/视觉风格标记');
        expect(docs).not.toContain('"示例"');
        expect(docs).not.toContain('示例", "示例"');
    });
});

describe('ViewComponentRegistry mapPositionalArgs (Smart Shifting)', () => {
    it('应在 ForgeChoiceGroup 缺省 formId 时自动补位 (3 args -> 4 props)', () => {
        const schema = viewComponentRegistry.resolve('ForgeChoiceGroup')!;
        const args = ["direction", "这次创作更想探索哪种核心冲突？", "选项A|选项B|选项C"];
        const props = viewComponentRegistry.mapPositionalArgs(schema, args);

        expect(props.formId).toBeNull();
        expect(props.fieldKey).toBe('direction');
        expect(props.label).toBe('这次创作更想探索哪种核心冲突？');
        expect(props.options).toBe('选项A|选项B|选项C');
    });

    it('应在 ForgeFacetChecklist 缺省 formId 时自动补位 (3 args -> 4 props)', () => {
        const schema = viewComponentRegistry.resolve('ForgeFacetChecklist')!;
        const args = ["facets", "聚焦维度", "维度1|维度2"];
        const props = viewComponentRegistry.mapPositionalArgs(schema, args);

        expect(props.formId).toBeNull();
        expect(props.fieldKey).toBe('facets');
        expect(props.options).toBe('维度1|维度2');
    });

    it('不应干扰正常的 4 参数调用', () => {
        const schema = viewComponentRegistry.resolve('ForgeChoiceGroup')!;
        const args = ["my_form", "my_key", "My Label", "Opt1|Opt2"];
        const props = viewComponentRegistry.mapPositionalArgs(schema, args);

        expect(props.formId).toBe('my_form');
        expect(props.fieldKey).toBe('my_key');
    });

    it('不应干扰不含 formId 或选项非必需的组件 (如 ForgeInput)', () => {
        const schema = viewComponentRegistry.resolve('ForgeInput')!;
        // ForgeInput 有 5 个 props，传入 3 个时不应触发 N-1 偏移 (4)
        const args = ["form", "key", "label"];
        const props = viewComponentRegistry.mapPositionalArgs(schema, args);

        expect(props.formId).toBe('form');
        expect(props.fieldKey).toBe('key');
        expect(props.label).toBe('label');
    });
});
