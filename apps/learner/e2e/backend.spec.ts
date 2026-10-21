import { expect, test, type Page } from '@playwright/test';
import {
  database,
  deleteGoogleUser,
  holdGoogleRedirect,
  learnerOf,
  localStack,
  makeGoogleUser,
  phoneEventIds,
  returnFromGoogle,
  serverEventIds,
  type TestUser,
} from './backend-setup.js';
import { enterPin, playLesson, signIn } from './helpers.js';
import { next, reachSpeakingItem } from './more-helpers.js';

const stack = localStack();
const sql = database(stack);
let user: TestUser;

test.beforeEach(async () => {
  user = await makeGoogleUser(stack);
});

test.afterEach(async () => {
  await deleteGoogleUser(stack, user);
});

test.afterAll(async () => {
  await sql.end();
});

const home = /^नमस्ते, /;

const UPLOADED = 'पाठ अपडेट हो गए';
const SAVED_LATER = 'फ़ोन में सेव · इंटरनेट मिलते ही अपलोड';

/** Tap "sync now" on the me screen and wait for its result (it reads the outcome when done). */
async function syncOnMe(page: Page, outcome: string): Promise<void> {
  await page.getByRole('link', { name: 'मैं', exact: true }).click();
  const button = page.getByRole('button', { name: 'अभी sync करें' });
  await button.click();
  await expect(page.getByText(outcome, { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(button).toBeEnabled();
  if (outcome === UPLOADED) await expect(page.getByText('सब अपलोड हो गया')).toBeVisible();
}

async function goHome(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'होम', exact: true }).click();
  await expect(page.getByRole('heading', { name: home })).toBeVisible();
}

test('progress is backed up, restored on a new phone, and follows the server', async ({
  page,
  browser,
  baseURL,
}) => {
  // Phone 1: a new learner skips connecting, then learns a lesson on the phone only.
  await page.goto('/');
  await page.getByLabel('आपका नाम').fill('प्रिया');
  await page.getByRole('button', { name: 'आगे', exact: true }).click();
  await enterPin(page, '1234');
  await enterPin(page, '1234');
  await page.getByRole('button', { name: 'बाद में' }).click();
  await expect(page.getByRole('heading', { name: home })).toBeVisible();
  await page.getByRole('button', { name: 'शुरू करें', exact: true }).click({ timeout: 30_000 });
  await page.getByRole('button', { name: 'अभ्यास करें' }).click();
  await playLesson(page, null);
  await expect(page.getByRole('heading', { name: 'पाठ 1 पूरा!' })).toBeVisible();
  await page.getByRole('button', { name: 'होम पर जाएँ' }).click();

  // Connect Google from the home nudge; the app's own callback links the profile.
  await holdGoogleRedirect(page);
  await page.getByRole('button', { name: 'Google से जुड़ें' }).click();
  await returnFromGoogle(page, stack, user);
  await expect(page.getByRole('status')).toHaveText('Google से जुड़ गया', { timeout: 20_000 });
  await page.getByRole('button', { name: 'आगे', exact: true }).click();
  await signIn(page, 'प्रिया', '1234');

  // Sync: everything on the phone is now on the server.
  await syncOnMe(page, UPLOADED);
  const learner = await learnerOf(sql, user);
  const onPhone = await phoneEventIds(page, learner);
  expect(onPhone.length).toBeGreaterThan(0);
  expect((await serverEventIds(sql, learner)).sort()).toEqual([...onPhone].sort());

  // Phone 2 (a fresh browser): restore with the same Google account and a new PIN.
  const phone2 = await browser.newContext({
    baseURL: baseURL ?? '',
    viewport: { width: 360, height: 640 },
    locale: 'hi-IN',
  });
  const page2 = await phone2.newPage();
  await page2.goto('/');
  await holdGoogleRedirect(page2);
  await page2.getByRole('button', { name: 'पुरानी प्रोफ़ाइल वापस लाएँ' }).click();
  await enterPin(page2, '5678');
  await enterPin(page2, '5678');
  await returnFromGoogle(page2, stack, user);
  await expect(page2.getByRole('status')).toHaveText('आपकी प्रोफ़ाइल और प्रोग्रेस वापस आ गई', {
    timeout: 20_000,
  });
  await page2.getByRole('button', { name: 'आगे', exact: true }).click();
  await signIn(page2, 'प्रिया', '5678');
  await expect(page2.getByText('पाठ 2', { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page2.getByText('1 दिन', { exact: true })).toBeVisible();

  // The server switches the starting test off for this learner: after a sync the card is gone.
  await expect(page2.getByText('शुरुआती टेस्ट दें')).toBeVisible();
  await sql`
    insert into public.feature_overrides (learner_id, key, enabled)
    values (${learner}, 'placement_test', false)`;
  await syncOnMe(page2, UPLOADED);
  await goHome(page2);
  await expect(page2.getByText('शुरुआती टेस्ट दें')).toHaveCount(0);

  // The server is down: learning goes on and is kept on the phone, then uploads later.
  await page2.route(`${stack.functionsUrl}/**`, (route) => route.abort());
  await reachSpeakingItem(page2);
  await next(page2);
  await expect(page2.getByRole('heading', { name: 'पाठ 2 पूरा!' })).toBeVisible();
  await page2.getByRole('button', { name: 'होम पर जाएँ' }).click();
  await syncOnMe(page2, SAVED_LATER);
  await page2.unroute(`${stack.functionsUrl}/**`);
  await syncOnMe(page2, UPLOADED);
  const onPhone2 = await phoneEventIds(page2, learner);
  expect((await serverEventIds(sql, learner)).sort()).toEqual([...onPhone2].sort());
  expect(onPhone2.length).toBeGreaterThan(onPhone.length);
  await phone2.close();
});
