import { describe, expect, it } from 'vitest';
import type {
    AgentRuntimeEvent,
    AgentRuntimeSnapshot
} from '../../../api/core/agent-runtime/events/AgentRuntimeEventBus.js';
import type { ForgeRuntimeContext } from '../../../types/ForgeRuntimeTypes.js';
import {
    buildForgeAgentRuntimePresentationEffects,
    projectForgeAgentRuntimeMessage
} from '../store/forgeAgentRuntimePresentation.js';

const createContext = (): ForgeRuntimeContext => ({
    activeLayer: 'concept'
} as ForgeRuntimeContext);

const createSnapshot = (overrides: Partial<AgentRuntimeSnapshot> = {}): AgentRuntimeSnapshot => ({
    sessionId: 'session-1',
    activeTurnId: 'turn-1',
    isStreaming: true,
    pendingToolCalls: [],
    messages: [],
    activeTools: [],
    ...overrides
});

describe('forge agent runtime presentation', () => {
    it('按 contentIndex 投影 text、thinking 与 toolCall，并静默更新消息', () => {
        const snapshot = createSnapshot({
            messages: [{
                id: 'agent-message:session-1:turn-1:1',
                turnId: 'turn-1',
                role: 'assistant',
                status: 'streaming',
                blocks: [
                    { type: 'text', contentIndex: 2, text: '最终回复' },
                    { type: 'thinking', contentIndex: 0, text: '先检查上下文' },
                    {
                        type: 'toolCall',
                        id: 'tool-1',
                        contentIndex: 1,
                        toolName: 'read',
                        args: { path: './AGENTS.md' }
                    }
                ]
            }]
        });
        const event: AgentRuntimeEvent = {
            type: 'message_update',
            sessionId: 'session-1',
            turnId: 'turn-1',
            messageId: 'agent-message:session-1:turn-1:1',
            block: { type: 'text', contentIndex: 2, text: '最终回复' }
        };

        expect(projectForgeAgentRuntimeMessage(snapshot.messages[0])).toEqual({
            messageId: 'agent-message:session-1:turn-1:1',
            turnId: 'turn-1',
            rawText: '最终回复',
            displayText: '最终回复',
            thinkingText: '先检查上下文',
            blocks: [
                { type: 'thinking', contentIndex: 0, text: '先检查上下文' },
                {
                    type: 'toolCall',
                    contentIndex: 1,
                    toolCallId: 'tool-1',
                    toolName: 'read',
                    args: { path: './AGENTS.md' }
                },
                { type: 'text', contentIndex: 2, text: '最终回复' }
            ]
        });

        expect(buildForgeAgentRuntimePresentationEffects({
            event,
            snapshot,
            context: createContext(),
            timestamp: 123
        })).toEqual([
            {
                type: 'project_agent_message',
                sessionId: 'session-1',
                turnId: 'turn-1',
                messageId: 'agent-message:session-1:turn-1:1',
                rawText: '最终回复',
                displayText: '最终回复',
                thinkingText: '先检查上下文',
                blocks: [
                    { type: 'thinking', contentIndex: 0, text: '先检查上下文' },
                    {
                        type: 'toolCall',
                        contentIndex: 1,
                        toolCallId: 'tool-1',
                        toolName: 'read',
                        args: { path: './AGENTS.md' }
                    },
                    { type: 'text', contentIndex: 2, text: '最终回复' }
                ],
                status: 'streaming',
                commit: false,
                timestamp: 123
            },
            {
                type: 'update_model_request_stream',
                requestId: 'turn-1',
                responseRaw: '最终回复',
                responseDisplay: '最终回复',
                responseThinking: '先检查上下文'
            },
            {
                type: 'set_agent_runtime_snapshot',
                requestId: 'turn-1',
                snapshot
            }
        ]);
    });

    it('在 turn_end 时提交最终消息并完成模型请求', () => {
        const snapshot = createSnapshot({
            isStreaming: false,
            messages: [{
                id: 'agent-message:session-1:turn-1:2',
                turnId: 'turn-1',
                role: 'assistant',
                status: 'complete',
                blocks: [{ type: 'text', contentIndex: 0, text: '续跑完成' }]
            }]
        });
        const event: AgentRuntimeEvent = {
            type: 'turn_end',
            sessionId: 'session-1',
            turnId: 'turn-1'
        };

        expect(buildForgeAgentRuntimePresentationEffects({
            event,
            snapshot,
            context: createContext(),
            timestamp: 456
        })).toEqual([
            expect.objectContaining({
                type: 'project_agent_message',
                messageId: 'agent-message:session-1:turn-1:2',
                displayText: '续跑完成',
                status: 'complete',
                commit: true,
                timestamp: 456
            }),
            {
                type: 'complete_model_request',
                requestId: 'turn-1',
                responseRaw: '续跑完成',
                responseDisplay: '续跑完成',
                responseThinking: '',
                completedAt: 456
            },
            {
                type: 'set_agent_runtime_snapshot',
                requestId: 'turn-1',
                snapshot
            }
        ]);
    });

    it('在错误结束时清理消息生成态并标记模型请求失败', () => {
        const snapshot = createSnapshot({
            isStreaming: false,
            errorMessage: 'Agent runtime failed.'
        });
        const event: AgentRuntimeEvent = {
            type: 'turn_end',
            sessionId: 'session-1',
            turnId: 'turn-1',
            errorMessage: 'Agent runtime failed.'
        };

        expect(buildForgeAgentRuntimePresentationEffects({
            event,
            snapshot,
            context: createContext(),
            timestamp: 789
        })).toEqual([
            {
                type: 'project_agent_turn_error',
                sessionId: 'session-1',
                turnId: 'turn-1',
                message: 'Agent runtime failed.'
            },
            {
                type: 'fail_model_request',
                requestId: 'turn-1',
                message: 'Agent runtime failed.'
            },
            {
                type: 'set_agent_runtime_snapshot',
                requestId: 'turn-1',
                snapshot
            }
        ]);
    });

    it('将通用工具生命周期映射为运行操作与模型工具 trace', () => {
        const startEvent: AgentRuntimeEvent = {
            type: 'tool_execution_start',
            sessionId: 'session-1',
            turnId: 'turn-1',
            toolCallId: 'tool-1',
            toolName: 'read',
            args: { path: './AGENTS.md' }
        };
        const endEvent: AgentRuntimeEvent = {
            type: 'tool_execution_end',
            sessionId: 'session-1',
            turnId: 'turn-1',
            toolCallId: 'tool-1',
            toolName: 'read',
            status: 'denied',
            errorMessage: 'Tool execution denied.'
        };

        expect(buildForgeAgentRuntimePresentationEffects({
            event: startEvent,
            snapshot: createSnapshot(),
            context: createContext(),
            timestamp: 100
        })).toEqual([
            expect.objectContaining({
                type: 'upsert_running_operation',
                dedupeKey: 'forge-agent-tool:session-1:turn-1:tool-1',
                title: '正在调用工具 · read'
            }),
            expect.objectContaining({
                type: 'append_model_request_tool_event',
                requestId: 'turn-1',
                event: expect.objectContaining({
                    id: 'turn-1:tool-1:tool_call:100',
                    type: 'tool_call',
                    toolName: 'read'
                })
            }),
            expect.objectContaining({ type: 'set_agent_runtime_snapshot' })
        ]);

        expect(buildForgeAgentRuntimePresentationEffects({
            event: endEvent,
            snapshot: createSnapshot({ pendingToolCalls: [] }),
            context: createContext(),
            timestamp: 200
        })).toEqual([
            expect.objectContaining({
                type: 'finish_operation',
                dedupeKey: 'forge-agent-tool:session-1:turn-1:tool-1',
                status: 'cancelled',
                title: '已拒绝工具调用 · read'
            }),
            expect.objectContaining({
                type: 'append_model_request_tool_event',
                requestId: 'turn-1',
                event: expect.objectContaining({
                    id: 'turn-1:tool-1:tool_result:200',
                    type: 'tool_result',
                    toolName: 'read'
                })
            }),
            expect.objectContaining({ type: 'set_agent_runtime_snapshot' })
        ]);
    });
});
