import type {
    ForgeAgentGraphResult,
    ForgeAgentPromptSourceUnit
} from '../../../api/core/forge/graph/ForgeAgentGraphRuntime.js';
import type {
    ForgePromptPreviewAgentContext,
    ForgePromptPreviewAttentionSource
} from '../../../types/ForgeAgentTypes.js';
import type { PromptAssemblyResult, PromptSourceTrace } from '../../../types/PromptAssemblyTypes.js';

export const buildAgentAttentionSources = (
    agentUnits: ForgeAgentPromptSourceUnit[],
    assembly?: PromptAssemblyResult
): ForgePromptPreviewAttentionSource[] => {
    const matchedTraceIds = new Set<string>();
    const findTraceForUnit = (unit: ForgeAgentPromptSourceUnit): PromptSourceTrace | undefined => {
        const trace = assembly?.trace.find(item =>
            item.unitId === unit.id || item.unitId.includes(`:${unit.id}:`)
        );
        if (trace) {
            matchedTraceIds.add(trace.traceId);
        }
        return trace;
    };
    const agentUnitIds = new Set(agentUnits.map(unit => unit.id));
    const sources = agentUnits.map((unit) => {
        const trace = findTraceForUnit(unit);
        return {
            id: unit.id,
            label: unit.label,
            kind: unit.kind,
            sourceKind: unit.sourceKind,
            inclusion: trace?.inclusion ?? 'source-only',
            forgeSlot: unit.forgeSlot,
            forgeRegion: unit.forgeRegion,
            sourcePath: unit.sourcePath,
            outputMessageIndex: trace?.outputMessageIndex ?? null
        } satisfies ForgePromptPreviewAttentionSource;
    });
    const assemblyOnly = (assembly?.trace ?? [])
        .filter(trace => Boolean(trace.forgeSlot)
            && !agentUnitIds.has(trace.unitId)
            && !matchedTraceIds.has(trace.traceId))
        .map((trace) => ({
            id: trace.unitId,
            label: trace.label,
            kind: trace.kind,
            sourceKind: trace.sourceKind,
            inclusion: trace.inclusion,
            forgeSlot: trace.forgeSlot,
            forgeRegion: trace.forgeRegion,
            sourcePath: trace.sourcePath,
            outputMessageIndex: trace.outputMessageIndex
        } satisfies ForgePromptPreviewAttentionSource));
    return [...sources, ...assemblyOnly];
};

export const buildPromptPreviewAgentContext = (
    graph: ForgeAgentGraphResult,
    assembly?: PromptAssemblyResult
): ForgePromptPreviewAgentContext => ({
    intent: graph.intent,
    graphTrace: graph.trace,
    selectedSkills: graph.selectedSkills,
    loadedCapabilities: graph.loadedCapabilities.map(item => ({
        id: item.capability.id,
        title: item.capability.title,
        loadAs: item.capability.loadAs,
        risk: item.capability.risk,
        namespace: item.namespace,
        shellProfile: item.shellProfile,
        skillName: item.capability.skillName
    })),
    projectResources: graph.projectResources,
    workingStatement: graph.workingStatement,
    attentionSources: buildAgentAttentionSources(graph.promptSourceUnits, assembly)
});
