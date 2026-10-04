import { describe, expect, it } from 'vitest';
import {
    CHAT_CONTEXT_TOOLS,
    buildChatHeaderMenu,
    buildChatMessageMenu,
    resolveChatPopoverPosition
} from '../presentation/chatMenus.js';

describe('chat message menu', () => {
    it('offers copy, edit, regenerate, branch and delete for assistant messages', () => {
        const items = buildChatMessageMenu({ isUser: false, disabled: false });
        expect(items.map(item => item.id)).toEqual(['copy', 'edit', 'regenerate', 'branch', 'delete']);
        expect(items.find(item => item.id === 'delete')?.danger).toBe(true);
        expect(items.every(item => !item.disabled)).toBe(true);
    });

    it('offers branch-and-reedit instead of assistant-only actions for user messages', () => {
        const items = buildChatMessageMenu({ isUser: true, disabled: false });
        expect(items.map(item => item.id)).toEqual(['copy', 'edit', 'branch-rerun', 'delete']);
        expect(items.find(item => item.id === 'branch-rerun')?.label).toBe('从此分支重发');
    });

    it('keeps copy available while mutating actions are locked', () => {
        const items = buildChatMessageMenu({ isUser: false, disabled: true });
        expect(items.find(item => item.id === 'copy')?.disabled).toBeFalsy();
        expect(items.filter(item => item.id !== 'copy').every(item => item.disabled)).toBe(true);
    });
});

describe('chat header menu', () => {
    it('lists search and prompt preview, plus profile only when it can open', () => {
        expect(buildChatHeaderMenu({ canOpenProfile: false }).map(item => item.id)).toEqual(['search', 'prompt']);
        expect(buildChatHeaderMenu({ canOpenProfile: true }).map(item => item.id)).toEqual(['search', 'profile', 'prompt']);
    });

    it('exposes the Lumina context tools as panel ids', () => {
        expect(CHAT_CONTEXT_TOOLS.map(tool => tool.id)).toEqual([
            'lumina-timeline',
            'lumina-lorebook',
            'lumina-director',
            'lumina-stats'
        ]);
    });
});

describe('chat popover position', () => {
    const bounds = { left: 0, top: 0, right: 1000, bottom: 800 };
    const size = { width: 200, height: 300 };

    it('anchors the menu under the pointer by default', () => {
        expect(resolveChatPopoverPosition({ anchor: { x: 100, y: 100 }, size, bounds })).toEqual({
            left: 104,
            top: 104
        });
    });

    it('flips to the left of the pointer when there is no room on the right', () => {
        expect(resolveChatPopoverPosition({ anchor: { x: 900, y: 100 }, size, bounds })).toEqual({
            left: 696,
            top: 104
        });
    });

    it('flips above the pointer when there is no room below', () => {
        expect(resolveChatPopoverPosition({ anchor: { x: 100, y: 700 }, size, bounds })).toEqual({
            left: 104,
            top: 396
        });
    });

    it('flips on both axes when the pointer is near the bottom-right corner', () => {
        expect(resolveChatPopoverPosition({ anchor: { x: 900, y: 700 }, size, bounds })).toEqual({
            left: 696,
            top: 396
        });
    });

    it('clamps inside a bounds area that is narrower than the menu', () => {
        expect(resolveChatPopoverPosition({
            anchor: { x: 200, y: 100 },
            size: { width: 320, height: 200 },
            bounds: { left: 0, top: 0, right: 300, bottom: 800 }
        })).toEqual({
            left: 8,
            top: 104
        });
    });
});
