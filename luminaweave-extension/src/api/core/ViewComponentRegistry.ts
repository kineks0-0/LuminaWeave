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
        let finalArgs = args;

        // 智能偏移逻辑：针对 Forge 交互组件 (N-1 参数场景)
        // 场景：AI 经常省略可选的 formId 直接输出 (fieldKey, label, options)，导致参数按索引映射时错位，最终 options 缺失。
        // 判定条件：
        // 1. 组件以 Forge 开头
        // 2. 第一个属性是可选的 formId
        // 3. 传入参数正好比属性定义少 1 个
        // 4. 最后一个属性（通常是 options）是必填的
        if (schema.name.startsWith('Forge') && 
            schema.props.length > 1 &&
            schema.props[0].key === 'formId' && 
            args.length === schema.props.length - 1 &&
            schema.props[schema.props.length - 1].required) {
            
            console.debug(`[ViewComponentRegistry] 自动补位：Forge 组件 "${schema.name}" 疑缺省 formId，执行智能位移。`);
            finalArgs = [null, ...args];
        }

        const result: Record<string, unknown> = {};

        for (let i = 0; i < schema.props.length; i++) {
            const prop = schema.props[i];
            if (i < finalArgs.length) {
                // 如果是最后一个预定义的属性，且实际上还有更多剩余参数，则进行贪婪合并
                if (i === schema.props.length - 1 && finalArgs.length > schema.props.length) {
                    const remaining = finalArgs.slice(i).map(a => String(a));
                    result[prop.key] = remaining.join('|');
                } else {
                    result[prop.key] = finalArgs[i];
                }
            }
        }

        return result;
    }

    private getExampleArg(schema: ViewComponentSchema, prop: PropDef): string {
        if (prop.key === 'formId') return '"kickoff_intent"';
        if (prop.key === 'fieldKey') return '"direction"';
        if (prop.key === 'title') return '"标题内容"';
        if (prop.key === 'label') return '"标题内容"';
        if (prop.key === 'description') return '"补充说明内容"';
        if (prop.key === 'placeholder') return '"请输入具体内容"';
        if (prop.key === 'structuredLabel') return '"详细定制"';
        if (prop.key === 'freeformLabel') return '"快速开始"';
        if (prop.key === 'layer') return '"concept"';
        if (prop.key === 'currentLayer') return '"concept"';
        if (prop.key === 'availableLayers') return '"concept|description|output"';
        if (prop.key === 'completedLayers') return '"concept|description"';
        if (prop.key === 'fields') return '"标题内容,补充说明内容"';
        if (prop.key === 'options') return '"选项1|选项2|选项3"';
        if (prop.key === 'message') return '"提示内容"';
        if (prop.key === 'text') return '"正文内容"';
        if (prop.key === 'summary') return '"摘要内容"';
        if (prop.key === 'attribution') return '"来源署名"';
        if (prop.key === 'suggestions') return '"建议1|建议2|建议3"';
        if (prop.key === 'level') return '"info"';
        if (prop.key === 'variant') return '"primary"';
        if (prop.key === 'tone') return '"calm"';
        if (prop.key === 'value') return prop.type === 'number' ? '50' : '"当前状态"';
        if (prop.key === 'max') return '100';

        if (prop.type === 'number') return '50';
        if (prop.type === 'array') return '["选项1", "选项2"]';
        if (prop.type === 'boolean') return 'true';
        if (prop.type === 'object') return '{"title":"标题内容"}';

        if (schema.name === 'ForgeInput') return '"角色姓名"';
        if (schema.name === 'ForgeTextarea') return '"人物背景摘要"';
        if (schema.name === 'ForgeSelect' || schema.name === 'ForgeChecklist') return '"叙事偏好"';

        return '"字段内容"';
    }

    private getPropMeaning(schema: ViewComponentSchema, prop: PropDef): string {
        if (prop.key === 'formId') {
            return '表单 ID；可选。提供时绑定到蓝图表单（持久模式）；不提供时组件进入“临时模式”，数据仅随消息记录。';
        }
        if (prop.key === 'fieldKey') {
            return '字段键；可选。提供时表示写入蓝图中的哪个字段；不提供时将使用 label 作为瞬态存储的键。';
        }
        if (prop.key === 'label') {
            return schema.name.startsWith('Forge')
                ? '用户可见的字段标题或组件标题。'
                : '组件标题或标签文本。';
        }
        if (prop.key === 'placeholder') {
            return '输入框占位提示，只影响显示，不参与状态索引。';
        }
        if (prop.key === 'title') {
            return '卡片或组件标题文本。';
        }
        if (prop.key === 'suggestions') {
            return '建议预设选项；函数式写成 "建议1|建议2"，点击后可自动填入框内。';
        }
        if (prop.key === 'description') {
            return '补充说明文本，告诉用户这张表单或卡片要收集什么。';
        }
        if (prop.key === 'layer') {
            return 'Forge 当前层标识，例如 concept、description、output。';
        }
        if (prop.key === 'options') {
            return '可选项列表；函数式通常写成 "选项1|选项2|选项3"，由组件自行拆分。';
        }
        if (prop.key === 'fields') {
            return '缺失字段列表；告诉用户当前还缺哪些字段。';
        }
        if (prop.key === 'currentLayer') {
            return '当前所在层。';
        }
        if (prop.key === 'availableLayers') {
            return '可切换层列表。';
        }
        if (prop.key === 'completedLayers') {
            return '已完成层列表，用于导航高亮。';
        }
        if (prop.key === 'summary') {
            return '摘要正文。';
        }
        if (prop.key === 'tone') {
            return '摘要卡的语气/视觉风格标记，例如 calm、warning；当前主要作为样式语义位。';
        }
        if (prop.key === 'structuredLabel') {
            return '模式选择器中“详细定制”按钮文案。';
        }
        if (prop.key === 'freeformLabel') {
            return '模式选择器中“快速开始”按钮文案。';
        }
        if (prop.key === 'text') {
            return '正文内容。';
        }
        if (prop.key === 'message') {
            return '提示内容。';
        }
        if (prop.key === 'value') {
            return prop.type === 'number' ? '数值内容。' : '当前值。';
        }
        if (prop.key === 'max') {
            return '最大值，用于进度或数值上限。';
        }
        if (prop.key === 'variant') {
            return '视觉变体标记。';
        }
        if (prop.key === 'level') {
            return '提示级别，例如 info、warning、danger。';
        }
        if (prop.key === 'attribution') {
            return '引用来源或署名。';
        }

        if (prop.key === 'id') {
            return '条目唯一标识符。';
        }
        if (prop.key === 'path') {
            return '记忆路径或分类。';
        }
        if (prop.key === 'content') {
            return '条目或记忆的完整内容文本。';
        }

        return '组件参数。';
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
                    { key: 'formId', type: 'string', required: false },
                    { key: 'fieldKey', type: 'string', required: false },
                    { key: 'label', type: 'string', required: true },
                    { key: 'placeholder', type: 'string', required: false },
                    { key: 'suggestions', type: 'string', required: false }
                ]
            },
            {
                name: 'ForgeTextarea',
                shortCode: 'FT',
                description: 'Forge 多行字段输入',
                props: [
                    { key: 'formId', type: 'string', required: false },
                    { key: 'fieldKey', type: 'string', required: false },
                    { key: 'label', type: 'string', required: true },
                    { key: 'placeholder', type: 'string', required: false },
                    { key: 'suggestions', type: 'string', required: false }
                ]
            },
            {
                name: 'ForgeSelect',
                shortCode: 'FS',
                description: 'Forge 单选选择器',
                props: [
                    { key: 'formId', type: 'string', required: false },
                    { key: 'fieldKey', type: 'string', required: false },
                    { key: 'label', type: 'string', required: true },
                    { key: 'options', type: 'string', required: true }
                ]
            },
            {
                name: 'ForgeChecklist',
                shortCode: 'FK',
                description: 'Forge 多选选择器',
                props: [
                    { key: 'formId', type: 'string', required: false },
                    { key: 'fieldKey', type: 'string', required: false },
                    { key: 'label', type: 'string', required: true },
                    { key: 'options', type: 'string', required: true }
                ]
            },
            {
                name: 'ForgeChoiceGroup',
                shortCode: 'FCG',
                description: 'Forge 启动阶段单选方向组',
                props: [
                    { key: 'formId', type: 'string', required: false },
                    { key: 'fieldKey', type: 'string', required: false },
                    { key: 'label', type: 'string', required: true },
                    { key: 'options', type: 'string', required: true }
                ]
            },
            {
                name: 'ForgeFacetChecklist',
                shortCode: 'FFC',
                description: 'Forge 启动阶段多选维度组',
                props: [
                    { key: 'formId', type: 'string', required: false },
                    { key: 'fieldKey', type: 'string', required: false },
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
            }
        ];

        builtins.forEach(s => this.register(s));
    }

    /**
     * 生成供 LLM 使用的组件说明文档 (LLM 专用简略版 - 原始纯文本)
     */
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
                    return '["选项A","选项B"]';
                }
                return typeof v === 'string' ? v.replace(/"/g, '') : v;
            }).join('|');
            const pipeEx = s.shortCode ? `${s.shortCode}|${pipeArgs}` : '';

            if (style === 'pipe' && pipeEx) {
                docs += `示例: \`${pipeEx}\`\n`;
            } else {
                docs += `示例: \`${funcEx}\`\n`;
            }
            docs += '\n';
        });

        return docs.trim();
    }
}

/** 全局单例 */
export const viewComponentRegistry = new ViewComponentRegistryImpl();
