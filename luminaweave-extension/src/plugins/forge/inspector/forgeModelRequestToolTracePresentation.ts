import type {
  ForgeModelRequestToolEvent,
  ForgeModelRequestTrace
} from '../../../types/ForgeRuntimeTypes.js';

export interface ForgeModelRequestToolEventPresentation {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  createdAt: number;
  payloadText: string;
}

export interface ForgeModelRequestToolTracePresentation {
  empty: boolean;
  emptyTitle: string;
  emptyDescription: string;
  toolSummary: Array<{
    name: string;
    description: string | null;
    approvalLabel: string;
  }>;
  events: ForgeModelRequestToolEventPresentation[];
}

const badgeByType: Record<ForgeModelRequestToolEvent['type'], string> = {
  tool_call: '调用',
  tool_result: '结果',
  tool_approval_needed: '待授权',
  tool_approval_resolved: '授权结果'
};

const stringifyPayload = (payload: unknown): string => {
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload);
  }
};

export const buildModelRequestToolTracePresentation = (
  trace: Pick<ForgeModelRequestTrace, 'toolEvents' | 'toolSetSummary'> | null | undefined
): ForgeModelRequestToolTracePresentation => {
  const toolSummary = [...(trace?.toolSetSummary ?? [])].map((tool) => ({
    name: tool.name,
    description: tool.description ?? null,
    approvalLabel: tool.needsApproval === 'dynamic'
      ? '动态判断'
      : tool.needsApproval
        ? '需要授权'
        : '无需授权'
  }));
  const events = [...(trace?.toolEvents ?? [])]
    .sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id))
    .map((event) => ({
      id: event.id,
      badge: badgeByType[event.type],
      title: event.toolName,
      subtitle: event.toolCallId,
      createdAt: event.createdAt,
      payloadText: stringifyPayload(event.payload)
    }));

  return {
    empty: events.length === 0,
    emptyTitle: '暂无工具调用',
    emptyDescription: '非 tool calling 请求，或本次请求尚未产生工具事件。',
    toolSummary,
    events
  };
};
