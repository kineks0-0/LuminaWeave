import { LuminaChatMessage } from '@shared/LuminaMessage.js';
import { EnvDetector } from '../EnvDetector.js';
import { ST_EVENT } from '../STEvent.js';
import { STProtocol } from './STProtocol.js';

export interface STMessageUpdate {
    index: number;
    content: string;
    name?: string;
    role?: string;
    is_hidden?: boolean;
    extra?: Record<string, unknown>;
    expectedSwipeId?: number;
    expectedActiveSwipeText?: string;
}

export interface STCharacterChatSwitchTarget {
    characterId?: string | number | null;
    characterName?: string;
    characterAvatarUrl?: string | null;
    chatFile?: string | null;
}

export interface STChatSessionCharacterMeta {
    characterId: string | null;
    characterName: string | null;
    characterAvatarUrl: string | null;
}

export interface STCharacterChatMutationResult {
    success: boolean;
    resolvedCharacterId: string | null;
    resolvedCharacterName: string | null;
    resolvedCharacterAvatarUrl: string | null;
    resolvedChatFile: string | null;
    reason?: string;
}

export interface STRenameCharacterChatInput {
    characterId?: string | number | null;
    characterName?: string;
    characterAvatarUrl?: string | null;
    oldChatFile: string;
    newChatTitle: string;
}

export interface STRenameCharacterChatResult extends STCharacterChatMutationResult {
    previousChatFile: string | null;
}

export interface STDeleteCharacterChatInput {
    characterId?: string | number | null;
    characterName?: string;
    characterAvatarUrl?: string | null;
    chatFile: string;
}

export interface STCharacterRosterItem {
    characterId: string;
    characterName: string;
    characterAvatarUrl: string | null;
}

export class STClient {
    private static _csrfToken: string | null = null;
    private static _csrfTime: number = 0;
    private static readonly INVALID_CSRF_ERROR = 'LW_INVALID_CSRF_TOKEN';
    private static readonly chatFileCharacterCache = new Map<string, string>();
    private static readonly chatFileCharacterMetaCache = new Map<string, STChatSessionCharacterMeta>();
    private static readonly chatFileCharacterMetaInflight = new Map<string, Promise<STChatSessionCharacterMeta | null>>();
    private static readonly DEBUG_PREFIX = '[LuminaWeave][DiscordSwitch][STClient]';

    private static get stMain(): typeof SillyTavern | undefined {
        return EnvDetector.stMain;
    }

    private static get stHelper(): typeof TavernHelper | undefined {
        return EnvDetector.stHelper;
    }

    private static get ctx(): typeof SillyTavern | undefined {
        return EnvDetector.ctx;
    }

    private static _fetchPromise: Promise<string> | null = null;

    private static getHostNavigationApi(): {
        getCurrentChatId?: () => unknown;
        selectCharacterById?: (id: string | number, options?: { switchMenu?: boolean }) => Promise<unknown> | unknown;
        openCharacterChat?: (fileName: string) => Promise<unknown> | unknown;
        doNewChat?: (options?: { deleteCurrentChat?: boolean }) => Promise<unknown> | unknown;
        clearChat?: (options?: { clearData?: boolean }) => Promise<unknown> | unknown;
        setCharacterId?: (value?: string | number | null | undefined) => unknown;
        setCharacterName?: (value?: string) => unknown;
        executeSlashCommandsWithOptions?: (command: string, options?: Record<string, unknown>) => Promise<unknown> | unknown;
        renameChat?: (oldFileName: string, newName: string) => Promise<unknown> | unknown;
        renameGroupOrCharacterChat?: (payload: {
            characterId?: string | number | null;
            groupId?: string | number | null;
            oldFileName: string;
            newFileName: string;
            loader?: boolean;
        }) => Promise<unknown> | unknown;
        deleteCharacterChatByName?: (characterId: string | number, fileName: string) => Promise<unknown> | unknown;
    } {
        const ctx = this.ctx as any;
        const stMain = this.stMain as any;
        const globalHost = EnvDetector.stGlobal as any;
        const helper = this.stHelper as any;

        return {
            getCurrentChatId: typeof ctx?.getCurrentChatId === 'function'
                ? ctx.getCurrentChatId.bind(ctx)
                : (typeof stMain?.getCurrentChatId === 'function'
                    ? stMain.getCurrentChatId.bind(stMain)
                    : undefined),
            selectCharacterById: typeof ctx?.selectCharacterById === 'function'
                ? ctx.selectCharacterById.bind(ctx)
                : (typeof stMain?.selectCharacterById === 'function'
                    ? stMain.selectCharacterById.bind(stMain)
                    : undefined),
            openCharacterChat: typeof ctx?.openCharacterChat === 'function'
                ? ctx.openCharacterChat.bind(ctx)
                : (typeof stMain?.openCharacterChat === 'function'
                    ? stMain.openCharacterChat.bind(stMain)
                    : undefined),
            doNewChat: typeof ctx?.doNewChat === 'function'
                ? ctx.doNewChat.bind(ctx)
                : (typeof stMain?.doNewChat === 'function'
                    ? stMain.doNewChat.bind(stMain)
                    : (typeof globalHost?.doNewChat === 'function'
                        ? globalHost.doNewChat.bind(globalHost)
                        : undefined)),
            clearChat: typeof ctx?.clearChat === 'function'
                ? ctx.clearChat.bind(ctx)
                : (typeof stMain?.clearChat === 'function'
                    ? stMain.clearChat.bind(stMain)
                    : (typeof globalHost?.clearChat === 'function'
                        ? globalHost.clearChat.bind(globalHost)
                        : undefined)),
            setCharacterId: typeof ctx?.setCharacterId === 'function'
                ? ctx.setCharacterId.bind(ctx)
                : (typeof stMain?.setCharacterId === 'function'
                    ? stMain.setCharacterId.bind(stMain)
                    : (typeof globalHost?.setCharacterId === 'function'
                        ? globalHost.setCharacterId.bind(globalHost)
                        : undefined)),
            setCharacterName: typeof ctx?.setCharacterName === 'function'
                ? ctx.setCharacterName.bind(ctx)
                : (typeof stMain?.setCharacterName === 'function'
                    ? stMain.setCharacterName.bind(stMain)
                    : (typeof globalHost?.setCharacterName === 'function'
                        ? globalHost.setCharacterName.bind(globalHost)
                        : undefined)),
            executeSlashCommandsWithOptions: typeof ctx?.executeSlashCommandsWithOptions === 'function'
                ? ctx.executeSlashCommandsWithOptions.bind(ctx)
                : (typeof stMain?.executeSlashCommandsWithOptions === 'function'
                    ? stMain.executeSlashCommandsWithOptions.bind(stMain)
                    : (typeof globalHost?.executeSlashCommandsWithOptions === 'function'
                        ? globalHost.executeSlashCommandsWithOptions.bind(globalHost)
                        : (typeof helper?.executeSlashCommandsWithOptions === 'function'
                            ? helper.executeSlashCommandsWithOptions.bind(helper)
                            : undefined))),
            renameChat: typeof ctx?.renameChat === 'function'
                ? ctx.renameChat.bind(ctx)
                : (typeof stMain?.renameChat === 'function'
                    ? stMain.renameChat.bind(stMain)
                    : (typeof globalHost?.renameChat === 'function'
                        ? globalHost.renameChat.bind(globalHost)
                        : undefined)),
            renameGroupOrCharacterChat: typeof ctx?.renameGroupOrCharacterChat === 'function'
                ? ctx.renameGroupOrCharacterChat.bind(ctx)
                : (typeof stMain?.renameGroupOrCharacterChat === 'function'
                    ? stMain.renameGroupOrCharacterChat.bind(stMain)
                    : (typeof globalHost?.renameGroupOrCharacterChat === 'function'
                        ? globalHost.renameGroupOrCharacterChat.bind(globalHost)
                        : undefined)),
            deleteCharacterChatByName: typeof ctx?.deleteCharacterChatByName === 'function'
                ? ctx.deleteCharacterChatByName.bind(ctx)
                : (typeof stMain?.deleteCharacterChatByName === 'function'
                    ? stMain.deleteCharacterChatByName.bind(stMain)
                    : (typeof globalHost?.deleteCharacterChatByName === 'function'
                        ? globalHost.deleteCharacterChatByName.bind(globalHost)
                        : undefined))
        };
    }

    private static log(message: string, payload?: unknown): void {
        if (payload === undefined) {
            console.info(`${this.DEBUG_PREFIX} ${message}`);
            return;
        }

        console.info(`${this.DEBUG_PREFIX} ${message}`, payload);
    }

    private static warn(message: string, payload?: unknown): void {
        if (payload === undefined) {
            console.warn(`${this.DEBUG_PREFIX} ${message}`);
            return;
        }

        console.warn(`${this.DEBUG_PREFIX} ${message}`, payload);
    }

    private static error(message: string, payload?: unknown): void {
        if (payload === undefined) {
            console.error(`${this.DEBUG_PREFIX} ${message}`);
            return;
        }

        console.error(`${this.DEBUG_PREFIX} ${message}`, payload);
    }

    private static getHostSnapshot(): Record<string, unknown> {
        const stMain = this.stMain as any;
        const ctx = this.ctx as any;
        const hostApi = this.getHostNavigationApi();
        return {
            currentCharacterId: this.getResolvedCurrentCharacterId(),
            currentChatId: this.getResolvedCurrentChatId(),
            ctxCharacterId: ctx?.characterId ?? null,
            ctxChatId: ctx?.chatId ?? null,
            stCurrentChatId: typeof stMain?.getCurrentChatId === 'function' ? stMain.getCurrentChatId() : null,
            hostCurrentChatId: typeof hostApi.getCurrentChatId === 'function' ? hostApi.getCurrentChatId() : null,
            hasCtxSelectCharacterById: typeof ctx?.selectCharacterById === 'function',
            hasCtxOpenCharacterChat: typeof ctx?.openCharacterChat === 'function',
            hasCtxDoNewChat: typeof ctx?.doNewChat === 'function',
            hasStMainSelectCharacterById: typeof stMain?.selectCharacterById === 'function',
            hasStMainOpenCharacterChat: typeof stMain?.openCharacterChat === 'function',
            hasStMainDoNewChat: typeof stMain?.doNewChat === 'function',
            hasClearChat: typeof hostApi.clearChat === 'function',
            hasSetCharacterId: typeof hostApi.setCharacterId === 'function',
            hasSetCharacterName: typeof hostApi.setCharacterName === 'function',
            hasGlobalDoNewChat: typeof (EnvDetector.stGlobal as any)?.doNewChat === 'function',
            hasExecuteSlashCommandsWithOptions: typeof hostApi.executeSlashCommandsWithOptions === 'function',
            hasRenameChat: typeof hostApi.renameChat === 'function',
            hasRenameGroupOrCharacterChat: typeof hostApi.renameGroupOrCharacterChat === 'function',
            hasDeleteCharacterChatByName: typeof hostApi.deleteCharacterChatByName === 'function',
            characterCount: Array.isArray(ctx?.characters) ? ctx.characters.length : 0
        };
    }

    static normalizeChatId(value: unknown): string | null {
        if (typeof value !== 'string' && typeof value !== 'number') {
            return null;
        }

        const normalized = String(value).trim().replace(/\.jsonl$/i, '');
        if (!normalized || normalized === 'null' || normalized === 'undefined' || normalized === 'default') {
            return null;
        }

        return normalized;
    }

    static hasActiveLiveChat(): boolean {
        return this.getResolvedCurrentChatId() !== null;
    }

    private static normalizeCharacterId(value: unknown): string | null {
        if (typeof value !== 'string' && typeof value !== 'number') {
            return null;
        }

        const normalized = String(value).trim();
        if (!normalized || normalized === 'null' || normalized === 'undefined' || normalized === 'default' || normalized === 'Global') {
            return null;
        }

        return normalized;
    }

    private static getCharacters(): any[] {
        const ctxCharacters = (this.ctx as any)?.characters;
        if (Array.isArray(ctxCharacters)) {
            return ctxCharacters;
        }

        if (typeof window !== 'undefined' && Array.isArray((window as any).characters)) {
            return (window as any).characters;
        }

        return [];
    }

    static getCharacterNames(): string[] {
        const helper = this.stHelper as any;
        if (helper && typeof helper.getCharacterNames === 'function') {
            try {
                const names = helper.getCharacterNames();
                if (Array.isArray(names)) {
                    return names
                        .filter((name): name is string => typeof name === 'string')
                        .map((name) => name.trim())
                        .filter(Boolean);
                }
            } catch {
                // Ignore helper failures and fall back to host character metadata.
            }
        }

        return this.getCharacters()
            .map((character) => typeof character?.name === 'string' ? character.name.trim() : '')
            .filter(Boolean);
    }

    static getCharacterNameById(characterId: string | number | null | undefined): string | null {
        const normalized = this.normalizeCharacterIndex(characterId);
        if (!normalized) {
            return null;
        }

        const index = Number(normalized);
        const names = this.getCharacterNames();
        if (index >= 0 && index < names.length) {
            const candidate = names[index]?.trim();
            if (candidate) {
                return candidate;
            }
        }

        const characters = this.getCharacters();
        const fallback = typeof characters[index]?.name === 'string' ? characters[index].name.trim() : '';
        return fallback || null;
    }

    static getCharacterAvatarUrlById(characterId: string | number | null | undefined): string | null {
        const normalized = this.normalizeCharacterIndex(characterId);
        if (!normalized) {
            return null;
        }

        return this.getCharacterRoster().find((character) => character.characterId === normalized)?.characterAvatarUrl ?? null;
    }

    private static getCharacterAvatarIdById(characterId: string | number | null | undefined): string | null {
        const normalized = this.normalizeCharacterIndex(characterId);
        if (!normalized) {
            return null;
        }

        const index = Number(normalized);
        const characters = this.getCharacters();
        const avatarId = typeof characters[index]?.avatar === 'string'
            ? characters[index].avatar.trim()
            : '';
        return avatarId || null;
    }

    static getCharacterRoster(): STCharacterRosterItem[] {
        const stMain = this.stMain as any;

        return this.getCharacters()
            .map((character, index): STCharacterRosterItem | null => {
                const characterName = typeof character?.name === 'string' ? character.name.trim() : '';
                if (!characterName) {
                    return null;
                }

                let characterAvatarUrl: string | null = null;
                const avatarId = typeof character?.avatar === 'string' ? character.avatar.trim() : '';
                if (avatarId) {
                    if (typeof stMain?.getThumbnailUrl === 'function') {
                        try {
                            const thumbnail = stMain.getThumbnailUrl('avatar', avatarId);
                            if (typeof thumbnail === 'string' && thumbnail.trim()) {
                                characterAvatarUrl = thumbnail.trim();
                            }
                        } catch {
                            // Ignore thumbnail resolution failures and fall back below.
                        }
                    }

                    if (!characterAvatarUrl) {
                        const helper = this.stHelper as any;
                        if (helper && typeof helper.getCharAvatarPath === 'function') {
                            try {
                                const avatarPath = helper.getCharAvatarPath(characterName);
                                if (typeof avatarPath === 'string' && avatarPath.trim()) {
                                    characterAvatarUrl = avatarPath.trim();
                                }
                            } catch {
                                // Ignore helper fallback failures and keep the avatar empty.
                            }
                        }
                    }
                }

                return {
                    characterId: String(index),
                    characterName,
                    characterAvatarUrl
                };
            })
            .filter((item): item is STCharacterRosterItem => item !== null);
    }

    private static getRawCharacterHelper(): {
        findCharacterIndex?: (name: string) => unknown;
    } | null {
        const helper = this.stHelper as any;
        const rawCharacter = helper?.RawCharacter;
        return rawCharacter && typeof rawCharacter === 'object' ? rawCharacter : rawCharacter || null;
    }

    private static normalizeCharacterIndex(value: unknown): string | null {
        if (typeof value !== 'string' && typeof value !== 'number') {
            return null;
        }

        const normalized = String(value).trim();
        return /^\d+$/.test(normalized) ? normalized : null;
    }

    private static toHostCharacterId(value: string | number): string | number {
        const normalized = String(value).trim();
        return /^\d+$/.test(normalized) ? Number(normalized) : value;
    }

    private static async waitForCondition(
        predicate: () => boolean,
        timeoutMs = 4000,
        intervalMs = 50,
        debugLabel = 'anonymous'
    ): Promise<boolean> {
        const deadline = Date.now() + timeoutMs;
        let attempts = 0;
        this.log(`waitForCondition:start:${debugLabel}`, {
            timeoutMs,
            intervalMs,
            snapshot: this.getHostSnapshot()
        });

        while (Date.now() <= deadline) {
            attempts += 1;
            try {
                if (predicate()) {
                    this.log(`waitForCondition:success:${debugLabel}`, {
                        attempts,
                        snapshot: this.getHostSnapshot()
                    });
                    return true;
                }
            } catch (error) {
                // Ignore transient host state errors and keep polling.
                this.warn(`waitForCondition:predicate-error:${debugLabel}`, error);
            }

            await new Promise((resolve) => setTimeout(resolve, intervalMs));
        }

        this.warn(`waitForCondition:timeout:${debugLabel}`, {
            attempts,
            snapshot: this.getHostSnapshot()
        });
        return false;
    }

    private static async waitForConditionWithHostEvents(
        predicate: () => boolean,
        options: {
            timeoutMs?: number;
            intervalMs?: number;
            debugLabel?: string;
            eventKeys?: Array<(typeof ST_EVENT)[keyof typeof ST_EVENT]>;
        } = {}
    ): Promise<boolean> {
        const timeoutMs = options.timeoutMs ?? 4000;
        const intervalMs = options.intervalMs ?? 50;
        const debugLabel = options.debugLabel ?? 'anonymous';
        const eventKeys = options.eventKeys ?? [
            ST_EVENT.CHAT_CHANGED,
            ST_EVENT.CHAT_LOADED,
            ST_EVENT.CHAT_CREATED,
            ST_EVENT.CHARACTER_PAGE_LOADED
        ];

        this.log(`waitForCondition:start:${debugLabel}`, {
            timeoutMs,
            intervalMs,
            eventKeys,
            snapshot: this.getHostSnapshot()
        });

        return new Promise<boolean>((resolve) => {
            const stEventSource = EnvDetector.stEventSource as {
                on?: (eventName: string, callback: (...args: any[]) => void) => void;
                off?: (eventName: string, callback: (...args: any[]) => void) => void;
            } | undefined;
            const eventTypes = EnvDetector.stEventTypes as Record<string, string> | undefined;
            const deadline = Date.now() + timeoutMs;
            let attempts = 0;
            let settled = false;
            let pollTimer: ReturnType<typeof setTimeout> | null = null;
            const listeners: Array<{ eventName: string; callback: () => void }> = [];

            const cleanup = () => {
                if (pollTimer) {
                    clearTimeout(pollTimer);
                    pollTimer = null;
                }
                for (const { eventName, callback } of listeners) {
                    try {
                        stEventSource?.off?.(eventName, callback);
                    } catch {
                        // Ignore listener cleanup failures on host bridges.
                    }
                }
            };

            const finish = (result: boolean) => {
                if (settled) {
                    return;
                }
                settled = true;
                cleanup();
                if (result) {
                    this.log(`waitForCondition:success:${debugLabel}`, {
                        attempts,
                        snapshot: this.getHostSnapshot()
                    });
                } else {
                    this.warn(`waitForCondition:timeout:${debugLabel}`, {
                        attempts,
                        snapshot: this.getHostSnapshot()
                    });
                }
                resolve(result);
            };

            const check = () => {
                attempts += 1;
                try {
                    if (predicate()) {
                        finish(true);
                        return;
                    }
                } catch (error) {
                    this.warn(`waitForCondition:predicate-error:${debugLabel}`, error);
                }

                if (Date.now() > deadline) {
                    finish(false);
                    return;
                }

                if (pollTimer) {
                    clearTimeout(pollTimer);
                }
                pollTimer = setTimeout(check, intervalMs);
            };

            if (stEventSource?.on && eventTypes) {
                for (const eventKey of eventKeys) {
                    const eventName = eventTypes[eventKey];
                    if (!eventName) {
                        continue;
                    }

                    const callback = () => {
                        if (settled) {
                            return;
                        }
                        check();
                    };
                    listeners.push({ eventName, callback });
                    stEventSource.on(eventName, callback);
                }
            }

            check();
        });
    }

    static getResolvedCurrentChatId(): string | null {
        const hostApi = this.getHostNavigationApi();
        if (typeof hostApi.getCurrentChatId === 'function') {
            const hostChatId = this.normalizeChatId(hostApi.getCurrentChatId());
            if (hostChatId) {
                return hostChatId;
            }
        }

        const ctxChatId = this.normalizeChatId((this.ctx as any)?.chatId);
        if (ctxChatId) {
            return ctxChatId;
        }

        const metadataChatId = this.normalizeChatId(
            typeof window !== 'undefined' ? (window as any)?.chat_metadata?.chat_id : null
        );
        if (metadataChatId) {
            return metadataChatId;
        }

        return null;
    }

    static getResolvedCurrentCharacterId(): string | null {
        const ctxCharacterId = this.normalizeCharacterId((this.ctx as any)?.characterId);
        if (ctxCharacterId) {
            return ctxCharacterId;
        }

        const globalCharacterId = this.normalizeCharacterId(
            typeof window !== 'undefined' ? (window as any)?.this_chid : null
        );
        if (globalCharacterId) {
            return globalCharacterId;
        }

        return null;
    }

    static resolveCharacterId(target: Pick<STCharacterChatSwitchTarget, 'characterId' | 'characterName' | 'characterAvatarUrl'>): string | null {
        const characters = this.getCharacters();
        const directIndex = this.normalizeCharacterIndex(target.characterId);
        if (characters.length === 0) {
            return directIndex;
        }

        if (directIndex && characters[Number(directIndex)] !== undefined) {
            return directIndex;
        }

        const normalizedAvatarUrl = typeof target.characterAvatarUrl === 'string'
            ? target.characterAvatarUrl.trim()
            : '';
        const normalizedName = typeof target.characterName === 'string'
            ? target.characterName.trim().toLowerCase()
            : '';
        const rawCharacter = this.getRawCharacterHelper();
        if (normalizedName && typeof rawCharacter?.findCharacterIndex === 'function') {
            const helperIndex = this.normalizeCharacterIndex(rawCharacter.findCharacterIndex(target.characterName!.trim()));
            if (helperIndex && characters[Number(helperIndex)] !== undefined) {
                return helperIndex;
            }
        }

        const stMain = this.stMain as any;

        const matchedIndex = characters.findIndex((character, index) => {
            if (!character) {
                return false;
            }

            if (normalizedAvatarUrl) {
                const avatarCandidates = new Set<string>();
                if (typeof character.avatar === 'string' && character.avatar.trim()) {
                    avatarCandidates.add(character.avatar.trim());
                    if (stMain && typeof stMain.getThumbnailUrl === 'function') {
                        try {
                            const thumbnail = stMain.getThumbnailUrl('avatar', character.avatar);
                            if (typeof thumbnail === 'string' && thumbnail.trim()) {
                                avatarCandidates.add(thumbnail.trim());
                            }
                        } catch {
                            // Ignore thumbnail resolution failures and continue with other candidates.
                        }
                    }
                }

                if (avatarCandidates.has(normalizedAvatarUrl)) {
                    return true;
                }
            }

            if (normalizedName) {
                const candidateName = typeof character.name === 'string' ? character.name.trim().toLowerCase() : '';
                if (candidateName && candidateName === normalizedName) {
                    return true;
                }
            }

            return directIndex !== null && String(index) === directIndex;
        });

        if (matchedIndex !== -1) {
            return String(matchedIndex);
        }

        return directIndex;
    }

    private static extractHistoryChatFile(entry: unknown): string | null {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
            return null;
        }

        const record = entry as Record<string, unknown>;
        const candidates = [record.file_name, record.fileName, record.chat_id, record.chatId, record.id];
        for (const candidate of candidates) {
            const normalized = this.normalizeChatId(candidate);
            if (normalized) {
                return normalized;
            }
        }

        return null;
    }

    private static buildChatSessionCharacterMeta(
        target: Pick<STCharacterChatSwitchTarget, 'characterId' | 'characterName' | 'characterAvatarUrl'>
    ): STChatSessionCharacterMeta | null {
        const characterId = this.resolveCharacterId(target);
        const directName = typeof target.characterName === 'string' ? target.characterName.trim() : '';
        const characterName = directName || (characterId ? this.getCharacterNameById(characterId) : null);
        const avatar = typeof target.characterAvatarUrl === 'string' && target.characterAvatarUrl.trim()
            ? target.characterAvatarUrl.trim()
            : null;

        if (!characterId && !characterName && !avatar) {
            return null;
        }

        return {
            characterId,
            characterName: characterName || null,
            characterAvatarUrl: avatar
        };
    }

    static cacheChatSessionCharacterMeta(
        chatFile: string | null | undefined,
        meta: STChatSessionCharacterMeta | null | undefined
    ): void {
        const normalizedChatFile = this.normalizeChatId(chatFile);
        if (!normalizedChatFile || !meta) {
            return;
        }

        const normalizedMeta: STChatSessionCharacterMeta = {
            characterId: meta.characterId ?? null,
            characterName: meta.characterName?.trim() || null,
            characterAvatarUrl: meta.characterAvatarUrl?.trim() || null
        };

        if (!normalizedMeta.characterId && !normalizedMeta.characterName && !normalizedMeta.characterAvatarUrl) {
            return;
        }

        this.chatFileCharacterMetaCache.set(normalizedChatFile, normalizedMeta);
        if (normalizedMeta.characterId) {
            this.chatFileCharacterCache.set(normalizedChatFile, normalizedMeta.characterId);
        }
    }

    private static getChatHistoryCandidateNames(
        target: Pick<STCharacterChatSwitchTarget, 'characterId' | 'characterName' | 'characterAvatarUrl'>
    ): string[] {
        const candidateNames = new Set<string>();
        if (typeof target.characterName === 'string' && target.characterName.trim()) {
            candidateNames.add(target.characterName.trim());
        }

        const resolvedCharacterId = this.resolveCharacterId(target);
        if (resolvedCharacterId) {
            const resolvedName = this.getCharacterNameById(resolvedCharacterId);
            if (resolvedName) {
                candidateNames.add(resolvedName);
            }
        }

        for (const name of this.getCharacterNames()) {
            if (name) {
                candidateNames.add(name);
            }
        }

        return [...candidateNames];
    }

    static async getChatSessionCharacterMeta(
        chatFile: string | null | undefined,
        target: Pick<STCharacterChatSwitchTarget, 'characterId' | 'characterName' | 'characterAvatarUrl'> = {}
    ): Promise<STChatSessionCharacterMeta | null> {
        const normalizedChatFile = this.normalizeChatId(chatFile);
        if (!normalizedChatFile) {
            return null;
        }

        const directMeta = this.buildChatSessionCharacterMeta(target);
        const cachedMeta = this.chatFileCharacterMetaCache.get(normalizedChatFile);
        if (cachedMeta) {
            this.log('getChatSessionCharacterMeta:cache-hit', {
                chatFile: normalizedChatFile,
                meta: cachedMeta
            });
            return {
                characterId: cachedMeta.characterId ?? directMeta?.characterId ?? null,
                characterName: cachedMeta.characterName ?? directMeta?.characterName ?? null,
                characterAvatarUrl: cachedMeta.characterAvatarUrl ?? directMeta?.characterAvatarUrl ?? null
            };
        }

        const inflight = this.chatFileCharacterMetaInflight.get(normalizedChatFile);
        if (inflight) {
            return inflight;
        }

        const lookupPromise = (async (): Promise<STChatSessionCharacterMeta | null> => {
            const helper = this.stHelper as any;
            if (!helper || typeof helper.getChatHistoryBrief !== 'function') {
                this.log('getChatSessionCharacterMeta:skip-no-helper', {
                    chatFile: normalizedChatFile,
                    hasHelper: Boolean(helper),
                    hasGetChatHistoryBrief: typeof helper?.getChatHistoryBrief === 'function'
                });
                return directMeta;
            }

            const candidateNames = this.getChatHistoryCandidateNames(target);
            for (const name of candidateNames) {
                try {
                    this.log('getChatSessionCharacterMeta:query-history', {
                        chatFile: normalizedChatFile,
                        candidateName: name
                    });
                    const history = await helper.getChatHistoryBrief(name, true);
                    if (!Array.isArray(history)) {
                        this.warn('getChatSessionCharacterMeta:invalid-history', {
                            candidateName: name,
                            history
                        });
                        continue;
                    }

                    const matched = history.some((entry: unknown) => this.extractHistoryChatFile(entry) === normalizedChatFile);
                    if (!matched) {
                        continue;
                    }

                    const matchedMeta: STChatSessionCharacterMeta = {
                        characterId: this.resolveCharacterId({
                            characterId: target.characterId ?? null,
                            characterName: name,
                            characterAvatarUrl: target.characterAvatarUrl ?? null
                        }),
                        characterName: name,
                        characterAvatarUrl: directMeta?.characterAvatarUrl ?? null
                    };

                    this.cacheChatSessionCharacterMeta(normalizedChatFile, matchedMeta);

                    this.log('getChatSessionCharacterMeta:matched', {
                        chatFile: normalizedChatFile,
                        meta: matchedMeta
                    });

                    return matchedMeta;
                } catch (error) {
                    this.warn('getChatSessionCharacterMeta:error', {
                        chatFile: normalizedChatFile,
                        candidateName: name,
                        error
                    });
                }
            }

            if (directMeta) {
                this.cacheChatSessionCharacterMeta(normalizedChatFile, directMeta);
            } else {
                this.log('getChatSessionCharacterMeta:not-found', {
                    chatFile: normalizedChatFile,
                    candidateCount: candidateNames.length
                });
            }
            return directMeta;
        })();

        this.chatFileCharacterMetaInflight.set(normalizedChatFile, lookupPromise);
        try {
            return await lookupPromise;
        } finally {
            this.chatFileCharacterMetaInflight.delete(normalizedChatFile);
        }
    }

    private static async resolveCharacterIdByChatHistory(target: STCharacterChatSwitchTarget): Promise<string | null> {
        const normalizedChatFile = this.normalizeChatId(target.chatFile);
        if (!normalizedChatFile) {
            this.log('resolveCharacterIdByChatHistory:skip', {
                normalizedChatFile,
            });
            return null;
        }

        const cachedCharacterId = this.chatFileCharacterCache.get(normalizedChatFile);
        if (cachedCharacterId) {
            this.log('resolveCharacterIdByChatHistory:cache-hit', {
                chatFile: normalizedChatFile,
                characterId: cachedCharacterId
            });
            return cachedCharacterId;
        }

        const resolvedMeta = await this.getChatSessionCharacterMeta(normalizedChatFile, target);
        return resolvedMeta?.characterId ?? null;
    }

    private static async resolveCharacterIdForSwitch(target: STCharacterChatSwitchTarget): Promise<string | null> {
        const resolvedFromSummary = this.resolveCharacterId(target);
        if (resolvedFromSummary) {
            this.log('resolveCharacterIdForSwitch:summary-hit', {
                target,
                resolvedCharacterId: resolvedFromSummary
            });
            return resolvedFromSummary;
        }

        this.warn('resolveCharacterIdForSwitch:summary-miss', { target });
        const resolvedFromHistory = await this.resolveCharacterIdByChatHistory(target);
        this.log('resolveCharacterIdForSwitch:history-result', {
            target,
            resolvedCharacterId: resolvedFromHistory
        });
        return resolvedFromHistory;
    }

    static async selectCharacterById(id: string | number, options: { switchMenu?: boolean } = {}): Promise<boolean> {
        const hostApi = this.getHostNavigationApi();
        if (typeof hostApi.selectCharacterById !== 'function') {
            this.warn('selectCharacterById:missing-api', {
                id,
                snapshot: this.getHostSnapshot()
            });
            return false;
        }

        const hostId = this.toHostCharacterId(id);
        this.log('selectCharacterById:before', {
            requestedId: id,
            hostId,
            options,
            snapshot: this.getHostSnapshot()
        });
        await hostApi.selectCharacterById(hostId, { switchMenu: options.switchMenu !== false });
        this.log('selectCharacterById:after-call', {
            hostId,
            snapshot: this.getHostSnapshot()
        });

        return this.waitForConditionWithHostEvents(
            () => this.getResolvedCurrentCharacterId() === String(hostId),
            {
                timeoutMs: 4000,
                intervalMs: 50,
                debugLabel: `selectCharacterById:${String(hostId)}`,
                eventKeys: [ST_EVENT.CHARACTER_PAGE_LOADED, ST_EVENT.CHAT_CHANGED, ST_EVENT.CHAT_LOADED]
            }
        );
    }

    static async openCharacterChat(fileName: string): Promise<boolean> {
        const normalizedChatId = this.normalizeChatId(fileName);
        const hostApi = this.getHostNavigationApi();
        if (!normalizedChatId || typeof hostApi.openCharacterChat !== 'function') {
            this.warn('openCharacterChat:missing-api-or-invalid-chat', {
                fileName,
                normalizedChatId,
                snapshot: this.getHostSnapshot()
            });
            return false;
        }

        this.log('openCharacterChat:before', {
            requestedChatFile: fileName,
            normalizedChatId,
            snapshot: this.getHostSnapshot()
        });
        await hostApi.openCharacterChat(normalizedChatId);
        this.log('openCharacterChat:after-call', {
            normalizedChatId,
            snapshot: this.getHostSnapshot()
        });

        return this.waitForConditionWithHostEvents(
            () => this.getResolvedCurrentChatId() === normalizedChatId,
            {
                timeoutMs: 4000,
                intervalMs: 50,
                debugLabel: `openCharacterChat:${normalizedChatId}`,
                eventKeys: [ST_EVENT.CHAT_CHANGED, ST_EVENT.CHAT_LOADED]
            }
        );
    }

    private static async waitForStableCurrentChatId(previousChatId: string | null, debugLabel: string): Promise<string | null> {
        let candidateChatId: string | null = null;
        let stableSamples = 0;
        const resolved = await this.waitForConditionWithHostEvents(
            () => {
                const currentChatId = this.getResolvedCurrentChatId();
                if (!currentChatId || currentChatId === previousChatId) {
                    candidateChatId = null;
                    stableSamples = 0;
                    return false;
                }

                if (candidateChatId === currentChatId) {
                    stableSamples += 1;
                } else {
                    candidateChatId = currentChatId;
                    stableSamples = 1;
                }

                return stableSamples >= 2;
            },
            {
                timeoutMs: 4000,
                intervalMs: 50,
                debugLabel,
                eventKeys: [ST_EVENT.CHAT_CREATED, ST_EVENT.CHAT_CHANGED, ST_EVENT.CHAT_LOADED]
            }
        );

        return resolved ? candidateChatId : null;
    }

    private static resolveCharacterMetaForTarget(
        target: Pick<STCharacterChatSwitchTarget, 'characterName' | 'characterAvatarUrl'>,
        resolvedCharacterId: string | null
    ): Pick<STCharacterChatMutationResult, 'resolvedCharacterName' | 'resolvedCharacterAvatarUrl'> {
        const resolvedNameFromId = resolvedCharacterId ? this.getCharacterNameById(resolvedCharacterId) : null;
        const resolvedAvatarFromId = resolvedCharacterId ? this.getCharacterAvatarUrlById(resolvedCharacterId) : null;
        const resolvedCharacterName = resolvedNameFromId
            || (typeof target.characterName === 'string' && target.characterName.trim()
                ? target.characterName.trim()
                : null);
        const resolvedCharacterAvatarUrl = resolvedAvatarFromId
            || (typeof target.characterAvatarUrl === 'string' && target.characterAvatarUrl.trim()
                ? target.characterAvatarUrl.trim()
                : null);

        return {
            resolvedCharacterName: resolvedCharacterName || null,
            resolvedCharacterAvatarUrl: resolvedCharacterAvatarUrl || null
        };
    }

    private static normalizeChatTitle(value: string | null | undefined): string | null {
        if (typeof value !== 'string') {
            return null;
        }

        const normalized = value.trim();
        return normalized ? normalized : null;
    }

    private static async listCharacterChatFiles(options: {
        characterId: string | null;
        characterName?: string | null;
        avatarId?: string | null;
    }): Promise<string[] | null> {
        const files = new Set<string>();
        const helper = this.stHelper as any;
        const candidateName = typeof options.characterName === 'string' ? options.characterName.trim() : '';
        if (helper && typeof helper.getChatHistoryBrief === 'function' && candidateName) {
            try {
                const history = await helper.getChatHistoryBrief(candidateName, true);
                if (Array.isArray(history)) {
                    history
                        .map((entry: unknown) => this.extractHistoryChatFile(entry))
                        .filter((fileName): fileName is string => Boolean(fileName))
                        .forEach((fileName) => files.add(fileName));
                }
            } catch (error) {
                this.log('listCharacterChatFiles:helper-error', {
                    characterName: candidateName,
                    error
                });
            }
        }

        const avatarId = typeof options.avatarId === 'string' ? options.avatarId.trim() : '';
        if (!avatarId) {
            return null;
        }

        try {
            const response = await this.fetchWithCsrf('/api/characters/chats', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    avatar_url: avatarId
                })
            });
            if (!response.ok) {
                return files.size > 0 ? Array.from(files) : null;
            }

            const payload = await response.json() as Record<string, unknown>;
            Object.values(payload)
                .map((entry: unknown) => this.extractHistoryChatFile(entry))
                .filter((fileName): fileName is string => Boolean(fileName))
                .forEach((fileName) => files.add(fileName));
            return files.size > 0 ? Array.from(files) : null;
        } catch (error) {
            this.log('listCharacterChatFiles:fetch-error', {
                characterId: options.characterId,
                avatarId,
                error
            });
            return files.size > 0 ? Array.from(files) : null;
        }
    }

    private static async isCharacterChatMissing(options: {
        chatFile: string;
        characterId: string | null;
        characterName?: string | null;
        avatarId?: string | null;
    }): Promise<boolean> {
        const files = await this.listCharacterChatFiles(options);
        if (!files) {
            return false;
        }
        return !files.includes(options.chatFile);
    }

    private static async resolveCharacterChatFile(options: {
        chatFile: string;
        characterId: string | null;
        characterName?: string | null;
        avatarId?: string | null;
    }): Promise<string | null> {
        const files = await this.listCharacterChatFiles(options);
        if (!files) {
            return options.chatFile;
        }

        const exactMatch = files.find((file) => file === options.chatFile);
        if (exactMatch) {
            return exactMatch;
        }
        this.error('resolveCharacterChatFile:mismatch', {
            targetChatFile: options.chatFile,
            candidateFiles: files,
            characterId: options.characterId,
            characterName: options.characterName ?? null,
            avatarId: options.avatarId ?? null,
            snapshot: this.getHostSnapshot()
        });
        return null;
    }

    private static clearHostChatMetadata(): void {
        const globalHost = EnvDetector.stGlobal as any;
        if (typeof window !== 'undefined') {
            (window as any).chat_metadata = {};
        }
        if (globalHost && typeof globalHost === 'object') {
            globalHost.chat_metadata = {};
        }
    }

    static async closeCurrentChatView(): Promise<boolean> {
        const hostApi = this.getHostNavigationApi();
        if (typeof hostApi.clearChat !== 'function' && typeof hostApi.setCharacterId !== 'function') {
            this.warn('closeCurrentChatView:missing-api', {
                snapshot: this.getHostSnapshot()
            });
            return false;
        }

        this.log('closeCurrentChatView:before', {
            snapshot: this.getHostSnapshot()
        });

        if (typeof hostApi.clearChat === 'function') {
            await hostApi.clearChat({ clearData: true });
        }
        if (typeof hostApi.setCharacterName === 'function') {
            hostApi.setCharacterName('');
        }
        if (typeof hostApi.setCharacterId === 'function') {
            hostApi.setCharacterId(undefined);
        }
        this.clearHostChatMetadata();

        return this.waitForConditionWithHostEvents(
            () => this.getResolvedCurrentChatId() === null,
            {
                timeoutMs: 2000,
                intervalMs: 50,
                debugLabel: 'closeCurrentChatView',
                eventKeys: [ST_EVENT.CHAT_CHANGED, ST_EVENT.CHAT_DELETED, ST_EVENT.CHAT_LOADED, ST_EVENT.CHARACTER_PAGE_LOADED]
            }
        );
    }

    static async switchToCharacterChat(target: STCharacterChatSwitchTarget): Promise<STCharacterChatMutationResult> {
        this.log('switchToCharacterChat:start', {
            target,
            snapshot: this.getHostSnapshot()
        });
        const resolvedCharacterId = await this.resolveCharacterIdForSwitch(target);
        const resolvedChatFile = this.normalizeChatId(target.chatFile);
        const currentCharacterId = this.getResolvedCurrentCharacterId();
        const resolvedCharacterMeta = this.resolveCharacterMetaForTarget(target, resolvedCharacterId);
        this.log('switchToCharacterChat:resolved-target', {
            target,
            resolvedCharacterId,
            resolvedChatFile,
            currentCharacterId,
            snapshot: this.getHostSnapshot()
        });

        if (!resolvedCharacterId) {
            if (resolvedChatFile && currentCharacterId) {
                this.warn('switchToCharacterChat:no-character-but-trying-chat-open', {
                    resolvedChatFile,
                    currentCharacterId
                });
                const chatSwitched = await this.openCharacterChat(resolvedChatFile);
                if (chatSwitched) {
                    this.log('switchToCharacterChat:chat-opened-with-current-character', {
                        resolvedChatFile,
                        currentCharacterId,
                        snapshot: this.getHostSnapshot()
                    });
                    return {
                        success: true,
                        resolvedCharacterId: currentCharacterId,
                        resolvedCharacterName: resolvedCharacterMeta.resolvedCharacterName,
                        resolvedCharacterAvatarUrl: resolvedCharacterMeta.resolvedCharacterAvatarUrl,
                        resolvedChatFile
                    };
                }
            }

            this.warn('switchToCharacterChat:abort-character-not-resolved', {
                target,
                resolvedChatFile,
                snapshot: this.getHostSnapshot()
            });
            return {
                success: false,
                resolvedCharacterId: null,
                resolvedCharacterName: resolvedCharacterMeta.resolvedCharacterName,
                resolvedCharacterAvatarUrl: resolvedCharacterMeta.resolvedCharacterAvatarUrl,
                resolvedChatFile,
                reason: 'character_not_resolved'
            };
        }

        if (!resolvedChatFile) {
            this.warn('switchToCharacterChat:abort-chat-file-missing', {
                target,
                resolvedCharacterId,
                currentCharacterId,
                snapshot: this.getHostSnapshot()
            });
            return {
                success: false,
                resolvedCharacterId,
                resolvedCharacterName: resolvedCharacterMeta.resolvedCharacterName,
                resolvedCharacterAvatarUrl: resolvedCharacterMeta.resolvedCharacterAvatarUrl,
                resolvedChatFile: null,
                reason: 'chat_file_missing'
            };
        }

        const targetAvatarId = this.getCharacterAvatarIdById(resolvedCharacterId);
        const resolvedExistingChatFile = await this.resolveCharacterChatFile({
            chatFile: resolvedChatFile,
            characterId: resolvedCharacterId,
            characterName: resolvedCharacterMeta.resolvedCharacterName,
            avatarId: targetAvatarId
        });
        if (!resolvedExistingChatFile) {
            this.warn('switchToCharacterChat:abort-chat-missing', {
                target,
                resolvedCharacterId,
                resolvedChatFile,
                snapshot: this.getHostSnapshot()
            });
            return {
                success: false,
                resolvedCharacterId,
                resolvedCharacterName: resolvedCharacterMeta.resolvedCharacterName,
                resolvedCharacterAvatarUrl: resolvedCharacterMeta.resolvedCharacterAvatarUrl,
                resolvedChatFile,
                reason: 'chat_not_found'
            };
        }
        const effectiveChatFile = resolvedExistingChatFile;

        if (currentCharacterId !== resolvedCharacterId) {
            this.log('switchToCharacterChat:character-switch-required', {
                currentCharacterId,
                resolvedCharacterId
            });
            const characterSwitched = await this.selectCharacterById(resolvedCharacterId);
            if (!characterSwitched) {
                this.warn('switchToCharacterChat:character-switch-failed', {
                    currentCharacterId,
                    resolvedCharacterId,
                    snapshot: this.getHostSnapshot()
                });
                return {
                    success: false,
                    resolvedCharacterId,
                    resolvedCharacterName: resolvedCharacterMeta.resolvedCharacterName,
                    resolvedCharacterAvatarUrl: resolvedCharacterMeta.resolvedCharacterAvatarUrl,
                    resolvedChatFile: effectiveChatFile,
                    reason: 'character_switch_failed'
                };
            }
        }

        const currentChatId = this.getResolvedCurrentChatId();
        if (currentChatId !== effectiveChatFile) {
            this.log('switchToCharacterChat:chat-switch-required', {
                currentChatId,
                resolvedChatFile: effectiveChatFile
            });
            const chatSwitched = await this.openCharacterChat(effectiveChatFile);
            if (!chatSwitched) {
                this.warn('switchToCharacterChat:chat-switch-failed', {
                    currentChatId,
                    resolvedChatFile: effectiveChatFile,
                    snapshot: this.getHostSnapshot()
                });
                return {
                    success: false,
                    resolvedCharacterId,
                    resolvedCharacterName: resolvedCharacterMeta.resolvedCharacterName,
                    resolvedCharacterAvatarUrl: resolvedCharacterMeta.resolvedCharacterAvatarUrl,
                    resolvedChatFile: effectiveChatFile,
                    reason: 'chat_switch_failed'
                };
            }
        }

        this.log('switchToCharacterChat:success', {
            resolvedCharacterId,
            resolvedChatFile: effectiveChatFile,
            snapshot: this.getHostSnapshot()
        });
        return {
            success: true,
            resolvedCharacterId,
            resolvedCharacterName: resolvedCharacterMeta.resolvedCharacterName,
            resolvedCharacterAvatarUrl: resolvedCharacterMeta.resolvedCharacterAvatarUrl,
            resolvedChatFile: effectiveChatFile
        };
    }

    static async createNewCharacterChat(
        target: Pick<STCharacterChatSwitchTarget, 'characterId' | 'characterName' | 'characterAvatarUrl'>
    ): Promise<STCharacterChatMutationResult> {
        this.log('createNewCharacterChat:start', {
            target,
            snapshot: this.getHostSnapshot()
        });

        const hostApi = this.getHostNavigationApi();
        const hasDirectCreateApi = typeof hostApi.doNewChat === 'function';
        const hasSlashCreateApi = typeof hostApi.executeSlashCommandsWithOptions === 'function';
        if (!hasDirectCreateApi && !hasSlashCreateApi) {
            this.warn('createNewCharacterChat:missing-api', {
                target,
                snapshot: this.getHostSnapshot()
            });
            return {
                success: false,
                resolvedCharacterId: null,
                resolvedCharacterName: null,
                resolvedCharacterAvatarUrl: null,
                resolvedChatFile: null,
                reason: 'create_chat_api_missing'
            };
        }

        const resolvedCharacterId = await this.resolveCharacterIdForSwitch(target);
        const resolvedCharacterMeta = this.resolveCharacterMetaForTarget(target, resolvedCharacterId);
        // 记录初始会话 ID，用于后续判断切换操作是否触发了宿主的自动创建行为
        const initialChatId = this.getResolvedCurrentChatId();
        const currentCharacterId = this.getResolvedCurrentCharacterId();

        if (!resolvedCharacterId) {
            this.warn('createNewCharacterChat:character-not-resolved', {
                target,
                snapshot: this.getHostSnapshot()
            });
            return {
                success: false,
                resolvedCharacterId: null,
                resolvedCharacterName: resolvedCharacterMeta.resolvedCharacterName,
                resolvedCharacterAvatarUrl: resolvedCharacterMeta.resolvedCharacterAvatarUrl,
                resolvedChatFile: null,
                reason: 'character_not_resolved'
            };
        }

        const targetAvatarId = this.getCharacterAvatarIdById(resolvedCharacterId);
        // 预检查目标角色的会话列表。
        // SillyTavern 在切换到一个没有任何会话的角色时，会自动触发一次新建对话动作。
        // 我们通过预检查会话数是否为 0 来标记是否预期会发生这种“自动创建”。
        const initialChatFiles = await this.listCharacterChatFiles({
            characterId: resolvedCharacterId,
            characterName: resolvedCharacterMeta.resolvedCharacterName,
            avatarId: targetAvatarId
        });
        const isAutoCreationExpected = Array.isArray(initialChatFiles) && initialChatFiles.length === 0;

        if (currentCharacterId !== resolvedCharacterId) {
            const characterSwitched = await this.selectCharacterById(resolvedCharacterId);
            if (!characterSwitched) {
                this.warn('createNewCharacterChat:character-switch-failed', {
                    target,
                    resolvedCharacterId,
                    snapshot: this.getHostSnapshot()
                });
                return {
                    success: false,
                    resolvedCharacterId,
                    resolvedCharacterName: resolvedCharacterMeta.resolvedCharacterName,
                    resolvedCharacterAvatarUrl: resolvedCharacterMeta.resolvedCharacterAvatarUrl,
                    resolvedChatFile: null,
                    reason: 'character_switch_failed'
                };
            }
        }

        const afterSwitchChatId = this.getResolvedCurrentChatId();
        this.log('createNewCharacterChat:after-switch', {
            target,
            resolvedCharacterId,
            initialChatId,
            afterSwitchChatId,
            isAutoCreationExpected,
            snapshot: this.getHostSnapshot()
        });

        // 【识别自动创建】：
        // 如果预期有自动创建（原本无会话），且切换角色后 chatId 确实发生了变化，
        // 则认为宿主已经代劳创建了一个新会话。
        // 此时我们直接复用该会话，而不再下发显式的 /newchat 指令，从而避免产生双重空记录。
        if (isAutoCreationExpected && afterSwitchChatId && afterSwitchChatId !== initialChatId) {
            const verifiedMeta = await this.getChatSessionCharacterMeta(afterSwitchChatId, target);
            // 二次校验确认该自动生成的会话身份确实匹配目标角色
            if (verifiedMeta?.characterId === resolvedCharacterId) {
                this.log('createNewCharacterChat:auto-creation-detected', {
                    resolvedCharacterId,
                    afterSwitchChatId,
                    snapshot: this.getHostSnapshot()
                });
                this.cacheChatSessionCharacterMeta(afterSwitchChatId, {
                    characterId: resolvedCharacterId,
                    characterName: resolvedCharacterMeta.resolvedCharacterName,
                    characterAvatarUrl: resolvedCharacterMeta.resolvedCharacterAvatarUrl
                });
                return {
                    success: true,
                    resolvedCharacterId,
                    resolvedCharacterName: resolvedCharacterMeta.resolvedCharacterName,
                    resolvedCharacterAvatarUrl: resolvedCharacterMeta.resolvedCharacterAvatarUrl,
                    resolvedChatFile: afterSwitchChatId
                };
            }
        }

        const previousChatId = afterSwitchChatId;
        this.log('createNewCharacterChat:before-host-call', {
            target,
            resolvedCharacterId,
            previousChatId,
            hasDirectCreateApi,
            hasSlashCreateApi,
            snapshot: this.getHostSnapshot()
        });

        if (hasDirectCreateApi) {
            await hostApi.doNewChat!({ deleteCurrentChat: false });
        } else {
            const slashResult = await hostApi.executeSlashCommandsWithOptions!('/newchat');
            const maybeResult = slashResult as {
                isError?: boolean;
                isAborted?: boolean;
                errorMessage?: string;
                abortReason?: string;
            } | null;

            if (maybeResult?.isError || maybeResult?.isAborted) {
                this.warn('createNewCharacterChat:slash-command-failed', {
                    target,
                    resolvedCharacterId,
                    slashResult,
                    snapshot: this.getHostSnapshot()
                });
                return {
                    success: false,
                    resolvedCharacterId,
                    resolvedCharacterName: resolvedCharacterMeta.resolvedCharacterName,
                    resolvedCharacterAvatarUrl: resolvedCharacterMeta.resolvedCharacterAvatarUrl,
                    resolvedChatFile: null,
                    reason: maybeResult?.errorMessage || maybeResult?.abortReason || 'slash_newchat_failed'
                };
            }
        }

        const resolvedChatFile = await this.waitForStableCurrentChatId(
            previousChatId,
            `createNewCharacterChat:${resolvedCharacterId}`
        );

        if (!resolvedChatFile) {
            this.warn('createNewCharacterChat:chat-id-not-stable', {
                target,
                resolvedCharacterId,
                previousChatId,
                snapshot: this.getHostSnapshot()
            });
            return {
                success: false,
                resolvedCharacterId,
                resolvedCharacterName: resolvedCharacterMeta.resolvedCharacterName,
                resolvedCharacterAvatarUrl: resolvedCharacterMeta.resolvedCharacterAvatarUrl,
                resolvedChatFile: null,
                reason: 'chat_id_not_stable'
            };
        }

        this.log('createNewCharacterChat:success', {
            target,
            resolvedCharacterId,
            resolvedChatFile,
            snapshot: this.getHostSnapshot()
        });
        this.cacheChatSessionCharacterMeta(resolvedChatFile, {
            characterId: resolvedCharacterId,
            characterName: resolvedCharacterMeta.resolvedCharacterName,
            characterAvatarUrl: resolvedCharacterMeta.resolvedCharacterAvatarUrl
        });
        return {
            success: true,
            resolvedCharacterId,
            resolvedCharacterName: resolvedCharacterMeta.resolvedCharacterName,
            resolvedCharacterAvatarUrl: resolvedCharacterMeta.resolvedCharacterAvatarUrl,
            resolvedChatFile
        };
    }

    static async renameCharacterChat(input: STRenameCharacterChatInput): Promise<STRenameCharacterChatResult> {
        const previousChatFile = this.normalizeChatId(input.oldChatFile);
        const newChatTitle = this.normalizeChatTitle(input.newChatTitle);
        this.log('renameCharacterChat:start', {
            input: {
                ...input,
                oldChatFile: previousChatFile,
                newChatTitle
            },
            snapshot: this.getHostSnapshot()
        });

        if (!previousChatFile) {
            return {
                success: false,
                resolvedCharacterId: null,
                resolvedCharacterName: null,
                resolvedCharacterAvatarUrl: null,
                resolvedChatFile: null,
                previousChatFile: null,
                reason: 'chat_file_missing'
            };
        }

        if (!newChatTitle) {
            return {
                success: false,
                resolvedCharacterId: null,
                resolvedCharacterName: null,
                resolvedCharacterAvatarUrl: null,
                resolvedChatFile: previousChatFile,
                previousChatFile,
                reason: 'chat_title_missing'
            };
        }

        const hostApi = this.getHostNavigationApi();
        const hasRenameApi = typeof hostApi.renameChat === 'function' || typeof hostApi.renameGroupOrCharacterChat === 'function';
        if (!hasRenameApi) {
            this.warn('renameCharacterChat:missing-api', {
                input,
                snapshot: this.getHostSnapshot()
            });
            return {
                success: false,
                resolvedCharacterId: null,
                resolvedCharacterName: null,
                resolvedCharacterAvatarUrl: null,
                resolvedChatFile: previousChatFile,
                previousChatFile,
                reason: 'rename_chat_api_missing'
            };
        }

        const resolvedCharacterId = await this.resolveCharacterIdForSwitch(input);
        const resolvedCharacterMeta = this.resolveCharacterMetaForTarget(input, resolvedCharacterId);
        if (!resolvedCharacterId) {
            return {
                success: false,
                resolvedCharacterId: null,
                resolvedCharacterName: resolvedCharacterMeta.resolvedCharacterName,
                resolvedCharacterAvatarUrl: resolvedCharacterMeta.resolvedCharacterAvatarUrl,
                resolvedChatFile: previousChatFile,
                previousChatFile,
                reason: 'character_not_resolved'
            };
        }

        if (this.getResolvedCurrentCharacterId() !== resolvedCharacterId) {
            const characterSwitched = await this.selectCharacterById(resolvedCharacterId);
            if (!characterSwitched) {
                return {
                    success: false,
                    resolvedCharacterId,
                    resolvedCharacterName: resolvedCharacterMeta.resolvedCharacterName,
                    resolvedCharacterAvatarUrl: resolvedCharacterMeta.resolvedCharacterAvatarUrl,
                    resolvedChatFile: previousChatFile,
                    previousChatFile,
                    reason: 'character_switch_failed'
                };
            }
        }

        this.log('renameCharacterChat:before-host-call', {
            previousChatFile,
            newChatTitle,
            resolvedCharacterId,
            hasRenameChat: typeof hostApi.renameChat === 'function',
            hasRenameGroupOrCharacterChat: typeof hostApi.renameGroupOrCharacterChat === 'function',
            snapshot: this.getHostSnapshot()
        });

        if (typeof hostApi.renameChat === 'function') {
            await hostApi.renameChat(previousChatFile, newChatTitle);
        } else {
            await hostApi.renameGroupOrCharacterChat!({
                characterId: this.toHostCharacterId(resolvedCharacterId),
                oldFileName: previousChatFile,
                newFileName: newChatTitle,
                loader: false
            });
        }

        const resolvedChatFile = await this.waitForConditionWithHostEvents(
            () => this.getResolvedCurrentChatId() === newChatTitle || this.normalizeChatId(newChatTitle) === newChatTitle,
            {
                timeoutMs: 2000,
                intervalMs: 50,
                debugLabel: `renameCharacterChat:${resolvedCharacterId}`,
                eventKeys: [ST_EVENT.CHAT_CHANGED, ST_EVENT.CHAT_LOADED]
            }
        ) ? newChatTitle : newChatTitle;

        this.cacheChatSessionCharacterMeta(resolvedChatFile, {
            characterId: resolvedCharacterId,
            characterName: resolvedCharacterMeta.resolvedCharacterName,
            characterAvatarUrl: resolvedCharacterMeta.resolvedCharacterAvatarUrl
        });
        this.chatFileCharacterMetaCache.delete(previousChatFile);
        this.chatFileCharacterCache.delete(previousChatFile);

        this.log('renameCharacterChat:success', {
            previousChatFile,
            resolvedChatFile,
            resolvedCharacterId,
            snapshot: this.getHostSnapshot()
        });

        return {
            success: true,
            resolvedCharacterId,
            resolvedCharacterName: resolvedCharacterMeta.resolvedCharacterName,
            resolvedCharacterAvatarUrl: resolvedCharacterMeta.resolvedCharacterAvatarUrl,
            resolvedChatFile,
            previousChatFile
        };
    }

    static async deleteCharacterChat(input: STDeleteCharacterChatInput): Promise<STCharacterChatMutationResult> {
        const normalizedChatFile = this.normalizeChatId(input.chatFile);
        this.log('deleteCharacterChat:start', {
            input: {
                ...input,
                chatFile: normalizedChatFile
            },
            snapshot: this.getHostSnapshot()
        });

        if (!normalizedChatFile) {
            return {
                success: false,
                resolvedCharacterId: null,
                resolvedCharacterName: null,
                resolvedCharacterAvatarUrl: null,
                resolvedChatFile: null,
                reason: 'chat_file_missing'
            };
        }

        const hostApi = this.getHostNavigationApi();
        const resolvedCharacterId = await this.resolveCharacterIdForSwitch(input);
        const resolvedCharacterMeta = this.resolveCharacterMetaForTarget(input, resolvedCharacterId);
        if (!resolvedCharacterId) {
            return {
                success: false,
                resolvedCharacterId: null,
                resolvedCharacterName: resolvedCharacterMeta.resolvedCharacterName,
                resolvedCharacterAvatarUrl: resolvedCharacterMeta.resolvedCharacterAvatarUrl,
                resolvedChatFile: normalizedChatFile,
                reason: 'character_not_resolved'
            };
        }

        const currentChatId = this.getResolvedCurrentChatId();
        const isDeletingCurrentChat = currentChatId === normalizedChatFile;
        const canUseDirectDeleteApi = typeof hostApi.deleteCharacterChatByName === 'function';
        const canUseDeleteSlash = typeof hostApi.executeSlashCommandsWithOptions === 'function' && currentChatId === normalizedChatFile;
        const avatarId = this.getCharacterAvatarIdById(resolvedCharacterId);
        const canUseFetchDelete = Boolean(avatarId);
        const characterNameForLookup = resolvedCharacterMeta.resolvedCharacterName;

        if (await this.isCharacterChatMissing({
            chatFile: normalizedChatFile,
            characterId: resolvedCharacterId,
            characterName: characterNameForLookup,
            avatarId
        })) {
            this.log('deleteCharacterChat:already-missing', {
                resolvedCharacterId,
                normalizedChatFile,
                isDeletingCurrentChat,
                snapshot: this.getHostSnapshot()
            });
            if (isDeletingCurrentChat) {
                await this.closeCurrentChatView();
            }
            this.chatFileCharacterMetaCache.delete(normalizedChatFile);
            this.chatFileCharacterCache.delete(normalizedChatFile);
            this.chatFileCharacterMetaInflight.delete(normalizedChatFile);
            return {
                success: true,
                resolvedCharacterId,
                resolvedCharacterName: resolvedCharacterMeta.resolvedCharacterName,
                resolvedCharacterAvatarUrl: resolvedCharacterMeta.resolvedCharacterAvatarUrl,
                resolvedChatFile: normalizedChatFile
            };
        }

        if (!canUseDirectDeleteApi && !canUseDeleteSlash && !canUseFetchDelete) {
            this.warn('deleteCharacterChat:missing-api', {
                input,
                resolvedCharacterId,
                currentChatId,
                canUseDeleteSlash,
                hasAvatarId: Boolean(avatarId),
                snapshot: this.getHostSnapshot()
            });
            return {
                success: false,
                resolvedCharacterId,
                resolvedCharacterName: resolvedCharacterMeta.resolvedCharacterName,
                resolvedCharacterAvatarUrl: resolvedCharacterMeta.resolvedCharacterAvatarUrl,
                resolvedChatFile: normalizedChatFile,
                reason: 'delete_chat_api_missing'
            };
        }

        // 【前置关闭视图】：
        // 如果删除的是当前正在查看的对话，必须在执行物理删除动作之前关闭视图。
        // 这确保了宿主（ST）在文件消失前能够安全释放文件句柄并重置 UI 状态负载。
        if (isDeletingCurrentChat) {
            await this.closeCurrentChatView();
        }

        if (canUseDirectDeleteApi) {
            await hostApi.deleteCharacterChatByName!(this.toHostCharacterId(resolvedCharacterId), normalizedChatFile);
        } else if (canUseDeleteSlash) {
            const slashResult = await hostApi.executeSlashCommandsWithOptions!('/delchat');
            const maybeResult = slashResult as {
                isError?: boolean;
                isAborted?: boolean;
                errorMessage?: string;
                abortReason?: string;
            } | null;
            if (maybeResult?.isError || maybeResult?.isAborted) {
                return {
                    success: false,
                    resolvedCharacterId,
                    resolvedCharacterName: resolvedCharacterMeta.resolvedCharacterName,
                    resolvedCharacterAvatarUrl: resolvedCharacterMeta.resolvedCharacterAvatarUrl,
                    resolvedChatFile: normalizedChatFile,
                    reason: maybeResult?.errorMessage || maybeResult?.abortReason || 'slash_delchat_failed'
                };
            }
        } else {
            const response = await this.fetchWithCsrf('/api/chats/delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    chatfile: `${normalizedChatFile}.jsonl`,
                    avatar_url: avatarId
                })
            });
            if (!response.ok) {
                if (await this.isCharacterChatMissing({
                    chatFile: normalizedChatFile,
                    characterId: resolvedCharacterId,
                    characterName: characterNameForLookup,
                    avatarId
                })) {
                    this.log('deleteCharacterChat:treated-as-success-after-failed-delete', {
                        resolvedCharacterId,
                        normalizedChatFile,
                        responseStatus: response.status,
                        snapshot: this.getHostSnapshot()
                    });
                } else {
                    return {
                        success: false,
                        resolvedCharacterId,
                        resolvedCharacterName: resolvedCharacterMeta.resolvedCharacterName,
                        resolvedCharacterAvatarUrl: resolvedCharacterMeta.resolvedCharacterAvatarUrl,
                        resolvedChatFile: normalizedChatFile,
                        reason: `delete_chat_failed_${response.status}`
                    };
                }
            }
        }


        this.chatFileCharacterMetaCache.delete(normalizedChatFile);
        this.chatFileCharacterCache.delete(normalizedChatFile);
        this.chatFileCharacterMetaInflight.delete(normalizedChatFile);

        this.log('deleteCharacterChat:success', {
            resolvedCharacterId,
            normalizedChatFile,
            snapshot: this.getHostSnapshot()
        });

        return {
            success: true,
            resolvedCharacterId,
            resolvedCharacterName: resolvedCharacterMeta.resolvedCharacterName,
            resolvedCharacterAvatarUrl: resolvedCharacterMeta.resolvedCharacterAvatarUrl,
            resolvedChatFile: normalizedChatFile
        };
    }

    static invalidateCsrfToken(): void {
        this._csrfToken = null;
        this._csrfTime = 0;
    }

    static async refreshCsrfToken(): Promise<string> {
        this.invalidateCsrfToken();
        return this.getCsrfToken();
    }

    static isInvalidCsrfError(error: unknown): boolean {
        return error instanceof Error && error.message === this.INVALID_CSRF_ERROR;
    }

    static async isInvalidCsrfResponse(response: Response): Promise<boolean> {
        if (response.status !== 403) return false;

        try {
            const text = await response.clone().text();
            return /csrf/i.test(text) || /invalid csrf token/i.test(text);
        } catch {
            return /csrf/i.test(response.statusText);
        }
    }

    static createInvalidCsrfError(): Error {
        return new Error(this.INVALID_CSRF_ERROR);
    }

    static async getCsrfToken(): Promise<string> {
        // 如果正在请求中，直接复用已有的 Promise
        if (this._fetchPromise) return this._fetchPromise;

        const isExpired = Date.now() - this._csrfTime > 300000;
        if (!this._csrfToken || isExpired) {
            this._fetchPromise = (async () => {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);
                
                try {
                    const tokenRes = await fetch('/csrf-token', { signal: controller.signal });
                    if (!tokenRes.ok) throw new Error(`CSRF Token 获取失败 (HTTP ${tokenRes.status})`);
                    
                    const tokenData = await tokenRes.json();
                    if (!tokenData?.token) throw new Error('CSRF Token 数据格式异常');

                    this._csrfToken = tokenData.token;
                    this._csrfTime = Date.now();
                    return this._csrfToken as string;
                } catch (e: any) {
                    console.error('[STClient] 获取 CSRF Token 异常:', e.name === 'AbortError' ? '请求超时 (5s)' : e.message);
                    // 如果获取失败，但原本已有 Token（即便过期了点点），可能仍可尝试复用，除非是彻底没 Token
                    if (this._csrfToken) return this._csrfToken;
                    throw e;
                } finally {
                    clearTimeout(timeoutId);
                    this._fetchPromise = null;
                }
            })();
            return this._fetchPromise;
        }
        return this._csrfToken || '';
    }

    static getRawMessages(options: { includeSwipes?: boolean } = {}): any[] {
        const helper = this.stHelper;
        if (helper && typeof helper.getChatMessages === 'function') {
            try {
                const res = helper.getChatMessages('0-{{lastMessageId}}', { include_swipes: true });
                if (Array.isArray(res)) {
                    const filtered = res.filter(Boolean);
                    return filtered.map((msg, index) => this._normalizeHelperMessage(msg, index, filtered.length));
                }
            } catch (e) {
                if (!EnvDetector.isSilenceMode) console.warn('[STClient] getChatMessages 失败，准备回退:', e);
            }
        }

        if (!EnvDetector.isSilenceMode) console.warn('[STClient] 尝试从 Context 回退...');
        const ctx = this.ctx;
        const messages = ctx?.chat;
        console.log(`[STClient] 从上下文获取 chat 数组，长度: ${Array.isArray(messages) ? messages.length : 'null/undefined'}`);
        
        if (!Array.isArray(messages)) {
            if (!EnvDetector.isSilenceMode) console.warn('STClient: 无法从上下文获取 chat 数组，环境可能未就绪。返回空数组以避免异常。');
            return [];
        }
        
        type STCtxMessageLike = {
            mes?: string;
            role?: string;
            message_id?: number;
            data?: Record<string, unknown>;
        };

        return messages.filter(Boolean).map((m, index) => {
            const extra = this._normalizeExtra((m.extra || {}) as Record<string, unknown>);
            const mLike = m as unknown as STCtxMessageLike;
            let resolvedRole = (extra.role as string | undefined) || mLike.role || (m.is_user ? 'user' : 'assistant');
            if (m.is_user && resolvedRole !== 'user') resolvedRole = 'user';
            
            return {
                message_id: mLike.message_id ?? index,
                name: m.name || '',
                role: resolvedRole,
                is_hidden: m.is_system || false,
                message: mLike.mes || '',
                mes: mLike.mes || '',
                data: mLike.data || {},
                extra: { 
                    ...extra,
                    message_id: mLike.message_id ?? index,
                    id: extra.id
                }
            };
        });
    }

    private static _normalizeExtra(extra: Record<string, unknown>): Record<string, unknown> {
        let out: Record<string, unknown> = { ...extra };
        for (let i = 0; i < 3; i++) {
            const nested = out.extra;
            if (!nested || typeof nested !== 'object' || Array.isArray(nested)) break;
            const nestedObj = nested as Record<string, unknown>;
            const { extra: _ignored, ...rest } = out;
            out = { ...rest, ...nestedObj };
        }
        return out;
    }

    private static _resolveActiveSwipeIndex(msg: any): number | undefined {
        const swipeId = typeof msg?.swipe_id === 'number' ? msg.swipe_id : undefined;
        if (!Array.isArray(msg?.swipes) || msg.swipes.length === 0) {
            return swipeId;
        }
        if (swipeId === undefined || swipeId < 0 || swipeId >= msg.swipes.length) {
            return undefined;
        }
        return swipeId;
    }

    private static _resolveActiveSwipeText(msg: any): string {
        const swipeId = this._resolveActiveSwipeIndex(msg);
        if (swipeId !== undefined && Array.isArray(msg?.swipes)) {
            const swipeText = msg.swipes[swipeId];
            if (typeof swipeText === 'string') {
                return swipeText;
            }
        }
        if (typeof msg?.message === 'string') return msg.message;
        if (typeof msg?.mes === 'string') return msg.mes;
        return '';
    }

    private static _resolveActiveSwipeExtra(msg: any): Record<string, unknown> {
        const swipeId = this._resolveActiveSwipeIndex(msg);
        if (swipeId === undefined || !Array.isArray(msg?.swipes_info)) {
            return {};
        }
        const swipeInfo = msg.swipes_info[swipeId];
        if (!swipeInfo || typeof swipeInfo !== 'object') {
            return {};
        }
        const rawExtra = (swipeInfo as Record<string, unknown>).extra;
        if (!rawExtra || typeof rawExtra !== 'object' || Array.isArray(rawExtra)) {
            return {};
        }
        return this._normalizeExtra(rawExtra as Record<string, unknown>);
    }

    private static _applyTavernRegex(
        text: string,
        source: 'user_input' | 'ai_output' | 'slash_command' | 'world_info' | 'reasoning',
        destination: 'display' | 'prompt',
        options: { depth?: number } = {}
    ): string {
        const helper = this.stHelper;
        if (helper && typeof helper.formatAsTavernRegexedString === 'function') {
            try {
                return helper.formatAsTavernRegexedString(text, source, destination, options);
            } catch (e) {
                console.warn('[STClient] formatAsTavernRegexedString 调用失败，回退原文:', e);
            }
        }
        return text;
    }

    private static _normalizeHelperMessage(msg: any, index: number, total: number): any {
        const baseExtra = this._normalizeExtra(((msg as Record<string, unknown>).extra || {}) as Record<string, unknown>);
        const activeSwipeIndex = this._resolveActiveSwipeIndex(msg);
        const activeSwipeText = this._resolveActiveSwipeText(msg);
        const activeSwipeExtra = this._resolveActiveSwipeExtra(msg);
        const swipeCount = Array.isArray(msg?.swipes) ? msg.swipes.length : 0;
        const hasSwipeVariants = swipeCount > 1 && activeSwipeIndex !== undefined;

        const mergedExtra: Record<string, unknown> = {
            ...baseExtra,
            ...activeSwipeExtra
        };

        if (hasSwipeVariants) {
            const branchScopedKeys = ['id', 'fingerprint', 'stFingerprint', 'mesRaw', 'mesST', 'pluginRaw', 'thinkingText', 'mesSummary'];
            for (const key of branchScopedKeys) {
                if (!(key in activeSwipeExtra)) {
                    delete mergedExtra[key];
                }
            }
        }

        if (typeof msg?.message_id === 'number') {
            mergedExtra.message_id = msg.message_id;
        }
        if (activeSwipeIndex !== undefined) {
            mergedExtra.swipe_id = activeSwipeIndex;
        }
        if (swipeCount > 0) {
            mergedExtra.swipeCount = swipeCount;
        }
        mergedExtra.activeSwipeText = activeSwipeText;

        const normalizedRole = STProtocol.normalizeRole(mergedExtra.role ?? msg?.role, msg?.role === 'user');
        const source = normalizedRole === 'user' ? 'user_input' : 'ai_output';
        const depth = Math.max(total - 1 - index, 0);
        const displayText = this._applyTavernRegex(activeSwipeText, source, 'display', { depth });

        return {
            ...msg,
            role: normalizedRole,
            message: activeSwipeText,
            mes: displayText,
            extra: {
                ...mergedExtra,
                role: normalizedRole
            }
        };
    }

    private static _formatToSTRaw(msg: Partial<LuminaChatMessage> & { message?: string }): any {
        const isUser = msg.role === 'user';
        const isSystem = msg.role === 'system';
        const normalizedRole = STProtocol.normalizeRole(msg.role, !!msg.is_user);
        const normalizedExtra = this._normalizeExtra({ ...(msg.extra || {}), role: normalizedRole });
        const stWritePayload = {
            ...msg,
            extra: normalizedExtra,
            mesST: msg.mesST ?? (typeof normalizedExtra.mesST === 'string' ? normalizedExtra.mesST as string : undefined),
            mesRaw: msg.mesRaw ?? (typeof normalizedExtra.mesRaw === 'string' ? normalizedExtra.mesRaw as string : undefined)
        };
        const payload: any = {
            name: msg.name || (isUser ? 'You' : 'Assistant'),
            role: normalizedRole || ((msg.role as ('system' | 'assistant' | 'user') | undefined) || (isUser ? 'user' : (isSystem ? 'system' : 'assistant'))),
            message: msg.message ?? STProtocol.resolveForSTWrite(stWritePayload),
            extra: normalizedExtra
        };

        payload.is_hidden = msg.is_hidden ?? false;
        
        return payload;
    }

    static async updateMessages(updates: STMessageUpdate[], skipFlush = false): Promise<void> {
        if (updates.length === 0) return;
        const helper = this.stHelper;
        if (!helper || typeof helper.setChatMessages !== 'function' || typeof helper.getChatMessages !== 'function') {
            console.error('[STClient] 无法执行 updateMessages: 缺少 TavernHelper API');
            return;
        }

        const targets: any[] = [];
        for (const update of updates) {
            try {
                const existingMsgs = helper.getChatMessages(`${update.index}-${update.index}`, { include_swipes: true });
                const existingMsg = existingMsgs && existingMsgs.length > 0 ? existingMsgs[0] : null;

                if (!existingMsg) {
                    console.warn(`[STClient] updateMessages: 无法找到索引 ${update.index} 的消息`);
                    continue;
                }

                const targetPayload: any = { message_id: existingMsg.message_id };
                const currentSwipeId = this._resolveActiveSwipeIndex(existingMsg);
                const currentActiveSwipeText = this._resolveActiveSwipeText(existingMsg);
                const expectSwipeMatched =
                    update.expectedSwipeId === undefined
                    || currentSwipeId === update.expectedSwipeId;
                const expectTextMatched =
                    update.expectedActiveSwipeText === undefined
                    || currentActiveSwipeText === update.expectedActiveSwipeText;
                const allowBodyWrite = expectSwipeMatched && expectTextMatched;
                const isBodyChange = update.content !== currentActiveSwipeText;

                if (update.name) {
                    targetPayload.name = update.name;
                }
                if (update.role) {
                    targetPayload.role = STProtocol.normalizeRole(update.role, update.role === 'user');
                }
                if (update.is_hidden !== undefined) {
                    targetPayload.is_hidden = update.is_hidden;
                    targetPayload.is_system = update.is_hidden;
                }

                if (allowBodyWrite) {
                    targetPayload.message = update.content;
                } else if (isBodyChange) {
                    console.warn(
                        `[STClient] 检测到 swipe 已切换，跳过对 message_id=${existingMsg.message_id} 的正文覆写 ` +
                        `(expectedSwipe=${String(update.expectedSwipeId)}, currentSwipe=${String(currentSwipeId)})`
                    );
                    continue;
                }

                if (update.extra) {
                    const existingExtra = this._normalizeExtra(((existingMsg as any).extra || {}) as Record<string, unknown>);
                    const nextExtra = this._normalizeExtra(update.extra);
                    const merged = { ...existingExtra, ...nextExtra };
                    if (merged.role !== undefined) {
                        merged.role = STProtocol.normalizeRole(merged.role, merged.role === 'user');
                    }
                    targetPayload.extra = merged;
                }

                if (Array.isArray(existingMsg.swipes) && currentSwipeId !== undefined && currentSwipeId >= 0 && currentSwipeId < existingMsg.swipes.length) {
                    targetPayload.swipes = [...existingMsg.swipes];
                    if (allowBodyWrite) {
                        targetPayload.swipes[currentSwipeId] = update.content;
                    }

                    const existingSwipesInfo = Array.isArray(existingMsg.swipes_info) ? [...existingMsg.swipes_info] : [];
                    while (existingSwipesInfo.length < targetPayload.swipes.length) {
                        existingSwipesInfo.push({});
                    }
                    const currentSwipeInfo = existingSwipesInfo[currentSwipeId];
                    const currentSwipeInfoRecord =
                        currentSwipeInfo && typeof currentSwipeInfo === 'object' && !Array.isArray(currentSwipeInfo)
                            ? { ...(currentSwipeInfo as Record<string, unknown>) }
                            : {};
                    const currentSwipeExtra = this._normalizeExtra((currentSwipeInfoRecord.extra || {}) as Record<string, unknown>);
                    const nextSwipeExtra = {
                        ...currentSwipeExtra,
                        ...(targetPayload.extra || {}),
                        message_id: existingMsg.message_id,
                        swipe_id: currentSwipeId,
                        swipeCount: targetPayload.swipes.length,
                        activeSwipeText: allowBodyWrite ? update.content : currentActiveSwipeText
                    };
                    currentSwipeInfoRecord.extra = nextSwipeExtra;
                    existingSwipesInfo[currentSwipeId] = currentSwipeInfoRecord;
                    targetPayload.swipes_info = existingSwipesInfo;
                }

                targets.push(targetPayload);
            } catch (e) {
                console.error(`[STClient] updateMessages 处理索引 ${update.index} 异常:`, e);
            }
        }

        if (targets.length > 0) {
            await helper.setChatMessages(targets, { refresh: 'none' });
            if (!skipFlush) await this.flush();
        }
    }

    static async updateMessage(index: number, msgContent: string, name?: string, role?: string, extraData: Record<string, any> = {}, skipFlush = false): Promise<void> {
        await this.updateMessages([{ index, content: msgContent, name, role, extra: extraData }], skipFlush);
    }

    private static async stFetch(url: string, body: Record<string, any>): Promise<Response> {
        return await this.fetchWithCsrf(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
    }

    static async fetchWithCsrf(url: string, options: RequestInit = {}, allowRetry = true): Promise<Response> {
        const performFetch = async (csrfToken: string) => {
            const headers = new Headers(options.headers || {});
            headers.set('X-CSRF-Token', csrfToken);
            return await fetch(url, {
                ...options,
                headers
            });
        };

        let response = await performFetch(await this.getCsrfToken());
        if (!allowRetry) return response;

        if (await this.isInvalidCsrfResponse(response)) {
            console.warn('[STClient] 检测到失效 CSRF Token，自动刷新后重试请求');
            response = await performFetch(await this.refreshCsrfToken());
        }

        return response;
    }

    static async appendMessages(msgs: Partial<LuminaChatMessage>[], skipFlush = false): Promise<void> {
        if (msgs.length === 0) return;

        console.log(`[STClient] 执行 API 批量追加 (${msgs.length} 条)...`);
        const helper = this.stHelper;

        if (helper && typeof helper.createChatMessages === 'function') {
            const stFormattedMsgs = msgs.map(m => this._formatToSTRaw(m));
            try {
                await helper.createChatMessages(stFormattedMsgs, { refresh: 'none' });
            } catch (e) {
                console.error('[STClient] createChatMessages 失败:', e);
            }
        } else {
            console.error('[STClient] 无法找到 TavernHelper，追加消息失败');
        }

        if (!skipFlush) await this.flush();
    }

    static async appendMessage(msg: Partial<LuminaChatMessage>, skipFlush = false): Promise<void> {
        await this.appendMessages([msg], skipFlush);
    }

    static async deleteMessages(indices: number[], skipFlush = false): Promise<void> {
        if (indices.length === 0) return;
        const sortedIndices = [...indices].sort((a, b) => b - a);
        const helper = this.stHelper;
        if (!helper || typeof helper.deleteChatMessages !== 'function') {
            console.error('[STClient] 无法找到 TavernHelper API，删除消息失败');
            return;
        }

        try {
            const currentRaw = this.getRawMessages();
            const idsToDelete: number[] = [];

            for (const idx of sortedIndices) {
                const msg = currentRaw[idx];
                if (msg && typeof msg.message_id === 'number') {
                    idsToDelete.push(msg.message_id);
                } else {
                    idsToDelete.push(Number(idx));
                }
            }

            if (idsToDelete.length > 0) {
                await helper.deleteChatMessages(idsToDelete, { refresh: 'none' });
                if (!skipFlush) await this.flush();
            }
        } catch (e) {
            console.error('[STClient] deleteChatMessages 失败:', e);
        }
    }

    static async deleteMessage(index: number, skipFlush = false): Promise<void> {
        await this.deleteMessages([index], skipFlush);
    }

    static async flush(): Promise<void> {
        const st = this.stMain;
        if (st && typeof st.saveChat === 'function') {
            await st.saveChat();
        }

        const helper = this.stHelper;
        if (helper && helper.builtin && typeof helper.builtin.reloadAndRenderChatWithoutEvents === 'function') {
            try {
                await helper.builtin.reloadAndRenderChatWithoutEvents();
                return;
            } catch (e) {
                console.error('[STClient] reloadAndRenderChatWithoutEvents 失败，尝试回退:', e);
            }
        }

        const ctx = this.stMain;
        if (ctx && typeof ctx.reloadCurrentChat === 'function') {
            await ctx.reloadCurrentChat();
        } else if (typeof window !== 'undefined' && typeof (window as any).renderChat === 'function') {
            (window as any).renderChat();
        }
    }

    static async getPreset(name: string): Promise<Record<string, any> | null> {
        const helper = this.stHelper;
        if (helper && typeof helper.getPreset === 'function') {
            return helper.getPreset(name);
        }
        return null;
    }

    static substituteMacros(content: string): string {
        if (!content) return '';

        const glob = EnvDetector.stGlobal;
        const substituteParams = glob?.substituteParams || (typeof window !== 'undefined' && (window as any).substituteParams);
        if (typeof substituteParams === 'function') {
            try {
                return substituteParams(content);
            } catch (e) {
                console.warn('[STClient] substituteParams 调用失败:', e);
            }
        }

        const helper = this.stHelper;
        if (helper && typeof helper.substitudeMacros === 'function') {
            try {
                return helper.substitudeMacros(content);
            } catch (e) {
                console.warn('[STClient] substitudeMacros 调用失败:', e);
            }
        }

        return content;
    }

    static getInstructSettings(): any {
        const st = this.stMain as any;
        return {
            enabled: st?.powerUserSettings?.instruct?.enabled ?? false,
            template: st?.powerUserSettings?.instruct ?? {},
            settings: st?.chatCompletionSettings || {}
        };
    }

    static getMainApi(): string {
        return (this.stMain as any)?.mainApi || 'openai';
    }

    static async getTokenCount(text: string): Promise<number> {
        const getTokenCountAsync = (this.stMain as any)?.getTokenCountAsync;
        if (typeof getTokenCountAsync === 'function') {
            try {
                return await getTokenCountAsync(text);
            } catch (e) {
                console.error('[STClient] getTokenCountAsync 执行异常:', e);
            }
        }
        return Math.ceil(text.length / 4);
    }

    static getActiveWorldInfoItems(): { id: string, content: string, role: number }[] {
        const glob = EnvDetector.stGlobal as any;
        const activatedItems: any[] = glob?.world_info_active || (typeof window !== 'undefined' && (window as any).world_info_active) || [];

        if (Array.isArray(activatedItems)) {
            return activatedItems.map(item => ({
                id: item.id || item.uid || 'wi_item',
                content: item.content || '',
                role: item.role ?? 0
            }));
        }

        return [];
    }

    // --- 预设管理桥接 (ST 原生) ---

    static getPresets(type: string): string[] {
        const glob = typeof window !== 'undefined' ? (window as any) : {};
        const manager = glob.getPresetManager?.(type);
        return manager?.getAllPresets() || [];
    }

    static getActivePresetName(type: string): string | null {
        const glob = typeof window !== 'undefined' ? (window as any) : {};
        const manager = glob.getPresetManager?.(type);
        return manager?.getSelectedPresetName() || null;
    }

    static selectPreset(type: string, name: string): void {
        const glob = typeof window !== 'undefined' ? (window as any) : {};
        const manager = glob.getPresetManager?.(type);
        if (manager && typeof manager.selectPreset === 'function') {
            manager.selectPreset(name);
        }
    }
}
