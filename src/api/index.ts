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
import { HALBootstrap } from './core/hal/HALBootstrap.js';
import { globalXMLInterceptor } from './core/xml-view/XMLInterceptor.js';
import { globalMemoryManager } from './core/runtime-utils/MemoryManager.js';
import { ControlledChatCreationCoordinator } from './core/conversation/ControlledChatCreationCoordinator.js';
import { pluginManager } from '../core/PluginManager.js';
import type { LuminaChatMessage } from '@shared/LuminaMessage.js';
import { LuminaWeaveAPIBase } from './core/facade/LuminaWeaveAPIBase.js';
import { HOST_EVENT, getHostRuntimePort } from './core/facade/HostRuntimePort.js';
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
import { ChatPresentationCommandService } from './services/ChatPresentationCommandService.js';
import type { DesktopModeManifest } from '../desktop-modes/core/types.js';

// 全局变量声明已移动至 src/types/sillytavern.d.ts

import { getChatMessageMutationPort } from './core/conversation/ChatMessageMutationPort.js';
import { getConversationHostFacadePort } from './core/facade/ConversationHostFacadePort.js';
import { PromptCommandService } from './core/generation/PromptCommandService.js';
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

    private _ready: boolean = false;
    private _readyPromise: Promise<boolean> | null = null;

    public lastStreamState: GenerationStreamState | null = null;
    private _manualAbortPending: boolean = false;
    private _lastGeneralChatLoadChatId: string | null = null;
    private _lastGeneralChatLoadAt: number = 0;
    private readonly controlledChatCreation = new ControlledChatCreationCoordinator();
    public registeredPanels: Map<string, RegisteredPanelEntry>;

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
            getLastMessageId: () => this.getLastMessageId(),
            getConversationMessages: () => this.services.conversation.getMessages({ sourceId: 'chat' }),
            commitToST: () => this.commitToST(),
            syncFromST: (options) => this.syncFromST(options),
            emit: (event, ...args) => this.emit(event, ...args),
            getLastStreamState: () => this.lastStreamState,
            setManualAbortPending: (value) => {
                this._manualAbortPending = value;
            }
        });
        this.debugChat = new ChatDebugGateway(this as any);
        this.memoryManager = globalMemoryManager;
        this.forgeAgent = new ForgeAgentController(this);
        this.desktopSurface = new DesktopSurfaceService((event, ...args) => this.emit(event, ...args));
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
        this.services = {
            desktopSurface: this.desktopSurface,
            host: this.host,
            conversation: this.conversation,
            generation: this.generation,
            settings: this.settings,
            chatPresentationCommands: this.chatPresentationCommands
        };
        this.registeredPanels = this.desktopSurface.registeredPanels;

        // 基础元数据
        // 自动解析 SillyTavern 上下文由基类提供

        this.beforeGenerationStartFlow.collect(async (payload) => {
            if (payload.chatType !== 'st') return;
            await this.syncPromptWorldInfo('beforeGenerationStart');
            await this.chatManager.commitToST();
        });

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
        this._ready = true;
        console.log('[LuminaWeave API] Facade initialization complete.');
        return true;
    }

    private _globalEventsInited = false;

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

    private shouldSuppressControlledChatCreationHostSync(reason: string, chatId: string | null): boolean {
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

    private initGlobalEvents() {
        if (this._globalEventsInited) return;

        // 核心增强：页面可见性变化时主动同步后端状态
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                const { chatId } = lwStorage._getContextIds();
                if (chatId) {
                    console.log(`[LuminaWeave] Tab became visible, syncing stream status for ${chatId}...`);
                    this.streamHandler.resumeToTerminal(chatId);
                }
            }
        });

        window.addEventListener('online', () => {
            const { chatId } = lwStorage._getContextIds();
            if (chatId) {
                this.streamHandler.resumeToTerminal(chatId);
            }
        });

        window.addEventListener('offline', () => {
            this.streamHandler.cancelResume();
        });

        window.addEventListener('pageshow', () => {
            const { chatId } = lwStorage._getContextIds();
            if (chatId) {
                this.streamHandler.resumeToTerminal(chatId);
            }
        });

        window.addEventListener('pagehide', () => {
            this.streamHandler.cancelResume();
        });

        this._globalEventsInited = true;
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
    private _stRawBuffer: string = '';
    private _isSyncing = false;
    private _stEventsInited = false;
    async initSTEvents(): Promise<void> {
        if (this._stEventsInited) return;

        // 核心修复：初始加载时物理重置生成锁定标志，防止“假死”
        if (this.chatManager && this.chatManager.sync) {
            this.chatManager.sync.isSTGenerating = false;
        }
        if (this.streamHandler) {
            this.streamHandler.isGenerating = false;
        }
        this._stRawBuffer = '';
        const { chatId } = lwStorage._getContextIds();

        // 初始同步一次后端状态
        if (chatId) {
            // 初始化时的状态同步失败
            this.streamHandler.resumeToTerminal(chatId).catch(e => console.warn('[LuminaWeave] 初始化流状态同步失败:', e));
        }

        const hostRuntime = getHostRuntimePort();
        const diagnostics = hostRuntime.getDiagnostics();

        console.log('[LuminaWeave] initSTEvents, stEventSource check:', {
            hasStCore: diagnostics.hasHostCore,
            hasEventSource: diagnostics.hasEventSource,
            hasEventTypes: diagnostics.hasEventTypes,
            source: diagnostics.source
        });

        if (diagnostics.hasEventSource && diagnostics.hasEventTypes) {
            this.streamHandler.init();

            hostRuntime.on(HOST_EVENT.CHAT_CHANGED, () => {
                console.log('[LuminaWeave] detect chat_id_changed, preparing for reload...');
                this.chatManager._stLoading = true;
            });

            const handleGeneralChatLoad = async (reason: string) => {
                if (this.chatManager.sync.isAutoSyncPaused) {
                    console.debug('[LuminaWeave] 自动同步已暂停，忽略 general chat load');
                    return;
                }
                if (this._isSyncing || !this._ready) return; // 增加 !this._ready 判定是为了防止初始化尚未完成时的外部监听同步

                const currentChatId = getChatMessageMutationPort().normalizeChatId(lwStorage._getContextIds().chatId);
                if (this.shouldSuppressControlledChatCreationHostSync(reason, currentChatId)) {
                    this.chatManager._stLoading = false;
                    return;
                }
                const now = Date.now();
                const isDuplicateLoad = Boolean(
                    currentChatId
                    && currentChatId === this._lastGeneralChatLoadChatId
                    && now - this._lastGeneralChatLoadAt < 600
                );
                if (isDuplicateLoad) {
                    console.debug(`[LuminaWeave] 跳过重复 general chat load: reason=${reason}, chatId=${currentChatId}`);
                    return;
                }

                this._isSyncing = true;
                try {
                    this.chatManager._stLoading = false;
                    this._lastGeneralChatLoadChatId = currentChatId;
                    this._lastGeneralChatLoadAt = now;
                    await this.syncFromST(); 
                    this.emit('CHAT_CHANGED');
                } finally {
                    this._isSyncing = false;
                }
            };

            hostRuntime.on(HOST_EVENT.CHAT_LOADED, async () => {
                await handleGeneralChatLoad('CHAT_LOADED');
                const { chatId } = lwStorage._getContextIds();
                if (chatId) this.streamHandler.resumeToTerminal(chatId);
            });
            // 核心增强：监听新对话创建与删除事件
            hostRuntime.on(HOST_EVENT.CHAT_CREATED, () => {
                console.log('[LuminaWeave] detect chat_created');
                this.emit('CHAT_CREATED');
                handleGeneralChatLoad('CHAT_CREATED');
            });

            hostRuntime.on(HOST_EVENT.CHAT_DELETED, () => {
                console.log('[LuminaWeave] detect chat_deleted');
                this.emit('CHAT_DELETED');
                handleGeneralChatLoad('CHAT_DELETED'); // 删除后通常会载入一个空对话或另一个对话
            });

            hostRuntime.on(HOST_EVENT.MESSAGE_RECEIVED, async () => {
                handleIncrementalSync('MESSAGE_RECEIVED');
            });

            // --- 核心增强：监听官方提示词准备就绪事件 ---
            // 兼容性监听器：同时捕获多种可能的提示词准备事件
            const unifiedIntercept = (evtName: string, data: any, isDryRunArg: any = undefined) => {
                const candidate = this.promptCommandService.recordPromptCandidate(evtName, data, isDryRunArg);

                console.debug(`[LuminaWeave] [EVENT_TRACE] 监听到提示词候选 [${evtName}]: exists=${!!candidate.prompt}, isDryRun=${candidate.isDryRun}, isProbing=${this.promptCommandService.isProbing}`);

                if (candidate.shouldEmitPrompt) {
                    console.log(`[LuminaWeave] 成功从事件 ${evtName} 截获提示词负载:`, candidate.prompt);
                    this.emit('ST_PROMPT_INTERCEPTED', candidate.prompt);
                }
            };

            // 监听所有可能触发提示词组装完成的事件
            const promptEvents = [
                HOST_EVENT.GENERATE_AFTER_DATA,
                HOST_EVENT.CHAT_COMPLETION_PROMPT_READY,
                HOST_EVENT.GENERATE_AFTER_COMBINE_PROMPTS
            ];

            promptEvents.forEach(evtKey => {
                hostRuntime.on(evtKey, (data: any, isDryRunArg: any) => unifiedIntercept(evtKey, data, isDryRunArg));
            });

            // 监听ST的信息更新
            hostRuntime.on(HOST_EVENT.GENERATION_ENDED, async (data: any) => {
                console.log('[LuminaWeave] 截获信息更新 (generation_ended)');
                console.log('[LuminaWeave] (generation_ended)data:', data);

                this.chatManager.sync.isSTGenerating = false;
                this._manualAbortPending = false;
                this._stRawBuffer = '';
                this.emit('ST_GENERATION_ENDED', data);

                // 核心修复：无论 Lumina 内部状态如何，只要监听到 ST 结束信号，就强制执行收尾
                // todo：注意，插件内部在生成时不走ST生成时应该无效
                // 这能有效防止因事件丢失或状态机异常导致的 UI 卡死
                const chatMessages = hostRuntime.getCurrentChatMessages();
                const lastMessage = chatMessages[chatMessages.length - 1] as any;
                if (lastMessage && !lastMessage.is_user) {
                    const finalText = lastMessage.mes || '';
                    await this.generationCommandService.finalizeGeneratedOutput(finalText);
                }

                // 核心修复：延迟 100ms 触发最终同步，确保 ST 本地数据库已写入完毕，然后发送结束信号
                setTimeout(async () => {
                    await this.syncFromST();
                    // 只有当是 ST 原生生成时才调用 handleEnd
                    if (!this.isGenerating) {
                        this.streamHandler.handleEnd();
                    }
                }, 100);
            });

            hostRuntime.on(HOST_EVENT.GENERATION_STARTED, (type: string, options: any, dryRun: boolean) => {
                if (this.promptCommandService.isProbing || dryRun) {
                    if (!this.promptCommandService.isProbing && dryRun && this.controlledChatCreation.shouldSuppressDryRunRestart()) {
                        console.debug('[LuminaWeave] 受控新建事务期间跳过重复 DryRun 重启');
                        return;
                    }
                    console.log(`[LuminaWeave] 监测到 ${this.promptCommandService.isProbing ? '探针' : 'DryRun'} 触发的 ST 开始生成，静默处理...`);
                    // 如果我们自己正在生成，不要去干扰 StreamHandler 的状态
                    if (!this.isGenerating) {
                        this.streamHandler.handleRestart({ silent: true });
                    }
                    return;
                }
                console.log('[LuminaWeave] 监测到 ST 开始生成，屏蔽自动同步...');
                this.chatManager.sync.isSTGenerating = true;
                this._stRawBuffer = '';
                this.lastStreamState = null; // 重置缓存
                // 同时也标记流式处理器开始工作，确保双向状态同步
                // 仅当非 Lumina 侧触发时才重置
                if (!this.isGenerating) {
                    this.streamHandler.handleRestart();
                }
                this.emit('GENERATION_STARTED');
            });

            hostRuntime.on(HOST_EVENT.GENERATION_STOPPED, () => {
                console.log('[LuminaWeave] 监测到 ST 停止生成，恢复自动同步并释放状态...');
                this.chatManager.sync.isSTGenerating = false;
                this._stRawBuffer = '';
                const wasManualAbort = this._manualAbortPending;
                this._manualAbortPending = false;
                setTimeout(async () => {
                    await handleIncrementalSync('ST_GENERATION_STOPPED');
                    if (!this.isGenerating) {
                        if (wasManualAbort) {
                            this.streamHandler.clearSmoothTimer();
                            this.emit('GENERATION_FAILED', '已停止生成', 'aborted');
                        } else {
                            this.streamHandler.handleEnd();
                        }
                    }
                }, 500);
            });

            // --- 核心增强：监听更多更新事件，实现增量同步 ---
            const handleIncrementalSync = async (reason: string) => {
                const syncService = this.chatManager.sync;
                if (syncService.isAutoSyncPaused) {
                    console.debug(`[LuminaWeave] 自动同步已暂停，忽略事件: ${reason}`);
                    return;
                }

                const currentChatId = getChatMessageMutationPort().normalizeChatId(lwStorage._getContextIds().chatId);
                if (this.shouldSuppressControlledChatCreationHostSync(reason, currentChatId)) {
                    return;
                }

                // 核心修复：防止初始化过程中 ST 事件触发增量同步导致竞态条件
                if (!this._ready) {
                    console.debug(`[LuminaWeave] 初始化尚未完成，忽略增量同步事件: ${reason}`);
                    return;
                }

                // 核心修复：如果在生成过程中 (无论是 ST 侧还是 Lumina 侧)，跳过由 MESSAGE_UPDATED 触发的同步。
                // 因为流式过程中 handleStreamToken 已经通过 StreamHandler 接管了 UI 预览，
                // 此时频繁调用 syncFromST 会导致 UI 整个列表不断重新渲染渲染。
                if ((this.isGenerating || syncService.isSTGenerating)) {
                    if (reason === 'MESSAGE_UPDATED' || reason === 'MESSAGE_RECEIVED') {
                        return;
                    }
                }

                if (this._isSyncing) return;

                // 核心修复：安全守卫 (SafetyGuard)
                // 仅在 ST 原生生成模式下 (`isSTGenerating`) 检查全局标志位。
                // 如果是 Lumina Nexus 模式 (`this.isGenerating` 为 true 但 `isSTGenerating` 为 false), 
                // `window.is_generating` 本来就是 false，此时绝不能触发 cleanup。
                const generationFlags = hostRuntime.getGenerationFlags();
                const isActuallyGenerating = generationFlags.isGenerating || generationFlags.isTyping;
                if (!isActuallyGenerating && syncService.isSTGenerating) {
                    // ST 认为没在生成，但我们认为在生成
                    // 如果这个事件是 STREAM_TOKEN 相关的，说明可能还在收尾，暂时忽略
                    if (reason.includes('STREAM_TOKEN')) return;
                    console.log('[LuminaWeave] [SafetyGuard] 检测到 ST 原生生成状态可能已挂起，准备检查 cleanup...');
                    setTimeout(() => {
                        const latestGenerationFlags = hostRuntime.getGenerationFlags();
                        const stillNotGenerating = !latestGenerationFlags.isGenerating && !latestGenerationFlags.isTyping;
                        if (stillNotGenerating && syncService.isSTGenerating) {
                            console.log('[LuminaWeave] [SafetyGuard] 确认 ST 生成已停止，执行强制 cleanup');
                            this.chatManager.sync.isSTGenerating = false;
                            this.streamHandler.handleEnd();
                        }
                    }, 200);
                    return;
                }

                this._isSyncing = true;
                try {
                    console.log(`[LuminaWeave] 由事件驱动触发同步: ${reason}`);
                    await this.syncFromST();
                } finally {
                    this._isSyncing = false;
                }
            };

            // 核心增强：监听流式 Token 接收，支持同步显示 ST 原生生成状态线
            const handleStreamToken = (capturedText: string) => {
                // 仅在 ST 正在原生生成（且 Lumina 本地未在生成）时执行同步，防止冲突
                if (this.chatManager.sync.isSTGenerating && !this.isGenerating) {

                    // 1. 增量/全量自适应判断
                    // 如果这次传来的 text 包含了 buffer 的内容，说明是全量
                    if (capturedText.startsWith(this._stRawBuffer)) {
                        this._stRawBuffer = capturedText;
                    }
                    // 如果 buffer 包含 capturedText，说明可能是重发，忽略
                    else if (this._stRawBuffer.includes(capturedText) && capturedText.length < this._stRawBuffer.length) {
                        return;
                    }
                    // 否则，视为增量 Token
                    else {
                        this._stRawBuffer += capturedText;
                    }

                    // 2. 保持原始 XML Buffer，交给 StreamHandler 统一决定过滤与展示
                    const lastLen = this.streamHandler.responseBuffer.length;
                    const rawDelta = this._stRawBuffer.startsWith(this.streamHandler.responseBuffer)
                        ? this._stRawBuffer.substring(lastLen)
                        : this._stRawBuffer;

                    if (rawDelta.length > 0 || this._stRawBuffer !== this.streamHandler.responseBuffer) {
                        this.streamHandler.handleChunk(rawDelta, this._stRawBuffer);
                    }
                }
            };

            hostRuntime.on(HOST_EVENT.STREAM_TOKEN_RECEIVED, handleStreamToken);
            hostRuntime.on(HOST_EVENT.SMOOTH_STREAM_TOKEN_RECEIVED, handleStreamToken);

            // 核心事件：切换对话或对话加载完成 (解决启动时 ChatID 无效导致的同步跳过)
            hostRuntime.on(HOST_EVENT.CHAT_LOADED, () => handleIncrementalSync('CHAT_LOADED'));
            hostRuntime.on(HOST_EVENT.CHAT_CHANGED, () => handleIncrementalSync('CHAT_CHANGED'));
            hostRuntime.on(HOST_EVENT.CHARACTER_PAGE_LOADED, () => handleIncrementalSync('CHARACTER_PAGE_LOADED'));

            // 消息编辑、删除、更新事件
            hostRuntime.on(HOST_EVENT.MESSAGE_EDITED, () => handleIncrementalSync('MESSAGE_EDITED'));
            hostRuntime.on(HOST_EVENT.MESSAGE_DELETED, () => handleIncrementalSync('MESSAGE_DELETED'));
            hostRuntime.on(HOST_EVENT.MESSAGE_UPDATED, () => handleIncrementalSync('MESSAGE_UPDATED'));
            // 核心增强：监听切换回复 (Swipe) 事件
            hostRuntime.on(HOST_EVENT.MESSAGE_SWIPED, () => handleIncrementalSync('MESSAGE_SWIPED'));
            // 批量加载更多消息
            hostRuntime.on(HOST_EVENT.MORE_MESSAGES_LOADED, () => handleIncrementalSync('MORE_MESSAGES_LOADED'));
        }
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

    // --- 门面方法：转发至 ChatManager ---
    async syncFromST(options: { skipSave?: boolean; forceOverwrite?: boolean; skipIndependentLoad?: boolean; forceIndependentLoad?: boolean; resolveIntent?: 'st' | 'lumina' } = {}): Promise<void> {
        await this.chatManager.syncFromST(0, options);
        await this.lorebookManager.syncFromST();

        const chat = this.chatManager.localChatData;
        if (chat) {
            chat.forEach((msg, index) => {
                const extra = msg.extra || {};
                const source = msg.is_user ? 'user_input' : 'ai_output';
                const depth = chat.length - 1 - index;

                const mesRawTs = extra.mesRaw_ts || 0;
                const mesTs = extra.mes_ts || 0;

                if (msg.pluginRaw) {
                    // 只要有 pluginRaw，我们就重新根据它生成最准确的展示版本
                    const finalSourceText = getChatMessageMutationPort().extractMessageText(msg);
                    
                    // 强力对齐：确保 mesRaw 包含标签，mes 紧随其后同步
                    if (msg.mesRaw !== finalSourceText) {
                        msg.mesRaw = finalSourceText;
                        msg.extra.mesRaw_ts = Date.now();
                    }

                    // 即使 mes 已经有值，如果其内容过旧或不包含预期标签，也重新生成
                    if (!msg.mes || mesRawTs > mesTs || !extra.mes_ts) {
                        msg.mes = this.applySTRegex(msg.mesRaw, source, 'display', { depth });
                        msg.extra.mes_ts = Date.now();
                    }
                } else if (!msg.mes || mesRawTs > mesTs || !extra.mes_ts) {
                    // 没有 pluginRaw 时，按常规逻辑从 mesRaw 同步到 mes
                    msg.mes = this.applySTRegex(msg.mesRaw, source, 'display', { depth });
                    msg.extra.mes_ts = Date.now();
                }
            });
        }

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

    registerDesktopMode(manifest: DesktopModeManifest) {
        this.desktopSurface.registerDesktopMode(manifest);
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
        return this.promptCommandService.probePrompt();
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
        return getHostRuntimePort().applyRegex(text, source, destination, options);
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
export { SyncUtils, DiffVisualizer } from './core/host-drivers/st/SyncUtils.js';
