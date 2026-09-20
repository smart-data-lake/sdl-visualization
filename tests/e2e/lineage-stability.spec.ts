import { expect, Page, test } from '@playwright/test';

/**
 * The lineage graph keeps its arrangement: selecting a node grows the graph around it instead of
 * rebuilding it, the node the user acts on never moves, and nothing ever changes its order within a
 * rank. See the "Layout stability" section of src/components/ConfigExplorer/LineageTab/README.md.
 *
 * ReactFlow writes a node's graph coordinates into its own transform; pan and zoom live on the
 * viewport, so the transforms can be compared without correcting for either.
 */

const nodes = (page: Page) => page.locator('.react-flow__node');
const node = (page: Page, id: string) => page.locator(`.react-flow__node[data-id="${id}"]`);
const nodeIds = async (page: Page) =>
  (await nodes(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-id')))).sort();

const graphViewMenu = (page: Page) => page.locator('.react-flow .MuiMenuButton-root').nth(1);
const expandColumns = (page: Page, id: string) => page.getByTestId(`columns-expand-${id}`);
const expandForward = (page: Page, id: string) =>
  page.locator(`.react-flow__node[data-id="${id}"] .react-flow__handle-bottom button`);

// nodeColors.centralNode in LineageGraphComponents.tsx, as the browser reports it
const SELECTED_BACKGROUND = 'rgb(173, 219, 255)';

type Placed = {id: string, x: number, y: number};

const placed = async (page: Page): Promise<Placed[]> =>
  nodes(page).evaluateAll((els) => els.map((e) => {
    const {e: x, f: y} = new DOMMatrix((e as HTMLElement).style.transform);
    return {id: e.getAttribute('data-id')!, x, y};
  }));

const positions = async (page: Page) =>
  Object.fromEntries((await placed(page)).map((n) => [n.id, `${n.x},${n.y}`]));

/* The mental map property: pairs sharing a rank that swapped their order along the cross axis. */
function orderInversions(before: Placed[], after: Placed[], layout: 'TB' | 'LR' = 'TB'): string[] {
  const [rank, cross] = layout === 'TB' ? ['y', 'x'] as const : ['x', 'y'] as const;
  const seen = new Map(after.map((n) => [n.id, n]));
  const shared = before.filter((n) => seen.has(n.id));
  const flipped: string[] = [];
  shared.forEach((u, i) => shared.slice(i + 1).forEach((v) => {
    if (u[rank] !== v[rank]) return;
    if ((u[cross] < v[cross]) !== (seen.get(u.id)![cross] < seen.get(v.id)![cross])) flipped.push(`${u.id}/${v.id}`);
  }));
  return flipped;
}

const highlightedIds = async (page: Page) => nodes(page).evaluateAll((els, selected) => els
  .filter((e) => getComputedStyle(e.firstElementChild!).backgroundColor === selected)
  .map((e) => e.getAttribute('data-id')), SELECTED_BACKGROUND);

/*
    Every edge has to start and end on a node, and no edge may be there twice. A duplicate is drawn
    into empty space - an arrow head with no node at it - and survives every later operation.
*/
const brokenEdges = async (page: Page) => page.evaluate(() => {
  const boxes = [...document.querySelectorAll('.react-flow__node')].map((e) => e.getBoundingClientRect());
  const onANode = (x: number, y: number) => boxes.some((b) =>
    x > b.left - 12 && x < b.right + 12 && y > b.top - 12 && y < b.bottom + 12);
  const problems: string[] = [];
  const seen = new Set<string>();
  document.querySelectorAll('.react-flow__edge').forEach((edge) => {
    const id = edge.getAttribute('data-testid') ?? '?';
    if (seen.has(id)) problems.push(`duplicate ${id}`);
    seen.add(id);
    const path = edge.querySelector('path.react-flow__edge-path') as SVGPathElement | null;
    if (!path) return;
    const toScreen = (p: DOMPoint) =>
      new DOMPoint(p.x, p.y).matrixTransform(path.ownerSVGElement!.getScreenCTM()!);
    const start = toScreen(path.getPointAtLength(0));
    const end = toScreen(path.getPointAtLength(path.getTotalLength()));
    if (!onANode(start.x, start.y)) problems.push(`${id} starts nowhere`);
    if (!onANode(end.x, end.y)) problems.push(`${id} ends nowhere`);
  });
  return problems;
});

async function drag(page: Page, id: string, dx: number, dy: number) {
  const box = (await node(page, id).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + dx, box.y + 10 + dy, { steps: 10 });
  await page.mouse.up();
}

async function openLineage(page: Page, url: string) {
  await page.goto(url);
  await page.getByRole('button', { name: 'Open lineage' }).click();
  await expect(nodes(page).first()).toBeVisible();
}

test.describe('layout stability', () => {
  test('selecting a node that is shown grows the graph around it, without moving it', async ({ page }) => {
    await openLineage(page, '/#/config/dataObjects/int-airports');
    const before = await placed(page);

    await node(page, 'join-departures-airports').getByText('join-departures-airports', { exact: true }).click();

    // the neighbours of the selected action arrive
    await expect.poll(() => nodeIds(page)).toContain('btl-departures-arrivals-airports');
    expect(await page.url()).toContain('/config/actions/join-departures-airports');

    // the graph opens around the selected node rather than being rebuilt: it stays where it is,
    // nothing changes its order, and everything that was shown is still shown
    const after = await placed(page);
    expect(orderInversions(before, after)).toEqual([]);
    expect(after.find((n) => n.id === 'join-departures-airports'))
      .toEqual(before.find((n) => n.id === 'join-departures-airports'));
    before.forEach((n) => expect(after.find((a) => a.id === n.id)?.y).toBe(n.y));
  });

  test('selecting one node after another keeps everything that was brought in', async ({ page }) => {
    /*
        The config explorer hands the panel a new props object on every navigation. Rebuilding the
        node set on that threw away what the previous selections had grown - int-airports arrived
        with the action and disappeared again on the next selection.
    */
    await openLineage(page, '/#/config/dataObjects/btl-departures-arrivals-airports');
    await node(page, 'join-departures-airports').getByText('join-departures-airports', { exact: true }).click();
    await expect.poll(() => nodeIds(page)).toContain('int-airports');
    const grown = await placed(page);

    await node(page, 'int-departures').getByText('int-departures', { exact: true }).click();

    await expect.poll(() => nodeIds(page)).toContain('download-deduplicate-departures');
    const after = await placed(page);
    grown.forEach((n) => expect(`${n.id} shown`).toBe(`${after.find((a) => a.id === n.id)?.id} shown`));
    expect(orderInversions(grown, after)).toEqual([]);
  });

  test('the highlight follows the selection, also back onto the node the graph was built around', async ({ page }) => {
    const highlighted = () => highlightedIds(page);

    await openLineage(page, '/#/config/dataObjects/btl-departures-arrivals-airports');
    expect(await highlighted()).toEqual(['btl-departures-arrivals-airports']);

    await node(page, 'compute-distances').getByText('compute-distances', { exact: true }).click();
    await expect.poll(highlighted).toEqual(['compute-distances']);

    // back onto the element the node set was built around - the highlight has to come back with it
    await node(page, 'btl-departures-arrivals-airports')
      .getByText('btl-departures-arrivals-airports', { exact: true }).click();
    await expect.poll(highlighted).toEqual(['btl-departures-arrivals-airports']);
  });

  test('the expand handles face away from the selected node', async ({ page }) => {
    const buttons = async (id: string) => node(page, id).evaluate((e) => ({
      forward: !!e.querySelector('.react-flow__handle-bottom button, .react-flow__handle-right button'),
      backward: !!e.querySelector('.react-flow__handle-top button, .react-flow__handle-left button'),
    }));

    await openLineage(page, '/#/config/dataObjects/int-airports');
    // an action downstream of the selected element can only be expanded downstream
    expect(await buttons('join-departures-airports')).toEqual({forward: true, backward: false});

    await node(page, 'join-departures-airports').getByText('join-departures-airports', { exact: true }).click();

    // selecting it makes it the node the graph is explored from, so it carries both
    await expect.poll(() => buttons('join-departures-airports')).toEqual({forward: true, backward: true});
    // and both read as expanded, because selecting it showed its neighbours on both sides
    await expect(node(page, 'join-departures-airports')
      .locator('.react-flow__handle button [data-testid="AddBoxOutlinedIcon"]')).toHaveCount(0);

    // and a node downstream of it keeps only the side that leads further downstream
    expect(await buttons('btl-departures-arrivals-airports')).toEqual({forward: true, backward: false});

    await node(page, 'int-departures').getByText('int-departures', { exact: true }).click();

    // the pair moves on with the selection, and the sides of the others turn to face away from it
    await expect.poll(() => buttons('int-departures')).toEqual({forward: true, backward: true});
    await expect.poll(() => buttons('join-departures-airports')).toEqual({forward: true, backward: false});
    // int-airports is reached by going forward to the action and back out of it, so it leads back
    expect(await buttons('int-airports')).toEqual({forward: false, backward: true});
  });

  test('expanding from a node that was selected earlier keeps the sides facing the current selection', async ({ page }) => {
    /*
        A node's expand handler carries the flowProps of the moment it was created, so its
        elementName is whatever was selected back then. Acting on that instead of on the current
        selection turned the sides around: the node the handle belongs to got both, the selected
        one lost the side facing it.
    */
    const buttons = async (id: string) => node(page, id).evaluate((e) => ({
      forward: !!e.querySelector('.react-flow__handle-bottom button, .react-flow__handle-right button'),
      backward: !!e.querySelector('.react-flow__handle-top button, .react-flow__handle-left button'),
    }));

    await openLineage(page, '/#/config/dataObjects/download-deduplicate-departures');
    await node(page, 'int-departures').getByText('int-departures', { exact: true }).click();
    await expect.poll(() => buttons('int-departures')).toEqual({forward: true, backward: true});

    // collapse on the node that was selected first, which is now upstream of the selection
    await node(page, 'download-deduplicate-departures').locator('.react-flow__handle-top button').click();
    await expect.poll(() => nodeIds(page)).not.toContain('ext-departures');

    expect(await buttons('download-deduplicate-departures')).toEqual({forward: false, backward: true});
    expect(await buttons('int-departures')).toEqual({forward: true, backward: true});
    expect(await highlightedIds(page)).toEqual(['int-departures']);
  });

  test('a node that is not shown arrives with the chain leading to it, and nothing else moves', async ({ page }) => {
    await openLineage(page, '/#/config/dataObjects/int-airports');
    const before = await positions(page);

    await page.goto('/#/config/dataObjects/btl-distances');

    await expect.poll(() => nodeIds(page)).toContain('btl-distances');
    const after = await positions(page);
    expect(Object.keys(after)).toContain('compute-distances'); // the chain, not only the element
    Object.keys(before).forEach((id) => expect(`${id}: ${after[id]}`).toBe(`${id}: ${before[id]}`));
  });

  test('expanding a node keeps the order of what is already shown', async ({ page }) => {
    await openLineage(page, '/#/config/dataObjects/int-airports');
    const before = await placed(page);

    await expandForward(page, 'join-departures-airports').click();
    await expect.poll(() => nodeIds(page)).toContain('btl-departures-arrivals-airports');

    const after = await placed(page);
    expect(orderInversions(before, after)).toEqual([]);
    // the node the user acted on stays exactly where it was
    expect(after.find((n) => n.id === 'join-departures-airports'))
      .toEqual(before.find((n) => n.id === 'join-departures-airports'));
  });

  test('collapsing a node leaves the rest where it is', async ({ page }) => {
    await openLineage(page, '/#/config/dataObjects/int-airports');
    await expandForward(page, 'join-departures-airports').click();
    await expect.poll(() => nodeIds(page)).toContain('btl-departures-arrivals-airports');
    const before = await positions(page);

    await expandForward(page, 'join-departures-airports').click();
    await expect.poll(() => nodeIds(page)).not.toContain('btl-departures-arrivals-airports');

    const after = await positions(page);
    Object.keys(after).forEach((id) => expect(`${id}: ${after[id]}`).toBe(`${id}: ${before[id]}`));
  });

  test('opening the columns of a node does not move it, and reorders nothing', async ({ page }) => {
    await openLineage(page, '/#/config/dataObjects/int-departures');
    await graphViewMenu(page).click();
    await page.getByRole('menuitem').nth(3).click(); // relations, laid out left to right
    await expect(nodes(page).first()).toBeVisible();
    const before = await placed(page);

    await expandColumns(page, 'int-departures').click();
    await expect(node(page, 'int-departures').locator('.lineage-column-row').first()).toBeVisible();

    const after = await placed(page);
    expect(orderInversions(before, after, 'LR')).toEqual([]);
    expect(after.find((n) => n.id === 'int-departures'))
      .toEqual(before.find((n) => n.id === 'int-departures'));
  });

  test('selecting another element keeps what the nodes were showing', async ({ page }) => {
    // the flow used to be re-created on every selection, which threw away the open columns with it
    await openLineage(page, '/#/config/dataObjects/int-departures');
    await graphViewMenu(page).click();
    await page.getByRole('menuitem').nth(3).click();
    await expect(nodes(page).first()).toBeVisible();
    await expandColumns(page, 'int-airports').click();
    const columns = await node(page, 'int-airports').locator('.lineage-column-row').count();
    expect(columns).toBeGreaterThan(0);

    await node(page, 'int-departures').getByText('int-departures', { exact: true }).click();

    await expect.poll(() => page.url()).toContain('/config/dataObjects/int-departures');
    await expect(node(page, 'int-airports').locator('.lineage-column-row')).toHaveCount(columns);
  });

  test('a node moved by hand keeps its place when the graph is expanded elsewhere', async ({ page }) => {
    await openLineage(page, '/#/config/dataObjects/int-airports');
    await drag(page, 'join-departures-airports', 200, 100);
    const dragged = await positions(page);

    // expand at the other end of the graph
    await node(page, 'historize-airports').locator('.react-flow__handle-top button').click();
    await expect.poll(() => nodeIds(page)).toContain('stg-airports');

    const after = await positions(page);
    Object.keys(dragged).forEach((id) => expect(`${id}: ${after[id]}`).toBe(`${id}: ${dragged[id]}`));
  });

  test('a node moved by hand still follows its neighbours', async ({ page }) => {
    // the displacement is kept, not the position: the node keeps its place in the arrangement
    await openLineage(page, '/#/config/dataObjects/int-airports');
    await drag(page, 'join-departures-airports', 200, 100);
    const before = await placed(page);

    // a node in the rank above grows, so every rank after it moves down
    await expandColumns(page, 'int-airports').click();
    await expect(node(page, 'int-airports').locator('.lineage-column-row').first()).toBeVisible();
    const after = await placed(page);

    // it moved down with its rank, and sideways by as much as a node that was not dragged
    const moved = (id: string) => ({
      x: after.find((n) => n.id === id)!.x - before.find((n) => n.id === id)!.x,
      y: after.find((n) => n.id === id)!.y - before.find((n) => n.id === id)!.y,
    });
    expect(moved('join-departures-airports').y).toBeGreaterThan(0);
    expect(moved('join-departures-airports').x).toBe(moved('historize-airports').x);
  });

  test('recompute layout gives up the manual moves', async ({ page }) => {
    await openLineage(page, '/#/config/dataObjects/int-airports');
    const computed = await positions(page);
    await drag(page, 'join-departures-airports', 200, 100);
    await expect.poll(async () => (await positions(page))['join-departures-airports'])
      .not.toBe(computed['join-departures-airports']);

    await page.getByRole('button', { name: 'Recompute layout' }).click();

    await expect.poll(() => positions(page)).toEqual(computed);
  });

  test('every edge starts and ends on a node, through expanding, selecting and collapsing', async ({ page }) => {
    /*
        Selecting a node expands it into neighbours that may already be shown, and merging the edges
        by object identity let the same edge in twice. The copy is drawn into empty space as soon as
        the graph is collapsed, and nothing takes it away again.
    */
    await openLineage(page, '/#/config/dataObjects/int-airports');
    expect(await brokenEdges(page)).toEqual([]);

    await page.getByRole('button', { name: 'Expand graph' }).click();
    await expect.poll(() => nodeIds(page)).toContain('btl-distances');
    expect(await brokenEdges(page)).toEqual([]);

    await node(page, 'join-departures-airports').getByText('join-departures-airports', { exact: true }).click();
    await expect.poll(() => page.url()).toContain('/config/actions/join-departures-airports');
    expect(await brokenEdges(page)).toEqual([]);

    await page.getByRole('button', { name: 'Collapse graph' }).click();
    await expect.poll(() => nodeIds(page)).not.toContain('btl-distances');
    expect(await brokenEdges(page)).toEqual([]);

    // and a node's own handle, in both directions - collapsing is what leaves an edge behind
    const handle = node(page, 'int-departures').locator('.react-flow__handle-top button');
    await handle.click();
    await expect.poll(() => nodeIds(page)).toContain('download-deduplicate-departures');
    expect(await brokenEdges(page)).toEqual([]);

    await handle.click();
    await expect.poll(() => nodeIds(page)).not.toContain('download-deduplicate-departures');
    expect(await brokenEdges(page)).toEqual([]);
  });
});
