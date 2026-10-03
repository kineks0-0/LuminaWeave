import type { AgentTool, AgentToolResult } from '@earendil-works/pi-agent-core';
import type { AgentRuntimeTool, AgentToolRegistry } from '../tools/AgentToolRegistry.js';
import { toPiToolResult } from './AgentSessionContent.js';
import { APPROVAL_PENDING_TEXT, isRecord } from './AgentSessionInternals.js';
import type { AgentSessionPendingApproval, AgentSessionToolCall } from './AgentSessionTypes.js';

export interface AgentSessionToolBindingContext {
    sessionId: string;
    registry: AgentToolRegistry | undefined;
    /** registry 要求审批时回调会话登记等待中的审批；绑定层本身不持有审批状态。 */
    onApprovalRequired(approval: AgentSessionPendingApproval): void;
}

export interface AgentSessionMergedTools {
    agentTools: AgentTool[];
    registryToolNames: ReadonlySet<string>;
}

/** 合并适配器工具与 SDK registry 工具；名称重复直接抛错。 */
export const mergeTools = (
    input: { turnId: string; adapterTools: AgentTool[] },
    context: AgentSessionToolBindingContext
): AgentSessionMergedTools => {
    const { turnId, adapterTools } = input;
    const names = new Set(adapterTools.map(tool => tool.name));
    if (names.size !== adapterTools.length) {
        throw new Error('Agent session adapter tools contain duplicate names.');
    }
    const registryToolNames = new Set<string>();
    const registry = context.registry;
    if (!registry) return { agentTools: [...adapterTools], registryToolNames };
    const wrapped: AgentTool[] = [];
    for (const tool of registry.listTools()) {
        if (names.has(tool.name)) {
            throw new Error(`Agent tool already registered: ${tool.name}`);
        }
        names.add(tool.name);
        registryToolNames.add(tool.name);
        wrapped.push(wrapRegistryTool(context, registry, turnId, tool));
    }
    return { agentTools: [...adapterTools, ...wrapped], registryToolNames };
};

const wrapRegistryTool = (
    context: AgentSessionToolBindingContext,
    registry: AgentToolRegistry,
    turnId: string,
    tool: AgentRuntimeTool
): AgentTool => ({
    name: tool.name,
    label: tool.label ?? tool.name,
    description: tool.description,
    parameters: toToolSchema(tool.parameters),
    execute: async (toolCallId, params) =>
        executeRegistryTool(context, registry, turnId, tool.name, toolCallId, params)
});

const executeRegistryTool = async (
    context: AgentSessionToolBindingContext,
    tools: AgentToolRegistry,
    turnId: string,
    toolName: string,
    toolCallId: string,
    args: unknown
): Promise<AgentToolResult> => {
    const { sessionId } = context;
    const execution = await tools.execute({ sessionId, turnId, toolCallId, toolName, args });
    if (execution.status === 'executed') return toPiToolResult(execution.result);
    // 被 registry hook 阻断时 registry 不发任何工具事件，总线上该调用无 start/end；模型仍会收到错误结果。
    if (execution.status === 'blocked') return { ...toPiToolResult(execution.result), isError: true };
    context.onApprovalRequired({
        sessionId,
        turnId,
        toolCallId,
        toolName,
        args: execution.approval.args,
        source: 'registry'
    });
    return {
        content: [{ type: 'text', text: APPROVAL_PENDING_TEXT }],
        details: undefined,
        terminate: true
    };
};

export const toToolCall = (approval: AgentSessionPendingApproval): AgentSessionToolCall => ({
    sessionId: approval.sessionId,
    turnId: approval.turnId,
    toolCallId: approval.toolCallId,
    toolName: approval.toolName,
    args: approval.args
});

/** registry 只持有跨运行时的 JSON Schema；pi 的 TSchema 是结构空接口，普通对象即可满足。 */
const toToolSchema = (parameters: unknown): AgentTool['parameters'] =>
    isRecord(parameters) ? parameters : { type: 'object' };
