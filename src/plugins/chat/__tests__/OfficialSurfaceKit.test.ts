import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readSource = (relativePath: string): string => {
    return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
};

const OFFICIAL_SURFACE_FILES = [
    '../surfaces/CharacterRosterSurface.vue',
    '../surfaces/ConversationSessionListSurface.vue',
    '../surfaces/ChatTranscriptSurface.vue',
    '../surfaces/ChatComposerSurface.vue',
    '../surfaces/ChatPromptInspectorSurface.vue',
    '../surfaces/ChatMainSurface.vue',
    '../ChatPreview.vue'
] as const;

const PRESENTATION_COMPONENT_FILES = [
    '../components/ChatHeader.vue',
    '../components/ChatTranscript.vue',
    '../components/ChatMessage.vue',
    '../components/ChatStreamingMessage.vue',
    '../components/ChatComposer.vue',
    '../components/ChatToolbar.vue',
    '../components/MessageRenderer.vue'
] as const;

const PRESENTATION_BLOCK_FILES = [
    '../components/blocks/AlertBlock.vue',
    '../components/blocks/BadgeBlock.vue',
    '../components/blocks/ChoiceBlock.vue',
    '../components/blocks/ProgressBlock.vue',
    '../components/blocks/QuoteBlock.vue',
    '../components/blocks/SepBlock.vue',
    '../components/blocks/StatBlock.vue',
    '../components/blocks/TextBlock.vue',
    '../components/blocks/ThinkingBlock.vue'
] as const;

const PRESENTATION_LOGIC_FILES = [
    '../presentation/ChatMessageRenderPreferences.ts',
    '../presentation/ChatStreamingPresentation.ts'
] as const;

const FORBIDDEN_PRESENTATION_IMPORTS = [
    'pinia',
    'useSettings',
    'useConversationContextStore',
    'lwApi',
    'luminaWeaveApi',
    'api/index',
    'api/storage',
    'lwStorage',
    '/shell/',
    'desktop-modes',
    'window.LuminaWeave',
    'as any'
] as const;

describe('Official Surface Kit', () => {
    it('declares all official chat surfaces and business renderers', () => {
        const pluginSource = readSource('../index.ts');

        for (const contractId of [
            'character.roster',
            'conversation.sessionList',
            'chat.transcript',
            'chat.composer',
            'chat.promptInspector',
            'chat.main'
        ]) {
            expect(pluginSource, contractId).toContain(`'${contractId}'`);
        }
    });

    it('provides dedicated surface and presentation components', () => {
        for (const relativePath of [
            ...OFFICIAL_SURFACE_FILES,
            ...PRESENTATION_COMPONENT_FILES,
            ...PRESENTATION_BLOCK_FILES,
            ...PRESENTATION_LOGIC_FILES
        ]) {
            const componentUrl = new URL(relativePath, import.meta.url);
            expect(existsSync(fileURLToPath(componentUrl)), relativePath).toBe(true);
        }
    });

    it('keeps official presentation components behind typed surface context', () => {
        for (const relativePath of OFFICIAL_SURFACE_FILES) {
            const componentUrl = new URL(relativePath, import.meta.url);
            const componentExists = existsSync(fileURLToPath(componentUrl));
            expect(componentExists, relativePath).toBe(true);
            if (!componentExists) continue;
            const source = readSource(relativePath);
            expect(source, relativePath).toContain('useSurfaceRuntimeContext');
            for (const forbiddenImport of FORBIDDEN_PRESENTATION_IMPORTS) {
                expect(source, relativePath).not.toContain(forbiddenImport);
            }
        }

        for (const relativePath of [
            ...PRESENTATION_COMPONENT_FILES,
            ...PRESENTATION_BLOCK_FILES,
            ...PRESENTATION_LOGIC_FILES
        ]) {
            const componentUrl = new URL(relativePath, import.meta.url);
            const componentExists = existsSync(fileURLToPath(componentUrl));
            expect(componentExists, relativePath).toBe(true);
            if (!componentExists) continue;
            const source = readSource(relativePath);
            for (const forbiddenImport of FORBIDDEN_PRESENTATION_IMPORTS) {
                expect(source, relativePath).not.toContain(forbiddenImport);
            }
        }
    });

    it('acquires the shared chat application from renderer context factories', () => {
        const chatRootSource = readSource('../ChatRoot.vue');
        const pluginSource = readSource('../index.ts');

        expect(pluginSource).toContain('createChatMainSurfaceContext');
        expect(chatRootSource).not.toContain('new ChatApplicationController');
    });

    it('mounts the settings preview through SurfaceOutlet metadata', () => {
        const pluginSource = readSource('../index.ts');
        const settingsRegistrySource = readSource('../../settings/settingsRegistry.ts');
        const settingsCategorySource = readSource('../../settings/SettingsCategoryView.vue');

        expect(pluginSource).toContain("settingsPreviewSurface: { contractId: 'chat.preview', input: {} }");
        expect(pluginSource).not.toContain('settingsPreviewComponent: ChatPreview');
        expect(settingsRegistrySource).toContain('settingsPreviewSurface: plugin.settingsPreviewSurface');
        expect(settingsCategorySource).toContain('v-if="plugin?.settingsPreviewSurface"');
        expect(settingsCategorySource).toContain('<ThemedSurfaceOutlet');
        expect(settingsCategorySource).toContain(':contract-id="plugin.settingsPreviewSurface.contractId"');
        expect(settingsCategorySource).toContain(':input="plugin.settingsPreviewSurface.input"');
        expect(settingsCategorySource).toContain('contract-id="settings.control"');
    });

    it('keeps an unrecorded conversation group collapsed until the first toggle', () => {
        const sessionListSource = readSource('../surfaces/ConversationSessionListSurface.vue');

        expect(sessionListSource).toContain('expandedSessionGroups[groupKey] === true');
        expect(sessionListSource).not.toContain('expandedSessionGroups[groupKey] !== false');
    });

    it('keeps shell chat navigation inside generic typed presentation inputs', () => {
        const contractSource = readSource('../../../platform/surface/officialContracts.ts');
        const chatMainSource = readSource('../surfaces/ChatMainSurface.vue');
        const telegramStackSource = readSource('../../../shell/modes/telegram/TelegramMobileStack.vue');

        expect(contractSource).toContain('onBack?: () => void;');
        expect(contractSource).toContain('onOpenRoleProfile?: () => void;');
        expect(contractSource).toContain('onOpenPanel?: (panelId: string) => void;');
        expect(chatMainSource).toContain('<ChatHeader');
        expect(chatMainSource).toContain(':on-back="input.onBack"');
        expect(chatMainSource).toContain(':on-open-role-profile="input.onOpenRoleProfile"');
        expect(chatMainSource).toContain(':on-open-panel="input.onOpenPanel"');
        expect(contractSource).not.toContain('onTelegramBack');
        expect(contractSource).not.toContain('onTelegramOpenRoleProfile');
        expect(chatMainSource).not.toContain('onTelegram');
        expect(telegramStackSource).toContain('onBack: onPopRoute');
        expect(telegramStackSource).toContain('onOpenRoleProfile: onOpenRoleProfile');
        expect(telegramStackSource).toContain('onOpenPanel: onOpenPanel');
    });

    it('projects Telegram desktop header actions through generic chat.main input', () => {
        const traditionalShellSource = readSource('../../../shell/traditional/TraditionalShell.vue');

        expect(traditionalShellSource).toContain("contractId === 'chat.main' && isTelegramDesktopMode.value");
        expect(traditionalShellSource).toContain('onOpenRoleProfile: onOpenTelegramDesktopRoleProfile');
        expect(traditionalShellSource).toContain('onOpenPanel: onSwitchRightPanel');
        expect(traditionalShellSource).toContain("onSwitchRightPanel('telegram-profile')");
        expect(traditionalShellSource).not.toContain('onTelegramOpenRoleProfile:');
    });

    it('assembles Discord and Telegram business content through official surface contracts', () => {
        const traditionalShellSource = readSource('../../../shell/traditional/TraditionalShell.vue');
        const discordMobileSource = readSource('../../../shell/modes/discord/DiscordMobileShell.vue');
        const telegramDesktopSource = readSource('../../../shell/modes/telegram/TelegramDesktopPane.vue');
        const telegramMobileSource = readSource('../../../shell/modes/telegram/TelegramMobileStack.vue');

        expect(traditionalShellSource).not.toContain('<DiscordCharacterRail');
        expect(traditionalShellSource).not.toContain('<TelegramCharacterOverview');

        expect(discordMobileSource).toContain('<ThemedSurfaceOutlet');
        expect(discordMobileSource).toContain('contract-id="character.roster"');
        expect(discordMobileSource).not.toContain('DiscordCharacterRail');

        expect(telegramDesktopSource).toContain('contract-id="conversation.sessionList"');
        expect(telegramDesktopSource).toContain('contract-id="character.roster"');
        expect(telegramDesktopSource).not.toContain('DiscordCharacterRail');
        expect(telegramDesktopSource).not.toContain('TelegramRoleListPage');

        expect(telegramMobileSource).toContain('contract-id="conversation.sessionList"');
        expect(telegramMobileSource).toContain('contract-id="character.roster"');
        expect(telegramMobileSource).not.toContain('DiscordCharacterRail');
        expect(telegramMobileSource).not.toContain('TelegramCharacterOverview');
        expect(telegramMobileSource).not.toContain('TelegramRoleListPage');
    });

    it('keeps composed roster and session surfaces constrained by their shell containers', () => {
        const rosterSource = readSource('../surfaces/CharacterRosterSurface.vue');
        const discordMobileSource = readSource('../../../shell/modes/discord/DiscordMobileShell.vue');
        const telegramDesktopSource = readSource('../../../shell/modes/telegram/TelegramDesktopPane.vue');

        expect(rosterSource).toContain('.character-roster-surface.is-compact');
        expect(rosterSource).toContain('var(--lw-character-rail-width, 292px)');
        expect(discordMobileSource).toContain('.lw-discord-mobile-sheet.is-top .character-roster-surface');
        expect(discordMobileSource).toContain('.lw-discord-mobile-sheet.is-left .character-roster-surface');
        expect(telegramDesktopSource).toContain('.lw-telegram-left-stack > .character-roster-surface');
        expect(telegramDesktopSource).toContain('.lw-telegram-left-stack > .conversation-session-list');
    });

    it('routes choice blocks through typed chat intents and the shared composer draft', () => {
        const choiceSource = readSource('../components/blocks/ChoiceBlock.vue');
        const rendererSource = readSource('../components/MessageRenderer.vue');
        const composerSource = readSource('../components/ChatComposer.vue');
        const contextFactorySource = readSource('../surfaces/createChatSurfaceContexts.ts');

        expect(choiceSource).toContain('onSelect?: (text: string) => void;');
        expect(choiceSource).not.toContain("inject<LuminaWeaveAPI>('lwApi')");
        expect(choiceSource).not.toContain('useSettings');
        expect(rendererSource).toContain('onSelectChoice?: (text: string) => void;');
        expect(composerSource).toContain('draft: string;');
        expect(composerSource).toContain('onUpdateDraft: (text: string) => void;');
        expect(contextFactorySource).toContain("settingsDomainService.getEffectiveValue('lumina-chat.dialogueUIInteraction')");
        expect(contextFactorySource).toContain('settingsDomainService.onAnyChange');
    });

    it('projects message render preferences through typed surface state', () => {
        const contractSource = readSource('../../../platform/surface/officialContracts.ts');
        const contextFactorySource = readSource('../surfaces/createChatSurfaceContexts.ts');
        const mainSurfaceSource = readSource('../surfaces/ChatMainSurface.vue');
        const transcriptSurfaceSource = readSource('../surfaces/ChatTranscriptSurface.vue');
        const rendererSource = readSource('../components/MessageRenderer.vue');

        expect(contractSource).toContain('messageRenderPreferences: Readonly<Ref<ChatMessageRenderPreferences>>;');
        expect(contextFactorySource).toContain('settingsDomainService.getGlobalValue<unknown>');
        expect(contextFactorySource).toContain("'lumina-settings.thinkingDisplayMode'");
        expect(contextFactorySource).toContain("'lumina-chat.filterChatReply'");
        expect(mainSurfaceSource).toContain(':render-preferences="messageRenderPreferences"');
        expect(transcriptSurfaceSource).toContain(':render-preferences="messageRenderPreferences"');
        expect(rendererSource).toContain('renderPreferences?: ChatMessageRenderPreferences;');
        expect(rendererSource).not.toContain('lwStorage');
    });

    it('routes shell surfaces through the themed Surface wrapper', () => {
        const wrapperSource = readSource('../../../platform/surface/ThemedSurfaceOutlet.vue');
        const outletSource = readSource('../../../platform/surface/SurfaceOutlet.vue');
        const workspaceManagerSource = readSource('../../../composables/useWorkspaceManager.ts');

        expect(wrapperSource).toContain('computed((): string => props.contractId)');
        expect(wrapperSource).toContain('useSurfaceSkin(contractId)');
        expect(wrapperSource).toContain(':css-vars="skin.cssVars.value"');
        expect(outletSource).not.toContain('useSurfaceSkin');
        expect(workspaceManagerSource).toContain("import ThemedSurfaceOutlet from '../platform/surface/ThemedSurfaceOutlet.vue';");
        expect(workspaceManagerSource).toContain('component: ThemedSurfaceOutlet');
        expect(workspaceManagerSource).not.toContain('component: SurfaceOutlet');

        const freeformShellSource = readSource('../../../shell/freeform/FreeformShell.vue');
        const freeformActivitySource = readSource('../../../shell/freeform/FreeformWorkspaceActivityOutlet.vue');
        expect(freeformShellSource).toContain('<FreeformWorkspaceActivityOutlet');
        expect(freeformActivitySource).toContain(':is="entry.component"');
        expect(freeformShellSource).not.toContain('<ThemedSurfaceOutlet');
        expect(freeformActivitySource).not.toContain('<ThemedSurfaceOutlet');

        for (const relativePath of [
            '../../../platform/desktop-mode-runtime/DesktopCompositionNodeOutlet.vue',
            '../../../shell/ShellPrimaryActivityOutlet.vue',
            '../../../shell/traditional/TraditionalShell.vue',
            '../../../shell/DynamicTabOutlet.vue',
            '../../../shell/modes/telegram/TelegramMobileStack.vue'
        ]) {
            expect(readSource(relativePath), relativePath).toContain('<ThemedSurfaceOutlet');
        }
    });

    it('applies theme message layout and streaming preferences in presentation components', () => {
        const messageSource = readSource('../components/ChatMessage.vue');
        const streamingSource = readSource('../components/ChatStreamingMessage.vue');
        const transcriptSource = readSource('../components/ChatTranscript.vue');
        const composerSource = readSource('../components/ChatComposer.vue');
        const mainSurfaceSource = readSource('../surfaces/ChatMainSurface.vue');

        expect(messageSource).toContain(':data-message-shape="messageShape"');
        expect(messageSource).toContain(':data-avatar-placement="effectiveAvatarPlacement"');
        expect(messageSource).toContain('v-if="showInlineAvatar"');
        expect(messageSource).toContain('v-if="showMessageMeta"');
        expect(streamingSource).toContain('renderPreferences.streamingEffect');
        expect(streamingSource).toContain(':streaming-presentation="streamPresentation"');
        expect(transcriptSource).toContain('props.presentation.scrollRequest?.revision');
        expect(composerSource).toContain('props.presentation.composerFocusRequest?.revision');
        expect(mainSurfaceSource).toContain('composerCollapsed.value = false');
    });

    it('renders user input as markdown text without assistant interaction blocks', () => {
        const messageSource = readSource('../components/ChatMessage.vue');

        expect(messageSource).toMatch(/<TextBlock\s+v-if="message\.is_user"/);
        expect(messageSource).toMatch(/<MessageRenderer\s+v-else/);
        expect(messageSource).toContain(':text="message.mesRaw || message.mes"');
    });
});
