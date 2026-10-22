// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { istDay } from '@shiksha/learner-core';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { makeFakeBackend, type FakeBackend } from '../../test/helpers/fake-backend.js';
import { makeEnv } from '../../test/helpers/installed-runtime.js';
import { initApp, signOut } from '../app-state.svelte.js';
import { navigate } from '../router.svelte.js';
import StaffApp from './StaffApp.svelte';
import { staffState } from './staff-state.svelte.js';

let backend: FakeBackend;
let cohort: string;
let priya: string;
let ravi: string;
const button = (name: string | RegExp): HTMLElement => screen.getByRole('button', { name });

async function student(name: string, google: string): Promise<string> {
  const id = crypto.randomUUID();
  await backend.serverFor(google).link({ profileId: id, name });
  await backend.repos.org.setLearnerCohort(id, cohort);
  return id;
}

beforeEach(async () => {
  signOut();
  backend = makeFakeBackend();
  const env = await makeEnv({ account: backend.account });
  initApp(env.runtime);
  staffState.me = null;
  cohort = await backend.repos.org.saveCohort({ name: 'सुबह की लैब', labId: null });
  await backend.repos.staff.save({
    email: 'meena@ngo.example',
    role: 'mentor',
    name: 'मीना',
    active: true,
    cohortIds: [cohort],
  });
  priya = await student('प्रिया', 'google-priya');
  ravi = await student('रवि', 'google-ravi');
  backend.useStaffAccount('meena@ngo.example');
});

async function signedIn(): Promise<void> {
  render(StaffApp);
  await fireEvent.click(await vi.waitFor(() => button('Google से साइन इन करें')));
  await vi.waitFor(() => screen.getByText('मीना'));
}

describe('the mentor actions', () => {
  test('a new code is shown once, large and grouped, and gone after "हो गया"', async () => {
    const { learnerId } = await backend.issueCode('अमन');
    await backend.repos.org.setLearnerCohort(learnerId, cohort);
    navigate({ name: 'staff', view: 'student', id: learnerId });
    await signedIn();
    await fireEvent.click(await vi.waitFor(() => button('नया बैकअप कोड बनाएँ')));
    const code = await vi.waitFor(() => screen.getByTestId('new-code'));
    expect(code.textContent).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(screen.getByText('इसे लिख लें — दोबारा नहीं दिखेगा')).toBeTruthy();
    await fireEvent.click(button('हो गया'));
    expect(screen.queryByTestId('new-code')).toBeNull();
    expect(button('नया बैकअप कोड बनाएँ')).toBeTruthy();
  });

  test('set level lists tracks and lessons from the phone and confirms before saving', async () => {
    navigate({ name: 'staff', view: 'student', id: priya });
    await signedIn();
    const track = await vi.waitFor(() => screen.getByLabelText('विषय'));
    expect([...track.querySelectorAll('option')].map((o) => o.value)).toEqual([
      'english',
      'aptitude',
    ]);
    await fireEvent.change(track, { target: { value: 'aptitude' } });
    const lesson = screen.getByLabelText('यहाँ से शुरू');
    expect([...lesson.querySelectorAll('option')].map((o) => o.value)).toEqual([
      'apt-01',
      'apt-02',
    ]);
    await fireEvent.change(lesson, { target: { value: 'apt-02' } });
    await fireEvent.click(button('स्तर बदलें'));
    await vi.waitFor(() => screen.getByText(/पक्का\?/));
    await fireEvent.click(button('हाँ, बदलें'));
    await vi.waitFor(() => screen.getByText('सेव हो गया'));
    const page = await backend.repos.events.page(priya, 0, 100);
    expect(JSON.stringify(page.events)).toContain('"startLesson":"apt-02"');
  });

  test('attendance lists the cohort for today with checkboxes, saves, and says so', async () => {
    navigate({ name: 'staff', view: 'cohorts' });
    await signedIn();
    await fireEvent.click(await vi.waitFor(() => button('हाज़िरी लगाएँ')));
    expect(screen.getByText(istDay(new Date()))).toBeTruthy();
    await fireEvent.click(screen.getByRole('checkbox', { name: 'प्रिया' }));
    await fireEvent.click(button('हाज़िरी सेव करें'));
    await vi.waitFor(() => screen.getByText('सेव हो गया'));
    const from = istDay(new Date());
    expect(await backend.repos.attendance.forLearner(priya, from)).toEqual([
      { date: from, present: true },
    ]);
    expect(await backend.repos.attendance.forLearner(ravi, from)).toEqual([
      { date: from, present: false },
    ]);
  });

  test('an error shows a plain message and keeps the form', async () => {
    navigate({ name: 'staff', view: 'cohorts' });
    await signedIn();
    await fireEvent.click(await vi.waitFor(() => button('हाज़िरी लगाएँ')));
    await fireEvent.click(screen.getByRole('checkbox', { name: 'प्रिया' }));
    backend.setOnline(false);
    await fireEvent.click(button('हाज़िरी सेव करें'));
    await vi.waitFor(() => screen.getByRole('alert'));
    expect(screen.getByRole('alert').textContent).not.toMatch(/OFFLINE|Error/);
    expect((screen.getByRole('checkbox', { name: 'प्रिया' }) as HTMLInputElement).checked).toBe(
      true,
    );
  });
});
