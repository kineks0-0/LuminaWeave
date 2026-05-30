import type { Component } from 'vue';
import type { SurfaceContractId } from '../platform/surface/types.js';
import type { DynamicTabConfig } from './types.js';

export interface DynamicTabResolution {
  surfaceContractId: SurfaceContractId | null;
  component: Component | null;
  props: Record<string, unknown>;
}

export const resolveDynamicTabTarget = (
  tab: DynamicTabConfig,
  componentRegistry: Record<string, Component>
): DynamicTabResolution => {
  const resolvedProps = {
    ...(tab.props || {}),
    ...(tab.activity ? { activity: tab.activity } : {})
  };

  if (tab.surfaceContractId) {
    return {
      surfaceContractId: tab.surfaceContractId,
      component: null,
      props: resolvedProps
    };
  }

  if (typeof tab.component === 'string') {
    const registeredComponent = componentRegistry[tab.component];
    if (registeredComponent) {
      return {
        surfaceContractId: null,
        component: registeredComponent,
        props: resolvedProps
      };
    }

    return {
      surfaceContractId: tab.component as SurfaceContractId,
      component: null,
      props: resolvedProps
    };
  }

  if (tab.component) {
    return {
      surfaceContractId: null,
      component: tab.component,
      props: resolvedProps
    };
  }

  return {
    surfaceContractId: tab.id as SurfaceContractId,
    component: null,
    props: resolvedProps
  };
};
