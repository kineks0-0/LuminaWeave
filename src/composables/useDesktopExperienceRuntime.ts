import { provide, type InjectionKey } from 'vue';
import { luminaWeaveApi } from '../api/index.js';
import { DesktopExperienceRuntime } from '../api/services/DesktopExperienceRuntime.js';
import { useConversationContextStore } from '../stores/useConversationContextStore.js';

export const desktopExperienceRuntimeKey: InjectionKey<DesktopExperienceRuntime> = Symbol('desktop-experience-runtime');

export interface DesktopExperienceRuntimeComposition {
    runtime: DesktopExperienceRuntime;
    contextStore: ReturnType<typeof useConversationContextStore>;
}

export const useDesktopExperienceRuntime = (): DesktopExperienceRuntimeComposition => {
    const contextStore = useConversationContextStore();
    // character / timeline / activity 都是挂在 lwApi.services 上的应用级共享实例，
    // 本 composable 不拥有它们，也就没有需要在作用域销毁时释放的东西。
    const runtime = new DesktopExperienceRuntime({
        conversation: luminaWeaveApi.services.conversation,
        generation: luminaWeaveApi.services.generation,
        character: luminaWeaveApi.services.character,
        timeline: luminaWeaveApi.services.timeline,
        activity: luminaWeaveApi.services.activity
    });

    provide(desktopExperienceRuntimeKey, runtime);

    return { runtime, contextStore };
};
