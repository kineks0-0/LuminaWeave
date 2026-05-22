import { beforeAll, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import type { LuminaPlugin } from '../../../types/plugin.js';
import { getPrimarySurfaceContractIdForPlugin } from '../officialPluginSurfaces.js';
import { getSurfaceContractIdForRegisteredPanel } from '../officialPanelSurfaces.js';
import { deriveNavigationSlotsFromManifest, getPluginNavigationSlots } from '../pluginNavigationSlots.js';

let officialPlugins: LuminaPlugin[] = [];

const StubComponent = defineComponent({ name: 'StubComponent', template: '<div />' });

vi.mock('../../../plugins/chat/ChatRoot.vue', () => ({ default: StubComponent }));
vi.mock('../../../plugins/chat/ChatPreview.vue', () => ({ default: StubComponent }));
vi.mock('../../../plugins/settings/SettingsRoot.vue', () => ({ default: StubComponent }));
vi.mock('../../../plugins/settings/SettingControl.vue', () => ({ default: StubComponent }));
vi.mock('../../../plugins/timeline/LuminaTimeline.vue', () => ({ default: StubComponent }));
vi.mock('../../../plugins/stats/LuminaStats.vue', () => ({ default: StubComponent }));
vi.mock('../../../plugins/lorebook/LorebookRoot.vue', () => ({ default: StubComponent }));
vi.mock('../../../plugins/lorebook/components/LorebookWorkspace.vue', () => ({ default: StubComponent }));
vi.mock('../../../plugins/director/components/DirectorPanel.vue', () => ({ default: StubComponent }));
vi.mock('../../../plugins/launcher/LauncherRoot.vue', () => ({ default: StubComponent }));
vi.mock('../../../plugins/dev/DevSettings.vue', () => ({ default: StubComponent }));
vi.mock('../../../plugins/forge/app/CardMakerPanel.vue', () => ({ default: StubComponent }));
vi.mock('../../../plugins/forge/app/ForgeAuxPanelView.vue', () => ({ default: StubComponent }));
vi.mock('../../../plugins/forge/ForgePromptPresetInlineSummary.vue', () => ({ default: StubComponent }));
vi.mock('../../../plugins/forge/ForgePromptPresetWorkbench.vue', () => ({ default: StubComponent }));

describe('official plugin platform manifests', () => {
    beforeAll(async () => {
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: (query: string) => ({
                matches: false,
                media: query,
                onchange: null,
                addListener: () => undefined,
                removeListener: () => undefined,
                addEventListener: () => undefined,
                removeEventListener: () => undefined,
                dispatchEvent: () => false
            })
        });

        const module = await import('../../../plugins/officialPlugins.js');
        officialPlugins = module.officialPlugins;
    }, 30000);

    it('declares manifest v2 for every official plugin', () => {
        expect(officialPlugins.map(plugin => plugin.id).sort()).toEqual([
            'lumina-chat',
            'lumina-dev',
            'lumina-director',
            'lumina-forge',
            'lumina-launcher',
            'lumina-lorebook',
            'lumina-settings',
            'lumina-stats',
            'lumina-terminal',
            'lumina-timeline'
        ].sort());

        officialPlugins.forEach(plugin => {
            expect(plugin.platformManifest?.id).toBe(plugin.id);
            expect(plugin.platformManifest?.surfaces?.length).toBeGreaterThan(0);
        });
    });

    it('keeps legacy settings manifests aligned with manifest v2 schemas', () => {
        officialPlugins.forEach(plugin => {
            if (!plugin.settingsManifest) return;
            expect(plugin.platformManifest?.settingsSchema).toBe(plugin.settingsManifest);
        });
    });

    it('maps every official plugin to one declared primary surface', () => {
        officialPlugins.forEach(plugin => {
            const primarySurface = getPrimarySurfaceContractIdForPlugin(plugin.id);
            expect(plugin.platformManifest?.surfaces?.some(surface => surface.id === primarySurface)).toBe(true);
        });
    });

    it('derives current navigation slots from primary surfaces', () => {
        const expectedSlots: Record<string, NonNullable<LuminaPlugin['slots']>> = {
            'lumina-chat': ['mainView'],
            'lumina-timeline': ['mainView', 'widget'],
            'lumina-forge': ['mainView'],
            'lumina-launcher': ['mainView'],
            'lumina-settings': ['widget'],
            'lumina-stats': ['widget'],
            'lumina-director': ['widget'],
            'lumina-lorebook': ['widget', 'mainView'],
            'lumina-dev': ['widget'],
            'lumina-terminal': ['widget']
        };

        officialPlugins.forEach(plugin => {
            expect(deriveNavigationSlotsFromManifest(plugin.platformManifest!)).toEqual(expectedSlots[plugin.id]);
            expect(getPluginNavigationSlots({ platformManifest: plugin.platformManifest, slots: [] })).toEqual(expectedSlots[plugin.id]);
            expect(plugin.slots).toBeUndefined();
            expect(getPluginNavigationSlots(plugin)).toEqual(expectedSlots[plugin.id]);
        });
    });

    it('uses manifest-declared navigation before official plugin id fallbacks', () => {
        expect(deriveNavigationSlotsFromManifest({
            id: 'third-party-panel',
            name: 'Third Party Panel',
            primarySurface: 'third-party.surface',
            navigationSlots: ['widget'],
            surfaces: [{ id: 'third-party.surface' }]
        })).toEqual(['widget']);
    });

    it('maps official registered panels that have platform surfaces', () => {
        expect(getSurfaceContractIdForRegisteredPanel('card_maker')).toBe('forge.workspace');
        expect(getSurfaceContractIdForRegisteredPanel('conflict')).toBeNull();
    });
});
