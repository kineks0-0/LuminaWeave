import type { ResourceDiagnostic } from '@shared/resources/index.js';
import type { CleanedMessage } from '../../../../types/nexus.js';
import type {
    PromptAssemblyOptions,
    PromptAssemblyResult,
    PromptPlannedUnit,
    PromptSourceSpan,
    PromptSourceTrace,
    PromptSourceUnit,
    PromptTransformTrace
} from '../../../../types/PromptAssemblyTypes.js';
import { PromptInformationPlanner } from './PromptInformationPlanner.js';

const createTraceId = (unitId: string, index: number): string => `${unitId}#${index}`;

const appendWithOffsets = (
    current: string,
    addition: string
): { content: string; start: number; end: number } => {
    const separator = current.length > 0 ? '\n\n' : '';
    const start = current.length + separator.length;
    const content = `${current}${separator}${addition}`;
    return {
        content,
        start,
        end: start + addition.length
    };
};

export class PromptAssemblyTracer {
    static assemble(
        sourceUnits: PromptSourceUnit[],
        options: PromptAssemblyOptions & { diagnostics?: ResourceDiagnostic[] } = {}
    ): PromptAssemblyResult {
        const plannedUnits = PromptInformationPlanner.plan(sourceUnits);
        return this.assemblePlanned(plannedUnits, {
            mergeLeadingSystemMessages: options.mergeLeadingSystemMessages,
            diagnostics: options.diagnostics
        });
    }

    static assemblePlanned(
        plannedUnits: PromptPlannedUnit[],
        options: PromptAssemblyOptions & { diagnostics?: ResourceDiagnostic[] } = {}
    ): PromptAssemblyResult {
        if (options.mergeLeadingSystemMessages) {
            return this.assembleWithLeadingSystemMerge(plannedUnits, options.diagnostics ?? []);
        }
        return this.assembleOneMessagePerUnit(plannedUnits, options.diagnostics ?? []);
    }

    private static assembleOneMessagePerUnit(
        plannedUnits: PromptPlannedUnit[],
        diagnostics: ResourceDiagnostic[]
    ): PromptAssemblyResult {
        const messages: CleanedMessage[] = [];
        const trace: PromptSourceTrace[] = [];

        plannedUnits.forEach((unit, unitIndex) => {
            if (!unit.finalContent.trim() || unit.inclusion === 'hidden') {
                trace.push(this.toTrace(unit, unitIndex, null, null, null));
                return;
            }

            const outputMessageIndex = messages.length;
            messages.push({ role: unit.roleHint, content: unit.finalContent });
            trace.push(this.toTrace(unit, unitIndex, outputMessageIndex, 0, unit.finalContent.length));
        });

        return {
            messages,
            sourceUnits: plannedUnits,
            plannedUnits,
            trace,
            diagnostics,
            tokenUsage: this.estimateUsage(plannedUnits)
        };
    }

    private static assembleWithLeadingSystemMerge(
        plannedUnits: PromptPlannedUnit[],
        diagnostics: ResourceDiagnostic[]
    ): PromptAssemblyResult {
        const messages: CleanedMessage[] = [];
        const trace: PromptSourceTrace[] = [];
        let systemBuffer = '';
        let systemMessageIndex: number | null = null;
        let hasFlushedLeadingSystem = false;

        const flushSystemBuffer = () => {
            if (!systemBuffer.trim()) return;
            if (systemMessageIndex === null) {
                systemMessageIndex = messages.length;
                messages.push({ role: 'system', content: systemBuffer });
            } else {
                messages[systemMessageIndex] = { role: 'system', content: systemBuffer };
            }
        };

        plannedUnits.forEach((unit, unitIndex) => {
            if (!unit.finalContent.trim() || unit.inclusion === 'hidden') {
                trace.push(this.toTrace(unit, unitIndex, null, null, null));
                return;
            }

            if (!hasFlushedLeadingSystem && unit.roleHint === 'system') {
                const appended = appendWithOffsets(systemBuffer, unit.finalContent);
                systemBuffer = appended.content;
                const transforms = systemBuffer === unit.finalContent
                    ? unit.transforms
                    : [...unit.transforms, this.createMergeTransform(unit.finalContent.length)];
                const traceUnit = { ...unit, transforms };
                flushSystemBuffer();
                trace.push(this.toTrace(traceUnit, unitIndex, systemMessageIndex, appended.start, appended.end));
                return;
            }

            if (!hasFlushedLeadingSystem) {
                flushSystemBuffer();
                hasFlushedLeadingSystem = true;
            }

            const outputMessageIndex = messages.length;
            messages.push({ role: unit.roleHint, content: unit.finalContent });
            trace.push(this.toTrace(unit, unitIndex, outputMessageIndex, 0, unit.finalContent.length));
        });

        flushSystemBuffer();

        return {
            messages,
            sourceUnits: plannedUnits,
            plannedUnits,
            trace,
            diagnostics,
            tokenUsage: this.estimateUsage(plannedUnits)
        };
    }

    private static toTrace(
        unit: PromptPlannedUnit,
        index: number,
        outputMessageIndex: number | null,
        outputStart: number | null,
        outputEnd: number | null
    ): PromptSourceTrace {
        return {
            traceId: createTraceId(unit.id, index),
            unitId: unit.id,
            kind: unit.kind,
            sourceKind: unit.sourceKind,
            resourceRef: unit.resourceRef,
            sourcePath: unit.sourcePath,
            label: unit.label,
            role: unit.roleHint,
            inclusion: unit.inclusion,
            outputMessageIndex,
            outputStart,
            outputEnd,
            rawLength: unit.rawContent.length,
            finalLength: unit.finalContent.length,
            transforms: unit.transforms,
            presetEntryId: unit.presetEntryId,
            slotId: unit.slotId,
            forgeSlot: unit.forgeSlot,
            forgeRegion: unit.forgeRegion,
            slotPolicy: unit.slotPolicy,
            sourceSpans: this.offsetSourceSpans(unit.sourceSpans, outputStart, unit.transforms)
        };
    }

    private static offsetSourceSpans(
        spans: PromptSourceSpan[],
        outputStart: number | null,
        transforms: PromptTransformTrace[]
    ): PromptSourceSpan[] {
        if (outputStart === null) {
            return spans.map(span => ({
                ...span,
                finalStart: null,
                finalEnd: null,
                transformTypes: Array.from(new Set([...span.transformTypes, ...transforms.map(transform => transform.type)])),
                lossy: span.lossy || transforms.some(transform => transform.lossy)
            }));
        }
        return spans.map(span => ({
            ...span,
            finalStart: span.finalStart === null ? null : outputStart + span.finalStart,
            finalEnd: span.finalEnd === null ? null : outputStart + span.finalEnd,
            transformTypes: Array.from(new Set([...span.transformTypes, ...transforms.map(transform => transform.type)])),
            lossy: span.lossy || transforms.some(transform => transform.lossy)
        }));
    }

    private static createMergeTransform(afterLength: number): PromptTransformTrace {
        return {
            type: 'merge',
            lossy: false,
            afterLength,
            detail: 'Merged into leading system message.'
        };
    }

    private static estimateUsage(plannedUnits: PromptPlannedUnit[]) {
        const bySourceKind: Record<string, number> = {};
        let estimatedTotal = 0;
        plannedUnits.forEach(unit => {
            const count = Math.ceil(unit.finalContent.length / 4);
            estimatedTotal += count;
            bySourceKind[unit.sourceKind] = (bySourceKind[unit.sourceKind] ?? 0) + count;
        });
        return { estimatedTotal, bySourceKind };
    }
}
