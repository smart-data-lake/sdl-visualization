import { expect, Page, test } from '@playwright/test';

/**
 * Column lineage in the data view (issue #141, see src/components/ConfigExplorer/LineageTab/README.md).
 *
 * getting-started exports no column lineage, so the documents these specs read are hand-written
 * fixtures after its actions: fixtures/shared/schema/*.lineage.*.
 */

const nodes = (page: Page) => page.locator('.react-flow__node');
const node = (page: Page, id: string) => page.locator(`.react-flow__node[data-id="${id}"]`);
const graphViewMenu = (page: Page) => page.locator('.react-flow .MuiMenuButton-root').nth(1);
const expandColumns = (page: Page, id: string) => page.getByTestId(`columns-expand-${id}`);
const collapseColumns = (page: Page, id: string) => page.getByTestId(`columns-collapse-${id}`);
const edge = (page: Page, id: string) => page.locator(`.react-flow__edge[data-testid="rf__edge-${id}"]`);
const lineageEdges = (page: Page) => page.locator('.react-flow__edge[data-testid$="::lineage"]');
// ReactFlow does not render a hidden edge at all - and a straight vertical path has no width, which
// Playwright would call invisible anyway - so an edge is counted rather than checked for visibility
const flowEdge = (page: Page, id: string) => edge(page, id);

async function openDataView(page: Page, id: string) {
  await page.goto(`/#/config/dataObjects/${id}`);
  await page.getByRole('button', { name: 'Open lineage' }).click();
  await expect(nodes(page).first()).toBeVisible();
  await graphViewMenu(page).click();
  await page.getByRole('menuitem').nth(1).click(); // data graph
  // the data view has no actions, so the node set shrinks to data objects
  await expect(nodes(page).filter({ has: page.locator('text=Action Object') })).toHaveCount(0);
}

test.describe('column lineage in the data view', () => {
  test('opening a data object draws its columns into the neighbours, and closing takes them back', async ({ page }) => {
    await openDataView(page, 'int-airports');
    await expect(lineageEdges(page)).toHaveCount(0);

    // the key columns: ident, which historize-airports takes over from stg-airports
    await expandColumns(page, 'int-airports').click();
    await expect(edge(page, 'stg-airports.ident->int-airports.ident::lineage')).toHaveCount(1);
    // the data flow edge made way for it
    await expect(flowEdge(page, 'stg-airports->historize-airports->int-airports')).toHaveCount(0);
    // none of what btl-departures-arrivals-airports reads from int-airports is a key column
    await expect(edge(page, 'int-airports.name->btl-departures-arrivals-airports.arr_name::lineage')).toHaveCount(0);

    // all columns: the export failed, so what the lineage names is what the node has
    await expandColumns(page, 'int-airports').click();
    await expect(node(page, 'int-airports').getByTestId('column-dl_ts_captured')).toBeVisible();
    for (const target of ['arr_name', 'dep_name']) {
      await expect(edge(page, `int-airports.name->btl-departures-arrivals-airports.${target}::lineage`)).toHaveCount(1);
    }
    await expect(lineageEdges(page)).toHaveCount(4 + 6);

    await collapseColumns(page, 'int-airports').click();
    await collapseColumns(page, 'int-airports').click();
    await expect(lineageEdges(page)).toHaveCount(0);
    await expect(flowEdge(page, 'stg-airports->historize-airports->int-airports')).toHaveCount(1);
  });

  test('a column edge names the columns and how the one is made from the other', async ({ page }) => {
    await openDataView(page, 'int-departures');
    await expandColumns(page, 'int-departures').click();
    await expandColumns(page, 'int-departures').click();

    const title = edge(page, 'ext-departures.firstseen->int-departures.dt::lineage').locator('title');
    await expect(title).toHaveText(
      "ext-departures.firstSeen → int-departures.dt\ndownload-deduplicate-departures: date_format(from_unixtime(firstseen), 'yyyyMMdd')",
      { useInnerText: false },
    );
    await expect(edge(page, 'ext-departures.icao24->int-departures.icao24::lineage').locator('title'))
      .toContainText('download-deduplicate-departures: unchanged');
  });

  test('every column edge ends on a column row or on its node', async ({ page }) => {
    await openDataView(page, 'int-airports');
    await expandColumns(page, 'int-airports').click();
    await expandColumns(page, 'int-airports').click();
    await expect(lineageEdges(page).first()).toBeVisible();

    // ReactFlow drops an edge whose handle is missing, which would leave fewer than expected
    const handles = await lineageEdges(page).evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')));
    expect(handles).toHaveLength(10);
    const ident = node(page, 'int-airports').getByTestId('column-ident');
    const identBox = (await ident.boundingBox())!;
    const path = edge(page, 'stg-airports.ident->int-airports.ident::lineage').locator('path.react-flow__edge-path');
    const d = (await path.getAttribute('d'))!;
    // the edge ends at the left border of the ident row, at its height
    const end = d.trim().split(/[ ,LMQC]+/).filter(Boolean).map(Number).slice(-2);
    const viewport = await page.locator('.react-flow__viewport').evaluate((el) => getComputedStyle(el).transform);
    const [a, , , dd, tx, ty] = viewport.match(/matrix\((.*)\)/)![1].split(',').map(Number);
    const pane = (await page.locator('.react-flow').boundingBox())!;
    const screenY = pane.y + ty + end[1] * dd;
    const screenX = pane.x + tx + end[0] * a;
    expect(Math.abs(screenY - (identBox.y + identBox.height / 2))).toBeLessThan(3);
    expect(screenX).toBeLessThan(identBox.x);
  });

  test('a row tooltip tells how the column is created', async ({ page }) => {
    await openDataView(page, 'int-airports');
    await expandColumns(page, 'int-airports').click();
    await expandColumns(page, 'int-airports').click();
    await node(page, 'int-airports').getByTestId('column-dl_ts_captured').locator('.lineage-column-name').hover();
    await expect(page.getByRole('tooltip')).toContainText('historize-airports: current_timestamp()');
  });
});
