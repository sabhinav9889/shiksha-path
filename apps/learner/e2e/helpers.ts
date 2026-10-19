import { expect, type Page } from '@playwright/test';

/** Tap the four digits of a PIN on the on-screen pad. */
export async function enterPin(page: Page, pin: string): Promise<void> {
  for (const digit of pin) {
    await page.getByRole('button', { name: digit, exact: true }).click();
  }
}

/** First-run or "add new" flow: name, language (default Hindi + English), PIN twice. */
export async function createProfile(page: Page, name: string, pin: string): Promise<void> {
  await page.getByLabel('आपका नाम').fill(name);
  await page.getByRole('button', { name: 'आगे', exact: true }).click();
  await enterPin(page, pin);
  await expect(page.getByText('PIN फिर से डालें')).toBeVisible();
  await enterPin(page, pin);
  await expect(page.getByRole('heading', { name: /^नमस्ते, / })).toBeVisible();
}

export async function signIn(page: Page, name: string, pin: string): Promise<void> {
  await page.getByRole('button', { name, exact: true }).click();
  await enterPin(page, pin);
  await expect(page.getByRole('heading', { name: /^नमस्ते, / })).toBeVisible();
}

/** Wait until the service worker controls the page, so a reload works with no network. */
export async function waitForOfflineReady(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
}

/**
 * Answer the five items of fixture lesson 1: four word orders, then the listening choice.
 * `wrongAt` is the item (0-based) to answer wrongly on purpose, if any.
 */
export async function playLesson(page: Page, wrongAt: number | null): Promise<void> {
  for (let item = 0; item < 4; item += 1) {
    const words = item === wrongAt ? ['am', 'I', 'Priya'] : ['I', 'am', 'Priya'];
    for (const word of words) {
      await page.locator(`[data-testid="bank"] button[data-word="${word}"]`).click();
    }
    await page.getByRole('button', { name: 'जाँचें', exact: true }).click();
    await page.getByRole('button', { name: 'आगे', exact: true }).click();
  }
  await page.getByRole('button', { name: item4Option(wrongAt === 4) }).click();
  await page.getByRole('button', { name: 'आगे', exact: true }).click();
}

const item4Option = (wrong: boolean): RegExp => (wrong ? /अलविदा/ : /नमस्ते/);
