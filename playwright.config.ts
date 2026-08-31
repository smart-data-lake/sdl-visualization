import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests against the app running on the getting-started fixtures
 * (see tests/e2e/fixtures). One dev server per fixture variant is started,
 * because the config source is decided by what the server offers:
 *   port 3000 - config parsed from HOCON files
 *   port 3001 - config read from exportedConfig.json
 *   port 3002 - everything from the Azure backend on port 7071, which is
 *               started alongside with a throwaway Azurite and the same
 *               fixtures pushed through its upload API
 *
 * The azure project runs the same specs as the hocon one, unchanged. That is the
 * point of it: if the app cannot tell the two backends apart, the backend
 * implements the contract.
 *
 * Running all three projects at once puts three dev servers, a backend and a
 * storage emulator on one machine, and the ReactFlow specs are timing sensitive
 * enough to notice. If the azure project flakes locally, run it on its own
 * (`npx playwright test --project=azure`) before believing it.
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
    {
      name: 'azure',
      testIgnore: '**/exported-config.spec.ts',
      use: { baseURL: 'http://localhost:3002' },
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
    {
      // The backend on its local store, with the fixtures seeded, in one process.
      command: 'yarn --cwd backend serve:e2e',
      url: 'http://localhost:7071/health',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      command: `${viteCmd} --port 3002`,
      url: 'http://localhost:3002',
      env: { E2E_FIXTURE: 'azure' },
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
