// @vitest-environment jsdom
import { createEvent, type LearnerEvent, type QuizRun } from '@shiksha/learner-core';
import { answerFor } from '@shiksha/learner-core/test-helpers/session-env';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { makeEnv, type TestEnv } from '../../../test/helpers/installed-runtime.js';
import { activity } from '../../activity.svelte.js';
import {
  appState,
  initApp,
  setLanguagePreference,
  signIn,
  signOut,
} from '../../app-state.svelte.js';
import { navigate, router } from '../../router.svelte.js';
import PlacementResult from './PlacementResult.svelte';

let env: TestEnv;

beforeEach(async () => {
  signOut();
  env = await makeEnv();
  initApp(env.runtime);
});

async function signedIn(): Promise<string> {
  const profile = await env.addProfile('प्रिया');
  // a new profile always records its first language choice (Plan 2b)
  await env.runtime.events.append(
    createEvent(env.runtime, profile.id, 'language_changed', { preference: 'hi_en' }),
  );
  await signIn(profile.id, '1234');
  return profile.id;
}

/** Take the fixture's placement test with this many English items right (of 5). */
async function place(englishRight: number): Promise<void> {
  const session = appState.session;
  const first = await session?.startPlacement();
  if (!session || !first) throw new Error('no placement');
  let run: QuizRun = first;
  let english = 0;
  while (run.answered.length < run.entries.length) {
    const source = run.entries[run.answered.length]?.source;
    const isEnglish = source?.kind === 'placement' && source.track === 'english';
    const right = !isEnglish || english < englishRight;
    if (isEnglish) english += 1;
    run = (await session.answer(run, answerFor(run, right))).run;
  }
  activity.current = { kind: 'placement', run };
  activity.placementResult = await session.finishPlacement(run);
  navigate({ name: 'placement-result' });
}

const button = (name: string | RegExp): HTMLButtonElement =>
  screen.getByRole('button', { name }) as HTMLButtonElement;
const text = (): string => document.body.textContent ?? '';
const languageEvents = async (id: string): Promise<LearnerEvent[]> =>
  (await env.runtime.events.all(id)).filter((e) => e.type === 'language_changed');

describe('the placement result', () => {
  test('shows each track’s score and where the learner starts', async () => {
    await signedIn();
    await place(3);
    render(PlacementResult);
    await vi.waitFor(() => expect(text()).toContain('अंग्रेज़ी: 60%'));
    expect(text()).toContain('सोच: 100%');
    expect(text()).toContain('आप "पाठ 2" से शुरू करेंगे');
    expect(screen.queryByText(/English अच्छी है/)).toBeNull();
  });

  test('starting goes home at the start lesson and ends the run', async () => {
    await signedIn();
    await place(3);
    render(PlacementResult);
    await fireEvent.click(await vi.waitFor(() => button('शुरू करें')));
    expect(router.current.name).toBe('home');
    expect(activity.current).toBeNull();
    expect(appState.session?.todayLesson()?.lessonId).toBe('ef1-02');
  });

  test('with no result (a reload) it goes home', async () => {
    await signedIn();
    navigate({ name: 'placement-result' });
    render(PlacementResult);
    await vi.waitFor(() => expect(router.current.name).toBe('home'));
  });
});

describe('the English-only suggestion', () => {
  test('a strong first placement suggests it, and accepting switches the interface at once', async () => {
    const id = await signedIn();
    await place(5);
    render(PlacementResult);
    await vi.waitFor(() => expect(text()).toContain('आपकी English अच्छी है'));
    await fireEvent.click(button('हाँ, सिर्फ़ English'));
    await vi.waitFor(() => expect(text()).toContain('You will start at'));
    expect(appState.lang).toBe('en');
    expect((await languageEvents(id)).at(-1)?.data).toEqual({ preference: 'en_only' });
    expect(screen.queryByText(/Your English is good/)).toBeNull();
  });

  test('declining keeps Hindi and removes the question', async () => {
    const id = await signedIn();
    await place(5);
    render(PlacementResult);
    await fireEvent.click(await vi.waitFor(() => button('नहीं, हिंदी + English')));
    expect(screen.queryByText(/English अच्छी है/)).toBeNull();
    expect(appState.lang).toBe('hi');
    expect(await languageEvents(id)).toHaveLength(1);
  });

  test('a strong second placement does not suggest it (only the first one counts)', async () => {
    await signedIn();
    await place(1);
    await place(5);
    expect(activity.placementResult?.englishOnlySuggested).toBe(true);
    render(PlacementResult);
    await vi.waitFor(() => expect(text()).toContain('अंग्रेज़ी: 100%'));
    expect(screen.queryByText(/English अच्छी है/)).toBeNull();
  });
});

describe('setLanguagePreference', () => {
  test('works before any lessons are installed', async () => {
    env = await makeEnv({ install: false });
    initApp(env.runtime);
    const profile = await env.addProfile('Priya');
    await signIn(profile.id, '1234');
    expect(appState.session).toBeNull();
    await setLanguagePreference('en_only');
    expect(appState.lang).toBe('en');
    expect((await languageEvents(profile.id)).map((e) => e.data)).toEqual([
      { preference: 'en_only' },
    ]);
  });

  test('with a session it updates progress too', async () => {
    await signedIn();
    await setLanguagePreference('en_only');
    expect(appState.session?.progress.language).toBe('en_only');
    expect(appState.lang).toBe('en');
  });
});
