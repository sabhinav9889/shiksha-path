// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { render, screen, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, test } from 'vitest';
import { makeEnv, type TestEnv } from '../../test/helpers/installed-runtime.js';
import { appState, initApp, signIn, signOut } from '../app-state.svelte.js';
import { navigate, parseRoute, routeHref } from '../router.svelte.js';
import HomeScreen from '../screens/home/HomeScreen.svelte';
import App from '../App.svelte';

let env: TestEnv;

beforeEach(async () => {
  signOut();
  env = await makeEnv();
  initApp(env.runtime);
});

describe('the community page address and entry', () => {
  test('#/community is its own page; anything longer goes home', () => {
    expect(parseRoute('#/community')).toEqual({ name: 'community' });
    expect(routeHref({ name: 'community' })).toBe('#/community');
    expect(parseRoute('#/community/x')).toEqual({ name: 'home' });
  });

  test('the home screen links to it while the feature is on, and not when it is off', async () => {
    const profile = await env.addProfile('प्रिया');
    await signIn(profile.id, '1234');
    const { unmount } = render(HomeScreen);
    const link = await waitFor(() => screen.getByRole('link', { name: /समुदाय/ }));
    expect(link.getAttribute('href')).toBe('#/community');
    unmount();
    appState.switches = { ...appState.switches, community_feed: false };
    render(HomeScreen);
    await waitFor(() => screen.getByText('नमस्ते, प्रिया'));
    expect(screen.queryByRole('link', { name: /समुदाय/ })).toBeNull();
  });

  test('the app opens the community page for a signed-in student, with the nav bar', async () => {
    const profile = await env.addProfile('प्रिया');
    await signIn(profile.id, '1234');
    navigate({ name: 'community' });
    render(App);
    await waitFor(() => screen.getByRole('heading', { level: 1, name: 'समुदाय' }));
    expect(screen.getByRole('navigation')).toBeTruthy();
  });

  test('a signed-out phone is sent to the profile picker, not the feed', async () => {
    navigate({ name: 'community' });
    render(App);
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'समुदाय' })).toBeNull());
  });
});
