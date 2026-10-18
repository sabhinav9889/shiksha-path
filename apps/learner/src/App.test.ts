// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte';
import { describe, expect, test } from 'vitest';
import App from './App.svelte';

describe('App', () => {
  test('mounts and shows its root element', () => {
    render(App);
    expect(screen.getByTestId('app-root')).toBeTruthy();
  });
});
