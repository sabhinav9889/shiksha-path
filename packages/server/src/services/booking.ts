import type { BookRequest, MyBookingsResponse, OpenSlotsResponse } from '@shiksha/api-contract';
import { BOOKING_LIST_CAP } from '@shiksha/api-contract';
import type { SlotRequest, StaffSlotsResponse } from '@shiksha/api-contract/staff';
import type { AuditRepo, LearnerRepo, OrgRepo, StaffRepo, SwitchRepo } from '../ports.js';
import type { BookingRepo } from '../ports-booking.js';
import { withAudit } from './audit.js';
import { callerLearner } from './caller.js';
import { ApiFailure } from './failure.js';
import { effectiveSwitches } from './me.js';
import type { StaffCaller } from './staff.js';

export interface BookingDeps {
  bookings: BookingRepo;
  staff: StaffRepo;
  learners: LearnerRepo;
  org: OrgRepo;
  switches: SwitchRepo;
  audit: AuditRepo;
}

// The booking rules (spec §10.1). Each boundary counts: a slot exactly 24 hours away may be
// booked, and a booking exactly 2 hours away may still be cancelled.
const MS_PER_HOUR = 3_600_000;
const MIN_HOURS_AHEAD = 24;
const MAX_DAYS_AHEAD = 14;
const HOURS_PER_DAY = 24;
const CANCEL_HOURS_BEFORE = 2;
const MAX_UPCOMING = 2;
/** Staff still see a slot for a day after it started, to see who came. */
const KEEP_HOURS = 24;

const hours = (n: number): number => n * MS_PER_HOUR;

/** Any active staff member may publish; students see slots of mentors who teach their cohort. */
export async function publishSlot(
  deps: BookingDeps,
  staff: StaffCaller,
  body: SlotRequest,
  now: Date = new Date(),
): Promise<string> {
  const startsAt = new Date(body.startsAt);
  if (startsAt.getTime() <= now.getTime()) throw new ApiFailure('INVALID_REQUEST');
  const slot = { mentorId: staff.staffId, startsAt, minutes: body.minutes, link: body.link };
  const id = await deps.bookings.saveSlot(slot);
  const details = { slotId: id, minutes: body.minutes };
  await withAudit(deps, { staff, action: 'slot_published', learnerId: null, details }, () =>
    Promise.resolve(),
  );
  return id;
}

/** The owner removes their slot, or an admin any slot. A booking on it goes with it. */
export async function removeSlot(
  deps: BookingDeps,
  staff: StaffCaller,
  input: { id: string },
): Promise<void> {
  const slot = await deps.bookings.getSlot(input.id);
  const allowed = slot && (staff.role === 'admin' || slot.mentorId === staff.staffId);
  if (!slot || !allowed) throw new ApiFailure('FORBIDDEN');
  const details = { slotId: slot.id, booked: slot.booking !== null };
  await withAudit(deps, { staff, action: 'slot_removed', learnerId: null, details }, () =>
    deps.bookings.removeSlot(slot.id),
  );
}

/** A mentor's own slots with who booked (the note too); an admin sees every mentor's. */
export async function listStaffSlots(
  deps: BookingDeps,
  staff: StaffCaller,
  now: Date = new Date(),
): Promise<StaffSlotsResponse> {
  const from = new Date(now.getTime() - hours(KEEP_HOURS));
  const scope = staff.role === 'admin' ? 'all' : staff.staffId;
  const rows = await deps.bookings.slotsOf(scope, from, BOOKING_LIST_CAP);
  return {
    slots: rows.map((s) => ({
      id: s.id,
      mentorName: s.mentorName,
      startsAt: s.startsAt,
      minutes: s.minutes,
      link: s.link,
      booking: s.booking && {
        id: s.booking.id,
        studentName: s.booking.studentName,
        topic: s.booking.topic,
        note: s.booking.note,
      },
    })),
  };
}

/** The signed-in student, with booking switched on for them, and their cohort (null: none). */
async function bookingStudent(
  deps: BookingDeps,
  authUserId: string,
): Promise<{ id: string; cohortId: string | null }> {
  const learner = await callerLearner(deps.learners, authUserId);
  if (!(await effectiveSwitches(deps.switches, learner.id)).mentor_booking) {
    throw new ApiFailure('FEATURE_OFF');
  }
  return { id: learner.id, cohortId: (await deps.org.cohortOfLearner(learner.id)) ?? null };
}

/** Open slots of the student's own cohort's mentors, from 24 hours to 14 days ahead. */
export async function listOpenSlots(
  deps: BookingDeps,
  authUserId: string,
  now: Date = new Date(),
): Promise<OpenSlotsResponse> {
  const { cohortId } = await bookingStudent(deps, authUserId);
  if (!cohortId) return { slots: [] };
  const from = new Date(now.getTime() + hours(MIN_HOURS_AHEAD));
  const to = new Date(now.getTime() + hours(MAX_DAYS_AHEAD * HOURS_PER_DAY));
  return { slots: await deps.bookings.openSlots({ cohortId, from, to, limit: BOOKING_LIST_CAP }) };
}

/** Whether this slot is one the student may see: an active mentor of their own cohort. */
async function visibleTo(deps: BookingDeps, mentorId: string, cohortId: string | null) {
  const mentor = await deps.staff.byId(mentorId);
  return Boolean(mentor?.active && cohortId && mentor.cohortIds.includes(cohortId));
}

export async function bookSlot(
  deps: BookingDeps,
  authUserId: string,
  body: BookRequest,
  now: Date = new Date(),
): Promise<{ id: string }> {
  const { id: learnerId, cohortId } = await bookingStudent(deps, authUserId);
  const slot = await deps.bookings.getSlot(body.slotId);
  // An unknown slot and one that is not theirs answer alike, so slots cannot be probed.
  if (!slot || !(await visibleTo(deps, slot.mentorId, cohortId))) throw new ApiFailure('FORBIDDEN');
  if (!inWindow(slot.startsAt, now)) throw new ApiFailure('INVALID_REQUEST');
  const input = { slotId: slot.id, learnerId, topic: body.topic, note: body.note ?? '' };
  const done = await deps.bookings.book({ ...input, now, maxUpcoming: MAX_UPCOMING });
  return { id: bookedId(done) };
}

/** Bookable from 24 hours to 14 days ahead, both ends included. */
function inWindow(startsAt: string, now: Date): boolean {
  const ahead = new Date(startsAt).getTime() - now.getTime();
  return ahead >= hours(MIN_HOURS_AHEAD) && ahead <= hours(MAX_DAYS_AHEAD * HOURS_PER_DAY);
}

/** The new booking's id, or the refusal the repository gave. */
function bookedId(done: { result: string; id: string | null }): string {
  if (done.result === 'taken') throw new ApiFailure('SLOT_TAKEN');
  if (done.result === 'limit') throw new ApiFailure('BOOKING_LIMIT');
  if (done.result !== 'booked' || !done.id) throw new ApiFailure('FORBIDDEN');
  return done.id;
}

/** The student's own bookings that have not ended, each with the link as it was booked. */
export async function myBookings(
  deps: BookingDeps,
  authUserId: string,
  now: Date = new Date(),
): Promise<MyBookingsResponse> {
  const learner = await callerLearner(deps.learners, authUserId);
  const rows = await deps.bookings.bookingsOf(learner.id, now, BOOKING_LIST_CAP);
  return {
    bookings: rows.map((b) => ({
      id: b.id,
      startsAt: b.startsAt,
      minutes: b.minutes,
      mentorName: b.mentorName,
      topic: b.topic,
      link: b.link,
      status: 'booked' as const,
    })),
  };
}

export async function cancelBooking(
  deps: BookingDeps,
  authUserId: string,
  input: { id: string },
  now: Date = new Date(),
): Promise<void> {
  const learner = await callerLearner(deps.learners, authUserId);
  const found = await deps.bookings.getBooking(input.id, learner.id);
  if (!found) throw new ApiFailure('FORBIDDEN');
  const ahead = new Date(found.startsAt).getTime() - now.getTime();
  if (ahead < hours(CANCEL_HOURS_BEFORE)) throw new ApiFailure('TOO_LATE');
  if (!(await deps.bookings.cancel(found.id, learner.id))) throw new ApiFailure('FORBIDDEN');
}
