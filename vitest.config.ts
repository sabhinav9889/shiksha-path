import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

const COVERAGE_MIN = 70;
// The full suite runs ~55 files in parallel; ESLint and SHA-256 tests can pass 5 s under load.
const TEST_TIMEOUT_MS = 15_000;

export default defineConfig({
  // Svelte components compile to client code; the browser condition picks Svelte's client build.
  plugins: [svelte()],
  resolve: { conditions: ['browser'] },
  test: {
    testTimeout: TEST_TIMEOUT_MS,
    setupFiles: ['apps/learner/test/setup.ts'],
    include: ['tooling/**/*.test.ts', 'packages/**/*.test.ts', 'apps/**/*.test.ts'],
    // Database tests need the local Supabase stack (Docker): `npm run test:db`.
    exclude: ['**/node_modules/**', '**/*.db.test.ts', 'supabase/**'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**', 'apps/*/src/**'],
      thresholds: {
        lines: COVERAGE_MIN,
        functions: COVERAGE_MIN,
        branches: COVERAGE_MIN,
        statements: COVERAGE_MIN,
      },
    },
  },
});
