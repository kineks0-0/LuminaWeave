import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

import { useForgeStore } from '../useForgeStore';

describe('useForgeStore model request traces', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
    });

    it('creates, updates, completes, and clears transient model request traces', () => {
        const store = useForgeStore();

        store.createModelRequestTrace({
            id: 'req_1',
            source: 'planner',
            status: 'queued',
            workspaceSessionId: 'forge_ws_1',
            requestPrompt: [{ role: 'user', content: 'hello' }],
            requestParameters: { temperature: 0.7, top_p: 0.9 },
            contextSnapshot: {
                kind: 'forge-runtime',
                workspaceTitle: 'Forge Workspace',
                detailMode: 'quick',
                activeLayer: 'concept',
                sourceCommand: { type: 'send_user_input', input: 'hello' },
                workflowSnapshot: null,
                historyMessages: [{ role: 'user', content: 'hello' }],
                referenceChatSessionId: null,
                referenceChatSnapshotId: null,
                lorebookEntries: [],
                memorySnapshot: null,
                selectedPresetId: 'preset_1',
                testChatPresetId: null,
                nexusPresetId: null
            },
            responseRaw: '',
            responseDisplay: '',
            responseThinking: '',
            requestedAt: 100,
            firstResponseAt: null,
            completedAt: null,
            errorMessage: null,
            presetId: 'preset_1',
            nodeSummary: [{ provider: 'openai', model: 'gpt-test', label: 'openai / gpt-test' }]
        });

        store.markModelRequestFirstResponse('req_1', 120);
        store.updateModelRequestStream({
            requestId: 'req_1',
            responseRaw: '<thinking>hi</thinking>hello',
            responseDisplay: 'hello',
            responseThinking: 'hi'
        });
        store.completeModelRequestTrace({
            requestId: 'req_1',
            responseRaw: '<thinking>hi</thinking>hello',
            responseDisplay: 'hello',
            responseThinking: 'hi',
            completedAt: 180
        });

        expect(store.modelRequestTraces).toHaveLength(1);
        expect(store.activeModelRequestTraceId).toBe('req_1');
        expect(store.modelRequestTraces[0]).toEqual(expect.objectContaining({
            status: 'completed',
            firstResponseAt: 120,
            completedAt: 180,
            responseDisplay: 'hello',
            responseThinking: 'hi'
        }));

        store.clearAll();

        expect(store.modelRequestTraces).toHaveLength(0);
        expect(store.activeModelRequestTraceId).toBeNull();
    });

    it('marks request as aborted without touching persistence-bound state', () => {
        const store = useForgeStore();

        store.createModelRequestTrace({
            id: 'req_abort',
            source: 'test_chat',
            status: 'streaming',
            workspaceSessionId: 'forge_ws_2',
            requestPrompt: [],
            requestParameters: {},
            contextSnapshot: {
                kind: 'forge-test-chat',
                workspaceTitle: 'Forge Test',
                detailMode: null,
                activeLayer: null,
                sourceCommand: { type: 'send_user_input', input: 'ping' },
                workflowSnapshot: null,
                historyMessages: [],
                referenceChatSessionId: null,
                referenceChatSnapshotId: null,
                lorebookEntries: [],
                memorySnapshot: null,
                selectedPresetId: null,
                testChatPresetId: 'preset_test',
                nexusPresetId: 'nexus_test'
            },
            responseRaw: 'partial',
            responseDisplay: 'partial',
            responseThinking: '',
            requestedAt: 200,
            firstResponseAt: 210,
            completedAt: null,
            errorMessage: null,
            presetId: 'preset_test',
            nodeSummary: []
        });

        store.abortModelRequestTrace('req_abort');

        expect(store.modelRequestTraces[0]).toEqual(expect.objectContaining({
            id: 'req_abort',
            status: 'aborted'
        }));
        expect(store.timelineItems).toHaveLength(0);
        expect(store.stagingArea).toHaveLength(0);
        expect(store.commitReadyEntries).toHaveLength(0);
    });
});
