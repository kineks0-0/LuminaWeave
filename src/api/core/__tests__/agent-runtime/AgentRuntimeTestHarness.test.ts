import { describe, expect, it } from 'vitest';
import { createAgentRuntimeTestHarness } from '@/api/core/agent-runtime/testing/AgentRuntimeTestHarness.js';

describe('AgentRuntimeTestHarness', () => {
    it('provides mock model, tool, session store, approval, and VFS helpers', async () => {
        const harness = createAgentRuntimeTestHarness();
        harness.model.enqueueText('model response');

        await harness.sessionStore.save('session_1', { activeNodeId: 'node_1' });
        await harness.vfs.writeFile('/data/note.md', 'mounted note');
        harness.approvals.enqueue({ approved: true, message: 'ok' });
        harness.registerTool(harness.createTool({
            name: 'echo',
            description: 'Echo input.',
            execute: async (_toolCallId, args: { text: string }) => ({
                content: [{ type: 'text', text: args.text }],
                details: { text: args.text }
            })
        }));

        await expect(harness.model.generate({ prompt: 'hello' })).resolves.toEqual({
            text: 'model response'
        });
        await expect(harness.sessionStore.load('session_1')).resolves.toEqual({ activeNodeId: 'node_1' });
        await expect(harness.vfs.readFile('/data/note.md')).resolves.toBe('mounted note');
        await expect(harness.approvals.request({ toolName: 'echo', args: { text: 'hello' } })).resolves.toEqual({
            approved: true,
            message: 'ok'
        });
        await expect(harness.tools.execute({
            sessionId: 'session_1',
            turnId: 'turn_1',
            toolCallId: 'call_echo',
            toolName: 'echo',
            args: { text: 'hello' }
        })).resolves.toMatchObject({
            status: 'executed',
            result: { details: { text: 'hello' } }
        });
        expect(harness.model.requests).toEqual([{ prompt: 'hello' }]);
    });

    it('exposes a runtime event recorder for adapter tests', () => {
        const harness = createAgentRuntimeTestHarness();

        harness.events.emit({ type: 'turn_start', sessionId: 'session_1', turnId: 'turn_1' });
        harness.events.emit({
            type: 'message_start',
            sessionId: 'session_1',
            turnId: 'turn_1',
            message: { id: 'message_1', turnId: 'turn_1', role: 'assistant', blocks: [] }
        });
        harness.events.emit({
            type: 'message_update',
            sessionId: 'session_1',
            turnId: 'turn_1',
            messageId: 'message_1',
            block: { type: 'text', contentIndex: 0, text: 'hello' }
        });

        expect(harness.events.getEvents().map(event => event.type)).toEqual([
            'turn_start',
            'message_start',
            'message_update'
        ]);
        expect(harness.events.getSnapshot('session_1').streamingMessage).toEqual({
            id: 'message_1',
            turnId: 'turn_1',
            role: 'assistant',
            blocks: [{ type: 'text', contentIndex: 0, text: 'hello' }],
            status: 'streaming'
        });
    });
});
