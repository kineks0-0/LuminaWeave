import {
    createAssistantMessageEventStream,
    streamSimple as piRunSimple,
    type Api,
    type AssistantMessage,
    type AssistantMessageEvent,
    type AssistantMessageEventStream,
    type Context,
    type Message,
    type Model,
    type Provider,
    type ProviderResponse,
    type SimpleStreamOptions,
    type StopReason
} from '@earendil-works/pi-ai';
import { llmEngine } from '../../../../llmEngine.js';
import { lwStorage } from '../../../../storage.js';
import type {
    ForgeExecutionRequest,
    ForgePiModelRequestTrace,
    ForgePiModelTraceEvent,
    ForgePiTraceMessage,
    ForgeRuntimeContext
} from '../../../../../types/ForgeRuntimeTypes.js';
import type { NexusAPI, NexusNode } from '../../../../../types/nexus.js';

const FORGE_REQUEST_ID_HEADER = 'x-lumina-forge-request-id';

export type ForgePiRunSimple = (
    model: Model<Api>,
    context: Context,
    options?: SimpleStreamOptions
) => AssistantMessageEventStream;

export interface ForgePiNexusProviderDeps {
    resolveNodesFromPreset?: (presetId?: string) => NexusNode[];
    readApiConfigs?: () => NexusAPI[];
    runSimple?: ForgePiRunSimple;
    now?: () => number;
}

interface ForgePiNexusRunMetadata {
    request: ForgeExecutionRequest;
    context: ForgeRuntimeContext;
    apiKey?: string;
}

interface ResolvedPiModelConfig {
    api: Api;
    provider: Provider;
    baseUrl: string;
    apiKey?: string;
}

export class ForgePiNexusProvider {
    private readonly resolveNodesFromPreset: (presetId?: string) => NexusNode[];
    private readonly readApiConfigs: () => NexusAPI[];
    private readonly runSimple: ForgePiRunSimple;
    private readonly now: () => number;
    private readonly runMetadata = new Map<string, ForgePiNexusRunMetadata>();
    private readonly traces = new Map<string, ForgePiModelRequestTrace>();
    private readonly traceGroups = new Map<string, ForgePiModelRequestTrace[]>();

    constructor(deps: ForgePiNexusProviderDeps = {}) {
        this.resolveNodesFromPreset = deps.resolveNodesFromPreset ?? ((presetId) => llmEngine.resolveNodesFromPreset(presetId));
        this.readApiConfigs = deps.readApiConfigs ?? (() => {
            const value = lwStorage.get('nexus.apis', [], 'Global');
            return Array.isArray(value) ? value as NexusAPI[] : [];
        });
        this.runSimple = deps.runSimple ?? piRunSimple;
        this.now = deps.now ?? Date.now;
    }

    createModelForRequest(request: ForgeExecutionRequest, context: ForgeRuntimeContext): Model<Api> {
        const presetId = request.presetId || context.selectedPresetId;
        const node = this.resolveNodesFromPreset(presetId)[0];
        if (!node) {
            throw new Error(`Forge pi runtime 无法解析 Nexus 预设节点：${presetId || '未指定'}`);
        }
        const apiConfig = this.readApiConfigs().find(item => item?.id === node.provider) ?? null;
        const resolved = this.resolvePiModelConfig(node, apiConfig);
        this.runMetadata.set(request.requestId, { request, context, apiKey: resolved.apiKey });
        return {
            id: node.model || presetId || 'forge-nexus',
            name: node.model || 'Forge Nexus',
            api: resolved.api,
            provider: resolved.provider,
            baseUrl: resolved.baseUrl,
            reasoning: false,
            input: ['text'],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 0,
            maxTokens: 0,
            headers: {
                [FORGE_REQUEST_ID_HEADER]: request.requestId
            }
        };
    }

    streamSimple(model: Model<Api>, context: Context, options?: SimpleStreamOptions): AssistantMessageEventStream {
        const stream = createAssistantMessageEventStream();
        void this.forwardPiStream(stream, model, context, options);
        return stream;
    }

    getTrace(requestId: string): ForgePiModelRequestTrace | null {
        return this.traces.get(requestId) ?? null;
    }

    getTraces(requestId: string): ForgePiModelRequestTrace[] {
        return [...(this.traceGroups.get(requestId) ?? [])];
    }

    private async forwardPiStream(
        output: AssistantMessageEventStream,
        model: Model<Api>,
        agentContext: Context,
        options: SimpleStreamOptions | undefined
    ): Promise<void> {
        const requestId = this.resolveRequestId(model);
        const metadata = requestId ? this.runMetadata.get(requestId) : undefined;
        const trace = this.createTrace({
            requestId: requestId || `forge-pi-${this.now()}`,
            model,
            agentContext,
            metadata
        });
        try {
            if (!metadata) {
                throw new Error(`Forge pi Nexus provider missing request metadata: ${requestId || 'unknown request'}`);
            }
            const source = this.runSimple(model, agentContext, this.createStreamOptions(options, metadata, trace));
            this.appendTraceEvent(trace, 'request_prepared', 'pi-ai request prepared.', {
                messageCount: agentContext.messages.length,
                toolCount: agentContext.tools?.length ?? 0
            });
            this.appendTraceEvent(trace, 'stream_start', 'pi-ai provider stream started.');
            let finalMessage: AssistantMessage | null = null;
            for await (const event of source) {
                finalMessage = this.captureEvent(trace, event) ?? finalMessage;
                output.push(event);
            }
            if (finalMessage) {
                trace.finalText = this.extractAssistantText(finalMessage);
                this.captureCacheUsage(trace, finalMessage, options);
                this.appendTraceEvent(trace, 'stream_done', 'pi-ai provider stream completed.', {
                    finalText: trace.finalText,
                    stopReason: finalMessage.stopReason
                });
                output.end(finalMessage);
            } else {
                const assistant = this.createEmptyAssistant(model, 'stop');
                this.appendTraceEvent(trace, 'stream_done', 'pi-ai provider stream completed without assistant message.');
                output.end(assistant);
            }
        } catch (error: unknown) {
            const assistant = this.createEmptyAssistant(model, 'error');
            assistant.errorMessage = this.formatErrorMessage(error);
            trace.errorMessage = assistant.errorMessage;
            this.appendTraceEvent(trace, 'stream_error', assistant.errorMessage);
            output.push({ type: 'error', reason: 'error', error: assistant });
            output.end(assistant);
        } finally {
            trace.updatedAt = this.now();
            this.traces.set(trace.requestId, trace);
            this.upsertTrace(trace);
        }
    }

    private createStreamOptions(
        options: SimpleStreamOptions | undefined,
        metadata: ForgePiNexusRunMetadata,
        trace: ForgePiModelRequestTrace
    ): SimpleStreamOptions {
        return {
            ...options,
            ...this.mapGenerationSettings(metadata.request.generationSettings),
            apiKey: metadata.apiKey,
            signal: options?.signal,
            onPayload: async (payload, model) => {
                trace.providerPayload = this.toJsonSafe(payload);
                return options?.onPayload ? options.onPayload(payload, model) : undefined;
            },
            onResponse: async (response, model) => {
                trace.providerResponse = this.summarizeProviderResponse(response);
                await options?.onResponse?.(response, model);
            }
        };
    }

    private captureEvent(trace: ForgePiModelRequestTrace, event: AssistantMessageEvent): AssistantMessage | null {
        if (event.type === 'text_delta') {
            trace.finalText += event.delta;
            this.appendTraceEvent(trace, 'text_delta', event.delta);
            return null;
        }
        if (event.type === 'toolcall_end') {
            this.appendTraceEvent(trace, 'tool_call', event.toolCall.name, event.toolCall);
            return null;
        }
        if (event.type === 'done') {
            return event.message;
        }
        if (event.type === 'error') {
            trace.errorMessage = event.error.errorMessage ?? null;
            return event.error;
        }
        return null;
    }

    private captureCacheUsage(
        trace: ForgePiModelRequestTrace,
        message: AssistantMessage,
        options: SimpleStreamOptions | undefined
    ): void {
        trace.cache = {
            sessionId: options?.sessionId,
            cacheRead: message.usage.cacheRead,
            cacheWrite: message.usage.cacheWrite,
            totalTokens: message.usage.totalTokens,
            providerUsage: this.toJsonSafe(message.usage)
        };
    }

    private resolvePiModelConfig(node: NexusNode, apiConfig: NexusAPI | null): ResolvedPiModelConfig {
        const type = apiConfig?.type;
        const baseUrl = apiConfig?.url || node.url || '';
        const apiKey = apiConfig?.key || node.key || undefined;
        if (type === 'anthropic') {
            return { api: 'anthropic-messages', provider: 'anthropic', baseUrl: baseUrl || 'https://api.anthropic.com', apiKey };
        }
        if (type === 'google') {
            return { api: 'google-generative-ai', provider: 'google', baseUrl, apiKey };
        }
        return {
            api: 'openai-completions',
            provider: this.resolveOpenAiProvider(node, apiConfig),
            baseUrl: baseUrl || 'https://api.openai.com/v1',
            apiKey
        };
    }

    private resolveOpenAiProvider(node: NexusNode, apiConfig: NexusAPI | null): Provider {
        if (apiConfig?.type === 'openai') return 'openai';
        if (node.provider === 'openai' || node.provider === 'openai_compatible') return 'openai';
        return node.provider || 'openai';
    }

    private createTrace(input: {
        requestId: string;
        model: Model<Api>;
        agentContext: Context;
        metadata?: ForgePiNexusRunMetadata;
    }): ForgePiModelRequestTrace {
        const now = this.now();
        const modelCallIndex = (this.traceGroups.get(input.requestId)?.length ?? 0) + 1;
        const trace: ForgePiModelRequestTrace = {
            traceId: `pi-trace-${input.requestId}-${modelCallIndex}`,
            requestId: input.requestId,
            modelCallIndex,
            api: 'lumina-nexus',
            modelId: input.model.id,
            providerId: input.model.provider,
            systemPrompt: input.agentContext.systemPrompt ?? '',
            piMessages: this.toTraceMessages(input.agentContext.messages),
            transformedPiMessages: this.toTraceMessages(input.agentContext.messages),
            providerPayload: null,
            providerResponse: null,
            tools: (input.agentContext.tools ?? []).map(tool => ({
                name: tool.name,
                description: tool.description
            })),
            generationSettings: input.metadata?.request.generationSettings ?? {},
            contextBundleSummary: null,
            lifecycle: [],
            finalText: '',
            errorMessage: null,
            createdAt: now,
            updatedAt: now
        };
        this.traces.set(trace.requestId, trace);
        this.upsertTrace(trace);
        return trace;
    }

    private upsertTrace(trace: ForgePiModelRequestTrace): void {
        const group = [...(this.traceGroups.get(trace.requestId) ?? [])];
        const index = group.findIndex(item => item.traceId === trace.traceId);
        if (index >= 0) {
            group.splice(index, 1, trace);
        } else {
            group.push(trace);
        }
        this.traceGroups.set(trace.requestId, group);
    }

    private toTraceMessages(messages: Message[]): ForgePiTraceMessage[] {
        return messages.map(message => {
            if (message.role === 'toolResult') {
                return {
                    role: message.role,
                    toolCallId: message.toolCallId,
                    toolName: message.toolName,
                    content: message.content,
                    isError: message.isError
                };
            }
            return {
                role: message.role,
                content: message.content
            };
        });
    }

    private appendTraceEvent(
        trace: ForgePiModelRequestTrace,
        type: ForgePiModelTraceEvent['type'],
        message: string,
        payload?: unknown
    ): void {
        trace.lifecycle.push({
            type,
            message,
            payload,
            timestamp: this.now()
        });
        trace.updatedAt = this.now();
    }

    private mapGenerationSettings(settings: ForgeExecutionRequest['generationSettings']): SimpleStreamOptions {
        return {
            temperature: typeof settings?.temperature === 'number' ? settings.temperature : undefined,
            maxTokens: typeof settings?.max_tokens === 'number' ? settings.max_tokens : undefined
        };
    }

    private summarizeProviderResponse(response: ProviderResponse): Record<string, unknown> {
        const status = 'status' in response ? response.status : undefined;
        const statusText = 'statusText' in response ? response.statusText : undefined;
        return {
            status,
            statusText
        };
    }

    private resolveRequestId(model: Model<Api>): string | null {
        return model.headers?.[FORGE_REQUEST_ID_HEADER] ?? null;
    }

    private extractAssistantText(assistant: AssistantMessage): string {
        return assistant.content
            .filter(part => part.type === 'text')
            .map(part => part.text)
            .join('');
    }

    private createEmptyAssistant(model: Model<Api>, stopReason: StopReason): AssistantMessage {
        return {
            role: 'assistant',
            content: [],
            api: model.api,
            provider: model.provider,
            model: model.id,
            usage: {
                input: 0,
                output: 0,
                cacheRead: 0,
                cacheWrite: 0,
                totalTokens: 0,
                cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
            },
            stopReason,
            timestamp: this.now()
        };
    }

    private toJsonSafe(value: unknown): unknown {
        try {
            return JSON.parse(JSON.stringify(value));
        } catch {
            return String(value);
        }
    }

    private formatErrorMessage(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }
}

export const forgePiNexusProvider = new ForgePiNexusProvider();
