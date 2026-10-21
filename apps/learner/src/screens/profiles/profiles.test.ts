// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { makeEnv, type TestEnv } from '../../../test/helpers/installed-runtime.js';
import { activity } from '../../activity.svelte.js';
import { appState, initApp, signOut } from '../../app-state.svelte.js';
import { navigate, router } from '../../router.svelte.js';
import CreateProfile from './CreateProfile.svelte';
import ProfilesScreen from './ProfilesScreen.svelte';

let env: TestEnv;

beforeEach(async () => {
  signOut();
  navigate({ name: 'profiles' });
  env = await makeEnv();
  initApp(env.runtime);
});

afterEach(() => {
  vi.useRealTimers();
});

const button = (name: string | RegExp): HTMLButtonElement =>
  screen.getByRole('button', { name }) as HTMLButtonElement;

async function enterPin(pin: string): Promise<void> {
  for (const digit of pin) await fireEvent.click(button(digit));
}

const dotsLabel = (): string =>
  screen.getByRole('img', { name: /PIN:/ }).getAttribute('aria-label') ?? '';

describe('signing in', () => {
  test('the right PIN signs in and goes home', async () => {
    await env.addProfile('प्रिया');
    render(ProfilesScreen);
    await vi.waitFor(() => button('प्रिया'));
    await enterPin('1234');
    await vi.waitFor(() => expect(router.current.name).toBe('home'));
    expect(appState.profile?.name).toBe('प्रिया');
  });

  test('a wrong PIN says how many tries are left and clears the dots', async () => {
    await env.addProfile('प्रिया');
    render(ProfilesScreen);
    await vi.waitFor(() => button('प्रिया'));
    await enterPin('0000');
    await vi.waitFor(() => expect(screen.getByRole('alert').textContent).toContain('PIN गलत है'));
    expect(screen.getByRole('alert').textContent).toContain('4');
    expect(dotsLabel()).toContain('0 / 4');
    expect(appState.profile).toBeNull();
  });

  test('five wrong PINs lock the pad with a countdown that ends by itself', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    await env.addProfile('प्रिया');
    render(ProfilesScreen);
    await vi.waitFor(() => button('प्रिया'));
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await enterPin('0000');
      await vi.waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    }
    await vi.waitFor(() => expect(screen.getByRole('alert').textContent).toContain('30 सेकंड'));
    expect(button('1').disabled).toBe(true);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(screen.getByRole('alert').textContent).toContain('20 सेकंड');
    await vi.advanceTimersByTimeAsync(20_000);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(button('1').disabled).toBe(false);
  });

  test('opening the picker signs the previous learner out', async () => {
    const profile = await env.addProfile('A');
    await (await import('../../app-state.svelte.js')).signIn(profile.id, '1234');
    render(ProfilesScreen);
    await vi.waitFor(() => expect(appState.profile).toBeNull());
    expect(activity.current).toBeNull();
  });

  test('a 40-character Devanagari name is shown inside a truncating container', async () => {
    const name = String.fromCodePoint(0x0905).repeat(40);
    await env.addProfile(name);
    render(ProfilesScreen);
    const picker = await vi.waitFor(() => button(name));
    const label = picker.querySelector('[data-testid="profile-name"]') as HTMLElement;
    expect(label.style.textOverflow).toBe('ellipsis');
    expect(label.style.minWidth).toBe('0px');
  });
});

describe('creating a profile', () => {
  const fill = async (name: string): Promise<void> => {
    await fireEvent.input(screen.getByLabelText('आपका नाम'), { target: { value: name } });
  };

  test('with no profiles the create form comes first', async () => {
    render(ProfilesScreen);
    await vi.waitFor(() => expect(screen.getByText('नया प्रोफ़ाइल')).toBeTruthy());
  });

  test('a blank name cannot go on', async () => {
    render(ProfilesScreen);
    await vi.waitFor(() => screen.getByLabelText('आपका नाम'));
    expect(button('आगे').disabled).toBe(true);
    await fill('   ');
    expect(button('आगे').disabled).toBe(true);
  });

  test('two matching PINs create the profile, sign in and go home', async () => {
    render(ProfilesScreen);
    await vi.waitFor(() => screen.getByLabelText('आपका नाम'));
    await fill('रोहित');
    await fireEvent.click(button('आगे'));
    await enterPin('4821');
    await vi.waitFor(() => screen.getByText('PIN फिर से डालें'));
    await enterPin('4821');
    await vi.waitFor(() => expect(router.current.name).toBe('home'), { timeout: 5000 });
    expect(appState.profile?.name).toBe('रोहित');
    expect((await env.runtime.profiles.list()).map((p) => p.name)).toEqual(['रोहित']);
    expect(JSON.stringify(await env.runtime.profiles.list())).not.toContain('4821');
  });

  test('PINs that do not match show a message and ask again', async () => {
    render(ProfilesScreen);
    await vi.waitFor(() => screen.getByLabelText('आपका नाम'));
    await fill('रोहित');
    await fireEvent.click(button('आगे'));
    await enterPin('4821');
    await vi.waitFor(() => screen.getByText('PIN फिर से डालें'));
    await enterPin('1111');
    await vi.waitFor(() => expect(screen.getByRole('alert').textContent).toContain('एक जैसे नहीं'));
    expect(await env.runtime.profiles.list()).toEqual([]);
    expect(screen.getByText('PIN फिर से डालें')).toBeTruthy();
  });

  test('a 41-character name is refused with the plain message and sends the learner back', async () => {
    render(ProfilesScreen);
    await vi.waitFor(() => screen.getByLabelText('आपका नाम'));
    await fill('a'.repeat(41));
    await fireEvent.click(button('आगे'));
    await enterPin('4821');
    await vi.waitFor(() => screen.getByText('PIN फिर से डालें'));
    await enterPin('4821');
    await vi.waitFor(() => expect(screen.getByRole('alert').textContent).toContain('1 से 40'));
    expect(screen.getByLabelText('आपका नाम')).toBeTruthy();
    expect(await env.runtime.profiles.list()).toEqual([]);
  });

  test('choosing English only is recorded and switches the interface to English', async () => {
    render(ProfilesScreen);
    await vi.waitFor(() => screen.getByLabelText('आपका नाम'));
    await fill('Rohit');
    await fireEvent.click(screen.getByLabelText('सिर्फ़ English'));
    await fireEvent.click(button('आगे'));
    await enterPin('4821');
    await vi.waitFor(() => screen.getByText('PIN फिर से डालें'));
    await enterPin('4821');
    await vi.waitFor(() => expect(appState.profile).not.toBeNull(), { timeout: 5000 });
    expect(appState.lang).toBe('en');
    const events = await env.runtime.events.all(appState.profile?.id ?? '');
    expect(events.map((e) => e.type)).toEqual(['language_changed']);
  });
});

describe('hardening', () => {
  test('a retry after a half-finished creation does not make a second profile', async () => {
    const events = env.runtime.events;
    const real = events.append.bind(events);
    let failOnce = true;
    events.append = (event) => {
      if (failOnce) {
        failOnce = false;
        return Promise.reject(new Error('disk'));
      }
      return real(event);
    };
    render(ProfilesScreen);
    await fireEvent.input(await vi.waitFor(() => screen.getByLabelText('आपका नाम')), {
      target: { value: 'रोहित' },
    });
    await fireEvent.click(button('आगे'));
    await enterPin('4821');
    await vi.waitFor(() => screen.getByText('PIN फिर से डालें'));
    await enterPin('4821');
    await vi.waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    await enterPin('4821');
    await vi.waitFor(() => expect(router.current.name).toBe('home'), { timeout: 5000 });
    expect(await env.runtime.profiles.list()).toHaveLength(1);
  });

  test('a locked profile stays locked after looking at another profile and back', async () => {
    await env.addProfile('प्रिया');
    await env.addProfile('रोहित');
    render(ProfilesScreen);
    await fireEvent.click(await vi.waitFor(() => button('प्रिया')));
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await enterPin('0000');
      await vi.waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    }
    // the picker re-reads the stored profiles after each attempt; allow for a busy machine
    const slow = { timeout: 5000 };
    await vi.waitFor(() => expect(button('1').disabled).toBe(true), slow);
    await fireEvent.click(button('रोहित'));
    await vi.waitFor(() => expect(button('1').disabled).toBe(false), slow);
    await fireEvent.click(button('प्रिया'));
    await vi.waitFor(() => expect(button('1').disabled).toBe(true), slow);
  });
});

describe('with the English-only option switched off', () => {
  // The picker signs everybody out, so a new profile normally sees every feature on; the form
  // itself still follows the switch.
  test('the create form offers no English-only choice', async () => {
    appState.switches = { ...appState.switches, english_only_option: false };
    render(CreateProfile, { lang: 'hi', existingCount: 0 });
    await vi.waitFor(() => screen.getByLabelText('आपका नाम'));
    expect(screen.queryByLabelText('सिर्फ़ English')).toBeNull();
    expect(screen.getByLabelText('हिंदी + English')).toBeTruthy();
  });
});
