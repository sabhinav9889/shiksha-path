// @vitest-environment jsdom
import { createEvent } from '@shiksha/learner-core';
import { fixedClock } from '@shiksha/learner-core/testing';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { makeEnv, type TestEnv } from '../../../test/helpers/installed-runtime.js';
import { activity } from '../../activity.svelte.js';
import { initApp, signIn, signOut } from '../../app-state.svelte.js';
import { navigate, router } from '../../router.svelte.js';
import LessonsScreen from './LessonsScreen.svelte';

const EN = 'english-foundation-1';
const MIB = 1_048_576;
let env: TestEnv;

beforeEach(async () => {
  signOut();
  navigate({ name: 'lessons' });
  env = await makeEnv();
  initApp(env.runtime);
});

async function open(done: string[] = []): Promise<string> {
  const profile = await env.addProfile('प्रिया');
  const deps = { clock: fixedClock('2026-10-18T10:00:00Z'), ids: env.runtime.ids };
  for (const lessonId of done) {
    await env.runtime.events.append(
      createEvent(deps, profile.id, 'lesson_completed', { lessonId, correct: 5, scored: 5 }),
    );
  }
  await signIn(profile.id, '1234');
  render(LessonsScreen);
  return profile.id;
}

const button = (name: string | RegExp): HTMLButtonElement =>
  screen.getByRole('button', { name }) as HTMLButtonElement;
const status = (title: string): string | null =>
  button(title).closest('[data-status]')?.getAttribute('data-status') ?? null;

describe('lesson rows', () => {
  test('show done, today and open from the log', async () => {
    await open(['ef1-01']);
    await vi.waitFor(() => expect(status('पाठ 1')).toBe('done'));
    expect(status('पाठ 2')).toBe('today');
    expect(status('पाठ 3')).toBe('open');
  });

  test('tapping a lesson starts it', async () => {
    await open();
    await vi.waitFor(() => button('पाठ 3'));
    await fireEvent.click(button('पाठ 3'));
    await vi.waitFor(() => expect(router.current).toEqual({ name: 'learn', lessonId: 'ef1-03' }));
    expect(activity.current?.kind).toBe('lesson');
  });

  test('the test-out row starts a test-out', async () => {
    await open();
    await vi.waitFor(() => button(/Test-out quiz/));
    await fireEvent.click(button(/Test-out quiz/));
    await vi.waitFor(() => expect(router.current.name).toBe('practice'));
    expect(activity.current).toMatchObject({ kind: 'test_out', moduleId: EN });
  });

  test('the track tabs switch between English and aptitude', async () => {
    await open();
    await vi.waitFor(() => button('अंग्रेज़ी'));
    await fireEvent.click(button('सोच'));
    await vi.waitFor(() => expect(status('पाठ 2')).toBe('open'));
    expect(screen.queryByRole('button', { name: 'पाठ 3' })).toBeNull();
  });
});

describe('downloads', () => {
  test('a module that is not on the phone offers a download that brings the rows back', async () => {
    await env.runtime.storage.removeModule(EN);
    await open();
    await vi.waitFor(() => button('डाउनलोड करें'));
    expect(screen.queryByRole('button', { name: 'पाठ 1' })).toBeNull();
    await fireEvent.click(button('डाउनलोड करें'));
    await vi.waitFor(() => expect(button('पाठ 1')).toBeTruthy(), { timeout: 5000 });
  });

  test('damaged stored lessons are offered for download, with no error', async () => {
    await env.runtime.storage.putModule(EN, 'aaaaaaaaaaaa', { junk: true } as never);
    await open();
    await vi.waitFor(() => button('डाउनलोड करें'));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('no space shows the plain message with the numbers', async () => {
    env = await makeEnv({
      install: false,
      estimator: { estimate: () => Promise.resolve({ quota: 10 * MIB, usage: 9 * MIB }) },
    });
    initApp(env.runtime);
    await env.runtime.content.sync(); // saves the lesson list; every module fails for space
    await open();
    await vi.waitFor(() => button('डाउनलोड करें'));
    await fireEvent.click(button('डाउनलोड करें'));
    await vi.waitFor(() =>
      expect(screen.getAllByRole('alert')[0]?.textContent).toContain('जगह कम है'),
    );
    expect(screen.getAllByRole('alert')[0]?.textContent).toMatch(/MB चाहिए, 1\.0 MB खाली/);
  });

  test('missing audio shows a link that fetches it', async () => {
    const [victim] = await env.runtime.storage.listAudio();
    await env.runtime.storage.removeAudio(victim ?? '');
    await open();
    await vi.waitFor(() => button('ऑडियो डाउनलोड करें'));
    await fireEvent.click(button('ऑडियो डाउनलोड करें'));
    await vi.waitFor(() =>
      expect(screen.queryByRole('button', { name: 'ऑडियो डाउनलोड करें' })).toBeNull(),
    );
    expect(await env.runtime.storage.hasAudio(victim ?? '')).toBe(true);
  });
});

describe('freeing space', () => {
  const finished = ['ef1-01', 'ef1-02', 'ef1-03'];

  test('a finished module can be removed after a confirmation and restored', async () => {
    await open(finished);
    await vi.waitFor(() => button('जगह खाली करें'));
    await fireEvent.click(button('जगह खाली करें'));
    expect(screen.getByText(/आपकी प्रोग्रेस नहीं/)).toBeTruthy();
    await fireEvent.click(button('हटाएँ'));
    await vi.waitFor(() => button('फिर से डाउनलोड करें'));
    expect(screen.queryByRole('button', { name: 'पाठ 1' })).toBeNull();
    expect(await env.runtime.storage.getModule(EN)).toBeNull();
    await fireEvent.click(button('फिर से डाउनलोड करें'));
    await vi.waitFor(() => expect(button('पाठ 1')).toBeTruthy(), { timeout: 5000 });
  });

  test('declining the confirmation keeps the lessons', async () => {
    await open(finished);
    await vi.waitFor(() => button('जगह खाली करें'));
    await fireEvent.click(button('जगह खाली करें'));
    await fireEvent.click(button('रहने दें'));
    expect(await env.runtime.storage.getModule(EN)).not.toBeNull();
    expect(button('जगह खाली करें')).toBeTruthy();
  });

  test('an unfinished module offers no removal', async () => {
    await open(['ef1-01']);
    await vi.waitFor(() => button('पाठ 1'));
    expect(screen.queryByRole('button', { name: 'जगह खाली करें' })).toBeNull();
  });
});
