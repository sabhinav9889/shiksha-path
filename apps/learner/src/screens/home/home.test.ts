// @vitest-environment jsdom
import { createEvent } from '@shiksha/learner-core';
import { fixedClock } from '@shiksha/learner-core/testing';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { makeEnv, type TestEnv } from '../../../test/helpers/installed-runtime.js';
import { activity, resetActivity } from '../../activity.svelte.js';
import { appState, initApp, signIn, signOut } from '../../app-state.svelte.js';
import { navigate, router } from '../../router.svelte.js';
import HomeScreen from './HomeScreen.svelte';
import SyncChip from './SyncChip.svelte';

const EN = 'english-foundation-1';
const APT = 'aptitude-1';
let env: TestEnv;

beforeEach(async () => {
  signOut();
  navigate({ name: 'home' });
  env = await makeEnv();
  initApp(env.runtime);
});

async function openHome(name = 'प्रिया'): Promise<string> {
  const profile = await env.addProfile(name);
  await signIn(profile.id, '1234');
  render(HomeScreen);
  return profile.id;
}

/** Events stamped `at`, written straight to the log like an earlier day of learning. */
async function addEvents(
  learnerId: string,
  at: string,
  make: (deps: Parameters<typeof createEvent>[0]) => ReturnType<typeof createEvent>[],
): Promise<void> {
  const deps = { clock: fixedClock(at), ids: env.runtime.ids };
  for (const event of make(deps)) await env.runtime.events.append(event);
}

const button = (name: string | RegExp): HTMLButtonElement =>
  screen.getByRole('button', { name }) as HTMLButtonElement;

describe("today's lesson", () => {
  test('shows the lesson and starts it', async () => {
    await openHome();
    await vi.waitFor(() => expect(screen.getByText('पाठ 1')).toBeTruthy());
    expect(screen.getByText('नमस्ते, प्रिया')).toBeTruthy();
    await fireEvent.click(button('शुरू करें'));
    await vi.waitFor(() => expect(router.current).toEqual({ name: 'learn', lessonId: 'ef1-01' }));
    expect(activity.current?.kind).toBe('lesson');
  });

  test('English-only learners see the English title', async () => {
    const profile = await env.addProfile('Priya');
    await env.runtime.events.append(
      createEvent(env.runtime, profile.id, 'language_changed', { preference: 'en_only' }),
    );
    await signIn(profile.id, '1234');
    render(HomeScreen);
    await vi.waitFor(() => expect(screen.getByText('Lesson 1')).toBeTruthy());
    expect(screen.getByText('Hello, Priya')).toBeTruthy();
  });

  test('moves on to the next lesson and shows streak and progress from the log', async () => {
    const profile = await env.addProfile('प्रिया');
    const now = env.runtime.clock.now().toISOString();
    await addEvents(profile.id, now, (deps) => [
      createEvent(deps, profile.id, 'item_answered', {
        source: { kind: 'lesson', lessonId: 'ef1-01' },
        itemId: 'q1',
        outcome: 'correct',
      }),
      createEvent(deps, profile.id, 'lesson_completed', {
        lessonId: 'ef1-01',
        correct: 5,
        scored: 5,
      }),
    ]);
    await signIn(profile.id, '1234');
    render(HomeScreen);
    await vi.waitFor(() => expect(screen.getByText('पाठ 2')).toBeTruthy());
    expect(screen.getByText('1 दिन')).toBeTruthy();
    expect(screen.getByText('1 / 3')).toBeTruthy();
  });

  test('when every lesson is done a completion card shows', async () => {
    const profile = await env.addProfile('प्रिया');
    const now = env.runtime.clock.now().toISOString();
    const lessons = ['ef1-01', 'ef1-02', 'ef1-03', 'apt-01', 'apt-02'];
    await addEvents(profile.id, now, (deps) =>
      lessons.map((lessonId) =>
        createEvent(deps, profile.id, 'lesson_completed', { lessonId, correct: 1, scored: 1 }),
      ),
    );
    await signIn(profile.id, '1234');
    render(HomeScreen);
    await vi.waitFor(() => expect(screen.getByText('सब पाठ पूरे!')).toBeTruthy());
  });
});

describe('reviews', () => {
  const dueMistake = (learnerId: string) =>
    addEvents(learnerId, '2026-10-10T10:00:00Z', (deps) => [
      createEvent(deps, learnerId, 'item_answered', {
        source: { kind: 'lesson', lessonId: 'ef1-01' },
        itemId: 'q1',
        outcome: 'wrong',
      }),
    ]);

  test('a due review shows its count and starts a review run', async () => {
    const profile = await env.addProfile('प्रिया');
    await dueMistake(profile.id);
    await signIn(profile.id, '1234');
    render(HomeScreen);
    await vi.waitFor(() => expect(screen.getByText('दोहराने के लिए 1 सवाल')).toBeTruthy());
    await fireEvent.click(screen.getByText('दोहराने के लिए 1 सवाल'));
    await vi.waitFor(() => expect(router.current.name).toBe('practice'));
    expect(activity.current?.kind).toBe('review');
  });

  test('with nothing due there is no review card', async () => {
    await openHome();
    await vi.waitFor(() => screen.getByText('पाठ 1'));
    expect(screen.queryByText(/दोहराने के लिए/)).toBeNull();
  });
});

describe('before the lessons are on the phone', () => {
  test('a first launch with nothing installed offers the download and explains a failure', async () => {
    env = await makeEnv({ install: false });
    initApp(env.runtime);
    env.server.failing.add('manifest.json');
    await openHome();
    await vi.waitFor(() => expect(screen.getByText('पाठ डाउनलोड करें')).toBeTruthy());
    await fireEvent.click(button('डाउनलोड करें'));
    await vi.waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('सूची अभी नहीं मिली'),
    );
    env.server.failing.delete('manifest.json');
    await fireEvent.click(button('डाउनलोड करें'));
    await vi.waitFor(() => expect(screen.getByText('पाठ 1')).toBeTruthy(), { timeout: 12_000 });
    expect(appState.session).not.toBeNull();
  });

  test('stored lessons that fail validation count as not installed (damaged storage)', async () => {
    for (const id of [EN, APT]) {
      await env.runtime.storage.putModule(id, 'aaaaaaaaaaaa', { junk: true } as never);
    }
    await openHome();
    await vi.waitFor(() => expect(screen.getByText('पाठ डाउनलोड करें')).toBeTruthy());
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('SyncChip', () => {
  const now = new Date('2026-10-18T10:10:00Z');

  test('all saved shows how long ago', () => {
    render(SyncChip, { lastSyncedAt: '2026-10-18T10:00:00Z', pending: 0, now, lang: 'hi' });
    expect(screen.getByText('सब सेव है · 10 मिनट पहले')).toBeTruthy();
  });

  test('pending events or never synced shows the saved-on-phone line', () => {
    render(SyncChip, { lastSyncedAt: '2026-10-18T10:00:00Z', pending: 3, now, lang: 'hi' });
    expect(screen.getByText('फ़ोन में सेव · इंटरनेट मिलते ही अपलोड')).toBeTruthy();
  });

  test('never synced shows the saved-on-phone line too', () => {
    render(SyncChip, { lastSyncedAt: null, pending: 0, now, lang: 'en' });
    expect(screen.getByText('Saved on phone · uploads when internet is back')).toBeTruthy();
  });
});

describe('content that changed while a lesson was open (Review Focus 5)', () => {
  test('the next time home opens it shows the new content, not the old', async () => {
    const profile = await env.addProfile('प्रिया');
    const now = env.runtime.clock.now().toISOString();
    await addEvents(profile.id, now, (deps) =>
      ['ef1-01', 'ef1-02'].map((lessonId) =>
        createEvent(deps, profile.id, 'lesson_completed', { lessonId, correct: 5, scored: 5 }),
      ),
    );
    await signIn(profile.id, '1234');
    const started = await appState.session?.startLesson('ef1-03');
    activity.current = { kind: 'lesson', ...(started as NonNullable<typeof started>) };

    // a newer build drops English lesson 3 and a sync installs it while the lesson is open
    await env.fixture.rebuild((files) => {
      delete files['modules/english-foundation-1/lessons/03.md'];
      const placement = 'placement/placement.yaml'; // its start rules may not name a missing lesson
      files[placement] = String(files[placement]).replace(
        'start_lesson: ef1-03',
        'start_lesson: ef1-02',
      );
    });
    expect((await env.runtime.content.sync()).ok).toBe(true);

    resetActivity(); // the lesson ended (or the learner went Back)
    render(HomeScreen);
    await vi.waitFor(() => expect(screen.getByText('पाठ 1')).toBeTruthy()); // aptitude lesson 1
    expect(document.body.textContent).not.toContain('ef1-03');
  });
});

describe('the placement card', () => {
  test('a new learner is offered the starting test, which opens it', async () => {
    await openHome();
    await vi.waitFor(() => expect(screen.getByText('शुरुआती टेस्ट दें')).toBeTruthy());
    await fireEvent.click(screen.getByText('शुरुआती टेस्ट दें'));
    await vi.waitFor(() => expect(router.current.name).toBe('placement'));
  });

  test.each([
    ['skipped', 'placement_skipped', {}],
    [
      'completed',
      'placement_completed',
      {
        sections: [{ track: 'english', score: 0.5, startLesson: 'ef1-01' }],
        englishOnlySuggested: false,
      },
    ],
  ] as const)('is not shown once the test was %s', async (_label, type, data) => {
    const profile = await env.addProfile('प्रिया');
    await env.runtime.events.append(createEvent(env.runtime, profile.id, type, data as never));
    await signIn(profile.id, '1234');
    render(HomeScreen);
    await vi.waitFor(() => screen.getByText('पाठ 1'));
    expect(screen.queryByText('शुरुआती टेस्ट दें')).toBeNull();
  });

  test('is not shown when the phone has no placement test', async () => {
    await env.runtime.storage.removePlacement();
    await openHome();
    await vi.waitFor(() => screen.getByText('पाठ 1'));
    expect(screen.queryByText('शुरुआती टेस्ट दें')).toBeNull();
  });
});

describe('hardening', () => {
  test('a review with nothing left to show says so', async () => {
    const profile = await env.addProfile('प्रिया');
    await addEvents(profile.id, '2026-10-10T10:00:00Z', (deps) => [
      createEvent(deps, profile.id, 'item_answered', {
        source: { kind: 'lesson', lessonId: 'ef1-01' },
        itemId: 'q1',
        outcome: 'wrong',
      }),
    ]);
    await signIn(profile.id, '1234');
    render(HomeScreen);
    await vi.waitFor(() => screen.getByText('दोहराने के लिए 1 सवाल'));
    const session = appState.session;
    if (!session) throw new Error('no session');
    session.startReview = () => Promise.resolve(null); // the item vanished meanwhile
    await fireEvent.click(screen.getByText('दोहराने के लिए 1 सवाल'));
    await vi.waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('अभी दोहराने के लिए कुछ नहीं'),
    );
  });
});

describe('the placement switch', () => {
  test('a cached placement_test: false hides the placement card', async () => {
    const profile = await env.addProfile('प्रिया');
    await env.runtime.events.setMeta(
      `switches:${profile.id}`,
      JSON.stringify({ placement_test: false }),
    );
    await signIn(profile.id, '1234');
    render(HomeScreen);
    await vi.waitFor(() => screen.getByText('पाठ 1'));
    expect(screen.queryByText('शुरुआती टेस्ट दें')).toBeNull();
  });
});
