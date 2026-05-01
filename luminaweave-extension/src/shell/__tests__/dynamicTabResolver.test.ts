import { defineComponent } from 'vue';
import { describe, expect, it } from 'vitest';
import { resolveDynamicTabTarget } from '../dynamicTabResolver';

const LegacyComponent = defineComponent({ name: 'LegacyComponent', template: '<div />' });
const InlineComponent = defineComponent({ name: 'InlineComponent', template: '<div />' });

describe('resolveDynamicTabTarget', () => {
  it('prefers explicit surface contract ids', () => {
    const resolved = resolveDynamicTabTarget({
      id: 'settings-large',
      name: 'Settings',
      icon: '',
      component: 'LegacyComponent',
      surfaceContractId: 'settings.root',
      props: { mode: 'large' }
    }, { LegacyComponent });

    expect(resolved.surfaceContractId).toBe('settings.root');
    expect(resolved.component).toBeNull();
    expect(resolved.props).toEqual({ mode: 'large' });
  });

  it('resolves registered legacy string components', () => {
    const resolved = resolveDynamicTabTarget({
      id: 'conflict',
      name: 'Conflict',
      icon: '',
      component: 'ConflictDiffViewer'
    }, { ConflictDiffViewer: LegacyComponent });

    expect(resolved.surfaceContractId).toBeNull();
    expect(resolved.component).toBe(LegacyComponent);
  });

  it('treats unknown string components as surface contracts', () => {
    const resolved = resolveDynamicTabTarget({
      id: 'custom-settings',
      name: 'Custom Settings',
      icon: '',
      component: 'settings.root'
    }, {});

    expect(resolved.surfaceContractId).toBe('settings.root');
    expect(resolved.component).toBeNull();
  });

  it('keeps inline component tabs as legacy component tabs', () => {
    const resolved = resolveDynamicTabTarget({
      id: 'telegram-profile',
      name: 'Profile',
      icon: '',
      component: InlineComponent
    }, {});

    expect(resolved.surfaceContractId).toBeNull();
    expect(resolved.component).toBe(InlineComponent);
  });

  it('falls back component-less tabs to their id as a surface contract', () => {
    const resolved = resolveDynamicTabTarget({
      id: 'launcher.root',
      name: 'Launcher',
      icon: ''
    }, {});

    expect(resolved.surfaceContractId).toBe('launcher.root');
    expect(resolved.component).toBeNull();
  });
});
