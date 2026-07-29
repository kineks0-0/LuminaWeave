import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readSource = (relativePath: string): string => readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    'utf8'
);

describe('Chat presentation application boundary', () => {
    it('routes generation state and chat commands through the application controller', () => {
        const chatStreamSource = readSource('../ChatStream.vue');

        expect(chatStreamSource).not.toContain('useConversationContextStore');
        expect(chatStreamSource).not.toContain("lwApi?.on('GENERATION_");
        expect(chatStreamSource).not.toContain("lwApi?.on('BUFFER_UPDATED'");
        expect(chatStreamSource).not.toContain('services.generation.sendMessage');
        expect(chatStreamSource).not.toContain('services.generation.regenerateLast');
        expect(chatStreamSource).not.toContain('services.conversation.branchNode');
        expect(chatStreamSource).not.toContain('crudChatRecord');
        expect(chatStreamSource).not.toContain('abortGenerate');
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

    it('cleans Prompt Inspector listeners and delayed probes when the panel unmounts', () => {
        const promptInspectorSource = readSource('../PromptInspector.vue');

        expect(promptInspectorSource).toContain("lwApi?.off('ST_PROMPT_INTERCEPTED', onStPromptIntercepted)");
        expect(promptInspectorSource).toContain("lwApi?.off('LUMINA_PROMPT_BUILT', onLuminaPromptBuilt)");
        expect(promptInspectorSource).toContain('clearTimeout(probeTimer)');
    });
});
