import type {
    AgentRuntimeDiagnostic,
    AgentRuntimeExtensionLoadInput,
    AgentRuntimeExtensionLoadResult,
    AgentRuntimeExtensionLoader
} from '../../runtime/AgentRuntimeTypes.js';
import { PiExtensionCompatHost, type PiExtensionFactory } from './PiExtensionCompatHost.js';

export interface PiExtensionModuleLoader {
    importModule: (path: string) => Promise<unknown>;
}

export interface PiExtensionLoaderOptions {
    compatHost: PiExtensionCompatHost;
    factories?: PiExtensionFactory[];
    moduleLoader?: PiExtensionModuleLoader;
}

export class PiExtensionLoader implements AgentRuntimeExtensionLoader {
    constructor(private readonly options: PiExtensionLoaderOptions) {}

    async load(input: AgentRuntimeExtensionLoadInput): Promise<AgentRuntimeExtensionLoadResult> {
        // inline factory 不需要本地代码加载器，适合浏览器侧和测试侧显式配置扩展。
        const extensions = this.options.factories?.map((factory, index) =>
            this.options.compatHost.fromFactory(`<inline:${index + 1}>`, factory)
        ) ?? [];
        const diagnostics: AgentRuntimeDiagnostic[] = [];

        for (const path of input.paths) {
            // 缺少 moduleLoader 时返回 diagnostics，而不是在浏览器环境隐式尝试本地 TS/JS 执行。
            if (!this.options.moduleLoader) {
                diagnostics.push({
                    type: 'error',
                    path,
                    message: 'Pi extension module loader is not configured.'
                });
                continue;
            }
            let loaded: unknown;
            try {
                loaded = await this.options.moduleLoader.importModule(path);
            } catch (error) {
                diagnostics.push({
                    type: 'error',
                    path,
                    message: toErrorMessage(error)
                });
                continue;
            }
            const factory = resolveFactory(loaded);
            if (!factory) {
                diagnostics.push({
                    type: 'error',
                    path,
                    message: 'Pi extension module must export a default factory function.'
                });
                continue;
            }
            extensions.push(this.options.compatHost.fromFactory(path, factory));
        }

        return {
            extensions,
            diagnostics
        };
    }
}

// 兼容 jiti/import() 两类加载结果：直接返回 factory 或返回带 default 的模块对象。
const resolveFactory = (loaded: unknown): PiExtensionFactory | null => {
    if (typeof loaded === 'function') {
        return loaded as PiExtensionFactory;
    }
    if (isObject(loaded) && typeof loaded.default === 'function') {
        return loaded.default as PiExtensionFactory;
    }
    return null;
};

const isObject = (value: unknown): value is { default?: unknown } =>
    typeof value === 'object' && value !== null;

const toErrorMessage = (error: unknown): string =>
    error instanceof Error ? error.message : String(error);
