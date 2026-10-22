// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import App from './App.svelte';
import { activity } from './activity.svelte.js';
import { appState, signOut } from './app-state.svelte.js';
import { navigate } from './router.svelte.js';

beforeEach(() => {
  signOut();
});

describe('App', () => {
  test('mounts and shows its root element', () => {
    render(App);
    expect(screen.getByTestId('app-root')).toBeTruthy();
  });

  test('without a signed-in profile every route shows the profiles screen', async () => {
    navigate({ name: 'home' });
    render(App);
    await tick();
    await vi.waitFor(() => expect(screen.getByText('नया प्रोफ़ाइल')).toBeTruthy());
  });
});

describe('the staff section', () => {
  test('opens without a student profile, loaded on demand', async () => {
    navigate({ name: 'staff', view: 'cohorts' });
    render(App);
    await vi.waitFor(() =>
      expect(screen.getByText(/मेंटर और एडमिन अपने NGO Google खाते से साइन इन करें/)).toBeTruthy(),
    );
  });
});

describe('leaving a run without finishing it', () => {
  const stub = { kind: 'review', run: { entries: [], answered: [] } } as never;

  test('browser Back or a nav tab clears the run that was in progress', async () => {
    appState.profile = { id: 'p', name: 'प्रिया' };
    activity.current = stub;
    navigate({ name: 'home' });
    render(App);
    await tick();
    expect(activity.current).toBeNull();
  });

  test('moving between the lesson, practice and finish screens keeps it', async () => {
    appState.profile = { id: 'p', name: 'प्रिया' };
    activity.current = stub;
    navigate({ name: 'practice' });
    render(App);
    await tick();
    expect(activity.current).not.toBeNull();
  });
});
