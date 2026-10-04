import {
    normalizeResearchMaxResults,
    type AgentResearchExtractDepth,
    type AgentResearchFailedResult,
    type AgentResearchFetchInput,
    type AgentResearchProvider,
    type AgentResearchResult,
    type AgentResearchSearchDepth,
    type AgentResearchSearchInput,
    type AgentResearchSource,
    type AgentResearchTimeRange
} from './AgentResearchProvider.js';
import { isRecord } from '@shared/CommonUtils.js';

const TAVILY_API_BASE_URL = 'https://api.tavily.com';

interface TavilyExecutableTool<TInput, TOutput> {
    execute?: (input: TInput) => Promise<TOutput>;
}

interface TavilySearchToolOptions {
    apiKey: string;
    includeAnswer: true;
    includeRawContent: 'markdown';
    includeFavicon: true;
    maxResults: number;
    searchDepth?: AgentResearchSearchDepth;
}

interface TavilyExtractToolOptions {
    apiKey: string;
    format: 'markdown';
    includeFavicon: true;
    extractDepth?: AgentResearchExtractDepth;
}

interface TavilySearchToolInput {
    query: string;
    searchDepth?: AgentResearchSearchDepth;
    timeRange?: AgentResearchTimeRange;
}

interface TavilyExtractToolInput {
    urls: string[];
    extractDepth?: AgentResearchExtractDepth;
    query?: string;
}

interface TavilySearchResponse {
    answer?: string;
    query: string;
    responseTime: number;
    results: Array<{
        title: string;
        url: string;
        content: string;
        rawContent?: string;
        score: number;
        publishedDate: string;
        favicon?: string;
    }>;
    usage?: { credits: number };
    requestId: string;
}

interface TavilyExtractResponse {
    results: Array<{
        url: string;
        title: string | null;
        rawContent: string;
        favicon?: string;
    }>;
    failedResults: Array<{
        url: string;
        error: string;
    }>;
    responseTime: number;
    usage?: { credits: number };
    requestId: string;
}

interface TavilySearchApiResult {
    title: string;
    url: string;
    content: string;
    raw_content?: string;
    score: number;
    published_date: string;
    favicon?: string;
}

interface TavilySearchApiResponse {
    answer?: string;
    response_time: number;
    images?: Array<string | { url?: string; description?: string }>;
    results?: TavilySearchApiResult[];
    usage?: { credits: number };
    request_id: string;
}

interface TavilyExtractApiResult {
    url: string;
    title: string | null;
    raw_content: string;
    favicon?: string;
}

interface TavilyExtractApiFailedResult {
    url: string;
    error: string;
}

interface TavilyExtractApiResponse {
    results?: TavilyExtractApiResult[];
    failed_results?: TavilyExtractApiFailedResult[];
    response_time: number;
    usage?: { credits: number };
    request_id: string;
}

export interface TavilyResearchProviderOptions {
    apiKey: string;
    createSearchTool?: (options: TavilySearchToolOptions) => TavilyExecutableTool<TavilySearchToolInput, TavilySearchResponse>;
    createExtractTool?: (options: TavilyExtractToolOptions) => TavilyExecutableTool<TavilyExtractToolInput, TavilyExtractResponse>;
}

export class TavilyResearchProvider implements AgentResearchProvider {
    readonly name = 'tavily' as const;

    constructor(private readonly options: TavilyResearchProviderOptions) {}

    async search(input: AgentResearchSearchInput): Promise<AgentResearchResult> {
        const apiKey = this.resolveApiKey();
        const maxResults = normalizeResearchMaxResults(input.maxResults);
        const tool = this.createSearchTool({
            apiKey,
            includeAnswer: true,
            includeRawContent: 'markdown',
            includeFavicon: true,
            maxResults,
            searchDepth: input.searchDepth
        });
        const response = await this.executeTool(tool, {
            query: input.query,
            searchDepth: input.searchDepth,
            timeRange: input.timeRange
        });
        const sources = response.results.map(result => ({
            title: result.title,
            url: result.url,
            content: result.content,
            rawContent: result.rawContent,
            score: result.score,
            publishedDate: result.publishedDate,
            favicon: result.favicon
        }));
        return {
            mode: 'search',
            provider: this.name,
            requestId: response.requestId,
            responseTime: response.responseTime,
            answer: response.answer,
            usage: response.usage,
            sources,
            markdown: formatSearchMarkdown(input.query, response.answer, sources)
        };
    }

    async fetch(input: AgentResearchFetchInput): Promise<AgentResearchResult> {
        const apiKey = this.resolveApiKey();
        const tool = this.createExtractTool({
            apiKey,
            format: 'markdown',
            includeFavicon: true,
            extractDepth: input.extractDepth
        });
        const response = await this.executeTool(tool, {
            urls: input.urls,
            extractDepth: input.extractDepth,
            query: input.query
        });
        const sources = response.results.map(result => ({
            title: result.title,
            url: result.url,
            rawContent: result.rawContent,
            favicon: result.favicon
        }));
        const failedResults = response.failedResults.map(result => ({
            url: result.url,
            error: result.error
        }));
        return {
            mode: 'fetch',
            provider: this.name,
            requestId: response.requestId,
            responseTime: response.responseTime,
            usage: response.usage,
            sources,
            failedResults,
            markdown: formatFetchMarkdown(sources, failedResults)
        };
    }

    private createSearchTool(options: TavilySearchToolOptions): TavilyExecutableTool<TavilySearchToolInput, TavilySearchResponse> {
        if (this.options.createSearchTool) {
            return this.options.createSearchTool(options);
        }
        return createTavilySearchFetchTool(options);
    }

    private createExtractTool(options: TavilyExtractToolOptions): TavilyExecutableTool<TavilyExtractToolInput, TavilyExtractResponse> {
        if (this.options.createExtractTool) {
            return this.options.createExtractTool(options);
        }
        return createTavilyExtractFetchTool(options);
    }

    private async executeTool<TInput, TOutput>(
        tool: TavilyExecutableTool<TInput, TOutput>,
        input: TInput
    ): Promise<TOutput> {
        if (typeof tool.execute !== 'function') {
            throw new Error('Tavily AI SDK tool does not expose execute.');
        }
        return tool.execute(input);
    }

    private resolveApiKey(): string {
        const apiKey = this.options.apiKey.trim();
        if (!apiKey) {
            throw new Error('Tavily API key is required.');
        }
        return apiKey;
    }
}

const createTavilySearchFetchTool = (
    options: TavilySearchToolOptions
): TavilyExecutableTool<TavilySearchToolInput, TavilySearchResponse> => ({
    execute: async input => {
        const response = await postTavily<TavilySearchApiResponse>('search', options.apiKey, {
            query: input.query,
            search_depth: input.searchDepth ?? options.searchDepth,
            max_results: options.maxResults,
            include_answer: options.includeAnswer,
            include_raw_content: options.includeRawContent,
            include_favicon: options.includeFavicon,
            time_range: input.timeRange
        });
        return {
            answer: response.answer,
            query: input.query,
            responseTime: response.response_time,
            results: (response.results ?? []).map(result => ({
                title: result.title,
                url: result.url,
                content: result.content,
                rawContent: result.raw_content,
                score: result.score,
                publishedDate: result.published_date,
                favicon: result.favicon
            })),
            usage: response.usage,
            requestId: response.request_id
        };
    }
});

const createTavilyExtractFetchTool = (
    options: TavilyExtractToolOptions
): TavilyExecutableTool<TavilyExtractToolInput, TavilyExtractResponse> => ({
    execute: async input => {
        const response = await postTavily<TavilyExtractApiResponse>('extract', options.apiKey, {
            urls: input.urls,
            extract_depth: input.extractDepth ?? options.extractDepth,
            format: options.format,
            include_favicon: options.includeFavicon,
            query: input.query
        });
        return {
            results: (response.results ?? []).map(result => ({
                url: result.url,
                title: result.title,
                rawContent: result.raw_content,
                favicon: result.favicon
            })),
            failedResults: (response.failed_results ?? []).map(result => ({
                url: result.url,
                error: result.error
            })),
            responseTime: response.response_time,
            usage: response.usage,
            requestId: response.request_id
        };
    }
});

const postTavily = async <TResponse>(
    endpoint: 'search' | 'extract',
    apiKey: string,
    body: Record<string, unknown>
): Promise<TResponse> => {
    const response = await fetch(`${TAVILY_API_BASE_URL}/${endpoint}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'X-Client-Source': 'ai-sdk'
        },
        body: JSON.stringify(body)
    });
    const data = await readTavilyJson(response);
    if (!response.ok) {
        throw new Error(formatTavilyError(response.status, data));
    }
    return data as TResponse;
};

const readTavilyJson = async (response: Response): Promise<unknown> => {
    try {
        return await response.json();
    } catch {
        return null;
    }
};

const formatTavilyError = (status: number, data: unknown): string => {
    if (isRecord(data)) {
        const detail = data.detail;
        if (isRecord(detail) && typeof detail.error === 'string') {
            return detail.error;
        }
    }
    return `${status} Error: ${JSON.stringify(data)}`;
};

const formatSearchMarkdown = (
    query: string,
    answer: string | undefined,
    sources: AgentResearchSource[]
): string => {
    const lines = [`# Web research: ${query}`];
    if (answer) {
        lines.push('', answer);
    }
    lines.push('', '## Sources');
    sources.forEach((source, index) => {
        lines.push('', `${index + 1}. [${source.title || source.url}](${source.url})`);
        if (source.content) {
            lines.push(source.content);
        }
        if (source.rawContent && source.rawContent !== source.content) {
            lines.push('', source.rawContent);
        }
    });
    return lines.join('\n').trim();
};

const formatFetchMarkdown = (
    sources: AgentResearchSource[],
    failedResults: AgentResearchFailedResult[]
): string => {
    const lines = ['# Web fetch'];
    sources.forEach((source, index) => {
        lines.push('', `## ${index + 1}. ${source.title || source.url}`, source.url);
        if (source.rawContent) {
            lines.push('', source.rawContent);
        } else if (source.content) {
            lines.push('', source.content);
        }
    });
    if (failedResults.length > 0) {
        lines.push('', '## Failed URLs');
        failedResults.forEach(result => {
            lines.push(`- ${result.url}: ${result.error}`);
        });
    }
    return lines.join('\n').trim();
};
