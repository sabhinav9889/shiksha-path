import { randomUUID } from 'node:crypto';
import type { LearnerRepo, StaffRepo } from '../ports.js';
import type {
  BookingRepo,
  BookingRow,
  BookingTopic,
  OpenSlotRow,
  SlotRow,
} from '../ports-booking.js';

interface Slot {
  id: string;
  mentorId: string;
  startsAt: Date;
  minutes: number;
  link: string | null;
}
interface Booking {
  id: string;
  slotId: string;
  learnerId: string;
  topic: BookingTopic;
  note: string;
  link: string | null;
  status: 'booked' | 'cancelled';
}

const MS_PER_MINUTE = 60_000;

/** In-memory slots and bookings; staff and learners give the names, as the SQL joins do. */
export function memoryBooking(staff: StaffRepo, learners: LearnerRepo): BookingRepo {
  const slots = new Map<string, Slot>();
  const bookings = new Map<string, Booking>();
  const live = (slotId: string): Booking | undefined =>
    [...bookings.values()].find((b) => b.slotId === slotId && b.status === 'booked');
  const soonest = (a: Slot, b: Slot): number =>
    a.startsAt.getTime() - b.startsAt.getTime() || a.id.localeCompare(b.id);
  const slotRow = async (slot: Slot): Promise<SlotRow> => {
    const booking = live(slot.id);
    const student = booking ? await learners.findById(booking.learnerId) : null;
    return {
      id: slot.id,
      mentorId: slot.mentorId,
      mentorName: (await staff.byId(slot.mentorId))?.name ?? null,
      startsAt: slot.startsAt.toISOString(),
      minutes: slot.minutes,
      link: slot.link,
      booking: booking
        ? {
            id: booking.id,
            learnerId: booking.learnerId,
            studentName: student?.name ?? '',
            topic: booking.topic,
            note: booking.note,
          }
        : null,
    };
  };
  const bookingRow = async (b: Booking): Promise<BookingRow | null> => {
    const slot = slots.get(b.slotId);
    if (!slot) return null;
    return {
      id: b.id,
      learnerId: b.learnerId,
      startsAt: slot.startsAt.toISOString(),
      minutes: slot.minutes,
      mentorName: (await staff.byId(slot.mentorId))?.name ?? null,
      topic: b.topic,
      link: b.link,
    };
  };
  const ends = (slot: Slot): number => slot.startsAt.getTime() + slot.minutes * MS_PER_MINUTE;
  const ownLive = (id: string, learnerId: string): Booking | undefined => {
    const found = bookings.get(id);
    return found && found.learnerId === learnerId && found.status === 'booked' ? found : undefined;
  };
  return {
    saveSlot({ mentorId, startsAt, minutes, link }) {
      const id = randomUUID();
      slots.set(id, { id, mentorId, startsAt, minutes, link });
      return Promise.resolve(id);
    },
    getSlot: async (id) => {
      const slot = slots.get(id);
      return slot ? slotRow(slot) : null;
    },
    removeSlot(id) {
      for (const [bookingId, b] of bookings) if (b.slotId === id) bookings.delete(bookingId);
      return Promise.resolve(slots.delete(id));
    },
    slotsOf: async (mentorId, from, limit) =>
      Promise.all(
        [...slots.values()]
          .filter((s) => (mentorId === 'all' || s.mentorId === mentorId) && s.startsAt >= from)
          .sort(soonest)
          .slice(0, limit)
          .map(slotRow),
      ),
    openSlots: async ({ cohortId, from, to, limit }) => {
      const out: OpenSlotRow[] = [];
      for (const slot of [...slots.values()].sort(soonest)) {
        const mentor = await staff.byId(slot.mentorId);
        const inWindow = slot.startsAt >= from && slot.startsAt <= to;
        if (!mentor?.active || !mentor.cohortIds.includes(cohortId)) continue;
        if (!inWindow || live(slot.id)) continue;
        out.push({
          id: slot.id,
          mentorName: mentor.name,
          startsAt: slot.startsAt.toISOString(),
          minutes: slot.minutes,
        });
      }
      return out.slice(0, limit);
    },
    book({ slotId, learnerId, topic, note, now, maxUpcoming }) {
      // One synchronous step, so two callers cannot interleave inside it.
      const slot = slots.get(slotId);
      if (!slot) return Promise.resolve({ result: 'missing', id: null });
      if (live(slotId)) return Promise.resolve({ result: 'taken', id: null });
      const upcoming = [...bookings.values()].filter((b) => {
        const s = slots.get(b.slotId);
        return b.learnerId === learnerId && b.status === 'booked' && s && s.startsAt > now;
      });
      if (upcoming.length >= maxUpcoming) return Promise.resolve({ result: 'limit', id: null });
      const id = randomUUID();
      const link = slot.link;
      bookings.set(id, { id, slotId, learnerId, topic, note, link, status: 'booked' });
      return Promise.resolve({ result: 'booked', id });
    },
    bookingsOf: async (learnerId, now, limit) => {
      const mine = [...bookings.values()].filter((b) => {
        const slot = slots.get(b.slotId);
        return (
          b.learnerId === learnerId && b.status === 'booked' && slot && ends(slot) > now.getTime()
        );
      });
      const rows = await Promise.all(mine.map(bookingRow));
      return rows
        .flatMap((r) => (r ? [r] : []))
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
        .slice(0, limit);
    },
    getBooking: async (id, learnerId) => {
      const found = ownLive(id, learnerId);
      return found ? bookingRow(found) : null;
    },
    cancel(id, learnerId) {
      const found = ownLive(id, learnerId);
      if (!found) return Promise.resolve(false);
      found.status = 'cancelled';
      return Promise.resolve(true);
    },
  };
}
