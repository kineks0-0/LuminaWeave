import type { ResourceDiagnostic, ResourceRef } from '@shared/resources/index.js';
import type { CleanedMessage } from './nexus.js';

export type PromptAssemblyTarget =
    | 'chat.continuation'
    | 'forge.card'
    | 'forge.conversation'
    | 'forge.planner'
    | 'forge.analyst'
    | 'forge.executor'
    | 'director.memory';

export type PromptAssemblyEngine = 'st-native' | 'lumina';

export type PromptAssemblyEnginePolicy = 'auto' | PromptAssemblyEngine | 'lumina-assembly';

export type PromptSourceMode = 'bound-session' | 'project' | 'manual';

export type PromptSessionBinding =
    | {
        kind: 'st-chat';
        chatId: string;
        characterId?: string;
        conversationId?: string;
        sourceId?: 'chat' | 'forge' | 'director' | string;
    }
    | {
        kind: 'plugin-session';
        sessionId: string;
        sourceId: 'chat' | 'forge' | 'director' | string;
        conversationId?: string;
        forgeProjectId?: string;
    };

export interface PromptAssemblyPolicy {
    engine?: PromptAssemblyEnginePolicy;
    sourceMode?: PromptSourceMode;
}

export interface PromptAssemblyRequest {
    target: PromptAssemblyTarget;
    sessionBinding: PromptSessionBinding;
    policy?: PromptAssemblyPolicy;
    presetId?: string;
    inputs?: Record<string, unknown>;
}

export interface PromptAssemblyRouteDecision {
    target: PromptAssemblyTarget;
    requestedEngine: PromptAssemblyEnginePolicy;
    engine: PromptAssemblyEngine;
    sessionBinding: PromptSessionBinding;
    sourceMode: PromptSourceMode;
    reason: string;
    diagnostics: ResourceDiagnostic[];
}

export type PromptSourceUnitKind = 'control' | 'information' | 'state';

export type PromptSourceKind =
    | 'preset'
    | 'character'
    | 'worldbook'
    | 'history'
    | 'memory'
    | 'forge'
    | 'skill'
    | 'shell'
    | 'tool'
    | 'user_input'
    | 'system_protocol'
    | 'macro'
    | 'unknown';

export type PromptSourceBudgetPolicy = 'pinned' | 'full' | 'summary' | 'droppable';

export type PromptUnitInclusion = 'full' | 'summary' | 'hidden' | 'pinned' | 'compressed';

export type ForgePromptSlot =
    | 'system_static'
    | 'runtime_contract'
    | 'skill_full'
    | 'skill_summary'
    | 'project_resources'
    | 'conversation_context'
    | 'review_state'
    | 'working_statement'
    | 'user_input';

export type ForgePromptRegion =
    | 'static_system'
    | 'stable_context'
    | 'task_context'
    | 'tail_restatement'
    | 'live_input';

export type ForgePromptSlotPriority = 'critical' | 'high' | 'normal' | 'low';

export type ForgePromptSlotFallback = 'summary' | 'hidden' | 'diagnostic';

export interface ForgePromptSlotPolicy {
    slot: ForgePromptSlot;
    region: ForgePromptRegion;
    required: boolean;
    priority: ForgePromptSlotPriority;
    fallback?: ForgePromptSlotFallback;
    maxChars?: number;
}

export type PromptTransformType = 'macro' | 'summary' | 'merge' | 'compact' | 'filter' | 'role-map' | 'truncate';

export interface PromptTransformTrace {
    type: PromptTransformType;
    lossy: boolean;
    beforeLength?: number;
    afterLength?: number;
    detail?: string;
}

export interface PromptSourceSpan {
    sourceUnitId: string;
    sourceKind: PromptSourceKind;
    resourceRef?: ResourceRef;
    sourcePath?: string;
    label: string;
    rawStart: number;
    rawEnd: number;
    finalStart: number | null;
    finalEnd: number | null;
    transformTypes: PromptTransformType[];
    lossy: boolean;
}

export interface PromptSourceUnit {
    id: string;
    kind: PromptSourceUnitKind;
    sourceKind: PromptSourceKind;
    resourceRef?: ResourceRef;
    sourcePath?: string;
    label: string;
    roleHint: CleanedMessage['role'];
    priority: number;
    rawContent: string;
    content: string;
    summaryContent?: string;
    budgetPolicy?: PromptSourceBudgetPolicy;
    forgeSlot?: ForgePromptSlot;
    forgeRegion?: ForgePromptRegion;
    slotPolicy?: ForgePromptSlotPolicy;
    presetEntryId?: string;
    slotId?: string;
    sourceSpans?: PromptSourceSpan[];
}

export interface PromptPlannedUnit extends PromptSourceUnit {
    inclusion: PromptUnitInclusion;
    finalContent: string;
    transforms: PromptTransformTrace[];
    sourceSpans: PromptSourceSpan[];
}

export interface PromptSourceTrace {
    traceId: string;
    unitId: string;
    kind: PromptSourceUnitKind;
    sourceKind: PromptSourceKind;
    resourceRef?: ResourceRef;
    sourcePath?: string;
    label: string;
    role: CleanedMessage['role'];
    inclusion: PromptUnitInclusion;
    outputMessageIndex: number | null;
    outputStart: number | null;
    outputEnd: number | null;
    rawLength: number;
    finalLength: number;
    transforms: PromptTransformTrace[];
    presetEntryId?: string;
    slotId?: string;
    forgeSlot?: ForgePromptSlot;
    forgeRegion?: ForgePromptRegion;
    slotPolicy?: ForgePromptSlotPolicy;
    sourceSpans: PromptSourceSpan[];
}

export interface PromptTokenUsage {
    estimatedTotal?: number;
    bySourceKind?: Partial<Record<PromptSourceKind, number>>;
}

export interface PromptAssemblyResult {
    messages: CleanedMessage[];
    sourceUnits: PromptSourceUnit[];
    plannedUnits: PromptPlannedUnit[];
    trace: PromptSourceTrace[];
    diagnostics: ResourceDiagnostic[];
    route?: PromptAssemblyRouteDecision;
    tokenUsage?: PromptTokenUsage;
}

export interface PromptInformationPlannerOptions {
    maxInformationChars?: number;
    truncateChars?: number;
    preserveControl?: boolean;
}

export interface PromptAssemblyOptions {
    mergeLeadingSystemMessages?: boolean;
}
