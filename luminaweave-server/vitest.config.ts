import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    alias: {
      '@shared': resolve(__dirname, '../luminaweave-extension/shared'),
    },
  },
});
