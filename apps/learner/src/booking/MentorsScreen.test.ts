// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { makeFakeBackend, type FakeBackend } from '../../test/helpers/fake-backend.js';
import { makeEnv, type TestEnv } from '../../test/helpers/installed-runtime.js';
import { setLinked, type AccountDeps } from '../account/account.js';
import { initApp, signIn, signOut } from '../app-state.svelte.js';
import { navigate, parseRoute } from '../router.svelte.js';
import MentorsScreen from './MentorsScreen.svelte';

const HOUR = 3_600_000;
const inHours = (n: number): Date => new Date(Date.now() + n * HOUR);
let backend: FakeBackend;
let env: TestEnv;
let cohort: string;
let mentorId: string;
let learnerId: string;
const button = (name: string | RegExp): HTMLButtonElement =>
  screen.getByRole('button', { name }) as HTMLButtonElement;
const slot = (hours: number, link: string | null = 'https://meet.example/room') =>
  backend.repos.bookings.saveSlot({ mentorId, startsAt: inHours(hours), minutes: 30, link });

beforeEach(async () => {
  signOut();
  backend = makeFakeBackend();
  env = await makeEnv({ account: backend.account });
  initApp(env.runtime);
  cohort = await backend.repos.org.saveCohort({ name: 'सुबह', labId: null });
  mentorId = await backend.repos.staff.save({
    email: 'meena@ngo.example',
    role: 'mentor',
    name: 'मीना',
    active: true,
    cohortIds: [cohort],
  });
  const profile = await env.addProfile('प्रिया');
  learnerId = profile.id;
  await backend.repos.learners.createLinked({ id: learnerId, name: 'प्रिया', authUserId: 'g1' });
  await backend.repos.org.setLearnerCohort(learnerId, cohort);
  await setLinked(env.runtime, learnerId);
  env.runtime.account = {
    loadAuth: () => Promise.resolve({ accessToken: () => Promise.resolve('g1') }),
    makeApi: () => backend.serverFor('g1'),
  } as unknown as AccountDeps;
  await signIn(learnerId, '1234');
});

describe('the Talk to a mentor page', () => {
  test('lists the open slots of my cohort’s mentors, without any meeting link', async () => {
    await slot(48);
    await slot(5); // too soon to book
    render(MentorsScreen);
    const row = (await vi.waitFor(() => screen.getByText(/मीना/))).closest('li') as HTMLElement;
    expect(within(row).getByText(/30 मिनट/)).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /बुक करें/ })).toHaveLength(1);
    expect(document.body.textContent).not.toContain('meet.example');
  });

  test('books a slot with a topic and a note; it moves to My bookings with its link', async () => {
    await slot(48);
    render(MentorsScreen);
    await fireEvent.click(await vi.waitFor(() => button(/बुक करें/)));
    await fireEvent.change(screen.getByLabelText('किस बारे में'), { target: { value: 'career' } });
    await fireEvent.input(screen.getByLabelText('छोटा नोट (ज़रूरी नहीं)'), {
      target: { value: '<b>CV में मदद</b>' },
    });
    await fireEvent.click(button('बुक पक्का करें'));
    const mine = (await vi.waitFor(() => screen.getByText('मेरी बुकिंग'))).closest(
      'section',
    ) as HTMLElement;
    await vi.waitFor(() => within(mine).getByRole('link', { name: 'जुड़ें' }));
    expect(within(mine).getByRole('link', { name: 'जुड़ें' }).getAttribute('href')).toBe(
      'https://meet.example/room',
    );
    expect(screen.queryByRole('button', { name: /बुक करें/ })).toBeNull();
    const [saved] = await backend.repos.bookings.slotsOf('all', new Date(0), 10);
    expect(saved?.booking).toMatchObject({ topic: 'career', note: '<b>CV में मदद</b>' });
    expect(document.querySelector('section b')).toBeNull();
  });

  test('a slot another student took first says so and leaves the list', async () => {
    const id = await slot(48);
    render(MentorsScreen);
    await fireEvent.click(await vi.waitFor(() => button(/बुक करें/)));
    const other = crypto.randomUUID();
    await backend.repos.learners.createLinked({ id: other, name: 'दूसरा', authUserId: 'g2' });
    await backend.repos.bookings.book({
      slotId: id,
      learnerId: other,
      topic: 'doubt',
      note: '',
      now: new Date(),
      maxUpcoming: 2,
    });
    await fireEvent.click(button('बुक पक्का करें'));
    await vi.waitFor(() => screen.getByText('यह स्लॉट अभी किसी और ने ले लिया।'));
    expect(screen.queryByRole('button', { name: /बुक करें/ })).toBeNull();
  });

  test('a third booking is refused with the reason', async () => {
    for (const hours of [48, 50]) {
      await backend.repos.bookings.book({
        slotId: await slot(hours),
        learnerId,
        topic: 'doubt',
        note: '',
        now: new Date(),
        maxUpcoming: 2,
      });
    }
    await slot(60);
    render(MentorsScreen);
    await fireEvent.click(await vi.waitFor(() => button(/बुक करें/)));
    await fireEvent.click(button('बुक पक्का करें'));
    await vi.waitFor(() => screen.getByText(/दो बुकिंग/));
  });

  test('cancels with notice, and is told it is too late inside 2 hours', async () => {
    const early = await slot(60);
    const soon = await slot(1);
    const now = new Date();
    await backend.repos.bookings.book({
      slotId: early,
      learnerId,
      topic: 'doubt',
      note: '',
      now,
      maxUpcoming: 2,
    });
    await backend.repos.bookings.book({
      slotId: soon,
      learnerId,
      topic: 'doubt',
      note: '',
      now: inHours(-30),
      maxUpcoming: 2,
    });
    render(MentorsScreen);
    const mine = (await vi.waitFor(() => screen.getByText('मेरी बुकिंग'))).closest(
      'section',
    ) as HTMLElement;
    const cancels = await vi.waitFor(() =>
      within(mine).getAllByRole('button', { name: /रद्द करें/ }),
    );
    expect(cancels).toHaveLength(2);
    await fireEvent.click(cancels[1] as HTMLButtonElement); // the later one: plenty of notice
    await fireEvent.click(
      await vi.waitFor(() => within(mine).getByRole('button', { name: /हाँ/ })),
    );
    await vi.waitFor(async () =>
      expect((await backend.repos.bookings.bookingsOf(learnerId, new Date(), 10)).length).toBe(1),
    );
    await fireEvent.click(within(mine).getByRole('button', { name: /रद्द करें/ }));
    await fireEvent.click(
      await vi.waitFor(() => within(mine).getByRole('button', { name: /हाँ/ })),
    );
    await vi.waitFor(() => screen.getByText(/2 घंटे/));
  });

  test('with the feature off, it says so and shows nothing to book', async () => {
    await slot(48);
    await backend.repos.setOverride(learnerId, 'mentor_booking', false);
    render(MentorsScreen);
    await vi.waitFor(() => screen.getByText('अभी यह सुविधा बंद है।'));
    expect(screen.queryByRole('button', { name: /बुक करें/ })).toBeNull();
  });

  test('the page has its own address', () => {
    expect(parseRoute('#/mentors')).toEqual({ name: 'mentors' });
    expect(parseRoute('#/mentors/x')).toEqual({ name: 'home' });
    navigate({ name: 'mentors' });
  });
});
