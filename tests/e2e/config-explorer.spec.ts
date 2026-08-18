import { expect, Page, test } from '@playwright/test';
import { ACTIONS, DATA_OBJECTS } from './fixture';

/** the element list in the left panel */
const elementList = (page: Page) => page.getByRole('list').first();
const element = (page: Page, id: string) =>
  elementList(page).getByRole('button', { name: id, exact: true });

test.describe('config explorer', () => {
  test('lists every data object and action of the config', async ({ page }) => {
    await page.goto('/#/config/dataObjects/int-airports');

    for (const id of [...DATA_OBJECTS, ...ACTIONS]) {
      await expect(element(page, id)).toBeVisible();
    }
    // the getting-started config has no connections
    await expect(elementList(page).getByRole('button', { name: 'Connections' })).toBeDisabled();
  });

  test('shows the configuration of a data object, with environment config applied', async ({ page }) => {
    await page.goto('/#/config/dataObjects/int-airports');

    await expect(page.getByRole('tab', { name: 'Configuration' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('link', { name: 'DeltaLakeTableDataObject' })).toBeVisible();
    await expect(page.getByRole('row', { name: 'table default.int_airports' })).toBeVisible();
    // path comes from envConfig/dev.conf via hocon substitution (${env.basePathWithId})
    await expect(page.getByRole('row', { name: 'path ./~{id}' })).toBeVisible();
  });

  test('search filters the element list by id', async ({ page }) => {
    await page.goto('/#/config/dataObjects/int-airports');
    await expect(element(page, 'btl-distances')).toBeVisible();

    await page.getByPlaceholder('Search element').fill('airports');

    await expect(element(page, 'int-airports')).toBeVisible();
    await expect(element(page, 'join-departures-airports')).toBeVisible();
    await expect(element(page, 'btl-distances')).toBeHidden();
    await expect(element(page, 'compute-distances')).toBeHidden();
  });

  test('a property chip filters the list by that property', async ({ page }) => {
    await page.goto('/#/config/dataObjects/int-airports');

    await page.getByRole('link', { name: 'DeltaLakeTableDataObject' }).click();

    await expect(page).toHaveURL(/elementSearchType=property&elementSearch=type:DeltaLakeTableDataObject/);
    await expect(page.getByPlaceholder('Search element')).toHaveValue('type:DeltaLakeTableDataObject');
    // ext-airports is a WebserviceFileDataObject, so it drops out
    await expect(element(page, 'int-airports')).toBeVisible();
    await expect(element(page, 'ext-airports')).toBeHidden();
  });

  test('renders the description of a data object', async ({ page }) => {
    await page.goto('/#/config/dataObjects/btl-distances/description');

    await expect(page.getByRole('tabpanel', { name: 'Description' })).toContainText('distance');
  });

  test('renders the exported schema of a data object', async ({ page }) => {
    await page.goto('/#/config/dataObjects/int-airports/schema');

    const schema = page.getByRole('tabpanel', { name: 'Schema' });
    // the newest export of this fixture failed, it only carries the spark message
    await expect(schema).toContainText('TABLE_OR_VIEW_NOT_FOUND');

    // pick the oldest export, which has the columns
    await schema.getByRole('combobox', { name: 'Schema exported at' }).click();
    await page.getByRole('option').last().click();

    await expect(schema.getByText('ident', { exact: true })).toBeVisible();
    await expect(schema.getByText('latitude_deg', { exact: true })).toBeVisible();
  });

  test('data objects without exported schema have the schema tab disabled', async ({ page }) => {
    await page.goto('/#/config/dataObjects/ext-airports');

    await expect(page.getByRole('tab', { name: 'Schema' })).toBeDisabled();
  });

  test('shows the global options', async ({ page }) => {
    await page.goto('/#/config/globalOptions');

    await expect(page.getByText('spark.sql.shuffle.partitions')).toBeVisible();
  });

  test('links a data object to the runs that wrote it', async ({ page }) => {
    await page.goto('/#/config/dataObjects/int-airports');

    const lastRuns = page.getByRole('link', { name: 'getting-started' }).first();
    await expect(lastRuns).toBeVisible();
    await expect(page.locator('a[href="#/workflows/getting-started/75.1/table"]')).toBeVisible();
  });
});
