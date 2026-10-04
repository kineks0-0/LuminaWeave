import { defineComponent } from 'vue';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../desktopModeStyles.js', () => ({
    applyDesktopModeStyles: vi.fn()
}));

vi.mock('../../../desktop-modes/builtins/telegram/shell/TelegramUserInfoPanel.vue', () => ({
    default: defineComponent({ name: 'TelegramUserInfoPanelStub', template: '<div />' })
}));
vi.mock('../../../shell/traditional/TraditionalShell.vue', () => ({
    default: defineComponent({ name: 'TraditionalShellStub', template: '<div />' })
}));
vi.mock('../../../shell/freeform/FreeformShell.vue', () => ({
    default: defineComponent({ name: 'FreeformShellStub', template: '<div />' })
}));

import { applyDesktopModeStyles } from '../desktopModeStyles.js';
import { initializeDesktopModeRuntime } from '../initializeDesktopModeRuntime.js';
import { desktopModeRuntimeRegistry } from '../DesktopModeRuntimeRegistry.js';
import { initializeSurfaceRuntime } from '../../surface/initializeSurfaceRuntime.js';

const injectedStylesFor = (modeId: string): unknown => {
    const call = vi.mocked(applyDesktopModeStyles).mock.calls.find(([id]) => id === modeId);
    return call?.[1];
};

describe('desktop mode style bootstrap', () => {
    beforeAll(() => {
        initializeSurfaceRuntime();
    });

    it('applies builtin binding styles when registering builtin desktop modes', () => {
        vi.mocked(applyDesktopModeStyles).mockClear();
        desktopModeRuntimeRegistry.clearForTests();

        initializeDesktopModeRuntime();

        // Vitest 将 ?raw CSS 置空，这里只断言绑定后的 styles 被传入（回归点是 undefined）。
        for (const modeId of ['discord', 'telegram']) {
            expect(typeof injectedStylesFor(modeId)).toBe('string');
        }
    });
});
