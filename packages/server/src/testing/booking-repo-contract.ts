import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, test } from 'vitest';
import type { ServiceFixture } from './service-contract.js';
import { staffWorld } from './staff-world.js';

const HOUR = 3_600_000;
const MAX = 2;

/** The booking repository (spec §10.1), against any set of repositories. */
export function describeBookingRepoContract(
  name: string,
  make: () => Promise<ServiceFixture>,
): void {
  describe(`bookings over ${name}`, () => {
    const w = staffWorld(make);
    const now = new Date();
    const made: string[] = [];
    const at = (hours: number): Date => new Date(now.getTime() + hours * HOUR);
    const slot = async (mentorId: string, hours: number, link: string | null = null) => {
      const id = await w.f.bookings.saveSlot({ mentorId, startsAt: at(hours), minutes: 30, link });
      made.push(id);
      return id;
    };
    const book = (slotId: string, learnerId: string, over: { now?: Date } = {}) =>
      w.f.bookings.book({
        slotId,
        learnerId,
        topic: 'career',
        note: 'CV help',
        now: over.now ?? now,
        maxUpcoming: MAX,
      });
    afterEach(async () => {
      for (const id of made.splice(0)) await w.f.bookings.removeSlot(id);
    });

    test('open slots: this cohort’s active mentors, in the window, not booked, soonest first', async () => {
      const mentorA = await w.staffMember('mentor', [w.cohortA]);
      const mentorB = await w.staffMember('mentor', [w.cohortB]);
      const paused = await w.staffMember('mentor', [w.cohortA]);
      const row = await w.f.staff.byId(paused.staffId);
      if (!row) throw new Error('no staff row');
      await w.f.staff.save({ ...row, active: false });
      const late = await slot(mentorA.staffId, 30);
      const soon = await slot(mentorA.staffId, 25);
      await slot(mentorB.staffId, 26); // another cohort's mentor
      await slot(paused.staffId, 27); // a paused mentor
      await slot(mentorA.staffId, 2); // too soon
      await slot(mentorA.staffId, 24 * 20); // too far
      const taken = await slot(mentorA.staffId, 28);
      await book(taken, w.learnerA);
      const open = await w.f.bookings.openSlots({
        cohortId: w.cohortA,
        from: at(24),
        to: at(24 * 14),
        limit: 50,
      });
      expect(open.map((s) => s.id)).toEqual([soon, late]);
      expect(open[0]).toMatchObject({ mentorName: 'mentor', minutes: 30 });
      expect(open[0]).not.toHaveProperty('link');
      const inclusive = await w.f.bookings.openSlots({
        cohortId: w.cohortA,
        from: at(25),
        to: at(30),
        limit: 50,
      });
      expect(inclusive.map((s) => s.id)).toEqual([soon, late]); // both ends count
    });

    test('open slots stop at the limit, with more rows than one answer holds', async () => {
      const mentor = await w.staffMember('mentor', [w.cohortA]);
      for (let n = 0; n < 55; n += 1) await slot(mentor.staffId, 25 + n / 100);
      const open = await w.f.bookings.openSlots({
        cohortId: w.cohortA,
        from: at(24),
        to: at(24 * 14),
        limit: 50,
      });
      expect(open).toHaveLength(50);
    });

    test('a slot books once; the second student is told it is taken; a cancel frees it', async () => {
      const mentor = await w.staffMember('mentor', [w.cohortA]);
      const id = await slot(mentor.staffId, 30, 'https://meet.example/x');
      const second = await w.learnerIn(w.cohortA);
      const first = await book(id, w.learnerA);
      expect(first.result).toBe('booked');
      expect((await book(id, second)).result).toBe('taken');
      expect(await w.f.bookings.cancel(first.id ?? '', w.learnerA)).toBe(true);
      expect(await w.f.bookings.cancel(first.id ?? '', w.learnerA)).toBe(false);
      expect((await book(id, second)).result).toBe('booked');
      expect((await book(randomUUID(), second)).result).toBe('missing');
    });

    test('two students booking one slot at the same moment: exactly one wins', async () => {
      const mentor = await w.staffMember('mentor', [w.cohortA]);
      const id = await slot(mentor.staffId, 30);
      const other = await w.learnerIn(w.cohortA);
      const results = await Promise.all([book(id, w.learnerA), book(id, other)]);
      expect(results.map((r) => r.result).sort()).toEqual(['booked', 'taken']);
    });

    test('a student holds at most two upcoming bookings, even booking three at once', async () => {
      const mentor = await w.staffMember('mentor', [w.cohortA]);
      const ids = [await slot(mentor.staffId, 30), await slot(mentor.staffId, 31)];
      ids.push(await slot(mentor.staffId, 32));
      const results = await Promise.all(ids.map((id) => book(id, w.learnerA)));
      expect(results.map((r) => r.result).sort()).toEqual(['booked', 'booked', 'limit']);
      expect(await w.f.bookings.bookingsOf(w.learnerA, now, 20)).toHaveLength(2);
      // Cancelling one makes room: the refused one now books.
      const refused = results.findIndex((r) => r.result === 'limit');
      const kept = results.find((r) => r.result === 'booked');
      await w.f.bookings.cancel(kept?.id ?? '', w.learnerA);
      expect((await book(ids[refused] ?? '', w.learnerA)).result).toBe('booked');
    });

    test('a booking past its start does not count against the limit', async () => {
      const mentor = await w.staffMember('mentor', [w.cohortA]);
      const past = await slot(mentor.staffId, -5);
      const a = await slot(mentor.staffId, 30);
      const b = await slot(mentor.staffId, 31);
      expect((await book(past, w.learnerA, { now: at(-6) })).result).toBe('booked');
      expect((await book(a, w.learnerA)).result).toBe('booked');
      expect((await book(b, w.learnerA)).result).toBe('booked');
    });

    test('a student reads only their own bookings, with the link as booked; the past is left out', async () => {
      const mentor = await w.staffMember('mentor', [w.cohortA]);
      const other = await w.learnerIn(w.cohortA);
      const id = await slot(mentor.staffId, 30, 'https://meet.example/mine');
      await book(id, w.learnerA);
      const old = await slot(mentor.staffId, -5);
      await book(old, other, { now: at(-6) });
      const mine = await w.f.bookings.bookingsOf(w.learnerA, now, 20);
      expect(mine).toMatchObject([
        { learnerId: w.learnerA, link: 'https://meet.example/mine', mentorName: 'mentor' },
      ]);
      expect(await w.f.bookings.bookingsOf(other, now, 20)).toEqual([]);
      expect(await w.f.bookings.getBooking(mine[0]?.id ?? '', other)).toBeNull();
    });

    test('a mentor lists their own slots with who booked, an admin lists all; removing frees the student', async () => {
      const mentorA = await w.staffMember('mentor', [w.cohortA]);
      const mentorB = await w.staffMember('mentor', [w.cohortB]);
      const mine = await slot(mentorA.staffId, 30);
      await slot(mentorB.staffId, 31);
      const booked = await book(mine, w.learnerA);
      const own = await w.f.bookings.slotsOf(mentorA.staffId, at(0), 50);
      expect(own).toHaveLength(1);
      expect(own[0]?.booking).toMatchObject({ studentName: 'S', topic: 'career', note: 'CV help' });
      expect(await w.f.bookings.slotsOf('all', at(0), 50)).toHaveLength(2);
      expect(await w.f.bookings.removeSlot(mine)).toBe(true);
      expect(await w.f.bookings.removeSlot(mine)).toBe(false);
      expect(await w.f.bookings.getSlot(mine)).toBeNull();
      expect(await w.f.bookings.getBooking(booked.id ?? '', w.learnerA)).toBeNull();
    });
  });
}
