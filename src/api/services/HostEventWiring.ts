import { HOST_EVENT, getHostRuntimePort } from '../core/facade/HostRuntimePort.js';
import type { ChatManager } from '../core/conversation/ChatManager.js';
import type { StreamHandler } from '../core/generation/StreamHandler.js';
import type { PromptCommandService } from '../core/generation/PromptCommandService.js';
import type { GenerationCommandService } from '../core/generation/GenerationCommandService.js';
import type { ControlledChatCreationCoordinator } from '../core/conversation/ControlledChatCreationCoordinator.js';
import type { GenerationStreamState } from './GenerationDomainService.js';
import { getChatMessageMutationPort } from '../core/conversation/ChatMessageMutationPort.js';
import { lwStorage } from '../storage.js';

export type SyncFromOptions = {
    skipSave?: boolean;
    forceOverwrite?: boolean;
    skipIndependentLoad?: boolean;
    forceIndependentLoad?: boolean;
    resolveIntent?: 'st' | 'lumina';
};

/**
 * Facade 提供给宿主事件接线的窄接口：事件处理器只消费这些能力，
 * 不再直接持有整个 LuminaWeaveAPI。
 */
export interface HostEventWiringHost {
    readonly chatManager: ChatManager;
    readonly streamHandler: StreamHandler;
    readonly promptCommandService: PromptCommandService;
    readonly generationCommandService: GenerationCommandService;
    readonly controlledChatCreation: ControlledChatCreationCoordinator;
    lastStreamState: GenerationStreamState | null;
    readonly isGenerating: boolean;
    isReady(): boolean;
    syncFromST(options?: SyncFromOptions): Promise<void>;
    emit(event: string, ...args: unknown[]): void;
    shouldSuppressControlledChatCreationHostSync(reason: string, chatId: string | null): boolean;
}

/**
 * 宿主事件接线：DOM 生命周期监听（visibility/online/pagehide 等）与 ST 宿主事件
 * （聊天切换、生成开始/结束、流式 token、消息编辑等）到领域同步的统一入口。
 */
export class HostEventWiring {
    private _globalEventsInited = false;
    private _stEventsInited = false;
    private _stRawBuffer = '';
    private _isSyncing = false;
    private _manualAbortPending = false;
    private _lastGeneralChatLoadChatId: string | null = null;
    private _lastGeneralChatLoadAt = 0;
    private _chatChangedFallbackTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(private readonly host: HostEventWiringHost) {}

    setManualAbortPending(value: boolean): void {
        this._manualAbortPending = value;
    }

    initGlobalEvents(): void {
        if (this._globalEventsInited) return;

        // 核心增强：页面可见性变化时主动同步后端状态
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                const { chatId } = lwStorage._getContextIds();
                if (chatId) {
                    console.log(`[LuminaWeave] Tab became visible, syncing stream status for ${chatId}...`);
                    this.host.streamHandler.resumeToTerminal(chatId);
                }
            }
        });

        window.addEventListener('online', () => {
            const { chatId } = lwStorage._getContextIds();
            if (chatId) {
                this.host.streamHandler.resumeToTerminal(chatId);
            }
        });

        window.addEventListener('offline', () => {
            this.host.streamHandler.cancelResume();
        });

        window.addEventListener('pageshow', () => {
            const { chatId } = lwStorage._getContextIds();
            if (chatId) {
                this.host.streamHandler.resumeToTerminal(chatId);
            }
        });

        window.addEventListener('pagehide', () => {
            this.host.streamHandler.cancelResume();
        });

        this._globalEventsInited = true;
    }

    async initSTEvents(): Promise<void> {
        if (this._stEventsInited) return;

        // 核心修复：初始加载时物理重置生成锁定标志，防止“假死”
        if (this.host.chatManager && this.host.chatManager.sync) {
            this.host.chatManager.sync.isSTGenerating = false;
        }
        if (this.host.streamHandler) {
            this.host.streamHandler.isGenerating = false;
        }
        this._stRawBuffer = '';
        const { chatId } = lwStorage._getContextIds();

        // 初始同步一次后端状态
        if (chatId) {
            // 初始化时的状态同步失败
            this.host.streamHandler.resumeToTerminal(chatId).catch(e => console.warn('[LuminaWeave] 初始化流状态同步失败:', e));
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
            this.host.streamHandler.init();

            const handleGeneralChatLoad = async (reason: string) => {
                if (this.host.chatManager.sync.isAutoSyncPaused) {
                    console.debug('[LuminaWeave] 自动同步已暂停，忽略 general chat load');
                    return;
                }
                if (this._isSyncing || !this.host.isReady()) return; // 增加 !isReady 判定是为了防止初始化尚未完成时的外部监听同步

                const currentChatId = getChatMessageMutationPort().normalizeChatId(lwStorage._getContextIds().chatId);
                if (this.host.shouldSuppressControlledChatCreationHostSync(reason, currentChatId)) {
                    this.host.chatManager._stLoading = false;
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
                    this.host.chatManager._stLoading = false;
                    this._lastGeneralChatLoadChatId = currentChatId;
                    this._lastGeneralChatLoadAt = now;
                    await this.host.syncFromST();
                    this.host.emit('CHAT_CHANGED');
                } finally {
                    this._isSyncing = false;
                }
            };

            // CHAT_CHANGED 在主聊天切换时先于 CHAT_LOADED 触发；部分切换路径只发 CHAT_CHANGED，
            // 因此这里做一次去抖兜底加载。事件之后若已有成功发起的 general load，则兜底跳过。
            const scheduleChatChangedFallback = (changedAt: number, attempt: number = 0): void => {
                if (this._chatChangedFallbackTimer) {
                    clearTimeout(this._chatChangedFallbackTimer);
                }
                this._chatChangedFallbackTimer = setTimeout(() => {
                    this._chatChangedFallbackTimer = null;
                    if (!this.host.isReady()) return;
                    if (this._lastGeneralChatLoadAt >= changedAt) {
                        return;
                    }
                    if (this.host.chatManager.sync.isAutoSyncPaused || this._isSyncing) {
                        if (attempt < 6) {
                            scheduleChatChangedFallback(changedAt, attempt + 1);
                        } else {
                            console.warn('[LuminaWeave] CHAT_CHANGED 兜底加载放弃：同步持续被占用');
                        }
                        return;
                    }
                    void handleGeneralChatLoad('CHAT_CHANGED_FALLBACK');
                }, 300);
            };

            hostRuntime.on(HOST_EVENT.CHAT_CHANGED, () => {
                console.log('[LuminaWeave] detect chat_id_changed, preparing for reload...');
                this.host.chatManager._stLoading = true;
                scheduleChatChangedFallback(Date.now());
            });

            hostRuntime.on(HOST_EVENT.CHAT_LOADED, async () => {
                await handleGeneralChatLoad('CHAT_LOADED');
                const { chatId } = lwStorage._getContextIds();
                if (chatId) this.host.streamHandler.resumeToTerminal(chatId);
            });
            // 核心增强：监听新对话创建与删除事件
            hostRuntime.on(HOST_EVENT.CHAT_CREATED, () => {
                console.log('[LuminaWeave] detect chat_created');
                this.host.emit('CHAT_CREATED');
                handleGeneralChatLoad('CHAT_CREATED');
            });

            hostRuntime.on(HOST_EVENT.CHAT_DELETED, () => {
                console.log('[LuminaWeave] detect chat_deleted');
                this.host.emit('CHAT_DELETED');
                handleGeneralChatLoad('CHAT_DELETED'); // 删除后通常会载入一个空对话或另一个对话
            });

            hostRuntime.on(HOST_EVENT.MESSAGE_RECEIVED, async () => {
                handleIncrementalSync('MESSAGE_RECEIVED');
            });

            // --- 核心增强：监听官方提示词准备就绪事件 ---
            // 兼容性监听器：同时捕获多种可能的提示词准备事件
            const unifiedIntercept = (evtName: string, data: any, isDryRunArg: any = undefined) => {
                const candidate = this.host.promptCommandService.recordPromptCandidate(evtName, data, isDryRunArg);

                console.debug(`[LuminaWeave] [EVENT_TRACE] 监听到提示词候选 [${evtName}]: exists=${!!candidate.prompt}, isDryRun=${candidate.isDryRun}, isProbing=${this.host.promptCommandService.isProbing}`);

                if (candidate.shouldEmitPrompt) {
                    console.log(`[LuminaWeave] 成功从事件 ${evtName} 截获提示词负载:`, candidate.prompt);
                    this.host.emit('ST_PROMPT_INTERCEPTED', candidate.prompt);
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

                this.host.chatManager.sync.isSTGenerating = false;
                this._manualAbortPending = false;
                this._stRawBuffer = '';
                this.host.emit('ST_GENERATION_ENDED', data);

                // 核心修复：无论 Lumina 内部状态如何，只要监听到 ST 结束信号，就强制执行收尾
                // todo：注意，插件内部在生成时不走ST生成时应该无效
                // 这能有效防止因事件丢失或状态机异常导致的 UI 卡死
                const chatMessages = hostRuntime.getCurrentChatMessages();
                const lastMessage = chatMessages[chatMessages.length - 1] as any;
                if (lastMessage && !lastMessage.is_user) {
                    const finalText = lastMessage.mes || '';
                    await this.host.generationCommandService.finalizeGeneratedOutput(finalText);
                }

                // 核心修复：延迟 100ms 触发最终同步，确保 ST 本地数据库已写入完毕，然后发送结束信号
                setTimeout(async () => {
                    await this.host.syncFromST();
                    // 只有当是 ST 原生生成时才调用 handleEnd
                    if (!this.host.isGenerating) {
                        this.host.streamHandler.handleEnd();
                    }
                }, 100);
            });

            hostRuntime.on(HOST_EVENT.GENERATION_STARTED, (type: string, options: any, dryRun: boolean) => {
                if (this.host.promptCommandService.isProbing || dryRun) {
                    if (!this.host.promptCommandService.isProbing && dryRun && this.host.controlledChatCreation.shouldSuppressDryRunRestart()) {
                        console.debug('[LuminaWeave] 受控新建事务期间跳过重复 DryRun 重启');
                        return;
                    }
                    console.log(`[LuminaWeave] 监测到 ${this.host.promptCommandService.isProbing ? '探针' : 'DryRun'} 触发的 ST 开始生成，静默处理...`);
                    // 如果我们自己正在生成，不要去干扰 StreamHandler 的状态
                    if (!this.host.isGenerating) {
                        this.host.streamHandler.handleRestart({ silent: true });
                    }
                    return;
                }
                console.log('[LuminaWeave] 监测到 ST 开始生成，屏蔽自动同步...');
                this.host.chatManager.sync.isSTGenerating = true;
                this._stRawBuffer = '';
                this.host.lastStreamState = null; // 重置缓存
                // 同时也标记流式处理器开始工作，确保双向状态同步
                // 仅当非 Lumina 侧触发时才重置
                if (!this.host.isGenerating) {
                    this.host.streamHandler.handleRestart();
                }
                this.host.emit('GENERATION_STARTED');
            });

            hostRuntime.on(HOST_EVENT.GENERATION_STOPPED, () => {
                console.log('[LuminaWeave] 监测到 ST 停止生成，恢复自动同步并释放状态...');
                this.host.chatManager.sync.isSTGenerating = false;
                this._stRawBuffer = '';
                const wasManualAbort = this._manualAbortPending;
                this._manualAbortPending = false;
                setTimeout(async () => {
                    await handleIncrementalSync('ST_GENERATION_STOPPED');
                    if (!this.host.isGenerating) {
                        if (wasManualAbort) {
                            this.host.streamHandler.clearSmoothTimer();
                            this.host.emit('GENERATION_FAILED', '已停止生成', 'aborted');
                        } else {
                            this.host.streamHandler.handleEnd();
                        }
                    }
                }, 500);
            });

            // --- 核心增强：监听更多更新事件，实现增量同步 ---
            const handleIncrementalSync = async (reason: string) => {
                const syncService = this.host.chatManager.sync;
                if (syncService.isAutoSyncPaused) {
                    console.debug(`[LuminaWeave] 自动同步已暂停，忽略事件: ${reason}`);
                    return;
                }

                const currentChatId = getChatMessageMutationPort().normalizeChatId(lwStorage._getContextIds().chatId);
                if (this.host.shouldSuppressControlledChatCreationHostSync(reason, currentChatId)) {
                    return;
                }

                // 核心修复：防止初始化过程中 ST 事件触发增量同步导致竞态条件
                if (!this.host.isReady()) {
                    console.debug(`[LuminaWeave] 初始化尚未完成，忽略增量同步事件: ${reason}`);
                    return;
                }

                // 核心修复：如果在生成过程中 (无论是 ST 侧还是 Lumina 侧)，跳过由 MESSAGE_UPDATED 触发的同步。
                // 因为流式过程中 handleStreamToken 已经通过 StreamHandler 接管了 UI 预览，
                // 此时频繁调用 syncFromST 会导致 UI 整个列表不断重新渲染渲染。
                if ((this.host.isGenerating || syncService.isSTGenerating)) {
                    if (reason === 'MESSAGE_UPDATED' || reason === 'MESSAGE_RECEIVED') {
                        return;
                    }
                }

                if (this._isSyncing) return;

                // 核心修复：安全守卫 (SafetyGuard)
                // 仅在 ST 原生生成模式下 (`isSTGenerating`) 检查全局标志位。
                // 如果是 Lumina Nexus 模式 (`isGenerating` 为 true 但 `isSTGenerating` 为 false),
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
                            this.host.chatManager.sync.isSTGenerating = false;
                            this.host.streamHandler.handleEnd();
                        }
                    }, 200);
                    return;
                }

                this._isSyncing = true;
                try {
                    console.log(`[LuminaWeave] 由事件驱动触发同步: ${reason}`);
                    await this.host.syncFromST();
                } finally {
                    this._isSyncing = false;
                }
            };

            // 核心增强：监听流式 Token 接收，支持同步显示 ST 原生生成状态线
            const handleStreamToken = (capturedText: string) => {
                // 仅在 ST 正在原生生成（且 Lumina 本地未在生成）时执行同步，防止冲突
                if (this.host.chatManager.sync.isSTGenerating && !this.host.isGenerating) {

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
                    const lastLen = this.host.streamHandler.responseBuffer.length;
                    const rawDelta = this._stRawBuffer.startsWith(this.host.streamHandler.responseBuffer)
                        ? this._stRawBuffer.substring(lastLen)
                        : this._stRawBuffer;

                    if (rawDelta.length > 0 || this._stRawBuffer !== this.host.streamHandler.responseBuffer) {
                        this.host.streamHandler.handleChunk(rawDelta, this._stRawBuffer);
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
}
