import { computed, type ComputedRef } from 'vue';
import type {
    ShellRuntimeActions,
    ShellRuntimeContext,
    ShellRuntimeFrame,
    ShellRuntimeSurfaces
} from '../../shell/types.js';

/** 平台传给当前模式 shell renderer 的完整 props（LuminaShellRoot 统一注入）。 */
export interface DesktopModeShellProps {
    runtimeContext: ShellRuntimeContext;
    runtimeSurfaces: ShellRuntimeSurfaces;
    runtimeActions: ShellRuntimeActions;
    runtimeFrame: ShellRuntimeFrame;
}

/** 模式包内的 composable 通过该响应式入口读写通用壳层状态，不直接依赖 App。 */
export interface DesktopModeShellRuntime {
    context: ComputedRef<ShellRuntimeContext>;
    surfaces: ComputedRef<ShellRuntimeSurfaces>;
    actions: ShellRuntimeActions;
}

export const createDesktopModeShellRuntime = (props: DesktopModeShellProps): DesktopModeShellRuntime => ({
    context: computed(() => props.runtimeContext),
    surfaces: computed(() => props.runtimeSurfaces),
    actions: props.runtimeActions
});
