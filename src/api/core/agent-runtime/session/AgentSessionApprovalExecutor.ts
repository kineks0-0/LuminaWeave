import type { AgentRuntimeEvent } from '../events/AgentRuntimeEventBus.js';
import type { AgentToolRegistry } from '../tools/AgentToolRegistry.js';
import { toBusToolResult } from './AgentSessionContent.js';
import { errorOutcome, toErrorMessage, type AgentSessionToolOutcome } from './AgentSessionInternals.js';
import { toToolCall } from './AgentSessionToolBinding.js';
import type { AgentSessionApprovalPolicy, AgentSessionPendingApproval } from './AgentSessionTypes.js';

export interface AgentSessionApprovalExecutorDeps {
    sessionId: string;
    tools: AgentToolRegistry | undefined;
    approvalPolicy: AgentSessionApprovalPolicy | undefined;
    emit: (event: AgentRuntimeEvent) => void;
}

/** 用户批准后执行等待中的调用：registry 工具经 registry 执行（事件由 registry 发出），策略工具经 approvalPolicy.execute 并在这里发 end 事件。 */
export const executeApprovedToolCall = async (
    deps: AgentSessionApprovalExecutorDeps,
    approval: AgentSessionPendingApproval,
    message?: string
): Promise<AgentSessionToolOutcome> => {
    const { sessionId, tools, approvalPolicy, emit } = deps;
    if (approval.source === 'registry') {
        if (!tools) return errorOutcome('Agent tool registry is not attached.');
        try {
            const resolution = await tools.resolveToolApproval(sessionId, approval.turnId, approval.toolCallId, true, message);
            if (resolution.status === 'approved') return { result: resolution.result, isError: false };
            return errorOutcome('Tool approval could not be resolved.');
        } catch (error: unknown) {
            // registry 已发出 failed 的 tool_execution_end；这里只把错误作为工具结果交还模型。
            return errorOutcome(toErrorMessage(error));
        }
    }
    if (!approvalPolicy) return errorOutcome('Agent approval policy is not attached.');
    const base = { sessionId, turnId: approval.turnId, toolCallId: approval.toolCallId, toolName: approval.toolName };
    try {
        const result = await approvalPolicy.execute(toToolCall(approval));
        emit({ type: 'tool_execution_end', ...base, status: 'completed', result: toBusToolResult(result) });
        return { result, isError: false };
    } catch (error: unknown) {
        const errorMessage = toErrorMessage(error);
        emit({ type: 'tool_execution_end', ...base, status: 'failed', errorMessage });
        return errorOutcome(errorMessage);
    }
};

/** 拒绝（或因中止取消）等待中的调用：registry 工具经 registry 发 denied 事件，策略工具由会话直接发。 */
export const denyToolCall = async (
    deps: AgentSessionApprovalExecutorDeps,
    approval: AgentSessionPendingApproval,
    reason?: string
): Promise<void> => {
    if (approval.source === 'registry') {
        await deps.tools?.resolveToolApproval(deps.sessionId, approval.turnId, approval.toolCallId, false, reason);
        return;
    }
    deps.emit({
        type: 'tool_execution_end',
        sessionId: deps.sessionId,
        turnId: approval.turnId,
        toolCallId: approval.toolCallId,
        toolName: approval.toolName,
        status: 'denied',
        ...(reason !== undefined ? { errorMessage: reason } : {})
    });
};
