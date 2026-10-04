import { computed, getCurrentInstance, onUnmounted, ref, type ComputedRef } from 'vue';
import { lwStorage } from '../../../../api/storage.js';

const STORAGE_KEY = 'luminaWeave.telegram.leftRailWidth';
const DEFAULT_WIDTH = 320;
const MIN_WIDTH = 260;
const MAIN_MIN_WIDTH = 520;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

interface ResizeStartState {
    pointerX: number;
    width: number;
}

/** Telegram 桌面左列表宽度与拖拽：状态完全由模式包拥有。 */
export const useTelegramLeftRailWidth = (
    widgetWidth: ComputedRef<number>,
    collapsed: ComputedRef<boolean>
) => {
    const leftRailWidth = ref(Number(lwStorage.get(STORAGE_KEY, DEFAULT_WIDTH, 'Global')));
    const isResizing = ref(false);
    let resizeStart: ResizeStartState | null = null;

    const leftRailStyle = computed(() => (
        collapsed.value
            ? { width: '0px', minWidth: '0px', maxWidth: '0px' }
            : {
                width: `${leftRailWidth.value}px`,
                minWidth: `${leftRailWidth.value}px`,
                maxWidth: `${leftRailWidth.value}px`
            }
    ));

    const handleResize = (event: MouseEvent) => {
        if (!isResizing.value) return;
        const newWidth = resizeStart
            ? resizeStart.width + (event.clientX - resizeStart.pointerX)
            : event.clientX;
        const maxWidth = window.innerWidth - widgetWidth.value - MAIN_MIN_WIDTH;
        leftRailWidth.value = clamp(newWidth, MIN_WIDTH, maxWidth);
    };

    const stopResize = () => {
        if (!isResizing.value) return;
        isResizing.value = false;
        resizeStart = null;
        document.removeEventListener('mousemove', handleResize);
        document.removeEventListener('mouseup', stopResize);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        lwStorage.set(STORAGE_KEY, leftRailWidth.value, 'Global');
    };

    const startResize = (event?: MouseEvent) => {
        resizeStart = event ? { pointerX: event.clientX, width: leftRailWidth.value } : null;
        isResizing.value = true;
        document.addEventListener('mousemove', handleResize);
        document.addEventListener('mouseup', stopResize);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    };

    if (getCurrentInstance()) {
        onUnmounted(stopResize);
    }

    return { leftRailWidth, leftRailStyle, isResizing, startResize, stopResize };
};
