import { nextTick, ref, watch, type Ref } from 'vue';
import type { DesktopExperienceRuntime } from '../../api/services/DesktopExperienceRuntime.js';
import type { CreateChatConversationInput } from '../../types/ConversationContextTypes.js';

type PendingConversationAction =
    | { kind: 'open'; sessionId: string }
    | { kind: 'create'; target: CreateChatConversationInput };

/**
 * 任意桌面模式的 shell 都能调用的通用会话导航：打开 / 新建会话时若不在聊天页，
 * 先切到聊天页，等标签切换完成后再执行，避免跨页竞态。
 */
export const useConversationNavigation = ({
    activeMainTab,
    runtime,
    switchMainView
}: {
    activeMainTab: Ref<string>;
    runtime: DesktopExperienceRuntime;
    switchMainView: (tabId: string) => void;
}) => {
    const characterChannelService = runtime.character;
    const pendingAction = ref<PendingConversationAction | null>(null);

    const openSessionNow = async (sessionId: string) => {
        await characterChannelService.openSession(sessionId);
    };

    const openSession = async (sessionId: string) => {
        if (!sessionId) return;
        if (activeMainTab.value === 'lumina-chat') {
            await openSessionNow(sessionId);
            return;
        }
        pendingAction.value = { kind: 'open', sessionId };
        switchMainView('lumina-chat');
        await nextTick();
    };

    const createSessionNow = async (target: CreateChatConversationInput) => {
        await characterChannelService.createSession(target);
    };

    const createSession = async (target: CreateChatConversationInput) => {
        if (activeMainTab.value === 'lumina-chat') {
            await createSessionNow(target);
            return;
        }
        pendingAction.value = { kind: 'create', target };
        switchMainView('lumina-chat');
        await nextTick();
    };

    watch(activeMainTab, async (value) => {
        if (value !== 'lumina-chat' || !pendingAction.value) return;
        const action = pendingAction.value;
        pendingAction.value = null;
        if (action.kind === 'open') {
            await openSessionNow(action.sessionId);
            return;
        }
        await createSessionNow(action.target);
    });

    return { openSession, createSession };
};
