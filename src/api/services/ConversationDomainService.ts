import type { LuminaChatMessage } from '@shared/LuminaMessage';
import type { ConversationService } from '../core/ConversationService';
import type {
    ConversationContextOption,
    ConversationContextOverride,
    ConversationContextSwitchInput,
    ConversationNodeSwitchInput,
    ConversationSessionRef,
    ConversationTimelineNode,
    ConversationViewContext,
    CreateChatConversationInput,
    CreateChatConversationResult,
    DeleteChatConversationInput,
    DeleteChatConversationResult,
    RenameChatConversationInput,
    RenameChatConversationResult
} from '../../types/ConversationContextTypes';

export type RuntimeReadyGate = () => Promise<boolean>;

export class ConversationDomainService {
    constructor(
        private readonly conversationService: ConversationService,
        private readonly waitForReady: RuntimeReadyGate
    ) {}

    async listSources(): Promise<ConversationContextOption[]> {
        await this.waitForReady();
        return this.conversationService.listConversationSources();
    }

    async listSessions(sourceId?: ConversationContextOption['id']): Promise<ConversationSessionRef[]> {
        await this.waitForReady();
        return this.conversationService.listConversationSessions(sourceId);
    }

    async getContext(override: ConversationContextOverride = {}): Promise<ConversationViewContext> {
        await this.waitForReady();
        return this.conversationService.getConversationContext(override);
    }

    async getMessages(override: ConversationContextOverride = {}): Promise<LuminaChatMessage[]> {
        await this.waitForReady();
        return this.conversationService.getConversationMessages(override);
    }

    async getTimelineGraph(
        override: ConversationContextOverride = {}
    ): Promise<Record<string, ConversationTimelineNode>> {
        await this.waitForReady();
        return this.conversationService.getConversationTimelineGraph(override);
    }

    async switchContext(input: ConversationContextSwitchInput): Promise<ConversationViewContext> {
        await this.waitForReady();
        return this.conversationService.switchConversationContext(input);
    }

    async createChatSession(input: CreateChatConversationInput): Promise<CreateChatConversationResult> {
        await this.waitForReady();
        return this.conversationService.createChatSession(input);
    }

    async renameChatSession(input: RenameChatConversationInput): Promise<RenameChatConversationResult> {
        await this.waitForReady();
        return this.conversationService.renameChatSession(input);
    }

    async deleteChatSession(input: DeleteChatConversationInput): Promise<DeleteChatConversationResult> {
        await this.waitForReady();
        return this.conversationService.deleteChatSession(input);
    }

    async switchNode(input: ConversationNodeSwitchInput): Promise<boolean> {
        await this.waitForReady();
        return this.conversationService.switchConversationNode(input);
    }

    async branchNode(input: ConversationNodeSwitchInput): Promise<boolean> {
        await this.waitForReady();
        return this.conversationService.branchConversationNode(input);
    }

    async rollbackNode(input: ConversationNodeSwitchInput): Promise<boolean> {
        await this.waitForReady();
        return this.conversationService.rollbackConversationNode(input);
    }
}
