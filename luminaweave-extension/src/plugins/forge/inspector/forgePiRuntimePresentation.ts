import type {
    ForgePiContextBundleSummary,
    ForgePiTreeNode
} from '@shared/ForgePiTypes.js';
import type {
    AgentRuntimeMessage,
    AgentRuntimePendingToolCall,
    AgentRuntimeSnapshot
} from '../../../api/core/agent-runtime/events/AgentRuntimeEventBus.js';

export interface ForgePiRuntimePresentationInput {
    contextBundleSummary: ForgePiContextBundleSummary | null;
    tree: ForgePiTreeNode[];
    activeNodeId: string | null;
    loadedSkills: string[];
    loadedExtensions: string[];
    agentRuntimeSnapshot?: AgentRuntimeSnapshot | null;
}

export interface ForgePiRuntimeContextFilePresentation {
    path: string;
    title: string;
    preview: string;
    size: number;
}

export interface ForgePiRuntimeTreeRow {
    id: string;
    parentId: string | null;
    kind: ForgePiTreeNode['kind'];
    title: string;
    summary: string;
    createdAt: number;
    depth: number;
    active: boolean;
}

export interface ForgePiRuntimePresentation {
    hasState: boolean;
    contextFiles: ForgePiRuntimeContextFilePresentation[];
    activeNode: ForgePiRuntimeTreeRow | null;
    treeRows: ForgePiRuntimeTreeRow[];
    skills: string[];
    extensions: string[];
    runtime: ForgePiRuntimeSnapshotPresentation | null;
}

export interface ForgePiRuntimeMessagePresentation {
    id: string;
    role: AgentRuntimeMessage['role'];
    status: AgentRuntimeMessage['status'] | null;
    blockCount: number;
    preview: string;
}

export interface ForgePiRuntimePendingToolPresentation {
    toolCallId: string;
    toolName: string;
    argsPreview: string;
    updateCount: number;
}

export interface ForgePiRuntimeActiveToolPresentation {
    name: string;
    description: string;
    approvalLabel: string;
}

export interface ForgePiRuntimeSnapshotPresentation {
    isStreaming: boolean;
    messageCount: number;
    pendingToolCount: number;
    activeToolCount: number;
    errorMessage: string | null;
    queueLabel: string | null;
    messages: ForgePiRuntimeMessagePresentation[];
    pendingToolCalls: ForgePiRuntimePendingToolPresentation[];
    activeTools: ForgePiRuntimeActiveToolPresentation[];
}

export interface ForgePiSkillComparison {
    shared: string[];
    graphOnly: string[];
    piOnly: string[];
}

const trimPreview = (content: string, maxLength = 160): string => {
    const normalized = content.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, maxLength)}...`;
};

const stringifyPreview = (value: unknown, maxLength = 320): string => {
    if (typeof value === 'string') return trimPreview(value, maxLength);
    try {
        return trimPreview(JSON.stringify(value, null, 2), maxLength);
    } catch {
        return '[unserializable]';
    }
};

const uniqueStable = (values: string[]): string[] => Array.from(new Set(values.filter(Boolean)));

export const buildForgePiSkillComparison = (
    graphSuggestedSkills: string[],
    piLoadedSkills: string[]
): ForgePiSkillComparison => {
    const graph = uniqueStable(graphSuggestedSkills);
    const pi = uniqueStable(piLoadedSkills);
    return {
        shared: graph.filter(skill => pi.includes(skill)),
        graphOnly: graph.filter(skill => !pi.includes(skill)),
        piOnly: pi.filter(skill => !graph.includes(skill))
    };
};

export const buildForgePiRuntimePresentation = (input: ForgePiRuntimePresentationInput): ForgePiRuntimePresentation => {
    const contextFiles = (input.contextBundleSummary?.files ?? []).map(file => ({
        path: file.path,
        title: file.title,
        preview: trimPreview(file.content),
        size: file.content.length
    }));
    const rows = buildTreeRows(input.tree, input.activeNodeId);
    const activeNode = rows.find(row => row.active) ?? null;
    const skills = uniqueStable([
        ...input.loadedSkills,
        ...(input.contextBundleSummary?.activeSkills ?? [])
    ]);
    const extensions = uniqueStable([
        ...input.loadedExtensions,
        ...(input.contextBundleSummary?.loadedExtensions ?? [])
    ]);
    const runtime = input.agentRuntimeSnapshot
        ? buildRuntimeSnapshotPresentation(input.agentRuntimeSnapshot)
        : null;

    return {
        hasState: contextFiles.length > 0
            || rows.length > 0
            || skills.length > 0
            || extensions.length > 0
            || Boolean(runtime),
        contextFiles,
        activeNode,
        treeRows: rows,
        skills,
        extensions,
        runtime
    };
};

const buildRuntimeSnapshotPresentation = (snapshot: AgentRuntimeSnapshot): ForgePiRuntimeSnapshotPresentation => ({
    isStreaming: snapshot.isStreaming,
    messageCount: snapshot.messages.length,
    pendingToolCount: snapshot.pendingToolCalls.length,
    activeToolCount: snapshot.activeTools.length,
    errorMessage: snapshot.errorMessage ?? null,
    queueLabel: snapshot.queue
        ? `${snapshot.queue.queuedTurns} queued${snapshot.queue.activeTurnId ? ` · active ${snapshot.queue.activeTurnId}` : ''}`
        : null,
    messages: snapshot.messages.map(buildRuntimeMessagePresentation),
    pendingToolCalls: snapshot.pendingToolCalls.map(buildPendingToolPresentation),
    activeTools: snapshot.activeTools.map(tool => ({
        name: tool.name,
        description: tool.description,
        approvalLabel: tool.needsApproval === 'dynamic'
            ? 'dynamic approval'
            : tool.needsApproval ? 'approval required' : 'no approval'
    }))
});

const buildRuntimeMessagePresentation = (message: AgentRuntimeMessage): ForgePiRuntimeMessagePresentation => ({
    id: message.id,
    role: message.role,
    status: message.status ?? null,
    blockCount: message.blocks.length,
    preview: trimPreview(message.blocks
        .map(block => typeof block.text === 'string' ? block.text : '')
        .filter(Boolean)
        .join(' '))
});

const buildPendingToolPresentation = (toolCall: AgentRuntimePendingToolCall): ForgePiRuntimePendingToolPresentation => ({
    toolCallId: toolCall.toolCallId,
    toolName: toolCall.toolName,
    argsPreview: stringifyPreview(toolCall.args),
    updateCount: toolCall.updates.length
});

const buildTreeRows = (tree: ForgePiTreeNode[], activeNodeId: string | null): ForgePiRuntimeTreeRow[] => {
    const byParent = new Map<string | null, ForgePiTreeNode[]>();
    for (const node of tree) {
        const siblings = byParent.get(node.parentId) ?? [];
        siblings.push(node);
        byParent.set(node.parentId, siblings);
    }
    for (const siblings of byParent.values()) {
        siblings.sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id));
    }

    const rows: ForgePiRuntimeTreeRow[] = [];
    const visited = new Set<string>();
    const visit = (node: ForgePiTreeNode, depth: number) => {
        if (visited.has(node.id)) return;
        visited.add(node.id);
        rows.push({
            id: node.id,
            parentId: node.parentId,
            kind: node.kind,
            title: node.title,
            summary: node.summary,
            createdAt: node.createdAt,
            depth,
            active: node.id === activeNodeId
        });
        for (const child of byParent.get(node.id) ?? []) {
            visit(child, depth + 1);
        }
    };

    for (const root of byParent.get(null) ?? []) {
        visit(root, 0);
    }
    for (const node of tree) {
        visit(node, 0);
    }
    return rows;
};
