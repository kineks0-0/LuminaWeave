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
                            <label>Base URL</label>
                            <input type="text" v-model="api.url" class="lw-input" @change="saveApis"
                                placeholder="https://api.deepseek.com/v1" />
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
            <div class="section-header">
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
                <button class="lw-btn lw-btn-primary lw-btn-small" @click="createPreset">
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5"
                        fill="none">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    新建编排
                </button>
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
                        <div class="node-item" v-for="(node, nIndex) in preset.nodes" :key="node.id">
                            <div class="node-index">#{{ nIndex + 1 }}</div>
                            <div class="node-main">
                                <div class="node-row">
                                    <div class="field-item flex-2">
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
                                    <div class="field-item flex-3" v-if="node.provider !== 'st_current'">
                                        <label>具体模型名称</label>
                                        <div class="model-picker-wrap">
                                            <input v-if="!fetchedModels[node.id]" type="text" v-model="node.model"
                                                class="lw-input" @change="save" placeholder="gpt-4o, claude-3-5..." />
                                            <select v-else :value="node.model" class="lw-select"
                                                @change="e => { node.model = (e.target as HTMLSelectElement).value; save(); }">
                                                <optgroup v-for="(groupModels, groupName) in fetchedModels[node.id]"
                                                    :key="groupName" :label="groupName">
                                                    <option v-for="m in groupModels" :key="String(m.value)"
                                                        :value="String(m.value)">{{ m.text }}</option>
                                                </optgroup>
                                            </select>
                                            <button class="icon-btn" :title="fetchedModels[node.id] ? '刷新列表' : '拉取列表'"
                                                @click="fetchModels(node)">
                                                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor"
                                                    stroke-width="2" fill="none">
                                                    <polyline points="23 4 23 10 17 10"></polyline>
                                                    <polyline points="1 20 1 14 7 14"></polyline>
                                                    <path
                                                        d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15">
                                                    </path>
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                    <div class="field-item flex-3" v-else>
                                        <label>模型状态</label>
                                        <div class="st-indicator">跟随原生 ST 动态选择</div>
                                    </div>
                                    <button class="icon-btn delete-node" @click="deleteNode(preset, nIndex)" title="移除">
                                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor"
                                            stroke-width="2" fill="none">
                                            <line x1="18" y1="6" x2="6" y2="18"></line>
                                            <line x1="6" y1="6" x2="18" y2="18"></line>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
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

const lwApi = (window as any).LuminaWeave as LuminaWeaveAPI;

interface NexusApi {
    id: string;
    name: string;
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

const _generateId = () => 'nx_' + Math.random().toString(36).substring(2, 11);

onMounted(() => {
    // 从全局存储加载 API 配置
    const loadedApis = lwStorage.get('nexus.apis', [], 'Global');
    customApis.value = JSON.parse(JSON.stringify(loadedApis));

    // 从全局存储加载 Preset 配置
    const loadedPresets = lwStorage.get('nexus.presets', [], 'Global');
    presets.value = JSON.parse(JSON.stringify(loadedPresets));
    console.log('[LuminaWeave] presets', presets.value);
    console.log('[LuminaWeave] customApis', customApis.value);
});

const saveApis = () => {
    (lwStorage as any).set('nexus.apis', JSON.parse(JSON.stringify(customApis.value)), 'Global');
};

const save = () => {
    (lwStorage as any).set('nexus.presets', JSON.parse(JSON.stringify(presets.value)), 'Global');
};

const createApi = () => {
    customApis.value.push({
        id: _generateId(),
        name: '未命名接口 ' + (customApis.value.length + 1),
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

const fetchedModels = ref<Record<string, Record<string, ModelOption[]>>>({});

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

    if (!targetApi.url || !targetApi.key) {
        const lw = (window as any).LuminaWeave as LuminaWeaveAPI | undefined;
        lw?.showToast('该接口的地址或密钥为空！', 'warning');
        return;
    }

    // 调用新的大前端直连原生获取法
    const models = await (llmEngine as any).fetchCustomModelsApi(targetApi.url, targetApi.key, targetApi.name) as Record<string, ModelOption[]>;

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
    padding-bottom: 12px;
    border-bottom: 1px solid var(--lw-border-subtle);
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
    /* color: var(--lw-purple);
    background: rgba(139, 92, 246, 0.08);
    border-color: rgba(139, 92, 246, 0.2); */
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

.field-item.flex-2 {
    flex: 2;
}

.field-item.flex-3 {
    flex: 3;
}

.field-item label {
    font-size: 10px;
    font-weight: 700;
    color: var(--lw-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

/* 节点堆栈 */
.node-stack {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.node-item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
}

.node-index {
    font-size: 10px;
    font-weight: 800;
    color: var(--lw-text-inverse);
    background: var(--lw-text-muted);
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    flex-shrink: 0;
    margin-top: 24px;
}

.node-main {
    flex: 1;
    background: var(--lw-bg-surface);
    border: 1px solid var(--lw-border-subtle);
    border-radius: var(--lw-radius-sm);
    padding: 10px;
}

.node-row {
    display: flex;
    align-items: flex-end;
    gap: 12px;
}

.model-picker-wrap {
    display: flex;
    gap: 6px;
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
