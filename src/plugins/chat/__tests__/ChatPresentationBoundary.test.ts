import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readSource = (relativePath: string): string => readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    'utf8'
);

describe('Chat presentation application boundary', () => {
    it('removes the coupled ChatStream and keeps official surfaces behind typed context', () => {
        const chatStreamUrl = new URL('../ChatStream.vue', import.meta.url);
        const surfaceSources = [
            '../surfaces/ChatMainSurface.vue',
            '../surfaces/ChatTranscriptSurface.vue',
            '../surfaces/ChatComposerSurface.vue',
            '../surfaces/ChatPromptInspectorSurface.vue'
        ].map(readSource);

        expect(existsSync(fileURLToPath(chatStreamUrl))).toBe(false);
        for (const source of surfaceSources) {
            expect(source).toContain('useSurfaceRuntimeContext');
            expect(source).not.toContain('useConversationContextStore');
            expect(source).not.toContain('luminaWeaveApi');
            expect(source).not.toContain('desktop-modes');
        }
    });

    it('removes the legacy chat store after the controller becomes the message owner', () => {
        const chatStoreUrl = new URL('../../../stores/useChatStore.ts', import.meta.url);
        const conversationViewStoreUrl = new URL('../../../stores/useConversationViewStore.ts', import.meta.url);
        const contextStoreSource = readSource('../../../stores/useConversationContextStore.ts');
        const pluginSource = readSource('../index.ts');

        expect(existsSync(fileURLToPath(chatStoreUrl))).toBe(false);
        expect(existsSync(fileURLToPath(conversationViewStoreUrl))).toBe(false);
        expect(pluginSource).not.toContain('useChatStore');
        expect(contextStoreSource).not.toContain('activeMessages');
        expect(contextStoreSource).not.toContain('currentContext.value.messages');
    });

    it('keeps Prompt Inspector host-neutral and clears its delayed probe', () => {
        const promptInspectorSource = readSource('../PromptInspector.vue');

        expect(promptInspectorSource).not.toContain('lwApi');
        expect(promptInspectorSource).not.toContain("inject(");
        expect(promptInspectorSource).toContain('clearTimeout(probeTimer)');
    });

    it('keeps the switching chat page light by hiding the previous session transcript', () => {
        const mainSurfaceSource = readSource('../surfaces/ChatMainSurface.vue');
        const transcriptSource = readSource('../components/ChatTranscript.vue');

        expect(mainSurfaceSource).toContain('transcriptMessages');
        expect(mainSurfaceSource).toContain('targetSessionId !== snapshot.value.context.sessionId');
        expect(mainSurfaceSource).toContain('enterTransitionMs');
        expect(mainSurfaceSource).toContain('messagesPending');
        expect(transcriptSource).toContain('messagesPending');
        expect(transcriptSource).toContain('chat-transcript-reveal');
    });

    it('opens prompt asset panels in a mobile sheet instead of navigating to settings', () => {
        const mainSurfaceSource = readSource('../surfaces/ChatMainSurface.vue');
        const sheetSource = readSource('../components/ChatPromptAssetsSheet.vue');

        expect(mainSurfaceSource).toContain('ChatPromptAssetsSheet');
        expect(mainSurfaceSource).toContain('input.isMobile');
        expect(mainSurfaceSource).toContain('openPromptAssetsSheet(target)');
        expect(mainSurfaceSource).toContain('promptAssetsSheetTarget');
        expect(sheetSource).toContain('SETTINGS_PANEL_COMPONENTS');
        expect(sheetSource).toContain('chat-regex-scripts');
        expect(sheetSource).toContain('chat-prompt-presets');
    });

    it('hosts the prompt inspector in a bottom sheet on every layout', () => {
        const mainSurfaceSource = readSource('../surfaces/ChatMainSurface.vue');
        const sheetSource = readSource('../components/ChatPromptInspectorSheet.vue');

        expect(mainSurfaceSource).toContain('ChatPromptInspectorSheet');
        expect(mainSurfaceSource).not.toContain('chat-main-surface__inspector');
        expect(sheetSource).toContain('role="dialog"');
        expect(sheetSource).toContain("event.key !== 'Escape'");
        expect(sheetSource).toContain('PromptInspector');
    });
});
