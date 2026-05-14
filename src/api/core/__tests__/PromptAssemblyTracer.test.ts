import { describe, expect, it } from 'vitest';
import { PromptInformationPlanner } from '../hal/prompt/PromptInformationPlanner.js';
import { PromptAssemblyTracer } from '../hal/prompt/PromptAssemblyTracer.js';
import type { PromptSourceUnit } from '../../../types/PromptAssemblyTypes.js';

const createUnit = (partial: Partial<PromptSourceUnit> & Pick<PromptSourceUnit, 'id' | 'kind' | 'sourceKind' | 'content'>): PromptSourceUnit => ({
    label: partial.id,
    roleHint: 'system',
    priority: 0,
    rawContent: partial.content,
    budgetPolicy: 'summary',
    ...partial
});

describe('PromptAssemblyTracer', () => {
    it('planner should preserve control units and summarize information units when budget is exceeded', () => {
        const planned = PromptInformationPlanner.plan([
            createUnit({
                id: 'control',
                kind: 'control',
                sourceKind: 'preset',
                content: 'Do not summarize me.'
            }),
            createUnit({
                id: 'history',
                kind: 'information',
                sourceKind: 'history',
                content: 'Very long history content',
                summaryContent: 'History summary'
            })
        ], { maxInformationChars: 1 });

        expect(planned[0]).toMatchObject({
            inclusion: 'full',
            finalContent: 'Do not summarize me.'
        });
        expect(planned[1]).toMatchObject({
            inclusion: 'summary',
            finalContent: 'History summary'
        });
        expect(planned[1].transforms[0]).toMatchObject({
            type: 'summary',
            lossy: true
        });
    });

    it('assembler should keep hidden units in trace without output offsets', () => {
        const planned = PromptInformationPlanner.plan([
            createUnit({
                id: 'drop',
                kind: 'information',
                sourceKind: 'worldbook',
                content: 'No room and no summary',
                budgetPolicy: 'droppable'
            })
        ], { maxInformationChars: 0 });

        const result = PromptAssemblyTracer.assemblePlanned(planned);

        expect(result.messages).toEqual([]);
        expect(result.trace[0]).toMatchObject({
            inclusion: 'hidden',
            outputMessageIndex: null,
            outputStart: null,
            outputEnd: null
        });
    });

    it('keeps source spans after summary and system merge transforms', () => {
        const planned = PromptInformationPlanner.plan([
            createUnit({
                id: 'control',
                kind: 'control',
                sourceKind: 'preset',
                content: 'System rule.'
            }),
            createUnit({
                id: 'worldbook',
                kind: 'information',
                sourceKind: 'worldbook',
                content: 'Long worldbook detail that must be summarized.',
                summaryContent: 'Worldbook summary.'
            })
        ], { maxInformationChars: 1 });

        const result = PromptAssemblyTracer.assemblePlanned(planned, {
            mergeLeadingSystemMessages: true
        });

        expect(result.messages).toHaveLength(1);
        expect(result.trace[1]).toMatchObject({
            unitId: 'worldbook',
            inclusion: 'summary',
            outputMessageIndex: 0
        });
        expect(result.trace[1].sourceSpans[0]).toMatchObject({
            sourceUnitId: 'worldbook',
            sourceKind: 'worldbook',
            finalStart: 'System rule.\n\n'.length,
            finalEnd: 'System rule.\n\nWorldbook summary.'.length,
            transformTypes: expect.arrayContaining(['summary', 'merge']),
            lossy: true
        });
    });
});
