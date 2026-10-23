// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { DEFAULT_BRANDING } from '@shiksha/api-contract';
import { render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, test } from 'vitest';
import { makeFakeBackend, type FakeBackend } from '../../test/helpers/fake-backend.js';
import { makeEnv, type TestEnv } from '../../test/helpers/installed-runtime.js';
import { appState, initApp, reloadBranding, signOut } from '../app-state.svelte.js';
import NavBar from '../ui/NavBar.svelte';
import { applyBranding, loadBranding, refreshBranding } from './branding.js';

let env: TestEnv;
let backend: FakeBackend;
const GREEN = { name: { hi: 'नई राह', en: 'New Path' }, primary: '#1f6f43', accent: '#9a3412' };

beforeEach(async () => {
  signOut();
  backend = makeFakeBackend();
  env = await makeEnv({ account: backend.account });
  initApp(env.runtime);
});

describe('branding on the phone', () => {
  test('with nothing cached, or a damaged cache, it is the default', async () => {
    expect(await loadBranding(env.runtime)).toEqual(DEFAULT_BRANDING);
    await env.runtime.events.setMeta('branding', '{"name":');
    expect(await loadBranding(env.runtime)).toEqual(DEFAULT_BRANDING);
    await env.runtime.events.setMeta('branding', JSON.stringify({ primary: 'red' }));
    expect(await loadBranding(env.runtime)).toEqual(DEFAULT_BRANDING);
  });

  test('a sync fetches it, signed in or not, and it stays after a restart offline', async () => {
    await backend.repos.branding.set(GREEN);
    const profile = await env.addProfile('प्रिया'); // not linked to anything
    await env.runtime.sync(profile.id);
    expect(await loadBranding(env.runtime)).toEqual({ ...GREEN, version: 1 });
    backend.setOnline(false);
    await refreshBranding(env.runtime);
    expect((await loadBranding(env.runtime)).primary).toBe('#1f6f43');
  });

  test('the colours go on the page, and the name in the top bar', async () => {
    await backend.repos.branding.set(GREEN);
    await refreshBranding(env.runtime);
    await reloadBranding();
    applyBranding(appState.brand, document, 'hi');
    const style = document.documentElement.style;
    expect(style.getPropertyValue('--color-primary')).toBe('#1f6f43');
    expect(style.getPropertyValue('--color-accent')).toBe('#9a3412');
    expect(style.getPropertyValue('--color-primary-dark')).toBe('#164e2f');
    expect(style.getPropertyValue('--color-primary-soft')).toBe('#e9f1ec');
    render(NavBar, { lang: 'hi', current: 'home' });
    expect(screen.getByText('नई राह')).toBeTruthy();
    expect(document.title).toBe('नई राह');
  });
});
