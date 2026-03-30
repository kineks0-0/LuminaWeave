<template>
    <div class="prompt-inspector" :class="{ 'is-edit-mode': editMode, 'is-probing': isProbing }">
        <!-- 顶部工具条 -->
        <div class="inspector-header">
            <div class="inspector-tabs">
                <button class="lw-btn" :class="!editMode ? 'lw-btn-primary' : 'lw-btn-ghost'" @click="editMode = false">
                    <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                    预览
                </button>
                <button class="lw-btn" :class="editMode ? 'lw-btn-primary' : 'lw-btn-ghost'" @click="switchToEdit">
                    <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                    自由编辑
                </button>
            </div>

            <!-- 中间状态 -->
            <div class="inspector-status">
                <template v-if="isProbing">
                    <span class="probe-spinner"></span>
                    <span>正在刺探 ST 管线...</span>
                </template>
                <template v-else-if="!payload">
                    <span>点击刺探获取最新提示词</span>
                </template>
                <template v-else>
                    <span class="payload-badge" :class="promptSource" v-if="promptSource">
                        {{ promptSource === 'st' ? 'ST 原始' : '幻光组装完成' }}
                    </span>
                    <span class="payload-badge" v-if="Array.isArray(payload)">{{ payload.length }} 条 Messages</span>
                    <span class="payload-badge" v-else>字符串</span>
                </template>
            </div>

            <!-- 刺探按钮 -->
            <button class="lw-btn lw-btn-secondary probe-btn" @click="runProbe" :disabled="isProbing" title="发送一次虚假 dryRun 请求，拼接最新 Prompt"
                :class="{ spinning: isProbing }">
                <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none">
                    <polyline points="23 4 23 10 17 10"></polyline>
                    <polyline points="1 20 1 14 7 14"></polyline>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                </svg>
                {{ isProbing ? '探针中...' : '刺探刷新' }}
            </button>
        </div>

        <!-- 消息预览模式 -->
        <div class="inspector-body" v-if="!editMode">
            <div v-if="isProbing" class="probe-loading">
                <span class="probe-dots"></span>
                <p>向 SillyTavern 发送探针请求，等待组装管线返回...</p>
            </div>
            <div v-else-if="!payload" class="empty-state">
                <svg viewBox="0 0 24 24" width="32" height="32" stroke="#94a3b8" stroke-width="1.5" fill="none">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <p>尚未获取提示词</p>
                <p class="sub">ST 环境担载完成后，点击『刺探刷新』即可获取当前完整提示词</p>
                <button class="probe-cta" @click="runProbe">
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                        <polyline points="23 4 23 10 17 10"></polyline>
                        <polyline points="1 20 1 14 7 14"></polyline>
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                    </svg>
                    立即刺探获取
                </button>
            </div>
            <template v-else-if="Array.isArray(payload)">
                <div v-for="(msg, i) in payload" :key="i" class="prompt-msg" :class="roleOf(msg)">
                    <div class="prompt-role">{{ roleLabel(roleOf(msg)) }}</div>
                    <div class="prompt-text">{{ contentOf(msg) }}</div>
                </div>
            </template>
            <pre v-else class="prompt-raw">{{ payload }}</pre>
        </div>

        <!-- 自由编辑模式 -->
        <div class="inspector-body edit-body" v-else>
            <div class="edit-hint">
                <svg viewBox="0 0 24 24" width="13" height="13" stroke="#f59e0b" stroke-width="2" fill="none">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                手动修改后，点击"以此提示词发送"将直接调用您编辑的内容，跳过 ST 重新组装
            </div>
            <textarea class="lw-input edit-textarea" v-model="editContent" style="font-family: monospace;"></textarea>
            <button class="lw-btn lw-btn-primary send-edited-btn" @click="sendEdited">
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
                以此提示词发送
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, inject, onMounted } from 'vue';
import { llmEngine } from '../../api/llmEngine';
import { lwStorage } from '../../api/storage';
import { LuminaWeaveAPI } from '../../api/index';

const lwApi = inject<LuminaWeaveAPI>('lwApi');

/** 当前面板模式 */
const editMode = ref(false);
/** 探针进行中标志 */
const isProbing = ref(false);
/** 当前截获到的 payload */
const payload = ref<any>(lwApi?.lastPromptPayload || null);
const editContent = ref('');
/** 提示词来源: 'st' | 'lumina' */
const promptSource = ref<'st' | 'lumina' | null>(null);

/** 监听 ST 原始截获 */
lwApi?.on('ST_PROMPT_INTERCEPTED', (p: any) => {
    payload.value = p;
    editContent.value = payloadToString(p);
    promptSource.value = 'st';
    // 注意：如果是探针触发的，探针还在等待 LUMINA_PROMPT_BUILT
});

/** 监听 Lumina 组装完成 */
lwApi?.on('LUMINA_PROMPT_BUILT', (p: any) => {
    payload.value = p;
    editContent.value = payloadToString(p);
    promptSource.value = 'lumina';
    isProbing.value = false; // 最终组装完成，探针结束
});

/**
 * 主动刺探：调用 probePrompt() 发起一次虚假 dryRun
 * 由 ST 组装完整提示词后自动报告回来
 */
const runProbe = async () => {
    if (!lwApi || isProbing.value) return;
    isProbing.value = true;
    const result = await lwApi.probePrompt();
    // probePrompt 通过 PROMPT_INTERCEPTED 事件更新了 payload
    // 如果 5s 超时会返回 null
    if (result === null && isProbing.value) {
        isProbing.value = false;
    }
};

/** 面板挂载时自动刺探 */
onMounted(() => {
    // 延迟 300ms 等 Vue 渲染完成后再刺探
    setTimeout(runProbe, 300);
});

/** 各角色标签映射 */
const roleLabel = (role: string) => {
    const m: Record<string, string> = { system: '⚙ System', user: '👤 User', assistant: '🤖 Assistant' };
    return m[role] || role;
};

/** 判定角色 (兼容 ST 原始对象) */
const roleOf = (msg: any): string => {
    if (msg.role) return msg.role;
    if (msg.is_user) return 'user';
    if (msg.is_system || (msg.extra && msg.extra.type === 'narrator')) return 'system';
    return 'assistant';
};

/** 提取 content 字符串 (支持多模态数组格式，兼容 mes 字段) */
const contentOf = (msg: any): string => {
    const rawContent = msg.content || msg.mes || '';
    if (typeof rawContent === 'string') return rawContent;
    if (Array.isArray(rawContent)) {
        return rawContent.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n');
    }
    return JSON.stringify(rawContent || '');
};


const payloadToString = (p: any): string => {
    if (!p) return '';
    if (typeof p === 'string') return p;
    if (Array.isArray(p)) return p.map((m: any) => `[${roleOf(m)}]\n${contentOf(m)}`).join('\n\n---\n\n');
    return JSON.stringify(p, null, 2);
};

const switchToEdit = () => {
    editContent.value = payloadToString(payload.value);
    editMode.value = true;
};

const sendEdited = () => {
    if (!lwApi || !editContent.value.trim()) return;
    // 将编辑后的内容直接发给自定义流引擎，不走 ST 重组管线
    const chatPresetId = lwStorage.get('lumina-chat.nexusPreset', 'Global', 'Global');
    // 以字符串形式送入（兼容大多数 text completion 引擎）
    const customPayload = editContent.value;
    // 初始化流状态
    lwApi.streamHandler.handleRestart();
    lwApi.generateAbortController = new AbortController();
    lwApi.emit('GENERATION_STARTED');

    (llmEngine as any).generateCustomStream(customPayload, {
        nexusPresetId: chatPresetId,
                // @ts-ignore
        signal: lwApi.generateAbortController.signal,
        onChunk: (fullText: string) => {
            if (!lwApi) return;
            // 核心修复：复用 StreamHandler 进行增量管理。
            // 这样会自动触发 Facade 层的正则网关处理，保持与正常发送逻辑 100% 一致的过滤统计。
            const lastRawLen = lwApi.streamHandler.responseBuffer.length;
            const rawDelta = fullText.substring(lastRawLen);
            lwApi.streamHandler.handleChunk(rawDelta, fullText);
        },
        onDone: async (finalText: string) => {
            if (!lwApi) return;
            // 核心修复：调用 handleEnd 清理流状态，触发最终正则处理与 GENERATION_ENDED 事件
            lwApi.streamHandler.handleEnd();
            lwApi.generateAbortController = null;
            
            const chat = await lwApi.getChat();
            const chatIndex = chat.length;
            await lwApi.crudChatRecord(chatIndex, 'add', finalText, {
                is_user: false,
                name: lwApi.getCharName()
            });

            // 确保同步写回 ST 环境与独立存储
            await lwApi.commitToST();
        },
        onError: (err: any) => {
            if (!lwApi) return;
            lwApi.streamHandler.handleEnd();
            lwApi.generateAbortController = null;
        }
    });
};
</script>

<style scoped>
.prompt-inspector {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--lw-bg-app);
    border-top: 1px solid var(--lw-border-base);
    font-size: 13px;
}

/* === 顶部工具条 === */
.inspector-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: var(--lw-bg-surface);
    border-bottom: 1px solid var(--lw-border-base);
    flex-shrink: 0;
}

.inspector-tabs {
    display: flex;
    gap: 6px;
}

.inspector-tabs .lw-btn {
    padding: 4px 12px;
    font-size: 12px;
}

/* 中间状态 */
.inspector-status {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--lw-text-muted);
    min-width: 0;
}

.payload-badge {
    background: var(--lw-bg-subtle);
    color: var(--lw-text-secondary);
    padding: 2px 8px;
    border-radius: 4px;
    font-weight: 700;
    font-size: 10px;
}

.payload-badge.st {
    background: #fee2e2;
    color: #b91c1c;
}

.payload-badge.lumina {
    background: #f0fdf4;
    color: #15803d;
}

/* 刺探按钮 */
.probe-btn {
    padding: 4px 12px;
    font-size: 11px;
}

.probe-btn.spinning svg {
    animation: spin 1s linear infinite;
}

@keyframes spin {
    from {
        transform: rotate(0deg);
    }

    to {
        transform: rotate(360deg);
    }
}

/* 探针载入动画 */
.probe-spinner {
    display: inline-block;
    width: 10px;
    height: 10px;
    border: 2px solid var(--lw-border-base);
    border-top-color: var(--lw-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    flex-shrink: 0;
}

/* 探针进行中的中心加载状态 */
.probe-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    height: 100%;
    color: #64748b;
    font-size: 12px;
}

.probe-dots {
    width: 32px;
    height: 32px;
    border: 3px solid var(--lw-border-base);
    border-top-color: var(--lw-primary);
    border-radius: 50%;
    animation: spin 0.9s linear infinite;
}

/* === 消息体 === */
.inspector-body {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 100%;
    color: var(--lw-text-muted);
    text-align: center;
}

.empty-state p {
    margin: 0;
    font-size: 13px;
}

.empty-state .sub {
    font-size: 11px;
}

/* === 空状态 CTA 按钮 === */
.probe-cta {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
    padding: 6px 14px;
    border-radius: 6px;
    border: 1px solid #c4b5fd;
    background: #faf5ff;
    color: var(--lw-primary, var(--lw-primary));
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: 0.15s;
}

.probe-cta:hover {
    background: var(--lw-bg-hover);
}

/* === 角色消息气泡 === */
.prompt-msg {
    background: var(--lw-bg-surface);
    border: 1px solid var(--lw-border-base);
    border-radius: var(--lw-radius-sm);
}

.prompt-role {
    padding: 6px 12px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.3px;
    border-bottom: 1px solid #f1f5f9;
}

.prompt-msg.system .prompt-role {
    background: #f0fdf4;
    color: #15803d;
}

.prompt-msg.user .prompt-role {
    background: #eff6ff;
    color: #1d4ed8;
}

.prompt-msg.assistant .prompt-role {
    background: #faf5ff;
    color: var(--lw-primary-hover);
}

.prompt-text {
    padding: 10px 12px;
    font-size: 12px;
    color: var(--lw-text-secondary);
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
}

.prompt-raw {
    background: var(--lw-bg-surface);
    border: 1px solid var(--lw-border-base);
    border-radius: var(--lw-radius-sm);
    padding: 12px;
    font-size: 11px;
    line-height: 1.6;
    color: var(--lw-text-secondary);
    white-space: pre-wrap;
    word-break: break-all;
    margin: 0;
}

/* === 编辑模式 === */
.edit-body {
    gap: 10px;
}

.edit-hint {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    font-size: 11px;
    color: #92400e;
    background: #fffbeb;
    border: 1px solid #fde68a;
    border-radius: 6px;
    padding: 8px 10px;
    line-height: 1.5;
    flex-shrink: 0;
}

.edit-textarea {
    flex: 1;
    resize: none;
    transition: var(--lw-transition);
}

.edit-textarea:focus {
    border-color: var(--lw-primary, var(--lw-primary));
    box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.12);
}

.send-edited-btn {
    padding: 10px 16px;
    font-weight: 800;
}
</style>
