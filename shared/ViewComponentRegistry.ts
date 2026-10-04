/**
 * ViewComponentRegistry - 组件 Schema 注册中心
 *
 * 管理所有 LuminaView DSL 可用的组件定义，
 * 提供位置参数到命名属性的映射规则。
 */

/** 属性定义 */
export interface PropDef {
    /** 属性键名 */
    key: string;
    /** 值类型 */
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    /** 是否必需 */
    required: boolean;
}

/** 组件 Schema 定义 */
export interface ViewComponentSchema {
    /** 全名，如 "Stat" */
    name: string;
    /** 管道模式缩写，如 "S" */
    shortCode?: string;
    /** 组件描述 */
    description?: string;
    /** 属性定义列表（键的顺序 = 位置参数顺序） */
    props: PropDef[];
}

/** 解析后的组件实例 */
export interface ParsedViewComponent {
    /** 组件名（统一为全名） */
    component: string;
    /** 解析后的命名属性 */
    props: Record<string, unknown>;
}

export type ViewSyntaxStyle = 'functional' | 'pipe';

const supportsForgeOptionsVarargs = (schema: ViewComponentSchema): boolean => (
    schema.name === 'ForgeChoiceGroup'
    || schema.name === 'ForgeFacetChecklist'
    || schema.name === 'ForgeFormAssist'
);

/**
 * 组件 Schema 注册中心
 */
class ViewComponentRegistryImpl {
    /** 全名映射：name -> schema */
    private byName = new Map<string, ViewComponentSchema>();
    /** 缩写映射：shortCode -> schema */
    private byShortCode = new Map<string, ViewComponentSchema>();

    constructor() {
        this.registerBuiltins();
    }

    /** 注册组件 Schema */
    public register(schema: ViewComponentSchema): void {
        this.byName.set(schema.name, schema);
        if (schema.shortCode) {
            this.byShortCode.set(schema.shortCode, schema);
        }
    }

    /** 通过全名或缩写查找 Schema */
    public resolve(nameOrCode: string): ViewComponentSchema | undefined {
        return this.byName.get(nameOrCode) || this.byShortCode.get(nameOrCode);
    }

    /** 获取所有已注册的组件名 */
    public getRegisteredNames(): string[] {
        return Array.from(this.byName.keys());
    }

    /**
     * 将位置参数数组映射为命名属性对象
     *
     * @param schema 组件 Schema
     * @param args 位置参数数组（已解析为 JS 值）
     */
    public mapPositionalArgs(schema: ViewComponentSchema, args: unknown[]): Record<string, unknown> {
        const finalArgs = args;

        const result: Record<string, unknown> = {};

        for (let i = 0; i < schema.props.length; i++) {
            const prop = schema.props[i];
            if (i < finalArgs.length) {
                // 如果是最后一个预定义的属性，且实际上还有更多剩余参数，则进行贪婪合并
                if (i === schema.props.length - 1 && finalArgs.length > schema.props.length) {
                    const remaining = finalArgs.slice(i).map(a => String(a));
                    result[prop.key] = supportsForgeOptionsVarargs(schema)
                        ? remaining
                        : remaining.join('|');
                } else {
                    result[prop.key] = finalArgs[i];
                }
            }
        }

        return result;
    }

    private getExampleArg(schema: ViewComponentSchema, prop: PropDef): any {
        if (prop.key === 'fieldKey') {
            if (schema.name === 'ForgeChoiceGroup') return '"kickoff_intent/direction"';
            if (schema.name === 'ForgeFacetChecklist') return '"kickoff_intent/facets"';
            if (schema.name === 'ForgeSelect') return '"role_core_profile/faction"';
            if (schema.name === 'ForgeTextarea') return '"role_core_profile/background"';
            if (schema.name === 'ForgeInput') return '"role_core_profile/name"';
            return '"character/name"';
        }
        if (prop.key === 'label') {
            if (schema.name === 'ForgeChoiceGroup') return '"标题内容"';
            if (schema.name === 'ForgeFacetChecklist') return '"聚焦维度"';
            if (schema.name === 'ForgeSelect') return '"阵营 / 立场"';
            if (schema.name === 'ForgeTextarea') return '"背景故事"';
            if (schema.name === 'ForgeInput') return '"角色姓名"';
            if (schema.name === 'ForgeForm') return '"角色基元采集"';
            return '"名称"';
        }
        if (prop.key === 'title' && schema.name === 'ForgeForm') return '"角色基元采集"';
        if (prop.key === 'description' && schema.name === 'ForgeForm') return '"先补齐角色的最小可运行骨架。"';
        if (prop.key === 'layer' && schema.name === 'ForgeForm') return '"concept"';
        if (prop.key === 'placeholder') return '"例如：林雾"';
        if (prop.key === 'options') return '"选项1|选项2"';
        if (prop.key === 'formId') return '"role_core"';
        if (prop.key === 'fields') return '"char/name|张三", "age|20"';
        if (prop.key === 'currentLayer') return '"concept"';
        if (prop.key === 'availableLayers') return '"concept,entity"';
        return '""';
    }

    private getPropMeaning(schema: ViewComponentSchema, prop: PropDef): string {
        if (prop.key === 'fieldKey') {
            return '字段标识路径。例如 "form/field" 表示蓝图字段，仅 "field" 表示消息级临时字段。';
        }
        if (prop.key === 'options') {
            return '选项列表。支持 "选项1|选项2" 或 "提交值::显示名" 格式。变长组件支持传递多个字符串参数。';
        }
        if (prop.key === 'fields') {
            return '建议列表。格式为 "路径|建议值" 或 "路径|建议值::说明"。支持多个参数。';
        }
        if (prop.key === 'label') return '界面显示标签/标题文字';
        if (prop.key === 'placeholder') return '输入框占位符提示';
        if (prop.key === 'content') return '卡片展示的正文内容';
        if (prop.key === 'formId') return '对应的表单 ID';
        if (prop.key === 'tone') return '摘要卡的语气/视觉风格标记';
        return prop.key;
    }

    /** 注册内置组件 */
    private registerBuiltins(): void {
        const builtins: ViewComponentSchema[] = [
            {
                name: 'Stat', shortCode: 'S',
                description: '人物属性/数值展示条',
                props: [
                    { key: 'label', type: 'string', required: true },
                    { key: 'value', type: 'number', required: true },
                    { key: 'max', type: 'number', required: false }
                ]
            },
            {
                name: 'Progress', shortCode: 'P',
                description: '通用进度条',
                props: [
                    { key: 'label', type: 'string', required: true },
                    { key: 'value', type: 'number', required: true }
                ]
            },
            {
                name: 'Alert', shortCode: 'A',
                description: '系统提示或警告框',
                props: [
                    { key: 'level', type: 'string', required: true },
                    { key: 'message', type: 'string', required: true }
                ]
            },
            {
                name: 'Choices', shortCode: 'C',
                description: '交互式决策分支（提供数组字符串）',
                props: [
                    { key: 'options', type: 'array', required: true }
                ]
            },
            {
                name: 'Quote', shortCode: 'Q',
                description: '引用或旁白文本块',
                props: [
                    { key: 'text', type: 'string', required: true },
                    { key: 'attribution', type: 'string', required: false }
                ]
            },
            {
                name: 'Badge', shortCode: 'B',
                description: '状态标签/徽章',
                props: [
                    { key: 'label', type: 'string', required: true },
                    { key: 'value', type: 'string', required: false },
                    { key: 'variant', type: 'string', required: false }
                ]
            },
            {
                name: 'Sep', shortCode: '—',
                description: '分割线',
                props: []
            },
            {
                name: 'ForgeModePicker',
                shortCode: 'FMP',
                description: 'Forge 协作节奏选择器',
                props: [
                    { key: 'title', type: 'string', required: false },
                    { key: 'structuredLabel', type: 'string', required: false },
                    { key: 'freeformLabel', type: 'string', required: false }
                ]
            },
            {
                name: 'ForgeForm',
                shortCode: 'FF',
                description: 'Forge 表单容器头部',
                props: [
                    { key: 'formId', type: 'string', required: true },
                    { key: 'title', type: 'string', required: true },
                    { key: 'description', type: 'string', required: false },
                    { key: 'layer', type: 'string', required: false }
                ]
            },
            {
                name: 'ForgeInput',
                shortCode: 'FI',
                description: 'Forge 单行字段输入',
                props: [
                    { key: 'fieldKey', type: 'string', required: true },
                    { key: 'label', type: 'string', required: true },
                    { key: 'placeholder', type: 'string', required: false }
                ]
            },
            {
                name: 'ForgeTextarea',
                shortCode: 'FT',
                description: 'Forge 多行字段输入',
                props: [
                    { key: 'fieldKey', type: 'string', required: true },
                    { key: 'label', type: 'string', required: true },
                    { key: 'placeholder', type: 'string', required: false }
                ]
            },
            {
                name: 'ForgeSelect',
                shortCode: 'FS',
                description: 'Forge 单选选择器',
                props: [
                    { key: 'fieldKey', type: 'string', required: true },
                    { key: 'label', type: 'string', required: true },
                    { key: 'options', type: 'string', required: true }
                ]
            },
            {
                name: 'ForgeChecklist',
                shortCode: 'FK',
                description: 'Forge 多选选择器',
                props: [
                    { key: 'fieldKey', type: 'string', required: true },
                    { key: 'label', type: 'string', required: true },
                    { key: 'options', type: 'string', required: true }
                ]
            },
            {
                name: 'ForgeChoiceGroup',
                shortCode: 'FCG',
                description: 'Forge 启动阶段单选方向组',
                props: [
                    { key: 'fieldKey', type: 'string', required: true },
                    { key: 'label', type: 'string', required: true },
                    { key: 'options', type: 'string', required: true }
                ]
            },
            {
                name: 'ForgeFacetChecklist',
                shortCode: 'FFC',
                description: 'Forge 启动阶段多选维度组',
                props: [
                    { key: 'fieldKey', type: 'string', required: true },
                    { key: 'label', type: 'string', required: true },
                    { key: 'options', type: 'string', required: true }
                ]
            },
            {
                name: 'ForgeMessageSubmit',
                shortCode: 'FMS',
                description: 'Forge 消息级统一提交按钮',
                props: [
                    { key: 'formId', type: 'string', required: false },
                    { key: 'label', type: 'string', required: false }
                ]
            },
            {
                name: 'ForgeLayerNavigator',
                shortCode: 'FL',
                description: 'Forge 层导航',
                props: [
                    { key: 'currentLayer', type: 'string', required: true },
                    { key: 'availableLayers', type: 'string', required: true },
                    { key: 'completedLayers', type: 'string', required: false }
                ]
            },
            {
                name: 'ForgeSummaryCard',
                shortCode: 'FSC',
                description: 'Forge 结构化摘要卡片',
                props: [
                    { key: 'title', type: 'string', required: true },
                    { key: 'summary', type: 'string', required: true },
                    { key: 'tone', type: 'string', required: false }
                ]
            },
            {
                name: 'ForgeMissingFields',
                shortCode: 'FM',
                description: 'Forge 缺失字段提示',
                props: [
                    { key: 'formId', type: 'string', required: true },
                    { key: 'fields', type: 'string', required: true }
                ]
            },
            {
                name: 'ForgeEntryProposal',
                shortCode: 'FEP',
                description: 'Forge 条目建议卡片',
                props: [
                    { key: 'id', type: 'string', required: true },
                    { key: 'title', type: 'string', required: true },
                    { key: 'content', type: 'string', required: true }
                ]
            },
            {
                name: 'ForgeMemoryProposal',
                shortCode: 'FMPR',
                description: 'Forge 记忆建议卡片',
                props: [
                    { key: 'path', type: 'string', required: true },
                    { key: 'title', type: 'string', required: true },
                    { key: 'content', type: 'string', required: true }
                ]
            },
            {
                name: 'ForgeFormAssist',
                shortCode: 'FFA',
                description: 'Forge 表单辅助能力。所有参数均为 varargs 字段建议，格式为 "路径/键|值1::说明1|值2" 或 "键|值"。路径含斜杠时视为蓝图表单，否则视为临时表单。',
                props: [
                    { key: 'fields', type: 'string', required: true }
                ]
            }
        ];

        builtins.forEach(s => this.register(s));
    }

    /**
     * 生成供 LLM 使用的组件说明文档 (结构化 Markdown 版)
     */
    public getDocumentation(style: ViewSyntaxStyle = 'functional'): string {
        let docs = '## 组件参考库 (LuminaView Components)\n';
        docs += `所有组件必须放置在 <V> ... </V> 标签内。当前只允许使用 \`${style === 'pipe' ? '管道式' : '函数式'}\` 语法。\n\n`;
        
        this.byName.forEach(s => {
            docs += `### ${s.name}\n`;
            if (style === 'pipe' && s.shortCode) {
                docs += `缩写: \`${s.shortCode}\`\n`;
            }
            docs += `作用: ${s.description || ''}\n`;
            if (s.props.length > 0) {
                if (style === 'functional') {
                    // 函数式语法：按位置展示，不暴露 key 名避免模型混淆为 XML 属性
                    docs += '位置参数 (按顺序传入):\n';
                    s.props.forEach((prop, index) => {
                        const req = prop.required ? '必填' : '可选';
                        docs += `- 第${index + 1}参数 (${req}): ${this.getPropMeaning(s, prop)}\n`;
                    });
                } else {
                    docs += '参数:\n';
                    s.props.forEach((prop) => {
                        docs += `- \`${prop.key}\`: ${this.getPropMeaning(s, prop)}\n`;
                    });
                }
            }
            
            // 生成示例
            const dummyArgs = s.props.map((p) => this.getExampleArg(s, p));
            
            const funcEx = `${s.name}(${dummyArgs.join(', ')})`;
            const pipeArgs = dummyArgs.map((v, index) => {
                const prop = s.props[index];
                if (prop?.key === 'options' || prop?.key === 'availableLayers') {
                    if (supportsForgeOptionsVarargs(s)) {
                        return '["正文1|按钮1","正文2|按钮2"]';
                    }
                    return '["选项A","选项B"]';
                }
                return typeof v === 'string' ? v.replace(/"/g, '') : v;
            }).join('|');
            const pipeEx = s.shortCode ? `${s.shortCode}|${pipeArgs}` : '';

            if (style === 'pipe' && pipeEx) {
                docs += `示例: \`${pipeEx}\`\n`;
            } else {
                if (supportsForgeOptionsVarargs(s)) {
                    if (s.name === 'ForgeFormAssist') {
                        docs += `示例: \`${s.name}("role/name|Alice::主角", "role/age|18")\`\n`;
                    } else if (s.name === 'ForgeChoiceGroup') {
                        docs += `示例: \`${s.name}("kickoff_intent/direction", "标题内容", "正文1|按钮1", "正文2|按钮2")\`\n`;
                    } else if (s.name === 'ForgeFacetChecklist') {
                        docs += `示例: \`${s.name}("kickoff_intent/facets", "聚焦维度", "人物关系|关系", "空间变化|空间")\`\n`;
                    } else {
                        docs += `示例: \`${s.name}("intent", "提示文字", "val1::显示名1", "val2::显示名2")\`\n`;
                    }
                } else {
                    docs += `示例: \`${funcEx}\`\n`;
                }
            }
            docs += '\n';
        });

        return docs.trim();
    }
}

/** 全局单例 */
export const viewComponentRegistry = new ViewComponentRegistryImpl();
