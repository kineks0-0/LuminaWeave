import { lwStorage } from './storage.js';
import { ChatManager } from './core/conversation/ChatManager.js';
import { StreamHandler } from './core/generation/StreamHandler.js';
import { TimelineManager, TimelineNode } from './core/storage/TimelineManager.js';
import { LorebookManager } from './core/lorebook/LorebookManager.js';
import { MessageListManager } from './core/conversation/MessageListManager.js';
import { ConversationService } from './core/conversation/ConversationService.js';
import { ConversationCommandService } from './core/conversation/ConversationCommandService.js';
import { PromptWorldInfoMount } from './core/lorebook/PromptWorldInfoMount.js';
import { FontManager } from './core/runtime-utils/FontManager.js';
import { MeasureService } from './core/runtime-utils/MeasureService.js';
import { MessageTextProjection } from './core/hal/prompt/MessageTextProjection.js';
import { onRegexDisplayChanged } from './core/hal/regex/RegexDisplayChange.js';
import { HALBootstrap } from './core/hal/HALBootstrap.js';
import { globalXMLInterceptor } from './core/xml-view/XMLInterceptor.js';
import { globalPromptRegistry } from './core/hal/prompt/PromptRegistry.js';
import { globalXMLTagRegistry } from '@shared/XMLTagRegistry.js';
import { createPluginInitContext } from './services/PluginInitContextFactory.js';
import { globalMemoryManager } from './core/runtime-utils/MemoryManager.js';
import { ControlledChatCreationCoordinator } from './core/conversation/ControlledChatCreationCoordinator.js';
import { pluginManager } from '../core/PluginManager.js';
import { pluginDomainRegistry } from '../platform/plugin/PluginDomainRegistry.js';
import { createPluginRuntimeApi, type PluginRuntimeApi } from './services/PluginRuntimeService.js';
import type { LuminaChatMessage } from '@shared/LuminaMessage.js';
import { LuminaWeaveAPIBase } from './core/facade/LuminaWeaveAPIBase.js';
import { getHostRuntimePort } from './core/facade/HostRuntimePort.js';
import { ChatDiffInspector, ChatDiffReport } from './debug/ChatDiffInspector.js';
import { ChatDebugGateway } from './debug/ChatDebugGateway.js';
import {
    DesktopSurfaceService,
    type DynamicTabConfig,
    type OpenPanelOptions,
    type RegisteredPanelConfig,
    type RegisteredPanelEntry
} from './services/DesktopSurfaceService.js';
import type { ActivityLaunchIntent, ActivityStatusBarDescriptor } from '../platform/activity/types.js';
import {
    HostInteractionService,
    type ModalOptions,
    type ToastType
} from './services/HostInteractionService.js';
import { ConversationDomainService } from './services/ConversationDomainService.js';
import {
    GenerationDomainService,
    type GenerationDomainEventListener,
    type GenerationStreamState,
    type SendMessageOptions
} from './services/GenerationDomainService.js';
import { settingsDomainService, type SettingsDomainService } from './services/SettingsDomainService.js';
import {
    DesktopActivityRuntime,
    DesktopTimelineRuntime,
    type DesktopCharacterRuntime
} from './services/DesktopExperienceRuntime.js';
import { CharacterRuntimeSlot } from './services/CharacterRuntimeSlot.js';
import { ChatPresentationCommandService } from './services/ChatPresentationCommandService.js';
import { HostEventWiring, type SyncFromOptions } from './services/HostEventWiring.js';
import type { DesktopModeManifest } from '../desktop-modes/core/types.js';

// 全局变量声明已移动至 src/types/sillytavern.d.ts

import { getChatMessageMutationPort } from './core/conversation/ChatMessageMutationPort.js';
import { getConversationHostFacadePort } from './core/facade/ConversationHostFacadePort.js';
import { HostDetector } from './core/host-drivers/HostDetector.js';
import { characterImportService } from './core/hal/resource/index.js';
import type { ResourceDocument } from '@shared/resources/index.js';
import { PromptCommandService } from './core/generation/PromptCommandService.js';
import { luminaRegexDisplayService } from './core/hal/regex/LuminaRegexDisplayService.js';
import { GenerationCommandService } from './core/generation/GenerationCommandService.js';
import { ForgeAgentController } from './core/forge/runtime/ForgeAgentController.js';
import type {
    ConversationContextOverride,
    ConversationContextChangedPayload,
    ConversationSessionsUpdatedPayload,
    ConversationWorldlineChangedPayload,
    ConversationContextSwitchInput,
    CreateChatConversationInput,
    CreateChatConversationResult,
    DeleteChatConversationInput,
    DeleteChatConversationResult,
    DuplicateChatConversationInput,
    DuplicateChatConversationResult,
    ConversationNodeSwitchInput,
    ConversationSessionRef,
    ConversationContextOption,
    ConversationTimelineNode,
    ConversationViewContext,
    RenameChatConversationInput,
    RenameChatConversationResult
} from '../types/ConversationContextTypes.js';

// 驱动注册现已下沉至 HALBootstrap.ts，由其在 init() 时根据探测结果动态注册

export interface LuminaWeaveDomainServices {
    desktopSurface: DesktopSurfaceService;
    host: HostInteractionService;
    conversation: ConversationDomainService;
    generation: GenerationDomainService;
    settings: SettingsDomainService;
    chatPresentationCommands: ChatPresentationCommandService;
    timeline: DesktopTimelineRuntime;
    activity: DesktopActivityRuntime;
    /** 应用级单例，由入口在 app.use(pinia) 后经 attachCharacterRuntime 挂载；挂载前读取会抛错。 */
    readonly character: DesktopCharacterRuntime;
}

/**
 * LuminaWeave API 入口 (Facade)
 * 聚合 ChatManager, StreamHandler, TimelineManager 等核心组件
 */// 内置 SVG 占位头像 (Base64)
const DEFAULT_AVATAR = 'data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiBmaWxsPSIjRTM2OEYwIi8+PHBhdGggZD0iTTEyIDRDMTAuMzQzMSA0IDkgNS4zNDMxNSA5IDdDMTEuNjU2OSA3IDEzIDguMzQzMTUgMTMgMTBDMTMgMTEuNjU2OSAxMS42NTY5IDEzIDkgMTNDIDkgMTQuNjU2OSAxMC4zNDMxIDE2IDEyIDE2QzE0LjIwOTEgMTYgMTYgMTQuMjA5MSAxNiAxMkMxNiA5Ljc5MDg2IDE0LjIwOTEgOCAxMiA4QzExLjU1NTYgOCAxICAgICAgICAgICAgIDExLjE0NDcgNy40ODU4MiAxMC43Njk3IDcuMDU5MDhDMTAuMzk0NyA2LjYzMjM0IDEwLjE1MjUgNi4wOTQ2MyAxMCA1LjVDMTAgNC42NzE1NyAxMC42NzE2IDQgMTEuNSA0SDExLjVaIiBmaWxsPSIjOTRBM0I4Ii8+PHBhdGggZD0iTTEyIDE3QzkuMjM4NTggMTcgNyAxOS4yMzg2IDcgMjJDMTAuMzMzMyAyMiAxMy42NjY3IDIyIDE3IDIyQzE3IDE5LjIzODYgMTQuNzYxNCAxNyAxMiAxN1oiIGZpbGw9IiM5NEEzQjgiLz48L3N2Zz4=';

export class LuminaWeaveAPI extends LuminaWeaveAPIBase {
    public chatManager: ChatManager;
    public streamHandler: StreamHandler;
    public timelineManager: TimelineManager;
    public lorebookManager: LorebookManager;
    public promptWorldInfoMount: PromptWorldInfoMount;
    public fontManager: FontManager;
    public measureService: MeasureService;
    public messageListManager: MessageListManager;
    public conversationService: ConversationService;
    public conversationCommandService: ConversationCommandService;
    public promptCommandService: PromptCommandService;
    public generationCommandService: GenerationCommandService;
    public debugChat: ChatDebugGateway;
    public memoryManager: typeof globalMemoryManager;
    public forgeAgent: ForgeAgentController;
    public desktopSurface: DesktopSurfaceService;
    public host: HostInteractionService;
    public conversation: ConversationDomainService;
    public generation: GenerationDomainService;
    public settings: SettingsDomainService;
    public chatPresentationCommands: ChatPresentationCommandService;
    public services: LuminaWeaveDomainServices;
    public readonly plugins: PluginRuntimeApi = createPluginRuntimeApi(pluginManager, pluginDomainRegistry, () => this.whenHostReady());

    private _ready: boolean = false;
    private regexDisplayRefreshPending = false;
    private resolveHostReady: (() => void) | null = null;
    private readonly hostReady = new Promise<void>(resolve => {
        this.resolveHostReady = resolve;
    });
    private _readyPromise: Promise<boolean> | null = null;

    public lastStreamState: GenerationStreamState | null = null;
    public readonly controlledChatCreation = new ControlledChatCreationCoordinator();
    private readonly hostEvents: HostEventWiring;
    public registeredPanels: Map<string, RegisteredPanelEntry>;
    private readonly characterRuntimeSlot = new CharacterRuntimeSlot();

    /** 挂载应用级 character 服务；只能调用一次。 */
    public attachCharacterRuntime(runtime: DesktopCharacterRuntime): void {
        this.characterRuntimeSlot.attach(runtime);
    }

    public get lastPromptPayload(): any {
        return this.promptCommandService?.lastPromptPayload ?? null;
    }

    public set lastPromptPayload(payload: any) {
        if (this.promptCommandService) {
            this.promptCommandService.lastPromptPayload = payload;
        }
    }

    public get generateAbortController(): AbortController | null {
        return this.generationCommandService?.generateAbortController ?? null;
    }

    public set generateAbortController(controller: AbortController | null) {
        if (this.generationCommandService) {
            this.generationCommandService.generateAbortController = controller;
        }
    }

    constructor() {
        super();
        // 宿主事件接线（DOM 生命周期 + ST 事件 → 领域同步）
        this.hostEvents = new HostEventWiring(this);
        // 核心子组件
        this.chatManager = new ChatManager(this);
        this.streamHandler = new StreamHandler();
        this.timelineManager = new TimelineManager(this);
        this.lorebookManager = new LorebookManager(this);
        this.promptWorldInfoMount = new PromptWorldInfoMount(this.lorebookManager);
        this.fontManager = new FontManager();
        this.measureService = new MeasureService();
        this.messageListManager = new MessageListManager(
            this.chatManager.store,
            (msg: LuminaChatMessage) => msg.is_user ? this.getUserAvatar(msg.name) : this.getCharAvatar(msg.name),
            (text: string, isUser: boolean, depth: number) => this.applySTRegex(text, isUser ? 'user_input' : 'ai_output', 'display', { depth })
        );
        this.conversationService = new ConversationService(this as any);
        this.conversationCommandService = new ConversationCommandService({
            chatManager: this.chatManager,
            getConversationMessages: () => this.getConversationMessages({ sourceId: 'chat' }),
            applyDisplayRegex: (text, source, depth) => this.applySTRegex(text, source, 'display', { depth }),
            getUserName: () => this.getUserName(),
            getCharName: () => this.getCharName(),
            syncFromHost: () => this.syncFromST({ skipSave: true, skipIndependentLoad: true })
        });
        this.promptCommandService = new PromptCommandService({
            syncPromptWorldInfo: () => this.syncPromptWorldInfo('probePrompt', { deferDuringControlledChatCreation: false }),
            startSilentStream: () => this.streamHandler.handleRestart({ silent: true }),
            onPromptIntercept: (handler) => this.on('ST_PROMPT_INTERCEPTED', handler),
            offPromptIntercept: (handler) => this.off('ST_PROMPT_INTERCEPTED', handler),
            emitPromptBuilt: (payload) => this.emit('LUMINA_PROMPT_BUILT', payload),
            shouldEmitDryRunPrompt: (fingerprint) => this.controlledChatCreation.shouldEmitDryRunPrompt(fingerprint)
        });
        this.generationCommandService = new GenerationCommandService({
            chatManager: this.chatManager,
            streamHandler: this.streamHandler,
            promptCommandService: this.promptCommandService,
            waitForReady: () => this.waitForReady(),
            beforeGenerationStart: (payload) => this.beforeGenerationStartFlow.emit(payload as any),
            crudChatRecord: (target, action, newText, meta) => this.crudChatRecord(target, action, newText, meta),
            getAssistantName: () => this.getAssistantName(),
            getCharName: () => this.getCharName(),
            getUserName: () => this.getUserName(),
            getLastMessageId: () => this.getLastMessageId(),
            getConversationMessages: () => this.services.conversation.getMessages({ sourceId: 'chat' }),
            commitToST: () => this.commitToST(),
            syncFromST: (options) => this.syncFromST(options),
            emit: (event, ...args) => this.emit(event, ...args),
            getLastStreamState: () => this.lastStreamState,
            setManualAbortPending: (value) => {
                this.hostEvents.setManualAbortPending(value);
            }
        });
        this.debugChat = new ChatDebugGateway(this as any);
        this.memoryManager = globalMemoryManager;
        this.forgeAgent = new ForgeAgentController(this);
        this.desktopSurface = new DesktopSurfaceService((event, ...args) => this.emit(event, ...args));
        // 必须早于 initializeAllPlugins：插件 init 经 context 做的全局注册都登记进各自的撤销作用域。
        pluginManager.setInitContextFactory((pluginId, scope) => createPluginInitContext(pluginId, scope, {
            promptRegistry: globalPromptRegistry,
            xmlInterceptor: globalXMLInterceptor,
            xmlTagRegistry: globalXMLTagRegistry,
            memoryManager: globalMemoryManager,
            getActiveTrace: () => {
                // 宿主就绪前不恢复：此时 provider 由随后的 onChatLoaded 统一恢复。
                if (!this._ready) return undefined;
                const leafId = this.chatManager.activeLeafId;
                return leafId ? this.chatManager.store.getTrace(leafId) : undefined;
            },
            desktopSurface: this.desktopSurface,
            events: this
        }));
        this.host = new HostInteractionService();
        this.conversation = new ConversationDomainService(
            this.conversationService,
            () => this.waitForReady(),
            {
                subscribe: (listener) => {
                    const onContextChanged = ({ context }: ConversationContextChangedPayload): void => {
                        listener({ type: 'context_changed', context });
                    };
                    const onSessionsUpdated = ({ sources, sessions }: ConversationSessionsUpdatedPayload): void => {
                        listener({ type: 'sessions_updated', sources, sessions });
                    };
                    const onTimelineUpdated = ({ context, targetNodeId }: ConversationWorldlineChangedPayload): void => {
                        listener({ type: 'timeline_updated', context, targetNodeId });
                    };
                    const onTimelineSwitched = ({ context, targetNodeId }: ConversationWorldlineChangedPayload): void => {
                        listener({ type: 'timeline_switched', context, targetNodeId });
                    };
                    const onTimelineRolledBack = ({ context, targetNodeId }: ConversationWorldlineChangedPayload): void => {
                        listener({ type: 'timeline_rolled_back', context, targetNodeId });
                    };
                    const subscriptions: Array<[string, Function]> = [
                        ['CONVERSATION_CONTEXT_CHANGED', onContextChanged],
                        ['CONVERSATION_SESSIONS_UPDATED', onSessionsUpdated],
                        ['CONVERSATION_WORLDLINE_UPDATED', onTimelineUpdated],
                        ['CONVERSATION_WORLDLINE_SWITCHED', onTimelineSwitched],
                        ['CONVERSATION_WORLDLINE_ROLLED_BACK', onTimelineRolledBack]
                    ];

                    for (const [event, handler] of subscriptions) {
                        this.on(event, handler);
                    }

                    return () => {
                        for (const [event, handler] of subscriptions) {
                            this.off(event, handler);
                        }
                    };
                }
            },
            this.conversationCommandService
        );
        this.generation = new GenerationDomainService({
            sendMessage: (text, options) => this.sendMessage(text, options),
            regenerateLast: () => this.regenerateLast(),
            runEditedPrompt: (text) => this.runEditedPrompt(text),
            abortGenerate: () => this.abortGenerate(),
            isGenerating: () => this.isGenerating,
            isSyncing: () => this.streamHandler.isSyncing,
            getLastStreamState: () => this.lastStreamState,
            getLastPromptPayload: () => this.lastPromptPayload as unknown,
            probePrompt: () => this.probePrompt() as Promise<unknown>,
            subscribe: (listener: GenerationDomainEventListener) => {
                const onStarted = (): void => listener({ type: 'started' });
                const onUpdated = (
                    processed: string,
                    rawText = processed,
                    filteredCount = 0,
                    statusText?: string,
                    thinkingText?: string,
                    pendingText?: string
                ): void => listener({
                    type: 'updated',
                    state: { processed, text: rawText, filteredCount, statusText, thinkingText, pendingText }
                });
                const onEnded = (finalText: string): void => listener({ type: 'ended', finalText });
                const onFailed = (message: string, status?: string): void => listener({ type: 'failed', message, status });
                const subscriptions: Array<[string, Function]> = [
                    ['GENERATION_STARTED', onStarted],
                    ['BUFFER_UPDATED', onUpdated],
                    ['GENERATION_ENDED', onEnded],
                    ['GENERATION_FAILED', onFailed]
                ];

                for (const [event, handler] of subscriptions) {
                    this.on(event, handler);
                }

                return () => {
                    for (const [event, handler] of subscriptions) {
                        this.off(event, handler);
                    }
                };
            },
            subscribePromptInspection: (listener) => {
                const onStPromptIntercepted = (payload: unknown): void => {
                    listener({ source: 'st', payload });
                };
                const onLuminaPromptBuilt = (payload: unknown): void => {
                    listener({ source: 'lumina', payload });
                };

                this.on('ST_PROMPT_INTERCEPTED', onStPromptIntercepted);
                this.on('LUMINA_PROMPT_BUILT', onLuminaPromptBuilt);

                return () => {
                    this.off('ST_PROMPT_INTERCEPTED', onStPromptIntercepted);
                    this.off('LUMINA_PROMPT_BUILT', onLuminaPromptBuilt);
                };
            }
        });
        this.settings = settingsDomainService;
        this.chatPresentationCommands = new ChatPresentationCommandService({
            on: (eventName, listener) => this.on(eventName, listener),
            off: (eventName, listener) => this.off(eventName, listener)
        });
        const slot = this.characterRuntimeSlot;
        this.services = {
            desktopSurface: this.desktopSurface,
            host: this.host,
            conversation: this.conversation,
            generation: this.generation,
            settings: this.settings,
            chatPresentationCommands: this.chatPresentationCommands,
            timeline: new DesktopTimelineRuntime(this.conversation),
            activity: new DesktopActivityRuntime(this.desktopSurface, this.host, this.chatPresentationCommands),
            get character() {
                return slot.get();
            }
        };
        this.registeredPanels = this.desktopSurface.registeredPanels;

        // 基础元数据
        // 自动解析 SillyTavern 上下文由基类提供

        this.beforeGenerationStartFlow.collect(async (payload) => {
            if (payload.chatType !== 'st') return;
            await this.syncPromptWorldInfo('beforeGenerationStart');
            await this.chatManager.commitToST();
        });

        // 显示正则集合（全局库 / 绑定缓存 / 禁用覆盖）变化后重投影历史消息。
        onRegexDisplayChanged(() => this.scheduleRegexDisplayRefresh());

        // 转发子组件事件至主 API 实例
        [this.chatManager, this.streamHandler, this.timelineManager, this.lorebookManager, this.fontManager, this.measureService, this.messageListManager, this.conversationService].forEach(mgr => {
            mgr.on('CHAT_UPDATED', () => this.emit('CHAT_UPDATED'));
            mgr.on('CHAT_CHANGED', () => this.emit('CHAT_CHANGED'));
            mgr.on('GENERATION_STARTED', () => this.emit('GENERATION_STARTED'));

            // 核心修复：转发流式更新时实时应用正则处理。
            mgr.on('BUFFER_UPDATED', (text: string, rawText?: string, filteredCount?: number, statusText?: string, thinkingText?: string, pendingText?: string) => {
                const fullRaw = rawText || text;
                const processed = this.applySTRegex(text, 'ai_output', 'display', 0);
                const stableFilteredCount = typeof filteredCount === 'number'
                    ? filteredCount
                    : Math.max(0, fullRaw.length - text.length);

                this.lastStreamState = {
                    processed,
                    text: fullRaw,
                    filteredCount: stableFilteredCount,
                    statusText,
                    thinkingText,
                    pendingText
                };
                this.emit('BUFFER_UPDATED', processed, fullRaw, stableFilteredCount, statusText, thinkingText ?? '', pendingText ?? '');
            });

            mgr.on('GENERATION_ENDED', (finalText: string) => {
                this.generationCommandService.handleStreamGenerationEnded(finalText);
                const processed = finalText ? this.applySTRegex(finalText, 'ai_output', 'display', 0) : finalText;
                this.emit('GENERATION_ENDED', processed);
            });
            mgr.on('GENERATION_FAILED', (message: string, status?: string) => {
                this.emit('GENERATION_FAILED', message, status);
            });

            // 转发新版响应式消息列表更新事件
            if (mgr === this.messageListManager as any) {
                mgr.on('MESSAGE_LIST_UPDATED', (list: any) => this.emit('MESSAGE_LIST_UPDATED', list));
            }

            mgr.on('TIMELINE_UPDATED', () => this.emit('TIMELINE_UPDATED'));
            mgr.on('LOREBOOK_SYNCED', (...args: any[]) => this.emit('LOREBOOK_SYNCED', ...args));
            mgr.on('CHAT_CONFLICT', (...args: any[]) => this.emit('CHAT_CONFLICT', ...args));
            mgr.on('CONVERSATION_CONTEXT_CHANGED', (...args: any[]) => this.emit('CONVERSATION_CONTEXT_CHANGED', ...args));
            mgr.on('CONVERSATION_SESSIONS_UPDATED', (...args: any[]) => this.emit('CONVERSATION_SESSIONS_UPDATED', ...args));
            mgr.on('CONVERSATION_WORLDLINE_UPDATED', (...args: any[]) => this.emit('CONVERSATION_WORLDLINE_UPDATED', ...args));
            mgr.on('CONVERSATION_WORLDLINE_SWITCHED', (...args: any[]) => this.emit('CONVERSATION_WORLDLINE_SWITCHED', ...args));
            mgr.on('CONVERSATION_WORLDLINE_ROLLED_BACK', (...args: any[]) => this.emit('CONVERSATION_WORLDLINE_ROLLED_BACK', ...args));

            // 处理来自 StreamHandler 的补全信号（通常由 Watchdog 恢复后触发）
            if (mgr === this.streamHandler) {
                mgr.on('TRANSACTION_COMMITTED', async (info: { lastTransactionId: string; activeLeafId?: string | null; generationId?: string | null }) => {
                    console.log('[LuminaWeave] 收到外部事务提交信号:', info.lastTransactionId);
                    await this.generationCommandService.handleTransactionCommitted(info);
                });
            }
        });

        // 取消构造函数中的自动 init，由 App.vue 在插件注册后显式调用
        // this._readyPromise = this.init(); 

        // 废弃旧版拦截机制，这里不再绑定全局 LuminaWeaveGenerateInterceptor
        // window.LuminaWeaveGenerateInterceptor = async (promptArray: any[], args: any) => { ... };

        // 调试与 UI 暴露
        if (typeof window !== 'undefined') {
            (window as any).LuminaWeave = this;
            (window as any).LuminaWeave_API = this;
        }
    }

    async init(): Promise<boolean> {
        if (this._ready) return true;
        if (this.promptCommandService.isProbing) return false; // 防止初始化重叠

        if (!this._readyPromise) {
            this._readyPromise = this._initInternal();
        }
        return this._readyPromise;
    }

    /**
     * 宿主完全就绪（_initInternal 走完）后 resolve；运行时插件注册以此为门控。
     * init 失败时永不 resolve，运行时注册将一直挂起（与 whenBuiltinsInitialized 约定一致）。
     */
    whenHostReady(): Promise<void> {
        return this.hostReady;
    }

    /**
     * @internal 只由 _initInternal 末尾调用（宿主就绪的唯一出口），同时设置 _ready 并放行 whenHostReady。
     * 设为公开仅为了单测直接驱动，插件与适配器不要调用。
     */
    markHostReady(): void {
        this._ready = true;
        this.resolveHostReady?.();
    }

    private async _initInternal(): Promise<boolean> {
        console.log('[LuminaWeave API] Starting explicit initialization...');
        this.emit('INIT_PROGRESS', '准备初始化环境...');

        // 0. 核心基础设施引导已由入口处的 boot() 完成

        // 1. 基础环境准备：通过 HALBootstrap 探测环境并注册对应驱动
        // 这里传入 onProgress 回调，将 HAL 的初始化进度透传给 UI
        await HALBootstrap.init({
            onProgress: (msg) => this.emit('INIT_PROGRESS', msg)
        });

        // 加载独立全局存储
        await lwStorage.loadIndependentGlobalData();

        // 恢复世界书快照（依赖 HAL extensionStore）
        await this.lorebookManager.initializeSnapshots();

        // 核心修复：激活组件。激活后，ChatManager 才会响应 lwStorage 的变动，
        // 从而确保在 loadIndependentGlobalData 完成且环境确认就绪后才开始逻辑监听。
        this.chatManager.activate();

        this.emit('INIT_PROGRESS', '初始化全局事件...');
        // 2. 初始化核心逻辑 (管理全局事件与监听))
        this.initGlobalEvents();
        await this.initSTEvents(); // 监听
        this.streamHandler.init();

        this.emit('INIT_PROGRESS', '加载子插件...');
        // 3. 初始化所有插件 (完全异步加载)
        // 这一步必须在 syncFromST 之前，因为同步过程中会解析现有消息中的 Mutation 标签，
        // 此时需要所有子插件已完成数据模型的注册。
        await pluginManager.initializeAllPlugins();
        await this.conversationService.initialize();
        await this.forgeAgent.initialize();

        this.emit('INIT_PROGRESS', '同步对话状态...');
        // 4. 初始同步：确保数据一致并从本地加载对话缓存
        await this.syncFromST();

        this.emit('INIT_PROGRESS', '同步世界书设置...');
        // 5. 高级业务初始化 (同步世界书、应用自定义字体等)
        try {
            await this.syncPromptWorldInfo('init', { deferDuringControlledChatCreation: false });
        } catch (e) {
            console.error('[LuminaWeave API] 初始同步提示词世界书失败:', e);
        }
        // 6. 注册设置变更监听 (同步持久化状态与 UI 响应)
        lwStorage.on('*', (data: any) => {
            if (
                data?.key === 'lumina-settings.isPromptInjectionEnabled'
                || data?.key === 'lumina-chat.dialogueUIFrequency'
                || data?.key === 'lumina-settings.luminaViewSyntaxStyle'
            ) {
                void this.syncPromptWorldInfo('settingsChanged');
            }
            this.emit('SETTINGS_CHANGED', data);
        });

        // 7. 监听时空穿越 (节点切换)
        this.chatManager.on('CHAT_UPDATED', () => {
            // 节点切换或对话更新后，异步同步最新状态至世界书
            void this.syncPromptWorldInfo('chatUpdated');
        });

        this.emit('INIT_PROGRESS', '实时指纹捕获中...');
        this.markHostReady();
        console.log('[LuminaWeave API] Facade initialization complete.');
        return true;
    }

    private async syncPromptWorldInfo(
        reason: string,
        options: { deferDuringControlledChatCreation?: boolean } = {}
    ): Promise<void> {
        const shouldDefer = options.deferDuringControlledChatCreation !== false;
        if (shouldDefer && this.controlledChatCreation.deferPromptSync()) {
            console.debug(`[LuminaWeave] 受控新建事务期间暂缓世界书同步: ${reason}`);
            return;
        }

        await this.promptWorldInfoMount.syncToWorldInfo();
    }

    public shouldSuppressControlledChatCreationHostSync(reason: string, chatId: string | null): boolean {
        const shouldSuppress = this.controlledChatCreation.suppressHostSync(reason, chatId);
        if (shouldSuppress) {
            console.debug('[LuminaWeave] 受控新建事务期间跳过宿主同步事件', {
                reason,
                chatId,
                state: this.controlledChatCreation.getState()
            });
        }
        return shouldSuppress;
    }

    private initGlobalEvents(): void {
        this.hostEvents.initGlobalEvents();
    }

    /** 供宿主事件接线查询初始化是否完成（替代直接读取私有 _ready）。 */
    public isReady(): boolean {
        return this._ready;
    }

    /**
     * 等待 API 初始化完成
     */
    async waitForReady(): Promise<boolean> {
        if (this._ready) return true;
        if (!this._readyPromise) {
            // 如果还未初始化，等待 1000ms 再试，或者直接触发一次 init (虽然通常是由 App 触发)
            return new Promise(resolve => setTimeout(() => resolve(this._ready || false), 1000));
        }
        return this._readyPromise;
    }
    async initSTEvents(): Promise<void> {
        await this.hostEvents.initSTEvents();
    }

    // --- 门面属性代理 ---
    get localChatData() { return this.chatManager.localChatData; }
    set localChatData(val) { this.chatManager.store.setNodes(val); }
    get isGenerating() { return this.streamHandler.isGenerating; }
    get responseBuffer() { return this.streamHandler.responseBuffer; }
    get syncState() { return this.chatManager.syncState; }

    getConflictState() {
        return this.getSyncDiff();
    }

    // --- LLM 预设代理 ---
    getPresets(type: string) { return getConversationHostFacadePort().getPresets(type); }
    getActivePresetName(type: string) { return getConversationHostFacadePort().getActivePresetName(type); }
    selectPreset(type: string, name: string) { return getConversationHostFacadePort().selectPreset(type, name); }
    getCurrentApiType() { return getConversationHostFacadePort().getMainApi(); }
    getPhysicalHost() { return HostDetector.physicalHost; }

    // --- 门面方法：转发至 ChatManager ---

    /** 合并同一轮内的多次正则变更通知（微任务后重投影一次）。 */
    private scheduleRegexDisplayRefresh(): void {
        if (this.regexDisplayRefreshPending) return;
        this.regexDisplayRefreshPending = true;
        void Promise.resolve().then(() => {
            this.regexDisplayRefreshPending = false;
            this.refreshRegexDisplayProjection();
        });
    }

    /**
     * 显示正则集合变化后，按新规则强制重投影历史消息的 mes，
     * 并广播新的会话上下文给聊天 surface（否则旧消息会保留上一次的展示文本）。
     */
    private refreshRegexDisplayProjection(): void {
        if (!this._ready) return;
        MessageTextProjection.projectForDisplay(
            this.chatManager.localChatData,
            (text, source, regexOptions) => this.applySTRegex(text, source, 'display', regexOptions),
            (msg) => getChatMessageMutationPort().extractMessageText(msg),
            { force: true }
        );
        void this.conversationService
            .getConversationContext({ sourceId: 'chat' })
            .then(context => {
                this.emit('CONVERSATION_CONTEXT_CHANGED', { context });
            });
    }

    async syncFromST(options: SyncFromOptions = {}): Promise<void> {
        await this.chatManager.syncFromST(0, options);
        await this.lorebookManager.syncFromST();

        MessageTextProjection.projectForDisplay(
            this.chatManager.localChatData,
            (text, source, regexOptions) => this.applySTRegex(text, source, 'display', regexOptions),
            (msg) => getChatMessageMutationPort().extractMessageText(msg)
        );

        // 核心架构重构：TimelineManager 现在是响应式的，会自动监听 store 变动并同步视图流。
        // 此处不再需要手动触发 Timeline 刷新。

        // 核心修复：同步完成后显式触发 UI 刷新事件，并强制刷新提示词世界书
        // 升级：使用 EventFlow 触发异步管道，确保视图模型刷新完成后再向下执行（防止流式气泡过早消失）
        // 关键优化：如果是初始化阶段（_ready=false），非阻塞触发以打破潜在的循环依赖死锁
        if (this._ready) {
            await this.messageReceivedFlow.emit();
        } else {
            void this.messageReceivedFlow.emit();
        }
        this.emit('MESSAGE_RECEIVED'); // 保留旧版兼容性事件
        void this.syncPromptWorldInfo('syncFromST');
        console.log('[LuminaWeave] 同步管道执行完毕，已发送刷新信号并同步世界书');
    }

    async commitToST(): Promise<void> {
        await this.chatManager.commitToST();
    }

    async saveToIndependentChat(): Promise<void> {
        await this.chatManager.saveToIndependentChat();
    }

    async forceSync(): Promise<void> {
        console.log('[LuminaWeave API] 手动触发全量同步...');
        return await this.syncFromST();
    }

    getSTChatMessages(): LuminaChatMessage[] {
        return getChatMessageMutationPort().getSnapshotMessagesSync();
    }

    getSyncDiff() {
        const stMessages = this.getSTChatMessages();
        const activeTrace = this.chatManager.store.getTrace(this.chatManager.store.activeLeafId);
        const localForCompare = activeTrace.length > 0 ? activeTrace : this.chatManager.store.nodePool;
        
        // 核心修复：即使当前界面认为没有冲突，在显式获取 diff 时也应该以当前 store 数据与 stBridge 最新数据比对为准
        const diffData = getChatMessageMutationPort().compareStates(localForCompare, stMessages);
        
        // 我们同样需要将这个最新的状态同步给 chatManager 的缓存
        this.chatManager.syncState.details.messageCount = this.chatManager.store.nodePool.length;
        this.chatManager.syncState.details.stCount = stMessages.length;
        this.chatManager.syncState.details.diffCount = diffData.diffCount;
        
        return diffData;
    }

    analyzeChatDiffWithST(options: { includeHumanReadable?: boolean; maxItems?: number; maxTextLen?: number } = {}): { report: ChatDiffReport; text?: string } {
        const stMessages = this.getSTChatMessages();
        const activeTrace = this.chatManager.store.getTrace(this.chatManager.store.activeLeafId);
        const localForCompare = activeTrace.length > 0 ? activeTrace : this.chatManager.store.nodePool;

        const report = ChatDiffInspector.analyze(localForCompare, stMessages);
        if (!options.includeHumanReadable) return { report };
        return { report, text: ChatDiffInspector.toHumanReadable(report, { maxItems: options.maxItems, maxTextLen: options.maxTextLen }) };
    }

    /**
     * 注册一个动态面板 (用于 Tab 或 Modal 展示)
     */
    registerPanel(id: string, component: RegisteredPanelEntry['component'], config: RegisteredPanelConfig = { title: '未命名面板' }) {
        this.desktopSurface.registerPanel(id, component, config);
    }

    registerDesktopMode(manifest: DesktopModeManifest): () => void {
        return this.desktopSurface.registerDesktopMode(manifest);
    }

    listDesktopModes() {
        return this.desktopSurface.listDesktopModes();
    }

    getDesktopMode(id: string) {
        return this.desktopSurface.getDesktopMode(id);
    }

    /**
     * 打开一个已注册的面板
     * @param id 面板 ID
     * @param props 传递给组件的属性
     * @param options 配置选项，如 { mode: 'tab' | 'modal' }
     */
    openPanel(id: string, props: Record<string, unknown> = {}, options: OpenPanelOptions = {}) {
        this.desktopSurface.openPanel(id, props, options);
    }

    launchActivity(intent: ActivityLaunchIntent) {
        this.desktopSurface.launchActivity(intent);
    }

    setActivityStatusBar(statusBar: ActivityStatusBarDescriptor | null) {
        this.emit('SET_ACTIVITY_STATUS_BAR', statusBar);
    }

    clearActivityStatusBar() {
        this.setActivityStatusBar(null);
    }

    /**
     * 动态打开一个新的 UI 标签页
     * @param tabConfig 标签配置 { id, name, icon, component | surfaceContractId, props }
     */
    openTab(tabConfig: DynamicTabConfig) {
        this.desktopSurface.openTab(tabConfig);
    }

    /**
     * 触发全局冲突查看弹窗 (重构为 Panel 调用)
     */
    openConflictViewer() {
        this.openPanel('conflict');
    }

    openSyncReportViewer() {
        this.openPanel('sync_report');
    }

    // --- 消息发送与生成逻辑 ---
    async sendMessage(text: string, options: SendMessageOptions = {}): Promise<boolean> {
        return this.generationCommandService.sendMessage(text, options);
    }

    async triggerGenerate(): Promise<boolean> {
        return this.generationCommandService.triggerGenerate();
    }

    async regenerateLast(): Promise<any> {
        return this.generationCommandService.regenerateLast();
    }

    async runEditedPrompt(customPayload: string): Promise<void> {
        return this.generationCommandService.runEditedPrompt(customPayload);
    }

    async abortGenerate(): Promise<any> {
        return this.generationCommandService.abortGenerate();
    }

    private async finalizeGeneratedOutput(rawFinalText: string): Promise<string> {
        return this.generationCommandService.finalizeGeneratedOutput(rawFinalText);
    }

    async _getSTFunction(funcName: string): Promise<Function | null> {
        return getHostRuntimePort().getHostFunction(funcName);
    }

    async listConversationSources(): Promise<ConversationContextOption[]> {
        return this.conversation.listSources();
    }

    async listConversationSessions(sourceId?: ConversationContextOption['id']): Promise<ConversationSessionRef[]> {
        return this.conversation.listSessions(sourceId);
    }

    async getConversationContext(override: ConversationContextOverride = {}): Promise<ConversationViewContext> {
        return this.conversation.getContext(override);
    }

    async getConversationMessages(override: ConversationContextOverride = {}): Promise<LuminaChatMessage[]> {
        return this.conversation.getMessages(override);
    }

    async getConversationTimelineGraph(
        override: ConversationContextOverride = {}
    ): Promise<Record<string, ConversationTimelineNode>> {
        return this.conversation.getTimelineGraph(override);
    }

    getTimelineTrace(leafId: string): TimelineNode[] {
        return this.timelineManager.getTrace(leafId);
    }

    async switchConversationContext(input: ConversationContextSwitchInput): Promise<ConversationViewContext> {
        return this.conversation.switchContext(input);
    }

    async createChatSession(input: CreateChatConversationInput): Promise<CreateChatConversationResult> {
        return this.conversation.createChatSession(input);
    }

    async renameChatSession(input: RenameChatConversationInput): Promise<RenameChatConversationResult> {
        return this.conversation.renameChatSession(input);
    }

    async deleteChatSession(input: DeleteChatConversationInput): Promise<DeleteChatConversationResult> {
        return this.conversation.deleteChatSession(input);
    }

    async duplicateChatSession(input: DuplicateChatConversationInput): Promise<DuplicateChatConversationResult> {
        return this.conversation.duplicateChatSession(input);
    }

    beginControlledChatCreation(targetCharacterId: string | number | null | undefined): void {
        const state = this.controlledChatCreation.begin(targetCharacterId);
        console.info('[LuminaWeave][ControlledChatCreation] begin', state);
    }

    markControlledChatCreationFinalChat(chatId: string | null | undefined): void {
        const normalizedChatId = getChatMessageMutationPort().normalizeChatId(chatId);
        const state = this.controlledChatCreation.markFinalChat(normalizedChatId);
        console.info('[LuminaWeave][ControlledChatCreation] final-chat', state);
    }

    isControlledChatCreationActive(): boolean {
        return this.controlledChatCreation.isActive();
    }

    getControlledChatCreationState() {
        return this.controlledChatCreation.getState();
    }

    async flushDeferredPromptWorldInfoSync(reason = 'controlled-chat-creation'): Promise<void> {
        if (!this.controlledChatCreation.consumeDeferredPromptSync()) {
            return;
        }

        console.debug(`[LuminaWeave] 刷新受控新建事务期间延后的世界书同步: ${reason}`);
        await this.syncPromptWorldInfo(reason, { deferDuringControlledChatCreation: false });
    }

    endControlledChatCreation(success: boolean): void {
        const summary = this.controlledChatCreation.end();
        console.info('[LuminaWeave][ControlledChatCreation] summary', {
            success,
            ...summary
        });
    }

    async switchConversationNode(input: ConversationNodeSwitchInput): Promise<boolean> {
        return this.conversation.switchNode(input);
    }

    async branchConversationNode(input: ConversationNodeSwitchInput): Promise<boolean> {
        return this.conversation.branchNode(input);
    }

    async rollbackConversationNode(input: ConversationNodeSwitchInput): Promise<boolean> {
        return this.conversation.rollbackNode(input);
    }

    getProcessedChat() {
        return this.messageListManager.messages;
    }

    async crudChatRecord(target: number | string, action: 'edit' | 'add' | 'delete', newText: string = '', meta: any = {}) {
        await this.waitForReady();
        const result = await this.conversationCommandService.mutateChatRecord(target, action, newText, meta);
        result.events.forEach(event => this.emit(event));
        return result.success;
    }

    async probePrompt(): Promise<any> {
        return this.generationCommandService.probePrompt();
    }

    /**
     * 重建当前对话所有消息 (开发模式)
     * 根据 pluginRaw 重新提取 mesRaw 并更新 mes 和指纹
     */
    public async rebuildCurrentChatMessages(): Promise<{ total: number; rebuilt: number }> {
        const result = await this.conversationCommandService.rebuildCurrentChatMessages();
        if (result.rebuilt > 0) {
            this.emit('CHAT_UPDATED');
            this.emit('MESSAGE_RECEIVED');
        }
        return result;
    }

    /**
     * 获取当前对话树中的最后一条消息 ID (叶子节点)
     */
    public getLastMessageId(): string | null {
        return this.chatManager.activeLeafId;
    }

    /**
     * 核心增强：强制重载并重新执行指定节点的 Mutation 指导
     * 用于解决同步延迟或手动回溯后状态未及时刷新的问题
     */
    async reExecuteMutations(nodeId: string): Promise<boolean> {
        console.log(`[LuminaWeave API] 正在强制重载节点 ${nodeId} 的 Mutation 指令...`);
        const node = this.chatManager.store.getNode(nodeId);
        if (!node) {
            console.warn(`[LuminaWeave API] 重载失败：目标节点 ${nodeId} 在本地存储中不存在。可能尚未同步？`);
            return false;
        }

        // 核心修复：优先使用包含完整标签链路的 pluginRaw，若无则回退至可能包含手动编辑标签的 mesRaw
        const rawContent = node.pluginRaw || node.mesRaw;
        if (!rawContent) {
            console.warn(`[LuminaWeave API] 重载失败：节点 ${nodeId} 不包含任何有效的原始数据 (pluginRaw/mesRaw 均为空)`);
            return false;
        }

        // 1. 强制重新执行 XML 拦截器 (executeHandlers = true)
        // 这将触发所有已注册插件（如 Director）的逻辑，并暂时填充其 DeltaCache
        globalXMLInterceptor.processAndCleanText(rawContent, true);

        // 2. 重新捕获增量与全量快照到节点元数据 (通过 MemoryManager)
        // 核心修复：必须传入 forceSnapshot: true，否则 ephemeral 状态（如 Next_Plan）在非 10 倍数深度节点不会被持久化，导致 branchFromNode 恢复后被重置。
        const trace = this.chatManager.store.getTrace(nodeId);
        const parentHistory = trace.slice(0, -1);
        globalMemoryManager.captureState(node, parentHistory, true);

        // 3. 立即触发一次分支重载 (这将导致 restoreState 被调用，从而重播刚才捕获的最新 Deltas)
        const result = await this.branchConversationNode({
            sourceId: 'chat',
            targetNodeId: nodeId
        });
        if (result) {
            this.showToast('指令重载成功', 'success');
        }
        return result;
    }

    /**
     * 清空当前所有内部状态，并从头开始重新执行当前路径中的所有 M 标签指令
     */
    async reExecuteAllMutations(): Promise<boolean> {
        console.log('[LuminaWeave API] 准备执行全局 M 标签重放...');

        // 1. 重置全局内存管理器 (清空当前状态)
        globalMemoryManager.resetAll();

        // 2. 获取当前活跃路径 (Trace)
        const trace = await this.getConversationMessages({ sourceId: 'chat' });
        if (!trace || trace.length === 0) {
            console.warn('[LuminaWeave API] 当前路径为空，取消重放');
            return false;
        }

         // 3. 按顺序从旧到新重新执行每个节点的 XML 标签
        // 此类重放执行不会同步提交至 ST (silent execution through handlers)
        for (const node of trace) {
            const rawContent = node.pluginRaw || node.mesRaw;
            if (rawContent) {
                // 强制执行 Handler，以此来触发 MutationEngine 的 executeMutation
                globalXMLInterceptor.processAndCleanText(rawContent, true);
            }
        }

        // 4. 重建时间轴关系 (确保一致性)
        // 核心架构重构：响应式驱动，无需手动同步。

         // 5. 触发 UI 刷新与通知
        this.emit('MESSAGE_RECEIVED');
        this.showToast('全局状态重放同步完成', 'success');
        
        console.log('[LuminaWeave API] 全局 M 标签重新执行完毕');
        return true;
    }

    /**
     * 强制回滚并切换到目标节点，并删除所有后续或分支节点
     */
    async rollbackToIndex(index: number): Promise<boolean> {
        const trace = await this.getConversationMessages({ sourceId: 'chat' });
        if (index < 0 || index >= trace.length) return false;
        return this.rollbackConversationNode({
            sourceId: 'chat',
            targetNodeId: trace[index].id
        });
    }

    /**
     * 获取指定键的状态值 (从存储中读取)
     * @param key 键名
     * @param defaultValue 默认值
     */
    getState(key: string, defaultValue: any = undefined): any {
        return lwStorage.get(key, defaultValue);
    }

    public applySTRegex(text: string, source: 'user_input' | 'ai_output' | 'slash_command' | 'world_info' | 'reasoning', destination: 'display' | 'prompt', options: any = {}): string {
        const port = getHostRuntimePort();
        const hostResult = port.hasHostRegex?.()
            ? port.applyRegex(text, source, destination, options)
            : text;
        // 预设/角色绑定的 Lumina 正则不在宿主脚本集中，显示层需要再叠加应用。
        return destination === 'display'
            ? luminaRegexDisplayService.apply(hostResult, source, destination, options)
            : hostResult;
    }

    getSTCore(): any {
        return getHostRuntimePort().getCore();
    }

    // 移除冗余事件方法，由基类提供

    /** 获取内置占位头像 */
    get DEFAULT_AVATAR(): string {
        return DEFAULT_AVATAR;
    }

    /** 获取当前角色名称 */
    getCharName(): string {
        return this.getAssistantName();
    }

    /** 导入 PNG/JSON 角色卡到本地资源源 */
    async importCharacterCard(file: File): Promise<ResourceDocument> {
        return characterImportService.importFile(file);
    }

    getAssistantName() {
        return getConversationHostFacadePort().getAssistantName();
    }

    /** 获取当前用户名称 */
    getUserName(): string {
        return getConversationHostFacadePort().getUserName();
    }

    getCharacterNames(): string[] {
        return getConversationHostFacadePort().getCharacterNames();
    }

    getCharacterNameById(characterId: string | number | null | undefined): string | null {
        return getConversationHostFacadePort().getCharacterNameById(characterId);
    }

    getCharacterRoster(): Array<{
        characterId: string;
        characterName: string;
        characterAvatarUrl: string | null;
    }> {
        return getConversationHostFacadePort().getCharacterRoster();
    }

    async getChatSessionCharacterMeta(
        chatFile: string | null | undefined,
        target: {
            characterId?: string | number | null;
            characterName?: string;
            characterAvatarUrl?: string | null;
        } = {}
    ): Promise<{
        characterId: string | null;
        characterName: string | null;
        characterAvatarUrl: string | null;
    } | null> {
        const meta = await getConversationHostFacadePort().getChatSessionCharacterMeta(chatFile, target);
        return meta
            ? {
                characterId: meta.characterId == null ? null : String(meta.characterId),
                characterName: meta.characterName,
                characterAvatarUrl: meta.characterAvatarUrl
            }
            : null;
    }

    getCharAvatar(name: string): string {
        return getConversationHostFacadePort().getCharacterAvatar(name, DEFAULT_AVATAR);
    }

    getUserAvatar(userName?: string): string {
        return getConversationHostFacadePort().getUserAvatar(userName, DEFAULT_AVATAR);
    }

    // --- 快照管理 ---
    getSnapshotNodes() {
        return this.chatManager.getSnapshotNodes();
    }

    async clearAllSnapshots() {
        return await this.chatManager.clearAllSnapshots();
    }

    showToast(message: string, type: ToastType = 'info', title?: string, duration: number = 3000): void {
        this.host.showToast(message, type, title, duration);
    }

    /**
     * 显示全局确认弹窗 (异步)
     * 解决 Tauri/Android 环境下 window.confirm 不可用的问题
     */
    async confirm(opt: string | ModalOptions): Promise<boolean> {
        return await this.host.confirm(opt);
    }
}

export const luminaWeaveApi = new LuminaWeaveAPI();
export type { TimelineNode, LuminaChatMessage };
export { SyncUtils } from './core/host-drivers/st/SyncUtils.js';
export { DiffVisualizer } from '../components/common/DiffVisualizer.js';
