import {
    AgentToolRegistry,
    type AgentRuntimeTool,
    type AgentRuntimeToolResult
} from '../tools/AgentToolRegistry.js';
import { AgentRuntimeEventBus } from '../events/AgentRuntimeEventBus.js';
import { deepClone } from '@shared/CommonUtils.js';

export interface AgentRuntimeMockModel<TRequest = unknown> {
    requests: TRequest[];
    enqueueText: (text: string) => void;
    generate: (request: TRequest) => Promise<{ text: string }>;
}

export interface AgentRuntimeMockSessionStore<TState = unknown> {
    load: (sessionId: string) => Promise<TState | null>;
    save: (sessionId: string, state: TState) => Promise<void>;
    dump: () => Record<string, TState>;
}

export interface AgentRuntimeMockApprovalRequest {
    toolName: string;
    args: unknown;
}

export interface AgentRuntimeMockApprovalResult {
    approved: boolean;
    message?: string;
}

export interface AgentRuntimeMockApprovalController {
    requests: AgentRuntimeMockApprovalRequest[];
    enqueue: (result: AgentRuntimeMockApprovalResult) => void;
    request: (request: AgentRuntimeMockApprovalRequest) => Promise<AgentRuntimeMockApprovalResult>;
}

export interface AgentRuntimeMockVfs {
    readFile: (path: string) => Promise<string>;
    writeFile: (path: string, content: string) => Promise<void>;
    deleteFile: (path: string) => Promise<void>;
    exists: (path: string) => Promise<boolean>;
    listFiles: () => string[];
}

export interface CreateAgentRuntimeMockToolOptions<TArgs = unknown, TDetails = unknown> {
    name: string;
    description: string;
    parameters?: unknown;
    needsApproval?: AgentRuntimeTool<TArgs, TDetails>['needsApproval'];
    execute?: (toolCallId: string, args: TArgs) => Promise<AgentRuntimeToolResult<TDetails>>;
}

export interface AgentRuntimeTestHarness {
    tools: AgentToolRegistry;
    events: AgentRuntimeEventBus;
    model: AgentRuntimeMockModel;
    sessionStore: AgentRuntimeMockSessionStore;
    approvals: AgentRuntimeMockApprovalController;
    vfs: AgentRuntimeMockVfs;
    createTool: <TArgs = unknown, TDetails = unknown>(options: CreateAgentRuntimeMockToolOptions<TArgs, TDetails>) => AgentRuntimeTool<TArgs, TDetails>;
    registerTool: <TArgs = unknown, TDetails = unknown>(tool: AgentRuntimeTool<TArgs, TDetails>) => AgentToolRegistry;
}

export const createAgentRuntimeTestHarness = (): AgentRuntimeTestHarness => {
    const tools = new AgentToolRegistry();
    return {
        tools,
        events: new AgentRuntimeEventBus(),
        model: createMockModel(),
        sessionStore: createMockSessionStore(),
        approvals: createMockApprovalController(),
        vfs: createMockVfs(),
        createTool: options => ({
            name: options.name,
            description: options.description,
            parameters: options.parameters ?? {},
            needsApproval: options.needsApproval,
            execute: options.execute ?? (async (_toolCallId, args) => ({
                content: [{ type: 'text', text: JSON.stringify(args) }],
                details: args as never
            }))
        }),
        registerTool: tool => {
            tools.register(tool);
            return tools;
        }
    };
};

const createMockModel = (): AgentRuntimeMockModel => {
    const responses: string[] = [];
    const requests: unknown[] = [];
    return {
        requests,
        enqueueText: text => {
            responses.push(text);
        },
        generate: async request => {
            requests.push(clone(request));
            return { text: responses.shift() ?? '' };
        }
    };
};

const createMockSessionStore = (): AgentRuntimeMockSessionStore => {
    const states = new Map<string, unknown>();
    return {
        load: async sessionId => clone(states.get(sessionId) ?? null),
        save: async (sessionId, state) => {
            states.set(sessionId, clone(state));
        },
        dump: () => Object.fromEntries(
            Array.from(states.entries()).map(([sessionId, state]) => [sessionId, clone(state)])
        )
    };
};

const createMockApprovalController = (): AgentRuntimeMockApprovalController => {
    const results: AgentRuntimeMockApprovalResult[] = [];
    const requests: AgentRuntimeMockApprovalRequest[] = [];
    return {
        requests,
        enqueue: result => {
            results.push({ ...result });
        },
        request: async request => {
            requests.push(clone(request));
            const approval = results.shift() ?? { approved: false, message: 'No mock approval result queued.' };
            return {
                ...approval,
                message: approval.message
            };
        }
    };
};

const createMockVfs = (): AgentRuntimeMockVfs => {
    const files = new Map<string, string>();
    return {
        readFile: async path => {
            const normalized = normalizePath(path);
            const content = files.get(normalized);
            if (content === undefined) throw new Error(`Mock VFS file not found: ${normalized}`);
            return content;
        },
        writeFile: async (path, content) => {
            files.set(normalizePath(path), content);
        },
        deleteFile: async path => {
            files.delete(normalizePath(path));
        },
        exists: async path => files.has(normalizePath(path)),
        listFiles: () => Array.from(files.keys()).sort()
    };
};

const normalizePath = (path: string): string =>
    `/${path || ''}`.replace(/\\/g, '/').replace(/\/+/g, '/');

const clone = <T>(value: T): T => {
    if (value === null || value === undefined) return value;
    return deepClone(value) as T;
};
