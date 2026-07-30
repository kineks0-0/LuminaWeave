import { describe, expect, it } from 'vitest';
import { resolveChatStreamingPresentation } from '../presentation/ChatStreamingPresentation.js';

describe('resolveChatStreamingPresentation', () => {
    it.each([
        ['instant', { effectClass: '', showCursor: false }],
        ['fade-in', { effectClass: 'lw-effect-fade-in', showCursor: false }],
        ['gpt-style', { effectClass: 'lw-effect-gpt-reveal', showCursor: false }],
        ['typewriter', { effectClass: '', showCursor: true }]
    ] as const)('projects %s streaming presentation', (effect, expected) => {
        expect(resolveChatStreamingPresentation(effect)).toEqual(expected);
    });
});
