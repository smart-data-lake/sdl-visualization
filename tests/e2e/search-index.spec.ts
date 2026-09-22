import { expect, Page, test } from '@playwright/test';

/**
 * The global search with a prebuilt index, which the exported fixture carries
 * (tests/e2e/fixtures/exported/search/index.json, built by scripts/buildSearchIndex.ts).
 *
 * This is the only place the full coverage is exercised end to end: description bodies and
 * schema columns come from per-element files the search can only reach through an index.
 */

/**
 * Clicking is the deterministic way in: it waits for the trigger to be actionable, whereas a
 * keypress fired before the header's effect has attached its listener is simply lost. The
 * shortcut itself is covered by its own test, which retries for exactly that reason.
 */
async function openPalette(page: Page) {
  await page.getByTestId('global-search').click();
  await expect(page.getByTestId('search-palette')).toBeVisible();
}

const palette = (page: Page) => page.getByTestId('search-palette');

const typeQuery = (page: Page, query: string) =>
  palette(page).getByTestId('search-input').locator('input').fill(query);

test.describe('global search over a built index', () => {
  test('it reports the index rather than the degraded coverage', async ({ page }) => {
    await page.goto('/#/config/dataObjects/int-airports');

    await openPalette(page);
    await expect(palette(page).getByTestId('search-coverage')).toContainText('documents');
    await expect(palette(page).getByTestId('search-coverage')).not.toContainText('Configuration only');
  });

  test('a word that only appears in a description finds that description', async ({ page }) => {
    await page.goto('/#/config/dataObjects/int-airports');

    await openPalette(page);
    await typeQuery(page, 'rail');

    await expect(palette(page).locator('[data-docid^="d:"]').first()).toBeVisible();
  });

  test('a column is found by name and opens the schema tab on it', async ({ page }) => {
    await page.goto('/#/config/dataObjects/int-airports');

    await openPalette(page);
    await typeQuery(page, 'icao24');

    const column = palette(page).locator('[data-docid^="c:"]').first();
    await expect(column).toBeVisible();
    await column.click();

    await expect(page).toHaveURL(/#\/config\/dataObjects\/int-departures\/schema\?column=icao24/);
    // the deep link marks the row it named
    await expect(page.locator('.sdlb-row-highlighted')).toContainText('icao24');
  });

  test('a data object whose newest schema export failed contributes no columns', async ({ page }) => {
    await page.goto('/#/config/dataObjects/int-airports');

    await openPalette(page);
    // btl-distances' newest export carries only an error; the indexer takes it as it finds it
    // rather than describing columns from an older one that may no longer exist
    await typeQuery(page, 'column:distance');

    await expect(palette(page).locator('[data-docid^="c:btl-distances"]')).toHaveCount(0);
  });

  test('a prefix narrows the search to one kind', async ({ page }) => {
    await page.goto('/#/config/dataObjects/int-airports');

    await openPalette(page);
    await typeQuery(page, 'column:callsign');

    await expect(palette(page).getByTestId('search-scope')).toHaveText('Columns');
    await expect(palette(page).locator('[data-docid^="c:"]').first()).toBeVisible();
    // an element body also matches "callsign", but the scope excludes it
    await expect(palette(page).locator('[data-docid^="e:"]')).toHaveCount(0);
  });

  test('a prefix can narrow to one field instead of one kind', async ({ page }) => {
    await page.goto('/#/config/dataObjects/int-airports');

    await openPalette(page);
    await typeQuery(page, 'tag:aviation');

    await expect(palette(page).getByTestId('search-scope')).toHaveText('tag');
    await expect(palette(page).locator('[data-docid="e:dataObjects:int-airports"]')).toBeVisible();
  });

  test('a colon that is not a known prefix is searched as typed', async ({ page }) => {
    await page.goto('/#/config/dataObjects/int-airports');

    await openPalette(page);
    await typeQuery(page, 'nosuchscope:icao24');

    await expect(palette(page).getByTestId('search-scope')).toHaveCount(0);
    await expect(palette(page).getByText(/No results for/)).toBeVisible();
  });

  test('nothing from a workflow run is searchable', async ({ page }) => {
    await page.goto('/#/config/dataObjects/int-airports');

    await openPalette(page);
    await typeQuery(page, 'SUCCEEDED');

    await expect(palette(page).getByText(/No results for/)).toBeVisible();
  });
});
