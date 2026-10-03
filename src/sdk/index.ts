/**
 * LuminaWeave 公开 SDK 入口。
 * 第三方 Mod 与示例只能从这里导入；本文件只允许导出类型与无模块级副作用的组合式函数，
 * 不得引入 Pinia store、LuminaWeaveAPI 实例、桌面模式注册表或 Shell 组件（见 SdkBoundary 测试）。
 */

/** 公开 SDK 契约版本（独立于 package.json）。0.x 期间 minor 可含破坏性变更；改动公开值/类型面时必须同步 bump。 */
export const SDK_VERSION: string = '0.1.0';

// 必须使用 `export type *` 而非具名再导出：具名再导出会使其他模块对 surface/types.js 的 `declare module` 增强无法合并进 SurfaceContractMap。
export type * from '../platform/surface/types.js';
export { useSurfaceInput, useSurfaceRuntimeContext } from '../platform/surface/useSurfaceRuntimeContext.js';
// 注意：此导出同时确保 officialContracts 对 surface/types.js 的直接增强先于 Mod 经 SDK 路径的增强被处理（TS 增强合并对顺序敏感），勿删除。
export type { OfficialSurfaceContractId } from '../platform/surface/officialContracts.js';

export type {
    DesktopCompositionActivitySlotNode,
    DesktopCompositionDirection,
    DesktopCompositionGroupNode,
    DesktopCompositionNode,
    DesktopCompositionNodeLayout,
    DesktopCompositionSize,
    DesktopCompositionSurfaceNode,
    DesktopCompositionSurfaceNodeFor,
    DesktopCompositionViewport,
    DesktopCompositionVisibility,
    DesktopModeAppearance,
    DesktopModeComposition,
    DesktopModeManifest,
    DesktopModeShellDefinition,
    DesktopModeShellKind,
    SurfaceSkinContext,
    SurfaceSkinDefinition,
    ThemeNavigationPreset,
    ThemeSurfacePreset,
    ThemeValueResolver,
    ThemeWindowPreset
} from '../desktop-modes/core/types.js';

export type {
    PluginBusinessRendererDefinition,
    PluginBusinessRendererMap,
    PluginCapabilityDefinition,
    PluginFallbackRendererMap,
    PluginIntentHandler,
    PluginManifestV2,
    PluginRuntimeReadContext,
    PluginRuntimeWriteContext,
    PluginStateSelector
} from '../platform/plugin/types.js';
export type { RegistrationDisposer, RegistrationHandle } from '../platform/plugin/PluginRegistrationScope.js';
export type {
    PluginEventListener,
    PluginInitContext,
    PluginMemoryProvider,
    PluginXMLHandler
} from '../platform/plugin/PluginInitContext.js';
export type { PluginRuntimeApi } from '../api/services/PluginRuntimeService.js';
export type { SettingDefinition, SettingOption } from '../types/plugin.js';
export type { PromptAssemblyPolicy } from '../types/PromptAssemblyTypes.js';
export type { ModalOptions, ToastType } from '../api/services/HostInteractionService.js';
export type { ActivityDescriptor, ActivityLaunchIntent } from '../platform/activity/types.js';

export type {
    DesktopActivityRuntime,
    DesktopCharacterRuntime,
    DesktopExperienceRuntime,
    DesktopTimelineRuntime
} from '../api/services/DesktopExperienceRuntime.js';
export type {
    GenerationDomainEvent,
    GenerationDomainEventListener,
    GenerationDomainService,
    GenerationStreamState,
    SendMessageOptions
} from '../api/services/GenerationDomainService.js';
export type {
    ConversationDomainEvent,
    ConversationDomainEventListener,
    ConversationDomainService
} from '../api/services/ConversationDomainService.js';
export type {
    ChatPresentationCommand,
    ChatPresentationCommandListener
} from '../api/services/ChatPresentationCommandService.js';

export type {
    CharacterChannelCapabilities,
    CharacterChannelGroup,
    CharacterChannelSessionItem,
    CharacterChannelState,
    CharacterChannelStatus,
    ConversationContextOption,
    ConversationContextOverride,
    ConversationNodeSwitchInput,
    ConversationSessionRef,
    ConversationSourceId,
    ConversationTimelineNode,
    ConversationViewContext,
    CreateChatConversationInput,
    CreateChatConversationResult,
    DeleteChatConversationInput,
    DeleteChatConversationResult,
    RenameChatConversationInput,
    RenameChatConversationResult
} from '../types/ConversationContextTypes.js';
export type { LuminaChatMessage, LuminaConversationType } from '@shared/LuminaMessage.js';
