import { expect, test } from '@playwright/test';
import { ACTIONS, WORKFLOW } from './fixture';

test.describe('workflows explorer', () => {
  test('lists the workflows of the state index', async ({ page }) => {
    await page.goto('/#/workflows');

    const row = page.getByRole('row', { name: new RegExp(WORKFLOW) });
    await expect(row).toBeVisible();
    // 5 attempts over 4 runs (24 was attempted twice), 5 actions
    await expect(row.getByRole('cell', { name: '4', exact: true })).toBeVisible();
    await expect(row.getByRole('cell', { name: '5', exact: true }).first()).toBeVisible();
  });

  test('shows the run history of a workflow', async ({ page }) => {
    await page.goto('/#/workflows');
    await page.getByRole('cell', { name: WORKFLOW }).click();

    await expect(page.getByRole('heading', { name: WORKFLOW })).toBeVisible();
    await expect(page.getByText('5 attempts displayed')).toBeVisible();
    // run 24 was attempted twice
    await expect(page.getByRole('row', { name: /^24 1 / })).toBeVisible();
    await expect(page.getByRole('row', { name: /^24 2 / })).toBeVisible();
  });

  test('opens the timeline of a run attempt', async ({ page }) => {
    await page.goto(`/#/workflows/${WORKFLOW}/24.1`);

    await expect(page.getByRole('heading', { name: `${WORKFLOW}: run 24 attempt 1` })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Timeline' })).toHaveAttribute('aria-selected', 'true');
    for (const action of ACTIONS) {
      await expect(page.getByRole('link', { name: new RegExp(`^${action} `) }).first()).toBeVisible();
    }
  });

  test('shows action execution details in the table view', async ({ page }) => {
    await page.goto(`/#/workflows/${WORKFLOW}/24.1/table`);

    const row = page.getByRole('row', { name: /^download-airports / });
    await expect(row).toBeVisible();
    // state file timestamps are UTC, and the browser timezone is pinned to UTC
    await expect(row).toContainText('17.03.2024 22:12:29');
    await expect(row).toContainText('0.2s');
    // action name links back into the config explorer
    await expect(row.getByRole('link', { name: 'download-airports' })).toHaveAttribute(
      'href',
      '#/config/actions/download-airports',
    );
  });

  test('shows the action graph of a run attempt', async ({ page }) => {
    await page.goto(`/#/workflows/${WORKFLOW}/24.1/graph`);

    const nodes = page.locator('.react-flow__node');
    await expect(nodes).toHaveCount(ACTIONS.length);
    const ids = await nodes.evaluateAll((els) => els.map((e) => e.getAttribute('data-id')));
    expect(ids.sort()).toEqual([...ACTIONS].sort());
  });

  test('navigates between the attempts of a run', async ({ page }) => {
    await page.goto(`/#/workflows/${WORKFLOW}/24.1`);

    await page.locator('button:has([data-testid="KeyboardArrowRightIcon"])').click();

    await expect(page.getByRole('heading', { name: `${WORKFLOW}: run 24 attempt 2` })).toBeVisible();
  });

  test('filters actions by name', async ({ page }) => {
    await page.goto(`/#/workflows/${WORKFLOW}/24.1/table`);

    await page.getByPlaceholder('Search by action name').fill('distances');

    await expect(page.getByRole('row', { name: /^compute-distances / })).toBeVisible();
    await expect(page.getByRole('row', { name: /^download-airports / })).toBeHidden();
  });
});
