import { expect, Page, test } from '@playwright/test';

/**
 * Grouping the lineage graph into boxes by a metadata attribute, see the Grouping section of
 * src/components/ConfigExplorer/LineageTab/README.md. The fixture's actions carry the feeds
 * download and compute, its data objects the layers extern, staging, integration and btl and the
 * subject areas airports and flight data. The fixture manifests lay the graph out top to bottom.
 */

const nodes = (page: Page) => page.locator('.react-flow__node');
const node = (page: Page, id: string) => page.locator(`.react-flow__node[data-id="${id}"]`);
const nodeIds = async (page: Page) =>
  (await nodes(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-id')))).sort();
const elementIds = async (page: Page) => (await nodeIds(page)).filter((id) => !id!.startsWith('group:'));
const boxIds = async (page: Page) => (await nodeIds(page)).filter((id) => id!.startsWith('group:'));

const graphViewMenu = (page: Page) => page.locator('.react-flow .MuiMenuButton-root').nth(1);

async function openLineage(page: Page, url: string, view?: 'data' | 'action') {
  await page.goto(url);
  await page.getByRole('button', { name: 'Open lineage' }).click();
  await expect(nodes(page).first()).toBeVisible();
  if (view) {
    await graphViewMenu(page).click();
    await page.getByRole('menuitem').nth(view === 'data' ? 1 : 2).click();
  }
  await page.getByRole('button', { name: 'Expand graph' }).click();
}

async function groupBy(page: Page, attribute: 'Feed' | 'Subject area' | 'Layer') {
  await page.getByRole('button', { name: 'Grouping' }).click();
  await page.getByRole('menuitem', { name: attribute }).click();
  await page.keyboard.press('Escape');
}

type Rect = { x: number, y: number, width: number, height: number };
const rectOf = async (page: Page, id: string): Promise<Rect> => (await node(page, id).boundingBox())!;
const inside = (inner: Rect, outer: Rect) => inner.x >= outer.x && inner.y >= outer.y
  && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;
const overlap = (a: Rect, b: Rect) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

type Placed = { id: string, x: number, y: number };
const placed = async (page: Page): Promise<Placed[]> => (await nodes(page).evaluateAll((els) => els.map((e) => {
  const { e: x, f: y } = new DOMMatrix((e as HTMLElement).style.transform);
  return { id: e.getAttribute('data-id')!, x, y };
}))).filter((n) => !n.id.startsWith('group:'));

/* Pairs of elements sharing a rank that swapped their order along the cross axis - top to bottom, so along x. */
function orderInversions(before: Placed[], after: Placed[]): string[] {
  const seen = new Map(after.map((n) => [n.id, n]));
  const shared = before.filter((n) => seen.has(n.id));
  const flipped: string[] = [];
  shared.forEach((u, i) => shared.slice(i + 1).forEach((v) => {
    if (u.y !== v.y) return;
    if ((u.x < v.x) !== (seen.get(u.id)!.x < seen.get(v.id)!.x)) flipped.push(`${u.id}/${v.id}`);
  }));
  return flipped;
}

/* Every edge that is drawn starts and ends on an element or a collapsed box - not in an open box's empty space. */
const brokenEdges = async (page: Page) => page.evaluate(() => {
  const ends = [...document.querySelectorAll('.react-flow__node')]
    .filter((e) => !e.getAttribute('data-id')!.startsWith('group:') || e.querySelector('[data-testid="group-box-count"]'))
    .map((e) => e.getBoundingClientRect());
  const onANode = (x: number, y: number) => ends.some((b) =>
    x > b.left - 14 && x < b.right + 14 && y > b.top - 14 && y < b.bottom + 14);
  const problems: string[] = [];
  document.querySelectorAll('.react-flow__edge').forEach((edge) => {
    const id = edge.getAttribute('data-testid') ?? '?';
    const path = edge.querySelector('path.react-flow__edge-path') as SVGPathElement | null;
    if (!path) return;
    const toScreen = (p: DOMPoint) => new DOMPoint(p.x, p.y).matrixTransform(path.ownerSVGElement!.getScreenCTM()!);
    if (!onANode(toScreen(path.getPointAtLength(0)).x, toScreen(path.getPointAtLength(0)).y)) problems.push(`${id} starts nowhere`);
    const end = toScreen(path.getPointAtLength(path.getTotalLength()));
    if (!onANode(end.x, end.y)) problems.push(`${id} ends nowhere`);
  });
  return problems;
});

test.describe('lineage grouping', () => {
  test('grouping the actions by feed puts each into its box', async ({ page }) => {
    await openLineage(page, '/#/config/actions/join-departures-airports', 'action');
    const ungrouped = await elementIds(page);

    await groupBy(page, 'Feed');

    await expect.poll(() => boxIds(page)).toEqual(['group:along:compute', 'group:along:download']);
    expect(await elementIds(page)).toEqual(ungrouped);
    const compute = await rectOf(page, 'group:along:compute');
    const download = await rectOf(page, 'group:along:download');
    expect(overlap(compute, download)).toBe(false);
    for (const id of ['compute-distances', 'historize-airports', 'join-departures-airports']) {
      expect(inside(await rectOf(page, id), compute), id).toBe(true);
    }
    expect(inside(await rectOf(page, 'download-airports'), download)).toBe(true);
  });

  test('a collapsed box stands for its members, and expanding it brings them back', async ({ page }) => {
    await openLineage(page, '/#/config/actions/join-departures-airports', 'action');
    await groupBy(page, 'Feed');
    await expect.poll(() => boxIds(page)).toContain('group:along:compute');
    const expanded = await elementIds(page);
    const downloadBefore = await rectOf(page, 'download-airports');

    await node(page, 'group:along:compute').getByRole('button', { name: 'Collapse group' }).click();

    await expect(node(page, 'compute-distances')).toHaveCount(0);
    await expect(node(page, 'group:along:compute').getByTestId('group-box-count')).toHaveText('4 elements');
    // download-airports feeds historize-airports: one edge, now ending on the box
    await expect(page.locator('.react-flow__edge[data-testid="rf__edge-group-edge:download-airports->group:along:compute"]')).toHaveCount(1);
    expect(await brokenEdges(page)).toEqual([]);

    await node(page, 'group:along:compute').getByRole('button', { name: 'Expand group' }).click();

    await expect.poll(() => elementIds(page)).toEqual(expanded);
    await expect(page.locator('.react-flow__edge[data-testid^="rf__edge-group-edge:"]')).toHaveCount(0);
    // the box it came from stays in place, so a node outside of it keeps its order relative to it
    expect((await rectOf(page, 'download-airports')).width).toBe(downloadBefore.width);
    expect(await brokenEdges(page)).toEqual([]);
  });

  test('dragging a box by its area moves its members with it', async ({ page }) => {
    await openLineage(page, '/#/config/actions/join-departures-airports', 'action');
    await groupBy(page, 'Feed');
    await expect.poll(() => boxIds(page)).toContain('group:along:compute');
    const members = ['compute-distances', 'historize-airports', 'join-departures-airports'];
    const before = await Promise.all(members.map((id) => rectOf(page, id)));
    const outside = await rectOf(page, 'download-airports');
    const box = await rectOf(page, 'group:along:compute');

    // the lower left corner lies in the box's padding, off every member
    await page.mouse.move(box.x + 6, box.y + box.height - 6);
    await page.mouse.down();
    await page.mouse.move(box.x + 46, box.y + box.height + 24, { steps: 8 });
    await page.mouse.up();

    const after = await Promise.all(members.map((id) => rectOf(page, id)));
    after.forEach((rect, i) => {
      expect(rect.x - before[i].x, members[i]).toBeCloseTo(40, 0);
      expect(rect.y - before[i].y, members[i]).toBeCloseTo(30, 0);
    });
    expect(await rectOf(page, 'download-airports')).toEqual(outside);
    const moved = await rectOf(page, 'group:along:compute');
    for (const rect of after) expect(inside(rect, moved)).toBe(true);
    // the move is remembered like a node's: laying out again keeps it
    await page.getByRole('button', { name: 'Grouping' }).click();
    await page.getByRole('menuitem', { name: 'Collapse all' }).click();
    await page.getByRole('button', { name: 'Grouping' }).click();
    await page.getByRole('menuitem', { name: 'Expand all' }).click();
    await expect(node(page, 'compute-distances')).toBeVisible();
    const relaid = await rectOf(page, 'compute-distances');
    const download = await rectOf(page, 'download-airports');
    expect(relaid.x - download.x).toBeCloseTo(after[0].x - outside.x, 0);
  });

  test('collapsing and expanding a box reorders nothing else', async ({ page }) => {
    await openLineage(page, '/#/config/dataObjects/btl-distances', 'data');
    await groupBy(page, 'Layer');
    await expect.poll(() => boxIds(page)).toContain('group:across:staging');
    // the graph is centred on btl-distances, which leaves the upper layers out of view
    await page.getByRole('button', { name: 'Show all', exact: true }).click();
    const before = await placed(page);

    await node(page, 'group:across:staging').getByRole('button', { name: 'Collapse group' }).click();
    await expect(node(page, 'stg-airports')).toHaveCount(0);
    expect(orderInversions(before, await placed(page))).toEqual([]);

    await node(page, 'group:across:staging').getByRole('button', { name: 'Expand group' }).click();
    await expect(node(page, 'stg-airports')).toBeVisible();
    expect(orderInversions(before, await placed(page))).toEqual([]);
  });

  test('grouping the data objects by layer gives one column per layer, in the order of the flow', async ({ page }) => {
    await openLineage(page, '/#/config/dataObjects/btl-distances', 'data');

    await groupBy(page, 'Layer');

    await expect.poll(() => boxIds(page)).toEqual([
      'group:across:btl', 'group:across:extern', 'group:across:integration', 'group:across:staging',
    ]);
    const [extern, staging, integration, btl] = await Promise.all(
      ['extern', 'staging', 'integration', 'btl'].map((layer) => rectOf(page, `group:across:${layer}`)));
    // top to bottom: each layer ends before the next one begins
    expect(extern.y + extern.height).toBeLessThanOrEqual(staging.y);
    expect(staging.y + staging.height).toBeLessThanOrEqual(integration.y);
    expect(integration.y + integration.height).toBeLessThanOrEqual(btl.y);
    expect(inside(await rectOf(page, 'ext-airports'), extern)).toBe(true);
    expect(inside(await rectOf(page, 'int-departures'), integration)).toBe(true);
  });

  test('a layer and a subject area together give a grid of boxes that do not overlap within an axis', async ({ page }) => {
    await openLineage(page, '/#/config/dataObjects/btl-distances');

    await groupBy(page, 'Layer');
    await groupBy(page, 'Subject area');

    await expect.poll(() => boxIds(page)).toContain('group:along:airports');
    const ids = await boxIds(page);
    const lanes = ids.filter((id) => id!.startsWith('group:along:'));
    const columns = ids.filter((id) => id!.startsWith('group:across:'));
    expect(lanes).toEqual(['group:along:airports', 'group:along:flight data']);
    expect(columns.length).toBe(4);
    for (const axis of [lanes, columns]) {
      const rects = await Promise.all(axis.map((id) => rectOf(page, id!)));
      rects.forEach((a, i) => rects.slice(i + 1).forEach((b) => expect(overlap(a, b)).toBe(false)));
    }
    // an action takes the layer and the subject area of what it writes
    expect(inside(await rectOf(page, 'historize-airports'), await rectOf(page, 'group:across:integration'))).toBe(true);
    expect(inside(await rectOf(page, 'historize-airports'), await rectOf(page, 'group:along:airports'))).toBe(true);
    expect(await brokenEdges(page)).toEqual([]);
  });

  test('selecting an element inside a collapsed box opens the box', async ({ page }) => {
    await openLineage(page, '/#/config/actions/join-departures-airports', 'action');
    await groupBy(page, 'Feed');
    await page.getByRole('button', { name: 'Grouping' }).click();
    await page.getByRole('menuitem', { name: 'Collapse all' }).click();
    await expect(node(page, 'download-airports')).toHaveCount(0);

    await page.goto('/#/config/actions/download-airports');

    await expect(node(page, 'download-airports')).toBeVisible();
    await expect(node(page, 'group:along:compute').getByTestId('group-box-count')).toHaveText('4 elements');
  });
});
