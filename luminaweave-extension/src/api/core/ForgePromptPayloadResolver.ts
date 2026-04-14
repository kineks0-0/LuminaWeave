import type { MemorySnapshot } from '../../types/MemorySnapshotTypes';
import type {
    ForgeFileMemoryTemplateInput,
    ForgeDraftTreeTemplateInput,
    ForgeMemorySnapshotTemplateInput,
    ForgePlannerPromptPayload,
    ForgeStageSnapshotTemplateInput,
    ForgeStructuredStateTemplateInput,
    ForgeWorkflowSnapshotTemplateInput,
} from '../../types/ForgePromptTypes';
import type { CleanedMessage } from '../../types/nexus';
import type { ForgeWorkflowSnapshot } from '../../types/ForgeWorkflowTypes';
import type { ForgeMemoryTree } from '../../types/ForgeMemoryTypes.js';
import type { ForgeDraftTree, ForgeStructuredState } from '../../types/ForgeStructuredTypes.js';

interface BuildPlannerPromptPayloadParams {
    systemPrompt: string;
    messages: CleanedMessage[];
    resolvedLorebookEntries: LuminaLorebookEntry[];
    memorySnapshot: MemorySnapshot;
    forgeMemoryTree?: ForgeMemoryTree;
    structuredState?: ForgeStructuredState;
    draftTree?: ForgeDraftTree;
    workflowSnapshot?: ForgeWorkflowSnapshot | null;
}

export class ForgePromptPayloadResolver {
    static buildPlannerPromptPayload(params: BuildPlannerPromptPayloadParams): ForgePlannerPromptPayload {
        return {
            systemPrompt: params.systemPrompt,
            messages: params.messages,
            resolvedLorebookEntries: params.resolvedLorebookEntries,
            memorySnapshot: params.memorySnapshot,
            forgeMemoryTree: params.forgeMemoryTree,
            structuredState: params.structuredState,
            draftTree: params.draftTree,
            workflowSnapshot: params.workflowSnapshot || null
        };
    }

    static buildMemorySnapshotTemplateInput(snapshot: MemorySnapshot): ForgeMemorySnapshotTemplateInput {
        return {
            sourceId: snapshot.sourceId,
            sessionId: snapshot.sessionId || 'unknown',
            activeLeafId: snapshot.activeLeafId || 'root',
            messageCount: snapshot.messageCount,
            lorebookMode: snapshot.lorebook.versionMode,
            lorebookEntryCount: snapshot.lorebook.entryCount,
            referenceChatLine: snapshot.selectedChatSessionId
                ? `\nreference_chat=${snapshot.selectedChatSessionId}`
                : '',
            referenceSnapshotLine: snapshot.selectedChatSnapshotId
                ? `\nreference_snapshot=${snapshot.selectedChatSnapshotId}`
                : ''
        };
    }

    static buildStructuredStateTemplateInput(structuredState: ForgeStructuredState): ForgeStructuredStateTemplateInput {
        const serializeFieldValue = (value: string | string[]): string => {
            const raw = Array.isArray(value) ? value.join(' | ') : String(value || '');
            const normalized = raw.replace(/\s+/g, ' ').trim();
            if (!normalized) return 'empty';
            return normalized.length > 120 ? `${normalized.slice(0, 117)}...` : normalized;
        };

        const formsDigest = Object.values(structuredState.forms)
            .map(form => `${form.id}:${Object.keys(form.fields).join(',')}`)
            .join(' | ');

        const formsDetail = Object.values(structuredState.forms)
            .map(form => {
                const fieldPairs = Object.entries(form.fields)
                    .map(([fieldKey, fieldState]) => `${fieldKey}=${serializeFieldValue(fieldState.value)}`)
                    .join('; ');
                const missing = form.missingFields.length > 0 ? form.missingFields.join(',') : 'none';
                const submitted = form.lastSubmittedAt ? 'yes' : 'no';
                return `- ${form.id} [layer=${form.layer}; submitted=${submitted}; missing=${missing}] ${fieldPairs || 'no_fields'}`;
            })
            .join('\n');

        return {
            activeFormId: structuredState.activeFormId || 'none',
            activeMessageFormId: structuredState.activeMessageFormId || 'none',
            formCount: Object.keys(structuredState.forms).length,
            lastUpdatedAt: structuredState.lastUpdatedAt,
            formsDigest: formsDigest || 'none',
            formsDetail: formsDetail || 'none'
        };
    }

    static buildForgeMemoryTreeTemplateInput(forgeMemoryTree: ForgeMemoryTree): ForgeFileMemoryTemplateInput {
        const entries = forgeMemoryTree.entries || [];
        return {
            entryCount: entries.length,
            lastUpdatedAt: forgeMemoryTree.lastUpdatedAt || 0,
            entriesDigest: entries.map(entry => entry.path).join(' | ') || 'none',
            entriesDetail: entries.length > 0
                ? entries.map(entry => `- ${entry.path} [source=${entry.source}] ${entry.summary || entry.content}`).join('\n')
                : 'none'
        };
    }

    static buildDraftTreeTemplateInput(draftTree: ForgeDraftTree): ForgeDraftTreeTemplateInput {
        const proposalCount = draftTree.nodes.filter(node => node.status === 'proposal').length;
        const workspaceReadyCount = draftTree.nodes.filter(node => node.status === 'approved_for_workspace').length;

        return {
            draftCount: draftTree.nodes.length,
            proposalCount,
            workspaceReadyCount,
            titlesDigest: draftTree.nodes.map(node => `${node.layer}:${node.title}`).join(' | ') || 'none'
        };
    }

    static buildStageTemplateInput(snapshot: ForgeWorkflowSnapshot): ForgeStageSnapshotTemplateInput {
        return {
            stage: snapshot.stage,
            visiblePhase: snapshot.visiblePhase,
            activeLayer: snapshot.activeLayer,
            nextRecommendedLayer: snapshot.nextRecommendedLayer || 'none',
            allowedActions: (snapshot.allowedActions || []).join(',') || 'none',
            missingFields: (snapshot.missingFields || []).join(',') || 'none',
            completedLayers: (snapshot.completedLayers || []).join(',') || 'none'
        };
    }

    static buildWorkflowTemplateInput(snapshot: ForgeWorkflowSnapshot): ForgeWorkflowSnapshotTemplateInput {
        return {
            stage: snapshot.stage,
            visiblePhase: snapshot.visiblePhase,
            detailMode: snapshot.detailMode || 'none',
            activeLayer: snapshot.activeLayer,
            subLayer: snapshot.subLayer || 'none',
            promptMode: snapshot.promptMode,
            reason: snapshot.reason,
            recommendedAction: snapshot.recommendedAction,
            shouldGenerate: snapshot.shouldGenerate,
            stagingCount: String(snapshot.stagingCount),
            commitReadyCount: String(snapshot.commitReadyCount),
            draftCount: String(snapshot.draftCount || 0),
            missingFields: (snapshot.missingFields || []).join(',') || 'none',
            allowedActions: (snapshot.allowedActions || []).join(',') || 'none',
            nextRecommendedLayer: snapshot.nextRecommendedLayer || 'none',
            requiresUserDecision: snapshot.requiresUserDecision
        };
    }
}
