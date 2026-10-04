import type { InjectionKey } from 'vue';
import type { SurfaceContractId } from './types.js';

/**
 * 桌面模式外壳向主 surface 注入运行时回调的通道。
 * 桌面组合（DesktopCompositionOutlet → ShellPrimaryActivityOutlet）不经过 TraditionalShell 的
 * surfaceInputResolver prop，因此模式壳通过 provide 提供解析器，由主 surface 出口合并。
 */
export type DesktopSurfaceInputResolver = (
    contractId: SurfaceContractId
) => Record<string, unknown> | undefined;

export const desktopSurfaceInputResolverKey: InjectionKey<DesktopSurfaceInputResolver> =
    Symbol('lw-desktop-surface-input-resolver');
