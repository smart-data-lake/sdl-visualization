import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests against the app running on the getting-started fixtures
 * (see tests/e2e/fixtures). Two dev servers are started, one per fixture
 * variant, because the config source is decided by what the server offers:
 *   port 3000 - config parsed from HOCON files
 *   port 3001 - config read from exportedConfig.json
 */

const viteCmd = 'yarn vite --config vite.config.e2e.ts';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list']],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    // timestamps are rendered in the browser's zone, pin it so assertions on
    // dates don't depend on where the tests run
    timezoneId: 'UTC',
    locale: 'en-GB',
    ...devices['Desktop Chrome'],
  },
  projects: [
    {
      name: 'hocon',
      testIgnore: '**/exported-config.spec.ts',
      use: { baseURL: 'http://localhost:3000' },
    },
    {
      name: 'exported',
      testMatch: '**/exported-config.spec.ts',
      use: { baseURL: 'http://localhost:3001' },
    },
  ],
  webServer: [
    {
      command: `${viteCmd} --port 3000`,
      url: 'http://localhost:3000',
      env: { E2E_FIXTURE: 'hocon' },
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      command: `${viteCmd} --port 3001`,
      url: 'http://localhost:3001',
      env: { E2E_FIXTURE: 'exported' },
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
