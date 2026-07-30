import type { LuminaChatMessage } from '@shared/LuminaMessage.js';
import type {
    ConversationDomainEvent,
    ConversationDomainService
} from '../../../api/services/ConversationDomainService.js';
import type {
    GenerationDomainEvent,
    GenerationDomainService,
    GenerationStreamState,
    PromptInspectionEvent,
    PromptInspectionSource
} from '../../../api/services/GenerationDomainService.js';
import type { HostInteractionService } from '../../../api/services/HostInteractionService.js';
import type { ConversationViewContext } from '../../../types/ConversationContextTypes.js';
import type {
    ChatPresentationCommand,
    ChatPresentationCommandService
} from '../../../api/services/ChatPresentationCommandService.js';

export type ChatGenerationPhase = 'idle' | 'running' | 'ended' | 'failed';

export interface ChatGenerationState {
    revision: number;
    phase: ChatGenerationPhase;
    isGenerating: boolean;
    isSyncing: boolean;
    stream: GenerationStreamState | null;
    errorMessage: string;
}

export interface ChatApplicationSnapshot {
    context: ConversationViewContext;
    messages: LuminaChatMessage[];
    generation: ChatGenerationState;
    composerDraft: string;
    promptInspection: ChatPromptInspectionState;
    promptInspectorVisible: boolean;
    presentation: ChatPresentationState;
}

export interface ChatPresentationState {
    scrollRequest: { revision: number; force: boolean } | null;
    composerFocusRequest: { revision: number } | null;
}

export interface ChatPromptInspectionState {
    revision: number;
    payload: unknown;
    source: PromptInspectionSource | null;
    isProbing: boolean;
    errorMessage: string;
}

export interface ChatMessageIntentInput {
    message: LuminaChatMessage;
    index: number;
}

export interface ChatMessageEditIntentInput extends ChatMessageIntentInput {
    text: string;
}

export interface ChatApplicationIntents {
    sendMessage(text: string): Promise<boolean>;
    stopGeneration(): Promise<boolean>;
    editMessage(input: ChatMessageEditIntentInput): Promise<boolean>;
    deleteMessage(input: ChatMessageIntentInput): Promise<boolean>;
    regenerate(): Promise<boolean>;
    branchMessage(input: ChatMessageIntentInput): Promise<boolean>;
    setComposerDraft(text: string): void;
    togglePromptInspector(): void;
    probePrompt(): Promise<boolean>;
    runEditedPrompt(text: string): Promise<boolean>;
}

export interface ChatApplicationControllerDependencies {
    conversation: Pick<
        ConversationDomainService,
        'getContext' | 'subscribe' | 'editMessage' | 'deleteMessage' | 'branchNode'
    >;
    generation: Pick<
        GenerationDomainService,
        | 'sendMessage'
        | 'regenerateLast'
        | 'runEditedPrompt'
        | 'stop'
        | 'isGenerating'
        | 'isSyncing'
        | 'getLastStreamState'
        | 'getLastPromptPayload'
        | 'probePrompt'
        | 'subscribe'
        | 'subscribePromptInspection'
    >;
    feedback: Pick<HostInteractionService, 'confirm' | 'showToast'>;
    activity: {
        subscribeChatPresentationCommands: ChatPresentationCommandService['subscribe'];
    };
}

export type ChatApplicationListener = (snapshot: ChatApplicationSnapshot) => void;

const createEmptyContext = (): ConversationViewContext => ({
    source: 'chat',
    sessionId: null,
    activeLeafId: null,
    messages: [],
    timelineGraph: {},
    focusedMessage: null,
    meta: {
        currentChatSessionId: null,
        isLive: false
    }
});

const createInitialGenerationState = (
    generation: ChatApplicationControllerDependencies['generation']
): ChatGenerationState => {
    const isGenerating = generation.isGenerating();
    return {
        revision: 0,
        phase: isGenerating ? 'running' : 'idle',
        isGenerating,
        isSyncing: generation.isSyncing(),
        stream: isGenerating ? generation.getLastStreamState() : null,
        errorMessage: ''
    };
};

export class ChatApplicationController {
    private readonly listeners = new Set<ChatApplicationListener>();
    private readonly disposers: Array<() => void> = [];
    private snapshot: ChatApplicationSnapshot;
    private contextRevision = 0;
    private started = false;
    private disposed = false;

    public readonly intents: ChatApplicationIntents;

    constructor(private readonly dependencies: ChatApplicationControllerDependencies) {
        const context = createEmptyContext();
        this.snapshot = {
            context,
            messages: context.messages,
            generation: createInitialGenerationState(dependencies.generation),
            composerDraft: '',
            promptInspection: {
                revision: 0,
                payload: dependencies.generation.getLastPromptPayload(),
                source: null,
                isProbing: false,
                errorMessage: ''
            },
            promptInspectorVisible: false,
            presentation: {
                scrollRequest: null,
                composerFocusRequest: null
            }
        };
        this.intents = {
            sendMessage: (text) => this.sendMessage(text),
            stopGeneration: () => this.stopGeneration(),
            editMessage: (input) => this.editMessage(input),
            deleteMessage: (input) => this.deleteMessage(input),
            regenerate: () => this.regenerate(),
            branchMessage: (input) => this.branchMessage(input),
            setComposerDraft: (text) => this.setComposerDraft(text),
            togglePromptInspector: () => this.togglePromptInspector(),
            probePrompt: () => this.probePrompt(),
            runEditedPrompt: (text) => this.runEditedPrompt(text)
        };
    }

    async start(): Promise<void> {
        if (this.started || this.disposed) return;
        this.started = true;

        try {
            this.disposers.push(
                this.dependencies.conversation.subscribe(event => this.handleConversationEvent(event))
            );
            this.disposers.push(
                this.dependencies.generation.subscribe(event => this.handleGenerationEvent(event))
            );
            this.disposers.push(
                this.dependencies.generation.subscribePromptInspection(event => this.handlePromptInspectionEvent(event))
            );
            this.disposers.push(
                this.dependencies.activity.subscribeChatPresentationCommands(
                    command => this.handlePresentationCommand(command)
                )
            );

            const requestedAtRevision = this.contextRevision;
            const context = await this.dependencies.conversation.getContext();
            if (this.disposed || requestedAtRevision !== this.contextRevision) return;
            this.applyContext(context);
        } catch (error) {
            this.disposeSubscriptions();
            if (!this.disposed) {
                this.started = false;
            }
            throw error;
        }
    }

    getSnapshot(): ChatApplicationSnapshot {
        return this.snapshot;
    }

    subscribe(listener: ChatApplicationListener): () => void {
        if (this.disposed) return () => undefined;
        this.listeners.add(listener);
        listener(this.snapshot);
        return () => {
            this.listeners.delete(listener);
        };
    }

    async sendMessage(text: string): Promise<boolean> {
        const normalizedText = text.trim();
        if (!normalizedText || !this.canMutateWithoutActiveGeneration()) {
            return false;
        }
        const sent = await this.dependencies.generation.sendMessage(normalizedText);
        if (sent) {
            this.updateSnapshot({ composerDraft: '' });
        }
        return sent;
    }

    async stopGeneration(): Promise<boolean> {
        if (!this.canMutateConversation() || !this.dependencies.generation.isGenerating()) return false;
        await this.dependencies.generation.stop();
        return true;
    }

    async editMessage(input: ChatMessageEditIntentInput): Promise<boolean> {
        if (!this.canMutateWithoutActiveGeneration() || !input.text.trim()) return false;
        return this.dependencies.conversation.editMessage(this.resolveMessageTarget(input), input.text);
    }

    async deleteMessage(input: ChatMessageIntentInput): Promise<boolean> {
        if (!this.canMutateWithoutActiveGeneration()) return false;
        const confirmed = await this.dependencies.feedback.confirm({
            title: '删除消息',
            message: `确定要删除此条消息吗？\n删除后无法撤销 (楼层 ${input.index})`,
            confirmText: '确认删除',
            danger: true
        });
        if (!confirmed || !this.canMutateWithoutActiveGeneration()) return false;
        return this.dependencies.conversation.deleteMessage(this.resolveMessageTarget(input));
    }

    async regenerate(): Promise<boolean> {
        if (!this.canMutateWithoutActiveGeneration()) return false;
        await this.dependencies.generation.regenerateLast();
        return true;
    }

    async branchMessage(input: ChatMessageIntentInput): Promise<boolean> {
        if (!this.canMutateWithoutActiveGeneration()) return false;
        const targetNodeId = input.message.id.trim();
        if (!targetNodeId) {
            this.dependencies.feedback.showToast('无法解析消息节点，不能创建分支。', 'error');
            return false;
        }
        return this.dependencies.conversation.branchNode({
            sourceId: 'chat',
            targetNodeId
        });
    }

    setComposerDraft(text: string): void {
        if (this.disposed || text === this.snapshot.composerDraft) return;
        this.updateSnapshot({ composerDraft: text });
    }

    togglePromptInspector(): void {
        if (this.disposed) return;
        this.updateSnapshot({
            promptInspectorVisible: !this.snapshot.promptInspectorVisible
        });
    }

    async probePrompt(): Promise<boolean> {
        if (this.disposed || this.snapshot.promptInspection.isProbing) return false;
        this.updatePromptInspection({
            ...this.snapshot.promptInspection,
            isProbing: true,
            errorMessage: ''
        });

        try {
            const payload = await this.dependencies.generation.probePrompt();
            if (this.disposed) return false;
            if (payload !== null && payload !== undefined) {
                this.updatePromptInspection({
                    revision: this.snapshot.promptInspection.revision + 1,
                    payload,
                    source: this.snapshot.promptInspection.source,
                    isProbing: false,
                    errorMessage: ''
                });
                return true;
            }

            this.updatePromptInspection({
                ...this.snapshot.promptInspection,
                isProbing: false
            });
            return false;
        } catch (error) {
            if (this.disposed) return false;
            this.updatePromptInspection({
                ...this.snapshot.promptInspection,
                isProbing: false,
                errorMessage: error instanceof Error ? error.message : '提示词探测失败'
            });
            return false;
        }
    }

    async runEditedPrompt(text: string): Promise<boolean> {
        const normalizedText = text.trim();
        if (!normalizedText || !this.canMutateWithoutActiveGeneration()) return false;
        await this.dependencies.generation.runEditedPrompt(normalizedText);
        return true;
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.disposeSubscriptions();
        this.listeners.clear();
    }

    private disposeSubscriptions(): void {
        this.disposers.splice(0).forEach(dispose => {
            try {
                dispose();
            } catch (error) {
                console.error('[ChatApplicationController] Subscription disposal failed', { error });
            }
        });
    }

    private handleConversationEvent(event: ConversationDomainEvent): void {
        if (this.disposed || event.type === 'sessions_updated') return;
        this.contextRevision += 1;
        this.applyContext(event.context);
    }

    private handleGenerationEvent(event: GenerationDomainEvent): void {
        if (this.disposed) return;
        const revision = this.snapshot.generation.revision + 1;

        if (event.type === 'started') {
            this.updateGeneration({
                revision,
                phase: 'running',
                isGenerating: true,
                isSyncing: false,
                stream: null,
                errorMessage: ''
            });
            return;
        }
        if (event.type === 'updated') {
            this.updateGeneration({
                revision,
                phase: 'running',
                isGenerating: true,
                isSyncing: this.dependencies.generation.isSyncing(),
                stream: event.state,
                errorMessage: ''
            });
            return;
        }
        if (event.type === 'ended') {
            this.updateGeneration({
                revision,
                phase: 'ended',
                isGenerating: false,
                isSyncing: false,
                stream: null,
                errorMessage: ''
            });
            return;
        }
        this.updateGeneration({
            revision,
            phase: 'failed',
            isGenerating: false,
            isSyncing: false,
            stream: this.snapshot.generation.stream,
            errorMessage: event.message || '生成失败，请检查后端节点配置或网络状态。'
        });
    }

    private handlePromptInspectionEvent(event: PromptInspectionEvent): void {
        if (this.disposed) return;
        this.updatePromptInspection({
            revision: this.snapshot.promptInspection.revision + 1,
            payload: event.payload,
            source: event.source,
            isProbing: event.source !== 'lumina' && this.snapshot.promptInspection.isProbing,
            errorMessage: ''
        });
    }

    private handlePresentationCommand(command: ChatPresentationCommand): void {
        if (this.disposed) return;
        if (command.type === 'scroll_to_bottom') {
            const revision = (this.snapshot.presentation.scrollRequest?.revision || 0) + 1;
            this.updateSnapshot({
                presentation: {
                    ...this.snapshot.presentation,
                    scrollRequest: { revision, force: command.force }
                }
            });
            return;
        }

        const revision = (this.snapshot.presentation.composerFocusRequest?.revision || 0) + 1;
        this.updateSnapshot({
            ...(command.text === undefined ? {} : { composerDraft: command.text }),
            presentation: {
                ...this.snapshot.presentation,
                composerFocusRequest: { revision }
            }
        });
    }

    private applyContext(context: ConversationViewContext): void {
        this.updateSnapshot({
            context,
            messages: context.messages
        });
    }

    private updateGeneration(generation: ChatGenerationState): void {
        this.updateSnapshot({ generation });
    }

    private updatePromptInspection(promptInspection: ChatPromptInspectionState): void {
        this.updateSnapshot({ promptInspection });
    }

    private updateSnapshot(patch: Partial<ChatApplicationSnapshot>): void {
        if (this.disposed) return;
        this.snapshot = {
            ...this.snapshot,
            ...patch
        };
        this.listeners.forEach(listener => {
            try {
                listener(this.snapshot);
            } catch (error) {
                console.error('[ChatApplicationController] Subscriber failed', { error });
            }
        });
    }

    private canMutateConversation(): boolean {
        return !this.disposed
            && this.snapshot.context.source === 'chat'
            && this.snapshot.context.meta?.isLive === true;
    }

    private canMutateWithoutActiveGeneration(): boolean {
        return this.canMutateConversation() && !this.dependencies.generation.isGenerating();
    }

    private resolveMessageTarget(input: ChatMessageIntentInput): string | number {
        return input.message.id.trim() || input.index;
    }
}
