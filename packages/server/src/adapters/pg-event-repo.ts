import type { LearnerEvent } from '@shiksha/learner-core';
import type { EventRepo } from '../ports.js';
import type { Sql } from './pg.js';

interface EventRow {
  seq: string;
  id: string;
  learner_id: string;
  type: string;
  at: Date;
  data: unknown;
}

const toEvent = (row: EventRow): LearnerEvent & { seq: number } =>
  ({
    seq: Number(row.seq),
    id: row.id,
    learnerId: row.learner_id,
    type: row.type,
    at: row.at.toISOString(),
    data: row.data,
  }) as LearnerEvent & { seq: number };

export class PgEventRepo implements EventRepo {
  constructor(private readonly sql: Sql) {}

  /** One statement for the whole batch: the rows travel as one JSON parameter. */
  async insertMany(
    learnerId: string,
    events: LearnerEvent[],
  ): Promise<{ inserted: string[]; ownedByOthers: string[] }> {
    const rows = events.map((e) => ({ id: e.id, type: e.type, at: e.at, data: e.data }));
    // One writer per learner at a time: a pull can then never pass an event whose sequence number
    // was taken before a later one committed, and summary refreshes see every committed row.
    const inserted = await this.sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(hashtext(${learnerId}))`;
      return tx<{ id: string }[]>`
        insert into learner_events (id, learner_id, type, at, data)
        select x.id, ${learnerId}, x.type, x.at, x.data
        from jsonb_to_recordset(${tx.json(rows)}) as x(id uuid, type text, at timestamptz, data jsonb)
        on conflict (id) do nothing
        returning id`;
    });
    const insertedIds = inserted.map((r) => r.id);
    const rest = events.map((e) => e.id).filter((id) => !insertedIds.includes(id));
    if (rest.length === 0) return { inserted: insertedIds, ownedByOthers: [] };
    const others = await this.sql<{ id: string }[]>`
      select id from learner_events
      where id in (select value::uuid from jsonb_array_elements_text(${this.sql.json(rest)}))
        and learner_id <> ${learnerId}`;
    return { inserted: insertedIds, ownedByOthers: others.map((r) => r.id) };
  }

  async page(
    learnerId: string,
    after: number,
    limit: number,
  ): Promise<{ events: (LearnerEvent & { seq: number })[] }> {
    const rows = await this.sql<EventRow[]>`
      select seq::text as seq, id, learner_id, type, at, data from learner_events
      where learner_id = ${learnerId} and seq > ${after}
        and tx_id < pg_snapshot_xmin(pg_current_snapshot())
      order by seq
      limit ${limit}`;
    return { events: rows.map(toEvent) };
  }
}
