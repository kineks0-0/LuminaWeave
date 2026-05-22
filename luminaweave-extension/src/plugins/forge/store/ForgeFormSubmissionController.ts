import type { ForgeRuntimeDecision, ForgeUserCommand } from '../../../types/ForgeRuntimeTypes.js';

export interface ForgeFormSubmissionControllerDeps {
    hasStructuredForm(formId: string): boolean;
    buildSubmittedFormUserInput(formId: string): string;
    getTransientSelections(scopeId: string): Map<string, string | string[]>;
    addUserViewMessage(content: string): void;
    dispatchWorkspaceCommand(command: ForgeUserCommand): Promise<ForgeRuntimeDecision | unknown>;
    clearTransientSelections(scopeId: string): void;
    markScopeSubmitted(scopeId: string): void;
    setLastError(message: string | null): void;
    showToast(message: string, type: 'error'): void;
    logger?: Pick<Console, 'log' | 'warn' | 'error'>;
}

export class ForgeFormSubmissionController {
    private readonly logger: Pick<Console, 'log' | 'warn' | 'error'>;

    constructor(private readonly deps: ForgeFormSubmissionControllerDeps) {
        this.logger = deps.logger ?? console;
    }

    async submitStructuredForm(formId: string): Promise<void> {
        const hasForm = this.deps.hasStructuredForm(formId);
        const scopeId = hasForm ? null : formId;
        this.deps.setLastError(null);

        try {
            const transientSummary = scopeId
                ? this.summarizeTransientSelections(this.deps.getTransientSelections(scopeId))
                : '';

            if (scopeId && transientSummary) {
                this.logger.log(`[Forge-Store] 将临时选项转化为对话记录:\n${transientSummary}`);
                this.deps.addUserViewMessage(`【用户选择与意图收集】:\n${transientSummary}`);
            }

            const formResultXml = hasForm ? this.deps.buildSubmittedFormUserInput(formId) : '';
            const finalUserInput = formResultXml || transientSummary;

            if (!finalUserInput) {
                this.logger.warn('[Forge-Store] 提交中止：没有任何有效数据。');
                return;
            }

            await this.deps.dispatchWorkspaceCommand({
                type: 'submit_form',
                formId,
                userInput: finalUserInput
            });

            if (scopeId) {
                this.logger.log(`[Forge-Store] 提交完成，清空消息作用域 ${scopeId} 的瞬态选值。`);
                this.deps.clearTransientSelections(scopeId);
                this.deps.markScopeSubmitted(scopeId);
            }
        } catch (error: any) {
            const message = error?.message || '提交表单失败';
            this.deps.setLastError(message);
            this.deps.showToast(message, 'error');
            this.logger.error('[Forge-Store] submitStructuredForm failed:', error);
        }
    }

    private summarizeTransientSelections(selections: Map<string, string | string[]>): string {
        return Array.from(selections.entries())
            .map(([key, value]) => {
                const displayValue = Array.isArray(value) ? value.join('、') : value;
                return displayValue ? `${key}: ${displayValue}` : null;
            })
            .filter(Boolean)
            .join('\n');
    }
}
