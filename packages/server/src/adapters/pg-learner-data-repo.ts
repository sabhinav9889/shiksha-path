import type { LearnerEvent } from '@shiksha/learner-core';
import type { LearnerDataRepo, LearnerRows } from '../ports.js';
import type { Sql } from './pg.js';

export class PgLearnerDataRepo implements LearnerDataRepo {
  constructor(private readonly sql: Sql) {}

  async rows(learnerId: string): Promise<LearnerRows | null> {
    const [learner] = await this.sql<
      { id: string; name: string; cohort_id: string | null; created_at: Date }[]
    >`select id, name, cohort_id, created_at from learners where id = ${learnerId}`;
    if (!learner) return null;
    const identities = await this.sql<{ auth_user_id: string }[]>`
      select auth_user_id from learner_identities where learner_id = ${learnerId}
      union select auth_user_id from login_codes where learner_id = ${learnerId}`;
    const events = await this.sql<LearnerEvent[]>`
      select id, learner_id as "learnerId", type, at, data from learner_events
      where learner_id = ${learnerId} order by seq`;
    const overrides = await this.sql<{ key: string; enabled: boolean }[]>`
      select key, enabled from feature_overrides where learner_id = ${learnerId}`;
    return {
      learner: {
        id: learner.id,
        name: learner.name,
        cohortId: learner.cohort_id,
        createdAt: learner.created_at.toISOString(),
      },
      authUserIds: identities.map((r) => r.auth_user_id),
      events: events.map((e) => ({ ...e, at: new Date(e.at).toISOString() })),
      overrides: Object.fromEntries(overrides.map((o) => [o.key, o.enabled])),
    };
  }

  async deleteWithTombstone(learnerId: string): Promise<{ events: number }> {
    return this.sql.begin(async (tx) => {
      const [counted] = await tx<{ n: number }[]>`
        select count(*)::int as n from learner_events where learner_id = ${learnerId}`;
      await tx`delete from learners where id = ${learnerId}`;
      await tx`insert into deleted_learners (id) values (${learnerId}) on conflict (id) do nothing`;
      return { events: counted?.n ?? 0 };
    });
  }

  async deleted(ids: string[]): Promise<string[]> {
    if (ids.length === 0) return [];
    const rows = await this.sql<{ id: string }[]>`
      select id from deleted_learners
      where id in (select value::uuid from jsonb_array_elements_text(${this.sql.json(ids)}))`;
    return rows.map((r) => r.id);
  }
}
