import { expect, test } from '@playwright/test';
import { createProfile } from './helpers.js';
import { next, reachSpeakingItem } from './more-helpers.js';

async function setUp(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await createProfile(page, 'प्रिया', '1234');
  await expect(page.getByRole('button', { name: 'शुरू करें', exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await reachSpeakingItem(page);
}

test('without microphone permission the learner is told why and can carry on', async ({ page }) => {
  await setUp(page);
  await page.getByRole('button', { name: 'रिकॉर्ड करें' }).click();
  await expect(page.getByRole('alert')).toContainText(
    /माइक्रोफ़ोन की अनुमति नहीं मिली|रिकॉर्डिंग नहीं हो पाई/,
  );
  await next(page);
  await expect(page.getByRole('heading', { name: 'पाठ 2 पूरा!' })).toBeVisible();
});

test('a browser that cannot record says so and carries on', async ({ page }) => {
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, 'MediaRecorder');
  });
  await setUp(page);
  await expect(page.getByRole('alert')).toContainText('रिकॉर्डिंग नहीं चल सकती');
  await expect(page.getByRole('button', { name: 'रिकॉर्ड करें' })).toHaveCount(0);
  await next(page);
  await expect(page.getByRole('heading', { name: 'पाठ 2 पूरा!' })).toBeVisible();
});
