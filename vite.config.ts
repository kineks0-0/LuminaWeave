import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { analyzer } from 'vite-bundle-analyzer'
import { resolve } from 'path'

const tauriDevHost = process.env.TAURI_DEV_HOST;

export interface VendorChunkGroup {
  name: string;
  test: RegExp;
}

export const vendorChunkGroups: VendorChunkGroup[] = [
  { name: 'vendor-zod', test: /node_modules[\\/]zod[\\/]/ },
  { name: 'vendor-vue', test: /node_modules[\\/](?:vue|pinia|@vue)[\\/]/ },
  { name: 'vendor-motion', test: /node_modules[\\/]gsap[\\/]/ },
  { name: 'vendor-ai-sdk', test: /node_modules[\\/](?:ai|@ai-sdk)[\\/]/ },
  { name: 'vendor-openai', test: /node_modules[\\/]openai[\\/]/ },
  { name: 'vendor-langchain', test: /node_modules[\\/]@langchain[\\/]/ }
];

const vendorCodeSplitting = { groups: vendorChunkGroups };

const chunkFileNames = 'assets/[name].js';
//const chunkFileNames = 'assets/[name]-[hash].js';

export const assetFileNames = (assetInfo: { names?: string[]; name?: string }) => {
  const name = assetInfo.names?.[0] ?? assetInfo.name ?? '';
  if (name.endsWith('.css')) return 'style.css';
  return 'assets/[name][extname]';
  //return 'assets/[name]-[hash][extname]';
};

export const resolveBuildProfile = (command: 'serve' | 'build', mode: string) => {
  const runtimeBuildMode = mode === 'analyze' ? 'github' : mode;
  const isClientBuild = runtimeBuildMode === 'client';
  const isAnalyzeBuild = mode === 'analyze' || process.env.LW_ANALYZE === 'true';
  const inlineSourceMap = runtimeBuildMode !== 'github' && runtimeBuildMode !== 'client';
  const nodeEnv = command === 'serve' ? 'development' : 'production';

  return {
    runtimeBuildMode,
    isClientBuild,
    isAnalyzeBuild,
    inlineSourceMap,
    nodeEnv
  };
};

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const isWatchBuild = process.argv.includes('--watch');
  const {
    runtimeBuildMode,
    isClientBuild,
    isAnalyzeBuild,
    inlineSourceMap,
    nodeEnv
  } = resolveBuildProfile(command, mode);

  return {
    base: './',
    plugins: [
      vue(),
      tailwindcss(),
      analyzer({
        enabled: isAnalyzeBuild,
        analyzerMode: 'static',
        fileName: 'bundle-report',
        reportTitle: 'LuminaWeave Extension Bundle',
        defaultSizes: 'gzip',
        openAnalyzer: false
      })
    ],
    define: {
      'process.env.NODE_ENV': JSON.stringify(nodeEnv),
      'process.env.LW_BUILD_MODE': JSON.stringify(runtimeBuildMode),
      'process.env.LW_INLINE_SOURCEMAP': JSON.stringify(inlineSourceMap)
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
        '@shared': resolve(__dirname, './shared'),
        'ai': resolve(__dirname, './node_modules/ai'),
        '@ai-sdk': resolve(__dirname, './node_modules/@ai-sdk'),
        'node:zlib': resolve(__dirname, './src/shims/node-zlib.ts'),
      }
    },
    clearScreen: isClientBuild ? false : undefined,
    server: isClientBuild
      ? {
          port: 1420,
          strictPort: true,
          host: tauriDevHost || false,
          hmr: tauriDevHost
            ? {
                protocol: 'ws',
                host: tauriDevHost,
                port: 1421
              }
            : undefined,
          watch: {
            ignored: ['**/src-tauri/**']
          }
        }
      : undefined,
    build: {
      outDir: isClientBuild ? 'dist-client' : 'dist',
      emptyOutDir: true,
      cssCodeSplit: false,
      minify: 'oxc',
      reportCompressedSize: true,
      sourcemap: inlineSourceMap ? 'inline' : false,
      watch: isWatchBuild
        ? {
            exclude: [
              'dist/**',
              '**/dist/**',
              'node_modules/**',
              '**/node_modules/**'
            ]
          }
        : null,
      rolldownOptions: isClientBuild
        ? {
            input: resolve(__dirname, 'index.html'),
            output: {
              chunkFileNames,
              codeSplitting: vendorCodeSplitting,
              assetFileNames
            },
            onwarn(warning, warn) {
              if (warning.code === 'FILE_NAME_CONFLICT') return;
              warn(warning);
            }
          }
        : {
            input: resolve(__dirname, 'src/index.ts'),
            external: [
              '/scripts/slash-commands.js',
              '/scripts/custom-request.js',
              '/scripts/preset-manager.js',
              '/script.js'
            ],
            output: {
              format: 'es',
              entryFileNames: 'index.js',
              chunkFileNames,
              codeSplitting: vendorCodeSplitting,
              assetFileNames
            },
            onwarn(warning, warn) {
              if (warning.code === 'FILE_NAME_CONFLICT') return;
              warn(warning);
            }
          }
    }
  };
})
