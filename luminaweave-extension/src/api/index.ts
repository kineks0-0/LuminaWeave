import { lwStorage } from './storage.js';
import { SyncUtils, DiffVisualizer, MessageTextResolver } from './core/SyncUtils.js';
import { llmEngine } from './llmEngine.js';
import { ChatManager } from './core/ChatManager.js';
import { STAdapter } from './core/STAdapter.js';
import { STProtocol } from './core/st-adapter/STProtocol.js';
import { STClient } from './core/st-adapter/STClient.js';
import { StreamHandler } from './core/StreamHandler.js';
import { TimelineManager, TimelineNode } from './core/TimelineManager.js';
import { LorebookManager } from './core/LorebookManager.js';
import { MessageListManager } from './core/MessageListManager.js';
import { PromptWorldInfoMount } from './core/PromptWorldInfoMount.js';
import { FontManager } from './core/FontManager.js';
import { MeasureService } from './core/MeasureService.js';
import { promptBuilder } from './core/PromptBuilder.js';
import { globalPromptRegistry, PromptSlot } from './core/PromptRegistry.js';
import { globalXMLInterceptor, XMLInterceptor, BuiltinXMLTags } from './core/XMLInterceptor.js';
import { globalMemoryManager } from './core/MemoryManager.js';
import { pluginManager } from '../core/PluginManager.js';
import { ST_EVENT } from './core/STEvent.js';
import type { LuminaChatMessage } from '../../../shared/LuminaMessage.js';
import { LuminaWeaveAPIBase } from './core/LuminaWeaveAPIBase.js';
import { ChatDiffInspector, ChatDiffReport } from './debug/ChatDiffInspector.js';

// 全局变量声明已移动至 src/types/sillytavern.d.ts

import { EnvDetector } from './core/EnvDetector.js';
import { GenerationSession } from './core/GenerationSession.js';
import { LuminaGenerationTask, TaskCallbacks } from './core/LuminaGenerationTask.js';
import { NexusClient } from './core/NexusClient.js';
import { ForgeAgentController } from './core/ForgeAgentController.js';
import { useModalStore, ModalOptions } from '../stores/useModalStore.js';

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
    public memoryManager: typeof globalMemoryManager;
    public forgeAgent: ForgeAgentController;

    private _ready: boolean = false;
    private _readyPromise: Promise<boolean> | null = null;

    public lastPromptPayload: any = null;
    public generateAbortController: AbortController | null = null;
    public lastStreamState: { processed: string; text: string; filteredCount: number; statusText?: string; thinkingText?: string } | null = null;
    private _probing: boolean = false;
    private _probingEvents: { name: string, hasData: boolean, keys: string[] }[] = [];
    private _manualAbortPending: boolean = false;
    public registeredPanels: Map<string, { id: string, component: any, config: any }> = new Map();

    /** 当前正在运行的生成会话 */
    private _session: GenerationSession | null = null;
    private nexus: NexusClient;
    private _currentTask: LuminaGenerationTask | null = null;

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
        this.memoryManager = globalMemoryManager;
        this.nexus = new NexusClient();
        this.forgeAgent = new ForgeAgentController(this);

        // 基础元数据
        // 自动解析 SillyTavern 上下文由基类提供

        this.beforeGenerationStartFlow.collect(async (payload) => {
            if (payload.chatType !== 'st') return;
            await this.promptWorldInfoMount.syncToWorldInfo();
            await this.chatManager.commitToST();
        });

        // 转发子组件事件至主 API 实例
        [this.chatManager, this.streamHandler, this.timelineManager, this.lorebookManager, this.fontManager, this.measureService, this.messageListManager].forEach(mgr => {
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

                this.lastStreamState = { processed, text: fullRaw, filteredCount: stableFilteredCount, statusText, thinkingText };
                this.emit('BUFFER_UPDATED', processed, fullRaw, stableFilteredCount, statusText, thinkingText ?? '', pendingText ?? '');
            });

            mgr.on('GENERATION_ENDED', (finalText: string) => {
                if (this._session) {
                    this._session.finalText = finalText;
                    this.finalizeGeneration();
                }
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

            // 处理来自 StreamHandler 的补全信号（通常由 Watchdog 恢复后触发）
            if (mgr === this.streamHandler) {
                mgr.on('TRANSACTION_COMMITTED', async (info: { lastTransactionId: string; activeLeafId?: string | null; generationId?: string | null }) => {
                    console.log('[LuminaWeave] 收到外部事务提交信号:', info.lastTransactionId);
                    
                    if (this._session) {
                        this._session.committedInfo = info;
                        this.finalizeGeneration();
                    } else {
                        // 核心增强：兜底机制。如果当前没有正在跟踪的生成任务（例如看门狗恢复或页面刚载入），
                        // 且后端事务已提交，则我们需要检查是否需要同步 UI。
                        const { chatId: currentChatId } = lwStorage._getContextIds();
                        const persistence = this.chatManager.persistence;
                        const localTxId = persistence.getIntegratedTxId(currentChatId);

                        if (info.lastTransactionId && localTxId !== info.lastTransactionId) {
                            console.log(`[LuminaWeave] [Fallback] 检测到本地事务 ID (${localTxId}) 后置于后端 (${info.lastTransactionId})，触发无状态同步...`);
                            await this.syncFromST({ forceIndependentLoad: true });
                        }
                    }
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
        if (this._probing) return false; // 防止初始化重叠

        if (!this._readyPromise) {
            this._readyPromise = this._initInternal();
        }
        return this._readyPromise;
    }

    private async _initInternal(): Promise<boolean> {
        console.log('[LuminaWeave API] Starting explicit initialization...');
        this.emit('INIT_PROGRESS', '准备初始化环境...');

        // 1. 基础环境准备：加载独立全局存储并等待 ST/Helper 准备就绪
        // 这里会先进入 silenceMode 以防 TavernHelper 尚未加载时报错
        EnvDetector.isSilenceMode = true;
        const [envReady] = await Promise.all([
            this.waitForEnvironment(20000), // 冷启动探测容忍度提高到 20s
            lwStorage.loadIndependentGlobalData()
        ]);
        
        // 环境就绪后，恢复正常日志输出并激活组件
        EnvDetector.isSilenceMode = false;

        if (!envReady) {
            console.warn('[LuminaWeave API] 环境未完全就绪，API 将在受限或脱离模式下继续运行');
        }

        // 核心修复：激活组件。激活后，ChatManager 才会响应 lwStorage 的变动，
        // 从而确保在 loadIndependentGlobalData 完成且环境确认就绪后才开始逻辑监听。
        this.chatManager.activate();

        this.emit('INIT_PROGRESS', '初始化全局事件...');
        // 2. 初始化核心逻辑 (管理全局事件与监听))
        this.initGlobalEvents();
        await this.initSTEvents(); // 监听
        this.initResponseBuffer(); // 内部调用 streamHandler.init()

        this.emit('INIT_PROGRESS', '加载子插件...');
        // 3. 初始化所有插件 (完全异步加载)
        // 这一步必须在 syncFromST 之前，因为同步过程中会解析现有消息中的 Mutation 标签，
        // 此时需要所有子插件已完成数据模型的注册。
        await pluginManager.initializeAllPlugins();

        this.emit('INIT_PROGRESS', '同步对话状态...');
        // 4. 初始同步：确保数据一致并从本地加载对话缓存
        await this.syncFromST();

        this.emit('INIT_PROGRESS', '同步世界书设置...');
        // 5. 高级业务初始化 (同步世界书、应用自定义字体等)
        try {
            await this.promptWorldInfoMount.syncToWorldInfo();
        } catch (e) {
            console.error('[LuminaWeave API] 初始同步提示词世界书失败:', e);
        }
        this.applyCustomFont();

        // 6. 注册设置变更监听 (同步持久化状态与 UI 响应)
        lwStorage.on('*', (data: any) => {
            if (
                data?.key === 'lumina-settings.isPromptInjectionEnabled'
                || data?.key === 'lumina-chat.dialogueUIFrequency'
                || data?.key === 'lumina-settings.luminaViewSyntaxStyle'
            ) {
                this.promptWorldInfoMount.syncToWorldInfo();
            }
            if (data && (data.key === 'lumina-chat.fontFamily' || data.key === 'lumina-chat.fontWeight')) {
                this.applyCustomFont();
            }
            this.emit('SETTINGS_CHANGED', data);
        });

        // 7. 监听时空穿越 (节点切换)
        this.chatManager.on('CHAT_UPDATED', () => {
            // 节点切换或对话更新后，异步同步最新状态至世界书
            this.promptWorldInfoMount.syncToWorldInfo();
        });

        this.emit('INIT_PROGRESS', '实时指纹捕获中...');
        this._ready = true;
        console.log('[LuminaWeave API] Facade initialization complete.');
        return true;
    }

    private _globalEventsInited = false;
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

        // 使用基类提供的标准探测器机制
        const core = this.ctx;
        const main = this.stMain;
        const stEventSource = this.stEventSource;
        const event_types = this.stEventTypes;

        console.log('[LuminaWeave] initSTEvents, stEventSource check:', {
            hasStCore: !!core,
            hasEventSource: !!stEventSource,
            hasEventTypes: !!event_types,
            source: core?.eventSource ? 'context' : (main?.eventSource ? 'main' : (stEventSource ? 'window' : 'null'))
        });

        if (stEventSource && event_types) {
            // 将主 API 获取到的标准 eventSource 传递给流式处理器，确保监听一致性
            this.streamHandler.init(stEventSource);

            stEventSource.on(event_types[ST_EVENT.CHAT_CHANGED], () => {
                console.log('[LuminaWeave] detect chat_id_changed, preparing for reload...');
                this.chatManager._stLoading = true;
            });

            const handleGeneralChatLoad = async () => {
                if (this.chatManager.sync.isAutoSyncPaused) {
                    console.debug('[LuminaWeave] 自动同步已暂停，忽略 general chat load');
                    return;
                }
                if (this._isSyncing || !this._ready) return; // 增加 !this._ready 判定是为了防止初始化尚未完成时的外部监听同步
                this._isSyncing = true;
                try {
                    this.chatManager._stLoading = false;
                    await this.syncFromST(); 
                    this.emit('CHAT_CHANGED');
                } finally {
                    this._isSyncing = false;
                }
            };

            stEventSource.on(event_types[ST_EVENT.CHAT_LOADED], async () => {
                await handleGeneralChatLoad();
                const { chatId } = lwStorage._getContextIds();
                if (chatId) this.streamHandler.resumeToTerminal(chatId);
            });
            // Removed duplicate CHAT_CHANGED listener here, as it's handled by CHAT_LOADED and the initial CHAT_CHANGED above.
            // stEventSource.on(event_types[ST_EVENT.CHAT_CHANGED], async () => {
            //     await handleGeneralChatLoad();
            //     const { chatId } = lwStorage._getContextIds();
            //     if (chatId) this.streamHandler.syncWithServer(chatId);
            // });

            // 核心增强：监听新对话创建与删除事件
            stEventSource.on(event_types[ST_EVENT.CHAT_CREATED], () => {
                console.log('[LuminaWeave] detect chat_created');
                this.emit('CHAT_CREATED');
                handleGeneralChatLoad();
            });

            stEventSource.on(event_types[ST_EVENT.CHAT_DELETED], () => {
                console.log('[LuminaWeave] detect chat_deleted');
                this.emit('CHAT_DELETED');
                handleGeneralChatLoad(); // 删除后通常会载入一个空对话或另一个对话
            });

            stEventSource.on(event_types[ST_EVENT.MESSAGE_RECEIVED], async () => {
                handleIncrementalSync('MESSAGE_RECEIVED');
            });

            // --- 核心增强：监听官方提示词准备就绪事件 ---
            // 兼容性监听器：同时捕获多种可能的提示词准备事件
            const unifiedIntercept = (evtName: string, data: any, isDryRunArg: any = undefined) => {
                // 探测期间记录轨迹
                if (this._probing) {
                    this._probingEvents.push({
                        name: evtName,
                        hasData: !!data,
                        keys: data && typeof data === 'object' ? Object.keys(data) : []
                    });
                }

                // 核心提取逻辑：处理直接传数组、data.prompt、data.messages 等多种情况
                let prompt = null;
                if (Array.isArray(data)) {
                    prompt = data;
                } else if (data && typeof data === 'object') {
                    prompt = data.prompt || data.chat || data.messages || data.fullPrompt;
                }

                // isDryRun 判定逻辑：
                // 1. 优先使用 data.dryRun
                // 2. 其次使用第二个参数 isDryRunArg
                // 3. 如果正在探测，默认为 true
                const isDryRun = (data && typeof data.dryRun === 'boolean')
                    ? data.dryRun
                    : (typeof isDryRunArg === 'boolean' ? isDryRunArg : this._probing);

                console.debug(`[LuminaWeave] [EVENT_TRACE] 监听到提示词候选 [${evtName}]: exists=${!!prompt}, isDryRun=${isDryRun}, isProbing=${this._probing}`);

                if (prompt && (isDryRun || this._probing)) {
                    console.log(`[LuminaWeave] 成功从事件 ${evtName} 截获提示词负载:`, prompt);
                    this.lastPromptPayload = prompt;
                    this.emit('ST_PROMPT_INTERCEPTED', prompt);
                }
            };

            // 监听所有可能触发提示词组装完成的事件
            const promptEvents = [
                ST_EVENT.GENERATE_AFTER_DATA,
                ST_EVENT.CHAT_COMPLETION_PROMPT_READY,
                ST_EVENT.GENERATE_AFTER_COMBINE_PROMPTS
            ];

            promptEvents.forEach(evtKey => {
                const evtName = event_types[evtKey];
                if (evtName) {
                    stEventSource.on(evtName, (data: any, isDryRunArg: any) => unifiedIntercept(evtName, data, isDryRunArg));
                }
            });

            // 监听ST的信息更新
            stEventSource.on(event_types[ST_EVENT.GENERATION_ENDED], (data: any) => {
                console.log('[LuminaWeave] 截获信息更新 (generation_ended)');
                console.log('[LuminaWeave] (generation_ended)data:', data);

                this.chatManager.sync.isSTGenerating = false;
                this._manualAbortPending = false;
                this._stRawBuffer = '';
                this.emit('ST_GENERATION_ENDED', data);

                // 核心修复：无论 Lumina 内部状态如何，只要监听到 ST 结束信号，就强制执行收尾
                // todo：注意，插件内部在生成时不走ST生成时应该无效
                // 这能有效防止因事件丢失或状态机异常导致的 UI 卡死
                const ctx = this.ctx || this.stMain;
                const lastMessage = ctx?.chat?.[ctx.chat.length - 1] as any;
                if (lastMessage && !lastMessage.is_user) {
                    const finalText = lastMessage.mes || '';
                    // 1. 调用全局 XML 拦截器 (解析并执行 Mutation 指令，更新本地 deltaCache)
                    const cleanedFinalText = globalXMLInterceptor.processAndCleanText(finalText, false);
                    
                    // 2. 核心增强：强制提交内存中的增量修改并同步至当前活跃节点
                    if (this.chatManager.activeLeafId) {
                        const activeNode = this.chatManager.store.getNode(this.chatManager.activeLeafId);
                        if (activeNode) {
                            globalMemoryManager.commitDeltas(activeNode);
                            // 核心修复：提交变动到 ST，确保记忆持久化
                            this.commitToST();
                        }
                    }

                    // 3. 触发插件引擎生命周期回调
                    pluginManager.callHooks('onGenerationEnded', cleanedFinalText);
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

            stEventSource.on(event_types[ST_EVENT.GENERATION_STARTED], (type: string, options: any, dryRun: boolean) => {
                if (this._probing || dryRun) {
                    console.log(`[LuminaWeave] 监测到 ${this._probing ? '探针' : 'DryRun'} 触发的 ST 开始生成，静默处理...`);
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

            stEventSource.on(event_types[ST_EVENT.GENERATION_STOPPED], () => {
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
                const glob = EnvDetector.stGlobal;
                const isActuallyGenerating = !!glob?.is_generating || !!glob?.is_typing;
                if (!isActuallyGenerating && syncService.isSTGenerating) {
                    // ST 认为没在生成，但我们认为在生成
                    // 如果这个事件是 STREAM_TOKEN 相关的，说明可能还在收尾，暂时忽略
                    if (reason.includes('STREAM_TOKEN')) return;
                    console.log('[LuminaWeave] [SafetyGuard] 检测到 ST 原生生成状态可能已挂起，准备检查 cleanup...');
                    setTimeout(() => {
                        const stillNotGenerating = !glob?.is_generating && !glob?.is_typing;
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

            stEventSource.on(event_types[ST_EVENT.STREAM_TOKEN_RECEIVED], handleStreamToken);
            stEventSource.on(event_types[ST_EVENT.SMOOTH_STREAM_TOKEN_RECEIVED], handleStreamToken);

            // 核心事件：切换对话或对话加载完成 (解决启动时 ChatID 无效导致的同步跳过)
            stEventSource.on(event_types[ST_EVENT.CHAT_LOADED], () => handleIncrementalSync('CHAT_LOADED'));
            stEventSource.on(event_types[ST_EVENT.CHAT_CHANGED], () => handleIncrementalSync('CHAT_CHANGED'));
            stEventSource.on(event_types[ST_EVENT.CHARACTER_PAGE_LOADED], () => handleIncrementalSync('CHARACTER_PAGE_LOADED'));

            // 消息编辑、删除、更新事件
            stEventSource.on(event_types[ST_EVENT.MESSAGE_EDITED], () => handleIncrementalSync('MESSAGE_EDITED'));
            stEventSource.on(event_types[ST_EVENT.MESSAGE_DELETED], () => handleIncrementalSync('MESSAGE_DELETED'));
            stEventSource.on(event_types[ST_EVENT.MESSAGE_UPDATED], () => handleIncrementalSync('MESSAGE_UPDATED'));
            // 核心增强：监听切换回复 (Swipe) 事件
            stEventSource.on(event_types[ST_EVENT.MESSAGE_SWIPED], () => handleIncrementalSync('MESSAGE_SWIPED'));
            // 批量加载更多消息
            stEventSource.on(event_types[ST_EVENT.MORE_MESSAGES_LOADED], () => handleIncrementalSync('MORE_MESSAGES_LOADED'));
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
    getPresets(type: string) { return STClient.getPresets(type); }
    getActivePresetName(type: string) { return STClient.getActivePresetName(type); }
    selectPreset(type: string, name: string) { return STClient.selectPreset(type, name); }

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
                    const finalSourceText = MessageTextResolver.extractMessageText(msg);
                    
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
        // 此处不再需要手动调用 syncTimelineWithCurrentChat()。

        // 核心修复：同步完成后显式触发 UI 刷新事件，并强制刷新提示词世界书
        // 升级：使用 EventFlow 触发异步管道，确保视图模型刷新完成后再向下执行（防止流式气泡过早消失）
        // 关键优化：如果是初始化阶段（_ready=false），非阻塞触发以打破潜在的循环依赖死锁
        if (this._ready) {
            await this.messageReceivedFlow.emit();
        } else {
            void this.messageReceivedFlow.emit();
        }
        this.emit('MESSAGE_RECEIVED'); // 保留旧版兼容性事件
        this.promptWorldInfoMount.syncToWorldInfo();
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
        return STAdapter.getSnapshotSync().lumina;
    }

    getSyncDiff() {
        const stMessages = this.getSTChatMessages();
        const activeTrace = this.chatManager.store.getTrace(this.chatManager.store.activeLeafId);
        const localForCompare = activeTrace.length > 0 ? activeTrace : this.chatManager.store.nodePool;
        
        // 核心修复：即使当前界面认为没有冲突，在显式获取 diff 时也应该以当前 store 数据与 stBridge 最新数据比对为准
        const diffData = STAdapter.compareStates(localForCompare, stMessages);
        
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
    registerPanel(id: string, component: any, config: { title: string, icon?: string, defaultMode?: 'tab' | 'modal' } = { title: '未命名面板' }) {
        console.log(`[LuminaWeave API] 注册面板: ${id}`);
        this.registeredPanels.set(id, { id, component, config });
    }

    /**
     * 打开一个已注册的面板
     * @param id 面板 ID
     * @param props 传递给组件的属性
     * @param options 配置选项，如 { mode: 'tab' | 'modal' }
     */
    openPanel(id: string, props: any = {}, options: { mode?: 'tab' | 'modal' } = {}) {
        const panel = this.registeredPanels.get(id);
        if (!panel) {
            console.error(`[LuminaWeave API] 尝试打开未注册的面板: ${id}`);
            return;
        }

        const mode = options.mode || panel.config.defaultMode || 'modal';

        if (mode === 'tab') {
            this.openTab({
                id: panel.id,
                name: panel.config.title,
                icon: panel.config.icon || '',
                component: panel.component,
                props: { ...props, isTabMode: true }
            });
        } else {
            // 默认触发 modal 类型的事件
            this.emit(`OPEN_PANEL_${id.toUpperCase()}`, props);
        }
    }

    /**
     * 动态打开一个新的 UI 标签页
     * @param tabConfig 标签配置 { id, name, icon, component, props }
     */
    openTab(tabConfig: { id: string, name: string, icon: string, component: any, props?: any }) {
        console.log(`[LuminaWeave API] 请求打开标签页: ${tabConfig.name} (${tabConfig.id})`);
        this.emit('OPEN_TAB', tabConfig);
    }

    /**
     * 触发全局冲突查看弹窗 (重构为 Panel 调用)
     */
    openConflictViewer() {
        this.openPanel('conflict');
    }

    // --- 消息发送与生成逻辑 ---
    async sendMessage(text: string, options: { chatType?: 'st' | 'plugin' } = {}): Promise<boolean> {
        await this.waitForReady();
        const { chatId } = lwStorage._getContextIds();
        const success = await this.crudChatRecord(-1, 'add', text, { is_user: true });
        if (!success) return false;

        const chatType = options.chatType || 'st';
        
        // 触发发信前生命周期流并等待其装载完毕（实现如世界书等前置依赖组装）
        await this.beforeGenerationStartFlow.emit({
            chatId,
            chatType,
            text
        });

        const chatPresetId = lwStorage.get('lumina-chat.nexusPreset', '', 'Global');
        const presets = lwStorage.get('nexus.presets', [], 'Global');
        const targetPreset = presets.find((p: any) => p.id === chatPresetId);
        const firstNode = targetPreset?.nodes?.[0];

        // 核心修复：如果首个节点是 ST 原生，或者没有配置预设，直接回退到原生生成电路
        // 这解决了非 OpenAI API 无法使用“主 API”的问题，且由于 STContext 已经由 Lumina 监听，流式处理依然有效。
        if (!firstNode || firstNode.provider === 'st_current') {
            console.log('[LuminaWeave] [MainAPI] 检测到原生节点或空预设，执行原生电路回退...');
            this.streamHandler.handleRestart();
            this.emit('GENERATION_STARTED');
            return this.triggerGenerate();
        }

        // --- 刺探阶段：仅在需要外部 LLM 节点（Nexus）时执行 ---
        const prompt = await this.probePrompt();
        if (!prompt) {
            console.warn('[LuminaWeave] 无法获取刺探提示词，回退至原生 ST 生成电路');
            return this.triggerGenerate();
        }

        const nodes = llmEngine.resolveNodesFromPreset(chatPresetId);

        this.streamHandler.handleRestart();
        this._session = llmEngine.createSession({
            chatId: lwStorage._getContextIds().chatId || '',
            charName: this.getAssistantName(),
            parentId: this.chatManager.activeLeafId,
            nodes
        });
        this.emit('GENERATION_STARTED');

        const finalPayload = prompt.messages || prompt;
        const finalMessages = llmEngine.cleanMessages(finalPayload);
        const generationSettings = prompt.settings || {};

        if (typeof generationSettings.seed === 'number' && generationSettings.seed < 0) {
            delete generationSettings.seed;
        }

        if (lwStorage.get('lumina-chat.unlimitedResponse', false, 'Global')) {
            console.log('[LuminaWeave] 流式无限输出已开启，移除 max_tokens 限制');
            delete generationSettings.max_tokens;
            delete generationSettings.max_length;
        }

        const task = new LuminaGenerationTask(this._session);
        // 保存 Task 引用以便中止
        this._currentTask = task;

        try {
            await task.run(finalMessages, {
                onChunk: (chunk: string, fullText: string) => {
                    const lastRawLen = this.streamHandler.responseBuffer.length;
                    const rawDelta = fullText.startsWith(this.streamHandler.responseBuffer)
                        ? fullText.substring(lastRawLen)
                        : fullText;

                    this.streamHandler.handleChunk(rawDelta, fullText);
                },
                onDone: async (finalText: string) => {
                    if (this._session) {
                        if (!this._session.committedInfo) {
                            this.emitSyncingStatus('等待后端确认事务...');
                        }
                    }
                    // 进入同步中状态，等待事务提交
                    this.streamHandler.handleEnd({ stayActive: true });
                    await this.finalizeGeneration();
                },
                onBackendCommitted: async (info) => {
                    if (this._session) {
                        this._session.committedInfo = info;
                    }
                    await this.finalizeGeneration();
                },
                onActivity: () => {
                    this.streamHandler.notifyActivity();
                },
                onError: (err: any) => {
                    // 如果错误是由 Abort 引起的，可能是用户取消，也可能是看门狗正在介入
                    const isAbort = err?.name === 'AbortError' || err?.message?.includes('aborted');
                    if (isAbort) {
                        console.log('[LuminaWeave] 流式信道由于 Abort 断开，等待同步或看门狗恢复...');
                        // 中止时不立即清理 session，保留给看门狗恢复或同步逻辑
                        return;
                    }

                    const errorMessage = err?.message || '后端生成失败';
                    this.streamHandler.isGenerating = false;
                    this.streamHandler.clearSmoothTimer();
                    this.emit('GENERATION_FAILED', errorMessage, 'error');
                    this.generateAbortController = null;
                    
                    // 核心修复：发生真实错误时清理会话，防止残留
                    if (this._session) {
                        this._session = null;
                    }
                    console.error('[LuminaWeave] LLM Engine 链路异常:', err);
                }
            }, generationSettings);
        } catch (e) {
            // 顶层异常，只在未能进入 Task.run 内部处理时触发
            this.streamHandler.isGenerating = false;
            this.streamHandler.clearSmoothTimer();
            this.emit('GENERATION_FAILED', (e as any)?.message || '发送失败', 'error');
            this._session = null;
            console.error('[LuminaWeave] 发送异常:', e);
        }

        return true;
    }

    private emitSyncingStatus(text: string) {
        const last = this.lastStreamState;
        if (!last) return;
        this.emit('BUFFER_UPDATED', last.processed, last.text, last.filteredCount, text, last.thinkingText ?? '', '');
    }

    /**
     * 协调完成生成后的同步：当且仅当 [文本就绪] 且 [后端事务提交就绪] 时执行。
     */
    private async finalizeGeneration() {
        const session = this._session;
        if (!session || session.isFinalizing) return;
        
        if (!session.canFinalize()) {
            console.log('[LuminaWeave] 等待收口条件满足...', { 
                hasText: !!session.finalText, 
                hasCommit: !!session.committedInfo,
                txId: session.committedInfo?.lastTransactionId || 'pending'
            });
            return;
        }

        session.isFinalizing = true;
        const { chatId: currentChatId } = lwStorage._getContextIds();
        this.emitSyncingStatus('同步对话中...');
        console.log('[LuminaWeave] 收口条件满足，开始同步对话数据。事务 ID:', session.committedInfo!.lastTransactionId);
        
        // 核心更新：将后端分配的新消息 ID 同步给本地 ChatManager
        if (session.committedInfo!.activeLeafId) {
            console.log('[LuminaWeave] 更新当前活跃节点:', session.committedInfo!.activeLeafId);
            this.chatManager.activeLeafId = session.committedInfo!.activeLeafId;
        }

        try {
            const persistenceService = this.chatManager.persistence;
            const info = session.committedInfo!;
            
            // 核心优化：增量原子同步 (Atomic Incremental Sync)
            // 具备完整的 Node 载荷和 Seq 序号，直接静默落地并对齐事务轨道
            if (info.node && typeof info.seq === 'number') {
                console.log('[LuminaWeave] [AtomicSync] 接收到后端增量推送，执行静默对齐。');
                
                // 1. 静默吸收：标记来源为 backend，底层将自动设置 syncStatus = 'synced'
                this.chatManager.store.upsertNode(info.node, { silent: true, source: 'backend' });
                
                // 2. 活跃节点指针对齐
                if (info.activeLeafId) {
                    this.chatManager.activeLeafId = info.activeLeafId;
                }
                
                // 3. 事务状态物理落地：更新持久化 Seq 和逻辑事务 ID
                await persistenceService.persistLastCommittedSeq(currentChatId, info.seq);
                persistenceService.setIntegratedTxId(currentChatId, info.lastTransactionId);
                
                console.log('[LuminaWeave] [AtomicSync] 增量落地成功。');
            } else {
                // 降级：执行传统的全量状态对齐 (如 SSE 载荷缺失时)
                const localTxId = persistenceService.getIntegratedTxId(currentChatId);
                if (info.lastTransactionId && localTxId === info.lastTransactionId) {
                    console.log(`[LuminaWeave] 本地事务已处于对齐状态 (${localTxId})，跳过拉取。`);
                } else {
                    await this.syncFromST({ forceIndependentLoad: true });
                }
                
                if (info.activeLeafId) {
                    this.chatManager.activeLeafId = info.activeLeafId;
                }
            }

        } catch (e) {
            console.error('[LuminaWeave] 同步对话数据失败:', e);
        } finally {
            // 核心修复：必须确保清理标志位，即使同步过程报错
            session.isFinalizing = false;

            const cleanedFinalText = globalXMLInterceptor.processAndCleanText(session.finalText || '', false);
            if (this.chatManager.activeLeafId) {
                const activeNode = this.chatManager.store.getNode(this.chatManager.activeLeafId);
                if (activeNode) {
                    globalMemoryManager.commitDeltas(activeNode);
                    await this.commitToST();
                }
            }
            pluginManager.callHooks('onGenerationEnded', cleanedFinalText);
            
            // 物理释放生成锁定
            this.streamHandler.finishSync();
            this.generateAbortController = null;
            
            // 核心修复：仅在当前活跃会话是正在结束的这个时才清理
            if (this._session === session) {
                this._session = null;
            }
            console.log('[LuminaWeave] 生成收口完成。');
        }
    }

    async triggerGenerate(): Promise<boolean> {
        const generate = await this._getSTFunction('generate');
        if (generate) {
            try {
                await generate();
                return true;
            } catch (e) {
                const message = (e as any)?.message || '触发 ST 生成失败';
                this.streamHandler.isGenerating = false;
                this.streamHandler.clearSmoothTimer();
                this.emit('GENERATION_FAILED', message, 'error');
                console.error('[LuminaWeave] ST generate 调用失败:', e);
                return false;
            }
        }

        this.streamHandler.isGenerating = false;
        this.streamHandler.clearSmoothTimer();
        this.emit('GENERATION_FAILED', '未找到 ST generate 方法：请检查是否在 SillyTavern 环境中运行，或切换到 Nexus 预设生成。', 'error');
        console.warn('[LuminaWeave] 找不到有效的 ST generate 方法');
        return false;
    }

    async regenerateLast(): Promise<any> {
        const regenerate = await this._getSTFunction('regenerate');
        if (regenerate) return regenerate();

        const slash = await this._getSTFunction('executeSlashCommandsWithOptions');
        if (slash) return slash('/regenerate');

        console.warn('[LuminaWeave] 找不到有效的 ST regenerate 方法');
    }

    async abortGenerate(): Promise<any> {
        this._manualAbortPending = true;
        this.streamHandler.isGenerating = false;

        if (this._currentTask) {
            console.log('[LuminaWeave] 触发正在运行的任务中止...');
            this._currentTask.abort();
            this._currentTask = null;
        }

        if (this.generateAbortController) {
            console.log('[LuminaWeave] 正在发出本地中断信号...');
            this.generateAbortController.abort();
            this.generateAbortController = null;
        }

        const { chatId } = lwStorage._getContextIds();
        if (chatId) {
            this.nexus.stopGeneration(chatId);
        }

        const stop = (await this._getSTFunction('stopGeneration')) || (await this._getSTFunction('stopGenerating'));
        if (stop) {
            console.log('[LuminaWeave] 触发原生 ST 停止指令...');
            const ret = await stop();
            setTimeout(async () => {
                await this.syncFromST({ skipSave: true, skipIndependentLoad: true });
                if (!this.isGenerating) {
                    this.streamHandler.clearSmoothTimer();
                    this.emit('GENERATION_FAILED', '已停止生成', 'aborted');
                }
            }, 250);
            return ret;
        }

        this.streamHandler.clearSmoothTimer();
        this.emit('GENERATION_FAILED', '已停止生成', 'aborted');
        console.warn('[LuminaWeave] 找不到有效的 ST 停止方法');
    }

    async _getSTFunction(funcName: string): Promise<Function | null> {
        let foundFunc: Function | null = null;
        let source = 'none';

        // 核心获取逻辑：优先从 SillyTavern 主 API 对象查找，而不是 context 镜像
        const stApi = (typeof SillyTavern !== 'undefined' ? SillyTavern : null) || (window as any).SillyTavern;

        if (stApi && typeof stApi[funcName] === 'function') {
            foundFunc = stApi[funcName];
            source = 'SillyTavern API';
        } else if (typeof (window as any)[funcName] === 'function') {
            foundFunc = (window as any)[funcName];
            source = 'window (global)';
        } else if (this.ctx && typeof (this.ctx as any)[funcName] === 'function') {
            // 最后才尝试 context (有些旧版本 ST 可能放在这)
            foundFunc = (this.ctx as any)[funcName];
            source = 'ctx';
        } else {
            // 尝试从父窗口查找 (Iframe 模式)
            try {
                if (window.parent && (window.parent as any).SillyTavern && typeof (window.parent as any).SillyTavern[funcName] === 'function') {
                    foundFunc = (window.parent as any).SillyTavern[funcName];
                    source = 'window.parent.SillyTavern';
                }
            } catch (e) { /* cross-origin prevented */ }

            if (!foundFunc) {
                const stCore = await this.getSTCore();
                if (stCore && typeof (stCore as any)[funcName] === 'function') {
                    foundFunc = (stCore as any)[funcName];
                    source = 'stCore (import)';
                }
            }
        }

        if (foundFunc) {
            console.debug(`[LuminaWeave] [ST_API] 已定位到函数: ${funcName}, 来源: ${source}`);
            // 确保 context 正确 (bind)
            if (source === 'SillyTavern API' && stApi) return foundFunc.bind(stApi);
            if (source === 'window.parent.SillyTavern') return foundFunc.bind((window.parent as any).SillyTavern);
            if (source === 'ctx') return foundFunc.bind(this.ctx);
            return foundFunc;
        }

        // 查找失败时的深度扫描
        const apiKeys = stApi ? Object.keys(stApi) : [];
        const windowKeys = Object.keys(window).filter(k => k.toLowerCase().includes('generate'));

        // 尝试常见别名
        const aliases = ['generateResponse', 'triggerGenerate', 'generateQuietPrompt'];
        for (const alias of aliases) {
            if (stApi && typeof stApi[alias] === 'function') {
                console.warn(`[LuminaWeave] [ST_API] 未找到 ${funcName}，但在 stApi 中尝试发现别名: ${alias}`);
                return stApi[alias].bind(stApi);
            }
        }

        console.error(`[LuminaWeave] [ST_API] 无法定位到函数: ${funcName}.`, {
            hasStApi: !!stApi,
            apiKeys: apiKeys.slice(0, 50), // 只记录前50个，防止日志爆炸
            windowMatchingKeys: windowKeys,
            hasWindowST: !!(window as any).SillyTavern,
            hasGlobalST: typeof SillyTavern !== 'undefined'
        });
        return null;
    }

    // --- 兼容性补足 ---
    async initTimelineGraph() { return this.syncFromST(); }
    stEventOn(event: string, cb: Function) { return this.on(event, cb); }
    initResponseBuffer() { return this.streamHandler.init(); }
    syncTimelineWithCurrentChat() { this.timelineManager.syncTimelineWithCurrentChat(); }

    async getChat(): Promise<LuminaChatMessage[]> {
        await this.waitForReady();
        if (!this.chatManager.localChatData || !this.chatManager.activeLeafId) return [];

        // 核心增强：从 Store 获取当前活跃节点的实时完整链路 (Trace)
        // 不再依赖 timelineManager 的 cached graph，防止在数据变动的瞬间产生空链路
        return this.chatManager.store.getTrace(this.chatManager.activeLeafId);
    }

    getProcessedChat() {
        return this.messageListManager.messages;
    }

    async crudChatRecord(target: number | string, action: 'edit' | 'add' | 'delete', newText: string = '', meta: any = {}) {
        await this.waitForReady();
        const chat = await this.getChat(); // 获取当前活跃链路
        if (!chat) return false;

        const runWithSyncLock = async (fn: () => Promise<any>) => {
            const syncService = this.chatManager.sync;
            syncService.pauseAutoSync();
            try {
                const result = await fn();
                // 操作完成后立即执行一次全量同步，确保本地与 ST 状态一致
                await this.syncFromST({ skipSave: true, skipIndependentLoad: true });
                return result;
            } finally {
                syncService.resumeAutoSync();
            }
        };

        if (action === 'edit') {
            return await runWithSyncLock(async () => {
                const index = typeof target === 'number' ? target : chat.findIndex(m => m.id === target);
                if (index >= 0 && index < chat.length) {
                    const msg = chat[index];
                    const source = msg.is_user ? 'user_input' : 'ai_output';
                    const depth = chat.length - 1 - index;
                    const now = Date.now();

                    const finalMesRaw = XMLInterceptor.extractTagContent(newText, BuiltinXMLTags.CHAT_REPLY).join('\n\n') || globalXMLInterceptor.processAndCleanText(newText, false);
                    msg.mesRaw = finalMesRaw;
                    msg.mes = this.applySTRegex(finalMesRaw, source, 'display', { depth });
                    msg.fingerprint = SyncUtils.getFingerprint(finalMesRaw);
                    msg.stFingerprint = SyncUtils.getSTFingerprint(msg.mes);
                    msg.extra = msg.extra || {};
                    msg.extra.mesRaw_ts = now;
                    msg.extra.mesRaw = finalMesRaw;
                    msg.extra.mes_ts = now;
                    msg.extra.fingerprint = msg.fingerprint;
                    msg.extra.stFingerprint = msg.stFingerprint;

                    // 核心修复：更新 activeLeafId 指针到当前编辑的节点
                    this.chatManager.activeLeafId = msg.id;

                    // 统一委托至 STClient
                    // 由于现在我们要完全后端解耦，不应该依赖原生 ST 的 updateMessage
                    // 而是应该修改本地状态后，调用独立存储的保存，然后让 fallback 去处理（或者未来改为调用后端的 edit 接口）
                    // 暂时保留原逻辑，因为 STClient.updateMessage 是发给 ST 前端界面的，能保持兼容
                    const stIndex = await STAdapter.getSnapshot().then(snap => snap.idToIndex.get(msg.id));
                    const finalIndex = stIndex ?? index;
                    await STClient.updateMessage(finalIndex, msg.mes, undefined, undefined, { id: msg.id, fingerprint: msg.fingerprint, stFingerprint: msg.stFingerprint, mesRaw: finalMesRaw });
                }
                const { chatId } = lwStorage._getContextIds();
                await this.chatManager.persistence.saveToIndependentChat(chatId);
                return true;
            });

        } else if (action === 'delete') {
            return await runWithSyncLock(async () => {
                const index = typeof target === 'number' ? target : chat.findIndex(m => m.id === target);
                if (index >= 0 && index < chat.length) {
                    const msg = chat[index];
                    this.chatManager.store.removeSubtree(msg.id);
                    if (index > 0) {
                        this.chatManager.activeLeafId = chat[index - 1].id;
                    } else {
                        this.chatManager.activeLeafId = null;
                    }

                    const stIndex = await STAdapter.getSnapshot().then(snap => snap.idToIndex.get(msg.id));
                    const finalIndex = stIndex ?? index;
                    await STClient.deleteMessages([finalIndex]);
                }
                const { chatId } = lwStorage._getContextIds();
                await this.chatManager.persistence.saveToIndependentChat(chatId);
                return true;
            });

        } else if (action === 'add') {
            return await runWithSyncLock(async () => {
                const isUser = !!meta.is_user;
                const source = isUser ? 'user_input' : 'ai_output';
                const displayText = this.applySTRegex(newText, source, 'display', { depth: 0 });

                // 补全父节点 ID
                const parentId = this.chatManager.activeLeafId;

                const finalMesRaw = isUser ? newText : (XMLInterceptor.extractTagContent(newText, BuiltinXMLTags.CHAT_REPLY).join('\n\n') || globalXMLInterceptor.processAndCleanText(newText, false));

                const newMsg: any = {
                    name: meta.name || (isUser ? this.getUserName() : this.getCharName()),
                    is_user: isUser,
                    role: isUser ? 'user' : 'assistant',
                    pluginRaw: meta.pluginRaw || null, // 1. 原始数据 (PluginRaw，包含生命周期标签)
                    mesRaw: finalMesRaw,                   // 2. 原始对话内容 (用于 ST 编辑和保存)
                    mes: displayText,                  // 3. 显示对话内容 (用于 UI 渲染)
                    characterId: lwStorage._getContextIds().charId,
                    parentId: parentId, // 链接至当前叶子
                    extra: {}
                };
                const chatId = lwStorage._getContextIds().chatId;

                // 核心修复：指纹 ID 的 index 部分必须对应 ST 对话列表中的“楼层” (即当前链路长度)
                // 而不是全量节点池的长度，否则在不同分支切换后会产生 ID 漂移
                const currentTrace = this.chatManager.store.getTrace(this.chatManager.activeLeafId);
                const fingerprint = SyncUtils.getFingerprint(newMsg.mesRaw);
                newMsg.fingerprint = fingerprint;
                newMsg.stFingerprint = SyncUtils.getSTFingerprint(newMsg.mesST ?? newMsg.mesRaw ?? newMsg.mes ?? '');

                // --- 冗余节点校验：如果当前父节点下已存在相同指纹的子节点，则直接复用 ---
                const existingChildren = this.chatManager.store.getChildren(this.chatManager.activeLeafId);
                const matchingNode = existingChildren.find((n: LuminaChatMessage) => n.fingerprint === fingerprint && n.role === newMsg.role);

                if (matchingNode) {
                    console.log('[LuminaWeave API] 检测到同内容子节点，执行复用:', matchingNode.id);
                    this.chatManager.activeLeafId = matchingNode.id;
                    await this.chatManager.persistence.saveToIndependentChat(chatId);
                    await this.chatManager.commitToST();

                    // 这里已被 runWithSyncLock 处理了 syncFromST
                    this.emit('MESSAGE_RECEIVED');
                    return true;
                }

                newMsg.id = SyncUtils.generateNodeId();

                if (newMsg.parentId === undefined) {
                    newMsg.parentId = this.chatManager.activeLeafId;
                }

                // --- 插件生命周期：允许插件注入元数据/快照 (Timeline Time Travel) ---
                pluginManager.callHooks('onMessageAdding', newMsg, currentTrace);

                this.chatManager.store.upsertNode(newMsg);

                // 更新活跃指针
                this.chatManager.activeLeafId = newMsg.id;

                // 委托至 STClient 追加物理消息
                await STClient.appendMessage({
                    role: newMsg.role,
                    mes: newMsg.mes,
                    name: newMsg.name,
                    extra: {
                        ...newMsg.extra,
                        id: newMsg.id,
                        fingerprint: newMsg.fingerprint,
                        stFingerprint: newMsg.stFingerprint,
                        mesRaw: finalMesRaw
                    }
                });

                // 优化同步：跳过从独立存储重载，防止刚设置的 activeLeafId 被旧磁盘元数据覆盖
                await this.chatManager.appendToIndependentChat(newMsg);
                // 这里已被 runWithSyncLock 处理了 syncFromST

                // --- 插件生命周期：消息添加后的副作用 (如异步规划) ---
                pluginManager.callHooks('onMessageAdded', newMsg, currentTrace);
                return true;
            });
        }

        await this.timelineManager.syncTimelineWithCurrentChat();
        this.emit('MESSAGE_RECEIVED');


        return true;
    }

    async probePrompt(): Promise<any> {
        console.log('[LuminaWeave] [Probe] 启动提示词探测流程...');
        this._probing = true;
        this._probingEvents = []; // 重置事件追踪
        this.lastPromptPayload = null;

        // 刺探前确保世界书已同步最新状态
        await this.promptWorldInfoMount.syncToWorldInfo();

        const generate = await this._getSTFunction('generate');
        if (generate) {
            console.log('[LuminaWeave] [Probe] 世界书同步完成，开始监听 Intercept 事件...');
            const probePromise = new Promise((resolve) => {
                const handler = (payload: any) => {
                    console.log("[LuminaWeave] [Probe] 探测任务成功响应:", !!payload);
                    this.off('ST_PROMPT_INTERCEPTED', handler);
                    resolve(payload);
                };
                this.on('ST_PROMPT_INTERCEPTED', handler);
                setTimeout(() => {
                    if (this._probing) {
                        console.error("[LuminaWeave] [Probe] 15秒探测超时！");
                        console.error("[LuminaWeave] [Probe] [DIAGNOSTIC] 探测期间捕获到的事件轨迹:", this._probingEvents);
                        if (this._probingEvents.length === 0) {
                            console.warn("[LuminaWeave] [Probe] [DIAGNOSTIC] 期间未收到任何提示词相关事件。请确认 [event_types] 是否包含 GENERATE_AFTER_DATA 等。");
                        } else {
                            console.warn("[LuminaWeave] [Probe] [DIAGNOSTIC] 收到了事件但未提取到 Prompt。请检查上述轨迹中的 keys 是否包含预期的提示词字段。");
                        }
                        this.off('ST_PROMPT_INTERCEPTED', handler);
                        resolve(null);
                    }
                }, 15000);
            });

            try {
                // ST Generate 签名为: (type, options, dryRun)
                // 核心修复：在 options 中显式传入 dry_run，同时由于部分 ST 版本 type='quiet' 会抑制事件，尝试组合参数
                console.log(`[LuminaWeave] [Probe] 正在发起 ST 原生 API 调用 (type=quiet, dry_run=true)...`);

                this.streamHandler.handleRestart({ silent: true });
                (generate as any)('quiet', {
                    should_silence: true,
                    is_quiet: true,
                    dry_run: true
                }, true);
            } catch (e) {
                console.error("[LuminaWeave] [Probe] 原生 API 调用崩溃:", e);
            }

            let result = await probePromise;
            console.log('[LuminaWeave] [Probe] 探测 Promise 已解决, 有效负载:', !!result);
            this._probing = false;
            const stop = (await this._getSTFunction('stopGeneration')) || (await this._getSTFunction('stopGenerating'));
            if (stop) {
                try {
                    await stop();
                } catch (e) {
                    console.warn('[LuminaWeave] [Probe] 停止 ST 探测生成失败:', e);
                }
            }

            // 插件的提示词已经通过世界书/宏等方式自然组装完毕，直接透传即可
            if (Array.isArray(result)) {
                this.lastPromptPayload = result;
                this.emit('LUMINA_PROMPT_BUILT', result);
                return { messages: result, settings: {} }; // 兼容原先的返回格式
            }

            return result;
        }

        console.warn('[LuminaWeave] [Probe] 探测失败：未能找到 generate 函数，探测终止。');
        this._probing = false;
        return null;
    }

    /**
     * 重建当前对话所有消息 (开发模式)
     * 根据 pluginRaw 重新提取 mesRaw 并更新 mes 和指纹
     */
    public async rebuildCurrentChatMessages(): Promise<{ total: number; rebuilt: number }> {
        const nodes = this.chatManager.store.nodePool;
        let count = 0;

        for (const msg of nodes) {
            // 保存旧指纹用于统计
            const oldFp = msg.fingerprint;
            
            // 调用统一归一化管道，强制全字段重算
            // 该方法内部会处理 pluginRaw 提取、mes 清洗、mesST 生成及 stFingerprint 计算
            STProtocol.syncMessageCalculatedFields(msg, { force: true });
            
            if (oldFp !== msg.fingerprint) {
                count++;
            }
        }

        if (count > 0) {
            const { chatId } = lwStorage._getContextIds();
            // 1. 同步回 ST
            await this.chatManager.commitToST();
            // 2. 保存独立存储
            await this.chatManager.persistence.saveToIndependentChat(chatId);
            // 3. 通知 UI 更新 (WorldlineStore 已在 upsert/setNodes 中处理事件，
            // 这里额外触发全局同步完成信号)
            this.emit('CHAT_UPDATED');
            this.emit('MESSAGE_RECEIVED');
        }

        return { total: nodes.length, rebuilt: count };
    }

    /**
     * 获取当前对话树中的最后一条消息 ID (叶子节点)
     */
    public getLastMessageId(): string | null {
        return this.chatManager.activeLeafId;
    }

    getTimelineNodes() { 
        // 核心修复：不再从 TimelineManager 获取缓存，而是实时从 store 获取
        const store = this.chatManager.store;
        return store.nodePool.reduce((acc: any, node) => {
            acc[node.id] = {
                ...node,
                text: node.mes || node.mesRaw || '',
                timestamp: node.extra?.send_date || Date.now()
            };
            return acc;
        }, {});
    }

    get activeLeafId() { return this.chatManager.store.activeLeafId; }

    async branchFromNode(targetNodeId: string): Promise<boolean> {
        // 1. 委托至 ChatManager 执行原子切换 (含 Pointer 切换、ST 同步、磁盘保存)
        const success = await this.chatManager.branchFromNode(targetNodeId);
        if (!success) return false;

        // 2. 数据重载与 UI 刷新
        // 核心架构重构：TimelineManager 会自动响应 WORLDLINE_SWITCHED/UPDATED 事件，无需手动同步。
        this.emit('WORLDLINE_SWITCHED', targetNodeId);
        this.emit('MESSAGE_RECEIVED');
        return true;
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
        const result = await this.branchFromNode(nodeId);
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
        const trace = await this.getChat();
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
    async rollbackFromNode(targetNodeId: string): Promise<boolean> {
        // 1. 委托至 ChatManager 执行原子回滚
        const success = await this.chatManager.rollbackFromNode(targetNodeId);
        if (!success) return false;

        console.log(`[LuminaWeave API] 执行物理级回滚 -> ${targetNodeId}`);

        // 2. 刷新状态
        // 核心架构重构：响应式驱动，无需手动同步。
        this.emit('WORLDLINE_ROLLED_BACK', targetNodeId);
        this.emit('MESSAGE_RECEIVED');
        return true;
    }

    async rollbackToIndex(index: number): Promise<boolean> {
        const trace = await this.getChat();
        if (index < 0 || index >= trace.length) return false;
        return this.rollbackFromNode(trace[index].id);
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
        const fn = typeof TavernHelper !== 'undefined' ? TavernHelper.formatAsTavernRegexedString : null;
        if (typeof fn === 'function') {
            return fn(text, source, destination, options);
        }
        return text;
    }

    getSTCore(): any {
        return (typeof SillyTavern !== 'undefined' ? SillyTavern : null) || (window as any).SillyTavern;
    }

    // 移除冗余事件方法，由基类提供

    applyCustomFont(): void {
        const rawFont = lwStorage.get('lumina-chat.fontFamily', 'sans-serif', 'Global');
        const font = rawFont.replace(/['"]/g, '').trim();

        // 1. 尝试通过 FontManager 加载远端字体资源
        if (this.fontManager) {
            this.fontManager.ensureFontLoaded(font);
        }

        let styleEl = document.getElementById('lw-custom-font-style');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'lw-custom-font-style';
            document.head.appendChild(styleEl);
        }
        const presetFonts: Record<string, string> = {
            'sans-serif': 'var(--lw-font-sans-serif)',
            'serif': 'var(--lw-font-serif)',
            'kaiti': 'var(--lw-font-kaiti)'
        };
        const fontValue = presetFonts[font] || `"${font}", sans-serif`;
        const weight = lwStorage.get('lumina-chat.fontWeight', 400, 'Global');
        styleEl.textContent = `:root { 
            --lw-font: ${fontValue} !important; 
            --lw-font-weight: ${weight} !important;
        }`;
    }

    /** 获取内置占位头像 */
    get DEFAULT_AVATAR(): string {
        return DEFAULT_AVATAR;
    }

    /** 获取当前角色名称 */
    getCharName(): string {
        return this.getAssistantName();
    }

    getAssistantName() {
        const ctx = this.ctx as any;
        const charId = ctx?.characterId;
        if (charId !== undefined && ctx?.characters && (ctx.characters as any)[Number(charId)]) {
            return (ctx.characters as any)[Number(charId)].name;
        }
        return ctx?.name2 || (typeof window !== 'undefined' ? (window as any).name2 : 'Assistant');
    }

    /** 获取当前用户名称 */
    getUserName(): string {
        const ctx = this.ctx as any;
        if (ctx && ctx.user?.name) return ctx.user.name;
        return ctx?.name1 || (typeof window !== 'undefined' ? (window as any).name1 : 'User');
    }

    getCharAvatar(name: string): string {
        if (!name) return DEFAULT_AVATAR;

        // 尝试使用传入的名称，如果没有则使用当前活跃角色名
        const targetName = name || this.getCharName();

        // 1. 优先尝试使用 TavernHelper 或 ST 原生提供的便捷路径 API
        const helper = typeof TavernHelper !== 'undefined' ? TavernHelper : null;
        const ctx = typeof SillyTavern !== 'undefined' ? SillyTavern : null;
        if (ctx && typeof (ctx as any).getCharAvatarPath === 'function') {
            const path = (ctx as any).getCharAvatarPath(targetName);
            if (path) return path;
        }
        if (helper && typeof (helper as any).getCharAvatarPath === 'function') {
            const path = (helper as any).getCharAvatarPath(targetName);
            if (path) return path;
        }

        // 2. 查找角色元数据
        const characters = this.ctx?.characters || window.characters || [];
        const searchName = targetName.toLowerCase().trim();

        const ch = characters.find((c: any) =>
            (c.name && c.name.toLowerCase().trim() === searchName) ||
            (c.original_name && c.original_name.toLowerCase().trim() === searchName)
        );

        if (!ch || !ch.avatar) return DEFAULT_AVATAR;

        // 3. 多级路径解析 Fallback

        // A. 优先使用 ST 最新缩略图协议 (推荐)
        if (typeof SillyTavern !== 'undefined' && typeof SillyTavern.getThumbnailUrl === 'function') {
            try {
                return SillyTavern.getThumbnailUrl('characters', ch.avatar);
            } catch (e) { }
        }

        // B. 处理标准物理路径
        if (ch.avatar.includes('.')) {
            return `/thumbnail?type=characters&file=${encodeURIComponent(ch.avatar)}`;
        }

        // C. 使用传统的 getCharacterAvatar API
        if (ch && ch.avatar) {
            if (typeof window !== 'undefined' && typeof (window as any).getCharacterAvatar === 'function') {
                let path = (window as any).getCharacterAvatar(ch.avatar);
                if (path) return path;
            }
        }

        return DEFAULT_AVATAR;
    }

    getUserAvatar(userName?: string): string {
        const ctx = this.ctx as any;

        // 尝试根据传入的名称动态寻找（ST 群聊/多用户场景）
        if (userName && ctx && Array.isArray(ctx.chat)) {
            // 在当前聊天记录中寻找最近一次该用户发言的头像信息
            const msg = ctx.chat.slice().reverse().find((m: any) => (m as any).is_user && (m as any).name === userName && (m as any).force_avatar) as any;
            if (msg && msg.force_avatar) {
                return msg.force_avatar.startsWith('http') || msg.force_avatar.startsWith('data:')
                    ? msg.force_avatar
                    : `/thumbnail?type=persona&file=${encodeURIComponent(msg.force_avatar)}`;
            }
        }

        const persona = (typeof window !== 'undefined' ? (window as any).user_avatar : null) || (this.ctx as any)?.user?.avatar || 'user-default.png';
        if (persona.startsWith('http') || persona.startsWith('data:')) return persona;

        const getThumbnailUrl = typeof SillyTavern !== 'undefined' ? SillyTavern.getThumbnailUrl : null;
        const hasThumbnailApi = typeof getThumbnailUrl === 'function';

        // 1. 优先使用 ST 最新缩略图协议 (推荐)
        if (hasThumbnailApi && getThumbnailUrl) {
            try {
                return getThumbnailUrl('persona', persona);
            } catch (e) {
                console.warn('[LuminaWeave] getThumbnailUrl failed:', e);
            }
        }

        // 2. 适配用户要求的格式 (物理路径转换 Fallback)
        if (persona.includes('.') || persona === 'user-default.png') {
            return `/thumbnail?type=persona&file=${encodeURIComponent(persona)}`;
        }

        // 3. 最终兜底
        if (!persona || persona === 'default.png') return DEFAULT_AVATAR;

        let path = persona;
        if (!path.startsWith('/') && !path.includes('://')) {
            path = '/' + path;
        }
        return path;
    }

    // --- 快照管理 ---
    getSnapshotNodes() {
        return this.chatManager.getSnapshotNodes();
    }

    async clearAllSnapshots() {
        return await this.chatManager.clearAllSnapshots();
    }

    showToast(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', title?: string, duration: number = 3000): void {
        console.log(`[LuminaWeave Toast] ${type.toUpperCase()}: ${message}`);
        // @ts-ignore
        if (typeof window.toastr !== 'undefined') {
            // @ts-ignore
            window.toastr[type](message, title, { timeOut: duration });
        }
    }

    /**
     * 显示全局确认弹窗 (异步)
     * 解决 Tauri/Android 环境下 window.confirm 不可用的问题
     */
    async confirm(opt: string | ModalOptions): Promise<boolean> {
        const modal = useModalStore();
        return await modal.confirm(opt);
    }
}

export const luminaWeaveApi = new LuminaWeaveAPI();
export type { TimelineNode, LuminaChatMessage };
export { SyncUtils, DiffVisualizer };
