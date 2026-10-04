import { describe, expect, it } from 'vitest';
import {
    CHAT_CONTEXT_TOOLS,
    buildChatHeaderMenu,
    buildChatMessageMenu,
    buildConversationSessionMenu,
    buildPromptPresetMenu,
    resolveChatPopoverPosition,
    resolveSessionMenuPlacement
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

    it('appends prompt asset entries when the host provides the handlers', () => {
        expect(buildChatHeaderMenu({ canOpenProfile: false, showPromptAssets: true }).map(item => item.id))
            .toEqual(['search', 'prompt', 'prompt-presets', 'regex-scripts']);
        expect(buildChatHeaderMenu({ canOpenProfile: true, showPromptAssets: true }).map(item => item.id))
            .toEqual(['search', 'profile', 'prompt', 'prompt-presets', 'regex-scripts']);
    });
});

describe('prompt preset menu', () => {
    it('lists presets with the active one checked and always offers management', () => {
        const items = buildPromptPresetMenu([
            { id: 'a', name: '预设 A', promptCount: 3 },
            { id: 'b', name: '预设 B', promptCount: 5 }
        ], 'b');

        expect(items.map(item => item.id)).toEqual(['preset:a', 'preset:b', 'manage-prompt-presets']);
        expect(items[0].selected).toBe(false);
        expect(items[1].selected).toBe(true);
        expect(items[1].icon).toBe('preset');
        expect(items[2].label).toBe('管理预设…');
    });

    it('keeps the management entry when there are no presets', () => {
        const items = buildPromptPresetMenu([], '');
        expect(items.map(item => item.id)).toEqual(['manage-prompt-presets']);
    });
});

describe('conversation session menu', () => {
    it('offers rename, duplicate and delete with delete marked dangerous', () => {
        const items = buildConversationSessionMenu();
        expect(items.map(item => item.id)).toEqual(['rename', 'duplicate', 'delete']);
        expect(items.find(item => item.id === 'delete')?.danger).toBe(true);
        expect(items.find(item => item.id === 'duplicate')?.icon).toBe('copy');
    });

    it('flips the menu above when the row sits near the container bottom', () => {
        expect(resolveSessionMenuPlacement({ bottom: 100 }, { bottom: 500 })).toBe('below');
        expect(resolveSessionMenuPlacement({ bottom: 480 }, { bottom: 500 })).toBe('above');
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
