import { expect, test } from '@playwright/test';
import { createProfile, signIn } from './helpers.js';
import { answerOrder, takePlacement } from './more-helpers.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await createProfile(page, 'प्रिया', '1234');
  await expect(page.getByRole('button', { name: /शुरुआती टेस्ट दें/ })).toBeVisible({
    timeout: 30_000,
  });
});

test('the starting test sets where a learner begins', async ({ page }) => {
  await takePlacement(page, 3);
  await expect(page.getByText('अंग्रेज़ी: 60%')).toBeVisible();
  await expect(page.getByText('आप "पाठ 2" से शुरू करेंगे')).toBeVisible();
  await page.getByRole('button', { name: 'शुरू करें', exact: true }).click();
  await expect(page.getByText('पाठ 2', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /शुरुआती टेस्ट दें/ })).toHaveCount(0);
});

test('a reload in the middle of the test ends it without a result', async ({ page }) => {
  await page.getByRole('button', { name: /शुरुआती टेस्ट दें/ }).click();
  await answerOrder(page, true);
  await page.reload();
  await signIn(page, 'प्रिया', '1234');
  await expect(page.getByRole('button', { name: /शुरुआती टेस्ट दें/ })).toBeVisible();
  await expect(page.getByText('पाठ 1', { exact: true })).toBeVisible();
});

test('skipping starts from the first lesson and is remembered', async ({ page }) => {
  await page.getByRole('button', { name: /शुरुआती टेस्ट दें/ }).click();
  await page.getByRole('button', { name: 'छोड़ें, शुरू से पढ़ूँगा' }).click();
  await page.getByRole('button', { name: 'हाँ, छोड़ें' }).click();
  await expect(page.getByText('पाठ 1', { exact: true })).toBeVisible();
  await page.reload();
  await signIn(page, 'प्रिया', '1234');
  await expect(page.getByRole('button', { name: /शुरुआती टेस्ट दें/ })).toHaveCount(0);
});

test('strong English suggests English only, and accepting switches the interface', async ({
  page,
}) => {
  await takePlacement(page, 5);
  await expect(page.getByText('आपकी English अच्छी है')).toBeVisible();
  await page.getByRole('button', { name: 'हाँ, सिर्फ़ English' }).click();
  await expect(page.getByText(/You will start at/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByRole('heading', { name: /^Hello, / })).toBeVisible();
});
