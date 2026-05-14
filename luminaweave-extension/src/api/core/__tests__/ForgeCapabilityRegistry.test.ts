import { describe, expect, it } from 'vitest';
import { ForgeCapabilityRegistry } from '../forge/ForgeCapabilityRegistry.js';

describe('ForgeCapabilityRegistry', () => {
    it('keeps a small stable capability index without full tool schemas', () => {
        const registry = new ForgeCapabilityRegistry();
        const capabilities = registry.listCapabilities();

        expect(capabilities.length).toBeGreaterThan(0);
        expect(capabilities.length).toBeLessThanOrEqual(8);
        expect(capabilities.map(item => item.id)).toContain('material-analyzer');
        expect(capabilities.every(item => item.summary.length < 140)).toBe(true);
        expect(capabilities.every(item => !('inputSchema' in item))).toBe(true);
    });

    it('searches capabilities by trigger words', () => {
        const registry = new ForgeCapabilityRegistry();

        expect(registry.search('世界书').map(item => item.id)).toEqual(['virtual-lorebook-editor']);
        expect(registry.search('export').map(item => item.id)).toEqual(['export-preparer']);
    });

    it('loads skill and shell profile references on demand', async () => {
        const registry = new ForgeCapabilityRegistry();
        const loaded = await registry.load({
            capabilityId: 'material-analyzer',
            forgeProjectId: 'forge_project_alpha',
            conversationId: 'conversation_alpha',
            reason: 'Inspect uploaded material files'
        });

        expect(loaded).toMatchObject({
            namespace: 'forge.material',
            shellProfile: 'project-readonly',
            trace: {
                capabilityId: 'material-analyzer',
                loadAs: 'shell-skill',
                risk: 'medium',
                reason: 'Inspect uploaded material files'
            }
        });
        expect(loaded.skill?.skill.name).toBe('material-analyzer');
        expect(loaded.skill?.skill.files[0].content).toContain('Material Analyzer');
    });

    it('reports unknown capabilities clearly', async () => {
        const registry = new ForgeCapabilityRegistry();

        await expect(registry.load({
            capabilityId: 'missing-capability',
            forgeProjectId: 'forge_project_alpha',
            reason: 'test'
        })).rejects.toThrow('Forge capability not found');
    });
});
