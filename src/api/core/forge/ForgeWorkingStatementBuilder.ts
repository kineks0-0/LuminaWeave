import type { ForgeCapabilityLoadResult } from './ForgeCapabilityRegistry.js';
import type { ForgeWorkflowSnapshot } from '../../../types/ForgeWorkflowTypes.js';
import type {
    ForgeAgentIntent,
    ForgeAgentProjectResourceSnapshot,
    ForgeWorkingStatement
} from '../../../types/ForgeAgentTypes.js';

export interface BuildForgeWorkingStatementInput {
    forgeProjectId: string;
    conversationId: string;
    workspacePath: string;
    activeLeafId: string | null;
    intent: ForgeAgentIntent;
    selectedSkills: string[];
    loadedCapabilities: ForgeCapabilityLoadResult[];
    projectResources: ForgeAgentProjectResourceSnapshot;
    workflowSnapshot?: ForgeWorkflowSnapshot | null;
}

const none = (items: string[]): string => items.length > 0 ? items.join(', ') : 'none';

export class ForgeWorkingStatementBuilder {
    static build(input: BuildForgeWorkingStatementInput): ForgeWorkingStatement {
        const workflow = input.workflowSnapshot ?? null;
        const loadedCapabilities = input.loadedCapabilities.map(item => item.capability.id);
        const shellProfiles = input.loadedCapabilities
            .map(item => item.shellProfile)
            .filter((profile): profile is NonNullable<typeof profile> => Boolean(profile));
        const reviewGate = {
            stagingCount: input.projectResources.stagingCount,
            commitReadyCount: input.projectResources.commitReadyCount,
            requiresUserDecision: workflow?.requiresUserDecision ?? input.projectResources.commitReadyCount > 0
        };
        const summary = [
            `intent=${input.intent}`,
            `project=${input.forgeProjectId}`,
            `phase=${workflow?.visiblePhase ?? 'unknown'}`,
            `skills=${none(input.selectedSkills)}`
        ].join(', ');

        const lines = [
            'Current Forge working statement:',
            `- project: ${input.forgeProjectId}`,
            `- conversation: ${input.conversationId}`,
            `- workspace: ${input.workspacePath}`,
            `- active leaf: ${input.activeLeafId ?? 'none'}`,
            `- intent: ${input.intent}`,
            `- visible phase: ${workflow?.visiblePhase ?? 'unknown'}`,
            `- active layer: ${workflow?.activeLayer ?? 'unknown'}`,
            `- detail mode: ${workflow?.detailMode ?? 'unknown'}`,
            `- prompt mode: ${workflow?.promptMode ?? 'unknown'}`,
            `- selected skills: ${none(input.selectedSkills)}`,
            `- loaded capabilities: ${none(loadedCapabilities)}`,
            `- shell profiles: ${none(shellProfiles)}`,
            `- project resources: ${input.projectResources.lorebookEntryCount} lorebook, ${input.projectResources.memoryEntryCount} memory, ${input.projectResources.draftNodeCount} draft nodes`,
            `- review gate: staging=${reviewGate.stagingCount}, commit-ready=${reviewGate.commitReadyCount}, user-decision=${reviewGate.requiresUserDecision}`,
            `- write scope: ${input.workspacePath}`,
            `- recommended action: ${workflow?.recommendedAction || 'continue current Forge project collaboration'}`
        ];

        return {
            forgeProjectId: input.forgeProjectId,
            conversationId: input.conversationId,
            workspacePath: input.workspacePath,
            activeLeafId: input.activeLeafId,
            intent: input.intent,
            visiblePhase: workflow?.visiblePhase ?? 'unknown',
            activeLayer: workflow?.activeLayer ?? 'unknown',
            detailMode: workflow?.detailMode ?? 'unknown',
            promptMode: workflow?.promptMode ?? 'unknown',
            selectedSkills: [...input.selectedSkills],
            loadedCapabilities,
            shellProfiles,
            projectResources: { ...input.projectResources },
            writeScope: input.workspacePath,
            reviewGate,
            recommendedAction: workflow?.recommendedAction || 'continue current Forge project collaboration',
            summary,
            lines
        };
    }

    static render(statement: ForgeWorkingStatement): string {
        return statement.lines.join('\n');
    }
}
