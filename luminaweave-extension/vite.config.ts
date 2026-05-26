import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { analyzer } from 'vite-bundle-analyzer'
import { resolve } from 'path'

const toNormalizedId = (id: string) => id.replace(/\\/g, '/');
const tauriDevHost = process.env.TAURI_DEV_HOST;

const vendorChunkName = (id: string) => {
  const normalizedId = toNormalizedId(id);
  if (!normalizedId.includes('/node_modules/')) return;

  if (
    normalizedId.includes('/node_modules/.vite/deps/vue') ||
    normalizedId.includes('/node_modules/.vite/deps/pinia') ||
    normalizedId.includes('/node_modules/vue/') ||
    normalizedId.includes('/node_modules/@vue/') ||
    normalizedId.includes('/node_modules/pinia/')
  ) {
    return 'vendor-vue';
  }
  if (normalizedId.includes('/node_modules/gsap/')) return 'vendor-motion';
  if (normalizedId.includes('/node_modules/@langchain/')) return 'vendor-langchain';
  if (normalizedId.includes('/node_modules/ai/') || normalizedId.includes('/node_modules/@ai-sdk/')) return 'vendor-ai-sdk';
  if (normalizedId.includes('/node_modules/openai/')) return 'vendor-openai';
};

const chunkFileNames = 'assets/[name]-[hash].js';

const assetFileNames = (assetInfo: { name?: string }) => {
  if (assetInfo.name?.endsWith('.css')) return 'style.css';
  return 'assets/[name]-[hash][extname]';
};

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isWatchBuild = process.argv.includes('--watch');
  const isAnalyzeBuild = mode === 'analyze' || process.env.LW_ANALYZE === 'true';
  const runtimeBuildMode = mode === 'analyze' ? 'github' : mode;
  const isClientBuild = runtimeBuildMode === 'client';
  const inlineSourceMap = runtimeBuildMode !== 'github' && runtimeBuildMode !== 'client';

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
      'process.env.NODE_ENV': '"production"',
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
      rollupOptions: isClientBuild
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
