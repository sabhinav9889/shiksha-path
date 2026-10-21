import { randomUUID } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import {
  API_ERRORS,
  FEATURE_KEYS,
  errorBody,
  linkRequest,
  linkResponse,
  meResponse,
  pullQuery,
  pullResponse,
  pushRequest,
  pushResponse,
} from '../src/index.js';

const id = randomUUID();
const ok = (schema: { safeParse(v: unknown): { success: boolean } }, value: unknown): boolean =>
  schema.safeParse(value).success;

describe('error bodies', () => {
  test('carry one of the agreed codes and nothing else', () => {
    expect([...API_ERRORS]).toEqual([
      'UNAUTHENTICATED',
      'NOT_LINKED',
      'FORBIDDEN',
      'INVALID_REQUEST',
      'PROFILE_TAKEN',
      'TOO_LARGE',
      'INTERNAL',
      'RATE_LIMITED',
      'FEATURE_OFF',
      'BAD_CODE',
    ]);
    expect(ok(errorBody, { error: 'FORBIDDEN' })).toBe(true);
    expect(ok(errorBody, { error: 'NOPE' })).toBe(false);
    expect(ok(errorBody, { error: 'FORBIDDEN', stack: 'x' })).toBe(false);
  });
});

describe('link', () => {
  test('accepts a profile id and a 1–40 character name', () => {
    expect(ok(linkRequest, { profileId: id, name: 'प्रिया' })).toBe(true);
    expect(ok(linkRequest, { profileId: id, name: 'a'.repeat(41) })).toBe(false);
    expect(ok(linkRequest, { profileId: id, name: '   ' })).toBe(false);
    expect(ok(linkRequest, { profileId: 'not-a-uuid', name: 'A' })).toBe(false);
    expect(ok(linkRequest, { profileId: id, name: 'A', extra: 1 })).toBe(false);
    expect(ok(linkResponse, { learnerId: id, name: 'A', created: true })).toBe(true);
  });
});

describe('push', () => {
  test('takes 1 to 100 events for one learner', () => {
    const events = (n: number): unknown[] => Array.from({ length: n }, () => ({}));
    expect(ok(pushRequest, { learnerId: id, events: events(1) })).toBe(true);
    expect(ok(pushRequest, { learnerId: id, events: events(100) })).toBe(true);
    expect(ok(pushRequest, { learnerId: id, events: events(0) })).toBe(false);
    expect(ok(pushRequest, { learnerId: id, events: events(101) })).toBe(false);
    expect(ok(pushRequest, { learnerId: 'x', events: events(1) })).toBe(false);
    expect(ok(pushResponse, { accepted: [id], rejected: ['#3'] })).toBe(true);
    expect(ok(pushResponse, { accepted: ['x'], rejected: [] })).toBe(false);
  });
});

describe('pull', () => {
  test('fills the defaults and bounds the page size', () => {
    expect(pullQuery.parse({})).toEqual({ after: 0, limit: 500 });
    expect(pullQuery.parse({ after: '7', limit: '3' })).toEqual({ after: 7, limit: 3 });
    expect(ok(pullQuery, { limit: '0' })).toBe(false);
    expect(ok(pullQuery, { limit: '501' })).toBe(false);
    expect(ok(pullQuery, { after: '-1' })).toBe(false);
    expect(ok(pullResponse, { events: [], next: null, cursor: 0 })).toBe(true);
    expect(ok(pullResponse, { events: [], next: null })).toBe(false);
  });
});

describe('me', () => {
  test('lists every feature switch', () => {
    expect([...FEATURE_KEYS]).toEqual([
      'ai_doubts',
      'speaking_practice',
      'placement_test',
      'english_only_option',
      'mentor_booking',
      'community_feed',
    ]);
    const switches = Object.fromEntries(FEATURE_KEYS.map((k) => [k, true]));
    expect(ok(meResponse, { learner: { id, name: 'A' }, switches })).toBe(true);
    expect(ok(meResponse, { learner: { id, name: 'A' }, switches: { ai_doubts: 'yes' } })).toBe(
      false,
    );
  });

  test('an old phone still reads a newer server: added switches and fields are accepted', () => {
    const switches = { ...Object.fromEntries(FEATURE_KEYS.map((k) => [k, true])), later: false };
    const parsed = meResponse.safeParse({ learner: { id, name: 'A', added: 1 }, switches, x: 1 });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.switches.ai_doubts).toBe(true);
  });
});

describe('responses from a newer server', () => {
  test('extra fields are accepted and dropped', () => {
    const pull = pullResponse.safeParse({ events: [], next: null, cursor: 0, added: true });
    expect(pull.success).toBe(true);
    expect(pull.data).toEqual({ events: [], next: null, cursor: 0 });
    expect(ok(pushResponse, { accepted: [], rejected: [], added: true })).toBe(true);
    expect(ok(linkResponse, { learnerId: id, name: 'A', created: true, added: 1 })).toBe(true);
  });
});
