import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForgePromptContextService } from '@/api/core/forge/prompt/ForgePromptContextService.js';
import type { MemorySnapshot } from '@/types/MemorySnapshotTypes.js';
import type { PromptSourceUnit } from '@/types/PromptAssemblyTypes.js';

vi.mock('@/api/core/host-drivers/st/STClient.js', () => ({
    STClient: {
        substituteMacros: vi.fn((text: string) => text),
        getActiveWorldInfoItems: vi.fn(() => []),
        getResolvedCurrentCharacterId: vi.fn(() => '0'),
        getResolvedCurrentChatId: vi.fn(() => 'chat_1')
    }
}));

const baseMemorySnapshot: MemorySnapshot = {
    sourceId: 'forge',
    sessionId: 'forge_session_1',
    activeLeafId: 'node_123456',
    messageCount: 2,
    selectedChatSessionId: null,
    selectedChatSnapshotId: null,
    lorebook: {
        bookId: 'book_1',
        versionMode: 'follow-timeline',
        versionLabel: 'Forge',
        versionHint: 'hint',
        snapshotKey: 'snapshot_1',
        entryCount: 0,
        entries: []
    }
};

const createRuntimeContext = () => ({
    workspaceSessionId: 'forge_ws_1',
    sessionChatId: 'forge_session_1',
    workspaceTitle: 'Forge Workspace',
    selectedPresetId: 'forge_preset_alpha',
    selectedChatSessionId: null,
    selectedChatSnapshotId: null,
    detailMode: 'quick' as const,
    collectionMode: 'conversation' as const,
    entryMode: 'structured' as const,
    activeLayer: 'concept' as const,
    completedLayers: [],
    workflowSnapshot: null,
    publishState: 'drafting' as const,
    activeLeafId: null,
    worldlineNodes: [],
    messages: [],
    timelineItems: [],
    structuredState: {
        activeFormId: null,
        activeMessageFormId: null,
        submitConfigs: {},
        submittedScopes: {},
        forms: {},
        lastUpdatedAt: Date.now()
    },
    draftTree: { nodes: [], lastUpdatedAt: Date.now() },
    forgeMemoryTree: { entries: [], lastUpdatedAt: 0 },
    stagingEntries: [],
    commitReadyEntries: [],
    virtualLorebookEntries: [],
    latestUserInput: '我想做一个旅行感角色卡',
    latestUserCommand: { type: 'send_user_input' as const, input: '我想做一个旅行感角色卡' }
});

const createAgentSourceUnit = (): PromptSourceUnit => ({
    id: 'working-statement:forge_project_alpha',
    kind: 'state',
    sourceKind: 'forge',
    label: 'Forge Working Statement',
    roleHint: 'system',
    priority: 100,
    rawContent: 'Runtime statement for real generation',
    content: 'Runtime statement for real generation',
    forgeSlot: 'working_statement',
    forgeRegion: 'tail_restatement',
    slotPolicy: {
        slot: 'working_statement',
        region: 'tail_restatement',
        required: true,
        priority: 'critical'
    }
});

describe('ForgePromptContextService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('应在预览模式下根据 mode 生成 conversation prompt', () => {
        const messages = ForgePromptContextService.buildPromptPreviewPayload({
            mode: 'conversation',
            presetData: null,
            messages: [],
            resolvedLorebookEntries: [],
            memorySnapshot: { ...baseMemorySnapshot },
            forgeMemoryTree: { entries: [], lastUpdatedAt: 0 },
            structuredState: {
                activeFormId: null,
                activeMessageFormId: null,
                submitConfigs: {},
                submittedScopes: {},
                forms: {},
                lastUpdatedAt: Date.now()
            },
            draftTree: { nodes: [], lastUpdatedAt: Date.now() },
            workflowSnapshot: null
        });

        expect(messages[0].role).toBe('system');
        expect(messages[0].content).toContain('你是 Lumina Forge 的“协作助手”');
        expect(messages[0].content).toContain('组件内容必须根据用户当前输入动态生成');
        expect(messages[0].content).toContain('<V>ForgeChoiceGroup("path", "label", "option1|option2")</V>');
        expect(messages[0].content).not.toContain('<forge_choice_group');
        expect(messages[0].content).not.toContain('<ForgeSelect');
        expect(messages[0].content).not.toContain('ForgeFacetChecklist(formId=');
        expect(messages[0].content).not.toContain('ForgeInput(label=');
    });

    it('应在 planner prompt 中明确区分 XML 操作层与 <V> DSL 层', () => {
        const messages = ForgePromptContextService.buildPromptPreviewPayload({
            presetData: null,
            messages: [],
            resolvedLorebookEntries: [],
            memorySnapshot: { ...baseMemorySnapshot },
            forgeMemoryTree: { entries: [], lastUpdatedAt: 0 },
            structuredState: {
                activeFormId: null,
                activeMessageFormId: null,
                submitConfigs: {},
                submittedScopes: {},
                forms: {},
                lastUpdatedAt: Date.now()
            },
            draftTree: { nodes: [], lastUpdatedAt: Date.now() },
            workflowSnapshot: null
        });

        expect(messages[0].content).toContain('协议边界固定为两层');
        expect(messages[0].content).toContain('原生 tool calling 层');
        expect(messages[0].content).toContain('`<V>` 内 DSL 层');
        expect(messages[0].content).toContain('<V>ForgeSelect("role_profile/faction", "选择阵营", "教会|帝国")</V>');
        expect(messages[0].content).toContain('<V>ForgeChoiceGroup("branch_direction", "请选择你想继续深入的分支方向：", "选项A|选项B|选项C")</V>');
        expect(messages[0].content).not.toContain('<ForgeSelect');
        expect(messages[0].content).not.toContain('<forge_choice_group');
        expect(messages[0].content).not.toContain('ForgeMissingFields(formId=');
    });

    it('应在执行请求中携带当前 Forge 预设 ID', () => {
        const request = ForgePromptContextService.buildPlannerExecutionRequest({
            context: createRuntimeContext(),
            presetData: null,
            memorySnapshot: { ...baseMemorySnapshot },
            resolvedLorebookEntries: [],
            charName: 'Forge Assistant'
        });

        expect(request.presetId).toBe('forge_preset_alpha');
    });

    it('应在 planner 真实执行请求中注入 Agent source units', () => {
        const request = ForgePromptContextService.buildPlannerExecutionRequest({
            context: createRuntimeContext(),
            presetData: null,
            memorySnapshot: { ...baseMemorySnapshot },
            resolvedLorebookEntries: [],
            charName: 'Forge Assistant',
            forgeAgentSourceUnits: [createAgentSourceUnit()]
        });

        expect(request.messages.some(message => message.content.includes('Runtime statement for real generation'))).toBe(true);
    });

    it('应在 conversation 真实执行请求中注入 Agent source units', () => {
        const request = ForgePromptContextService.buildConversationExecutionRequest({
            context: createRuntimeContext(),
            presetData: null,
            memorySnapshot: { ...baseMemorySnapshot },
            resolvedLorebookEntries: [],
            charName: 'Forge Assistant',
            forgeAgentSourceUnits: [createAgentSourceUnit()]
        });

        expect(request.messages.some(message => message.content.includes('Runtime statement for real generation'))).toBe(true);
    });

    it('应为 Forge 主模型预览生成来源 trace', () => {
        const assembly = ForgePromptContextService.buildPromptPreviewAssembly({
            mode: 'planner',
            presetData: null,
            messages: [{ role: 'user', content: '帮我做一张卡' }],
            resolvedLorebookEntries: [
                {
                    uid: 'entry-1',
                    comment: '世界设定',
                    key: ['world'],
                    keysecondary: [],
                    content: '世界书内容',
                    constant: false,
                    selective: false,
                    selectiveLogic: 0,
                    disable: false,
                    enabled: true,
                    position: 0,
                    depth: 0,
                    order: 0,
                    probability: 100,
                    scan_depth: 0
                }
            ],
            memorySnapshot: { ...baseMemorySnapshot },
            forgeMemoryTree: { entries: [], lastUpdatedAt: 0 },
            structuredState: {
                activeFormId: null,
                activeMessageFormId: null,
                submitConfigs: {},
                submittedScopes: {},
                forms: {},
                lastUpdatedAt: Date.now()
            },
            draftTree: { nodes: [], lastUpdatedAt: Date.now() },
            workflowSnapshot: null
        });

        expect(assembly.messages.length).toBeGreaterThan(0);
        expect(assembly.trace.length).toBeGreaterThan(0);
        expect(assembly.trace.some(trace => trace.sourceKind === 'worldbook')).toBe(true);
        expect(assembly.trace.some(trace => trace.sourceKind === 'history')).toBe(true);
        expect(assembly.trace.every(trace => trace.outputMessageIndex === null || trace.outputMessageIndex >= 0)).toBe(true);
        expect(assembly.route).toMatchObject({
            target: 'forge.planner',
            engine: 'lumina'
        });
    });

    it('应能生成 executor 预览载荷', () => {
        const messages = ForgePromptContextService.buildExecutorPreviewPayload({
            instruction: '重写性格描述，使其更冷静克制',
            entryId: 'character.alpha',
            originalContent: '原始条目内容',
            sessionChatId: 'forge_session_1',
            charName: 'Forge Assistant',
            presetId: 'forge_preset_alpha',
            sourceCommand: { type: 'noop' }
        });

        expect(messages).toHaveLength(3);
        expect(messages[0].role).toBe('system');
        expect(messages[0].content).toContain('你是 Lumina Forge 的“执行者 (Executor)”');
        expect(messages[0].content).toContain('原生 tool calling 写入协议');
        expect(messages[0].content).toContain('stageEntry');
        expect(messages[0].content).toContain('writeFile');
        expect(messages[0].content).toContain('Review Gate');
        expect(messages[0].content).not.toContain('<entry_update id="条目ID">完整内容</entry_update>');
        expect(messages[1].content).toContain('重写性格描述，使其更冷静克制');
        expect(messages[2].content).toContain('targetEntryId: "character.alpha"');
        expect(messages[2].content).toContain('stageEntry');
        expect(messages[2].content).toContain('原始条目内容');
    });

    it('应在 executor 执行请求中保留当前 Forge 预设 ID', () => {
        const request = ForgePromptContextService.buildExecutorExecutionRequest({
            instruction: '重写性格描述，使其更冷静克制',
            entryId: 'character.alpha',
            originalContent: '原始条目内容',
            sessionChatId: 'forge_session_1',
            charName: 'Forge Assistant',
            presetId: 'forge_preset_alpha',
            sourceCommand: { type: 'noop' }
        });

        expect(request.presetId).toBe('forge_preset_alpha');
    });

    it('应为 executor 预览生成控制来源 trace', () => {
        const assembly = ForgePromptContextService.buildExecutorPreviewAssembly({
            instruction: '重写性格描述，使其更冷静克制',
            entryId: 'character.alpha',
            originalContent: '原始条目内容',
            sessionChatId: 'forge_session_1',
            charName: 'Forge Assistant',
            presetId: 'forge_preset_alpha',
            sourceCommand: { type: 'noop' }
        });

        expect(assembly.messages).toHaveLength(3);
        expect(assembly.trace.some(trace => trace.sourceKind === 'forge')).toBe(true);
        expect(assembly.trace.every(trace => trace.kind === 'control')).toBe(true);
        expect(assembly.route).toMatchObject({
            target: 'forge.executor',
            engine: 'lumina'
        });
    });
});
