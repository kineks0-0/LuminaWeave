import { defineComponent } from 'vue';
import { describe, expect, it } from 'vitest';
import type { LuminaPlugin } from '../../types/plugin.js';
import * as workspaceProjection from '../workspaceSurfaceProjection.js';
import { createWorkspaceSurfaceOutletProps } from '../workspaceSurfaceProjection.js';

describe('createWorkspaceSurfaceOutletProps', () => {
    it('derives an activity-only workspace app without a navigation slot', () => {
        const plugin: LuminaPlugin = {
            id: 'third-party-notes',
            name: 'Notes',
            icon: 'note',
            component: defineComponent({ name: 'LegacyNotes', template: '<div />' }),
            platformManifest: {
                id: 'third-party-notes',
                name: 'Notes',
                primarySurface: 'chat.main',
                activity: {
                    size: 'small',
                    pageType: 'standalone',
                    titleBar: { title: 'Notes Workspace' }
                },
                surfaces: []
            }
        };
        const deriveWorkspacePluginCatalog = (
            workspaceProjection as typeof workspaceProjection & {
                deriveWorkspacePluginCatalog?: (plugins: readonly LuminaPlugin[]) => Array<{
                    id: string;
                    contractId: string;
                    activity: { size?: string; pageType?: string };
                }>;
            }
        ).deriveWorkspacePluginCatalog;

        expect(deriveWorkspacePluginCatalog).toBeTypeOf('function');
        if (!deriveWorkspacePluginCatalog) return;

        expect(deriveWorkspacePluginCatalog([plugin])).toEqual([
            expect.objectContaining({
                id: 'plugin:third-party-notes',
                contractId: 'chat.main',
                kind: 'widget',
                activity: {
                    size: 'small',
                    pageType: 'standalone',
                    titleBar: { title: 'Notes Workspace' }
                }
            })
        ]);
    });

    it('projects window compact state into Chat input', () => {
        expect(createWorkspaceSurfaceOutletProps({
            contractId: 'chat.main',
            desktopModeId: 'stage',
            rawInput: {},
            isMobile: false,
            isCompact: true
        })).toEqual({
            contractId: 'chat.main',
            desktopModeId: 'stage',
            input: {
                isMobile: true,
                workspaceCompact: true
            }
        });
    });

    it('preserves Forge workspace environment while projecting compact state', () => {
        expect(createWorkspaceSurfaceOutletProps({
            contractId: 'forge.workspace',
            desktopModeId: 'stage',
            rawInput: { embeddedInWorkspaceWindow: true },
            environment: {
                activity: { size: 'small', pageType: 'standalone' },
                embeddedInWorkspaceWindow: true
            },
            isMobile: false,
            isCompact: true
        })).toEqual({
            contractId: 'forge.workspace',
            desktopModeId: 'stage',
            input: {
                activity: { size: 'small', pageType: 'standalone' },
                embeddedInWorkspaceWindow: true,
                isMobile: true,
                workspaceCompact: true
            }
        });
    });
});
