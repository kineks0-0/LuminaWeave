import { describe, expect, it, vi } from 'vitest';
import { ForgeRuntimeOrchestrator, type ForgeRuntimePort } from '../ForgeRuntimeOrchestrator';
import type {
    ForgeExecutionRequest,
    ForgeRuntimeContext,
    ForgeRuntimeEffect,
    ForgeRuntimeEvent,
    StagingEntry
} from '../../../types/ForgeRuntimeTypes';

const createContext = (overrides: Partial<ForgeRuntimeContext> = {}): ForgeRuntimeContext => ({
    workspaceSessionId: 'forge_ws_test',
    sessionChatId: 'lw_card_test',
    workspaceTitle: 'Forge Workspace',
    selectedPresetId: 'preset_1',
    selectedChatSessionId: null,
    selectedChatSnapshotId: null,
    detailMode: 'quick',
    entryMode: 'freeform',
    activeLayer: 'concept',
    completedLayers: [],
    workflowSnapshot: null,
    publishState: 'drafting',
    activeLeafId: 'msg_assistant_1',
    worldlineNodes: [],
    messages: [],
    timelineItems: [],
    structuredState: {
        activeFormId: null,
        activeMessageFormId: null,
        forms: {},
        lastUpdatedAt: 0
    },
    draftTree: {
        nodes: [],
        lastUpdatedAt: 0
    },
    forgeMemoryTree: {
        entries: [],
        lastUpdatedAt: 0
    },
    stagingEntries: [],
    commitReadyEntries: [],
    virtualLorebookEntries: [],
    latestUserInput: '',
    latestUserCommand: { type: 'noop' },
    ...overrides
});

const createPort = (context: ForgeRuntimeContext) => {
    const appliedEffects: ForgeRuntimeEffect[] = [];
    const handledEvents: ForgeRuntimeEvent[] = [];

    const port: ForgeRuntimePort = {
        getRuntimeContext: vi.fn((_command, latestUserInput) => ({
            ...context,
            latestUserInput: latestUserInput ?? context.latestUserInput,
            latestUserCommand: _command
        })),
        applyRuntimeEffects: vi.fn(async (effects) => {
            appliedEffects.push(...effects);
        }),
        buildPlannerExecutionRequest: vi.fn(async () => ({
            mode: 'planner',
            messages: [],
            sessionChatId: context.sessionChatId,
            charName: 'Forge Assistant',
            sourceCommand: { type: 'send_user_input', input: context.latestUserInput }
        }) as ForgeExecutionRequest),
        buildAnalystExecutionRequest: vi.fn(async () => ({
            mode: 'analyst',
            messages: [],
            sessionChatId: context.sessionChatId,
            charName: 'Forge Assistant',
            sourceCommand: { type: 'send_user_input', input: context.latestUserInput }
        }) as ForgeExecutionRequest),
        buildConversationExecutionRequest: vi.fn(async () => ({
            mode: 'conversation',
            messages: [],
            sessionChatId: context.sessionChatId,
            charName: 'Forge Assistant',
            sourceCommand: { type: 'send_user_input', input: context.latestUserInput }
        }) as ForgeExecutionRequest),
        buildExecutorExecutionRequest: vi.fn(async () => ({
            mode: 'executor',
            messages: [],
            sessionChatId: context.sessionChatId,
            charName: 'Forge Assistant',
            sourceCommand: { type: 'noop' }
        }) as ForgeExecutionRequest),
        prepareAssistantStream: vi.fn(),
        handleRuntimeEvent: vi.fn((event) => {
            handledEvents.push(event);
        }),
        resolveOriginalContent: vi.fn(() => '原始条目内容'),
        resolveEntryComment: vi.fn(() => null)
    };

    return {
        port,
        appliedEffects,
        handledEvents
    };
};

describe('ForgeRuntimeOrchestrator', () => {
    it('应将 choose_entry_mode 命令转为 effect 链', async () => {
        const { port, appliedEffects } = createPort(createContext({
            entryMode: null,
            latestUserCommand: { type: 'choose_entry_mode', mode: 'structured' }
        }));

        const orchestrator = new ForgeRuntimeOrchestrator(port, {
            run: vi.fn()
        } as any);

        await orchestrator.dispatch({ type: 'choose_entry_mode', mode: 'structured' });

        expect(port.applyRuntimeEffects).toHaveBeenCalled();
        expect(appliedEffects).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'set_entry_mode', mode: 'structured' }),
            expect.objectContaining({ type: 'set_active_layer', layer: 'concept' })
        ]));
    });

    it('应在 planner 事件流中把 entry_update 转成 staging effect', async () => {
        const { port, appliedEffects, handledEvents } = createPort(createContext({
            latestUserInput: '请帮我改写背景',
            latestUserCommand: { type: 'send_user_input', input: '请帮我改写背景' }
        }));

        const gateway = {
            run: vi.fn(async (_request, options?: { onEvent?: (event: ForgeRuntimeEvent) => void }) => {
                options?.onEvent?.({
                    type: 'trace',
                    tag: 'entry_update',
                    status: '正在生成条目修改',
                    timestamp: 1
                });
                options?.onEvent?.({
                    type: 'action_completed',
                    actionType: 'update',
                    raw: '<entry_update id="entry-1" description="重写背景">新的内容</entry_update>',
                    content: '新的内容'
                });
                options?.onEvent?.({
                    type: 'stream_done',
                    rawText: '<entry_update id="entry-1" description="重写背景">新的内容</entry_update>',
                    displayText: '新的内容',
                    thinkingText: ''
                });
                return {
                    rawText: '<entry_update id="entry-1" description="重写背景">新的内容</entry_update>',
                    events: handledEvents,
                    effects: []
                };
            })
        };

        const orchestrator = new ForgeRuntimeOrchestrator(port, gateway as any);
        await orchestrator.dispatch({ type: 'send_user_input', input: '请帮我改写背景' });

        expect(port.prepareAssistantStream).toHaveBeenCalledTimes(1);
        expect(handledEvents.some(event => event.type === 'action_completed')).toBe(true);
        expect(appliedEffects).toEqual(expect.arrayContaining([
            expect.objectContaining({ type: 'upsert_running_operation' }),
            expect.objectContaining({
                type: 'upsert_staging_entry',
                entry: expect.objectContaining<Partial<StagingEntry>>({
                    targetEntryId: 'entry-1',
                    proposedContent: '新的内容',
                    originalContent: '原始条目内容',
                    sourceTag: 'entry_update'
                })
            })
        ]));
    });

    it('应在普通问答下调用 conversation request builder', async () => {
        const context = createContext({
            workflowSnapshot: {
                stage: 'skeleton',
                visiblePhase: 'build',
                detailMode: 'quick',
                activeLayer: 'concept',
                subLayer: 'concept',
                promptMode: 'planner',
                reason: '当前正在 concept 层收敛设定。',
                recommendedAction: '继续讨论角色动机。',
                shouldGenerate: true,
                requiresUserDecision: false,
                allowedActions: ['collect_form', 'advance_layer', 'chat'],
                missingFields: [],
                nextRecommendedLayer: 'entity',
                entryMode: 'freeform',
                stagingCount: 0,
                commitReadyCount: 0,
                stagingEntries: [],
                commitReadyEntries: [],
                draftCount: 0,
                completedLayers: [],
                updatedAt: Date.now()
            },
            latestUserInput: '为什么要先补背景？',
            latestUserCommand: { type: 'send_user_input', input: '为什么要先补背景？' }
        });
        const { port } = createPort(context);

        const gateway = {
            run: vi.fn(async () => ({
                rawText: '先补背景能把角色动机和关系约束固定下来，后面的外貌和措辞会更稳定。',
                events: [],
                effects: []
            }))
        };

        const orchestrator = new ForgeRuntimeOrchestrator(port, gateway as any);
        await orchestrator.dispatch({ type: 'send_user_input', input: '为什么要先补背景？' });

        expect(port.buildConversationExecutionRequest).toHaveBeenCalledTimes(1);
        expect(port.buildPlannerExecutionRequest).not.toHaveBeenCalled();
    });

    it('应在 submit_form 后调用 planner request builder', async () => {
        const context = createContext({
            detailMode: 'detailed',
            entryMode: 'structured',
            latestUserInput: '我刚提交了启动方向，请继续细化。',
            latestUserCommand: {
                type: 'submit_form',
                formId: 'kickoff_intent',
                userInput: '我刚提交了启动方向，请继续细化。'
            }
        });
        const { port } = createPort(context);

        const gateway = {
            run: vi.fn(async () => ({
                rawText: '我会先把旅行感拆成角色骨架与叙事两部分来继续收敛。',
                events: [],
                effects: []
            }))
        };

        const orchestrator = new ForgeRuntimeOrchestrator(port, gateway as any);
        await orchestrator.dispatch({
            type: 'submit_form',
            formId: 'kickoff_intent',
            userInput: '我刚提交了启动方向，请继续细化。'
        });

        expect(port.buildPlannerExecutionRequest).toHaveBeenCalledTimes(1);
        expect(port.buildConversationExecutionRequest).not.toHaveBeenCalled();
    });
});
