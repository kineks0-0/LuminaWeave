import { AgentRuntimeEventBus, type AgentRuntimeSnapshot } from '../events/AgentRuntimeEventBus.js';
import type {
    AgentRuntimeResourceDiscoveryInput,
    AgentRuntimeResourceDiscoveryResult
} from '../extensions/AgentRuntimeExtensionRunner.js';
import { AgentRuntimeExtensionHost } from '../extensions/AgentRuntimeExtensionHost.js';
import { AgentToolRegistry, type AgentRuntimeTool } from '../tools/AgentToolRegistry.js';
import { AgentRuntimeCore } from './AgentRuntimeCore.js';
import type {
    AgentRuntimeOptions,
    AgentRuntimeSetupInput,
    AgentRuntimeToolEntry,
    AgentRuntimeToolPlugin
} from './AgentRuntimeTypes.js';

export class AgentRuntime<TTurnInput, TRunResult, TPreviewResult, TApprovalResult> {
    readonly id: string;
    readonly events: AgentRuntimeEventBus;
    readonly tools: AgentToolRegistry;
    private readonly core: AgentRuntimeCore<TTurnInput, TRunResult, TPreviewResult, TApprovalResult>;
    private readonly extensionHost: AgentRuntimeExtensionHost;
    private isSetup = false;
    private toolSetupPromise: Promise<void> | null = null;

    constructor(private readonly options: AgentRuntimeOptions<TTurnInput, TRunResult, TPreviewResult, TApprovalResult>) {
        this.id = options.id;
        this.events = options.events ?? new AgentRuntimeEventBus();
        this.tools = new AgentToolRegistry({ events: this.events });
        this.extensionHost = new AgentRuntimeExtensionHost({
            runtimeId: options.id,
            tools: this.tools,
            extensions: options.extensions,
            extensionLoader: options.extensionLoader,
            resourceScanner: options.resourceScanner
        });
        this.core = new AgentRuntimeCore({
            resolveSessionId: options.resolveSessionId,
            events: this.events,
            createSession: input => options.createSession({
                ...input,
                extensionRunner: this.extensionHost.getRunner(),
                tools: this.tools
            })
        });
    }

    /**
     * 运行时启动保持显式一次性初始化，避免构造函数隐式扫描目录或执行扩展代码。
     */
    async setup(input: AgentRuntimeSetupInput = { reason: 'startup' }): Promise<void> {
        await this.setupTools();
        if (this.isSetup && input.reason !== 'reload') return;
        await this.extensionHost.setup(input);
        this.isSetup = true;
    }

    async runTurn(input: TTurnInput): Promise<TRunResult> {
        await this.setup();
        return this.core.runTurn(input);
    }

    async previewPrompt(input: TTurnInput): Promise<TPreviewResult> {
        await this.setup();
        return this.core.previewPrompt(input);
    }

    async continue(sessionId: string): Promise<void> {
        await this.setup();
        await this.core.continue(sessionId);
    }

    async resolveToolApproval(
        toolCallId: string,
        approved: boolean,
        message?: string,
        options?: unknown
    ): Promise<TApprovalResult | null> {
        await this.setup();
        return this.core.resolveToolApproval(toolCallId, approved, message, options);
    }

    abortActiveGeneration(): void {
        this.core.abortActiveGeneration();
    }

    async discoverResources(
        input: AgentRuntimeResourceDiscoveryInput
    ): Promise<AgentRuntimeResourceDiscoveryResult> {
        await this.setup({ reason: input.reason });
        return this.extensionHost.discoverResources(input);
    }

    getSnapshot(): AgentRuntimeSnapshot {
        return this.events.getSnapshot();
    }

    private async setupTools(): Promise<void> {
        if (!this.toolSetupPromise) {
            // 工具注册不可回滚，因此失败后重试也复用同一个 promise，避免重复注册污染 registry。
            this.toolSetupPromise = this.registerTools();
        }
        await this.toolSetupPromise;
    }

    private async registerTools(): Promise<void> {
        for (const entry of this.options.tools ?? []) {
            // 工具插件拿到共享 registry，使接入方可以按阶段和权限组合工具，而不是让 SDK 注册默认工具。
            if (isToolPlugin(entry)) {
                await entry.setup({
                    runtimeId: this.id,
                    tools: this.tools,
                    events: this.events,
                    model: this.options.model,
                    modelProvider: this.options.modelProvider,
                    workspace: this.options.workspace,
                    approvals: this.options.approvals,
                    permissions: this.options.permissions
                });
                continue;
            }
            this.tools.register(entry);
        }
    }
}

const isToolPlugin = (entry: AgentRuntimeToolEntry): entry is AgentRuntimeToolPlugin =>
    'setup' in entry && typeof entry.setup === 'function' && !isRuntimeTool(entry);

// 通过结构特征区分工具插件与模型可见工具，避免新增运行时 tag 字段污染现有工具定义。
const isRuntimeTool = (entry: AgentRuntimeToolEntry): entry is AgentRuntimeTool =>
    'name' in entry && 'execute' in entry;
