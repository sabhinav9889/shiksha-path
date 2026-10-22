// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { makeFakeBackend } from '../../../test/helpers/fake-backend.js';
import { makeEnv, type TestEnv } from '../../../test/helpers/installed-runtime.js';
import { setLinked } from '../../account/account.js';
import { appState, initApp, signIn, signOut } from '../../app-state.svelte.js';
import { navigate, router } from '../../router.svelte.js';
import HomeScreen from '../home/HomeScreen.svelte';
import MeScreen from '../me/MeScreen.svelte';
import ProfilesScreen from '../profiles/ProfilesScreen.svelte';

let env: TestEnv;
let backend: ReturnType<typeof makeFakeBackend>;

async function setUp(withBackend: boolean): Promise<void> {
  signOut();
  backend = makeFakeBackend();
  env = await makeEnv(withBackend ? { account: backend.account } : {});
  initApp(env.runtime);
}

beforeEach(async () => {
  await setUp(true);
});

const button = (name: string | RegExp): HTMLButtonElement =>
  screen.getByRole('button', { name }) as HTMLButtonElement;
const text = (): string => document.body.textContent ?? '';

async function enterPin(pin: string): Promise<void> {
  for (const digit of pin) await fireEvent.click(button(digit));
}

describe('creating a profile with a backend', () => {
  test('offers to connect Google after the PIN, and "later" goes home', async () => {
    navigate({ name: 'profiles' });
    render(ProfilesScreen);
    await fireEvent.input(await vi.waitFor(() => screen.getByLabelText('आपका नाम')), {
      target: { value: 'रोहित' },
    });
    await fireEvent.click(button('आगे'));
    await enterPin('4821');
    await vi.waitFor(() => screen.getByText('PIN फिर से डालें'));
    await enterPin('4821');
    await vi.waitFor(() => expect(text()).toContain('अपनी प्रोग्रेस सुरक्षित रखने के लिए'), {
      timeout: 12_000,
    });
    await fireEvent.click(button('बाद में'));
    expect(router.current.name).toBe('home');
  });

  test('"connect" starts Google sign-in for that profile', async () => {
    navigate({ name: 'profiles' });
    render(ProfilesScreen);
    await fireEvent.input(await vi.waitFor(() => screen.getByLabelText('आपका नाम')), {
      target: { value: 'रोहित' },
    });
    await fireEvent.click(button('आगे'));
    await enterPin('4821');
    await vi.waitFor(() => screen.getByText('PIN फिर से डालें'));
    await enterPin('4821');
    await fireEvent.click(await vi.waitFor(() => button('Google से जुड़ें'), { timeout: 12_000 }));
    const signedIn = await backend.google.finishGoogleSignIn('x');
    expect(signedIn?.profileId).toBe(appState.profile?.id);
  });
});

describe('the profile picker', () => {
  test('offers to bring back a profile, and hides a restore that never finished', async () => {
    await env.addProfile('प्रिया');
    const { startRestore } = await import('../../account/restore-flow.js');
    await startRestore(env.runtime, '1111'); // the learner went to Google and never came back
    navigate({ name: 'profiles' });
    render(ProfilesScreen);
    await vi.waitFor(() => button('प्रिया'));
    expect(screen.queryByRole('button', { name: 'restoring' })).toBeNull();
    expect(button('पुरानी प्रोफ़ाइल वापस लाएँ')).toBeTruthy();
  });

  test('bringing back asks for a new PIN twice, then starts Google sign-in', async () => {
    await env.addProfile('प्रिया');
    navigate({ name: 'profiles' });
    render(ProfilesScreen);
    await fireEvent.click(await vi.waitFor(() => button('पुरानी प्रोफ़ाइल वापस लाएँ')));
    expect(text()).toContain('नया 4 अंकों का PIN');
    await enterPin('2468');
    await vi.waitFor(() => screen.getByText('PIN फिर से डालें'));
    await enterPin('2468');
    await vi.waitFor(async () =>
      expect(await backend.google.finishGoogleSignIn('x')).not.toBeNull(),
    );
  });

  test('a phone-only build shows no restore button', async () => {
    await setUp(false);
    await env.addProfile('प्रिया');
    navigate({ name: 'profiles' });
    render(ProfilesScreen);
    await vi.waitFor(() => button('प्रिया'));
    expect(screen.queryByRole('button', { name: 'पुरानी प्रोफ़ाइल वापस लाएँ' })).toBeNull();
  });
});

describe('the reminder to connect', () => {
  test('home reminds an unlinked learner, and not a linked one', async () => {
    const profile = await env.addProfile('प्रिया');
    await signIn(profile.id, '1234');
    const first = render(HomeScreen);
    await vi.waitFor(() => expect(text()).toContain('प्रोग्रेस सिर्फ़ इस फ़ोन पर है'));
    first.unmount();
    await setLinked(env.runtime, profile.id);
    render(HomeScreen);
    await vi.waitFor(() => screen.getByText('पाठ 1'));
    expect(text()).not.toContain('प्रोग्रेस सिर्फ़ इस फ़ोन पर है');
  });

  test('a phone-only build never shows it', async () => {
    await setUp(false);
    const profile = await env.addProfile('प्रिया');
    await signIn(profile.id, '1234');
    render(HomeScreen);
    await vi.waitFor(() => screen.getByText('पाठ 1'));
    expect(text()).not.toContain('Google');
  });

  test('the me screen shows whether the account is connected', async () => {
    const profile = await env.addProfile('प्रिया');
    await signIn(profile.id, '1234');
    const first = render(MeScreen);
    await vi.waitFor(() => button('Google से जुड़ें'));
    first.unmount();
    await setLinked(env.runtime, profile.id);
    render(MeScreen);
    await vi.waitFor(() => expect(text()).toContain('Google खाता: जुड़ा है'));
  });
});

describe('backup code entry points', () => {
  test('the home reminder offers a code as well as Google', async () => {
    const { code } = await backend.issueCode('कोड वाली');
    const profile = await env.addProfile('नया');
    await signIn(profile.id, '1234');
    render(HomeScreen);
    await fireEvent.click(await vi.waitFor(() => button('मेरे पास कोड है')));
    await fireEvent.input(screen.getByLabelText('अपना कोड लिखें'), { target: { value: code } });
    await fireEvent.click(button('कोड से जुड़ें'));
    await vi.waitFor(() => expect(text()).toContain('कोड से जुड़ गया'));
  });

  test('bringing back with a code: PIN twice, then the code, with no trip to Google', async () => {
    const { learnerId, code } = await backend.issueCode('कोड वाली');
    navigate({ name: 'profiles' });
    render(ProfilesScreen);
    await fireEvent.click(await vi.waitFor(() => button('पुरानी प्रोफ़ाइल वापस लाएँ')));
    await fireEvent.click(button('मेरे पास कोड है'));
    await enterPin('5678');
    await enterPin('5678');
    await fireEvent.input(await vi.waitFor(() => screen.getByLabelText('अपना कोड लिखें')), {
      target: { value: code },
    });
    await fireEvent.click(button('कोड से जुड़ें'));
    await vi.waitFor(() => expect(text()).toContain('आपकी प्रोफ़ाइल और प्रोग्रेस वापस आ गई'));
    expect(await env.runtime.profiles.get(learnerId)).not.toBeNull();
    expect(sessionStorage.getItem('shiksha.linking')).toBeNull();
    await fireEvent.click(button('आगे'));
    await vi.waitFor(() => button('कोड वाली')); // back on the picker, with the restored profile
  });

  test('a new profile can use a code at the "connect" step and lands on the picker', async () => {
    const { code } = await backend.issueCode('कोड वाली');
    navigate({ name: 'profiles' });
    render(ProfilesScreen);
    await fireEvent.input(await vi.waitFor(() => screen.getByLabelText('आपका नाम')), {
      target: { value: 'नया' },
    });
    await fireEvent.click(button('आगे'));
    await enterPin('4321');
    await enterPin('4321');
    await fireEvent.click(await vi.waitFor(() => button('मेरे पास कोड है')));
    await fireEvent.input(screen.getByLabelText('अपना कोड लिखें'), { target: { value: code } });
    await fireEvent.click(button('कोड से जुड़ें'));
    await vi.waitFor(() => expect(text()).toContain('कोड से जुड़ गया'));
    await fireEvent.click(button('आगे'));
    await vi.waitFor(() => button('कोड वाली'));
  });
});
