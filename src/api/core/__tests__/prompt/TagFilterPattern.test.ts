import { describe, expect, it } from 'vitest';
import {
    buildTagFilterRegex,
    resolveTagFilterTags,
    TAG_FILTER_RULE_NAME
} from '@/api/core/hal/regex/TagFilterPattern.js';

describe('TagFilterPattern', () => {
    it('collects transient / ephemeral / persistent tags except Chat_Reply', () => {
        const tags = resolveTagFilterTags();

        expect(tags).toContain('thinking');
        expect(tags).toContain('Character_Action');
        expect(tags).toContain('Story_Summary');
        expect(tags.some(tag => tag.toLowerCase() === 'chat_reply')).toBe(false);
        // presentational 容器（<V>）保留在消息中
        expect(tags).not.toContain('V');
        expect(TAG_FILTER_RULE_NAME).toBe('[Lumina] Tag Filter');
    });

    it('builds an ST-compatible global regex with closed and unclosed alternatives', () => {
        expect(buildTagFilterRegex(['thinking'])).toBe(
            '/(?:<thinking\\b[^>]*?>(?:[\\s\\S]*?)<\\/thinking>|<thinking\\b[^>]*?>(?:[\\s\\S]*?)$)/gisu'
        );
    });
});
