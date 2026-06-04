import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readShellRootSource = () =>
    readFileSync(new URL('../LuminaShellRoot.vue', import.meta.url), 'utf-8');

describe('LuminaShellRoot runtime boundary', () => {
    it('accepts structured shell runtime payloads instead of raw shell state props', () => {
        const source = readShellRootSource();

        expect(source).toContain('runtimeContext: ShellRuntimeContext');
        expect(source).toContain('runtimeSurfaces: ShellRuntimeSurfaces');
        expect(source).toContain('runtimeActions: ShellRuntimeActions');
        expect(source).toContain('runtimeFrame: ShellRuntimeFrame');

        [
            'shouldShowDiscordGuildRail:',
            'workspaceStageStripItems:',
            'activeWidgetPlugin:',
            'onOpenDiscordChatSession:',
            'onHandleWorkspaceDockOpenWithNavigation:'
        ].forEach((rawPropName) => {
            expect(source).not.toContain(rawPropName);
        });
    });
});
