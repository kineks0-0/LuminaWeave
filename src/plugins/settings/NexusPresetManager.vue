<template>
    <div class="nexus-preset-manager tw:flex tw:flex-col tw:gap-6">
        <!-- 模块 1: 自定义 API 配置台 -->
        <div class="section-container lw-card tw:flex tw:flex-col tw:gap-5 tw:p-5">
            <div class="section-header tw:flex tw:items-center tw:justify-between tw:border-b tw:border-lw-border-subtle tw:pb-4">
                <div class="section-title tw:flex tw:items-center tw:gap-3">
                    <div class="icon-wrap tw:flex tw:size-8 tw:items-center tw:justify-center tw:rounded-lw-sm tw:border tw:border-lw-border-subtle tw:bg-lw-surface tw:text-lw-text-muted">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2"
                            fill="none">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="2" y1="12" x2="22" y2="12"></line>
                            <path
                                d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z">
                            </path>
                        </svg>
                    </div>
                    <div class="title-meta tw:flex tw:flex-col">
                        <span class="main-title tw:text-[length:var(--lw-type-title-small-size)] tw:font-[var(--lw-type-title-small-weight)] tw:leading-[var(--lw-type-title-small-line-height)] tw:tracking-[var(--lw-type-title-small-tracking)] tw:text-lw-text tw:text-balance">自定义 API 接口</span>
                        <span class="sub-hint tw:text-[length:var(--lw-type-body-small-size)] tw:font-[var(--lw-type-body-small-weight)] tw:leading-[var(--lw-type-body-small-line-height)] tw:tracking-[var(--lw-type-body-small-tracking)] tw:text-lw-text-muted tw:text-pretty">配置跨域直连端点以突破 ST 限制</span>
                    </div>
                </div>
                <LuminaButton variant="soft" tone="neutral" size="sm" @click="createApi">
                    <Plus class="tw:size-3.5" aria-hidden="true" />
                    添加接口
                </LuminaButton>
            </div>

            <div v-if="customApis.length > 0" class="api-list tw:flex tw:flex-col tw:gap-4">
                <div
                    v-for="(api, aIndex) in customApis"
                    :key="api.id"
                    class="api-item tw:rounded-lw-sm tw:border tw:border-lw-border-subtle tw:bg-lw-subtle tw:p-3.5 tw:transition-[background-color,border-color] tw:hover:border-lw-border tw:hover:bg-lw-hover"
                >
                    <div class="item-header tw:mb-3 tw:flex tw:items-center tw:justify-between tw:gap-3 tw:border-b tw:border-dashed tw:border-lw-border-subtle tw:pb-2">
                        <input type="text" v-model="api.name" class="name-edit-input tw:flex-1 tw:rounded tw:border tw:border-transparent tw:bg-transparent tw:px-2 tw:py-1 tw:text-[length:var(--lw-type-title-small-size)] tw:font-[var(--lw-type-title-small-weight)] tw:leading-[var(--lw-type-title-small-line-height)] tw:tracking-[var(--lw-type-title-small-tracking)] tw:text-lw-text tw:outline-none tw:transition-[background-color,border-color] tw:hover:border-lw-border-subtle tw:hover:bg-lw-surface tw:focus:border-lw-accent tw:focus:bg-lw-surface" @change="saveApis"
                            placeholder="接口简称 (如: DeepSeek-V3)" />
                        <button
                            class="icon-btn delete tw:inline-flex tw:items-center tw:justify-center tw:rounded-md tw:border-0 tw:bg-transparent tw:p-1.5 tw:text-lw-text-muted tw:transition-[background-color,color] tw:hover:bg-red-50 tw:hover:text-red-600"
                            @click="deleteApi(aIndex)"
                            title="删除"
                            aria-label="删除接口"
                        >
                            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2"
                                fill="none">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path
                                    d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2">
                                </path>
                            </svg>
                        </button>
                    </div>
                    <div class="item-fields tw:grid tw:grid-cols-2 tw:gap-3">
                        <div class="field-item tw:flex tw:flex-col tw:gap-1.5">
                            <label class="tw:text-[length:var(--lw-type-label-small-size)] tw:font-[var(--lw-type-label-small-weight)] tw:leading-[var(--lw-type-label-small-line-height)] tw:tracking-[var(--lw-type-label-small-tracking)] tw:text-lw-text-muted tw:uppercase">Provider</label>
                            <select v-model="api.type" class="lw-select" @change="saveApis">
                                <option value="openai_compatible">OpenAI 兼容</option>
                                <option value="openai">OpenAI 官方</option>
                                <option value="anthropic">Anthropic</option>
                                <option value="google">Google</option>
                            </select>
                        </div>
                        <div class="field-item tw:flex tw:flex-col tw:gap-1.5">
                            <label class="tw:text-[length:var(--lw-type-label-small-size)] tw:font-[var(--lw-type-label-small-weight)] tw:leading-[var(--lw-type-label-small-line-height)] tw:tracking-[var(--lw-type-label-small-tracking)] tw:text-lw-text-muted tw:uppercase">Base URL</label>
                            <input v-if="api.type === 'openai' || api.type === 'openai_compatible'" type="text"
                                v-model="api.url" class="lw-input" @change="saveApis"
                                placeholder="https://api.deepseek.com/v1" />
                            <div v-else class="st-indicator tw:flex tw:h-9 tw:items-center tw:rounded-lw-sm tw:border tw:border-lw-border-subtle tw:bg-[var(--lw-bg-app)] tw:px-3 tw:py-2 tw:text-xs tw:text-lw-text-muted">该 Provider 无需 Base URL</div>
                        </div>
                        <div class="field-item tw:flex tw:flex-col tw:gap-1.5">
                            <label class="tw:text-[length:var(--lw-type-label-small-size)] tw:font-[var(--lw-type-label-small-weight)] tw:leading-[var(--lw-type-label-small-line-height)] tw:tracking-[var(--lw-type-label-small-tracking)] tw:text-lw-text-muted tw:uppercase">API Key</label>
                            <input type="password" v-model="api.key" class="lw-input" @change="saveApis"
                                placeholder="sk-..." />
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 模块 2: Nexus 路由编排 -->
        <div class="section-container lw-card tw:flex tw:flex-col tw:gap-5 tw:p-5">
            <div class="section-header vertical tw:flex tw:flex-col tw:items-start tw:gap-4 tw:border-b tw:border-lw-border-subtle tw:pb-4">
                <div class="header-main tw:flex tw:w-full tw:items-center tw:justify-between">
                    <div class="section-title tw:flex tw:items-center tw:gap-3">
                        <div class="icon-wrap tw:flex tw:size-8 tw:items-center tw:justify-center tw:rounded-lw-sm tw:border tw:border-[#5c8bf633] tw:bg-[#5c73f614] tw:text-lw-primary">
                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2"
                                fill="none">
                                <circle cx="12" cy="12" r="3"></circle>
                                <path
                                    d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z">
                                </path>
                            </svg>
                        </div>
                        <div class="title-meta tw:flex tw:flex-col">
                            <span class="main-title tw:text-[length:var(--lw-type-title-small-size)] tw:font-[var(--lw-type-title-small-weight)] tw:leading-[var(--lw-type-title-small-line-height)] tw:tracking-[var(--lw-type-title-small-tracking)] tw:text-lw-text tw:text-balance">Nexus 路由编排</span>
                            <span class="sub-hint tw:text-[length:var(--lw-type-body-small-size)] tw:font-[var(--lw-type-body-small-weight)] tw:leading-[var(--lw-type-body-small-line-height)] tw:tracking-[var(--lw-type-body-small-tracking)] tw:text-lw-text-muted tw:text-pretty">组合多个 API 实现高可用备用方案</span>
                        </div>
                    </div>
                </div>

                <div class="header-controls tw:flex tw:w-full tw:items-center tw:gap-5 tw:rounded-lw-md tw:border tw:border-lw-border-subtle tw:bg-lw-subtle tw:px-3.5 tw:py-2.5">
                    <div class="control-item tw:flex tw:items-center tw:gap-2">
                        <span class="control-label tw:whitespace-nowrap tw:text-[length:var(--lw-type-label-small-size)] tw:font-[var(--lw-type-label-small-weight)] tw:leading-[var(--lw-type-label-small-line-height)] tw:tracking-[var(--lw-type-label-small-tracking)] tw:text-lw-text-muted tw:uppercase">传输模式:</span>
                        <select v-model="useSSE" @change="saveFlags" class="lw-select tw:h-7 tw:w-auto tw:min-w-[120px] tw:px-2 tw:text-[length:var(--lw-type-label-small-size)] tw:font-[var(--lw-type-label-small-weight)] tw:leading-[var(--lw-type-label-small-line-height)] tw:tracking-[var(--lw-type-label-small-tracking)]">
                            <option :value="true">SSE 流式 (推荐)</option>
                            <option :value="false">轮询 (兼容模式)</option>
                        </select>
                    </div>
                    <LuminaButton variant="solid" tone="primary" size="sm" @click="createPreset">
                        <Plus class="tw:size-3.5" aria-hidden="true" />
                        新建编排
                    </LuminaButton>
                </div>
            </div>

            <div v-if="presets.length > 0" class="preset-list tw:flex tw:flex-col tw:gap-4">
                <div
                    v-for="(preset, pIndex) in presets"
                    :key="preset.id"
                    class="preset-group tw:rounded-lw-sm tw:border tw:border-lw-border-subtle tw:bg-lw-subtle tw:p-3.5 tw:transition-[background-color,border-color] tw:hover:border-lw-border tw:hover:bg-lw-hover"
                >
                    <div class="group-header tw:mb-3 tw:flex tw:items-center tw:justify-between tw:gap-3 tw:border-b tw:border-dashed tw:border-lw-border-subtle tw:pb-2">
                        <input type="text" v-model="preset.name" class="name-edit-input tw:flex-1 tw:rounded tw:border tw:border-transparent tw:bg-transparent tw:px-2 tw:py-1 tw:text-[length:var(--lw-type-title-small-size)] tw:font-[var(--lw-type-title-small-weight)] tw:leading-[var(--lw-type-title-small-line-height)] tw:tracking-[var(--lw-type-title-small-tracking)] tw:text-lw-text tw:outline-none tw:transition-[background-color,border-color] tw:hover:border-lw-border-subtle tw:hover:bg-lw-surface tw:focus:border-lw-accent tw:focus:bg-lw-surface" @change="save"
                            placeholder="预设名称..." />
                        <button
                            class="icon-btn delete tw:inline-flex tw:items-center tw:justify-center tw:rounded-md tw:border-0 tw:bg-transparent tw:p-1.5 tw:text-lw-text-muted tw:transition-[background-color,color] tw:hover:bg-red-50 tw:hover:text-red-600"
                            @click="deletePreset(pIndex)"
                            title="删除预设"
                            aria-label="删除预设"
                        >
                            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2"
                                fill="none">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path
                                    d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2">
                                </path>
                            </svg>
                        </button>
                    </div>

                    <div class="node-stack tw:flex tw:flex-col tw:gap-2">
                        <TransitionGroup
                            name="node-list"
                            move-class="tw:transition-transform tw:duration-200 tw:ease-out"
                            enter-active-class="tw:transition-[opacity,transform] tw:duration-200 tw:ease-out"
                            leave-active-class="tw:transition-[opacity,transform] tw:duration-200 tw:ease-out"
                            enter-from-class="tw:translate-x-2.5 tw:opacity-0"
                            leave-to-class="tw:translate-x-2.5 tw:opacity-0"
                        >
                            <div
                                v-for="(node, nIndex) in preset.nodes"
                                :key="node.id"
                                :class="getNodeItemClass(node, nIndex)"
                            >
                                <div class="node-main tw:flex tw:w-full tw:flex-1 tw:flex-col tw:gap-3 tw:p-4">
                                    <div class="node-field-group tw:flex tw:flex-col tw:gap-3.5 tw:py-0.5">
                                        <div class="field-item tw:flex tw:flex-col tw:gap-1.5">
                                            <label class="tw:text-[length:var(--lw-type-label-small-size)] tw:font-[var(--lw-type-label-small-weight)] tw:leading-[var(--lw-type-label-small-line-height)] tw:tracking-[var(--lw-type-label-small-tracking)] tw:text-lw-text-muted tw:uppercase">逻辑节点 (API 来源)</label>
                                            <select v-model="node.provider" class="lw-select" @change="save">
                                                <option value="st_current">【ST 当前界面模型】(原生后端)</option>
                                                <optgroup label="前端直连 (自定义 API)">
                                                    <option v-for="api in customApis" :key="api.id" :value="api.id">
                                                        ⚡ {{ api.name }}
                                                    </option>
                                                </optgroup>
                                            </select>
                                        </div>
                                        <div v-if="node.provider !== 'st_current'" class="field-item tw:flex tw:flex-col tw:gap-1.5">
                                            <label class="tw:text-[length:var(--lw-type-label-small-size)] tw:font-[var(--lw-type-label-small-weight)] tw:leading-[var(--lw-type-label-small-line-height)] tw:tracking-[var(--lw-type-label-small-tracking)] tw:text-lw-text-muted tw:uppercase">具体模型名称</label>
                                            <div class="model-picker-wrap tw:relative tw:w-full" :class="{ 'is-open': openDropdownId === node.id }">
                                                <div class="picker-trigger tw:flex tw:items-center tw:gap-0.5 tw:rounded-lw-sm tw:border tw:border-lw-border-subtle tw:bg-[var(--lw-bg-app)] tw:p-px tw:transition-[border-color,box-shadow] tw:focus-within:border-lw-primary tw:focus-within:[box-shadow:0_0_0_3px_rgba(var(--lw-primary-rgb),0.1)]">
                                                    <input type="text" v-model="node.model"
                                                        class="lw-input tw:h-8 tw:flex-1 tw:border-0 tw:bg-transparent" @change="save" placeholder="手动输入或点击选择..." />
                                                    <button class="picker-expand-btn tw:flex tw:size-7 tw:items-center tw:justify-center tw:rounded-md tw:border-0 tw:bg-transparent tw:text-lw-text-muted tw:transition-[background-color,color] tw:hover:bg-lw-hover tw:hover:text-lw-text" @click.stop="e => toggleDropdown(node.id, e)" aria-label="展开模型列表">
                                                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none">
                                                            <polyline points="6 9 12 15 18 9"></polyline>
                                                        </svg>
                                                    </button>
                                                    <button class="icon-btn refresh tw:mr-1 tw:inline-flex tw:items-center tw:justify-center tw:rounded-md tw:border-0 tw:bg-transparent tw:p-1.5 tw:text-lw-text-muted tw:transition-[background-color,color] tw:hover:bg-lw-active tw:hover:text-lw-text" :title="fetchedModels[node.id] ? '刷新列表' : '拉取列表'"
                                                        :aria-label="fetchedModels[node.id] ? '刷新模型列表' : '拉取模型列表'"
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
                                                :class="[
                                                    'model-dropdown-portal tw:absolute tw:left-0 tw:top-[calc(100%+4px)] tw:z-50 tw:flex tw:w-full tw:min-w-[280px] tw:max-w-[450px] tw:max-h-[400px] tw:flex-col tw:overflow-hidden tw:rounded-lw-md tw:border tw:border-lw-border tw:bg-lw-surface tw:shadow-2xl tw:animate-[dropdown-fade-in_200ms_ease-out] tw:max-[600px]:fixed tw:max-[600px]:left-1/2 tw:max-[600px]:top-1/2 tw:max-[600px]:w-[calc(100vw-32px)] tw:max-[600px]:max-h-[70vh] tw:max-[600px]:-translate-x-1/2 tw:max-[600px]:-translate-y-1/2 tw:max-[600px]:shadow-[0_0_0_100vh_rgba(0,0,0,0.5)]',
                                                    dropdownFlipped ? 'is-flipped tw:max-[600px]:bottom-auto' : ''
                                                ]"
                                            >
                                                    <div class="dropdown-header tw:flex tw:items-center tw:gap-2 tw:border-b tw:border-lw-border-subtle tw:bg-lw-subtle tw:p-3">
                                                        <div class="search-box tw:flex tw:flex-1 tw:items-center tw:gap-2 tw:rounded-md tw:border tw:border-lw-border-subtle tw:bg-[var(--lw-bg-app)] tw:px-2.5">
                                                            <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="3" fill="none">
                                                                <circle cx="11" cy="11" r="8"></circle>
                                                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                                            </svg>
                                                            <input type="text" v-model="modelSearchQuery" class="tw:h-8 tw:w-full tw:border-0 tw:bg-transparent tw:text-[length:var(--lw-type-body-small-size)] tw:font-[var(--lw-type-body-small-weight)] tw:leading-[var(--lw-type-body-small-line-height)] tw:tracking-[var(--lw-type-body-small-tracking)] tw:text-lw-text tw:outline-none" placeholder="搜索模型..." autofocus @click.stop />
                                                        </div>
                                                        <button class="sort-toggle tw:flex tw:size-8 tw:items-center tw:justify-center tw:rounded-md tw:border tw:border-lw-border-subtle tw:bg-[var(--lw-bg-app)] tw:text-lw-text-muted tw:transition-[border-color] tw:hover:border-lw-primary" @click.stop="modelSortAlpha = !modelSortAlpha" :title="modelSortAlpha ? '取消排序' : '字母排序'" :aria-label="modelSortAlpha ? '取消模型排序' : '按字母排序模型'">
                                                            <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" :style="{ color: modelSortAlpha ? 'var(--lw-primary)' : '' }">
                                                                <line x1="4" y1="6" x2="20" y2="6"></line>
                                                                <line x1="4" y1="12" x2="14" y2="12"></line>
                                                                <line x1="4" y1="18" x2="8" y2="18"></line>
                                                            </svg>
                                                        </button>
                                                    </div>

                                                    <div class="dropdown-list tw:flex-1 tw:overflow-y-auto tw:py-2">
                                                        <div v-if="Object.keys(getFilteredModels(node.id)).length === 0" class="no-results tw:p-8 tw:text-center tw:text-[length:var(--lw-type-body-medium-size)] tw:font-[var(--lw-type-body-medium-weight)] tw:leading-[var(--lw-type-body-medium-line-height)] tw:tracking-[var(--lw-type-body-medium-tracking)] tw:text-lw-text-muted">
                                                            未找到匹配模型
                                                        </div>
                                                        <div v-for="(models, group) in getFilteredModels(node.id)" :key="group" class="model-group tw:mb-2">
                                                            <div class="group-label tw:sticky tw:top-[-8px] tw:z-10 tw:bg-lw-subtle tw:px-4 tw:py-1.5 tw:text-[length:var(--lw-type-label-small-size)] tw:font-[var(--lw-type-label-small-weight)] tw:leading-[var(--lw-type-label-small-line-height)] tw:tracking-[var(--lw-type-label-small-tracking)] tw:text-lw-text-muted tw:uppercase">{{ group }}</div>
                                                            <div v-for="m in models" :key="String(m.value)"
                                                                class="model-option tw:flex tw:cursor-pointer tw:flex-col tw:px-4 tw:py-2 tw:transition-[background-color]"
                                                                :class="node.model === String(m.value) ? 'tw:bg-lw-primary-bg' : 'tw:hover:bg-lw-hover'"
                                                                @click="selectModel(node, String(m.value))"
                                                            >
                                                                <span class="opt-text tw:mb-0.5 tw:text-[length:var(--lw-type-title-small-size)] tw:font-[var(--lw-type-title-small-weight)] tw:leading-[var(--lw-type-title-small-line-height)] tw:tracking-[var(--lw-type-title-small-tracking)]" :class="node.model === String(m.value) ? 'tw:text-lw-primary' : 'tw:text-lw-text'">{{ m.text }}</span>
                                                                <span class="opt-val tw:font-mono tw:text-[length:var(--lw-type-body-small-size)] tw:font-[var(--lw-type-body-small-weight)] tw:leading-[var(--lw-type-body-small-line-height)] tw:tracking-[var(--lw-type-body-small-tracking)] tw:text-lw-text-muted">{{ String(m.value) }}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div v-else class="field-item tw:flex tw:flex-col tw:gap-1.5">
                                            <label class="tw:text-[length:var(--lw-type-label-small-size)] tw:font-[var(--lw-type-label-small-weight)] tw:leading-[var(--lw-type-label-small-line-height)] tw:tracking-[var(--lw-type-label-small-tracking)] tw:text-lw-text-muted tw:uppercase">模型状态</label>
                                            <div class="st-indicator tw:flex tw:h-9 tw:items-center tw:rounded-lw-sm tw:border tw:border-lw-border-subtle tw:bg-[var(--lw-bg-app)] tw:px-3 tw:py-2 tw:text-xs tw:text-lw-text-muted">跟随原生 ST 动态选择</div>
                                        </div>
                                    </div>
                                </div>

                                <div class="node-footer tw:flex tw:h-[42px] tw:select-none tw:items-center tw:justify-between tw:rounded-b-lw-md tw:border-t tw:border-dashed tw:border-lw-border-subtle tw:bg-lw-subtle tw:px-3">
                                    <div class="footer-left tw:flex tw:items-center tw:gap-3">
                                        <div class="node-index tw:flex tw:h-[18px] tw:w-7 tw:items-center tw:justify-center tw:rounded tw:border tw:border-lw-border-subtle tw:bg-lw-surface tw:text-[length:var(--lw-type-label-small-size)] tw:font-[var(--lw-type-label-small-weight)] tw:leading-[var(--lw-type-label-small-line-height)] tw:tracking-[var(--lw-type-label-small-tracking)] tw:text-lw-text-muted tw:opacity-80">#{{ nIndex + 1 }}</div>
                                    </div>

                                    <div
                                        class="node-drag-handle tw:mx-auto tw:flex tw:h-8 tw:w-12 tw:cursor-grab tw:touch-none tw:items-center tw:justify-center tw:rounded-md tw:text-lw-text-muted tw:transition-[background-color,color] tw:hover:bg-lw-active tw:hover:text-lw-primary tw:active:cursor-grabbing tw:active:bg-lw-primary tw:active:text-white"
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

                                    <div class="footer-right tw:flex tw:items-center tw:gap-3">
                                        <div class="node-sort-actions tw:flex tw:flex-col tw:gap-1">
                                            <button
                                                class="tw:flex tw:h-3.5 tw:w-6 tw:items-center tw:justify-center tw:border-0 tw:bg-transparent tw:p-0 tw:text-lw-text-muted tw:transition-[color,transform,opacity] tw:duration-150 tw:ease-out tw:disabled:cursor-not-allowed tw:disabled:opacity-10 tw:enabled:hover:-translate-y-px tw:enabled:hover:text-lw-primary"
                                                @click="moveNode(preset, nIndex, 'up')"
                                                :disabled="nIndex === 0"
                                                title="上移"
                                                aria-label="上移节点"
                                            >
                                                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="3" fill="none">
                                                    <polyline points="18 15 12 9 6 15"></polyline>
                                                </svg>
                                            </button>
                                            <button
                                                class="tw:flex tw:h-3.5 tw:w-6 tw:items-center tw:justify-center tw:border-0 tw:bg-transparent tw:p-0 tw:text-lw-text-muted tw:transition-[color,transform,opacity] tw:duration-150 tw:ease-out tw:disabled:cursor-not-allowed tw:disabled:opacity-10 tw:enabled:hover:translate-y-px tw:enabled:hover:text-lw-primary"
                                                @click="moveNode(preset, nIndex, 'down')"
                                                :disabled="nIndex === preset.nodes.length - 1"
                                                title="下移"
                                                aria-label="下移节点"
                                            >
                                                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="3" fill="none">
                                                    <polyline points="6 9 12 15 18 9"></polyline>
                                                </svg>
                                            </button>
                                        </div>
                                        <div class="footer-divider tw:mx-1 tw:h-4 tw:w-px tw:bg-lw-border-subtle"></div>
                                        <button
                                            class="icon-btn delete tw:inline-flex tw:items-center tw:justify-center tw:rounded-md tw:border-0 tw:bg-transparent tw:p-1.5 tw:text-lw-text-muted tw:transition-[background-color,color] tw:hover:bg-red-50 tw:hover:text-red-600"
                                            @click="deleteNode(preset, nIndex)"
                                            title="移除节点"
                                            aria-label="移除节点"
                                        >
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

                    <LuminaButton variant="outline" tone="neutral" size="sm" block class="tw:mt-3 tw:border-dashed tw:text-lw-text-secondary" @click="addNode(preset)">
                        <Plus class="tw:size-3" aria-hidden="true" />
                        添加备用节点 (Fallback)
                    </LuminaButton>
                </div>
            </div>

            <div v-else class="empty-state tw:p-10 tw:text-center tw:text-lw-text-muted">
                <div class="empty-icon tw:mb-3 tw:opacity-50">
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
import { ref, onMounted, inject } from 'vue';
import { Plus } from 'lucide-vue-next';
import { settingsDomainService } from '../../api/services/SettingsDomainService.js';
import { llmEngine } from '../../api/llmEngine.js';
import { LuminaWeaveAPI } from '../../api/index.js';
import LuminaButton from '../../ui/primitives/LuminaButton.vue';
import { cn } from '../../ui/cn.js';
import { useModalStore } from '../../stores/useModalStore.js';


const lwApi = inject<LuminaWeaveAPI>('lwApi');

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
    const loadedApis = settingsDomainService.getGlobalValue<NexusApi[]>('nexus.apis', []);
    customApis.value = JSON.parse(JSON.stringify(loadedApis));
    for (const api of customApis.value) {
        if (!api.type) api.type = 'openai_compatible';
    }

    // 从全局存储加载 Preset 配置
    const loadedPresets = settingsDomainService.getGlobalValue<NexusPreset[]>('nexus.presets', []);
    presets.value = JSON.parse(JSON.stringify(loadedPresets));

    useSSE.value = settingsDomainService.getGlobalValue('nexus.useSSE', true) === true;
});

const saveApis = () => {
    void settingsDomainService.setGlobalValue('nexus.apis', JSON.parse(JSON.stringify(customApis.value)));
};

const save = () => {
    void settingsDomainService.setGlobalValue('nexus.presets', JSON.parse(JSON.stringify(presets.value)));
};

const saveFlags = () => {
    void settingsDomainService.setGlobalValue('nexus.useSSE', useSSE.value);
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

const deleteApi = async (index: number) => {
    const confirmed = await useModalStore().confirm({
        title: '删除接口',
        message: '删除后无法恢复，预设里用到这个接口的节点也会失效。',
        confirmText: '删除',
        danger: true
    });
    if (!confirmed) return;
    customApis.value.splice(index, 1);
    saveApis();
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

const deletePreset = async (index: number) => {
    const confirmed = await useModalStore().confirm({
        title: '删除预设',
        message: '删除后无法恢复。',
        confirmText: '删除',
        danger: true
    });
    if (!confirmed) return;
    presets.value.splice(index, 1);
    save();
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

const getNodeItemClass = (node: NexusNode, index: number) => cn(
    'node-item tw:relative tw:flex tw:flex-col tw:overflow-visible tw:rounded-lw-md tw:border tw:border-lw-border-subtle tw:bg-lw-surface tw:p-0 tw:transition-[background-color,border-color,box-shadow,transform,opacity] tw:duration-200 tw:ease-out',
    draggingNodeId.value === node.id && 'is-dragging tw:z-10 tw:scale-[1.02] tw:border-lw-primary tw:bg-lw-hover tw:shadow-[0_8px_24px_rgba(var(--lw-primary-rgb),0.15)]',
    draggingNodeId.value && draggingNodeId.value !== node.id && dragCurrentIndex.value === index && 'is-placeholder tw:border-dashed tw:opacity-40'
);

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
        lwApi?.services.host.showToast('选择原生 ST 后无需手动拉取模型。', 'warning');
        return;
    }

    const targetApi = customApis.value.find(a => a.id === node.provider);
    if (!targetApi) {
        lwApi?.services.host.showToast('所选接口不存在，请先配置！', 'error');
        return;
    }

    if (!targetApi.key) {
        lwApi?.services.host.showToast('该接口的地址或密钥为空！', 'warning');
        return;
    }

    if (targetApi.type !== 'openai' && targetApi.type !== 'openai_compatible') {
        lwApi?.services.host.showToast('该 Provider 暂不支持自动拉取模型列表，请手动填写模型名。', 'warning');
        return;
    }

    if (!targetApi.url) {
        lwApi?.services.host.showToast('该接口的地址为空！', 'warning');
        return;
    }

    const models = await llmEngine.fetchProviderModels(targetApi.id, targetApi.name) as Record<string, ModelOption[]>;

    if (Object.keys(models).length > 0) {
        fetchedModels.value[node.id] = models;
        lwApi?.services.host.showToast(`成功为您拉取 [${targetApi.name}] 模型列表！`, 'success');

        if (!node.model) {
            const firstGroup = Object.values(models)[0];
            if (firstGroup && firstGroup.length > 0) {
                node.model = String(firstGroup[0].value);
                save();
            }
        }
    } else {
        const errMsg = '拉取大模型失败，跨域报错或密钥不正确。请按 F12 检查控制台网络拦截。';
        lwApi?.services.host.showToast(errMsg, 'error', '获取失败', 5000);
    }
};
</script>
