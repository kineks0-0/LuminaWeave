import { getActiveDesktopModeIdFromSettings } from '../../desktop-modes/core/registry.js';

/**
 * 与原始持久化值比较，而不是与归一化后的 id 比较：
 * 持久化 id 指向未注册模式时归一化结果是 classic，用户再选 classic 必须能改写持久化值。
 */
export const shouldUpdateDesktopModeSetting = (
  nextDesktopModeId: string,
  settings: Record<string, unknown>
): boolean => nextDesktopModeId !== getActiveDesktopModeIdFromSettings(settings);
