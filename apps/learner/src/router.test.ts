// @vitest-environment jsdom
import { describe, expect, test } from 'vitest';
import { navigate, parseRoute, routeHref, router, type Route } from './router.svelte.js';

const ROUTES: Route[] = [
  { name: 'profiles' },
  { name: 'home' },
  { name: 'lessons' },
  { name: 'learn', lessonId: 'ef1-01' },
  { name: 'practice' },
  { name: 'finish' },
  { name: 'placement' },
  { name: 'placement-result' },
];

describe('parseRoute', () => {
  test('reads each known route', () => {
    expect(parseRoute('#/learn/ef1-01')).toEqual({ name: 'learn', lessonId: 'ef1-01' });
    expect(parseRoute('#/practice')).toEqual({ name: 'practice' });
    expect(parseRoute('#/lessons')).toEqual({ name: 'lessons' });
  });

  test('empty, unknown and malformed hashes go home', () => {
    for (const hash of ['', '#', '#/nonsense', '#/learn/', '#/learn/../../x', '#/learn/A B']) {
      expect(parseRoute(hash)).toEqual({ name: 'home' });
    }
  });

  test('routeHref and parseRoute round-trip every route', () => {
    for (const route of ROUTES) expect(parseRoute(routeHref(route))).toEqual(route);
  });
});

describe('navigate', () => {
  test('updates the current route and the address', () => {
    navigate({ name: 'lessons' });
    expect(router.current).toEqual({ name: 'lessons' });
    expect(window.location.hash).toBe('#/lessons');
  });
});
