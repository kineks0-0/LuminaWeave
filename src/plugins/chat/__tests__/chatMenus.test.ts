import { describe, expect, it } from 'vitest';
import {
    CHAT_CONTEXT_TOOLS,
    buildChatHeaderMenu,
    buildChatMessageMenu,
    resolveChatMenuPlacement
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

describe('chat menu placement', () => {
    const viewport = { top: 0, bottom: 800 };

    it('opens below the anchor when there is room', () => {
        expect(resolveChatMenuPlacement({ anchorTop: 100, anchorBottom: 160, viewport, menuHeight: 240 })).toBe('below');
    });

    it('flips above when the space below is too small', () => {
        expect(resolveChatMenuPlacement({ anchorTop: 600, anchorBottom: 660, viewport, menuHeight: 240 })).toBe('above');
    });

    it('picks the roomier side when neither fits', () => {
        expect(resolveChatMenuPlacement({ anchorTop: 200, anchorBottom: 560, viewport, menuHeight: 300 })).toBe('below');
        expect(resolveChatMenuPlacement({ anchorTop: 280, anchorBottom: 620, viewport, menuHeight: 300 })).toBe('above');
    });
});
