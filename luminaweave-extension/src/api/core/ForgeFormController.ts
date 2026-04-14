import { lwStorage } from '../storage.js';
import type { ForgeMemorySource } from '../../types/ForgeMemoryTypes.js';
import type {
    ForgeLayer,
    ForgeStructuredFieldState,
    ForgeStructuredFormState,
    ForgeStructuredState
} from '../../types/ForgeStructuredTypes.js';

// ────────────────── Types ──────────────────

export type ForgeFieldBlueprint = {
    kind: 'input' | 'textarea' | 'select' | 'checklist';
    key: string;
    label: string;
    placeholder?: string;
    options?: string;
};

export type ForgeLayerBlueprint = {
    layer: ForgeLayer;
    formId: string;
    title: string;
    description: string;
    fields: ForgeFieldBlueprint[];
};

// ────────────────── Constants ──────────────────

export const kickoffBlueprint: ForgeLayerBlueprint = {
    layer: 'concept',
    formId: 'kickoff_intent',
    title: '启动阶段 · 偏好与方向',
    description: '先确定这次 Forge 的方向切入点与思考维度，再进入最小角色骨架。',
    fields: [
        { kind: 'select', key: 'direction', label: '方向选择', options: '邂逅人物|沿途风景|漫游治愈|未知冒险' },
        { kind: 'checklist', key: 'facets', label: '思考维度', options: '人物关系|空间变化|情绪流动|节奏起伏' }
    ]
};

export const orderedLayers: ForgeLayer[] = [
    'concept', 'entity', 'state_machine', 'description', 'variables', 'summary', 'output'
];

export const expansionLayerOrder: ForgeLayer[] = ['entity', 'state_machine', 'variables', 'summary', 'output'];

export const layerBlueprints: Record<ForgeLayer, ForgeLayerBlueprint> = {
    concept: {
        layer: 'concept',
        formId: 'role_core_profile',
        title: '概念层 · 角色基元采集',
        description: '先定义角色的最小可运行骨架，包括姓名、核心设定与背景摘要。',
        fields: [
            { kind: 'input', key: 'name', label: '角色姓名', placeholder: '例如：林雾' },
            { kind: 'input', key: 'identity', label: '一句话核心设定', placeholder: '例如：失忆的教会审讯官' },
            { kind: 'textarea', key: 'background', label: '背景故事', placeholder: '描述成长经历、重大创伤、当前处境' },
            { kind: 'select', key: 'faction', label: '阵营 / 立场', options: '教会|帝国|雇佣兵|中立|未定' }
        ]
    },
    entity: {
        layer: 'entity',
        formId: 'entity_materials',
        title: '实体层 · 世界与角色实体',
        description: '整理人物关系、物件、阵营和世界中实际存在的内容。',
        fields: [
            { kind: 'textarea', key: 'core_cast', label: '核心角色群像', placeholder: '列出主要角色及关系' },
            { kind: 'textarea', key: 'world_entities', label: '关键实体 / 势力 / 物件', placeholder: '列出必须存在的世界实体' }
        ]
    },
    state_machine: {
        layer: 'state_machine',
        formId: 'state_machine_flow',
        title: '状态机层 · 阶段与拓扑',
        description: '定义剧情阶段、地图连通或状态跳转规则。',
        fields: [
            { kind: 'textarea', key: 'state_nodes', label: '状态节点', placeholder: '列出主要状态或区域节点' },
            { kind: 'textarea', key: 'state_edges', label: '状态迁移规则', placeholder: '描述节点之间如何连通或切换' }
        ]
    },
    description: {
        layer: 'description',
        formId: 'description_guides',
        title: '描写层 · 叙事与语言',
        description: '补叙事指南、语料模式和场景策略。',
        fields: [
            { kind: 'textarea', key: 'narrative_core', label: '叙事指南核心', placeholder: '强调该写什么、不该写什么' },
            { kind: 'textarea', key: 'style_notes', label: '语言 / 场景策略', placeholder: '描述特定场景下的写法' }
        ]
    },
    variables: {
        layer: 'variables',
        formId: 'variable_routes',
        title: '变量层 · 数据与路由',
        description: '设计变量体系、字段更新和条件显示依赖。',
        fields: [
            { kind: 'textarea', key: 'variable_inventory', label: '变量盘点', placeholder: '列出需要追踪的变量和来源' },
            { kind: 'textarea', key: 'condition_routes', label: '条件路由', placeholder: '描述变量如何控制条件显示' }
        ]
    },
    summary: {
        layer: 'summary',
        formId: 'world_root_index',
        title: '汇总层 · 根目录',
        description: '整理世界根目录和总索引。',
        fields: [
            { kind: 'textarea', key: 'root_index', label: '世界根目录', placeholder: '按目录组织已设计内容' }
        ]
    },
    output: {
        layer: 'output',
        formId: 'output_design',
        title: '输出层 · 回复格式与状态栏',
        description: '收束最终输出格式、状态栏和展示要求。',
        fields: [
            { kind: 'textarea', key: 'statusbar_design', label: '状态栏设计', placeholder: '描述最终显示元素' },
            { kind: 'textarea', key: 'reply_format', label: '回复格式', placeholder: '描述运行时输出结构' }
        ]
    }
};

export const layerBlueprintByFormId = Object.values(layerBlueprints).reduce<Record<string, ForgeLayerBlueprint>>((acc, blueprint) => {
    acc[blueprint.formId] = blueprint;
    return acc;
}, {
    [kickoffBlueprint.formId]: kickoffBlueprint
});

// ────────────────── Helpers ──────────────────

export const createStructuredFieldState = (value: string | string[], source: ForgeStructuredFieldState['source'] = 'system'): ForgeStructuredFieldState => ({
    value,
    locked: false,
    confirmed: false,
    source,
    updatedAt: Date.now()
});

export const isStructuredValueEmpty = (value: string | string[]): boolean => {
    if (Array.isArray(value)) return value.length === 0;
    return !String(value || '').trim();
};

export const isModelFormPrefillEnabled = (): boolean =>
    lwStorage.get('lumina-forge.enableModelFormPrefill', true, 'Global') !== false;

export const isValidStructuredFieldBinding = (formId: string | undefined, fieldKey: string | undefined): boolean => {
    if (!formId?.trim() || !fieldKey?.trim()) return false;
    const blueprint = layerBlueprintByFormId[formId];
    if (!blueprint) return false;
    return blueprint.fields.some(f => f.key === fieldKey);
};

// ────────────────── Deps Interface ──────────────────

export interface FormControllerDeps {
    getStructuredState(): ForgeStructuredState;
    getTransientSelections(): Map<string, string | string[]>;
    upsertTransientSelection(key: string, value: string | string[]): void;
    getActiveLayer(): ForgeLayer;
    setActiveLayer(layer: ForgeLayer): void;
    getCompletedLayers(): ForgeLayer[];
    setCompletedLayers(layers: ForgeLayer[]): void;
    getDetailMode(): string | null;
    addAssistantViewMessage(content: string): void;
    upsertForgeMemory(path: string, title: string, content: string, source: ForgeMemorySource, summary?: string): void;
    syncDraftTree(): void;
    persistSession(): void;
}

// ────────────────── Controller ──────────────────

export class ForgeFormController {
    constructor(private deps: FormControllerDeps) {}

    createFormFromBlueprint(blueprint: ForgeLayerBlueprint): ForgeStructuredFormState {
        return {
            id: blueprint.formId,
            layer: blueprint.layer,
            title: blueprint.title,
            fields: blueprint.fields.reduce<Record<string, ForgeStructuredFieldState>>((acc, field) => {
                acc[field.key] = createStructuredFieldState(field.kind === 'checklist' ? [] : '');
                return acc;
            }, {}),
            missingFields: blueprint.fields.map(field => field.key),
            lastSubmittedAt: null
        };
    }

    ensureFormById(formId: string): ForgeStructuredFormState {
        const state = this.deps.getStructuredState();
        const blueprint = layerBlueprintByFormId[formId] || layerBlueprints[this.deps.getActiveLayer()];
        const existing = state.forms[blueprint.formId];
        if (existing) {
            state.activeFormId = existing.id;
            state.activeMessageFormId = blueprint.formId === kickoffBlueprint.formId ? blueprint.formId : state.activeMessageFormId;
            return existing;
        }

        const nextForm = this.createFormFromBlueprint(blueprint);
        state.forms[blueprint.formId] = nextForm;
        state.activeFormId = nextForm.id;
        if (blueprint.formId === kickoffBlueprint.formId) {
            state.activeMessageFormId = blueprint.formId;
        }
        state.lastUpdatedAt = Date.now();
        this.deps.persistSession();
        return nextForm;
    }

    ensureLayerForm(layerName: ForgeLayer): ForgeStructuredFormState {
        return this.ensureFormById(layerBlueprints[layerName].formId);
    }

    recomputeMissingFields(formId: string): string[] {
        const state = this.deps.getStructuredState();
        const form = state.forms[formId];
        if (!form) return [];
        const blueprint = layerBlueprintByFormId[formId];
        const missingFields = blueprint.fields
            .filter((field) => {
                const currentField = form.fields[field.key];
                if (!currentField) return true;
                if (Array.isArray(currentField.value)) return currentField.value.length === 0;
                return !String(currentField.value || '').trim();
            })
            .map(field => field.key);

        form.missingFields = missingFields;
        state.lastUpdatedAt = Date.now();
        return missingFields;
    }

    getStructuredFieldText(formId: string | undefined, fieldKey: string): string {
        if (formId) {
            const currentField = this.deps.getStructuredState().forms[formId]?.fields[fieldKey];
            if (currentField) {
                return Array.isArray(currentField.value) ? currentField.value.join(', ') : String(currentField.value || '');
            }
        }
        const transient = this.deps.getTransientSelections().get(fieldKey);
        if (transient !== undefined) {
            return Array.isArray(transient) ? transient.join(', ') : String(transient || '');
        }
        return '';
    }

    hasStructuredFieldBinding(formId: string, fieldKey: string): boolean {
        return isValidStructuredFieldBinding(formId, fieldKey);
    }

    getStructuredFieldList(formId: string | undefined, fieldKey: string): string[] {
        if (formId) {
            const currentField = this.deps.getStructuredState().forms[formId]?.fields[fieldKey];
            if (currentField) {
                if (Array.isArray(currentField.value)) return currentField.value;
                return currentField.value ? [String(currentField.value)] : [];
            }
        }
        const transient = this.deps.getTransientSelections().get(fieldKey);
        if (transient !== undefined) {
            if (Array.isArray(transient)) return transient;
            return transient ? [String(transient)] : [];
        }
        return [];
    }

    setStructuredFieldValue(formId: string | undefined, fieldKey: string, nextValue: string | string[], source: ForgeStructuredFieldState['source'] = 'manual'): void {
        if (!formId || !isValidStructuredFieldBinding(formId, fieldKey)) {
            console.log(`[Forge-Store] 检测到非蓝图绑定字段，自动路由至瞬态存储 (Temporary Mode): "${fieldKey}"`);
            this.deps.upsertTransientSelection(fieldKey, nextValue);
            return;
        }

        const state = this.deps.getStructuredState();
        const form = state.forms[formId] || this.ensureFormById(formId);
        form.fields[fieldKey] = {
            value: nextValue,
            locked: form.fields[fieldKey]?.locked || false,
            confirmed: Array.isArray(nextValue) ? nextValue.length > 0 : Boolean(String(nextValue).trim()),
            source,
            updatedAt: Date.now()
        };
        state.activeFormId = formId;
        state.activeMessageFormId = formId;
        this.recomputeMissingFields(formId);
        this.deps.persistSession();
    }

    prefillStructuredForm(payload: {
        formId?: string | null;
        layer?: ForgeLayer | null;
        fields: Array<{ fieldKey: string; value: string | string[] }>;
        overwrite?: boolean;
        source?: ForgeStructuredFieldState['source'];
    }): void {
        if (!isModelFormPrefillEnabled()) return;

        const state = this.deps.getStructuredState();
        const resolvedFormId = payload.formId
            || (payload.layer ? layerBlueprints[payload.layer]?.formId : null)
            || state.activeMessageFormId
            || state.activeFormId;

        if (!resolvedFormId || payload.fields.length === 0) return;

        const form = state.forms[resolvedFormId] || this.ensureFormById(resolvedFormId);
        const source = payload.source || 'system';
        const overwrite = payload.overwrite === true;
        const now = Date.now();
        let changed = false;

        payload.fields.forEach((field) => {
            const currentField = form.fields[field.fieldKey];
            if (!currentField) return;
            if (!overwrite && !isStructuredValueEmpty(currentField.value)) return;

            form.fields[field.fieldKey] = {
                value: field.value,
                locked: currentField.locked || false,
                confirmed: !isStructuredValueEmpty(field.value),
                source,
                updatedAt: now
            };
            changed = true;
        });

        if (!changed) return;

        state.activeFormId = resolvedFormId;
        state.activeMessageFormId = resolvedFormId;
        this.recomputeMissingFields(resolvedFormId);
        this.deps.persistSession();
    }

    buildFormResultXml(formId: string): string {
        const form = this.deps.getStructuredState().forms[formId];
        if (!form) return '';
        const fieldLines = Object.entries(form.fields).map(([fieldKey, fieldState]) => {
            const serialized = Array.isArray(fieldState.value)
                ? fieldState.value.join(' | ')
                : String(fieldState.value || '');
            return `  <FIELD key="${fieldKey}">${serialized}</FIELD>`;
        });

        return [
            `<forge_form_result form="${form.id}" layer="${form.layer}">`,
            ...fieldLines,
            '</forge_form_result>'
        ].join('\n');
    }

    buildLayerFormDsl(layerName: ForgeLayer): string {
        const blueprint = layerBlueprints[layerName];
        this.ensureLayerForm(layerName);

        const lines = [
            '<V>',
            `ForgeForm("${blueprint.formId}", "${blueprint.title}", "${blueprint.description}", "${blueprint.layer}")`,
            `ForgeLayerNavigator("${layerName}", "${orderedLayers.join('|')}", "${this.deps.getCompletedLayers().join('|')}")`
        ];

        blueprint.fields.forEach((field) => {
            if (field.kind === 'input') {
                lines.push(`ForgeInput("${blueprint.formId}", "${field.key}", "${field.label}", "${field.placeholder || ''}")`);
            } else if (field.kind === 'textarea') {
                lines.push(`ForgeTextarea("${blueprint.formId}", "${field.key}", "${field.label}", "${field.placeholder || ''}")`);
            } else if (field.kind === 'select') {
                lines.push(`ForgeSelect("${blueprint.formId}", "${field.key}", "${field.label}", "${field.options || ''}")`);
            } else if (field.kind === 'checklist') {
                lines.push(`ForgeChecklist("${blueprint.formId}", "${field.key}", "${field.label}", "${field.options || ''}")`);
            }
        });

        lines.push(`ForgeMissingFields("${blueprint.formId}", "${this.recomputeMissingFields(blueprint.formId).join(',')}")`);
        lines.push('</V>');
        return lines.join('\n');
    }

    summarizeFormValues(formId: string): string {
        const form = this.deps.getStructuredState().forms[formId];
        if (!form) return '';

        return Object.entries(form.fields)
            .map(([fieldKey, fieldState]) => {
                const serialized = Array.isArray(fieldState.value)
                    ? fieldState.value.join('、')
                    : String(fieldState.value || '').trim();
                if (!serialized) return '';
                return `${fieldKey}：${serialized}`;
            })
            .filter(Boolean)
            .join('\n');
    }

    buildSubmittedFormUserInput(formId: string): string {
        const form = this.deps.getStructuredState().forms[formId];
        if (!form) return '';

        const summary = this.summarizeFormValues(formId);
        if (!summary) return `我刚提交了 ${form.title}。`;

        return [
            `我刚提交了 ${form.title}。`,
            `请基于这些已确认内容继续推进当前 Forge 流程：`,
            summary
        ].join('\n');
    }

    resolveNextLayerAfterSubmission(layer: ForgeLayer): ForgeLayer {
        if (layer === 'concept') return 'description';
        if (layer === 'description') return 'entity';
        if (expansionLayerOrder.includes(layer)) {
            const currentIndex = expansionLayerOrder.indexOf(layer);
            return expansionLayerOrder[currentIndex + 1] || layer;
        }
        return layer;
    }

    syncFormSubmissionIntoMemory(formId: string): void {
        const summary = this.summarizeFormValues(formId);
        if (!summary) return;

        if (formId === kickoffBlueprint.formId) {
            this.deps.upsertForgeMemory('启动/用户偏好', '启动偏好', summary, 'user', summary.replace(/\n/g, '；'));
            return;
        }
        if (formId === layerBlueprints.concept.formId) {
            this.deps.upsertForgeMemory('设定决议/角色骨架', '角色骨架', summary, 'user', summary.replace(/\n/g, '；'));
            return;
        }
        if (formId === layerBlueprints.description.formId) {
            this.deps.upsertForgeMemory('设定决议/叙事与表现', '叙事与表现', summary, 'user', summary.replace(/\n/g, '；'));
            return;
        }
        if (formId === layerBlueprints.entity.formId || formId === layerBlueprints.state_machine.formId || formId === layerBlueprints.variables.formId) {
            this.deps.upsertForgeMemory('设定决议/世界观', '世界观与结构扩展', summary, 'user', summary.replace(/\n/g, '；'));
            return;
        }
        if (formId === layerBlueprints.summary.formId || formId === layerBlueprints.output.formId) {
            this.deps.upsertForgeMemory('设定决议/核心想法', '核心想法与输出收束', summary, 'user', summary.replace(/\n/g, '；'));
        }
    }

    applySubmittedFormResult(formId: string): void {
        const state = this.deps.getStructuredState();
        const form = state.forms[formId];
        if (!form) return;

        const missingFields = this.recomputeMissingFields(formId);
        form.lastSubmittedAt = Date.now();
        state.activeMessageFormId = null;
        this.deps.addAssistantViewMessage(this.buildFormResultXml(formId));
        this.syncFormSubmissionIntoMemory(formId);

        if (formId === kickoffBlueprint.formId) {
            this.deps.setActiveLayer('concept');
        } else if (missingFields.length === 0 && !this.deps.getCompletedLayers().includes(form.layer)) {
            this.deps.setCompletedLayers([...this.deps.getCompletedLayers(), form.layer]);
            this.deps.setActiveLayer(this.resolveNextLayerAfterSubmission(form.layer));
        } else {
            this.deps.setActiveLayer(form.layer);
        }

        if (missingFields.length === 0) {
            form.missingFields = [];
        }
        this.deps.syncDraftTree();
        this.deps.persistSession();
    }
}
