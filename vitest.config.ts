import { defineConfig } from 'vitest/config';

const COVERAGE_MIN = 70;

export default defineConfig({
  test: {
    include: ['tooling/**/*.test.ts', 'packages/**/*.test.ts', 'apps/**/*.test.ts'],
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
