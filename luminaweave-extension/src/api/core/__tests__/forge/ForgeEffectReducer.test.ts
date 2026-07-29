import { describe, expect, it, vi } from 'vitest';
import { applyForgeEffects, type ForgeEffectTarget } from '@/api/core/forge/effects/ForgeEffectReducer.js';
import type { ForgeLayer } from '@/types/ForgeStructuredTypes.js';

const createTarget = () => {
    const calls: string[] = [];
    const record = (name: string) => {
        calls.push(name);
    };

    const target: ForgeEffectTarget = {
        addAssistantViewMessage: vi.fn(() => record('addAssistantViewMessage')),
        createAndAppendUserMessage: vi.fn(() => record('createAndAppendUserMessage')),
        projectAgentMessage: vi.fn(() => record('projectAgentMessage')),
        projectAgentTurnError: vi.fn(() => record('projectAgentTurnError')),
        upsertRunningOperation: vi.fn(() => record('upsertRunningOperation')),
        completeOperationByKey: vi.fn(() => record('completeOperationByKey')),
        finishOperationByKey: vi.fn(() => record('finishOperationByKey')),
        addOperationTimelineItem: vi.fn(() => record('addOperationTimelineItem')),
        updateOperationPrompt: vi.fn(() => record('updateOperationPrompt')),
        setActiveModelRequestTrace: vi.fn(() => record('setActiveModelRequestTrace')),
        markModelRequestFirstResponse: vi.fn(() => record('markModelRequestFirstResponse')),
        updateModelRequestStream: vi.fn(() => record('updateModelRequestStream')),
        completeModelRequestTrace: vi.fn(() => record('completeModelRequestTrace')),
        failModelRequestTrace: vi.fn(() => record('failModelRequestTrace')),
        appendModelRequestToolEvent: vi.fn(() => record('appendModelRequestToolEvent')),
        setModelRequestToolSetSummary: vi.fn(() => record('setModelRequestToolSetSummary')),
        setModelRequestPiTrace: vi.fn(() => record('setModelRequestPiTrace')),
        setAgentRuntimeSnapshot: vi.fn(() => record('setAgentRuntimeSnapshot')),
        setForgePiSessionState: vi.fn(() => record('setForgePiSessionState')),
        upsertToolApproval: vi.fn(() => record('upsertToolApproval')),
        resolveToolApproval: vi.fn(() => record('resolveToolApproval')),
        setEntryMode: vi.fn(() => record('setEntryMode')),
        setDetailMode: vi.fn(() => record('setDetailMode')),
        setCollectionMode: vi.fn(() => record('setCollectionMode')),
        setActiveLayerAndEmitForm: vi.fn(() => record('setActiveLayerAndEmitForm')),
        prefillStructuredForm: vi.fn(() => record('prefillStructuredForm')),
        applySubmittedFormResult: vi.fn(() => record('applySubmittedFormResult')),
        upsertForgeMemory: vi.fn(() => record('upsertForgeMemory')),
        removeForgeMemory: vi.fn(() => record('removeForgeMemory')),
        upsertVirtualLorebookEntry: vi.fn(() => {
            record('upsertVirtualLorebookEntry');
            return 'entry-1';
        }),
        removeVirtualLorebookEntry: vi.fn(() => {
            record('removeVirtualLorebookEntry');
            return true;
        }),
        upsertStagingEntry: vi.fn(() => record('upsertStagingEntry')),
        autoMergeEntryToVirtualLorebook: vi.fn(() => record('autoMergeEntryToVirtualLorebook')),
        moveStagingToCommitReady: vi.fn(() => record('moveStagingToCommitReady')),
        removeStagingEntry: vi.fn(() => record('removeStagingEntry')),
        moveCommitReadyToStaging: vi.fn(() => record('moveCommitReadyToStaging')),
        syncDraftTree: vi.fn(() => record('syncDraftTree')),
        freezeWorkspace: vi.fn(async () => record('freezeWorkspace')),
        setReferenceChat: vi.fn(() => record('setReferenceChat')),
        refreshWorkflowSnapshot: vi.fn(async () => record('refreshWorkflowSnapshot')),
        persistSession: vi.fn(() => record('persistSession')),
        getActiveLayer: vi.fn((): ForgeLayer => 'concept')
    };

    return { target, calls };
};

describe('ForgeEffectReducer', () => {
    it('persists once after project resource effects are applied', async () => {
        const { target, calls } = createTarget();

        await applyForgeEffects([
            {
                type: 'memory_upsert',
                path: 'constraints/core',
                title: 'Core Constraint',
                content: 'Keep the project scoped.',
                source: 'planner'
            },
            {
                type: 'upsert_staging_entry',
                entry: {
                    originalContent: '',
                    proposedContent: 'New lorebook text',
                    description: 'Draft update',
                    targetEntryId: 'entry-1',
                    category: 'concept',
                    layer: 'concept',
                    sourceTag: 'planner',
                    sourceMessageId: 'msg-1',
                    sourceSessionId: 'forge-session-1'
                }
            },
            {
                type: 'move_staging_to_commit_ready',
                stagingId: 'stage-1'
            }
        ], target);

        expect(target.upsertForgeMemory).toHaveBeenCalledOnce();
        expect(target.upsertStagingEntry).toHaveBeenCalledOnce();
        expect(target.autoMergeEntryToVirtualLorebook).not.toHaveBeenCalled();
        expect(target.moveStagingToCommitReady).toHaveBeenCalledOnce();
        expect(target.persistSession).toHaveBeenCalledOnce();
        expect(calls.at(-1)).toBe('persistSession');
    });

    it('does not persist for read-only or trace-only effects', async () => {
        const { target } = createTarget();

        await applyForgeEffects([
            { type: 'memory_read', path: 'constraints/core', summary: 'Read memory' },
            { type: 'history_read', target: 'recent conversation', summary: 'Read history' },
            { type: 'set_active_model_request', requestId: 'req-1' },
            {
                type: 'append_model_request_tool_event',
                requestId: 'req-1',
                event: {
                    id: 'req-1:call-1:tool_call',
                    type: 'tool_call',
                    toolCallId: 'call-1',
                    toolName: 'readFile',
                    payload: { path: 'project.json' },
                    createdAt: 100
                }
            },
            {
                type: 'set_agent_runtime_snapshot',
                requestId: 'req-1',
                snapshot: {
                    sessionId: 'session-1',
                    isStreaming: false,
                    pendingToolCalls: [],
                    messages: [],
                    activeTools: []
                }
            },
            { type: 'append_message', role: 'assistant', content: 'hello' }
        ], target);

        expect(target.persistSession).not.toHaveBeenCalled();
        expect(target.appendModelRequestToolEvent).toHaveBeenCalledWith('req-1', expect.objectContaining({
            toolName: 'readFile'
        }));
        expect(target.setAgentRuntimeSnapshot).toHaveBeenCalledWith(expect.objectContaining({
            requestId: 'req-1',
            snapshot: expect.objectContaining({ isStreaming: false })
        }));
    });

    it('applies agent message, error, and terminal tool projection effects without persisting', async () => {
        const { target } = createTarget();

        await applyForgeEffects([
            {
                type: 'project_agent_message',
                sessionId: 'session-1',
                turnId: 'turn-1',
                messageId: 'agent-message:session-1:turn-1:1',
                rawText: '完成',
                displayText: '完成',
                thinkingText: '处理中',
                blocks: [{ type: 'text', contentIndex: 0, text: '完成' }],
                status: 'streaming',
                commit: false,
                timestamp: 100
            },
            {
                type: 'project_agent_turn_error',
                sessionId: 'session-1',
                turnId: 'turn-1',
                message: 'Agent runtime failed.'
            },
            {
                type: 'finish_operation',
                dedupeKey: 'forge-agent-tool:session-1:turn-1:tool-1',
                status: 'failed',
                operationKind: 'system',
                title: '工具调用失败 · read',
                summary: 'Tool execution failed.'
            }
        ], target);

        expect(target.projectAgentMessage).toHaveBeenCalledWith(expect.objectContaining({
            messageId: 'agent-message:session-1:turn-1:1',
            commit: false
        }));
        expect(target.projectAgentTurnError).toHaveBeenCalledWith({
            sessionId: 'session-1',
            turnId: 'turn-1',
            message: 'Agent runtime failed.'
        });
        expect(target.finishOperationByKey).toHaveBeenCalledWith(expect.objectContaining({
            status: 'failed',
            dedupeKey: 'forge-agent-tool:session-1:turn-1:tool-1'
        }));
        expect(target.persistSession).not.toHaveBeenCalled();
    });

    it('applies tool approval effects without persisting project resources', async () => {
        const { target } = createTarget();

        await applyForgeEffects([
            {
                type: 'upsert_tool_approval',
                approval: {
                    id: 'approval-call-1',
                    requestId: 'req_1',
                    toolCallId: 'call_1',
                    toolName: 'writeFile',
                    args: { path: '/forge/card.md' },
                    reason: '写入需要确认',
                    source: 'conversation',
                    status: 'pending',
                    createdAt: 100
                }
            },
            {
                type: 'resolve_tool_approval',
                toolCallId: 'call_1',
                approved: false,
                message: '本轮不写入'
            }
        ], target);

        expect(target.upsertToolApproval).toHaveBeenCalledOnce();
        expect(target.resolveToolApproval).toHaveBeenCalledWith('call_1', false, '本轮不写入');
        expect(target.persistSession).not.toHaveBeenCalled();
    });

    it('marks prompt/protocol staging content as suspicious without auto-promoting it', async () => {
        const { target } = createTarget();

        await applyForgeEffects([
            {
                type: 'upsert_staging_entry',
                entry: {
                    originalContent: '',
                    proposedContent: [
                        '### 原生 tool calling 写入协议',
                        '- 典型产出：`<entry_update type="角色设定/characters">`',
                        '- `<memory_update path="AUTO/Checklist">` 写入 Forge 文件化记忆'
                    ].join('\n'),
                    description: '旧提示词污染',
                    targetEntryId: 'forge_entry_polluted',
                    category: 'protocol',
                    layer: 'concept',
                    sourceTag: 'legacy-parser',
                    sourceMessageId: null,
                    sourceSessionId: 'conversation_alpha'
                }
            }
        ], target);

        expect(target.upsertStagingEntry).toHaveBeenCalledWith(expect.objectContaining({
            targetEntryId: 'forge_entry_polluted',
            suspicious: true,
            suspiciousReason: expect.stringContaining('prompt/protocol')
        }));
        expect(target.moveStagingToCommitReady).not.toHaveBeenCalled();
    });
});
