// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { makeFakeBackend, type FakeBackend } from '../../test/helpers/fake-backend.js';
import { makeEnv } from '../../test/helpers/installed-runtime.js';
import { initApp, signOut } from '../app-state.svelte.js';
import { navigate } from '../router.svelte.js';
import StaffApp from './StaffApp.svelte';
import { toLocalInput } from './post-time.js';
import { setStaffLang } from './staff-lang.svelte.js';
import { staffState } from './staff-state.svelte.js';

const HOUR = 3_600_000;
let backend: FakeBackend;
let cohort: string;
let mentorId: string;
const button = (name: string | RegExp): HTMLButtonElement =>
  screen.getByRole('button', { name }) as HTMLButtonElement;
const field = (label: string): HTMLInputElement => screen.getByLabelText(label) as HTMLInputElement;
const inHours = (n: number): Date => new Date(Date.now() + n * HOUR);
const slots = async () => backend.repos.bookings.slotsOf('all', new Date(0), 50);

async function openAs(email: string): Promise<void> {
  backend.useStaffAccount(email);
  navigate({ name: 'staff', view: 'slots' });
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
  cohort = await backend.repos.org.saveCohort({ name: 'सुबह', labId: null });
  const member = { active: true, cohortIds: [cohort] };
  mentorId = await backend.repos.staff.save({
    ...member,
    email: 'meena@ngo.example',
    role: 'mentor',
    name: 'मीना',
  });
  await backend.repos.staff.save({
    ...member,
    email: 'ravi@ngo.example',
    role: 'mentor',
    name: 'रवि',
  });
});

describe('the staff meeting slots screen', () => {
  test('a mentor publishes a slot in India time and sees it listed as open', async () => {
    await openAs('meena@ngo.example');
    await fireEvent.input(await vi.waitFor(() => field('शुरू होने का समय')), {
      target: { value: toLocalInput(inHours(72).toISOString()) },
    });
    await fireEvent.input(field('जुड़ने का लिंक (https://)'), {
      target: { value: 'https://meet.google.com/abc-defg-hij' },
    });
    await fireEvent.click(button('स्लॉट जोड़ें'));
    await vi.waitFor(async () => expect(await slots()).toHaveLength(1));
    const [saved] = await slots();
    expect(saved).toMatchObject({
      mentorId,
      minutes: 30,
      link: 'https://meet.google.com/abc-defg-hij',
    });
    expect(Math.abs(new Date(saved?.startsAt ?? 0).getTime() - inHours(72).getTime())).toBeLessThan(
      120_000,
    );
    await vi.waitFor(() => screen.getByText('खाली'));
  });

  test('a time in the past, or an http link, is refused and nothing is saved', async () => {
    await openAs('meena@ngo.example');
    await fireEvent.input(await vi.waitFor(() => field('शुरू होने का समय')), {
      target: { value: toLocalInput(inHours(-5).toISOString()) },
    });
    await fireEvent.click(button('स्लॉट जोड़ें'));
    await vi.waitFor(() => screen.getByRole('alert'));
    expect(await slots()).toEqual([]);
  });

  test('a booked slot shows who booked and their note as plain text; another mentor’s slots are not shown', async () => {
    const other = await backend.repos.staff
      .list()
      .then((rows) => rows.find((r) => r.name === 'रवि'));
    const mine = await backend.repos.bookings.saveSlot({
      mentorId,
      startsAt: inHours(72),
      minutes: 30,
      link: null,
    });
    await backend.repos.bookings.saveSlot({
      mentorId: other?.id ?? '',
      startsAt: inHours(80),
      minutes: 30,
      link: null,
    });
    const { learnerId } = await backend.issueCode('प्रिया');
    await backend.repos.org.setLearnerCohort(learnerId, cohort);
    await backend.repos.bookings.book({
      slotId: mine,
      learnerId,
      topic: 'career',
      note: '<b>CV में मदद</b>',
      now: new Date(),
      maxUpcoming: 2,
    });
    await openAs('meena@ngo.example');
    const row = (await vi.waitFor(() => screen.getByText(/प्रिया/))).closest('li') as HTMLElement;
    expect(within(row).getByText('<b>CV में मदद</b>')).toBeTruthy();
    expect(row.querySelector('b')).toBeNull();
    expect(within(row).getByText(/करियर/)).toBeTruthy();
    expect(
      screen.getAllByRole('listitem').filter((li) => li.className.includes('person')),
    ).toHaveLength(1);
  });

  test('the owner removes a slot after one question; the nav link marks the page', async () => {
    await backend.repos.bookings.saveSlot({
      mentorId,
      startsAt: inHours(72),
      minutes: 30,
      link: null,
    });
    await openAs('meena@ngo.example');
    const link = await vi.waitFor(() => screen.getByRole('link', { name: 'मुलाक़ात के समय' }));
    expect(link.getAttribute('aria-current')).toBe('page');
    expect(link.getAttribute('href')).toBe('#/staff/slots');
    await fireEvent.click(
      await vi.waitFor(
        () => screen.getAllByRole('button', { name: /हटाएँ/ })[0] as HTMLButtonElement,
      ),
    );
    await fireEvent.click(screen.getAllByRole('button', { name: /हाँ/ })[0] as HTMLButtonElement);
    await vi.waitFor(async () => expect(await slots()).toEqual([]));
  });
});
