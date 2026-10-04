import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LuminaRegexDisplayService } from '@/api/core/hal/regex/LuminaRegexDisplayService.js';
import {
    setCachedCharacterRegexScripts,
    setCachedPresetRegexScripts
} from '@/api/core/hal/regex/LuminaRegexAssetCache.js';
import {
    BOUND_REGEX_OVERRIDE_STORAGE_KEY,
    setBoundRegexOverride
} from '@/api/core/hal/regex/BoundRegexOverrideStore.js';
import { createDefaultRegexScript } from '@/api/core/hal/prompt/chat/RegexScriptLibraryService.js';
import { CHAT_PROMPT_REGEX_STORAGE_KEY } from '@/api/core/hal/prompt/ChatPromptCompositionService.js';
import { REGEX_PLACEMENTS } from '@/types/RegexScriptTypes.js';
import { lwStorage } from '@/api/storage.js';

const displayScript = (overrides: Partial<ReturnType<typeof createDefaultRegexScript>> = {}) => ({
    ...createDefaultRegexScript(),
    findRegex: '/SUOT/g',
    replaceString: 'HTML',
    placement: [REGEX_PLACEMENTS.aiOutput],
    markdownOnly: true,
    ...overrides
});

describe('LuminaRegexDisplayService', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        setCachedPresetRegexScripts(null, []);
        setCachedCharacterRegexScripts(null, []);
        vi.spyOn(lwStorage, 'get').mockImplementation((_key: string, fallback: unknown) => fallback);
    });

    it('按预设绑定 → 角色绑定 → 全局库顺序应用显示脚本', () => {
        setCachedPresetRegexScripts('preset-1', [displayScript({ id: 'p1', scriptName: '预设显示' })]);
        setCachedCharacterRegexScripts('char-1', [
            displayScript({ id: 'c1', scriptName: '角色显示', findRegex: '/HTML/g', replaceString: 'CHAR' })
        ]);

        const service = new LuminaRegexDisplayService();
        expect(service.apply('SUOT', 'ai_output', 'display')).toBe('CHAR');
    });

    it('全局库参与显示，并按 id 去重（绑定优先）', () => {
        setCachedPresetRegexScripts('preset-1', [displayScript({ id: 'shared', replaceString: 'PRESET' })]);
        vi.spyOn(lwStorage, 'get').mockImplementation((key: string, fallback: unknown) => (
            key === CHAT_PROMPT_REGEX_STORAGE_KEY
                ? [
                    { ...displayScript({ id: 'shared', replaceString: 'GLOBAL' }) },
                    { ...displayScript({ id: 'g1', findRegex: '/PRESET/g', replaceString: 'P2' }) }
                ]
                : fallback
        ));

        const service = new LuminaRegexDisplayService();
        expect(service.apply('SUOT', 'ai_output', 'display')).toBe('P2');
    });

    it('promptOnly 脚本不参与显示，prompt 目标不做显示处理', () => {
        setCachedPresetRegexScripts('preset-1', [displayScript({ id: 'p1', promptOnly: true })]);

        const service = new LuminaRegexDisplayService();
        expect(service.apply('SUOT', 'ai_output', 'display')).toBe('SUOT');
        expect(service.apply('SUOT', 'ai_output', 'prompt')).toBe('SUOT');
    });

    it('按 depth 范围过滤显示脚本', () => {
        setCachedPresetRegexScripts('preset-1', [displayScript({ id: 'p1', minDepth: 3 })]);

        const service = new LuminaRegexDisplayService();
        expect(service.apply('SUOT', 'ai_output', 'display', { depth: 1 })).toBe('SUOT');
        expect(service.apply('SUOT', 'ai_output', 'display', { depth: 5 })).toBe('HTML');
    });

    it('本机覆盖可停用绑定脚本，也可强制启用来源停用的脚本', () => {
        const overrideState = new Map<string, unknown>();
        vi.spyOn(lwStorage, 'get').mockImplementation((key: string, fallback: unknown) => (
            key === BOUND_REGEX_OVERRIDE_STORAGE_KEY ? (overrideState.get(key) ?? fallback) : fallback
        ));
        vi.spyOn(lwStorage, 'set').mockImplementation(async (key: string, value: unknown) => {
            overrideState.set(key, value);
        });

        setCachedPresetRegexScripts('preset-1', [
            displayScript({ id: 'p1', findRegex: '/A/g', replaceString: 'X' }),
            displayScript({ id: 'p2', findRegex: '/B/g', replaceString: 'Y', enabled: false })
        ]);

        const service = new LuminaRegexDisplayService();
        expect(service.apply('A', 'ai_output', 'display')).toBe('X');
        expect(service.apply('B', 'ai_output', 'display')).toBe('B');

        setBoundRegexOverride('p1', 'disabled');
        setBoundRegexOverride('p2', 'enabled');

        expect(service.apply('A', 'ai_output', 'display')).toBe('A');
        expect(service.apply('B', 'ai_output', 'display')).toBe('Y');
    });
});
