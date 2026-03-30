import { globalXMLInterceptor } from '../../api/core/XMLInterceptor';
import { globalPromptRegistry, PromptSlot, STIdentifier } from '../../api/core/PromptRegistry';
import { p } from '../../api/core/PromptUtils';

/**
 * 对应大模型必须输出的标准化 Mutation 操作指令结构
 * 形如: <Mutation target="inventory" action="add" index="-1" value='{"id": "sword", "count": 1}' />
 */
export interface MutationCommand {
    target: string; // 操作的数据模型名称 (必需对应于 registerDataModel 的 target)
    action: 'add' | 'insert' | 'update' | 'replace' | 'delete' | 'remove';
    index?: number; // 目标数组下标，若不存在则可能为对象操作或推入末尾
    key?: string;   // 目标对象键名
    value?: any;    // 要注入或覆写的值
    silent?: boolean; // 是否静默执行 (不填入 deltaCache，用于时空重回)
}

/**
 * 数据模型代理接口。
 * 子插件通过实现此接口，由引擎全自动接管增删改查。
 */
export interface DataModelProxy {
    description?: string; // 目标的说明，例如 "物品栏表格 (物品, 数量, 描述)"
    onAdd?: (value: any, index?: number, key?: string) => void;
    onUpdate?: (value: any, index?: number, key?: string) => void;
    onDelete?: (index?: number, key?: string) => void;
}

/**
 * 通用增量更新引擎
 * 负责解析模型输出的修改指令，并路由到注册了的子插件状态库中。
 */
export class IncrementalMutationEngine {
    public models: Map<string, DataModelProxy> = new Map();
    private deltaCache: MutationCommand[] = []; // 增量缓存池

    constructor() {
        this.installDefaultInterceptor();
        this.registerPromptMetadata();
    }

    /**
     * 注册 XML 标签元数据，使 M 标签出现在 Prompt 指令序列中
     */
    private registerPromptMetadata() {
        globalPromptRegistry.register({
            id: 'mutation-engine-xml-docs',
            slot: PromptSlot.ST_MAIN,
            targetIdentifier: STIdentifier.MAIN,
            priority: 30, // 紧跟在规划指令之后
            xmlTags: [{
                tag: 'M',
                aliases: ['Mutation'],
                description: '世界线状态同步指令。当你需要修改物品、人际关系或全局状态时，必须在此标签内输出指令。',
                statusText: '状态同步中...',
                anchor: 'Next_Plan',
                position: 'after',
                priority: 10
            }],
            getFragment: () => null
        });
    }

    /**
     * 获取 Mutation API 的文档描述内容
     */
    public getDocumentation(): string {
        if (this.models.size === 0) return '';

        let doc = 'Mutation API 详细语法\n';
        doc += '输出包装:\n<Mutation>语句1;语句2...etc</Mutation>\n支持 <M> 简写标签。\n\n';
        doc += '语法支持: `target.action(args)` 或简写 `target(value)` (等同于 update)。\n';
        doc += '操作示例:\n';
        doc += '- 更新: t.update(value), 示例: global.update({time: "黄昏"}), 简化写法: global.time = "黄昏"\n';
        doc += '- 人物更新: characters["李华"].status = "欣喜"\n';
        doc += '- 添加: inventory.add({item: "木剑", count: 1})\n';
        doc += '- 初始化/同步状态: t = {data}, 示例 global = {time: "晨曦"}\n\n';
        
        doc += '当前可用数据模型:\n';
        this.models.forEach((proxy, name) => {
            const actions = [];
            if (proxy.onUpdate) actions.push('update');
            if (proxy.onAdd) actions.push('add');
            if (proxy.onDelete) actions.push('delete/remove');

            doc += `[${name}] ${proxy.description || '无描述'} | 支持: ${actions.join(', ')}\n`;
        });

        doc += '\n自然语言快捷语法:\n';
        doc += '[物品栏更新]：\n- 类型：名称（描述）\n示例:\n- 消耗品：金疮药（止血良药）\n';

        return doc;
    }

    /**
     * 子插件暴露自身的数据修改接口
     * @param targetName 数据模型唯一追踪名 (比如 'inventory', 'relationships')
     * @param proxy 提供增删改查回调的代理对象
     */
    public registerDataModel(targetName: string, proxy: DataModelProxy) {
        this.models.set(targetName, proxy);
        console.log(`[MutationEngine] Data model registered for tracking: ${targetName}`);
    }

    /**
     * 获取所有可用操作的目标模型名称
     */
    public getAvailableTargets(): string[] {
        return Array.from(this.models.keys());
    }

    /**
     * 获取特定模型的描述
     */
    public getModelDescription(target: string): string | undefined {
        return this.models.get(target)?.description;
    }

    /**
     * 将拦截到的一条 Mutation 指令派发给对应的底层 Proxy 执行
     */
    public dispatch(cmd: MutationCommand) {
        const proxy = this.models.get(cmd.target);
        if (!proxy) {
            console.warn(`[MutationEngine] 尝试修改未注册的 target: ${cmd.target}. Mutation 被丢弃。`);
            return;
        }

        // 记录增量用于时间线游走 (除非是静默模式，如重播时)
        if (!cmd.silent) {
            this.deltaCache.push(cmd);
        }

        try {
            switch (cmd.action) {
                case 'add':
                case 'insert':
                    if (proxy.onAdd) proxy.onAdd(cmd.value, cmd.index, cmd.key);
                    break;
                case 'update':
                case 'replace':
                    if (proxy.onUpdate) proxy.onUpdate(cmd.value, cmd.index, cmd.key);
                    break;
                case 'delete':
                case 'remove':
                    if (proxy.onDelete) proxy.onDelete(cmd.index, cmd.key);
                    break;
                default:
                    console.warn(`[MutationEngine] 未知的 Action 动作: ${cmd.action}`);
            }
        } catch (e) {
            console.error(`[MutationEngine] 派发到 ${cmd.target} 的执行发生错误:`, e);
        }
    }

    /**
     * 提取当前回合产生的所有增量指令，并清空缓存
     * 用于绑定到 LuminaChatMessage 的 extra.tier1Delta 中
     */
    public flushDeltas(): MutationCommand[] {
        const deltas = [...this.deltaCache];
        this.deltaCache = [];
        return deltas;
    }

    /**
     * 清空缓存池
     */
    public clearCache() {
        this.deltaCache = [];
    }

    /**
     * MemoryManager 接口支持：重播增量
     */
    public applyDelta(delta: MutationCommand) {
        this.dispatch({ ...delta, silent: true });
    }

    /**
     * 执行拦截器注册。
     * 向全局的 XMLInterceptor 注册拦截 <Mutation> 标签。
     * 由于状态修改是落地性质的，它的生命周期被强制标记为 'persistent' (落库后就不往 ST 聊天流里吐出此 XML 标签了)
     */
    private installDefaultInterceptor() {
        const parser = (content: string, fullMatchText: string) => {
            if (content.trim().length === 0 && fullMatchText.includes('target=')) {
                // 兼容旧的 Attributes 模式
                const cmd = this.extractAttributes(fullMatchText);
                if (cmd && cmd.target && cmd.action) {
                    this.dispatch(cmd as MutationCommand);
                }
                return '';
            }

            this.executeMutation(content);
            return '';
        };

        globalXMLInterceptor.registerXMLParser('Mutation', 'persistent', parser);
        globalXMLInterceptor.registerXMLParser('M', 'persistent', parser);

        // 3. 自然语言模式 [物品栏更新] (Persistent)
        const inventoryPattern = /\[物品栏更新\]：\s*((?:\n?\s*-\s*[^：\n]+?：[^（\n]+?(?:（.*?）)?)+)/gis;
        globalXMLInterceptor.registerPatternParser(inventoryPattern, 'persistent', (content) => {
            this.parseNaturalLanguageInventory(content);
            return '';
        });
    }

    /**
     * 解析自然语言风格的物品栏更新
     * 格式:
     * - 类型：名称（描述）
     */
    private parseNaturalLanguageInventory(text: string) {
        // 分行处理
        const lines = text.split('\n');
        const itemRegex = /^\s*-\s*([^：\n]+?)：([^（\n]+?)(?:（(.*?)）)?$/;

        for (const line of lines) {
            const match = line.match(itemRegex);
            if (match) {
                const type = match[1].trim();
                const name = match[2].trim();
                const desc = match[3] ? match[3].trim() : '';

                // 构建标准 Mutation 并执行
                this.dispatch({
                    target: 'inventory',
                    action: 'add',
                    value: {
                        item: name,
                        count: 1,
                        desc: desc ? `[${type}] ${desc}` : `[${type}]`
                    }
                });
            }
        }
    }

    /**
     * JS 驱动的 Mutation 执行核心
     * 将模型输出的代码片段作为受限沙箱中的 JS 运行
     */
    public executeMutation(code: string) {
        if (!code.trim()) return;

        try {
            // 1. 预处理：替换中文引号、分号结尾等，使之更接近标准 JS
            // 核心修复：采用保护模式，不替换已在英引号内部的中文引号，防止内容损坏导致语法错误
            const processedCode = code.replace(/("[^"]*")|('[^']*')|[\u201C\u201D]|[\u2018\u2019]/g, (match, g1, g2) => {
                if (g1 || g2) return match; // 保护已有字符串内容
                return (match === '“' || match === '”') ? '"' : "'";
            }).trim();

            // 2. 创建沙箱环境
            const sandbox = this.createSandbox();

            // 3. 执行。使用 with(sandbox) 允许 LLM 直接书写 target.action 或 target = ...
            const runner = new Function('sandbox', `with(sandbox) { ${processedCode} }`);
            runner(sandbox);
        } catch (e) {
            console.error(`[MutationEngine] Mutation 执行失败. \n代码: ${code}\n错误:`, e);
        }
    }

    /**
     * 创建执行沙箱
     * 捕获顶层变量引用和赋值
     */
    private createSandbox(): any {
        const self = this;
        const baseSandbox: any = {};

        // 注入所有已注册的模型代理
        this.models.forEach((proxy, name) => {
            baseSandbox[name] = this.createModelProxy(name, proxy);
        });

        // 返回顶级 Proxy 捕获全局赋值 (如 global = { ... })
        return new Proxy(baseSandbox, {
            get(target, prop) {
                if (prop in target) return target[prop as string];
                // 允许 undefined 访问而非抛错
                return undefined;
            },
            set(target, prop, value) {
                if (typeof prop === 'string' && target[prop]) {
                    // LLM 在进行顶层赋值: target = { ... }
                    self.dispatch({
                        target: prop,
                        action: 'update',
                        value: value
                    });
                    return true;
                }
                return false;
            },
            has(target, prop) {
                // 告诉 with 语句这些变量在沙箱中
                return prop in target;
            }
        });
    }

    /**
     * 为单个数据模型创建 Proxy
     * 支持:
     * - target.add(val)
     * - target.update(val)
     * - target.prop = val
     * - target["key"].prop = val
     * - target(val)
     */
    private createModelProxy(targetName: string, _model: DataModelProxy): any {
        const self = this;
        const base = () => { }; // 使 Proxy 可通过 () 调用

        return new Proxy(base, {
            get(_, prop) {
                const p = prop as string;
                // 标准方法映射
                if (p === 'add' || p === 'insert' || p === 'update' || p === 'replace') {
                    const action = (p === 'add' || p === 'insert') ? 'add' : 'update';
                    return (...args: any[]) => {
                        let value = args[0];
                        let index: number | undefined;
                        let key: string | undefined;

                        if (args.length >= 2) {
                            // 启发式识别: (key, value) 或 (value, index)
                            if (typeof args[0] === 'string' && typeof args[1] === 'object') {
                                key = args[0];
                                value = args[1];
                            } else if (typeof args[1] === 'number') {
                                index = args[1];
                            } else {
                                // 默认按照 (value, index) 尝试，或者 fallback
                                value = args[0];
                                index = args[1];
                            }
                        }
                        self.dispatch({ target: targetName, action, value, index, key });
                    };
                }
                if (p === 'delete' || p === 'remove') {
                    return (indexOrKey: any) => {
                        const index = typeof indexOrKey === 'number' ? indexOrKey : undefined;
                        const key = typeof indexOrKey === 'string' ? indexOrKey : undefined;
                        self.dispatch({ target: targetName, action: 'delete', index, key });
                    };
                }

                // 如果是其他属性访问，返回一个 Key 代理，支持 characters.师傅.status = "..."
                return self.createKeyProxy(targetName, p);
            },
            set(_, prop, value) {
                // 处理 target.field = value 
                self.dispatch({
                    target: targetName,
                    action: 'update',
                    value: { [prop as string]: value }
                });
                return true;
            },
            apply(_, __, args) {
                // 顶层调用处理同上
                let value = args[0];
                let index: number | undefined;
                let key: string | undefined;
                if (args.length >= 2) {
                    if (typeof args[0] === 'string' && typeof args[1] === 'object') {
                        key = args[0];
                        value = args[1];
                    } else if (typeof args[1] === 'number') {
                        index = args[1];
                    }
                }
                self.dispatch({ target: targetName, action: 'update', value, index, key });
            }
        });
    }

    /**
     * 创建针对特定 Key 的二级代理
     * 支持 characters.师傅.status = "..."
     */
    private createKeyProxy(targetName: string, key: string): any {
        const self = this;
        return new Proxy({}, {
            get(_, prop) {
                if (prop === 'update') {
                    return (val: any) => self.dispatch({ target: targetName, action: 'update', key: key, value: val });
                }
                return undefined;
            },
            set(_, prop, value) {
                // characters.师傅.status = "..." -> update({status: "..."}, key="师傅")
                self.dispatch({
                    target: targetName,
                    action: 'update',
                    key: key,
                    value: { [prop as string]: value }
                });
                return true;
            }
        });
    }

    /**
     * 极简正则提纯提取类似 Element 的 Attributes
     */
    private extractAttributes(tagString: string): Partial<MutationCommand> {
        const result: any = {};

        // 匹配 target="inventory" 或 target='inventory'
        const targetMatch = tagString.match(/target=["']([^"']+)["']/i);
        if (targetMatch) result.target = targetMatch[1];

        const actionMatch = tagString.match(/action=["']([^"']+)["']/i);
        if (actionMatch) result.action = actionMatch[1].toLowerCase();

        const indexMatch = tagString.match(/index=["']?(-?\d+)["']?/i);
        if (indexMatch) result.index = parseInt(indexMatch[1], 10);

        const keyMatch = tagString.match(/key=["']([^"']+)["']/i);
        if (keyMatch) result.key = keyMatch[1];

        // value 支持提取，可能是被序列化的 JSON "'{...}'"
        const valMatch = tagString.match(/value=["']([^"']+)["']/i);
        if (valMatch) {
            try {
                // 如果恰好内部是单引号或双引号互转的标准 JSON
                const rawJsonStr = valMatch[1].replace(/&quot;/g, '"');
                result.value = JSON.parse(rawJsonStr);
            } catch (e) {
                // 实在解析不了就当成普通字符串
                result.value = valMatch[1];
            }
        }

        return result;
    }
}

export const globalMutationEngine = new IncrementalMutationEngine();
