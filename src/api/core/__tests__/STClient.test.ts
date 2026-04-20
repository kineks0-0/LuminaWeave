import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EnvDetector } from '../EnvDetector.js';
import { ST_EVENT } from '../STEvent';
import { STClient } from '../st-adapter/STClient';

describe('STClient - extra normalization', () => {
    let helper: any;
    let stMain: any;
    let ctx: any;
    let stGlobal: any;
    let stEventSource: any;
    let stEventTypes: any;

    beforeEach(() => {
        helper = undefined;
        stMain = undefined;
        ctx = undefined;
        stGlobal = {};
        stEventSource = undefined;
        stEventTypes = undefined;
        vi.useRealTimers();
        vi.restoreAllMocks();
        vi.spyOn(EnvDetector, 'stHelper', 'get').mockImplementation(() => helper);
        vi.spyOn(EnvDetector, 'stMain', 'get').mockImplementation(() => stMain as any);
        vi.spyOn(EnvDetector, 'ctx', 'get').mockImplementation(() => ctx as any);
        vi.spyOn(EnvDetector, 'stGlobal', 'get').mockImplementation(() => stGlobal as any);
        vi.spyOn(EnvDetector, 'stEventSource', 'get').mockImplementation(() => stEventSource as any);
        vi.spyOn(EnvDetector, 'stEventTypes', 'get').mockImplementation(() => stEventTypes as any);
    });

    it('updateMessages should flatten nested extra.extra into extra', async () => {
        type MockCalls = { mock: { calls: unknown[][] } };

        const setChatMessages = vi.fn(async () => {});
        const getChatMessages = vi.fn(() => [{
            message_id: 2,
            message: 'old',
            extra: { oldKey: 1 }
        }]);

        helper = {
            setChatMessages,
            getChatMessages
        };

        await STClient.updateMessages([{
            index: 0,
            content: 'new',
            extra: {
                extra: {
                    id: 'node_2',
                    compressionState: 'summary'
                }
            }
        }], true);

        expect(setChatMessages).toHaveBeenCalledTimes(1);
        const calls = (setChatMessages as unknown as MockCalls).mock.calls;
        const firstCall = calls[0];
        expect(Array.isArray(firstCall)).toBe(true);
        const payload = (firstCall?.[0] as unknown);
        expect(Array.isArray(payload)).toBe(true);
        const firstTarget = (payload as unknown[])[0] as { extra?: Record<string, unknown> };
        expect(firstTarget.extra?.id).toBe('node_2');
        expect(firstTarget.extra?.compressionState).toBe('summary');
        expect((firstTarget.extra as Record<string, unknown> | undefined)?.extra).toBeUndefined();
        expect(firstTarget.extra?.oldKey).toBe(1);
    });

    it('appendMessages should flatten nested extra.extra into extra', async () => {
        type MockCalls = { mock: { calls: unknown[][] } };

        const createChatMessages = vi.fn(async () => {});
        helper = {
            createChatMessages
        };

        await STClient.appendMessages([{
            role: 'assistant',
            name: 'A',
            mesRaw: 'hi',
            extra: {
                extra: { id: 'node_3' },
                compressionState: 'summary'
            }
        }], true);

        expect(createChatMessages).toHaveBeenCalledTimes(1);
        const calls = (createChatMessages as unknown as MockCalls).mock.calls;
        const firstCall = calls[0];
        expect(Array.isArray(firstCall)).toBe(true);
        const payload = (firstCall?.[0] as unknown);
        expect(Array.isArray(payload)).toBe(true);
        const firstMsg = (payload as unknown[])[0] as { extra?: Record<string, unknown> };
        expect(firstMsg.extra?.id).toBe('node_3');
        expect(firstMsg.extra?.compressionState).toBe('summary');
        expect((firstMsg.extra as Record<string, unknown> | undefined)?.extra).toBeUndefined();
    });

    it('appendMessages should prefer mesST over mesRaw and mes when writing ST message', async () => {
        type MockCalls = { mock: { calls: unknown[][] } };

        const createChatMessages = vi.fn(async () => {});
        helper = {
            createChatMessages
        };

        await STClient.appendMessages([{
            role: 'assistant',
            name: 'A',
            mesST: 'st-body',
            mesRaw: 'raw-body',
            mes: 'display-body',
            extra: {
                mesST: 'extra-st',
                mesRaw: 'extra-raw'
            }
        }], true);

        const calls = (createChatMessages as unknown as MockCalls).mock.calls;
        const payload = (calls[0]?.[0] as unknown[])?.[0] as { message?: string };
        expect(payload.message).toBe('st-body');
    });

    it('appendMessages should fall back to extra.mesRaw when top-level mesST and mesRaw are absent', async () => {
        type MockCalls = { mock: { calls: unknown[][] } };

        const createChatMessages = vi.fn(async () => {});
        helper = {
            createChatMessages
        };

        await STClient.appendMessages([{
            role: 'assistant',
            name: 'A',
            mes: 'display-body',
            extra: {
                mesRaw: 'raw-from-extra'
            }
        }], true);

        const calls = (createChatMessages as unknown as MockCalls).mock.calls;
        const payload = (calls[0]?.[0] as unknown[])?.[0] as { message?: string };
        expect(payload.message).toBe('raw-from-extra');
    });

    it('getRawMessages should project active swipe text and regexed display text', () => {
        const getChatMessages = vi.fn(() => [{
            message_id: 7,
            name: 'Assistant',
            role: 'assistant',
            is_hidden: false,
            message: 'old active',
            swipe_id: 1,
            swipes: ['first raw', 'second raw'],
            swipes_info: [
                { extra: { id: 'node_swipe_0', fingerprint: 'fp_0' } },
                { extra: { id: 'node_swipe_1', fingerprint: 'fp_1', mesRaw: 'second raw' } }
            ],
            extra: { id: 'st_floor_id', fingerprint: 'fp_floor' }
        }]);
        const formatAsTavernRegexedString = vi.fn((text: string, _source: string, _destination: string, options?: { depth?: number }) => {
            return `display:${text}:depth=${options?.depth ?? 'none'}`;
        });

        helper = {
            getChatMessages,
            formatAsTavernRegexedString
        };

        const messages = STClient.getRawMessages({ includeSwipes: true });

        expect(messages).toHaveLength(1);
        expect(messages[0].message).toBe('second raw');
        expect(messages[0].mes).toBe('display:second raw:depth=0');
        expect(messages[0].extra.id).toBe('node_swipe_1');
        expect(messages[0].extra.message_id).toBe(7);
        expect(messages[0].extra.swipe_id).toBe(1);
        expect(messages[0].extra.swipeCount).toBe(2);
        expect(messages[0].extra.activeSwipeText).toBe('second raw');
    });

    it('updateMessages should skip body overwrite when swipe_id no longer matches', async () => {
        const setChatMessages = vi.fn(async () => {});
        const getChatMessages = vi.fn(() => [{
            message_id: 5,
            role: 'assistant',
            message: 'current swipe text',
            swipe_id: 1,
            swipes: ['older', 'current swipe text'],
            swipes_info: [{}, {}],
            extra: { id: 'node_current' }
        }]);

        helper = {
            setChatMessages,
            getChatMessages
        };

        await STClient.updateMessages([{
            index: 0,
            content: 'rewrite old branch',
            expectedSwipeId: 0,
            expectedActiveSwipeText: 'older',
            extra: { id: 'node_old_branch' }
        }], true);

        expect(setChatMessages).not.toHaveBeenCalled();
    });

    it('getResolvedCurrentChatId should treat invalid host ids as closed-chat state even if synced message metadata remains', () => {
        const getChatMessages = vi.fn(() => [{
            message_id: 0,
            message: 'welcome',
            extra: { _lw_sync_chat_id: 'chat_sync_fallback' }
        }]);

        helper = { getChatMessages };
        stMain = {
            getCurrentChatId: () => 'default'
        };
        ctx = {
            chatId: undefined
        };

        expect(STClient.getResolvedCurrentChatId()).toBeNull();
    });

    it('switchToCharacterChat should select the target character before opening the target chat file', async () => {
        const state = {
            currentCharacterId: undefined as string | undefined,
            currentChatId: undefined as string | undefined,
            characters: [
                { name: 'Alpha', avatar: 'alpha.png', chat: 'chat_alpha_default' },
                { name: 'Beta', avatar: 'beta.png', chat: 'chat_beta_default' }
            ]
        };

        const selectCharacterById = vi.fn(async (id: number | string) => {
            const normalizedId = String(id);
            state.currentCharacterId = normalizedId;
            state.currentChatId = state.characters[Number(normalizedId)]?.chat;
        });
        const openCharacterChat = vi.fn(async (fileName: string) => {
            state.currentChatId = fileName;
        });

        helper = {
            getChatHistoryBrief: vi.fn(async (name: string) => {
                if (name === 'Beta') {
                    return [{ file_name: 'chat_beta_archive' }];
                }
                return [{ file_name: 'chat_alpha_default' }];
            })
        };
        stMain = {
            getCurrentChatId: () => state.currentChatId,
            getThumbnailUrl: (_type: string, file: string) => `/thumbnail/avatar/${file}`,
            selectCharacterById,
            openCharacterChat
        };
        ctx = {
            get chatId() {
                return state.currentChatId;
            },
            get characterId() {
                return state.currentCharacterId;
            },
            characters: state.characters
        };

        const result = await STClient.switchToCharacterChat({
            characterId: 1,
            characterName: 'Beta',
            characterAvatarUrl: '/thumbnail/avatar/beta.png',
            chatFile: 'chat_beta_archive'
        });

        expect(result.success).toBe(true);
        expect(selectCharacterById).toHaveBeenCalledWith(1, { switchMenu: true });
        expect(openCharacterChat).toHaveBeenCalledWith('chat_beta_archive');
        expect(state.currentCharacterId).toBe('1');
        expect(state.currentChatId).toBe('chat_beta_archive');
    });

    it('switchToCharacterChat should abort before selecting a character when no target chat file is available', async () => {
        const state = {
            currentCharacterId: '0',
            currentChatId: 'chat_alpha_default',
            characters: [
                { name: 'Alpha', avatar: 'alpha.png', chat: 'chat_alpha_default' },
                { name: 'Beta', avatar: 'beta.png', chat: 'chat_beta_default' }
            ]
        };

        const selectCharacterById = vi.fn(async (id: number | string) => {
            state.currentCharacterId = String(id);
            state.currentChatId = state.characters[Number(id)]?.chat;
        });

        stMain = {
            getCurrentChatId: () => state.currentChatId,
            selectCharacterById
        };
        ctx = {
            get chatId() {
                return state.currentChatId;
            },
            get characterId() {
                return state.currentCharacterId;
            },
            characters: state.characters
        };

        const result = await STClient.switchToCharacterChat({
            characterId: 1,
            characterName: 'Beta',
            characterAvatarUrl: '/thumbnail/avatar/beta.png',
            chatFile: null
        });

        expect(result.success).toBe(false);
        expect(result.reason).toBe('chat_file_missing');
        expect(selectCharacterById).not.toHaveBeenCalled();
        expect(state.currentCharacterId).toBe('0');
        expect(state.currentChatId).toBe('chat_alpha_default');
    });

    it('switchToCharacterChat should recover the host character index from TavernHelper chat history when summary metadata is insufficient', async () => {
        const state = {
            currentCharacterId: undefined as string | undefined,
            currentChatId: undefined as string | undefined,
            characters: [
                { name: 'Alpha', avatar: 'alpha.png', chat: 'chat_alpha_default' },
                { name: 'Beta', avatar: 'beta.png', chat: 'chat_beta_default' }
            ]
        };

        const selectCharacterById = vi.fn(async (id: number | string) => {
            const normalizedId = String(id);
            state.currentCharacterId = normalizedId;
            state.currentChatId = state.characters[Number(normalizedId)]?.chat;
        });
        const openCharacterChat = vi.fn(async (fileName: string) => {
            state.currentChatId = fileName;
        });

        helper = {
            RawCharacter: {
                findCharacterIndex: (name: string) => name === 'Beta' ? 1 : 0
            },
            getCharacterNames: () => ['Alpha', 'Beta'],
            getChatHistoryBrief: vi.fn(async (name: string) => {
                if (name === 'Beta') {
                    return [{ file_name: 'chat_beta_archive' }];
                }
                return [{ file_name: 'chat_alpha_default' }];
            })
        };
        stMain = {
            getCurrentChatId: () => state.currentChatId,
            selectCharacterById,
            openCharacterChat
        };
        ctx = {
            get chatId() {
                return state.currentChatId;
            },
            get characterId() {
                return state.currentCharacterId;
            },
            characters: state.characters
        };

        const result = await STClient.switchToCharacterChat({
            characterId: 'char_beta',
            characterName: '',
            characterAvatarUrl: null,
            chatFile: 'chat_beta_archive'
        });

        expect(result.success).toBe(true);
        expect(selectCharacterById).toHaveBeenCalledWith(1, { switchMenu: true });
        expect(openCharacterChat).toHaveBeenCalledWith('chat_beta_archive');
    });

    it('getChatSessionCharacterMeta should recover missing session character metadata from TavernHelper chat history', async () => {
        helper = {
            getCharacterNames: () => ['Alpha', 'Beta', 'Gamma'],
            getChatHistoryBrief: vi.fn(async (name: string) => {
                if (name === 'Gamma') {
                    return [{ file_name: 'chat_gamma_archive' }];
                }
                return [{ file_name: `chat_${name.toLowerCase()}_default` }];
            })
        };
        ctx = {
            characters: [
                { name: 'Alpha', avatar: 'alpha.png' },
                { name: 'Beta', avatar: 'beta.png' },
                { name: 'Gamma', avatar: 'gamma.png' }
            ]
        };

        const meta = await STClient.getChatSessionCharacterMeta('chat_gamma_archive', {
            characterId: null,
            characterName: '',
            characterAvatarUrl: null
        });

        expect(meta).toEqual({
            characterId: '2',
            characterName: 'Gamma',
            characterAvatarUrl: null
        });
        expect(helper.getChatHistoryBrief).toHaveBeenCalledWith('Gamma', true);
    });

    it('switchToCharacterChat should use ctx host navigation APIs when stMain does not expose them', async () => {
        const state = {
            currentCharacterId: undefined as string | undefined,
            currentChatId: undefined as string | undefined,
            characters: [
                { name: 'Alpha', avatar: 'alpha.png', chat: 'chat_alpha_default' },
                { name: 'Beta', avatar: 'beta.png', chat: 'chat_beta_default' },
                { name: 'Gamma', avatar: 'gamma.png', chat: 'chat_gamma_default' },
                { name: 'Dungeon Narrator', avatar: 'dungeon.png', chat: 'chat_dungeon_default' }
            ]
        };

        const ctxSelectCharacterById = vi.fn(async (id: number | string) => {
            const normalizedId = String(id);
            state.currentCharacterId = normalizedId;
            state.currentChatId = state.characters[Number(normalizedId)]?.chat;
        });
        const ctxOpenCharacterChat = vi.fn(async (fileName: string) => {
            state.currentChatId = fileName;
        });

        helper = {
            getChatHistoryBrief: vi.fn(async (name: string) => {
                if (name === 'Dungeon Narrator') {
                    return [{ file_name: '地牢叙事者 - 2026-04-16@22h18m26s' }];
                }
                return [];
            })
        };
        stMain = {
            getThumbnailUrl: (_type: string, file: string) => `/thumbnail/avatar/${file}`
        };
        ctx = {
            getCurrentChatId: () => state.currentChatId,
            get chatId() {
                return state.currentChatId;
            },
            get characterId() {
                return state.currentCharacterId;
            },
            characters: state.characters,
            selectCharacterById: ctxSelectCharacterById,
            openCharacterChat: ctxOpenCharacterChat
        };

        const result = await STClient.switchToCharacterChat({
            characterId: 3,
            characterName: 'Dungeon Narrator',
            characterAvatarUrl: '/thumbnail/avatar/dungeon.png',
            chatFile: '地牢叙事者 - 2026-04-16@22h18m26s'
        });

        expect(result.success).toBe(true);
        expect(ctxSelectCharacterById).toHaveBeenCalledWith(3, { switchMenu: true });
        expect(ctxOpenCharacterChat).toHaveBeenCalledWith('地牢叙事者 - 2026-04-16@22h18m26s');
    });

    it('switchToCharacterChat should fall back to avatar-based chat lookup when the provided character name is stale', async () => {
        const state = {
            currentCharacterId: '1',
            currentChatId: 'Seraphina - 2026-04-19@22h59m34s108ms',
            characters: [
                { name: 'Alpha', avatar: 'alpha.png', chat: 'chat_alpha_default' },
                { name: 'Seraphina', avatar: 'seraphina.png', chat: 'Seraphina - 2026-04-19@22h59m34s108ms' },
                { name: '戎震虎', avatar: 'rongzhenhu.png', chat: '戎震虎 - 2026-04-17@16h34m15s' }
            ]
        };

        const selectCharacterById = vi.fn(async (id: number | string) => {
            const normalizedId = String(id);
            state.currentCharacterId = normalizedId;
            state.currentChatId = state.characters[Number(normalizedId)]?.chat;
        });
        const openCharacterChat = vi.fn(async (fileName: string) => {
            state.currentChatId = fileName;
        });
        const fetchWithCsrf = vi.spyOn(STClient, 'fetchWithCsrf').mockResolvedValue({
            ok: true,
            json: async () => ({
                '0': { file_name: '戎震虎 - 2026-04-17@16h34m15s' }
            })
        } as Response);

        helper = {
            getChatHistoryBrief: vi.fn(async (name: string) => {
                if (name === '地牢叙事者') {
                    return [{ file_name: '地牢叙事者 - 2026-04-18@00h00m00s' }];
                }
                return [];
            })
        };
        stMain = {
            getCurrentChatId: () => state.currentChatId,
            getThumbnailUrl: (_type: string, file: string) => `/thumbnail/avatar/${file}`,
            selectCharacterById,
            openCharacterChat
        };
        ctx = {
            get chatId() {
                return state.currentChatId;
            },
            get characterId() {
                return state.currentCharacterId;
            },
            characters: state.characters
        };

        const result = await STClient.switchToCharacterChat({
            characterId: 2,
            characterName: '地牢叙事者',
            characterAvatarUrl: '/thumbnail/avatar/%E5%9C%B0%E7%89%A2%E5%8F%99%E4%BA%8B%E8%80%85.png',
            chatFile: '戎震虎 - 2026-04-17@16h34m15s'
        });

        expect(result.success).toBe(true);
        expect(result.resolvedCharacterName).toBe('戎震虎');
        expect(fetchWithCsrf).toHaveBeenCalledWith(
            '/api/characters/chats',
            expect.objectContaining({
                method: 'POST'
            })
        );
        expect(selectCharacterById).toHaveBeenCalledWith(2, { switchMenu: true });
        expect(state.currentChatId).toBe('戎震虎 - 2026-04-17@16h34m15s');
        expect(openCharacterChat).not.toHaveBeenCalled();
    });

    it('switchToCharacterChat should fail with an error log when host chat filenames still do not match after normalization', async () => {
        const state = {
            currentCharacterId: '0',
            currentChatId: 'chat_alpha_default',
            characters: [
                { name: 'Alpha', avatar: 'alpha.png', chat: 'chat_alpha_default' },
                { name: 'Seraphina', avatar: 'seraphina.png', chat: 'chat_seraphina_default' }
            ]
        };

        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const selectCharacterById = vi.fn(async (id: number | string) => {
            const normalizedId = String(id);
            state.currentCharacterId = normalizedId;
            state.currentChatId = state.characters[Number(normalizedId)]?.chat;
        });
        const openCharacterChat = vi.fn(async (fileName: string) => {
            state.currentChatId = fileName;
        });

        helper = {
            getChatHistoryBrief: vi.fn(async (name: string) => {
                if (name === 'Seraphina') {
                    return [{ file_name: 'Seraphina - 2026-04-20@00h00m44s.jsonl' }];
                }
                return [];
            })
        };
        stMain = {
            getCurrentChatId: () => state.currentChatId,
            getThumbnailUrl: (_type: string, file: string) => `/thumbnail/avatar/${file}`,
            selectCharacterById,
            openCharacterChat
        };
        ctx = {
            get chatId() {
                return state.currentChatId;
            },
            get characterId() {
                return state.currentCharacterId;
            },
            characters: state.characters
        };

        const result = await STClient.switchToCharacterChat({
            characterId: 1,
            characterName: 'Seraphina',
            characterAvatarUrl: '/thumbnail/avatar/seraphina.png',
            chatFile: 'Seraphina - 2026-04-20@00h00m43s569ms'
        });

        expect(result.success).toBe(false);
        expect(result.reason).toBe('chat_not_found');
        expect(selectCharacterById).not.toHaveBeenCalled();
        expect(openCharacterChat).not.toHaveBeenCalled();
        expect(consoleError).toHaveBeenCalledWith(
            expect.stringContaining('resolveCharacterChatFile:mismatch'),
            expect.objectContaining({
                targetChatFile: 'Seraphina - 2026-04-20@00h00m43s569ms',
                candidateFiles: ['Seraphina - 2026-04-20@00h00m44s']
            })
        );
    });

    it('createNewCharacterChat should create a new chat on the current character without reselecting it', async () => {
        const state = {
            currentCharacterId: '1',
            currentChatId: 'chat_beta_default',
            characters: [
                { name: 'Alpha', avatar: 'alpha.png', chat: 'chat_alpha_default' },
                { name: 'Beta', avatar: 'beta.png', chat: 'chat_beta_default' }
            ]
        };

        const selectCharacterById = vi.fn(async (id: number | string) => {
            state.currentCharacterId = String(id);
        });
        const doNewChat = vi.fn(async () => {
            state.currentChatId = 'Beta - 2026-04-19@10h20m30s';
        });

        stMain = {
            getCurrentChatId: () => state.currentChatId,
            getThumbnailUrl: (_type: string, file: string) => `/thumbnail/avatar/${file}`,
            selectCharacterById,
            doNewChat
        };
        ctx = {
            get chatId() {
                return state.currentChatId;
            },
            get characterId() {
                return state.currentCharacterId;
            },
            characters: state.characters
        };

        const result = await STClient.createNewCharacterChat({
            characterId: 1,
            characterName: 'Beta',
            characterAvatarUrl: '/thumbnail/avatar/beta.png'
        });

        expect(result).toEqual({
            success: true,
            resolvedCharacterId: '1',
            resolvedCharacterName: 'Beta',
            resolvedCharacterAvatarUrl: '/thumbnail/avatar/beta.png',
            resolvedChatFile: 'Beta - 2026-04-19@10h20m30s'
        });
        expect(selectCharacterById).not.toHaveBeenCalled();
        expect(doNewChat).toHaveBeenCalledWith({ deleteCurrentChat: false });
    });

    it('createNewCharacterChat should switch character before creating the new chat', async () => {
        const state = {
            currentCharacterId: '0',
            currentChatId: 'chat_alpha_default',
            characters: [
                { name: 'Alpha', avatar: 'alpha.png', chat: 'chat_alpha_default' },
                { name: 'Beta', avatar: 'beta.png', chat: 'chat_beta_default' }
            ]
        };

        const selectCharacterById = vi.fn(async (id: number | string) => {
            state.currentCharacterId = String(id);
            state.currentChatId = state.characters[Number(id)]?.chat;
        });
        const doNewChat = vi.fn(async () => {
            state.currentChatId = 'Beta - 2026-04-19@11h00m00s';
        });

        stMain = {
            getCurrentChatId: () => state.currentChatId,
            getThumbnailUrl: (_type: string, file: string) => `/thumbnail/avatar/${file}`,
            selectCharacterById,
            doNewChat
        };
        ctx = {
            get chatId() {
                return state.currentChatId;
            },
            get characterId() {
                return state.currentCharacterId;
            },
            characters: state.characters
        };

        const result = await STClient.createNewCharacterChat({
            characterId: 1,
            characterName: 'Beta',
            characterAvatarUrl: '/thumbnail/avatar/beta.png'
        });

        expect(result.success).toBe(true);
        expect(result.resolvedCharacterId).toBe('1');
        expect(result.resolvedChatFile).toBe('Beta - 2026-04-19@11h00m00s');
        expect(selectCharacterById).toHaveBeenCalledWith(1, { switchMenu: true });
        expect(doNewChat).toHaveBeenCalledWith({ deleteCurrentChat: false });
    });

    it('selectCharacterById should resolve from host events before polling fallback', async () => {
        vi.useFakeTimers();

        const listeners = new Map<string, Set<() => void>>();
        const emit = (eventName: string) => {
            for (const listener of listeners.get(eventName) || []) {
                listener();
            }
        };

        const state = {
            currentCharacterId: '0',
            currentChatId: 'chat_alpha_default',
            characters: [
                { name: 'Alpha', avatar: 'alpha.png', chat: 'chat_alpha_default' },
                { name: 'Beta', avatar: 'beta.png', chat: 'chat_beta_default' }
            ]
        };

        stEventTypes = {
            [ST_EVENT.CHARACTER_PAGE_LOADED]: 'character_page_loaded',
            [ST_EVENT.CHAT_CHANGED]: 'chat_changed',
            [ST_EVENT.CHAT_LOADED]: 'chat_loaded',
            [ST_EVENT.CHAT_CREATED]: 'chat_created'
        };
        stEventSource = {
            on: (eventName: string, callback: () => void) => {
                if (!listeners.has(eventName)) {
                    listeners.set(eventName, new Set());
                }
                listeners.get(eventName)!.add(callback);
            },
            off: (eventName: string, callback: () => void) => {
                listeners.get(eventName)?.delete(callback);
            }
        };

        const selectCharacterById = vi.fn(async (id: number | string) => {
            Promise.resolve().then(() => {
                state.currentCharacterId = String(id);
                state.currentChatId = state.characters[Number(id)]?.chat;
                emit('character_page_loaded');
            });
        });

        stMain = {
            getCurrentChatId: () => state.currentChatId,
            selectCharacterById
        };
        ctx = {
            get chatId() {
                return state.currentChatId;
            },
            get characterId() {
                return state.currentCharacterId;
            },
            characters: state.characters
        };

        const resultPromise = STClient.selectCharacterById(1);
        await Promise.resolve();
        const result = await resultPromise;

        expect(result).toBe(true);
        expect(selectCharacterById).toHaveBeenCalledWith(1, { switchMenu: true });
    });

    it('createNewCharacterChat should use ctx doNewChat when stMain does not expose it', async () => {
        const state = {
            currentCharacterId: '1',
            currentChatId: 'chat_beta_default',
            characters: [
                { name: 'Alpha', avatar: 'alpha.png', chat: 'chat_alpha_default' },
                { name: 'Beta', avatar: 'beta.png', chat: 'chat_beta_default' }
            ]
        };

        const ctxDoNewChat = vi.fn(async () => {
            state.currentChatId = 'Beta - 2026-04-19@11h30m00s';
        });

        stMain = {
            getCurrentChatId: () => state.currentChatId,
            getThumbnailUrl: (_type: string, file: string) => `/thumbnail/avatar/${file}`
        };
        ctx = {
            getCurrentChatId: () => state.currentChatId,
            get chatId() {
                return state.currentChatId;
            },
            get characterId() {
                return state.currentCharacterId;
            },
            characters: state.characters,
            doNewChat: ctxDoNewChat
        };

        const result = await STClient.createNewCharacterChat({
            characterId: 1,
            characterName: 'Beta',
            characterAvatarUrl: '/thumbnail/avatar/beta.png'
        });

        expect(result.success).toBe(true);
        expect(result.resolvedChatFile).toBe('Beta - 2026-04-19@11h30m00s');
        expect(ctxDoNewChat).toHaveBeenCalledWith({ deleteCurrentChat: false });
    });

    it('createNewCharacterChat should use the host global doNewChat when running inside an iframe-like bridge', async () => {
        const state = {
            currentCharacterId: '1',
            currentChatId: 'chat_beta_default',
            characters: [
                { name: 'Alpha', avatar: 'alpha.png', chat: 'chat_alpha_default' },
                { name: 'Beta', avatar: 'beta.png', chat: 'chat_beta_default' }
            ]
        };

        const globalDoNewChat = vi.fn(async () => {
            state.currentChatId = 'Beta - 2026-04-19@11h45m00s';
        });

        stGlobal = {
            doNewChat: globalDoNewChat
        };
        stMain = {
            getCurrentChatId: () => state.currentChatId,
            getThumbnailUrl: (_type: string, file: string) => `/thumbnail/avatar/${file}`
        };
        ctx = {
            get chatId() {
                return state.currentChatId;
            },
            get characterId() {
                return state.currentCharacterId;
            },
            characters: state.characters
        };

        const result = await STClient.createNewCharacterChat({
            characterId: 1,
            characterName: 'Beta',
            characterAvatarUrl: '/thumbnail/avatar/beta.png'
        });

        expect(result.success).toBe(true);
        expect(result.resolvedChatFile).toBe('Beta - 2026-04-19@11h45m00s');
        expect(globalDoNewChat).toHaveBeenCalledWith({ deleteCurrentChat: false });
    });

    it('createNewCharacterChat should fall back to the verified /newchat slash command when doNewChat is unavailable', async () => {
        const state = {
            currentCharacterId: '1',
            currentChatId: 'chat_beta_default',
            characters: [
                { name: 'Alpha', avatar: 'alpha.png', chat: 'chat_alpha_default' },
                { name: 'Beta', avatar: 'beta.png', chat: 'chat_beta_default' }
            ]
        };

        const executeSlashCommandsWithOptions = vi.fn(async (command: string) => {
            if (command === '/newchat') {
                state.currentChatId = 'Beta - 2026-04-19@12h00m00s';
            }
            return {
                isError: false,
                isAborted: false
            };
        });

        helper = {
            executeSlashCommandsWithOptions
        };
        stMain = {
            getCurrentChatId: () => state.currentChatId,
            getThumbnailUrl: (_type: string, file: string) => `/thumbnail/avatar/${file}`
        };
        ctx = {
            get chatId() {
                return state.currentChatId;
            },
            get characterId() {
                return state.currentCharacterId;
            },
            characters: state.characters
        };

        const result = await STClient.createNewCharacterChat({
            characterId: 1,
            characterName: 'Beta',
            characterAvatarUrl: '/thumbnail/avatar/beta.png'
        });

        expect(result.success).toBe(true);
        expect(result.resolvedChatFile).toBe('Beta - 2026-04-19@12h00m00s');
        expect(executeSlashCommandsWithOptions).toHaveBeenCalledWith('/newchat');
    });

    it('renameCharacterChat should switch to the target character and use the host renameChat API', async () => {
        const state = {
            currentCharacterId: '0',
            currentChatId: 'chat_alpha_default',
            characters: [
                { name: 'Alpha', avatar: 'alpha.png', chat: 'chat_alpha_default' },
                { name: 'Beta', avatar: 'beta.png', chat: 'chat_beta_default' }
            ]
        };

        const selectCharacterById = vi.fn(async (id: number | string) => {
            state.currentCharacterId = String(id);
            state.currentChatId = state.characters[Number(id)]?.chat;
        });
        const renameChat = vi.fn(async (_oldFileName: string, newName: string) => {
            state.currentChatId = newName;
        });

        stMain = {
            getCurrentChatId: () => state.currentChatId,
            selectCharacterById,
            renameChat
        };
        ctx = {
            get chatId() {
                return state.currentChatId;
            },
            get characterId() {
                return state.currentCharacterId;
            },
            characters: state.characters
        };

        const result = await STClient.renameCharacterChat({
            characterId: 1,
            characterName: 'Beta',
            characterAvatarUrl: '/thumbnail/avatar/beta.png',
            oldChatFile: 'chat_beta_archive',
            newChatTitle: 'Renamed Beta Archive'
        });

        expect(result.success).toBe(true);
        expect(result.previousChatFile).toBe('chat_beta_archive');
        expect(result.resolvedChatFile).toBe('Renamed Beta Archive');
        expect(selectCharacterById).toHaveBeenCalledWith(1, { switchMenu: true });
        expect(renameChat).toHaveBeenCalledWith('chat_beta_archive', 'Renamed Beta Archive');
    });

    it('deleteCharacterChat should call the host deleteCharacterChatByName API with the resolved character id', async () => {
        const state = {
            currentCharacterId: '1',
            currentChatId: 'chat_beta_default',
            characters: [
                { name: 'Alpha', avatar: 'alpha.png', chat: 'chat_alpha_default' },
                { name: 'Beta', avatar: 'beta.png', chat: 'chat_beta_default' }
            ]
        };

        const deleteCharacterChatByName = vi.fn(async () => undefined);
        helper = {
            getChatHistoryBrief: vi.fn(async () => [{ file_name: 'chat_beta_archive' }])
        };

        stMain = {
            getCurrentChatId: () => state.currentChatId,
            deleteCharacterChatByName
        };
        ctx = {
            get chatId() {
                return state.currentChatId;
            },
            get characterId() {
                return state.currentCharacterId;
            },
            characters: state.characters
        };

        const result = await STClient.deleteCharacterChat({
            characterId: 1,
            characterName: 'Beta',
            characterAvatarUrl: '/thumbnail/avatar/beta.png',
            chatFile: 'chat_beta_archive'
        });

        expect(result.success).toBe(true);
        expect(result.resolvedChatFile).toBe('chat_beta_archive');
        expect(deleteCharacterChatByName).toHaveBeenCalledWith(1, 'chat_beta_archive');
    });

    it('deleteCharacterChat should fall back to the verified /delchat slash command when deleting the current chat', async () => {
        const state = {
            currentCharacterId: '1',
            currentChatId: 'chat_beta_archive',
            characters: [
                { name: 'Alpha', avatar: 'alpha.png', chat: 'chat_alpha_default' },
                { name: 'Beta', avatar: 'beta.png', chat: 'chat_beta_default' }
            ]
        };

        const executeSlashCommandsWithOptions = vi.fn(async (command: string) => {
            expect(command).toBe('/delchat');
            return {
                isError: false,
                isAborted: false
            };
        });

        helper = {
            getChatHistoryBrief: vi.fn(async () => [{ file_name: 'chat_beta_archive' }]),
            executeSlashCommandsWithOptions
        };
        stMain = {
            getCurrentChatId: () => state.currentChatId
        };
        ctx = {
            get chatId() {
                return state.currentChatId;
            },
            get characterId() {
                return state.currentCharacterId;
            },
            characters: state.characters
        };

        const result = await STClient.deleteCharacterChat({
            characterId: 1,
            characterName: 'Beta',
            characterAvatarUrl: '/thumbnail/avatar/beta.png',
            chatFile: 'chat_beta_archive'
        });

        expect(result.success).toBe(true);
        expect(executeSlashCommandsWithOptions).toHaveBeenCalledWith('/delchat');
    });

    it('deleteCharacterChat should close the current host chat view after deleting the active chat', async () => {
        const state = {
            currentCharacterId: '1' as string | undefined,
            currentChatId: 'chat_beta_archive' as string | undefined,
            currentCharacterName: 'Beta' as string | undefined,
            characters: [
                { name: 'Alpha', avatar: 'alpha.png', chat: 'chat_alpha_default' },
                { name: 'Beta', avatar: 'beta.png', chat: 'chat_beta_archive' }
            ]
        };

        const deleteCharacterChatByName = vi.fn(async () => {
            state.characters[1].chat = 'Beta - 2026-04-19@18h00m00s';
        });
        const clearChat = vi.fn(async () => {
            state.currentChatId = undefined;
        });
        const setCharacterId = vi.fn((value?: string | number | null) => {
            state.currentCharacterId = value == null ? undefined : String(value);
        });
        const setCharacterName = vi.fn((value?: string) => {
            state.currentCharacterName = value ?? '';
        });

        helper = {
            getChatHistoryBrief: vi.fn(async () => [{ file_name: 'chat_beta_archive' }])
        };
        stMain = {
            getCurrentChatId: () => state.currentChatId,
            deleteCharacterChatByName,
            clearChat,
            setCharacterId,
            setCharacterName
        };
        ctx = {
            get chatId() {
                return state.currentChatId;
            },
            get characterId() {
                return state.currentCharacterId;
            },
            characters: state.characters
        };
        (window as any).chat_metadata = { chat_id: 'chat_beta_archive' };

        const result = await STClient.deleteCharacterChat({
            characterId: 1,
            characterName: 'Beta',
            characterAvatarUrl: '/thumbnail/avatar/beta.png',
            chatFile: 'chat_beta_archive'
        });

        expect(result.success).toBe(true);
        expect(deleteCharacterChatByName).toHaveBeenCalledWith(1, 'chat_beta_archive');
        expect(clearChat).toHaveBeenCalledWith({ clearData: true });
        expect(setCharacterId).toHaveBeenCalledWith(undefined);
        expect(setCharacterName).toHaveBeenCalledWith('');
        expect(STClient.getResolvedCurrentChatId()).toBeNull();
        expect((window as any).chat_metadata).toEqual({});
    });

    it('deleteCharacterChat should fall back to the direct ST delete endpoint when host delete APIs are not exposed', async () => {
        const state = {
            currentCharacterId: '1',
            currentChatId: 'chat_beta_default',
            characters: [
                { name: 'Alpha', avatar: 'alpha.png', chat: 'chat_alpha_default' },
                { name: 'Beta', avatar: 'beta-avatar.png', chat: 'chat_beta_default' }
            ]
        };

        const fetchWithCsrf = vi.spyOn(STClient, 'fetchWithCsrf').mockResolvedValue({
            ok: true,
            status: 200
        } as Response);
        helper = {
            getChatHistoryBrief: vi.fn(async () => [{ file_name: 'chat_beta_archive' }])
        };

        stMain = {
            getCurrentChatId: () => state.currentChatId
        };
        ctx = {
            get chatId() {
                return state.currentChatId;
            },
            get characterId() {
                return state.currentCharacterId;
            },
            characters: state.characters
        };

        const result = await STClient.deleteCharacterChat({
            characterId: 1,
            characterName: 'Beta',
            characterAvatarUrl: '/thumbnail/avatar/beta.png',
            chatFile: 'chat_beta_archive'
        });

        expect(result.success).toBe(true);
        expect(fetchWithCsrf).toHaveBeenCalledWith('/api/chats/delete', expect.objectContaining({
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        }));
    });

    it('deleteCharacterChat should treat an already-missing chat as deleted without calling the ST delete endpoint', async () => {
        const state = {
            currentCharacterId: '1',
            currentChatId: 'chat_beta_default',
            characters: [
                { name: 'Alpha', avatar: 'alpha.png', chat: 'chat_alpha_default' },
                { name: 'Beta', avatar: 'beta-avatar.png', chat: 'chat_beta_default' }
            ]
        };

        const fetchWithCsrf = vi.spyOn(STClient, 'fetchWithCsrf').mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                first: { file_name: 'chat_beta_default.jsonl' }
            })
        } as Response);

        stMain = {
            getCurrentChatId: () => state.currentChatId
        };
        ctx = {
            get chatId() {
                return state.currentChatId;
            },
            get characterId() {
                return state.currentCharacterId;
            },
            characters: state.characters
        };

        const result = await STClient.deleteCharacterChat({
            characterId: 1,
            characterName: 'Beta',
            characterAvatarUrl: '/thumbnail/avatar/beta.png',
            chatFile: 'chat_beta_archive'
        });

        expect(result.success).toBe(true);
        expect(fetchWithCsrf).toHaveBeenCalledTimes(1);
        expect(fetchWithCsrf).toHaveBeenCalledWith('/api/characters/chats', expect.objectContaining({
            method: 'POST'
        }));
    });
});
