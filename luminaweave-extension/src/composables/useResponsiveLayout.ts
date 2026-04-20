import { computed, onMounted, onUnmounted, ref, watch, type Ref } from 'vue';
import { lwStorage } from '../api/storage';

const MOBILE_BREAKPOINT = 768;
const SIDEBAR_MIN_CONTENT_WIDTH = 960;
const SIDEBAR_COLLAPSE_WIDTH = 1100;

export type SidebarMode = 'left' | 'right' | 'widget' | 'hidden';

export function useResponsiveLayout(panelBodyRef: Ref<HTMLElement | null>) {
    const viewportWidth = ref(window.innerWidth);
    const containerWidth = ref(0);

    const isMobile = computed(() => viewportWidth.value < MOBILE_BREAKPOINT);
    const canShowEmbeddedSidebar = computed(
        () => !isMobile.value && viewportWidth.value >= SIDEBAR_MIN_CONTENT_WIDTH
    );
    const shouldAutoCollapseSidebar = computed(
        () => !isMobile.value
            && containerWidth.value > 0
            && containerWidth.value < SIDEBAR_COLLAPSE_WIDTH
    );

    const sidebarMode = ref<SidebarMode>(
        lwStorage.get('luminaWeave.sidebarMode', 'left', 'Global')
    );

    const effectiveSidebarMode = computed<SidebarMode>(() => {
        if (isMobile.value) return 'hidden';
        if ((sidebarMode.value === 'left' || sidebarMode.value === 'right') && !canShowEmbeddedSidebar.value) {
            return 'widget';
        }
        return sidebarMode.value;
    });

    const setSidebarMode = (mode: SidebarMode) => {
        sidebarMode.value = mode;
        lwStorage.set('luminaWeave.sidebarMode', mode, 'Global');
    };

    let resizeObserver: ResizeObserver | null = null;

    const attachResizeObserver = (element: HTMLElement | null) => {
        resizeObserver?.disconnect();
        resizeObserver = null;

        if (!element) {
            return;
        }

        resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                containerWidth.value = entry.contentRect.width;
            }
        });
        resizeObserver.observe(element);
    };

    const handleViewportResize = () => {
        viewportWidth.value = window.innerWidth;
    };

    onMounted(() => {
        window.addEventListener('resize', handleViewportResize);
        attachResizeObserver(panelBodyRef.value);
    });

    watch(panelBodyRef, (element) => {
        attachResizeObserver(element);
    });

    onUnmounted(() => {
        window.removeEventListener('resize', handleViewportResize);
        resizeObserver?.disconnect();
    });

    return {
        isMobile,
        canShowEmbeddedSidebar,
        shouldAutoCollapseSidebar,
        sidebarMode: effectiveSidebarMode,
        rawSidebarMode: sidebarMode,
        setSidebarMode,
        viewportWidth,
        containerWidth,
    };
}
