import { describe, expect, it, vi } from 'vitest';
import { AgentPromptAssembler } from '@/api/core/agent-runtime/prompt/AgentPromptAssembler.js';

describe('AgentPromptAssembler', () => {
    it('reuses the exact prepared prompt object for preview and run preparation with the same cache key', async () => {
        const assemble = vi.fn(async (input: { requestId: string; input: string }) => ({
            requestId: input.requestId,
            systemPrompt: `system:${input.input}`,
            branchMessages: [{ role: 'user', content: input.input }],
            activeTools: [{ name: 'readFile', description: 'read files' }]
        }));
        const assembler = new AgentPromptAssembler({
            assemble,
            resolveCacheKey: input => input.requestId
        });

        const preview = await assembler.preview({ requestId: 'request_1', input: 'hello' });
        const run = await assembler.prepareForRun({ requestId: 'request_1', input: 'hello' });

        expect(run).toBe(preview);
        expect(assemble).toHaveBeenCalledTimes(1);
        expect(assemble).toHaveBeenNthCalledWith(1, { requestId: 'request_1', input: 'hello' });
    });

    it('returns the exact prepared prompt object from the adapter assembly port', async () => {
        const prepared = {
            requestId: 'request_2',
            systemPrompt: 'system',
            branchMessages: [],
            activeTools: []
        };
        const assembler = new AgentPromptAssembler({
            assemble: vi.fn(async () => prepared)
        });

        await expect(assembler.prepareForRun({ requestId: 'request_2' })).resolves.toBe(prepared);
    });

    it('can invalidate a cached prepared prompt after the turn consumes it', async () => {
        const assemble = vi.fn(async (input: { requestId: string }) => ({
            requestId: input.requestId,
            generation: assemble.mock.calls.length
        }));
        const assembler = new AgentPromptAssembler({
            assemble,
            resolveCacheKey: input => input.requestId
        });

        const first = await assembler.preview({ requestId: 'request_3' });
        assembler.invalidate({ requestId: 'request_3' });
        const second = await assembler.prepareForRun({ requestId: 'request_3' });

        expect(second).not.toBe(first);
        expect(second).toEqual({ requestId: 'request_3', generation: 2 });
        expect(assemble).toHaveBeenCalledTimes(2);
    });
});
