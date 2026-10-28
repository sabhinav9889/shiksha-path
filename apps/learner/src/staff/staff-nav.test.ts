// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { makeFakeBackend, type FakeBackend } from '../../test/helpers/fake-backend.js';
import { makeEnv } from '../../test/helpers/installed-runtime.js';
import { initApp, signOut } from '../app-state.svelte.js';
import { navigate, startRouter, type Route } from '../router.svelte.js';
import StaffApp from './StaffApp.svelte';
import { setStaffLang } from './staff-lang.svelte.js';
import { staffState } from './staff-state.svelte.js';

let backend: FakeBackend;
let student: string;
let stopRouter: (() => void) | null = null;

afterEach(() => stopRouter?.());

beforeEach(async () => {
  signOut();
  localStorage.clear();
  setStaffLang('hi');
  backend = makeFakeBackend();
  const env = await makeEnv({ account: backend.account });
  initApp(env.runtime);
  staffState.me = null;
  const cohort = await backend.repos.org.saveCohort({ name: 'सुबह', labId: null });
  await backend.repos.staff.save({
    email: 'boss@ngo.example',
    role: 'admin',
    name: 'सुनीता',
    active: true,
    cohortIds: [],
  });
  const { learnerId } = await backend.issueCode('प्रिया');
  await backend.repos.org.setLearnerCohort(learnerId, cohort);
  student = learnerId;
  backend.useStaffAccount('boss@ngo.example');
});

async function openAt(route: Route): Promise<void> {
  navigate(route);
  stopRouter = startRouter(); // the app shell follows the address bar; so does this test
  render(StaffApp);
  await fireEvent.click(
    await vi.waitFor(() => screen.getByRole('button', { name: 'Google से साइन इन करें' })),
  );
  await vi.waitFor(() => screen.getByRole('button', { name: 'साइन आउट' }));
}

const current = (): string[] =>
  screen
    .getAllByRole('link')
    .filter((a) => a.getAttribute('aria-current') === 'page')
    .map((a) => a.textContent?.trim() ?? '');

describe('the staff bar shows where you are', () => {
  test.each([
    ['the cohort list', { name: 'staff', view: 'cohorts' }, 'समूह'],
    ['the recordings page', { name: 'staff', view: 'recordings' }, 'रिकॉर्डिंग'],
    ['an admin section', { name: 'staff', view: 'admin', section: 'switches' }, 'फ़ीचर'],
    [
      'a student page (it sits under the cohorts)',
      { name: 'staff', view: 'student', id: 'x' },
      'समूह',
    ],
  ] as const)(
    'on %s exactly that link is marked current, and the page has a title',
    async (_n, route, label) => {
      await openAt(route.view === 'student' ? { ...route, id: student } : route);
      expect(current()).toEqual([label]);
      if (route.view !== 'student') {
        expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(label);
      }
    },
  );

  test('the mark follows a tap on another link', async () => {
    await openAt({ name: 'staff', view: 'cohorts' });
    await fireEvent.click(screen.getByRole('link', { name: 'लॉग' }));
    await vi.waitFor(() => expect(current()).toEqual(['लॉग']));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('लॉग');
  });
});

describe('the cohort names in the staff bar', () => {
  test('open that cohort alone, and "all cohorts" brings the others back', async () => {
    const other = await backend.repos.org.saveCohort({ name: 'शाम', labId: null });
    const { learnerId } = await backend.issueCode('रवि');
    await backend.repos.org.setLearnerCohort(learnerId, other);
    const [morning] = (await backend.repos.org.cohorts('all')).filter((c) => c.name === 'सुबह');
    await backend.repos.staff.save({
      email: 'meena@ngo.example',
      role: 'mentor',
      name: 'मीना',
      active: true,
      cohortIds: [morning?.id ?? '', other],
    });
    backend.useStaffAccount('meena@ngo.example');
    await openAt({ name: 'staff', view: 'cohorts' });
    await vi.waitFor(() => screen.getByRole('heading', { name: 'सुबह', level: 2 }));
    expect(screen.getByRole('heading', { name: 'शाम', level: 2 })).toBeTruthy();

    await fireEvent.click(screen.getByRole('link', { name: 'शाम' }));
    await vi.waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'सुबह', level: 2 })).toBeNull(),
    );
    expect(screen.getByRole('heading', { name: 'शाम', level: 2 })).toBeTruthy();
    expect(current()).toEqual(['शाम']); // the cohort link is the current page, not "all cohorts"

    await fireEvent.click(screen.getByRole('link', { name: 'सब समूह' }));
    await vi.waitFor(() => screen.getByRole('heading', { name: 'सुबह', level: 2 }));
    expect(screen.getByRole('heading', { name: 'शाम', level: 2 })).toBeTruthy();
  });

  test('an address for a cohort the mentor does not have shows a plain message', async () => {
    await backend.repos.staff.save({
      email: 'meena@ngo.example',
      role: 'mentor',
      name: 'मीना',
      active: true,
      cohortIds: [],
    });
    backend.useStaffAccount('meena@ngo.example');
    await openAt({ name: 'staff', view: 'cohort', id: '9b2e1c4a-7d3f-4a58-8c61-2f0d5e7b1a93' });
    await vi.waitFor(() => screen.getByText('यह समूह नहीं मिला'));
  });
});
