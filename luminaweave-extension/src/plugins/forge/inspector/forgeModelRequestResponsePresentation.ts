import type { ForgePiTreeNode } from '@shared/ForgePiTypes.js';
import type { ForgeModelRequestTrace } from '../../../types/ForgeRuntimeTypes.js';

export interface ResolveForgeModelRequestResponseTextInput {
    trace: ForgeModelRequestTrace | null;
    sessionTree?: ForgePiTreeNode[];
    mode?: 'display' | 'thinking' | 'raw';
    fallback?: string;
}

export const resolveForgeModelRequestResponseText = ({
    trace,
    sessionTree = [],
    mode = 'display',
    fallback
}: ResolveForgeModelRequestResponseTextInput): string => {
    const emptyText = fallback ?? resolveDefaultFallback(mode);
    if (!trace) return emptyText;
    if (mode === 'thinking') return firstNonBlank(trace.responseThinking, emptyText);
    if (mode === 'raw') return firstNonBlank(trace.responseRaw, emptyText);
    return firstNonBlank(
        trace.responseDisplay,
        resolveLatestPiModelFinalText(trace),
        trace.piModelTrace?.finalText,
        resolveLatestAssistantText(sessionTree),
        emptyText
    );
};

const resolveDefaultFallback = (mode: ResolveForgeModelRequestResponseTextInput['mode']): string => {
    if (mode === 'thinking') return '暂无 thinking 内容';
    if (mode === 'raw') return '暂无 raw 内容';
    return '暂无回复内容';
};

const firstNonBlank = (...values: Array<string | null | undefined>): string => {
    return values.find(value => typeof value === 'string' && value.trim().length > 0) ?? '';
};

const resolveLatestPiModelFinalText = (trace: ForgeModelRequestTrace): string => {
    const traces = trace.piModelTraces ?? [];
    for (let index = traces.length - 1; index >= 0; index -= 1) {
        const finalText = traces[index]?.finalText;
        if (typeof finalText === 'string' && finalText.trim()) return finalText;
    }
    return '';
};

const resolveLatestAssistantText = (sessionTree: ForgePiTreeNode[]): string => {
    const flattened = flattenTree(sessionTree);
    for (const node of flattened.reverse()) {
        if (node.kind !== 'assistant') continue;
        const text = resolveAssistantPayloadText(node.payload);
        if (text.trim()) return text;
        if (node.summary.trim()) return node.summary;
    }
    return '';
};

const flattenTree = (nodes: ForgePiTreeNode[]): ForgePiTreeNode[] => {
    const result: ForgePiTreeNode[] = [];
    const visit = (node: ForgePiTreeNode): void => {
        result.push(node);
        for (const child of node.children ?? []) {
            visit(child);
        }
    };
    for (const node of nodes) visit(node);
    return result;
};

const resolveAssistantPayloadText = (payload: unknown): string => {
    if (!isRecord(payload)) return '';
    if (typeof payload.text === 'string') return payload.text;
    const agentMessage = payload.agentMessage;
    if (!isRecord(agentMessage) || agentMessage.role !== 'assistant') return '';
    const content = agentMessage.content;
    if (!Array.isArray(content)) return '';
    return content
        .map(part => isRecord(part) && part.type === 'text' && typeof part.text === 'string' ? part.text : '')
        .join('');
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};
