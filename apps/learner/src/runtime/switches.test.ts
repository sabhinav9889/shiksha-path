// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, test } from 'vitest';
import { makeFakeBackend, type FakeBackend } from '../../test/helpers/fake-backend.js';
import { makeEnv, type TestEnv } from '../../test/helpers/installed-runtime.js';
import { setLinked } from '../account/account.js';
import { appState, initApp, signIn, signOut } from '../app-state.svelte.js';
import { ALL_ON, loadSwitches, refreshSwitches } from './switches.js';

let env: TestEnv;
let backend: FakeBackend;
let learner: string;

beforeEach(async () => {
  signOut();
  backend = makeFakeBackend();
  env = await makeEnv({ account: backend.account });
  initApp(env.runtime);
  const profile = await env.addProfile('प्रिया');
  learner = profile.id;
  backend.useGoogleAccount('google-priya');
  await backend.google.startGoogleSignIn(learner);
  await backend.google.finishGoogleSignIn('x');
  await backend.serverFor('google-priya').link({ profileId: learner, name: 'प्रिया' });
  await setLinked(env.runtime, learner);
});

const api = () => backend.serverFor('google-priya');

describe('loading switches', () => {
  test('with nothing cached every feature is on', async () => {
    expect(await loadSwitches(env.runtime, learner)).toEqual(ALL_ON);
    expect(Object.values(ALL_ON).every(Boolean)).toBe(true);
  });

  test('a cached value missing a key treats it as on', async () => {
    await env.runtime.events.setMeta(
      `switches:${learner}`,
      JSON.stringify({ placement_test: false }),
    );
    expect(await loadSwitches(env.runtime, learner)).toEqual({ ...ALL_ON, placement_test: false });
  });

  test('a damaged cache falls back to every feature on', async () => {
    await env.runtime.events.setMeta(`switches:${learner}`, '{not json');
    expect(await loadSwitches(env.runtime, learner)).toEqual(ALL_ON);
    await env.runtime.events.setMeta(`switches:${learner}`, '{"placement_test":"no"}');
    expect(await loadSwitches(env.runtime, learner)).toEqual(ALL_ON);
  });
});

describe('refreshing from /v1/me', () => {
  test('stores what the server says, including a personal override', async () => {
    await backend.repos.setAllStudents('speaking_practice', false);
    await backend.repos.setOverride(learner, 'placement_test', false);
    await refreshSwitches(env.runtime, api(), learner);
    expect(await loadSwitches(env.runtime, learner)).toEqual({
      ...ALL_ON,
      speaking_practice: false,
      placement_test: false,
    });
  });

  test('a failing /v1/me keeps the cached values', async () => {
    await backend.repos.setAllStudents('placement_test', false);
    await refreshSwitches(env.runtime, api(), learner);
    await backend.repos.setAllStudents('placement_test', true);
    backend.setOnline(false);
    await refreshSwitches(env.runtime, api(), learner);
    expect((await loadSwitches(env.runtime, learner)).placement_test).toBe(false);
  });

  test('two learners on one phone keep separate switch values', async () => {
    const other = await env.addProfile('रवि');
    await backend.repos.setOverride(learner, 'english_only_option', false);
    await refreshSwitches(env.runtime, api(), learner);
    expect((await loadSwitches(env.runtime, learner)).english_only_option).toBe(false);
    expect(await loadSwitches(env.runtime, other.id)).toEqual(ALL_ON);
  });
});

describe('the app state', () => {
  test('sign-in shows the cached switches, then the server refreshes them', async () => {
    await env.runtime.events.setMeta(
      `switches:${learner}`,
      JSON.stringify({ ...ALL_ON, community_feed: false }),
    );
    await backend.repos.setAllStudents('placement_test', false);
    await signIn(learner, '1234');
    expect(appState.switches.community_feed).toBe(false);
    await expect.poll(() => appState.switches.placement_test).toBe(false);
    expect(appState.switches.community_feed).toBe(true);
  });

  test('a sync refreshes the switches', async () => {
    await signIn(learner, '1234');
    await expect.poll(() => appState.switches.placement_test).toBe(true);
    await backend.repos.setAllStudents('placement_test', false);
    await env.runtime.sync(learner);
    expect((await loadSwitches(env.runtime, learner)).placement_test).toBe(false);
  });

  test('signing out goes back to every feature on', async () => {
    await env.runtime.events.setMeta(`switches:${learner}`, JSON.stringify({ ai_doubts: false }));
    await signIn(learner, '1234');
    expect(appState.switches.ai_doubts).toBe(false);
    signOut();
    expect(appState.switches).toEqual(ALL_ON);
  });
});
