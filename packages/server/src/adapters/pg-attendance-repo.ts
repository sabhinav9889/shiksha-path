import type { AttendanceRepo } from '../ports.js';
import type { Sql } from './pg.js';

export class PgAttendanceRepo implements AttendanceRepo {
  constructor(private readonly sql: Sql) {}

  async markDay(input: {
    learnerIds: string[];
    present: ReadonlySet<string>;
    day: string;
    staffId: string;
  }): Promise<number> {
    const rows = input.learnerIds.map((id) => ({ id, present: input.present.has(id) }));
    const written = await this.sql`
      insert into lab_attendance (learner_id, day, present, marked_by)
      select x.id, ${input.day}::date, x.present, ${input.staffId}
      from jsonb_to_recordset(${this.sql.json(rows)}) as x(id uuid, present boolean)
      on conflict (learner_id, day)
        do update set present = excluded.present, marked_by = excluded.marked_by
      returning learner_id`;
    return written.length;
  }

  async forLearner(
    learnerId: string,
    fromDay: string,
  ): Promise<{ date: string; present: boolean }[]> {
    const rows = await this.sql<{ date: string; present: boolean }[]>`
      select to_char(day, 'YYYY-MM-DD') as date, present from lab_attendance
      where learner_id = ${learnerId} and day >= ${fromDay}::date
      order by day desc`;
    return [...rows];
  }
}
