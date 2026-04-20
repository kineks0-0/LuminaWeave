import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const inlineSourceMap = mode !== 'github';

  return {
    plugins: [vue()],
    define: {
      'process.env.NODE_ENV': '"production"',
      'process.env.LW_BUILD_MODE': JSON.stringify(mode),
      'process.env.LW_INLINE_SOURCEMAP': JSON.stringify(inlineSourceMap)
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
        '@shared': resolve(__dirname, './shared'),
        'ai': resolve(__dirname, './node_modules/ai'),
        '@ai-sdk': resolve(__dirname, './node_modules/@ai-sdk'),
      }
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      lib: {
        entry: resolve(__dirname, 'src/index.ts'),
        name: 'LuminaWeave',
        formats: ['es'],
        fileName: () => 'index.js'
      },
      sourcemap: inlineSourceMap ? 'inline' : false,
      rollupOptions: {
        external: [
          '/scripts/slash-commands.js',
          '/scripts/custom-request.js',
          '/scripts/preset-manager.js',
          '/script.js'
        ],
        output: {
          codeSplitting: false,
          assetFileNames: (assetInfo) => {
            if (assetInfo.name?.endsWith('.css')) return 'style.css';
            return assetInfo.name || '';
          }
        },
        onwarn(warning, warn) {
          if (warning.code === 'FILE_NAME_CONFLICT') return;
          warn(warning);
        }
      }
    }
  };
})
