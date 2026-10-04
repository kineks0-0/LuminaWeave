import { onMounted, onUnmounted, ref } from 'vue';

const MIN_HOST_FONT_SCALE = 0.5;
const MAX_HOST_FONT_SCALE = 1.5;

/** 解析宿主 Font Scale（ST --fontScale），非法或越界时回落到安全范围 */
export const parseHostFontScale = (raw: string | null | undefined): number => {
  const parsed = Number.parseFloat(raw ?? '');
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1;
  }
  return Math.min(MAX_HOST_FONT_SCALE, Math.max(MIN_HOST_FONT_SCALE, parsed));
};

const readDocumentFontScale = (): number => {
  if (typeof document === 'undefined') {
    return 1;
  }
  return parseHostFontScale(getComputedStyle(document.documentElement).getPropertyValue('--fontScale'));
};

/**
 * 跟随宿主（SillyTavern）字号缩放：
 * ST 在 documentElement 的 style 上维护 `--fontScale`，这里以 MutationObserver 观测并暴露响应式系数。
 * Lumina 只在自身子树写 `--lw-type-scale`，不修改宿主 DOM。
 */
export const useHostFontScale = () => {
  const hostFontScale = ref(readDocumentFontScale());

  let observer: MutationObserver | null = null;
  const syncHostFontScale = () => {
    hostFontScale.value = readDocumentFontScale();
  };

  onMounted(() => {
    syncHostFontScale();
    if (typeof MutationObserver === 'undefined') {
      return;
    }
    observer = new MutationObserver(syncHostFontScale);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
  });

  onUnmounted(() => {
    observer?.disconnect();
    observer = null;
  });

  return { hostFontScale };
};
