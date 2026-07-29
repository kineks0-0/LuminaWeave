import {
    forgeThreadWorkspacePath,
    forgeWorkspacePath
} from '../../../hal/shell/ShellWorkspaceService.js';

export type ForgeSemanticPathResolution =
    | {
        kind: 'virtual';
        inputPath: string;
        displayPath: string;
    }
    | {
        kind: 'workspace';
        inputPath: string;
        displayPath: string;
        workspacePath: string;
    }
    | {
        kind: 'resource-vfs';
        inputPath: string;
        displayPath: string;
        resourcePath: string;
    };

export interface ForgeSemanticPathContext {
    path: string;
    forgeProjectId: string;
    conversationId: string;
    threadTitle?: string | null;
    stableThreads?: ForgeSemanticThreadEntry[];
}

export interface ForgeSemanticThreadEntry {
    label: string;
    conversationId: string;
}

const RESOURCE_ROOT_PATTERN = /^\/(?:sources|library)(?:\/|$)/;

const escapeRegExp = (value: string): string =>
    value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeAbsolutePath = (path: string): string =>
    `/${path || ''}`.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '') || '/';

const normalizeAgentRelativePath = (path: string): string => {
    const normalized = path.trim().replace(/\\/g, '/').replace(/\/+/g, '/');
    if (!normalized || normalized === '.') return './';
    if (normalized.startsWith('./')) return normalized.replace(/\/$/, '') || './';
    return `./${normalized.replace(/^\//, '')}`.replace(/\/$/, '') || './';
};

const relativeToWorkspace = (path: string): string => {
    const normalized = normalizeAgentRelativePath(path);
    return normalized === './' ? '' : normalized.slice(2);
};

const VIRTUAL_FILE_PATHS = new Set([
    './AGENTS.md',
    './.forge/agent/SYSTEM.md',
    './.forge/agent/EXECUTOR.md',
    './.forge/agent/UI_DSL.md',
    './.forge/agent/REASONING.md'
]);

export const buildForgeStableThreadLabel = (index: number, title: string): string => {
    const prefix = String(index + 1).padStart(2, '0');
    const cleanTitle = title
        .trim()
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/\s+/g, '')
        .slice(0, 40);
    return `${prefix}${cleanTitle || '协作线程'}`;
};

export class ForgeSemanticVfsMapper {
    resolveAgentPath(input: ForgeSemanticPathContext): ForgeSemanticPathResolution {
        const rawPath = input.path.trim();
        if (RESOURCE_ROOT_PATTERN.test(rawPath)) {
            const resourcePath = normalizeAbsolutePath(rawPath);
            return {
                kind: 'resource-vfs',
                inputPath: rawPath,
                displayPath: resourcePath,
                resourcePath
            };
        }

        const projectRoot = forgeWorkspacePath(input.forgeProjectId);
        const currentThreadRoot = forgeThreadWorkspacePath(input.forgeProjectId, input.conversationId);
        const displayPath = normalizeAgentRelativePath(rawPath);
        const relative = relativeToWorkspace(displayPath);
        const currentThreadPrefix = 'threads/目前';

        if (VIRTUAL_FILE_PATHS.has(displayPath)) {
            return {
                kind: 'virtual',
                inputPath: rawPath,
                displayPath
            };
        }

        if (relative === currentThreadPrefix || relative.startsWith(`${currentThreadPrefix}/`)) {
            const suffix = relative.slice(currentThreadPrefix.length).replace(/^\//, '');
            return {
                kind: 'workspace',
                inputPath: rawPath,
                displayPath,
                workspacePath: suffix ? `${currentThreadRoot}/${suffix}` : currentThreadRoot
            };
        }

        const stableThread = input.stableThreads?.find(thread => {
            const prefix = `threads/${thread.label}`;
            return relative === prefix || relative.startsWith(`${prefix}/`);
        });
        if (stableThread) {
            const prefix = `threads/${stableThread.label}`;
            const suffix = relative.slice(prefix.length).replace(/^\//, '');
            const threadRoot = forgeThreadWorkspacePath(input.forgeProjectId, stableThread.conversationId);
            return {
                kind: 'workspace',
                inputPath: rawPath,
                displayPath,
                workspacePath: suffix ? `${threadRoot}/${suffix}` : threadRoot
            };
        }

        return {
            kind: 'workspace',
            inputPath: rawPath,
            displayPath,
            workspacePath: relative ? `${projectRoot}/${relative}` : projectRoot
        };
    }

    toAgentDisplayPath(input: ForgeSemanticPathContext): string {
        const rawPath = input.path.trim();
        if (RESOURCE_ROOT_PATTERN.test(rawPath)) {
            return normalizeAbsolutePath(rawPath);
        }

        const normalized = normalizeAbsolutePath(rawPath);
        const currentThreadRoot = forgeThreadWorkspacePath(input.forgeProjectId, input.conversationId);
        if (normalized === currentThreadRoot || normalized.startsWith(`${currentThreadRoot}/`)) {
            const suffix = normalized.slice(currentThreadRoot.length).replace(/^\//, '');
            return suffix ? `./threads/目前/${suffix}` : './threads/目前';
        }

        const projectRoot = forgeWorkspacePath(input.forgeProjectId);
        if (normalized === projectRoot || normalized.startsWith(`${projectRoot}/`)) {
            const suffix = normalized.slice(projectRoot.length).replace(/^\//, '');
            return suffix ? `./${suffix}` : './';
        }

        return normalizeAgentRelativePath(rawPath);
    }

    rewriteCommandToWorkspace(input: {
        command: string;
        forgeProjectId: string;
        conversationId: string;
        stableThreads?: ForgeSemanticThreadEntry[];
    }): string {
        const projectRoot = forgeWorkspacePath(input.forgeProjectId);
        const currentThreadRoot = forgeThreadWorkspacePath(input.forgeProjectId, input.conversationId);
        let command = input.command
            .replace(/(^|[\s"'(])\.\/threads\/目前(?=\/|\s|$)/g, `$1${currentThreadRoot}`);
        for (const thread of input.stableThreads ?? []) {
            const escaped = thread.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const threadRoot = forgeThreadWorkspacePath(input.forgeProjectId, thread.conversationId);
            command = command.replace(new RegExp(`(^|[\\s"'(])\\.\\/threads\\/${escaped}(?=\\/|\\s|$)`, 'g'), `$1${threadRoot}`);
        }
        return command
            .replace(/(^|[\s"'(])\.\/(?=[^\s"'()|;&<>]+)/g, `$1${projectRoot}/`);
    }

    rewriteTextToAgentDisplay(input: {
        text: string;
        forgeProjectId: string;
        conversationId: string;
        stableThreads?: ForgeSemanticThreadEntry[];
    }): string {
        const currentThreadRoot = forgeThreadWorkspacePath(input.forgeProjectId, input.conversationId);
        const projectRoot = forgeWorkspacePath(input.forgeProjectId);
        const currentConversationId = escapeRegExp(input.conversationId);
        let text = input.text
            .split(currentThreadRoot).join('./threads/目前')
            .split(projectRoot).join('.');
        text = text
            .replace(new RegExp(`(^|[\\s"'(])\\.\\/chat\\/${currentConversationId}(?=\\/|\\s|$)`, 'g'), '$1./threads/目前')
            .replace(new RegExp(`(^|[\\s"'(])chat\\/${currentConversationId}(?=\\/|\\s|$)`, 'g'), '$1./threads/目前');
        for (const thread of input.stableThreads ?? []) {
            const conversationId = escapeRegExp(thread.conversationId);
            text = text
                .replace(new RegExp(`(^|[\\s"'(])\\.\\/chat\\/${conversationId}(?=\\/|\\s|$)`, 'g'), `$1./threads/${thread.label}`)
                .replace(new RegExp(`(^|[\\s"'(])chat\\/${conversationId}(?=\\/|\\s|$)`, 'g'), `$1./threads/${thread.label}`);
        }
        return text;
    }
}

export const forgeSemanticVfsMapper = new ForgeSemanticVfsMapper();
