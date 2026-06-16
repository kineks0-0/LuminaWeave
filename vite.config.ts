import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { analyzer } from 'vite-bundle-analyzer'
import { resolve } from 'path'

export const toNormalizedId = (id: string) => id.replace(/\\/g, '/');
const tauriDevHost = process.env.TAURI_DEV_HOST;

export const resolveNodeModulePackageName = (id: string) => {
  const normalizedId = toNormalizedId(id);
  const optimizedDepsMarker = '/node_modules/.vite/deps/';
  const optimizedDepsIndex = normalizedId.lastIndexOf(optimizedDepsMarker);
  if (optimizedDepsIndex >= 0) {
    const optimizedName = normalizedId
      .slice(optimizedDepsIndex + optimizedDepsMarker.length)
      .split(/[?#]/)[0];
    if (optimizedName.startsWith('vue')) return 'vue';
    if (optimizedName.startsWith('pinia')) return 'pinia';
    return undefined;
  }

  const nodeModulesMarker = '/node_modules/';
  const nodeModulesIndex = normalizedId.lastIndexOf(nodeModulesMarker);
  if (nodeModulesIndex < 0) return undefined;

  const parts = normalizedId.slice(nodeModulesIndex + nodeModulesMarker.length).split('/');
  const [scopeOrName, packageName] = parts;
  if (!scopeOrName) return undefined;
  return scopeOrName.startsWith('@') && packageName ? `${scopeOrName}/${packageName}` : scopeOrName;
};

const vendorPackageGroups = new Map<string, string>([
  ['vue', 'vendor-vue'],
  ['pinia', 'vendor-vue'],
  ['gsap', 'vendor-motion'],
  ['ai', 'vendor-ai-sdk'],
  ['openai', 'vendor-openai']
]);

export const vendorChunkName = (id: string) => {
  const packageName = resolveNodeModulePackageName(id);
  if (!packageName) return undefined;

  const groupName = vendorPackageGroups.get(packageName);
  if (groupName) return groupName;
  if (packageName.startsWith('@vue/')) return 'vendor-vue';
  if (packageName.startsWith('@langchain/')) return 'vendor-langchain';
  if (packageName.startsWith('@ai-sdk/')) return 'vendor-ai-sdk';
  return undefined;
};

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
              manualChunks: vendorChunkName,
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
              manualChunks: vendorChunkName,
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
