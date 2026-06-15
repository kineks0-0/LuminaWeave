import { describe, expect, it, vi } from 'vitest';
import type { ForgeAgentGraphInput } from '@/api/core/forge/graph/ForgeAgentGraphRuntime.js';

const { runMock } = vi.hoisted(() => ({
    runMock: vi.fn()
}));

vi.mock('@/api/core/forge/graph/ForgeAgentGraphRuntime.js', () => ({
    forgeAgentGraphRuntime: {
        run: runMock
    }
}));

describe('ForgeAgentGraph', () => {
    it('delegates graph execution through the lazy runtime wrapper', async () => {
        const input = {
            session: { id: 'forge_session_alpha' },
            userInput: 'build preview'
        } as ForgeAgentGraphInput;
        const graphResult = { intent: 'edit' };
        runMock.mockResolvedValueOnce(graphResult);

        const { ForgeAgentGraph } = await import('@/api/core/forge/graph/ForgeAgentGraph.js');
        const result = await ForgeAgentGraph.run(input);

        expect(result).toBe(graphResult);
        expect(runMock).toHaveBeenCalledWith(input);
    });
});
