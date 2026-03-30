import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  define: {
    'process.env.NODE_ENV': '"production"'
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    }
  },
  build: {
    outDir: 'dist',
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'LuminaWeave',
      formats: ['es'],
      fileName: () => 'index.js'
    },
    sourcemap: true,
    rollupOptions: {
      external: [
        '/scripts/slash-commands.js',
        '/scripts/custom-request.js',
        '/scripts/preset-manager.js',
        '/script.js'
      ],
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.names?.includes('luminaweave-extension.css')) return 'style.css';
          return assetInfo.names?.[0] || '';
        }
      }
    }
  }
})
