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
                <template v-else-if="!hasDisplayPayload">
                    <span>点击刺探获取最新提示词</span>
                </template>
                <template v-else>
                    <span class="payload-badge" :class="promptSource" v-if="promptSource">
                        {{ promptSource === 'st' ? 'ST 原始' : '幻光组装完成' }}
                    </span>
                    <span class="payload-badge" v-if="Array.isArray(displayPayload)">{{ displayPayload.length }} 条 Messages</span>
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
            <div v-else-if="!hasDisplayPayload" class="empty-state">
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
            <template v-else>
                <div class="inspector-view-tabs">
                    <button class="view-tab" :class="{ active: viewMode === 'messages' }" @click="viewMode = 'messages'">
                        Messages
                    </button>
                    <button class="view-tab" :class="{ active: viewMode === 'merged' }" @click="viewMode = 'merged'">
                        合并
                    </button>
                    <button class="view-tab" :class="{ active: viewMode === 'sources' }" @click="viewMode = 'sources'">
                        来源
                    </button>
                </div>

                <template v-if="viewMode === 'messages'">
                    <template v-if="Array.isArray(displayPayload)">
                        <div v-for="(msg, i) in displayPayload" :key="i" class="prompt-msg" :class="roleOf(msg)">
                            <div class="prompt-role">{{ roleLabel(roleOf(msg)) }}</div>
                            <div class="prompt-text">{{ contentOf(msg) }}</div>
                        </div>
                    </template>
                    <pre v-else class="prompt-raw">{{ displayPayload }}</pre>
                </template>

                <div v-else-if="viewMode === 'merged'" class="merged-list">
                    <template v-if="Array.isArray(displayPayload)">
                        <article v-for="item in mergedMessages" :key="item.index" class="merged-message" :class="roleOf(item.msg)">
                            <header class="merged-message-header">
                                <span class="prompt-role-inline">{{ roleLabel(roleOf(item.msg)) }}</span>
                                <span class="merged-index">message {{ item.index }}</span>
                            </header>
                            <div class="prompt-text prompt-text-highlighted">
                                <template v-for="(segment, segmentIndex) in highlightedSegments(item.msg, item.traces)" :key="`${item.index}-${segmentIndex}`">
                                    <mark
                                        v-if="segment.traceId"
                                        class="prompt-source-mark"
                                        :class="{ selected: selectedTraceId === segment.traceId }"
                                        :title="segment.label"
                                        @click="selectedTraceId = segment.traceId"
                                    >{{ segment.text }}</mark>
                                    <span v-else>{{ segment.text }}</span>
                                </template>
                            </div>
                            <div class="merged-source-panel">
                                <div v-if="!item.traces.length" class="source-empty">这条 message 没有可用来源追踪。</div>
                                <button
                                    v-for="trace in item.traces"
                                    v-else
                                    :key="trace.traceId"
                                    type="button"
                                    class="merged-source-row"
                                    :class="[trace.kind, { selected: selectedTraceId === trace.traceId }]"
                                    @click="selectedTraceId = selectedTraceId === trace.traceId ? null : trace.traceId"
                                >
                                    <div class="merged-source-main">
                                        <span class="source-kind">{{ sourceKindLabel(trace.sourceKind) }}</span>
                                        <strong>{{ trace.label }}</strong>
                                        <span class="source-inclusion" :class="trace.inclusion">{{ inclusionLabel(trace.inclusion) }}</span>
                                    </div>
                                    <div class="source-meta">
                                        <span>{{ promptKindLabel(trace.kind) }}</span>
                                        <span v-if="trace.forgeSlot">{{ trace.forgeSlot }} · {{ trace.forgeRegion }}</span>
                                        <span>{{ traceRangeLabel(trace) }}</span>
                                        <span v-if="trace.resourceRef">
                                            {{ trace.resourceRef.sourceId }} / {{ trace.resourceRef.resourceType }} /
                                            {{ trace.resourceRef.resourceId }}
                                        </span>
                                        <span v-else-if="trace.sourcePath">{{ trace.sourcePath }}</span>
                                    </div>
                                    <blockquote v-if="traceExcerpt(item.msg, trace)" class="merged-source-excerpt">
                                        {{ traceExcerpt(item.msg, trace) }}
                                    </blockquote>
                                </button>
                            </div>
                        </article>
                    </template>
                    <pre v-else class="prompt-raw">{{ displayPayload }}</pre>
                </div>

                <div v-else class="source-list">
                    <div v-if="assemblyTrace.length" class="source-filter-bar">
                        <span class="source-filter-label">来源类型</span>
                        <button
                            type="button"
                            class="source-filter-chip"
                            :class="{ active: sourceKindFilter === 'all' }"
                            @click="sourceKindFilter = 'all'"
                        >
                            全部 {{ assemblyTrace.length }}
                        </button>
                        <button
                            v-for="option in sourceKindOptions"
                            :key="option.kind"
                            type="button"
                            class="source-filter-chip"
                            :class="{ active: sourceKindFilter === option.kind }"
                            @click="sourceKindFilter = option.kind"
                        >
                            {{ sourceKindLabel(option.kind) }} {{ option.count }}
                        </button>
                    </div>

                    <div v-if="diagnosticGroups.length" class="diagnostics-panel">
                        <section v-for="group in diagnosticGroups" :key="group.key" class="diagnostic-group" :class="group.level">
                            <header class="diagnostic-group-header">
                                <span>{{ group.label }}</span>
                                <strong>{{ group.items.length }}</strong>
                            </header>
                            <div v-for="item in group.items" :key="`${item.level}-${item.code}-${item.message}`" class="diagnostic-item">
                                <span class="diagnostic-level" :class="item.level">{{ diagnosticLevelLabel(item.level) }}</span>
                                <code>{{ item.code }}</code>
                                <span>{{ item.message }}</span>
                            </div>
                        </section>
                    </div>

                    <div v-if="!assemblyTrace.length" class="source-empty">当前提示词没有可用来源追踪。</div>
                    <div v-else-if="!filteredAssemblyTrace.length" class="source-empty">当前筛选条件下没有来源片段。</div>
                    <article v-for="(trace, i) in filteredAssemblyTrace" v-else :key="trace.unitId || i" class="source-card"
                        :class="[trace.kind, { selected: selectedTraceId === trace.traceId }]">
                        <header class="source-card-header">
                            <div class="source-title">
                                <span class="source-kind">{{ sourceKindLabel(trace.sourceKind) }}</span>
                                <strong>{{ trace.label }}</strong>
                            </div>
                            <div class="source-card-actions">
                                <button
                                    v-if="trace.outputMessageIndex !== null"
                                    type="button"
                                    class="source-jump-btn"
                                    @click="jumpToTrace(trace)"
                                >
                                    定位
                                </button>
                                <span class="source-inclusion" :class="trace.inclusion">{{ inclusionLabel(trace.inclusion) }}</span>
                            </div>
                        </header>
                        <div class="source-meta">
                            <span>{{ promptKindLabel(trace.kind) }}</span>
                            <span v-if="trace.forgeSlot">{{ trace.forgeSlot }} · {{ trace.forgeRegion }}</span>
                            <span v-if="trace.outputMessageIndex !== undefined">
                                message {{ trace.outputMessageIndex }} · {{ trace.outputStart ?? 0 }}-{{ trace.outputEnd ?? 0 }}
                            </span>
                            <span v-if="trace.resourceRef">
                                {{ trace.resourceRef.sourceId }} / {{ trace.resourceRef.resourceType }} /
                                {{ trace.resourceRef.resourceId }}
                            </span>
                            <span v-else-if="trace.sourcePath">{{ trace.sourcePath }}</span>
                        </div>
                        <div v-if="trace.transforms.length" class="transform-row">
                            <span v-for="transform in trace.transforms" :key="`${trace.unitId}-${transform.type}-${transform.detail ?? ''}`"
                                class="transform-chip" :class="{ lossy: transform.lossy }" :title="transform.detail">
                                {{ transformLabel(transform.type) }}
                                <span v-if="transform.detail" class="transform-detail">{{ transform.detail }}</span>
                            </span>
                        </div>
                        <details v-if="comparisonFor(trace)" class="trace-comparison">
                            <summary>处理前 / 处理后</summary>
                            <div class="trace-comparison-grid">
                                <section>
                                    <span>原始内容</span>
                                    <pre>{{ comparisonFor(trace)?.raw }}</pre>
                                </section>
                                <section>
                                    <span>进入最终提示词</span>
                                    <pre>{{ comparisonFor(trace)?.final }}</pre>
                                </section>
                            </div>
                        </details>
                        <details v-if="trace.resourceRef" class="resource-ref-details">
                            <summary>ResourceRef</summary>
                            <dl>
                                <template v-for="item in resourceRefRows(trace.resourceRef)" :key="item.label">
                                    <dt>{{ item.label }}</dt>
                                    <dd>{{ item.value }}</dd>
                                </template>
                            </dl>
                        </details>
                        <details v-if="sourceSpansOf(trace).length" class="source-span-details">
                            <summary>Source spans</summary>
                            <div v-for="span in sourceSpansOf(trace)" :key="`${trace.traceId}-${span.sourceUnitId}-${span.rawStart}`" class="source-span-row">
                                <span>{{ sourceKindLabel(span.sourceKind) }}</span>
                                <strong>{{ span.label }}</strong>
                                <code>raw {{ span.rawStart }}-{{ span.rawEnd }}</code>
                                <code>final {{ span.finalStart ?? '-' }}-{{ span.finalEnd ?? '-' }}</code>
                                <span v-if="span.transformTypes.length">{{ span.transformTypes.map(transformLabel).join(' / ') }}</span>
                            </div>
                        </details>
                    </article>
                </div>
            </template>
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
import { computed, ref, inject, onMounted } from 'vue';
import { LuminaWeaveAPI } from '../../api/index.js';
import type {
    PromptAssemblyResult,
    PromptSourceKind,
    PromptSourceTrace,
    PromptSourceUnitKind,
    PromptUnitInclusion,
} from '../../types/PromptAssemblyTypes.js';
import type { CleanedMessage } from '../../types/nexus.js';
import type { ResourceDiagnostic, ResourceRef } from '../../../shared/resources';

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
const viewMode = ref<'messages' | 'merged' | 'sources'>('messages');
const assembly = ref<PromptAssemblyResult | null>(null);
const selectedTraceId = ref<string | null>(null);
const sourceKindFilter = ref<PromptSourceKind | 'all'>('all');
const displayPayload = computed(() => normalizePromptPayload(payload.value).payload);
const hasDisplayPayload = computed(() => {
    const value = displayPayload.value;
    return Array.isArray(value) ? value.length > 0 : Boolean(value);
});
const assemblyTrace = computed(() => assembly.value?.trace ?? []);
const filteredAssemblyTrace = computed(() => {
    if (sourceKindFilter.value === 'all') return assemblyTrace.value;
    return assemblyTrace.value.filter((trace) => trace.sourceKind === sourceKindFilter.value);
});
const sourceKindOptions = computed(() => {
    const counts = new Map<PromptSourceKind, number>();
    assemblyTrace.value.forEach((trace) => {
        counts.set(trace.sourceKind, (counts.get(trace.sourceKind) ?? 0) + 1);
    });
    return Array.from(counts.entries())
        .map(([kind, count]) => ({ kind, count }))
        .sort((a, b) => sourceKindLabel(a.kind).localeCompare(sourceKindLabel(b.kind), 'zh-Hans-CN'));
});
const mergedMessages = computed(() => {
    const value = displayPayload.value;
    if (!Array.isArray(value)) return [];
    return value.map((msg: any, index: number) => ({
        index,
        msg,
        traces: assemblyTrace.value
            .filter((trace) => trace.outputMessageIndex === index)
            .sort((a, b) => (a.outputStart ?? 0) - (b.outputStart ?? 0)),
    }));
});
const assemblyDiagnostics = computed(() => assembly.value?.diagnostics ?? []);
const diagnosticGroups = computed(() => {
    const buckets = new Map<string, { key: string; label: string; level: ResourceDiagnostic['level']; items: ResourceDiagnostic[] }>();
    assemblyDiagnostics.value.forEach((item) => {
        const key = diagnosticGroupKey(item);
        const existing = buckets.get(key);
        if (existing) {
            existing.items.push(item);
            existing.level = strongestDiagnosticLevel(existing.items);
            return;
        }
        buckets.set(key, {
            key,
            label: diagnosticGroupLabel(key),
            level: item.level,
            items: [item],
        });
    });
    const order = ['source-selection', 'st-engine', 'worldbook-trigger', 'resource-read', 'write-policy', 'other'];
    return Array.from(buckets.values()).sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
});

interface HighlightedPromptSegment {
    text: string;
    traceId: string | null;
    label?: string;
}

const setPromptPayload = (p: any, source: 'st' | 'lumina') => {
    const normalized = normalizePromptPayload(p);
    payload.value = normalized.payload;
    assembly.value = normalized.assembly ?? buildSyntheticAssembly(normalized.payload, source);
    editContent.value = payloadToString(normalized.payload);
    promptSource.value = source;
};

/** 监听 ST 原始截获 */
lwApi?.on('ST_PROMPT_INTERCEPTED', (p: any) => {
    setPromptPayload(p, 'st');
    // 注意：如果是探针触发的，探针还在等待 LUMINA_PROMPT_BUILT
});

/** 监听 Lumina 组装完成 */
lwApi?.on('LUMINA_PROMPT_BUILT', (p: any) => {
    setPromptPayload(p, 'lumina');
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

const normalizePromptPayload = (p: any): { payload: any; assembly?: PromptAssemblyResult | null } => {
    if (p && typeof p === 'object' && !Array.isArray(p) && Array.isArray(p.messages)) {
        return {
            payload: p.messages,
            assembly: isPromptAssemblyResult(p.assembly) ? p.assembly : null,
        };
    }
    return { payload: p, assembly: null };
};

const isPromptAssemblyResult = (value: unknown): value is PromptAssemblyResult => {
    return Boolean(
        value
        && typeof value === 'object'
        && Array.isArray((value as PromptAssemblyResult).messages)
        && Array.isArray((value as PromptAssemblyResult).trace),
    );
};

const buildSyntheticAssembly = (p: any, source: 'st' | 'lumina'): PromptAssemblyResult | null => {
    if (!Array.isArray(p)) return null;
    const messages = p.map((msg: any): CleanedMessage => ({
        role: roleOf(msg) as CleanedMessage['role'],
        content: contentOf(msg),
        name: msg?.name,
    }));
    const trace: PromptSourceTrace[] = messages.map((msg, index) => ({
        traceId: `${source}-probe-trace-${index}`,
        unitId: `${source}-probe-message-${index}`,
        label: `${source === 'st' ? 'ST' : 'Lumina'} ${plainRoleLabel(msg.role)} #${index + 1}`,
        kind: promptKindForRole(msg.role),
        sourceKind: 'unknown',
        sourcePath: `${source}.probe.messages.${index}`,
        role: msg.role,
        inclusion: 'full',
        outputMessageIndex: index,
        outputStart: 0,
        outputEnd: msg.content.length,
        rawLength: msg.content.length,
        finalLength: msg.content.length,
        transforms: [
            {
                type: 'role-map',
                detail: 'raw_prompt_probe',
                lossy: false,
            },
        ],
        sourceSpans: [
            {
                sourceUnitId: `${source}-probe-message-${index}`,
                sourceKind: 'unknown',
                sourcePath: `${source}.probe.messages.${index}`,
                label: `${source === 'st' ? 'ST' : 'Lumina'} ${plainRoleLabel(msg.role)} #${index + 1}`,
                rawStart: 0,
                rawEnd: msg.content.length,
                finalStart: 0,
                finalEnd: msg.content.length,
                transformTypes: ['role-map'],
                lossy: false,
            },
        ],
    }));
    return {
        messages,
        sourceUnits: [],
        plannedUnits: [],
        trace,
        diagnostics: [],
    };
};

const plainRoleLabel = (role: string) => {
    const m: Record<string, string> = { system: 'System', user: 'User', assistant: 'Assistant' };
    return m[role] || role;
};

const promptKindForRole = (role: string): PromptSourceUnitKind => {
    return role === 'system' ? 'control' : 'information';
};

const sourceKindLabel = (kind: PromptSourceKind) => {
    const labels: Record<PromptSourceKind, string> = {
        preset: '预设',
        character: '角色',
        worldbook: '世界书',
        history: '历史',
        memory: '记忆',
        forge: 'Forge',
        skill: 'Skill',
        shell: 'Shell',
        tool: '工具',
        user_input: '用户输入',
        system_protocol: '系统协议',
        macro: '宏',
        unknown: '未标注',
    };
    return labels[kind] ?? kind;
};

const resourceRefRows = (ref: ResourceRef) => {
    return [
        { label: 'sourceId', value: ref.sourceId },
        { label: 'type', value: ref.resourceType },
        { label: 'resourceId', value: ref.resourceId },
        { label: 'revision', value: ref.revision ?? '-' },
        { label: 'path', value: ref.path },
        { label: 'writable', value: ref.writable ? 'true' : 'false' },
        { label: 'origin', value: ref.origin ?? '-' },
        {
            label: 'forkedFrom',
            value: ref.forkedFrom
                ? `${ref.forkedFrom.sourceId}/${ref.forkedFrom.resourceType}/${ref.forkedFrom.resourceId}`
                : '-',
        },
    ];
};

const diagnosticLevelLabel = (level: ResourceDiagnostic['level']) => {
    const labels: Record<ResourceDiagnostic['level'], string> = {
        error: '错误',
        warning: '警告',
        info: '信息',
    };
    return labels[level] ?? level;
};

const traceRangeLabel = (trace: PromptSourceTrace) => {
    if (trace.outputMessageIndex === null || trace.outputStart === null || trace.outputEnd === null) {
        return '未进入最终 message';
    }
    return `${trace.outputStart}-${trace.outputEnd}`;
};

const traceExcerpt = (msg: any, trace: PromptSourceTrace) => {
    if (trace.outputStart === null || trace.outputEnd === null) return '';
    const content = contentOf(msg);
    const excerpt = content.slice(trace.outputStart, trace.outputEnd).trim();
    if (!excerpt) return '';
    return excerpt.length > 220 ? `${excerpt.slice(0, 220)}...` : excerpt;
};

const promptKindLabel = (kind: PromptSourceUnitKind) => {
    const labels: Record<PromptSourceUnitKind, string> = {
        control: '控制内容',
        information: '信息内容',
        state: '状态内容',
    };
    return labels[kind] ?? kind;
};

const inclusionLabel = (inclusion: PromptUnitInclusion) => {
    const labels: Record<PromptUnitInclusion, string> = {
        full: '完整',
        summary: '摘要',
        hidden: '隐藏',
        pinned: '固定',
        compressed: '压缩',
    };
    return labels[inclusion] ?? inclusion;
};

const transformLabel = (type: string) => {
    const labels: Record<string, string> = {
        macro: '宏替换',
        summary: '摘要',
        truncate: '截断',
        compact: '压缩',
        filter: '过滤',
        'role-map': '角色映射',
        merge: '合并',
    };
    return labels[type] ?? type;
};

const sourceSpansOf = (trace: PromptSourceTrace) => {
    return Array.isArray(trace.sourceSpans) ? trace.sourceSpans : [];
};

const jumpToTrace = (trace: PromptSourceTrace) => {
    selectedTraceId.value = trace.traceId;
    viewMode.value = 'merged';
};

const diagnosticGroupKey = (item: ResourceDiagnostic) => {
    if (item.code.includes('SOURCE_SELECTION') || item.code.includes('EXCLUDED_BY_SOURCE_SELECTION')) return 'source-selection';
    if (item.code.startsWith('ST_ENGINE')) return 'st-engine';
    if (item.code.startsWith('LUMINA_WORLDBOOK')) return 'worldbook-trigger';
    if (item.code.includes('NOT_FOUND') || item.code.startsWith('RESOURCE_SAVE')) return 'resource-read';
    if (item.code.includes('WRITE_POLICY') || item.code.includes('READONLY')) return 'write-policy';
    return 'other';
};

const diagnosticGroupLabel = (key: string) => {
    const labels: Record<string, string> = {
        'source-selection': '来源选择',
        'st-engine': 'ST 合成限制',
        'worldbook-trigger': '世界书触发',
        'resource-read': '资源读取',
        'write-policy': '写入策略',
        other: '其他诊断',
    };
    return labels[key] ?? key;
};

const strongestDiagnosticLevel = (items: ResourceDiagnostic[]): ResourceDiagnostic['level'] => {
    if (items.some((item) => item.level === 'error')) return 'error';
    if (items.some((item) => item.level === 'warning')) return 'warning';
    return 'info';
};

const highlightedSegments = (msg: any, traces: PromptSourceTrace[]): HighlightedPromptSegment[] => {
    const content = contentOf(msg);
    if (!content) return [{ text: '', traceId: null }];

    const selected = selectedTraceId.value
        ? traces.filter((trace) => trace.traceId === selectedTraceId.value)
        : traces;
    const ranges = selected
        .filter((trace) => trace.outputStart !== null && trace.outputEnd !== null && trace.outputEnd > trace.outputStart)
        .map((trace) => ({
            trace,
            start: Math.max(0, Math.min(content.length, trace.outputStart ?? 0)),
            end: Math.max(0, Math.min(content.length, trace.outputEnd ?? 0)),
        }))
        .filter((range) => range.end > range.start)
        .sort((a, b) => a.start - b.start || a.end - b.end);

    if (!ranges.length) return [{ text: content, traceId: null }];

    const segments: HighlightedPromptSegment[] = [];
    let cursor = 0;
    ranges.forEach((range) => {
        if (range.start < cursor) return;
        if (range.start > cursor) {
            segments.push({ text: content.slice(cursor, range.start), traceId: null });
        }
        segments.push({
            text: content.slice(range.start, range.end),
            traceId: range.trace.traceId,
            label: range.trace.label,
        });
        cursor = range.end;
    });
    if (cursor < content.length) {
        segments.push({ text: content.slice(cursor), traceId: null });
    }
    return segments;
};

const comparisonFor = (trace: PromptSourceTrace): { raw: string; final: string } | null => {
    const sourceUnit = assembly.value?.sourceUnits.find((unit) => unit.id === trace.unitId);
    const plannedUnit = assembly.value?.plannedUnits.find((unit) => unit.id === trace.unitId);
    const hasMeaningfulTransform = trace.transforms.some((transform) => transform.lossy || transform.type === 'summary' || transform.type === 'truncate' || transform.type === 'compact');
    const finalContent = plannedUnit?.finalContent
        ?? (trace.outputMessageIndex !== null && Array.isArray(displayPayload.value)
            ? traceExcerpt(displayPayload.value[trace.outputMessageIndex], trace)
            : '');
    const rawContent = sourceUnit?.rawContent ?? sourceUnit?.content ?? '';

    if (!hasMeaningfulTransform && rawContent.length === finalContent.length) return null;
    if (!rawContent && !finalContent) return null;

    return {
        raw: trimComparisonText(rawContent || '(无原始内容)'),
        final: trimComparisonText(finalContent || '(未进入最终提示词)'),
    };
};

const trimComparisonText = (value: string) => {
    const normalized = value.replace(/^\s+|\s+$/g, '');
    return normalized.length > 1400 ? `${normalized.slice(0, 1400)}...` : normalized;
};

if (payload.value) {
    const normalized = normalizePromptPayload(payload.value);
    payload.value = normalized.payload;
    assembly.value = normalized.assembly ?? buildSyntheticAssembly(normalized.payload, 'lumina');
}

const payloadToString = (p: any): string => {
    if (!p) return '';
    if (typeof p === 'string') return p;
    if (Array.isArray(p)) return p.map((m: any) => `[${roleOf(m)}]\n${contentOf(m)}`).join('\n\n---\n\n');
    return JSON.stringify(p, null, 2);
};

const switchToEdit = () => {
    editContent.value = payloadToString(displayPayload.value);
    editMode.value = true;
};

const sendEdited = () => {
    if (!lwApi || !editContent.value.trim()) return;
    // 将编辑后的内容直接发给自定义流引擎，不走 ST 重组管线
    // 以字符串形式送入（兼容大多数 text completion 引擎）
    void lwApi.services.generation.runEditedPrompt(editContent.value);
};
</script>

<style scoped>
.prompt-inspector {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--lw-bg-app);
    border-top: 1px solid var(--lw-border-base);
    font-size: var(--lw-type-body-medium-size);
    line-height: var(--lw-type-body-medium-line-height);
    font-weight: var(--lw-type-body-medium-weight);
    letter-spacing: var(--lw-type-body-medium-tracking);
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
    font-size: var(--lw-type-label-medium-size);
    line-height: var(--lw-type-label-medium-line-height);
    font-weight: var(--lw-type-label-medium-weight);
    letter-spacing: var(--lw-type-label-medium-tracking);
}

/* 中间状态 */
.inspector-status {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--lw-type-body-small-size);
    line-height: var(--lw-type-body-small-line-height);
    font-weight: var(--lw-type-body-small-weight);
    letter-spacing: var(--lw-type-body-small-tracking);
    color: var(--lw-text-muted);
    min-width: 0;
}

.payload-badge {
    background: var(--lw-bg-subtle);
    color: var(--lw-text-secondary);
    padding: 2px 8px;
    border-radius: 4px;
    font-size: var(--lw-type-label-small-size);
    line-height: var(--lw-type-label-small-line-height);
    font-weight: var(--lw-type-label-small-weight);
    letter-spacing: var(--lw-type-label-small-tracking);
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
    font-size: var(--lw-type-label-small-size);
    line-height: var(--lw-type-label-small-line-height);
    font-weight: var(--lw-type-label-small-weight);
    letter-spacing: var(--lw-type-label-small-tracking);
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
    font-size: var(--lw-type-body-small-size);
    line-height: var(--lw-type-body-small-line-height);
    font-weight: var(--lw-type-body-small-weight);
    letter-spacing: var(--lw-type-body-small-tracking);
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
    font-size: var(--lw-type-body-medium-size);
    line-height: var(--lw-type-body-medium-line-height);
    font-weight: var(--lw-type-body-medium-weight);
    letter-spacing: var(--lw-type-body-medium-tracking);
}

.empty-state .sub {
    font-size: var(--lw-type-body-small-size);
    line-height: var(--lw-type-body-small-line-height);
    font-weight: var(--lw-type-body-small-weight);
    letter-spacing: var(--lw-type-body-small-tracking);
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
    font-size: var(--lw-type-label-medium-size);
    line-height: var(--lw-type-label-medium-line-height);
    font-weight: var(--lw-type-label-medium-weight);
    letter-spacing: var(--lw-type-label-medium-tracking);
    cursor: pointer;
    transition: 0.15s;
}

.probe-cta:hover {
    background: var(--lw-bg-hover);
}

.inspector-view-tabs {
    display: inline-flex;
    align-self: flex-start;
    gap: 4px;
    padding: 3px;
    border: 1px solid var(--lw-border-base);
    border-radius: 6px;
    background: var(--lw-bg-surface);
}

.view-tab {
    border: 0;
    border-radius: 4px;
    padding: 4px 10px;
    background: transparent;
    color: var(--lw-text-muted);
    font-size: var(--lw-type-label-small-size);
    line-height: var(--lw-type-label-small-line-height);
    font-weight: var(--lw-type-label-small-weight);
    letter-spacing: var(--lw-type-label-small-tracking);
    cursor: pointer;
}

.view-tab.active {
    background: var(--lw-bg-subtle);
    color: var(--lw-text-primary);
}

/* === 角色消息气泡 === */
.prompt-msg {
    background: var(--lw-bg-surface);
    border: 1px solid var(--lw-border-base);
    border-radius: var(--lw-radius-sm);
    overflow: clip;
}

.prompt-role {
    padding: 6px 12px;
    font-size: var(--lw-type-label-small-size);
    line-height: var(--lw-type-label-small-line-height);
    font-weight: var(--lw-type-label-small-weight);
    letter-spacing: var(--lw-type-label-small-tracking);
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
    font-size: var(--lw-type-body-small-size);
    line-height: var(--lw-type-body-small-line-height);
    font-weight: var(--lw-type-body-small-weight);
    letter-spacing: var(--lw-type-body-small-tracking);
    color: var(--lw-text-secondary);
    white-space: pre-wrap;
    word-break: break-word;
}

.prompt-text-highlighted {
    overflow-wrap: anywhere;
}

.prompt-source-mark {
    border-radius: 3px;
    padding: 0 2px;
    background: color-mix(in srgb, var(--lw-primary) 12%, transparent);
    color: inherit;
    cursor: pointer;
}

.prompt-source-mark.selected {
    background: color-mix(in srgb, var(--lw-primary) 24%, transparent);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--lw-primary) 32%, transparent);
}

.prompt-raw {
    background: var(--lw-bg-surface);
    border: 1px solid var(--lw-border-base);
    border-radius: var(--lw-radius-sm);
    padding: 12px;
    font-size: var(--lw-type-body-small-size);
    line-height: var(--lw-type-body-small-line-height);
    font-weight: var(--lw-type-body-small-weight);
    letter-spacing: var(--lw-type-body-small-tracking);
    color: var(--lw-text-secondary);
    white-space: pre-wrap;
    word-break: break-all;
    margin: 0;
}

.source-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.source-filter-bar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    padding: 8px;
    border: 1px solid var(--lw-border-base);
    border-radius: var(--lw-radius-sm);
    background: var(--lw-bg-surface);
}

.source-filter-label {
    color: var(--lw-text-muted);
    font-size: var(--lw-type-label-small-size);
    line-height: var(--lw-type-label-small-line-height);
    font-weight: var(--lw-type-label-small-weight);
}

.source-filter-chip,
.source-jump-btn {
    border: 1px solid var(--lw-border-base);
    border-radius: 4px;
    background: var(--lw-bg-surface);
    color: var(--lw-text-secondary);
    font-size: var(--lw-type-label-small-size);
    line-height: var(--lw-type-label-small-line-height);
    font-weight: var(--lw-type-label-small-weight);
    letter-spacing: var(--lw-type-label-small-tracking);
    cursor: pointer;
}

.source-filter-chip {
    padding: 3px 7px;
}

.source-filter-chip:hover,
.source-filter-chip.active,
.source-jump-btn:hover {
    border-color: color-mix(in srgb, var(--lw-primary) 32%, var(--lw-border-base));
    background: color-mix(in srgb, var(--lw-primary) 8%, var(--lw-bg-surface));
    color: var(--lw-text-primary);
}

.source-jump-btn {
    padding: 2px 7px;
}

.merged-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.merged-message {
    display: flex;
    flex-direction: column;
    overflow: clip;
    border: 1px solid var(--lw-border-base);
    border-radius: var(--lw-radius-sm);
    background: var(--lw-bg-surface);
}

.merged-message-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 12px;
    border-bottom: 1px solid #f1f5f9;
}

.prompt-role-inline {
    color: var(--lw-text-primary);
    font-size: var(--lw-type-label-small-size);
    line-height: var(--lw-type-label-small-line-height);
    font-weight: var(--lw-type-label-small-weight);
    letter-spacing: var(--lw-type-label-small-tracking);
}

.merged-index {
    color: var(--lw-text-muted);
    font-size: var(--lw-type-label-small-size);
    line-height: var(--lw-type-label-small-line-height);
    font-weight: var(--lw-type-label-small-weight);
    letter-spacing: var(--lw-type-label-small-tracking);
}

.merged-message.system .merged-message-header {
    background: #f0fdf4;
}

.merged-message.user .merged-message-header {
    background: #eff6ff;
}

.merged-message.assistant .merged-message-header {
    background: #faf5ff;
}

.merged-source-panel {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px 12px;
    border-top: 1px solid var(--lw-border-base);
    background: var(--lw-bg-app);
}

.merged-source-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
    padding: 8px 10px;
    border: 1px solid var(--lw-border-base);
    border-radius: var(--lw-radius-sm);
    background: var(--lw-bg-surface);
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
}

.merged-source-row.control {
    border-color: color-mix(in srgb, #2563eb 32%, var(--lw-border-base));
}

.merged-source-row.information {
    border-color: color-mix(in srgb, #16a34a 32%, var(--lw-border-base));
}

.merged-source-row.state {
    border-color: color-mix(in srgb, #9333ea 32%, var(--lw-border-base));
}

.merged-source-row:hover,
.merged-source-row.selected {
    background: var(--lw-bg-subtle);
}

.merged-source-row.selected {
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--lw-primary) 24%, transparent);
}

.merged-source-main {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    color: var(--lw-text-primary);
    font-size: var(--lw-type-label-small-size);
    line-height: var(--lw-type-label-small-line-height);
    font-weight: var(--lw-type-label-small-weight);
    letter-spacing: var(--lw-type-label-small-tracking);
}

.merged-source-main strong {
    overflow-wrap: anywhere;
}

.merged-source-excerpt {
    margin: 0;
    padding: 6px 8px;
    border-left: 2px solid var(--lw-border-base);
    color: var(--lw-text-secondary);
    background: var(--lw-bg-subtle);
    font-size: var(--lw-type-body-small-size);
    line-height: var(--lw-type-body-small-line-height);
    font-weight: var(--lw-type-body-small-weight);
    letter-spacing: var(--lw-type-body-small-tracking);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
}

.source-empty {
    color: var(--lw-text-muted);
    font-size: var(--lw-type-body-small-size);
    line-height: var(--lw-type-body-small-line-height);
}

.diagnostics-panel {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.diagnostic-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px;
    border: 1px solid var(--lw-border-base);
    border-radius: var(--lw-radius-sm);
    background: var(--lw-bg-surface);
}

.diagnostic-group.error {
    border-color: color-mix(in srgb, #dc2626 36%, var(--lw-border-base));
}

.diagnostic-group.warning {
    border-color: color-mix(in srgb, #d97706 36%, var(--lw-border-base));
}

.diagnostic-group.info {
    border-color: color-mix(in srgb, #2563eb 36%, var(--lw-border-base));
}

.diagnostic-group-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    color: var(--lw-text-primary);
    font-size: var(--lw-type-label-small-size);
    line-height: var(--lw-type-label-small-line-height);
    font-weight: var(--lw-type-label-small-weight);
    letter-spacing: var(--lw-type-label-small-tracking);
}

.diagnostic-group-header strong {
    color: var(--lw-text-muted);
}

.diagnostic-item {
    display: grid;
    grid-template-columns: minmax(44px, max-content) minmax(80px, max-content) minmax(0, 1fr);
    gap: 8px;
    align-items: start;
    color: var(--lw-text-secondary);
    font-size: var(--lw-type-body-small-size);
    line-height: var(--lw-type-body-small-line-height);
    font-weight: var(--lw-type-body-small-weight);
    letter-spacing: var(--lw-type-body-small-tracking);
}

.diagnostic-item code {
    color: var(--lw-text-muted);
    overflow-wrap: anywhere;
}

.diagnostic-level {
    border-radius: 4px;
    padding: 1px 5px;
    background: var(--lw-bg-subtle);
    color: var(--lw-text-muted);
    font-size: var(--lw-type-label-small-size);
    line-height: var(--lw-type-label-small-line-height);
}

.diagnostic-level.error {
    background: #fee2e2;
    color: #b91c1c;
}

.diagnostic-level.warning {
    background: #fffbeb;
    color: #92400e;
}

.diagnostic-level.info {
    background: #eff6ff;
    color: #1d4ed8;
}

.source-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px 12px;
    border: 1px solid var(--lw-border-base);
    border-radius: var(--lw-radius-sm);
    background: var(--lw-bg-surface);
}

.source-card.control {
    border-color: color-mix(in srgb, #2563eb 32%, var(--lw-border-base));
}

.source-card.information {
    border-color: color-mix(in srgb, #16a34a 32%, var(--lw-border-base));
}

.source-card.state {
    border-color: color-mix(in srgb, #9333ea 32%, var(--lw-border-base));
}

.source-card.selected {
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--lw-primary) 28%, transparent);
}

.source-card-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
}

.source-card-actions {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
}

.source-title {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
}

.source-title strong {
    color: var(--lw-text-primary);
    font-size: var(--lw-type-label-medium-size);
    line-height: var(--lw-type-label-medium-line-height);
    font-weight: var(--lw-type-label-medium-weight);
    letter-spacing: var(--lw-type-label-medium-tracking);
    overflow-wrap: anywhere;
}

.source-kind,
.source-inclusion,
.transform-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
    border-radius: 4px;
    padding: 2px 6px;
    background: var(--lw-bg-subtle);
    color: var(--lw-text-secondary);
    font-size: var(--lw-type-label-small-size);
    line-height: var(--lw-type-label-small-line-height);
    font-weight: var(--lw-type-label-small-weight);
    letter-spacing: var(--lw-type-label-small-tracking);
}

.transform-detail {
    color: var(--lw-text-muted);
    overflow-wrap: anywhere;
}

.source-inclusion.summary,
.transform-chip.lossy {
    background: #fffbeb;
    color: #92400e;
}

.source-inclusion.hidden {
    background: #f1f5f9;
    color: #64748b;
}

.source-inclusion.pinned {
    background: #eff6ff;
    color: #1d4ed8;
}

.source-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 10px;
    color: var(--lw-text-muted);
    font-size: var(--lw-type-body-small-size);
    line-height: var(--lw-type-body-small-line-height);
    font-weight: var(--lw-type-body-small-weight);
    letter-spacing: var(--lw-type-body-small-tracking);
}

.transform-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

.trace-comparison {
    border-top: 1px solid var(--lw-border-base);
    padding-top: 8px;
}

.trace-comparison summary {
    color: var(--lw-text-secondary);
    font-size: var(--lw-type-label-small-size);
    line-height: var(--lw-type-label-small-line-height);
    font-weight: var(--lw-type-label-small-weight);
    letter-spacing: var(--lw-type-label-small-tracking);
    cursor: pointer;
}

.trace-comparison-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    margin-top: 8px;
}

.trace-comparison-grid section {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 6px;
    padding: 8px;
    border: 1px solid var(--lw-border-base);
    border-radius: var(--lw-radius-sm);
    background: var(--lw-bg-subtle);
}

.trace-comparison-grid span {
    color: var(--lw-text-muted);
    font-size: var(--lw-type-label-small-size);
    line-height: var(--lw-type-label-small-line-height);
    font-weight: var(--lw-type-label-small-weight);
}

.trace-comparison-grid pre {
    margin: 0;
    max-height: 220px;
    overflow: auto;
    color: var(--lw-text-secondary);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font-size: var(--lw-type-body-small-size);
    line-height: var(--lw-type-body-small-line-height);
    font-family: ui-monospace, Consolas, monospace;
}

.resource-ref-details {
    border-top: 1px solid var(--lw-border-base);
    padding-top: 8px;
}

.resource-ref-details summary,
.source-span-details summary {
    color: var(--lw-text-secondary);
    font-size: var(--lw-type-label-small-size);
    line-height: var(--lw-type-label-small-line-height);
    font-weight: var(--lw-type-label-small-weight);
    letter-spacing: var(--lw-type-label-small-tracking);
    cursor: pointer;
}

.source-span-details {
    border-top: 1px solid var(--lw-border-base);
    padding-top: 8px;
}

.source-span-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    margin-top: 6px;
    color: var(--lw-text-muted);
    font-size: var(--lw-type-body-small-size);
    line-height: var(--lw-type-body-small-line-height);
    font-weight: var(--lw-type-body-small-weight);
    letter-spacing: var(--lw-type-body-small-tracking);
}

.source-span-row strong {
    color: var(--lw-text-secondary);
    overflow-wrap: anywhere;
}

.source-span-row code {
    color: var(--lw-text-muted);
}

.resource-ref-details dl {
    display: grid;
    grid-template-columns: minmax(76px, max-content) minmax(0, 1fr);
    gap: 4px 10px;
    margin: 8px 0 0;
    color: var(--lw-text-muted);
    font-size: var(--lw-type-body-small-size);
    line-height: var(--lw-type-body-small-line-height);
    font-weight: var(--lw-type-body-small-weight);
    letter-spacing: var(--lw-type-body-small-tracking);
}

.resource-ref-details dt {
    color: var(--lw-text-secondary);
}

.resource-ref-details dd {
    margin: 0;
    overflow-wrap: anywhere;
}

/* === 编辑模式 === */
.edit-body {
    gap: 10px;
}

.edit-hint {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    font-size: var(--lw-type-body-small-size);
    line-height: var(--lw-type-body-small-line-height);
    font-weight: var(--lw-type-body-small-weight);
    letter-spacing: var(--lw-type-body-small-tracking);
    color: #92400e;
    background: #fffbeb;
    border: 1px solid #fde68a;
    border-radius: 6px;
    padding: 8px 10px;
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
    font-weight: var(--lw-type-label-large-weight);
}

@media (max-width: 720px) {
    .trace-comparison-grid {
        grid-template-columns: 1fr;
    }

    .diagnostic-item {
        grid-template-columns: 1fr;
    }
}
</style>
