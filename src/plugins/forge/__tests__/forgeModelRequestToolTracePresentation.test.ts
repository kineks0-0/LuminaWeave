import { describe, expect, it } from 'vitest';

import { buildModelRequestToolTracePresentation } from '../inspector/forgeModelRequestToolTracePresentation.js';
import type { ForgeModelRequestTrace } from '../../../types/ForgeRuntimeTypes.js';

const createTrace = (overrides: Partial<ForgeModelRequestTrace> = {}): ForgeModelRequestTrace => ({
    id: 'req_tools',
    source: 'conversation',
    status: 'completed',
    workspaceSessionId: 'forge_project_alpha',
    requestPrompt: [{ role: 'user', content: 'hello' }],
    requestParameters: {},
    contextSnapshot: {
        kind: 'forge-runtime',
        workspaceTitle: 'Forge Alpha',
        detailMode: 'quick',
        activeLayer: 'concept',
        sourceCommand: { type: 'send_user_input', input: 'hello' },
        workflowSnapshot: null,
        historyMessages: [],
        referenceChatSessionId: null,
        referenceChatSnapshotId: null,
        lorebookEntries: [],
        memorySnapshot: null,
        selectedPresetId: 'forge-main',
        testChatPresetId: null,
        nexusPresetId: null
    },
    responseRaw: 'done',
    responseDisplay: 'done',
    responseThinking: '',
    requestedAt: 100,
    firstResponseAt: 110,
    completedAt: 180,
    errorMessage: null,
    presetId: 'forge-main',
    nodeSummary: [],
    toolEvents: [],
    ...overrides
});

describe('forgeModelRequestToolTracePresentation', () => {
    it('groups tool calling events for the request debug panel', () => {
        const presentation = buildModelRequestToolTracePresentation(createTrace({
            toolSetSummary: [
                { name: 'capabilitySearch', description: '搜索能力', needsApproval: false },
                { name: 'stageEntry', description: '进入审阅', needsApproval: true },
                { name: 'bash', description: '执行命令', needsApproval: 'dynamic' }
            ],
            toolEvents: [
                {
                    id: 'event_call',
                    type: 'tool_call',
                    toolCallId: 'call_1',
                    toolName: 'capabilitySearch',
                    payload: { query: '世界书' },
                    createdAt: 100
                },
                {
                    id: 'event_result',
                    type: 'tool_result',
                    toolCallId: 'call_1',
                    toolName: 'capabilitySearch',
                    payload: { capabilities: [{ id: 'virtual-lorebook-editor' }] },
                    createdAt: 120
                },
                {
                    id: 'event_approval',
                    type: 'tool_approval_needed',
                    toolCallId: 'call_2',
                    toolName: 'stageEntry',
                    payload: { reason: '需要审阅', args: { targetEntryId: 'character.concept' } },
                    createdAt: 140
                }
            ]
        }));

        expect(presentation.empty).toBe(false);
        expect(presentation.toolSummary).toEqual([
            { name: 'capabilitySearch', description: '搜索能力', approvalLabel: '无需授权' },
            { name: 'stageEntry', description: '进入审阅', approvalLabel: '需要授权' },
            { name: 'bash', description: '执行命令', approvalLabel: '动态判断' }
        ]);
        expect(presentation.events.map(event => event.badge)).toEqual([
            '调用',
            '结果',
            '待授权'
        ]);
        expect(presentation.events[0]).toMatchObject({
            title: 'capabilitySearch',
            subtitle: 'call_1',
            payloadText: '{\n  "query": "世界书"\n}'
        });
        expect(presentation.events[2].payloadText).toContain('character.concept');
    });

    it('returns a stable empty state for non tool-calling requests', () => {
        const presentation = buildModelRequestToolTracePresentation(createTrace());

        expect(presentation.empty).toBe(true);
        expect(presentation.emptyTitle).toBe('暂无工具调用');
    });

    it('limits long tool payload previews before rendering them in the debug panel', () => {
        const longMarkdown = 'webResearch result\n'.repeat(4000);
        const presentation = buildModelRequestToolTracePresentation(createTrace({
            toolEvents: [
                {
                    id: 'event_web_research_result',
                    type: 'tool_result',
                    toolCallId: 'call_web_research',
                    toolName: 'webResearch',
                    payload: {
                        content: longMarkdown,
                        details: {
                            provider: 'tavily',
                            sources: [
                                {
                                    title: 'Result',
                                    url: 'https://example.test/result',
                                    rawContent: longMarkdown
                                }
                            ]
                        }
                    },
                    createdAt: 100
                }
            ]
        }));

        const payloadText = presentation.events[0].payloadText;
        expect(payloadText.length).toBeLessThanOrEqual(12000);
        expect(payloadText).toContain('[已截断');
        expect(payloadText).not.toContain(longMarkdown);
    });
});
