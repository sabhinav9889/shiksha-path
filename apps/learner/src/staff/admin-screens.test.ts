// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { makeFakeBackend, type FakeBackend } from '../../test/helpers/fake-backend.js';
import { makeEnv } from '../../test/helpers/installed-runtime.js';
import { initApp, signOut } from '../app-state.svelte.js';
import { navigate, type AdminSection } from '../router.svelte.js';
import StaffApp from './StaffApp.svelte';
import { staffState } from './staff-state.svelte.js';

let backend: FakeBackend;
let cohortA: string;
let cohortB: string;
let priya: string;
const button = (name: string | RegExp): HTMLButtonElement =>
  screen.getByRole('button', { name }) as HTMLButtonElement;
const rows = (): HTMLElement[] => screen.queryAllByTestId('admin-student-row');

async function student(name: string, cohort: string): Promise<string> {
  const { learnerId } = await backend.issueCode(name);
  await backend.repos.org.setLearnerCohort(learnerId, cohort);
  return learnerId;
}

beforeEach(async () => {
  signOut();
  backend = makeFakeBackend();
  const env = await makeEnv({ account: backend.account });
  initApp(env.runtime);
  staffState.me = null;
  cohortA = await backend.repos.org.saveCohort({ name: 'सुबह', labId: null });
  cohortB = await backend.repos.org.saveCohort({ name: 'शाम', labId: null });
  await backend.repos.staff.save({
    email: 'boss@ngo.example',
    role: 'admin',
    name: 'सुनीता',
    active: true,
    cohortIds: [],
  });
  priya = await student('प्रिया', cohortB);
  await backend.repos.summaries.refresh(priya, () => ({
    lessonsDone: 0,
    lessonsThisWeek: 0,
    streak: 0,
    lastActiveDay: '2020-01-01',
    currentLesson: null,
    lowScores: false,
    stuckLesson: null,
  }));
  backend.useStaffAccount('boss@ngo.example');
});

async function openAdmin(section: AdminSection): Promise<void> {
  navigate({ name: 'staff', view: 'admin', section });
  render(StaffApp);
  await fireEvent.click(await vi.waitFor(() => button('Google से साइन इन करें')));
  await vi.waitFor(() => button('साइन आउट'));
}

async function type(label: string, value: string): Promise<void> {
  await fireEvent.input(screen.getByLabelText(label), { target: { value } });
}

describe('the admin setup', () => {
  test('creates a lab, a cohort in it, and a mentor invite for that cohort', async () => {
    await openAdmin('setup');
    await vi.waitFor(() => screen.getByLabelText('नई लैब का नाम'));
    await type('नई लैब का नाम', 'रामपुर लैब');
    await fireEvent.click(button('लैब जोड़ें'));
    await vi.waitFor(() => expect(screen.getAllByText('रामपुर लैब').length).toBeGreaterThan(0));
    const [lab] = await backend.repos.org.labs();
    await type('नए समूह का नाम', 'रामपुर सुबह');
    await fireEvent.change(screen.getByLabelText('लैब'), { target: { value: lab?.id } });
    await fireEvent.click(button('समूह जोड़ें'));
    await vi.waitFor(() => screen.getByRole('checkbox', { name: 'रामपुर सुबह' }));
    const cohort = (await backend.repos.org.cohorts('all')).find((c) => c.name === 'रामपुर सुबह');
    expect(cohort?.labId).toBe(lab?.id);
    await type('मेंटर का नाम', 'मीना');
    await type('ईमेल', 'meena@ngo.example');
    await fireEvent.click(screen.getByRole('checkbox', { name: 'रामपुर सुबह' }));
    await fireEvent.click(button('बुलाएँ'));
    await vi.waitFor(() => screen.getByText('meena@ngo.example'));
    const invited = (await backend.repos.staff.list()).find((s) => s.email === 'meena@ngo.example');
    expect(invited).toMatchObject({ role: 'mentor', name: 'मीना', cohortIds: [cohort?.id] });
  });
});

describe('the admin staff list', () => {
  test('an admin pauses a mentor and changes their cohorts', async () => {
    const id = await backend.repos.staff.save({
      email: 'meena@ngo.example',
      role: 'mentor',
      name: 'मीना',
      active: true,
      cohortIds: [cohortA],
    });
    await openAdmin('setup');
    await fireEvent.click(await vi.waitFor(() => button('मीना: बदलें')));
    const panel = screen.getByTestId('staff-edit');
    await fireEvent.click(within(panel).getByRole('checkbox', { name: 'शाम' }));
    await fireEvent.click(within(panel).getByRole('checkbox', { name: 'सक्रिय' }));
    await fireEvent.click(within(panel).getByRole('button', { name: 'सेव करें' }));
    await vi.waitFor(async () =>
      expect(await backend.repos.staff.byId(id)).toMatchObject({
        active: false,
        cohortIds: expect.arrayContaining([cohortA, cohortB]),
      }),
    );
    expect(screen.getByText(/बंद है/)).toBeTruthy();
  });
});

describe('the admin students page', () => {
  test('shows 50 at a time, then more', async () => {
    for (let n = 0; n < 50; n += 1) await student(`छात्र ${String(n).padStart(2, '0')}`, cohortA);
    await openAdmin('students');
    await vi.waitFor(() => expect(rows()).toHaveLength(50));
    await fireEvent.click(button('और दिखाएँ'));
    await vi.waitFor(() => expect(rows()).toHaveLength(51));
    expect(screen.queryByRole('button', { name: 'और दिखाएँ' })).toBeNull();
  });

  test('searches by name and filters by cohort and "needs attention"', async () => {
    await student('रवि', cohortA);
    await student('रविना', cohortB);
    await openAdmin('students');
    await vi.waitFor(() => expect(rows()).toHaveLength(3));
    await type('नाम से खोजें', 'रवि');
    await fireEvent.click(button('खोजें'));
    await vi.waitFor(() => expect(rows()).toHaveLength(2));
    await fireEvent.change(screen.getByLabelText('समूह', { selector: 'select' }), {
      target: { value: cohortB },
    });
    await fireEvent.click(button('खोजें'));
    await vi.waitFor(() => expect(rows()).toHaveLength(1));
    await type('नाम से खोजें', '');
    await fireEvent.click(screen.getByLabelText('सिर्फ़ जिन्हें ध्यान चाहिए'));
    await fireEvent.click(button('खोजें'));
    await vi.waitFor(() =>
      expect(rows().map((r) => r.textContent)).toEqual([expect.stringContaining('प्रिया')]),
    );
  });

  test('moves, deactivates (asking first), sets an override, and deletes (asking twice)', async () => {
    await openAdmin('students');
    await fireEvent.click(await vi.waitFor(() => button('प्रिया')));
    const panel = await vi.waitFor(() => screen.getByTestId('student-actions'));
    await fireEvent.change(within(panel).getByLabelText('नया समूह'), {
      target: { value: cohortA },
    });
    await fireEvent.click(within(panel).getByRole('button', { name: 'समूह बदलें' }));
    await vi.waitFor(async () =>
      expect(await backend.repos.org.cohortOfLearner(priya)).toBe(cohortA),
    );

    await fireEvent.click(within(panel).getByRole('button', { name: 'बंद करें' }));
    expect((await backend.repos.org.student(priya))?.deactivated).toBe(false); // asked first
    await fireEvent.click(within(panel).getByRole('button', { name: 'हाँ, बंद करें' }));
    await vi.waitFor(async () =>
      expect((await backend.repos.org.student(priya))?.deactivated).toBe(true),
    );

    const doubts = await vi.waitFor(() => within(panel).getByLabelText('AI से सवाल'));
    await fireEvent.change(doubts, { target: { value: 'off' } });
    await vi.waitFor(async () =>
      expect(await backend.repos.switches.overrides(priya)).toEqual({ ai_doubts: false }),
    );

    await fireEvent.click(within(panel).getByRole('button', { name: 'हटाएँ' }));
    await vi.waitFor(() => within(panel).getByText('हमेशा के लिए हटाएँ?'));
    await fireEvent.click(within(panel).getByRole('button', { name: 'हाँ' }));
    const confirm = within(panel).getByRole('button', { name: 'हमेशा के लिए हटाएँ' });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    await fireEvent.input(within(panel).getByLabelText('पक्का करने के लिए छात्र का नाम लिखें'), {
      target: { value: 'प्रिया' },
    });
    expect((confirm as HTMLButtonElement).disabled).toBe(false);
    await fireEvent.click(confirm);
    await vi.waitFor(() => expect(rows()).toHaveLength(0));
    expect(await backend.repos.org.student(priya)).toBeNull();
  });
});

describe('the delete confirmation', () => {
  test('accepts a name typed in a different Unicode form than the one stored', async () => {
    // The same Hindi letter two ways: one code point (U+095C) and base letter plus nukta.
    const stored = `ग${String.fromCharCode(0x095c)}`;
    const typed = `ग${String.fromCharCode(0x0921, 0x093c)}`;
    expect(stored).not.toBe(typed);
    await student(stored, cohortA);
    await openAdmin('students');
    await fireEvent.click(await vi.waitFor(() => button(stored)));
    const panel = await vi.waitFor(() => screen.getByTestId('student-actions'));
    await fireEvent.click(within(panel).getByRole('button', { name: 'हटाएँ' }));
    await fireEvent.click(
      await vi.waitFor(() => within(panel).getByRole('button', { name: 'हाँ' })),
    );
    await fireEvent.input(within(panel).getByLabelText('पक्का करने के लिए छात्र का नाम लिखें'), {
      target: { value: typed },
    });
    const confirm = within(panel).getByRole('button', { name: 'हमेशा के लिए हटाएँ' });
    expect((confirm as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('the admin switches page', () => {
  test('shows each all-students value and saves a change', async () => {
    await openAdmin('switches');
    const booking = (await vi.waitFor(() =>
      screen.getByRole('checkbox', { name: 'मेंटर से मिलना' }),
    )) as HTMLInputElement;
    expect(booking.checked).toBe(true);
    await fireEvent.click(booking);
    await vi.waitFor(() => screen.getByText('सेव हो गया'));
    expect((await backend.repos.switches.allStudents()).mentor_booking).toBe(false);
  });
});

describe('the admin branding page', () => {
  test('shows contrast as you type and blocks colours hard to read on white or the page', async () => {
    await openAdmin('branding');
    await vi.waitFor(() => screen.getByLabelText('दूसरा रंग'));
    await type('दूसरा रंग', '#767676'); // fine on white, too light on the page background
    await vi.waitFor(() => screen.getByText(/पढ़ने में मुश्किल/));
    expect(button('ब्रांडिंग सेव करें').disabled).toBe(true);
    await type('दूसरा रंग', '#9a3412');
    await type('मुख्य रंग', '#1f6f43');
    await type('नाम (हिंदी)', 'नई राह');
    expect(button('ब्रांडिंग सेव करें').disabled).toBe(false);
    await fireEvent.click(button('ब्रांडिंग सेव करें'));
    await vi.waitFor(() => screen.getByText(/सेव हो गया/));
    expect(await backend.repos.branding.get()).toMatchObject({
      name: { hi: 'नई राह', en: 'Shiksha Path' },
      primary: '#1f6f43',
      accent: '#9a3412',
    });
  });
});

describe('the admin audit page', () => {
  test('lists entries newest first, deleted students shown anonymously', async () => {
    await openAdmin('audit');
    const api = backend.staffAuth.api;
    await api.setActive({ learnerId: priya, active: false });
    await api.deleteStudent({ learnerId: priya });
    navigate({ name: 'staff', view: 'admin', section: 'setup' });
    await vi.waitFor(() => screen.getByLabelText('नई लैब का नाम'));
    navigate({ name: 'staff', view: 'admin', section: 'audit' });
    const entries = await vi.waitFor(() => {
      const found = screen.getAllByTestId('audit-row');
      expect(found).toHaveLength(2);
      return found;
    });
    expect(entries[0]?.textContent).toContain('छात्र हटाया');
    expect(entries[1]?.textContent).toContain('छात्र बंद किया');
    for (const row of entries) {
      expect(row.textContent).toContain('हटाया गया छात्र');
      expect(row.textContent).toContain('सुनीता');
      expect(row.textContent).not.toContain(priya);
    }
  });
});
