// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { makeFakeBackend, type FakeBackend } from '../../test/helpers/fake-backend.js';
import { makeEnv } from '../../test/helpers/installed-runtime.js';
import { initApp, signOut } from '../app-state.svelte.js';
import { navigate } from '../router.svelte.js';
import StaffApp from './StaffApp.svelte';
import { staffState } from './staff-state.svelte.js';

let backend: FakeBackend;
let lab: string;
let emptyCohort: string;
let busyCohort: string;
const button = (name: string | RegExp): HTMLButtonElement =>
  screen.getByRole('button', { name }) as HTMLButtonElement;
const cohortNames = async (): Promise<string[]> =>
  (await backend.repos.org.cohorts('all')).map((c) => c.name);

beforeEach(async () => {
  signOut();
  backend = makeFakeBackend();
  initApp((await makeEnv({ account: backend.account })).runtime);
  staffState.me = null;
  lab = await backend.repos.org.saveLab({ name: 'रामपुर लैब' });
  emptyCohort = await backend.repos.org.saveCohort({ name: 'सुबह', labId: null });
  busyCohort = await backend.repos.org.saveCohort({ name: 'शाम', labId: lab });
  const { learnerId } = await backend.issueCode('प्रिया');
  await backend.repos.org.setLearnerCohort(learnerId, busyCohort);
  await backend.repos.staff.save({
    email: 'boss@ngo.example',
    role: 'admin',
    name: 'सुनीता',
    active: true,
    cohortIds: [],
  });
  backend.useStaffAccount('boss@ngo.example');
  navigate({ name: 'staff', view: 'admin', section: 'setup' });
  render(StaffApp);
  await fireEvent.click(await vi.waitFor(() => button('Google से साइन इन करें')));
  await vi.waitFor(() => button('साइन आउट'));
});

describe('deleting a cohort or a lab from the admin setup', () => {
  test('an empty cohort is deleted after one confirmation', async () => {
    await fireEvent.click(await vi.waitFor(() => button('सुबह: हटाएँ')));
    expect(screen.getByText(/यह समूह हटाएँ/)).toBeTruthy();
    await fireEvent.click(button('सुबह: हाँ'));
    await vi.waitFor(async () => expect(await cohortNames()).toEqual(['शाम']));
    expect(screen.queryByRole('button', { name: 'सुबह: हटाएँ' })).toBeNull();
  });

  test('cancelling the question deletes nothing', async () => {
    await fireEvent.click(await vi.waitFor(() => button('सुबह: हटाएँ')));
    await fireEvent.click(button('सुबह: रद्द करें'));
    expect(await cohortNames()).toContain('सुबह');
    expect(button('सुबह: हटाएँ')).toBeTruthy();
  });

  test('a cohort that still has students says so and stays', async () => {
    await fireEvent.click(await vi.waitFor(() => button('शाम: हटाएँ')));
    await fireEvent.click(button('शाम: हाँ'));
    await vi.waitFor(() =>
      screen.getByText('इस समूह में छात्र हैं। पहले उन्हें दूसरे समूह में भेजें।'),
    );
    expect(await cohortNames()).toContain('शाम');
  });

  test('a lab with a cohort says so; once its cohort is gone the lab is deleted', async () => {
    await fireEvent.click(await vi.waitFor(() => button('रामपुर लैब: हटाएँ')));
    await fireEvent.click(button('रामपुर लैब: हाँ'));
    await vi.waitFor(() => screen.getByText('इस लैब में समूह हैं। पहले वे समूह हटाएँ।'));
    expect(await backend.repos.org.labs()).toHaveLength(1);
    await backend.repos.org.setLearnerCohort(
      (await backend.repos.org.students([busyCohort]))[0]?.id ?? '',
      emptyCohort,
    );
    await fireEvent.click(button('शाम: हटाएँ'));
    await fireEvent.click(button('शाम: हाँ'));
    await vi.waitFor(async () => expect(await cohortNames()).toEqual(['सुबह']));
    await fireEvent.click(button('रामपुर लैब: हटाएँ'));
    await fireEvent.click(button('रामपुर लैब: हाँ'));
    await vi.waitFor(async () => expect(await backend.repos.org.labs()).toEqual([]));
  });
});
