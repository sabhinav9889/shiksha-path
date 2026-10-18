// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import App from './App.svelte';
import { signOut } from './app-state.svelte.js';
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
