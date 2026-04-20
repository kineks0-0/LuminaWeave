import type { LuminaChatMessage, LuminaConversationType } from '@shared/LuminaMessage.js';
import type { ChatSessionRef, ForgeWorkspaceSessionRef } from './SessionTypes.js';

export type ConversationSourceId = Extract<LuminaConversationType, 'chat' | 'forge'>;
export type ConversationContextSource = ConversationSourceId;

export interface ConversationTimelineNode extends LuminaChatMessage {
    text: string;
    timestamp: number;
    _original?: LuminaChatMessage;
}

export interface ConversationContextOption {
    id: ConversationSourceId;
    label: string;
    description: string;
    count: number;
    sessionId: string | null;
    activeLeafId: string | null;
}

export type ConversationSessionRef =
    | (ChatSessionRef & { sourceId: 'chat' })
    | (ForgeWorkspaceSessionRef & { sourceId: 'forge' });

export interface ConversationViewContextMeta {
    workspaceTitle?: string;
    selectedChatSessionId?: string | null;
    selectedChatSnapshotId?: string | null;
    currentChatSessionId?: string | null;
    isLive?: boolean;
}

export interface ConversationViewContext {
    source: ConversationSourceId;
    sessionId: string | null;
    activeLeafId: string | null;
    messages: LuminaChatMessage[];
    timelineGraph: Record<string, ConversationTimelineNode>;
    focusedMessage: LuminaChatMessage | null;
    meta?: ConversationViewContextMeta;
}

export interface ConversationContextOverride {
    sourceId?: ConversationSourceId;
    sessionId?: string | null;
    activeLeafId?: string | null;
}

export interface ConversationContextSwitchInput {
    sourceId: ConversationSourceId;
    sessionId?: string | null;
}

export interface CreateChatConversationInput {
    characterId?: string | number | null;
    characterName?: string;
    characterAvatarUrl?: string | null;
}

export interface CreateChatConversationResult {
    sessionId: string;
    title: string;
    characterId: string | null;
    characterName: string;
    characterAvatarUrl: string | null;
}

export interface RenameChatConversationInput {
    sessionId: string;
    nextTitle: string;
    characterId?: string | number | null;
    characterName?: string;
    characterAvatarUrl?: string | null;
}

export interface RenameChatConversationResult {
    previousSessionId: string;
    sessionId: string;
    title: string;
    characterId: string | null;
    characterName: string;
    characterAvatarUrl: string | null;
}

export interface DeleteChatConversationInput {
    sessionId: string;
    characterId?: string | number | null;
    characterName?: string;
    characterAvatarUrl?: string | null;
}

export interface DeleteChatConversationResult {
    sessionId: string;
    characterId: string | null;
    characterName: string;
    characterAvatarUrl: string | null;
}

export interface CharacterChannelCapabilities {
    supportsCharacterRoster: boolean;
    supportsCreateSession: boolean;
    supportsRenameSession: boolean;
    supportsDeleteSession: boolean;
    supportsCloseCurrentSession: boolean;
    supportsNativeOpenSession: boolean;
    supportsHostHistory: boolean;
    supportsHostSearch: boolean;
    supportsFindLastMessage: boolean;
    supportsStableSessionId: boolean;
    supportsCurrentWindowInfo: boolean;
}

export interface CharacterChannelSessionItem extends ChatSessionRef {
    sourceId: 'chat';
    characterKey: string;
    recentHistoryPreview: string;
    stableSessionId: string | null;
}

export interface CharacterChannelGroup {
    key: string;
    characterId: string | number | null;
    characterName: string;
    characterAvatarUrl: string | null;
    characterInitial: string;
    sessions: CharacterChannelSessionItem[];
    recentSession: CharacterChannelSessionItem | null;
    recentPreview: string;
}

export interface CharacterChannelStatus {
    kind: 'idle' | 'loading' | 'switching' | 'error';
    text: string;
    sessionId: string | null;
    characterName: string;
    error: string | null;
}

export interface CharacterChannelState {
    characterGroups: CharacterChannelGroup[];
    activeSessionId: string | null;
    selectedViewSessionId: string | null;
    currentLiveSessionId: string | null;
    busySessionIds: string[];
    expandedCharacterKey: string | null;
    expandedSessionGroups: Record<string, boolean>;
    capabilityFlags: CharacterChannelCapabilities;
    status: CharacterChannelStatus;
}

export interface ConversationNodeSwitchInput extends ConversationContextOverride {
    targetNodeId: string;
}

export interface ConversationSourceAdapter {
    readonly id: ConversationSourceId;
    readonly label: string;
    readonly description: string;
    listSessions(): Promise<ConversationSessionRef[]>;
    getSourceOption(): Promise<ConversationContextOption>;
    getContext(override?: ConversationContextOverride): Promise<ConversationViewContext>;
    selectSession?(sessionId: string | null): Promise<string | null>;
    switchToNode(input: ConversationNodeSwitchInput): Promise<boolean>;
    branchFromNode(input: ConversationNodeSwitchInput): Promise<boolean>;
    rollbackFromNode(input: ConversationNodeSwitchInput): Promise<boolean>;
}

export interface ConversationContextChangedPayload {
    context: ConversationViewContext;
}

export interface ConversationSessionsUpdatedPayload {
    sources: ConversationContextOption[];
    sessions: ConversationSessionRef[];
}

export interface ConversationWorldlineChangedPayload {
    context: ConversationViewContext;
    targetNodeId?: string;
}

export type ConversationContext = ConversationViewContext;
