import { randomUUID } from 'node:crypto';
import { cryptoIds, createEvent, systemClock, type LearnerEvent } from '@shiksha/learner-core';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import type { EventRepo, LearnerRepo, SwitchRepo } from '../ports.js';
import { ApiFailure } from '../services/failure.js';
import { linkLearner } from '../services/link.js';
import { getMe } from '../services/me.js';
import { pullEvents, pushEvents } from '../services/sync.js';

/** Repositories plus the set-up a test needs that the read-only ports do not offer. */
export interface ServiceFixture {
  learners: LearnerRepo;
  events: EventRepo;
  switches: SwitchRepo;
  newAuthUser(): Promise<string>;
  setAllStudents(key: string, enabled: boolean): Promise<void>;
  setOverride(learnerId: string, key: string, enabled: boolean): Promise<void>;
  removeSwitch(key: string): Promise<void>;
  cleanup(): Promise<void>;
}

const codeOf = async (promise: Promise<unknown>): Promise<string | undefined> =>
  promise.then(
    () => undefined,
    (error: unknown) => (error instanceof ApiFailure ? error.code : String(error)),
  );

const event = (learnerId: string): LearnerEvent =>
  createEvent({ clock: systemClock, ids: cryptoIds }, learnerId, 'language_changed', {
    preference: 'hi_en',
  });

/** The services' behaviour, run against any set of repositories (memory, Postgres). */
export function describeServiceContract(
  name: string,
  makeFixture: () => Promise<ServiceFixture>,
): void {
  describe(`services over ${name}`, () => {
    let f: ServiceFixture;
    let authA: string;
    let authB: string;
    let a: string;
    let b: string;

    beforeEach(async () => {
      f = await makeFixture();
      [authA, authB] = [await f.newAuthUser(), await f.newAuthUser()];
      a = (await linkLearner(f, authA, { profileId: randomUUID(), name: 'A' })).learnerId;
      b = (await linkLearner(f, authB, { profileId: randomUUID(), name: 'B' })).learnerId;
    });

    afterEach(async () => {
      await f.cleanup();
    });

    describe('linking', () => {
      test('a new identity creates a learner with the phone profile id', async () => {
        const auth = await f.newAuthUser();
        const profileId = randomUUID();
        const out = await linkLearner(f, auth, { profileId, name: 'प्रिया' });
        expect(out).toEqual({ learnerId: profileId, name: 'प्रिया', created: true });
      });

      test('an identity already linked gets its own learner back, whatever profile id is sent', async () => {
        const again = await linkLearner(f, authA, { profileId: randomUUID(), name: 'Other' });
        expect(again).toEqual({ learnerId: a, name: 'A', created: false });
      });

      test("nobody can claim another learner's id", async () => {
        const auth = await f.newAuthUser();
        expect(await codeOf(linkLearner(f, auth, { profileId: a, name: 'X' }))).toBe(
          'PROFILE_TAKEN',
        );
        expect((await f.learners.findById(a))?.name).toBe('A');
      });
    });

    describe('pushing events', () => {
      test('a retried push is accepted again and stored once', async () => {
        const events = [event(a), event(a), event(a)];
        const ids = events.map((e) => e.id).sort();
        const first = await pushEvents(f, authA, { learnerId: a, events });
        const second = await pushEvents(f, authA, { learnerId: a, events });
        expect([...first.accepted].sort()).toEqual(ids);
        expect([...second.accepted].sort()).toEqual(ids);
        expect((await f.events.page(a, 0, 500)).events).toHaveLength(3);
      });

      test('pushing as another learner is forbidden', async () => {
        expect(await codeOf(pushEvents(f, authA, { learnerId: b, events: [event(b)] }))).toBe(
          'FORBIDDEN',
        );
      });

      test('an event that names another learner is rejected, and the rest accepted', async () => {
        const mine = event(a);
        const theirs = event(b);
        const out = await pushEvents(f, authA, { learnerId: a, events: [mine, theirs] });
        expect(out).toEqual({ accepted: [mine.id], rejected: [theirs.id] });
        expect((await f.events.page(b, 0, 500)).events).toHaveLength(0);
      });

      test('an event id that already belongs to another learner is rejected for this one', async () => {
        const theirs = event(b);
        await pushEvents(f, authB, { learnerId: b, events: [theirs] });
        const copy = { ...theirs, learnerId: a };
        const out = await pushEvents(f, authA, { learnerId: a, events: [copy] });
        expect(out).toEqual({ accepted: [], rejected: [theirs.id] });
        expect((await f.events.page(a, 0, 500)).events).toHaveLength(0);
      });

      test('malformed events are rejected by id or position; the valid rest is kept', async () => {
        const good = event(a);
        const wrongType = { ...event(a), type: 'not_a_type' };
        const out = await pushEvents(f, authA, { learnerId: a, events: [42, {}, wrongType, good] });
        expect(out.accepted).toEqual([good.id]);
        expect(out.rejected).toEqual(['#0', '#1', wrongType.id]);
      });

      test('the same event twice in one batch is stored once', async () => {
        const one = event(a);
        const out = await pushEvents(f, authA, { learnerId: a, events: [one, one] });
        expect(out.accepted).toEqual([one.id]);
        expect((await f.events.page(a, 0, 500)).events).toHaveLength(1);
      });
    });

    describe('pulling events', () => {
      test("pages through a learner's own events only", async () => {
        const events = Array.from({ length: 7 }, () => event(a));
        await pushEvents(f, authA, { learnerId: a, events });
        await pushEvents(f, authB, { learnerId: b, events: [event(b)] });
        const pages: string[][] = [];
        let after = 0;
        for (let guard = 0; guard < 5; guard += 1) {
          const page = await pullEvents(f, authA, { after, limit: 3 });
          pages.push(page.events.map((e) => (e as LearnerEvent).id));
          if (page.next === null) break;
          after = page.next;
        }
        expect(pages.map((p) => p.length)).toEqual([3, 3, 1]);
        expect(pages.flat().sort()).toEqual(events.map((e) => e.id).sort());
      });

      test('returns events exactly as they were sent', async () => {
        const one = event(a);
        await pushEvents(f, authA, { learnerId: a, events: [one] });
        expect((await pullEvents(f, authA, { after: 0, limit: 500 })).events).toEqual([one]);
      });
    });

    describe('feature switches', () => {
      test('every switch is listed, the override wins, and a missing switch is on', async () => {
        await f.setAllStudents('placement_test', false);
        await f.setOverride(a, 'placement_test', true);
        await f.setOverride(a, 'speaking_practice', false);
        await f.removeSwitch('community_feed');
        const me = await getMe(f, authA);
        expect(me.learner).toEqual({ id: a, name: 'A' });
        expect(me.switches).toEqual({
          ai_doubts: true,
          speaking_practice: false,
          placement_test: true,
          english_only_option: true,
          mentor_booking: true,
          community_feed: true,
        });
        expect((await getMe(f, authB)).switches.placement_test).toBe(false);
      });
    });

    describe('an identity with no learner', () => {
      test('cannot push, pull or read its settings', async () => {
        const stranger = await f.newAuthUser();
        expect(await codeOf(pushEvents(f, stranger, { learnerId: a, events: [event(a)] }))).toBe(
          'NOT_LINKED',
        );
        expect(await codeOf(pullEvents(f, stranger, { after: 0, limit: 10 }))).toBe('NOT_LINKED');
        expect(await codeOf(getMe(f, stranger))).toBe('NOT_LINKED');
      });
    });
  });
}
