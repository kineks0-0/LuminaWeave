import type { PluginManager } from '../../core/PluginManager.js';
import { createRuntimePlugin } from '../../platform/plugin/createRuntimePlugin.js';
import type { PluginDomainRegistry } from '../../platform/plugin/PluginDomainRegistry.js';
import type { RegistrationHandle } from '../../platform/plugin/PluginRegistrationScope.js';
import { desktopModeRuntimeRegistry } from '../../platform/desktop-mode-runtime/DesktopModeRuntimeRegistry.js';
import { surfaceRegistry } from '../../platform/surface/SurfaceRegistry.js';
import { OFFICIAL_SURFACE_CONTRACTS } from '../../platform/surface/officialContracts.js';
import type { PluginManifestV2 } from '../../platform/plugin/types.js';

/** 第三方运行时插件注册入口（lwApi.plugins）。 */
export interface PluginRuntimeApi {
    register(manifest: PluginManifestV2): Promise<RegistrationHandle>;
    unregister(pluginId: string): boolean;
    list(): PluginManifestV2[];
}

const HEADER_SLOTS: ReadonlySet<string> = new Set(['headerCenter', 'headerRight']);

const OFFICIAL_CONTRACT_IDS: ReadonlySet<string> = new Set(OFFICIAL_SURFACE_CONTRACTS);

const assertNotOfficialContract = (pluginId: string, contractId: string | undefined, where: string): void => {
    if (contractId !== undefined && OFFICIAL_CONTRACT_IDS.has(contractId)) {
        throw new Error(
            `[LuminaWeave PluginRuntime] Runtime plugin cannot use official surface contract "${contractId}" (${where}): ${pluginId}`
        );
    }
};

const assertRuntimeManifest = (manifest: PluginManifestV2): void => {
    // 运行时插件没有 header 组件（占位组件不渲染内容），声明 header 槽位只会得到空白入口。
    if (manifest.navigationSlots?.some(slot => HEADER_SLOTS.has(slot))) {
        throw new Error(
            `[LuminaWeave PluginRuntime] Runtime plugin cannot declare header navigation slots: ${manifest.id}`
        );
    }
    // 官方 contract 是保留命名空间：运行时插件既不能声明，也不能给它挂 renderer。
    for (const surface of manifest.surfaces ?? []) {
        assertNotOfficialContract(manifest.id, surface.id, 'surfaces');
    }
    const rendererGroups: [string, Record<string, { contractId?: string } | undefined> | undefined][] = [
        ['businessRenderers', manifest.businessRenderers],
        ['fallbackRenderers', manifest.fallbackRenderers]
    ];
    for (const [where, renderers] of rendererGroups) {
        for (const [key, renderer] of Object.entries(renderers ?? {})) {
            assertNotOfficialContract(manifest.id, key, where);
            assertNotOfficialContract(manifest.id, renderer?.contractId, where);
        }
    }
};

/** 返回依赖该插件 contract 的其他方的可读描述；空数组表示可以卸载。 */
export type PluginDependentsQuery = (pluginId: string) => string[];

export const queryPluginDependents: PluginDependentsQuery = pluginId => {
    const surfaceDependents = surfaceRegistry.findForeignDependents(pluginId).map(dependent => (
        dependent.kind === 'desktop-override'
            ? `desktop mode "${dependent.modeId}" override on ${dependent.contractId}`
            : `plugin "${dependent.ownerPluginId}" ${dependent.kind} renderer on ${dependent.contractId}`
    ));
    const ownedContractIds = surfaceRegistry.listContracts()
        .filter(contract => contract.ownerPluginId === pluginId)
        .map(contract => contract.id);
    const modeDependents = desktopModeRuntimeRegistry.listModesReferencingContracts(ownedContractIds, { excludeOwnerPluginId: pluginId })
        .map(modeId => `desktop mode "${modeId}" composition`);
    return [...surfaceDependents, ...modeDependents];
};

export const createPluginRuntimeApi = (
    manager: Pick<PluginManager, 'registerAndInitialize' | 'unregister'>,
    domainRegistry: Pick<PluginDomainRegistry, 'list'>,
    whenReady: () => Promise<unknown>,
    queryDependents: PluginDependentsQuery = queryPluginDependents
): PluginRuntimeApi => {
    // 依赖检查只放在第三方入口（unregister 与句柄 dispose）：有依赖方时拒绝并抛错，不级联卸载。
    // PluginManager.unregister 与注册/init 失败的回滚路径不检查，否则回滚会被自己挂的渲染器卡住。
    const assertNoDependents = (pluginId: string): void => {
        const dependents = queryDependents(pluginId);
        if (dependents.length === 0) return;
        throw new Error(
            `[LuminaWeave PluginRuntime] Cannot unregister "${pluginId}", still used by: ${dependents.join('; ')}`
        );
    };
    // 只允许卸载经本 API 注册的运行时插件，内置插件不可被 Mod 卸载。
    const runtimeHandles = new Map<string, RegistrationHandle>();
    return {
        register: async manifest => {
            // 等宿主完成内置插件注册与初始化后再接入，避免抢注官方 id/contract 导致启动失败。
            await whenReady();
            assertRuntimeManifest(manifest);
            const inner = await manager.registerAndInitialize(createRuntimePlugin(manifest));
            const handle: RegistrationHandle = {
                pluginId: inner.pluginId,
                // 只有仍是当前登记的句柄才撤销，过期句柄不影响同 id 的新注册。
                dispose: () => {
                    if (runtimeHandles.get(manifest.id) !== handle) return;
                    assertNoDependents(manifest.id);
                    runtimeHandles.delete(manifest.id);
                    inner.dispose();
                }
            };
            runtimeHandles.set(manifest.id, handle);
            return handle;
        },
        unregister: pluginId => {
            const handle = runtimeHandles.get(pluginId);
            if (!handle) return false;
            // 依赖检查在 handle.dispose() 内，有依赖时此处直接抛错，runtimeHandles 保持不变。
            handle.dispose();
            return true;
        },
        list: () => domainRegistry.list()
    };
};
