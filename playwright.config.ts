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
 * Locally the azure project only runs when asked for (E2E_AZURE=1, or
 * `yarn test:e2e:azure`): it repeats the hocon specs against the backend and
 * roughly doubles the run. CI always runs it.
 *
 * `yarn test:e2e` builds the app once and serves the build (E2E_PREVIEW=1), which
 * loads much faster than dev servers compiling on first request. A plain
 * `npx playwright test` uses dev servers, so it never tests a stale build.
 */

const preview = !!process.env.E2E_PREVIEW;
const azure = !!process.env.CI || !!process.env.E2E_AZURE;
const serverCmd = (port: number) => preview
  ? `yarn vite preview --config vite.config.e2e.ts --port ${port}`
  : `yarn vite --config vite.config.e2e.ts --port ${port}`;

/**
 * Specs that only make sense on the exported fixture: it is the one carrying a prebuilt
 * search index, so it is the only place the full search coverage can be asserted.
 */
const EXPORTED_ONLY = ['**/exported-config.spec.ts', '**/search-index.spec.ts'];

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
    // recording every test costs CPU the timing sensitive specs notice; locally a failure is rerun instead
    video: process.env.CI ? 'retain-on-failure' : 'off',
    // timestamps are rendered in the browser's zone, pin it so assertions on
    // dates don't depend on where the tests run
    timezoneId: 'UTC',
    locale: 'en-GB',
    ...devices['Desktop Chrome'],
  },
  projects: [
    {
      name: 'hocon',
      testIgnore: EXPORTED_ONLY,
      use: { baseURL: 'http://localhost:3000' },
    },
    {
      name: 'exported',
      testMatch: EXPORTED_ONLY,
      use: { baseURL: 'http://localhost:3001' },
    },
    ...(azure ? [{
      name: 'azure',
      testIgnore: EXPORTED_ONLY,
      use: { baseURL: 'http://localhost:3002' },
    }] : []),
  ],
  webServer: [
    {
      command: serverCmd(3000),
      url: 'http://localhost:3000',
      env: { E2E_FIXTURE: 'hocon' },
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      command: serverCmd(3001),
      url: 'http://localhost:3001',
      env: { E2E_FIXTURE: 'exported' },
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    ...(azure ? [{
      // The backend on its local store, with the fixtures seeded, in one process.
      command: 'yarn --cwd backend serve:e2e',
      url: 'http://localhost:7071/health',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    }, {
      command: serverCmd(3002),
      url: 'http://localhost:3002',
      env: { E2E_FIXTURE: 'azure' },
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    }] : []),
  ],
});
