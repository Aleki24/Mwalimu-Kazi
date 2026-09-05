import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const pkg = (name: string): string =>
  fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url));

export default defineConfig({
  test: { include: ['packages/*/src/**/*.test.ts'] },
  resolve: {
    alias: {
      '@mwalimu/types': pkg('types'),
      '@mwalimu/core': pkg('core'),
    },
  },
});
