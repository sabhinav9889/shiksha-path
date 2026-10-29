// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { makeFakeBackend, type FakeBackend } from '../../test/helpers/fake-backend.js';
import { makeEnv } from '../../test/helpers/installed-runtime.js';
import { initApp, signOut } from '../app-state.svelte.js';
import { navigate } from '../router.svelte.js';
import StaffApp from './StaffApp.svelte';
import { setStaffLang } from './staff-lang.svelte.js';
import { staffState } from './staff-state.svelte.js';

let backend: FakeBackend;
let cohortA: string;
let cohortB: string;
const button = (name: string | RegExp): HTMLButtonElement =>
  screen.getByRole('button', { name }) as HTMLButtonElement;
const field = (label: string): HTMLInputElement => screen.getByLabelText(label) as HTMLInputElement;
const feed = async (cohort: string): Promise<string[]> =>
  (await backend.repos.posts.feed(cohort, 30)).map((p) => p.title);

async function openAs(email: string): Promise<void> {
  backend.useStaffAccount(email);
  navigate({ name: 'staff', view: 'posts' });
  render(StaffApp);
  await fireEvent.click(await vi.waitFor(() => button('Google से साइन इन करें')));
  await vi.waitFor(() => button('साइन आउट'));
}

beforeEach(async () => {
  signOut();
  setStaffLang('hi');
  backend = makeFakeBackend();
  initApp((await makeEnv({ account: backend.account })).runtime);
  staffState.me = null;
  cohortA = await backend.repos.org.saveCohort({ name: 'सुबह', labId: null });
  cohortB = await backend.repos.org.saveCohort({ name: 'शाम', labId: null });
  const member = { active: true };
  await backend.repos.staff.save({
    ...member,
    email: 'boss@ngo.example',
    role: 'admin',
    name: 'सुनीता',
    cohortIds: [],
  });
  await backend.repos.staff.save({
    ...member,
    email: 'ravi@ngo.example',
    role: 'mentor',
    name: 'रवि',
    cohortIds: [cohortA],
  });
});

describe('the staff posts screen', () => {
  test('a mentor sees the warning, can post only to their own cohort, and the post appears', async () => {
    await openAs('ravi@ngo.example');
    await vi.waitFor(() => screen.getByText('छात्रों के नाम और फ़ोटो पोस्ट न करें।'));
    const audience = field('किसके लिए') as unknown as HTMLSelectElement;
    expect([...audience.options].map((o) => o.text)).toEqual(['सुबह']);
    await fireEvent.input(field('शीर्षक'), { target: { value: 'मॉक इंटरव्यू' } });
    await fireEvent.input(field('संदेश'), { target: { value: '<b>पेन लाएँ</b>' } });
    await fireEvent.click(button('पोस्ट करें'));
    await vi.waitFor(async () => expect(await feed(cohortA)).toEqual(['मॉक इंटरव्यू']));
    const item = (await vi.waitFor(() => screen.getByText('मॉक इंटरव्यू'))).closest('li');
    // Plain text, never markup.
    expect(within(item as HTMLElement).getByText('<b>पेन लाएँ</b>')).toBeTruthy();
    expect(field('शीर्षक').value).toBe('');
  });

  test('an admin can post to everyone or to any cohort', async () => {
    await openAs('boss@ngo.example');
    const audience = (await vi.waitFor(() => field('किसके लिए'))) as unknown as HTMLSelectElement;
    expect([...audience.options].map((o) => o.text)).toEqual(['सभी छात्र', 'सुबह', 'शाम']);
    await fireEvent.input(field('शीर्षक'), { target: { value: 'सबके लिए' } });
    await fireEvent.click(button('पोस्ट करें'));
    await vi.waitFor(async () => expect(await feed(cohortB)).toEqual(['सबके लिए']));
  });

  test('a session needs an https link; a plain http one is refused and nothing is saved', async () => {
    await openAs('ravi@ngo.example');
    await fireEvent.input(await vi.waitFor(() => field('शीर्षक')), { target: { value: 'सेशन' } });
    await fireEvent.click(screen.getByLabelText('यह एक सेशन है'));
    await fireEvent.input(field('शुरू होने का समय'), { target: { value: '2026-11-10T16:00' } });
    await fireEvent.input(field('जुड़ने का लिंक (https://)'), {
      target: { value: 'http://x.org' },
    });
    await fireEvent.click(button('पोस्ट करें'));
    await vi.waitFor(() => screen.getByRole('alert'));
    expect(await feed(cohortA)).toEqual([]);
    await fireEvent.input(field('जुड़ने का लिंक (https://)'), {
      target: { value: 'https://meet.google.com/abc-defg-hij' },
    });
    await fireEvent.click(button('पोस्ट करें'));
    await vi.waitFor(async () => expect(await feed(cohortA)).toEqual(['सेशन']));
    const [saved] = await backend.repos.posts.feed(cohortA, 30);
    expect(saved?.session).toMatchObject({
      minutes: 60,
      link: 'https://meet.google.com/abc-defg-hij',
    });
  });

  test('the author edits and deletes their post; someone else’s post has no buttons', async () => {
    const [ravi] = (await backend.repos.staff.list()).filter((s) => s.role === 'mentor');
    const boss = (await backend.repos.staff.list()).find((s) => s.role === 'admin');
    const base = { cohortId: cohortA, body: '', session: null };
    await backend.repos.posts.save(
      { ...base, authorId: ravi?.id ?? '', title: 'रवि की' },
      new Date(),
    );
    await backend.repos.posts.save(
      { ...base, authorId: boss?.id ?? '', title: 'एडमिन की' },
      new Date(),
    );
    await openAs('ravi@ngo.example');
    await vi.waitFor(() => screen.getByText('रवि की'));
    expect(screen.queryByRole('button', { name: 'एडमिन की: हटाएँ' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'एडमिन की: बदलें' })).toBeNull();
    await fireEvent.click(button('रवि की: बदलें'));
    await fireEvent.input(field('शीर्षक'), { target: { value: 'रवि की नई' } });
    await fireEvent.click(button('बदलाव सेव करें'));
    await vi.waitFor(async () => expect(await feed(cohortA)).toContain('रवि की नई'));
    await fireEvent.click(await vi.waitFor(() => button('रवि की नई: हटाएँ')));
    await fireEvent.click(button('रवि की नई: हाँ'));
    await vi.waitFor(async () => expect(await feed(cohortA)).toEqual(['एडमिन की']));
  });

  test('the staff bar links to the posts page and marks it as the current one', async () => {
    await openAs('ravi@ngo.example');
    const link = await vi.waitFor(() => screen.getByRole('link', { name: 'पोस्ट' }));
    expect(link.getAttribute('aria-current')).toBe('page');
    expect(link.getAttribute('href')).toBe('#/staff/posts');
  });
});
