import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

/**
 * Live updates against the backend's sse driver: an open run view follows what SDLB uploads,
 * without a click on refresh. Uploads a workflow of its own, so no other spec sees its runs.
 */

const API = 'http://localhost:7071/api/v1';
const SCOPE = { tenant: 'PrivateTenant', repo: 'getting-started', env: 'dev' };
const WORKFLOW = 'live-updates-e2e';
const ACTION = 'download-airports';

function stateFile(runId: number) {
  const file = new URL('./fixtures/shared/state/succeeded/getting-started.75.1.json', import.meta.url);
  const state = JSON.parse(readFileSync(file, 'utf8'));
  state.appConfig.applicationName = WORKFLOW;
  state.runId = runId;
  state.attemptId = 1;
  state.isFinal = false;
  const action = state.actionsState[ACTION];
  action.state = 'RUNNING';
  delete action.endTstmp;
  return state;
}

test('an open run view follows the action states SDLB uploads', async ({ page, request }) => {
  // unique per test run, since a reused backend keeps what earlier runs uploaded
  const runId = 1_000 + (Date.now() % 1_000_000);
  const upload = await request.post(`${API}/state?${new URLSearchParams(SCOPE)}`, { data: stateFile(runId) });
  expect(upload.ok(), await upload.text()).toBe(true);

  const listening = page.waitForRequest(/\/live\/events\?/);
  await page.goto(`/#/workflows/${WORKFLOW}/${runId}.1/table`);
  const row = page.getByRole('row', { name: new RegExp(`^${ACTION} `) });
  await expect(row.getByTestId('RunCircleOutlinedIcon')).toBeVisible();
  await listening;
  // the refresh button shows the connection: green while the workflow runs
  const refresh = page.locator('button[data-live]');
  await expect(refresh).toHaveAttribute('data-live', 'running');

  const query = new URLSearchParams({ ...SCOPE, application: WORKFLOW, runId: String(runId), attemptId: '1', actionId: ACTION });
  // retried, as the event stream may still be opening when the request is seen
  await expect(async () => {
    const patch = await request.patch(`${API}/state?${query}`, { data: { state: 'SUCCEEDED', endTstmp: '2025-07-21T05:24:10.498Z' } });
    expect(patch.ok()).toBe(true);
    await expect(row.getByTestId('CheckCircleOutlineIcon')).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 15_000 });

  // SDLB posts the whole state once more at the end, now final: the dot turns grey
  const final = stateFile(runId);
  final.isFinal = true;
  final.actionsState[ACTION].state = 'SUCCEEDED';
  const finish = await request.post(`${API}/state?${new URLSearchParams(SCOPE)}`, { data: final });
  expect(finish.ok(), await finish.text()).toBe(true);
  await expect(refresh).toHaveAttribute('data-live', 'finished');

  // and it still refreshes on a click
  const refetch = page.waitForRequest(new RegExp(`/state\\?.*runId=${runId}`));
  await refresh.click();
  await refetch;
});
