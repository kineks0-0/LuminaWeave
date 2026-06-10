import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const appSourceUrl = new URL('../../App.vue', import.meta.url);
const payloadComposableUrl = new URL('../../composables/shell/useShellRuntimePayload.ts', import.meta.url);

const readAppSource = () => readFileSync(appSourceUrl, 'utf-8');

describe('App shell runtime payload composable', () => {
  it('keeps shell runtime payload assembly in a shell composable', () => {
    const appSource = readAppSource();

    expect(existsSync(payloadComposableUrl), 'composables/shell/useShellRuntimePayload.ts').toBe(true);
    expect(appSource).toContain("import { useShellRuntimePayload } from './composables/shell/useShellRuntimePayload.js';");
    expect(appSource).toContain('} = useShellRuntimePayload({');

    [
      'computed<ShellRuntimeContext>',
      'computed<ShellRuntimeSurfaces>',
      'computed<ShellRuntimeActions>',
      'computed<ShellRuntimeFrame>',
      'const shellRuntimeContext = computed',
      'const shellRuntimeSurfaces = computed',
      'const shellRuntimeActions = computed',
      'const shellRuntimeFrame = computed'
    ].forEach((inlinePayloadDetail) => {
      expect(appSource).not.toContain(inlinePayloadDetail);
    });
  });

  it('keeps App as the state and lifecycle owner', () => {
    const appSource = readAppSource();

    [
      'const activeMainTab = ref',
      'const dynamicTabs = ref',
      'useShellBootstrap({',
      'useDesktopMode()',
      'useWorkspaceManager({',
      'useWidgetPanels({',
      'useTelegramShell({',
      'useDiscordShell({'
    ].forEach((appOwnedBoundary) => {
      expect(appSource).toContain(appOwnedBoundary);
    });
  });
});
