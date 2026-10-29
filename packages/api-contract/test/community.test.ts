import { describe, expect, test } from 'vitest';
import { FEED_CAP, feedResponse } from '../src/community.js';
import {
  postDeleteRequest,
  postRequest,
  STAFF_POSTS_CAP,
  staffPostsResponse,
} from '../src/community-staff.js';

const cohortId = '3b241101-e2bb-4255-8caf-4136c566a962';
const base = { title: 'Mock interview', body: 'Bring a pen', audience: { kind: 'all' } } as const;
const post = (over: Record<string, unknown>): unknown => ({ ...base, session: null, ...over });
const session = (link: string | null): unknown =>
  post({ session: { startsAt: '2026-11-10T10:00:00+05:30', minutes: 60, link } });

describe('postRequest', () => {
  test('accepts a plain post to everyone and one to a cohort with a session', () => {
    expect(postRequest.safeParse(post({})).success).toBe(true);
    const cohort = post({ audience: { kind: 'cohort', cohortId } });
    expect(postRequest.safeParse(cohort).success).toBe(true);
    expect(postRequest.safeParse(session('https://meet.google.com/abc-defg-hij')).success).toBe(
      true,
    );
    expect(postRequest.safeParse(session(null)).success).toBe(true);
  });

  test.each([
    'javascript:alert(1)',
    'data:text/html,x',
    'http://meet.google.com/x',
    `https://example.org/${'a'.repeat(500)}`,
  ])('refuses the session link %s', (link) => {
    expect(postRequest.safeParse(session(link)).success).toBe(false);
  });

  test('limits the title, body and session length and refuses unknown keys', () => {
    const bad = (over: Record<string, unknown>): boolean =>
      postRequest.safeParse(post(over)).success;
    expect(bad({ title: 'x'.repeat(121) })).toBe(false);
    expect(bad({ title: '   ' })).toBe(false);
    expect(bad({ body: 'x'.repeat(4001) })).toBe(false);
    expect(bad({ body: '' })).toBe(true);
    expect(bad({ extra: 1 })).toBe(false);
    expect(bad({ audience: { kind: 'cohort' } })).toBe(false);
    const minutes = (n: number): boolean =>
      bad({ session: { startsAt: '2026-11-10T10:00:00+05:30', minutes: n, link: null } });
    expect([minutes(14), minutes(15), minutes(480), minutes(481)]).toEqual([
      false,
      true,
      true,
      false,
    ]);
    expect(bad({ session: { startsAt: 'tomorrow', minutes: 60, link: null } })).toBe(false);
  });

  test('trims the title and keeps markup as plain text', () => {
    const parsed = postRequest.parse(post({ title: '  Hi  ', body: '<script>x</script>' }));
    expect(parsed.title).toBe('Hi');
    expect(parsed.body).toBe('<script>x</script>');
  });

  test('a delete takes one uuid and nothing else', () => {
    expect(postDeleteRequest.safeParse({ id: cohortId }).success).toBe(true);
    expect(postDeleteRequest.safeParse({ id: 'x' }).success).toBe(false);
    expect(postDeleteRequest.safeParse({ id: cohortId, more: 1 }).success).toBe(false);
  });
});

describe('what a phone and the staff section read', () => {
  const row = {
    id: cohortId,
    title: 'T',
    body: '',
    authorName: null,
    toCohort: false,
    createdAt: '2026-11-01T00:00:00.000Z',
    editedAt: null,
    session: null,
  };

  test('a newer server adding a field never breaks an older phone', () => {
    const parsed = feedResponse.parse({ posts: [{ ...row, pinned: true }] });
    expect(parsed.posts[0]).not.toHaveProperty('pinned');
  });

  test('a feed is capped', () => {
    const many = Array.from({ length: FEED_CAP + 1 }, () => row);
    expect(feedResponse.safeParse({ posts: many }).success).toBe(false);
  });

  test('staff posts carry who may change them', () => {
    const staff = { ...row, cohortId: null, canEdit: true, canDelete: true };
    expect(staffPostsResponse.parse({ posts: [staff] }).posts).toHaveLength(1);
    const many = Array.from({ length: STAFF_POSTS_CAP + 1 }, () => staff);
    expect(staffPostsResponse.safeParse({ posts: many }).success).toBe(false);
  });
});
