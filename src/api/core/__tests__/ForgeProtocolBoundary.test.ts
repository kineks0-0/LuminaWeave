import { describe, expect, it, beforeEach } from 'vitest';
import { PromptBuilder } from '../hal/prompt/PromptBuilder.js';
import { initMockHAL } from './halMock.js';

describe('Forge protocol boundary', () => {
    beforeEach(() => {
        initMockHAL();
    });

    it('应只暴露合法 XML 标签与 <V> 内真实 DSL 组件调用', () => {
        const result = PromptBuilder.buildForgePrompt({
            systemPrompt: 'Forge Start.',
            messages: [],
            includeSystemProtocol: true
        });

        const content = result[0].content;

        expect(content).toContain('<forge_skill>');
        expect(content).toContain('<draft_plan>');
        expect(content).toContain('<entry_update>');
        expect(content).toContain('<V>');
        expect(content).toContain('ForgeChoiceGroup(');
        expect(content).toContain('ForgeFacetChecklist(');

        expect(content).not.toContain('<forge_facet_checklist');
        expect(content).not.toContain('<ForgeFacetChecklist');
        expect(content).not.toContain('<forge_choice_group');
        expect(content).not.toContain('ForgeFacetChecklist(formId=');
        expect(content).not.toContain('ForgeChoiceGroup(formId=');
    });
});
