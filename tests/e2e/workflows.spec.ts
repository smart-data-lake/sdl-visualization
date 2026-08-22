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

  test('the timeline minimap keeps one line per action group', async ({ page }) => {
    // run 75 starts download-airports and download-deduplicate-departures in the same millisecond,
    // so the minimap lines they aggregate into carry the same phase and start time. Keying those
    // lines by their content made them collide ("two children with the same key"), which lets React
    // drop one of them.
    const reactWarnings: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('same key')) reactWarnings.push(text);
    });

    await page.goto(`/#/workflows/${WORKFLOW}/75.1`);

    for (const action of ACTIONS) {
      await expect(page.getByRole('link', { name: new RegExp(`^${action} `) }).first()).toBeVisible();
    }
    // one minimap line per action, none omitted by a duplicate key
    await expect.poll(() => page.getByTestId('minimap-line').count()).toBe(ACTIONS.length);
    expect(reactWarnings).toEqual([]);
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

  test('the table shows the main input and output counts of each action', async ({ page }) => {
    await page.goto(`/#/workflows/${WORKFLOW}/75.1/table`);

    // the counts come from the metrics of the state file: count#mainInput for the input, and count,
    // records_written or files_written for the output
    const cells = (action: string) => page.getByRole('row', { name: new RegExp(`^${action} `) })
      .getByRole('cell');
    // download-airports is a file action, so its output count is its files_written
    await expect(cells('download-airports').nth(6)).toHaveText('');
    await expect(cells('download-airports').nth(7)).toHaveText('1');
    // an action reading a single input records no mainInput metric
    await expect(cells('download-deduplicate-departures').nth(6)).toHaveText('');
    await expect(cells('download-deduplicate-departures').nth(7)).toHaveText('759');
    // the join reads 83330 rows from its main input and writes 663
    await expect(cells('join-departures-airports').nth(6)).toHaveText('83330');
    await expect(cells('join-departures-airports').nth(7)).toHaveText('663');

    // both columns are shown by default and can be switched off again
    const menu = page.locator('button:has([data-testid="ViewColumnOutlinedIcon"])');
    await menu.click();
    const item = (title: string) => page.getByRole('menuitem').filter({ hasText: title });
    await expect(item('Input Count').getByRole('checkbox')).toBeChecked();
    await expect(item('Output Count').getByRole('checkbox')).toBeChecked();
    await item('Input Count').getByRole('checkbox').click();
    await expect(page.getByRole('columnheader', { name: 'Input Count' })).toBeHidden();
    await expect(page.getByRole('columnheader', { name: 'Output Count' })).toBeVisible();
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

  test('the run graph shows the state of each action on its node', async ({ page }) => {
    await page.goto(`/#/workflows/${WORKFLOW}/24.1/graph`);
    await expect(page.locator('.react-flow__node').first()).toBeVisible();

    // the box inside the node carries the border
    const node = (action: string) => page.locator(`.react-flow__node[data-id="${action}"] > div`).first();
    // in attempt 24.1 the downloads succeeded, deduplicate-departures failed and the actions
    // waiting on it were cancelled - see statusColors.ts for the palette
    await expect(node('download-airports')).toHaveCSS('border-color', 'rgb(32, 175, 46)'); // SUCCEEDED
    await expect(node('historize-airports')).toHaveCSS('border-color', 'rgb(32, 175, 46)'); // SUCCEEDED
    await expect(node('download-deduplicate-departures')).toHaveCSS('border-color', 'rgb(235, 52, 40)'); // FAILED
    await expect(node('join-departures-airports')).toHaveCSS('border-color', 'rgb(0, 187, 206)'); // CANCELLED
    await expect(node('compute-distances')).toHaveCSS('border-color', 'rgb(0, 187, 206)'); // CANCELLED

    // the state is also named by an icon, so that it does not rely on the border colour alone
    await expect(node('download-airports').getByTestId('CheckCircleOutlineIcon')).toBeVisible();
    await expect(node('download-deduplicate-departures').getByTestId('HighlightOffIcon')).toBeVisible();
    await expect(node('join-departures-airports').getByTestId('BlockOutlinedIcon')).toBeVisible();
  });

  test('the run graph shows the metrics of each data flow on its edge', async ({ page }) => {
    await page.goto(`/#/workflows/${WORKFLOW}/75.1/graph`);
    await expect(page.locator('.react-flow__node').first()).toBeVisible();

    // every edge of the action graph is one data object: the output label is what the source action
    // wrote to it, the input label what the target action read from it
    const edge = (from: string, via: string, to: string) => `${from}->${via}->${to}`;
    const output = (id: string) => page.getByTestId(`edge-metric-output-${id}`);
    const input = (id: string) => page.getByTestId(`edge-metric-input-${id}`);

    // download-airports is a file action, so it only recorded files_written
    const download = edge('download-airports', 'stg-airports', 'historize-airports');
    await expect(output(download)).toHaveText('1');
    await expect(input(download)).toBeHidden(); // historize-airports recorded no input metric

    // the interesting case: 759 rows written, only 666 of them read
    const departures = edge('download-deduplicate-departures', 'int-departures', 'join-departures-airports');
    await expect(output(departures)).toHaveText('759');
    await expect(input(departures)).toHaveText('666');

    const airports = edge('historize-airports', 'int-airports', 'join-departures-airports');
    await expect(output(airports)).toHaveText('83330');
    await expect(input(airports)).toHaveText('83330');

    const join = edge('join-departures-airports', 'btl-departures-arrivals-airports', 'compute-distances');
    await expect(output(join)).toHaveText('663');
    await expect(input(join)).toHaveText('663');

    // btl-distances is written but read by no action of the attempt, so its metric has no edge and
    // is shown next to compute-distances instead
    await expect(page.getByTestId('node-metric-output-btl-distances')).toHaveText('663');
  });

  test('the tooltip of a metric names its data object and lists every metric of it', async ({ page }) => {
    await page.goto(`/#/workflows/${WORKFLOW}/75.1/graph`);
    await expect(page.locator('.react-flow__node').first()).toBeVisible();
    const compute = 'join-departures-airports->btl-departures-arrivals-airports->compute-distances';

    // innerText, not toHaveText: the assertion is about the line breaks, which textContent drops
    const tooltipLines = () => page.getByRole('tooltip').innerText();

    // an output lists everything the action recorded for that data object, sorted by name, and none
    // of the count#<inputId> metrics, which describe the action's inputs
    await page.getByTestId(`edge-metric-output-${compute}`).hover();
    await expect.poll(tooltipLines).toBe([
      'written to btl-departures-arrivals-airports:',
      'bytes_written = 16837', 'count = 663', 'num_files = 2', 'num_output_bytes = 16837',
      'num_tasks = 2', 'records_written = 663', 'rows_inserted = 663',
    ].join('\n'));

    // an input lists the metrics qualified with its own id
    const departures = 'download-deduplicate-departures->int-departures->join-departures-airports';
    await page.getByTestId(`edge-metric-input-${departures}`).hover();
    await expect.poll(tooltipLines).toBe('read from int-departures:\ncount#int-departures = 666');
  });

  test('selecting an edge in the run graph highlights its metrics', async ({ page }) => {
    await page.goto(`/#/workflows/${WORKFLOW}/75.1/graph`);
    const id = 'download-deduplicate-departures->int-departures->join-departures-airports';
    const label = page.getByTestId(`edge-metric-output-${id}`);
    await expect(label).toBeVisible();

    // unselected: the label border follows its edge, i.e. the default grey
    await expect(label).toHaveCSS('border-color', 'rgb(177, 177, 183)');
    await expect(page.locator(`g[data-testid="rf__edge-${id}"] .react-flow__edge-path`))
      .toHaveCSS('stroke', 'rgb(177, 177, 183)');

    await page.locator(`g[data-testid="rf__edge-${id}"] .react-flow__edge-path`).click({ force: true });

    // selected: the edge and both of its metric labels turn to the highlight colour
    await expect(page.locator(`g[data-testid="rf__edge-${id}"] .react-flow__edge-path`))
      .toHaveCSS('stroke', 'rgb(9, 107, 222)');
    await expect(label).toHaveCSS('border-color', 'rgb(9, 107, 222)');
    await expect(page.getByTestId(`edge-metric-input-${id}`)).toHaveCSS('border-color', 'rgb(9, 107, 222)');

    // and everything highlighted is lifted over the other edges and labels, so that the
    // highlighting is not hidden behind them
    await expect(page.locator(`svg.react-flow__edges:has(g[data-testid="rf__edge-${id}"])`))
      .toHaveCSS('z-index', '1000');
    await expect(page.locator('.react-flow__node[data-id="join-departures-airports"]'))
      .toHaveCSS('z-index', '1000');
    await expect(label.locator('..')).toHaveCSS('z-index', '1001');

    // clicking the pane puts everything back - away from the toolbar and the zoom controls
    await page.locator('.react-flow__pane').click({ position: { x: 1150, y: 300 } });
    await expect(label).toHaveCSS('border-color', 'rgb(177, 177, 183)');
    await expect(page.locator('.react-flow__node[data-id="join-departures-airports"]'))
      .toHaveCSS('z-index', '0');
  });

  test('the run graph aligns the metrics to the nodes in both layouts', async ({ page }) => {
    await page.goto(`/#/workflows/${WORKFLOW}/75.1/graph`);
    await expect(page.locator('.react-flow__node').first()).toBeVisible();

    const box = async (locator: ReturnType<typeof page.locator>) => (await locator.boundingBox())!;
    // the labels are placed relative to the edge endpoints, which ReactFlow measures, so the gap to
    // the node is asserted as "a small one" rather than to the pixel
    const isSmallGap = (gap: number) => { expect(gap).toBeGreaterThan(4); expect(gap).toBeLessThan(16); };
    const node = (action: string) => page.locator(`.react-flow__node[data-id="${action}"]`);
    const join = 'download-deduplicate-departures->int-departures->join-departures-airports';
    const airports = 'historize-airports->int-airports->join-departures-airports';

    // vertical layout: the labels sit below resp. above their node, the ones of the two edges
    // entering join-departures-airports following each other along the path
    let departures = await box(node('download-deduplicate-departures'));
    let output = await box(page.getByTestId(`edge-metric-output-${join}`));
    isSmallGap(output.y - (departures.y + departures.height));

    let joinNode = await box(node('join-departures-airports'));
    let first = await box(page.getByTestId(`edge-metric-input-${join}`));
    let second = await box(page.getByTestId(`edge-metric-input-${airports}`));
    isSmallGap(joinNode.y - (first.y + first.height));
    expect(second.y + second.height).toBeLessThan(first.y); // no overlap
    expect(Math.round(second.x)).toBe(Math.round(first.x)); // both beside the same line

    // the metric of an output no action reads has no edge, so it is centered under its action
    let compute = await box(node('compute-distances'));
    let stub = await box(page.getByTestId('node-metric-output-btl-distances'));
    expect(Math.round(stub.x + stub.width / 2)).toBe(Math.round(compute.x + compute.width / 2));

    await page.getByRole('button', { name: /switch to horizontal layout/ }).click();
    await expect(page.getByTestId(`edge-metric-output-${join}`)).toBeVisible();

    // horizontal layout: the labels sit right resp. left of their node and above the line, and the
    // ones entering join-departures-airports are stacked, as there is no room along the line
    departures = await box(node('download-deduplicate-departures'));
    output = await box(page.getByTestId(`edge-metric-output-${join}`));
    isSmallGap(output.x - (departures.x + departures.width));
    expect(output.y + output.height).toBeLessThan(departures.y + departures.height / 2); // above the line

    joinNode = await box(node('join-departures-airports'));
    first = await box(page.getByTestId(`edge-metric-input-${join}`));
    second = await box(page.getByTestId(`edge-metric-input-${airports}`));
    isSmallGap(joinNode.x - (first.x + first.width));
    expect(Math.round(second.x + second.width)).toBe(Math.round(first.x + first.width)); // stacked
    expect(second.y + second.height).toBeLessThan(first.y);

    // the stub is centered on its action in this layout too
    compute = await box(node('compute-distances'));
    stub = await box(page.getByTestId('node-metric-output-btl-distances'));
    expect(Math.round(stub.y + stub.height / 2)).toBe(Math.round(compute.y + compute.height / 2));
  });

  test('the run graph of an attempt without metrics shows no labels', async ({ page }) => {
    // in attempt 24.1 deduplicate-departures failed and the actions waiting on it were cancelled,
    // so their results carry an empty metrics bag
    await page.goto(`/#/workflows/${WORKFLOW}/24.1/graph`);
    await expect(page.locator('.react-flow__node')).toHaveCount(ACTIONS.length);

    const departures = 'download-deduplicate-departures->int-departures->join-departures-airports';
    await expect(page.getByTestId(`edge-metric-output-${departures}`)).toBeHidden();
    await expect(page.getByTestId(`edge-metric-input-${departures}`)).toBeHidden();
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
