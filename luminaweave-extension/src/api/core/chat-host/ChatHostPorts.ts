import { chatSessionIndexService } from '../ChatSessionIndexService.js';
import { STClient } from '../st-adapter/STClient.js';
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

export interface ChatSessionDirectoryPort {
    listCharacterRoster(): Promise<Array<{
        characterId: string;
        characterName: string;
        characterAvatarUrl: string | null;
    }>>;
    listSessions(): Promise<ChatSessionRef[]>;
    openSession(target: ChatSessionDescriptor): Promise<boolean>;
    createSession(input: CreateChatConversationInput): Promise<Awaited<ReturnType<typeof STClient.createNewCharacterChat>>>;
    renameSession(input: RenameChatConversationInput): Promise<Awaited<ReturnType<typeof STClient.renameCharacterChat>>>;
    deleteSession(input: DeleteChatConversationInput): Promise<Awaited<ReturnType<typeof STClient.deleteCharacterChat>>>;
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

class STChatProvider implements ChatSessionDirectoryPort {
    async listCharacterRoster(): Promise<Array<{
        characterId: string;
        characterName: string;
        characterAvatarUrl: string | null;
    }>> {
        return STClient.getCharacterRoster();
    }

    async listSessions(): Promise<ChatSessionRef[]> {
        return chatSessionIndexService.listChatSessions();
    }

    async openSession(target: ChatSessionDescriptor): Promise<boolean> {
        const result = await STClient.switchToCharacterChat({
            characterId: target.characterId,
            characterName: target.characterName || '',
            characterAvatarUrl: target.characterAvatarUrl ?? null,
            chatFile: target.sessionId
        });
        return Boolean(result.success);
    }

    async createSession(input: CreateChatConversationInput): Promise<Awaited<ReturnType<typeof STClient.createNewCharacterChat>>> {
        return STClient.createNewCharacterChat({
            characterId: input.characterId ?? null,
            characterName: input.characterName || '',
            characterAvatarUrl: input.characterAvatarUrl ?? null
        });
    }

    async renameSession(input: RenameChatConversationInput): Promise<Awaited<ReturnType<typeof STClient.renameCharacterChat>>> {
        return STClient.renameCharacterChat({
            characterId: input.characterId ?? null,
            characterName: input.characterName || '',
            characterAvatarUrl: input.characterAvatarUrl ?? null,
            oldChatFile: input.sessionId,
            newChatTitle: input.nextTitle
        });
    }

    async deleteSession(input: DeleteChatConversationInput): Promise<Awaited<ReturnType<typeof STClient.deleteCharacterChat>>> {
        return STClient.deleteCharacterChat({
            characterId: input.characterId ?? null,
            characterName: input.characterName || '',
            characterAvatarUrl: input.characterAvatarUrl ?? null,
            chatFile: input.sessionId
        });
    }

    async closeCurrentSession(): Promise<boolean> {
        return STClient.closeCurrentChatView();
    }

    async resolveSessionCharacterMeta(
        sessionId: string,
        target: Partial<ChatSessionCharacterMeta> = {}
    ): Promise<ChatSessionCharacterMeta | null> {
        return STClient.getChatSessionCharacterMeta(sessionId, {
            characterId: target.characterId ?? null,
            characterName: target.characterName || '',
            characterAvatarUrl: target.characterAvatarUrl ?? null
        });
    }
}

class HelperAugmentProvider {
    async resolveSessionCharacterMeta(
        sessionId: string,
        target: Partial<ChatSessionCharacterMeta> = {}
    ): Promise<ChatSessionCharacterMeta | null> {
        const directMeta = normalizeCharacterMeta(target);
        const resolved = await STClient.getChatSessionCharacterMeta(sessionId, {
            characterId: target.characterId ?? null,
            characterName: target.characterName || '',
            characterAvatarUrl: target.characterAvatarUrl ?? null
        });

        return normalizeCharacterMeta({
            characterId: resolved?.characterId ?? directMeta?.characterId ?? null,
            characterName: resolved?.characterName ?? directMeta?.characterName ?? null,
            characterAvatarUrl: resolved?.characterAvatarUrl ?? directMeta?.characterAvatarUrl ?? null
        });
    }
}

export class CompositeChatHostProvider implements ChatSessionDirectoryPort, ChatHistoryAccessPort {
    private readonly tauri = new TauriChatProvider();
    private readonly st = new STChatProvider();
    private readonly helper = new HelperAugmentProvider();

    getCapabilityFlags(): CharacterChannelCapabilities {
        return {
            supportsCharacterRoster: true,
            supportsCreateSession: true,
            supportsRenameSession: true,
            supportsDeleteSession: true,
            supportsCloseCurrentSession: true,
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
        return this.st.listCharacterRoster();
    }

    async listSessions(): Promise<ChatSessionRef[]> {
        return this.st.listSessions();
    }

    async openSession(target: ChatSessionDescriptor): Promise<boolean> {
        return this.st.openSession(target);
    }

    async createSession(input: CreateChatConversationInput): Promise<Awaited<ReturnType<typeof STClient.createNewCharacterChat>>> {
        return this.st.createSession(input);
    }

    async renameSession(input: RenameChatConversationInput): Promise<Awaited<ReturnType<typeof STClient.renameCharacterChat>>> {
        return this.st.renameSession(input);
    }

    async deleteSession(input: DeleteChatConversationInput): Promise<Awaited<ReturnType<typeof STClient.deleteCharacterChat>>> {
        return this.st.deleteSession(input);
    }

    async closeCurrentSession(): Promise<boolean> {
        return this.st.closeCurrentSession();
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
        return this.tauri.getCurrentRef();
    }

    async getWindowInfo(): Promise<ChatWindowInfo | null> {
        return this.tauri.getWindowInfo();
    }

    async getRecentHistory(target: ChatSessionDescriptor, limit: number): Promise<ChatHistoryMessage[] | null> {
        return this.tauri.getRecentHistory(target, limit);
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
        return this.tauri.searchMessages(target, query, options);
    }

    async findLastMessage(
        target: ChatSessionDescriptor,
        query: {
            role?: 'user' | 'assistant' | 'system';
            hasExtraKeys?: string[];
            scanLimit?: number;
        } = {}
    ): Promise<ChatHistoryMessage | null> {
        return this.tauri.findLastMessage(target, query);
    }

    async getSessionSummary(target: ChatSessionDescriptor): Promise<ChatSessionHistorySummary | null> {
        return this.tauri.getSessionSummary(target);
    }

    async getStableSessionId(target: ChatSessionDescriptor): Promise<string | null> {
        return this.tauri.getStableSessionId(target);
    }

    buildSessionDescriptor(sessionId: string, target: Partial<ChatSessionCharacterMeta> = {}): ChatSessionDescriptor {
        return createSessionDescriptor(sessionId, target);
    }
}

export const compositeChatHostProvider = new CompositeChatHostProvider();
