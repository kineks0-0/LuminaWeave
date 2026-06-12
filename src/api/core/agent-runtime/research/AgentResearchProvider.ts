import { Type } from '@earendil-works/pi-ai';
import type { AgentRuntimeTool, AgentRuntimeToolResult } from '../tools/AgentToolRegistry.js';

export type AgentResearchProviderName = 'tavily';
export type AgentResearchMode = 'search' | 'fetch';
export type AgentResearchSearchDepth = 'basic' | 'advanced';
export type AgentResearchExtractDepth = 'basic' | 'advanced';
export type AgentResearchTimeRange = 'year' | 'month' | 'week' | 'day' | 'y' | 'm' | 'w' | 'd';

export interface AgentResearchSearchInput {
    mode: 'search';
    query: string;
    maxResults?: number;
    searchDepth?: AgentResearchSearchDepth;
    timeRange?: AgentResearchTimeRange;
}

export interface AgentResearchFetchInput {
    mode: 'fetch';
    urls: string[];
    query?: string;
    extractDepth?: AgentResearchExtractDepth;
}

export type AgentResearchInput = AgentResearchSearchInput | AgentResearchFetchInput;

export interface AgentResearchSource {
    title?: string | null;
    url: string;
    content?: string;
    rawContent?: string;
    score?: number;
    publishedDate?: string;
    favicon?: string;
}

export interface AgentResearchFailedResult {
    url: string;
    error: string;
}

export interface AgentResearchResult {
    mode: AgentResearchMode;
    provider: AgentResearchProviderName;
    requestId?: string;
    responseTime?: number;
    answer?: string;
    sources: AgentResearchSource[];
    failedResults?: AgentResearchFailedResult[];
    usage?: { credits: number };
    markdown: string;
}

export interface AgentResearchProvider {
    name: AgentResearchProviderName;
    search(input: AgentResearchSearchInput): Promise<AgentResearchResult>;
    fetch(input: AgentResearchFetchInput): Promise<AgentResearchResult>;
}

export interface WebResearchToolErrorDetails {
    mode?: AgentResearchMode;
    provider: AgentResearchProviderName;
    error: string;
}

export type WebResearchToolDetails = AgentResearchResult | WebResearchToolErrorDetails;

export interface CreateWebResearchToolOptions {
    provider: AgentResearchProvider;
}

export const normalizeResearchMaxResults = (value: unknown): number => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return 5;
    }
    return Math.max(1, Math.min(10, Math.floor(value)));
};

export const createWebResearchTool = (
    options: CreateWebResearchToolOptions
): AgentRuntimeTool<unknown, WebResearchToolDetails> => ({
    name: 'webResearch',
    label: '联网研究',
    description: [
        'Search the web or fetch URL content through the configured Tavily provider.',
        'Returns compressed Markdown and source metadata only; it does not write Forge project files, memory, or ST resources.'
    ].join('\n'),
    parameters: Type.Object({
        mode: Type.Union([
            Type.Literal('search'),
            Type.Literal('fetch')
        ]),
        query: Type.Optional(Type.String({ description: 'Search query, or optional fetch rerank query.' })),
        urls: Type.Optional(Type.Array(Type.String({ description: 'URLs to fetch as Markdown.' }))),
        maxResults: Type.Optional(Type.Number({ description: 'Search result limit, clamped to 1-10. Default: 5.' })),
        searchDepth: Type.Optional(Type.Union([
            Type.Literal('basic'),
            Type.Literal('advanced')
        ])),
        timeRange: Type.Optional(Type.Union([
            Type.Literal('year'),
            Type.Literal('month'),
            Type.Literal('week'),
            Type.Literal('day'),
            Type.Literal('y'),
            Type.Literal('m'),
            Type.Literal('w'),
            Type.Literal('d')
        ])),
        extractDepth: Type.Optional(Type.Union([
            Type.Literal('basic'),
            Type.Literal('advanced')
        ]))
    }),
    execute: async (_toolCallId, args) => executeWebResearchTool(options.provider, args)
});

const executeWebResearchTool = async (
    provider: AgentResearchProvider,
    rawArgs: unknown
): Promise<AgentRuntimeToolResult<WebResearchToolDetails>> => {
    const args = toRecord(rawArgs);
    const mode = readMode(args.mode);
    if (!mode) {
        return webResearchError(provider, 'webResearch requires mode.');
    }

    try {
        if (mode === 'search') {
            const query = readOptionalString(args.query)?.trim();
            if (!query) {
                return webResearchError(provider, 'webResearch search requires query.', mode);
            }
            const result = await provider.search({
                mode,
                query,
                maxResults: normalizeResearchMaxResults(args.maxResults),
                searchDepth: readSearchDepth(args.searchDepth),
                timeRange: readTimeRange(args.timeRange)
            });
            return webResearchResult(result);
        }

        const urls = readStringArray(args.urls);
        if (urls.length === 0) {
            return webResearchError(provider, 'webResearch fetch requires urls.', mode);
        }
        const result = await provider.fetch({
            mode,
            urls,
            query: readOptionalString(args.query),
            extractDepth: readExtractDepth(args.extractDepth)
        });
        return webResearchResult(result);
    } catch (error) {
        return webResearchError(provider, error instanceof Error ? error.message : String(error), mode);
    }
};

const webResearchResult = (
    result: AgentResearchResult
): AgentRuntimeToolResult<AgentResearchResult> => ({
    content: [{ type: 'text', text: result.markdown }],
    details: result
});

const webResearchError = (
    provider: AgentResearchProvider,
    error: string,
    mode?: AgentResearchMode
): AgentRuntimeToolResult<WebResearchToolErrorDetails> => ({
    content: [{ type: 'text', text: error }],
    details: {
        mode,
        provider: provider.name,
        error
    }
});

const toRecord = (value: unknown): Record<string, unknown> =>
    value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};

const readOptionalString = (value: unknown): string | undefined =>
    typeof value === 'string' ? value : undefined;

const readStringArray = (value: unknown): string[] =>
    Array.isArray(value)
        ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        : [];

const readMode = (value: unknown): AgentResearchMode | null =>
    value === 'search' || value === 'fetch' ? value : null;

const readSearchDepth = (value: unknown): AgentResearchSearchDepth | undefined =>
    value === 'basic' || value === 'advanced' ? value : undefined;

const readExtractDepth = (value: unknown): AgentResearchExtractDepth | undefined =>
    value === 'basic' || value === 'advanced' ? value : undefined;

const readTimeRange = (value: unknown): AgentResearchTimeRange | undefined => {
    if (
        value === 'year'
        || value === 'month'
        || value === 'week'
        || value === 'day'
        || value === 'y'
        || value === 'm'
        || value === 'w'
        || value === 'd'
    ) {
        return value;
    }
    return undefined;
};
