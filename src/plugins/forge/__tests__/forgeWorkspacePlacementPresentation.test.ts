import { describe, expect, it } from 'vitest';
import {
    createForgeWorkspaceInstanceState,
    resolveForgeWorkspacePlacement
} from '../app/forgeWorkspacePlacementPresentation.js';

describe('resolveForgeWorkspacePlacement', () => {
    it.each([
        {
            mode: 'left' as const,
            expected: {
                showOwnedLeftSidebar: true,
                showEmbeddedSidebar: false,
                showAuxStripInBody: false,
                showAuxStripForWidgetMode: false,
                showAuxStripForHiddenMode: false
            }
        },
        {
            mode: 'right' as const,
            expected: {
                showOwnedLeftSidebar: false,
                showEmbeddedSidebar: true,
                showAuxStripInBody: true,
                showAuxStripForWidgetMode: false,
                showAuxStripForHiddenMode: false
            }
        },
        {
            mode: 'widget' as const,
            expected: {
                showOwnedLeftSidebar: false,
                showEmbeddedSidebar: false,
                showAuxStripInBody: false,
                showAuxStripForWidgetMode: true,
                showAuxStripForHiddenMode: false
            }
        },
        {
            mode: 'hidden' as const,
            expected: {
                showOwnedLeftSidebar: false,
                showEmbeddedSidebar: false,
                showAuxStripInBody: false,
                showAuxStripForWidgetMode: false,
                showAuxStripForHiddenMode: true
            }
        }
    ])('maps the traditional $mode placement without leaking another placement', ({ mode, expected }) => {
        expect(resolveForgeWorkspacePlacement({
            isMobile: false,
            embeddedInWorkspaceWindow: false,
            auxSidebarMode: mode,
            auxPresentationMode: 'embedded'
        })).toMatchObject(expected);
    });

    it('lets mobile placement override desktop sidebar settings', () => {
        expect(resolveForgeWorkspacePlacement({
            isMobile: true,
            embeddedInWorkspaceWindow: false,
            auxSidebarMode: 'right',
            auxPresentationMode: 'embedded'
        })).toEqual({
            isDetachedWorkspace: false,
            isMobileLayout: true,
            isStandaloneExpandedWorkspace: false,
            showStandaloneWorkspaceActions: false,
            showWorkspaceHero: false,
            showWorkspaceTopbar: false,
            showMobileAuxStrip: true,
            showOwnedLeftSidebar: false,
            showEmbeddedSidebar: false,
            showAuxStripInBody: false,
            showAuxStripForWidgetMode: false,
            showAuxStripForHiddenMode: false,
            isTraditionalWithRightSidebar: false,
            isTraditionalWithWidgetSidebar: false
        });
    });

    it('maps an embedded freeform window independently from the shell sidebar mode', () => {
        expect(resolveForgeWorkspacePlacement({
            isMobile: false,
            embeddedInWorkspaceWindow: true,
            auxSidebarMode: 'left',
            auxPresentationMode: 'embedded'
        })).toMatchObject({
            isDetachedWorkspace: false,
            isStandaloneExpandedWorkspace: false,
            showWorkspaceHero: true,
            showWorkspaceTopbar: true,
            showOwnedLeftSidebar: false,
            showEmbeddedSidebar: true,
            showAuxStripInBody: true
        });
    });

    it('maps a detached freeform window without rendering an embedded auxiliary panel', () => {
        expect(resolveForgeWorkspacePlacement({
            isMobile: false,
            embeddedInWorkspaceWindow: true,
            auxSidebarMode: 'right',
            auxPresentationMode: 'detached'
        })).toMatchObject({
            isDetachedWorkspace: true,
            isStandaloneExpandedWorkspace: false,
            showWorkspaceHero: false,
            showWorkspaceTopbar: false,
            showOwnedLeftSidebar: false,
            showEmbeddedSidebar: false,
            showAuxStripInBody: false
        });
    });
});

describe('createForgeWorkspaceInstanceState', () => {
    it('returns independent sidebar collapse state for each surface instance', () => {
        const first = createForgeWorkspaceInstanceState();
        const second = createForgeWorkspaceInstanceState();

        first.isSidebarCollapsed = true;

        expect(second.isSidebarCollapsed).toBe(false);
    });
});
