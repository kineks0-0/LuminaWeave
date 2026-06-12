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

const TOOL_PAYLOAD_TEXT_LIMIT = 12000;
const TOOL_PAYLOAD_STRING_LIMIT = 4000;
const TOOL_PAYLOAD_ARRAY_ITEM_LIMIT = 20;
const TOOL_PAYLOAD_OBJECT_KEY_LIMIT = 40;

const truncateText = (value: string, limit: number): string => {
  if (value.length <= limit) return value;
  let marker = `\n\n[已截断 ${value.length - limit} 个字符]`;
  let headLength = Math.max(0, limit - marker.length);
  marker = `\n\n[已截断 ${value.length - headLength} 个字符]`;
  headLength = Math.max(0, limit - marker.length);
  return `${value.slice(0, headLength)}${marker}`;
};

const isPlainRecord = (value: object): value is Record<string, unknown> =>
  Object.prototype.toString.call(value) === '[object Object]';

const createToolPayloadReplacer = () => {
  const seen = new WeakSet<object>();
  return (_key: string, value: unknown): unknown => {
    if (typeof value === 'string') {
      return truncateText(value, TOOL_PAYLOAD_STRING_LIMIT);
    }
    if (!value || typeof value !== 'object') return value;
    if (seen.has(value)) return '[Circular]';
    seen.add(value);

    if (Array.isArray(value) && value.length > TOOL_PAYLOAD_ARRAY_ITEM_LIMIT) {
      return [
        ...value.slice(0, TOOL_PAYLOAD_ARRAY_ITEM_LIMIT),
        `[已截断 ${value.length - TOOL_PAYLOAD_ARRAY_ITEM_LIMIT} 项]`
      ];
    }

    if (isPlainRecord(value)) {
      const entries = Object.entries(value);
      if (entries.length > TOOL_PAYLOAD_OBJECT_KEY_LIMIT) {
        const preview: Record<string, unknown> = {};
        for (const [entryKey, entryValue] of entries.slice(0, TOOL_PAYLOAD_OBJECT_KEY_LIMIT)) {
          preview[entryKey] = entryValue;
        }
        preview.__truncatedKeys = `[已截断 ${entries.length - TOOL_PAYLOAD_OBJECT_KEY_LIMIT} 个字段]`;
        return preview;
      }
    }

    return value;
  };
};

const stringifyPayload = (payload: unknown): string => {
  try {
    const serialized = JSON.stringify(payload, createToolPayloadReplacer(), 2);
    return truncateText(serialized ?? String(payload), TOOL_PAYLOAD_TEXT_LIMIT);
  } catch {
    return truncateText(String(payload), TOOL_PAYLOAD_TEXT_LIMIT);
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
