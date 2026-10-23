import { randomUUID } from 'node:crypto';
import { expect, test, type Browser, type Page } from '@playwright/test';
import {
  database,
  deleteGoogleUser,
  deleteStudent,
  holdGoogleRedirect,
  localStack,
  makeGoogleUser,
  ownerAddsStaff,
  phoneEventIds,
  returnToStaff,
  serverEventIds,
  storedRecordings,
  type TestUser,
} from './backend-setup.js';
import { enterPin, playLesson, signIn } from './helpers.js';
import { assertFits, next, reachSpeakingItem } from './more-helpers.js';

const stack = localStack();
const sql = database(stack);
const UPLOADED = 'पाठ अपडेट हो गए';
const PAUSED = 'आपकी प्रोफ़ाइल अभी बंद है — अपने मेंटर से बात करें';
const run = randomUUID().slice(0, 8);
const LAB = `e2e लैब ${run}`;
const COHORT = `e2e समूह ${run}`;
const STUDENT = 'कविता';
const COMMENT = `साफ़ बोलीं ${run}`;

let admin: TestUser;
let mentor: TestUser;
let learnerId: string | null = null;

test.beforeEach(async () => {
  [admin, mentor] = [await makeGoogleUser(stack), await makeGoogleUser(stack)];
});

test.afterEach(async () => {
  if (learnerId) await deleteStudent(stack, sql, learnerId).catch(() => undefined);
  await sql`delete from public.staff where email in (${admin.email}, ${mentor.email})`;
  await sql`delete from public.cohorts where name = ${COHORT}`;
  await sql`delete from public.labs where name = ${LAB}`;
  for (const user of [admin, mentor]) await deleteGoogleUser(stack, user);
});

test.afterAll(async () => {
  await sql.end();
});

async function staffPage(browser: Browser, baseURL: string, width: number): Promise<Page> {
  const context = await browser.newContext({
    baseURL,
    viewport: { width, height: 800 },
    locale: 'hi-IN',
  });
  return context.newPage();
}

/** Open the staff section and sign in with the Google stand-in. */
async function staffSignIn(page: Page, user: TestUser, name: string): Promise<void> {
  await page.goto('/#/staff');
  await holdGoogleRedirect(page);
  await page.getByRole('button', { name: 'Google से साइन इन करें' }).click();
  await returnToStaff(page, stack, user);
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible({ timeout: 20_000 });
}

async function syncOnMe(page: Page, outcome: string): Promise<void> {
  await page.getByRole('link', { name: 'मैं', exact: true }).click();
  const button = page.getByRole('button', { name: 'अभी sync करें' });
  await button.click();
  await expect(page.getByText(outcome, { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(button).toBeEnabled();
}

/** Fits at phone and desktop widths: no sideways scroll, every button and link tappable. */
async function fitsBoth(page: Page, screen: string): Promise<void> {
  for (const width of [360, 1024]) {
    await page.setViewportSize({ width, height: 800 });
    await assertFits(page, `${screen} at ${width}px`);
  }
}

test('an admin sets up, a mentor teaches, and every step is in the audit log', async ({
  page,
  browser,
  baseURL,
}) => {
  // 1. The owner adds the first admin; the admin sets up a lab, a cohort and a mentor.
  await ownerAddsStaff(stack, { email: admin.email, role: 'admin', name: 'सुनीता' });
  const adminPage = await staffPage(browser, baseURL ?? '', 1024);
  await staffSignIn(adminPage, admin, 'सुनीता');
  await adminPage.goto('/#/staff/admin/setup');
  await adminPage.getByLabel('नई लैब का नाम').fill(LAB);
  await adminPage.getByRole('button', { name: 'लैब जोड़ें' }).click();
  await expect(adminPage.getByRole('option', { name: LAB })).toBeAttached();
  await adminPage.getByLabel('नए समूह का नाम').fill(COHORT);
  await adminPage.getByRole('combobox', { name: 'लैब', exact: true }).selectOption({ label: LAB });
  await adminPage.getByRole('button', { name: 'समूह जोड़ें' }).click();
  await adminPage.getByLabel('मेंटर का नाम').fill('मीना');
  await adminPage.getByLabel('ईमेल').fill(mentor.email);
  await adminPage.getByRole('checkbox', { name: COHORT }).check();
  await adminPage.getByRole('button', { name: 'बुलाएँ' }).click();
  await expect(adminPage.getByText(mentor.email)).toBeVisible();

  // 2. The mentor signs in and adds a student, who joins on their phone with the code.
  const mentorPage = await staffPage(browser, baseURL ?? '', 360);
  await staffSignIn(mentorPage, mentor, 'मीना');
  await expect(mentorPage.getByRole('heading', { name: COHORT })).toBeVisible();
  await mentorPage.getByLabel('नए छात्र का नाम').fill(STUDENT);
  await mentorPage.getByRole('button', { name: 'नया छात्र जोड़ें' }).click();
  const code = (await mentorPage.getByTestId('new-code').textContent()) ?? '';
  expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  await mentorPage.getByRole('button', { name: 'हो गया' }).click();
  await expect(mentorPage.getByTestId('new-code')).toHaveCount(0);
  const [row] = await sql<{ id: string }[]>`
    select l.id from public.learners l join public.cohorts c on c.id = l.cohort_id
    where c.name = ${COHORT} and l.name = ${STUDENT}`;
  learnerId = row?.id ?? null;
  expect(learnerId).toBeTruthy();

  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'connection', { value: { type: 'wifi' } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'पुरानी प्रोफ़ाइल वापस लाएँ' }).click();
  await page.getByRole('button', { name: 'मेरे पास कोड है' }).click();
  await enterPin(page, '2468');
  await enterPin(page, '2468');
  await page.getByLabel('अपना कोड लिखें').fill(code);
  await page.getByRole('button', { name: 'कोड से जुड़ें' }).click();
  await expect(page.getByRole('status')).toHaveText('आपकी प्रोफ़ाइल और प्रोग्रेस वापस आ गई', {
    timeout: 20_000,
  });
  await page.getByRole('button', { name: 'आगे', exact: true }).click();
  await signIn(page, STUDENT, '2468');
  await expect(page.getByRole('button', { name: 'शुरू करें', exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await reachSpeakingItem(page);
  await page.getByRole('button', { name: 'रिकॉर्ड करें' }).click();
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'रोकें' }).click();
  await expect(page.getByText('रिकॉर्डिंग सेव हो गई')).toBeVisible();
  await next(page);
  await page.getByRole('button', { name: 'होम पर जाएँ' }).click();
  await syncOnMe(page, UPLOADED);
  await expect.poll(() => storedRecordings(stack, learnerId ?? '')).toHaveLength(1);

  // 3. The mentor plays and reviews the recording, then moves English on to lesson 3.
  await mentorPage.goto('/#/staff/recordings');
  await mentorPage.getByRole('button', { name: /ef1-02 सुनें/ }).click();
  await expect(mentorPage.locator('audio')).toHaveAttribute('src', new RegExp(learnerId ?? ''));
  await mentorPage.getByLabel('टिप्पणी (वैकल्पिक)').fill(COMMENT);
  await mentorPage.getByRole('button', { name: 'सुन लिया' }).click();
  await expect(mentorPage.getByText('सब रिकॉर्डिंग सुन ली गईं')).toBeVisible();

  await mentorPage.goto('/#/staff');
  await expect(mentorPage.getByTestId('student-row')).toHaveCount(1);
  await fitsBoth(mentorPage, 'cohorts');
  await mentorPage.getByRole('link', { name: STUDENT }).click();
  const lesson = mentorPage.getByLabel('यहाँ से शुरू');
  await expect(lesson.locator('option[value="ef1-03"]')).toBeAttached({ timeout: 30_000 });
  await fitsBoth(mentorPage, 'student');
  await mentorPage.getByLabel('विषय').selectOption('english');
  await lesson.selectOption('ef1-03');
  await mentorPage.getByRole('button', { name: 'स्तर बदलें' }).click();
  await mentorPage.getByRole('button', { name: 'हाँ, बदलें' }).click();
  await expect(mentorPage.getByText('सेव हो गया')).toBeVisible();

  await syncOnMe(page, UPLOADED);
  await page.getByRole('link', { name: 'होम', exact: true }).click();
  await expect(page.getByText('पाठ 3', { exact: true })).toBeVisible({ timeout: 20_000 });

  // 4. The admin pauses the student: the phone says so, and learning still works.
  await adminPage.goto('/#/staff/admin/students');
  await adminPage
    .getByRole('combobox', { name: 'समूह', exact: true })
    .selectOption({ label: COHORT });
  await adminPage.getByRole('button', { name: 'खोजें' }).click();
  await expect(adminPage.getByTestId('admin-student-row')).toHaveCount(1);
  await fitsBoth(adminPage, 'admin students');
  await adminPage.getByRole('button', { name: STUDENT, exact: true }).click();
  await adminPage.getByRole('button', { name: 'बंद करें' }).click();
  await adminPage.getByRole('button', { name: 'हाँ, बंद करें' }).click();
  await expect(adminPage.getByRole('button', { name: 'फिर से चालू करें' })).toBeVisible();

  await page.getByRole('link', { name: 'मैं', exact: true }).click();
  await page.getByRole('button', { name: 'अभी sync करें' }).click();
  await expect(page.getByText(PAUSED)).toBeVisible({ timeout: 20_000 });
  await page.getByRole('link', { name: 'पाठ', exact: true }).click();
  await page.getByRole('button', { name: 'पाठ 1' }).click();
  await page.getByRole('button', { name: 'अभ्यास करें' }).click();
  await playLesson(page, null);
  await expect(page.getByRole('heading', { name: 'पाठ 1 पूरा!' })).toBeVisible();
  await page.getByRole('button', { name: 'होम पर जाएँ' }).click();

  // 5. The admin turns the student back on: the work done meanwhile uploads.
  await adminPage.getByRole('button', { name: 'फिर से चालू करें' }).click();
  await expect(adminPage.getByRole('button', { name: 'बंद करें' })).toBeVisible();
  await syncOnMe(page, UPLOADED);
  const onPhone = await phoneEventIds(page, learnerId ?? '');
  expect((await serverEventIds(sql, learnerId ?? '')).sort()).toEqual([...onPhone].sort());

  // 6. The audit log has each step, and never a code or a comment's words.
  await adminPage.goto('/#/staff/admin/audit');
  const log = adminPage.getByTestId('audit-row');
  await expect(log.first()).toBeVisible();
  const text = (await log.allTextContents()).join('\n');
  for (const step of [
    'लैब सेव की',
    'समूह सेव किया',
    'स्टाफ़ बुलाया',
    'कोड बनाया',
    'रिकॉर्डिंग सुनी',
    'स्तर बदला',
    'छात्र बंद किया',
    'छात्र फिर चालू किया',
  ]) {
    expect(text).toContain(step);
  }
  expect(text).not.toContain(code);
  expect(text).not.toContain(code.replace('-', ''));
  expect(text).not.toContain(COMMENT);
  await adminPage.context().close();
  await mentorPage.context().close();
});
