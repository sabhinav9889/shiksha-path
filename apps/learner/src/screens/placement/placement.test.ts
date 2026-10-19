// @vitest-environment jsdom
import type { LearnerEvent } from '@shiksha/learner-core';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { makeEnv, type TestEnv } from '../../../test/helpers/installed-runtime.js';
import { activity } from '../../activity.svelte.js';
import { appState, initApp, signIn, signOut } from '../../app-state.svelte.js';
import { navigate, router } from '../../router.svelte.js';
import PlacementScreen from './PlacementScreen.svelte';
import { startPlacementRun } from './placement-flow.js';

let env: TestEnv;

beforeEach(async () => {
  signOut();
  env = await makeEnv();
  initApp(env.runtime);
  const profile = await env.addProfile('प्रिया');
  await signIn(profile.id, '1234');
});

const button = (name: string | RegExp): HTMLButtonElement =>
  screen.getByRole('button', { name }) as HTMLButtonElement;
const log = async (): Promise<LearnerEvent[]> => env.runtime.events.all(appState.profile?.id ?? '');
const count = async (type: string): Promise<number> =>
  (await log()).filter((e) => e.type === type).length;

async function answerOrder(right: boolean): Promise<void> {
  for (const word of right ? ['I', 'am', 'Priya'] : ['am', 'I', 'Priya']) {
    const tile = await vi.waitFor(() => {
      const found = screen.getByTestId('bank').querySelector(`button[data-word="${word}"]`);
      if (!found) throw new Error('not yet');
      return found;
    });
    await fireEvent.click(tile);
  }
  await fireEvent.click(button('जाँचें'));
}

async function open(): Promise<void> {
  expect(await startPlacementRun()).toBe(true);
  render(PlacementScreen);
}

describe('taking the placement test', () => {
  test('starting it opens the placement run', async () => {
    expect(await startPlacementRun()).toBe(true);
    expect(router.current.name).toBe('placement');
    expect(activity.current?.kind).toBe('placement');
  });

  test('shows one progress segment per track and the not-an-exam note', async () => {
    await open();
    await vi.waitFor(() => expect(screen.getAllByTestId('segment')).toHaveLength(2));
    expect(document.body.textContent).toContain('यह परीक्षा नहीं है');
    // the track's title comes from the stored lesson list
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('शुरुआती टेस्ट · अंग्रेज़ी'),
    );
  });

  test('answering every item shows no right or wrong, and ends on the result', async () => {
    await open();
    for (let i = 0; i < 7; i += 1) {
      await answerOrder(i % 2 === 0);
      expect(screen.queryByRole('status')).toBeNull();
      await fireEvent.click(await vi.waitFor(() => button('आगे')));
    }
    await vi.waitFor(() => expect(router.current.name).toBe('placement-result'));
    expect(await count('placement_completed')).toBe(1);
    expect(activity.placementResult?.sections.map((s) => s.track)).toEqual(['english', 'aptitude']);
  });

  test('tapping next twice on the last item records one result', async () => {
    await open();
    for (let i = 0; i < 6; i += 1) {
      await answerOrder(true);
      await fireEvent.click(await vi.waitFor(() => button('आगे')));
    }
    await answerOrder(true);
    const next = await vi.waitFor(() => button('आगे'));
    next.click();
    next.click();
    await vi.waitFor(() => expect(router.current.name).toBe('placement-result'));
    expect(await count('placement_completed')).toBe(1);
  });

  test('a failed save of the result shows a plain message and can be retried', async () => {
    await open();
    for (let i = 0; i < 6; i += 1) {
      await answerOrder(true);
      await fireEvent.click(await vi.waitFor(() => button('आगे')));
    }
    await answerOrder(true);
    const events = env.runtime.events;
    const real = events.append.bind(events);
    let failOnce = true;
    events.append = (event) => {
      if (event.type === 'placement_completed' && failOnce) {
        failOnce = false;
        return Promise.reject(new Error('full'));
      }
      return real(event);
    };
    await fireEvent.click(await vi.waitFor(() => button('आगे')));
    await vi.waitFor(() => expect(screen.getByRole('alert').textContent).toContain('कुछ गड़बड़'));
    await fireEvent.click(button('फिर कोशिश करें'));
    await vi.waitFor(() => expect(router.current.name).toBe('placement-result'));
    expect(await count('placement_completed')).toBe(1);
  });
});

describe('skipping and interrupting', () => {
  test('skipping asks first, then remembers the skip and keeps the first lesson', async () => {
    await open();
    await fireEvent.click(await vi.waitFor(() => button('छोड़ें, शुरू से पढ़ूँगा')));
    await fireEvent.click(button('टेस्ट दूँगा'));
    expect(await count('placement_skipped')).toBe(0);
    await fireEvent.click(button('छोड़ें, शुरू से पढ़ूँगा'));
    await fireEvent.click(button('हाँ, छोड़ें'));
    await vi.waitFor(() => expect(router.current.name).toBe('home'));
    expect(await count('placement_skipped')).toBe(1);
    expect(activity.current).toBeNull();
    expect(appState.session?.needsPlacement()).toBe(false);
    expect(appState.session?.todayLesson()?.lessonId).toBe('ef1-01');
  });

  test('with no run in progress (a reload) it goes home and records no result', async () => {
    navigate({ name: 'placement' });
    render(PlacementScreen);
    await vi.waitFor(() => expect(router.current.name).toBe('home'));
    expect(await count('placement_completed')).toBe(0);
  });

  test('a phone without the placement test cannot start it', async () => {
    await env.runtime.storage.removePlacement();
    signOut();
    const profile = await env.addProfile('रोहित');
    await signIn(profile.id, '1234');
    expect(await startPlacementRun()).toBe(false);
    expect(activity.current).toBeNull();
  });
});
