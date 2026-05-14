import type {
    PromptInformationPlannerOptions,
    PromptPlannedUnit,
    PromptSourceSpan,
    PromptSourceUnit,
    PromptTransformTrace
} from '../../../../types/PromptAssemblyTypes.js';

const DEFAULT_TRUNCATE_CHARS = 600;

const createSummaryTransform = (beforeLength: number, afterLength: number): PromptTransformTrace => ({
    type: 'summary',
    lossy: true,
    beforeLength,
    afterLength
});

const createTruncateTransform = (beforeLength: number, afterLength: number): PromptTransformTrace => ({
    type: 'truncate',
    lossy: true,
    beforeLength,
    afterLength
});

const createDefaultSourceSpan = (
    unit: PromptSourceUnit,
    finalStart: number | null,
    finalEnd: number | null,
    transforms: PromptTransformTrace[]
): PromptSourceSpan => ({
    sourceUnitId: unit.id,
    sourceKind: unit.sourceKind,
    resourceRef: unit.resourceRef,
    sourcePath: unit.sourcePath,
    label: unit.label,
    rawStart: 0,
    rawEnd: unit.rawContent.length,
    finalStart,
    finalEnd,
    transformTypes: transforms.map(transform => transform.type),
    lossy: transforms.some(transform => transform.lossy)
});

const sourceSpansFor = (
    unit: PromptSourceUnit,
    finalContent: string,
    transforms: PromptTransformTrace[]
): PromptSourceSpan[] => {
    if (unit.sourceSpans?.length) {
        return unit.sourceSpans.map(span => ({
            ...span,
            finalStart: finalContent ? 0 : null,
            finalEnd: finalContent ? finalContent.length : null,
            transformTypes: Array.from(new Set([...span.transformTypes, ...transforms.map(transform => transform.type)])),
            lossy: span.lossy || transforms.some(transform => transform.lossy)
        }));
    }
    return [createDefaultSourceSpan(unit, finalContent ? 0 : null, finalContent ? finalContent.length : null, transforms)];
};

export class PromptInformationPlanner {
    static plan(
        units: PromptSourceUnit[],
        options: PromptInformationPlannerOptions = {}
    ): PromptPlannedUnit[] {
        const preserveControl = options.preserveControl ?? true;
        const maxInformationChars = options.maxInformationChars ?? Number.POSITIVE_INFINITY;
        const truncateChars = options.truncateChars ?? DEFAULT_TRUNCATE_CHARS;
        let usedInformationChars = 0;

        return units.map((unit): PromptPlannedUnit => {
            if (preserveControl && unit.kind === 'control') {
                return {
                    ...unit,
                    inclusion: unit.budgetPolicy === 'pinned' ? 'pinned' : 'full',
                    finalContent: unit.content,
                    transforms: [],
                    sourceSpans: sourceSpansFor(unit, unit.content, [])
                };
            }

            const fullCost = unit.content.length;
            if (unit.budgetPolicy === 'pinned') {
                usedInformationChars += fullCost;
                return {
                    ...unit,
                    inclusion: 'pinned',
                    finalContent: unit.content,
                    transforms: [],
                    sourceSpans: sourceSpansFor(unit, unit.content, [])
                };
            }

            if (usedInformationChars + fullCost <= maxInformationChars || unit.budgetPolicy === 'full') {
                usedInformationChars += fullCost;
                return {
                    ...unit,
                    inclusion: 'full',
                    finalContent: unit.content,
                    transforms: [],
                    sourceSpans: sourceSpansFor(unit, unit.content, [])
                };
            }

            const summary = unit.summaryContent?.trim();
            if (summary) {
                usedInformationChars += summary.length;
                const transforms = [createSummaryTransform(unit.content.length, summary.length)];
                return {
                    ...unit,
                    inclusion: 'summary',
                    finalContent: summary,
                    transforms,
                    sourceSpans: sourceSpansFor(unit, summary, transforms)
                };
            }

            if (unit.budgetPolicy === 'summary' && unit.content.length > truncateChars) {
                const truncated = `${unit.content.slice(0, Math.max(0, truncateChars - 3)).trimEnd()}...`;
                usedInformationChars += truncated.length;
                const transforms = [createTruncateTransform(unit.content.length, truncated.length)];
                return {
                    ...unit,
                    inclusion: 'summary',
                    finalContent: truncated,
                    transforms,
                    sourceSpans: sourceSpansFor(unit, truncated, transforms)
                };
            }

            const transforms: PromptTransformTrace[] = [{
                type: 'compact',
                lossy: true,
                beforeLength: unit.content.length,
                afterLength: 0,
                detail: 'Excluded by information budget.'
            }];
            return {
                ...unit,
                inclusion: 'hidden',
                finalContent: '',
                transforms,
                sourceSpans: sourceSpansFor(unit, '', transforms)
            };
        });
    }
}
