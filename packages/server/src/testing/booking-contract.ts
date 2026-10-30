import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, test } from 'vitest';
import { listAudit } from '../services/audit.js';
import { deleteLearner, exportLearner } from '../services/learner-data.js';
import * as booking from '../services/booking.js';
import type { ServiceFixture } from './service-contract.js';
import { codeOf, staffWorld } from './staff-world.js';

const HOUR = 3_600_000;

/** Mentors publish slots and students book them (spec §10.1), against any repositories. */
export function describeBookingContract(name: string, make: () => Promise<ServiceFixture>): void {
  describe(`slot booking over ${name}`, () => {
    const w = staffWorld(make);
    const now = new Date();
    const made: string[] = [];
    const slotAt = (hours: number, link: string | null = null) => ({
      startsAt: new Date(now.getTime() + hours * HOUR).toISOString(),
      minutes: 30,
      link,
    });
    type Staff = Awaited<ReturnType<typeof w.staffMember>>;
    const publish = async (who: Staff, hours: number, link: string | null = null) => {
      const id = await booking.publishSlot(w.f, who, slotAt(hours, link), now);
      made.push(id);
      return id;
    };
    const open = async (learner: string) =>
      (await booking.listOpenSlots(w.f, await w.learnerAuth(learner), now)).slots;
    const book = async (learner: string, slotId: string, note = 'help with my CV') =>
      booking.bookSlot(w.f, await w.learnerAuth(learner), { slotId, topic: 'career', note }, now);
    afterEach(async () => {
      for (const id of made.splice(0)) await w.f.bookings.removeSlot(id);
    });

    test('a student sees only their cohort’s mentors’ slots, inside the window, without the link', async () => {
      const mentorA = await w.staffMember('mentor', [w.cohortA]);
      const mentorB = await w.staffMember('mentor', [w.cohortB]);
      const secret = 'https://meet.example/private-room';
      const early = await publish(mentorA, 10);
      const ok = await publish(mentorA, 24, secret);
      const last = await publish(mentorA, 24 * 14);
      const far = await publish(mentorA, 24 * 14 + 1);
      await publish(mentorB, 30);
      const slots = await open(w.learnerA);
      expect(slots.map((s) => s.id)).toEqual([ok, last]);
      expect(JSON.stringify(slots)).not.toContain('private-room');
      expect((await open(w.learnerB)).map((s) => s.id)).toEqual([expect.any(String)]);
      expect(slots.some((s) => [early, far].includes(s.id))).toBe(false);
    });

    test('booking: one student per slot, the window is enforced, and the link goes only to the booker', async () => {
      const mentor = await w.staffMember('mentor', [w.cohortA]);
      const other = await w.learnerIn(w.cohortA);
      const slot = await publish(mentor, 30, 'https://meet.example/room-1');
      const tooSoon = await publish(mentor, 10);
      expect(await codeOf(book(w.learnerA, tooSoon))).toBe('INVALID_REQUEST');
      const { id } = await book(w.learnerA, slot);
      expect(await codeOf(book(other, slot))).toBe('SLOT_TAKEN');
      const mine = await booking.myBookings(w.f, await w.learnerAuth(w.learnerA), now);
      expect(mine.bookings).toMatchObject([{ id, link: 'https://meet.example/room-1' }]);
      expect((await booking.myBookings(w.f, await w.learnerAuth(other), now)).bookings).toEqual([]);
      expect((await open(other)).map((s) => s.id)).not.toContain(slot);
    });

    test('the window counts both ends: exactly 24 hours and exactly 14 days book; a minute outside does not', async () => {
      const mentor = await w.staffMember('mentor', [w.cohortA]);
      const other = await w.learnerIn(w.cohortA);
      const edge = async (hours: number) => publish(mentor, hours);
      expect((await book(w.learnerA, await edge(24))).id).toBeTruthy();
      expect((await book(other, await edge(24 * 14))).id).toBeTruthy();
      const justUnder = await publish(mentor, 24 - 1 / 60);
      const justOver = await publish(mentor, 24 * 14 + 1 / 60);
      expect(await codeOf(book(w.learnerB, justUnder))).toBe('FORBIDDEN'); // not B's cohort
      const third = await w.learnerIn(w.cohortA);
      expect(await codeOf(book(third, justUnder))).toBe('INVALID_REQUEST');
      expect(await codeOf(book(third, justOver))).toBe('INVALID_REQUEST');
    });

    test('no booking across cohorts, with a paused mentor, or for an unknown slot', async () => {
      const mentorA = await w.staffMember('mentor', [w.cohortA]);
      const mentorB = await w.staffMember('mentor', [w.cohortB]);
      const paused = await w.staffMember('mentor', [w.cohortA]);
      const theirs = await publish(mentorB, 30);
      const pausedSlot = await publish(paused, 31);
      const row = await w.f.staff.byId(paused.staffId);
      if (!row) throw new Error('no staff row');
      await w.f.staff.save({ ...row, active: false });
      expect(await codeOf(book(w.learnerA, theirs))).toBe('FORBIDDEN');
      expect(await codeOf(book(w.learnerA, pausedSlot))).toBe('FORBIDDEN');
      expect(await codeOf(book(w.learnerA, randomUUID()))).toBe('FORBIDDEN');
      expect(await w.f.bookings.getSlot(theirs)).not.toBeNull();
      expect(mentorA.staffId).not.toBe(mentorB.staffId);
    });

    test('at most two upcoming bookings; cancelling makes room', async () => {
      const mentor = await w.staffMember('mentor', [w.cohortA]);
      const [s1, s2, s3] = [
        await publish(mentor, 30),
        await publish(mentor, 31),
        await publish(mentor, 32),
      ];
      const first = await book(w.learnerA, s1 ?? '');
      await book(w.learnerA, s2 ?? '');
      expect(await codeOf(book(w.learnerA, s3 ?? ''))).toBe('BOOKING_LIMIT');
      await booking.cancelBooking(w.f, await w.learnerAuth(w.learnerA), { id: first.id }, now);
      expect((await book(w.learnerA, s3 ?? '')).id).toBeTruthy();
    });

    test('cancelling needs 2 hours’ notice, counted inclusively; nobody cancels another’s booking', async () => {
      const mentor = await w.staffMember('mentor', [w.cohortA]);
      const other = await w.learnerIn(w.cohortA);
      const slot = await publish(mentor, 30);
      const { id } = await book(w.learnerA, slot);
      const auth = await w.learnerAuth(w.learnerA);
      expect(
        await codeOf(booking.cancelBooking(w.f, await w.learnerAuth(other), { id }, now)),
      ).toBe('FORBIDDEN');
      const late = new Date(now.getTime() + 28 * HOUR + 60_000); // 1 min under 2 h
      expect(await codeOf(booking.cancelBooking(w.f, auth, { id }, late))).toBe('TOO_LATE');
      const exactly = new Date(now.getTime() + 28 * HOUR); // exactly 2 h before
      await booking.cancelBooking(w.f, auth, { id }, exactly);
      expect((await open(w.learnerA)).map((s) => s.id)).toContain(slot);
      expect(await codeOf(booking.cancelBooking(w.f, auth, { id }, now))).toBe('FORBIDDEN');
    });

    test('a mentor sees who booked, with the note; another mentor does not; removing frees the student', async () => {
      const mentorA = await w.staffMember('mentor', [w.cohortA]);
      const mentorB = await w.staffMember('mentor', [w.cohortB]);
      const boss = await w.staffMember('admin', []);
      const slot = await publish(mentorA, 30);
      await book(w.learnerA, slot);
      const mineA = (await booking.listStaffSlots(w.f, mentorA, now)).slots;
      expect(mineA).toMatchObject([
        { id: slot, booking: { studentName: 'S', note: 'help with my CV' } },
      ]);
      expect((await booking.listStaffSlots(w.f, mentorB, now)).slots).toEqual([]);
      expect((await booking.listStaffSlots(w.f, boss, now)).slots.map((s) => s.id)).toContain(slot);
      expect(await codeOf(booking.removeSlot(w.f, mentorB, { id: slot }))).toBe('FORBIDDEN');
      await booking.removeSlot(w.f, mentorA, { id: slot });
      expect(
        (await booking.myBookings(w.f, await w.learnerAuth(w.learnerA), now)).bookings,
      ).toEqual([]);
      const again = await publish(mentorA, 31);
      await booking.removeSlot(w.f, boss, { id: again }); // an admin may remove any
      expect(await w.f.bookings.getSlot(again)).toBeNull();
    });

    test('a student’s export includes their bookings and notes, and deleting them removes the booking', async () => {
      const mentor = await w.staffMember('mentor', [w.cohortA]);
      const slot = await publish(mentor, 30);
      await book(w.learnerA, slot, 'my private worry');
      const out = await exportLearner(w.f, w.learnerA);
      expect(out.data.bookings).toMatchObject([
        { topic: 'career', note: 'my private worry', mentorName: 'mentor', status: 'booked' },
      ]);
      const other = await exportLearner(w.f, w.learnerB);
      expect(other.data.bookings).toEqual([]);
      await deleteLearner(w.f, w.learnerA);
      expect(await w.f.bookings.getSlot(slot)).toMatchObject({ booking: null });
    });

    test('a slot cannot be published in the past', async () => {
      const mentor = await w.staffMember('mentor', [w.cohortA]);
      expect(await codeOf(booking.publishSlot(w.f, mentor, slotAt(-1), now))).toBe(
        'INVALID_REQUEST',
      );
    });

    test('with the switch off, or a paused student, booking is refused', async () => {
      const mentor = await w.staffMember('mentor', [w.cohortA]);
      const slot = await publish(mentor, 30);
      await w.f.setOverride(w.learnerA, 'mentor_booking', false);
      expect(await codeOf(book(w.learnerA, slot))).toBe('FEATURE_OFF');
      expect(await codeOf(open(w.learnerA))).toBe('FEATURE_OFF');
      await w.f.setOverride(w.learnerA, 'mentor_booking', true);
      await w.f.org.setDeactivated(w.learnerA, true);
      expect(await codeOf(book(w.learnerA, slot))).toBe('DEACTIVATED');
      await w.f.org.setDeactivated(w.learnerA, false);
    });

    test('every staff write leaves one audit entry with ids only, never the link or the note', async () => {
      const mentor = await w.staffMember('mentor', [w.cohortA]);
      const boss = await w.staffMember('admin', []);
      const slot = await publish(mentor, 30, 'https://meet.example/secret-room');
      await book(w.learnerA, slot, 'my private worry');
      await booking.removeSlot(w.f, mentor, { id: slot });
      const entries = (await listAudit(w.f, boss, null, 100)).entries.slice(0, 2);
      expect(entries.map((e) => e.action)).toEqual(['slot_removed', 'slot_published']);
      expect(entries[1]?.details).toEqual({ slotId: slot, minutes: 30 });
      expect(JSON.stringify(entries)).not.toMatch(/secret-room|private worry/);
    });
  });
}
