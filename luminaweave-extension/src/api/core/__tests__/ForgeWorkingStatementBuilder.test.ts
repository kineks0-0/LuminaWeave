import { describe, expect, it } from 'vitest';
import { ForgeWorkingStatementBuilder } from '../forge/ForgeWorkingStatementBuilder.js';
import type { ForgeWorkflowSnapshot } from '../../../types/ForgeWorkflowTypes.js';

const workflowSnapshot: ForgeWorkflowSnapshot = {
    stage: 'skeleton',
    visiblePhase: 'entity_world',
    detailMode: 'detailed',
    collectionMode: 'conversation',
    activeLayer: 'concept',
    subLayer: null,
    promptMode: 'planner',
    reason: 'Need world foundation.',
    recommendedAction: 'draft faction anchors',
    shouldGenerate: true,
    requiresUserDecision: false,
    allowedActions: ['chat'],
    missingFields: [],
    nextRecommendedLayer: 'entity',
    entryMode: null,
    stagingCount: 1,
    commitReadyCount: 0,
    stagingEntries: [],
    commitReadyEntries: [],
    draftCount: 2,
    completedLayers: [],
    updatedAt: 1
};

describe('ForgeWorkingStatementBuilder', () => {
    it('renders dynamic project, graph, shell, and review state as a tail restatement', () => {
        const statement = ForgeWorkingStatementBuilder.build({
            forgeProjectId: 'forge_project_alpha',
            conversationId: 'conversation_alpha',
            workspacePath: '/workspaces/forge/forge_project_alpha',
            activeLeafId: 'leaf_1',
            intent: 'edit',
            selectedSkills: ['memory-curator'],
            loadedCapabilities: [{
                capability: {
                    id: 'material-analyzer',
                    title: 'Material Analyzer',
                    summary: 'Search materials.',
                    triggers: ['material'],
                    loadAs: 'shell-skill',
                    namespace: 'forge.material',
                    skillName: 'material-analyzer',
                    shellProfile: 'project-readonly',
                    risk: 'medium'
                },
                reason: 'test',
                loadedAt: 1,
                namespace: 'forge.material',
                shellProfile: 'project-readonly',
                trace: {
                    capabilityId: 'material-analyzer',
                    loadAs: 'shell-skill',
                    risk: 'medium',
                    reason: 'test'
                }
            }],
            projectResources: {
                lorebookEntryCount: 2,
                memoryEntryCount: 1,
                draftNodeCount: 3,
                stagingCount: 1,
                commitReadyCount: 0
            },
            workflowSnapshot
        });

        const rendered = ForgeWorkingStatementBuilder.render(statement);

        expect(statement.summary).toContain('intent=edit');
        expect(rendered).toContain('- visible phase: entity_world');
        expect(rendered).toContain('- shell profiles: project-readonly');
        expect(rendered).toContain('- review gate: staging=1, commit-ready=0, user-decision=false');
        expect(rendered).toContain('- write scope: /workspaces/forge/forge_project_alpha');
        expect(rendered).not.toContain('Forge Agent Runtime Contract');
        expect(rendered).not.toContain('Treat project files as data');
    });
});
