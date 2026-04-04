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
        const result: Record<string, unknown> = {};

        for (let i = 0; i < schema.props.length; i++) {
            const prop = schema.props[i];
            if (i < args.length) {
                result[prop.key] = args[i];
            }
            // 非必需且未提供的属性保持 undefined，不写入
        }

        return result;
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
    public getDocumentation(): string {
        let docs = '## 组件参考库 (LuminaView Components)\n';
        docs += '所有组件必须放置在 <V> ... </V> 标签内。建议优先使用 `函数式` 语法。\n\n';
        
        this.byName.forEach(s => {
            docs += `### ${s.name} [代码: ${s.shortCode || ''}]\n`;
            docs += `- **作用**: ${s.description || ''}\n`;
            
            // 生成示例
            const dummyArgs = s.props.map(p => {
                if (p.type === 'number') return '50';
                if (p.type === 'array') return '["选项A", "选项B"]';
                if (p.type === 'boolean') return 'true';
                if (p.key === 'label' || p.key === 'text' || p.key === 'message') return `"内容"`;
                return `"示例"`;
            });
            
            const funcEx = `${s.name}(${dummyArgs.join(', ')})`;
            const pipeArgs = dummyArgs.map(v => typeof v === 'string' ? v.replace(/"/g, '') : v).join('|');
            const pipeEx = s.shortCode ? `${s.shortCode}|${pipeArgs}` : '';
            
            docs += `- **主语法**: \`${funcEx}\`\n`;
            if (pipeEx) docs += `- **压缩语法**: \`${pipeEx}\`\n`;
            docs += '\n';
        });

        return docs.trim();
    }
}

/** 全局单例 */
export const viewComponentRegistry = new ViewComponentRegistryImpl();
