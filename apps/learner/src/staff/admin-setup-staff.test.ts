// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { makeFakeBackend, type FakeBackend } from '../../test/helpers/fake-backend.js';
import { makeEnv } from '../../test/helpers/installed-runtime.js';
import { initApp, signOut } from '../app-state.svelte.js';
import { navigate } from '../router.svelte.js';
import StaffApp from './StaffApp.svelte';
import { staffState } from './staff-state.svelte.js';

let backend: FakeBackend;
const button = (name: string | RegExp): HTMLButtonElement =>
  screen.getByRole('button', { name }) as HTMLButtonElement;
/** The card of a lab, or of the "no lab" group, found by the name in its heading or row. */
const groupOf = (text: string): HTMLElement => {
  const hit = screen.getAllByText(text).find((el) => el.closest('.group'));
  return hit?.closest('.group') as HTMLElement;
};
const emails = async (): Promise<string[]> =>
  (await backend.repos.staff.list()).map((s) => s.email).sort();

beforeEach(async () => {
  signOut();
  backend = makeFakeBackend();
  initApp((await makeEnv({ account: backend.account })).runtime);
  staffState.me = null;
  const lab = await backend.repos.org.saveLab({ name: 'रामपुर लैब' });
  await backend.repos.org.saveLab({ name: 'खाली लैब' });
  const inLab = await backend.repos.org.saveCohort({ name: 'शाम', labId: lab });
  await backend.repos.org.saveCohort({ name: 'सुबह', labId: null });
  const member = { active: true, cohortIds: [] as string[] };
  await backend.repos.staff.save({
    ...member,
    email: 'boss@ngo.example',
    role: 'admin',
    name: 'सुनीता',
  });
  await backend.repos.staff.save({
    ...member,
    email: 'ravi@ngo.example',
    role: 'mentor',
    name: 'रवि',
    cohortIds: [inLab],
  });
  backend.useStaffAccount('boss@ngo.example');
  navigate({ name: 'staff', view: 'admin', section: 'setup' });
  render(StaffApp);
  await fireEvent.click(await vi.waitFor(() => button('Google से साइन इन करें')));
  await vi.waitFor(() => button('साइन आउट'));
});

describe('the admin setup lists and staff delete', () => {
  test('each lab holds its own cohorts; the rest sit under "no lab"', async () => {
    await vi.waitFor(() => screen.getByText('रवि'));
    const lab = groupOf('रामपुर लैब');
    expect(within(lab).getByText('शाम')).toBeTruthy();
    expect(within(lab).queryByText('सुबह')).toBeNull();
    expect(within(groupOf('खाली लैब')).getByText('अभी कोई समूह नहीं')).toBeTruthy();
    expect(within(groupOf('कोई लैब नहीं')).getByText('सुबह')).toBeTruthy();
  });

  test('a mentor row shows their cohorts and is deleted after one confirmation', async () => {
    const row = (await vi.waitFor(() => screen.getByText('रवि'))).closest('.person');
    expect(within(row as HTMLElement).getByText('शाम')).toBeTruthy();
    await fireEvent.click(button('रवि: हटाएँ'));
    expect(await emails()).toContain('ravi@ngo.example');
    await fireEvent.click(button('रवि: हाँ'));
    await vi.waitFor(async () => expect(await emails()).toEqual(['boss@ngo.example']));
    expect(screen.queryByText('रवि')).toBeNull();
  });

  test('an admin cannot delete themselves; the row stays and the reason shows', async () => {
    await fireEvent.click(await vi.waitFor(() => button('सुनीता: हटाएँ')));
    await fireEvent.click(button('सुनीता: हाँ'));
    await vi.waitFor(() => screen.getByText('हटाया नहीं जा सका। आप खुद को नहीं हटा सकते।'));
    expect(await emails()).toContain('boss@ngo.example');
  });
});
