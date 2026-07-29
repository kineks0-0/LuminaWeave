import { describe, expect, it } from 'vitest';
import { createWorkspaceSurfaceOutletProps } from '../workspaceSurfaceProjection.js';

describe('createWorkspaceSurfaceOutletProps', () => {
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
