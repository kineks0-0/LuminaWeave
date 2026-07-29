import type { Ref } from 'vue';
import type { ActivityLaunchIntent } from '../../platform/activity/types.js';
import type {
    CharacterChannelState,
    ConversationContextOverride,
    ConversationNodeSwitchInput,
    CreateChatConversationInput,
    DeleteChatConversationInput,
    RenameChatConversationInput
} from '../../types/ConversationContextTypes.js';
import type { ConversationDomainService } from './ConversationDomainService.js';
import type { DesktopSurfaceService } from './DesktopSurfaceService.js';
import type { GenerationDomainService } from './GenerationDomainService.js';

export interface DesktopCharacterRuntime {
    readonly state: Ref<CharacterChannelState>;
    refresh(): Promise<void>;
    openSession(sessionId: string): Promise<void>;
    createSession(input: CreateChatConversationInput): Promise<void>;
    renameSession(input: RenameChatConversationInput): Promise<void>;
    deleteSession(input: DeleteChatConversationInput): Promise<void>;
    closeCurrentSession(): Promise<boolean>;
    toggleGroup(groupKey: string): void;
    toggleGroupSessionExpansion(groupKey: string): void;
    dispose(): void;
}

export class DesktopTimelineRuntime {
    constructor(private readonly conversation: ConversationDomainService) {}

    getGraph(override: ConversationContextOverride = {}): ReturnType<ConversationDomainService['getTimelineGraph']> {
        return this.conversation.getTimelineGraph(override);
    }

    switchNode(input: ConversationNodeSwitchInput): Promise<boolean> {
        return this.conversation.switchNode(input);
    }

    branchNode(input: ConversationNodeSwitchInput): Promise<boolean> {
        return this.conversation.branchNode(input);
    }

    rollbackNode(input: ConversationNodeSwitchInput): Promise<boolean> {
        return this.conversation.rollbackNode(input);
    }
}

export class DesktopActivityRuntime {
    constructor(private readonly desktopSurface: Pick<DesktopSurfaceService, 'launchActivity'>) {}

    launch(intent: ActivityLaunchIntent): void {
        this.desktopSurface.launchActivity(intent);
    }
}

export interface DesktopExperienceRuntimeDependencies {
    conversation: ConversationDomainService;
    generation: GenerationDomainService;
    character: DesktopCharacterRuntime;
    activity: Pick<DesktopSurfaceService, 'launchActivity'>;
}

export class DesktopExperienceRuntime {
    public readonly conversation: ConversationDomainService;
    public readonly generation: GenerationDomainService;
    public readonly character: DesktopCharacterRuntime;
    public readonly timeline: DesktopTimelineRuntime;
    public readonly activity: DesktopActivityRuntime;
    private disposed = false;

    constructor(dependencies: DesktopExperienceRuntimeDependencies) {
        this.conversation = dependencies.conversation;
        this.generation = dependencies.generation;
        this.character = dependencies.character;
        this.timeline = new DesktopTimelineRuntime(dependencies.conversation);
        this.activity = new DesktopActivityRuntime(dependencies.activity);
    }

    dispose(): void {
        if (this.disposed) {
            return;
        }

        this.disposed = true;
        this.character.dispose();
    }
}
