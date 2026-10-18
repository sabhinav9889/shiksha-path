// @vitest-environment jsdom
import { startQuiz, type LearnerEvent } from '@shiksha/learner-core';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { makeEnv, type TestEnv } from '../../../test/helpers/installed-runtime.js';
import { activity } from '../../activity.svelte.js';
import { appState, initApp, signIn, signOut } from '../../app-state.svelte.js';
import { navigate, router } from '../../router.svelte.js';
import PracticeScreen from './PracticeScreen.svelte';

let env: TestEnv;
let flush: ReturnType<typeof vi.fn>;
const EN = 'english-foundation-1';

beforeEach(async () => {
  signOut();
  env = await makeEnv();
  initApp(env.runtime);
  flush = vi.fn(() => Promise.resolve({ ok: false, sent: 0, remaining: 0, nextAttemptInMs: 5000 }));
  env.runtime.flush = flush as never;
});

async function signedIn(): Promise<string> {
  const profile = await env.addProfile('प्रिया');
  await signIn(profile.id, '1234');
  return profile.id;
}

async function openLessonRun(): Promise<void> {
  await signedIn();
  const started = await appState.session?.startLesson('ef1-01');
  activity.current = { kind: 'lesson', ...(started as NonNullable<typeof started>) };
  navigate({ name: 'practice' });
  render(PracticeScreen);
}

async function openCustomRun(pick: (index: number) => boolean): Promise<void> {
  await signedIn();
  const started = await appState.session?.startLesson('ef1-01');
  const lesson = (started as NonNullable<typeof started>).lesson;
  const entries = lesson.items
    .map((item) => ({ source: { kind: 'lesson', lessonId: lesson.id } as const, item }))
    .filter((_, i) => pick(i));
  activity.current = { kind: 'lesson', lesson, run: startQuiz(entries), view: started!.view };
  navigate({ name: 'practice' });
  render(PracticeScreen);
}

const button = (name: string | RegExp): HTMLButtonElement =>
  screen.getByRole('button', { name }) as HTMLButtonElement;
const log = async (): Promise<LearnerEvent[]> => env.runtime.events.all(appState.profile?.id ?? '');

async function solveOrder(right: boolean): Promise<void> {
  const words = right ? ['I', 'am', 'Priya'] : ['am', 'I', 'Priya'];
  for (const word of words) {
    const tile = await vi.waitFor(() => {
      const found = screen.getByTestId('bank').querySelector(`button[data-word="${word}"]`);
      if (!found) throw new Error('word not in the bank yet');
      return found;
    });
    await fireEvent.click(tile);
  }
  await fireEvent.click(button('जाँचें'));
}

async function next(): Promise<void> {
  await vi.waitFor(() => button('आगे'));
  await fireEvent.click(button('आगे'));
}

describe('a lesson run', () => {
  test('records one answer per item and one completion, then goes to the finish screen', async () => {
    await openLessonRun();
    for (let i = 0; i < 4; i += 1) {
      await vi.waitFor(() => screen.getByTestId('bank'));
      await solveOrder(i !== 2);
      await next();
    }
    await vi.waitFor(() => button(/नमस्ते/));
    await fireEvent.click(button(/नमस्ते/));
    await next();
    await vi.waitFor(() => expect(router.current.name).toBe('finish'));
    const types = (await log()).map((e) => e.type);
    expect(types.filter((t) => t === 'item_answered')).toHaveLength(5);
    expect(types.filter((t) => t === 'lesson_completed')).toHaveLength(1);
    expect(activity.finish?.summary).toMatchObject({ correct: 4, wrong: 1 });
    expect(flush).toHaveBeenCalledTimes(1);
  });

  test('a wrong answer shows why, and the correct answer', async () => {
    await openCustomRun((i) => i === 4);
    await vi.waitFor(() => button(/अलविदा/));
    await fireEvent.click(button(/अलविदा/));
    await vi.waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain('गलत क्यों है?'),
    );
    expect(screen.getByRole('status').textContent).toContain('यह विदा है');
    expect(screen.getByRole('status').textContent).toContain('सही जवाब: नमस्ते');
  });

  test('a wrong word order shows the right sentence', async () => {
    await openCustomRun((i) => i === 0);
    await vi.waitFor(() => screen.getByTestId('bank'));
    await solveOrder(false);
    await vi.waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain('सही जवाब: I am Priya'),
    );
  });

  test('the answer is already in the log when the feedback appears', async () => {
    await openCustomRun((i) => i === 4);
    await vi.waitFor(() => button(/नमस्ते/));
    await fireEvent.click(button(/नमस्ते/));
    await vi.waitFor(() => screen.getByRole('status'));
    expect((await log()).filter((e) => e.type === 'item_answered')).toHaveLength(1);
  });

  test('tapping an option twice records one answer', async () => {
    await openCustomRun((i) => i === 4);
    await vi.waitFor(() => button(/नमस्ते/));
    await fireEvent.click(button(/नमस्ते/));
    await fireEvent.click(button(/अलविदा/));
    await vi.waitFor(() => screen.getByRole('status'));
    expect((await log()).filter((e) => e.type === 'item_answered')).toHaveLength(1);
  });

  test('tapping next twice on the last item records one completion', async () => {
    await openCustomRun((i) => i === 4);
    await vi.waitFor(() => button(/नमस्ते/));
    await fireEvent.click(button(/नमस्ते/));
    await vi.waitFor(() => button('आगे'));
    const nextButton = button('आगे');
    nextButton.click();
    nextButton.click(); // before the screen has had time to update
    await vi.waitFor(() => expect(router.current.name).toBe('finish'));
    const completions = (await log()).filter((e) => e.type === 'lesson_completed');
    expect(completions).toHaveLength(1);
    expect(flush).toHaveBeenCalledTimes(1);
  });

  test('a speaking item is not scored and moves straight on', async () => {
    await signedIn();
    const started = await appState.session?.startLesson('ef1-01');
    const speak = {
      id: 's1',
      type: 'speak_compare',
      prompt: { hi: 'बोलें', en: 'Say it' },
      text: 'Hello',
      model_audio: 'audio/0123456789abcdef.mp3',
    } as const;
    const run = startQuiz([{ source: { kind: 'lesson', lessonId: 'ef1-01' }, item: speak }]);
    activity.current = { kind: 'lesson', ...(started as NonNullable<typeof started>), run };
    navigate({ name: 'practice' });
    render(PracticeScreen);
    await vi.waitFor(() => button('आगे'));
    await fireEvent.click(button('आगे'));
    await vi.waitFor(() => expect(router.current.name).toBe('finish'));
    expect(screen.queryByRole('status')).toBeNull();
    const answered = (await log()).find((e) => e.type === 'item_answered');
    expect(answered?.data).toMatchObject({ outcome: 'unscored' });
  });
});

describe('leaving a run', () => {
  test('the close button asks first, and leaving records no completion', async () => {
    await openLessonRun();
    await vi.waitFor(() => screen.getByTestId('bank'));
    await fireEvent.click(button('बंद करें'));
    expect(screen.getByText('पाठ बीच में छोड़ें?')).toBeTruthy();
    await fireEvent.click(button('जारी रखें'));
    expect(screen.queryByText('पाठ बीच में छोड़ें?')).toBeNull();
    await fireEvent.click(button('बंद करें'));
    await fireEvent.click(button('छोड़ें'));
    await vi.waitFor(() => expect(router.current.name).toBe('lessons'));
    expect(activity.current).toBeNull();
    expect((await log()).some((e) => e.type === 'lesson_completed')).toBe(false);
  });

  test('the browser Back button asks first too', async () => {
    await openLessonRun();
    await vi.waitFor(() => screen.getByTestId('bank'));
    window.dispatchEvent(new PopStateEvent('popstate'));
    await vi.waitFor(() => expect(screen.getByText('पाठ बीच में छोड़ें?')).toBeTruthy());
    expect(router.current.name).toBe('practice');
  });

  test('with no activity (a reload) it goes back to the lessons list', async () => {
    navigate({ name: 'practice' });
    render(PracticeScreen);
    await vi.waitFor(() => expect(router.current.name).toBe('lessons'));
  });
});

describe('other kinds of run', () => {
  test('a review run finishes without a lesson completion', async () => {
    await signedIn();
    const profileId = appState.profile?.id ?? '';
    const { createEvent } = await import('@shiksha/learner-core');
    const { fixedClock } = await import('@shiksha/learner-core/testing');
    const deps = { clock: fixedClock('2026-10-10T10:00:00Z'), ids: env.runtime.ids };
    await env.runtime.events.append(
      createEvent(deps, profileId, 'item_answered', {
        source: { kind: 'lesson', lessonId: 'ef1-01' },
        itemId: 'q1',
        outcome: 'wrong',
      }),
    );
    await signIn(profileId, '1234');
    const run = await appState.session?.startReview();
    activity.current = { kind: 'review', run: run as NonNullable<typeof run> };
    navigate({ name: 'practice' });
    render(PracticeScreen);
    await vi.waitFor(() => screen.getByTestId('bank'));
    await solveOrder(true);
    await next();
    await vi.waitFor(() => expect(router.current.name).toBe('finish'));
    expect(activity.finish?.kind).toBe('review');
    expect((await log()).some((e) => e.type === 'lesson_completed')).toBe(false);
  });

  test.each([
    [true, true],
    [false, false],
  ])('a test-out answered right=%s records passed=%s', async (right, passed) => {
    await signedIn();
    const started = await appState.session?.startTestOut(EN);
    activity.current = {
      kind: 'test_out',
      moduleId: EN,
      ...(started as NonNullable<typeof started>),
    };
    navigate({ name: 'practice' });
    render(PracticeScreen);
    for (let i = 0; i < 5; i += 1) {
      await vi.waitFor(() => screen.getByTestId('bank'));
      await solveOrder(right);
      await next();
    }
    await vi.waitFor(() => expect(router.current.name).toBe('finish'));
    const done = (await log()).find((e) => e.type === 'test_out_completed');
    expect(done?.data).toMatchObject({ moduleId: EN, passed });
    expect(activity.finish?.testOut?.passed).toBe(passed);
  });
});
