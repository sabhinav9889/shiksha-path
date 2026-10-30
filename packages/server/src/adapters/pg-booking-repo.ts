import type {
  BookingRepo,
  ExportedBooking,
  BookingRow,
  BookingTopic,
  OpenSlotRow,
  SlotRow,
} from '../ports-booking.js';
import type { Sql } from './pg.js';

interface SlotSql {
  id: string;
  mentor_id: string;
  mentor_name: string | null;
  starts_at: Date;
  minutes: number;
  link: string | null;
  booking_id: string | null;
  learner_id: string | null;
  student_name: string | null;
  topic: BookingTopic | null;
  note: string | null;
}

interface BookingSql {
  id: string;
  learner_id: string;
  starts_at: Date;
  minutes: number;
  mentor_name: string | null;
  topic: BookingTopic;
  link: string | null;
}

const toSlot = (r: SlotSql): SlotRow => ({
  id: r.id,
  mentorId: r.mentor_id,
  mentorName: r.mentor_name,
  startsAt: r.starts_at.toISOString(),
  minutes: r.minutes,
  link: r.link,
  booking:
    r.booking_id && r.learner_id && r.topic
      ? {
          id: r.booking_id,
          learnerId: r.learner_id,
          studentName: r.student_name ?? '',
          topic: r.topic,
          note: r.note ?? '',
        }
      : null,
});

const toBooking = (r: BookingSql): BookingRow => ({
  id: r.id,
  learnerId: r.learner_id,
  startsAt: r.starts_at.toISOString(),
  minutes: r.minutes,
  mentorName: r.mentor_name,
  topic: r.topic,
  link: r.link,
});

export class PgBookingRepo implements BookingRepo {
  constructor(private readonly sql: Sql) {}

  /** A slot with its mentor's name and its live booking, if any. */
  private slots(): ReturnType<Sql> {
    return this.sql`
      select s.id, s.mentor_id, st.name as mentor_name, s.starts_at, s.minutes, s.link,
             b.id as booking_id, b.learner_id, l.name as student_name, b.topic, b.note
      from mentor_slots s
        left join staff st on st.id = s.mentor_id
        left join bookings b on b.slot_id = s.id and b.status = 'booked'
        left join learners l on l.id = b.learner_id`;
  }

  async saveSlot(slot: {
    mentorId: string;
    startsAt: Date;
    minutes: number;
    link: string | null;
  }): Promise<string> {
    const [row] = await this.sql<{ id: string }[]>`
      insert into mentor_slots (mentor_id, starts_at, minutes, link)
      values (${slot.mentorId}, ${slot.startsAt}, ${slot.minutes}, ${slot.link})
      returning id`;
    return row?.id ?? '';
  }

  async getSlot(id: string): Promise<SlotRow | null> {
    const [row] = await this.sql<SlotSql[]>`${this.slots()} where s.id = ${id}`;
    return row ? toSlot(row) : null;
  }

  async removeSlot(id: string): Promise<boolean> {
    const gone = await this.sql`delete from mentor_slots where id = ${id} returning id`;
    return gone.length > 0;
  }

  async slotsOf(mentorId: string | 'all', from: Date, limit: number): Promise<SlotRow[]> {
    const all = mentorId === 'all';
    const mentor = all ? null : mentorId;
    const rows = await this.sql<SlotSql[]>`
      ${this.slots()}
      where (${all} or s.mentor_id = ${mentor}::uuid) and s.starts_at >= ${from}
      order by s.starts_at, s.id limit ${limit}`;
    return rows.map(toSlot);
  }

  async openSlots(query: {
    cohortId: string;
    from: Date;
    to: Date;
    limit: number;
  }): Promise<OpenSlotRow[]> {
    const rows = await this.sql<
      { id: string; mentor_name: string; starts_at: Date; minutes: number }[]
    >`
      select s.id, st.name as mentor_name, s.starts_at, s.minutes
      from mentor_slots s join staff st on st.id = s.mentor_id and st.active
      where exists (select 1 from staff_cohorts sc
                    where sc.staff_id = s.mentor_id and sc.cohort_id = ${query.cohortId})
        and s.starts_at between ${query.from} and ${query.to}
        and not exists (select 1 from bookings b where b.slot_id = s.id and b.status = 'booked')
      order by s.starts_at, s.id limit ${query.limit}`;
    return rows.map((r) => ({
      id: r.id,
      mentorName: r.mentor_name,
      startsAt: r.starts_at.toISOString(),
      minutes: r.minutes,
    }));
  }

  async book(input: {
    slotId: string;
    learnerId: string;
    topic: BookingTopic;
    note: string;
    now: Date;
    maxUpcoming: number;
  }): ReturnType<BookingRepo['book']> {
    return this.sql.begin(async (tx) => {
      // The learner row is the lock: one student's bookings are counted one at a time.
      await tx`select id from learners where id = ${input.learnerId} for update`;
      // The share lock holds the slot until this commits, so a mentor removing it waits.
      const [slot] = await tx<{ link: string | null }[]>`
        select link from mentor_slots where id = ${input.slotId} for share`;
      if (!slot) return { result: 'missing' as const, id: null };
      const [live] = await tx`
        select 1 from bookings where slot_id = ${input.slotId} and status = 'booked'`;
      if (live) return { result: 'taken' as const, id: null };
      const [count] = await tx<{ n: number }[]>`
        select count(*)::int as n from bookings b join mentor_slots s on s.id = b.slot_id
        where b.learner_id = ${input.learnerId} and b.status = 'booked' and s.starts_at > ${input.now}`;
      if ((count?.n ?? 0) >= input.maxUpcoming) return { result: 'limit' as const, id: null };
      // The partial unique index decides when two different students race for one slot.
      const [made] = await tx<{ id: string }[]>`
        insert into bookings (slot_id, learner_id, topic, note, link)
        values (${input.slotId}, ${input.learnerId}, ${input.topic}, ${input.note}, ${slot.link})
        on conflict (slot_id) where status = 'booked' do nothing
        returning id`;
      return made
        ? { result: 'booked' as const, id: made.id }
        : { result: 'taken' as const, id: null };
    });
  }

  private bookings(): ReturnType<Sql> {
    return this.sql`
      select b.id, b.learner_id, s.starts_at, s.minutes, st.name as mentor_name, b.topic, b.link
      from bookings b join mentor_slots s on s.id = b.slot_id
        left join staff st on st.id = s.mentor_id`;
  }

  async bookingsOf(learnerId: string, now: Date, limit: number): Promise<BookingRow[]> {
    const rows = await this.sql<BookingSql[]>`
      ${this.bookings()}
      where b.learner_id = ${learnerId} and b.status = 'booked'
        and s.starts_at + make_interval(mins => s.minutes) > ${now}
      order by s.starts_at, b.id limit ${limit}`;
    return rows.map(toBooking);
  }

  async getBooking(id: string, learnerId: string): Promise<BookingRow | null> {
    const [row] = await this.sql<BookingSql[]>`
      ${this.bookings()}
      where b.id = ${id} and b.learner_id = ${learnerId} and b.status = 'booked'`;
    return row ? toBooking(row) : null;
  }

  async exportFor(learnerId: string): Promise<ExportedBooking[]> {
    const rows = await this.sql<
      {
        starts_at: Date;
        minutes: number;
        mentor_name: string | null;
        topic: BookingTopic;
        note: string;
        status: 'booked' | 'cancelled';
      }[]
    >`select s.starts_at, s.minutes, st.name as mentor_name, b.topic, b.note, b.status
      from bookings b join mentor_slots s on s.id = b.slot_id
        left join staff st on st.id = s.mentor_id
      where b.learner_id = ${learnerId} order by s.starts_at, b.id`;
    return rows.map((r) => ({
      startsAt: r.starts_at.toISOString(),
      minutes: r.minutes,
      mentorName: r.mentor_name,
      topic: r.topic,
      note: r.note,
      status: r.status,
    }));
  }

  async cancel(id: string, learnerId: string): Promise<boolean> {
    const done = await this.sql`
      update bookings set status = 'cancelled'
      where id = ${id} and learner_id = ${learnerId} and status = 'booked' returning id`;
    return done.length > 0;
  }
}
