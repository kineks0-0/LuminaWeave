import type {
    ForgePromptRegion,
    ForgePromptSlot,
    PromptSourceKind,
    PromptUnitInclusion
} from './PromptAssemblyTypes.js';
import type { ForgeWorkflowSnapshot } from './ForgeWorkflowTypes.js';

export type ForgeAgentIntent = 'conversation' | 'planning' | 'edit' | 'review' | 'test' | 'export';

export interface ForgeAgentProjectResourceSnapshot {
    lorebookEntryCount: number;
    memoryEntryCount: number;
    draftNodeCount: number;
    stagingCount: number;
    commitReadyCount: number;
}

export interface ForgeWorkingStatement {
    forgeProjectId: string;
    conversationId: string;
    workspacePath: string;
    activeLeafId: string | null;
    intent: ForgeAgentIntent;
    visiblePhase: ForgeWorkflowSnapshot['visiblePhase'] | 'unknown';
    activeLayer: ForgeWorkflowSnapshot['activeLayer'] | 'unknown';
    detailMode: ForgeWorkflowSnapshot['detailMode'] | 'unknown';
    promptMode: ForgeWorkflowSnapshot['promptMode'] | 'unknown';
    selectedSkills: string[];
    loadedCapabilities: string[];
    shellProfiles: string[];
    projectResources: ForgeAgentProjectResourceSnapshot;
    writeScope: string;
    reviewGate: {
        stagingCount: number;
        commitReadyCount: number;
        requiresUserDecision: boolean;
    };
    recommendedAction: string;
    summary: string;
    lines: string[];
}

export interface ForgePromptPreviewAgentCapability {
    id: string;
    title: string;
    loadAs: string;
    risk: string;
    namespace?: string;
    shellProfile?: string;
    skillName?: string;
}

export interface ForgePromptPreviewGraphTraceItem {
    node: string;
    summary: string;
}

export interface ForgePromptPreviewAttentionSource {
    id: string;
    label: string;
    kind: string;
    sourceKind: PromptSourceKind;
    inclusion: PromptUnitInclusion | 'source-only';
    forgeSlot?: ForgePromptSlot;
    forgeRegion?: ForgePromptRegion;
    sourcePath?: string;
    outputMessageIndex: number | null;
}

export interface ForgePromptPreviewAgentContext {
    intent: ForgeAgentIntent;
    graphTrace: ForgePromptPreviewGraphTraceItem[];
    selectedSkills: string[];
    loadedCapabilities: ForgePromptPreviewAgentCapability[];
    projectResources: ForgeAgentProjectResourceSnapshot;
    workingStatement: ForgeWorkingStatement;
    attentionSources: ForgePromptPreviewAttentionSource[];
}
