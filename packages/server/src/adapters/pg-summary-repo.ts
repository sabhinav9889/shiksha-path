import type { SummaryRepo } from '../ports.js';
import type { Summary } from '../services/summary.js';
import type { Sql } from './pg.js';

export class PgSummaryRepo implements SummaryRepo {
  constructor(private readonly sql: Sql) {}

  /** Under a per-learner lock (the same one inserts take), so the last refresh sees everything. */
  async refresh(learnerId: string, derive: (events: unknown[]) => Summary): Promise<Summary> {
    return this.sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(hashtext(${learnerId}))`;
      const log = await tx<{ at: Date }[]>`
        select id, learner_id as "learnerId", type, at, data from learner_events
        where learner_id = ${learnerId} order by seq`;
      const summary = derive(log.map((e) => ({ ...e, at: new Date(e.at).toISOString() })));
      await tx`
        insert into learner_summaries (learner_id, summary) values (${learnerId}, ${tx.json(summary as unknown as Parameters<typeof tx.json>[0])})
        on conflict (learner_id) do update set summary = excluded.summary`;
      return summary;
    });
  }

  async forLearners(ids: string[]): Promise<Map<string, Summary>> {
    if (ids.length === 0) return new Map();
    const rows = await this.sql<{ learner_id: string; summary: Summary }[]>`
      select learner_id, summary from learner_summaries
      where learner_id in (select value::uuid from jsonb_array_elements_text(${this.sql.json(ids)}))`;
    return new Map(rows.map((r) => [r.learner_id, r.summary]));
  }
}
