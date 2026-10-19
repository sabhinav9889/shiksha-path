import { afterEach } from 'vitest';

// Vitest runs without globals, so Testing Library's automatic cleanup is off. Unmount rendered
// components after every test, but only in files that have a DOM.
if (typeof document !== 'undefined') {
  const { cleanup } = await import('@testing-library/svelte');
  afterEach(cleanup);
}
