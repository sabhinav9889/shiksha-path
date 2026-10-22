// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { createEvent, cryptoIds, systemClock } from '@shiksha/learner-core';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { makeFakeBackend, type FakeBackend } from '../../test/helpers/fake-backend.js';
import { makeEnv } from '../../test/helpers/installed-runtime.js';
import { initApp, signOut } from '../app-state.svelte.js';
import { navigate } from '../router.svelte.js';
import StaffApp from './StaffApp.svelte';
import { staffState } from './staff-state.svelte.js';

let backend: FakeBackend;
let cohort: string;
let busy: string;
let quiet: string;
let recording: string;

const ids = { clock: systemClock, ids: cryptoIds };

async function student(name: string, google: string): Promise<string> {
  const id = crypto.randomUUID();
  await backend.serverFor(google).link({ profileId: id, name });
  await backend.repos.org.setLearnerCohort(id, cohort);
  return id;
}

beforeEach(async () => {
  signOut();
  backend = makeFakeBackend();
  const env = await makeEnv({ account: backend.account });
  initApp(env.runtime);
  staffState.me = null;
  cohort = await backend.repos.org.saveCohort({ name: 'सुबह की लैब', labId: null });
  await backend.repos.staff.save({
    email: 'meena@ngo.example',
    role: 'mentor',
    name: 'मीना',
    active: true,
    cohortIds: [cohort],
  });
  busy = await student('प्रिया', 'google-priya');
  quiet = await student('<b>रवि</b>', 'google-ravi');
  await backend.serverFor('google-priya').push({
    learnerId: busy,
    events: [
      createEvent(ids, busy, 'lesson_started', { lessonId: 'ef1-01', moduleVersion: '1' }),
      createEvent(ids, busy, 'item_answered', {
        source: { kind: 'lesson', lessonId: 'ef1-01' },
        itemId: 'q1',
        outcome: 'correct',
      }),
      createEvent(ids, busy, 'lesson_completed', { lessonId: 'ef1-01', correct: 4, scored: 5 }),
    ],
  });
  await backend.repos.summaries.refresh(quiet, () => ({
    lessonsDone: 0,
    lessonsThisWeek: 0,
    streak: 0,
    lastActiveDay: '2020-01-01',
    currentLesson: null,
    lowScores: false,
    stuckLesson: null,
  }));
  recording = crypto.randomUUID();
  await backend.repos.recordings.create({
    id: recording,
    learnerId: busy,
    lessonId: 'ef1-02',
    itemId: 's1',
    mime: 'audio/webm',
    bytes: 3,
    durationMs: 2000,
    recordedAt: new Date().toISOString(),
  });
  backend.repos.storage.put(`${busy}/${recording}`, 3);
  await backend.repos.recordings.markUploaded(recording, new Date());
  backend.useStaffAccount('meena@ngo.example');
});

async function signedIn(): Promise<void> {
  render(StaffApp);
  await fireEvent.click(
    await vi.waitFor(() => screen.getByRole('button', { name: 'Google से साइन इन करें' })),
  );
  await vi.waitFor(() => screen.getByText('मीना'));
}

describe('the mentor screens', () => {
  test('the cohort list shows each student, flagged ones first, with plain words', async () => {
    navigate({ name: 'staff', view: 'cohorts' });
    await signedIn();
    const rows = await vi.waitFor(() => {
      const found = screen.getAllByTestId('student-row');
      expect(found.length).toBe(2);
      return found;
    });
    expect(rows[0]?.textContent).toContain('<b>रवि</b>'); // shown literally, never as HTML
    expect(rows[0]?.textContent).toContain('3 दिन से नहीं आए');
    expect(rows[1]?.textContent).toContain('प्रिया');
    expect(rows[1]?.textContent).toContain('इस हफ़्ते 1 पाठ');
    expect(rows[1]?.textContent).toContain('आज');
    expect(document.querySelector('b')).toBeNull();
  });

  test('the student page shows progress, activity in words, and recordings', async () => {
    navigate({ name: 'staff', view: 'student', id: busy });
    await signedIn();
    await vi.waitFor(() => screen.getByText('पाठ ef1-01 पूरा किया (4/5)'));
    expect(screen.getByText('पाठ ef1-01 शुरू किया')).toBeTruthy();
    expect(screen.getByText(/1 पाठ पूरे/)).toBeTruthy();
    expect(within(screen.getByTestId('student-recordings')).getByText(/ef1-02/)).toBeTruthy();
  });

  test('the recordings page plays on tap and saves a review, which removes it from the list', async () => {
    navigate({ name: 'staff', view: 'recordings' });
    await signedIn();
    const play = await vi.waitFor(() => screen.getByRole('button', { name: /सुनें/ }));
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    await fireEvent.click(play);
    await vi.waitFor(() =>
      expect(document.querySelector('audio')?.getAttribute('src')).toContain(recording),
    );
    await fireEvent.input(screen.getByLabelText('टिप्पणी (वैकल्पिक)'), {
      target: { value: 'साफ़ बोला' },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'सुन लिया' }));
    await vi.waitFor(() => screen.getByText('सब रिकॉर्डिंग सुन ली गईं'));
    expect((await backend.repos.recordings.get(recording))?.comment).toBe('साफ़ बोला');
  });
});
