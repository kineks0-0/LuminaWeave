/**
 * ForgeTestChatService
 *
 * 独立于制卡主流程的测试聊天服务。
 * - 使用 LuminaGenerationTask 直接调用后端，绕过 ForgeExecutionGateway（避免 Forge XML 解析）
 * - 使用 ForgeTestChatPromptBuilder 自合成提示词
 * - 预设持久化到 lwStorage（key: lumina-forge.testChatPresets）
 * - 消息仅存于内存，不写入 WorldlineStore / ChatManager / PersistenceService
 */

import { llmEngine } from '../../llmEngine.js';
import { lwStorage } from '../../storage.js';
import { LuminaGenerationTask } from '../generation/LuminaGenerationTask.js';
import { PromptPresetComposer } from '../hal/prompt/PromptPresetComposer.js';
import { promptPresetRegistry } from '../hal/prompt/PromptPresetRegistry.js';
import { buildSTPresetMessages } from './ForgeTestChatPromptBuilder.js';
import { getForgeTestChatHostPort } from './ForgeTestChatHostPort.js';
import { clonePromptPresetGenerationSettings } from '../utils/promptPresetGenerationSettings.js';
import {
    promptResourceResolver,
    PromptResourceBindingService,
    PromptResourceResolver,
    type PromptResourceBindingResolution,
    type PromptResourceBundle
} from '../hal/resource/index.js';
import type { CleanedMessage } from '../../../types/nexus.js';
import type { ResourceRef } from '@shared/resources/index.js';
import type { ForgeVirtualLorebookEntry } from '../../../types/SessionTypes.js';
import {
    type ForgeTestChatMessage,
} from '../../../types/ForgeTestChatTypes.js';
import type {
    PromptPresetCharCard,
    PromptPresetDefinition,
    PromptPresetGenerationSettings
} from '../../../types/PromptPresetTypes.js';
import type {
    ForgeModelRequestTrace,
    ForgeRequestContextSnapshot,
    ForgeRequestNodeSummaryItem
} from '../../../types/ForgeRuntimeTypes.js';

// ──────────────────────────────────────────────
// 存储 Key
// ──────────────────────────────────────────────

const STORAGE_KEY_REGISTRY = 'lumina-prompt-presets.registry';
const STORAGE_KEY_BINDINGS = 'lumina-prompt-presets.bindings';
const STORAGE_KEY_BUILTIN_OVERRIDES = 'lumina-prompt-presets.builtin-overrides';

// ──────────────────────────────────────────────
// 依赖注入接口
// ──────────────────────────────────────────────

export interface ForgeTestChatDeps {
    getVirtualLorebookEntries: () => ForgeVirtualLorebookEntry[];
    /** Nexus 编排预设 ID（非测试聊天自身预设），用于解析 LLM 节点 */
    getNexusPresetId: () => string;
    getWorkspaceTitle?: () => string;
    getWorkspaceSessionId?: () => string;
    getPromptResourceRefs?: () => ResourceRef[];
    getPromptResourceBindingResolution?: () => PromptResourceBindingResolution | null;
    createModelRequestTrace: (trace: ForgeModelRequestTrace) => void;
    markModelRequestFirstResponse: (requestId: string, firstResponseAt?: number) => void;
    updateModelRequestStream: (payload: {
        requestId: string;
        responseRaw: string;
        responseDisplay: string;
        responseThinking: string;
    }) => void;
    completeModelRequestTrace: (payload: {
        requestId: string;
        responseRaw: string;
        responseDisplay: string;
        responseThinking: string;
        completedAt?: number;
    }) => void;
    failModelRequestTrace: (requestId: string, message: string) => void;
    abortModelRequestTrace: (requestId: string) => void;
    setActiveModelRequestTrace: (requestId: string | null) => void;
}

// ──────────────────────────────────────────────
// 服务类
// ──────────────────────────────────────────────

export class ForgeTestChatService {
    // ── 消息列表（内存，不持久化）
    // 这里不能用 ref：该服务会挂到 Pinia store 上，实例被代理后 ref 会被自动解包，
    // 类方法里继续访问 .value 会把字符串/布尔/数组误当成 Ref 使用。
    readonly messages: ForgeTestChatMessage[] = [];
    isStreaming = false;

    // ── 预设管理
    readonly presets: PromptPresetDefinition[] = [];
    activePresetId = '';

    private readonly deps: ForgeTestChatDeps;
    /** 持有当前正在运行的任务引用，abort() 调用真正的后端中断 */
    private currentTask: LuminaGenerationTask | null = null;
    private currentTraceId: string | null = null;

    constructor(deps: ForgeTestChatDeps) {
        this.deps = deps;
        this._syncFromRegistry();
        lwStorage.on('*', this.handleStorageChange);
    }

    // ──────────────────────────────────────────────
    // 消息操作
    // ──────────────────────────────────────────────

    clearMessages(): void {
        this.messages.splice(0, this.messages.length);
    }

    /** 取消当前流式生成（真正的后端中断） */
    abort(): void {
        if (this.currentTask) {
            this.currentTask.abort();
            this.currentTask = null;
        }
        if (this.currentTraceId) {
            this.deps.abortModelRequestTrace(this.currentTraceId);
        }
        this.isStreaming = false;
        // 将最后一条 assistant 消息标记为非流式
        const msgs = this.messages;
        const last = msgs[msgs.length - 1];
        if (last?.role === 'assistant' && last.isStreaming) {
            msgs.splice(msgs.length - 1, 1, { ...last, isStreaming: false });
        }
        this.currentTraceId = null;
    }

    async sendMessage(userText: string): Promise<void> {
        if (this.isStreaming) return;
        const trimmed = userText.trim();
        if (!trimmed) return;

        // 每次发送前同步一次 registry，兼容设置面板热改。
        this._syncFromRegistry();

        // 追加用户消息
        this.messages.push({
            id: `ftc-u-${Date.now()}`,
            role: 'user',
            content: trimmed
        });

        // 追加空的 assistant 占位（流式占位）
        const assistantId = `ftc-a-${Date.now()}`;
        this.messages.push({
            id: assistantId,
            role: 'assistant',
            content: '',
            isStreaming: true
        });

        this.isStreaming = true;
        let requestTraceId: string | null = null;
        let hasMarkedFirstResponse = false;

        try {
            const preset = this._getActivePreset();
            // 对话历史：不含刚插入的空 assistant 占位
            const conversationHistory = this.messages
                .slice(0, -1)
                .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

            const virtualLorebookEntries = this.deps.getVirtualLorebookEntries();
            const resourceBindingResolution = this.deps.getPromptResourceBindingResolution?.() ?? null;
            const promptResourceRefs = resourceBindingResolution?.enabledRefs ?? this.deps.getPromptResourceRefs?.() ?? [];
            const excludedPromptResourceRefs = resourceBindingResolution?.excludedRefs ?? [];
            const resourceBundle = promptResourceRefs.length > 0
                ? await promptResourceResolver.resolve(promptResourceRefs)
                : null;

            let messages: CleanedMessage[];
            if (preset.engine === 'st_preset') {
                const stEngineResourceResolution = PromptResourceResolver.resolveSTEngineResources(promptResourceRefs);
                const stEngineResourceBundle = resourceBundle
                    ? PromptResourceResolver.filterBundleForSTEngine(resourceBundle)
                    : null;
                const diagnostics = [...stEngineResourceResolution.diagnostics];
                diagnostics.push(...PromptResourceBindingService.createSourceSelectionDiagnostics(excludedPromptResourceRefs));
                diagnostics.forEach(diagnostic => {
                    console.warn(`[ForgeTestChatService] ${diagnostic.code}: ${diagnostic.message}`);
                });
                const stPreset = await this._resolveSTPreset();
                if (!stPreset) {
                    throw new Error('无法获取 ST 当前预设，请确认 SillyTavern 已加载预设。');
                }
                messages = buildSTPresetMessages({
                    stPreset,
                    virtualLorebookEntries,
                    conversationHistory,
                    workspaceTitle: this.deps.getWorkspaceTitle?.(),
                    resourceBundle: stEngineResourceBundle ?? undefined,
                    host: {
                        ...getForgeTestChatHostPort().createPromptContext()
                    }
                });
            } else {
                messages = PromptPresetComposer.compose(
                    'forge-test-chat',
                    preset.id,
                    {
                        lorebookEntries: [
                            ...virtualLorebookEntries.map(entry => entry.entry),
                            ...(resourceBundle?.lorebookEntries ?? [])
                        ],
                        charCard: this.resolveCharCard(preset, resourceBundle ?? undefined),
                        conversationHistory,
                        resourceRefs: promptResourceRefs,
                        resourceDiagnostics: [
                            ...(resourceBundle?.diagnostics ?? []),
                            ...PromptResourceBindingService.createSourceSelectionDiagnostics(excludedPromptResourceRefs)
                        ],
                    }
                ).messages;
            }

            // 解析 LLM 节点（使用 Nexus 编排预设）
            const nexusPresetId = this.deps.getNexusPresetId();
            const presetId = nexusPresetId ||
                lwStorage.get('lumina-forge.nexusPreset', '', 'Global') ||
                lwStorage.get('lumina-chat.nexusPreset', 'Global', 'Global');
            const nodes = llmEngine.resolveNodesFromPreset(presetId);

            if (nodes.length === 0) {
                throw new Error('未找到可用的 LLM 节点配置，请在设置中检查 Nexus 编排预设。');
            }

            const chatId = `forge-test-${Date.now()}`;
            const charName = this.deps.getWorkspaceTitle?.() || 'Forge Test';

            const session = llmEngine.createSession({
                chatId,
                charName,
                parentId: null,
                nodes
            });

            const cleanedMessages = llmEngine.cleanMessages(messages);
            const generationSettings = await this._resolveGenerationSettings(preset.generationSettings);
            requestTraceId = this._createRequestTrace({
                userInput: trimmed,
                presetId: preset.id,
                nexusPresetId: presetId,
                conversationHistory,
                virtualLorebookEntries,
                requestPrompt: cleanedMessages,
                requestParameters: generationSettings,
                nodeSummary: this._buildNodeSummary(nodes)
            });
            this.currentTraceId = requestTraceId;
            const task = new LuminaGenerationTask(session);
            this.currentTask = task;

            await task.run(cleanedMessages, {
                onChunk: (_chunk, fullText) => {
                    this._updateAssistant(assistantId, fullText, true);
                    if (requestTraceId && !hasMarkedFirstResponse) {
                        hasMarkedFirstResponse = true;
                        this.deps.markModelRequestFirstResponse(requestTraceId, Date.now());
                    }
                    if (requestTraceId) {
                        this.deps.updateModelRequestStream({
                            requestId: requestTraceId,
                            responseRaw: fullText,
                            responseDisplay: fullText,
                            responseThinking: ''
                        });
                    }
                },
                onDone: (finalText) => {
                    this._updateAssistant(assistantId, finalText, false);
                    if (requestTraceId) {
                        this.deps.completeModelRequestTrace({
                            requestId: requestTraceId,
                            responseRaw: finalText,
                            responseDisplay: finalText,
                            responseThinking: '',
                            completedAt: Date.now()
                        });
                    }
                    this.isStreaming = false;
                    this.currentTask = null;
                    this.currentTraceId = null;
                },
                onError: (err) => {
                    this._updateAssistant(assistantId, `[错误] ${err.message}`, false);
                    if (requestTraceId) {
                        this.deps.failModelRequestTrace(requestTraceId, err.message);
                    }
                    this.isStreaming = false;
                    this.currentTask = null;
                    this.currentTraceId = null;
                }
            }, generationSettings);

            // task.run() 正常完成（onDone 回调可能已处理，此处兜底）
            const last = this.messages.find(m => m.id === assistantId);
            if (last?.isStreaming) {
                this._updateAssistant(assistantId, last.content, false);
            }
        } catch (err: any) {
            const last = this.messages.find(m => m.id === assistantId);
            this._updateAssistant(assistantId, last?.content || `[错误] ${err?.message ?? '生成失败'}`, false);
            if (requestTraceId) {
                this.deps.failModelRequestTrace(requestTraceId, err?.message ?? '生成失败');
            }
        } finally {
            this.isStreaming = false;
            this.currentTask = null;
            this.currentTraceId = null;
        }
    }

    // ──────────────────────────────────────────────
    // 预设 CRUD
    // ──────────────────────────────────────────────

    setActivePreset(id: string): void {
        const preset = this.presets.find(p => p.id === id);
        if (!preset) return;
        promptPresetRegistry.setActivePreset('forge-test-chat', id);
        this._syncFromRegistry();
    }

    // ──────────────────────────────────────────────
    // 私有工具
    // ──────────────────────────────────────────────

    private readonly handleStorageChange = (data: { key?: string } | null) => {
        const key = data?.key;
        if (!key || key === STORAGE_KEY_REGISTRY || key === STORAGE_KEY_BINDINGS || key === STORAGE_KEY_BUILTIN_OVERRIDES) {
            this._syncFromRegistry();
        }
    };

    private resolveCharCard(
        preset: PromptPresetDefinition,
        resourceBundle?: PromptResourceBundle
    ): PromptPresetCharCard | null {
        if (preset.charCardMode === 'none') {
            return null;
        }
        if (preset.charCardMode === 'custom') {
            return preset.customCharCard ?? null;
        }
        if (resourceBundle?.charCard) {
            return resourceBundle.charCard;
        }
        return getForgeTestChatHostPort().resolveCurrentCharCard();
    }

    private _getActivePreset(): PromptPresetDefinition {
        const found = this.presets.find(p => p.id === this.activePresetId);
        return found ?? promptPresetRegistry.getActivePreset('forge-test-chat');
    }

    private _updateAssistant(id: string, content: string, streaming: boolean): void {
        const idx = this.messages.findIndex(m => m.id === id);
        if (idx === -1) return;
        this.messages.splice(idx, 1, { ...this.messages[idx], content, isStreaming: streaming });
    }

    private _sanitizeSettings(settings: PromptPresetGenerationSettings): PromptPresetGenerationSettings {
        return clonePromptPresetGenerationSettings(settings);
    }

    private _applyUnlimitedResponseOverride(settings: PromptPresetGenerationSettings): PromptPresetGenerationSettings {
        const adjusted = clonePromptPresetGenerationSettings(settings);
        if (lwStorage.get('lumina-chat.unlimitedResponse', false, 'Global')) {
            delete adjusted.max_tokens;
            delete adjusted.max_length;
        }
        return adjusted;
    }

    private _createRequestTrace(input: {
        userInput: string;
        presetId: string;
        nexusPresetId: string;
        conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
        virtualLorebookEntries: ForgeVirtualLorebookEntry[];
        requestPrompt: CleanedMessage[];
        requestParameters: PromptPresetGenerationSettings;
        nodeSummary: ForgeRequestNodeSummaryItem[];
    }): string {
        const requestId = this._generateTraceId();
        const contextSnapshot: ForgeRequestContextSnapshot = {
            kind: 'forge-test-chat',
            workspaceTitle: this.deps.getWorkspaceTitle?.() || null,
            detailMode: null,
            activeLayer: null,
            sourceCommand: { type: 'send_user_input', input: input.userInput },
            workflowSnapshot: null,
            historyMessages: input.conversationHistory.map((message) => ({ ...message })),
            referenceChatSessionId: null,
            referenceChatSnapshotId: null,
            lorebookEntries: input.virtualLorebookEntries.map((entry) => ({
                id: entry.id,
                title: String((entry.entry as any)?.comment || (entry.entry as any)?.uid || entry.id),
                comment: String((entry.entry as any)?.comment || ''),
                keywords: Array.isArray((entry.entry as any)?.key)
                    ? (entry.entry as any).key.map((keyword: unknown) => String(keyword))
                    : [],
                disabled: Boolean((entry.entry as any)?.disable)
            })),
            memorySnapshot: null,
            selectedPresetId: null,
            testChatPresetId: input.presetId,
            nexusPresetId: input.nexusPresetId
        };

        this.deps.createModelRequestTrace({
            id: requestId,
            source: 'test_chat',
            status: 'queued',
            workspaceSessionId: this.deps.getWorkspaceSessionId?.() || 'forge_test_chat',
            requestPrompt: input.requestPrompt.map((message) => ({ ...message })),
            requestParameters: clonePromptPresetGenerationSettings(input.requestParameters),
            contextSnapshot,
            responseRaw: '',
            responseDisplay: '',
            responseThinking: '',
            requestedAt: Date.now(),
            firstResponseAt: null,
            completedAt: null,
            errorMessage: null,
            presetId: input.presetId,
            nodeSummary: input.nodeSummary.map((item) => ({ ...item }))
        });
        this.deps.setActiveModelRequestTrace(requestId);
        return requestId;
    }

    private _buildNodeSummary(nodes: Array<{ provider?: string; model?: string | null }>): ForgeRequestNodeSummaryItem[] {
        return nodes.map((node) => {
            const provider = String(node.provider || 'unknown');
            const model = typeof node.model === 'string' && node.model.trim() ? node.model.trim() : null;
            return {
                provider,
                model,
                label: provider === 'st_current'
                    ? '宿主当前模型'
                    : [provider, model].filter(Boolean).join(' / ')
            };
        });
    }

    private _generateTraceId(): string {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return `forge_req_${crypto.randomUUID()}`;
        }
        return `forge_req_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    }

    private async _resolveSTPreset(): Promise<Record<string, any> | null> {
        try {
            const preset = await getForgeTestChatHostPort().getPreset('in_use');
            if (preset && Array.isArray(preset.prompts)) {
                return preset as unknown as Record<string, any>;
            }
            return null;
        } catch {
            return null;
        }
    }

    private async _resolveGenerationSettings(
        presetSettings?: PromptPresetGenerationSettings | null
    ): Promise<PromptPresetGenerationSettings> {
        const inheritedSettings = await this._resolveMainChatGenerationSettings();
        return this._applyUnlimitedResponseOverride({
            ...inheritedSettings,
            ...clonePromptPresetGenerationSettings(presetSettings)
        });
    }

    private async _resolveMainChatGenerationSettings(): Promise<PromptPresetGenerationSettings> {
        const preset = await getForgeTestChatHostPort().getPreset('in_use');
        const presetSettings = this._cloneSettingsRecord(preset?.settings);
        const fallbackSettings = this._cloneSettingsRecord(getForgeTestChatHostPort().getInstructSettings()?.settings);
        return this._sanitizeSettings(Object.keys(presetSettings).length > 0 ? presetSettings : fallbackSettings);
    }

    private _cloneSettingsRecord(value: unknown): PromptPresetGenerationSettings {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return {};
        }
        return clonePromptPresetGenerationSettings(value as Record<string, unknown>);
    }

    private _syncFromRegistry(): void {
        promptPresetRegistry.reload();
        const presets = promptPresetRegistry.listPresets('forge-test-chat');
        this.presets.splice(0, this.presets.length, ...presets);
        this.activePresetId = promptPresetRegistry.getActivePresetId('forge-test-chat');
    }
}
