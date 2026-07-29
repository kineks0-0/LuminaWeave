import { describe, expect, it } from 'vitest';
import {
    buildAgentAttentionSources,
    buildPromptPreviewAgentContext
} from '../store/forgePromptPreviewAgentContext.js';

describe('forgePromptPreviewAgentContext', () => {
    it('matches agent source units to prompt assembly trace entries', () => {
        const sources = buildAgentAttentionSources([
            {
                id: 'skill-virtual-lorebook',
                label: '虚拟世界书编辑',
                kind: 'skill',
                sourceKind: 'forge-agent',
                forgeSlot: 'skills',
                forgeRegion: 'agent'
            }
        ] as any, {
            trace: [
                {
                    traceId: 'trace-1',
                    unitId: 'forge:skill-virtual-lorebook:body',
                    label: '虚拟世界书编辑',
                    kind: 'skill',
                    sourceKind: 'forge-agent',
                    inclusion: 'included',
                    forgeSlot: 'skills',
                    forgeRegion: 'agent',
                    sourcePath: 'skills/virtual-lorebook.md',
                    outputMessageIndex: 0
                }
            ]
        } as any);

        expect(sources).toEqual([{
            id: 'skill-virtual-lorebook',
            label: '虚拟世界书编辑',
            kind: 'skill',
            sourceKind: 'forge-agent',
            inclusion: 'included',
            forgeSlot: 'skills',
            forgeRegion: 'agent',
            sourcePath: undefined,
            outputMessageIndex: 0
        }]);
    });

    it('keeps assembly-only forge trace entries visible', () => {
        const sources = buildAgentAttentionSources([], {
            trace: [
                {
                    traceId: 'trace-extra',
                    unitId: 'assembly-only',
                    label: '阶段边界',
                    kind: 'context',
                    sourceKind: 'forge-agent',
                    inclusion: 'included',
                    forgeSlot: 'boundary',
                    forgeRegion: 'runtime',
                    sourcePath: 'context/boundary.md',
                    outputMessageIndex: 1
                }
            ]
        } as any);

        expect(sources).toEqual([{
            id: 'assembly-only',
            label: '阶段边界',
            kind: 'context',
            sourceKind: 'forge-agent',
            inclusion: 'included',
            forgeSlot: 'boundary',
            forgeRegion: 'runtime',
            sourcePath: 'context/boundary.md',
            outputMessageIndex: 1
        }]);
    });

    it('projects graph capabilities into prompt preview agent context', () => {
        const context = buildPromptPreviewAgentContext({
            intent: 'conversation',
            trace: [{ node: 'capability-index' }],
            selectedSkills: ['虚拟世界书编辑'],
            loadedCapabilities: [{
                capability: {
                    id: 'virtual-lorebook-editor',
                    title: '虚拟世界书编辑',
                    loadAs: 'tool',
                    risk: 'review-gated',
                    skillName: '虚拟世界书编辑'
                },
                namespace: 'forge',
                shellProfile: 'project-readonly'
            }],
            projectResources: [{ id: 'resource-1' }],
            workingStatement: '只生成可审阅 proposal',
            promptSourceUnits: []
        } as any);

        expect(context.loadedCapabilities).toEqual([{
            id: 'virtual-lorebook-editor',
            title: '虚拟世界书编辑',
            loadAs: 'tool',
            risk: 'review-gated',
            namespace: 'forge',
            shellProfile: 'project-readonly',
            skillName: '虚拟世界书编辑'
        }]);
        expect(context.workingStatement).toBe('只生成可审阅 proposal');
    });
});
