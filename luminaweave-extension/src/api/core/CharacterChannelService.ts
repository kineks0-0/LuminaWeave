import { ref, type Ref } from 'vue';
import type { LuminaWeaveAPI } from '../index.js';
import type {
    CharacterChannelCapabilities,
    CharacterChannelGroup,
    CharacterChannelSessionItem,
    CharacterChannelState,
    CharacterChannelStatus,
    CreateChatConversationInput,
    DeleteChatConversationInput,
    RenameChatConversationInput
} from '../../types/ConversationContextTypes.js';
import type { ChatSessionRef } from '../../types/SessionTypes.js';
import {
    compositeChatHostProvider,
    type ChatSessionCharacterMeta,
    type ChatSessionDescriptor,
    type CompositeChatHostProvider
} from './chat-host/ChatHostPorts.js';

type ConversationContextStoreLike = {
    chatSessions: Array<ChatSessionRef & { sourceId?: 'chat' }>;
    activeSourceId: 'chat' | 'forge';
    activeSessionId: string | null;
    selectedViewSessionId: string | null;
    currentChatSessionId: string | null;
    sessionSwitchState: {
        isSwitching: boolean;
        targetSessionId: string | null;
        targetCharacterName: string;
        statusText: string;
        startedAt: number | null;
    };
    refreshFromApi?: () => Promise<void>;
    refreshSessionOptions: () => Promise<void>;
    selectViewSession: (id: string | null) => Promise<void>;
    syncCurrentChatSelection: () => void;
    beginSessionSwitch: (payload?: {
        sessionId?: string | null;
        characterName?: string | null;
        statusText?: string | null;
    }) => void;
    updateSessionSwitch: (payload?: {
        statusText?: string | null;
        sessionId?: string | null;
        characterName?: string | null;
    }) => void;
    endSessionSwitch: () => void;
};

const EMPTY_CAPABILITIES: CharacterChannelCapabilities = {
    supportsCharacterRoster: false,
    supportsCreateSession: false,
    supportsRenameSession: false,
    supportsDeleteSession: false,
    supportsCloseCurrentSession: false,
    supportsNativeOpenSession: false,
    supportsHostHistory: false,
    supportsHostSearch: false,
    supportsFindLastMessage: false,
    supportsStableSessionId: false,
    supportsCurrentWindowInfo: false
};

const EMPTY_STATUS: CharacterChannelStatus = {
    kind: 'idle',
    text: '',
    sessionId: null,
    characterName: '',
    error: null
};

const createEmptyState = (capabilityFlags: CharacterChannelCapabilities = EMPTY_CAPABILITIES): CharacterChannelState => ({
    characterGroups: [],
    activeSessionId: null,
    selectedViewSessionId: null,
    currentLiveSessionId: null,
    busySessionIds: [],
    expandedCharacterKey: null,
    expandedSessionGroups: {},
    capabilityFlags,
    status: EMPTY_STATUS
});

const normalizeCharacterName = (value: string | null | undefined): string => {
    return typeof value === 'string' ? value.trim() : '';
};

const isFilteredCharacterName = (value: string | null | undefined): boolean => {
    return normalizeCharacterName(value).toLowerCase() === 'assistant';
};

const normalizePreview = (value: string | null | undefined): string => {
    return typeof value === 'string'
        ? value.replace(/\s+/g, ' ').trim()
        : '';
};

export class CharacterChannelService {
    public readonly state: Ref<CharacterChannelState>;
    private readonly busySessionIds = new Set<string>();
    private readonly stableCharacterOrder = ref<string[]>([]);
    private refreshPromise: Promise<void> | null = null;
    private isBound = false;

    constructor(
        private readonly api: Pick<LuminaWeaveAPI,
            'on'
            | 'waitForReady'
            | 'createChatSession'
            | 'renameChatSession'
            | 'deleteChatSession'
            | 'getAssistantName'
            | 'getCharAvatar'
            | 'DEFAULT_AVATAR'
        >,
        private readonly contextStore: ConversationContextStoreLike,
        private readonly hostProvider: CompositeChatHostProvider = compositeChatHostProvider
    ) {
        this.state = ref(createEmptyState(this.hostProvider.getCapabilityFlags()));
        this.bind();
    }

    private bind(): void {
        if (this.isBound) {
            return;
        }

        this.isBound = true;
        const triggerRefresh = () => {
            void this.refresh();
        };

        this.api.on('CONVERSATION_SESSIONS_UPDATED', triggerRefresh);
        this.api.on('CONVERSATION_CONTEXT_CHANGED', triggerRefresh);
        this.api.on('CHAT_CHANGED', triggerRefresh);
        void this.api.waitForReady().then((ready) => {
            if (ready) {
                return this.refresh();
            }
            return undefined;
        });
    }

    private setBusy(sessionId: string, busy: boolean): void {
        if (!sessionId) {
            return;
        }

        if (busy) {
            this.busySessionIds.add(sessionId);
        } else {
            this.busySessionIds.delete(sessionId);
        }

        this.state.value = {
            ...this.state.value,
            busySessionIds: Array.from(this.busySessionIds)
        };
    }

    private updateStatus(status: Partial<CharacterChannelStatus>): void {
        this.state.value = {
            ...this.state.value,
            status: {
                ...this.state.value.status,
                ...status
            }
        };
    }

    private buildSessionDescriptor(session: ChatSessionRef): ChatSessionDescriptor {
        return this.hostProvider.buildSessionDescriptor(session.id, {
            characterId: session.characterId ?? null,
            characterName: session.characterName || '',
            characterAvatarUrl: session.characterAvatarUrl ?? null
        });
    }

    private resolveCharacterName(session: ChatSessionRef, meta: ChatSessionCharacterMeta | null): string {
        const directName = normalizeCharacterName(session.characterName);
        if (directName && !isFilteredCharacterName(directName)) {
            return directName;
        }

        const resolvedName = normalizeCharacterName(meta?.characterName);
        if (resolvedName && !isFilteredCharacterName(resolvedName)) {
            return resolvedName;
        }

        if (session.source === 'st-current') {
            const assistantName = normalizeCharacterName(this.api.getAssistantName());
            if (assistantName && !isFilteredCharacterName(assistantName)) {
                return assistantName;
            }
        }

        return directName || resolvedName || session.title || '未命名角色';
    }

    private shouldHideSession(session: ChatSessionRef, meta: ChatSessionCharacterMeta | null): boolean {
        if (isFilteredCharacterName(session.characterName) || isFilteredCharacterName(meta?.characterName)) {
            return true;
        }

        if (session.source === 'st-current' && isFilteredCharacterName(this.api.getAssistantName())) {
            return true;
        }

        return false;
    }

    private resolveCharacterAvatar(
        session: ChatSessionRef,
        characterName: string,
        meta: ChatSessionCharacterMeta | null,
        rosterById: Map<string, { characterAvatarUrl: string | null }>
    ): string | null {
        if (session.characterAvatarUrl) {
            return session.characterAvatarUrl;
        }

        if (meta?.characterAvatarUrl) {
            return meta.characterAvatarUrl;
        }

        const characterId = session.characterId ?? meta?.characterId;
        if (characterId != null) {
            const avatarFromRoster = rosterById.get(String(characterId))?.characterAvatarUrl ?? null;
            if (avatarFromRoster) {
                return avatarFromRoster;
            }
        }

        const avatar = this.api.getCharAvatar(characterName);
        return avatar || this.api.DEFAULT_AVATAR;
    }

    private updateStableCharacterOrder(groups: CharacterChannelGroup[]): void {
        const nextKeys = groups.map((group) => group.key);
        const existingKeys = this.stableCharacterOrder.value.filter((key) => nextKeys.includes(key));
        const appendedKeys = nextKeys.filter((key) => !existingKeys.includes(key));
        this.stableCharacterOrder.value = [...existingKeys, ...appendedKeys];
    }

    private syncExpansionState(groups: CharacterChannelGroup[]): void {
        const groupKeys = new Set(groups.map((group) => group.key));
        const expandedSessionGroups = Object.fromEntries(
            Object.entries(this.state.value.expandedSessionGroups).filter(([key]) => groupKeys.has(key))
        );

        let expandedCharacterKey = this.state.value.expandedCharacterKey;
        const activeGroupKey = groups.find((group) => group.sessions.some((session) => session.id === this.state.value.activeSessionId))?.key || null;

        if (activeGroupKey) {
            expandedCharacterKey = activeGroupKey;
        } else if (!expandedCharacterKey || !groupKeys.has(expandedCharacterKey)) {
            expandedCharacterKey = groups[0]?.key || null;
        }

        this.state.value = {
            ...this.state.value,
            expandedCharacterKey,
            expandedSessionGroups
        };
    }

    private updateState(groups: CharacterChannelGroup[]): void {
        const status = this.contextStore.sessionSwitchState.isSwitching
            ? {
                kind: 'switching' as const,
                text: this.contextStore.sessionSwitchState.statusText || '',
                sessionId: this.contextStore.sessionSwitchState.targetSessionId,
                characterName: this.contextStore.sessionSwitchState.targetCharacterName,
                error: null
            }
            : this.state.value.status.kind === 'error'
                ? this.state.value.status
                : EMPTY_STATUS;

        this.state.value = {
            ...this.state.value,
            characterGroups: groups,
            activeSessionId: this.contextStore.activeSourceId === 'chat' ? this.contextStore.activeSessionId : null,
            selectedViewSessionId: this.contextStore.selectedViewSessionId,
            currentLiveSessionId: this.contextStore.currentChatSessionId,
            busySessionIds: Array.from(this.busySessionIds),
            capabilityFlags: this.hostProvider.getCapabilityFlags(),
            status
        };

        this.syncExpansionState(groups);
    }

    private async buildGroups(): Promise<CharacterChannelGroup[]> {
        const [sessions, roster] = await Promise.all([
            this.hostProvider.listSessions(),
            this.hostProvider.listCharacterRoster()
        ]);
        const visibleRoster = roster.filter((item) => !isFilteredCharacterName(item.characterName));

        const rosterById = new Map(
            visibleRoster.map((item) => [String(item.characterId), item] as const)
        );

        const enhancedSessionResults: Array<CharacterChannelSessionItem | null> = await Promise.all(sessions.map(async (session) => {
            const meta = await this.hostProvider.resolveSessionCharacterMeta(session.id, {
                characterId: session.characterId ?? null,
                characterName: session.characterName || '',
                characterAvatarUrl: session.characterAvatarUrl ?? null
            });
            if (this.shouldHideSession(session, meta)) {
                return null;
            }
            const descriptor = this.buildSessionDescriptor(session);
            const sessionSummary = await this.hostProvider.getSessionSummary(descriptor);
            const characterName = this.resolveCharacterName(session, meta);
            const characterId = session.characterId ?? meta?.characterId ?? null;
            const preview = normalizePreview(sessionSummary?.preview)
                || normalizePreview(session.previewMessage)
                || normalizePreview(session.summary)
                || '暂无最近对话';

            return {
                ...session,
                sourceId: 'chat' as const,
                characterId,
                characterName,
                characterAvatarUrl: this.resolveCharacterAvatar(session, characterName, meta, rosterById),
                characterKey: characterId != null ? String(characterId) : (characterName || session.id),
                recentHistoryPreview: preview,
                stableSessionId: sessionSummary?.stableSessionId ?? null
            } as CharacterChannelSessionItem;
        }));
        const enhancedSessions = enhancedSessionResults.filter((session): session is CharacterChannelSessionItem => session !== null);

        const grouped = new Map<string, CharacterChannelGroup>();

        visibleRoster.forEach((item) => {
            const key = String(item.characterId);
            grouped.set(key, {
                key,
                characterId: item.characterId,
                characterName: item.characterName,
                characterAvatarUrl: item.characterAvatarUrl,
                characterInitial: item.characterName.trim().slice(0, 1).toUpperCase() || '角',
                sessions: [],
                recentSession: null,
                recentPreview: '暂无历史对话'
            });
        });

        enhancedSessions.forEach((session) => {
            if (isFilteredCharacterName(session.characterName)) {
                return;
            }

            const sessionCharacterName = session.characterName || '未命名角色';
            const existing = grouped.get(session.characterKey);
            if (existing) {
                existing.characterId = existing.characterId ?? session.characterId ?? null;
                existing.characterName = existing.characterName || sessionCharacterName;
                existing.characterAvatarUrl = existing.characterAvatarUrl || session.characterAvatarUrl || null;
                existing.characterInitial = existing.characterName.trim().slice(0, 1).toUpperCase() || '角';
                existing.sessions.push(session);
                if (existing.recentPreview === '暂无历史对话') {
                    existing.recentPreview = session.recentHistoryPreview;
                }
                return;
            }

            grouped.set(session.characterKey, {
                key: session.characterKey,
                characterId: session.characterId ?? null,
                characterName: sessionCharacterName,
                characterAvatarUrl: session.characterAvatarUrl ?? null,
                characterInitial: sessionCharacterName.trim().slice(0, 1).toUpperCase() || '角',
                sessions: [session],
                recentSession: session,
                recentPreview: session.recentHistoryPreview
            });
        });

        const groups = Array.from(grouped.values()).map((group) => {
            const sortedSessions = [...group.sessions].sort((left, right) => right.updatedAt - left.updatedAt);
            const recentSession = sortedSessions[0] || null;

            return {
                ...group,
                sessions: sortedSessions,
                recentSession,
                recentPreview: recentSession?.recentHistoryPreview || group.recentPreview
            };
        });

        this.updateStableCharacterOrder(groups);

        const orderMap = new Map(this.stableCharacterOrder.value.map((key, index) => [key, index] as const));
        return groups.sort((left, right) => {
            const leftOrder = orderMap.get(left.key) ?? Number.MAX_SAFE_INTEGER;
            const rightOrder = orderMap.get(right.key) ?? Number.MAX_SAFE_INTEGER;
            return leftOrder - rightOrder;
        });
    }

    async refresh(): Promise<void> {
        if (this.refreshPromise) {
            return this.refreshPromise;
        }

        this.updateStatus({
            kind: this.contextStore.sessionSwitchState.isSwitching ? 'switching' : 'loading',
            text: this.contextStore.sessionSwitchState.isSwitching
                ? this.contextStore.sessionSwitchState.statusText
                : '正在刷新角色频道...',
            error: null
        });

        this.refreshPromise = this.buildGroups()
            .then((groups) => {
                this.updateState(groups);
                if (!this.contextStore.sessionSwitchState.isSwitching) {
                    this.updateStatus(EMPTY_STATUS);
                }
            })
            .catch((error) => {
                console.error('[CharacterChannelService] refresh failed', error);
                this.updateStatus({
                    kind: 'error',
                    text: '角色频道刷新失败',
                    error: error instanceof Error ? error.message : String(error ?? 'unknown_error')
                });
            })
            .finally(() => {
                this.refreshPromise = null;
            });

        return this.refreshPromise;
    }

    getSession(sessionId: string): CharacterChannelSessionItem | null {
        for (const group of this.state.value.characterGroups) {
            const session = group.sessions.find((item) => item.id === sessionId);
            if (session) {
                return session;
            }
        }
        return null;
    }

    toggleGroup(groupKey: string): void {
        this.state.value = {
            ...this.state.value,
            expandedCharacterKey: this.state.value.expandedCharacterKey === groupKey ? null : groupKey
        };
    }

    expandGroup(groupKey: string): void {
        this.state.value = {
            ...this.state.value,
            expandedCharacterKey: groupKey
        };
    }

    collapseGroup(groupKey: string): void {
        if (this.state.value.expandedCharacterKey !== groupKey) {
            return;
        }

        this.state.value = {
            ...this.state.value,
            expandedCharacterKey: null
        };
    }

    toggleGroupSessionExpansion(groupKey: string): void {
        this.state.value = {
            ...this.state.value,
            expandedSessionGroups: {
                ...this.state.value.expandedSessionGroups,
                [groupKey]: !this.state.value.expandedSessionGroups[groupKey]
            }
        };
    }

    async openSession(sessionId: string): Promise<void> {
        const session = this.getSession(sessionId);
        if (!session) {
            return;
        }

        this.contextStore.beginSessionSwitch({
            sessionId: session.id,
            characterName: session.characterName,
            statusText: session.characterName
                ? `正在切换到 ${session.characterName}...`
                : '正在切换聊天...'
        });

        try {
            const opened = await this.hostProvider.openSession(this.buildSessionDescriptor(session));
            if (opened) {
                this.contextStore.updateSessionSwitch({
                    sessionId: session.id,
                    characterName: session.characterName,
                    statusText: session.characterName
                        ? `正在载入 ${session.characterName} 的聊天内容...`
                        : '正在载入聊天内容...'
                });
                await this.contextStore.selectViewSession(null);
            } else {
                this.contextStore.updateSessionSwitch({
                    statusText: session.characterName
                        ? `宿主切换失败，正在打开 ${session.characterName} 的历史会话...`
                        : '宿主切换失败，正在打开历史会话...'
                });
                await this.contextStore.selectViewSession(session.id);
            }

            await this.contextStore.refreshFromApi?.();
            await this.refresh();
        } finally {
            this.contextStore.endSessionSwitch();
            await this.refresh();
        }
    }

    async createSession(target: CreateChatConversationInput): Promise<void> {
        const characterName = normalizeCharacterName(target.characterName);
        this.contextStore.beginSessionSwitch({
            characterName,
            statusText: characterName
                ? `正在为 ${characterName} 新建对话...`
                : '正在新建对话...'
        });

        try {
            const created = await this.api.createChatSession({
                characterId: target.characterId ?? null,
                characterName,
                characterAvatarUrl: target.characterAvatarUrl ?? null
            });

            this.contextStore.updateSessionSwitch({
                sessionId: created.sessionId,
                characterName: created.characterName || characterName,
                statusText: created.characterName
                    ? `正在载入 ${created.characterName} 的新对话...`
                    : '正在载入新对话...'
            });
            await this.contextStore.selectViewSession(null);
            await this.contextStore.refreshFromApi?.();
            await this.refresh();
        } finally {
            this.contextStore.endSessionSwitch();
            await this.refresh();
        }
    }

    async renameSession(input: RenameChatConversationInput): Promise<void> {
        const nextTitle = normalizeCharacterName(input.nextTitle);
        if (!input.sessionId || !nextTitle) {
            return;
        }

        this.setBusy(input.sessionId, true);
        try {
            const result = await this.api.renameChatSession({
                ...input,
                nextTitle
            });

            if (this.contextStore.selectedViewSessionId === input.sessionId) {
                await this.contextStore.selectViewSession(result.sessionId);
            } else if (this.contextStore.activeSourceId === 'chat' && this.contextStore.activeSessionId === input.sessionId) {
                this.contextStore.syncCurrentChatSelection();
            }

            await this.contextStore.refreshFromApi?.();
            await this.refresh();
        } finally {
            this.setBusy(input.sessionId, false);
        }
    }

    async deleteSession(input: DeleteChatConversationInput): Promise<void> {
        if (!input.sessionId) {
            return;
        }

        this.setBusy(input.sessionId, true);
        try {
            const deletedSelectedView = this.contextStore.selectedViewSessionId === input.sessionId;
            const deletedActiveChat = this.contextStore.activeSourceId === 'chat' && this.contextStore.activeSessionId === input.sessionId;

            if (deletedSelectedView || deletedActiveChat) {
                await this.contextStore.selectViewSession(null);
            }

            await this.api.deleteChatSession(input);

            if (!deletedSelectedView && !deletedActiveChat) {
                await this.contextStore.refreshSessionOptions();
            }

            await this.contextStore.refreshFromApi?.();
            await this.refresh();
        } finally {
            this.setBusy(input.sessionId, false);
        }
    }

    async closeCurrentSession(): Promise<boolean> {
        const closed = await this.hostProvider.closeCurrentSession();
        if (!closed) {
            return false;
        }

        await this.contextStore.selectViewSession(null);
        await this.contextStore.refreshFromApi?.();
        await this.refresh();
        return true;
    }
}
