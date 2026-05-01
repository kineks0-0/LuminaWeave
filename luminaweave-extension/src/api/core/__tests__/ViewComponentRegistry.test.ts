import { describe, expect, it } from 'vitest';
import { viewComponentRegistry } from '../ViewComponentRegistry';

describe('ViewComponentRegistry documentation', () => {
    it('Forge 示例应使用可读占位词，而不是泛化的“示例”', () => {
        const docs = viewComponentRegistry.getDocumentation('functional');

        expect(docs).toContain('ForgeChoiceGroup("kickoff_intent/direction", "标题内容", "正文1|按钮1", "正文2|按钮2")');
        expect(docs).toContain('ForgeForm("role_core", "角色基元采集"');
        expect(docs).toContain('表单 ID');
        expect(docs).toContain('字段标识路径');
        expect(docs).toContain('摘要卡的语气/视觉风格标记');
        expect(docs).not.toContain('"示例"');
        expect(docs).not.toContain('示例", "示例"');
    });
});

describe('ViewComponentRegistry mapPositionalArgs (Smart Shifting)', () => {
    it('应按复合 fieldKey 映射 ForgeChoiceGroup 三参数调用', () => {
        const schema = viewComponentRegistry.resolve('ForgeChoiceGroup')!;
        const args = ["kickoff_intent/direction", "这次创作更想探索哪种核心冲突？", "选项A|选项B|选项C"];
        const props = viewComponentRegistry.mapPositionalArgs(schema, args);

        expect(props.formId).toBeUndefined();
        expect(props.fieldKey).toBe('kickoff_intent/direction');
        expect(props.label).toBe('这次创作更想探索哪种核心冲突？');
        expect(props.options).toBe('选项A|选项B|选项C');
    });

    it('应按复合 fieldKey 映射 ForgeFacetChecklist 三参数调用', () => {
        const schema = viewComponentRegistry.resolve('ForgeFacetChecklist')!;
        const args = ["kickoff_intent/facets", "聚焦维度", "维度1|维度2"];
        const props = viewComponentRegistry.mapPositionalArgs(schema, args);

        expect(props.formId).toBeUndefined();
        expect(props.fieldKey).toBe('kickoff_intent/facets');
        expect(props.options).toBe('维度1|维度2');
    });

    it('应在富选项 varargs 调用下保留 options 数组，而不是拼回单字符串', () => {
        const schema = viewComponentRegistry.resolve('ForgeChoiceGroup')!;
        const args = ['kickoff_intent/direction', '选择方向', '正文1|按钮1', '正文2|按钮2'];
        const props = viewComponentRegistry.mapPositionalArgs(schema, args);

        expect(props.options).toEqual(['正文1|按钮1', '正文2|按钮2']);
    });

    it('不应拆分复合 path，路径拆分由组件负责', () => {
        const schema = viewComponentRegistry.resolve('ForgeChoiceGroup')!;
        const args = ["my_form/my_key", "My Label", "Opt1|Opt2"];
        const props = viewComponentRegistry.mapPositionalArgs(schema, args);

        expect(props.formId).toBeUndefined();
        expect(props.fieldKey).toBe('my_form/my_key');
    });

    it('不应为 ForgeInput 注入独立 formId', () => {
        const schema = viewComponentRegistry.resolve('ForgeInput')!;
        const args = ["form/key", "label", "placeholder"];
        const props = viewComponentRegistry.mapPositionalArgs(schema, args);

        expect(props.formId).toBeUndefined();
        expect(props.fieldKey).toBe('form/key');
        expect(props.label).toBe('label');
        expect(props.placeholder).toBe('placeholder');
    });
});
