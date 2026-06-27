import type {
    AgentRuntimeAgentEndEvent,
    AgentRuntimeBeforeAgentStartEvent,
    AgentRuntimeBeforeAgentStartResult,
    AgentRuntimeExtension,
    AgentRuntimeResourceDiscoveryResult
} from '../AgentRuntimeExtensionRunner.js';
import type {
    AgentToolAfterResultInput,
    AgentToolBeforeCallInput,
    AgentToolBeforeCallResult,
    AgentToolBlockResult,
    AgentRuntimeTool,
    AgentRuntimeToolResult
} from '../../tools/AgentToolRegistry.js';
import type { AgentRuntimeExtensionSetupContext } from '../AgentRuntimeExtensionRunner.js';
import type { AgentRuntimeDiagnostic } from '../../runtime/AgentRuntimeTypes.js';

export type PiExtensionFactory = (pi: PiExtensionAPI) => Promise<void> | void;

export interface PiExtensionProviderConfig {
    baseUrl?: string;
    apiKey?: string;
    api?: string;
    streamSimple?: unknown;
    headers?: Record<string, string>;
    authHeader?: string;
    models?: unknown[];
    oauth?: unknown;
    [key: string]: unknown;
}

export interface PiExtensionProviderRegistry {
    registerProvider: (name: string, config: PiExtensionProviderConfig) => void;
    unregisterProvider?: (name: string) => void;
}

export interface PiExtensionToolDefinition<TArgs = unknown, TDetails = unknown> {
    name: string;
    label?: string;
    description: string;
    parameters: unknown;
    needsApproval?: boolean | ((args: TArgs) => boolean | Promise<boolean>);
    execute: (
        toolCallId: string,
        args: TArgs,
        signal?: AbortSignal,
        onUpdate?: (content: AgentRuntimeToolResult<TDetails>['content']) => void,
        context?: PiExtensionToolExecutionContext
    ) => Promise<AgentRuntimeToolResult<TDetails>>;
}

export interface PiExtensionToolExecutionContext {
    cwd: string;
}

export interface PiExtensionContext {
    cwd: string;
    reload: () => Promise<void>;
    getActiveTools: () => string[];
}

export interface PiResourcesDiscoverEvent {
    type: 'resources_discover';
    cwd: string;
    reason: 'startup' | 'reload';
}

export interface PiBeforeAgentStartEvent {
    type: 'before_agent_start';
    prompt: string;
    systemPrompt: string;
    images?: unknown[];
}

export interface PiBeforeAgentStartResult {
    message?: {
        customType: string;
        content: unknown;
        display?: boolean;
        details?: unknown;
    };
    messages?: AgentRuntimeBeforeAgentStartResult['messages'];
    systemPrompt?: string;
}

export interface PiAgentEndEvent {
    type: 'agent_end';
    messages: unknown[];
    result?: unknown;
}

export interface PiToolCallEvent {
    type: 'tool_call';
    toolCallId: string;
    toolName: string;
    input: Record<string, unknown>;
    args: unknown;
}

export interface PiToolCallResult {
    args?: unknown;
    block?: boolean;
    reason?: string;
    details?: unknown;
    content?: AgentRuntimeToolResult['content'];
}

export interface PiToolResultEvent {
    type: 'tool_result';
    toolCallId: string;
    toolName: string;
    input: Record<string, unknown>;
    args: unknown;
    content: AgentRuntimeToolResult['content'];
    details: unknown;
    isError?: boolean;
}

export interface PiToolResultResult {
    content?: AgentRuntimeToolResult['content'];
    details?: unknown;
    isError?: boolean;
}

export type PiExtensionHandler<E, R = undefined> = (
    event: E,
    context: PiExtensionContext
) => Promise<R | void> | R | void;

type PiExtensionGenericHandler = PiExtensionHandler<unknown, unknown>;

export interface PiExtensionAPI {
    on(event: 'resources_discover', handler: PiExtensionHandler<PiResourcesDiscoverEvent, AgentRuntimeResourceDiscoveryResult>): void;
    on(event: 'before_agent_start', handler: PiExtensionHandler<PiBeforeAgentStartEvent, PiBeforeAgentStartResult>): void;
    on(event: 'agent_end', handler: PiExtensionHandler<PiAgentEndEvent>): void;
    on(event: 'tool_call', handler: PiExtensionHandler<PiToolCallEvent, PiToolCallResult>): void;
    on(event: 'tool_result', handler: PiExtensionHandler<PiToolResultEvent, PiToolResultResult>): void;
    on(event: string, handler: PiExtensionGenericHandler): void;
    registerTool<TArgs = unknown, TDetails = unknown>(tool: PiExtensionToolDefinition<TArgs, TDetails>): void;
    registerProvider(name: string, config: PiExtensionProviderConfig): void;
    unregisterProvider(name: string): void;
    registerCommand(name: string, options: unknown): void;
    registerShortcut(shortcut: string, options: unknown): void;
    registerFlag(name: string, options: { default?: boolean | string }): void;
    getFlag(name: string): boolean | string | undefined;
    registerMessageRenderer(customType: string, renderer: unknown): void;
    sendMessage<TContent = unknown>(
        message: { customType: string; content: TContent; display?: boolean; details?: unknown }
    ): void;
    sendUserMessage(content: string | unknown[]): void;
    appendEntry<TContent = unknown>(customType: string, data?: TContent): void;
    setSessionName(name: string): void;
    getSessionName(): string | undefined;
    setLabel(entryId: string, label: string | undefined): void;
    exec(command: string, args: string[], options?: unknown): Promise<unknown>;
    getActiveTools(): string[];
    getAllTools(): Array<{ name: string; description: string; needsApproval: boolean | 'dynamic' }>;
    setActiveTools(toolNames: string[]): void;
    getCommands(): unknown[];
    setModel(model: unknown): Promise<boolean>;
    getThinkingLevel(): string;
    setThinkingLevel(level: string): void;
}

export interface PiExtensionCompatHostOptions {
    cwd: string;
    providerRegistry?: PiExtensionProviderRegistry;
    exec?: (command: string, args: string[], options?: unknown) => Promise<unknown>;
    onDiagnostic?: (diagnostic: AgentRuntimeDiagnostic) => void;
}

export class PiExtensionCompatHost {
    constructor(private readonly options: PiExtensionCompatHostOptions) {}

    fromFactory(id: string, factory: PiExtensionFactory): AgentRuntimeExtension {
        return {
            id,
            setup: async context => {
                const handlers = new PiExtensionHandlerRegistry();
                const flags = new Map<string, boolean | string | undefined>();
                const api = this.createApi(context, handlers, flags);
                try {
                    await factory(api);
                } catch (error) {
                    this.options.onDiagnostic?.({
                        type: 'error',
                        path: id,
                        message: toErrorMessage(error)
                    });
                    return;
                }
                this.bindHandlers(context, handlers);
            }
        };
    }

    private createApi(
        context: AgentRuntimeExtensionSetupContext,
        handlers: PiExtensionHandlerRegistry,
        flags: Map<string, boolean | string | undefined>
    ): PiExtensionAPI {
        // pi 的 on() 是重载接口；内部只需要按事件名保存 handler，事件 payload 在绑定阶段恢复类型。
        const on = ((event: string, handler: PiExtensionGenericHandler): void => {
            handlers.add(event, handler);
        }) as PiExtensionAPI['on'];
        return {
            on,
            registerTool: <TArgs = unknown, TDetails = unknown>(
                tool: PiExtensionToolDefinition<TArgs, TDetails>
            ): void => {
                // 工具执行仍进入 SDK registry，approval、trace 和 before/after hook 不绕过现有边界。
                const runtimeTool: AgentRuntimeTool<TArgs, TDetails> = {
                    name: tool.name,
                    label: tool.label,
                    description: tool.description,
                    parameters: tool.parameters,
                    needsApproval: tool.needsApproval,
                    execute: async (toolCallId, args) => tool.execute(toolCallId, args, undefined, undefined, {
                        cwd: this.options.cwd
                    })
                };
                context.tools.register(runtimeTool);
            },
            registerProvider: (name, config): void => {
                this.options.providerRegistry?.registerProvider(name, config);
            },
            unregisterProvider: (name): void => {
                this.options.providerRegistry?.unregisterProvider?.(name);
            },
            registerCommand: (): void => {},
            registerShortcut: (): void => {},
            registerFlag: (name, options): void => {
                flags.set(name, options.default);
            },
            getFlag: name => flags.get(name),
            registerMessageRenderer: (): void => {},
            sendMessage: message => {
                context.workflow.appendCustomMessage(message);
            },
            sendUserMessage: content => {
                // 兼容层不能直接驱动 session loop，只把用户消息转成 continuation 请求交给 adapter。
                context.workflow.requestContinuation({
                    id: `pi-user-message-${Date.now()}`,
                    reason: 'pi-send-user-message',
                    prompt: typeof content === 'string' ? content : undefined,
                    details: typeof content === 'string' ? undefined : content
                });
            },
            appendEntry: (customType, data): void => {
                context.workflow.appendCustomMessage({
                    customType,
                    content: data,
                    display: false,
                    persist: true
                });
            },
            setSessionName: (): void => {},
            getSessionName: () => undefined,
            setLabel: (): void => {},
            exec: async (command, args, options) => {
                if (!this.options.exec) {
                    throw new Error('Pi extension exec is not configured.');
                }
                return this.options.exec(command, args, options);
            },
            getActiveTools: () => context.tools.getToolSummary().map(tool => tool.name),
            getAllTools: () => context.tools.getToolSummary(),
            setActiveTools: (): void => {},
            getCommands: () => [],
            setModel: async () => false,
            getThinkingLevel: () => 'auto',
            setThinkingLevel: (): void => {}
        };
    }

    private bindHandlers(
        context: AgentRuntimeExtensionSetupContext,
        handlers: PiExtensionHandlerRegistry
    ): void {
        const piContext = this.createContext(context);
        this.bindResourceDiscovery(context, handlers, piContext);
        this.bindBeforeAgentStart(context, handlers, piContext);
        this.bindAgentEnd(context, handlers, piContext);
        this.bindToolCall(context, handlers, piContext);
        this.bindToolResult(context, handlers, piContext);
    }

    private bindResourceDiscovery(
        context: AgentRuntimeExtensionSetupContext,
        handlers: PiExtensionHandlerRegistry,
        piContext: PiExtensionContext
    ): void {
        const resourceHandlers = handlers.get<PiResourcesDiscoverEvent, AgentRuntimeResourceDiscoveryResult>('resources_discover');
        if (resourceHandlers.length === 0) return;
        context.resources.onDiscover(async input => {
            // 多个 pi 扩展可以追加资源路径；这里保留顺序，后续解析和去重由资源加载端处理。
            const merged: AgentRuntimeResourceDiscoveryResult = {};
            for (const handler of resourceHandlers) {
                const result = await handler({
                    type: 'resources_discover',
                    cwd: this.options.cwd,
                    reason: input.reason
                }, piContext);
                appendResourceResult(merged, result);
            }
            return merged;
        });
    }

    private bindBeforeAgentStart(
        context: AgentRuntimeExtensionSetupContext,
        handlers: PiExtensionHandlerRegistry,
        piContext: PiExtensionContext
    ): void {
        const beforeHandlers = handlers.get<PiBeforeAgentStartEvent, PiBeforeAgentStartResult>('before_agent_start');
        if (beforeHandlers.length === 0) return;
        context.events.onBeforeAgentStart(async event => {
            let systemPrompt = event.systemPrompt;
            const messages: NonNullable<AgentRuntimeBeforeAgentStartResult['messages']> = [];
            for (const handler of beforeHandlers) {
                const result = await handler(toPiBeforeAgentStartEvent(event, systemPrompt), piContext);
                if (!result) continue;
                if (result.systemPrompt !== undefined) {
                    systemPrompt = result.systemPrompt;
                }
                if (result.message) {
                    messages.push(result.message);
                }
                if (result.messages) {
                    messages.push(...result.messages);
                }
            }
            return {
                ...(messages.length > 0 ? { messages } : {}),
                systemPrompt
            };
        });
    }

    private bindAgentEnd(
        context: AgentRuntimeExtensionSetupContext,
        handlers: PiExtensionHandlerRegistry,
        piContext: PiExtensionContext
    ): void {
        const agentEndHandlers = handlers.get<PiAgentEndEvent>('agent_end');
        if (agentEndHandlers.length === 0) return;
        context.events.onAgentEnd(async event => {
            for (const handler of agentEndHandlers) {
                await handler(toPiAgentEndEvent(event), piContext);
            }
        });
    }

    private bindToolCall(
        context: AgentRuntimeExtensionSetupContext,
        handlers: PiExtensionHandlerRegistry,
        piContext: PiExtensionContext
    ): void {
        const toolCallHandlers = handlers.get<PiToolCallEvent, PiToolCallResult>('tool_call');
        if (toolCallHandlers.length === 0) return;
        context.tools.onBeforeToolCall(async input => {
            let args = input.args;
            for (const handler of toolCallHandlers) {
                // 让前一个扩展改写后的参数继续传给后一个扩展，匹配 pi hook 的链式拦截语义。
                const event = toPiToolCallEvent(input, args);
                const result = await handler(event, piContext);
                args = resolveToolCallArgsAfterHandler(args, event);
                if (!result) {
                    continue;
                }
                if (result.args !== undefined) {
                    args = result.args;
                }
                if (result.block) {
                    return {
                        args,
                        block: toAgentToolBlockResult(result)
                    };
                }
            }
            return args === input.args ? undefined : { args };
        });
    }

    private bindToolResult(
        context: AgentRuntimeExtensionSetupContext,
        handlers: PiExtensionHandlerRegistry,
        piContext: PiExtensionContext
    ): void {
        const toolResultHandlers = handlers.get<PiToolResultEvent, PiToolResultResult>('tool_result');
        if (toolResultHandlers.length === 0) return;
        context.tools.onAfterToolResult(async input => {
            let result = input.result;
            for (const handler of toolResultHandlers) {
                // tool_result 是后处理链，后续扩展看到的是上一个扩展改写后的结果。
                const next = await handler(toPiToolResultEvent(input, result), piContext);
                if (!next) continue;
                result = {
                    content: next.content ?? result.content,
                    details: next.details ?? result.details
                };
            }
            return result;
        });
    }

    private createContext(context: AgentRuntimeExtensionSetupContext): PiExtensionContext {
        return {
            cwd: this.options.cwd,
            reload: async () => {},
            getActiveTools: () => context.tools.getToolSummary().map(tool => tool.name)
        };
    }
}

class PiExtensionHandlerRegistry {
    private readonly handlers = new Map<string, PiExtensionGenericHandler[]>();

    add(event: string, handler: PiExtensionGenericHandler): void {
        // 同一事件保留注册顺序，避免 extension 间 hidden context / tool hook 顺序漂移。
        const existing = this.handlers.get(event) ?? [];
        existing.push(handler);
        this.handlers.set(event, existing);
    }

    get<E, R = undefined>(event: string): Array<PiExtensionHandler<E, R>> {
        return [...(this.handlers.get(event) ?? [])] as Array<PiExtensionHandler<E, R>>;
    }
}

const appendResourceResult = (
    target: AgentRuntimeResourceDiscoveryResult,
    source: AgentRuntimeResourceDiscoveryResult | void
): void => {
    if (!source) return;
    if (source.skillPaths) {
        target.skillPaths = [...(target.skillPaths ?? []), ...source.skillPaths];
    }
    if (source.promptPaths) {
        target.promptPaths = [...(target.promptPaths ?? []), ...source.promptPaths];
    }
    if (source.themePaths) {
        target.themePaths = [...(target.themePaths ?? []), ...source.themePaths];
    }
};

const toPiBeforeAgentStartEvent = (
    event: AgentRuntimeBeforeAgentStartEvent,
    systemPrompt: string
): PiBeforeAgentStartEvent => ({
    type: 'before_agent_start',
    prompt: event.prompt,
    systemPrompt,
    images: event.images
});

const toPiAgentEndEvent = (event: AgentRuntimeAgentEndEvent): PiAgentEndEvent => ({
    type: 'agent_end',
    messages: event.messages,
    result: event.result
});

const toPiToolCallEvent = (
    input: AgentToolBeforeCallInput,
    args: unknown
): PiToolCallEvent => ({
    type: 'tool_call',
    toolCallId: input.toolCallId,
    toolName: input.toolName,
    input: toMutableToolInput(args),
    args
});

const toPiToolResultEvent = (
    input: AgentToolAfterResultInput,
    result: AgentRuntimeToolResult
): PiToolResultEvent => ({
    type: 'tool_result',
    toolCallId: input.toolCallId,
    toolName: input.toolName,
    input: toMutableToolInput(input.args),
    args: input.args,
    content: result.content,
    details: result.details
});

const resolveToolCallArgsAfterHandler = (
    previousArgs: unknown,
    event: PiToolCallEvent
): unknown => {
    if (isRecord(previousArgs)) return event.input;
    if (!isRecord(previousArgs) && Object.keys(event.input).length > 0) return event.input;
    return previousArgs;
};

const toMutableToolInput = (args: unknown): Record<string, unknown> =>
    isRecord(args) ? args : {};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const toAgentToolBlockResult = (result: PiToolCallResult): AgentToolBlockResult => {
    const message = result.reason ?? 'Tool call blocked by pi extension.';
    return {
        message,
        content: result.content,
        details: result.details ?? { reason: message }
    };
};

const toErrorMessage = (error: unknown): string =>
    error instanceof Error ? error.message : String(error);
