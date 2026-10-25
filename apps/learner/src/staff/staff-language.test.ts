// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { makeFakeBackend, type FakeBackend } from '../../test/helpers/fake-backend.js';
import { makeEnv } from '../../test/helpers/installed-runtime.js';
import { appState, initApp, signOut } from '../app-state.svelte.js';
import { navigate } from '../router.svelte.js';
import StaffApp from './StaffApp.svelte';
import { setStaffLang } from './staff-lang.svelte.js';
import { staffState } from './staff-state.svelte.js';

let backend: FakeBackend;
const button = (name: string | RegExp): HTMLElement => screen.getByRole('button', { name });

beforeEach(async () => {
  signOut();
  localStorage.clear();
  setStaffLang('hi');
  backend = makeFakeBackend();
  const env = await makeEnv({ account: backend.account });
  initApp(env.runtime);
  staffState.me = null;
  await backend.repos.staff.save({
    email: 'boss@ngo.example',
    role: 'admin',
    name: 'सुनीता',
    active: true,
    cohortIds: [],
  });
  backend.useStaffAccount('boss@ngo.example');
  navigate({ name: 'staff', view: 'cohorts' });
});

describe('the staff language switch', () => {
  test('the sign-in page can switch to English and back, before anyone signs in', async () => {
    render(StaffApp);
    await vi.waitFor(() => button('Google से साइन इन करें'));
    await fireEvent.click(button('English'));
    await vi.waitFor(() => button('Sign in with Google'));
    expect(
      screen.getByText('Mentors and admins sign in with their NGO Google account.'),
    ).toBeTruthy();
    await fireEvent.click(button('हिन्दी'));
    await vi.waitFor(() => button('Google से साइन इन करें'));
  });

  test('signed in, the whole staff section follows it, and it is remembered', async () => {
    render(StaffApp);
    await fireEvent.click(await vi.waitFor(() => button('Google से साइन इन करें')));
    await vi.waitFor(() => button('साइन आउट'));
    await fireEvent.click(button('English'));
    await vi.waitFor(() => button('Sign out'));
    expect(screen.getByRole('link', { name: 'Cohorts' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Setup' })).toBeTruthy();
    expect(localStorage.getItem('shiksha.staff-lang')).toBe('en');
  });

  test('a stored English choice is used the next time, and learner profiles are untouched', async () => {
    localStorage.setItem('shiksha.staff-lang', 'en');
    setStaffLang('en');
    render(StaffApp);
    await vi.waitFor(() => button('Sign in with Google'));
    expect(appState.lang).toBe('hi'); // the learner side keeps its own language
  });
});
