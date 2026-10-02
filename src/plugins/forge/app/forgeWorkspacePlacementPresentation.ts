export type ForgeAuxSidebarMode = 'left' | 'right' | 'widget' | 'hidden';
export type ForgeAuxPresentationMode = 'embedded' | 'detached' | 'widget' | 'hidden';

export interface ForgeWorkspacePlacementInput {
    isMobile: boolean;
    embeddedInWorkspaceWindow: boolean;
    auxSidebarMode: ForgeAuxSidebarMode;
    auxPresentationMode: ForgeAuxPresentationMode;
}

export interface ForgeWorkspacePlacement {
    isDetachedWorkspace: boolean;
    isMobileLayout: boolean;
    isStandaloneExpandedWorkspace: boolean;
    showStandaloneWorkspaceActions: boolean;
    showWorkspaceHero: boolean;
    showWorkspaceTopbar: boolean;
    showMobileAuxStrip: boolean;
    showOwnedLeftSidebar: boolean;
    showEmbeddedSidebar: boolean;
    showAuxStripInBody: boolean;
    showAuxStripForWidgetMode: boolean;
    showAuxStripForHiddenMode: boolean;
    isTraditionalWithRightSidebar: boolean;
    isTraditionalWithWidgetSidebar: boolean;
}

export interface ForgeWorkspaceInstanceState {
    isSidebarCollapsed: boolean;
}

export const createForgeWorkspaceInstanceState = (): ForgeWorkspaceInstanceState => ({
    isSidebarCollapsed: false
});

export const resolveForgeWorkspacePlacement = (
    input: ForgeWorkspacePlacementInput
): ForgeWorkspacePlacement => {
    const isTraditionalDesktop = !input.isMobile && !input.embeddedInWorkspaceWindow;
    const isTraditionalWithLeftSidebar = isTraditionalDesktop && input.auxSidebarMode === 'left';
    const isTraditionalWithRightSidebar = isTraditionalDesktop && input.auxSidebarMode === 'right';
    const isTraditionalWithWidgetSidebar = isTraditionalDesktop && input.auxSidebarMode === 'widget';
    const isTraditionalWithHiddenSidebar = isTraditionalDesktop && input.auxSidebarMode === 'hidden';
    const isDetachedWorkspace = input.embeddedInWorkspaceWindow
        && input.auxPresentationMode === 'detached';
    const isMobileLayout = input.isMobile || isTraditionalWithHiddenSidebar;
    const isStandaloneExpandedWorkspace = isTraditionalDesktop && !isMobileLayout;
    const showEmbeddedAuxiliary = !input.isMobile
        && !isDetachedWorkspace
        && (isTraditionalWithRightSidebar
            || (input.embeddedInWorkspaceWindow && input.auxPresentationMode === 'embedded'));

    return {
        isDetachedWorkspace,
        isMobileLayout,
        isStandaloneExpandedWorkspace,
        showStandaloneWorkspaceActions: isStandaloneExpandedWorkspace,
        showWorkspaceHero: !isStandaloneExpandedWorkspace && !isDetachedWorkspace && !isMobileLayout,
        showWorkspaceTopbar: !isStandaloneExpandedWorkspace && !isDetachedWorkspace && !isMobileLayout,
        showMobileAuxStrip: isMobileLayout,
        showOwnedLeftSidebar: isTraditionalWithLeftSidebar,
        showEmbeddedSidebar: showEmbeddedAuxiliary,
        showAuxStripInBody: showEmbeddedAuxiliary,
        showAuxStripForWidgetMode: isTraditionalWithWidgetSidebar,
        showAuxStripForHiddenMode: isTraditionalWithHiddenSidebar,
        isTraditionalWithRightSidebar,
        isTraditionalWithWidgetSidebar
    };
};
