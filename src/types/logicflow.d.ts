declare module '@logicflow/vue-node-registry' {
  import { LogicFlow } from '@logicflow/core';
  import { Component } from 'vue';

  export function register(config: {
    type: string;
    component: Component;
  }, lf: any): void;
}
