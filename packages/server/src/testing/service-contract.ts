import { randomUUID } from 'node:crypto';
import type { RecordingStart } from '@shiksha/api-contract';
import { cryptoIds, createEvent, systemClock, type LearnerEvent } from '@shiksha/learner-core';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import type {
  BrandingRepo,
  Caller,
  EventRepo,
  LearnerDataRepo,
  LearnerRepo,
  OrgRepo,
  RateLimiter,
  RecordingRepo,
  StaffRepo,
  SwitchRepo,
} from '../ports.js';
import { getBranding, setBranding } from '../services/branding.js';
import { completeRecording, startRecording } from '../services/recordings.js';
import type { MemoryRecordingStorage } from './memory-recording-storage.js';
import { ApiFailure } from '../services/failure.js';
import { linkLearner } from '../services/link.js';
import { getMe } from '../services/me.js';
import { pullEvents, pushEvents } from '../services/sync.js';

const google = (authUserId: string): Caller => ({ authUserId, provider: 'google', email: null });

/** Repositories plus the set-up a test needs that the read-only ports do not offer. */
export interface ServiceFixture {
  learners: LearnerRepo;
  events: EventRepo;
  switches: SwitchRepo;
  limiter: RateLimiter;
  recordings: RecordingRepo;
  branding: BrandingRepo;
  data: LearnerDataRepo;
  staff: StaffRepo;
  org: OrgRepo;
  /** Stands in for the bucket: a test "uploads" with `storage.put`. */
  storage: MemoryRecordingStorage;
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

/**
 * Rate windows are fixed clock windows: a burst that straddles a boundary splits across two.
 * Start a burst with at least `margin` ms left in the current window.
 */
async function awayFromWindowEdge(windowSeconds: number, margin = 10_000): Promise<void> {
  const windowMs = windowSeconds * 1000;
  const left = windowMs - (Date.now() % windowMs);
  if (left < margin) await new Promise((resolve) => setTimeout(resolve, left + 500));
}

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
      a = (await linkLearner(f, google(authA), { profileId: randomUUID(), name: 'A' })).learnerId;
      b = (await linkLearner(f, google(authB), { profileId: randomUUID(), name: 'B' })).learnerId;
    });

    afterEach(async () => {
      await f.cleanup();
    });

    describe('linking', () => {
      test('a student deleted on request cannot be brought back by linking their old id', async () => {
        const gone = randomUUID();
        await f.data.deleteWithTombstone(gone);
        const auth = await f.newAuthUser();
        const out = linkLearner(f, google(auth), { profileId: gone, name: 'X' });
        expect(await codeOf(out)).toBe('FORBIDDEN');
        expect(await f.learners.findById(gone)).toBeNull();
      });

      test('an email sign-in the server did not issue cannot create a learner', async () => {
        const auth = await f.newAuthUser();
        const profileId = randomUUID();
        const out = linkLearner(
          f,
          { authUserId: auth, provider: 'email', email: null },
          { profileId, name: 'X' },
        );
        expect(await codeOf(out)).toBe('FORBIDDEN');
        expect(await f.learners.findById(profileId)).toBeNull();
      });

      test('two links at once for one identity: one creates it, the other finds it', async () => {
        const auth = await f.newAuthUser();
        const profileId = randomUUID();
        const body = { profileId, name: 'A' };
        const both = await Promise.all([
          linkLearner(f, google(auth), body),
          linkLearner(f, google(auth), body),
        ]);
        expect(both.map((r) => r.created).sort()).toEqual([false, true]);
        expect(both.every((r) => r.learnerId === profileId)).toBe(true);
      });

      test('two identities racing for one profile id: one wins, the other is PROFILE_TAKEN', async () => {
        const [one, two] = [await f.newAuthUser(), await f.newAuthUser()];
        const body = { profileId: randomUUID(), name: 'A' };
        const results = await Promise.allSettled([
          linkLearner(f, google(one), body),
          linkLearner(f, google(two), body),
        ]);
        const codes = results.map((r) =>
          r.status === 'fulfilled' ? 'ok' : (r.reason as { code?: string }).code,
        );
        expect(codes.sort()).toEqual(['PROFILE_TAKEN', 'ok']);
      });

      test('a new identity creates a learner with the phone profile id', async () => {
        const auth = await f.newAuthUser();
        const profileId = randomUUID();
        const out = await linkLearner(f, google(auth), { profileId, name: 'प्रिया' });
        expect(out).toEqual({ learnerId: profileId, name: 'प्रिया', created: true });
      });

      test('an identity already linked gets its own learner back, whatever profile id is sent', async () => {
        const again = await linkLearner(f, google(authA), {
          profileId: randomUUID(),
          name: 'Other',
        });
        expect(again).toEqual({ learnerId: a, name: 'A', created: false });
      });

      test("nobody can claim another learner's id", async () => {
        const auth = await f.newAuthUser();
        expect(await codeOf(linkLearner(f, google(auth), { profileId: a, name: 'X' }))).toBe(
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
        // the cursor says where the phone got to, even on the last page, so it can ask for new
        // events only next time; with nothing new it stays put
        const end = await pullEvents(f, authA, { after: 0, limit: 500 });
        const again = await pullEvents(f, authA, { after: end.cursor, limit: 500 });
        expect(again).toEqual({ events: [], next: null, cursor: end.cursor });
        await pushEvents(f, authA, { learnerId: a, events: [event(a)] });
        expect((await pullEvents(f, authA, { after: end.cursor, limit: 500 })).events).toHaveLength(
          1,
        );
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

    describe('events only the server writes', () => {
      test('a phone cannot push a level_set: only a mentor sets a level', async () => {
        const levelSet = createEvent({ clock: systemClock, ids: cryptoIds }, a, 'level_set', {
          track: 'english',
          startLesson: 'ef1-03',
        });
        const out = await pushEvents(f, authA, { learnerId: a, events: [levelSet, event(a)] });
        expect(out.rejected).toEqual([levelSet.id]);
        expect(out.accepted).toHaveLength(1);
      });
    });

    describe('rate limits', () => {
      test('the 61st push in a minute is refused, and another learner is unaffected', async () => {
        await awayFromWindowEdge(60);
        for (let n = 0; n < 60; n += 1) {
          await pushEvents(f, authA, { learnerId: a, events: [event(a)] });
        }
        const over = pushEvents(f, authA, { learnerId: a, events: [event(a)] });
        expect(await codeOf(over)).toBe('RATE_LIMITED');
        expect(
          (await pushEvents(f, authB, { learnerId: b, events: [event(b)] })).accepted,
        ).toHaveLength(1);
      });

      test('the 61st pull in a minute is refused', async () => {
        await awayFromWindowEdge(60);
        for (let n = 0; n < 60; n += 1) await pullEvents(f, authA, { after: 0, limit: 10 });
        expect(await codeOf(pullEvents(f, authA, { after: 0, limit: 10 }))).toBe('RATE_LIMITED');
      });

      test('the 11th link in an hour by one sign-in is refused', async () => {
        for (let n = 0; n < 9; n += 1) {
          // the set-up's own link was the first
          await linkLearner(f, google(authA), { profileId: randomUUID(), name: 'A' });
        }
        const over = linkLearner(f, google(authA), { profileId: randomUUID(), name: 'A' });
        expect(await codeOf(over)).toBe('RATE_LIMITED');
      });

      test('two hits at once never both take the last slot', async () => {
        const bucket = `test:${randomUUID()}`;
        await f.limiter.hit(bucket, 2, 60);
        const both = await Promise.all([
          f.limiter.hit(bucket, 2, 60),
          f.limiter.hit(bucket, 2, 60),
        ]);
        expect(both.filter(Boolean)).toHaveLength(1);
      });
    });

    describe('recordings', () => {
      const start = (over: Partial<RecordingStart> = {}): RecordingStart => ({
        id: randomUUID(),
        lessonId: 'ef1-02',
        itemId: 's1',
        mime: 'audio/webm',
        bytes: 2048,
        durationMs: 3000,
        at: '2026-10-22T10:00:00.000Z',
        ...over,
      });

      test('start, upload, complete: the object sits under the learner and is uploaded', async () => {
        const body = start();
        const out = await startRecording(f, authA, body);
        expect(out.uploadUrl).toBeTruthy();
        expect(out.token).toBeTruthy();
        f.storage.put(`${a}/${body.id}`, 2048);
        expect(await completeRecording(f, authA, { id: body.id })).toEqual({ status: 'uploaded' });
        expect((await f.recordings.get(body.id))?.status).toBe('uploaded');
        expect((await f.recordings.listByLearner(a)).map((r) => r.id)).toEqual([body.id]);
      });

      test('starting again: nothing to do once uploaded, a fresh URL while pending', async () => {
        const body = start();
        await startRecording(f, authA, body);
        expect((await startRecording(f, authA, body)).uploadUrl).toBeTruthy();
        f.storage.put(`${a}/${body.id}`, 2048);
        await completeRecording(f, authA, { id: body.id });
        expect(await startRecording(f, authA, body)).toEqual({ uploadUrl: null, token: null });
      });

      test("nobody starts or completes another learner's recording", async () => {
        const body = start();
        await startRecording(f, authA, body);
        expect(await codeOf(startRecording(f, authB, body))).toBe('FORBIDDEN');
        f.storage.put(`${a}/${body.id}`, 2048);
        expect(await codeOf(completeRecording(f, authB, { id: body.id }))).toBe('FORBIDDEN');
        expect((await f.recordings.get(body.id))?.status).toBe('pending');
      });

      test('complete needs the object, within the size limit', async () => {
        const body = start();
        await startRecording(f, authA, body);
        expect(await codeOf(completeRecording(f, authA, { id: body.id }))).toBe('INVALID_REQUEST');
        f.storage.put(`${a}/${body.id}`, 1_048_577);
        expect(await codeOf(completeRecording(f, authA, { id: body.id }))).toBe('INVALID_REQUEST');
        expect(await codeOf(completeRecording(f, authA, { id: randomUUID() }))).toBe(
          'INVALID_REQUEST',
        );
      });

      test('with speaking practice off for the learner, uploads are refused', async () => {
        await f.setOverride(a, 'speaking_practice', false);
        expect(await codeOf(startRecording(f, authA, start()))).toBe('FEATURE_OFF');
        expect((await startRecording(f, authB, start())).uploadUrl).toBeTruthy();
      });

      test('the 101st start in a day is refused', async () => {
        for (let n = 0; n < 100; n += 1) await startRecording(f, authA, start());
        expect(await codeOf(startRecording(f, authA, start()))).toBe('RATE_LIMITED');
      });
    });

    describe('branding', () => {
      const readable = {
        name: { hi: 'नई राह', en: 'New Path' },
        primary: '#1f6f43',
        accent: '#9a3412',
      };

      test('a readable change is saved and its version grows by one', async () => {
        const before = await getBranding(f);
        const { version } = await setBranding(f, readable);
        expect(version).toBe(before.version + 1);
        expect(await getBranding(f)).toEqual({ ...readable, version });
        await setBranding(f, { name: before.name, primary: before.primary, accent: before.accent });
      });

      test('a colour white text cannot be read on is refused, and nothing changes', async () => {
        const before = await getBranding(f);
        const out = setBranding(f, { ...readable, primary: '#ffd400' });
        expect(await codeOf(out)).toBe('INVALID_REQUEST');
        expect(await getBranding(f)).toEqual(before);
      });
    });
  });
}
