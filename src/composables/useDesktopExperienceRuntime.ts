import { onScopeDispose, provide, type InjectionKey } from 'vue';
import { luminaWeaveApi } from '../api/index.js';
import { CharacterChannelService } from '../api/core/conversation/CharacterChannelService.js';
import { DesktopExperienceRuntime } from '../api/services/DesktopExperienceRuntime.js';
import { useConversationContextStore } from '../stores/useConversationContextStore.js';

export const desktopExperienceRuntimeKey: InjectionKey<DesktopExperienceRuntime> = Symbol('desktop-experience-runtime');

export interface DesktopExperienceRuntimeComposition {
    runtime: DesktopExperienceRuntime;
    contextStore: ReturnType<typeof useConversationContextStore>;
}

export const useDesktopExperienceRuntime = (): DesktopExperienceRuntimeComposition => {
    const contextStore = useConversationContextStore();
    const runtime = new DesktopExperienceRuntime({
        conversation: luminaWeaveApi.services.conversation,
        generation: luminaWeaveApi.services.generation,
        character: new CharacterChannelService(luminaWeaveApi, contextStore),
        activity: luminaWeaveApi.services.desktopSurface,
        feedback: luminaWeaveApi.services.host,
        chatPresentationCommands: luminaWeaveApi.services.chatPresentationCommands
    });

    provide(desktopExperienceRuntimeKey, runtime);
    onScopeDispose(() => runtime.dispose());

    return { runtime, contextStore };
};
