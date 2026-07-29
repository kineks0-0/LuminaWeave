import type {
    AgentRuntimeDiagnostic,
    AgentRuntimeExtensionLoadInput,
    AgentRuntimeExtensionLoadResult,
    AgentRuntimeExtensionLoader,
    AgentRuntimeResourceScanInput,
    AgentRuntimeResourceScanResult,
    AgentRuntimeResourceScanner
} from '../../../agent-runtime/runtime/AgentRuntimeTypes.js';
import { PiExtensionCompatHost } from '../../../agent-runtime/extensions/pi/PiExtensionCompatHost.js';
import { promptPresetRegistry } from '../../../hal/prompt/PromptPresetRegistry.js';
import {
    forgeAgentPresetResourceRegistry,
    type ForgeAgentPresetExtensionResource,
    type ForgeAgentPresetResourceRegistry
} from '../../presets/ForgeAgentPresetResourceRegistry.js';

export interface ForgePiPresetExtensionResolverOptions {
    registry?: ForgeAgentPresetResourceRegistry;
    resolvePresetId?: () => string;
}

export interface ForgePiPresetExtensionLoaderOptions extends ForgePiPresetExtensionResolverOptions {
    compatHost: PiExtensionCompatHost;
}

const resolveActiveAgentPresetId = (): string => promptPresetRegistry.getActivePresetId('forge-agent');

const resolveExtensions = (
    options: ForgePiPresetExtensionResolverOptions
): ForgeAgentPresetExtensionResource[] => {
    const registry = options.registry ?? forgeAgentPresetResourceRegistry;
    const presetId = options.resolvePresetId?.() ?? resolveActiveAgentPresetId();
    return registry.resolve(presetId).extensions;
};

const resolveExtensionPathSource = (
    source: ForgeAgentPresetExtensionResource['source']
): 'manifest' | 'code-config' => source === 'base' ? 'manifest' : 'code-config';

const diagnostic = (path: string, message: string): AgentRuntimeDiagnostic => ({
    type: 'error',
    path,
    message
});

export class ForgePiPresetExtensionScanner implements AgentRuntimeResourceScanner {
    constructor(private readonly options: ForgePiPresetExtensionResolverOptions = {}) {}

    scan(_input: AgentRuntimeResourceScanInput): AgentRuntimeResourceScanResult {
        const extensions = resolveExtensions(this.options);
        return {
            extensionPaths: extensions.map(extension => extension.path)
        };
    }
}

export class ForgePiPresetExtensionLoader implements AgentRuntimeExtensionLoader {
    constructor(private readonly options: ForgePiPresetExtensionLoaderOptions) {}

    load(input: AgentRuntimeExtensionLoadInput): AgentRuntimeExtensionLoadResult {
        const extensions = resolveExtensions(this.options);
        const byPath = new Map(extensions.map(extension => [extension.path, extension]));
        const diagnostics: AgentRuntimeDiagnostic[] = [];
        const loaded = input.paths.flatMap(path => {
            const extension = byPath.get(path);
            if (!extension) {
                diagnostics.push(diagnostic(path, 'Forge Pi extension path is not registered for the active Agent preset.'));
                return [];
            }
            return [this.options.compatHost.fromFactory(extension.id, extension.factory)];
        });
        return {
            extensions: loaded,
            resolvedExtensionPaths: input.paths
                .map(path => byPath.get(path))
                .filter((extension): extension is ForgeAgentPresetExtensionResource => Boolean(extension))
                .map(extension => ({
                    extensionId: extension.id,
                    path: extension.path,
                    source: resolveExtensionPathSource(extension.source)
                })),
            diagnostics
        };
    }
}

export const createForgePiPresetExtensionRuntimeDeps = (
    options: ForgePiPresetExtensionResolverOptions = {}
): {
    extensionLoader: AgentRuntimeExtensionLoader;
    resourceScanner: AgentRuntimeResourceScanner;
} => {
    const compatHost = new PiExtensionCompatHost({ cwd: './' });
    return {
        extensionLoader: new ForgePiPresetExtensionLoader({ ...options, compatHost }),
        resourceScanner: new ForgePiPresetExtensionScanner(options)
    };
};
