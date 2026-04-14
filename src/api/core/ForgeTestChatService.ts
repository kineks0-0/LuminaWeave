/**
 * ForgeTestChatService
 *
 * 独立于制卡主流程的测试聊天服务。
 * - 使用 LuminaGenerationTask 直接调用后端，绕过 ForgeExecutionGateway（避免 Forge XML 解析）
 * - 使用 ForgeTestChatPromptBuilder 自合成提示词
 * - 预设持久化到 lwStorage（key: lumina-forge.testChatPresets）
 * - 消息仅存于内存，不写入 WorldlineStore / ChatManager / PersistenceService
 */

import { ref } from 'vue';
import { llmEngine } from '../llmEngine.js';
import { lwStorage } from '../storage.js';
import { LuminaGenerationTask } from './LuminaGenerationTask.js';
import { buildTestChatMessages } from './ForgeTestChatPromptBuilder.js';
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
    readonly messages = ref<ForgeTestChatMessage[]>([]);
    readonly isStreaming = ref(false);

    // ── 预设管理
    readonly presets = ref<ForgeTestChatPreset[]>([]);
    readonly activePresetId = ref<string>('');

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
        this.messages.value = [];
    }

    /** 取消当前流式生成（真正的后端中断） */
    abort(): void {
        if (this.currentTask) {
            this.currentTask.abort();
            this.currentTask = null;
        }
        this.isStreaming.value = false;
        // 将最后一条 assistant 消息标记为非流式
        const msgs = this.messages.value;
        const last = msgs[msgs.length - 1];
        if (last?.role === 'assistant' && last.isStreaming) {
            msgs.splice(msgs.length - 1, 1, { ...last, isStreaming: false });
        }
    }

    async sendMessage(userText: string): Promise<void> {
        if (this.isStreaming.value) return;
        const trimmed = userText.trim();
        if (!trimmed) return;

        // 每次发送前从 storage 刷新预设（兼容设置面板修改后未重启的场景）
        this._loadPresets();

        // 追加用户消息
        this.messages.value.push({
            id: `ftc-u-${Date.now()}`,
            role: 'user',
            content: trimmed
        });

        // 追加空的 assistant 占位（流式占位）
        const assistantId = `ftc-a-${Date.now()}`;
        this.messages.value.push({
            id: assistantId,
            role: 'assistant',
            content: '',
            isStreaming: true
        });

        this.isStreaming.value = true;

        try {
            const preset = this._getActivePreset();
            // 对话历史：不含刚插入的空 assistant 占位
            const conversationHistory = this.messages.value
                .slice(0, -1)
                .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

            const messages = buildTestChatMessages({
                preset,
                virtualLorebookEntries: this.deps.getVirtualLorebookEntries(),
                conversationHistory,
                workspaceTitle: this.deps.getWorkspaceTitle?.()
            });

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
            const task = new LuminaGenerationTask(session);
            this.currentTask = task;

            await task.run(cleanedMessages, {
                onChunk: (_chunk, fullText) => {
                    this._updateAssistant(assistantId, fullText, true);
                },
                onDone: (finalText) => {
                    this._updateAssistant(assistantId, finalText, false);
                    this.isStreaming.value = false;
                    this.currentTask = null;
                },
                onError: (err) => {
                    this._updateAssistant(assistantId, `[错误] ${err.message}`, false);
                    this.isStreaming.value = false;
                    this.currentTask = null;
                }
            });

            // task.run() 正常完成（onDone 回调可能已处理，此处兜底）
            const last = this.messages.value.find(m => m.id === assistantId);
            if (last?.isStreaming) {
                this._updateAssistant(assistantId, last.content, false);
            }
        } catch (err: any) {
            const last = this.messages.value.find(m => m.id === assistantId);
            this._updateAssistant(assistantId, last?.content || `[错误] ${err?.message ?? '生成失败'}`, false);
        } finally {
            this.isStreaming.value = false;
            this.currentTask = null;
        }
    }

    // ──────────────────────────────────────────────
    // 预设 CRUD
    // ──────────────────────────────────────────────

    setActivePreset(id: string): void {
        const preset = this.presets.value.find(p => p.id === id);
        if (!preset) return;
        this.activePresetId.value = id;
        lwStorage.set(STORAGE_KEY_ACTIVE_PRESET, id, 'Global');
    }

    createPreset(partial: Pick<ForgeTestChatPreset, 'name' | 'charCardMode' | 'promptEntries'> & Partial<ForgeTestChatPreset>): ForgeTestChatPreset {
        const now = Date.now();
        const preset: ForgeTestChatPreset = {
            ...partial,
            id: `user:${now}`,
            createdAt: now,
            updatedAt: now
        };
        this.presets.value.push(preset);
        this._persistPresets();
        return preset;
    }

    updatePreset(id: string, changes: Partial<Omit<ForgeTestChatPreset, 'id' | 'builtIn' | 'createdAt'>>): void {
        const idx = this.presets.value.findIndex(p => p.id === id);
        if (idx === -1) return;
        const existing = this.presets.value[idx];
        if (existing.builtIn) return; // 内置预设不可修改
        this.presets.value.splice(idx, 1, { ...existing, ...changes, updatedAt: Date.now() });
        this._persistPresets();
    }

    deletePreset(id: string): void {
        const preset = this.presets.value.find(p => p.id === id);
        if (!preset || preset.builtIn) return;
        this.presets.value = this.presets.value.filter(p => p.id !== id);
        // 若删除的是当前激活预设，回退到第一个
        if (this.activePresetId.value === id) {
            this.setActivePreset(this.presets.value[0]?.id ?? '');
        }
        this._persistPresets();
    }

    // ──────────────────────────────────────────────
    // 私有工具
    // ──────────────────────────────────────────────

    private _getActivePreset(): ForgeTestChatPreset {
        const found = this.presets.value.find(p => p.id === this.activePresetId.value);
        // 找不到时回退到第一个（内置「纯世界书」）
        return found ?? this.presets.value[0] ?? createBuiltInPresets()[1];
    }

    private _updateAssistant(id: string, content: string, streaming: boolean): void {
        const idx = this.messages.value.findIndex(m => m.id === id);
        if (idx === -1) return;
        this.messages.value.splice(idx, 1, { ...this.messages.value[idx], content, isStreaming: streaming });
    }

    private _loadPresets(): void {
        const builtIns = createBuiltInPresets();
        const savedRaw = lwStorage.get(STORAGE_KEY_PRESETS, [], 'Global') as ForgeTestChatPreset[];
        const saved = Array.isArray(savedRaw) ? savedRaw : [];
        // 合并：内置预设始终保留，用户预设附加在后
        const userPresets = saved.filter(p => !p.builtIn);
        this.presets.value = [...builtIns, ...userPresets];

        const savedActiveId = lwStorage.get(STORAGE_KEY_ACTIVE_PRESET, '', 'Global') as string;
        const validId = this.presets.value.find(p => p.id === savedActiveId)?.id;
        this.activePresetId.value = validId ?? builtIns[1].id; // 默认「纯世界书」
    }

    private _persistPresets(): void {
        // 只持久化用户自定义预设（内置预设在运行时重建）
        const userPresets = this.presets.value.filter(p => !p.builtIn);
        lwStorage.set(STORAGE_KEY_PRESETS, userPresets, 'Global');
    }
}
