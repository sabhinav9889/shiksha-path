// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { makeFakeBackend, type FakeBackend } from '../../test/helpers/fake-backend.js';
import { makeEnv, type TestEnv } from '../../test/helpers/installed-runtime.js';
import { initApp, signOut } from '../app-state.svelte.js';
import { navigate } from '../router.svelte.js';
import StaffApp from './StaffApp.svelte';
import { staffState } from './staff-state.svelte.js';

let env: TestEnv;
let backend: FakeBackend;
const button = (name: string | RegExp): HTMLButtonElement =>
  screen.getByRole('button', { name }) as HTMLButtonElement;

beforeEach(async () => {
  signOut();
  backend = makeFakeBackend();
  env = await makeEnv({ account: backend.account });
  initApp(env.runtime);
  staffState.me = null;
  navigate({ name: 'staff', view: 'cohorts' });
});

describe('the staff section', () => {
  test('signed out it offers Google sign-in, and touches no learner session', async () => {
    const profile = await env.addProfile('प्रिया');
    backend.useGoogleAccount('google-priya');
    await backend.google.startGoogleSignIn(profile.id);
    await backend.google.finishGoogleSignIn('x');
    render(StaffApp);
    await vi.waitFor(() => button('Google से साइन इन करें'));
    expect(await backend.google.accessToken(profile.id)).toBe('google-priya');
  });

  test('an invited mentor signs in, claims, and sees their role and cohorts', async () => {
    const cohort = await backend.repos.org.saveCohort({ name: 'सुबह की लैब', labId: null });
    await backend.repos.staff.save({
      email: 'meena@ngo.example',
      role: 'mentor',
      name: 'मीना',
      active: true,
      cohortIds: [cohort],
    });
    backend.useStaffAccount('meena@ngo.example');
    render(StaffApp);
    await fireEvent.click(await vi.waitFor(() => button('Google से साइन इन करें')));
    await vi.waitFor(() => screen.getByText('मीना'));
    expect(screen.getByText('मेंटर')).toBeTruthy();
    expect(screen.getAllByText('सुबह की लैब').length).toBeGreaterThan(0);
  });

  test('an account that is not staff is told so and signed out', async () => {
    backend.useStaffAccount('stranger@example.com');
    render(StaffApp);
    await fireEvent.click(await vi.waitFor(() => button('Google से साइन इन करें')));
    await vi.waitFor(() => screen.getByText('यह खाता स्टाफ़ के लिए नहीं है'));
    expect(await backend.staffAuth.token()).toBeNull();
  });

  test('signing out of staff leaves every learner profile signed in', async () => {
    const profile = await env.addProfile('रोहित');
    backend.useGoogleAccount('google-rohit');
    await backend.google.startGoogleSignIn(profile.id);
    await backend.google.finishGoogleSignIn('x');
    await backend.repos.staff.save({
      email: 'boss@ngo.example',
      role: 'admin',
      name: 'Boss',
      active: true,
      cohortIds: [],
    });
    backend.useStaffAccount('boss@ngo.example');
    render(StaffApp);
    await fireEvent.click(await vi.waitFor(() => button('Google से साइन इन करें')));
    await fireEvent.click(await vi.waitFor(() => button('साइन आउट')));
    await vi.waitFor(() => button('Google से साइन इन करें'));
    expect(await backend.google.accessToken(profile.id)).toBe('google-rohit');
  });
});
