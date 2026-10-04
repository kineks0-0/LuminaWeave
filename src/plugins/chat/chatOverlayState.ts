import { ref } from 'vue';
import type { ChatPromptAssetsTarget } from './presentation/chatMenus.js';

/**
 * 聊天内浮层状态：独立于 surface 生命周期。
 * 主题 / 设置更新会重建 `chat.main` surface，若开合状态放在组件内，
 * 抽屉会在入场动画后被连同旧组件一起卸载（闪一下又消失）。
 */
export const promptAssetsSheetTarget = ref<ChatPromptAssetsTarget | null>(null);

export const openPromptAssetsSheet = (target: ChatPromptAssetsTarget): void => {
  promptAssetsSheetTarget.value = target;
};

export const closePromptAssetsSheet = (): void => {
  promptAssetsSheetTarget.value = null;
};
