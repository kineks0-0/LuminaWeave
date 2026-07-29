import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PromptPresetComposer } from '@/api/core/hal/prompt/PromptPresetComposer.js';
import { getPromptPresetProfile } from '@/api/core/hal/prompt/PromptPresetProfiles.js';
import { getForgePromptSlotPolicy } from '@/api/core/hal/prompt/ForgePromptSlotPolicies.js';
import { promptPresetRegistry } from '@/api/core/hal/prompt/PromptPresetRegistry.js';
import type { PromptSourceUnit } from '@/types/PromptAssemblyTypes.js';
import type { PromptPresetDefinition } from '@/types/PromptPresetTypes.js';

const { storageGet, storageSet } = vi.hoisted(() => ({
    storageGet: vi.fn((key: string, defaultValue?: unknown) => defaultValue),
    storageSet: vi.fn()
}));

vi.mock('@/api/storage.js', () => ({
    lwStorage: {
        get: storageGet,
        set: storageSet
    }
}));

const createAgentUnit = (
    overrides: Partial<PromptSourceUnit> & Pick<PromptSourceUnit, 'id' | 'label' | 'content'> & {
        forgeSlot: NonNullable<PromptSourceUnit['forgeSlot']>;
    }
): PromptSourceUnit => {
    const slotPolicy = getForgePromptSlotPolicy(overrides.forgeSlot);
    return {
        id: overrides.id,
        kind: overrides.kind ?? 'control',
        sourceKind: overrides.sourceKind ?? 'forge',
        label: overrides.label,
        roleHint: overrides.roleHint ?? 'system',
        priority: overrides.priority ?? 0,
        rawContent: overrides.rawContent ?? overrides.content,
        content: overrides.content,
        summaryContent: overrides.summaryContent,
        budgetPolicy: overrides.budgetPolicy ?? (slotPolicy.required ? 'pinned' : 'summary'),
        sourcePath: overrides.sourcePath,
        forgeSlot: overrides.forgeSlot,
        forgeRegion: overrides.forgeRegion ?? slotPolicy.region,
        slotPolicy
    };
};

describe('Forge prompt layout slots', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        promptPresetRegistry.resetForTests();
        storageGet.mockImplementation((key: string, defaultValue?: unknown) => defaultValue);
    });

    it('declares preset slot policies for static, skill, resources, working statement, and live input regions', () => {
        const slots = new Map(getPromptPresetProfile('forge-agent').slots.map(item => [item.slot.id, item.slot]));

        expect(slots.get('base_system_prompt')?.forgeSlotPolicy).toMatchObject({
            slot: 'system_static',
            region: 'static_system'
        });
        expect(slots.get('agent_skill_context')?.forgeSlotPolicy).toMatchObject({
            slot: 'skill_full',
            region: 'task_context',
            fallback: 'summary'
        });
        expect(slots.get('agent_working_statement')?.forgeSlotPolicy).toMatchObject({
            slot: 'working_statement',
            region: 'tail_restatement',
            required: true
        });
        expect(slots.get('agent_user_input')?.forgeSlotPolicy).toMatchObject({
            slot: 'user_input',
            region: 'live_input',
            required: true
        });
    });

    it('hydrates agent source units by slot without flattening skill content into preset entries', () => {
        const preset: PromptPresetDefinition = {
            id: 'agent-layout-test',
            name: 'Agent Layout Test',
            profileId: 'forge-agent',
            engine: 'composed',
            entries: [
                { id: 'slot:base_system_prompt', type: 'slot', enabled: true, slotId: 'base_system_prompt' },
                { id: 'slot:agent_skill_context', type: 'slot', enabled: true, slotId: 'agent_skill_context' },
                { id: 'slot:agent_project_resources', type: 'slot', enabled: true, slotId: 'agent_project_resources' },
                { id: 'slot:agent_working_statement', type: 'slot', enabled: true, slotId: 'agent_working_statement' },
                { id: 'slot:agent_user_input', type: 'slot', enabled: true, slotId: 'agent_user_input' }
            ],
            specials: {},
            generationSettings: {},
            createdAt: 1,
            updatedAt: 1
        };

        const result = PromptPresetComposer.composeWithTrace('forge-agent', preset, {
            baseSystemPromptKey: 'agentSystemPrompt',
            macroContext: {
                agentSystemPrompt: 'STATIC FORGE SYSTEM'
            },
            forgeAgentSourceUnits: [
                createAgentUnit({
                    id: 'skill:memory-curator',
                    sourceKind: 'skill',
                    forgeSlot: 'skill_full',
                    label: 'Memory Curator',
                    content: '# Memory Curator\nUse memory typed effects.'
                }),
                createAgentUnit({
                    id: 'project:resources',
                    kind: 'state',
                    sourceKind: 'forge',
                    forgeSlot: 'project_resources',
                    label: 'Project Resources',
                    content: 'lorebook: 2\nmemory: 1'
                }),
                createAgentUnit({
                    id: 'working:current',
                    forgeSlot: 'working_statement',
                    label: 'Current Working Statement',
                    content: 'project=forge_project_alpha\nworkspace=/workspaces/forge/forge_project_alpha'
                }),
                createAgentUnit({
                    id: 'user-input:current',
                    sourceKind: 'user_input',
                    forgeSlot: 'user_input',
                    label: 'Current User Input',
                    roleHint: 'user',
                    content: '请更新记忆'
                })
            ]
        });

        const skillTrace = result.trace.find(trace => trace.forgeSlot === 'skill_full');
        expect(skillTrace).toMatchObject({
            sourceKind: 'skill',
            slotId: 'agent_skill_context',
            presetEntryId: 'slot:agent_skill_context',
            forgeRegion: 'task_context'
        });
        expect(result.messages.some(message => message.content.includes('# Memory Curator'))).toBe(true);
        expect(result.messages[0].content).toBe('STATIC FORGE SYSTEM');
        expect(result.messages[0].content).not.toContain('forge_project_alpha');
        expect(result.trace.find(trace => trace.forgeSlot === 'working_statement')).toMatchObject({
            forgeRegion: 'tail_restatement',
            slotId: 'agent_working_statement',
            sourceKind: 'forge'
        });
        expect(result.trace.find(trace => trace.forgeSlot === 'user_input')).toMatchObject({
            role: 'user',
            forgeRegion: 'live_input'
        });
    });
});
