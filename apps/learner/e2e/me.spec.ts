import { expect, test } from '@playwright/test';
import { createProfile, signIn, waitForOfflineReady } from './helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await createProfile(page, 'प्रिया', '1234');
  await expect(page.getByRole('button', { name: 'शुरू करें', exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole('link', { name: 'मैं', exact: true }).click();
});

test('language, storage and an offline sync are shown plainly', async ({ page, context }) => {
  await expect(page.getByTestId('module-row')).toHaveCount(2);
  await waitForOfflineReady(page);
  await signIn(page, 'प्रिया', '1234');
  await page.getByRole('link', { name: 'मैं', exact: true }).click();
  await context.setOffline(true);
  await page.getByRole('button', { name: 'अभी sync करें' }).click();
  await expect(page.getByRole('status')).toContainText('फ़ोन में सेव');
  await page.getByRole('button', { name: /English only/ }).click();
  await expect(page.getByRole('heading', { name: 'Language' })).toBeVisible();
});

for (const label of ['प्रोफ़ाइल बदलें', 'साइन आउट']) {
  test(`"${label}" leaves nothing for the next learner, and Back does not return`, async ({
    page,
  }) => {
    await page.getByRole('button', { name: label }).click();
    await expect(page.getByText('कौन पढ़ रहा है?')).toBeVisible();
    await page.goBack();
    await expect(page.getByText('कौन पढ़ रहा है?')).toBeVisible();
    await expect(page.getByRole('button', { name: label })).toHaveCount(0);

    await page.getByRole('button', { name: 'नया जोड़ें' }).click();
    await createProfile(page, 'रोहित', '5678');
    await page.getByRole('link', { name: 'मैं', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'रोहित' })).toBeVisible();
    await expect(page.getByText(/^0 रिकॉर्डिंग · /)).toBeVisible();
    await expect(page.getByText('प्रिया')).toHaveCount(0);
  });
}
