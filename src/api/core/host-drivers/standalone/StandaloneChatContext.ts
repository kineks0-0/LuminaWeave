import { HALContext } from '../../hal/HALContext.js';

export interface StandaloneChatContext {
    chatId: string | null;
    characterId: string | null;
    characterName: string;
    characterAvatarUrl: string | null;
}

interface SyncHostStorage {
    get?(key: string, scope: 'Global', id?: string): unknown;
    set?(key: string, value: unknown, scope: 'Global', id?: string): void;
}

const STORAGE_KEY = 'lumina-standalone.chat-context';

let memoryContext: StandaloneChatContext | null = null;

const normalizeContext = (value: unknown): StandaloneChatContext | null => {
    if (!value || typeof value !== 'object') return null;
    const record = value as Record<string, unknown>;
    const chatId = typeof record.chatId === 'string' && record.chatId.trim() ? record.chatId.trim() : null;
    if (!chatId) return null;
    const characterId = record.characterId == null ? null : String(record.characterId);
    return {
        chatId,
        characterId,
        characterName: typeof record.characterName === 'string' ? record.characterName : '',
        characterAvatarUrl: typeof record.characterAvatarUrl === 'string' ? record.characterAvatarUrl : null
    };
};

const syncStorage = (): SyncHostStorage | null => {
    try {
        return HALContext.instance.storage as unknown as SyncHostStorage;
    } catch {
        return null;
    }
};

const readStoredContext = (): unknown => {
    const storage = syncStorage();
    if (storage && typeof storage.get === 'function') {
        try {
            return storage.get(STORAGE_KEY, 'Global');
        } catch {
            return null;
        }
    }
    return memoryContext;
};

const writeStoredContext = (value: StandaloneChatContext | null): void => {
    memoryContext = value;
    const storage = syncStorage();
    if (storage && typeof storage.set === 'function') {
        try {
            storage.set(STORAGE_KEY, value, 'Global');
        } catch {
            // 独立模式存储不可用时保留内存指针。
        }
    }
};

/**
 * standalone 运行时的“当前会话 / 当前角色”指针。
 * 使用宿主同步存储（StandaloneHostStorage）而不是 lwStorage，
 * 因为 lwStorage.get/set 会读取 _getContextIds()，指针本身必须避免递归。
 */
export const getStandaloneChatContext = (): StandaloneChatContext | null =>
    normalizeContext(readStoredContext());

export const setStandaloneChatContext = (context: StandaloneChatContext): void => {
    writeStoredContext(context);
};

export const clearStandaloneChatContext = (): void => {
    writeStoredContext(null);
};
