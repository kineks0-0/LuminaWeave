import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initMockHAL } from '@/api/core/__tests__/support/halMock.js';
import { LocalResourceSource } from '@/api/core/host-drivers/standalone/LocalResourceSource.js';
import { ResourceService } from '@/api/core/hal/resource/ResourceService.js';
import { ResourceSourceRegistry } from '@/api/core/hal/resource/ResourceSourceRegistry.js';
import {
    ChatPromptPresetLibraryService
} from '@/api/core/hal/prompt/chat/ChatPromptPresetLibraryService.js';
import {
    RegexScriptLibraryService,
    createDefaultRegexScript
} from '@/api/core/hal/prompt/chat/RegexScriptLibraryService.js';
import { CHAT_PROMPT_PRESET_STORAGE_KEY } from '@/api/core/hal/prompt/ChatPromptCompositionService.js';
import { CHAT_PROMPT_REGEX_STORAGE_KEY } from '@/api/core/hal/prompt/ChatPromptCompositionService.js';
import { REGEX_PLACEMENTS } from '@/types/RegexScriptTypes.js';
import { lwStorage } from '@/api/storage.js';

const { store } = vi.hoisted(() => ({ store: new Map<string, unknown>() }));

const stPresetFixture = (): Record<string, unknown> => ({
    name: '论坛预设',
    temperature: 0.9,
    prompts: [
        { identifier: 'main', name: '主提示词', system_prompt: true, role: 'system', content: '你是{{char}}。' },
        { identifier: 'chatHistory', name: '对话历史', role: 'user', content: '' }
    ],
    prompt_order: [{
        character_id: 100000,
        order: [
            { identifier: 'main', enabled: true },
            { identifier: 'chatHistory', enabled: true }
        ]
    }]
});

const createPresetService = (): ChatPromptPresetLibraryService => {
    const registry = new ResourceSourceRegistry();
    registry.registerSource(new LocalResourceSource());
    return new ChatPromptPresetLibraryService(new ResourceService(registry));
};

describe('ChatPromptPresetLibraryService', () => {
    beforeEach(() => {
        store.clear();
        initMockHAL({
            runtime: {
                extensionStore: {
                    listKeys: vi.fn(async () => Array.from(store.keys())),
                    getJson: vi.fn(async ({ key }: { key: string }) => store.get(key) ?? null),
                    setJson: vi.fn(async ({ key, value }: { key: string; value: unknown }) => {
                        store.set(key, value);
                    }),
                    updateJson: vi.fn(async ({ key, value }: { key: string; value: unknown }) => {
                        store.set(key, value);
                    }),
                    deleteJson: vi.fn(async ({ key }: { key: string }) => {
                        store.delete(key);
                    }),
                    setBlob: vi.fn(),
                    getBlob: vi.fn()
                }
            }
        });
        vi.restoreAllMocks();
    });

    it('导入 ST 预设后可列出、加载并保持字段', async () => {
        const service = createPresetService();
        const imported = await service.importFromRaw(stPresetFixture());
        expect(imported.document).not.toBeNull();

        const list = await service.list();
        expect(list).toHaveLength(1);
        expect(list[0].name).toBe('论坛预设');
        expect(list[0].promptCount).toBe(2);

        const loaded = await service.load(list[0].id);
        expect(loaded.preset!.sampling.temperature).toBe(0.9);
        expect(loaded.preset!.prompts[0].content).toBe('你是{{char}}。');
    });

    it('拒绝 Text Completion 预设且不写入资源', async () => {
        const service = createPresetService();
        const imported = await service.importFromRaw({ instruct: {}, temp: 0.9 });

        expect(imported.document).toBeNull();
        expect(imported.diagnostics.some(item => item.code === 'preset.text_completion_unsupported')).toBe(true);
        expect(await service.list()).toEqual([]);
    });

    it('保存编辑后的预设并往返保真', async () => {
        const service = createPresetService();
        const imported = await service.importFromRaw(stPresetFixture());
        const id = imported.document!.ref.resourceId;

        const loaded = await service.load(id);
        loaded.preset!.name = '改名预设';
        loaded.preset!.sampling.temperature = 0.5;
        await service.save(id, loaded.preset!);

        const reloaded = await service.load(id);
        expect(reloaded.preset!.name).toBe('改名预设');
        expect(reloaded.preset!.sampling.temperature).toBe(0.5);
    });

    it('从默认创建、复制与删除，激活 id 随删除清理', async () => {
        const service = createPresetService();
        const created = await service.createFromDefault('我的预设');
        const id = created.ref.resourceId;
        service.setActive(id);
        expect(service.getActiveId()).toBe(id);

        const duplicated = await service.duplicate(id);
        expect(duplicated).not.toBeNull();

        expect(await service.remove(id)).toBe(true);
        expect(service.getActiveId()).toBe('');
        expect((await service.list()).some(item => item.id === id)).toBe(false);
    });

    it('激活 id 读取 lwStorage', async () => {
        vi.spyOn(lwStorage, 'get').mockImplementation((key: string, fallback: unknown) => (
            key === CHAT_PROMPT_PRESET_STORAGE_KEY ? 'preset-abc' : fallback
        ));
        const service = createPresetService();

        expect(service.getActiveId()).toBe('preset-abc');
    });
});

describe('RegexScriptLibraryService', () => {
    let storage: Map<string, unknown>;

    beforeEach(() => {
        storage = new Map<string, unknown>();
        vi.restoreAllMocks();
        vi.spyOn(lwStorage, 'get').mockImplementation((key: string, fallback: unknown) => (
            key === CHAT_PROMPT_REGEX_STORAGE_KEY ? (storage.get(key) ?? fallback) : fallback
        ));
        vi.spyOn(lwStorage, 'set').mockImplementation(async (key: string, value: unknown) => {
            storage.set(key, value);
        });
    });

    it('CRUD 与顺序调整', () => {
        const service = new RegexScriptLibraryService();
        const first = service.add({ scriptName: '第一条', findRegex: '/a/g', replaceString: 'b' });
        const second = service.add({ scriptName: '第二条' });

        expect(service.list().map(item => item.id)).toEqual([first.id, second.id]);

        service.move(second.id, -1);
        expect(service.list().map(item => item.id)).toEqual([second.id, first.id]);

        service.update(first.id, { enabled: false });
        expect(service.list().find(item => item.id === first.id)!.enabled).toBe(false);

        expect(service.remove(second.id)).toBe(true);
        expect(service.list()).toHaveLength(1);
    });

    it('导入 ST 正则数组并重新分配 id', () => {
        const service = new RegexScriptLibraryService();
        const result = service.importFromRaw([
            { id: 'old-a', scriptName: '导入一', findRegex: '/x/g', replaceString: 'y', placement: [1] },
            { scriptName: '导入二', placement: [2] }
        ]);

        expect(result.added).toBe(2);
        expect(result.scripts.map(item => item.scriptName)).toEqual(['导入一', '导入二']);
        expect(result.scripts[0].id).not.toBe('old-a');
    });

    it('导出为 ST 兼容 JSON', () => {
        const service = new RegexScriptLibraryService();
        service.add({ scriptName: '导出', findRegex: '/a/g', replaceString: 'b', enabled: false });
        const exported = service.exportRaw();

        expect(exported[0].disabled).toBe(true);
        expect(exported[0].scriptName).toBe('导出');
    });

    it('内联测试强制启用脚本并按 placement 应用', () => {
        const service = new RegexScriptLibraryService();
        const script = {
            ...createDefaultRegexScript(),
            enabled: false,
            findRegex: '/状态：\\S+/g',
            replaceString: '状态：?',
            placement: [REGEX_PLACEMENTS.aiOutput]
        };
        const result = service.test(script, 'HP 状态：正常 结束', REGEX_PLACEMENTS.aiOutput);

        expect(result.text).toBe('HP 状态：? 结束');
    });
});
