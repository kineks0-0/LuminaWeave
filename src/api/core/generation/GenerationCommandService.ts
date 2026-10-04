import { pluginManager } from '../../../core/PluginManager.js';
import { llmEngine } from '../../llmEngine.js';
import { lwStorage } from '../../storage.js';
import type { SendMessageOptions } from '../../services/GenerationDomainService.js';
import { PromptAssemblyRouter } from '../hal/prompt/PromptAssemblyRouter.js';
import { NexusClient } from '../hal/network/NexusClient.js';
import { getHostRuntimePort } from '../facade/HostRuntimePort.js';
import { globalMemoryManager } from '../runtime-utils/MemoryManager.js';
import { globalXMLInterceptor } from '../xml-view/XMLInterceptor.js';
import type { ChatManager } from '../conversation/ChatManager.js';
import type { StreamHandler } from './StreamHandler.js';
import type { LuminaChatMessage } from '@shared/LuminaMessage.js';
import type { CleanedMessage } from '../../../types/nexus.js';
import { GenerationSession } from './GenerationSession.js';
import { LuminaGenerationTask } from './LuminaGenerationTask.js';
import type { PromptCommandService } from './PromptCommandService.js';
import type { GenerationStreamState } from '../../services/GenerationDomainService.js';
import {
    injectCharacterPromptMessages,
    type CharacterPromptInjectionResult
} from '../hal/prompt/CharacterPromptInjection.js';
import { promptResourceResolver } from '../hal/resource/index.js';
import {
    buildSourceResourcePath,
    characterBookToLorebookEntries,
    type ResourceRef
} from '@shared/resources/index.js';

export interface GenerationCommandServiceDependencies {
    chatManager: ChatManager;
    streamHandler: StreamHandler;
    promptCommandService: PromptCommandService;
    waitForReady(): Promise<boolean>;
    beforeGenerationStart(input: { chatId: string | null; chatType: string; text: string }): Promise<void>;
    crudChatRecord(target: number | string, action: 'edit' | 'add' | 'delete', newText?: string, meta?: any): Promise<boolean>;
    getAssistantName(): string;
    getCharName(): string;
    getUserName(): string;
    getLastMessageId(): string | null;
    getConversationMessages(): Promise<LuminaChatMessage[]>;
    commitToST(): Promise<void>;
    syncFromST(options?: any): Promise<void>;
    emit(event: string, ...args: any[]): void;
    getLastStreamState(): GenerationStreamState | null;
    setManualAbortPending(value: boolean): void;
}

export class GenerationCommandService {
    private readonly chatManager: ChatManager;
    private readonly streamHandler: StreamHandler;
    private readonly promptCommandService: PromptCommandService;
    private readonly waitForReady: () => Promise<boolean>;
    private readonly beforeGenerationStart: GenerationCommandServiceDependencies['beforeGenerationStart'];
    private readonly crudChatRecord: GenerationCommandServiceDependencies['crudChatRecord'];
    private readonly getAssistantName: () => string;
    private readonly getCharName: () => string;
    private readonly getUserName: () => string;
    private readonly getLastMessageId: () => string | null;
    private readonly getConversationMessages: () => Promise<LuminaChatMessage[]>;
    private readonly commitToST: () => Promise<void>;
    private readonly syncFromST: (options?: any) => Promise<void>;
    private readonly emit: (event: string, ...args: any[]) => void;
    private readonly getLastStreamState: () => GenerationStreamState | null;
    private readonly setManualAbortPending: (value: boolean) => void;
    private session: GenerationSession | null = null;
    private currentTask: LuminaGenerationTask | null = null;
    private nexus = new NexusClient();
    private abortController: AbortController | null = null;

    constructor(dependencies: GenerationCommandServiceDependencies) {
        this.chatManager = dependencies.chatManager;
        this.streamHandler = dependencies.streamHandler;
        this.promptCommandService = dependencies.promptCommandService;
        this.waitForReady = dependencies.waitForReady;
        this.beforeGenerationStart = dependencies.beforeGenerationStart;
        this.crudChatRecord = dependencies.crudChatRecord;
        this.getAssistantName = dependencies.getAssistantName;
        this.getCharName = dependencies.getCharName;
        this.getUserName = dependencies.getUserName;
        this.getLastMessageId = dependencies.getLastMessageId;
        this.getConversationMessages = dependencies.getConversationMessages;
        this.commitToST = dependencies.commitToST;
        this.syncFromST = dependencies.syncFromST;
        this.emit = dependencies.emit;
        this.getLastStreamState = dependencies.getLastStreamState;
        this.setManualAbortPending = dependencies.setManualAbortPending;
    }

    get generateAbortController(): AbortController | null {
        return this.abortController;
    }

    set generateAbortController(controller: AbortController | null) {
        this.abortController = controller;
    }

    async sendMessage(text: string, options: SendMessageOptions = {}): Promise<boolean> {
        await this.waitForReady();
        const { chatId } = lwStorage._getContextIds();
        const success = await this.crudChatRecord(-1, 'add', text, { is_user: true });
        if (!success) return false;

        const chatType = options.chatType || 'st';
        await this.beforeGenerationStart({
            chatId,
            chatType,
            text
        });

        const chatPresetId = lwStorage.get('lumina-chat.nexusPreset', '', 'Global');
        const presets = lwStorage.get('nexus.presets', [], 'Global');
        const targetPreset = presets.find((preset: any) => preset.id === chatPresetId);
        const firstNode = targetPreset?.nodes?.[0];
        const stNativeAvailable = Boolean(await getHostRuntimePort().getHostFunction('generate'));
        const defaultEngine = stNativeAvailable
            ? (!firstNode || firstNode.provider === 'st_current' ? 'st-native' : 'lumina')
            : 'lumina-assembly';
        const promptRoute = PromptAssemblyRouter.route({
            target: 'chat.continuation',
            sessionBinding: options.promptAssembly?.sessionBinding ?? (
                chatType === 'st'
                    ? {
                        kind: 'st-chat',
                        chatId: chatId || '',
                        conversationId: chatId || undefined,
                        sourceId: 'chat'
                    }
                    : {
                        kind: 'plugin-session',
                        sessionId: chatId || 'plugin-chat',
                        conversationId: chatId || undefined,
                        sourceId: 'chat'
                    }
            ),
            policy: {
                engine: options.promptAssembly?.engine ?? defaultEngine,
                sourceMode: options.promptAssembly?.sourceMode ?? 'bound-session'
            },
            presetId: chatPresetId || undefined,
            inputs: { text }
        });
        promptRoute.diagnostics.forEach(diagnostic => {
            const log = diagnostic.level === 'error' ? console.error : diagnostic.level === 'warning' ? console.warn : console.info;
            log(`[LuminaWeave] [PromptAssemblyRouter] ${diagnostic.code}: ${diagnostic.message}`);
        });

        if (promptRoute.engine === 'st-native') {
            console.log('[LuminaWeave] [MainAPI] 检测到原生节点或空预设，执行原生电路回退...');
            this.streamHandler.handleRestart();
            this.emit('GENERATION_STARTED');
            return this.triggerGenerate();
        }

        const prompt = promptRoute.requestedEngine === 'lumina-assembly'
            ? await this.assembleLuminaPromptPayload()
            : await this.promptCommandService.probePrompt();
        if (!prompt) {
            console.warn('[LuminaWeave] 无法获取刺探提示词，回退至原生 ST 生成电路');
            return this.triggerGenerate();
        }

        const nodes = llmEngine.resolveNodesFromPreset(chatPresetId);

        this.streamHandler.handleRestart();
        this.session = llmEngine.createSession({
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

        const task = new LuminaGenerationTask(this.session);
        this.currentTask = task;

        try {
            await task.run(finalMessages, {
                onChunk: (_chunk: string, fullText: string) => {
                    const lastRawLen = this.streamHandler.responseBuffer.length;
                    const rawDelta = fullText.startsWith(this.streamHandler.responseBuffer)
                        ? fullText.substring(lastRawLen)
                        : fullText;

                    this.streamHandler.handleChunk(rawDelta, fullText);
                },
                onDone: async () => {
                    if (this.session && !this.session.committedInfo) {
                        this.emitSyncingStatus('等待后端确认事务...');
                    }
                    this.streamHandler.handleEnd({ stayActive: true });
                    await this.finalizeGeneration();
                },
                onBackendCommitted: async (info) => {
                    if (this.session) {
                        this.session.committedInfo = info;
                    }
                    await this.finalizeGeneration();
                },
                onActivity: () => {
                    this.streamHandler.notifyActivity();
                },
                onError: (err: any) => {
                    const isAbort = err?.name === 'AbortError' || err?.message?.includes('aborted');
                    if (isAbort) {
                        console.log('[LuminaWeave] 流式信道由于 Abort 断开，等待同步或看门狗恢复...');
                        return;
                    }

                    const errorMessage = err?.message || '后端生成失败';
                    this.streamHandler.isGenerating = false;
                    this.streamHandler.clearSmoothTimer();
                    this.emit('GENERATION_FAILED', errorMessage, 'error');
                    this.abortController = null;

                    if (this.session) {
                        this.session = null;
                    }
                    console.error('[LuminaWeave] LLM Engine 链路异常:', err);
                }
            }, generationSettings);
        } catch (error) {
            this.streamHandler.isGenerating = false;
            this.streamHandler.clearSmoothTimer();
            this.emit('GENERATION_FAILED', (error as any)?.message || '发送失败', 'error');
            this.session = null;
            console.error('[LuminaWeave] 发送异常:', error);
        }

        return true;
    }

    async triggerGenerate(): Promise<boolean> {
        const generate = await getHostRuntimePort().getHostFunction('generate');
        if (generate) {
            try {
                await generate();
                return true;
            } catch (error) {
                const message = (error as any)?.message || '触发 ST 生成失败';
                this.streamHandler.isGenerating = false;
                this.streamHandler.clearSmoothTimer();
                this.emit('GENERATION_FAILED', message, 'error');
                console.error('[LuminaWeave] ST generate 调用失败:', error);
                return false;
            }
        }

        this.streamHandler.isGenerating = false;
        this.streamHandler.clearSmoothTimer();
        this.emit('GENERATION_FAILED', '未找到 ST generate 方法：请检查是否在 SillyTavern 环境中运行，或切换到 Nexus 预设生成。', 'error');
        console.warn('[LuminaWeave] 找不到有效的 ST generate 方法');
        return false;
    }

    async regenerateLast(): Promise<unknown> {
        const regenerate = await getHostRuntimePort().getHostFunction('regenerate');
        if (regenerate) return regenerate();

        const slash = await getHostRuntimePort().getHostFunction('executeSlashCommandsWithOptions');
        if (slash) return slash('/regenerate');

        console.warn('[LuminaWeave] 找不到有效的 ST regenerate 方法');
        return undefined;
    }

    async runEditedPrompt(customPayload: string): Promise<void> {
        const chatPresetId = lwStorage.get('lumina-chat.nexusPreset', 'Global', 'Global');

        this.streamHandler.handleRestart();
        this.abortController = new AbortController();
        this.emit('GENERATION_STARTED');

        const nodes = llmEngine.resolveNodesFromPreset(chatPresetId);
        const session = llmEngine.createSession({
            chatId: lwStorage._getContextIds().chatId || '',
            charName: this.getCharName(),
            parentId: this.getLastMessageId(),
            nodes
        });

        const task = new LuminaGenerationTask(session);
        this.currentTask = task;

        await task.run(llmEngine.cleanMessages([{ role: 'user', content: customPayload }]), {
            onChunk: (_chunk: string, fullText: string) => {
                const lastRawLen = this.streamHandler.responseBuffer.length;
                const rawDelta = fullText.substring(lastRawLen);
                this.streamHandler.handleChunk(rawDelta, fullText);
            },
            onDone: async (finalText: string) => {
                this.streamHandler.handleEnd();
                this.currentTask = null;

                const chat = await this.getConversationMessages();
                const chatIndex = chat.length;
                await this.crudChatRecord(chatIndex, 'add', finalText, {
                    is_user: false,
                    name: this.getCharName()
                });

                await this.commitToST();
            },
            onError: () => {
                this.streamHandler.handleEnd();
                this.abortController = null;
            }
        });
    }

    private async assembleLuminaPromptPayload(): Promise<{ messages: CleanedMessage[]; settings: Record<string, unknown>; trace: any[] }> {
        const messages = await this.getConversationMessages();
        const payloadMessages = messages
            .filter(message => !message.is_hidden)
            .map(message => ({
                role: this.normalizePromptRole(message),
                content: message.mesST || message.mesRaw || message.mes || ''
            }))
            .filter(message => message.content.trim().length > 0);

        const injection = await this.resolveLocalCharacterPromptInjection(payloadMessages);
        const finalMessages = injection?.messages ?? payloadMessages;
        const historyTrace = messages.map((message, index) => ({
            sourceUnitId: message.id,
            sourceKind: 'history',
            label: message.name || message.role || `message-${index}`,
            outputMessageIndex: finalMessages.findIndex(item => item.content === (message.mesST || message.mesRaw || message.mes || '')),
            rawLength: (message.pluginRaw || message.mesRaw || message.mes || '').length,
            finalLength: (message.mesST || message.mesRaw || message.mes || '').length
        }));

        const payload = {
            messages: finalMessages,
            settings: {},
            trace: [...historyTrace, ...(injection?.trace ?? [])]
        };

        this.promptCommandService.lastPromptPayload = payload;
        this.emit('LUMINA_PROMPT_BUILT', payload.messages);
        return payload;
    }

    /**
     * 独立模式下当前会话绑定本地角色资源时，注入 persona、角色卡与卡内 character_book。
     * ST 数字角色 id 无法命中本地资源，因此 ST 宿主路径行为不变。
     */
    private async resolveLocalCharacterPromptInjection(
        messages: CleanedMessage[]
    ): Promise<CharacterPromptInjectionResult | null> {
        const { chatId, charId } = lwStorage._getContextIds();
        const resourceId = typeof charId === 'string' ? charId : String(charId ?? '');
        if (!chatId || !resourceId || resourceId === 'Global') return null;

        try {
            const ref: ResourceRef = {
                sourceId: 'local',
                resourceType: 'character',
                resourceId,
                path: buildSourceResourcePath('local', 'character', resourceId),
                writable: true
            };
            const bundle = await promptResourceResolver.resolve([ref]);
            if (!bundle.charCard) return null;

            const personaDescription = lwStorage.get('lumina-chat.personaDescription', '', 'Global');
            const characterDocument = bundle.documents.find(document => document.ref.resourceType === 'character');

            return injectCharacterPromptMessages({
                messages,
                charCard: bundle.charCard,
                personaDescription: typeof personaDescription === 'string' ? personaDescription : '',
                worldbookEntries: characterDocument ? characterBookToLorebookEntries(characterDocument.raw) : [],
                userName: this.getUserName(),
                charName: bundle.charCard.name || this.getAssistantName()
            });
        } catch (error) {
            console.warn('[LuminaWeave] 本地角色提示注入失败，按纯历史生成。', error);
            return null;
        }
    }

    private normalizePromptRole(message: LuminaChatMessage): 'system' | 'user' | 'assistant' {
        if (message.role === 'system' || message.role === 'user' || message.role === 'assistant') {
            return message.role;
        }
        return message.is_user ? 'user' : 'assistant';
    }

    async abortGenerate(): Promise<unknown> {
        this.setManualAbortPending(true);
        this.streamHandler.isGenerating = false;

        if (this.currentTask) {
            console.log('[LuminaWeave] 触发正在运行的任务中止...');
            this.currentTask.abort();
            this.currentTask = null;
        }

        if (this.abortController) {
            console.log('[LuminaWeave] 正在发出本地中断信号...');
            this.abortController.abort();
            this.abortController = null;
        }

        const { chatId } = lwStorage._getContextIds();
        if (chatId) {
            this.nexus.stopGeneration(chatId);
        }

        const stop = (await getHostRuntimePort().getHostFunction('stopGeneration'))
            || (await getHostRuntimePort().getHostFunction('stopGenerating'));
        if (stop) {
            console.log('[LuminaWeave] 触发原生 ST 停止指令...');
            const ret = await stop();
            setTimeout(async () => {
                await this.syncFromST({ skipSave: true, skipIndependentLoad: true });
                if (!this.streamHandler.isGenerating) {
                    this.streamHandler.clearSmoothTimer();
                    this.emit('GENERATION_FAILED', '已停止生成', 'aborted');
                }
            }, 250);
            return ret;
        }

        this.streamHandler.clearSmoothTimer();
        this.emit('GENERATION_FAILED', '已停止生成', 'aborted');
        console.warn('[LuminaWeave] 找不到有效的 ST 停止方法');
        return undefined;
    }

    handleStreamGenerationEnded(finalText: string): void {
        if (this.session) {
            this.session.finalText = finalText;
            void this.finalizeGeneration();
        }
    }

    async handleTransactionCommitted(info: { lastTransactionId: string; activeLeafId?: string | null; generationId?: string | null }): Promise<void> {
        if (this.session) {
            this.session.committedInfo = info;
            await this.finalizeGeneration();
            return;
        }

        const { chatId: currentChatId } = lwStorage._getContextIds();
        const persistence = this.chatManager.persistence;
        const localTxId = persistence.getIntegratedTxId(currentChatId);

        if (info.lastTransactionId && localTxId !== info.lastTransactionId) {
            console.log(`[LuminaWeave] [Fallback] 检测到本地事务 ID (${localTxId}) 后置于后端 (${info.lastTransactionId})，触发无状态同步...`);
            await this.syncFromST({ forceIndependentLoad: true });
        }
    }

    private emitSyncingStatus(text: string): void {
        const last = this.getLastStreamState();
        if (!last) return;
        this.emit('BUFFER_UPDATED', last.processed, last.text, last.filteredCount, text, last.thinkingText ?? '', '');
    }

    async finalizeGeneratedOutput(rawFinalText: string): Promise<string> {
        const cleanedFinalText = globalXMLInterceptor.processAndCleanText(rawFinalText || '', true);

        if (this.chatManager.activeLeafId) {
            const activeNode = this.chatManager.store.getNode(this.chatManager.activeLeafId);
            if (activeNode) {
                globalMemoryManager.commitDeltas(activeNode);
                await this.commitToST();
            }
        }

        pluginManager.callHooks('onGenerationEnded', cleanedFinalText);
        return cleanedFinalText;
    }

    private async finalizeGeneration(): Promise<void> {
        const session = this.session;
        if (!session || session.isFinalizing) return;

        if (!session.canFinalize()) {
            console.log('[LuminaWeave] 等待收口条件满足...', {
                hasText: Boolean(session.finalText),
                hasCommit: Boolean(session.committedInfo),
                txId: session.committedInfo?.lastTransactionId || 'pending'
            });
            return;
        }

        session.isFinalizing = true;
        const { chatId: currentChatId } = lwStorage._getContextIds();
        this.emitSyncingStatus('同步对话中...');
        console.log('[LuminaWeave] 收口条件满足，开始同步对话数据。事务 ID:', session.committedInfo!.lastTransactionId);

        if (session.committedInfo!.activeLeafId) {
            console.log('[LuminaWeave] 更新当前活跃节点:', session.committedInfo!.activeLeafId);
            this.chatManager.activeLeafId = session.committedInfo!.activeLeafId;
        }

        try {
            const persistenceService = this.chatManager.persistence;
            const info = session.committedInfo!;

            if (info.node && typeof info.seq === 'number') {
                console.log('[LuminaWeave] [AtomicSync] 接收到后端增量推送，执行静默对齐。');
                this.chatManager.store.upsertNode(info.node, { silent: true, source: 'backend' });

                if (info.activeLeafId) {
                    this.chatManager.activeLeafId = info.activeLeafId;
                }

                await persistenceService.persistLastCommittedSeq(currentChatId, info.seq);
                persistenceService.setIntegratedTxId(currentChatId, info.lastTransactionId);

                console.log('[LuminaWeave] [AtomicSync] 增量落地成功。');
            } else {
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
        } catch (error) {
            console.error('[LuminaWeave] 同步对话数据失败:', error);
        } finally {
            session.isFinalizing = false;

            await this.finalizeGeneratedOutput(session.finalText || '');

            this.streamHandler.finishSync();
            this.abortController = null;

            if (this.session === session) {
                this.session = null;
            }
            console.log('[LuminaWeave] 生成收口完成。');
        }
    }
}
