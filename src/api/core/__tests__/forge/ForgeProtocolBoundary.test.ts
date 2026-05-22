import { describe, expect, it, beforeEach } from 'vitest';
import { PromptBuilder } from '@/api/core/hal/prompt/PromptBuilder.js';
import { initMockHAL } from '@/api/core/__tests__/support/halMock.js';

describe('Forge protocol boundary', () => {
    beforeEach(() => {
        initMockHAL();
    });

    it('Forge 主协议应转向原生 tool calling，只保留 <V> 作为 DSL 容器', () => {
        const result = PromptBuilder.buildForgePrompt({
            systemPrompt: 'Forge Start.',
            messages: [],
            includeSystemProtocol: true
        });

        const content = result[0].content;

        expect(content).toContain('原生 tool calling');
        expect(content).toContain('capabilitySearch');
        expect(content).toContain('skillLoad');
        expect(content).toContain('stageEntry');
        expect(content).toContain('<V>');
        expect(content).toContain('ForgeChoiceGroup(');
        expect(content).toContain('ForgeFacetChecklist(');

        expect(content).not.toContain('<forge_skill>');
        expect(content).not.toContain('<draft_plan>');
        expect(content).not.toContain('<entry_update>');
        expect(content).not.toContain('<forge_facet_checklist');
        expect(content).not.toContain('<ForgeFacetChecklist');
        expect(content).not.toContain('<forge_choice_group');
        expect(content).not.toContain('ForgeFacetChecklist(formId=');
        expect(content).not.toContain('ForgeChoiceGroup(formId=');
    });
});
