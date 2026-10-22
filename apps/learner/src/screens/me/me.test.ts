// @vitest-environment jsdom
import { createEvent } from '@shiksha/learner-core';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { makeEnv, type TestEnv } from '../../../test/helpers/installed-runtime.js';
import App from '../../App.svelte';
import { activity } from '../../activity.svelte.js';
import { appState, initApp, signIn, signOut } from '../../app-state.svelte.js';
import { navigate, router } from '../../router.svelte.js';
import { captureInstallPrompt, install } from '../../runtime/install-prompt.js';
import MeScreen from './MeScreen.svelte';

let env: TestEnv;

beforeEach(async () => {
  signOut();
  install.prompt = null;
  env = await makeEnv();
  initApp(env.runtime);
});

async function open(name = 'प्रिया'): Promise<string> {
  const profile = await env.addProfile(name);
  await signIn(profile.id, '1234');
  navigate({ name: 'me' });
  render(MeScreen);
  await vi.waitFor(() => screen.getByRole('button', { name: /अभी sync करें|Sync now/ }));
  return profile.id;
}

const button = (name: string | RegExp): HTMLButtonElement =>
  screen.getByRole('button', { name }) as HTMLButtonElement;
const text = (): string => document.body.textContent ?? '';

async function record(learnerId: string, bytes: number): Promise<void> {
  await env.runtime.recordings.put({
    id: `r-${learnerId}-${bytes}`,
    learnerId,
    lessonId: 'ef1-01',
    itemId: `s${bytes}`,
    mime: 'audio/webm',
    bytes: new Uint8Array(bytes),
    durationMs: 1000,
    at: '2026-10-19T10:00:00.000Z',
  });
}

describe('language', () => {
  test('switching to English only changes the interface and is recorded', async () => {
    const id = await open();
    expect(button(/हिंदी \+ English/).getAttribute('aria-pressed')).toBe('true');
    await fireEvent.click(button(/सिर्फ़ English/));
    await vi.waitFor(() => expect(text()).toContain('Language'));
    // the names come from the catalogue, in the interface's language
    expect(button(/Hindi \+ English/)).toBeTruthy();
    expect(button(/English only/).getAttribute('aria-pressed')).toBe('true');
    expect(appState.lang).toBe('en');
    const events = (await env.runtime.events.all(id)).filter((e) => e.type === 'language_changed');
    expect(events.at(-1)?.data).toEqual({ preference: 'en_only' });
  });
});

describe('sync', () => {
  test('says when nothing was ever uploaded, and reports a sync plainly', async () => {
    await open();
    expect(text()).toContain('अभी तक sync नहीं हुआ');
    await fireEvent.click(button('अभी sync करें'));
    await vi.waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain('पाठ अपडेट हो गए'),
    );
  });

  test('a lesson list that cannot be fetched shows the plain message', async () => {
    env = await makeEnv({ install: false });
    initApp(env.runtime);
    env.server.failing.add('manifest.json');
    await open();
    await fireEvent.click(button('अभी sync करें'));
    await vi.waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain('सूची अभी नहीं मिली'),
    );
  });

  test('pending changes are counted', async () => {
    const profile = await env.addProfile('प्रिया');
    await env.runtime.events.append(
      createEvent(env.runtime, profile.id, 'language_changed', { preference: 'hi_en' }),
    );
    await signIn(profile.id, '1234');
    render(MeScreen);
    await vi.waitFor(() => expect(text()).toContain('1 बदलाव अपलोड होने बाकी'));
  });
});

describe('storage', () => {
  test('lists the downloaded modules with their size, and marks a removed one', async () => {
    await env.runtime.content.remove('aptitude-1');
    await open();
    await vi.waitFor(() => expect(text()).toContain('MB इस्तेमाल'));
    const rows = screen.getAllByTestId('module-row').map((row) => row.textContent ?? '');
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.includes('मॉड्यूल') && r.includes('✓'))).toBeTruthy();
    expect(rows.some((r) => r.includes('हटाया गया'))).toBe(true);
  });

  test("counts only the signed-in learner's recordings", async () => {
    const other = await env.addProfile('रोहित');
    await record(other.id, 5000);
    const profile = await env.addProfile('प्रिया');
    await record(profile.id, 1000);
    await record(profile.id, 2000);
    await signIn(profile.id, '1234');
    render(MeScreen);
    await vi.waitFor(() => expect(text()).toContain('2 रिकॉर्डिंग'));
    expect(text()).not.toContain('3 रिकॉर्डिंग');
  });
});

describe('install', () => {
  test('the install button shows only once the browser offered it, and prompts once', async () => {
    const target = new EventTarget();
    install.prompt = captureInstallPrompt(target);
    await open();
    expect(screen.queryByRole('button', { name: 'फ़ोन पर इंस्टॉल करें' })).toBeNull();
    const event = Object.assign(new Event('beforeinstallprompt'), {
      prompt: vi.fn(() => Promise.resolve()),
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    });
    target.dispatchEvent(event);
    await fireEvent.click(await vi.waitFor(() => button('फ़ोन पर इंस्टॉल करें')));
    expect(event.prompt).toHaveBeenCalledTimes(1);
    await vi.waitFor(() =>
      expect(screen.queryByRole('button', { name: 'फ़ोन पर इंस्टॉल करें' })).toBeNull(),
    );
  });
});

describe('switching and signing out on a shared phone', () => {
  // the first learner chose English, so the buttons read in English
  test.each(['Switch profile', 'Sign out'])(
    '"%s" leaves nothing of the learner, and Back does not return',
    async (label) => {
      const first = await env.addProfile('प्रिया');
      await record(first.id, 1000);
      await signIn(first.id, '1234');
      await setEnglish();
      navigate({ name: 'me' });
      render(App);
      await fireEvent.click(await vi.waitFor(() => button(label)));
      expect([appState.profile, appState.session, activity.current]).toEqual([null, null, null]);
      expect(appState.lang).toBe('hi');
      await vi.waitFor(() => expect(router.current.name).toBe('profiles'));
      navigate({ name: 'me' }); // what the browser Back button does
      await tick();
      await vi.waitFor(() => expect(router.current.name).toBe('profiles'));
      expect(text()).not.toContain('Language');

      const second = await env.addProfile('रोहित');
      await signIn(second.id, '1234');
      expect(appState.lang).toBe('hi');
      expect(await env.runtime.recordings.summary(second.id)).toEqual({ count: 0, bytes: 0 });
    },
  );
});

async function setEnglish(): Promise<void> {
  const { setLanguagePreference } = await import('../../app-state.svelte.js');
  await setLanguagePreference('en_only');
}

describe('navigation', () => {
  test('the bottom bar has a मैं tab that is marked on this screen', async () => {
    const profile = await env.addProfile('प्रिया');
    await signIn(profile.id, '1234');
    navigate({ name: 'me' });
    render(App);
    const tab = await vi.waitFor(() => screen.getByRole('link', { name: 'मैं' }));
    expect(tab.getAttribute('aria-current')).toBe('page');
  });
});

describe('with the English-only option switched off', () => {
  test('the me screen offers only हिंदी + English', async () => {
    const profile = await env.addProfile('रवि');
    await env.runtime.events.setMeta(
      `switches:${profile.id}`,
      JSON.stringify({ english_only_option: false }),
    );
    await signIn(profile.id, '1234');
    render(MeScreen);
    await vi.waitFor(() => button(/हिंदी \+ English/));
    expect(screen.queryByRole('button', { name: /सिर्फ़ English/ })).toBeNull();
  });
});

describe('when a sync breaks', () => {
  test('the button comes back and the learner is told the work is saved on the phone', async () => {
    await open();
    env.runtime.sync = () => Promise.reject(new Error('broken'));
    await fireEvent.click(button(/अभी sync करें/));
    await vi.waitFor(() => expect(text()).toContain('फ़ोन में सेव · इंटरनेट मिलते ही अपलोड'));
    expect(button(/अभी sync करें/).disabled).toBe(false);
  });
});
