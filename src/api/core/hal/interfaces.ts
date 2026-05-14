/**
 * HAL 核心接口族定义
 */

/**
 * 宏占位符替换接口
 */
export interface IMacroResolver {
    /**
     * 替换内容中的宏（如 {{user}}, {{char}} 等）
     * @param content 待处理的文本
     */
    resolve(content: string): string;
}

/**
 * 会话 ID 规范化接口
 */
export interface ISessionIdNormalizer {
    /**
     * 规范化会话 ID (例如移除 .jsonl 后缀)
     * @param id 原始 ID
     */
    normalize(id: string | null | undefined): string | null;
}

/**
 * 事件总线桥接接口
 */
export interface IEventBridge {
    /**
     * 绑定宿主事件并转发为 Lumina 标准领域事件
     */
    bindHostEvents(): void;
    /**
     * 解绑事件
     */
    unbindHostEvents(): void;
    /**
     * 订阅领域事件
     */
    on(event: string, callback: (...args: any[]) => void): void;
    /**
     * 取消订阅
     */
    off(event: string, callback: (...args: any[]) => void): void;
    /**
     * 发布领域事件
     */
    emit(event: string, ...args: any[]): void;
}

/**
 * 宿主引导存储接口 (Bootstrap Storage)
 * 极简同步/异步 KV，用于加载 HAL 自身配置，独立于领域生命周期
 */
export interface IBootstrapStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    getJson<T>(key: string): T | null;
    setJson<T>(key: string, value: T): void;
}

/**
 * 宿主提供者接口
 * 负责实例化并组装特定宿主环境下的 HAL 上下文
 */
export interface IHostProvider {
    /**
     * 创建该宿主环境下的 HAL 上下文实例
     */
    createContext(): any; // 这里由于循环引用风险暂用 any，在具体实现中会返回 HALContext
}

/**
 * 宿主基础 KV 存储接口
 */
export interface IHostStorage {
    /**
     * 读取配置项
     * @param namespace 命名空间 (可选)
     * @param key 键名
     * @param table 表名 (可选)
     */
    getItem(namespace: string | undefined, key: string, table?: string): Promise<string | null>;
    /**
     * 写入配置项
     * @param namespace 命名空间 (可选)
     * @param key 键名
     * @param value 键值
     * @param table 表名 (可选)
     */
    setItem(namespace: string | undefined, key: string, value: string, table?: string): Promise<void>;
    /**
     * 移除配置项
     * @param namespace 命名空间 (可选)
     * @param key 键名
     * @param table 表名 (可选)
     */
    removeItem(namespace: string | undefined, key: string, table?: string): Promise<void>;
}

/**
 * 宿主网络与生成接口
 */
export interface IHostNetwork {
    /**
     * 发起流式生成请求
     * @param payload 生成负载
     * @param options 配置项
     */
    generateStream(payload: any, options?: any): Promise<ReadableStream<any>>;

    /**
     * 发起宿主认证请求。ST 实现会自动注入 CSRF。
     */
    fetchWithAuth?(input: string, init?: RequestInit): Promise<Response>;
}

/**
 * Token 计数接口
 */
export interface ITokenCounter {
    count(text: string): Promise<number>;
}

/**
 * 宿主特定资源状态 Provider
 * 用于查询宿主当前运行态的资源信息（如 ST 侧当前选中的预设、激活的世界书条目等）
 */
export interface IHostResourceProvider {
    /**
     * 获取宿主当前激活的世界书条目 (同步获取)
     */
    getActiveLorebookEntries(): any[];

    /**
     * 获取宿主当前选中的角色 ID
     */
    getCurrentCharacterId(): string | number | null;

    /**
     * 获取宿主当前选中的会话 ID
     */
    getCurrentChatId(): string | null;

    /**
     * 获取宿主特定类型的预设
     * @param name 预设名称或类型（如 'in_use', 'openai'）
     */
    getPreset(name: string): Promise<Record<string, any> | null>;
}
