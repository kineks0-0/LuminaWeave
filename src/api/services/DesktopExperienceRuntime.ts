import type { Ref } from 'vue';
import type { LuminaChatMessage } from '@shared/LuminaMessage.js';
import type { ActivityLaunchIntent } from '../../platform/activity/types.js';
import type {
    CharacterChannelState,
    ConversationContextOverride,
    ConversationNodeSwitchInput,
    CreateChatConversationInput,
    DeleteChatConversationInput,
    DuplicateChatConversationInput,
    RenameChatConversationInput
} from '../../types/ConversationContextTypes.js';
import type { ConversationDomainService } from './ConversationDomainService.js';
import type { DesktopSurfaceService } from './DesktopSurfaceService.js';
import type { GenerationDomainService } from './GenerationDomainService.js';
import type {
    ChatPresentationCommandListener,
    ChatPresentationCommandService
} from './ChatPresentationCommandService.js';
import type {
    HostInteractionService,
    ModalOptions,
    ToastType
} from './HostInteractionService.js';

export interface DesktopCharacterRuntime {
    readonly state: Ref<CharacterChannelState>;
    readonly defaultAvatar: string;
    resolveMessageAvatar(message: LuminaChatMessage): string;
    refresh(): Promise<void>;
    openSession(sessionId: string): Promise<void>;
    createSession(input: CreateChatConversationInput): Promise<void>;
    importCharacterCard(file: File): Promise<void>;
    renameSession(input: RenameChatConversationInput): Promise<void>;
    deleteSession(input: DeleteChatConversationInput): Promise<void>;
    duplicateSession(input: DuplicateChatConversationInput): Promise<void>;
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
    constructor(
        private readonly desktopSurface: Pick<DesktopSurfaceService, 'launchActivity'>,
        private readonly feedback: Pick<HostInteractionService, 'confirm' | 'showToast'>,
        private readonly chatPresentationCommands: Pick<ChatPresentationCommandService, 'subscribe'>
    ) {}

    launch(intent: ActivityLaunchIntent): void {
        this.desktopSurface.launchActivity(intent);
    }

    confirm(options: string | ModalOptions): Promise<boolean> {
        return this.feedback.confirm(options);
    }

    showToast(
        message: string,
        type: ToastType = 'info',
        title?: string,
        duration: number = 3000
    ): void {
        this.feedback.showToast(message, type, title, duration);
    }

    subscribeChatPresentationCommands(listener: ChatPresentationCommandListener): () => void {
        return this.chatPresentationCommands.subscribe(listener);
    }
}

export interface DesktopExperienceRuntimeDependencies {
    conversation: ConversationDomainService;
    generation: GenerationDomainService;
    character: DesktopCharacterRuntime;
    // character / timeline / activity 都是挂在 lwApi.services 上的应用级共享实例，由外部注入；
    // 本类不拥有它们，所以没有 dispose。
    timeline: DesktopTimelineRuntime;
    activity: DesktopActivityRuntime;
}

export class DesktopExperienceRuntime {
    public readonly conversation: ConversationDomainService;
    public readonly generation: GenerationDomainService;
    public readonly character: DesktopCharacterRuntime;
    public readonly timeline: DesktopTimelineRuntime;
    public readonly activity: DesktopActivityRuntime;

    constructor(dependencies: DesktopExperienceRuntimeDependencies) {
        this.conversation = dependencies.conversation;
        this.generation = dependencies.generation;
        this.character = dependencies.character;
        this.timeline = dependencies.timeline;
        this.activity = dependencies.activity;
    }
}
