<template>
    <div class="nexus-preset-manager">
        <!-- 模块 1: 自定义 API 配置台 -->
        <div class="section-container lw-card">
            <div class="section-header">
                <div class="section-title">
                    <div class="icon-wrap">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2"
                            fill="none">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="2" y1="12" x2="22" y2="12"></line>
                            <path
                                d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z">
                            </path>
                        </svg>
                    </div>
                    <div class="title-meta">
                        <span class="main-title">自定义 API 接口</span>
                        <span class="sub-hint">配置跨域直连端点以突破 ST 限制</span>
                    </div>
                </div>
                <button class="lw-btn lw-btn-secondary lw-btn-small" @click="createApi">
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5"
                        fill="none">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    添加接口
                </button>
            </div>

            <div class="api-list" v-if="customApis.length > 0">
                <div class="api-item" v-for="(api, aIndex) in customApis" :key="api.id">
                    <div class="item-header">
                        <input type="text" v-model="api.name" class="name-edit-input" @change="saveApis"
                            placeholder="接口简称 (如: DeepSeek-V3)" />
                        <button class="icon-btn delete" @click="deleteApi(aIndex)" title="删除">
                            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2"
                                fill="none">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path
                                    d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2">
                                </path>
                            </svg>
                        </button>
                    </div>
                    <div class="item-fields">
                        <div class="field-item">
                            <label>Provider</label>
                            <select v-model="api.type" class="lw-select" @change="saveApis">
                                <option value="openai_compatible">OpenAI 兼容</option>
                                <option value="openai">OpenAI 官方</option>
                                <option value="anthropic">Anthropic</option>
                                <option value="google">Google</option>
                            </select>
                        </div>
                        <div class="field-item">
                            <label>Base URL</label>
                            <input v-if="api.type === 'openai' || api.type === 'openai_compatible'" type="text"
                                v-model="api.url" class="lw-input" @change="saveApis"
                                placeholder="https://api.deepseek.com/v1" />
                            <div v-else class="st-indicator">该 Provider 无需 Base URL</div>
                        </div>
                        <div class="field-item">
                            <label>API Key</label>
                            <input type="password" v-model="api.key" class="lw-input" @change="saveApis"
                                placeholder="sk-..." />
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 模块 2: Nexus 路由编排 -->
        <div class="section-container lw-card">
            <div class="section-header vertical">
                <div class="header-main">
                    <div class="section-title">
                        <div class="icon-wrap accent">
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2"
                                fill="none">
                                <circle cx="12" cy="12" r="3"></circle>
                                <path
                                    d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z">
                                </path>
                            </svg>
                        </div>
                        <div class="title-meta">
                            <span class="main-title">Nexus 路由编排</span>
                            <span class="sub-hint">组合多个 API 实现高可用备用方案</span>
                        </div>
                    </div>
                </div>

                <div class="header-controls">
                    <div class="control-item">
                        <span class="control-label">传输模式:</span>
                        <select v-model="useSSE" @change="saveFlags" class="lw-select compact">
                            <option :value="true">SSE 流式 (推荐)</option>
                            <option :value="false">轮询 (兼容模式)</option>
                        </select>
                    </div>
                    <button class="lw-btn lw-btn-primary lw-btn-small" @click="createPreset">
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5"
                            fill="none">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        新建编排
                    </button>
                </div>
            </div>

            <div class="preset-list" v-if="presets.length > 0">
                <div class="preset-group" v-for="(preset, pIndex) in presets" :key="preset.id">
                    <div class="group-header">
                        <input type="text" v-model="preset.name" class="name-edit-input" @change="save"
                            placeholder="预设名称..." />
                        <button class="icon-btn delete" @click="deletePreset(pIndex)" title="删除预设">
                            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2"
                                fill="none">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path
                                    d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2">
                                </path>
                            </svg>
                        </button>
                    </div>

                    <div class="node-stack">
                        <TransitionGroup name="node-list">
                            <div 
                                v-for="(node, nIndex) in preset.nodes" 
                                :key="node.id" 
                                class="node-item"
                                :class="{ 
                                    'is-dragging': draggingNodeId === node.id,
                                    'is-placeholder': draggingNodeId && draggingNodeId !== node.id && dragCurrentIndex === nIndex
                                }"
                            >
                                <div class="node-main">
                                    <div class="node-field-group">
                                        <div class="field-item">
                                            <label>逻辑节点 (API 来源)</label>
                                            <select v-model="node.provider" class="lw-select" @change="save">
                                                <option value="st_current">【ST 当前界面模型】(原生后端)</option>
                                                <optgroup label="前端直连 (自定义 API)">
                                                    <option v-for="api in customApis" :key="api.id" :value="api.id">
                                                        ⚡ {{ api.name }}
                                                    </option>
                                                </optgroup>
                                            </select>
                                        </div>
                                        <div class="field-item" v-if="node.provider !== 'st_current'">
                                            <label>具体模型名称</label>
                                            <div class="model-picker-wrap" :class="{ 'is-open': openDropdownId === node.id }">
                                                <div class="picker-trigger">
                                                    <input type="text" v-model="node.model"
                                                        class="lw-input" @change="save" placeholder="手动输入或点击选择..." />
                                                    <button class="picker-expand-btn" @click.stop="e => toggleDropdown(node.id, e)">
                                                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none">
                                                            <polyline points="6 9 12 15 18 9"></polyline>
                                                        </svg>
                                                    </button>
                                                    <button class="icon-btn refresh" :title="fetchedModels[node.id] ? '刷新列表' : '拉取列表'"
                                                        @click.stop="fetchModels(node)">
                                                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor"
                                                            stroke-width="2" fill="none">
                                                            <polyline points="23 4 23 10 17 10"></polyline>
                                                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                                                        </svg>
                                                    </button>
                                                </div>

                                                <!-- 自定义下拉视图 -->
                                                <div v-if="openDropdownId === node.id" 
                                                    class="model-dropdown-portal"
                                                    :class="{ 'is-flipped': dropdownFlipped }"
                                                >
                                                    <div class="dropdown-header">
                                                        <div class="search-box">
                                                            <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="3" fill="none">
                                                                <circle cx="11" cy="11" r="8"></circle>
                                                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                                            </svg>
                                                            <input type="text" v-model="modelSearchQuery" placeholder="搜索模型..." autofocus @click.stop />
                                                        </div>
                                                        <button class="sort-toggle" @click.stop="modelSortAlpha = !modelSortAlpha" :title="modelSortAlpha ? '取消排序' : '字母排序'">
                                                            <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" :style="{ color: modelSortAlpha ? 'var(--lw-primary)' : '' }">
                                                                <line x1="4" y1="6" x2="20" y2="6"></line>
                                                                <line x1="4" y1="12" x2="14" y2="12"></line>
                                                                <line x1="4" y1="18" x2="8" y2="18"></line>
                                                            </svg>
                                                        </button>
                                                    </div>

                                                    <div class="dropdown-list">
                                                        <div v-if="Object.keys(getFilteredModels(node.id)).length === 0" class="no-results">
                                                            未找到匹配模型
                                                        </div>
                                                        <div v-for="(models, group) in getFilteredModels(node.id)" :key="group" class="model-group">
                                                            <div class="group-label">{{ group }}</div>
                                                            <div v-for="m in models" :key="String(m.value)" 
                                                                class="model-option"
                                                                :class="{ 'is-selected': node.model === String(m.value) }"
                                                                @click="selectModel(node, String(m.value))"
                                                            >
                                                                <span class="opt-text">{{ m.text }}</span>
                                                                <span class="opt-val">{{ String(m.value) }}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="field-item" v-else>
                                            <label>模型状态</label>
                                            <div class="st-indicator">跟随原生 ST 动态选择</div>
                                        </div>
                                    </div>
                                </div>

                                <div class="node-footer">
                                    <div class="footer-left">
                                        <div class="node-index">#{{ nIndex + 1 }}</div>
                                    </div>
                                    
                                    <div 
                                        class="node-drag-handle" 
                                        @pointerdown="e => startDrag(e, preset, nIndex)"
                                        title="拖拽排序"
                                    >
                                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none">
                                            <circle cx="9" cy="8" r="1.2"></circle>
                                            <circle cx="12" cy="8" r="1.2"></circle>
                                            <circle cx="15" cy="8" r="1.2"></circle>
                                            <circle cx="9" cy="16" r="1.2"></circle>
                                            <circle cx="12" cy="16" r="1.2"></circle>
                                            <circle cx="15" cy="16" r="1.2"></circle>
                                        </svg>
                                    </div>

                                    <div class="footer-right">
                                        <div class="node-sort-actions">
                                            <button @click="moveNode(preset, nIndex, 'up')" :disabled="nIndex === 0" title="上移">
                                                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="3" fill="none">
                                                    <polyline points="18 15 12 9 6 15"></polyline>
                                                </svg>
                                            </button>
                                            <button @click="moveNode(preset, nIndex, 'down')" :disabled="nIndex === preset.nodes.length - 1" title="下移">
                                                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="3" fill="none">
                                                    <polyline points="6 9 12 15 18 9"></polyline>
                                                </svg>
                                            </button>
                                        </div>
                                        <div class="footer-divider"></div>
                                        <button class="icon-btn delete" @click="deleteNode(preset, nIndex)" title="移除节点">
                                            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                                                <polyline points="3 6 5 6 21 6"></polyline>
                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </TransitionGroup>
                    </div>

                    <button class="lw-btn lw-btn-ghost lw-btn-small add-node-btn" @click="addNode(preset)">
                        <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5"
                            fill="none">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        添加备用节点 (Fallback)
                    </button>
                </div>
            </div>

            <div class="empty-state" v-else>
                <div class="empty-icon">
                    <svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" stroke-width="1.5"
                        fill="none">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                    </svg>
                </div>
                <p>暂无编排预设</p>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { lwStorage } from '../../api/storage';
import { llmEngine } from '../../api/llmEngine';
import { LuminaWeaveAPI } from '../../api/index';
import { gsap } from 'gsap';

const lwApi = (window as any).LuminaWeave as LuminaWeaveAPI;

interface NexusApi {
    id: string;
    name: string;
    type: 'openai' | 'openai_compatible' | 'anthropic' | 'google';
    url: string;
    key: string;
}

interface NexusNode {
    id: string;
    provider: string;
    model: string;
}

interface NexusPreset {
    id: string;
    name: string;
    nodes: NexusNode[];
}

interface ModelOption {
    value: string | number;
    text: string;
}

const presets = ref<NexusPreset[]>([]);
const customApis = ref<NexusApi[]>([]);
const useSSE = ref<boolean>(true);

const _generateId = () => 'nx_' + Math.random().toString(36).substring(2, 11);

onMounted(() => {
    // 从全局存储加载 API 配置
    const loadedApis = lwStorage.get('nexus.apis', [], 'Global');
    customApis.value = JSON.parse(JSON.stringify(loadedApis));
    for (const api of customApis.value) {
        if (!api.type) api.type = 'openai_compatible';
    }

    // 从全局存储加载 Preset 配置
    const loadedPresets = lwStorage.get('nexus.presets', [], 'Global');
    presets.value = JSON.parse(JSON.stringify(loadedPresets));
    console.log('[LuminaWeave] presets', presets.value);
    console.log('[LuminaWeave] customApis', customApis.value);

    useSSE.value = lwStorage.get('nexus.useSSE', true, 'Global') === true;
});

const saveApis = () => {
    void lwStorage.set('nexus.apis', JSON.parse(JSON.stringify(customApis.value)), 'Global');
};

const save = () => {
    void lwStorage.set('nexus.presets', JSON.parse(JSON.stringify(presets.value)), 'Global');
};

const saveFlags = () => {
    void lwStorage.set('nexus.useSSE', useSSE.value, 'Global');
};

const createApi = () => {
    customApis.value.push({
        id: _generateId(),
        name: '未命名接口 ' + (customApis.value.length + 1),
        type: 'openai_compatible',
        url: 'https://api.openai.com/v1',
        key: ''
    });
    saveApis();
};

const deleteApi = (index: number) => {
    if (confirm('确定要删除这个接口吗？如果您此前在预设中使用了该接口，它将被自动丢弃。')) {
        customApis.value.splice(index, 1);
        saveApis();
    }
};

const createPreset = () => {
    presets.value.push({
        id: _generateId(),
        name: '未命名编排 ' + (presets.value.length + 1),
        nodes: [
            { id: _generateId(), provider: 'st_current', model: '' }
        ]
    });
    save();
};

const deletePreset = (index: number) => {
    if (confirm('确定要删除这个预设吗？')) {
        presets.value.splice(index, 1);
        save();
    }
};

const addNode = (preset: NexusPreset) => {
    preset.nodes.push({ id: _generateId(), provider: 'st_current', model: '' });
    save();
};

const deleteNode = (preset: NexusPreset, index: number) => {
    preset.nodes.splice(index, 1);
    save();
};

const moveNode = (preset: NexusPreset, index: number, direction: 'up' | 'down' | 'top') => {
    const nodes = preset.nodes;
    if (direction === 'up' && index > 0) {
        [nodes[index], nodes[index - 1]] = [nodes[index - 1], nodes[index]];
    } else if (direction === 'down' && index < nodes.length - 1) {
        [nodes[index], nodes[index + 1]] = [nodes[index + 1], nodes[index]];
    } else if (direction === 'top' && index > 0) {
        const item = nodes.splice(index, 1)[0];
        nodes.unshift(item);
    }
    save();
};

// --- 重型手动拖拽交互引擎 (Workspace 捕获模式) ---
const draggingNodeId = ref<string | null>(null);
const dragCurrentIndex = ref<number>(-1);
let dragStartClientY = 0;
let nodeHeights: number[] = [];
let nodeOffsets: number[] = [];
let activePreset: NexusPreset | null = null;
let currentPointerId: number | null = null;

const startDrag = (event: PointerEvent, preset: NexusPreset, index: number) => {
    // 捕获指针，确保在容器外部也能响应
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
    currentPointerId = event.pointerId;

    activePreset = preset;
    draggingNodeId.value = preset.nodes[index].id;
    dragCurrentIndex.value = index;
    dragStartClientY = event.clientY;

    // 获取所有节点的 Y 轴基准线，用于计算交换逻辑
    const container = target.closest('.node-stack');
    if (container) {
        const children = Array.from(container.children) as HTMLElement[];
        nodeHeights = children.map(c => c.offsetHeight);
        const rect = container.getBoundingClientRect();
        nodeOffsets = children.map(c => c.getBoundingClientRect().top - rect.top);
    }

    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopDrag);
    window.addEventListener('pointercancel', stopDrag);
};

const handlePointerMove = (event: PointerEvent) => {
    if (currentPointerId !== null && event.pointerId !== currentPointerId) return;
    if (!activePreset || draggingNodeId.value === null) return;

    const dy = event.clientY - dragStartClientY;
    const currentIndex = activePreset.nodes.findIndex(n => n.id === draggingNodeId.value);
    if (currentIndex === -1) return;

    // 确定目标索引
    let targetIndex = currentIndex;
    const itemHeight = nodeHeights[currentIndex] || 60;
    
    // 向下移动探测
    if (dy > itemHeight * 0.6 && currentIndex < activePreset.nodes.length - 1) {
        targetIndex = currentIndex + 1;
    } 
    // 向上移动探测
    else if (dy < -itemHeight * 0.6 && currentIndex > 0) {
        targetIndex = currentIndex - 1;
    }

    if (targetIndex !== currentIndex) {
        const nodes = activePreset.nodes;
        // 执行交换
        const item = nodes.splice(currentIndex, 1)[0];
        nodes.splice(targetIndex, 0, item);
        
        // 重置起点，实现连续平滑滑动
        dragStartClientY = event.clientY;
        dragCurrentIndex.value = targetIndex;
    }
};

const stopDrag = (event: PointerEvent) => {
    if (currentPointerId !== null && event.pointerId !== currentPointerId) return;
    
    // 释放捕获
    if (draggingNodeId.value) {
        const el = document.querySelector(`[key="${draggingNodeId.value}"]`) as HTMLElement;
        if (el?.releasePointerCapture) el.releasePointerCapture(event.pointerId);
    }

    draggingNodeId.value = null;
    dragCurrentIndex.value = -1;
    activePreset = null;
    currentPointerId = null;
    document.body.style.userSelect = '';
    
    save();
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', stopDrag);
    window.removeEventListener('pointercancel', stopDrag);
};

const fetchedModels = ref<Record<string, Record<string, ModelOption[]>>>({});

// --- 自定义模型选择器状态 (Model Picker) ---
const openDropdownId = ref<string | null>(null);
const modelSearchQuery = ref("");
const modelSortAlpha = ref(false);
const dropdownFlipped = ref(false);

const toggleDropdown = (nodeId: string, event: MouseEvent) => {
    if (openDropdownId.value === nodeId) {
        openDropdownId.value = null;
    } else {
        openDropdownId.value = nodeId;
        modelSearchQuery.value = ""; // 开启时清空搜索
        
        // 智能定位：检测底部空间
        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        dropdownFlipped.value = spaceBelow < 250; // 如果下方空间少于 250px，则向上弹出
    }
};

const selectModel = (node: NexusNode, value: string) => {
    node.model = value;
    openDropdownId.value = null;
    save();
};

const getFilteredModels = (nodeId: string) => {
    const rawGroups = fetchedModels.value[nodeId];
    if (!rawGroups) return {};

    const query = modelSearchQuery.value.toLowerCase().trim();
    const result: Record<string, ModelOption[]> = {};

    for (const [groupName, models] of Object.entries(rawGroups)) {
        let filtered = models;
        if (query) {
            filtered = models.filter(m => 
                m.text.toLowerCase().includes(query) || 
                String(m.value).toLowerCase().includes(query)
            );
        }

        if (filtered.length > 0) {
            // 排序逻辑
            if (modelSortAlpha.value) {
                filtered = [...filtered].sort((a, b) => a.text.localeCompare(b.text));
            }
            result[groupName] = filtered;
        }
    }
    return result;
};

// 全局点击关闭
onMounted(() => {
    window.addEventListener('click', (e: MouseEvent) => {
        const path = e.composedPath();
        const isInternal = path.some(el => 
            (el as HTMLElement).classList?.contains('model-picker-wrap') ||
            (el as HTMLElement).classList?.contains('model-dropdown-portal')
        );
        if (!isInternal) {
            openDropdownId.value = null;
        }
    });

    // Esc 关闭
    window.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Escape') openDropdownId.value = null;
    });
});

const fetchModels = async (node: NexusNode) => {
    if (node.provider === 'st_current') {
        const lw = (window as any).LuminaWeave as LuminaWeaveAPI | undefined;
        lw?.showToast('选择原生 ST 后无需手动拉取模型。', 'warning');
        return;
    }

    const targetApi = customApis.value.find(a => a.id === node.provider);
    if (!targetApi) {
        const lw = (window as any).LuminaWeave as LuminaWeaveAPI | undefined;
        lw?.showToast('所选接口不存在，请先配置！', 'error');
        return;
    }

    if (!targetApi.key) {
        const lw = (window as any).LuminaWeave as LuminaWeaveAPI | undefined;
        lw?.showToast('该接口的地址或密钥为空！', 'warning');
        return;
    }

    if (targetApi.type !== 'openai' && targetApi.type !== 'openai_compatible') {
        const lw = (window as any).LuminaWeave as LuminaWeaveAPI | undefined;
        lw?.showToast('该 Provider 暂不支持自动拉取模型列表，请手动填写模型名。', 'warning');
        return;
    }

    if (!targetApi.url) {
        const lw = (window as any).LuminaWeave as LuminaWeaveAPI | undefined;
        lw?.showToast('该接口的地址为空！', 'warning');
        return;
    }

    const models = await llmEngine.fetchProviderModels(targetApi.id, targetApi.name) as Record<string, ModelOption[]>;

    if (Object.keys(models).length > 0) {
        fetchedModels.value[node.id] = models;
        const lw = (window as any).LuminaWeave as LuminaWeaveAPI | undefined;
        lw?.showToast(`成功为您拉取 [${targetApi.name}] 模型列表！`, 'success');

        if (!node.model) {
            const firstGroup = Object.values(models)[0];
            if (firstGroup && firstGroup.length > 0) {
                node.model = String(firstGroup[0].value);
                save();
            }
        }
    } else {
        const errMsg = '拉取大模型失败，跨域报错或密钥不正确。请按 F12 检查控制台网络拦截。';
        const lw = (window as any).LuminaWeave as LuminaWeaveAPI | undefined;
        lw?.showToast(errMsg, 'error', '获取失败', 5000);
    }
};
</script>

<style scoped>
.nexus-preset-manager {
    display: flex;
    flex-direction: column;
    gap: 24px;
}

.section-container {
    display: flex;
    flex-direction: column;
    padding: 20px;
    gap: 20px;
}

.section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--lw-border-subtle);
}

.section-header.vertical {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
}

.header-main {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
}

.header-controls {
    display: flex;
    align-items: center;
    gap: 20px;
    width: 100%;
    padding: 10px 14px;
    background: var(--lw-bg-subtle);
    border-radius: var(--lw-radius-md);
    border: 1px solid var(--lw-border-subtle);
}

.control-item {
    display: flex;
    align-items: center;
    gap: 8px;
}

.control-label {
    font-size: 11px;
    font-weight: 700;
    color: var(--lw-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    white-space: nowrap;
}

.lw-select.compact {
    height: 28px;
    font-size: 11px;
    padding: 0 8px;
    width: auto;
    min-width: 120px;
}

.section-title {
    display: flex;
    align-items: center;
    gap: 12px;
}

.icon-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: var(--lw-bg-app);
    color: var(--lw-text-muted);
    border-radius: var(--lw-radius-sm);
    border: 1px solid var(--lw-border-subtle);
}

.icon-wrap.accent {
    border-color: #5c8bf633;
    color: var(--lw-primary);
    border-radius: var(--lw-radius-sm);
    background: #5c73f614;
}

.title-meta {
    display: flex;
    flex-direction: column;
}

.main-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--lw-text-main);
}

.sub-hint {
    font-size: 11px;
    color: var(--lw-text-muted);
}

/* 列表样式 */
.api-list,
.preset-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.api-item,
.preset-group {
    background: var(--lw-bg-subtle);
    border: 1px solid var(--lw-border-subtle);
    border-radius: var(--lw-radius-sm);
    padding: 14px;
    transition: var(--lw-transition);
}

.api-item:hover,
.preset-group:hover {
    border-color: var(--lw-border-base);
    background: var(--lw-bg-hover);
}

.item-header,
.group-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px dashed var(--lw-border-subtle);
}

.name-edit-input {
    flex: 1;
    background: transparent;
    border: 1px solid transparent;
    font-size: 13px;
    font-weight: 600;
    padding: 4px 8px;
    border-radius: 4px;
    color: var(--lw-text-main);
    outline: none;
    transition: var(--lw-transition);
}

.name-edit-input:hover {
    background: var(--lw-bg-surface);
    border-color: var(--lw-border-subtle);
}

.name-edit-input:focus {
    background: var(--lw-bg-surface);
    border-color: var(--lw-accent);
}

.item-fields {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
}

.field-item {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.field-item label {
    font-size: 10px;
    font-weight: 700;
    color: var(--lw-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.node-stack {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.node-item {
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: 0;
    background: var(--lw-bg-surface);
    border: 1px solid var(--lw-border-subtle);
    border-radius: var(--lw-radius-md);
    transition: all 0.25s cubic-bezier(0.2, 0, 0.2, 1);
    cursor: default;
    position: relative;
    overflow: visible; /* 为了让下拉框不被截断 */
}

.node-item.is-dragging {
    z-index: 10;
    border-color: var(--lw-primary);
    box-shadow: 0 8px 24px rgba(var(--lw-primary-rgb), 0.15);
    background: var(--lw-bg-hover);
    transform: scale(1.02);
}

.node-item.is-placeholder {
    opacity: 0.4;
    border-style: dashed;
}

/* TransitionGroup FLIP 动画 */
.node-list-move {
    transition: transform 0.3s cubic-bezier(0.2, 0, 0.2, 1);
}

.node-list-enter-active,
.node-list-leave-active {
    transition: all 0.25s ease;
}

.node-list-enter-from,
.node-list-leave-to {
    opacity: 0;
    transform: translateX(10px);
}

.node-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    width: 100%;
}

.node-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 42px;
    padding: 0 12px;
    background: var(--lw-bg-subtle);
    border-top: 1px dashed var(--lw-border-subtle);
    border-bottom-left-radius: var(--lw-radius-md);
    border-bottom-right-radius: var(--lw-radius-md);
    user-select: none;
}

.footer-left, .footer-right {
    display: flex;
    align-items: center;
    gap: 12px;
}

.footer-divider {
    width: 1px;
    height: 16px;
    background: var(--lw-border-subtle);
    margin: 0 4px;
}

.node-drag-handle {
    cursor: grab;
    color: var(--lw-text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 32px;
    border-radius: 6px;
    transition: var(--lw-transition);
    touch-action: none;
    margin: 0 auto; /* 居中 */
}

.node-drag-handle:hover {
    background: var(--lw-bg-active);
    color: var(--lw-primary);
}

.node-drag-handle:active {
    cursor: grabbing;
    background: var(--lw-primary);
    color: white;
}

.node-index {
    font-size: 9px;
    font-weight: 900;
    color: var(--lw-text-muted);
    background: var(--lw-bg-surface);
    width: 28px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    border: 1px solid var(--lw-border-subtle);
    opacity: 0.8;
}

.node-sort-actions {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.node-sort-actions button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 14px;
    padding: 0;
    background: transparent;
    border: none;
    color: var(--lw-text-muted);
    cursor: pointer;
    transition: var(--lw-transition);
}

.node-sort-actions button:hover:not(:disabled) {
    color: var(--lw-primary);
    transform: translateY(-1px);
}

.node-sort-actions button:hover:not(:disabled):last-child {
    transform: translateY(1px);
}

.node-sort-actions button:disabled {
    opacity: 0.1;
    cursor: not-allowed;
}

.model-picker-wrap {
    position: relative;
    width: 100%;
}

.picker-trigger {
    display: flex;
    gap: 2px;
    align-items: center;
    background: var(--lw-bg-app);
    border-radius: var(--lw-radius-sm);
    border: 1px solid var(--lw-border-subtle);
    padding: 1px;
    transition: var(--lw-transition);
}

.picker-trigger:focus-within {
    border-color: var(--lw-primary);
    box-shadow: 0 0 0 3px rgba(var(--lw-primary-rgb), 0.1);
}

.picker-trigger .lw-input {
    border: none;
    background: transparent;
    height: 32px;
    flex: 1;
}

.picker-expand-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    background: transparent;
    color: var(--lw-text-muted);
    cursor: pointer;
    border-radius: 6px;
    transition: var(--lw-transition);
}

.picker-expand-btn:hover {
    background: var(--lw-bg-hover);
    color: var(--lw-text-main);
}

.picker-trigger .refresh {
    margin-right: 4px;
}

/* 下拉菜单门户 */
.model-dropdown-portal {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    width: 100%;
    min-width: 280px;
    max-width: 450px;
    max-height: 400px;
    background: var(--lw-bg-surface);
    border: 1px solid var(--lw-border-base);
    border-radius: var(--lw-radius-md);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2);
    z-index: 9999;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: dropdown-fade-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

@media (max-width: 600px) {
    .model-dropdown-portal {
        position: fixed;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) !important;
        width: calc(100vw - 32px);
        max-height: 70vh;
        box-shadow: 0 0 0 100vh rgba(0,0,0,0.5); /* 遮罩效果 */
    }
    
    .model-dropdown-portal.is-flipped {
        bottom: auto;
    }
}

@keyframes dropdown-fade-in {
    from { opacity: 0; transform: translateY(10px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
}

.dropdown-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    border-bottom: 1px solid var(--lw-border-subtle);
    background: var(--lw-bg-subtle);
}

.search-box {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--lw-bg-app);
    border: 1px solid var(--lw-border-subtle);
    border-radius: 6px;
    padding: 0 10px;
}

.search-box input {
    width: 100%;
    height: 32px;
    border: none;
    background: transparent;
    font-size: 13px;
    color: var(--lw-text-main);
    outline: none;
}

.sort-toggle {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--lw-border-subtle);
    background: var(--lw-bg-app);
    border-radius: 6px;
    cursor: pointer;
    color: var(--lw-text-muted);
    transition: var(--lw-transition);
}

.sort-toggle:hover {
    border-color: var(--lw-primary);
}

.dropdown-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px 0;
}

.no-results {
    padding: 32px;
    text-align: center;
    color: var(--lw-text-muted);
    font-size: 13px;
}

.model-group {
    margin-bottom: 8px;
}

.group-label {
    padding: 6px 16px;
    font-size: 10px;
    font-weight: 800;
    color: var(--lw-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    background: var(--lw-bg-subtle);
    position: sticky;
    top: -8px;
    z-index: 10;
}

.model-option {
    display: flex;
    flex-direction: column;
    padding: 8px 16px;
    cursor: pointer;
    transition: var(--lw-transition);
}

.model-option:hover {
    background: var(--lw-bg-hover);
}

.model-option.is-selected {
    background: var(--lw-primary-bg);
}

.model-option.is-selected .opt-text {
    color: var(--lw-primary);
    font-weight: 700;
}

.opt-text {
    font-size: 13px;
    color: var(--lw-text-main);
    margin-bottom: 2px;
}

.opt-val {
    font-size: 11px;
    color: var(--lw-text-muted);
    font-family: monospace;
}
.node-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.node-field-group {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 2px 0;
}

.node-footer-actions {
    display: flex;
    justify-content: center;
    padding-top: 10px;
    margin-top: 4px;
    border-top: 1px dashed var(--lw-border-subtle);
}

.st-indicator {
    padding: 8px 12px;
    background: var(--lw-bg-app);
    border: 1px solid var(--lw-border-subtle);
    border-radius: var(--lw-radius-sm);
    font-size: 11px;
    color: var(--lw-text-muted);
    height: 36px;
    display: flex;
    align-items: center;
}

.icon-btn {
    padding: 6px;
    border-radius: 6px;
    color: var(--lw-text-muted);
    background: transparent;
    border: none;
    cursor: pointer;
    transition: var(--lw-transition);
}

.icon-btn:hover {
    background: var(--lw-bg-active);
    color: var(--lw-text-main);
}

.icon-btn.delete:hover {
    color: #ef4444;
    background: #fef2f2;
}

.add-node-btn {
    margin-top: 12px;
    width: 100%;
    border: 1px dashed var(--lw-border-base) !important;
}

.empty-state {
    padding: 40px;
    text-align: center;
    color: var(--lw-text-muted);
}

.empty-icon {
    margin-bottom: 12px;
    opacity: 0.5;
}
</style>
