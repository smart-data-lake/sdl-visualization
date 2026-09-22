import { expect, Page, test } from '@playwright/test';

/**
 * The global search in the title bar, where no index has been built.
 *
 * Neither the hocon fixture nor a freshly seeded backend has one - an index is only ever
 * produced by an explicit rebuild - so this is the degraded path, and the point of the spec
 * is that it is a working search that says what it cannot see, not an empty box.
 */

/**
 * The shortcut listener is attached in an effect, so a keypress fired the instant the header
 * paints can be lost. Retrying the press keeps this a test of the shortcut rather than of
 * mount timing.
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

/** Scopes queries to the palette, which would otherwise also match the page behind it. */
const palette = (page: Page) => page.getByTestId('search-palette');

const typeQuery = (page: Page, query: string) =>
  palette(page).getByTestId('search-input').locator('input').fill(query);

test.describe('global search without an index', () => {
  test('the box in the title bar opens it, with the caret in it', async ({ page }) => {
    await page.goto('/#/config/dataObjects/int-airports');

    await openPalette(page);
    await expect(palette(page).getByTestId('search-input').locator('input')).toBeFocused();
  });

  test('ctrl+K opens it too', async ({ page }) => {
    await page.goto('/#/config/dataObjects/int-airports');
    await expect(page.getByTestId('global-search')).toBeVisible();

    // retried: a press landing before the header's effect has run is lost, which a person cannot do
    await expect(async () => {
      await page.keyboard.press('Control+k');
      await expect(palette(page)).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
  });

  test('a search finds its data object and enter navigates to it', async ({ page }) => {
    await page.goto('/#/config/dataObjects/btl-distances');

    await openPalette(page);
    await typeQuery(page, 'int-airports');

    await expect(palette(page).getByTestId('search-result').first()).toBeVisible();
    await expect(palette(page).getByText('Data Objects')).toBeVisible();

    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#\/config\/dataObjects\/int-airports\/configuration/);
  });

  test('the arrow keys move the selection', async ({ page }) => {
    await page.goto('/#/config/dataObjects/int-airports');

    await openPalette(page);
    await typeQuery(page, 'airports');
    await expect(palette(page).getByTestId('search-result').nth(1)).toBeVisible();

    const second = await palette(page).getByTestId('search-result').nth(1).getAttribute('data-docid');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    const [, elementType, elementName] = second!.split(':');
    await expect(page).toHaveURL(new RegExp(`#/config/${elementType}/${elementName}`));
  });

  test('escape closes it', async ({ page }) => {
    await page.goto('/#/config/dataObjects/int-airports');

    await openPalette(page);
    await page.keyboard.press('Escape');
    await expect(palette(page)).toBeHidden();
  });

  test('it says it can only see the configuration, since nothing built an index', async ({ page }) => {
    await page.goto('/#/config/dataObjects/int-airports');

    await openPalette(page);
    await expect(palette(page).getByTestId('search-coverage')).toContainText('Configuration only');
  });

  test('it is reachable from the workflows explorer, not just the config explorer', async ({ page }) => {
    await page.goto('/#/workflows');

    await openPalette(page);
    await typeQuery(page, 'int-airports');
    await expect(palette(page).getByTestId('search-result').first()).toBeVisible();
  });
});
