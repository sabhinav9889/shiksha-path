import { defineConfig } from 'vitest/config';

const DB_TEST_TIMEOUT_MS = 30_000;

/** Tests that need the local Supabase stack (`npm run db:start`), run one file at a time. */
export default defineConfig({
  test: {
    include: ['**/*.db.test.ts', 'supabase/tests/**/*.test.ts'],
    exclude: ['**/node_modules/**'],
    testTimeout: DB_TEST_TIMEOUT_MS,
    hookTimeout: DB_TEST_TIMEOUT_MS,
    fileParallelism: false,
    passWithNoTests: true, // until the first database test exists
  },
});
