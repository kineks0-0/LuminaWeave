import { afterEach, describe, expect, it, vi } from 'vitest';

const resolverMock = vi.hoisted(() => ({ resolve: vi.fn() }));
const hostMock = vi.hoisted(() => ({ getHostFunction: vi.fn() }));
const taskRunMock = vi.hoisted(() => vi.fn(async () => {}));

vi.mock('@/api/core/hal/resource/index.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/api/core/hal/resource/index.js')>();
    return { ...actual, promptResourceResolver: resolverMock };
});

vi.mock('@/api/core/facade/HostRuntimePort.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/api/core/facade/HostRuntimePort.js')>();
    return { ...actual, getHostRuntimePort: () => hostMock };
});

vi.mock('@/api/core/generation/LuminaGenerationTask.js', () => ({
    LuminaGenerationTask: class {
        run = taskRunMock;
        abort = vi.fn();
    }
}));

import { GenerationCommandService } from '@/api/core/generation/GenerationCommandService.js';
import { lwStorage } from '@/api/storage.js';

const createService = (): GenerationCommandService => new GenerationCommandService({
    chatManager: {} as never,
    streamHandler: {} as never,
    promptCommandService: {} as never,
    waitForReady: vi.fn(async () => true),
    beforeGenerationStart: vi.fn(),
    crudChatRecord: vi.fn(),
    getAssistantName: () => 'Alice',
    getCharName: () => 'Alice',
    getUserName: () => '旅行者',
    getLastMessageId: () => null,
    getConversationMessages: vi.fn(async () => []),
    commitToST: vi.fn(),
    syncFromST: vi.fn(),
    emit: vi.fn(),
    getLastStreamState: () => null,
    setManualAbortPending: vi.fn()
});

const characterBundle = () => ({
    refs: [],
    documents: [{
        ref: {
            sourceId: 'local',
            resourceType: 'character',
            resourceId: 'Alice',
            path: '/sources/local/characters/Alice',
            writable: true
        },
        raw: { data: { name: 'Alice', character_book: { entries: [] } } },
        summary: { id: 'Alice', type: 'character', name: 'Alice', format: 'chara_card_v2' },
        capabilities: {
            readable: true,
            writable: true,
            forkable: true,
            importable: true,
            exportable: true,
            searchable: true
        }
    }],
    lorebookEntries: [],
    charCard: {
        name: 'Alice',
        description: '{{char}} 是一名骑士。',
        personality: '',
        scenario: '',
        systemPrompt: ''
    },
    presetRaw: null,
    diagnostics: []
});

const createSendService = (): GenerationCommandService => new GenerationCommandService({
    chatManager: { activeLeafId: null } as never,
    streamHandler: {
        handleRestart: vi.fn(),
        responseBuffer: '',
        isGenerating: false,
        clearSmoothTimer: vi.fn()
    } as never,
    promptCommandService: { lastPromptPayload: null, probePrompt: vi.fn(async () => null) } as never,
    waitForReady: vi.fn(async () => true),
    beforeGenerationStart: vi.fn(),
    crudChatRecord: vi.fn(async () => true),
    getAssistantName: () => 'Alice',
    getCharName: () => 'Alice',
    getUserName: () => '旅行者',
    getLastMessageId: () => null,
    getConversationMessages: vi.fn(async () => []),
    commitToST: vi.fn(),
    syncFromST: vi.fn(),
    emit: vi.fn(),
    getLastStreamState: () => null,
    setManualAbortPending: vi.fn()
});

describe('GenerationCommandService send routing', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        hostMock.getHostFunction.mockReset();
        taskRunMock.mockClear();
    });

    it('falls back to lumina assembly when the host provides no ST generate', async () => {
        hostMock.getHostFunction.mockResolvedValue(null);
        vi.spyOn(lwStorage, '_getContextIds').mockReturnValue({ charId: undefined, chatId: 'lw_chat_1' } as never);
        vi.spyOn(lwStorage, 'get').mockImplementation((_key: string, fallback: unknown) => fallback);

        const service = createSendService();
        const triggerSpy = vi.spyOn(service, 'triggerGenerate');

        await expect(service.sendMessage('你好')).resolves.toBe(true);

        expect(triggerSpy).not.toHaveBeenCalled();
        expect(taskRunMock).toHaveBeenCalled();
    });

    it('keeps ST native generation when the host provides generate', async () => {
        const generate = vi.fn(async () => {});
        hostMock.getHostFunction.mockResolvedValue(generate);
        vi.spyOn(lwStorage, '_getContextIds').mockReturnValue({ charId: undefined, chatId: 'lw_chat_1' } as never);
        vi.spyOn(lwStorage, 'get').mockImplementation((_key: string, fallback: unknown) => fallback);

        const service = createSendService();
        const triggerSpy = vi.spyOn(service, 'triggerGenerate');

        await expect(service.sendMessage('你好')).resolves.toBe(true);

        expect(triggerSpy).toHaveBeenCalled();
        expect(generate).toHaveBeenCalled();
        expect(taskRunMock).not.toHaveBeenCalled();
    });
});

describe('GenerationCommandService local character injection', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        resolverMock.resolve.mockReset();
    });

    it('prepends persona and character card when the chat is bound to a local character', async () => {
        vi.spyOn(lwStorage, '_getContextIds').mockReturnValue({ charId: 'Alice', chatId: 'lw_chat_1' });
        vi.spyOn(lwStorage, 'get').mockImplementation((key: string, fallback: unknown) => (
            key === 'lumina-chat.personaDescription' ? '旅行者设定' : fallback
        ));
        resolverMock.resolve.mockResolvedValue(characterBundle());

        const service = createService();
        const result = await Reflect.get(service, 'resolveLocalCharacterPromptInjection')
            .call(service, [{ role: 'user', content: '你好' }]);

        expect(resolverMock.resolve).toHaveBeenCalledWith([expect.objectContaining({
            sourceId: 'local',
            resourceType: 'character',
            resourceId: 'Alice'
        })]);
        expect(result.messages[0].content).toBe('# 用户设定\n旅行者设定');
        expect(result.messages[1].content).toContain('Alice 是一名骑士。');
        expect(result.messages[2]).toEqual({ role: 'user', content: '你好' });
    });

    it('returns null for non-local character ids', async () => {
        vi.spyOn(lwStorage, '_getContextIds').mockReturnValue({ charId: '42', chatId: 'chat_1' });
        resolverMock.resolve.mockResolvedValue({ ...characterBundle(), charCard: null, documents: [] });

        const service = createService();
        const result = await Reflect.get(service, 'resolveLocalCharacterPromptInjection')
            .call(service, [{ role: 'user', content: '你好' }]);

        expect(result).toBeNull();
    });
});
