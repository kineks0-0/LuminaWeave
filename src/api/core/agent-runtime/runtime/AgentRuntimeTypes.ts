import type { AgentRuntimeEventBus } from '../events/AgentRuntimeEventBus.js';
import type {
    AgentRuntimeExtension,
    AgentRuntimeResolvedExtensionPath,
    AgentRuntimeResourceDiscoveryInput,
    AgentRuntimeResourceDiscoveryResult
} from '../extensions/AgentRuntimeExtensionRunner.js';
import type { AgentRuntimeModelProvider } from '../model/AgentRuntimeModelProvider.js';
import type { AgentToolRegistry, AgentRuntimeTool } from '../tools/AgentToolRegistry.js';
import type { AgentRuntimeManagedSession, AgentRuntimeSessionFactoryInput } from './AgentRuntimeCore.js';

export interface AgentRuntimeDiagnostic {
    type: 'warning' | 'error';
    message: string;
    path?: string;
    details?: unknown;
}

export interface AgentRuntimeModelSelection {
    providerId?: string;
    modelId?: string;
    presetId?: string;
}

export interface AgentRuntimeSetupInput {
    reason: 'startup' | 'reload';
}

export interface AgentRuntimeResourceScanInput extends AgentRuntimeResourceDiscoveryInput {
    runtimeId: string;
}

export interface AgentRuntimeResourceScanResult extends AgentRuntimeResourceDiscoveryResult {
    extensionPaths?: string[];
    diagnostics?: AgentRuntimeDiagnostic[];
}

/**
 * 资源扫描由接入方提供，SDK core 不默认读取项目目录或用户目录。
 */
export interface AgentRuntimeResourceScanner {
    scan: (
        input: AgentRuntimeResourceScanInput
    ) => Promise<AgentRuntimeResourceScanResult> | AgentRuntimeResourceScanResult;
}

export interface AgentRuntimeExtensionLoadInput {
    runtimeId: string;
    paths: string[];
}

export interface AgentRuntimeExtensionLoadResult {
    extensions: AgentRuntimeExtension[];
    resolvedExtensionPaths?: AgentRuntimeResolvedExtensionPath[];
    diagnostics?: AgentRuntimeDiagnostic[];
}

/**
 * 扩展加载器只消费已解析路径，真实 TS/JS 执行机制必须由宿主环境显式注入。
 */
export interface AgentRuntimeExtensionLoader {
    load: (
        input: AgentRuntimeExtensionLoadInput
    ) => Promise<AgentRuntimeExtensionLoadResult> | AgentRuntimeExtensionLoadResult;
}

export interface AgentRuntimeToolPluginContext {
    runtimeId: string;
    tools: AgentToolRegistry;
    events: AgentRuntimeEventBus;
    model?: AgentRuntimeModelSelection;
    modelProvider?: AgentRuntimeModelProvider;
    workspace?: unknown;
    approvals?: unknown;
    permissions?: unknown;
}

export interface AgentRuntimeToolPlugin {
    id: string;
    setup: (context: AgentRuntimeToolPluginContext) => Promise<void> | void;
}

// 单个 runtime 既允许直接传工具，也允许传工具插件，以便非 Forge adapter 逐步迁移。
export type AgentRuntimeToolEntry = AgentRuntimeTool | AgentRuntimeToolPlugin;

export interface AgentRuntimeOptions<TTurnInput, TRunResult, TPreviewResult, TApprovalResult> {
    id: string;
    model?: AgentRuntimeModelSelection;
    modelProvider?: AgentRuntimeModelProvider;
    tools?: AgentRuntimeToolEntry[];
    extensions?: AgentRuntimeExtension[];
    extensionLoader?: AgentRuntimeExtensionLoader;
    resourceScanner?: AgentRuntimeResourceScanner;
    events?: AgentRuntimeEventBus;
    workspace?: unknown;
    approvals?: unknown;
    permissions?: unknown;
    sessionStore?: unknown;
    eventSink?: unknown;
    resolveSessionId: (input: TTurnInput) => string;
    createSession: (
        input: AgentRuntimeSessionFactoryInput<TTurnInput>
    ) => AgentRuntimeManagedSession<TTurnInput, TRunResult, TPreviewResult, TApprovalResult>;
}
