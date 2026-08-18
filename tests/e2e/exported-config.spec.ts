import { expect, test } from '@playwright/test';
import { ACTIONS, DATA_OBJECTS } from './fixture';

/**
 * Runs against the "exported" fixture: no HOCON files are served, only
 * exportedConfig.json (produced by SDLB's ConfigJsonExporter). This is the
 * setup the deployed getting-started visualizer uses, and it is a different
 * branch of fetchAPI_local_statefiles.getConfig() than the HOCON one, so the
 * core of the config explorer is checked against it as well.
 */
test.describe('config from exportedConfig.json', () => {
  test('lists every data object and action', async ({ page }) => {
    await page.goto('/#/config/dataObjects/int-airports');

    const list = page.getByRole('list').first();
    for (const id of [...DATA_OBJECTS, ...ACTIONS]) {
      await expect(list.getByRole('button', { name: id, exact: true })).toBeVisible();
    }
  });

  test('shows configuration attributes and the documentation the exporter added', async ({ page }) => {
    await page.goto('/#/config/actions/compute-distances');

    await expect(page.getByRole('link', { name: 'CopyAction' })).toBeVisible();
    await expect(page.getByRole('tabpanel', { name: 'Configuration' })).toContainText('ComputeDistanceTransformer');
  });

  test('renders the lineage graph', async ({ page }) => {
    await page.goto('/#/config/dataObjects/int-airports');
    await page.getByRole('button', { name: 'Open lineage' }).click();

    const ids = await page
      .locator('.react-flow__node')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-id')));
    expect(ids.sort()).toEqual(['historize-airports', 'int-airports', 'join-departures-airports']);
  });
});
