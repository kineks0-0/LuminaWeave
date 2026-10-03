import { z } from 'zod';
import type { LuminaChatMessage } from '@shared/LuminaMessage.js';
import type { Ref } from 'vue';
import type { ActivityDescriptor } from '../activity/types.js';
import type {
    CharacterChannelState,
    CreateChatConversationInput
} from '../../types/ConversationContextTypes.js';
import type { SettingDefinition } from '../../types/plugin.js';
import type {
    ChatApplicationIntents,
    ChatApplicationSnapshot
} from '../../plugins/chat/application/ChatApplicationController.js';
import type { ChatMessageRenderPreferences } from '../../plugins/chat/presentation/ChatMessageRenderPreferences.js';
import type {
    EmptySurfaceData,
    SurfaceContractDefinition,
    SurfaceContractDefinitionUnion,
    SurfaceContractSpec,
    SurfaceInputSchema
} from './types.js';

export interface ChatMainSurfaceInput {
    isMobile?: boolean;
    workspaceCompact?: boolean;
    onBack?: () => void;
    onOpenRoleProfile?: () => void;
    onOpenPanel?: (panelId: string) => void;
}

export interface CharacterRosterSurfaceInput {
    compact?: boolean;
    /** 由外壳接管打开 / 新建会话（如 Telegram 移动端需同时进入聊天页）；缺省时走 surface 自身意图 */
    onOpenSession?: (sessionId: string) => void;
    onCreateSession?: (input: CreateChatConversationInput) => void;
}

export interface ConversationSessionListSurfaceInput {
    characterKey?: string;
    compact?: boolean;
    /** 由外壳接管打开会话（如 Telegram 移动端需同时进入聊天页）；缺省时走 surface 自身意图 */
    onOpenSession?: (sessionId: string) => void;
    /** 新建聊天入口（如跳到联系人选择角色）；未提供时不显示该入口 */
    onStartNewChat?: () => void;
}

export interface ChatTranscriptSurfaceInput {
    compact?: boolean;
}

export interface ChatComposerSurfaceInput {
    compact?: boolean;
    placeholder?: string;
}

export interface ChatPromptInspectorSurfaceInput {
    autoProbe?: boolean;
}

export interface CharacterChannelSurfaceState {
    channel: Readonly<Ref<CharacterChannelState>>;
}

export type ChatChoiceInteractionMode = 'fill' | 'generate';

export interface CharacterRosterSurfaceIntents {
    refresh(): Promise<void>;
    openSession(sessionId: string): Promise<void>;
    createSession(input: CreateChatConversationInput): Promise<void>;
    toggleGroup(groupKey: string): void;
}

export interface ConversationSessionListSurfaceIntents {
    openSession(sessionId: string): Promise<void>;
    renameSession(sessionId: string, nextTitle: string): Promise<void>;
    deleteSession(sessionId: string): Promise<void>;
    closeCurrentSession(): Promise<boolean>;
    toggleGroupSessionExpansion(groupKey: string): void;
}

export interface ChatApplicationSurfaceState {
    snapshot: Readonly<Ref<ChatApplicationSnapshot>>;
    character: Readonly<Ref<CharacterChannelState>>;
    choiceInteractionMode: Readonly<Ref<ChatChoiceInteractionMode>>;
    messageRenderPreferences: Readonly<Ref<ChatMessageRenderPreferences>>;
    defaultAvatar: string;
    resolveMessageAvatar(message: LuminaChatMessage): string;
}

export type ChatTranscriptSurfaceIntents = Pick<ChatApplicationIntents,
    | 'editMessage'
    | 'deleteMessage'
    | 'regenerate'
    | 'branchMessage'
    | 'sendMessage'
    | 'setComposerDraft'
>;

export type ChatComposerSurfaceIntents = Pick<ChatApplicationIntents,
    'sendMessage' | 'stopGeneration' | 'setComposerDraft' | 'togglePromptInspector'
>;

export type ChatPromptInspectorSurfaceIntents = Pick<ChatApplicationIntents,
    'probePrompt' | 'runEditedPrompt'
>;

export interface SettingsRootSurfaceInput {
    mode?: 'large' | 'small';
    activity?: ActivityDescriptor;
}

export interface SettingsControlSurfaceInput {
    pluginId: string;
    settingKey: string;
    config: SettingDefinition;
}

export interface ForgeWorkspaceSurfaceInput {
    mode?: 'large' | 'small';
    activity?: ActivityDescriptor;
    isMobile?: boolean;
    workspaceCompact?: boolean;
    embeddedInWorkspaceWindow?: boolean;
    auxSidebarMode?: 'left' | 'right' | 'widget' | 'hidden';
    activeRightPanelId?: string;
}

export interface ForgeSettingsWorkbenchSurfaceInput {
    pluginId?: string;
}

export interface TimelineNavigatorSurfaceInput {
    mode?: 'large' | 'small';
    activity?: ActivityDescriptor;
    isMobile?: boolean;
}

export interface ContextPanelSurfaceInput {
    mode?: 'large' | 'small';
    activity?: ActivityDescriptor;
    isMobile?: boolean;
}

export interface LorebookWorkspaceSurfaceInput extends ContextPanelSurfaceInput {
    timelineSourceId?: 'chat' | 'forge';
    showTimelineChrome?: boolean;
    skinVariant?: string;
    skinStyle?: Record<string, string | number>;
}

export interface LauncherRootSurfaceInput {
    activeMainTab?: string;
    presentation?: 'window' | 'launchpad';
    dismissOnSelect?: boolean;
    onDismiss?: () => void;
}

export interface TelegramInfoPanelSurfaceInput {
    state: CharacterChannelState;
    isMobile?: boolean;
    onOpenTool(panelId: string): void;
    onCreateSession(input: CreateChatConversationInput): void;
    onOpenSession(sessionId: string): void;
}

declare module './types.js' {
    interface SurfaceContractMap {
        'character.roster': SurfaceContractSpec<
            CharacterRosterSurfaceInput,
            CharacterChannelSurfaceState,
            CharacterRosterSurfaceIntents
        >;
        'conversation.sessionList': SurfaceContractSpec<
            ConversationSessionListSurfaceInput,
            CharacterChannelSurfaceState,
            ConversationSessionListSurfaceIntents
        >;
        'chat.transcript': SurfaceContractSpec<
            ChatTranscriptSurfaceInput,
            ChatApplicationSurfaceState,
            ChatTranscriptSurfaceIntents
        >;
        'chat.main': SurfaceContractSpec<ChatMainSurfaceInput, ChatApplicationSurfaceState, ChatApplicationIntents>;
        'chat.preview': SurfaceContractSpec<EmptySurfaceData>;
        'chat.composer': SurfaceContractSpec<
            ChatComposerSurfaceInput,
            ChatApplicationSurfaceState,
            ChatComposerSurfaceIntents
        >;
        'chat.promptInspector': SurfaceContractSpec<
            ChatPromptInspectorSurfaceInput,
            ChatApplicationSurfaceState,
            ChatPromptInspectorSurfaceIntents
        >;
        'settings.root': SurfaceContractSpec<SettingsRootSurfaceInput>;
        'settings.control': SurfaceContractSpec<SettingsControlSurfaceInput>;
        'forge.workspace': SurfaceContractSpec<ForgeWorkspaceSurfaceInput>;
        'forge.settings.summary': SurfaceContractSpec<EmptySurfaceData>;
        'forge.settings.workbench': SurfaceContractSpec<ForgeSettingsWorkbenchSurfaceInput>;
        'timeline.navigator': SurfaceContractSpec<TimelineNavigatorSurfaceInput>;
        'stats.panel': SurfaceContractSpec<ContextPanelSurfaceInput>;
        'director.panel': SurfaceContractSpec<ContextPanelSurfaceInput>;
        'lorebook.workspace': SurfaceContractSpec<LorebookWorkspaceSurfaceInput>;
        'launcher.root': SurfaceContractSpec<LauncherRootSurfaceInput>;
        'dev.tools': SurfaceContractSpec<EmptySurfaceData>;
        'terminal.root': SurfaceContractSpec<EmptySurfaceData>;
        'telegram.infoPanel': SurfaceContractSpec<TelegramInfoPanelSurfaceInput>;
    }
}

export const OFFICIAL_SURFACE_CONTRACTS = [
    'character.roster',
    'conversation.sessionList',
    'chat.transcript',
    'chat.main',
    'chat.preview',
    'chat.composer',
    'chat.promptInspector',
    'settings.root',
    'settings.control',
    'forge.workspace',
    'timeline.navigator',
    'stats.panel',
    'director.panel',
    'lorebook.workspace',
    'forge.settings.summary',
    'forge.settings.workbench',
    'launcher.root',
    'dev.tools',
    'terminal.root',
    'telegram.infoPanel'
] as const;

export type OfficialSurfaceContractId = typeof OFFICIAL_SURFACE_CONTRACTS[number];

const callbackSchema = <TCallback extends (...args: never[]) => void>(): z.ZodType<TCallback> =>
    z.custom<TCallback>(value => typeof value === 'function');

const activityDescriptorSchema: z.ZodType<ActivityDescriptor> = z.object({
    size: z.enum(['default', 'small']).optional(),
    pageType: z.enum(['nested', 'standalone']).optional(),
    statusBar: z.object({
        background: z.string().optional(),
        iconColor: z.enum(['light', 'dark', 'auto']).optional(),
        safeArea: z.enum(['shell', 'manual']).optional()
    }).strict().optional(),
    titleBar: z.object({
        title: z.string().optional(),
        subtitle: z.string().optional(),
        showBack: z.boolean().optional(),
        actions: z.array(z.object({
            id: z.string(),
            label: z.string(),
            icon: z.string().optional()
        }).strict()).optional()
    }).strict().optional(),
    secondaryMenu: z.object({
        activeId: z.string().optional(),
        items: z.array(z.object({
            id: z.string(),
            label: z.string(),
            icon: z.string().optional()
        }).strict()).optional()
    }).strict().optional()
}).strict();

const settingOptionSchema = z.object({
    value: z.union([z.string(), z.number()]),
    label: z.string(),
    description: z.string().optional()
}).strict();

const settingOptionsSchema: z.ZodType<NonNullable<SettingDefinition['options']>> = z.union([
    z.array(settingOptionSchema),
    z.custom<() => Array<z.infer<typeof settingOptionSchema>>>(value => typeof value === 'function')
]);

const settingShowIfSchema: z.ZodType<NonNullable<SettingDefinition['showIf']>> =
    z.custom<NonNullable<SettingDefinition['showIf']>>(value => typeof value === 'function');

const settingDefinitionSchema: z.ZodType<SettingDefinition> = z.object({
    default: z.unknown(),
    label: z.string(),
    description: z.string().optional(),
    type: z.enum(['theme', 'options', 'stepper', 'nexus-select', 'slider', 'boolean', 'text', 'password']),
    options: settingOptionsSchema.optional(),
    allowedScopes: z.array(z.enum(['Global', 'Character', 'Chat', 'Session'])).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().optional(),
    category: z.enum(['appearance', 'conversation', 'generation', 'context', 'workshop', 'storage', 'advanced']).optional(),
    group: z.string().optional(),
    advanced: z.boolean().optional(),
    keywords: z.array(z.string()).optional(),
    showIf: settingShowIfSchema.optional()
}).strict().superRefine((definition, context) => {
    if (!Object.prototype.hasOwnProperty.call(definition, 'default')) {
        context.addIssue({
            code: 'custom',
            message: 'Setting definition default is required',
            path: ['default']
        });
    }
});

const characterChannelSessionSchema = z.object({
    id: z.string(),
    title: z.string(),
    source: z.enum(['lumina-server', 'st-current']),
    createdAt: z.number(),
    updatedAt: z.number(),
    messageCount: z.number(),
    summary: z.string(),
    previewMessage: z.string(),
    activeLeafId: z.string().nullable(),
    characterId: z.union([z.string(), z.number(), z.null()]).optional(),
    characterName: z.string().optional(),
    characterAvatarUrl: z.string().nullable().optional(),
    sourceId: z.literal('chat'),
    characterKey: z.string(),
    recentHistoryPreview: z.string(),
    stableSessionId: z.string().nullable()
}).strict();

const characterChannelGroupSchema = z.object({
    key: z.string(),
    characterId: z.union([z.string(), z.number(), z.null()]),
    characterName: z.string(),
    characterAvatarUrl: z.string().nullable(),
    characterInitial: z.string(),
    sessions: z.array(characterChannelSessionSchema),
    recentSession: characterChannelSessionSchema.nullable(),
    recentPreview: z.string()
}).strict();

const characterChannelCapabilitiesSchema = z.object({
    supportsCharacterRoster: z.boolean(),
    supportsCreateSession: z.boolean(),
    supportsRenameSession: z.boolean(),
    supportsDeleteSession: z.boolean(),
    supportsCloseCurrentSession: z.boolean(),
    supportsNativeOpenSession: z.boolean(),
    supportsHostHistory: z.boolean(),
    supportsHostSearch: z.boolean(),
    supportsFindLastMessage: z.boolean(),
    supportsStableSessionId: z.boolean(),
    supportsCurrentWindowInfo: z.boolean()
}).strict();

const characterChannelStatusSchema = z.object({
    kind: z.enum(['idle', 'loading', 'switching', 'error']),
    text: z.string(),
    sessionId: z.string().nullable(),
    characterName: z.string(),
    error: z.string().nullable()
}).strict();

const characterChannelStateSchema: z.ZodType<CharacterChannelState> = z.object({
    characterGroups: z.array(characterChannelGroupSchema),
    activeSessionId: z.string().nullable(),
    selectedViewSessionId: z.string().nullable(),
    currentLiveSessionId: z.string().nullable(),
    busySessionIds: z.array(z.string()),
    expandedCharacterKey: z.string().nullable(),
    expandedSessionGroups: z.record(z.string(), z.boolean()),
    capabilityFlags: characterChannelCapabilitiesSchema,
    status: characterChannelStatusSchema
}).strict();

const emptyInputSchema: SurfaceInputSchema<'chat.preview'> = z.object({}).strict();

const contextPanelInputSchema = z.object({
    mode: z.enum(['large', 'small']).optional(),
    activity: activityDescriptorSchema.optional(),
    isMobile: z.boolean().optional()
}).strict();

export const OFFICIAL_SURFACE_INPUT_SCHEMAS = {
    'character.roster': z.object({
        compact: z.boolean().optional(),
        onOpenSession: callbackSchema<(sessionId: string) => void>().optional(),
        onCreateSession: callbackSchema<(input: CreateChatConversationInput) => void>().optional()
    }).strict(),
    'conversation.sessionList': z.object({
        characterKey: z.string().min(1).optional(),
        compact: z.boolean().optional(),
        onOpenSession: callbackSchema<(sessionId: string) => void>().optional(),
        onStartNewChat: callbackSchema<() => void>().optional()
    }).strict(),
    'chat.transcript': z.object({
        compact: z.boolean().optional()
    }).strict(),
    'chat.main': z.object({
        isMobile: z.boolean().optional(),
        workspaceCompact: z.boolean().optional(),
        onBack: callbackSchema<() => void>().optional(),
        onOpenRoleProfile: callbackSchema<() => void>().optional(),
        onOpenPanel: callbackSchema<(panelId: string) => void>().optional()
    }).strict(),
    'chat.preview': emptyInputSchema,
    'chat.composer': z.object({
        compact: z.boolean().optional(),
        placeholder: z.string().optional()
    }).strict(),
    'chat.promptInspector': z.object({
        autoProbe: z.boolean().optional()
    }).strict(),
    'settings.root': z.object({
        mode: z.enum(['large', 'small']).optional(),
        activity: activityDescriptorSchema.optional()
    }).strict(),
    'settings.control': z.object({
        pluginId: z.string().min(1),
        settingKey: z.string().min(1),
        config: settingDefinitionSchema
    }).strict(),
    'forge.workspace': z.object({
        mode: z.enum(['large', 'small']).optional(),
        activity: activityDescriptorSchema.optional(),
        isMobile: z.boolean().optional(),
        workspaceCompact: z.boolean().optional(),
        embeddedInWorkspaceWindow: z.boolean().optional(),
        auxSidebarMode: z.enum(['left', 'right', 'widget', 'hidden']).optional(),
        activeRightPanelId: z.string().optional()
    }).strict(),
    'forge.settings.summary': emptyInputSchema,
    'forge.settings.workbench': z.object({
        pluginId: z.string().optional()
    }).strict(),
    'timeline.navigator': contextPanelInputSchema,
    'stats.panel': contextPanelInputSchema,
    'director.panel': contextPanelInputSchema,
    'lorebook.workspace': contextPanelInputSchema.extend({
        timelineSourceId: z.enum(['chat', 'forge']).optional(),
        showTimelineChrome: z.boolean().optional(),
        skinVariant: z.string().optional(),
        skinStyle: z.record(z.string(), z.union([z.string(), z.number()])).optional()
    }).strict(),
    'launcher.root': z.object({
        activeMainTab: z.string().optional(),
        presentation: z.enum(['window', 'launchpad']).optional(),
        dismissOnSelect: z.boolean().optional(),
        onDismiss: callbackSchema<() => void>().optional()
    }).strict(),
    'dev.tools': emptyInputSchema,
    'terminal.root': emptyInputSchema,
    'telegram.infoPanel': z.object({
        state: characterChannelStateSchema,
        isMobile: z.boolean().optional(),
        onOpenTool: callbackSchema<(panelId: string) => void>(),
        onCreateSession: callbackSchema<(input: CreateChatConversationInput) => void>(),
        onOpenSession: callbackSchema<(sessionId: string) => void>()
    }).strict()
} satisfies { [K in OfficialSurfaceContractId]: SurfaceInputSchema<K> };

const createOfficialContractDefinition = <K extends OfficialSurfaceContractId>(
    id: K,
    inputSchema: SurfaceInputSchema<K>
): SurfaceContractDefinition<K> => ({ id, inputSchema });

export const OFFICIAL_SURFACE_CONTRACT_DEFINITIONS = OFFICIAL_SURFACE_CONTRACTS.map(contractId =>
    createOfficialContractDefinition(contractId, OFFICIAL_SURFACE_INPUT_SCHEMAS[contractId])
) as SurfaceContractDefinitionUnion[];
