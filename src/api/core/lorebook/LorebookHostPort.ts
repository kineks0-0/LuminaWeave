export interface LorebookHostWorldbookRef {
    name: string;
    id: string;
    /** 资源来源（ST 为 'st'，本地为 'local'），按聊天启用绑定时用于构造 ResourceRef。 */
    sourceId?: string;
}

export interface LorebookHostWorldbookData {
    entries?: Record<string, unknown> | unknown[];
    data?: Record<string, unknown> | unknown[];
    [key: string]: unknown;
}

export interface LorebookHostPort {
    getWorldbookRefs(): LorebookHostWorldbookRef[];
    /** 异步刷新 getWorldbookRefs 的缓存（本地源需要；宿主同步实现可省略）。 */
    refreshWorldbookRefs?(): Promise<void>;
    getWorldbook(name: string): Promise<LorebookHostWorldbookData>;
    createWorldbook(name: string, entries?: any[]): Promise<boolean>;
    importRawWorldbook(filename: string, data: string): Promise<boolean>;
    /** 删除整本世界书；宿主不支持时省略。 */
    deleteWorldbook?(name: string): Promise<boolean>;
    /** 宿主是否支持把插件提示词伪装同步进系统世界书（仅 ST 原生生成链路需要）。 */
    supportsSystemPromptMount?: boolean;
    getGlobalWorldbookNames(): string[];
    getSelectedWorldbookName(): string | null;
    rebindGlobalWorldbooks(newList: string[]): Promise<void>;
    syncLuminaRegex?(): Promise<void>;
}

const emptyLorebookHostPort: LorebookHostPort = {
    getWorldbookRefs: () => [],
    getWorldbook: async () => ({ entries: {} }),
    createWorldbook: async () => false,
    importRawWorldbook: async () => false,
    supportsSystemPromptMount: false,
    getGlobalWorldbookNames: () => [],
    getSelectedWorldbookName: () => null,
    rebindGlobalWorldbooks: async () => { /* no-op for hostless runtimes */ }
};

let currentLorebookHostPort: LorebookHostPort = emptyLorebookHostPort;

export function configureLorebookHostPort(port: LorebookHostPort): void {
    currentLorebookHostPort = port;
}

export function getLorebookHostPort(): LorebookHostPort {
    return currentLorebookHostPort;
}
