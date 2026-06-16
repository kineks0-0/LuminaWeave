import { describe, expect, it } from 'vitest';
import * as viteConfig from './vite.config';

type BuildProfile = {
  runtimeBuildMode: string;
  isClientBuild: boolean;
  isAnalyzeBuild: boolean;
  inlineSourceMap: boolean;
  nodeEnv: 'development' | 'production';
};

type ConfigHelpers = typeof viteConfig & {
  resolveNodeModulePackageName: (id: string) => string | undefined;
  vendorChunkName: (id: string) => string | undefined;
  assetFileNames: (assetInfo: { names?: string[]; name?: string }) => string;
  resolveBuildProfile: (command: 'serve' | 'build', mode: string) => BuildProfile;
};

const helpers = viteConfig as ConfigHelpers;

describe('vite config helpers', () => {
  it('resolves package names from node_modules ids', () => {
    expect(helpers.resolveNodeModulePackageName('D:/app/node_modules/vue/dist/vue.runtime.esm-bundler.js')).toBe('vue');
    expect(helpers.resolveNodeModulePackageName('D:/app/node_modules/@ai-sdk/openai/dist/index.js')).toBe('@ai-sdk/openai');
    expect(helpers.resolveNodeModulePackageName('D:/app/src/main.ts')).toBeUndefined();
  });

  it('maps vendor packages to stable chunk names', () => {
    expect(helpers.vendorChunkName('D:/app/node_modules/vue/dist/vue.runtime.esm-bundler.js')).toBe('vendor-vue');
    expect(helpers.vendorChunkName('D:/app/node_modules/@vue/runtime-core/dist/runtime-core.esm-bundler.js')).toBe('vendor-vue');
    expect(helpers.vendorChunkName('D:/app/node_modules/@langchain/core/dist/index.js')).toBe('vendor-langchain');
    expect(helpers.vendorChunkName('D:/app/node_modules/@ai-sdk/openai/dist/index.js')).toBe('vendor-ai-sdk');
    expect(helpers.vendorChunkName('D:/app/node_modules/openai/index.mjs')).toBe('vendor-openai');
    expect(helpers.vendorChunkName('D:/app/src/main.ts')).toBeUndefined();
  });

  it('keeps CSS fixed and assets extension-correct', () => {
    expect(helpers.assetFileNames({ names: ['style.css'] })).toBe('style.css');
    expect(helpers.assetFileNames({ name: 'style.css' })).toBe('style.css');
    expect(helpers.assetFileNames({ names: ['wterm.wasm'] })).toBe('assets/[name][extname]');
  });

  it('derives explicit build profiles from command and mode', () => {
    expect(helpers.resolveBuildProfile('serve', 'client')).toMatchObject({
      runtimeBuildMode: 'client',
      isClientBuild: true,
      inlineSourceMap: false,
      nodeEnv: 'development'
    });
    expect(helpers.resolveBuildProfile('build', 'debug')).toMatchObject({
      runtimeBuildMode: 'debug',
      isClientBuild: false,
      inlineSourceMap: true,
      nodeEnv: 'production'
    });
    expect(helpers.resolveBuildProfile('build', 'analyze')).toMatchObject({
      runtimeBuildMode: 'github',
      isAnalyzeBuild: true,
      inlineSourceMap: false,
      nodeEnv: 'production'
    });
  });
});
