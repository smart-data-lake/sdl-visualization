import { expect, Page, test } from '@playwright/test';

/**
 * The lineage panel of the config explorer (LineageTabWithSeparateView).
 * ReactFlow puts the graph node id on the DOM element as data-id, so the
 * rendered graph can be asserted on directly.
 */

const nodes = (page: Page) => page.locator('.react-flow__node');
const nodeIds = async (page: Page) =>
  (await nodes(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-id')))).sort();

async function openLineage(page: Page, url: string) {
  await page.goto(url);
  await page.getByRole('button', { name: 'Open lineage' }).click();
  await expect(nodes(page).first()).toBeVisible();
}

test.describe('lineage graph', () => {
  test('shows the direct neighbours of a data object', async ({ page }) => {
    await openLineage(page, '/#/config/dataObjects/int-airports');

    expect(await nodeIds(page)).toEqual(['historize-airports', 'int-airports', 'join-departures-airports']);
  });

  test('shows the direct neighbours of an action', async ({ page }) => {
    await openLineage(page, '/#/config/actions/join-departures-airports');

    expect(await nodeIds(page)).toEqual([
      'btl-departures-arrivals-airports',
      'int-airports',
      'int-departures',
      'join-departures-airports',
    ]);
  });

  test('expanding the graph shows the full lineage of the element', async ({ page }) => {
    await openLineage(page, '/#/config/dataObjects/int-airports');

    await page.getByRole('button', { name: 'Expand graph' }).click();

    expect(await nodeIds(page)).toEqual([
      'btl-departures-arrivals-airports',
      'btl-distances',
      'compute-distances',
      'download-airports',
      'ext-airports',
      'historize-airports',
      'int-airports',
      'join-departures-airports',
      'stg-airports',
    ]);
  });

  test('switching the layout relayouts the nodes', async ({ page }) => {
    await openLineage(page, '/#/config/dataObjects/int-airports');
    const central = nodes(page).filter({ has: page.getByText('int-airports', { exact: true }) }).first();
    const before = await central.getAttribute('style');

    await page.getByRole('button', { name: 'switch to horizontal layout' }).click();

    await expect(page.getByRole('button', { name: 'switch to vertical layout' })).toBeVisible();
    await expect.poll(() => central.getAttribute('style')).not.toBe(before);
  });

  test('closing the lineage hides the panel', async ({ page }) => {
    await openLineage(page, '/#/config/dataObjects/int-airports');

    await page.getByRole('button', { name: 'Close lineage' }).click();

    await expect(nodes(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Open lineage' })).toBeVisible();
  });

  test('edges connect the action to its input and output', async ({ page }) => {
    await openLineage(page, '/#/config/dataObjects/int-airports');

    await expect(page.getByRole('button', { name: 'Edge from historize-airports to int-airports' })).toBeAttached();
    await expect(page.getByRole('button', { name: 'Edge from int-airports to join-departures-airports' })).toBeAttached();
  });
});
