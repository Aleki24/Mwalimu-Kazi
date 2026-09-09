import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const pkg = (name: string): string =>
  fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url));

export default defineConfig({
  test: {
    include: [
      'packages/*/src/**/*.test.ts',
      // The design guards live with the app they police, and run in the same
      // command as everything else — a check you have to remember to run is
      // not a guard.
      'apps/mobile/*.test.ts',
    ],
  },
  resolve: {
    alias: {
      '@mwalimu/types': pkg('types'),
      '@mwalimu/core': pkg('core'),
      '@mwalimu/ui/tokens.json': fileURLToPath(new URL('./packages/ui/tokens.json', import.meta.url)),
    },
  },
});
