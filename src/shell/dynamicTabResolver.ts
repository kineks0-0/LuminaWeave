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
  if (tab.surfaceContractId) {
    return {
      surfaceContractId: tab.surfaceContractId,
      component: null,
      props: tab.props || {}
    };
  }

  if (typeof tab.component === 'string') {
    const registeredComponent = componentRegistry[tab.component];
    if (registeredComponent) {
      return {
        surfaceContractId: null,
        component: registeredComponent,
        props: tab.props || {}
      };
    }

    return {
      surfaceContractId: tab.component as SurfaceContractId,
      component: null,
      props: tab.props || {}
    };
  }

  if (tab.component) {
    return {
      surfaceContractId: null,
      component: tab.component,
      props: tab.props || {}
    };
  }

  return {
    surfaceContractId: tab.id as SurfaceContractId,
    component: null,
    props: tab.props || {}
  };
};
