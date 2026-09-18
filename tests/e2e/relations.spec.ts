import { expect, Page, test } from '@playwright/test';
import { RELATED_DATA_OBJECTS } from './fixture';

/**
 * Columns on a DataObject node, and the relations view built from the declared foreign keys
 * (see src/components/ConfigExplorer/LineageTab/README.md).
 *
 * The foreign keys these specs assert on are fixtures of ours, not part of the getting-started
 * project - hocon/config/relations.conf and fixtures/patch-relations.py put the same ones into
 * both config sources, so the hocon and azure projects see the same relations.
 */

const nodes = (page: Page) => page.locator('.react-flow__node');
const nodeIds = async (page: Page) =>
  (await nodes(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-id')))).sort();

// the toolbar dropdowns render an icon only, so they have no accessible name
const graphViewMenu = (page: Page) => page.locator('.react-flow .MuiMenuButton-root').nth(1);

// the control at the lower border of a data object node walks none -> keys -> all and back
const expandColumns = (page: Page, id: string) => page.getByTestId(`columns-expand-${id}`);
const collapseColumns = (page: Page, id: string) => page.getByTestId(`columns-collapse-${id}`);

const node = (page: Page, id: string) => page.locator(`.react-flow__node[data-id="${id}"]`);
const columnsOf = (page: Page, id: string) => node(page, id).locator('.lineage-column-row');
// ReactFlow identifies an edge by a test id rather than by data-id, unlike a node
const edgePath = (page: Page, id: string) =>
  page.locator(`.react-flow__edge[data-testid="rf__edge-${id}"] path.react-flow__edge-path`);
const nodeHeight = async (page: Page, id: string) => (await node(page, id).boundingBox())!.height;
const columnName = (page: Page, nodeId: string, column: string) =>
  node(page, nodeId).locator(`[data-testid="column-${column}"] .lineage-column-name`);

async function openLineage(page: Page, url: string) {
  await page.goto(url);
  await page.getByRole('button', { name: 'Open lineage' }).click();
  await expect(nodes(page).first()).toBeVisible();
}

async function openRelations(page: Page, url: string) {
  await openLineage(page, url);
  await graphViewMenu(page).click();
  await page.getByRole('menuitem').nth(3).click(); // relations
  await expect(nodes(page).first()).toBeVisible();
}

test.describe('columns of a data object', () => {
  test('a data object node shows its key columns, marking primary and foreign keys', async ({ page }) => {
    await openLineage(page, '/#/config/dataObjects/int-departures');

    // closed by default, and only the way to open it is offered
    await expect(columnsOf(page, 'int-departures')).toHaveCount(0);
    await expect(collapseColumns(page, 'int-departures')).toHaveCount(0);
    const collapsedHeight = await nodeHeight(page, 'int-departures');

    await expandColumns(page, 'int-departures').click();

    // the primary key, and the two columns the foreign keys run through. estDepartureAirport is
    // both, and is spelled as the exported schema spells it rather than as the config does
    await expect.poll(() =>
      columnsOf(page, 'int-departures').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')))
    ).toEqual(['column-icao24', 'column-estdepartureairport', 'column-estarrivalairport', 'column-dt']);

    const primaryKey = node(page, 'int-departures').locator('[data-testid="column-icao24"] .lineage-column-icon-pk');
    const foreignKey = node(page, 'int-departures').locator('[data-testid="column-estarrivalairport"] .lineage-column-icon-fk');
    await expect(primaryKey).toHaveCount(1);
    await expect(foreignKey).toHaveCount(1);
    // a column that is both is marked as both
    await expect(node(page, 'int-departures').locator('[data-testid="column-estdepartureairport"] .lineage-column-icon')).toHaveCount(2);

    // and the node grew to hold them (heights are in screen pixels, i.e. scaled by the zoom)
    await expect.poll(() => nodeHeight(page, 'int-departures')).toBeGreaterThan(collapsedHeight);
    // open on its keys, the control offers both directions
    await expect(collapseColumns(page, 'int-departures')).toBeVisible();
    await expect(expandColumns(page, 'int-departures')).toBeVisible();
  });

  test('a second click opens the node on all of its columns, and back again', async ({ page }) => {
    await openLineage(page, '/#/config/dataObjects/int-departures');
    await expandColumns(page, 'int-departures').click();
    const keyColumns = await columnsOf(page, 'int-departures').count();

    await expandColumns(page, 'int-departures').click();

    // every column of the exported schema, not only the four the keys name
    await expect.poll(() => columnsOf(page, 'int-departures').count()).toBeGreaterThan(keyColumns);
    await expect(node(page, 'int-departures').getByText('callsign')).toBeVisible();
    // fully open, only the way back is offered
    await expect(expandColumns(page, 'int-departures')).toHaveCount(0);

    // and the way back steps to the key columns rather than closing the node
    await collapseColumns(page, 'int-departures').click();
    await expect.poll(() => columnsOf(page, 'int-departures').count()).toBe(keyColumns);

    await collapseColumns(page, 'int-departures').click();
    await expect(columnsOf(page, 'int-departures')).toHaveCount(0);
  });

  test('a table whose columns are all key columns is not offered a further step', async ({ page }) => {
    await openLineage(page, '/#/config/dataObjects/int-airports');
    await expandColumns(page, 'int-airports').click();

    // int-airports has one column, its primary key, and no schema export to add anything to it
    await expect(columnsOf(page, 'int-airports')).toHaveCount(1);
    await expect(collapseColumns(page, 'int-airports')).toBeVisible();
    await expect(expandColumns(page, 'int-airports')).toHaveCount(0);
  });

  test('the graph expand handle stays clickable over the column control', async ({ page }) => {
    await openLineage(page, '/#/config/dataObjects/int-airports');
    await expandColumns(page, 'int-airports').click();
    await expect(columnsOf(page, 'int-airports')).toHaveCount(1);
    const before = await nodes(page).count();

    /*
        Both controls live on the lower border of the node: the column control spans it, the graph
        expand handle is anchored in its middle because that is where the edges attach. The handle
        is on top, and the column control's two halves stop short of the middle, so neither hides
        the other.
    */
    await node(page, 'int-airports').locator('.react-flow__handle-bottom button').click();

    await expect.poll(() => nodes(page).count()).not.toBe(before);
  });

  test('a data object with neither keys nor a schema export offers no column control', async ({ page }) => {
    // a web service data object: nothing declares its columns and the exporter never ran on it,
    // so a control here could only ever open on "no columns"
    await openLineage(page, '/#/config/dataObjects/ext-departures');
    await expect(node(page, 'ext-departures')).toBeVisible();

    await expect(expandColumns(page, 'ext-departures')).toHaveCount(0);
    await expect(collapseColumns(page, 'ext-departures')).toHaveCount(0);
  });

  test('the column font is the one the node sizes itself from', async ({ page }) => {
    /*
        A Joy Typography brings its own font-size through emotion, which is injected after the
        stylesheet and wins, so the size has to be passed to the component - see COLUMN_FONT_SIZE.
        The node declares its height from the row height before it renders, so a font that does not
        fit its line box would push the rows out of the box.
    */
    await openLineage(page, '/#/config/dataObjects/int-departures');
    await expandColumns(page, 'int-departures').click();
    await expect(columnsOf(page, 'int-departures')).not.toHaveCount(0);

    const fonts = await columnsOf(page, 'int-departures')
      .locator('.lineage-column-name')
      .evaluateAll((els) => els.map((el) => getComputedStyle(el).fontSize));
    expect(new Set(fonts)).toEqual(new Set(['14px']));
  });

  test('a foreign key pointing outside the configuration is marked as unresolved', async ({ page }) => {
    await openLineage(page, '/#/config/dataObjects/btl-departures-arrivals-airports');
    await expandColumns(page, 'btl-departures-arrivals-airports').click();

    const unresolved = node(page, 'btl-departures-arrivals-airports')
      .locator('[data-testid="column-callsign"] .lineage-column-icon-unresolved');
    await expect(unresolved).toHaveCount(1);
  });

  test('a column only says something when it has something to say', async ({ page }) => {
    await openLineage(page, '/#/config/dataObjects/int-departures');
    await expandColumns(page, 'int-departures').click();
    await expect(columnsOf(page, 'int-departures')).not.toHaveCount(0);

    // icao24 is a primary key and nothing else - the row already shows that, a tooltip would be empty
    await columnName(page, 'int-departures', 'icao24').hover();
    await page.waitForTimeout(600);
    await expect(page.locator('[role="tooltip"]')).toHaveCount(0);

    // a column that takes part in a relation names the other end of it
    await columnName(page, 'int-departures', 'estarrivalairport').hover();
    await expect(page.locator('[role="tooltip"]')).toContainText('int_airports.ident');
  });

  test('the name of a related column leads to the data object at the other end', async ({ page }) => {
    await openLineage(page, '/#/config/dataObjects/int-departures');
    await expandColumns(page, 'int-departures').click();
    await expect(columnsOf(page, 'int-departures')).not.toHaveCount(0);

    // a column that is only a primary key leads nowhere
    await expect(node(page, 'int-departures').locator('[data-testid="column-icao24"] .lineage-column-link'))
      .toHaveCount(0);

    await columnName(page, 'int-departures', 'estarrivalairport').click();

    await expect.poll(() => page.url()).toContain('/config/dataObjects/int-airports');
  });

  test('a column that several data objects relate to leads nowhere in particular', async ({ page }) => {
    await openLineage(page, '/#/config/dataObjects/int-airports');
    await expandColumns(page, 'int-airports').click();
    await expect(columnsOf(page, 'int-airports')).toHaveCount(1);

    /*
        int-airports.ident is referenced by int-departures and by btl-departures-arrivals-airports.
        There is no single other end to navigate to, and picking one of them would be a guess, so
        the name is not a link - the tooltip still names them all.
    */
    await expect(node(page, 'int-airports').locator('.lineage-column-link')).toHaveCount(0);
    await columnName(page, 'int-airports', 'ident').hover();
    await expect(page.locator('[role="tooltip"]')).toContainText('int-departures');
    await expect(page.locator('[role="tooltip"]')).toContainText('btl-departures-arrivals-airports');
  });

  test('the nodes of a run graph have no columns, there is no configuration behind them', async ({ page }) => {
    await page.goto('/#/workflows/getting-started/75.1/graph');
    await expect(nodes(page).first()).toBeVisible();

    await expect(page.locator('[data-testid^="columns-expand-"]')).toHaveCount(0);
  });
});

test.describe('relations graph', () => {
  test('shows the data objects the selected one is related to, and nothing else', async ({ page }) => {
    await openRelations(page, '/#/config/dataObjects/int-departures');

    // as in the lineage views, what is shown is the neighbourhood of the selected element.
    // btl-departures-arrivals-airports also references int-airports, but not int-departures
    expect(await nodeIds(page)).toEqual(['int-airports', 'int-departures']);
  });

  test('expanding the graph shows everything related to the selected data object', async ({ page }) => {
    await openRelations(page, '/#/config/dataObjects/int-airports');
    await page.getByRole('button', { name: 'Expand graph' }).click();

    // everything that reaches int-airports through foreign keys, in either direction
    await expect.poll(() => nodeIds(page)).toEqual(RELATED_DATA_OBJECTS);
  });

  test('switching to the relations view lays it out left to right', async ({ page }) => {
    await openLineage(page, '/#/config/dataObjects/int-departures');
    // the button names the layout it would switch to, so this one says we are top to bottom
    await expect(page.getByRole('button', { name: 'switch to horizontal layout' })).toBeVisible();

    await graphViewMenu(page).click();
    await page.getByRole('menuitem').nth(3).click();

    // an entity relation diagram is drawn left to right
    await expect(page.getByRole('button', { name: 'switch to vertical layout' })).toBeVisible();
  });

  test('an edge carries the name of the foreign key it stands for', async ({ page }) => {
    await openRelations(page, '/#/config/dataObjects/int-departures');

    /*
        The title has to be a child of the edge's own group, not of one of its paths: an edge is a
        wide invisible path that makes it easier to hit plus the visible line drawn on top of it,
        and a title on either of them would only show while the pointer is over that one - so
        hovering the line itself would say nothing.
    */
    const titles = await page.locator('.react-flow__edge').evaluateAll((els) =>
      els.map((el) => (el.firstElementChild?.tagName === 'title' ? el.firstElementChild.textContent : null)));
    expect(titles).toEqual(['fk_departure_airport', 'fk_arrival_airport']);
  });

  test('a data object on the referencing side names its foreign key on the edge too', async ({ page }) => {
    await openRelations(page, '/#/config/dataObjects/btl-departures-arrivals-airports');

    const titles = await page.locator('.react-flow__edge').evaluateAll((els) =>
      els.map((el) => (el.firstElementChild?.tagName === 'title' ? el.firstElementChild.textContent : null)));
    expect(titles).toEqual(['fk_arrival_airport']);
  });

  test('two foreign keys between the same pair are two edges', async ({ page }) => {
    await openRelations(page, '/#/config/dataObjects/int-departures');

    // while both ends are closed the two edges lie on the same two node handles and draw on top of
    // each other - one line between the data objects, which is what the closed view means
    await expect(edgePath(page, 'int-departures-fk:fk_departure_airport->int-airports::estdepartureairport->ident')).toHaveCount(1);
    await expect(edgePath(page, 'int-departures-fk:fk_arrival_airport->int-airports::estarrivalairport->ident')).toHaveCount(1);
  });

  test('an edge moves onto the columns when a node is expanded, and back when it is collapsed', async ({ page }) => {
    await openRelations(page, '/#/config/dataObjects/int-departures');

    const edgeId = 'int-departures-fk:fk_arrival_airport->int-airports::estarrivalairport->ident';
    const edge = edgePath(page, edgeId);
    await expect(edge).toHaveCount(1);
    const collapsed = await edge.getAttribute('d');

    await expandColumns(page, 'int-departures').click();
    // the edge now starts at a column instead of at the node, so its path is a different one -
    // and it is still attached, which is what breaks when a handle goes missing
    await expect.poll(() => edge.getAttribute('d')).not.toBe(collapsed);
    await expect(edge).toHaveCount(1);

    // the two ends are decided separately, so this one now runs from a column to a node
    const oneEndOpen = await edge.getAttribute('d');
    await expandColumns(page, 'int-airports').click();
    await expect.poll(() => edge.getAttribute('d')).not.toBe(oneEndOpen);
    await expect(edge).toHaveCount(1);

    await collapseColumns(page, 'int-departures').click();
    await collapseColumns(page, 'int-airports').click();
    await expect.poll(() => edge.getAttribute('d')).toBe(collapsed);
  });

  test('selecting an action navigates to a data object, the relations graph has no actions', async ({ page }) => {
    await openLineage(page, '/#/config/actions/join-departures-airports');

    await graphViewMenu(page).click();
    await page.getByRole('menuitem').nth(3).click();

    await expect.poll(() => page.url()).toContain('/config/dataObjects/');
    await expect(nodes(page).first()).toBeVisible();
  });

  test('switching back to the lineage view shows the actions again', async ({ page }) => {
    await openRelations(page, '/#/config/dataObjects/int-departures');
    expect(await nodeIds(page)).toEqual(['int-airports', 'int-departures']);

    await graphViewMenu(page).click();
    await page.getByRole('menuitem').nth(0).click(); // full graph

    // the direct neighbours of int-departures in the full graph: the action that writes it and
    // the action that reads it
    await expect.poll(() => nodeIds(page))
      .toEqual(['download-deduplicate-departures', 'int-departures', 'join-departures-airports']);
  });
});
