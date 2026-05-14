import type {
    ForgePromptSlot,
    ForgePromptSlotPolicy
} from '../../../../types/PromptAssemblyTypes.js';

export const FORGE_PROMPT_SLOT_POLICIES: Record<ForgePromptSlot, ForgePromptSlotPolicy> = {
    system_static: {
        slot: 'system_static',
        region: 'static_system',
        required: true,
        priority: 'critical',
        fallback: 'diagnostic'
    },
    runtime_contract: {
        slot: 'runtime_contract',
        region: 'static_system',
        required: true,
        priority: 'critical',
        fallback: 'diagnostic'
    },
    skill_full: {
        slot: 'skill_full',
        region: 'task_context',
        required: false,
        priority: 'high',
        fallback: 'summary'
    },
    skill_summary: {
        slot: 'skill_summary',
        region: 'tail_restatement',
        required: false,
        priority: 'high',
        fallback: 'hidden'
    },
    project_resources: {
        slot: 'project_resources',
        region: 'stable_context',
        required: false,
        priority: 'normal',
        fallback: 'summary'
    },
    conversation_context: {
        slot: 'conversation_context',
        region: 'stable_context',
        required: false,
        priority: 'normal',
        fallback: 'summary'
    },
    review_state: {
        slot: 'review_state',
        region: 'task_context',
        required: false,
        priority: 'high',
        fallback: 'summary'
    },
    working_statement: {
        slot: 'working_statement',
        region: 'tail_restatement',
        required: true,
        priority: 'critical',
        fallback: 'diagnostic'
    },
    user_input: {
        slot: 'user_input',
        region: 'live_input',
        required: true,
        priority: 'critical',
        fallback: 'diagnostic'
    }
};

export const FORGE_AGENT_PRESET_SLOT_TO_FORGE_SLOTS: Record<string, ForgePromptSlot[]> = {
    agent_runtime_contract: ['runtime_contract'],
    agent_skill_context: ['skill_full', 'skill_summary'],
    agent_project_resources: ['project_resources'],
    agent_review_state: ['review_state'],
    agent_working_statement: ['working_statement'],
    agent_user_input: ['user_input']
};

export const getForgePromptSlotPolicy = (slot: ForgePromptSlot): ForgePromptSlotPolicy =>
    FORGE_PROMPT_SLOT_POLICIES[slot];

export const isForgeAgentPresetSlot = (slotId: string | undefined): boolean =>
    Boolean(slotId && FORGE_AGENT_PRESET_SLOT_TO_FORGE_SLOTS[slotId]);
