import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    listBoundRegexRules,
    listBuiltinTagRules,
    resolveReplyFilterState
} from '../panels/chatSanitizerBuiltins.js';
import {
    setCachedCharacterRegexScripts,
    setCachedPresetRegexScripts
} from '../../../api/core/hal/regex/LuminaRegexAssetCache.js';
import {
    filterDisabledBoundRegexes,
    setBoundRegexDisabled
} from '../../../api/core/hal/regex/BoundRegexOverrideStore.js';
import { REGEX_PLACEMENTS, type RegexScript } from '../../../types/RegexScriptTypes.js';

const storageState = vi.hoisted(() => new Map<string, unknown>());

vi.mock('@/api/storage.js', () => ({
    lwStorage: {
        get: (key: string, fallback: unknown) => storageState.has(key) ? storageState.get(key) : fallback,
        set: (key: string, value: unknown) => {
            storageState.set(key, value);
            return Promise.resolve();
        }
    }
}));

const buildScript = (overrides: Partial<RegexScript> & Pick<RegexScript, 'id'>): RegexScript => ({
    scriptName: '脚本',
    enabled: true,
    findRegex: '/a/g',
    replaceString: 'b',
    trimStrings: [],
    placement: [REGEX_PLACEMENTS.aiOutput],
    markdownOnly: true,
    promptOnly: false,
    runOnEdit: false,
    substituteRegex: 0,
    minDepth: null,
    maxDepth: null,
    ...overrides
});

describe('chatSanitizerBuiltins', () => {
    it('maps registered chat tags to read-only dispositions', () => {
        const byTag = new Map(listBuiltinTagRules().map(rule => [rule.tag, rule]));

        expect(byTag.get('thinking')?.disposition).toBe('hide-content');
        expect(byTag.get('Story_Summary')?.disposition).toBe('hidden-from-ui');
        expect(byTag.get('Chat_Reply')?.disposition).toBe('body');
        expect(byTag.get('V')?.disposition).toBe('preserve');
        // Forge-only tags 不进入聊天的净化视图
        expect(byTag.has('forge_skill')).toBe(false);
    });

    it('reads reply filter switches from the registered setting keys', () => {
        const values: Record<string, unknown> = {
            'lumina-chat.filterChatReply': true,
            'lumina-chat.allowTopLevelInFilter': false,
            'lumina-chat.implicitThinkingInFilter': true,
            'lumina-chat.aggressiveThinking': true
        };

        expect(resolveReplyFilterState((key, fallback) => values[key] ?? fallback)).toEqual({
            enabled: true,
            allowTopLevel: false,
            implicitThinking: true,
            aggressiveThinking: true
        });
    });

    it('falls back to defaults when nothing is stored', () => {
        expect(resolveReplyFilterState((_key, fallback) => fallback)).toEqual({
            enabled: false,
            allowTopLevel: true,
            implicitThinking: false,
            aggressiveThinking: false
        });
    });

    describe('listBoundRegexRules', () => {
        beforeEach(() => {
            storageState.clear();
            setCachedPresetRegexScripts(null, []);
            setCachedCharacterRegexScripts(null, []);
        });

        it('lists preset then character scripts with source labels and dedupes by id', () => {
            setCachedPresetRegexScripts('preset-a', [
                buildScript({ id: 'shared', scriptName: '预设脚本', placement: [REGEX_PLACEMENTS.aiOutput] })
            ], '预设A');
            setCachedCharacterRegexScripts('char-b', [
                buildScript({ id: 'shared', scriptName: '被覆盖的重复脚本' }),
                buildScript({
                    id: 'char-only',
                    scriptName: '角色脚本',
                    enabled: false,
                    placement: [REGEX_PLACEMENTS.userInput]
                })
            ], '角色B');

            expect(listBoundRegexRules()).toEqual([
                {
                    id: 'shared',
                    name: '预设脚本',
                    source: 'preset',
                    sourceLabel: '预设「预设A」',
                    sourceEnabled: true,
                    disabled: false,
                    effectiveEnabled: true,
                    placement: [REGEX_PLACEMENTS.aiOutput]
                },
                {
                    id: 'char-only',
                    name: '角色脚本',
                    source: 'character',
                    sourceLabel: '角色卡「角色B」',
                    sourceEnabled: false,
                    disabled: false,
                    effectiveEnabled: false,
                    placement: [REGEX_PLACEMENTS.userInput]
                }
            ]);
        });

        it('reflects Lumina-level disabled overrides and filters active scripts', () => {
            setCachedPresetRegexScripts('preset-a', [
                buildScript({ id: 'p', scriptName: '预设脚本' })
            ], '预设A');

            setBoundRegexDisabled('p', true);
            expect(listBoundRegexRules()[0]).toMatchObject({
                id: 'p',
                sourceEnabled: true,
                disabled: true,
                effectiveEnabled: false
            });
            expect(filterDisabledBoundRegexes([
                buildScript({ id: 'p' }),
                buildScript({ id: 'q' })
            ]).map(script => script.id)).toEqual(['q']);

            setBoundRegexDisabled('p', false);
            expect(listBoundRegexRules()[0].effectiveEnabled).toBe(true);
        });

        it('falls back to generic source labels and returns empty when nothing is bound', () => {
            setCachedPresetRegexScripts('preset-a', [buildScript({ id: 'p', scriptName: '' })]);
            expect(listBoundRegexRules()).toEqual([
                {
                    id: 'p',
                    name: '未命名脚本',
                    source: 'preset',
                    sourceLabel: '预设',
                    sourceEnabled: true,
                    disabled: false,
                    effectiveEnabled: true,
                    placement: [REGEX_PLACEMENTS.aiOutput]
                }
            ]);

            setCachedPresetRegexScripts(null, []);
            expect(listBoundRegexRules()).toEqual([]);
        });
    });
});
