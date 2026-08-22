import { expect, Page, test } from '@playwright/test';
import { ACTIONS, DATA_OBJECTS } from './fixture';

/**
 * The lineage panel of the config explorer (LineageTabWithSeparateView).
 * ReactFlow puts the graph node id on the DOM element as data-id, so the
 * rendered graph can be asserted on directly.
 */

const nodes = (page: Page) => page.locator('.react-flow__node');
const nodeIds = async (page: Page) =>
  (await nodes(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-id')))).sort();

// the toolbar dropdowns render an icon only, so they have no accessible name
const graphViewMenu = (page: Page) => page.locator('.react-flow .MuiMenuButton-root').nth(1);
const groupingMenu = (page: Page) => page.locator('.react-flow .MuiMenuButton-root').nth(2);

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

  test('switching the graph view shows the data resp. action graph', async ({ page }) => {
    // switching the view can require navigating to another element, which must not happen while the
    // graph is rendering ("Cannot update a component while rendering a different one"), and must not
    // change the number of hooks the details tabs call ("change in the order of Hooks")
    const reactWarnings: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('Cannot update a component') || text.includes('order of Hooks')) reactWarnings.push(text);
    });

    await openLineage(page, '/#/config/dataObjects/int-airports');

    await graphViewMenu(page).click();
    await page.getByRole('menuitem').nth(1).click(); // data graph
    await expect.poll(() => nodeIds(page)).toEqual(['btl-departures-arrivals-airports', 'int-airports', 'stg-airports']);

    // switching to the action view while a data object is selected navigates to a neighbour action
    await graphViewMenu(page).click();
    await page.getByRole('menuitem').nth(2).click(); // action graph
    await expect.poll(() => page.url()).toContain('/config/actions/');
    await expect(nodes(page).first()).toBeVisible();

    // and back, which navigates to a neighbour data object
    await graphViewMenu(page).click();
    await page.getByRole('menuitem').nth(1).click();
    await expect.poll(() => page.url()).toContain('/config/dataObjects/');
    await expect(nodes(page).first()).toBeVisible();

    expect(reactWarnings).toEqual([]);
  });

  test('the expand handle of a node adds and removes its neighbours', async ({ page }) => {
    await openLineage(page, '/#/config/dataObjects/int-airports');

    const expandForward = page.locator('.react-flow__node[data-id="join-departures-airports"] .react-flow__handle-bottom button');
    await expandForward.click();
    await expect.poll(() => nodeIds(page)).toContain('btl-departures-arrivals-airports');

    await expandForward.click();
    await expect.poll(() => nodeIds(page)).not.toContain('btl-departures-arrivals-airports');
  });

  test('grouping by feed replaces the nodes by their group, reset restores them', async ({ page }) => {
    await openLineage(page, '/#/config/actions/join-departures-airports');

    // group by feed is only enabled in the action view
    await graphViewMenu(page).click();
    await page.getByRole('menuitem').nth(2).click();
    await expect(nodes(page).first()).toBeVisible();
    const ungrouped = await nodeIds(page);

    await groupingMenu(page).click();
    await page.locator('.byFeed').click();
    await expect.poll(() => nodeIds(page)).not.toEqual(ungrouped);

    await groupingMenu(page).click();
    await page.getByRole('menuitem').last().click(); // reset grouping
    await expect.poll(() => nodeIds(page)).toEqual(ungrouped);
  });

  test('the attribute filter and the viewport buttons keep the graph intact', async ({ page }) => {
    await openLineage(page, '/#/config/dataObjects/int-airports');
    const before = await nodeIds(page);

    await page.getByRole('button', { name: 'Recompute layout' }).click();
    await page.getByRole('button', { name: 'Show all' }).click();
    await page.getByRole('button', { name: 'Focus on central node' }).click();
    expect(await nodeIds(page)).toEqual(before);

    await page.locator('.attribute-selection-dropdown-parent').click();
    await page.locator('.attribute-selection-dropdown li').first().click();
    await page.keyboard.press('Escape');
    expect(await nodeIds(page)).toEqual(before);
  });

  test('the toolbar settings survive closing and reopening the panel', async ({ page }) => {
    await openLineage(page, '/#/config/dataObjects/int-airports');

    await page.getByRole('button', { name: 'switch to horizontal layout' }).click();
    await page.getByRole('button', { name: 'Expand graph' }).click();
    const expanded = await nodeIds(page);

    await page.getByRole('button', { name: 'Close lineage' }).click();
    await expect(nodes(page)).toHaveCount(0);
    await page.getByRole('button', { name: 'Open lineage' }).click();
    await expect(nodes(page).first()).toBeVisible();

    await expect(page.getByRole('button', { name: 'switch to vertical layout' })).toBeVisible();
    expect(await nodeIds(page)).toEqual(expanded);
  });

  test('navigating to another element re-centers the graph', async ({ page }) => {
    await openLineage(page, '/#/config/dataObjects/int-airports');

    await page.goto('/#/config/dataObjects/btl-distances');
    await expect.poll(() => nodeIds(page)).toEqual(['btl-distances', 'compute-distances']);
  });
});

/**
 * The lineage of everything a configuration table lists (ElementTable), which is shown as a whole:
 * no center node, no expansion and no graph view to switch.
 */
test.describe('lineage of the listed elements', () => {
  const openTableLineage = async (page: Page, url: string) => {
    await page.goto(url);
    await page.getByRole('button', { name: 'Show lineage of the listed elements' }).click();
    await expect(nodes(page).first()).toBeVisible();
  };

  test('shows every data object of the data objects table', async ({ page }) => {
    await openTableLineage(page, '/#/config/dataObjects');

    expect(await nodeIds(page)).toEqual([...DATA_OBJECTS].sort());
    // the whole graph is shown, so there is nothing to expand, center or switch the view of.
    // The expand handles hold their icon only where they can act (the button itself always renders)
    await expect(nodes(page).locator('.react-flow__handle svg')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Expand graph' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Focus on central node' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Show graph view options' })).toHaveCount(0);
    // but it is a panel of the config explorer, so it can be closed
    await page.getByRole('button', { name: 'Close lineage' }).click();
    await expect(nodes(page)).toHaveCount(0);
  });

  test('shows every action of the actions table', async ({ page }) => {
    await openTableLineage(page, '/#/config/actions');

    expect(await nodeIds(page)).toEqual([...ACTIONS].sort());
  });

  test('switching the tab switches between the data and the action graph', async ({ page }) => {
    await openTableLineage(page, '/#/config/dataObjects');

    await page.getByRole('tab', { name: 'Actions' }).click();
    await expect.poll(() => nodeIds(page)).toEqual([...ACTIONS].sort());

    await page.getByRole('tab', { name: 'Data Objects' }).click();
    await expect.poll(() => nodeIds(page)).toEqual([...DATA_OBJECTS].sort());
  });

  test('the graph follows the filter of the element list', async ({ page }) => {
    await openTableLineage(page, '/#/config/dataObjects');

    await page.getByPlaceholder('Search element').fill('airports');

    await expect.poll(() => nodeIds(page)).toEqual([
      'btl-departures-arrivals-airports',
      'ext-airports',
      'int-airports',
      'stg-airports',
    ]);
  });

  test('an empty table shows an empty graph', async ({ page }) => {
    await openTableLineage(page, '/#/config/dataObjects');

    // no data object matches, so the tab is empty (and disabled) while there are still actions
    await page.getByPlaceholder('Search element').fill('download');
    await expect(nodes(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Show lineage of the listed elements' })).toHaveCount(0);

    // nothing matches at all
    await page.getByPlaceholder('Search element').fill('no-such-element');
    await expect(nodes(page)).toHaveCount(0);

    // and the graph comes back when the filter is cleared
    await page.getByPlaceholder('Search element').fill('');
    await expect.poll(() => nodeIds(page)).toEqual([...DATA_OBJECTS].sort());
  });

  test('the connections tab shows an empty graph, it has no lineage', async ({ page }) => {
    await openTableLineage(page, '/#/config/dataObjects');

    await page.goto('/#/config/connections');

    await expect(nodes(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Show lineage of the listed elements' })).toHaveCount(0);
  });

  test('clicking a node navigates to that element and re-centers the graph', async ({ page }) => {
    await openTableLineage(page, '/#/config/dataObjects');

    await nodes(page).filter({ has: page.getByText('btl-distances', { exact: true }) }).first()
      .getByText('btl-distances', { exact: true }).click();

    await expect.poll(() => page.url()).toContain('/config/dataObjects/btl-distances');
    await expect.poll(() => nodeIds(page)).toEqual(['btl-distances', 'compute-distances']);
  });
});
