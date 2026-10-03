import type { AgentMessage, StreamFn } from '@earendil-works/pi-agent-core';
import { fauxAssistantMessage, fauxText } from '@earendil-works/pi-ai';
import { describe, expect, it } from 'vitest';
import { createSessionKit, echoTool, registerWriteTool, toolCallResponse } from './agentSessionTestKit';

const history: AgentMessage[] = [
    { role: 'user', content: [{ type: 'text', text: 'earlier' }], timestamp: 1 },
    fauxAssistantMessage(fauxText('earlier answer'))
];

describe('AgentSession turn context', () => {
    it('previews exactly the messages pi hands to the provider on the first request', async () => {
        const { faux, session, tools, plan } = createSessionKit({ now: () => 4242 });
        registerWriteTool(tools);
        const captured: unknown[] = [];
        const streamFn: StreamFn = (model, context, options) => {
            captured.push(structuredClone(context.messages));
            return faux.streamFn(model, context, options);
        };
        faux.setResponses([
            toolCallResponse('echo', { text: 'x' }),
            fauxAssistantMessage(fauxText('done'))
        ]);
        const turnPlan = plan('t1', { history, tools: [echoTool], streamFn, prompt: 'go' });

        const preview = session.previewTurn(turnPlan);
        await session.runTurn(turnPlan);

        expect(captured.length).toBeGreaterThan(0);
        // 注入固定时间后无需剔除 timestamp：预览与 provider 收到的消息逐字段相等。
        expect(preview.transcript).toEqual(captured[0]);
        expect(preview.userMessage).toMatchObject({ timestamp: 4242 });
        expect(preview.transcript[0]).toMatchObject({ role: 'system', content: 'sys' });
        expect(preview.transcript.slice(1, -1)).toEqual(history);
        expect(preview.userMessage).toMatchObject({ role: 'user', content: [{ type: 'text', text: 'go' }] });
        expect(preview.transcript.at(-1)).toBe(preview.userMessage);
        expect(preview.model).toEqual({ provider: 'faux', id: 'faux-model' });
    });

    it('does not emit bus events or write the log when previewing', () => {
        const { session, received, plan, requireLog, logChanges } = createSessionKit();

        session.previewTurn(plan('t1'));

        expect(received).toEqual([]);
        expect(requireLog().toPersistedState().entries).toEqual([]);
        expect(logChanges).toEqual([]);
    });

    it('declares both registry and adapter tools with their parameters', () => {
        const { session, tools, plan } = createSessionKit();
        registerWriteTool(tools);

        const preview = session.previewTurn(plan('t1', { tools: [echoTool] }));

        expect(preview.toolDeclarations.map(tool => tool.name)).toEqual(['echo', 'write']);
        expect(preview.tools.map(tool => tool.name)).toEqual(['echo', 'write']);
        expect(preview.toolDeclarations[0].parameters).toMatchObject({
            type: 'object',
            properties: { text: { type: 'string' } }
        });
        expect(preview.toolDeclarations[1].parameters).toMatchObject({
            type: 'object',
            properties: { path: { type: 'string' } }
        });
        expect(preview.transcript[0]).toMatchObject({ role: 'system', toolsAdded: preview.toolDeclarations });
    });

    it('rejects history containing system messages in preview as in runTurn', () => {
        const { session, plan } = createSessionKit();
        const bad = plan('t1', { history: [{ role: 'system', content: 'x', timestamp: 0 }] });

        expect(() => session.previewTurn(bad)).toThrow(/system messages/);
    });
});
