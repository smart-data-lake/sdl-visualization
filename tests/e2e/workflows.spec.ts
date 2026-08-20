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

  test('the run graph toolbar leaves out the config graph options', async ({ page }) => {
    await page.goto(`/#/workflows/${WORKFLOW}/24.1/graph`);
    await expect(page.locator('.react-flow__node').first()).toBeVisible();

    // the whole graph of one attempt is shown, so there is nothing to expand, switch or close
    await expect(page.getByRole('button', { name: 'Expand graph' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Close lineage' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Focus on central node' })).toBeHidden();
    // the graph view selector and the grouping dropdown are the MenuButtons after the node search
    await expect(page.locator('.react-flow .MuiMenuButton-root')).toHaveCount(1);
    // what is left acts on the viewport only
    await expect(page.getByRole('button', { name: 'Show all' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Recompute layout' })).toBeVisible();
    await expect(page.getByRole('button', { name: /switch to (horizontal|vertical) layout/ })).toBeVisible();
  });

  test('clicking an action in the run graph opens its details', async ({ page }) => {
    await page.goto(`/#/workflows/${WORKFLOW}/24.1/graph`);

    await page.locator('.react-flow__node').filter({ hasText: ACTIONS[0] }).getByText(ACTIONS[0]).click();

    await expect(page).toHaveURL(new RegExp(`/workflows/${WORKFLOW}/24.1/graph/${ACTIONS[0]}$`));
    await expect(page.getByRole('heading', { name: `Metrics for ${ACTIONS[0]}` })).toBeVisible();
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

  // issue #115: refreshing remounts the page, which used to reset the filters to their default
  // while the menus still showed the selection
  test('the status filter stays applied when the data is refreshed', async ({ page }) => {
    await page.goto(`/#/workflows/${WORKFLOW}/24.1/table`);
    await expect(page.getByRole('row', { name: /^compute-distances / })).toBeVisible();

    // compute-distances and join-departures-airports were cancelled in attempt 24.1
    await page.getByRole('button', { name: 'Filter Status' }).click();
    await page.getByRole('menuitem').filter({ hasText: 'Cancelled' }).getByRole('checkbox').click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('row', { name: /^compute-distances / })).toBeHidden();

    await page.getByTestId('RefreshOutlinedIcon').click();

    await expect(page.getByRole('row', { name: /^download-airports / })).toBeVisible();
    await expect(page.getByRole('row', { name: /^compute-distances / })).toBeHidden();
    await expect(page.getByRole('row', { name: /^join-departures-airports / })).toBeHidden();
    // and the menu still shows what is applied
    await page.getByRole('button', { name: 'Filter Status' }).click();
    await expect(page.getByRole('menuitem').filter({ hasText: 'Cancelled' }).getByRole('checkbox')).not.toBeChecked();
    await expect(page.getByRole('menuitem').filter({ hasText: 'Succeeded' }).getByRole('checkbox')).toBeChecked();
  });
});
