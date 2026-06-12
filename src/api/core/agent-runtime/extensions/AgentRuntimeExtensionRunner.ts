import type { AgentToolRegistry } from '../tools/AgentToolRegistry.js';

export interface AgentRuntimeCustomMessage<TContent = unknown> {
    customType: string;
    content: TContent;
    display?: boolean;
    persist?: boolean;
    details?: unknown;
}

export interface AgentRuntimeBeforeAgentStartEvent {
    prompt: string;
    systemPrompt: string;
    images?: unknown[];
}

export interface AgentRuntimeBeforeAgentStartResult {
    messages?: AgentRuntimeCustomMessage[];
    systemPrompt?: string;
}

export interface AgentRuntimeAgentEndEvent {
    messages: unknown[];
    result?: unknown;
}

export interface AgentRuntimeResourceDiscoveryInput {
    reason: 'startup' | 'reload';
}

export interface AgentRuntimeResourceDiscoveryResult {
    skillPaths?: string[];
    promptPaths?: string[];
    themePaths?: string[];
}

export interface AgentRuntimeStatusProjection {
    id: string;
    label: string;
    state?: 'idle' | 'running' | 'waiting' | 'complete' | 'error';
    details?: unknown;
}

export interface AgentRuntimeWidgetProjection<TContent = unknown> {
    id: string;
    title: string;
    content: TContent;
    details?: unknown;
}

export interface AgentRuntimeContinuationRequest {
    id: string;
    reason: string;
    prompt?: string;
    details?: unknown;
}

export interface AgentRuntimeWorkflowProjection {
    customMessages: AgentRuntimeCustomMessage[];
    statuses: AgentRuntimeStatusProjection[];
    widgets: AgentRuntimeWidgetProjection[];
}

export interface AgentRuntimeResolvedExtensionPath {
    extensionId: string;
    path: string;
    source: 'code-config' | 'manifest' | 'vfs';
}

export type AgentRuntimeBeforeAgentStartHandler = (
    event: AgentRuntimeBeforeAgentStartEvent
) => Promise<AgentRuntimeBeforeAgentStartResult | void> | AgentRuntimeBeforeAgentStartResult | void;

export type AgentRuntimeAgentEndHandler = (
    event: AgentRuntimeAgentEndEvent
) => Promise<void> | void;

export type AgentRuntimeResourceDiscoveryHandler = (
    input: AgentRuntimeResourceDiscoveryInput
) => Promise<AgentRuntimeResourceDiscoveryResult | void> | AgentRuntimeResourceDiscoveryResult | void;

export interface AgentRuntimeExtensionSetupContext {
    tools: AgentToolRegistry;
    events: AgentRuntimeEventRegistry;
    resources: AgentRuntimeResourceRegistry;
    workflow: AgentRuntimeWorkflowRegistry;
}

export interface AgentRuntimeExtension {
    id: string;
    setup: (context: AgentRuntimeExtensionSetupContext) => Promise<void> | void;
}

export interface AgentRuntimeExtensionRunnerOptions {
    tools: AgentToolRegistry;
    extensions?: AgentRuntimeExtension[];
    resolvedExtensionPaths?: AgentRuntimeResolvedExtensionPath[];
}

export class AgentRuntimeEventRegistry {
    private readonly beforeAgentStartHandlers: AgentRuntimeBeforeAgentStartHandler[] = [];
    private readonly agentEndHandlers: AgentRuntimeAgentEndHandler[] = [];

    onBeforeAgentStart(handler: AgentRuntimeBeforeAgentStartHandler): void {
        this.beforeAgentStartHandlers.push(handler);
    }

    onAgentEnd(handler: AgentRuntimeAgentEndHandler): void {
        this.agentEndHandlers.push(handler);
    }

    getBeforeAgentStartHandlers(): AgentRuntimeBeforeAgentStartHandler[] {
        return [...this.beforeAgentStartHandlers];
    }

    getAgentEndHandlers(): AgentRuntimeAgentEndHandler[] {
        return [...this.agentEndHandlers];
    }
}

export class AgentRuntimeResourceRegistry {
    private readonly discoveryHandlers: AgentRuntimeResourceDiscoveryHandler[] = [];

    onDiscover(handler: AgentRuntimeResourceDiscoveryHandler): void {
        this.discoveryHandlers.push(handler);
    }

    getDiscoveryHandlers(): AgentRuntimeResourceDiscoveryHandler[] {
        return [...this.discoveryHandlers];
    }
}

export class AgentRuntimeWorkflowRegistry {
    private readonly customMessages: AgentRuntimeCustomMessage[] = [];
    private readonly statuses = new Map<string, AgentRuntimeStatusProjection>();
    private readonly widgets = new Map<string, AgentRuntimeWidgetProjection>();
    private readonly continuationRequests: AgentRuntimeContinuationRequest[] = [];

    appendCustomMessage(message: AgentRuntimeCustomMessage): void {
        this.customMessages.push(clone(message));
    }

    setStatus(status: AgentRuntimeStatusProjection): void {
        this.statuses.set(status.id, clone(status));
    }

    setWidget(widget: AgentRuntimeWidgetProjection): void {
        this.widgets.set(widget.id, clone(widget));
    }

    requestContinuation(request: AgentRuntimeContinuationRequest): void {
        this.continuationRequests.push(clone(request));
    }

    getProjection(): AgentRuntimeWorkflowProjection {
        return {
            customMessages: clone(this.customMessages),
            statuses: clone(Array.from(this.statuses.values())),
            widgets: clone(Array.from(this.widgets.values()))
        };
    }

    drainContinuationRequests(): AgentRuntimeContinuationRequest[] {
        const requests = clone(this.continuationRequests);
        this.continuationRequests.length = 0;
        return requests;
    }
}

export class AgentRuntimeExtensionRunner {
    private readonly events = new AgentRuntimeEventRegistry();
    private readonly resources = new AgentRuntimeResourceRegistry();
    private readonly workflow = new AgentRuntimeWorkflowRegistry();
    private readonly extensions: AgentRuntimeExtension[];
    private readonly resolvedExtensionPaths: AgentRuntimeResolvedExtensionPath[];
    private invalidationReason: string | null = null;
    private isSetup = false;

    constructor(private readonly options: AgentRuntimeExtensionRunnerOptions) {
        this.extensions = [...(options.extensions ?? [])];
        this.resolvedExtensionPaths = clone(options.resolvedExtensionPaths ?? []);
    }

    async setup(): Promise<void> {
        this.assertValid();
        if (this.isSetup) return;
        const context: AgentRuntimeExtensionSetupContext = {
            tools: this.options.tools,
            events: this.events,
            resources: this.resources,
            workflow: this.workflow
        };
        for (const extension of this.extensions) {
            await extension.setup(context);
        }
        this.isSetup = true;
    }

    invalidate(message = 'Agent runtime extension context is stale.'): void {
        this.invalidationReason = message;
    }

    async emitBeforeAgentStart(event: AgentRuntimeBeforeAgentStartEvent): Promise<AgentRuntimeBeforeAgentStartResult> {
        this.assertValid();
        let systemPrompt = event.systemPrompt;
        const messages: AgentRuntimeCustomMessage[] = [];
        for (const handler of this.events.getBeforeAgentStartHandlers()) {
            const result = await handler({ ...event, systemPrompt });
            if (!result) continue;
            if (result.systemPrompt !== undefined) {
                systemPrompt = result.systemPrompt;
            }
            if (result.messages) {
                messages.push(...result.messages);
            }
        }
        return {
            ...(messages.length > 0 ? { messages } : {}),
            systemPrompt
        };
    }

    async emitAgentEnd(event: AgentRuntimeAgentEndEvent): Promise<void> {
        this.assertValid();
        for (const handler of this.events.getAgentEndHandlers()) {
            await handler(event);
        }
    }

    async discoverResources(input: AgentRuntimeResourceDiscoveryInput): Promise<AgentRuntimeResourceDiscoveryResult> {
        this.assertValid();
        const skillPaths: string[] = [];
        const promptPaths: string[] = [];
        const themePaths: string[] = [];
        for (const handler of this.resources.getDiscoveryHandlers()) {
            const result = await handler(input);
            if (!result) continue;
            skillPaths.push(...(result.skillPaths ?? []));
            promptPaths.push(...(result.promptPaths ?? []));
            themePaths.push(...(result.themePaths ?? []));
        }
        return {
            ...(skillPaths.length > 0 ? { skillPaths } : {}),
            ...(promptPaths.length > 0 ? { promptPaths } : {}),
            ...(themePaths.length > 0 ? { themePaths } : {})
        };
    }

    getWorkflowProjection(): AgentRuntimeWorkflowProjection {
        this.assertValid();
        return this.workflow.getProjection();
    }

    drainContinuationRequests(): AgentRuntimeContinuationRequest[] {
        this.assertValid();
        return this.workflow.drainContinuationRequests();
    }

    getResolvedExtensionPaths(): AgentRuntimeResolvedExtensionPath[] {
        this.assertValid();
        return clone(this.resolvedExtensionPaths);
    }

    private assertValid(): void {
        if (this.invalidationReason) {
            throw new Error(this.invalidationReason);
        }
    }
}

const clone = <T>(value: T): T => {
    if (value === null || value === undefined) return value;
    return JSON.parse(JSON.stringify(value)) as T;
};
