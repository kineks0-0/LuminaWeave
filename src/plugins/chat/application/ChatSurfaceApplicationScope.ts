import { shallowRef, type ShallowRef } from 'vue';
import type { DesktopExperienceRuntime } from '../../../api/services/DesktopExperienceRuntime.js';
import {
    ChatApplicationController,
    type ChatApplicationIntents,
    type ChatApplicationSnapshot
} from './ChatApplicationController.js';

export interface ChatSurfaceApplicationLease {
    readonly controller: ChatApplicationController;
    readonly snapshot: Readonly<ShallowRef<ChatApplicationSnapshot>>;
    readonly intents: ChatApplicationIntents;
    release(): void;
}

interface SharedChatSurfaceApplication {
    controller: ChatApplicationController;
    snapshot: ShallowRef<ChatApplicationSnapshot>;
    unsubscribeSnapshot: () => void;
    references: number;
    active: boolean;
}

const sharedApplications = new WeakMap<DesktopExperienceRuntime, SharedChatSurfaceApplication>();

const startSharedApplication = async (application: SharedChatSurfaceApplication): Promise<void> => {
    const maximumAttempts = 2;
    for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
        if (!application.active) return;
        try {
            await application.controller.start();
            return;
        } catch (error) {
            console.error('[ChatSurfaceApplicationScope] Start failed', { attempt, error });
        }
    }
};

const createSharedApplication = (runtime: DesktopExperienceRuntime): SharedChatSurfaceApplication => {
    const controller = new ChatApplicationController({
        conversation: runtime.conversation,
        generation: runtime.generation,
        feedback: runtime.activity,
        activity: runtime.activity
    });
    const snapshot = shallowRef(controller.getSnapshot());
    const unsubscribeSnapshot = controller.subscribe((nextSnapshot) => {
        snapshot.value = nextSnapshot;
    });
    const application: SharedChatSurfaceApplication = {
        controller,
        snapshot,
        unsubscribeSnapshot,
        references: 0,
        active: true
    };

    void startSharedApplication(application);

    return application;
};

export const acquireChatSurfaceApplication = (
    runtime: DesktopExperienceRuntime
): ChatSurfaceApplicationLease => {
    let application = sharedApplications.get(runtime);
    if (!application) {
        application = createSharedApplication(runtime);
        sharedApplications.set(runtime, application);
    }
    application.references += 1;

    let released = false;
    return {
        controller: application.controller,
        snapshot: application.snapshot,
        intents: application.controller.intents,
        release(): void {
            if (released) return;
            released = true;
            application.references -= 1;
            if (application.references > 0) return;

            application.active = false;
            application.unsubscribeSnapshot();
            application.controller.dispose();
            sharedApplications.delete(runtime);
        }
    };
};
