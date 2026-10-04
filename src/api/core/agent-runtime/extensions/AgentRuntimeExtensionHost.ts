import type {
    AgentRuntimeExtension,
    AgentRuntimeResourceDiscoveryInput,
    AgentRuntimeResourceDiscoveryResult,
    AgentRuntimeResolvedExtensionPath
} from './AgentRuntimeExtensionRunner.js';
import { AgentRuntimeExtensionRunner } from './AgentRuntimeExtensionRunner.js';
import type { AgentToolRegistry } from '../tools/AgentToolRegistry.js';
import type {
    AgentRuntimeDiagnostic,
    AgentRuntimeExtensionLoader,
    AgentRuntimeResourceScanResult,
    AgentRuntimeResourceScanner,
    AgentRuntimeSetupInput
} from '../runtime/AgentRuntimeTypes.js';
import { deepClone } from '@shared/CommonUtils.js';

export interface AgentRuntimeExtensionHostOptions {
    runtimeId: string;
    tools: AgentToolRegistry;
    extensions?: AgentRuntimeExtension[];
    extensionLoader?: AgentRuntimeExtensionLoader;
    resourceScanner?: AgentRuntimeResourceScanner;
}

export interface AgentRuntimeExtensionHostSetupResult {
    resources: AgentRuntimeResourceDiscoveryResult;
    diagnostics: AgentRuntimeDiagnostic[];
    resolvedExtensionPaths: AgentRuntimeResolvedExtensionPath[];
}

export class AgentRuntimeExtensionHost {
    private runner: AgentRuntimeExtensionRunner | null = null;
    private scannedResources: AgentRuntimeResourceDiscoveryResult = {};
    private scannerDiagnostics: AgentRuntimeDiagnostic[] = [];
    private loaderDiagnostics: AgentRuntimeDiagnostic[] = [];
    private resolvedExtensionPaths: AgentRuntimeResolvedExtensionPath[] = [];
    private setupError: unknown | null = null;

    constructor(private readonly options: AgentRuntimeExtensionHostOptions) {}

    async setup(input: AgentRuntimeSetupInput): Promise<AgentRuntimeExtensionHostSetupResult> {
        if (this.setupError) {
            throw this.setupError;
        }

        if (this.runner) {
            if (input.reason === 'reload') {
                await this.scanResources(input);
            }
            return this.getSetupResult();
        }

        // scanner 只发现资源和扩展路径；是否加载代码由 loader 决定，保持权限边界可替换。
        const scanned = await this.scanResources(input);

        const loaded = await this.options.extensionLoader?.load({
            runtimeId: this.options.runtimeId,
            paths: scanned?.extensionPaths ?? []
        });
        this.loaderDiagnostics = [...(loaded?.diagnostics ?? [])];
        this.resolvedExtensionPaths = [...(loaded?.resolvedExtensionPaths ?? [])];

        this.runner = new AgentRuntimeExtensionRunner({
            tools: this.options.tools,
            extensions: [
                ...(this.options.extensions ?? []),
                ...(loaded?.extensions ?? [])
            ],
            resolvedExtensionPaths: this.resolvedExtensionPaths
        });
        try {
            await this.runner.setup();
        } catch (error) {
            // runner setup 可能已经注册了部分工具或 handler；无回滚能力时保留首次错误，避免重试产生重复副作用。
            this.setupError = error;
            throw error;
        }
        return this.getSetupResult();
    }

    async discoverResources(input: AgentRuntimeResourceDiscoveryInput): Promise<AgentRuntimeResourceDiscoveryResult> {
        // 静态扫描资源和扩展运行时资源统一在这里合并，adapter 不需要知道来源差异。
        const runnerResources = this.runner
            ? await this.runner.discoverResources(input)
            : {};
        return mergeResourceDiscovery(this.scannedResources, runnerResources);
    }

    getRunner(): AgentRuntimeExtensionRunner | null {
        return this.runner;
    }

    getDiagnostics(): AgentRuntimeDiagnostic[] {
        return clone(this.collectDiagnostics());
    }

    getResolvedExtensionPaths(): AgentRuntimeResolvedExtensionPath[] {
        return clone(this.resolvedExtensionPaths);
    }

    private getSetupResult(): AgentRuntimeExtensionHostSetupResult {
        return {
            resources: clone(this.scannedResources),
            diagnostics: clone(this.collectDiagnostics()),
            resolvedExtensionPaths: clone(this.resolvedExtensionPaths)
        };
    }

    private async scanResources(input: AgentRuntimeSetupInput): Promise<AgentRuntimeResourceScanResult | undefined> {
        const scanned = await this.options.resourceScanner?.scan({
            reason: input.reason,
            runtimeId: this.options.runtimeId
        });
        this.scannedResources = pickResourceDiscovery(scanned ?? {});
        this.scannerDiagnostics = [...(scanned?.diagnostics ?? [])];
        return scanned;
    }

    private collectDiagnostics(): AgentRuntimeDiagnostic[] {
        return [
            ...this.scannerDiagnostics,
            ...this.loaderDiagnostics
        ];
    }
}

export const mergeResourceDiscovery = (
    left: AgentRuntimeResourceDiscoveryResult,
    right: AgentRuntimeResourceDiscoveryResult
): AgentRuntimeResourceDiscoveryResult => ({
    ...mergeArrayField('skillPaths', left, right),
    ...mergeArrayField('promptPaths', left, right),
    ...mergeArrayField('themePaths', left, right)
});

// 只保留模型/loader 需要消费的 resource discovery 字段，避免 extensionPaths 泄入 prompt 资源。
const pickResourceDiscovery = (
    input: AgentRuntimeResourceDiscoveryResult
): AgentRuntimeResourceDiscoveryResult => ({
    ...(input.skillPaths && input.skillPaths.length > 0 ? { skillPaths: [...input.skillPaths] } : {}),
    ...(input.promptPaths && input.promptPaths.length > 0 ? { promptPaths: [...input.promptPaths] } : {}),
    ...(input.themePaths && input.themePaths.length > 0 ? { themePaths: [...input.themePaths] } : {})
});

const mergeArrayField = (
    field: keyof AgentRuntimeResourceDiscoveryResult,
    left: AgentRuntimeResourceDiscoveryResult,
    right: AgentRuntimeResourceDiscoveryResult
): AgentRuntimeResourceDiscoveryResult => {
    const merged = [...(left[field] ?? []), ...(right[field] ?? [])];
    return merged.length > 0 ? { [field]: merged } : {};
};

const clone = <T>(value: T): T => {
    if (value === null || value === undefined) return value;
    return deepClone(value) as T;
};
