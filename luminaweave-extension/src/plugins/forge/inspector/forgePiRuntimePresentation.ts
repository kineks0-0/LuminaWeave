import type {
    ForgePiContextBundleSummary,
    ForgePiTreeNode
} from '@shared/ForgePiTypes.js';

export interface ForgePiRuntimePresentationInput {
    contextBundleSummary: ForgePiContextBundleSummary | null;
    tree: ForgePiTreeNode[];
    activeNodeId: string | null;
    loadedSkills: string[];
    loadedExtensions: string[];
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

    return {
        hasState: contextFiles.length > 0 || rows.length > 0 || skills.length > 0 || extensions.length > 0,
        contextFiles,
        activeNode,
        treeRows: rows,
        skills,
        extensions
    };
};

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
