import { expect, test, type Page } from '@playwright/test';
import { createProfile, playLesson } from './helpers.js';

const MIN_TAP = 44;
const LONG_NAME = 'अ'.repeat(40);

/** No sideways scrolling, and every visible button and link is big enough to tap. */
async function assertFits(page: Page, screen: string): Promise<void> {
  const problems = await page.evaluate((min) => {
    const found: string[] = [];
    const root = document.documentElement;
    if (root.scrollWidth > root.clientWidth) {
      found.push(`scrolls sideways (${root.scrollWidth} > ${root.clientWidth})`);
    }
    for (const element of document.querySelectorAll('button, a')) {
      const box = element.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      if (box.width < min || box.height < min) {
        const label = (element.textContent ?? '').trim().slice(0, 24);
        found.push(
          `${element.tagName} "${label}" is ${Math.round(box.width)}x${Math.round(box.height)}`,
        );
      }
    }
    return found;
  }, MIN_TAP);
  expect(problems, `${screen} at 360px`).toEqual([]);
}

test('every screen fits a 360 px phone with a 40-character Hindi name', async ({ page }) => {
  await page.goto('/');
  await assertFits(page, 'create profile');
  await createProfile(page, LONG_NAME, '1234');
  await expect(page.getByRole('button', { name: 'शुरू करें' })).toBeVisible({ timeout: 30_000 });
  await assertFits(page, 'home');

  await page.getByRole('link', { name: 'पाठ', exact: true }).click();
  await expect(page.getByRole('button', { name: 'पाठ 1' })).toBeVisible();
  await assertFits(page, 'lessons');

  await page.getByRole('button', { name: 'पाठ 1' }).click();
  await expect(page.getByRole('button', { name: 'अभ्यास करें' })).toBeVisible();
  await assertFits(page, 'lesson');

  await page.getByRole('button', { name: 'अभ्यास करें' }).click();
  await expect(page.getByTestId('bank')).toBeVisible();
  await assertFits(page, 'practice (word order)');
  await playLesson(page, null);
  await expect(page.getByRole('heading', { name: 'पाठ 1 पूरा!' })).toBeVisible();
  await assertFits(page, 'finish');

  await page.goto('/#/profiles');
  await expect(page.getByText('कौन पढ़ रहा है?')).toBeVisible();
  await assertFits(page, 'profile picker');
});
