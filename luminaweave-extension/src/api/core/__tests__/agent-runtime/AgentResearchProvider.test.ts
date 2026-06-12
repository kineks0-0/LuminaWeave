import { describe, expect, it, vi } from 'vitest';
import {
    TavilyResearchProvider,
    createWebResearchTool,
    type AgentResearchFetchInput,
    type AgentResearchProvider,
    type AgentResearchResult,
    type AgentResearchSearchInput
} from '@/api/core/agent-runtime/research/index.js';

describe('Agent research provider', () => {
    it('normalizes Tavily search results through the AI SDK search tool', async () => {
        const searchExecute = vi.fn(async () => ({
            answer: 'Tavily answer',
            query: 'forge agent web research',
            responseTime: 1.25,
            images: [],
            requestId: 'req_search',
            usage: { credits: 2 },
            results: [{
                title: 'Forge Agent Research',
                url: 'https://example.test/research',
                content: 'Search result summary',
                rawContent: '# Markdown body',
                score: 0.91,
                publishedDate: '2026-06-12',
                favicon: 'https://example.test/favicon.ico'
            }]
        }));
        const createSearchTool = vi.fn(() => ({ execute: searchExecute }));

        const provider = new TavilyResearchProvider({
            apiKey: 'tvly-test',
            createSearchTool,
            createExtractTool: vi.fn()
        });

        const result = await provider.search({
            mode: 'search',
            query: 'forge agent web research',
            maxResults: 99,
            searchDepth: 'advanced',
            timeRange: 'week'
        });

        expect(createSearchTool).toHaveBeenCalledWith({
            apiKey: 'tvly-test',
            includeAnswer: true,
            includeRawContent: 'markdown',
            includeFavicon: true,
            maxResults: 10,
            searchDepth: 'advanced'
        });
        expect(searchExecute).toHaveBeenCalledWith({
            query: 'forge agent web research',
            searchDepth: 'advanced',
            timeRange: 'week'
        });
        expect(result).toMatchObject({
            mode: 'search',
            provider: 'tavily',
            requestId: 'req_search',
            responseTime: 1.25,
            answer: 'Tavily answer',
            usage: { credits: 2 },
            sources: [{
                title: 'Forge Agent Research',
                url: 'https://example.test/research',
                content: 'Search result summary',
                rawContent: '# Markdown body',
                score: 0.91,
                publishedDate: '2026-06-12',
                favicon: 'https://example.test/favicon.ico'
            }]
        });
        expect(result.markdown).toContain('Tavily answer');
        expect(result.markdown).toContain('https://example.test/research');
        expect(result.markdown).toContain('# Markdown body');
    });

    it('normalizes Tavily fetch results through the AI SDK extract tool', async () => {
        const extractExecute = vi.fn(async () => ({
            responseTime: 2.5,
            requestId: 'req_fetch',
            usage: { credits: 1 },
            results: [{
                url: 'https://example.test/page',
                title: 'Fetched Page',
                rawContent: '# Page body',
                favicon: 'https://example.test/favicon.ico'
            }],
            failedResults: [{
                url: 'https://example.test/missing',
                error: 'not found'
            }]
        }));
        const createExtractTool = vi.fn(() => ({ execute: extractExecute }));

        const provider = new TavilyResearchProvider({
            apiKey: 'tvly-test',
            createSearchTool: vi.fn(),
            createExtractTool
        });

        const result = await provider.fetch({
            mode: 'fetch',
            urls: ['https://example.test/page', 'https://example.test/missing'],
            extractDepth: 'advanced',
            query: 'extract page facts'
        });

        expect(createExtractTool).toHaveBeenCalledWith({
            apiKey: 'tvly-test',
            format: 'markdown',
            includeFavicon: true,
            extractDepth: 'advanced'
        });
        expect(extractExecute).toHaveBeenCalledWith({
            urls: ['https://example.test/page', 'https://example.test/missing'],
            extractDepth: 'advanced',
            query: 'extract page facts'
        });
        expect(result).toMatchObject({
            mode: 'fetch',
            provider: 'tavily',
            requestId: 'req_fetch',
            responseTime: 2.5,
            usage: { credits: 1 },
            sources: [{
                title: 'Fetched Page',
                url: 'https://example.test/page',
                rawContent: '# Page body',
                favicon: 'https://example.test/favicon.ico'
            }],
            failedResults: [{
                url: 'https://example.test/missing',
                error: 'not found'
            }]
        });
        expect(result.markdown).toContain('Fetched Page');
        expect(result.markdown).toContain('# Page body');
        expect(result.markdown).toContain('not found');
    });

    it('wraps a research provider as the model-visible webResearch tool', async () => {
        const provider: AgentResearchProvider = {
            name: 'tavily',
            search: vi.fn(async (input: AgentResearchSearchInput): Promise<AgentResearchResult> => ({
                mode: 'search',
                provider: 'tavily',
                requestId: 'req_tool',
                responseTime: 1,
                sources: [],
                markdown: `searched:${input.query}`
            })),
            fetch: vi.fn(async (input: AgentResearchFetchInput): Promise<AgentResearchResult> => ({
                mode: 'fetch',
                provider: 'tavily',
                requestId: 'req_fetch_tool',
                responseTime: 1,
                sources: [],
                markdown: `fetched:${input.urls.join(',')}`
            }))
        };
        const tool = createWebResearchTool({ provider });

        const missingSearchQuery = await tool.execute('call_missing_query', {
            mode: 'search'
        });
        const missingFetchUrls = await tool.execute('call_missing_urls', {
            mode: 'fetch'
        });
        const searchResult = await tool.execute('call_search', {
            mode: 'search',
            query: 'forge',
            maxResults: 20
        });

        expect(tool.name).toBe('webResearch');
        expect(missingSearchQuery.details).toMatchObject({
            error: 'webResearch search requires query.'
        });
        expect(missingFetchUrls.details).toMatchObject({
            error: 'webResearch fetch requires urls.'
        });
        expect(provider.search).toHaveBeenCalledWith({
            mode: 'search',
            query: 'forge',
            maxResults: 10,
            searchDepth: undefined,
            timeRange: undefined
        });
        expect(searchResult).toMatchObject({
            content: [{ type: 'text', text: 'searched:forge' }],
            details: {
                mode: 'search',
                provider: 'tavily',
                requestId: 'req_tool'
            }
        });
    });
});
