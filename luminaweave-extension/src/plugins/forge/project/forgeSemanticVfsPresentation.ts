import type {
    ForgePiContextBundleSummary,
    ForgePiMessagePayload,
    ForgePiSessionEntry
} from '@shared/ForgePiTypes.js';

export type ForgeSemanticVfsNodeKind = 'directory' | 'file' | 'alias' | 'resource-root';
export type ForgeSemanticVfsSource = 'virtual' | 'context' | 'session' | 'workspace' | 'resource';
export type ForgeSemanticVfsWritePolicy = 'read-only' | 'protected' | 'direct-write' | 'pass-through';

export interface ForgeSemanticVfsNode {
    path: string;
    label: string;
    kind: ForgeSemanticVfsNodeKind;
    source: ForgeSemanticVfsSource;
    writePolicy: ForgeSemanticVfsWritePolicy;
    preview: string;
    content: string | null;
    depth: number;
    children: ForgeSemanticVfsNode[];
}

export interface ForgeSemanticVfsTreeInput {
    contextBundle: ForgePiContextBundleSummary | null;
    sessionEntries: ForgePiSessionEntry[];
    activeNodeId: string | null;
    projectFiles?: ForgeSemanticVfsProjectEntry[];
    includeAgentVirtualFiles?: boolean;
    includeSessionProjection?: boolean;
}

export interface ForgeSemanticVfsProjectEntry {
    path: string;
    kind?: 'directory' | 'file';
    content: string | null;
    source?: ForgeSemanticVfsSource;
    writePolicy?: ForgeSemanticVfsWritePolicy;
}

export interface ForgeProjectVfsPanelTreeInput {
    sessionEntries: ForgePiSessionEntry[];
    activeNodeId: string | null;
    projectFiles: ForgeSemanticVfsProjectEntry[];
    contextBundle?: ForgePiContextBundleSummary | null;
}

interface SemanticFileSeed {
    path: string;
    label?: string;
    kind?: ForgeSemanticVfsNodeKind;
    source: ForgeSemanticVfsSource;
    writePolicy: ForgeSemanticVfsWritePolicy;
    preview: string;
    content?: string | null;
}

const DEFAULT_PROMPT_FILES = [
    './.forge/agent/UI_DSL.md',
    './.forge/agent/REASONING.md',
    './.forge/agent/PLANNER.md',
    './.forge/agent/CONVERSATION.md',
    './.forge/agent/ANALYST.md',
    './.forge/agent/EXECUTOR.md'
];

const MANAGED_AGENT_PROMPT_PATH_PATTERN = /^\.\/\.forge\/agent\/(?:SYSTEM|PLANNER|CONVERSATION|ANALYST|EXECUTOR)\.md$/;
const MANAGED_AGENT_SKILL_PATH_PATTERN = /^\.\/agent\/skills\/[a-z0-9][a-z0-9-]*\/SKILL\.md$/;

const normalizeForgeProjectPath = (path: string): string => {
    const normalized = path.trim().replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
    if (!normalized || normalized === '.') return './';
    if (normalized.startsWith('./')) return normalized;
    if (normalized.startsWith('/')) return normalized;
    return `./${normalized}`;
};

export const isForgeAgentResourceOverridePath = (path: string): boolean => {
    const normalized = normalizeForgeProjectPath(path);
    return normalized === './AGENTS.md'
        || MANAGED_AGENT_PROMPT_PATH_PATTERN.test(normalized)
        || MANAGED_AGENT_SKILL_PATH_PATTERN.test(normalized);
};

const DEFAULT_FILE_SEEDS: SemanticFileSeed[] = [
    {
        path: './AGENTS.md',
        source: 'virtual',
        writePolicy: 'protected',
        preview: 'Forge Agent 工作契约'
    },
    {
        path: './.forge/agent/SYSTEM.md',
        source: 'virtual',
        writePolicy: 'protected',
        preview: 'Forge 默认系统提示词'
    },
    ...DEFAULT_PROMPT_FILES.map(path => ({
        path,
        source: 'virtual' as const,
        writePolicy: 'protected' as const,
        preview: 'Forge mode prompt'
    })),
    {
        path: './memory/AUTO/Checklist.md',
        source: 'virtual',
        writePolicy: 'direct-write',
        preview: '自动维护的制卡检查清单'
    },
    {
        path: './memory/用户偏好.md',
        source: 'virtual',
        writePolicy: 'direct-write',
        preview: '用户偏好和约束记忆'
    },
    {
        path: './threads/目前/messages.md',
        source: 'virtual',
        writePolicy: 'read-only',
        preview: '当前协作线程消息别名'
    },
    {
        path: './lorebook/',
        source: 'virtual',
        writePolicy: 'direct-write',
        preview: '虚拟世界书项目视图'
    },
    {
        path: '/library/',
        source: 'resource',
        writePolicy: 'pass-through',
        preview: '底层 Resource VFS library 直通入口'
    },
    {
        path: '/sources/',
        source: 'resource',
        writePolicy: 'pass-through',
        preview: '底层 Resource VFS sources 直通入口'
    }
];

export const buildForgeSemanticVfsTree = (input: ForgeSemanticVfsTreeInput): ForgeSemanticVfsNode[] => {
    const includeAgentVirtualFiles = input.includeAgentVirtualFiles ?? true;
    const includeSessionProjection = input.includeSessionProjection ?? includeAgentVirtualFiles;
    const roots = createBaseRoots(includeAgentVirtualFiles);
    [
        ...(includeAgentVirtualFiles ? DEFAULT_FILE_SEEDS : []),
        ...(includeAgentVirtualFiles ? contextFileSeeds(input.contextBundle) : []),
        ...(includeAgentVirtualFiles ? skillFileSeeds(input.contextBundle) : []),
        ...(includeSessionProjection ? sessionFileSeeds(input) : []),
        ...projectFileSeeds(input.projectFiles ?? [])
    ]
        .forEach(seed => upsertSemanticPath(roots, normalizeSemanticPath(seed.path), seed));
    return withDirectoryContents(sortSemanticNodes(roots));
};

export const buildForgeProjectVfsPanelTree = (input: ForgeProjectVfsPanelTreeInput): ForgeSemanticVfsNode[] =>
    buildForgeSemanticVfsTree({
        contextBundle: input.contextBundle ?? null,
        sessionEntries: input.sessionEntries,
        activeNodeId: input.activeNodeId,
        includeAgentVirtualFiles: false,
        includeSessionProjection: true,
        projectFiles: input.projectFiles
    });

export const flattenForgeSemanticVfsTree = (nodes: ForgeSemanticVfsNode[]): ForgeSemanticVfsNode[] =>
    nodes.flatMap(node => [node, ...flattenForgeSemanticVfsTree(node.children)]);

const createBaseRoots = (includeResourceRoots: boolean): ForgeSemanticVfsNode[] => [
    createNode('./', './', 'directory', 'virtual', 'direct-write', 'Forge 项目语义根', 0),
    ...(includeResourceRoots ? [
        createNode('/library/', '/library', 'resource-root', 'resource', 'pass-through', '底层 Resource VFS library', 0),
        createNode('/sources/', '/sources', 'resource-root', 'resource', 'pass-through', '底层 Resource VFS sources', 0)
    ] : [])
];

const createNode = (
    path: string,
    label: string,
    kind: ForgeSemanticVfsNodeKind,
    source: ForgeSemanticVfsSource,
    writePolicy: ForgeSemanticVfsWritePolicy,
    preview: string,
    depth: number
): ForgeSemanticVfsNode => ({
    path,
    label,
    kind,
    source,
    writePolicy,
    preview,
    content: preview || null,
    depth,
    children: []
});

const contextFileSeeds = (contextBundle: ForgePiContextBundleSummary | null): SemanticFileSeed[] =>
    (contextBundle?.files ?? []).map(file => ({
        path: file.path,
        source: 'context',
        writePolicy: inferWritePolicy(file.path),
        preview: compactPreview(file.content),
        content: file.content
    }));

const projectFileSeeds = (files: ForgeSemanticVfsProjectEntry[]): SemanticFileSeed[] =>
    files.map(file => ({
        path: normalizeProjectEntryPath(file),
        kind: file.kind === 'directory' ? 'directory' : 'file',
        source: file.source ?? 'workspace',
        writePolicy: file.writePolicy ?? 'direct-write',
        preview: file.kind === 'directory' ? '目录' : compactPreview(file.content ?? ''),
        content: file.content
    }));

const skillFileSeeds = (contextBundle: ForgePiContextBundleSummary | null): SemanticFileSeed[] =>
    (contextBundle?.activeSkills ?? []).map(skillName => ({
        path: `./agent/skills/${skillName}/SKILL.md`,
        source: 'context',
        writePolicy: 'protected',
        preview: `已加载技能：${skillName}`
    }));

const sessionFileSeeds = (input: ForgeSemanticVfsTreeInput): SemanticFileSeed[] => {
    const branchIds = resolveBranchIds(input.sessionEntries, input.activeNodeId);
    const seeds: SemanticFileSeed[] = [];
    input.sessionEntries.forEach((entry) => {
        if (branchIds && !branchIds.has(entry.id)) return;
        if (entry.kind === 'user' || entry.kind === 'assistant') {
            const message = isMessagePayload(entry.payload) ? entry.payload.text ?? entry.summary : entry.summary;
            seeds.push({
                path: `./threads/目前/nodes/${entry.id}.md`,
                label: entry.kind === 'user' ? 'User' : 'Assistant',
                source: 'session',
                writePolicy: 'read-only',
                preview: compactPreview(message),
                content: message
            });
        }
    });
    return seeds;
};

const upsertSemanticPath = (
    roots: ForgeSemanticVfsNode[],
    path: string,
    seed: SemanticFileSeed
): void => {
    if (path === './' || path === '/library/' || path === '/sources/') {
        const node = roots.find(root => root.path === path);
        if (node) applySeed(node, seed);
        return;
    }

    const root = path.startsWith('./')
        ? roots.find(node => node.path === './')
        : path.startsWith('/library/')
            ? roots.find(node => node.path === '/library/')
            : path.startsWith('/sources/')
                ? roots.find(node => node.path === '/sources/')
                : null;
    if (!root) return;

    const parts = splitPathParts(path);
    let current = root;
    parts.forEach((part, index) => {
        const isLast = index === parts.length - 1;
        const nodePath = buildChildPath(root.path, parts.slice(0, index + 1), isLast ? path.endsWith('/') : true);
        let child = current.children.find(candidate => candidate.path === nodePath);
        if (!child) {
            child = createNode(
                nodePath,
                part,
                isLast && !path.endsWith('/') ? 'file' : inferDirectoryKind(nodePath),
                seed.source,
                seed.writePolicy,
                '',
                current.depth + 1
            );
            current.children.push(child);
        }
        if (isLast) applySeed(child, seed);
        current = child;
    });
};

const applySeed = (node: ForgeSemanticVfsNode, seed: SemanticFileSeed): void => {
    if (seed.label) node.label = seed.label;
    node.source = seed.source;
    node.writePolicy = seed.writePolicy;
    node.preview = seed.preview;
    node.content = seed.content !== undefined ? seed.content : (seed.preview || null);
    node.kind = seed.kind
        ? seed.kind
        : seed.path.endsWith('/')
        ? inferDirectoryKind(node.path)
        : node.kind === 'directory' || node.kind === 'alias'
            ? 'file'
            : node.kind;
};

const sortSemanticNodes = (nodes: ForgeSemanticVfsNode[]): ForgeSemanticVfsNode[] =>
    [...nodes]
        .sort((left, right) => nodeSortKey(left).localeCompare(nodeSortKey(right), 'zh-Hans-CN'))
        .map(node => ({ ...node, children: sortSemanticNodes(node.children) }));

const withDirectoryContents = (nodes: ForgeSemanticVfsNode[]): ForgeSemanticVfsNode[] =>
    nodes.map((node) => {
        const children = withDirectoryContents(node.children);
        if (node.kind !== 'directory' && node.kind !== 'alias' && node.kind !== 'resource-root') {
            return { ...node, children };
        }
        const content = children.length > 0
            ? children.map(child => `${directoryChildKindLabel(child.kind)} ${child.path}`).join('\n')
            : '空目录';
        return {
            ...node,
            children,
            content,
            preview: node.preview || content
        };
    });

const directoryChildKindLabel = (kind: ForgeSemanticVfsNodeKind): string => {
    if (kind === 'file') return 'file';
    if (kind === 'resource-root') return 'root';
    if (kind === 'alias') return 'alias';
    return 'dir';
};

const nodeSortKey = (node: ForgeSemanticVfsNode): string => {
    if (node.path === './') return '0';
    if (node.path === '/library/') return '8';
    if (node.path === '/sources/') return '9';
    return `${node.kind === 'file' ? '2' : '1'}:${node.label}`;
};

const splitPathParts = (path: string): string[] => {
    if (path.startsWith('./')) return path.slice(2).split('/').filter(Boolean);
    if (path.startsWith('/library/')) return path.slice('/library/'.length).split('/').filter(Boolean);
    if (path.startsWith('/sources/')) return path.slice('/sources/'.length).split('/').filter(Boolean);
    return [];
};

const buildChildPath = (rootPath: string, parts: string[], directory: boolean): string => {
    const body = parts.join('/');
    if (rootPath === './') return `./${body}${directory ? '/' : ''}`;
    return `${rootPath}${body}${directory ? '/' : ''}`;
};

const normalizeSemanticPath = (path: string): string => {
    const normalized = path.replaceAll('\\', '/').replace(/\/+/g, '/');
    if (normalized === '.' || normalized === './') return './';
    if (normalized.startsWith('./')) return normalized;
    if (normalized.startsWith('/library/') || normalized === '/library') {
        return normalized === '/library' ? '/library/' : normalized;
    }
    if (normalized.startsWith('/sources/') || normalized === '/sources') {
        return normalized === '/sources' ? '/sources/' : normalized;
    }
    return `./${normalized.replace(/^\//, '')}`;
};

const normalizeProjectEntryPath = (entry: ForgeSemanticVfsProjectEntry): string => {
    const normalized = normalizeSemanticPath(entry.path);
    if (entry.kind !== 'directory') return normalized.replace(/\/$/, '');
    return normalized.endsWith('/') ? normalized : `${normalized}/`;
};

const inferWritePolicy = (path: string): ForgeSemanticVfsWritePolicy => {
    if (path.startsWith('/library/') || path.startsWith('/sources/')) return 'pass-through';
    if (path.startsWith('./threads/')) return 'read-only';
    return path.startsWith('./.forge/') || path.startsWith('./agent/skills/') || path === './AGENTS.md'
        ? 'protected'
        : 'direct-write';
};

const inferDirectoryKind = (path: string): ForgeSemanticVfsNodeKind =>
    path === './threads/目前/' ? 'alias' : path === '/library/' || path === '/sources/' ? 'resource-root' : 'directory';

const compactPreview = (value: string): string => {
    const text = value.replace(/\s+/g, ' ').trim();
    return text.length > 120 ? `${text.slice(0, 117)}...` : text;
};

const resolveBranchIds = (entries: ForgePiSessionEntry[], activeNodeId: string | null): Set<string> | null => {
    if (!activeNodeId) return null;
    const byId = new Map(entries.map(entry => [entry.id, entry]));
    const ids = new Set<string>();
    let current = byId.get(activeNodeId);
    while (current) {
        ids.add(current.id);
        current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return ids;
};

const isMessagePayload = (value: unknown): value is ForgePiMessagePayload =>
    isRecord(value)
    && (value.role === 'user' || value.role === 'assistant' || value.role === 'system' || value.role === 'toolResult')
    && (typeof value.text === 'string' || value.text === undefined);

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;
