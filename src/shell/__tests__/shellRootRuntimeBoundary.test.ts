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

    it('keeps the concrete shell mounted and projects composition into its activity region', () => {
        const source = readShellRootSource();
        const traditionalSource = readFileSync(
            new URL('../traditional/TraditionalShell.vue', import.meta.url),
            'utf-8'
        );
        const freeformSource = readFileSync(
            new URL('../freeform/FreeformShell.vue', import.meta.url),
            'utf-8'
        );

        expect(source).toContain('DesktopCompositionOutlet');
        expect(source).toContain('#activity');
        expect(source).toContain('#composition="{ activityComponent, activityComponentProps }"');
        expect(source).toContain(':is="currentShellRenderer"');
        expect(source).not.toContain('v-if="hasComposition"');
        expect(source).not.toContain('const hasComposition');
        expect(source).not.toContain("import FreeformShell from './freeform/FreeformShell.vue';");
        expect(source).not.toContain("import TraditionalShell from './traditional/TraditionalShell.vue';");
        expect(source).not.toContain("props.runtimeContext.shellKind === 'freeform'");
        expect(traditionalSource).toContain('name="composition"');
        expect(freeformSource).toContain('name="composition"');
    });

    it('keeps the Telegram mobile navigation stack inside the Telegram mode package', () => {
        const telegramShellSource = readFileSync(
            new URL('../../desktop-modes/builtins/telegram/shell/TelegramShell.vue', import.meta.url),
            'utf-8'
        );
        const traditionalSource = readFileSync(
            new URL('../traditional/TraditionalShell.vue', import.meta.url),
            'utf-8'
        );

        expect(traditionalSource).toContain(':activity-component="resolvedActivityComponent"');
        expect(traditionalSource).toContain(':activity-component-props="resolvedActivityComponentProps"');
        expect(traditionalSource).not.toContain('TelegramMobileStack');
        expect(telegramShellSource).toContain('isTelegramMobileMode.value ? TelegramMobileStack : undefined');
        expect(telegramShellSource).toContain('route: telegramMobileCurrentRoute.value');
        expect(telegramShellSource).toContain('showBottomNavPadding: showBottomNav.value');
    });

    it('feeds the workspace manager from the complete plugin registry', () => {
        const appSource = readFileSync(new URL('../../App.vue', import.meta.url), 'utf-8');
        const workspaceSource = readFileSync(
            new URL('../../composables/useWorkspaceManager.ts', import.meta.url),
            'utf-8'
        );

        expect(appSource).toContain('pluginManager.getPlugins()');
        expect(appSource).toContain('useWorkspaceManager({\n  plugins: workspacePlugins,');
        expect(workspaceSource).toContain('plugins: ComputedRef<LuminaPlugin[]>;');
        expect(workspaceSource).not.toContain('...mainPlugins.value');
        expect(workspaceSource).not.toContain('...widgetPlugins.value');
    });

    it('isolates composition renderer identity across modes, viewports, nodes, and contracts', () => {
        const outletSource = readFileSync(
            new URL('../../platform/desktop-mode-runtime/DesktopCompositionOutlet.vue', import.meta.url),
            'utf-8'
        );
        const nodeOutletSource = readFileSync(
            new URL('../../platform/desktop-mode-runtime/DesktopCompositionNodeOutlet.vue', import.meta.url),
            'utf-8'
        );

        expect(outletSource).toContain(':key="compositionRenderKey"');
        expect(outletSource).toContain('props.isMobile ? \'mobile\' : \'desktop\'');
        expect(nodeOutletSource).toContain(':key="getNodeRenderKey(child)"');
        expect(nodeOutletSource).toContain('node.contractId');
    });

    it('keeps Forge and Launcher business identities out of freeform shell and workspace catalog', () => {
        const shellSource = readFileSync(new URL('../freeform/FreeformShell.vue', import.meta.url), 'utf-8');
        const menuSource = readFileSync(new URL('../freeform/WorkspaceMenu.vue', import.meta.url), 'utf-8');
        const workspaceSource = readFileSync(
            new URL('../../composables/useWorkspaceManager.ts', import.meta.url),
            'utf-8'
        );
        const widgetPanelSource = readFileSync(
            new URL('../../composables/shell/useWidgetPanels.ts', import.meta.url),
            'utf-8'
        );

        expect(shellSource).not.toContain('ForgeWorkspaceWindowActions');
        expect(shellSource).not.toContain("entry.appId === 'panel:card_maker'");
        expect(shellSource).not.toContain('contract-id="launcher.root"');
        expect(shellSource).not.toContain('showWorkspaceLaunchpad');
        expect(shellSource).not.toContain('currentDetailedView');
        expect(menuSource).not.toContain('createStageWithLauncher');
        expect(menuSource).not.toContain('openWorkspaceSettings');
        expect(workspaceSource).not.toContain('FORGE_AUX_PANEL');
        expect(workspaceSource).not.toContain("'plugin:lumina-launcher'");
        expect(workspaceSource).not.toContain("'panel:card_maker'");
        expect(workspaceSource).not.toContain('useSessionIndexStore');
        expect(workspaceSource).not.toContain("'plugin:context-switcher'");
        expect(workspaceSource).not.toContain('currentDetailedView');
        expect(widgetPanelSource).not.toContain('lumina-launcher');
    });

    it('keeps Forge presentation and identity checks out of the traditional shell boundary', () => {
        const appSource = readFileSync(new URL('../../App.vue', import.meta.url), 'utf-8');
        const shellSource = readFileSync(
            new URL('../traditional/TraditionalShell.vue', import.meta.url),
            'utf-8'
        );
        const payloadSource = readFileSync(
            new URL('../../composables/shell/useShellRuntimePayload.ts', import.meta.url),
            'utf-8'
        );
        const widgetHostSource = readFileSync(
            new URL('../traditional/WidgetPanelHost.vue', import.meta.url),
            'utf-8'
        );
        const forgeWorkspaceSource = readFileSync(
            new URL('../../plugins/forge/app/CardMakerPanel.vue', import.meta.url),
            'utf-8'
        );
        const primaryActivitySource = readFileSync(
            new URL('../ShellPrimaryActivityOutlet.vue', import.meta.url),
            'utf-8'
        );

        for (const source of [appSource, shellSource, payloadSource]) {
            expect(source).not.toContain('ForgeSidebar');
            expect(source).not.toContain('shouldShowForgeSidebar');
            expect(source).not.toContain('isForgeSidebarCollapsed');
            expect(source).not.toContain('isForgeActiveInTraditional');
        }

        expect(shellSource).toContain("auxSidebarMode: props.runtimeContext.isMobile ? 'hidden' : props.runtimeContext.traditional.sidebarMode");
        expect(shellSource).toContain('activeRightPanelId: props.runtimeContext.traditional.activeRightPanel');
        // 主 Activity outlet 是 traditional shell 实际渲染 surface 的入口，必须透传 aux 位置环境，否则 Forge 无法切换辅助侧栏模式。
        expect(primaryActivitySource).toContain("auxSidebarMode: props.runtimeContext.isMobile ? 'hidden' : props.runtimeContext.traditional.sidebarMode");
        expect(primaryActivitySource).toContain('activeRightPanelId: props.runtimeContext.traditional.activeRightPanel');
        expect(shellSource).not.toContain('officialPanelSurfaces');
        expect(widgetHostSource).not.toContain('officialPanelSurfaces');
        expect(forgeWorkspaceSource).toContain('<ForgeSidebar');
        expect(forgeWorkspaceSource).toContain('resolveForgeWorkspacePlacement');
        expect(forgeWorkspaceSource).not.toContain("props.auxSidebarMode === 'left'");
    });
});
