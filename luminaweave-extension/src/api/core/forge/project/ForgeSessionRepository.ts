import { useForgeStore } from '../../../../stores/useForgeStore.js';
import type { ForgeWorkspaceSession, ForgeWorkspaceSessionRef } from '../../../../types/SessionTypes.js';
import { API_BASE, API_ROUTES } from '@shared/ApiEndpoints.js';
import {
    cloneForgeMemoryTree,
    cloneDraftTree,
    cloneStructuredState,
    createEmptyForgeMemoryTree,
    createEmptyDraftTree,
    createEmptyStructuredState
} from '../../utils/forgeStateDefaults.js';
import { HALContext } from '../../hal/HALContext.js';
import type { ConversationDocument } from '@shared/ConversationTypes.js';
import { migrateLegacyForgeSession } from '@shared/ConversationMigration.js';
import {
    forgeThreadWorkspacePath,
    resolveForgeConversationId,
    resolveForgeProjectId,
    shellWorkspaceService
} from '../../hal/shell/ShellWorkspaceService.js';
import { forgeProjectDataService } from './ForgeProjectDataService.js';

const STORAGE_KEY = 'lumina-forge.workspace-sessions';
const ACTIVE_KEY = 'lumina-forge.active-session-id';

const generateSessionChatId = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `lw_card_${crypto.randomUUID()}`;
    }
    return `lw_card_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
};

const resolveThreadWorkspacePath = (
    forgeProjectId: string,
    conversationId: string,
    workspacePath?: string | null
): string => (
    workspacePath && workspacePath.includes('/chat/')
        ? workspacePath
        : forgeThreadWorkspacePath(forgeProjectId, conversationId)
);

export class ForgeSessionRepository {
    private conversationToSession(document: ConversationDocument): ForgeWorkspaceSession {
        const forge = document.pluginState.forge || {};
        const forgeProjectId = String(forge.forgeProjectId || document.legacy?.legacyForgeSessionId || document.id);
        const conversationId = String(forge.conversationId || forge.sessionChatId || document.legacy?.legacyChatId || generateSessionChatId());
        return {
            id: document.id,
            forgeProjectId,
            conversationId,
            workspacePath: resolveThreadWorkspacePath(forgeProjectId, conversationId, typeof forge.workspacePath === 'string' ? forge.workspacePath : null),
            projectTitle: typeof forge.projectTitle === 'string' ? forge.projectTitle : undefined,
            sessionChatId: forge.sessionChatId || conversationId,
            title: document.title,
            createdAt: document.createdAt,
            updatedAt: document.updatedAt,
            presetId: forge.presetId || '',
            activeLeafId: document.activeLeafId,
            worldlineNodes: document.nodes || [],
            selectedChatSessionId: forge.selectedChatSessionId || null,
            selectedChatSnapshotId: forge.selectedChatSnapshotId || null,
            draftInput: forge.draftInput || '',
            timelineItems: [],
            piSession: forge.piSession as any,
            stagingEntries: (forge.stagingEntries || []) as any[],
            commitReadyEntries: (forge.commitReadyEntries || []) as any[],
            virtualLorebookEntries: (forge.virtualLorebookEntries || []) as any[],
            importedLorebookId: forge.importedLorebookId || null,
            workflowSnapshot: (forge.workflowSnapshot || null) as any,
            detailMode: (forge.detailMode || null) as any,
            entryMode: (forge.entryMode || null) as any,
            structuredState: cloneStructuredState((forge.structuredState || createEmptyStructuredState()) as any),
            draftTree: cloneDraftTree((forge.draftTree || createEmptyDraftTree()) as any),
            forgeMemoryTree: cloneForgeMemoryTree((forge.forgeMemoryTree || createEmptyForgeMemoryTree()) as any),
            activeLayer: (forge.activeLayer || 'concept') as any,
            completedLayers: (forge.completedLayers || []) as any,
            publishState: (forge.publishState || 'drafting') as any,
            activeAuxPanel: forge.activeAuxPanel as any,
            auxPresentationMode: forge.auxPresentationMode as any,
            worldlineSnapshots: forge.worldlineSnapshots as any,
            workspaceMode: 'workspace'
        };
    }

    private sessionToConversation(session: ForgeWorkspaceSession): ConversationDocument {
        return migrateLegacyForgeSession(this.normalizeProjectFields(session) as any, session.worldlineNodes);
    }

    private pruneOldSessions(sessions: ForgeWorkspaceSession[], count: number = 3): ForgeWorkspaceSession[] {
        if (sessions.length <= count) return sessions;
        const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);
        // 修正：保留最近更新的 count 个，其余的截断
        return sorted.slice(0, count);
    }

    private mergeSessions(primary: ForgeWorkspaceSession[], secondary: ForgeWorkspaceSession[]): ForgeWorkspaceSession[] {
        const merged = new Map<string, ForgeWorkspaceSession>();

        [...secondary, ...primary].forEach((session) => {
            const existing = merged.get(session.id);
            if (!existing || session.updatedAt >= existing.updatedAt) {
                merged.set(session.id, session);
            }
        });

        return Array.from(merged.values()).sort((a, b) => b.updatedAt - a.updatedAt);
    }

    private readLocal(): ForgeWorkspaceSession[] {
        if (typeof localStorage === 'undefined') return [];
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed)
                ? parsed.map((session: Partial<ForgeWorkspaceSession>) => {
                    const id = session.id || `forge_ws_${Date.now().toString(36)}`;
                    const sessionChatId = session.sessionChatId || session.conversationId || generateSessionChatId();
                    const forgeProjectId = session.forgeProjectId || id;
                    return {
                        sessionChatId,
                        id,
                        forgeProjectId,
                        conversationId: session.conversationId || sessionChatId,
                        workspacePath: resolveThreadWorkspacePath(forgeProjectId, session.conversationId || sessionChatId, session.workspacePath),
                        projectTitle: session.projectTitle || session.title || 'Forge Project',
                        title: session.title || 'Forge Project',
                        createdAt: session.createdAt || Date.now(),
                        updatedAt: session.updatedAt || Date.now(),
                        presetId: session.presetId || '',
                        activeLeafId: session.activeLeafId || null,
                        worldlineNodes: session.worldlineNodes || [],
                        selectedChatSessionId: session.selectedChatSessionId || null,
                        selectedChatSnapshotId: session.selectedChatSnapshotId || null,
                        draftInput: session.draftInput || '',
                        timelineItems: session.timelineItems || [],
                        piSession: session.piSession,
                        stagingEntries: (session.stagingEntries || []).map((entry) => ({
                            ...entry,
                            layer: entry.layer || null,
                            sourceTag: entry.sourceTag || null,
                            sourceMessageId: entry.sourceMessageId || null,
                            sourceSessionId: entry.sourceSessionId || null
                        })),
                        commitReadyEntries: (session.commitReadyEntries || []).map((entry) => ({
                            ...entry,
                            layer: entry.layer || null,
                            sourceTag: entry.sourceTag || null,
                            sourceMessageId: entry.sourceMessageId || null,
                            sourceSessionId: entry.sourceSessionId || null
                        })),
                        virtualLorebookEntries: session.virtualLorebookEntries || [],
                        importedLorebookId: session.importedLorebookId || null,
                        workflowSnapshot: session.workflowSnapshot || null,
                        detailMode: session.detailMode || null,
                        entryMode: session.entryMode || null,
                        structuredState: cloneStructuredState(session.structuredState || createEmptyStructuredState()),
                        draftTree: cloneDraftTree(session.draftTree || createEmptyDraftTree()),
                        forgeMemoryTree: cloneForgeMemoryTree(session.forgeMemoryTree || createEmptyForgeMemoryTree()),
                        activeLayer: session.activeLayer || 'concept',
                        completedLayers: session.completedLayers || [],
                        publishState: session.publishState || 'drafting',
                        workspaceMode: ((session as any).workspaceMode === 'stub' ? 'stub' : 'workspace') as 'workspace'
                    };
                })
                .map(s => this.dehydrateSession(s)) // 强制脱水所有本地读取的数据，确保 localStorage 绝对轻量
                : [];
        } catch {
            return [];
        }
    }

    private writeLocal(sessions: ForgeWorkspaceSession[]): void {
        if (typeof localStorage === 'undefined') return;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
        } catch (e: any) {
            if (e.name === 'QuotaExceededError') {
                console.warn('[ForgeRepository] LocalStorage 额度溢出，尝试清理旧会话...');
                // 仅保留最近的几个会话作为缓存，物理隔离新会话
                const pruned = this.pruneOldSessions(sessions, 3);
                try {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
                } catch {
                    console.error('[ForgeRepository] 清理后依然无法保存到本地，将仅依赖后端同步。');
                    // 极致情况：只留当前正在编辑的 ID
                    const activeId = this.getActiveSessionId();
                    const minimal = sessions.filter(s => s.id === activeId);
                    try {
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(minimal));
                    } catch {
                        localStorage.removeItem(STORAGE_KEY);
                    }
                }
            }
        }
    }

    private async syncSessionToServer(session: ForgeWorkspaceSession): Promise<boolean> {
        try {
            await HALContext.instance.runtime.conversation.saveConversation(session.id, this.sessionToConversation(session));
            return true;
        } catch {
            return false;
        }
    }

    private async hydrateProjectData(session: ForgeWorkspaceSession): Promise<ForgeWorkspaceSession> {
        const result = await forgeProjectDataService.loadOrCreateFromSession(this.normalizeProjectFields(session));
        return {
            ...result.session,
            projectTitle: result.session.projectTitle || result.session.title,
            title: session.title,
            workspacePath: this.normalizeProjectFields(session).workspacePath
        };
    }

    private dehydrateSession(session: ForgeWorkspaceSession): ForgeWorkspaceSession {
        const normalized = this.normalizeProjectFields(session);
        // “脱水”逻辑：清空重量级内容，本地仅留存根
        return {
            ...normalized,
            worldlineNodes: [],
            timelineItems: [],
            piSession: normalized.piSession,
            stagingEntries: [],
            commitReadyEntries: [],
            virtualLorebookEntries: [],
            draftTree: createEmptyDraftTree(),
            forgeMemoryTree: createEmptyForgeMemoryTree(),
            structuredState: createEmptyStructuredState(),
            workspaceMode: 'stub' as any // 标记为存根
        };
    }

    listSessions(): ForgeWorkspaceSessionRef[] {
        return this.readLocal()
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .map((session) => ({
                id: session.id,
                forgeProjectId: session.forgeProjectId,
                conversationId: session.conversationId,
                sessionChatId: session.sessionChatId,
                workspacePath: session.workspacePath,
                projectTitle: session.projectTitle,
                title: session.title,
                createdAt: session.createdAt,
                updatedAt: session.updatedAt,
                messageCount: session.worldlineNodes.length,
                activeLeafId: session.activeLeafId,
                selectedChatSessionId: session.selectedChatSessionId
            }));
    }

    async loadSession(id: string): Promise<ForgeWorkspaceSession | null> {
        // 1. 优先从后端拉取完整数据
        try {
            const data = await HALContext.instance.runtime.conversation.getConversation(id);
            if (data && data.document) {
                console.log(`[ForgeRepository] 已从后端加载会话: ${id}`);
                // 顺便更新下本地存根，保持元数据同步
                const session = await this.hydrateProjectData(this.conversationToSession(data.document));
                await this.writeConversationProjection(session);
                this.updateLocalMeta(session);
                return session;
            }
        } catch (e) {
            console.warn(`[ForgeRepository] 从后端加载会话失败，尝试回退到本地: ${id}`, e);
        }

        // 2. 后端不可用或 404，回退到本地
        const local = this.readLocal().find(session => session.id === id);
        if (local) {
            if ((local as any).workspaceMode === 'stub') {
                console.warn(`[ForgeRepository] 本地仅存在会话存根，且后端不可达: ${id}`);
                // 此时可以考虑弹窗提示，或者直接返回 stub（UI 层需处理空数据）
            }
            return this.hydrateProjectData(local);
        }

        return null;
    }

    private updateLocalMeta(session: ForgeWorkspaceSession): void {
        const sessions = this.readLocal();
        const index = sessions.findIndex(s => s.id === session.id);
        const stub = this.dehydrateSession(session);
        if (index === -1) {
            sessions.push(stub);
        } else {
            sessions[index] = stub;
        }
        this.writeLocal(sessions);
    }

    private getProjectId(session: ForgeWorkspaceSession | ForgeWorkspaceSessionRef): string {
        return session.forgeProjectId || session.id;
    }

    private getProjectThreads(projectId: string): ForgeWorkspaceSession[] {
        return this.readLocal()
            .filter((session) => this.getProjectId(session) === projectId)
            .sort((left, right) => right.updatedAt - left.updatedAt);
    }

    private async loadProjectSeed(projectId: string): Promise<ForgeWorkspaceSession | null> {
        const threads = this.getProjectThreads(projectId);
        for (const thread of threads) {
            const loaded = await this.loadSession(thread.id).catch(() => null);
            if (loaded) return loaded;
        }
        return null;
    }

    async saveSession(session: ForgeWorkspaceSession): Promise<void> {
        const normalizedSession: ForgeWorkspaceSession = this.normalizeProjectFields({
            ...session,
            structuredState: cloneStructuredState(session.structuredState || createEmptyStructuredState()),
            draftTree: cloneDraftTree(session.draftTree || createEmptyDraftTree()),
            forgeMemoryTree: cloneForgeMemoryTree(session.forgeMemoryTree || createEmptyForgeMemoryTree())
        });
        await this.bindProjectWorkspace(normalizedSession);

        // 1. 优先推送到后端
        const syncSuccess = await this.syncSessionToServer(normalizedSession);
        await forgeProjectDataService.saveFromSession(normalizedSession);
        await this.writeConversationProjection(normalizedSession);

        // 2. 根据同步结果决定本地存储深度
        const sessions = this.readLocal();
        const index = sessions.findIndex(item => item.id === session.id);

        // 本地禁止保存聊天记录与完整状态，仅保留元数据存根
        // 即使同步失败也不回退到本地完整备份，以彻底避免 LocalStorage 溢出
        const localContent = this.dehydrateSession(normalizedSession);

        if (index === -1) {
            sessions.push(localContent);
        } else {
            sessions[index] = localContent;
        }

        this.writeLocal(sessions);
        this.setActiveSessionId(normalizedSession.id);

        if (syncSuccess) {
            console.log(`[ForgeRepository] 会话已成功同步至后端，本地存根已更新: ${session.id}`);
        } else {
            console.warn(`[ForgeRepository] 后端同步失败，本地仅保留元数据存根，刷新页面可能会丢失未同步的内容: ${session.id}`);
        }
    }

    renameSession(id: string, title: string): ForgeWorkspaceSession | null {
        const nextTitle = title.trim();
        if (!nextTitle) return null;

        const sessions = this.readLocal();
        const index = sessions.findIndex(item => item.id === id);
        if (index === -1) return null;

        const updated: ForgeWorkspaceSession = {
            ...sessions[index],
            title: nextTitle,
            updatedAt: Date.now()
        };
        sessions[index] = updated;
        this.writeLocal(sessions);
        void this.hydrateProjectData(updated)
            .then((hydrated) => this.saveSession({
                ...hydrated,
                title: nextTitle,
                updatedAt: updated.updatedAt
            }))
            .catch((error) => {
                console.warn('[ForgeRepository] Forge project metadata rename sync failed:', error);
            });
        return updated;
    }

    async renameThread(id: string, title: string): Promise<ForgeWorkspaceSession | null> {
        const nextTitle = title.trim();
        if (!nextTitle) return null;

        const local = this.readLocal().find(session => session.id === id);
        if (!local) return null;

        const loaded = await this.loadSession(id).catch(() => null);
        const updated: ForgeWorkspaceSession = {
            ...(loaded || local),
            title: nextTitle,
            projectTitle: (loaded || local).projectTitle || (loaded || local).title,
            updatedAt: Date.now()
        };
        await this.saveSession(updated);
        return updated;
    }

    async renameProject(forgeProjectId: string, title: string): Promise<boolean> {
        const projectId = forgeProjectId.trim();
        const nextTitle = title.trim();
        if (!projectId || !nextTitle) return false;

        const sessions = this.readLocal();
        const projectThreads = sessions.filter((session) => this.getProjectId(session) === projectId);
        if (projectThreads.length === 0) return false;

        const timestamp = Date.now();
        const renamedProjectFile = await forgeProjectDataService.renameProject(projectId, nextTitle);
        const nextLocal = sessions.map((session) => (
            this.getProjectId(session) === projectId
                ? {
                    ...session,
                    projectTitle: nextTitle,
                    updatedAt: Math.max(session.updatedAt || 0, timestamp)
                }
                : session
        ));
        this.writeLocal(nextLocal);

        for (const thread of projectThreads) {
            await this.renameProjectMetadataForThread(thread, nextTitle, timestamp);
        }

        if (!renamedProjectFile) {
            const seed = nextLocal.find((session) => this.getProjectId(session) === projectId);
            if (seed) {
                await forgeProjectDataService.saveFromSession({
                    ...seed,
                    projectTitle: nextTitle
                });
            }
        }
        return true;
    }

    async createSession(partial?: Partial<ForgeWorkspaceSession>): Promise<ForgeWorkspaceSession> {
        const now = Date.now();
        const forgeStore = useForgeStore();
        const id = partial?.id || `forge_ws_${now.toString(36)}`;
        const sessionChatId = partial?.sessionChatId || partial?.conversationId || generateSessionChatId();
        const forgeProjectId = partial?.forgeProjectId || id;

        const session: ForgeWorkspaceSession = {
            id,
            forgeProjectId,
            conversationId: partial?.conversationId || sessionChatId,
            workspacePath: resolveThreadWorkspacePath(forgeProjectId, partial?.conversationId || sessionChatId, partial?.workspacePath),
            projectTitle: partial?.projectTitle || partial?.title || `Forge Project ${new Date(now).toLocaleDateString()}`,
            sessionChatId,
            title: partial?.title || `Forge Project ${new Date(now).toLocaleDateString()}`,
            createdAt: partial?.createdAt || now,
            updatedAt: partial?.updatedAt || now,
            presetId: partial?.presetId || '',
            activeLeafId: partial?.activeLeafId || null,
            worldlineNodes: partial?.worldlineNodes || [],
            selectedChatSessionId: partial?.selectedChatSessionId || null,
            selectedChatSnapshotId: partial?.selectedChatSnapshotId || null,
            draftInput: partial?.draftInput || '',
            timelineItems: partial?.timelineItems || [],
            piSession: partial?.piSession,
            stagingEntries: (partial?.stagingEntries || forgeStore.stagingArea || []).map((entry) => ({
                ...entry,
                layer: entry.layer || null,
                sourceTag: entry.sourceTag || null,
                sourceMessageId: entry.sourceMessageId || null,
                sourceSessionId: entry.sourceSessionId || null
            })),
            commitReadyEntries: (partial?.commitReadyEntries || forgeStore.commitReadyEntries || []).map((entry) => ({
                ...entry,
                layer: entry.layer || null,
                sourceTag: entry.sourceTag || null,
                sourceMessageId: entry.sourceMessageId || null,
                sourceSessionId: entry.sourceSessionId || null
            })),
            virtualLorebookEntries: partial?.virtualLorebookEntries || [],
            importedLorebookId: partial?.importedLorebookId || null,
            workflowSnapshot: partial?.workflowSnapshot || null,
            detailMode: partial?.detailMode || null,
            entryMode: partial?.entryMode || null,
            structuredState: cloneStructuredState(partial?.structuredState || createEmptyStructuredState()),
            draftTree: cloneDraftTree(partial?.draftTree || createEmptyDraftTree()),
            forgeMemoryTree: cloneForgeMemoryTree(partial?.forgeMemoryTree || createEmptyForgeMemoryTree()),
            activeLayer: partial?.activeLayer || 'concept',
            completedLayers: partial?.completedLayers || [],
            publishState: partial?.publishState || 'drafting',
            workspaceMode: 'workspace'
        };

        await this.saveSession(session);
        return session;
    }

    async createThread(
        forgeProjectId: string,
        partial?: Partial<ForgeWorkspaceSession>
    ): Promise<ForgeWorkspaceSession> {
        const projectId = forgeProjectId.trim();
        if (!projectId) {
            throw new Error('forgeProjectId is required');
        }

        const now = Date.now();
        const seed = await this.loadProjectSeed(projectId);
        const conversationId = partial?.conversationId || partial?.sessionChatId || generateSessionChatId();
        const seedProjectState = seed
            ? {
                presetId: seed.presetId,
                projectTitle: seed.projectTitle || seed.title,
                selectedChatSessionId: seed.selectedChatSessionId,
                selectedChatSnapshotId: seed.selectedChatSnapshotId,
                virtualLorebookEntries: seed.virtualLorebookEntries,
                importedLorebookId: seed.importedLorebookId,
                detailMode: seed.detailMode,
                entryMode: seed.entryMode,
                structuredState: cloneStructuredState(seed.structuredState || createEmptyStructuredState()),
                draftTree: cloneDraftTree(seed.draftTree || createEmptyDraftTree()),
                forgeMemoryTree: cloneForgeMemoryTree(seed.forgeMemoryTree || createEmptyForgeMemoryTree()),
                activeLayer: seed.activeLayer,
                completedLayers: seed.completedLayers,
                publishState: seed.publishState,
                activeAuxPanel: seed.activeAuxPanel,
                auxPresentationMode: seed.auxPresentationMode,
                stagingEntries: seed.stagingEntries,
                commitReadyEntries: seed.commitReadyEntries
            }
            : {};

        return this.createSession({
            ...seedProjectState,
            ...partial,
            id: partial?.id || `forge_thread_${now.toString(36)}`,
            forgeProjectId: projectId,
            conversationId,
            sessionChatId: partial?.sessionChatId || conversationId,
            workspacePath: resolveThreadWorkspacePath(projectId, conversationId, partial?.workspacePath),
            title: partial?.title || `协作线程 ${new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
            createdAt: partial?.createdAt || now,
            updatedAt: partial?.updatedAt || now,
            worldlineNodes: partial?.worldlineNodes || [],
            timelineItems: partial?.timelineItems || [],
            piSession: partial?.piSession,
            workspaceMode: 'workspace'
        });
    }

    async deleteThread(id: string): Promise<boolean> {
        const sessions = this.readLocal();
        const target = sessions.find((session) => session.id === id);
        if (!target) return false;

        try {
            await HALContext.instance.runtime.conversation.deleteConversation(id);
        } catch (error) {
            console.warn(`[ForgeRepository] 删除协作线程远端会话失败，将继续清理本地索引: ${id}`, error);
        }

        this.writeLocal(sessions.filter((session) => session.id !== id));
        if (this.getActiveSessionId() === id) {
            const next = sessions.find((session) => session.id !== id) || null;
            this.setActiveSessionId(next?.id ?? null);
        }
        await shellWorkspaceService.deleteForgeConversationProjection(
            resolveForgeProjectId(target),
            resolveForgeConversationId(target)
        );
        await shellWorkspaceService.unbindForgeConversation(resolveForgeConversationId(target));
        return true;
    }

    async deleteProject(forgeProjectId: string): Promise<boolean> {
        const projectId = forgeProjectId.trim();
        if (!projectId) return false;

        const sessions = this.readLocal();
        const deleting = sessions.filter((session) => this.getProjectId(session) === projectId);
        if (deleting.length === 0) {
            await forgeProjectDataService.deleteProject(projectId);
            await shellWorkspaceService.unbindForgeProject(projectId);
            return false;
        }

        for (const session of deleting) {
            try {
                await HALContext.instance.runtime.conversation.deleteConversation(session.id);
            } catch (error) {
                console.warn(`[ForgeRepository] 删除项目线程远端会话失败，将继续清理本地索引: ${session.id}`, error);
            }
        }

        const deletingIds = new Set(deleting.map((session) => session.id));
        const remaining = sessions.filter((session) => !deletingIds.has(session.id));
        this.writeLocal(remaining);
        if (this.getActiveSessionId() && deletingIds.has(this.getActiveSessionId()!)) {
            this.setActiveSessionId(remaining[0]?.id ?? null);
        }

        for (const session of deleting) {
            await shellWorkspaceService.deleteForgeConversationProjection(
                resolveForgeProjectId(session),
                resolveForgeConversationId(session)
            );
        }
        await forgeProjectDataService.deleteProject(projectId);
        await shellWorkspaceService.unbindForgeProject(projectId);
        return true;
    }

    private normalizeProjectFields(session: ForgeWorkspaceSession): ForgeWorkspaceSession {
        const forgeProjectId = resolveForgeProjectId(session);
        const conversationId = resolveForgeConversationId(session);
        return {
            ...session,
            forgeProjectId,
            conversationId,
            sessionChatId: session.sessionChatId || conversationId,
            workspacePath: resolveThreadWorkspacePath(forgeProjectId, conversationId, session.workspacePath)
        };
    }

    private async bindProjectWorkspace(session: ForgeWorkspaceSession): Promise<void> {
        try {
            await shellWorkspaceService.bindForgeConversation({
                forgeProjectId: resolveForgeProjectId(session),
                conversationId: resolveForgeConversationId(session)
            });
        } catch (error) {
            console.warn('[ForgeRepository] Forge project workspace binding failed:', error);
        }
    }

    private async writeConversationProjection(session: ForgeWorkspaceSession): Promise<void> {
        try {
            const forgeProjectId = resolveForgeProjectId(session);
            const conversationId = resolveForgeConversationId(session);
            await shellWorkspaceService.writeForgeConversationProjection({
                forgeProjectId,
                conversationId,
                workspaceSessionId: session.id,
                workspacePath: session.workspacePath || forgeThreadWorkspacePath(forgeProjectId, conversationId),
                title: session.title,
                createdAt: session.createdAt,
                updatedAt: session.updatedAt,
                activeLeafId: session.activeLeafId,
                messages: session.worldlineNodes || []
            });
        } catch (error) {
            console.warn('[ForgeRepository] Forge conversation VFS projection failed:', error);
        }
    }

    private async renameProjectMetadataForThread(
        thread: ForgeWorkspaceSession,
        projectTitle: string,
        timestamp: number
    ): Promise<void> {
        try {
            const data = await HALContext.instance.runtime.conversation.getConversation(thread.id);
            const document = data?.document;
            if (!document) return;

            const updatedDocument: ConversationDocument = {
                ...document,
                updatedAt: Math.max(document.updatedAt || 0, timestamp),
                pluginState: {
                    ...document.pluginState,
                    forge: {
                        ...(document.pluginState.forge || {}),
                        projectTitle
                    }
                }
            };
            await HALContext.instance.runtime.conversation.saveConversation(thread.id, updatedDocument);
        } catch (error) {
            console.warn(`[ForgeRepository] Forge project title metadata sync failed: ${thread.id}`, error);
        }
    }

    async refreshFromServer(): Promise<void> {
        try {
            console.log('[ForgeRepository] 正在从服务端同步 Forge 项目列表...');
            const data = await HALContext.instance.runtime.conversation.listConversations();
            const remote = Array.isArray(data.conversations)
                ? data.conversations.filter((conversation) => conversation.conversationType === 'forge')
                : [];

            console.debug(`[ForgeRepository] 服务端共返回 ${remote.length} 个 Forge 会话。`);

            const hydratedRemote = await Promise.all(remote.map(async (conversation) => {
                try {
                    const full = await HALContext.instance.runtime.conversation.getConversation(conversation.id);
                    if (full?.document) {
                        console.debug(`[ForgeRepository] 会话加载成功: ${conversation.id}`);
                        return this.hydrateProjectData(this.conversationToSession(full.document));
                    }
                    return null;
                } catch (err) {
                    console.warn(`[ForgeRepository] 加载单个服务端会话失败: ${conversation.id}`, err);
                    return null;
                }
            }));
            const remoteSessions = hydratedRemote.filter((session): session is ForgeWorkspaceSession => Boolean(session));

            const local = this.readLocal();

            // 迁移逻辑：如果本地有远端没有的会话，尝试同步给远端
            const remoteIds = new Set(remoteSessions.map((s) => s.id));
            const migrationTasks = local.filter(s => !remoteIds.has(s.id));
            if (migrationTasks.length > 0) {
                console.log(`[ForgeRepository] 发现 ${migrationTasks.length} 个未同步的本地会话，正在迁移至后端...`);
                for (const session of migrationTasks) {
                    try {
                        await forgeProjectDataService.saveFromSession(this.normalizeProjectFields(session));
                        const success = await this.syncSessionToServer(session);
                        if (success) {
                            console.log(`[ForgeRepository] 会话自动迁移成功: ${session.id}`);
                        } else {
                            console.warn(`[ForgeRepository] 会话自动迁移失败 (服务器接受异常): ${session.id}`);
                        }
                    } catch (err) {
                        console.error(`[ForgeRepository] 会话自动迁移崩溃: ${session.id}`, err);
                    }
                }
                console.log('[ForgeRepository] 本地会话迁移流程结束。');
            }

            const merged = this.mergeSessions(local, remoteSessions);
            for (const session of remoteSessions) {
                await this.writeConversationProjection(session);
            }
            this.writeLocal(merged);
            console.log(`[ForgeRepository] 会话同步完成，当前共 ${merged.length} 个活跃会话。`);
        } catch (e) {
            console.warn('[ForgeRepository] 刷新服务端 Forge 项目列表失败，降级为本地模式', e);
        }
    }

    getActiveSessionId(): string | null {
        if (typeof localStorage === 'undefined') return null;
        return localStorage.getItem(ACTIVE_KEY);
    }

    setActiveSessionId(id: string | null): void {
        if (typeof localStorage === 'undefined') return;
        if (!id) {
            localStorage.removeItem(ACTIVE_KEY);
            return;
        }
        localStorage.setItem(ACTIVE_KEY, id);
    }
}

export const forgeSessionRepository = new ForgeSessionRepository();
