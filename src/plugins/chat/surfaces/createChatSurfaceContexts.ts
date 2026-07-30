import type {
    ChatApplicationSurfaceState,
    ChatChoiceInteractionMode,
    CharacterChannelSurfaceState
} from '../../../platform/surface/officialContracts.js';
import type {
    SurfaceRendererContextFactoryInput,
    SurfaceRendererContextValues
} from '../../../platform/surface/types.js';
import { acquireChatSurfaceApplication } from '../application/ChatSurfaceApplicationScope.js';
import { shallowRef, type ShallowRef } from 'vue';
import { settingsDomainService } from '../../../api/services/SettingsDomainService.js';
import {
    DEFAULT_CHAT_MESSAGE_RENDER_PREFERENCES,
    resolveChatStreamingEffect,
    type ChatMessageRenderPreferences
} from '../presentation/ChatMessageRenderPreferences.js';

type ChatSurfaceContextInput = Pick<
    SurfaceRendererContextFactoryInput<'chat.main'>,
    'runtime' | 'onDispose'
>;

const resolveChoiceInteractionMode = (): ChatChoiceInteractionMode => (
    settingsDomainService.getEffectiveValue('lumina-chat.dialogueUIInteraction') === 'fill'
        ? 'fill'
        : 'generate'
);

const resolveMessageRenderPreferences = (): ChatMessageRenderPreferences => {
    const thinkingDisplayMode = settingsDomainService.getGlobalValue<unknown>(
        'lumina-settings.thinkingDisplayMode',
        DEFAULT_CHAT_MESSAGE_RENDER_PREFERENCES.thinkingDisplayMode
    );

    return {
        ...DEFAULT_CHAT_MESSAGE_RENDER_PREFERENCES,
        thinkingDisplayMode: thinkingDisplayMode === 'hidden' ? 'hidden' : 'collapsible',
        thinkingAutoExpand: Boolean(settingsDomainService.getGlobalValue<unknown>(
            'lumina-settings.thinkingAutoExpand',
            DEFAULT_CHAT_MESSAGE_RENDER_PREFERENCES.thinkingAutoExpand
        )),
        filterChatReply: Boolean(settingsDomainService.getGlobalValue<unknown>(
            'lumina-chat.filterChatReply',
            DEFAULT_CHAT_MESSAGE_RENDER_PREFERENCES.filterChatReply
        )),
        allowTopLevelInFilter: Boolean(settingsDomainService.getGlobalValue<unknown>(
            'lumina-chat.allowTopLevelInFilter',
            DEFAULT_CHAT_MESSAGE_RENDER_PREFERENCES.allowTopLevelInFilter
        )),
        implicitThinkingInFilter: Boolean(settingsDomainService.getGlobalValue<unknown>(
            'lumina-chat.implicitThinkingInFilter',
            DEFAULT_CHAT_MESSAGE_RENDER_PREFERENCES.implicitThinkingInFilter
        )),
        streamingEffect: resolveChatStreamingEffect(settingsDomainService.getGlobalValue<unknown>(
            'lumina-chat.streamingEffect',
            DEFAULT_CHAT_MESSAGE_RENDER_PREFERENCES.streamingEffect
        ))
    };
};

interface ChatPresentationSettings {
    choiceInteractionMode: Readonly<ShallowRef<ChatChoiceInteractionMode>>;
    messageRenderPreferences: Readonly<ShallowRef<ChatMessageRenderPreferences>>;
}

const createChatPresentationSettings = (
    context: ChatSurfaceContextInput
): ChatPresentationSettings => {
    const choiceInteractionMode = shallowRef<ChatChoiceInteractionMode>(resolveChoiceInteractionMode());
    const messageRenderPreferences = shallowRef<ChatMessageRenderPreferences>(
        resolveMessageRenderPreferences()
    );
    context.onDispose(settingsDomainService.onAnyChange(() => {
        choiceInteractionMode.value = resolveChoiceInteractionMode();
        messageRenderPreferences.value = resolveMessageRenderPreferences();
    }));
    return { choiceInteractionMode, messageRenderPreferences };
};

const createApplicationState = (
    context: ChatSurfaceContextInput,
    snapshot: ReturnType<typeof acquireChatSurfaceApplication>['snapshot']
): ChatApplicationSurfaceState => {
    const presentationSettings = createChatPresentationSettings(context);
    return {
        snapshot,
        character: context.runtime.character.state,
        choiceInteractionMode: presentationSettings.choiceInteractionMode,
        messageRenderPreferences: presentationSettings.messageRenderPreferences,
        defaultAvatar: context.runtime.character.defaultAvatar,
        resolveMessageAvatar: (message) => context.runtime.character.resolveMessageAvatar(message)
    };
};

const createCharacterState = (
    context: SurfaceRendererContextFactoryInput<'character.roster'>
): CharacterChannelSurfaceState => ({
    channel: context.runtime.character.state
});

export const createCharacterRosterSurfaceContext = (
    context: SurfaceRendererContextFactoryInput<'character.roster'>
): SurfaceRendererContextValues<'character.roster'> => ({
    state: createCharacterState(context),
    intents: {
        refresh: () => context.runtime.character.refresh(),
        openSession: (sessionId) => context.runtime.character.openSession(sessionId),
        createSession: (input) => context.runtime.character.createSession(input),
        toggleGroup: (groupKey) => context.runtime.character.toggleGroup(groupKey)
    }
});

export const createConversationSessionListSurfaceContext = (
    context: SurfaceRendererContextFactoryInput<'conversation.sessionList'>
): SurfaceRendererContextValues<'conversation.sessionList'> => ({
    state: { channel: context.runtime.character.state },
    intents: {
        openSession: (sessionId) => context.runtime.character.openSession(sessionId),
        renameSession: (sessionId, nextTitle) => context.runtime.character.renameSession({
            sessionId,
            nextTitle
        }),
        deleteSession: async (sessionId) => {
            const confirmed = await context.runtime.activity.confirm({
                title: '删除会话',
                message: '确定要删除这个会话吗？此操作无法撤销。',
                confirmText: '确认删除',
                danger: true
            });
            if (!confirmed) return;
            await context.runtime.character.deleteSession({ sessionId });
        },
        closeCurrentSession: () => context.runtime.character.closeCurrentSession(),
        toggleGroupSessionExpansion: (groupKey) => context.runtime.character.toggleGroupSessionExpansion(groupKey)
    }
});

const acquireApplication = <K extends 'chat.main' | 'chat.transcript' | 'chat.composer' | 'chat.promptInspector'>(
    context: SurfaceRendererContextFactoryInput<K>
): ReturnType<typeof acquireChatSurfaceApplication> => {
    const lease = acquireChatSurfaceApplication(context.runtime);
    context.onDispose(lease.release);
    return lease;
};

export const createChatMainSurfaceContext = (
    context: SurfaceRendererContextFactoryInput<'chat.main'>
): SurfaceRendererContextValues<'chat.main'> => {
    const lease = acquireApplication(context);
    return {
        state: createApplicationState(context, lease.snapshot),
        intents: lease.intents
    };
};

export const createChatTranscriptSurfaceContext = (
    context: SurfaceRendererContextFactoryInput<'chat.transcript'>
): SurfaceRendererContextValues<'chat.transcript'> => {
    const lease = acquireApplication(context);
    return {
        state: createApplicationState(context, lease.snapshot),
        intents: lease.intents
    };
};

export const createChatComposerSurfaceContext = (
    context: SurfaceRendererContextFactoryInput<'chat.composer'>
): SurfaceRendererContextValues<'chat.composer'> => {
    const lease = acquireApplication(context);
    return {
        state: createApplicationState(context, lease.snapshot),
        intents: lease.intents
    };
};

export const createChatPromptInspectorSurfaceContext = (
    context: SurfaceRendererContextFactoryInput<'chat.promptInspector'>
): SurfaceRendererContextValues<'chat.promptInspector'> => {
    const lease = acquireApplication(context);
    return {
        state: createApplicationState(context, lease.snapshot),
        intents: lease.intents
    };
};
