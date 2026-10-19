import { expect, type Page } from '@playwright/test';

const MIN_TAP = 44;

/** No sideways scrolling, and every visible button and link is big enough to tap. */
export async function assertFits(page: Page, screen: string): Promise<void> {
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
  expect(problems, screen).toEqual([]);
}

/** Answer the word-order item on screen ("I am Priya"), rightly or not, and check it. */
export async function answerOrder(page: Page, right: boolean): Promise<void> {
  for (const word of right ? ['I', 'am', 'Priya'] : ['am', 'I', 'Priya']) {
    await page.locator(`[data-testid="bank"] button[data-word="${word}"]`).click();
  }
  await page.getByRole('button', { name: 'जाँचें', exact: true }).click();
}

export const next = (page: Page): Promise<void> =>
  page.getByRole('button', { name: 'आगे', exact: true }).click();

/** Take the fixture's starting test: 5 English items (`englishRight` of them right), 2 aptitude. */
export async function takePlacement(page: Page, englishRight: number): Promise<void> {
  await page.getByRole('button', { name: /शुरुआती टेस्ट दें/ }).click();
  for (let item = 0; item < 7; item += 1) {
    await answerOrder(page, item >= 5 || item < englishRight);
    await expect(page.getByRole('status')).toHaveCount(0); // no right or wrong in the test
    await next(page);
  }
  await expect(page.getByRole('heading', { name: 'आपका नतीजा' })).toBeVisible();
}

/** Open English lesson 2 (five word orders, then the speaking item) and answer the word orders. */
export async function reachSpeakingItem(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'पाठ', exact: true }).click();
  await page.getByRole('button', { name: 'पाठ 2' }).click();
  await page.getByRole('button', { name: 'अभ्यास करें' }).click();
  for (let item = 0; item < 5; item += 1) {
    await answerOrder(page, true);
    await next(page);
  }
  await expect(page.getByText('Hello, my name is Priya.')).toBeVisible();
}
