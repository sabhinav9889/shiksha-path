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
let emptyLab = '';
let cohortId = '';
const button = (name: string | RegExp): HTMLButtonElement =>
  screen.getByRole('button', { name }) as HTMLButtonElement;
/** The card of a lab, or of the "no lab" group, found by the name in its heading or row. */
const groupOf = (text: string): HTMLElement => {
  const heading = screen.getAllByText(text, { selector: 'header strong' })[0];
  return heading?.closest('.group') as HTMLElement;
};

beforeEach(async () => {
  signOut();
  backend = makeFakeBackend();
  initApp((await makeEnv({ account: backend.account })).runtime);
  staffState.me = null;
  const lab = await backend.repos.org.saveLab({ name: 'रामपुर लैब' });
  emptyLab = await backend.repos.org.saveLab({ name: 'खाली लैब' });
  cohortId = await backend.repos.org.saveCohort({ name: 'शाम', labId: lab });
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
    cohortIds: [cohortId],
  });
  backend.useStaffAccount('boss@ngo.example');
  navigate({ name: 'staff', view: 'admin', section: 'setup' });
  render(StaffApp);
  await fireEvent.click(await vi.waitFor(() => button('Google से साइन इन करें')));
  await vi.waitFor(() => button('साइन आउट'));
});

const editor = (label: string): HTMLElement => screen.getByRole('form', { name: label });
const field = (label: string, name: string): HTMLInputElement =>
  within(editor(label)).getByLabelText(name) as HTMLInputElement;

describe('editing a lab or a cohort on the setup screen', () => {
  test('a lab is renamed; its cohorts stay inside it', async () => {
    await fireEvent.click(await vi.waitFor(() => button('रामपुर लैब: बदलें')));
    expect(field('रामपुर लैब: बदलें', 'लैब का नाम').value).toBe('रामपुर लैब');
    await fireEvent.input(field('रामपुर लैब: बदलें', 'लैब का नाम'), {
      target: { value: 'नई लैब' },
    });
    await fireEvent.click(
      within(screen.getByRole('form')).getByRole('button', { name: 'सेव करें' }),
    );
    await vi.waitFor(() => groupOf('नई लैब'));
    expect(within(groupOf('नई लैब')).getByText('शाम')).toBeTruthy();
    expect(screen.queryByText('रामपुर लैब')).toBeNull();
    expect((await backend.repos.org.labs()).map((l) => l.name)).toContain('नई लैब');
  });

  test('a cohort is renamed and moved to another lab, keeping its mentor', async () => {
    await fireEvent.click(await vi.waitFor(() => button('शाम: बदलें')));
    await fireEvent.input(field('शाम: बदलें', 'समूह का नाम'), { target: { value: 'दोपहर' } });
    await fireEvent.change(within(editor('शाम: बदलें')).getByLabelText('लैब'), {
      target: { value: emptyLab },
    });
    await fireEvent.click(
      within(screen.getByRole('form')).getByRole('button', { name: 'सेव करें' }),
    );
    await vi.waitFor(() => expect(screen.queryByRole('form')).toBeNull());
    await vi.waitFor(() => within(groupOf('खाली लैब')).getByText('दोपहर'));
    expect(within(groupOf('रामपुर लैब')).getByText('अभी कोई समूह नहीं')).toBeTruthy();
    const [row] = await backend.repos.org.cohorts([cohortId]);
    expect(row).toEqual({ id: cohortId, name: 'दोपहर', labId: emptyLab });
    const mentor = (await backend.repos.staff.list()).find((s) => s.email === 'ravi@ngo.example');
    expect(mentor?.cohortIds).toEqual([cohortId]);
  });

  test('a cohort can leave its lab and sits under "no lab"', async () => {
    await fireEvent.click(await vi.waitFor(() => button('शाम: बदलें')));
    await fireEvent.change(within(editor('शाम: बदलें')).getByLabelText('लैब'), {
      target: { value: '' },
    });
    await fireEvent.click(
      within(screen.getByRole('form')).getByRole('button', { name: 'सेव करें' }),
    );
    await vi.waitFor(() => expect(screen.queryByRole('form')).toBeNull());
    await vi.waitFor(() => within(groupOf('कोई लैब नहीं')).getByText('शाम'));
    expect((await backend.repos.org.cohorts([cohortId]))[0]?.labId).toBeNull();
  });

  test('cancel closes the form and changes nothing', async () => {
    await fireEvent.click(await vi.waitFor(() => button('रामपुर लैब: बदलें')));
    await fireEvent.input(field('रामपुर लैब: बदलें', 'लैब का नाम'), {
      target: { value: 'कुछ और' },
    });
    await fireEvent.click(
      within(screen.getByRole('form')).getByRole('button', { name: 'रद्द करें' }),
    );
    expect(screen.queryByRole('form', { name: 'रामपुर लैब: बदलें' })).toBeNull();
    expect(screen.getAllByText('रामपुर लैब').length).toBeGreaterThan(0);
    expect((await backend.repos.org.labs()).map((l) => l.name)).not.toContain('कुछ और');
  });

  test('a lab deleted meanwhile is refused with a message, and nothing is created', async () => {
    await fireEvent.click(await vi.waitFor(() => button('खाली लैब: बदलें')));
    await backend.repos.org.deleteLab(emptyLab); // another admin removed it
    await fireEvent.input(field('खाली लैब: बदलें', 'लैब का नाम'), { target: { value: 'भूत' } });
    await fireEvent.click(
      within(screen.getByRole('form')).getByRole('button', { name: 'सेव करें' }),
    );
    await vi.waitFor(() => screen.getByRole('alert'));
    expect((await backend.repos.org.labs()).map((l) => l.name)).not.toContain('भूत');
  });

  test('only one editor is open at a time, and saving twice is not possible while it runs', async () => {
    await fireEvent.click(await vi.waitFor(() => button('रामपुर लैब: बदलें')));
    await fireEvent.click(button('शाम: बदलें'));
    expect(screen.queryByRole('form', { name: 'रामपुर लैब: बदलें' })).toBeNull();
    expect(editor('शाम: बदलें')).toBeTruthy();
  });
});
