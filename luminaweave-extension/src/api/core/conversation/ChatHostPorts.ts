import { chatSessionIndexService } from './ChatSessionIndexService.js';
import type { LuminaChatMessage } from '@shared/LuminaMessage.js';
import type {
    CreateChatConversationInput,
    DeleteChatConversationInput,
    RenameChatConversationInput,
    CharacterChannelCapabilities
} from '../../../types/ConversationContextTypes.js';
import type { ChatSessionRef } from '../../../types/SessionTypes.js';

export interface ChatSessionCharacterMeta {
    characterId: string | number | null;
    characterName: string | null;
    characterAvatarUrl: string | null;
}

export interface ChatSessionDescriptor extends ChatSessionCharacterMeta {
    sessionId: string;
}

export interface ChatHistoryMessage {
    index: number;
    role: 'user' | 'assistant' | 'system';
    text: string;
    message: unknown;
}

export interface ChatMessageSearchHit {
    index: number;
    score: number;
    snippet: string;
    role: 'user' | 'assistant' | 'system';
    text: string;
}

export interface ChatSessionHistorySummary {
    preview: string;
    updatedAt: number;
    messageCount: number;
    stableSessionId: string | null;
}

export interface ChatWindowInfo {
    mode: 'windowed' | 'off';
    totalCount: number;
    windowStartIndex: number;
    windowLength: number;
    chatRef?: unknown;
}

export interface ChatSessionMutationResult {
    success: boolean;
    resolvedCharacterId: string | null;
    resolvedCharacterName: string | null;
    resolvedCharacterAvatarUrl: string | null;
    resolvedChatFile: string | null;
    reason?: string;
    previousChatFile?: string | null;
}

export interface ChatSessionDirectoryPort {
    listCharacterRoster(): Promise<Array<{
        characterId: string;
        characterName: string;
        characterAvatarUrl: string | null;
    }>>;
    openSession(target: ChatSessionDescriptor): Promise<boolean>;
    createSession(input: CreateChatConversationInput): Promise<ChatSessionMutationResult>;
    renameSession(input: RenameChatConversationInput): Promise<ChatSessionMutationResult>;
    deleteSession(input: DeleteChatConversationInput): Promise<ChatSessionMutationResult>;
    closeCurrentSession(): Promise<boolean>;
    resolveSessionCharacterMeta(sessionId: string, target?: Partial<ChatSessionCharacterMeta>): Promise<ChatSessionCharacterMeta | null>;
}

export interface ChatHistoryAccessPort {
    getCurrentRef(): Promise<unknown | null>;
    getWindowInfo(): Promise<ChatWindowInfo | null>;
    getRecentHistory(target: ChatSessionDescriptor, limit: number): Promise<ChatHistoryMessage[] | null>;
    searchMessages(
        target: ChatSessionDescriptor,
        query: string,
        options?: {
            limit?: number;
            role?: 'user' | 'assistant' | 'system';
            startIndex?: number;
            endIndex?: number;
            scanLimit?: number;
        }
    ): Promise<ChatMessageSearchHit[] | null>;
    findLastMessage(
        target: ChatSessionDescriptor,
        query?: {
            role?: 'user' | 'assistant' | 'system';
            hasExtraKeys?: string[];
            scanLimit?: number;
        }
    ): Promise<ChatHistoryMessage | null>;
    getSessionSummary(target: ChatSessionDescriptor): Promise<ChatSessionHistorySummary | null>;
    getStableSessionId(target: ChatSessionDescriptor): Promise<string | null>;
}

export type ChatMessageSnapshot = {
    raw: ChatMessage[];
    lumina: LuminaChatMessage[];
    idToIndex: Map<string, number>;
};

export interface ChatMessageListPort {
    getSnapshotSync(): ChatMessageSnapshot;
    getSnapshot(options?: { ensureStableIds?: boolean }): Promise<ChatMessageSnapshot>;
}

const normalizeCharacterId = (value: string | number | null | undefined): string | null => {
    if (value == null) return null;
    const normalized = String(value).trim();
    return normalized || null;
};

const normalizeCharacterMeta = (
    meta: Partial<ChatSessionCharacterMeta> | null | undefined
): ChatSessionCharacterMeta | null => {
    if (!meta) return null;

    const normalized: ChatSessionCharacterMeta = {
        characterId: meta.characterId ?? null,
        characterName: typeof meta.characterName === 'string' ? meta.characterName.trim() || null : null,
        characterAvatarUrl: typeof meta.characterAvatarUrl === 'string' ? meta.characterAvatarUrl.trim() || null : null
    };

    if (!normalized.characterId && !normalized.characterName && !normalized.characterAvatarUrl) {
        return null;
    }

    return normalized;
};

const createSessionDescriptor = (
    sessionId: string,
    target: Partial<ChatSessionCharacterMeta> = {}
): ChatSessionDescriptor => ({
    sessionId,
    characterId: target.characterId ?? null,
    characterName: target.characterName ?? null,
    characterAvatarUrl: target.characterAvatarUrl ?? null
});

class TauriChatProvider implements Pick<ChatSessionDirectoryPort, 'openSession'>, ChatHistoryAccessPort {
    async openSession(_target: ChatSessionDescriptor): Promise<boolean> {
        return false;
    }

    async getCurrentRef(): Promise<unknown | null> {
        return null;
    }

    async getWindowInfo(): Promise<ChatWindowInfo | null> {
        return null;
    }

    async getRecentHistory(_target: ChatSessionDescriptor, _limit: number): Promise<ChatHistoryMessage[] | null> {
        return null;
    }

    async searchMessages(
        target: ChatSessionDescriptor,
        query: string,
        options: {
            limit?: number;
            role?: 'user' | 'assistant' | 'system';
            startIndex?: number;
            endIndex?: number;
            scanLimit?: number;
        } = {}
    ): Promise<ChatMessageSearchHit[] | null> {
        void target;
        void query;
        void options;
        return null;
    }

    async findLastMessage(
        target: ChatSessionDescriptor,
        query: {
            role?: 'user' | 'assistant' | 'system';
            hasExtraKeys?: string[];
            scanLimit?: number;
        } = {}
    ): Promise<ChatHistoryMessage | null> {
        void target;
        void query;
        return null;
    }

    async getSessionSummary(_target: ChatSessionDescriptor): Promise<ChatSessionHistorySummary | null> {
        return null;
    }

    async getStableSessionId(_target: ChatSessionDescriptor): Promise<string | null> {
        return null;
    }
}

class EmptyChatSessionDirectoryPort implements ChatSessionDirectoryPort {
    async listCharacterRoster(): Promise<Array<{
        characterId: string;
        characterName: string;
        characterAvatarUrl: string | null;
    }>> {
        return [];
    }

    async openSession(target: ChatSessionDescriptor): Promise<boolean> {
        void target;
        return false;
    }

    async createSession(input: CreateChatConversationInput): Promise<ChatSessionMutationResult> {
        void input;
        return {
            success: false,
            resolvedCharacterId: null,
            resolvedCharacterName: null,
            resolvedCharacterAvatarUrl: null,
            resolvedChatFile: null,
            reason: 'chat-host-unavailable'
        };
    }

    async renameSession(input: RenameChatConversationInput): Promise<ChatSessionMutationResult> {
        void input;
        return {
            success: false,
            resolvedCharacterId: null,
            resolvedCharacterName: null,
            resolvedCharacterAvatarUrl: null,
            resolvedChatFile: null,
            reason: 'chat-host-unavailable',
            previousChatFile: null
        };
    }

    async deleteSession(input: DeleteChatConversationInput): Promise<ChatSessionMutationResult> {
        void input;
        return {
            success: false,
            resolvedCharacterId: null,
            resolvedCharacterName: null,
            resolvedCharacterAvatarUrl: null,
            resolvedChatFile: null,
            reason: 'chat-host-unavailable'
        };
    }

    async closeCurrentSession(): Promise<boolean> {
        return false;
    }

    async resolveSessionCharacterMeta(
        sessionId: string,
        target: Partial<ChatSessionCharacterMeta> = {}
    ): Promise<ChatSessionCharacterMeta | null> {
        void sessionId;
        return normalizeCharacterMeta(target);
    }
}

class EmptyChatHistoryAccessPort implements ChatHistoryAccessPort {
    async getCurrentRef(): Promise<unknown | null> { return null; }
    async getWindowInfo(): Promise<ChatWindowInfo | null> { return null; }
    async getRecentHistory(_target: ChatSessionDescriptor, _limit: number): Promise<ChatHistoryMessage[] | null> { return null; }
    async searchMessages(
        _target: ChatSessionDescriptor,
        _query: string,
        _options: {
            limit?: number;
            role?: 'user' | 'assistant' | 'system';
            startIndex?: number;
            endIndex?: number;
            scanLimit?: number;
        } = {}
    ): Promise<ChatMessageSearchHit[] | null> { return null; }
    async findLastMessage(
        _target: ChatSessionDescriptor,
        _query: {
            role?: 'user' | 'assistant' | 'system';
            hasExtraKeys?: string[];
            scanLimit?: number;
        } = {}
    ): Promise<ChatHistoryMessage | null> { return null; }
    async getSessionSummary(_target: ChatSessionDescriptor): Promise<ChatSessionHistorySummary | null> { return null; }
    async getStableSessionId(_target: ChatSessionDescriptor): Promise<string | null> { return null; }
}

class DirectoryMetaAugmentProvider {
    constructor(private readonly directory: ChatSessionDirectoryPort) {}

    async resolveSessionCharacterMeta(
        sessionId: string,
        target: Partial<ChatSessionCharacterMeta> = {}
    ): Promise<ChatSessionCharacterMeta | null> {
        const directMeta = normalizeCharacterMeta(target);
        const resolved = await this.directory.resolveSessionCharacterMeta(sessionId, target);

        return normalizeCharacterMeta({
            characterId: resolved?.characterId ?? directMeta?.characterId ?? null,
            characterName: resolved?.characterName ?? directMeta?.characterName ?? null,
            characterAvatarUrl: resolved?.characterAvatarUrl ?? directMeta?.characterAvatarUrl ?? null
        });
    }
}

export class CompositeChatHostProvider implements ChatSessionDirectoryPort, ChatHistoryAccessPort {
    private readonly directory: ChatSessionDirectoryPort;
    private readonly history: ChatHistoryAccessPort;
    private readonly helper: DirectoryMetaAugmentProvider;

    constructor(
        directory: ChatSessionDirectoryPort = new EmptyChatSessionDirectoryPort(),
        history: ChatHistoryAccessPort = new EmptyChatHistoryAccessPort()
    ) {
        this.directory = directory;
        this.history = history;
        this.helper = new DirectoryMetaAugmentProvider(directory);
    }

    getCapabilityFlags(): CharacterChannelCapabilities {
        return {
            supportsCharacterRoster: !(this.directory instanceof EmptyChatSessionDirectoryPort),
            supportsCreateSession: !(this.directory instanceof EmptyChatSessionDirectoryPort),
            supportsRenameSession: !(this.directory instanceof EmptyChatSessionDirectoryPort),
            supportsDeleteSession: !(this.directory instanceof EmptyChatSessionDirectoryPort),
            supportsCloseCurrentSession: !(this.directory instanceof EmptyChatSessionDirectoryPort),
            supportsNativeOpenSession: false,
            supportsHostHistory: false,
            supportsHostSearch: false,
            supportsFindLastMessage: false,
            supportsStableSessionId: false,
            supportsCurrentWindowInfo: false
        };
    }

    async listCharacterRoster(): Promise<Array<{
        characterId: string;
        characterName: string;
        characterAvatarUrl: string | null;
    }>> {
        return this.directory.listCharacterRoster();
    }

    async listSessions(): Promise<ChatSessionRef[]> {
        return chatSessionIndexService.listChatSessions();
    }

    async openSession(target: ChatSessionDescriptor): Promise<boolean> {
        return this.directory.openSession(target);
    }

    async createSession(input: CreateChatConversationInput): Promise<ChatSessionMutationResult> {
        return this.directory.createSession(input);
    }

    async renameSession(input: RenameChatConversationInput): Promise<ChatSessionMutationResult> {
        return this.directory.renameSession(input);
    }

    async deleteSession(input: DeleteChatConversationInput): Promise<ChatSessionMutationResult> {
        return this.directory.deleteSession(input);
    }

    async closeCurrentSession(): Promise<boolean> {
        return this.directory.closeCurrentSession();
    }

    async resolveSessionCharacterMeta(
        sessionId: string,
        target: Partial<ChatSessionCharacterMeta> = {}
    ): Promise<ChatSessionCharacterMeta | null> {
        const resolved = await this.helper.resolveSessionCharacterMeta(sessionId, target);
        return normalizeCharacterMeta({
            characterId: resolved?.characterId ?? target.characterId ?? null,
            characterName: resolved?.characterName ?? target.characterName ?? null,
            characterAvatarUrl: resolved?.characterAvatarUrl ?? target.characterAvatarUrl ?? null
        });
    }

    async getCurrentRef(): Promise<unknown | null> {
        return this.history.getCurrentRef();
    }

    async getWindowInfo(): Promise<ChatWindowInfo | null> {
        return this.history.getWindowInfo();
    }

    async getRecentHistory(target: ChatSessionDescriptor, limit: number): Promise<ChatHistoryMessage[] | null> {
        return this.history.getRecentHistory(target, limit);
    }

    async searchMessages(
        target: ChatSessionDescriptor,
        query: string,
        options: {
            limit?: number;
            role?: 'user' | 'assistant' | 'system';
            startIndex?: number;
            endIndex?: number;
            scanLimit?: number;
        } = {}
    ): Promise<ChatMessageSearchHit[] | null> {
        return this.history.searchMessages(target, query, options);
    }

    async findLastMessage(
        target: ChatSessionDescriptor,
        query: {
            role?: 'user' | 'assistant' | 'system';
            hasExtraKeys?: string[];
            scanLimit?: number;
        } = {}
    ): Promise<ChatHistoryMessage | null> {
        return this.history.findLastMessage(target, query);
    }

    async getSessionSummary(target: ChatSessionDescriptor): Promise<ChatSessionHistorySummary | null> {
        return this.history.getSessionSummary(target);
    }

    async getStableSessionId(target: ChatSessionDescriptor): Promise<string | null> {
        return this.history.getStableSessionId(target);
    }

    buildSessionDescriptor(sessionId: string, target: Partial<ChatSessionCharacterMeta> = {}): ChatSessionDescriptor {
        return createSessionDescriptor(sessionId, target);
    }
}

export const compositeChatHostProvider = new CompositeChatHostProvider();

export function configureChatHostProvider(directory: ChatSessionDirectoryPort, history?: ChatHistoryAccessPort): void {
    const next = new CompositeChatHostProvider(directory, history);
    Object.setPrototypeOf(compositeChatHostProvider, Object.getPrototypeOf(next));
    Object.assign(compositeChatHostProvider, next);
}

const emptyMessageSnapshot = (): ChatMessageSnapshot => ({
    raw: [],
    lumina: [],
    idToIndex: new Map()
});

let chatMessageListPort: ChatMessageListPort = {
    getSnapshotSync: emptyMessageSnapshot,
    async getSnapshot() {
        return emptyMessageSnapshot();
    }
};

export function configureChatMessageListPort(port: ChatMessageListPort): void {
    chatMessageListPort = port;
}

export function getChatMessageListPort(): ChatMessageListPort {
    return chatMessageListPort;
}
