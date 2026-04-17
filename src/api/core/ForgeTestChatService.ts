/**
 * ForgeTestChatService
 *
 * 独立于制卡主流程的测试聊天服务。
 * - 使用 LuminaGenerationTask 直接调用后端，绕过 ForgeExecutionGateway（避免 Forge XML 解析）
 * - 使用 ForgeTestChatPromptBuilder 自合成提示词
 * - 预设持久化到 lwStorage（key: lumina-forge.testChatPresets）
 * - 消息仅存于内存，不写入 WorldlineStore / ChatManager / PersistenceService
 */

import { llmEngine } from '../llmEngine.js';
import { lwStorage } from '../storage.js';
import { LuminaGenerationTask } from './LuminaGenerationTask.js';
import { buildTestChatMessages, buildSTPresetMessages } from './ForgeTestChatPromptBuilder.js';
import { STClient } from './st-adapter/STClient.js';
import type { CleanedMessage } from '../../types/nexus.js';
import type { ForgeVirtualLorebookEntry } from '../../types/SessionTypes.js';
import {
    createBuiltInPresets,
    type ForgeTestChatMessage,
    type ForgeTestChatPreset
} from '../../types/ForgeTestChatTypes.js';

// ──────────────────────────────────────────────
// 存储 Key
// ──────────────────────────────────────────────

const STORAGE_KEY_PRESETS = 'lumina-forge.testChatPresets';
const STORAGE_KEY_ACTIVE_PRESET = 'lumina-forge.testChatActivePreset';

// ──────────────────────────────────────────────
// 依赖注入接口
// ──────────────────────────────────────────────

export interface ForgeTestChatDeps {
    getVirtualLorebookEntries: () => ForgeVirtualLorebookEntry[];
    /** Nexus 编排预设 ID（非测试聊天自身预设），用于解析 LLM 节点 */
    getNexusPresetId: () => string;
    getWorkspaceTitle?: () => string;
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
    readonly presets: ForgeTestChatPreset[] = [];
    activePresetId = '';

    private readonly deps: ForgeTestChatDeps;
    /** 持有当前正在运行的任务引用，abort() 调用真正的后端中断 */
    private currentTask: LuminaGenerationTask | null = null;

    constructor(deps: ForgeTestChatDeps) {
        this.deps = deps;
        this._loadPresets();
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
        this.isStreaming = false;
        // 将最后一条 assistant 消息标记为非流式
        const msgs = this.messages;
        const last = msgs[msgs.length - 1];
        if (last?.role === 'assistant' && last.isStreaming) {
            msgs.splice(msgs.length - 1, 1, { ...last, isStreaming: false });
        }
    }

    async sendMessage(userText: string): Promise<void> {
        if (this.isStreaming) return;
        const trimmed = userText.trim();
        if (!trimmed) return;

        // 每次发送前从 storage 刷新预设（兼容设置面板修改后未重启的场景）
        this._loadPresets();

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

        try {
            const preset = this._getActivePreset();
            // 对话历史：不含刚插入的空 assistant 占位
            const conversationHistory = this.messages
                .slice(0, -1)
                .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

            const virtualLorebookEntries = this.deps.getVirtualLorebookEntries();

            let messages: CleanedMessage[];
            if (preset.promptMode === 'st_preset') {
                const stPreset = await this._resolveSTPreset();
                if (!stPreset) {
                    throw new Error('无法获取 ST 当前预设，请确认 SillyTavern 已加载预设。');
                }
                messages = buildSTPresetMessages({
                    stPreset,
                    virtualLorebookEntries,
                    conversationHistory,
                    workspaceTitle: this.deps.getWorkspaceTitle?.()
                });
            } else {
                messages = buildTestChatMessages({
                    preset,
                    virtualLorebookEntries,
                    conversationHistory,
                    workspaceTitle: this.deps.getWorkspaceTitle?.()
                });
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
            const generationSettings = await this._resolveMainChatGenerationSettings();
            const task = new LuminaGenerationTask(session);
            this.currentTask = task;

            await task.run(cleanedMessages, {
                onChunk: (_chunk, fullText) => {
                    this._updateAssistant(assistantId, fullText, true);
                },
                onDone: (finalText) => {
                    this._updateAssistant(assistantId, finalText, false);
                    this.isStreaming = false;
                    this.currentTask = null;
                },
                onError: (err) => {
                    this._updateAssistant(assistantId, `[错误] ${err.message}`, false);
                    this.isStreaming = false;
                    this.currentTask = null;
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
        } finally {
            this.isStreaming = false;
            this.currentTask = null;
        }
    }

    // ──────────────────────────────────────────────
    // 预设 CRUD
    // ──────────────────────────────────────────────

    setActivePreset(id: string): void {
        const preset = this.presets.find(p => p.id === id);
        if (!preset) return;
        this.activePresetId = id;
        lwStorage.set(STORAGE_KEY_ACTIVE_PRESET, id, 'Global');
    }

    createPreset(partial: Pick<ForgeTestChatPreset, 'name' | 'charCardMode' | 'promptMode' | 'promptEntries'> & Partial<ForgeTestChatPreset>): ForgeTestChatPreset {
        const now = Date.now();
        const preset: ForgeTestChatPreset = {
            ...partial,
            id: `user:${now}`,
            createdAt: now,
            updatedAt: now
        };
        this.presets.push(preset);
        this._persistPresets();
        return preset;
    }

    updatePreset(id: string, changes: Partial<Omit<ForgeTestChatPreset, 'id' | 'builtIn' | 'createdAt'>>): void {
        const idx = this.presets.findIndex(p => p.id === id);
        if (idx === -1) return;
        const existing = this.presets[idx];
        if (existing.builtIn) return; // 内置预设不可修改
        this.presets.splice(idx, 1, { ...existing, ...changes, updatedAt: Date.now() });
        this._persistPresets();
    }

    deletePreset(id: string): void {
        const preset = this.presets.find(p => p.id === id);
        if (!preset || preset.builtIn) return;
        const idx = this.presets.findIndex(p => p.id === id);
        if (idx !== -1) {
            this.presets.splice(idx, 1);
        }
        // 若删除的是当前激活预设，回退到第一个
        if (this.activePresetId === id) {
            this.setActivePreset(this.presets[0]?.id ?? '');
        }
        this._persistPresets();
    }

    // ──────────────────────────────────────────────
    // 私有工具
    // ──────────────────────────────────────────────

    private _getActivePreset(): ForgeTestChatPreset {
        const found = this.presets.find(p => p.id === this.activePresetId);
        return found ?? this.presets[0] ?? createBuiltInPresets()[0];
    }

    private _updateAssistant(id: string, content: string, streaming: boolean): void {
        const idx = this.messages.findIndex(m => m.id === id);
        if (idx === -1) return;
        this.messages.splice(idx, 1, { ...this.messages[idx], content, isStreaming: streaming });
    }

    private _sanitizeSettings(settings: Record<string, unknown>): Record<string, unknown> {
        const sanitized = { ...settings };
        if (typeof sanitized.seed === 'number' && sanitized.seed < 0) {
            delete sanitized.seed;
        }
        return sanitized;
    }

    private async _resolveSTPreset(): Promise<Record<string, any> | null> {
        try {
            const preset = await STClient.getPreset('in_use');
            if (preset && Array.isArray(preset.prompts)) {
                return preset as unknown as Record<string, any>;
            }
            return null;
        } catch {
            return null;
        }
    }

    private async _resolveMainChatGenerationSettings(): Promise<Record<string, unknown>> {
        const preset = await STClient.getPreset('in_use');
        const presetSettings = this._cloneSettingsRecord(preset?.settings);
        const fallbackSettings = this._cloneSettingsRecord(STClient.getInstructSettings()?.settings);
        const inheritedSettings = Object.keys(presetSettings).length > 0 ? presetSettings : fallbackSettings;

        if (lwStorage.get('lumina-chat.unlimitedResponse', false, 'Global')) {
            delete inheritedSettings.max_tokens;
            delete inheritedSettings.max_length;
        }

        return this._sanitizeSettings(inheritedSettings);
    }

    private _cloneSettingsRecord(value: unknown): Record<string, unknown> {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return {};
        }
        return { ...(value as Record<string, unknown>) };
    }

    private _loadPresets(): void {
        const builtIns = createBuiltInPresets();
        const savedRaw = lwStorage.get(STORAGE_KEY_PRESETS, [], 'Global') as ForgeTestChatPreset[];
        const saved = Array.isArray(savedRaw) ? savedRaw : [];
        const userPresets = saved
            .filter(p => !p.builtIn)
            .map(p => ({ ...p, promptMode: p.promptMode ?? 'custom' }));
        this.presets.splice(0, this.presets.length, ...builtIns, ...userPresets);

        const savedActiveId = lwStorage.get(STORAGE_KEY_ACTIVE_PRESET, '', 'Global') as string;
        const validId = this.presets.find(p => p.id === savedActiveId)?.id;
        this.activePresetId = validId ?? builtIns[0].id;
    }

    private _persistPresets(): void {
        // 只持久化用户自定义预设（内置预设在运行时重建）
        const userPresets = this.presets.filter(p => !p.builtIn);
        lwStorage.set(STORAGE_KEY_PRESETS, userPresets, 'Global');
    }
}
