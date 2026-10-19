import { expect, test } from '@playwright/test';
import { createProfile, enterPin, playLesson, signIn, waitForOfflineReady } from './helpers.js';

test('a learner can install, go offline, learn, and come back to their progress', async ({
  page,
  context,
}) => {
  // Online, first visit: make a profile, and the lessons download by themselves.
  await page.goto('/');
  await createProfile(page, 'प्रिया', '1234');
  await expect(page.getByRole('button', { name: 'शुरू करें' })).toBeVisible({ timeout: 30_000 });
  await waitForOfflineReady(page);

  // Offline from here on: a cold reload still opens the app.
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('कौन पढ़ रहा है?')).toBeVisible();
  await signIn(page, 'प्रिया', '1234');
  await expect(page.getByText('पाठ 1', { exact: true })).toBeVisible();

  // A reload in the middle of the lesson text, then in the middle of practice, loses only the run.
  await page.getByRole('button', { name: 'शुरू करें' }).click();
  await expect(page.getByRole('button', { name: 'अभ्यास करें' })).toBeVisible();
  await page.reload();
  await signIn(page, 'प्रिया', '1234');
  await page.getByRole('button', { name: 'शुरू करें' }).click();
  await page.getByRole('button', { name: 'अभ्यास करें' }).click();
  await expect(page.getByTestId('bank')).toBeVisible();
  await page.reload();
  await signIn(page, 'प्रिया', '1234');
  await expect(page.getByText('पाठ 1', { exact: true })).toBeVisible(); // not finished: still lesson 1

  // Learn: today's lesson, the practice, one deliberate mistake.
  await page.getByRole('button', { name: 'शुरू करें' }).click();
  await page.getByRole('button', { name: 'अभ्यास करें' }).click();
  await playLesson(page, 2);
  await expect(page.getByRole('heading', { name: 'पाठ 1 पूरा!' })).toBeVisible();
  await expect(page.getByText('5 में से 4 सही · 1 दिन की streak')).toBeVisible();
  await expect(page.getByText('फ़ोन में सेव · इंटरनेट मिलते ही अपलोड')).toBeVisible();

  // Reload offline mid-way: progress is still there after signing in again.
  await page.reload();
  await expect(page.getByText('कौन पढ़ रहा है?')).toBeVisible();
  await signIn(page, 'प्रिया', '1234');
  await expect(page.getByText('पाठ 2', { exact: true })).toBeVisible();
  await expect(page.getByText('1 दिन', { exact: true })).toBeVisible();

  // A second learner on the same phone starts from the beginning.
  await page.goto('/#/profiles');
  await page.getByRole('button', { name: 'नया जोड़ें' }).click();
  await createProfile(page, 'रोहित', '5678');
  await expect(page.getByText('पाठ 1', { exact: true })).toBeVisible();
  await expect(page.getByText('0 दिन', { exact: true })).toBeVisible();

  // Five wrong PINs lock the first learner's profile.
  await page.goto('/#/profiles');
  await page.getByRole('button', { name: 'प्रिया', exact: true }).click();
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    await enterPin(page, '0000');
    await expect(page.getByRole('alert')).toContainText(`${5 - attempt} कोशिशें बाकी`);
  }
  await enterPin(page, '0000');
  await expect(page.getByRole('alert')).toContainText('सेकंड');
});
