import { expect, test } from '@playwright/test';
import { createProfile, signIn } from './helpers.js';
import { next, reachSpeakingItem } from './more-helpers.js';

// Runs in the "chromium-mic" project: a fake microphone, permission granted.
test('a learner records, hears it back, records again, and it is kept', async ({ page }) => {
  await page.goto('/');
  await createProfile(page, 'प्रिया', '1234');
  await expect(page.getByRole('button', { name: 'शुरू करें', exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await reachSpeakingItem(page);
  await expect(page.getByText('सिर्फ़ आपको और आपके मेंटर को')).toBeVisible();

  await page.getByRole('button', { name: 'रिकॉर्ड करें' }).click();
  await expect(page.getByText(/सेकंड बाकी/)).toBeVisible();
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: 'रोकें' }).click();
  await expect(page.getByText('रिकॉर्डिंग सेव हो गई')).toBeVisible();
  await page.getByRole('button', { name: 'मेरी रिकॉर्डिंग सुनें' }).click();
  await page.getByRole('button', { name: 'फिर से रिकॉर्ड करें' }).click();
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: 'रोकें' }).click();
  await expect(page.getByText('रिकॉर्डिंग सेव हो गई')).toBeVisible();
  await next(page);
  await expect(page.getByRole('heading', { name: 'पाठ 2 पूरा!' })).toBeVisible();

  await page.reload();
  await signIn(page, 'प्रिया', '1234');
  await page.getByRole('link', { name: 'मैं', exact: true }).click();
  await expect(page.getByText(/^1 रिकॉर्डिंग · /)).toBeVisible();
});
