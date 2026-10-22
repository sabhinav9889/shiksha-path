import { expect, test, type Page } from '@playwright/test';
import {
  database,
  deleteGoogleUser,
  deleteStudent,
  holdGoogleRedirect,
  issueBackupCode,
  learnerOf,
  localStack,
  makeGoogleUser,
  phoneEventIds,
  returnFromGoogle,
  serverEventIds,
  storedRecordings,
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

test('a student with a backup code brings their profile to a new phone', async ({
  browser,
  baseURL,
}) => {
  const issued = await issueBackupCode(stack, sql, 'कोड वाली');
  const phone = await browser.newContext({
    baseURL: baseURL ?? '',
    viewport: { width: 360, height: 640 },
    locale: 'hi-IN',
  });
  try {
    const page = await phone.newPage();
    await page.goto('/');
    await page.getByRole('button', { name: 'पुरानी प्रोफ़ाइल वापस लाएँ' }).click();
    await page.getByRole('button', { name: 'मेरे पास कोड है' }).click();
    await enterPin(page, '2468');
    await enterPin(page, '2468');
    await page.getByLabel('अपना कोड लिखें').fill(issued.code.toLowerCase());
    await page.getByRole('button', { name: 'कोड से जुड़ें' }).click();
    await expect(page.getByRole('status')).toHaveText('आपकी प्रोफ़ाइल और प्रोग्रेस वापस आ गई', {
      timeout: 20_000,
    });
    await page.getByRole('button', { name: 'आगे', exact: true }).click();
    await signIn(page, 'कोड वाली', '2468');
  } finally {
    await phone.close();
    await issued.cleanup();
  }
});

test('a recording uploads on Wi-Fi, and a deleted student is wiped from their phone', async ({
  page,
}) => {
  // The phone reports Wi-Fi (Chrome on Android has this; desktop Chrome does not say).
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'connection', { value: { type: 'wifi' } });
  });
  await page.goto('/');
  await page.getByLabel('आपका नाम').fill('रिया');
  await page.getByRole('button', { name: 'आगे', exact: true }).click();
  await enterPin(page, '1357');
  await enterPin(page, '1357');
  await page.getByRole('button', { name: 'बाद में' }).click();
  await expect(page.getByRole('button', { name: 'शुरू करें', exact: true })).toBeVisible({
    timeout: 30_000,
  });

  // Record on the speaking item with the fake microphone.
  await reachSpeakingItem(page);
  await page.getByRole('button', { name: 'रिकॉर्ड करें' }).click();
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'रोकें' }).click();
  await expect(page.getByText('रिकॉर्डिंग सेव हो गई')).toBeVisible();
  await next(page);
  await expect(page.getByRole('heading', { name: 'पाठ 2 पूरा!' })).toBeVisible();
  await page.getByRole('button', { name: 'होम पर जाएँ' }).click();

  // Connect, then sync on Wi-Fi: the recording reaches the bucket.
  await holdGoogleRedirect(page);
  await page.getByRole('button', { name: 'Google से जुड़ें' }).click();
  await returnFromGoogle(page, stack, user);
  await expect(page.getByRole('status')).toHaveText('Google से जुड़ गया', { timeout: 20_000 });
  await page.getByRole('button', { name: 'आगे', exact: true }).click();
  await signIn(page, 'रिया', '1357');
  await syncOnMe(page, UPLOADED);
  const learner = await learnerOf(sql, user);
  await expect.poll(() => storedRecordings(stack, learner)).toHaveLength(1);
  const [row] = await sql<{ status: string }[]>`
    select status from public.recordings where learner_id = ${learner}`;
  expect(row?.status).toBe('uploaded');

  // The NGO deletes the student on request; the next sync wipes the phone's copy.
  await deleteStudent(stack, sql, learner);
  await page.getByRole('button', { name: 'अभी sync करें' }).click();
  await expect(page.getByText('यह प्रोफ़ाइल NGO के कहने पर हटा दी गई')).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole('button', { name: 'रिया', exact: true })).toHaveCount(0);
  expect(await phoneEventIds(page, learner)).toEqual([]);
});
