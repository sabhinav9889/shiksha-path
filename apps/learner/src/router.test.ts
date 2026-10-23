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
  { name: 'me' },
  { name: 'auth-callback' },
  { name: 'staff', view: 'cohorts' },
  { name: 'staff', view: 'recordings' },
  { name: 'staff', view: 'student', id: '0f8fad5b-d9cb-469f-a165-70867728950e' },
  { name: 'staff', view: 'admin', section: 'students' },
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

describe('the sign-in callback', () => {
  test('ignores the query Google sign-in adds', () => {
    expect(parseRoute('#/auth-callback?code=abc123')).toEqual({ name: 'auth-callback' });
  });
});

describe('navigate', () => {
  test('updates the current route and the address', () => {
    navigate({ name: 'lessons' });
    expect(router.current).toEqual({ name: 'lessons' });
    expect(window.location.hash).toBe('#/lessons');
  });
});

describe('the staff section', () => {
  test('reads its views; a bad student id or admin section goes to the cohorts', () => {
    expect(parseRoute('#/staff')).toEqual({ name: 'staff', view: 'cohorts' });
    expect(parseRoute('#/staff/admin/audit')).toEqual({
      name: 'staff',
      view: 'admin',
      section: 'audit',
    });
    expect(parseRoute('#/staff?code=x')).toEqual({ name: 'staff', view: 'cohorts' });
    for (const hash of ['#/staff/student/nope', '#/staff/admin/hack', '#/staff/what']) {
      expect(parseRoute(hash)).toEqual({ name: 'staff', view: 'cohorts' });
    }
  });
});
