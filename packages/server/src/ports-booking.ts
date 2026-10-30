/** One-to-one mentor slots and bookings (spec §10.1, reduced: no calendar integration). */

export type BookingTopic = 'doubt' | 'progress' | 'career' | 'resume';

/** A slot as its mentor or an admin reads it, with the live booking if there is one. */
export interface SlotRow {
  id: string;
  mentorId: string;
  mentorName: string | null;
  startsAt: string;
  minutes: number;
  link: string | null;
  booking: {
    id: string;
    learnerId: string;
    studentName: string;
    topic: BookingTopic;
    note: string;
  } | null;
}

/** A slot a student may book: no link. */
export interface OpenSlotRow {
  id: string;
  mentorName: string;
  startsAt: string;
  minutes: number;
}

export interface BookingRow {
  id: string;
  learnerId: string;
  startsAt: string;
  minutes: number;
  mentorName: string | null;
  topic: BookingTopic;
  link: string | null;
}

/** A booking as a student's data export lists it, with the note and cancelled ones too. */
export interface ExportedBooking {
  startsAt: string;
  minutes: number;
  mentorName: string | null;
  topic: BookingTopic;
  note: string;
  status: 'booked' | 'cancelled';
}

export type BookResult = 'booked' | 'taken' | 'limit' | 'missing';

export interface BookingRepo {
  saveSlot(slot: {
    mentorId: string;
    startsAt: Date;
    minutes: number;
    link: string | null;
  }): Promise<string>;
  getSlot(id: string): Promise<SlotRow | null>;
  /** Remove a slot; a live booking on it goes too. False when there is no such slot. */
  removeSlot(id: string): Promise<boolean>;
  /** Slots starting at or after `from`, soonest first: one mentor's, or all of them. */
  slotsOf(mentorId: string | 'all', from: Date, limit: number): Promise<SlotRow[]>;
  /** Slots of active mentors who teach `cohortId`, starting in [from, to], with no live booking. */
  openSlots(query: {
    cohortId: string;
    from: Date;
    to: Date;
    limit: number;
  }): Promise<OpenSlotRow[]>;
  /**
   * Book a slot for a learner, all in one step: at most `maxUpcoming` bookings that have not
   * started, and one live booking per slot, even when two students book at the same moment.
   */
  book(input: {
    slotId: string;
    learnerId: string;
    topic: BookingTopic;
    note: string;
    now: Date;
    maxUpcoming: number;
  }): Promise<{ result: BookResult; id: string | null }>;
  /** A learner's own live bookings that have not ended, soonest first. */
  bookingsOf(learnerId: string, now: Date, limit: number): Promise<BookingRow[]>;
  getBooking(id: string, learnerId: string): Promise<BookingRow | null>;
  /** Everything held about a learner's bookings, for their data export. */
  exportFor(learnerId: string): Promise<ExportedBooking[]>;
  /** Cancel a learner's own live booking. False when there is none. */
  cancel(id: string, learnerId: string): Promise<boolean>;
}
