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

  test('a column edge names how the one column is made from the other', async ({ page }) => {
    await openDataView(page, 'int-departures');
    await expandColumns(page, 'int-departures').click();
    await expandColumns(page, 'int-departures').click();

    const title = edge(page, 'ext-departures.firstseen->int-departures.dt::lineage').locator('title');
    await expect(title).toHaveText(
      "download-deduplicate-departures: date_format(from_unixtime(firstseen), 'yyyyMMdd')",
      { useInnerText: false },
    );
    await expect(edge(page, 'ext-departures.icao24->int-departures.icao24::lineage').locator('title'))
      .toContainText('download-deduplicate-departures: unchanged');
  });

  test('an edge can be hit beside its visible line', async ({ page }) => {
    await openDataView(page, 'int-departures');
    const hitWidth = (id: string) => edge(page, id).locator('path.react-flow__edge-path-selector')
      .evaluate((el) => getComputedStyle(el).strokeWidth);
    await expect.poll(() => hitWidth('ext-departures->download-deduplicate-departures->int-departures')).toBe('12px');

    await expandColumns(page, 'int-departures').click();
    await expandColumns(page, 'int-departures').click();
    await expect.poll(() => hitWidth('ext-departures.icao24->int-departures.icao24::lineage')).toBe('8px');
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

  test('a row tooltip says when a column is unresolved in the column lineage', async ({ page }) => {
    await openDataView(page, 'int-departures');
    await expandColumns(page, 'int-departures').click();
    await expandColumns(page, 'int-departures').click();
    await node(page, 'int-departures').getByTestId('column-created_at').locator('.lineage-column-name').hover();
    await expect(page.getByRole('tooltip')).toContainText('unresolved in the column lineage of download-deduplicate-departures');
  });

  test('a row tooltip offers the trace', async ({ page }) => {
    await openDataView(page, 'int-airports');
    await expandColumns(page, 'int-airports').click();
    await expandColumns(page, 'int-airports').click();
    await node(page, 'int-airports').getByTestId('column-name').locator('.lineage-column-name').hover();
    await expect(page.getByRole('tooltip')).toHaveText('trace column');
  });
});

test.describe('tracing a column', () => {
  const traceButton = (page: Page, nodeId: string, column: string) =>
    node(page, nodeId).getByTestId(`column-${column}`).getByTestId(`trace-${column}`);
  const row = (page: Page, nodeId: string, column: string) => node(page, nodeId).getByTestId(`column-${column}`);
  const panel = (page: Page) => page.getByTestId('column-trace-panel');
  const isHighlighted = (page: Page, id: string) =>
    edge(page, id).locator('path.react-flow__edge-path').evaluate((el) => (el as SVGPathElement).style.stroke);

  test('highlights what a column depends on and what depends on it, and nothing else', async ({ page }) => {
    await openDataView(page, 'int-airports');
    await expandColumns(page, 'int-airports').click();
    await expandColumns(page, 'int-airports').click();

    await traceButton(page, 'int-airports', 'name').click();

    // stg-airports.name upstream; arr_name and dep_name downstream, each once more in btl-distances
    await expect(page.getByTestId('column-trace-starts')).toHaveText(/^Start columns\s*stg-airports\.name$/);
    await expect(page.getByTestId('column-trace-ends')).toContainText('btl-distances.');
    await expect(page.getByTestId('column-trace-show')).toHaveText('Show all');
    await expect(row(page, 'int-airports', 'name')).toHaveClass(/lineage-column-trace-start/);
    await expect(row(page, 'int-airports', 'ident')).not.toHaveClass(/lineage-column-traced/);

    await expect.poll(() => isHighlighted(page, 'stg-airports.name->int-airports.name::lineage')).toBe('rgb(9, 107, 222)');
    await expect.poll(() => isHighlighted(page, 'int-airports.name->btl-departures-arrivals-airports.dep_name::lineage')).toBe('rgb(9, 107, 222)');
    expect(await isHighlighted(page, 'stg-airports.ident->int-airports.ident::lineage')).not.toBe('rgb(9, 107, 222)');

    // btl-distances is on the trace but not in the graph
    await page.getByTestId('column-trace-show').click();
    await expect(node(page, 'btl-distances')).toBeVisible();
    await expect(page.getByTestId('column-trace-show')).toHaveCount(0);
    await expect.poll(() => isHighlighted(page, 'btl-departures-arrivals-airports->compute-distances->btl-distances')).toBe('rgb(9, 107, 222)');

    // clicking the pane ends it
    // at its right border, clear of the toolbar, the controls and the nodes
    const pane = (await page.locator('.react-flow__pane').boundingBox())!;
    await page.locator('.react-flow__pane').click({ position: { x: pane.width - 5, y: pane.height / 2 } });
    await expect(panel(page)).toHaveCount(0);
    await expect(row(page, 'int-airports', 'name')).not.toHaveClass(/lineage-column-traced/);
  });

  test('in the full view, only the edges of the actions the column passes through', async ({ page }) => {
    await page.goto('/#/config/dataObjects/int-departures');
    await page.getByRole('button', { name: 'Open lineage' }).click();
    await expect(node(page, 'int-departures')).toBeVisible();
    await expandColumns(page, 'int-departures').click();
    await expandColumns(page, 'int-departures').click();

    await traceButton(page, 'int-departures', 'dt').click();
    await expect(page.getByTestId('column-trace-starts')).toHaveText(/^Start columns\s*ext-departures\.firstSeen$/);
    await expect(page.getByTestId('column-trace-ends')).toContainText('int-departures.dt');
    // dt comes from ext-departures through download-deduplicate-departures, and nothing reads it. The
    // open data object shows its columns, so the actions' edges run per column to their ports
    await expect.poll(() => isHighlighted(page, 'download-deduplicate-departures->int-departures.dt::port')).toBe('rgb(9, 107, 222)');
    expect(await isHighlighted(page, 'download-deduplicate-departures->int-departures.icao24::port')).not.toBe('rgb(9, 107, 222)');
    expect(await isHighlighted(page, 'int-departures.estdepartureairport->join-departures-airports::port')).not.toBe('rgb(9, 107, 222)');

    // tracing it again stops it
    await traceButton(page, 'int-departures', 'dt').click();
    await expect(panel(page)).toHaveCount(0);
  });
});

test.describe('the ports of an action in the full view', () => {
  const port = (page: Page, side: 'input' | 'output', key: string) =>
    node(page, 'join-departures-airports').getByTestId(`port-${side}-${key}`);
  const connection = (page: Page, from: string, to: string) =>
    node(page, 'join-departures-airports').getByTestId(`connection-${from}>${to}`);

  async function openAction(page: Page) {
    await page.goto('/#/config/actions/join-departures-airports');
    await page.getByRole('button', { name: 'Open lineage' }).click();
    await expect(node(page, 'join-departures-airports')).toBeVisible();
    await expandColumns(page, 'join-departures-airports').click();
  }

  test('an action opens on the columns it reads and writes, and the connections between them', async ({ page }) => {
    await openAction(page);
    await expect(port(page, 'input', 'int-airports.name')).toBeVisible();
    await expect(port(page, 'output', 'btl-departures-arrivals-airports.dep_longitude_deg')).toBeVisible();
    // one input feeds two outputs
    await expect(connection(page, 'int-airports.name', 'btl-departures-arrivals-airports.arr_name')).toHaveCount(1);
    await expect(connection(page, 'int-airports.name', 'btl-departures-arrivals-airports.dep_name')).toHaveCount(1);
    await expect(connection(page, 'int-departures.estdepartureairport', 'btl-departures-arrivals-airports.estdepartureairport')
      .locator('title')).toHaveText(
      'unchanged', { useInnerText: false });
    // a port edge names the two nodes it runs between, the port names the column
    await expect(edge(page, 'int-airports.name->join-departures-airports::port').locator('title'))
      .toHaveText('int-airports → join-departures-airports', { useInnerText: false });

    // every port is connected to its data object, which is closed, so the edge ends on the node
    await expect(edge(page, 'int-airports.name->join-departures-airports::port')).toHaveCount(1);
    await expect(edge(page, 'join-departures-airports->btl-departures-arrivals-airports.arr_name::port')).toHaveCount(1);
    await expect(edge(page, 'join-departures-airports_from_int-airports')).toHaveCount(0);

    await collapseColumns(page, 'join-departures-airports').click();
    await expect(page.locator('.react-flow__edge[data-testid$="::port"]')).toHaveCount(0);
    await expect(edge(page, 'join-departures-airports_from_int-airports')).toHaveCount(1);
  });

  test('a column trace runs through the ports it passes', async ({ page }) => {
    await openAction(page);
    await expandColumns(page, 'int-airports').click();
    await expandColumns(page, 'int-airports').click();
    await node(page, 'int-airports').getByTestId('trace-name').click();

    await expect(connection(page, 'int-airports.name', 'btl-departures-arrivals-airports.dep_name'))
      .toHaveClass(/lineage-port-connection-traced/);
    await expect(connection(page, 'int-airports.latitude_deg', 'btl-departures-arrivals-airports.dep_latitude_deg'))
      .not.toHaveClass(/lineage-port-connection-traced/);
    await expect(port(page, 'output', 'btl-departures-arrivals-airports.arr_name')).toHaveClass(/lineage-column-traced/);
    await expect.poll(() => edge(page, 'int-airports.name->join-departures-airports::port').locator('path.react-flow__edge-path')
      .evaluate((el) => (el as SVGPathElement).style.stroke)).toBe('rgb(9, 107, 222)');
  });
});

test.describe('rebuilding the graph', () => {
  test('an opened node stays open when the graph view changes', async ({ page }) => {
    await page.goto('/#/config/dataObjects/int-departures');
    await page.getByRole('button', { name: 'Open lineage' }).click();
    await expandColumns(page, 'int-departures').click();
    const keyColumns = await node(page, 'int-departures').locator('.lineage-column-row').count();
    expect(keyColumns).toBeGreaterThan(0);
    await expandColumns(page, 'join-departures-airports').click();
    await expect(node(page, 'join-departures-airports').getByTestId('port-input-int-departures.estdepartureairport')).toBeVisible();

    // the data view has no actions; the data object keeps its key columns and its edges on them
    await graphViewMenu(page).click();
    await page.getByRole('menuitem').nth(1).click();
    await expect(node(page, 'join-departures-airports')).toHaveCount(0);
    await expect.poll(() => node(page, 'int-departures').locator('.lineage-column-row').count()).toBe(keyColumns);
    await expect(lineageEdges(page).first()).toBeAttached();

    // back in the full view, the action opens on its ports again
    await graphViewMenu(page).click();
    await page.getByRole('menuitem').nth(0).click();
    await expect(node(page, 'join-departures-airports').getByTestId('port-input-int-departures.estdepartureairport')).toBeVisible();
    await expect.poll(() => node(page, 'int-departures').locator('.lineage-column-row').count()).toBe(keyColumns);

    // closing is remembered too
    await collapseColumns(page, 'int-departures').click();
    await graphViewMenu(page).click();
    await page.getByRole('menuitem').nth(1).click();
    await expect(node(page, 'int-departures')).toBeVisible();
    await expect(node(page, 'int-departures').locator('.lineage-column-row')).toHaveCount(0);
  });

  test('a new layout keeps what the nodes know of their lineage', async ({ page }) => {
    await page.goto('/#/config/actions/compute-distances');
    await page.getByRole('button', { name: 'Open lineage' }).click();
    await expect(expandColumns(page, 'compute-distances')).toBeVisible();
    await expect(expandColumns(page, 'btl-distances')).toBeVisible();

    // the layout builds the node set anew, the nodes themselves stay mounted
    await page.locator('.react-flow [data-testid="AlignVerticalTopIcon"]').click();
    await expect(page.locator('.react-flow [data-testid="AlignHorizontalLeftIcon"]')).toBeVisible();
    await expect(expandColumns(page, 'compute-distances')).toBeVisible();
    await expect(expandColumns(page, 'btl-distances')).toBeVisible();

    await expandColumns(page, 'compute-distances').click();
    await expect(node(page, 'compute-distances').getByTestId('port-output-btl-distances.distance')).toBeVisible();
  });
});
