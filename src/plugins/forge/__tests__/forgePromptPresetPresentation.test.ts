import { describe, expect, it } from 'vitest';
import type { PromptPresetDefinition } from '../../../types/PromptPresetTypes.js';
import forgeExecutorDefault from '../../../resources/presets/forge-executor-default.json';
import forgeMainDefault from '../../../resources/presets/forge-main-default.json';
import {
    buildForgePromptPresetResourceGroups,
    buildForgePromptPresetWorkbenchOverview,
    buildForgePromptPresetOrchestrationRows,
    buildForgePromptPresetResourceRows,
    hasForgeAgentResourcePreset,
    summarizeForgePromptPreset
} from '../store/forgePromptPresetPresentation.js';

const preset: PromptPresetDefinition = {
    id: 'built-in:forge-main-default',
    name: '默认主模型',
    profileId: 'forge-main',
    builtIn: true,
    engine: 'composed',
    entries: [],
    specials: {},
    forgeAgentResources: {
        contract: {
            path: './AGENTS.md',
            kind: 'contract',
            title: 'Forge Agent 工作契约',
            content: 'Contract'
        },
        system: {
            path: './.forge/agent/SYSTEM.md',
            kind: 'system',
            title: '默认系统提示词',
            content: 'System'
        },
        modes: {
            planner: {
                path: './.forge/agent/PLANNER.md',
                kind: 'mode_prompt',
                title: 'Planner 模式提示词',
                content: 'Planner'
            },
            conversation: {
                path: './.forge/agent/CONVERSATION.md',
                kind: 'mode_prompt',
                title: 'Conversation 模式提示词',
                content: 'Conversation'
            },
            analyst: {
                path: './.forge/agent/ANALYST.md',
                kind: 'mode_prompt',
                title: 'Analyst 模式提示词',
                content: 'Analyst'
            },
            executor: {
                path: './.forge/agent/EXECUTOR.md',
                kind: 'mode_prompt',
                title: 'Executor 模式提示词',
                content: 'Executor'
            }
        },
        skills: [{
            name: 'virtual-lorebook-editor',
            path: './agent/skills/virtual-lorebook-editor/SKILL.md',
            title: '虚拟世界书编辑',
            loadPolicy: 'always',
            content: 'Skill'
        }]
    },
    forgeAgentOrchestration: {
        label: 'Agent 提示词编排',
        steps: [
            { kind: 'contract', enabled: true, path: './AGENTS.md', title: 'Contract' },
            { kind: 'system', enabled: true, path: './.forge/agent/SYSTEM.md', title: 'System' },
            { kind: 'mode_prompt', enabled: true, path: './.forge/agent/<MODE>.md', title: 'Mode Prompt' },
            { kind: 'ui_dsl', enabled: true, path: './.forge/agent/UI_DSL.md', title: 'UI DSL' },
            { kind: 'reasoning_boundary', enabled: true, path: './.forge/agent/REASONING.md', title: 'Reasoning Boundary' },
            { kind: 'skills', enabled: true, title: 'Skills' },
            { kind: 'capabilities', enabled: true, title: 'Capabilities' },
            { kind: 'memory_index', enabled: true, path: './.pi/agent/context/memory-index.md', title: 'Memory Index' },
            { kind: 'context_files', enabled: true, title: 'Context Files' },
            { kind: 'branch_messages', enabled: true, title: 'Branch Messages' }
        ]
    },
    generationSettings: {},
    createdAt: 0,
    updatedAt: 0
};

describe('forgePromptPresetPresentation', () => {
    it('keeps built-in Forge agent orchestration aligned with prompt resources', () => {
        const expectedKinds = [
            'contract',
            'system',
            'mode_prompt',
            'ui_dsl',
            'reasoning_boundary',
            'skills',
            'capabilities',
            'memory_index',
            'context_files',
            'branch_messages'
        ];

        expect(forgeMainDefault.forgeAgentOrchestration.steps.map(step => step.kind)).toEqual(expectedKinds);
        expect(forgeExecutorDefault.forgeAgentOrchestration.steps.map(step => step.kind)).toEqual(expectedKinds);
    });

    it('projects Forge agent preset resources into user-facing rows', () => {
        expect(hasForgeAgentResourcePreset(preset)).toBe(true);

        const rows = buildForgePromptPresetResourceRows(preset);

        expect(rows.map(row => row.path)).toEqual([
            './AGENTS.md',
            './.forge/agent/SYSTEM.md',
            './.forge/agent/PLANNER.md',
            './.forge/agent/CONVERSATION.md',
            './.forge/agent/ANALYST.md',
            './.forge/agent/EXECUTOR.md',
            './agent/skills/virtual-lorebook-editor/SKILL.md'
        ]);
        expect(rows.find(row => row.path === './AGENTS.md')).toEqual(expect.objectContaining({
            kind: 'contract',
            label: 'Contract'
        }));
    });

    it('projects orchestration steps without using slot wording', () => {
        const rows = buildForgePromptPresetOrchestrationRows(preset);

        expect(rows.map(row => row.kind)).toEqual([
            'contract',
            'system',
            'mode_prompt',
            'ui_dsl',
            'reasoning_boundary',
            'skills',
            'capabilities',
            'memory_index',
            'context_files',
            'branch_messages'
        ]);
        expect(rows.map(row => row.label)).toEqual([
            'Contract',
            'System',
            'Mode Prompt',
            'UI DSL',
            'Reasoning Boundary',
            'Skills',
            'Capabilities',
            'Memory Index',
            'Context Files',
            'Branch Messages'
        ]);
    });

    it('summarizes resource presets separately from legacy composed entries', () => {
        expect(summarizeForgePromptPreset(preset)).toEqual({
            primary: 'Agent 资源包',
            details: ['10 步编排', '1 技能']
        });

        expect(summarizeForgePromptPreset({
            ...preset,
            forgeAgentResources: undefined,
            forgeAgentOrchestration: undefined,
            entries: [
                { id: 'slot:char', type: 'slot', slotId: 'char', enabled: true },
                { id: 'slot:off', type: 'slot', slotId: 'off', enabled: false }
            ]
        })).toEqual({
            primary: '组合预设',
            details: ['1 项']
        });
    });

    it('builds a resource-first workbench overview for built-in agent presets', () => {
        expect(buildForgePromptPresetWorkbenchOverview(preset)).toEqual({
            typeLabel: 'Agent 资源包',
            editLabel: '内置只读',
            primaryActionLabel: '复制为自定义预设',
            sourcePriority: '项目覆盖 > 当前预设 > 内置 fallback',
            resourceCount: 7,
            orchestrationCount: 10,
            skillCount: 1
        });
    });

    it('groups agent resources by editing task instead of a flat textarea list', () => {
        const groups = buildForgePromptPresetResourceGroups(preset);

        expect(groups.map(group => group.id)).toEqual(['contract', 'system', 'mode', 'skills']);
        expect(groups.find(group => group.id === 'mode')?.resources.map(resource => resource.path)).toEqual([
            './.forge/agent/PLANNER.md',
            './.forge/agent/CONVERSATION.md',
            './.forge/agent/ANALYST.md',
            './.forge/agent/EXECUTOR.md'
        ]);
        expect(groups.find(group => group.id === 'skills')?.resources[0]).toEqual(expect.objectContaining({
            path: './agent/skills/virtual-lorebook-editor/SKILL.md',
            skillName: 'virtual-lorebook-editor',
            loadPolicy: 'always',
            loadPolicyLabel: '常驻'
        }));
    });

    it('keeps legacy composed presets visibly separate from resource presets', () => {
        const legacyPreset: PromptPresetDefinition = {
            ...preset,
            forgeAgentResources: undefined,
            forgeAgentOrchestration: undefined,
            entries: [{ id: 'slot:legacy', type: 'slot', slotId: 'legacy', enabled: true }]
        };

        expect(buildForgePromptPresetWorkbenchOverview(legacyPreset)).toEqual({
            typeLabel: '兼容条目预设',
            editLabel: '内置只读',
            primaryActionLabel: '复制为自定义预设',
            sourcePriority: '',
            resourceCount: 0,
            orchestrationCount: 0,
            skillCount: 0
        });
        expect(buildForgePromptPresetResourceGroups(legacyPreset)).toEqual([]);
    });
});
