// @vitest-environment jsdom
import type { QuizSummary } from '@shiksha/learner-core';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { makeEnv, type TestEnv } from '../../../test/helpers/installed-runtime.js';
import { activity, type FinishInfo } from '../../activity.svelte.js';
import { appState, initApp, signIn, signOut } from '../../app-state.svelte.js';
import { navigate, router } from '../../router.svelte.js';
import FinishScreen from './FinishScreen.svelte';

let env: TestEnv;

beforeEach(async () => {
  signOut();
  env = await makeEnv();
  initApp(env.runtime);
  const profile = await env.addProfile('प्रिया');
  await signIn(profile.id, '1234');
  navigate({ name: 'finish' });
});

const summary = (correct: number, wrong: number): QuizSummary => ({
  total: correct + wrong,
  scored: correct + wrong,
  correct,
  wrong,
  unscored: 0,
  score: correct / (correct + wrong),
  mistakes: [],
});

const lesson = (over: Partial<FinishInfo> = {}): FinishInfo => ({
  kind: 'lesson',
  summary: summary(4, 1),
  streak: { current: 3, activeToday: true },
  lessonTitle: { hi: 'पाठ 1', en: 'Lesson 1' },
  ...over,
});

const text = (): string => document.body.textContent ?? '';

describe('a finished lesson', () => {
  test('shows the title, the score, the streak and the saved-on-phone line', async () => {
    activity.finish = lesson();
    render(FinishScreen);
    expect(screen.getByRole('heading', { name: 'पाठ 1 पूरा!' })).toBeTruthy();
    expect(text()).toContain('5 में से 4 सही · 3 दिन की streak');
    await vi.waitFor(() => expect(text()).toContain('फ़ोन में सेव · इंटरनेट मिलते ही अपलोड'));
  });

  test('says how many mistakes will come back, only when there were some', () => {
    activity.finish = lesson();
    const { unmount } = render(FinishScreen);
    expect(text()).toContain('1 गलतियाँ अगले कुछ दिनों में दोहराने में आएँगी');
    unmount();
    activity.finish = lesson({ summary: summary(5, 0) });
    render(FinishScreen);
    expect(text()).not.toContain('दोहराने में आएँगी');
  });

  test('English-only learners get English text', () => {
    appState.lang = 'en';
    activity.finish = lesson();
    render(FinishScreen);
    expect(screen.getByRole('heading', { name: 'Lesson 1 complete!' })).toBeTruthy();
    expect(text()).toContain('4 of 5 correct · 3 day streak');
  });
});

describe('other finishes', () => {
  test('a review says so', () => {
    activity.finish = {
      kind: 'review',
      summary: summary(2, 0),
      streak: { current: 1, activeToday: true },
    };
    render(FinishScreen);
    expect(screen.getByRole('heading', { name: 'दोहराना पूरा!' })).toBeTruthy();
  });

  test('a passed test-out shows the score as a percentage', () => {
    activity.finish = {
      kind: 'test_out',
      summary: summary(5, 0),
      streak: { current: 1, activeToday: true },
      testOut: { score: 0.9, passed: true },
    };
    render(FinishScreen);
    expect(screen.getByRole('heading', { name: 'पास हुए – module पूरा!' })).toBeTruthy();
    expect(text()).toContain('आपका स्कोर: 90%');
    expect(text()).not.toContain('दोहराने में आएँगी');
  });

  test('a test-out that was not passed says to keep learning', () => {
    activity.finish = {
      kind: 'test_out',
      summary: summary(2, 3),
      streak: { current: 1, activeToday: true },
      testOut: { score: 0.4, passed: false },
    };
    render(FinishScreen);
    expect(screen.getByRole('heading', { name: 'अभी पास नहीं हुए – पाठ जारी रखें' })).toBeTruthy();
    expect(text()).toContain('आपका स्कोर: 40%');
  });
});

describe('leaving', () => {
  test('the home button clears the activity and goes home', async () => {
    activity.finish = lesson();
    render(FinishScreen);
    await fireEvent.click(screen.getByRole('button', { name: 'होम पर जाएँ' }));
    expect(router.current.name).toBe('home');
    expect([activity.current, activity.finish]).toEqual([null, null]);
  });

  test('leaving by any other way clears it too', () => {
    activity.finish = lesson();
    const { unmount } = render(FinishScreen);
    unmount();
    expect([activity.current, activity.finish]).toEqual([null, null]);
  });

  test('with nothing to show it goes home', async () => {
    render(FinishScreen);
    await vi.waitFor(() => expect(router.current.name).toBe('home'));
  });
});
