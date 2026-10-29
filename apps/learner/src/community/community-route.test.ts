// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { render, screen, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, test } from 'vitest';
import { makeEnv, type TestEnv } from '../../test/helpers/installed-runtime.js';
import { appState, initApp, signIn, signOut } from '../app-state.svelte.js';
import { navigate, parseRoute, routeHref } from '../router.svelte.js';
import NavBar from '../ui/NavBar.svelte';
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

  test('the navigation has a Community tab while the feature is on, and not when it is off', async () => {
    const { unmount } = render(NavBar, { lang: 'hi', current: 'home' });
    const tabs = screen.getAllByRole('link').map((a) => a.textContent?.trim());
    expect(tabs).toEqual(['होम', 'पाठ', 'समुदाय', 'मैं']);
    expect(screen.getByRole('link', { name: 'समुदाय' }).getAttribute('href')).toBe('#/community');
    unmount();
    appState.switches = { ...appState.switches, community_feed: false };
    render(NavBar, { lang: 'hi', current: 'home' });
    expect(screen.queryByRole('link', { name: 'समुदाय' })).toBeNull();
  });

  test('on the community page its tab is the current one', () => {
    render(NavBar, { lang: 'hi', current: 'community' });
    expect(screen.getByRole('link', { name: 'समुदाय' }).getAttribute('aria-current')).toBe('page');
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
