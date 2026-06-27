import type { ForgeWorkspaceSessionRef } from '../../../types/SessionTypes.js';

export type ForgeProjectCenterRowKind = 'project' | 'thread';

export interface ForgeProjectCenterRow {
    id: string;
    sessionId: string;
    projectId: string;
    kind: ForgeProjectCenterRowKind;
    title: string;
    timeLabel: string;
    metaLabel: string;
    selected: boolean;
    expanded: boolean;
    updatedAt: number;
    threads: ForgeProjectCenterRow[];
}

export interface ForgeProjectCenterRowsInput {
    projects: ForgeWorkspaceSessionRef[];
    getThreads: (projectId: string) => ForgeWorkspaceSessionRef[];
    selectedProjectId: string | null;
    activeThreadId: string | null;
    now?: number;
}

export type ForgeProjectCenterMenuAction =
    | 'create-thread'
    | 'pin-project'
    | 'open-resource-manager'
    | 'create-permanent-worktree'
    | 'rename-project'
    | 'archive-conversation'
    | 'remove-project'
    | 'open-thread'
    | 'rename-thread'
    | 'remove-thread';

export interface ForgeProjectCenterMenuItem {
    id: ForgeProjectCenterMenuAction;
    label: string;
    disabled: boolean;
    disabledTitle?: string;
}

const unavailableTitle = '当前版本尚未接入此能力';

export const resolveForgeProjectId = (session: ForgeWorkspaceSessionRef): string =>
    session.forgeProjectId || session.id;

export const buildForgeProjectCenterRows = (input: ForgeProjectCenterRowsInput): ForgeProjectCenterRow[] => {
    const now = input.now ?? Date.now();
    return input.projects.flatMap((project) => {
        const projectId = resolveForgeProjectId(project);
        const expanded = projectId === input.selectedProjectId;
        const threads: ForgeProjectCenterRow[] = expanded
            ? input.getThreads(projectId).map((thread) => ({
                id: thread.id,
                sessionId: thread.id,
                projectId,
                kind: 'thread' as const,
                title: thread.title,
                timeLabel: formatForgeProjectCenterTime(thread.updatedAt, now),
                metaLabel: `${thread.messageCount} nodes`,
                selected: thread.id === input.activeThreadId,
                expanded: false,
                updatedAt: thread.updatedAt,
                threads: []
            }))
            : [];
        return {
            id: projectId,
            sessionId: project.id,
            projectId,
            kind: 'project',
            title: project.projectTitle || project.title,
            timeLabel: formatForgeProjectCenterTime(project.updatedAt, now),
            metaLabel: `${input.getThreads(projectId).length} threads`,
            selected: expanded,
            expanded,
            updatedAt: project.updatedAt,
            threads
        };
    });
};

export const buildForgeProjectCenterMenu = (kind: ForgeProjectCenterRowKind): ForgeProjectCenterMenuItem[] => {
    if (kind === 'thread') {
        return [
            { id: 'open-thread', label: '打开对话', disabled: false },
            { id: 'rename-thread', label: '重命名对话', disabled: false },
            { id: 'archive-conversation', label: '归档对话', disabled: true, disabledTitle: unavailableTitle },
            { id: 'remove-thread', label: '移除', disabled: false }
        ];
    }

    return [
        { id: 'create-thread', label: '新建对话', disabled: false },
        { id: 'pin-project', label: '置顶项目', disabled: true, disabledTitle: unavailableTitle },
        { id: 'open-resource-manager', label: '在资源管理器中打开', disabled: true, disabledTitle: unavailableTitle },
        { id: 'create-permanent-worktree', label: '创建永久工作树', disabled: true, disabledTitle: unavailableTitle },
        { id: 'rename-project', label: '重命名项目', disabled: false },
        { id: 'archive-conversation', label: '归档对话', disabled: true, disabledTitle: unavailableTitle },
        { id: 'remove-project', label: '移除', disabled: false }
    ];
};

export const formatForgeProjectCenterTime = (timestamp: number, now: number = Date.now()): string => {
    const delta = Math.max(0, now - timestamp);
    const minute = 60_000;
    const hour = 60 * minute;
    const day = 24 * hour;
    const week = 7 * day;

    if (delta < minute) return '刚刚';
    if (delta < 10 * minute) return '最近';
    if (delta < hour) return `${Math.max(1, Math.floor(delta / minute))}分钟`;
    if (delta < day) return `${Math.max(1, Math.floor(delta / hour))}小时`;
    if (delta < 6 * day) return `${Math.max(1, Math.floor(delta / day))}天`;
    return `${Math.max(1, Math.round(delta / week))}周`;
};
