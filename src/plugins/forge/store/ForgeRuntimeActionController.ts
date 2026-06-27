import type { ForgeRuntimeOrchestrator } from '../../../api/core/forge/runtime/ForgeRuntimeOrchestrator.js';
import type {
    ForgeRuntimeDecision,
    ForgeToolApprovalResolutionOptions,
    ForgeUserCommand
} from '../../../types/ForgeRuntimeTypes.js';

export interface ForgeRuntimeActionControllerDeps {
    getRuntimeOrchestrator(): ForgeRuntimeOrchestrator;
    setProcessing(value: boolean): void;
    getIsGenerating(): boolean;
    setIsGenerating(value: boolean): void;
    failRunningOperations(reason?: string): void;
    shouldKeepGenerationActiveAfterDispatch?(): boolean;
    markToolApprovalResolved?(toolCallId: string, approved: boolean, message?: string): void;
    fallbackResolveToolApproval(toolCallId: string, approved: boolean, message?: string): void;
    logger?: Pick<Console, 'log' | 'warn'>;
}

export class ForgeRuntimeActionController {
    private readonly logger: Pick<Console, 'log' | 'warn'>;

    constructor(private readonly deps: ForgeRuntimeActionControllerDeps) {
        this.logger = deps.logger ?? console;
    }

    async dispatchWorkspaceCommand(command: ForgeUserCommand): Promise<ForgeRuntimeDecision> {
        this.logger.log(`[Forge-Store] 开始调度命令：${command.type}`, { command });
        this.deps.setProcessing(true);
        try {
            const result = await this.deps.getRuntimeOrchestrator().dispatch(command);
            this.logger.log(`[Forge-Store] 命令 ${command.type} 执行圆满结束。`);
            return result;
        } finally {
            this.logger.log(`[Forge-Store] 正在清理命令 ${command.type} 的生命周期。`);
            this.deps.setProcessing(false);
            const keepGenerationActive = this.deps.shouldKeepGenerationActiveAfterDispatch?.() === true;
            if (this.deps.getIsGenerating()) {
                if (keepGenerationActive) {
                    this.logger.log('[Forge-Store] 命令调度暂停在待授权状态，保留生成态。');
                } else {
                    this.logger.warn('[Forge-Store] 严重警告：命令调度结束但 isGenerating 仍为 true，正在强制回收。');
                    this.deps.setIsGenerating(false);
                    this.deps.failRunningOperations();
                }
            } else {
                this.deps.failRunningOperations();
            }
        }
    }

    async resolveToolApproval(
        toolCallId: string,
        approved: boolean,
        message?: string,
        options?: ForgeToolApprovalResolutionOptions
    ): Promise<boolean> {
        const markedLocally = this.deps.markToolApprovalResolved !== undefined;
        this.deps.markToolApprovalResolved?.(toolCallId, approved, message);
        const resumed = options === undefined
            ? await this.deps.getRuntimeOrchestrator().resolveToolApproval(toolCallId, approved, message)
            : await this.deps.getRuntimeOrchestrator().resolveToolApproval(toolCallId, approved, message, options);
        if (!resumed) {
            if (!markedLocally) {
                this.deps.fallbackResolveToolApproval(toolCallId, approved, message);
            }
            return resumed;
        }
        if (!approved) {
            this.deps.setIsGenerating(false);
            this.deps.failRunningOperations('工具授权已拒绝。');
        }
        return resumed;
    }
}
