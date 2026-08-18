import { defineConfig } from 'vitest/config';

/**
 * Unit tests. The end-to-end tests in tests/e2e are Playwright specs and must
 * not be picked up here (vitest would otherwise match their *.spec.ts files).
 */
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
  },
});
