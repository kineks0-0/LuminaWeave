import { describe, expect, it, vi } from 'vitest';
import {
    createForgeAgentPresetResourceRegistry
} from '@/api/core/forge/presets/ForgeAgentPresetResourceRegistry.js';

describe('ForgeAgentPresetResourceRegistry', () => {
    it('按 base 后当前预设的顺序合并技能，并让当前预设覆盖同名技能', () => {
        const registry = createForgeAgentPresetResourceRegistry({
            baseSkills: {
                'resources/forge-agent/base/skills/shared/SKILL.md': [
                    '---',
                    'name: shared',
                    'description: Base shared skill',
                    'metadata:',
                    '  title: Base Shared',
                    '---',
                    '# Base Shared'
                ].join('\n'),
                'resources/forge-agent/base/skills/base-only/SKILL.md': [
                    '---',
                    'name: base-only',
                    'description: Base only skill',
                    'metadata:',
                    '  title: Base Only',
                    '---',
                    '# Base Only'
                ].join('\n')
            },
            presetSkills: {
                'resources/forge-agent/presets/forge-agent-default/skills/shared/SKILL.md': [
                    '---',
                    'name: shared',
                    'description: Preset shared skill',
                    'metadata:',
                    '  title: Preset Shared',
                    '---',
                    '# Preset Shared'
                ].join('\n'),
                'resources/forge-agent/presets/forge-agent-default/skills/preset-only/SKILL.md': [
                    '---',
                    'name: preset-only',
                    'description: Preset only skill',
                    'metadata:',
                    '  title: Preset Only',
                    '---',
                    '# Preset Only'
                ].join('\n')
            }
        });

        const resources = registry.resolve('built-in:forge-agent-default');

        expect(resources.skills.map(skill => `${skill.source}:${skill.name}`)).toEqual([
            'base:base-only',
            'preset:preset-only',
            'preset:shared'
        ]);
        expect(resources.skills.find(skill => skill.name === 'shared')).toEqual(expect.objectContaining({
            title: 'Preset Shared',
            content: expect.stringContaining('# Preset Shared'),
            path: './agent/skills/shared/SKILL.md',
            source: 'preset'
        }));
    });

    it('按 base 后当前预设的顺序合并 Pi 扩展，并让当前预设覆盖同 ID 扩展', () => {
        const baseFactory = vi.fn();
        const presetFactory = vi.fn();
        const registry = createForgeAgentPresetResourceRegistry({
            baseExtensions: {
                'resources/forge-agent/base/extensions/shared/index.ts': baseFactory,
                'resources/forge-agent/base/extensions/base-only/index.ts': vi.fn()
            },
            presetExtensions: {
                'resources/forge-agent/presets/forge-agent-default/extensions/shared/index.ts': presetFactory,
                'resources/forge-agent/presets/forge-agent-default/extensions/preset-only/index.ts': vi.fn()
            }
        });

        const resources = registry.resolve('built-in:forge-agent-default');

        expect(resources.extensions.map(extension => `${extension.source}:${extension.id}`)).toEqual([
            'base:base-only',
            'preset:preset-only',
            'preset:shared'
        ]);
        expect(resources.extensions.find(extension => extension.id === 'shared')).toEqual(expect.objectContaining({
            source: 'preset',
            factory: presetFactory
        }));
    });
});
