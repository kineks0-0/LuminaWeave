import { describe, expect, it } from 'vitest';
import { listBuiltinTagRules, resolveReplyFilterState } from '../panels/chatSanitizerBuiltins.js';

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
});
