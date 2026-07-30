import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import type { DesktopExperienceRuntime } from '../../../api/services/DesktopExperienceRuntime.js';

describe('ChatSurfaceApplicationScope', () => {
    it('shares one controller and disposes it after the final surface release', async () => {
        const moduleUrl = new URL('../application/ChatSurfaceApplicationScope.ts', import.meta.url);
        const moduleExists = existsSync(fileURLToPath(moduleUrl));
        expect(moduleExists).toBe(true);
        if (!moduleExists) return;

        const conversationUnsubscribe = vi.fn();
        const generationUnsubscribe = vi.fn();
        const promptUnsubscribe = vi.fn();
        const runtime = {
            conversation: {
                getContext: vi.fn(async () => ({
                    source: 'chat',
                    sessionId: 'chat_1',
                    activeLeafId: null,
                    messages: [],
                    timelineGraph: {},
                    focusedMessage: null,
                    meta: { currentChatSessionId: 'chat_1', isLive: true }
                })),
                subscribe: vi.fn(() => conversationUnsubscribe),
                editMessage: vi.fn(async () => true),
                deleteMessage: vi.fn(async () => true),
                branchNode: vi.fn(async () => true)
            },
            generation: {
                sendMessage: vi.fn(async () => true),
                regenerateLast: vi.fn(async () => undefined),
                runEditedPrompt: vi.fn(async () => undefined),
                stop: vi.fn(async () => undefined),
                isGenerating: vi.fn(() => false),
                isSyncing: vi.fn(() => false),
                getLastStreamState: vi.fn(() => null),
                getLastPromptPayload: vi.fn(() => null),
                probePrompt: vi.fn(async () => null),
                subscribe: vi.fn(() => generationUnsubscribe),
                subscribePromptInspection: vi.fn(() => promptUnsubscribe)
            },
            activity: {
                confirm: vi.fn(async () => true),
                showToast: vi.fn(),
                subscribeChatPresentationCommands: vi.fn(() => vi.fn())
            }
        } as unknown as DesktopExperienceRuntime;
        const scopeModule = await import('../application/ChatSurfaceApplicationScope.js');

        const firstLease = scopeModule.acquireChatSurfaceApplication(runtime);
        const secondLease = scopeModule.acquireChatSurfaceApplication(runtime);
        await Promise.resolve();

        expect(firstLease.controller).toBe(secondLease.controller);
        expect(runtime.conversation.subscribe).toHaveBeenCalledTimes(1);
        expect(runtime.generation.subscribe).toHaveBeenCalledTimes(1);
        expect(runtime.generation.subscribePromptInspection).toHaveBeenCalledTimes(1);

        firstLease.release();
        expect(conversationUnsubscribe).not.toHaveBeenCalled();
        expect(generationUnsubscribe).not.toHaveBeenCalled();
        expect(promptUnsubscribe).not.toHaveBeenCalled();

        secondLease.release();
        expect(conversationUnsubscribe).toHaveBeenCalledTimes(1);
        expect(generationUnsubscribe).toHaveBeenCalledTimes(1);
        expect(promptUnsubscribe).toHaveBeenCalledTimes(1);
    });

    it('retries startup once and restores the existing lease after initial context loading fails', async () => {
        const recoveredContext = {
            source: 'chat' as const,
            sessionId: 'chat_recovered',
            activeLeafId: null,
            messages: [],
            timelineGraph: {},
            focusedMessage: null,
            meta: { currentChatSessionId: 'chat_recovered', isLive: true }
        };
        const getContext = vi.fn()
            .mockRejectedValueOnce(new Error('context load failed'))
            .mockResolvedValueOnce(recoveredContext);
        const runtime = {
            conversation: {
                getContext,
                subscribe: vi.fn(() => vi.fn()),
                editMessage: vi.fn(async () => true),
                deleteMessage: vi.fn(async () => true),
                branchNode: vi.fn(async () => true)
            },
            generation: {
                sendMessage: vi.fn(async () => true),
                regenerateLast: vi.fn(async () => undefined),
                runEditedPrompt: vi.fn(async () => undefined),
                stop: vi.fn(async () => undefined),
                isGenerating: vi.fn(() => false),
                isSyncing: vi.fn(() => false),
                getLastStreamState: vi.fn(() => null),
                getLastPromptPayload: vi.fn(() => null),
                probePrompt: vi.fn(async () => null),
                subscribe: vi.fn(() => vi.fn()),
                subscribePromptInspection: vi.fn(() => vi.fn())
            },
            activity: {
                confirm: vi.fn(async () => true),
                showToast: vi.fn(),
                subscribeChatPresentationCommands: vi.fn(() => vi.fn())
            }
        } as unknown as DesktopExperienceRuntime;
        const scopeModule = await import('../application/ChatSurfaceApplicationScope.js');

        const lease = scopeModule.acquireChatSurfaceApplication(runtime);

        await vi.waitFor(() => {
            expect(getContext).toHaveBeenCalledTimes(2);
            expect(lease.snapshot.value.context.sessionId).toBe('chat_recovered');
        });
        await Promise.resolve();
        expect(getContext).toHaveBeenCalledTimes(2);

        lease.release();
    });
});
