import { describe, expect, it, vi } from 'vitest';

describe('Tavily research provider startup boundary', () => {
    it('does not load the Tavily AI SDK during provider module import', async () => {
        vi.resetModules();
        vi.doMock('@tavily/ai-sdk', () => {
            throw new Error('Tavily AI SDK must not load during provider startup.');
        });

        await expect(import('@/api/core/agent-runtime/research/TavilyResearchProvider.js'))
            .resolves
            .toHaveProperty('TavilyResearchProvider');

        vi.doUnmock('@tavily/ai-sdk');
    });
});
