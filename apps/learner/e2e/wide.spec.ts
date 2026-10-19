import { expect, test, type Page } from '@playwright/test';
import { createProfile } from './helpers.js';
import { assertFits, takePlacement } from './more-helpers.js';

const READABLE = 640;

/** The navigation sits on the left, full height, and there is no bottom bar. */
async function assertSideNav(page: Page, width: number): Promise<void> {
  const nav = page.getByRole('navigation');
  const box = await nav.boundingBox();
  const viewport = page.viewportSize();
  expect(box?.x).toBe(0);
  expect(box?.width).toBe(width);
  expect(box?.height).toBe(viewport?.height);
}

for (const [width, height, rail] of [
  [768, 1024, 96],
  [1280, 800, 220],
] as const) {
  test(`at ${width} px every screen fits and the navigation is a ${rail} px side bar`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await createProfile(page, 'प्रिया', '1234');
    await expect(page.getByRole('button', { name: 'शुरू करें', exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await assertSideNav(page, rail);
    await assertFits(page, `home at ${width}`);

    await page.getByRole('link', { name: 'पाठ', exact: true }).click();
    await expect(page.getByRole('button', { name: 'पाठ 1' })).toBeVisible();
    await assertSideNav(page, rail);
    await assertFits(page, `lessons at ${width}`);

    await page.getByRole('link', { name: 'मैं', exact: true }).click();
    await expect(page.getByTestId('module-row').first()).toBeVisible();
    await assertSideNav(page, rail);
    await assertFits(page, `me at ${width}`);

    await page.getByRole('link', { name: 'पाठ', exact: true }).click();
    await page.getByRole('button', { name: 'पाठ 1' }).click();
    await page.getByRole('button', { name: 'अभ्यास करें' }).click();
    await expect(page.getByTestId('bank')).toBeVisible();
    const column = await page.locator('section.practice').boundingBox();
    expect(column?.width).toBeLessThanOrEqual(READABLE);
    await assertFits(page, `practice at ${width}`);

    await page.getByRole('button', { name: 'बंद करें' }).click();
    await page.getByRole('button', { name: 'छोड़ें' }).click();
    await page.getByRole('link', { name: 'होम', exact: true }).click();
    await takePlacement(page, 3);
    await assertFits(page, `placement result at ${width}`);
  });
}
