<template>
  <div class="prompt-preset-workbench">
    <div class="workbench-head">
      <div>
        <div class="workbench-title">Agent 预设工作台</div>
        <div class="workbench-subtitle">管理 Forge 主模型、执行模型和测试聊天的 Agent 资源包、提示词编排和请求参数。</div>
      </div>
      <div class="workbench-actions">
        <button class="head-btn" type="button" @click="createPresetFromCurrent">新建</button>
        <button class="head-btn" type="button" @click="duplicateCurrentPreset">复制</button>
        <button class="head-btn" type="button" @click="restoreDefaultPreset">恢复默认</button>
      </div>
    </div>

    <div class="profile-tabs">
      <button
        v-for="profile in profiles"
        :key="profile.id"
        type="button"
        class="profile-tab"
        :class="{ active: activeProfileId === profile.id }"
        @click="switchProfile(profile.id)"
      >
        {{ profile.label }}
      </button>
    </div>

    <div class="preset-toolbar">
      <select class="preset-select" :value="activePresetId" @change="onPresetChange">
        <option v-for="preset in presets" :key="preset.id" :value="preset.id">
          {{ preset.name }}
        </option>
      </select>
      <span class="preset-engine">{{ workbenchOverview.typeLabel }}</span>
      <span class="preset-state" :class="{ builtIn: draft.builtIn }">{{ workbenchOverview.editLabel }}</span>
      <button v-if="!draft.builtIn" class="danger-btn" type="button" @click="deleteCurrentPreset">删除</button>
    </div>

    <div class="preset-overview">
      <div class="overview-copy">
        <div class="overview-eyebrow">CURRENT PRESET</div>
        <div class="overview-title">{{ draft.name || '未命名预设' }}</div>
        <div class="overview-description">
          <template v-if="hasAgentResourcePreset">
            资源从项目覆盖、当前预设和内置 fallback 逐级解析；最终请求由右侧编排顺序装配。
          </template>
          <template v-else-if="draft.engine === 'st_preset'">
            当前配置直通 SillyTavern 上下文预设，Forge 不接管条目编排。
          </template>
          <template v-else>
            当前配置是兼容条目预设，用于旧的组合条目链路。
          </template>
        </div>
      </div>
      <div class="overview-metrics">
        <div class="overview-metric">
          <span>资源</span>
          <strong>{{ workbenchOverview.resourceCount }}</strong>
        </div>
        <div class="overview-metric">
          <span>编排</span>
          <strong>{{ workbenchOverview.orchestrationCount }}</strong>
        </div>
        <div class="overview-metric">
          <span>技能</span>
          <strong>{{ workbenchOverview.skillCount }}</strong>
        </div>
      </div>
      <button v-if="draft.builtIn" class="save-btn" type="button" @click="duplicateCurrentPreset">
        {{ workbenchOverview.primaryActionLabel }}
      </button>
    </div>

    <div class="editor-grid">
      <section class="editor-pane">
        <div class="section-title">{{ hasAgentResourcePreset ? '资源编辑器' : '预设基础' }}</div>
        <label class="field-label">
          <span>名称</span>
          <input v-model="draft.name" class="field-input" type="text" :disabled="draft.builtIn" />
        </label>

        <label v-if="activeProfileId === 'forge-test-chat'" class="field-label">
          <span>引擎</span>
          <select v-model="draft.engine" class="field-select" :disabled="draft.builtIn">
            <option value="composed">组合预设</option>
            <option value="st_preset">ST 预设直通</option>
          </select>
        </label>

        <template v-if="activeProfileId === 'forge-test-chat'">
          <label class="field-label">
            <span>角色卡来源</span>
            <select v-model="draft.charCardMode" class="field-select" :disabled="draft.builtIn">
              <option value="from_st">来自 ST 当前角色</option>
              <option value="custom">自定义角色卡</option>
              <option value="none">不注入角色卡</option>
            </select>
          </label>

          <div v-if="draft.charCardMode === 'custom'" class="char-card-grid">
            <label class="field-label">
              <span>角色名称</span>
              <input v-model="draft.customCharCard.name" class="field-input" type="text" :disabled="draft.builtIn" />
            </label>
            <label class="field-label">
              <span>System Prompt</span>
              <textarea v-model="draft.customCharCard.systemPrompt" class="field-textarea" rows="3" :disabled="draft.builtIn" />
            </label>
            <label class="field-label">
              <span>角色描述</span>
              <textarea v-model="draft.customCharCard.description" class="field-textarea" rows="3" :disabled="draft.builtIn" />
            </label>
            <label class="field-label">
              <span>角色性格</span>
              <textarea v-model="draft.customCharCard.personality" class="field-textarea" rows="3" :disabled="draft.builtIn" />
            </label>
            <label class="field-label">
              <span>场景</span>
              <textarea v-model="draft.customCharCard.scenario" class="field-textarea" rows="3" :disabled="draft.builtIn" />
            </label>
          </div>
        </template>

        <div v-if="hasAgentResourcePreset" class="agent-resource-block">
          <div class="resource-tabs" role="tablist" aria-label="Agent 资源分组">
            <button
              v-for="group in resourceGroups"
              :key="group.id"
              class="resource-tab"
              :class="{ active: activeResourceGroup?.id === group.id }"
              type="button"
              @click="activeResourceGroupId = group.id"
            >
              {{ group.label }}
              <span>{{ group.resources.length }}</span>
            </button>
          </div>

            <div v-if="activeResourceGroup" class="resource-group-panel">
              <div class="resource-group-head">
                <div>
                  <div class="resource-group-title">{{ activeResourceGroup.label }}</div>
                  <div class="resource-group-description">{{ activeResourceGroup.description }}</div>
                </div>
                <button
                  v-if="activeResourceGroup.id === 'skills' && resourceEditable"
                  class="secondary-btn"
                  type="button"
                  @click="addSkillResource"
                >
                  新增技能
                </button>
                <span class="preset-state" :class="{ builtIn: !resourceEditable }">
                  {{ resourceEditable ? '可编辑' : '只读预览' }}
                </span>
              </div>

            <div v-if="activeResourceGroup.resources.length === 0" class="empty-resource-state">
              当前预设没有提供自定义技能。技能仍可从项目或内置技能库按需加载。
            </div>

            <div v-for="row in activeResourceGroup.resources" :key="row.id" class="resource-editor-card">
              <div class="resource-editor-head">
                <span class="entry-tag">{{ row.label }}</span>
                <div class="resource-editor-title">
                  <strong>{{ row.title }}</strong>
                  <span>{{ row.path }}</span>
                </div>
              </div>
              <div v-if="row.kind === 'skill'" class="skill-metadata-grid">
                <label class="field-label">
                  <span>技能名</span>
                  <input
                    class="field-input"
                    type="text"
                    :value="row.skillName || ''"
                    :disabled="!resourceEditable"
                    @change="updateSkillName(row.skillName || '', $event)"
                  />
                </label>
                <label class="field-label">
                  <span>标题</span>
                  <input
                    class="field-input"
                    type="text"
                    :value="row.title"
                    :disabled="!resourceEditable"
                    @input="updateSkillTitle(row.skillName || '', $event)"
                  />
                </label>
                <label class="field-label">
                  <span>说明</span>
                  <input
                    class="field-input"
                    type="text"
                    :value="row.description || ''"
                    :disabled="!resourceEditable"
                    @input="updateSkillDescription(row.skillName || '', $event)"
                  />
                </label>
              </div>
              <div v-if="row.kind === 'skill'" class="skill-resource-controls">
                <label class="field-label compact">
                  <span>加载策略</span>
                  <select
                    class="field-select"
                    :value="row.loadPolicy || 'on_demand'"
                    :disabled="!resourceEditable"
                    @change="updateSkillLoadPolicy(row.skillName || '', $event)"
                  >
                    <option value="on_demand">按需加载</option>
                    <option value="always">常驻</option>
                  </select>
                </label>
                <span class="entry-tag">{{ row.loadPolicyLabel || '按需' }}</span>
                <button
                  v-if="resourceEditable"
                  class="icon-btn danger"
                  type="button"
                  aria-label="移除技能"
                  title="移除技能"
                  @click="removeSkillResource(row.skillName || '')"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" aria-hidden="true">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"></path>
                    <path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6"></path>
                  </svg>
                </button>
              </div>
              <textarea
                v-if="resourceEditable"
                class="field-textarea resource-textarea"
                rows="10"
                :value="row.content"
                @input="updateResourceContent(row.id, $event)"
              />
              <pre v-else class="resource-preview">{{ row.content }}</pre>
            </div>
          </div>

          <p class="section-hint">
            这些内容会通过语义 VFS 映射为 <code>./AGENTS.md</code> 和 <code>./.forge/agent/*.md</code>。项目文件覆盖预设资源，预设资源覆盖内置 fallback。
          </p>
        </div>

        <details class="collapsible-block" :open="!hasAgentResourcePreset">
          <summary>
            <span>请求参数</span>
            <span>{{ overriddenGenerationSettingCount }} 项覆盖</span>
          </summary>
          <div class="generation-settings-block">
            <div class="generation-settings-grid">
              <label
                v-for="field in generationSettingFields"
                :key="field.key"
                class="field-label"
              >
                <span>{{ field.label }}</span>
                <input
                  class="field-input"
                  type="number"
                  :step="field.step"
                  :value="getGenerationSettingInputValue(field.key)"
                  :disabled="draft.builtIn"
                  :placeholder="field.placeholder"
                  @input="updateGenerationSetting(field.key, $event)"
                />
              </label>
            </div>
            <p class="section-hint">
              留空表示不覆盖该参数。这里的值会随 Agent 预设一起保存，并在模型请求调试窗中显示。
            </p>
          </div>
        </details>

        <div v-if="specialDefinitions.length > 0 && draft.engine !== 'st_preset' && !hasAgentResourcePreset" class="special-block">
          <div class="section-title">Special Prompt</div>
          <label v-for="special in specialDefinitions" :key="special.key" class="field-label">
            <span>{{ special.label }}</span>
            <textarea
              v-model="draft.specials[special.key]"
              class="field-textarea"
              rows="6"
              :disabled="draft.builtIn"
            />
          </label>
        </div>

        <div class="editor-actions">
          <button v-if="!draft.builtIn" class="save-btn" type="button" @click="savePreset">
            保存当前预设
          </button>
          <button v-else class="save-btn" type="button" @click="duplicateCurrentPreset">
            复制为自定义预设
          </button>
          <button class="secondary-btn" type="button" @click="applyActivePreset">
            设为当前绑定
          </button>
        </div>
      </section>

      <section class="editor-pane">
        <div class="section-head">
          <div class="section-title">{{ hasAgentResourcePreset ? '编排检查' : canEditLegacyEntries ? '兼容条目预设' : 'Agent 资源预设' }}</div>
          <div v-if="canEditLegacyEntries" class="section-actions">
            <select v-model="selectedSlotToAdd" class="slot-select" :disabled="draft.builtIn || availableSlots.length === 0 || draft.engine === 'st_preset'">
              <option value="">添加 Slot</option>
              <option v-for="slot in availableSlots" :key="slot.id" :value="slot.id">
                {{ slot.label }}
              </option>
            </select>
            <button class="secondary-btn" type="button" :disabled="!selectedSlotToAdd || draft.builtIn || draft.engine === 'st_preset'" @click="addSlotEntry">
              添加 Slot
            </button>
            <button class="secondary-btn" type="button" :disabled="draft.builtIn || draft.engine === 'st_preset'" @click="addCustomEntry">
              添加自定义
            </button>
          </div>
        </div>

        <div v-if="hasAgentResourcePreset" class="agent-orchestration">
          <div class="engine-hint">
            Forge Agent 预设使用资源包和编排步骤，不再通过旧条目顺序编辑。实际请求由 runtime 按下列顺序装配。
          </div>

          <div class="orchestration-list">
            <div v-for="(row, index) in orchestrationRows" :key="row.id" class="orchestration-card">
              <span class="orchestration-index">{{ index + 1 }}</span>
              <div class="orchestration-main">
                <div class="orchestration-title">{{ row.label }}</div>
                <div v-if="row.path" class="orchestration-path">{{ row.path }}</div>
              </div>
              <span class="entry-tag" :class="{ disabled: !row.enabled }">{{ row.enabled ? '启用' : '关闭' }}</span>
            </div>
          </div>

          <div class="resource-list">
            <div class="section-title">资源路径</div>
            <div v-for="row in resourceRows" :key="row.id" class="resource-card">
              <div class="resource-card-head">
                <span class="entry-tag">{{ row.label }}</span>
                <span class="resource-title">{{ row.title }}</span>
              </div>
              <div class="resource-path">{{ row.path }}</div>
            </div>
          </div>
        </div>

        <div v-else-if="draft.engine === 'st_preset'" class="engine-hint">
          当前使用 ST 预设直通模式，条目顺序由 ST 当前上下文预设决定。
        </div>

        <div v-else-if="!canEditLegacyEntries" class="engine-hint">
          Forge Agent 主模型与执行模型只使用资源包、技能和 Agent 提示词编排。旧条目预设不再作为公开编辑模型；请恢复默认预设或复制默认资源包后编辑。
        </div>

        <div v-else class="entry-list">
          <div v-for="(entry, index) in draft.entries" :key="entry.id" class="entry-card">
            <div class="entry-row">
              <label class="entry-main">
                <input
                  class="entry-checkbox"
                  :checked="entry.enabled"
                  type="checkbox"
                  @change="handleEntryEnabledChange(entry, $event)"
                />
                <span class="entry-title">{{ resolveEntryTitle(entry) }}</span>
              </label>
              <div class="entry-tags">
                <span class="entry-tag">{{ entry.type === 'slot' ? 'SLOT' : 'CUSTOM' }}</span>
                <span class="entry-tag role">{{ resolveEntryRole(entry) }}</span>
              </div>
            </div>

            <div class="entry-actions">
              <button
                class="icon-btn"
                type="button"
                :disabled="index === 0 || draft.builtIn"
                aria-label="上移条目"
                title="上移"
                @click="moveEntry(index, -1)"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" aria-hidden="true">
                  <polyline points="6 15 12 9 18 15"></polyline>
                </svg>
              </button>
              <button
                class="icon-btn"
                type="button"
                :disabled="index === draft.entries.length - 1 || draft.builtIn"
                aria-label="下移条目"
                title="下移"
                @click="moveEntry(index, 1)"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" aria-hidden="true">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
              <button
                class="icon-btn"
                type="button"
                :aria-label="expandedEntryIds.has(entry.id) ? '收起条目' : '展开条目'"
                :title="expandedEntryIds.has(entry.id) ? '收起' : '展开'"
                @click="toggleExpanded(entry.id)"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  stroke="currentColor"
                  stroke-width="2.5"
                  fill="none"
                  aria-hidden="true"
                >
                  <polyline
                    :points="expandedEntryIds.has(entry.id) ? '6 15 12 9 18 15' : '6 9 12 15 18 9'"
                  ></polyline>
                </svg>
              </button>
              <button
                class="icon-btn danger"
                type="button"
                :disabled="draft.builtIn"
                aria-label="删除条目"
                title="删除"
                @click="removeEntry(index)"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" aria-hidden="true">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"></path>
                  <path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6"></path>
                  <line x1="10" y1="11" x2="10" y2="17"></line>
                  <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
              </button>
            </div>

            <div v-if="entry.type === 'custom' && expandedEntryIds.has(entry.id)" class="entry-editor">
              <label class="field-label">
                <span>Role</span>
                <select v-model="entry.role" class="field-select" :disabled="draft.builtIn">
                  <option value="system">system</option>
                  <option value="user">user</option>
                  <option value="assistant">assistant</option>
                </select>
              </label>
              <label class="field-label">
                <span>内容</span>
                <textarea v-model="entry.content" class="field-textarea" rows="5" :disabled="draft.builtIn" />
              </label>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import { promptPresetRegistry } from '../../api/core/hal/prompt/PromptPresetRegistry.js';
import { clonePromptPresetGenerationSettings } from '../../api/core/utils/promptPresetGenerationSettings.js';
import { lwStorage } from '../../api/storage.js';
import { useSurfaceInput } from '../../platform/surface/useSurfaceRuntimeContext.js';
import {
    buildForgeAgentSkillPath,
    buildForgePromptPresetOrchestrationRows,
    buildForgePromptPresetResourceGroups,
    buildForgePromptPresetResourceRows,
    buildForgePromptPresetWorkbenchOverview,
    hasForgeAgentResourcePreset,
    normalizeForgeAgentSkillName
} from './store/forgePromptPresetPresentation.js';
import type { ForgePromptPresetResourceGroupId } from './store/forgePromptPresetPresentation.js';
import type {
    ForgeAgentSkillLoadPolicy,
    PromptPresetDefinition,
    PromptPresetEntry,
    PromptPresetGenerationSettings,
    PromptPresetProfileId,
    PromptPresetSpecialDefinition,
    PromptPresetSlotDefinition
} from '../../types/PromptPresetTypes.js';

useSurfaceInput('forge.settings.workbench');

type EditablePreset = PromptPresetDefinition & {
    customCharCard: NonNullable<PromptPresetDefinition['customCharCard']>;
};

type GenerationSettingField = {
    key: keyof PromptPresetGenerationSettings;
    label: string;
    step: string;
    placeholder?: string;
};

const STORAGE_KEY_BUILTIN_OVERRIDES = 'lumina-prompt-presets.builtin-overrides';

const profiles = promptPresetRegistry.listProfiles();
const activeProfileId = ref<PromptPresetProfileId>('forge-agent');
const presets = ref<PromptPresetDefinition[]>([]);
const activePresetId = ref('');
const selectedSlotToAdd = ref('');
const activeResourceGroupId = ref<ForgePromptPresetResourceGroupId>('contract');
const expandedEntryIds = reactive(new Set<string>());
const generationSettingFields: GenerationSettingField[] = [
    { key: 'temperature', label: 'temperature', step: '0.01', placeholder: '例如 0.7' },
    { key: 'top_p', label: 'top_p', step: '0.01', placeholder: '例如 0.9' },
    { key: 'top_k', label: 'top_k', step: '1', placeholder: '例如 40' },
    { key: 'presence_penalty', label: 'presence_penalty', step: '0.01', placeholder: '例如 0.2' },
    { key: 'frequency_penalty', label: 'frequency_penalty', step: '0.01', placeholder: '例如 0.2' },
    { key: 'max_tokens', label: 'max_tokens', step: '1', placeholder: '例如 512' },
    { key: 'max_length', label: 'max_length', step: '1', placeholder: '例如 1024' },
    { key: 'seed', label: 'seed', step: '1', placeholder: '例如 42' }
];

const draft = reactive<EditablePreset>({
    id: '',
    name: '',
    profileId: 'forge-agent',
    builtIn: true,
    engine: 'composed',
    charCardMode: undefined,
    customCharCard: {
        name: '',
        description: '',
        personality: '',
        scenario: '',
        systemPrompt: ''
    },
    entries: [],
    specials: {},
    generationSettings: {},
    createdAt: 0,
    updatedAt: 0
});

const currentProfile = computed(() => profiles.find(profile => profile.id === activeProfileId.value) || profiles[0]);
const hasAgentResourcePreset = computed(() => hasForgeAgentResourcePreset(draft));
const canEditLegacyEntries = computed(() => activeProfileId.value === 'forge-test-chat' && !hasAgentResourcePreset.value);
const resourceEditable = computed(() => hasAgentResourcePreset.value && !draft.builtIn);
const resourceRows = computed(() => buildForgePromptPresetResourceRows(draft));
const resourceGroups = computed(() => buildForgePromptPresetResourceGroups(draft));
const activeResourceGroup = computed(() =>
    resourceGroups.value.find(group => group.id === activeResourceGroupId.value) || resourceGroups.value[0] || null
);
const orchestrationRows = computed(() => buildForgePromptPresetOrchestrationRows(draft));
const workbenchOverview = computed(() => buildForgePromptPresetWorkbenchOverview(draft));
const overriddenGenerationSettingCount = computed(() =>
    Object.values(draft.generationSettings).filter(value => typeof value === 'number' && Number.isFinite(value)).length
);
const slotDefinitions = computed<Record<string, PromptPresetSlotDefinition>>(() =>
    Object.fromEntries(currentProfile.value.slots.map(slot => [slot.slot.id, slot.slot]))
);
const specialDefinitions = computed<PromptPresetSpecialDefinition[]>(() => currentProfile.value.specials);
const availableSlots = computed(() =>
    currentProfile.value.slots
        .map(slot => slot.slot)
        .filter(slot => !draft.entries.some(entry => entry.type === 'slot' && entry.slotId === slot.id))
);

const clonePreset = (preset: PromptPresetDefinition): EditablePreset => ({
    ...preset,
    entries: preset.entries.map(entry => ({ ...entry })),
    specials: { ...preset.specials },
    forgeAgentResources: preset.forgeAgentResources
        ? {
            contract: { ...preset.forgeAgentResources.contract },
            system: { ...preset.forgeAgentResources.system },
            executor: { ...preset.forgeAgentResources.executor },
            skills: preset.forgeAgentResources.skills?.map(skill => ({ ...skill })),
            extensions: preset.forgeAgentResources.extensions?.map(extension => ({ ...extension }))
        }
        : undefined,
    forgeAgentOrchestration: preset.forgeAgentOrchestration
        ? {
            label: preset.forgeAgentOrchestration.label,
            steps: preset.forgeAgentOrchestration.steps.map(step => ({ ...step }))
        }
        : undefined,
    generationSettings: clonePromptPresetGenerationSettings(preset.generationSettings),
    customCharCard: {
        name: preset.customCharCard?.name || '',
        description: preset.customCharCard?.description || '',
        personality: preset.customCharCard?.personality || '',
        scenario: preset.customCharCard?.scenario || '',
        systemPrompt: preset.customCharCard?.systemPrompt || ''
    }
});

const assignDraft = (preset: PromptPresetDefinition) => {
    const next = clonePreset(preset);
    Object.assign(draft, next);
    activeResourceGroupId.value = buildForgePromptPresetResourceGroups(next)[0]?.id || 'contract';
    expandedEntryIds.clear();
};

const loadProfile = (profileId: PromptPresetProfileId) => {
    promptPresetRegistry.reload();
    presets.value = promptPresetRegistry.listPresets(profileId);
    activePresetId.value = promptPresetRegistry.getActivePresetId(profileId);
    const activePreset = promptPresetRegistry.getActivePreset(profileId);
    assignDraft(activePreset);
};

const switchProfile = (profileId: PromptPresetProfileId) => {
    activeProfileId.value = profileId;
    selectedSlotToAdd.value = '';
    loadProfile(profileId);
};

const onPresetChange = (event: Event) => {
    const id = (event.target as HTMLSelectElement).value;
    activePresetId.value = id;
    const preset = promptPresetRegistry.getPreset(activeProfileId.value, id);
    if (preset) {
        assignDraft(preset);
    }
};

const createPresetFromCurrent = () => {
    const preset = promptPresetRegistry.createPreset(activeProfileId.value, {
        name: `新预设 ${presets.value.length + 1}`,
        engine: draft.engine,
        charCardMode: draft.charCardMode,
        customCharCard: draft.customCharCard,
        entries: draft.entries,
        specials: draft.specials,
        forgeAgentResources: draft.forgeAgentResources,
        forgeAgentOrchestration: draft.forgeAgentOrchestration,
        generationSettings: draft.generationSettings
    });
    loadProfile(activeProfileId.value);
    activePresetId.value = preset.id;
    promptPresetRegistry.setActivePreset(activeProfileId.value, preset.id);
    const created = promptPresetRegistry.getPreset(activeProfileId.value, preset.id);
    if (created) assignDraft(created);
};

const duplicateCurrentPreset = () => {
    const duplicated = promptPresetRegistry.duplicatePreset(activeProfileId.value, draft.id);
    if (!duplicated) return;
    promptPresetRegistry.setActivePreset(activeProfileId.value, duplicated.id);
    loadProfile(activeProfileId.value);
};

const restoreDefaultPreset = () => {
    promptPresetRegistry.restoreProfileDefault(activeProfileId.value);
    loadProfile(activeProfileId.value);
};

const deleteCurrentPreset = () => {
    promptPresetRegistry.deletePreset(activeProfileId.value, draft.id);
    loadProfile(activeProfileId.value);
};

const savePreset = () => {
    if (draft.builtIn) return;
    promptPresetRegistry.updatePreset(activeProfileId.value, draft.id, {
        name: draft.name.trim() || '未命名预设',
        engine: draft.engine,
        charCardMode: draft.charCardMode,
        customCharCard: draft.charCardMode === 'custom' ? draft.customCharCard : undefined,
        entries: draft.entries.map(entry => ({ ...entry })),
        specials: { ...draft.specials },
        forgeAgentResources: draft.forgeAgentResources,
        forgeAgentOrchestration: draft.forgeAgentOrchestration,
        generationSettings: clonePromptPresetGenerationSettings(draft.generationSettings)
    });
    loadProfile(activeProfileId.value);
    const refreshed = promptPresetRegistry.getPreset(activeProfileId.value, draft.id);
    if (refreshed) {
        activePresetId.value = refreshed.id;
        assignDraft(refreshed);
    }
};

const applyActivePreset = () => {
    promptPresetRegistry.setActivePreset(activeProfileId.value, draft.id);
    loadProfile(activeProfileId.value);
};

const handleEntryEnabledChange = (entry: PromptPresetEntry, event: Event) => {
    const checked = (event.target as HTMLInputElement).checked;
    entry.enabled = checked;
    if (!draft.builtIn) {
        return;
    }
    promptPresetRegistry.setBuiltInEntryEnabled(activeProfileId.value, draft.id, entry.id, checked);
};

const moveEntry = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= draft.entries.length) return;
    const nextEntries = draft.entries.slice();
    [nextEntries[index], nextEntries[nextIndex]] = [nextEntries[nextIndex], nextEntries[index]];
    draft.entries.splice(0, draft.entries.length, ...nextEntries);
};

const addCustomEntry = () => {
    draft.entries.push({
        id: `custom:${Date.now()}:${draft.entries.length}`,
        type: 'custom',
        enabled: true,
        role: 'system',
        content: ''
    });
};

const addSlotEntry = () => {
    if (!selectedSlotToAdd.value) return;
    draft.entries.push({
        id: `slot:${selectedSlotToAdd.value}:${Date.now()}`,
        type: 'slot',
        slotId: selectedSlotToAdd.value,
        enabled: true
    });
    selectedSlotToAdd.value = '';
};

const removeEntry = (index: number) => {
    const [entry] = draft.entries.splice(index, 1);
    if (entry) {
        expandedEntryIds.delete(entry.id);
    }
};

const toggleExpanded = (entryId: string) => {
    if (expandedEntryIds.has(entryId)) {
        expandedEntryIds.delete(entryId);
    } else {
        expandedEntryIds.add(entryId);
    }
};

const resolveEntryTitle = (entry: PromptPresetEntry) => {
    if (entry.type === 'custom') {
        return entry.content?.trim().slice(0, 32) || '自定义 Prompt';
    }
    return slotDefinitions.value[entry.slotId || '']?.label || entry.slotId || '未知 Slot';
};

const resolveEntryRole = (entry: PromptPresetEntry) => {
    if (entry.type === 'custom') {
        return entry.role || 'system';
    }
    return slotDefinitions.value[entry.slotId || '']?.defaultRole || 'system';
};

const getGenerationSettingInputValue = (key: keyof PromptPresetGenerationSettings): string => {
    const value = draft.generationSettings[key];
    return typeof value === 'number' ? String(value) : '';
};

const updateGenerationSetting = (key: keyof PromptPresetGenerationSettings, event: Event) => {
    const rawValue = (event.target as HTMLInputElement).value.trim();
    if (!rawValue) {
        delete draft.generationSettings[key];
        return;
    }

    const parsedValue = Number(rawValue);
    if (!Number.isFinite(parsedValue)) {
        return;
    }

    draft.generationSettings[key] = parsedValue;
};

const updateResourceContent = (resourceId: string, event: Event) => {
    const resources = draft.forgeAgentResources;
    if (!resources) return;

    const content = (event.target as HTMLTextAreaElement).value;
    if (resourceId === 'contract') {
        resources.contract.content = content;
        return;
    }
    if (resourceId === 'system') {
        resources.system.content = content;
        return;
    }
    if (resourceId === 'executor') {
        resources.executor.content = content;
        return;
    }
    if (resourceId.startsWith('skill:')) {
        const skillName = resourceId.slice('skill:'.length);
        const skill = resources.skills?.find(item => item.name === skillName);
        if (skill) {
            skill.content = content;
        }
    }
};

const updateSkillLoadPolicy = (skillName: string, event: Event) => {
    const resources = draft.forgeAgentResources;
    if (!resources || !skillName) return;
    const policy: ForgeAgentSkillLoadPolicy = (event.target as HTMLSelectElement).value === 'always' ? 'always' : 'on_demand';
    const skill = resources.skills?.find(item => item.name === skillName);
    if (skill) {
        skill.loadPolicy = policy;
    }
};

const resolveUniqueSkillName = (rawName: string, currentName?: string): string => {
    const resources = draft.forgeAgentResources;
    const baseName = normalizeForgeAgentSkillName(rawName);
    const existingNames = new Set((resources?.skills || [])
        .map(skill => skill.name)
        .filter(name => name !== currentName));
    let nextName = baseName;
    let suffix = 2;
    while (existingNames.has(nextName)) {
        nextName = `${baseName}-${suffix}`;
        suffix += 1;
    }
    return nextName;
};

const updateSkillName = (skillName: string, event: Event) => {
    const resources = draft.forgeAgentResources;
    if (!resources?.skills || !skillName) return;
    const skill = resources.skills.find(item => item.name === skillName);
    if (!skill) return;
    const nextName = resolveUniqueSkillName((event.target as HTMLInputElement).value, skillName);
    skill.name = nextName;
    skill.path = buildForgeAgentSkillPath(nextName);
    (event.target as HTMLInputElement).value = nextName;
};

const updateSkillTitle = (skillName: string, event: Event) => {
    const resources = draft.forgeAgentResources;
    if (!resources?.skills || !skillName) return;
    const skill = resources.skills.find(item => item.name === skillName);
    if (skill) {
        skill.title = (event.target as HTMLInputElement).value;
    }
};

const updateSkillDescription = (skillName: string, event: Event) => {
    const resources = draft.forgeAgentResources;
    if (!resources?.skills || !skillName) return;
    const skill = resources.skills.find(item => item.name === skillName);
    if (skill) {
        skill.description = (event.target as HTMLInputElement).value;
    }
};

const addSkillResource = () => {
    const resources = draft.forgeAgentResources;
    if (!resources) return;
    resources.skills = resources.skills || [];
    const existingNames = new Set(resources.skills.map(skill => skill.name));
    let index = resources.skills.length + 1;
    let name = `custom-skill-${index}`;
    while (existingNames.has(name)) {
        index += 1;
        name = `custom-skill-${index}`;
    }
    resources.skills.push({
        name,
        path: buildForgeAgentSkillPath(name),
        title: '自定义技能',
        description: '预设提供的自定义技能。',
        loadPolicy: 'on_demand',
        content: '# 自定义技能\n\n描述该技能的适用场景、输入、步骤和输出要求。'
    });
    activeResourceGroupId.value = 'skills';
};

const removeSkillResource = (skillName: string) => {
    const resources = draft.forgeAgentResources;
    if (!resources?.skills || !skillName) return;
    resources.skills = resources.skills.filter(skill => skill.name !== skillName);
};

const handleStorageChange = (data: { key?: string } | null) => {
    const key = data?.key;
    if (!key || key === 'lumina-prompt-presets.registry' || key === 'lumina-prompt-presets.bindings' || key === STORAGE_KEY_BUILTIN_OVERRIDES) {
        loadProfile(activeProfileId.value);
    }
};

onMounted(() => {
    loadProfile(activeProfileId.value);
    lwStorage.on('*', handleStorageChange);
});

onUnmounted(() => {
    lwStorage.off('*', handleStorageChange);
});
</script>

<style scoped>
.prompt-preset-workbench {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px 0;
  min-width: 0;
}

.workbench-head,
.preset-toolbar,
.section-head,
.editor-actions,
.workbench-actions,
.profile-tabs,
.entry-row,
.entry-actions,
.overview-metrics,
.resource-tabs,
.resource-group-head,
.resource-editor-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.workbench-head,
.preset-toolbar,
.editor-pane,
.preset-overview {
  border: 1px solid var(--lw-border-base);
  border-radius: 20px;
  background: color-mix(in srgb, var(--lw-bg-elevated) 92%, transparent);
  min-width: 0;
}

.workbench-head {
  justify-content: space-between;
  padding: 18px 20px;
}

.workbench-title {
  font-size: var(--lw-type-title-medium-size);
  font-weight: var(--lw-type-title-small-weight);
  color: var(--lw-text-main);
  text-wrap: balance;
}

.workbench-subtitle {
  margin-top: 4px;
  font-size: var(--lw-type-body-small-size);
  color: var(--lw-text-muted);
  line-height: 1.6;
  text-wrap: pretty;
}

.workbench-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.head-btn,
.save-btn,
.secondary-btn,
.danger-btn,
.mini-btn {
  border-radius: 999px;
  border: 1px solid var(--lw-border-base);
  background: var(--lw-bg-app);
  color: var(--lw-text-main);
  cursor: pointer;
  font-size: var(--lw-type-body-small-size);
  font-weight: var(--lw-type-title-small-weight);
}

.head-btn,
.secondary-btn,
.danger-btn,
.save-btn {
  padding: 8px 12px;
}

.danger-btn,
.mini-btn.danger {
  color: #dc2626;
}

.profile-tabs {
  flex-wrap: wrap;
}

.profile-tab {
  border: 1px solid var(--lw-border-base);
  background: var(--lw-bg-subtle);
  color: var(--lw-text-secondary);
  border-radius: 999px;
  padding: 8px 14px;
  cursor: pointer;
  font-size: var(--lw-type-body-small-size);
  font-weight: var(--lw-type-title-small-weight);
}

.profile-tab.active {
  background: rgba(var(--lw-primary-rgb), 0.12);
  color: var(--lw-primary);
  border-color: rgba(var(--lw-primary-rgb), 0.28);
}

.preset-toolbar {
  padding: 14px 16px;
  flex-wrap: wrap;
  min-width: 0;
}

.preset-overview {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 16px;
  align-items: center;
  padding: 18px 20px;
}

.overview-copy {
  min-width: 0;
}

.overview-eyebrow {
  font-size: var(--lw-type-label-small-size);
  font-weight: var(--lw-type-title-small-weight);
  letter-spacing: 0;
  color: var(--lw-primary);
}

.overview-title {
  margin-top: 3px;
  font-size: var(--lw-type-title-small-size);
  font-weight: var(--lw-type-title-small-weight);
  color: var(--lw-text-main);
  overflow-wrap: anywhere;
}

.overview-description {
  margin-top: 4px;
  max-width: 72ch;
  font-size: var(--lw-type-body-small-size);
  line-height: 1.6;
  color: var(--lw-text-muted);
}

.overview-metrics {
  justify-content: flex-end;
  flex-wrap: wrap;
}

.overview-metric {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 58px;
  padding: 8px 10px;
  border-radius: 14px;
  background: color-mix(in srgb, var(--lw-bg-subtle) 72%, transparent);
}

.overview-metric span {
  font-size: var(--lw-type-label-small-size);
  color: var(--lw-text-muted);
}

.overview-metric strong {
  font-size: var(--lw-type-title-small-size);
  line-height: 1;
  color: var(--lw-text-main);
}

.section-head {
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
}

.section-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
  min-width: 0;
}

.preset-select,
.field-input,
.field-select,
.field-textarea,
.slot-select {
  width: 100%;
  box-sizing: border-box;
  appearance: none;
  border: 1px solid var(--lw-border-base) !important;
  border-radius: 14px;
  background: var(--lw-bg-app) !important;
  color: var(--lw-text-main) !important;
  -webkit-text-fill-color: var(--lw-text-main);
  font: inherit;
  box-shadow: none;
  outline: none;
}

.preset-select:focus,
.field-input:focus,
.field-select:focus,
.field-textarea:focus,
.slot-select:focus {
  border-color: var(--lw-border-active) !important;
  box-shadow: 0 0 0 4px rgba(var(--lw-primary-rgb), 0.08);
}

.field-input::placeholder,
.field-textarea::placeholder {
  color: var(--lw-text-muted);
  -webkit-text-fill-color: var(--lw-text-muted);
}

.preset-select:disabled,
.field-input:disabled,
.field-select:disabled,
.field-textarea:disabled,
.slot-select:disabled {
  background: color-mix(in srgb, var(--lw-bg-muted) 94%, white) !important;
  color: var(--lw-text-muted) !important;
  -webkit-text-fill-color: var(--lw-text-muted);
  border-color: var(--lw-border-subtle) !important;
  cursor: not-allowed;
  opacity: 1;
}

.preset-select {
  min-width: 0;
  max-width: min(100%, 320px);
  padding: 8px 12px;
}

.preset-engine,
.preset-state,
.entry-tag {
  border-radius: 999px;
  padding: 4px 9px;
  font-size: var(--lw-type-label-small-size);
  font-weight: var(--lw-type-title-small-weight);
  background: color-mix(in srgb, var(--lw-bg-subtle) 86%, transparent);
  color: var(--lw-text-secondary);
}

.preset-engine,
.preset-state {
  white-space: nowrap;
}

.preset-state.builtIn {
  color: var(--lw-text-muted);
}

.editor-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 14px;
  min-width: 0;
}

.editor-pane {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  min-width: 0;
  overflow: hidden;
}

.section-title {
  font-size: var(--lw-type-body-medium-size);
  font-weight: var(--lw-type-title-small-weight);
  color: var(--lw-text-main);
  min-width: 0;
}

.field-label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: var(--lw-type-body-small-size);
  font-weight: var(--lw-type-title-small-weight);
  color: var(--lw-text-secondary);
}

.field-input,
.field-select {
  padding: 10px 12px;
}

.field-textarea {
  resize: vertical;
  min-height: 92px;
  max-width: 100%;
  padding: 10px 12px;
  line-height: 1.55;
}

.resource-textarea {
  min-height: 148px;
  font-family: ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', monospace;
  font-size: var(--lw-type-body-small-size);
}

.skill-metadata-grid {
  display: grid;
  grid-template-columns: minmax(150px, 0.8fr) minmax(150px, 0.8fr) minmax(220px, 1.4fr);
  gap: 10px;
  min-width: 0;
}

.slot-select {
  width: min(100%, 220px);
}

.char-card-grid,
.special-block,
.generation-settings-block,
.agent-resource-block,
.agent-orchestration,
.orchestration-list,
.resource-list,
.resource-group-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.resource-tabs {
  flex-wrap: wrap;
  padding: 4px;
  border: 1px solid var(--lw-border-base);
  border-radius: 16px;
  background: color-mix(in srgb, var(--lw-bg-subtle) 64%, transparent);
}

.resource-tab {
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--lw-text-secondary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  font-size: var(--lw-type-body-small-size);
  font-weight: var(--lw-type-title-small-weight);
}

.resource-tab.active {
  background: var(--lw-bg-elevated);
  color: var(--lw-text-main);
  box-shadow: inset 0 0 0 1px var(--lw-border-base);
}

.resource-tab span {
  border-radius: 999px;
  padding: 1px 7px;
  background: color-mix(in srgb, var(--lw-bg-muted) 78%, transparent);
  color: var(--lw-text-muted);
  font-size: var(--lw-type-label-small-size);
}

.resource-group-panel {
  min-width: 0;
}

.resource-group-head {
  justify-content: space-between;
  align-items: flex-start;
  padding: 4px 2px 0;
}

.resource-group-title {
  font-size: var(--lw-type-body-medium-size);
  font-weight: var(--lw-type-title-small-weight);
  color: var(--lw-text-main);
}

.resource-group-description {
  margin-top: 3px;
  color: var(--lw-text-muted);
  font-size: var(--lw-type-body-small-size);
  line-height: 1.55;
}

.resource-editor-card,
.empty-resource-state,
.collapsible-block {
  border: 1px solid var(--lw-border-base);
  border-radius: 16px;
  background: color-mix(in srgb, var(--lw-bg-app) 78%, transparent);
}

.resource-editor-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  padding: 12px;
}

.resource-editor-head {
  align-items: flex-start;
  min-width: 0;
}

.resource-editor-title {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.resource-editor-title strong {
  color: var(--lw-text-main);
  font-size: var(--lw-type-body-small-size);
}

.resource-editor-title span {
  color: var(--lw-text-muted);
  font-size: var(--lw-type-label-small-size);
  overflow-wrap: anywhere;
}

.skill-resource-controls {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

.field-label.compact {
  max-width: 180px;
}

.resource-preview {
  margin: 0;
  max-height: 260px;
  overflow: auto;
  white-space: pre-wrap;
  border-radius: 14px;
  background: color-mix(in srgb, var(--lw-bg-subtle) 78%, transparent);
  padding: 12px;
  color: var(--lw-text-secondary);
  font-family: ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', monospace;
  font-size: var(--lw-type-body-small-size);
  line-height: 1.55;
}

.empty-resource-state {
  padding: 14px;
  color: var(--lw-text-muted);
  font-size: var(--lw-type-body-small-size);
  line-height: 1.6;
}

.collapsible-block {
  padding: 0;
  overflow: hidden;
}

.collapsible-block summary {
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 13px 14px;
  color: var(--lw-text-main);
  font-size: var(--lw-type-body-small-size);
  font-weight: var(--lw-type-title-small-weight);
}

.collapsible-block summary span:last-child {
  color: var(--lw-text-muted);
  font-size: var(--lw-type-label-small-size);
}

.collapsible-block .generation-settings-block {
  padding: 0 14px 14px;
}

.generation-settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.section-hint {
  margin: 0;
  font-size: var(--lw-type-body-small-size);
  line-height: 1.6;
  color: var(--lw-text-muted);
}

.entry-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.entry-card {
  border: 1px solid var(--lw-border-base);
  border-radius: 16px;
  padding: 12px;
  background: color-mix(in srgb, var(--lw-bg-app) 78%, transparent);
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  overflow: hidden;
}

.entry-main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1 1 260px;
}

.entry-checkbox {
  appearance: none;
  width: 18px;
  height: 18px;
  margin: 0;
  border: 1px solid var(--lw-border-strong) !important;
  border-radius: 6px;
  background: var(--lw-bg-elevated) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.42);
  cursor: pointer;
  position: relative;
  flex-shrink: 0;
}

.entry-checkbox:focus {
  outline: none;
  border-color: var(--lw-border-active) !important;
  box-shadow: 0 0 0 4px rgba(var(--lw-primary-rgb), 0.08);
}

.entry-checkbox:checked {
  background: rgba(var(--lw-primary-rgb), 0.14) !important;
  border-color: rgba(var(--lw-primary-rgb), 0.36) !important;
}

.entry-checkbox:checked::after {
  content: '';
  position: absolute;
  left: 5px;
  top: 1px;
  width: 5px;
  height: 10px;
  border: solid var(--lw-text-main);
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.entry-title {
  font-size: var(--lw-type-body-medium-size);
  font-weight: var(--lw-type-title-small-weight);
  color: var(--lw-text-main);
  line-height: 1.5;
  word-break: break-word;
}

.entry-tags {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.entry-tag.role {
  color: var(--lw-primary);
}

.entry-tag.disabled {
  color: var(--lw-text-muted);
  background: color-mix(in srgb, var(--lw-bg-muted) 92%, transparent);
}

.orchestration-card,
.resource-card {
  border: 1px solid var(--lw-border-base);
  border-radius: 16px;
  background: color-mix(in srgb, var(--lw-bg-app) 78%, transparent);
  min-width: 0;
}

.orchestration-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 12px;
}

.orchestration-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: rgba(var(--lw-primary-rgb), 0.1);
  color: var(--lw-primary);
  font-size: var(--lw-type-label-small-size);
  font-weight: var(--lw-type-title-small-weight);
}

.orchestration-main,
.resource-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.orchestration-title,
.resource-title {
  color: var(--lw-text-main);
  font-weight: var(--lw-type-title-small-weight);
  font-size: var(--lw-type-body-small-size);
}

.orchestration-path,
.resource-path {
  color: var(--lw-text-muted);
  font-size: var(--lw-type-label-small-size);
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.resource-card {
  padding: 12px;
}

.resource-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex-wrap: wrap;
}

.entry-row {
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
}

.entry-actions {
  justify-content: flex-end;
  flex-wrap: wrap;
  flex: 0 0 auto;
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 12px;
  border: 1px solid var(--lw-border-base);
  background: var(--lw-bg-app);
  color: var(--lw-text-secondary);
  cursor: pointer;
  transition: background-color 140ms ease, color 140ms ease, border-color 140ms ease;
}

.icon-btn:hover:not(:disabled) {
  color: var(--lw-text-main);
  background: color-mix(in srgb, var(--lw-bg-subtle) 92%, transparent);
}

.icon-btn:disabled {
  opacity: 0.42;
  cursor: not-allowed;
}

.icon-btn.danger {
  color: #dc2626;
}

.entry-editor,
.engine-hint {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.engine-hint {
  font-size: var(--lw-type-body-small-size);
  line-height: 1.6;
  color: var(--lw-text-muted);
  border: 1px dashed var(--lw-border-base);
  border-radius: 14px;
  padding: 14px;
}

@media (max-width: 1080px) {
  .workbench-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .preset-overview {
    grid-template-columns: minmax(0, 1fr);
    align-items: flex-start;
  }

  .workbench-actions {
    width: 100%;
    justify-content: flex-start;
  }

  .section-actions {
    width: 100%;
    justify-content: flex-start;
  }

  .skill-metadata-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (min-width: 1320px) {
  .editor-grid {
    grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
  }
}
</style>
