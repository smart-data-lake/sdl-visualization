import { Page } from '@playwright/test';

/* The layout menu of the lineage toolbar, which shows the icon of the layout in use. */
export type LayoutChoice = 'TB' | 'LR' | 'force';

export const layoutSelector = (page: Page) => page.getByTestId('layout-selector');

export const layoutIcon: Record<LayoutChoice, string> = {
    TB: 'AlignVerticalTopIcon', LR: 'AlignHorizontalLeftIcon', force: 'BubbleChartOutlinedIcon',
};

/* the selector showing the given layout as the one in use */
export const layoutInUse = (page: Page, choice: LayoutChoice) =>
    layoutSelector(page).locator(`[data-testid="${layoutIcon[choice]}"]`);

export async function chooseLayout(page: Page, choice: LayoutChoice) {
    await layoutSelector(page).click();
    await page.getByTestId(`layout-${choice}`).click();
}
