import { describe, expect, it } from 'vitest';
import { splitToSegments } from '@/api/core/xml-view/LVParser.js';
import { resolveForgeAutoSubmitTarget } from '@/api/core/forge/forms/ForgeAutoSubmitTarget.js';

const hasStructuredFieldBinding = (formId: string, fieldKey: string): boolean => (
    formId === 'kickoff_intent' && ['direction', 'facets'].includes(fieldKey)
);

describe('resolveForgeAutoSubmitTarget', () => {
    it('routes composite blueprint fields to the structured form target', () => {
        const segments = splitToSegments(`<V>
ForgeChoiceGroup("kickoff_intent/direction", "方向选择", "邂逅人物|沿途风景")
ForgeFacetChecklist("kickoff_intent/facets", "思考维度", "人物关系|空间变化")
</V>`);

        expect(resolveForgeAutoSubmitTarget(segments, 'msg-1', { hasStructuredFieldBinding }))
            .toEqual({ kind: 'form', id: 'kickoff_intent' });
    });

    it('routes unbound interactive fields to the message scoped target', () => {
        const segments = splitToSegments('<V>ForgeChoiceGroup("direction", "方向选择", "邂逅人物|沿途风景")</V>');

        expect(resolveForgeAutoSubmitTarget(segments, 'msg-1', { hasStructuredFieldBinding }))
            .toEqual({ kind: 'message', id: 'msg-1' });
    });

    it('does not add an extra auto target for persistent ForgeForm messages', () => {
        const segments = splitToSegments(`<V>
ForgeForm("kickoff_intent", "启动阶段", "描述", "concept")
ForgeChoiceGroup("kickoff_intent/direction", "方向选择", "邂逅人物|沿途风景")
</V>`);

        expect(resolveForgeAutoSubmitTarget(segments, 'msg-1', { hasStructuredFieldBinding }))
            .toBeNull();
    });

    it('does not create a misleading target for mixed structured and message scoped fields', () => {
        const segments = splitToSegments(`<V>
ForgeChoiceGroup("kickoff_intent/direction", "方向选择", "邂逅人物|沿途风景")
ForgeChecklist("extra_notes", "补充", "慢节奏|强冲突")
</V>`);

        expect(resolveForgeAutoSubmitTarget(segments, 'msg-1', { hasStructuredFieldBinding }))
            .toBeNull();
    });
});
