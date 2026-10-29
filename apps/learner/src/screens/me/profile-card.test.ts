// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import type { ProfileResponse } from '@shiksha/api-contract';
import { render, screen, within } from '@testing-library/svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { makeEnv, type TestEnv } from '../../../test/helpers/installed-runtime.js';
import { wipeProfile } from '../../account/forget.js';
import type { ApiClient, ApiResult } from '../../api/api-client.js';
import { initApp, signIn, signOut } from '../../app-state.svelte.js';
import ProfileCard from './ProfileCard.svelte';
import { loadProfileCache, refreshProfile } from './profile-cache.js';

const card: ProfileResponse = {
  email: 'priya@gmail.example',
  cohort: { id: crypto.randomUUID(), name: 'सुबह' },
  mentors: [{ name: 'मीना', email: 'meena@ngo.example' }],
};
const answering = (answer: ApiResult<ProfileResponse>): ApiClient =>
  ({ profile: vi.fn(() => Promise.resolve(answer)) }) as unknown as ApiClient;

let env: TestEnv;
let id: string;

beforeEach(async () => {
  signOut();
  env = await makeEnv();
  initApp(env.runtime);
  id = (await env.addProfile('प्रिया')).id;
});

describe('the details kept on the phone', () => {
  test('a fresh answer is kept; offline the last copy is shown; a refusal clears it', async () => {
    const fresh = await refreshProfile(env.runtime, answering({ ok: true, value: card }), id);
    expect(fresh).toMatchObject({ status: 'fresh', card });
    const offline = await refreshProfile(
      env.runtime,
      answering({ ok: false, error: 'OFFLINE' }),
      id,
    );
    expect(offline).toMatchObject({ status: 'offline', card });
    expect((await refreshProfile(env.runtime, null, id)).card).toEqual(card);
    const gone = await refreshProfile(
      env.runtime,
      answering({ ok: false, error: 'NOT_LINKED' }),
      id,
    );
    expect(gone).toMatchObject({ status: 'off', card: null });
    expect(await loadProfileCache(env.runtime, id)).toBeNull();
  });

  test('a damaged or older copy gives nothing, not a crash; removing the profile removes it', async () => {
    await env.runtime.events.setMeta(`profileCard:${id}`, '{ nope');
    expect(await loadProfileCache(env.runtime, id)).toBeNull();
    await env.runtime.events.setMeta(`profileCard:${id}`, JSON.stringify({ card: { email: 1 } }));
    expect(await loadProfileCache(env.runtime, id)).toBeNull();
    await refreshProfile(env.runtime, answering({ ok: true, value: card }), id);
    await wipeProfile(env.runtime, id);
    expect(await loadProfileCache(env.runtime, id)).toBeNull();
  });
});

describe('the My details card', () => {
  async function open(value: ProfileResponse): Promise<void> {
    await signIn(id, '1234');
    await refreshProfile(env.runtime, answering({ ok: true, value }), id);
    render(ProfileCard);
  }

  test('shows the email, the cohort and each mentor', async () => {
    await open(card);
    const box = (await vi.waitFor(() => screen.getByText('priya@gmail.example'))).closest(
      'section',
    ) as HTMLElement;
    expect(within(box).getByText('सुबह')).toBeTruthy();
    expect(within(box).getByText('मीना')).toBeTruthy();
    expect(within(box).getByText('meena@ngo.example')).toBeTruthy();
  });

  test('without a cohort or an email it says so, and shows no mentors', async () => {
    await open({ email: null, cohort: null, mentors: [] });
    await vi.waitFor(() => screen.getByText('अभी कोई समूह नहीं'));
    expect(screen.queryByText(/@/)).toBeNull();
    expect(screen.getByText('अभी कोई मेंटर नहीं')).toBeTruthy();
  });

  test('text from the server is shown as text, never as markup', async () => {
    await open({ ...card, mentors: [{ name: '<b>x</b>', email: 'a@b.example' }] });
    await vi.waitFor(() => screen.getByText('<b>x</b>'));
    expect(document.querySelector('section b')).toBeNull();
  });
});
